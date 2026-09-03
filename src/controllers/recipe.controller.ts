import type {
  Request,
  Response,
} from "express";

import mongoose from "mongoose";

import {
  Ingredient,
} from "../models/ingredient.model";

import {
  Product,
} from "../models/product.model";

import {
  ProductRecipe,
  type RecipeBaseItem,
  type RecipeModifierItem,
  type RecipeOptionModifier,
} from "../models/productRecipe.model";

/* ========================================
   TIPOS INTERNOS
======================================== */

type ParsedBaseItem = {
  ingredient: string;
  quantity: number;
  removableIngredient?: string;
};

type ParsedModifierItem = {
  ingredient: string;
  quantity: number;
};

type ParsedOptionModifier = {
  optionId: string;
  items: ParsedModifierItem[];
};

/* ========================================
   HELPERS
======================================== */

function getParam(
  value:
    | string
    | string[]
    | undefined,
): string | null {
  if (
    typeof value === "string"
  ) {
    return value;
  }

  if (
    Array.isArray(value) &&
    value.length > 0
  ) {
    return value[0] ?? null;
  }

  return null;
}

function getRequiredString(
  value: unknown,
): string | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized.length > 0
    ? normalized
    : null;
}

function getOptionalString(
  value: unknown,
): string | undefined {
  if (
    typeof value !== "string"
  ) {
    return undefined;
  }

  const normalized =
    value.trim();

  return normalized.length > 0
    ? normalized
    : undefined;
}

function isPositiveNumber(
  value: unknown,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
  );
}

function isNonZeroFiniteNumber(
  value: unknown,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value !== 0
  );
}

function parseBaseItems(
  value: unknown,
): ParsedBaseItem[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsedItems:
    ParsedBaseItem[] = [];

  const usedIngredients =
    new Set<string>();

  for (const item of value) {
    if (
      typeof item !== "object" ||
      item === null
    ) {
      return null;
    }

    const record =
      item as Record<
        string,
        unknown
      >;

    const ingredient =
      getRequiredString(
        record.ingredient,
      );

    if (
      !ingredient ||
      !mongoose.Types.ObjectId.isValid(
        ingredient,
      ) ||
      !isPositiveNumber(
        record.quantity,
      ) ||
      usedIngredients.has(
        ingredient,
      )
    ) {
      return null;
    }

    usedIngredients.add(
      ingredient,
    );

    parsedItems.push({
      ingredient,

      quantity:
        record.quantity,

      removableIngredient:
        getOptionalString(
          record.removableIngredient,
        ),
    });
  }

  return parsedItems;
}

function parseOptionModifiers(
  value: unknown,
  mode:
    | "size"
    | "extra",
): ParsedOptionModifier[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsedModifiers:
    ParsedOptionModifier[] = [];

  const usedOptionIds =
    new Set<string>();

  for (const modifier of value) {
    if (
      typeof modifier !==
        "object" ||
      modifier === null
    ) {
      return null;
    }

    const modifierRecord =
      modifier as Record<
        string,
        unknown
      >;

    const optionId =
      getRequiredString(
        modifierRecord.optionId,
      );

    if (
      !optionId ||
      usedOptionIds.has(
        optionId,
      ) ||
      !Array.isArray(
        modifierRecord.items,
      )
    ) {
      return null;
    }

    usedOptionIds.add(
      optionId,
    );

    const usedIngredients =
      new Set<string>();

    const items:
      ParsedModifierItem[] = [];

    for (
      const item of
      modifierRecord.items
    ) {
      if (
        typeof item !==
          "object" ||
        item === null
      ) {
        return null;
      }

      const itemRecord =
        item as Record<
          string,
          unknown
        >;

      const ingredient =
        getRequiredString(
          itemRecord.ingredient,
        );

      const quantity =
        itemRecord.quantity;

      if (
        !ingredient ||
        !mongoose.Types.ObjectId.isValid(
          ingredient,
        ) ||
        typeof quantity !==
          "number" ||
        !Number.isFinite(
          quantity,
        ) ||
        (
          mode === "size"
            ? quantity === 0
            : quantity <= 0
        ) ||
        usedIngredients.has(
          ingredient,
        )
      ) {
        return null;
      }

      usedIngredients.add(
        ingredient,
      );

      items.push({
        ingredient,
        quantity,
      });
    }

    parsedModifiers.push({
      optionId,
      items,
    });
  }

  return parsedModifiers;
}

function collectIngredientIds(
  baseItems:
    ParsedBaseItem[],
  sizeModifiers:
    ParsedOptionModifier[],
  extraModifiers:
    ParsedOptionModifier[],
): string[] {
  const ids =
    new Set<string>();

  for (
    const item of
    baseItems
  ) {
    ids.add(
      item.ingredient,
    );
  }

  for (
    const modifier of [
      ...sizeModifiers,
      ...extraModifiers,
    ]
  ) {
    for (
      const item of
      modifier.items
    ) {
      ids.add(
        item.ingredient,
      );
    }
  }

  return [
    ...ids,
  ];
}

function validateSizeResult(
  baseItems:
    ParsedBaseItem[],
  sizeModifiers:
    ParsedOptionModifier[],
): boolean {
  const baseTotals =
    new Map<
      string,
      number
    >();

  for (
    const item of
    baseItems
  ) {
    baseTotals.set(
      item.ingredient,
      (
        baseTotals.get(
          item.ingredient,
        ) ?? 0
      ) +
        item.quantity,
    );
  }

  for (
    const modifier of
    sizeModifiers
  ) {
    const totals =
      new Map(
        baseTotals,
      );

    for (
      const item of
      modifier.items
    ) {
      totals.set(
        item.ingredient,
        (
          totals.get(
            item.ingredient,
          ) ?? 0
        ) +
          item.quantity,
      );
    }

    for (
      const quantity of
      totals.values()
    ) {
      if (
        quantity <
        -0.000001
      ) {
        return false;
      }
    }
  }

  return true;
}

const recipePopulate = [
  {
    path:
      "product",

    select:
      "legacyId name slug ingredients sizes extras active",
  },

  {
    path:
      "baseItems.ingredient",

    select:
      "name slug unit stock minimumStock unitCost active",
  },

  {
    path:
      "sizeModifiers.items.ingredient",

    select:
      "name slug unit stock minimumStock unitCost active",
  },

  {
    path:
      "extraModifiers.items.ingredient",

    select:
      "name slug unit stock minimumStock unitCost active",
  },
];

/* ========================================
   LISTAR RECETAS
======================================== */

export async function getRecipes(
  _request: Request,
  response: Response,
): Promise<void> {
  try {
    const recipes =
      await ProductRecipe.find()
        .populate(
          recipePopulate,
        )
        .sort({
          updatedAt:
            -1,
        })
        .lean();

    response
      .status(200)
      .json({
        success:
          true,

        data:
          recipes,
      });
  } catch (error) {
    console.error(
      "Error al obtener recetas:",
      error,
    );

    response
      .status(500)
      .json({
        success:
          false,

        message:
          "No se pudieron cargar las recetas.",
      });
  }
}

/* ========================================
   RECETA POR PRODUCTO
======================================== */

export async function getRecipeByProductId(
  request: Request,
  response: Response,
): Promise<void> {
  const productId =
    getParam(
      request.params.productId,
    );

  if (
    !productId ||
    !mongoose.Types.ObjectId.isValid(
      productId,
    )
  ) {
    response
      .status(400)
      .json({
        success:
          false,

        message:
          "El identificador del producto no es válido.",
      });

    return;
  }

  try {
    const recipe =
      await ProductRecipe.findOne({
        product:
          productId,
      })
        .populate(
          recipePopulate,
        )
        .lean();

    if (!recipe) {
      response
        .status(404)
        .json({
          success:
            false,

          message:
            "El producto todavía no tiene una receta configurada.",
        });

      return;
    }

    response
      .status(200)
      .json({
        success:
          true,

        data:
          recipe,
      });
  } catch (error) {
    console.error(
      "Error al obtener receta:",
      error,
    );

    response
      .status(500)
      .json({
        success:
          false,

        message:
          "No se pudo cargar la receta.",
      });
  }
}

/* ========================================
   CREAR / ACTUALIZAR RECETA
======================================== */

export async function upsertRecipeByProductId(
  request: Request,
  response: Response,
): Promise<void> {
  const productId =
    getParam(
      request.params.productId,
    );

  if (
    !productId ||
    !mongoose.Types.ObjectId.isValid(
      productId,
    )
  ) {
    response
      .status(400)
      .json({
        success:
          false,

        message:
          "El identificador del producto no es válido.",
      });

    return;
  }

  try {
    const product =
      await Product.findById(
        productId,
      );

    if (!product) {
      response
        .status(404)
        .json({
          success:
            false,

          message:
            "El producto no existe.",
        });

      return;
    }

    const baseItems =
      parseBaseItems(
        request.body.baseItems,
      );

    const sizeModifiers =
      parseOptionModifiers(
        request.body.sizeModifiers,
        "size",
      );

    const extraModifiers =
      parseOptionModifiers(
        request.body.extraModifiers,
        "extra",
      );

    if (
      !baseItems ||
      !sizeModifiers ||
      !extraModifiers
    ) {
      response
        .status(400)
        .json({
          success:
            false,

          message:
            "La estructura de la receta no es válida.",
        });

      return;
    }

    const active =
      typeof request.body.active ===
      "boolean"
        ? request.body.active
        : true;

    if (
      active &&
      baseItems.length === 0
    ) {
      response
        .status(400)
        .json({
          success:
            false,

          message:
            "Una receta activa debe tener al menos un insumo base.",
        });

      return;
    }

    const productIngredients =
      new Set(
        product.ingredients,
      );

    for (
      const item of
      baseItems
    ) {
      if (
        item.removableIngredient &&
        !productIngredients.has(
          item.removableIngredient,
        )
      ) {
        response
          .status(400)
          .json({
            success:
              false,

            message:
              `"${item.removableIngredient}" no figura entre los ingredientes removibles de ${product.name}.`,
          });

        return;
      }
    }

    const validSizeIds =
      new Set(
        product.sizes.map(
          (option) =>
            option.id,
        ),
      );

    for (
      const modifier of
      sizeModifiers
    ) {
      if (
        !validSizeIds.has(
          modifier.optionId,
        )
      ) {
        response
          .status(400)
          .json({
            success:
              false,

            message:
              `El tamaño "${modifier.optionId}" ya no existe en ${product.name}.`,
          });

        return;
      }
    }

    const validExtraIds =
      new Set(
        product.extras.map(
          (option) =>
            option.id,
        ),
      );

    for (
      const modifier of
      extraModifiers
    ) {
      if (
        !validExtraIds.has(
          modifier.optionId,
        )
      ) {
        response
          .status(400)
          .json({
            success:
              false,

            message:
              `El extra "${modifier.optionId}" ya no existe en ${product.name}.`,
          });

        return;
      }
    }

    if (
      !validateSizeResult(
        baseItems,
        sizeModifiers,
      )
    ) {
      response
        .status(400)
        .json({
          success:
            false,

          message:
            "Un ajuste de tamaño deja un insumo con consumo negativo. Revisá la receta.",
        });

      return;
    }

    const ingredientIds =
      collectIngredientIds(
        baseItems,
        sizeModifiers,
        extraModifiers,
      );

    const existingIngredients =
      await Ingredient.find({
        _id: {
          $in:
            ingredientIds,
        },
      })
        .select(
          "_id",
        )
        .lean();

    if (
      existingIngredients.length !==
      ingredientIds.length
    ) {
      response
        .status(400)
        .json({
          success:
            false,

          message:
            "La receta referencia uno o más insumos que ya no existen.",
        });

      return;
    }

    const normalizedBaseItems:
      RecipeBaseItem[] =
      baseItems.map(
        (item) => ({
          ingredient:
            new mongoose.Types.ObjectId(
              item.ingredient,
            ),

          quantity:
            item.quantity,

          removableIngredient:
            item.removableIngredient,
        }),
      );

    const normalizeModifiers = (
      modifiers:
        ParsedOptionModifier[],
    ): RecipeOptionModifier[] =>
      modifiers
        .filter(
          (modifier) =>
            modifier.items.length >
            0,
        )
        .map(
          (modifier) => ({
            optionId:
              modifier.optionId,

            items:
              modifier.items.map(
                (
                  item,
                ): RecipeModifierItem => ({
                  ingredient:
                    new mongoose.Types.ObjectId(
                      item.ingredient,
                    ),

                  quantity:
                    item.quantity,
                }),
              ),
          }),
        );

    await ProductRecipe.findOneAndUpdate(
      {
        product:
          product._id,
      },
      {
        product:
          product._id,

        baseItems:
          normalizedBaseItems,

        sizeModifiers:
          normalizeModifiers(
            sizeModifiers,
          ),

        extraModifiers:
          normalizeModifiers(
            extraModifiers,
          ),

        active,
      },
      {
        upsert:
          true,

        new:
          true,

        runValidators:
          true,

        setDefaultsOnInsert:
          true,
      },
    );

    const savedRecipe =
      await ProductRecipe.findOne({
        product:
          product._id,
      })
        .populate(
          recipePopulate,
        )
        .lean();

    response
      .status(200)
      .json({
        success:
          true,

        message:
          "Receta guardada correctamente.",

        data:
          savedRecipe,
      });
  } catch (error) {
    console.error(
      "Error al guardar receta:",
      error,
    );

    response
      .status(500)
      .json({
        success:
          false,

        message:
          "No se pudo guardar la receta.",
      });
  }
}