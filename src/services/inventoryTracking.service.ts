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
  Product,
} from "../models/product.model";

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
  activeProducts: number;
  issues: string[];
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
    products,
    recipes,
  ] =
    await Promise.all([
      isInventoryTrackingEnabled(),

      Ingredient.countDocuments({
        active: true,
      }),

      Product.find({
        active: true,
      })
        .select(
          "_id legacyId name choiceGroups",
        )
        .lean(),

      ProductRecipe.find({
        active: true,
        "baseItems.0": {
          $exists: true,
        },
      })
        .select(
          "product baseItems choiceModifiers",
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

  const issues:
    string[] = [];

  for (const product of products) {
    const recipe =
      recipesByProduct.get(
        product._id.toString(),
      );

    if (!recipe) {
      issues.push(
        `${product.name}: falta una receta activa con insumos base.`,
      );

      continue;
    }

    const choiceKeys =
      new Set(
        (
          recipe.choiceModifiers ??
          []
        )
          .filter(
            (modifier) =>
              modifier.items.length >
              0,
          )
          .map(
            (modifier) =>
              `${modifier.groupId}:${modifier.optionId}`,
          ),
      );

    for (
      const group of
      product.choiceGroups
    ) {
      for (const option of group.options) {
        if (
          option.productLegacyId
        ) {
          const linkedProduct =
            productsByLegacyId.get(
              option.productLegacyId,
            );

          if (
            !linkedProduct ||
            !recipesByProduct.has(
              linkedProduct._id.toString(),
            )
          ) {
            issues.push(
              `${product.name} - ${group.label} / ${option.label}: falta la receta del producto vinculado.`,
            );
          }

          continue;
        }

        if (
          !choiceKeys.has(
            `${group.id}:${option.id}`,
          )
        ) {
          issues.push(
            `${product.name} - ${group.label} / ${option.label}: falta indicar qué insumo consume esta opción.`,
          );
        }
      }
    }
  }

  const configuredRecipes =
    recipes.length;

  return {
    enabled,

    readyToEnable:
      activeIngredients > 0 &&
      products.length > 0 &&
      issues.length === 0,

    activeIngredients,
    configuredRecipes,
    activeProducts:
      products.length,
    issues,
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
        currentStatus.issues[0] ??
          "Antes de activar el descuento automático, completá los insumos y las recetas de todos los productos activos.",
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
