import mongoose, {
  type ClientSession,
  type HydratedDocument,
} from "mongoose";

import {
  Ingredient,
} from "../models/ingredient.model";

import {
  InventoryMovement,
} from "../models/inventoryMovement.model";

import {
  Order,
  type OrderDocument,
} from "../models/order.model";

import {
  Product,
} from "../models/product.model";

import {
  ProductRecipe,
  type ProductRecipeDocument,
} from "../models/productRecipe.model";

/* ========================================
   TIPOS
======================================== */

export type RecipeSelection = {
  sizeId?: string;
  extraIds?: string[];
  removedIngredients?: string[];
};

export type IngredientRequirements =
  Map<string, number>;

type ConfirmedOrderResult = {
  order:
    HydratedDocument<OrderDocument>;
  alreadyConfirmed: boolean;
};

/* ========================================
   ERROR CONTROLADO
======================================== */

export class OrderInventoryError
  extends Error {
  statusCode: number;

  constructor(
    statusCode: number,
    message: string,
  ) {
    super(message);

    this.name =
      "OrderInventoryError";

    this.statusCode =
      statusCode;
  }
}

/* ========================================
   CANTIDADES
======================================== */

const quantityPrecision =
  1_000_000;

const quantityTolerance =
  0.000001;

function normalizeQuantity(
  value: number,
): number {
  return Math.round(
    value * quantityPrecision,
  ) / quantityPrecision;
}

function addQuantity(
  requirements:
    IngredientRequirements,
  ingredientId: string,
  quantity: number,
): void {
  const nextQuantity =
    normalizeQuantity(
      (
        requirements.get(
          ingredientId,
        ) ?? 0
      ) + quantity,
    );

  if (
    Math.abs(nextQuantity) <
    quantityTolerance
  ) {
    requirements.delete(
      ingredientId,
    );

    return;
  }

  requirements.set(
    ingredientId,
    nextQuantity,
  );
}

/* ========================================
   CONSUMO DE UNA RECETA
======================================== */

export function addRecipeConsumption(
  requirements:
    IngredientRequirements,
  recipe:
    Pick<
      ProductRecipeDocument,
      | "baseItems"
      | "sizeModifiers"
      | "extraModifiers"
    >,
  selection:
    RecipeSelection,
  multiplier: number,
): boolean {
  const localConsumption =
    new Map<string, number>();

  const removedLabels =
    new Set(
      selection
        .removedIngredients ??
      [],
    );

  const removedIngredientIds =
    new Set<string>();

  for (
    const item of
    recipe.baseItems
  ) {
    const ingredientId =
      item.ingredient.toString();

    if (
      item.removableIngredient &&
      removedLabels.has(
        item.removableIngredient,
      )
    ) {
      removedIngredientIds.add(
        ingredientId,
      );

      continue;
    }

    addQuantity(
      localConsumption,
      ingredientId,
      item.quantity,
    );
  }

  const sizeModifier =
    selection.sizeId
      ? recipe.sizeModifiers.find(
          (modifier) =>
            modifier.optionId ===
            selection.sizeId,
        )
      : undefined;

  for (
    const item of
    sizeModifier?.items ?? []
  ) {
    const ingredientId =
      item.ingredient.toString();

    if (
      removedIngredientIds.has(
        ingredientId,
      )
    ) {
      continue;
    }

    addQuantity(
      localConsumption,
      ingredientId,
      item.quantity,
    );
  }

  const selectedExtraIds =
    new Set(
      selection.extraIds ??
      [],
    );

  for (
    const modifier of
    recipe.extraModifiers
  ) {
    if (
      !selectedExtraIds.has(
        modifier.optionId,
      )
    ) {
      continue;
    }

    for (
      const item of
      modifier.items
    ) {
      addQuantity(
        localConsumption,
        item.ingredient.toString(),
        item.quantity,
      );
    }
  }

  let hasConsumption =
    false;

  for (
    const [
      ingredientId,
      quantity,
    ] of localConsumption
  ) {
    if (
      quantity <
      -quantityTolerance
    ) {
      throw new OrderInventoryError(
        409,
        "Una receta genera un consumo negativo. Revisala antes de confirmar el pedido.",
      );
    }

    if (
      quantity <=
      quantityTolerance
    ) {
      continue;
    }

    addQuantity(
      requirements,
      ingredientId,
      quantity * multiplier,
    );

    hasConsumption =
      true;
  }

  return hasConsumption;
}

/* ========================================
   RECETAS DEL PEDIDO
======================================== */

async function getOrderRequirements(
  order:
    HydratedDocument<OrderDocument>,
  session:
    ClientSession,
): Promise<IngredientRequirements> {
  const linkedLegacyIds =
    new Set<number>();

  for (
    const item of order.items
  ) {
    for (
      const choice of
      item.customization.choices
    ) {
      if (
        choice.productLegacyId
      ) {
        linkedLegacyIds.add(
          choice.productLegacyId,
        );
      }
    }
  }

  const linkedProducts =
    linkedLegacyIds.size > 0
      ? await Product.find({
          legacyId: {
            $in: [
              ...linkedLegacyIds,
            ],
          },
        })
          .select(
            "_id legacyId name",
          )
          .session(session)
          .lean()
      : [];

  const linkedProductsByLegacyId =
    new Map(
      linkedProducts
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

  const recipeProductIds =
    new Set<string>();

  for (
    const item of order.items
  ) {
    recipeProductIds.add(
      item.product.toString(),
    );
  }

  for (
    const product of
    linkedProducts
  ) {
    recipeProductIds.add(
      product._id.toString(),
    );
  }

  const recipes =
    await ProductRecipe.find({
      product: {
        $in: [
          ...recipeProductIds,
        ],
      },

      active:
        true,
    })
      .session(session);

  const recipesByProductId =
    new Map(
      recipes.map(
        (recipe) => [
          recipe.product.toString(),
          recipe,
        ],
      ),
    );

  const requirements:
    IngredientRequirements =
    new Map();

  for (
    const item of order.items
  ) {
    const linkedChoices =
      item.customization.choices
        .filter(
          (choice) =>
            choice.productLegacyId !==
            undefined,
        );

    const primaryRecipe =
      recipesByProductId.get(
        item.product.toString(),
      );

    let hasRecipe =
      false;

    if (primaryRecipe) {
      hasRecipe =
        true;

      addRecipeConsumption(
        requirements,
        primaryRecipe,
        {
          sizeId:
            item.customization
              .size?.id,

          extraIds:
            item.customization
              .extras.map(
                (extra) =>
                  extra.id,
              ),

          removedIngredients:
            item.customization
              .removedIngredients,
        },
        item.quantity,
      );
    }

    if (
      !primaryRecipe &&
      linkedChoices.length === 0
    ) {
      throw new OrderInventoryError(
        409,
        `Configurá una receta activa para ${item.name} antes de confirmar el pedido.`,
      );
    }

    for (
      const choice of
      linkedChoices
    ) {
      const legacyId =
        choice.productLegacyId;

      if (!legacyId) {
        continue;
      }

      const linkedProduct =
        linkedProductsByLegacyId.get(
          legacyId,
        );

      if (!linkedProduct) {
        throw new OrderInventoryError(
          409,
          `El producto elegido en "${choice.optionLabel}" ya no existe.`,
        );
      }

      const linkedRecipe =
        recipesByProductId.get(
          linkedProduct._id.toString(),
        );

      if (!linkedRecipe) {
        throw new OrderInventoryError(
          409,
          `Configurá una receta activa para ${choice.optionLabel} antes de confirmar el pedido.`,
        );
      }

      hasRecipe =
        true;

      addRecipeConsumption(
        requirements,
        linkedRecipe,
        {
          sizeId:
            choice.sizeId,

          removedIngredients:
            choice.removedIngredients,
        },
        item.quantity,
      );
    }

    if (!hasRecipe) {
      throw new OrderInventoryError(
        409,
        `Configurá una receta para ${item.name} antes de confirmar el pedido.`,
      );
    }
  }

  if (
    requirements.size === 0
  ) {
    throw new OrderInventoryError(
      409,
      "Las recetas del pedido no generan consumo de stock.",
    );
  }

  return requirements;
}

/* ========================================
   DESCONTAR STOCK
======================================== */

function getEstimatedCost(
  quantity: number,
  unitCost: number,
): number {
  return Math.round(
    quantity *
      unitCost *
      100,
  ) / 100;
}

async function consumeRequirements(
  order:
    HydratedDocument<OrderDocument>,
  requirements:
    IngredientRequirements,
  session:
    ClientSession,
): Promise<void> {
  const ingredientIds = [
    ...requirements.keys(),
  ];

  const ingredients =
    await Ingredient.find({
      _id: {
        $in:
          ingredientIds,
      },
    })
      .session(session);

  const ingredientsById =
    new Map(
      ingredients.map(
        (ingredient) => [
          ingredient._id.toString(),
          ingredient,
        ],
      ),
    );

  const missingIngredients:
    string[] = [];

  const insufficientIngredients:
    string[] = [];

  for (
    const [
      ingredientId,
      requiredQuantity,
    ] of requirements
  ) {
    const ingredient =
      ingredientsById.get(
        ingredientId,
      );

    if (
      !ingredient ||
      !ingredient.active
    ) {
      missingIngredients.push(
        ingredient?.name ??
        ingredientId,
      );

      continue;
    }

    if (
      ingredient.stock +
        quantityTolerance <
      requiredQuantity
    ) {
      insufficientIngredients.push(
        `${ingredient.name} (necesita ${requiredQuantity}, disponible ${ingredient.stock})`,
      );
    }
  }

  if (
    missingIngredients.length >
    0
  ) {
    throw new OrderInventoryError(
      409,
      `Hay insumos inexistentes o inactivos: ${missingIngredients.join(", ")}.`,
    );
  }

  if (
    insufficientIngredients.length >
    0
  ) {
    throw new OrderInventoryError(
      409,
      `Stock insuficiente: ${insufficientIngredients.join("; ")}.`,
    );
  }

  const movements:
    Array<{
      ingredient:
        mongoose.Types.ObjectId;
      order:
        mongoose.Types.ObjectId;
      orderNumber: number;
      type: "sale";
      change: number;
      previousStock: number;
      newStock: number;
      unitCost: number;
      estimatedCost: number;
      note: string;
    }> = [];

  for (
    const [
      ingredientId,
      requiredQuantity,
    ] of requirements
  ) {
    const previousIngredient =
      await Ingredient.findOneAndUpdate(
        {
          _id:
            ingredientId,

          active:
            true,

          stock: {
            $gte:
              requiredQuantity,
          },
        },
        {
          $inc: {
            stock:
              -requiredQuantity,
          },
        },
        {
          new:
            false,

          runValidators:
            true,

          session,
        },
      );

    if (!previousIngredient) {
      throw new OrderInventoryError(
        409,
        "El stock cambió mientras se confirmaba el pedido. Volvé a intentarlo.",
      );
    }

    const newStock =
      normalizeQuantity(
        previousIngredient.stock -
          requiredQuantity,
      );

    movements.push({
      ingredient:
        previousIngredient._id,

      order:
        order._id,

      orderNumber:
        order.orderNumber,

      type:
        "sale",

      change:
        -requiredQuantity,

      previousStock:
        previousIngredient.stock,

      newStock,

      unitCost:
        previousIngredient.unitCost,

      estimatedCost:
        getEstimatedCost(
          requiredQuantity,
          previousIngredient.unitCost,
        ),

      note:
        `Pedido #${order.orderNumber}`,
    });
  }

  await InventoryMovement.insertMany(
    movements,
    {
      session,
    },
  );
}

/* ========================================
   CONFIRMAR PEDIDO
======================================== */

export async function confirmOrderWithInventory(
  orderId: string,
): Promise<ConfirmedOrderResult> {
  const session =
    await mongoose.startSession();

  let result:
    ConfirmedOrderResult | null =
    null;

  try {
    await session.withTransaction(
      async () => {
        const order =
          await Order.findById(
            orderId,
          )
            .session(session);

        if (!order) {
          throw new OrderInventoryError(
            404,
            "El pedido solicitado no existe.",
          );
        }

        if (
          order.status ===
          "confirmed"
        ) {
          result = {
            order,
            alreadyConfirmed:
              true,
          };

          return;
        }

        if (
          order.status !==
          "pending"
        ) {
          throw new OrderInventoryError(
            409,
            "Un pedido confirmado o cancelado no puede volver a modificarse.",
          );
        }

        const requirements =
          await getOrderRequirements(
            order,
            session,
          );

        await consumeRequirements(
          order,
          requirements,
          session,
        );

        order.status =
          "confirmed";

        order.inventoryDeductedAt =
          new Date();

        await order.save({
          session,
        });

        result = {
          order,
          alreadyConfirmed:
            false,
        };
      },
    );
  } finally {
    await session.endSession();
  }

  if (!result) {
    throw new Error(
      "La transacción de confirmación no devolvió un resultado.",
    );
  }

  return result;
}
