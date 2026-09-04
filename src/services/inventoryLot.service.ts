import mongoose from "mongoose";

import type {
  ClientSession,
  Types,
} from "mongoose";

import {
  InventoryLot,
  type InventoryLotSource,
} from "../models/inventoryLot.model";

import type {
  InventoryLotConsumption,
} from "../models/inventoryMovement.model";

const QUANTITY_TOLERANCE =
  0.000001;

export type CreateInventoryLotData = {
  ingredient: Types.ObjectId;
  quantity: number;
  unitCost: number;
  source: InventoryLotSource;
  receivedAt?: Date;
  expirationDate?: Date;
  batchNumber?: string;
  purchase?: Types.ObjectId;
  supplier?: Types.ObjectId;
  supplierName?: string;
};

function normalizeQuantity(
  value: number,
): number {
  return Math.round(
    value * 1_000_000,
  ) / 1_000_000;
}

export async function createInventoryLot(
  data: CreateInventoryLotData,
  session: ClientSession,
): Promise<Types.ObjectId> {
  const [lot] =
    await InventoryLot.create(
      [
        {
          ingredient:
            data.ingredient,
          purchase:
            data.purchase,
          supplier:
            data.supplier,
          supplierName:
            data.supplierName,
          batchNumber:
            data.batchNumber,
          receivedAt:
            data.receivedAt ??
            new Date(),
          expirationDate:
            data.expirationDate,
          initialQuantity:
            data.quantity,
          remainingQuantity:
            data.quantity,
          unitCost:
            data.unitCost,
          source:
            data.source,
        },
      ],
      {
        session,
      },
    );

  if (!lot) {
    throw new Error(
      "No se pudo crear el lote de inventario.",
    );
  }

  return lot._id;
}

async function reconcileLegacyStock(
  ingredient:
    Types.ObjectId,
  currentStock: number,
  unitCost: number,
  session: ClientSession,
): Promise<void> {
  const totals =
    await InventoryLot.aggregate<{
      total: number;
    }>([
      {
        $match: {
          ingredient:
            new mongoose.Types.ObjectId(
              ingredient,
            ),
          remainingQuantity: {
            $gt: 0,
          },
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum:
              "$remainingQuantity",
          },
        },
      },
    ]).session(session);

  const tracked =
    totals[0]?.total ?? 0;

  const untracked =
    normalizeQuantity(
      currentStock - tracked,
    );

  if (
    untracked >
    QUANTITY_TOLERANCE
  ) {
    await createInventoryLot(
      {
        ingredient,
        quantity:
          untracked,
        unitCost,
        source:
          "legacy",
        receivedAt:
          new Date(0),
      },
      session,
    );
  }

  if (
    untracked <
    -QUANTITY_TOLERANCE
  ) {
    throw new Error(
      "Los lotes del insumo no coinciden con su stock. Realizá un conteo físico antes de continuar.",
    );
  }
}

export async function consumeInventoryLots(
  ingredient:
    Types.ObjectId,
  quantity: number,
  currentStock: number,
  unitCost: number,
  session: ClientSession,
): Promise<InventoryLotConsumption[]> {
  await reconcileLegacyStock(
    ingredient,
    currentStock,
    unitCost,
    session,
  );

  const lots =
    await InventoryLot.find({
      ingredient,
      remainingQuantity: {
        $gt: 0,
      },
    })
      .sort({
        receivedAt: 1,
        createdAt: 1,
      })
      .session(session);

  lots.sort(
    (left, right) => {
      const leftExpiration =
        left.expirationDate
          ?.getTime() ??
        Number.POSITIVE_INFINITY;
      const rightExpiration =
        right.expirationDate
          ?.getTime() ??
        Number.POSITIVE_INFINITY;

      if (
        leftExpiration !==
        rightExpiration
      ) {
        return (
          leftExpiration -
          rightExpiration
        );
      }

      return (
        left.receivedAt.getTime() -
        right.receivedAt.getTime()
      );
    },
  );

  let remaining =
    quantity;

  const consumed:
    InventoryLotConsumption[] = [];

  for (const lot of lots) {
    if (
      remaining <=
      QUANTITY_TOLERANCE
    ) {
      break;
    }

    const used =
      Math.min(
        lot.remainingQuantity,
        remaining,
      );

    lot.remainingQuantity =
      normalizeQuantity(
        lot.remainingQuantity -
          used,
      );

    await lot.save({
      session,
    });

    consumed.push({
      lot:
        lot._id,
      quantity:
        normalizeQuantity(
          used,
        ),
    });

    remaining =
      normalizeQuantity(
        remaining - used,
      );
  }

  if (
    remaining >
    QUANTITY_TOLERANCE
  ) {
    throw new Error(
      "No hay lotes suficientes para respaldar el movimiento de stock.",
    );
  }

  return consumed;
}

export async function restoreInventoryLots(
  consumptions:
    InventoryLotConsumption[],
  session: ClientSession,
): Promise<void> {
  for (
    const consumption of
    consumptions
  ) {
    const updated =
      await InventoryLot.findByIdAndUpdate(
        consumption.lot,
        {
          $inc: {
            remainingQuantity:
              consumption.quantity,
          },
        },
        {
          session,
          new: true,
          runValidators: true,
        },
      );

    if (!updated) {
      throw new Error(
        "No se pudo restaurar uno de los lotes consumidos.",
      );
    }
  }
}
