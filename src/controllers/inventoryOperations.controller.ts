import mongoose from "mongoose";

import type {
  Request,
  Response,
} from "express";

import {
  Ingredient,
} from "../models/ingredient.model";

import {
  InventoryCount,
} from "../models/inventoryCount.model";

import {
  InventoryLot,
} from "../models/inventoryLot.model";

import {
  InventoryMovement,
} from "../models/inventoryMovement.model";

import type {
  InventoryLotConsumption,
} from "../models/inventoryMovement.model";

import {
  InventoryPurchase,
  type InventoryPurchaseLine,
} from "../models/inventoryPurchase.model";

import {
  Order,
} from "../models/order.model";

import {
  Product,
} from "../models/product.model";

import {
  ProductRecipe,
} from "../models/productRecipe.model";

import {
  Supplier,
} from "../models/supplier.model";

import {
  addRecipeConsumption,
  type IngredientRequirements,
} from "../services/orderInventory.service";

import {
  consumeInventoryLots,
  createInventoryLot,
} from "../services/inventoryLot.service";

import {
  isInventoryTrackingEnabled,
} from "../services/inventoryTracking.service";

class InventoryOperationError
  extends Error {
  statusCode: number;

  constructor(
    statusCode: number,
    message: string,
  ) {
    super(message);
    this.name =
      "InventoryOperationError";
    this.statusCode =
      statusCode;
  }
}

function getString(
  value: unknown,
): string | undefined {
  if (
    typeof value !== "string"
  ) {
    return undefined;
  }

  const normalized =
    value.trim();

  return normalized ||
    undefined;
}

function getPositiveNumber(
  value: unknown,
): number | null {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
  )
    ? value
    : null;
}

function getNonNegativeNumber(
  value: unknown,
): number | null {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
  )
    ? value
    : null;
}

function getDate(
  value: unknown,
): Date | undefined {
  if (
    typeof value !== "string" ||
    !value
  ) {
    return undefined;
  }

  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime(),
  )
    ? undefined
    : date;
}

function getActor(
  response: Response,
): {
  id: string;
  email: string;
} {
  const admin =
    response.locals.admin;

  if (
    !admin?.id ||
    !admin?.email
  ) {
    throw new InventoryOperationError(
      401,
      "La sesión administrativa no es válida.",
    );
  }

  return admin;
}

function rounded(
  value: number,
): number {
  return Math.round(
    value * 1_000_000,
  ) / 1_000_000;
}

function money(
  value: number,
): number {
  return Math.round(
    value * 100,
  ) / 100;
}

function sendOperationError(
  error: unknown,
  response: Response,
  fallback: string,
): void {
  if (
    error instanceof
    InventoryOperationError
  ) {
    response.status(
      error.statusCode,
    ).json({
      success: false,
      message:
        error.message,
    });

    return;
  }

  console.error(
    fallback,
    error,
  );

  response.status(500).json({
    success: false,
    message:
      fallback,
  });
}

/* ========================================
   PROVEEDORES
======================================== */

export async function getSuppliers(
  _request: Request,
  response: Response,
): Promise<void> {
  try {
    const suppliers =
      await Supplier.find()
        .sort({
          active: -1,
          name: 1,
        })
        .lean();

    response.status(200).json({
      success: true,
      data: suppliers,
    });
  } catch (error) {
    sendOperationError(
      error,
      response,
      "No se pudieron cargar los proveedores.",
    );
  }
}

export async function createSupplier(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const name =
      getString(
        request.body?.name,
      );

    if (!name) {
      throw new InventoryOperationError(
        400,
        "El nombre del proveedor es obligatorio.",
      );
    }

    const duplicate =
      await Supplier.findOne({
        name: {
          $regex:
            `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          $options:
            "i",
        },
      });

    if (duplicate) {
      throw new InventoryOperationError(
        409,
        "Ya existe un proveedor con ese nombre.",
      );
    }

    const supplier =
      await Supplier.create({
        name,
        contactName:
          getString(
            request.body
              ?.contactName,
          ),
        phone:
          getString(
            request.body?.phone,
          ),
        email:
          getString(
            request.body?.email,
          )?.toLowerCase(),
        notes:
          getString(
            request.body?.notes,
          ),
        active: true,
      });

    response.status(201).json({
      success: true,
      message:
        "Proveedor creado.",
      data: supplier,
    });
  } catch (error) {
    sendOperationError(
      error,
      response,
      "No se pudo crear el proveedor.",
    );
  }
}

export async function updateSupplier(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const supplierId =
      typeof request.params.id ===
      "string"
        ? request.params.id
        : "";

    if (
      !mongoose.Types.ObjectId.isValid(
        supplierId,
      )
    ) {
      throw new InventoryOperationError(
        400,
        "El proveedor indicado no es válido.",
      );
    }

    const supplier =
      await Supplier.findById(
        supplierId,
      );

    if (!supplier) {
      throw new InventoryOperationError(
        404,
        "El proveedor no existe.",
      );
    }

    for (
      const field of [
        "contactName",
        "phone",
        "email",
        "notes",
      ] as const
    ) {
      if (
        request.body?.[field] !==
        undefined
      ) {
        supplier[field] =
          getString(
            request.body[field],
          );
      }
    }

    if (
      typeof request.body
        ?.active === "boolean"
    ) {
      supplier.active =
        request.body.active;
    }

    await supplier.save();

    response.status(200).json({
      success: true,
      message:
        "Proveedor actualizado.",
      data: supplier,
    });
  } catch (error) {
    sendOperationError(
      error,
      response,
      "No se pudo actualizar el proveedor.",
    );
  }
}

/* ========================================
   COMPRAS Y REPOSICIÓN
======================================== */

export async function createPurchase(
  request: Request,
  response: Response,
): Promise<void> {
  const session =
    await mongoose.startSession();

  try {
    const actor =
      getActor(response);

    const rawLines =
      request.body?.lines;

    if (
      !Array.isArray(rawLines) ||
      rawLines.length === 0
    ) {
      throw new InventoryOperationError(
        400,
        "La compra debe tener al menos un insumo.",
      );
    }

    const supplierId =
      getString(
        request.body
          ?.supplierId,
      );

    const supplier =
      supplierId &&
      mongoose.Types.ObjectId.isValid(
        supplierId,
      )
        ? await Supplier.findById(
            supplierId,
          ).lean()
        : null;

    if (
      supplierId &&
      !supplier
    ) {
      throw new InventoryOperationError(
        400,
        "El proveedor seleccionado no existe.",
      );
    }

    const ingredientIds = [
      ...new Set(
        rawLines.map(
          (line) =>
            getString(
              line?.ingredientId,
            ) ?? "",
        ),
      ),
    ];

    if (
      ingredientIds.some(
        (id) =>
          !mongoose.Types.ObjectId.isValid(
            id,
          ),
      )
    ) {
      throw new InventoryOperationError(
        400,
        "La compra contiene un insumo inválido.",
      );
    }

    const ingredients =
      await Ingredient.find({
        _id: {
          $in:
            ingredientIds,
        },
        active: true,
      });

    const ingredientsById =
      new Map(
        ingredients.map(
          (ingredient) => [
            ingredient._id.toString(),
            ingredient,
          ],
        ),
      );

    if (
      ingredientsById.size !==
      ingredientIds.length
    ) {
      throw new InventoryOperationError(
        400,
        "Uno o más insumos no existen o están inactivos.",
      );
    }

    const purchasedAt =
      getDate(
        request.body
          ?.purchasedAt,
      ) ?? new Date();

    const purchase =
      new InventoryPurchase({
        supplier:
          supplier?._id,
        supplierName:
          supplier?.name,
        invoiceNumber:
          getString(
            request.body
              ?.invoiceNumber,
          ),
        purchasedAt,
        lines: [],
        totalCost: 0,
        notes:
          getString(
            request.body?.notes,
          ),
        createdBy:
          actor.id,
        createdByEmail:
          actor.email,
      });

    const parsedLines:
      InventoryPurchaseLine[] = [];

    let purchaseTotal = 0;

    for (const rawLine of rawLines) {
      const ingredientId =
        getString(
          rawLine
            ?.ingredientId,
        ) as string;

      const ingredient =
        ingredientsById.get(
          ingredientId,
        );

      if (!ingredient) {
        throw new InventoryOperationError(
          400,
          "La compra contiene un insumo inválido.",
        );
      }

      const presentationQuantity =
        getPositiveNumber(
          rawLine
            ?.presentationQuantity,
        );

      const conversionFactor =
        getPositiveNumber(
          rawLine
            ?.conversionFactor ??
            ingredient
              .purchaseUnitFactor,
        );

      const totalCost =
        getNonNegativeNumber(
          rawLine?.totalCost,
        );

      if (
        presentationQuantity ===
          null ||
        conversionFactor === null ||
        totalCost === null
      ) {
        throw new InventoryOperationError(
          400,
          `Revisá cantidad, conversión y costo de ${ingredient.name}.`,
        );
      }

      const baseQuantity =
        rounded(
          presentationQuantity *
            conversionFactor,
        );

      const lineUnitCost =
        money(
          totalCost /
            baseQuantity,
        );

      parsedLines.push({
        ingredient:
          ingredient._id,
        ingredientName:
          ingredient.name,
        presentationQuantity,
        presentationLabel:
          getString(
            rawLine
              ?.presentationLabel,
          ) ??
          ingredient
            .purchaseUnitLabel ??
          ingredient.unit,
        conversionFactor,
        baseQuantity,
        totalCost,
        unitCost:
          lineUnitCost,
        batchNumber:
          getString(
            rawLine
              ?.batchNumber,
          ),
        expirationDate:
          getDate(
            rawLine
              ?.expirationDate,
          ),
      });

      purchaseTotal +=
        totalCost;
    }

    purchase.lines =
      parsedLines;
    purchase.totalCost =
      money(purchaseTotal);

    await session.withTransaction(
      async () => {
        await purchase.save({
          session,
        });

        for (const line of parsedLines) {
          const ingredient =
            await Ingredient.findById(
              line.ingredient,
            ).session(session);

          if (!ingredient) {
            throw new InventoryOperationError(
              409,
              "Uno de los insumos dejó de estar disponible.",
            );
          }

          const previousStock =
            ingredient.stock;
          const newStock =
            rounded(
              previousStock +
                line.baseQuantity,
            );

          const weightedCost =
            newStock > 0
              ? money(
                  (
                    previousStock *
                      ingredient.unitCost +
                    line.totalCost
                  ) /
                    newStock,
                )
              : line.unitCost;

          ingredient.stock =
            newStock;
          ingredient.unitCost =
            weightedCost;

          await ingredient.save({
            session,
          });

          await createInventoryLot(
            {
              ingredient:
                ingredient._id,
              quantity:
                line.baseQuantity,
              unitCost:
                line.unitCost,
              source:
                "purchase",
              receivedAt:
                purchasedAt,
              expirationDate:
                line.expirationDate,
              batchNumber:
                line.batchNumber,
              purchase:
                purchase._id,
              supplier:
                supplier?._id,
              supplierName:
                supplier?.name,
            },
            session,
          );

          await InventoryMovement.create(
            [
              {
                ingredient:
                  ingredient._id,
                purchase:
                  purchase._id,
                performedBy:
                  actor.id,
                performedByEmail:
                  actor.email,
                type:
                  "restock",
                change:
                  line.baseQuantity,
                previousStock,
                newStock,
                unitCost:
                  line.unitCost,
                estimatedCost:
                  line.totalCost,
                note:
                  supplier?.name
                    ? `Compra a ${supplier.name}`
                    : "Compra registrada",
                lotConsumptions:
                  [],
              },
            ],
            {
              session,
            },
          );
        }
      },
    );

    response.status(201).json({
      success: true,
      message:
        "Compra registrada y stock actualizado.",
      data: purchase,
    });
  } catch (error) {
    sendOperationError(
      error,
      response,
      "No se pudo registrar la compra.",
    );
  } finally {
    await session.endSession();
  }
}

export async function getPurchases(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const limit =
      Math.min(
        Math.max(
          Number(
            request.query.limit ??
              30,
          ) || 30,
          1,
        ),
        200,
      );

    const purchases =
      await InventoryPurchase.find()
        .sort({
          purchasedAt: -1,
        })
        .limit(limit)
        .lean();

    const data =
      response.locals.admin
        ?.role === "owner"
        ? purchases
        : purchases.map(
            (purchase) => ({
              ...purchase,
              totalCost: undefined,
              lines:
                purchase.lines.map(
                  (line) => ({
                    ...line,
                    unitCost:
                      undefined,
                    totalCost:
                      undefined,
                  }),
                ),
            }),
          );

    response.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    sendOperationError(
      error,
      response,
      "No se pudieron cargar las compras.",
    );
  }
}

/* ========================================
   CONTEO FÍSICO / CIERRE
======================================== */

export async function createInventoryCount(
  request: Request,
  response: Response,
): Promise<void> {
  const session =
    await mongoose.startSession();

  try {
    const actor =
      getActor(response);

    if (
      !Array.isArray(
        request.body?.items,
      ) ||
      request.body.items.length ===
        0
    ) {
      throw new InventoryOperationError(
        400,
        "Ingresá al menos un conteo de stock.",
      );
    }

    const countedAt =
      getDate(
        request.body
          ?.countedAt,
      ) ?? new Date();

    let savedCount:
      InstanceType<
        typeof InventoryCount
      > | null = null;

    await session.withTransaction(
      async () => {
        const ids =
          request.body.items.map(
            (item: unknown) =>
              getString(
                (
                  item as Record<
                    string,
                    unknown
                  >
                ).ingredientId,
              ) ?? "",
          );

        if (
          new Set(ids).size !==
            ids.length ||
          ids.some(
            (id: string) =>
              !mongoose.Types.ObjectId.isValid(
                id,
              ),
          )
        ) {
          throw new InventoryOperationError(
            400,
            "El conteo contiene insumos repetidos o inválidos.",
          );
        }

        const ingredients =
          await Ingredient.find({
            _id: {
              $in: ids,
            },
          }).session(session);

        const byId =
          new Map(
            ingredients.map(
              (ingredient) => [
                ingredient._id.toString(),
                ingredient,
              ],
            ),
          );

        if (
          byId.size !==
          ids.length
        ) {
          throw new InventoryOperationError(
            400,
            "Uno de los insumos del conteo ya no existe.",
          );
        }

        const count =
          new InventoryCount({
            countedAt,
            label:
              getString(
                request.body?.label,
              ),
            notes:
              getString(
                request.body?.notes,
              ),
            items: [],
            totalDifferenceCost:
              0,
            createdBy:
              actor.id,
            createdByEmail:
              actor.email,
          });

        let totalDifferenceCost =
          0;

        for (
          const rawItem of
          request.body.items
        ) {
          const ingredientId =
            getString(
              rawItem
                ?.ingredientId,
            ) as string;

          const countedStock =
            getNonNegativeNumber(
              rawItem
                ?.countedStock,
            );

          if (countedStock === null) {
            throw new InventoryOperationError(
              400,
              "Todos los conteos deben ser números iguales o mayores a cero.",
            );
          }

          const ingredient =
            byId.get(
              ingredientId,
            )!;

          const expectedStock =
            ingredient.stock;
          const difference =
            rounded(
              countedStock -
                expectedStock,
            );
          const differenceCost =
            money(
              difference *
                ingredient.unitCost,
            );

          count.items.push({
            ingredient:
              ingredient._id,
            ingredientName:
              ingredient.name,
            expectedStock,
            countedStock,
            difference,
            unitCost:
              ingredient.unitCost,
            estimatedDifferenceCost:
              differenceCost,
          });

          totalDifferenceCost +=
            differenceCost;

          if (difference === 0) {
            continue;
          }

          let lotConsumptions:
            InventoryLotConsumption[] =
            [];

          if (difference < 0) {
            lotConsumptions =
              await consumeInventoryLots(
                ingredient._id,
                Math.abs(
                  difference,
                ),
                expectedStock,
                ingredient.unitCost,
                session,
              );
          } else {
            await createInventoryLot(
              {
                ingredient:
                  ingredient._id,
                quantity:
                  difference,
                unitCost:
                  ingredient.unitCost,
                source:
                  "adjustment",
              },
              session,
            );
          }

          ingredient.stock =
            countedStock;
          await ingredient.save({
            session,
          });

          await InventoryMovement.create(
            [
              {
                ingredient:
                  ingredient._id,
                inventoryCount:
                  count._id,
                performedBy:
                  actor.id,
                performedByEmail:
                  actor.email,
                type:
                  "adjustment",
                change:
                  difference,
                previousStock:
                  expectedStock,
                newStock:
                  countedStock,
                unitCost:
                  ingredient.unitCost,
                estimatedCost:
                  Math.abs(
                    differenceCost,
                  ),
                note:
                  count.label ||
                  "Conteo físico",
                lotConsumptions,
              },
            ],
            {
              session,
            },
          );
        }

        count.totalDifferenceCost =
          money(
            totalDifferenceCost,
          );
        await count.save({
          session,
        });

        savedCount =
          count;
      },
    );

    response.status(201).json({
      success: true,
      message:
        "Conteo guardado y diferencias aplicadas.",
      data:
        savedCount,
    });
  } catch (error) {
    sendOperationError(
      error,
      response,
      "No se pudo guardar el conteo físico.",
    );
  } finally {
    await session.endSession();
  }
}

export async function getInventoryCounts(
  _request: Request,
  response: Response,
): Promise<void> {
  try {
    const counts =
      await InventoryCount.find()
        .sort({
          countedAt: -1,
        })
        .limit(50)
        .lean();

    const data =
      response.locals.admin
        ?.role === "owner"
        ? counts
        : counts.map(
            (count) => ({
              ...count,
              totalDifferenceCost:
                undefined,
              items:
                count.items.map(
                  (item) => ({
                    ...item,
                    unitCost:
                      undefined,
                    estimatedDifferenceCost:
                      undefined,
                  }),
                ),
            }),
          );

    response.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    sendOperationError(
      error,
      response,
      "No se pudieron cargar los conteos.",
    );
  }
}

/* ========================================
   ALERTAS, LOTES Y LISTA DE COMPRAS
======================================== */

export async function getInventoryAlerts(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const requestedDays =
      Number(
        request.query.days ?? 7,
      );
    const days =
      Number.isFinite(
        requestedDays,
      )
        ? Math.min(
            Math.max(
              requestedDays,
              1,
            ),
            90,
          )
        : 7;

    const now =
      new Date();
    const until =
      new Date(
        now.getTime() +
          days *
            24 *
            60 *
            60 *
            1000,
      );

    const [
      ingredients,
      expiringLots,
    ] =
      await Promise.all([
        Ingredient.find({
          active: true,
        })
          .sort({
            name: 1,
          })
          .lean(),
        InventoryLot.find({
          remainingQuantity: {
            $gt: 0,
          },
          expirationDate: {
            $lte: until,
          },
        })
          .populate(
            "ingredient",
            "name unit",
          )
          .sort({
            expirationDate: 1,
          })
          .lean(),
      ]);

    const lowStock =
      ingredients.filter(
        (ingredient) =>
          ingredient.stock <=
          ingredient.minimumStock,
      );

    const shoppingList =
      ingredients
        .map(
          (ingredient) => {
            const target =
              Math.max(
                ingredient
                  .targetStock ?? 0,
                ingredient
                  .minimumStock,
              );

            return {
              ingredientId:
                ingredient._id,
              name:
                ingredient.name,
              unit:
                ingredient.unit,
              currentStock:
                ingredient.stock,
              minimumStock:
                ingredient
                  .minimumStock,
              targetStock:
                target,
              suggestedQuantity:
                rounded(
                  Math.max(
                    target -
                      ingredient.stock,
                    0,
                  ),
                ),
            };
          },
        )
        .filter(
          (item) =>
            item.suggestedQuantity >
            0,
        );

    response.status(200).json({
      success: true,
      data: {
        lowStock,
        shoppingList,
        expiringLots:
          expiringLots.map(
            (lot) => ({
              ...lot,
              unitCost:
                response.locals.admin
                  ?.role === "owner"
                  ? lot.unitCost
                  : undefined,
            }),
          ),
        expirationWindowDays:
          days,
      },
    });
  } catch (error) {
    sendOperationError(
      error,
      response,
      "No se pudieron cargar las alertas de inventario.",
    );
  }
}

/* ========================================
   REPORTE DE COSTOS Y CONSUMO
======================================== */

export async function getInventoryReport(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const to =
      getDate(
        request.query.to,
      ) ?? new Date();
    to.setUTCHours(
      23,
      59,
      59,
      999,
    );

    const from =
      getDate(
        request.query.from,
      ) ??
      new Date(
        to.getTime() -
          29 *
            24 *
            60 *
            60 *
            1000,
      );
    from.setUTCHours(
      0,
      0,
      0,
      0,
    );

    if (from > to) {
      throw new InventoryOperationError(
        400,
        "La fecha desde no puede ser posterior a la fecha hasta.",
      );
    }

    const [
      movementTotals,
      ingredientConsumption,
      purchaseTotals,
      salesTotals,
      currentIngredients,
    ] =
      await Promise.all([
        InventoryMovement.aggregate<{
          _id: string;
          estimatedCost: number;
          movements: number;
        }>([
          {
            $match: {
              createdAt: {
                $gte: from,
                $lte: to,
              },
            },
          },
          {
            $group: {
              _id: "$type",
              estimatedCost: {
                $sum:
                  "$estimatedCost",
              },
              movements: {
                $sum: 1,
              },
            },
          },
        ]),
        InventoryMovement.aggregate<{
          _id: mongoose.Types.ObjectId;
          quantity: number;
          estimatedCost: number;
        }>([
          {
            $match: {
              type: "sale",
              createdAt: {
                $gte: from,
                $lte: to,
              },
            },
          },
          {
            $group: {
              _id:
                "$ingredient",
              quantity: {
                $sum: {
                  $abs:
                    "$change",
                },
              },
              estimatedCost: {
                $sum:
                  "$estimatedCost",
              },
            },
          },
          {
            $sort: {
              estimatedCost: -1,
            },
          },
        ]),
        InventoryPurchase.aggregate<{
          totalCost: number;
          purchases: number;
        }>([
          {
            $match: {
              purchasedAt: {
                $gte: from,
                $lte: to,
              },
            },
          },
          {
            $group: {
              _id: null,
              totalCost: {
                $sum:
                  "$totalCost",
              },
              purchases: {
                $sum: 1,
              },
            },
          },
        ]),
        Order.aggregate<{
          revenue: number;
          orders: number;
        }>([
          {
            $match: {
              status:
                "confirmed",
              inventoryDeductedAt: {
                $gte: from,
                $lte: to,
              },
            },
          },
          {
            $group: {
              _id: null,
              revenue: {
                $sum: "$total",
              },
              orders: {
                $sum: 1,
              },
            },
          },
        ]),
        Ingredient.find({
          active: true,
        })
          .select(
            "stock unitCost",
          )
          .lean(),
      ]);

    const ingredientIds =
      ingredientConsumption.map(
        (item) => item._id,
      );

    const ingredientNames =
      new Map(
        (
          await Ingredient.find({
            _id: {
              $in:
                ingredientIds,
            },
          })
            .select(
              "name unit",
            )
            .lean()
        ).map(
          (ingredient) => [
            ingredient._id.toString(),
            ingredient,
          ],
        ),
      );

    const totalsByType =
      Object.fromEntries(
        movementTotals.map(
          (item) => [
            item._id,
            {
              estimatedCost:
                money(
                  item.estimatedCost,
                ),
              movements:
                item.movements,
            },
          ],
        ),
      );

    const salesCost =
      totalsByType.sale
        ?.estimatedCost ?? 0;
    const revenue =
      salesTotals[0]
        ?.revenue ?? 0;

    response.status(200).json({
      success: true,
      data: {
        from,
        to,
        revenue:
          money(revenue),
        confirmedOrders:
          salesTotals[0]
            ?.orders ?? 0,
        estimatedSalesCost:
          money(salesCost),
        estimatedGrossMargin:
          money(
            revenue -
              salesCost,
          ),
        wasteCost:
          money(
            totalsByType.waste
              ?.estimatedCost ?? 0,
          ),
        adjustmentCost:
          money(
            totalsByType
              .adjustment
              ?.estimatedCost ?? 0,
          ),
        purchasesCost:
          money(
            purchaseTotals[0]
              ?.totalCost ?? 0,
          ),
        purchaseCount:
          purchaseTotals[0]
            ?.purchases ?? 0,
        inventoryValue:
          money(
            currentIngredients.reduce(
              (total, ingredient) =>
                total +
                ingredient.stock *
                  ingredient.unitCost,
              0,
            ),
          ),
        movementsByType:
          totalsByType,
        consumptionByIngredient:
          ingredientConsumption.map(
            (item) => ({
              ingredientId:
                item._id,
              name:
                ingredientNames.get(
                  item._id.toString(),
                )?.name ??
                "Insumo eliminado",
              unit:
                ingredientNames.get(
                  item._id.toString(),
                )?.unit,
              quantity:
                rounded(
                  item.quantity,
                ),
              estimatedCost:
                money(
                  item.estimatedCost,
                ),
            }),
          ),
      },
    });
  } catch (error) {
    sendOperationError(
      error,
      response,
      "No se pudo generar el reporte de inventario.",
    );
  }
}

/* ========================================
   DISPONIBILIDAD PÚBLICA DEL MENÚ
======================================== */

function requirementsAreAvailable(
  requirements:
    IngredientRequirements,
  ingredients:
    Map<
      string,
      {
        stock: number;
        active: boolean;
      }
    >,
): boolean {
  for (
    const [
      ingredientId,
      quantity,
    ] of requirements
  ) {
    const ingredient =
      ingredients.get(
        ingredientId,
      );

    if (
      !ingredient?.active ||
      ingredient.stock <
        quantity
    ) {
      return false;
    }
  }

  return true;
}

export async function getPublicAvailability(
  _request: Request,
  response: Response,
): Promise<void> {
  try {
    const products =
      await Product.find({
        active: true,
      })
        .select(
          "_id legacyId name sizes choiceGroups",
        )
        .lean();

    if (
      !await isInventoryTrackingEnabled()
    ) {
      response.status(200).json({
        success: true,
        trackingEnabled: false,
        data:
          products.map(
            (product) => ({
              productId:
                product._id,
              legacyId:
                product.legacyId,
              available: true,
            }),
          ),
      });

      return;
    }

    const [
      recipes,
      ingredientDocuments,
    ] =
      await Promise.all([
        ProductRecipe.find({
          active: true,
        }).lean(),
        Ingredient.find()
          .select(
            "stock active",
          )
          .lean(),
      ]);

    const recipesByProduct =
      new Map(
        recipes.map(
          (recipe) => [
            recipe.product.toString(),
            recipe,
          ],
        ),
      );

    const productsByLegacyId =
      new Map(
        products
          .filter(
            (product) =>
              product.legacyId !==
              undefined,
          )
          .map(
            (product) => [
              product.legacyId as number,
              product,
            ] as const,
          ),
      );

    const ingredients =
      new Map(
        ingredientDocuments.map(
          (ingredient) => [
            ingredient._id.toString(),
            ingredient,
          ],
        ),
      );

    const availability =
      products.map(
        (product) => {
          const recipe =
            recipesByProduct.get(
              product._id.toString(),
            );

          if (!recipe) {
            return {
              productId:
                product._id,
              legacyId:
                product.legacyId,
              available: false,
              reason:
                "configuration",
            };
          }

          const baseRequirements:
            IngredientRequirements =
            new Map();

          addRecipeConsumption(
            baseRequirements,
            recipe,
            {
              sizeId:
                product.sizes[0]
                  ?.id,
            },
            1,
          );

          let available =
            requirementsAreAvailable(
              baseRequirements,
              ingredients,
            );

          for (
            const group of
            product.choiceGroups
          ) {
            const hasAvailableOption =
              group.options.some(
                (option) => {
                  const optionRequirements =
                    new Map(
                      baseRequirements,
                    );

                  if (
                    option.productLegacyId
                  ) {
                    const linkedProduct =
                      productsByLegacyId.get(
                        option.productLegacyId,
                      );
                    const linkedRecipe =
                      linkedProduct
                        ? recipesByProduct.get(
                            linkedProduct._id.toString(),
                          )
                        : undefined;

                    if (!linkedRecipe) {
                      return false;
                    }

                    addRecipeConsumption(
                      optionRequirements,
                      linkedRecipe,
                      {
                        sizeId:
                          option.sizeId,
                      },
                      1,
                    );
                  } else {
                    addRecipeConsumption(
                      optionRequirements,
                      {
                        baseItems: [],
                        sizeModifiers: [],
                        extraModifiers: [],
                        choiceModifiers:
                          recipe.choiceModifiers ??
                          [],
                      },
                      {
                        choiceSelections: [
                          {
                            groupId:
                              group.id,
                            optionId:
                              option.id,
                          },
                        ],
                      },
                      1,
                    );
                  }

                  return requirementsAreAvailable(
                    optionRequirements,
                    ingredients,
                  );
                },
              );

            available =
              available &&
              hasAvailableOption;
          }

          return {
            productId:
              product._id,
            legacyId:
              product.legacyId,
            available,
            reason:
              available
                ? undefined
                : "stock",
          };
        },
      );

    response.status(200).json({
      success: true,
      trackingEnabled: true,
      data: availability,
    });
  } catch (error) {
    console.error(
      "No se pudo calcular la disponibilidad:",
      error,
    );

    response.status(500).json({
      success: false,
      message:
        "No se pudo consultar la disponibilidad del menú.",
    });
  }
}
