import type {
  Request,
  Response,
} from "express";

import mongoose from "mongoose";

import {
  Ingredient,
  type IngredientUnit,
} from "../models/ingredient.model";

import {
  InventoryMovement,
  type InventoryMovementType,
} from "../models/inventoryMovement.model";

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

function getNonNegativeNumber(
  value: unknown,
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return null;
  }

  return value;
}

function getPositiveNumber(
  value: unknown,
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return null;
  }

  return value;
}

function getNonNegativeInteger(
  value: unknown,
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    return null;
  }

  return value;
}

function createSlug(
  value: string,
): string {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .trim()
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    );
}

function isIngredientUnit(
  value: unknown,
): value is IngredientUnit {
  return (
    value === "unit" ||
    value === "portion" ||
    value === "gram" ||
    value === "kilogram" ||
    value === "milliliter" ||
    value === "liter"
  );
}

function isManualMovementType(
  value: unknown,
): value is
  | "restock"
  | "waste"
  | "adjustment" {
  return (
    value === "restock" ||
    value === "waste" ||
    value === "adjustment"
  );
}

function getEstimatedCost(
  change: number,
  unitCost: number,
): number {
  return Math.round(
    Math.abs(change) *
      unitCost *
      100,
  ) / 100;
}

/* ========================================
   OBTENER INSUMOS
======================================== */

export async function getIngredients(
  _request: Request,
  response: Response,
): Promise<void> {
  try {
    const ingredients =
      await Ingredient.find()
        .sort({
          active: -1,
          order: 1,
          name: 1,
        });

    response
      .status(200)
      .json({
        success: true,
        data: ingredients,
      });
  } catch (error) {
    console.error(
      "Error al obtener inventario:",
      error,
    );

    response
      .status(500)
      .json({
        success: false,
        message:
          "No se pudo cargar el inventario.",
      });
  }
}

/* ========================================
   CREAR INSUMO
======================================== */

export async function createIngredient(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const name =
      getRequiredString(
        request.body.name,
      );

    if (!name) {
      response
        .status(400)
        .json({
          success: false,
          message:
            "El nombre del insumo es obligatorio.",
        });

      return;
    }

    if (
      !isIngredientUnit(
        request.body.unit,
      )
    ) {
      response
        .status(400)
        .json({
          success: false,
          message:
            "La unidad del insumo no es válida.",
        });

      return;
    }

    const stock =
      getNonNegativeNumber(
        request.body.stock,
      );

    const minimumStock =
      getNonNegativeNumber(
        request.body.minimumStock,
      );

    const unitCost =
      getNonNegativeNumber(
        request.body.unitCost,
      );

    const order =
      getNonNegativeInteger(
        request.body.order,
      );

    if (
      stock === null ||
      minimumStock === null ||
      unitCost === null ||
      order === null
    ) {
      response
        .status(400)
        .json({
          success: false,
          message:
            "Stock, stock mínimo, costo y orden deben ser valores válidos y no negativos.",
        });

      return;
    }

    const slug =
      createSlug(name);

    if (!slug) {
      response
        .status(400)
        .json({
          success: false,
          message:
            "No se pudo generar un identificador válido para el insumo.",
        });

      return;
    }

    const existingIngredient =
      await Ingredient.findOne({
        slug,
      });

    if (existingIngredient) {
      response
        .status(409)
        .json({
          success: false,
          message:
            "Ya existe un insumo con ese nombre.",
        });

      return;
    }

    const ingredient =
      await Ingredient.create({
        name,
        slug,
        unit:
          request.body.unit,
        stock,
        minimumStock,
        unitCost,
        active:
          typeof request.body.active ===
          "boolean"
            ? request.body.active
            : true,
        order,
      });

    if (stock > 0) {
      await InventoryMovement.create({
        ingredient:
          ingredient._id,

        type:
          "initial",

        change:
          stock,

        previousStock:
          0,

        newStock:
          stock,

        unitCost,

        estimatedCost:
          getEstimatedCost(
            stock,
            unitCost,
          ),

        note:
          "Stock inicial",
      });
    }

    response
      .status(201)
      .json({
        success: true,
        data: ingredient,
      });
  } catch (error) {
    console.error(
      "Error al crear insumo:",
      error,
    );

    if (
      error instanceof Error &&
      error.message.includes(
        "E11000",
      )
    ) {
      response
        .status(409)
        .json({
          success: false,
          message:
            "Ya existe un insumo con ese nombre.",
        });

      return;
    }

    response
      .status(500)
      .json({
        success: false,
        message:
          "No se pudo crear el insumo.",
      });
  }
}

/* ========================================
   ACTUALIZAR INSUMO
======================================== */

export async function updateIngredient(
  request: Request,
  response: Response,
): Promise<void> {
  const ingredientId =
    getParam(
      request.params.id,
    );

  if (
    !ingredientId ||
    !mongoose.Types.ObjectId.isValid(
      ingredientId,
    )
  ) {
    response
      .status(400)
      .json({
        success: false,
        message:
          "El identificador del insumo no es válido.",
      });

    return;
  }

  try {
    const ingredient =
      await Ingredient.findById(
        ingredientId,
      );

    if (!ingredient) {
      response
        .status(404)
        .json({
          success: false,
          message:
            "El insumo no existe.",
        });

      return;
    }

    if (
      request.body.name !==
      undefined
    ) {
      const name =
        getRequiredString(
          request.body.name,
        );

      if (!name) {
        response
          .status(400)
          .json({
            success: false,
            message:
              "El nombre del insumo no es válido.",
          });

        return;
      }

      const slug =
        createSlug(name);

      const duplicate =
        await Ingredient.findOne({
          slug,
          _id: {
            $ne:
              ingredient._id,
          },
        });

      if (duplicate) {
        response
          .status(409)
          .json({
            success: false,
            message:
              "Ya existe otro insumo con ese nombre.",
          });

        return;
      }

      ingredient.name =
        name;

      ingredient.slug =
        slug;
    }

    if (
      request.body.unit !==
      undefined
    ) {
      if (
        !isIngredientUnit(
          request.body.unit,
        )
      ) {
        response
          .status(400)
          .json({
            success: false,
            message:
              "La unidad del insumo no es válida.",
          });

        return;
      }

      ingredient.unit =
        request.body.unit;
    }

    if (
      request.body.minimumStock !==
      undefined
    ) {
      const minimumStock =
        getNonNegativeNumber(
          request.body.minimumStock,
        );

      if (
        minimumStock === null
      ) {
        response
          .status(400)
          .json({
            success: false,
            message:
              "El stock mínimo no es válido.",
          });

        return;
      }

      ingredient.minimumStock =
        minimumStock;
    }

    if (
      request.body.unitCost !==
      undefined
    ) {
      const unitCost =
        getNonNegativeNumber(
          request.body.unitCost,
        );

      if (
        unitCost === null
      ) {
        response
          .status(400)
          .json({
            success: false,
            message:
              "El costo unitario no es válido.",
          });

        return;
      }

      ingredient.unitCost =
        unitCost;
    }

    if (
      request.body.order !==
      undefined
    ) {
      const order =
        getNonNegativeInteger(
          request.body.order,
        );

      if (order === null) {
        response
          .status(400)
          .json({
            success: false,
            message:
              "El orden no es válido.",
          });

        return;
      }

      ingredient.order =
        order;
    }

    if (
      typeof request.body.active ===
      "boolean"
    ) {
      ingredient.active =
        request.body.active;
    }

    await ingredient.save();

    response
      .status(200)
      .json({
        success: true,
        data: ingredient,
      });
  } catch (error) {
    console.error(
      "Error al actualizar insumo:",
      error,
    );

    response
      .status(500)
      .json({
        success: false,
        message:
          "No se pudo actualizar el insumo.",
      });
  }
}

/* ========================================
   REGISTRAR MOVIMIENTO
======================================== */

export async function createInventoryMovement(
  request: Request,
  response: Response,
): Promise<void> {
  const ingredientId =
    getParam(
      request.params.id,
    );

  if (
    !ingredientId ||
    !mongoose.Types.ObjectId.isValid(
      ingredientId,
    )
  ) {
    response
      .status(400)
      .json({
        success: false,
        message:
          "El identificador del insumo no es válido.",
      });

    return;
  }

  if (
    !isManualMovementType(
      request.body.type,
    )
  ) {
    response
      .status(400)
      .json({
        success: false,
        message:
          "El tipo de movimiento no es válido.",
      });

    return;
  }

  try {
    const ingredient =
      await Ingredient.findById(
        ingredientId,
      );

    if (!ingredient) {
      response
        .status(404)
        .json({
          success: false,
          message:
            "El insumo no existe.",
        });

      return;
    }

    const type:
      InventoryMovementType =
      request.body.type;

    const previousStock =
      ingredient.stock;

    let newStock =
      previousStock;

    if (
      type === "restock" ||
      type === "waste"
    ) {
      const quantity =
        getPositiveNumber(
          request.body.quantity,
        );

      if (quantity === null) {
        response
          .status(400)
          .json({
            success: false,
            message:
              "La cantidad debe ser mayor a cero.",
          });

        return;
      }

      if (
        type === "restock"
      ) {
        newStock =
          previousStock +
          quantity;
      } else {
        if (
          quantity >
          previousStock
        ) {
          response
            .status(400)
            .json({
              success: false,
              message:
                "La merma no puede ser mayor al stock disponible.",
            });

          return;
        }

        newStock =
          previousStock -
          quantity;
      }
    } else {
      const targetStock =
        getNonNegativeNumber(
          request.body.newStock,
        );

      if (
        targetStock === null
      ) {
        response
          .status(400)
          .json({
            success: false,
            message:
              "El nuevo stock debe ser un valor válido y no negativo.",
          });

        return;
      }

      newStock =
        targetStock;
    }

    const change =
      newStock -
      previousStock;

    if (change === 0) {
      response
        .status(400)
        .json({
          success: false,
          message:
            "El movimiento no modifica el stock actual.",
        });

      return;
    }

    const note =
      getOptionalString(
        request.body.note,
      );

    ingredient.stock =
      newStock;

    await ingredient.save();

    let movement;

    try {
      movement =
        await InventoryMovement.create({
          ingredient:
            ingredient._id,

          type,

          change,

          previousStock,

          newStock,

          unitCost:
            ingredient.unitCost,

          estimatedCost:
            getEstimatedCost(
              change,
              ingredient.unitCost,
            ),

          note,
        });
    } catch (movementError) {
      /*
        Si el historial no pudiera guardarse,
        revertimos el stock para no perder
        trazabilidad.
      */

      ingredient.stock =
        previousStock;

      await ingredient.save();

      throw movementError;
    }

    response
      .status(201)
      .json({
        success: true,

        data: {
          ingredient,
          movement,
        },
      });
  } catch (error) {
    console.error(
      "Error al registrar movimiento de inventario:",
      error,
    );

    response
      .status(500)
      .json({
        success: false,
        message:
          "No se pudo registrar el movimiento de inventario.",
      });
  }
}

/* ========================================
   HISTORIAL
======================================== */

export async function getInventoryMovements(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const ingredientId =
      typeof request.query
        .ingredientId ===
      "string"
        ? request.query
            .ingredientId
        : undefined;

    const requestedLimit =
      typeof request.query.limit ===
      "string"
        ? Number(
            request.query.limit,
          )
        : 30;

    const limit =
      Number.isInteger(
        requestedLimit,
      ) &&
      requestedLimit > 0
        ? Math.min(
            requestedLimit,
            100,
          )
        : 30;

    const filter:
      Record<
        string,
        mongoose.Types.ObjectId
      > = {};

    if (ingredientId) {
      if (
        !mongoose.Types.ObjectId.isValid(
          ingredientId,
        )
      ) {
        response
          .status(400)
          .json({
            success: false,
            message:
              "El identificador del insumo no es válido.",
          });

        return;
      }

      filter.ingredient =
        new mongoose.Types.ObjectId(
          ingredientId,
        );
    }

    const movements =
      await InventoryMovement.find(
        filter,
      )
        .populate(
          "ingredient",
          "name unit",
        )
        .sort({
          createdAt: -1,
        })
        .limit(limit);

    response
      .status(200)
      .json({
        success: true,
        data: movements,
      });
  } catch (error) {
    console.error(
      "Error al obtener movimientos de inventario:",
      error,
    );

    response
      .status(500)
      .json({
        success: false,
        message:
          "No se pudo cargar el historial de inventario.",
      });
  }
}
