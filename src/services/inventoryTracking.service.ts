import type {
  ClientSession,
} from "mongoose";

import {
  Ingredient,
} from "../models/ingredient.model";

import {
  ProductRecipe,
} from "../models/productRecipe.model";

import {
  StoreSettings,
} from "../models/storeSettings.model";

/* ========================================
   TIPOS
======================================== */

export type InventoryTrackingStatus = {
  enabled: boolean;
  readyToEnable: boolean;
  activeIngredients: number;
  configuredRecipes: number;
};

/* ========================================
   ERROR CONTROLADO
======================================== */

export class InventoryTrackingSettingsError
  extends Error {
  statusCode: number;

  constructor(
    statusCode: number,
    message: string,
  ) {
    super(message);

    this.name =
      "InventoryTrackingSettingsError";

    this.statusCode =
      statusCode;
  }
}

/* ========================================
   CONSULTA PARA PEDIDOS
======================================== */

export async function isInventoryTrackingEnabled(
  session?: ClientSession,
): Promise<boolean> {
  const query =
    StoreSettings.findById(
      "main",
    )
      .select(
        "inventoryTrackingEnabled",
      )
      .lean();

  if (session) {
    query.session(
      session,
    );
  }

  const settings =
    await query;

  return (
    settings
      ?.inventoryTrackingEnabled ===
    true
  );
}

/* ========================================
   ESTADO PARA EL PANEL
======================================== */

export async function getInventoryTrackingStatus():
  Promise<InventoryTrackingStatus> {
  const [
    enabled,
    activeIngredients,
    configuredRecipes,
  ] =
    await Promise.all([
      isInventoryTrackingEnabled(),

      Ingredient.countDocuments({
        active: true,
      }),

      ProductRecipe.countDocuments({
        active: true,
        "baseItems.0": {
          $exists: true,
        },
      }),
    ]);

  return {
    enabled,

    readyToEnable:
      activeIngredients > 0 &&
      configuredRecipes > 0,

    activeIngredients,
    configuredRecipes,
  };
}

/* ========================================
   ACTIVAR O PAUSAR
======================================== */

export async function updateInventoryTrackingEnabled(
  enabled: boolean,
): Promise<InventoryTrackingStatus> {
  if (enabled) {
    const currentStatus =
      await getInventoryTrackingStatus();

    if (
      !currentStatus
        .readyToEnable
    ) {
      throw new InventoryTrackingSettingsError(
        409,
        "Antes de activar el descuento automático, cargá al menos un insumo activo y una receta activa.",
      );
    }
  }

  await StoreSettings.findByIdAndUpdate(
    "main",
    {
      $set: {
        inventoryTrackingEnabled:
          enabled,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );

  return getInventoryTrackingStatus();
}
