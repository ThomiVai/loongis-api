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
  type InventoryLotConsumption,
  type InventoryMovementType,
} from "../models/inventoryMovement.model";

import {
  InventoryLot,
} from "../models/inventoryLot.model";

import {
  consumeInventoryLots,
  createInventoryLot,
} from "../services/inventoryLot.service";

import {
  getInventoryTrackingStatus,
  InventoryTrackingSettingsError,
  updateInventoryTrackingEnabled,
} from "../services/inventoryTracking.service";

/* ========================================
   CONFIGURACIÓN DE SEGUIMIENTO
======================================== */

export async function getInventorySettings(
  _request: Request,
  response: Response,
): Promise<void> {
  try {
    const status =
      await getInventoryTrackingStatus();

    response
      .status(200)
      .json({
        success: true,
        data: status,
      });
  } catch (error) {
    console.error(
      "Error al obtener la configuración de inventario:",
      error,
    );

    response
      .status(500)
      .json({
        success: false,
        message:
          "No se pudo cargar la configuración de inventario.",
      });
  }
}

export async function updateInventorySettings(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    if (
      typeof request.body !==
        "object" ||
      request.body === null ||
      Array.isArray(
        request.body,
      ) ||
      typeof request.body
        .enabled !==
        "boolean"
    ) {
      response
        .status(400)
        .json({
          success: false,
          message:
            "La configuración enviada no es válida.",
        });

      return;
    }

    const status =
      await updateInventoryTrackingEnabled(
        request.body.enabled,
      );

    response
      .status(200)
      .json({
        success: true,
        message:
          status.enabled
            ? "Descuento automático de stock activado."
            : "Descuento automático de stock pausado.",
        data: status,
      });
  } catch (error) {
    if (
      error instanceof
      InventoryTrackingSettingsError
    ) {
      response
        .status(
          error.statusCode,
        )
        .json({
          success: false,
          message:
            error.message,
        });

      return;
    }

    console.error(
      "Error al actualizar la configuración de inventario:",
      error,
    );

    response
      .status(500)
      .json({
        success: false,
        message:
          "No se pudo actualizar la configuración de inventario.",
      });
  }
}

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

    const data =
      response.locals.admin
        ?.role === "owner"
        ? ingredients
        : ingredients.map(
            (ingredient) => ({
              ...ingredient.toObject(),
              unitCost: undefined,
            }),
          );

    response
      .status(200)
      .json({
        success: true,
        data,
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

    const targetStock =
      getNonNegativeNumber(
        request.body.targetStock ??
          minimumStock,
      );

    const purchaseUnitFactor =
      getPositiveNumber(
        request.body
          .purchaseUnitFactor ?? 1,
      );

    const order =
      getNonNegativeInteger(
        request.body.order,
      );

    if (
      stock === null ||
      minimumStock === null ||
      unitCost === null ||
      targetStock === null ||
      purchaseUnitFactor === null ||
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
          targetStock,
          unitCost,
          purchaseUnitLabel:
            getOptionalString(
              request.body
                .purchaseUnitLabel,
            ),
          purchaseUnitFactor,
          category:
            getOptionalString(
              request.body.category,
            ),
          storageLocation:
            getOptionalString(
              request.body
                .storageLocation,
            ),
          trackExpiration:
            request.body
              .trackExpiration ===
            true,
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

        performedBy:
          response.locals.admin
            ?.id,

        performedByEmail:
          response.locals.admin
            ?.email,
      });

      await InventoryLot.create({
        ingredient:
          ingredient._id,
        receivedAt:
          new Date(),
        initialQuantity:
          stock,
        remainingQuantity:
          stock,
        unitCost,
        source:
          "initial",
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
      request.body.targetStock !==
      undefined
    ) {
      const targetStock =
        getNonNegativeNumber(
          request.body.targetStock,
        );

      if (targetStock === null) {
        response.status(400).json({
          success: false,
          message:
            "El stock objetivo no es válido.",
        });

        return;
      }

      ingredient.targetStock =
        targetStock;
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
      request.body.purchaseUnitFactor !==
      undefined
    ) {
      const factor =
        getPositiveNumber(
          request.body
            .purchaseUnitFactor,
        );

      if (factor === null) {
        response.status(400).json({
          success: false,
          message:
            "La conversión de compra debe ser mayor a cero.",
        });

        return;
      }

      ingredient.purchaseUnitFactor =
        factor;
    }

    if (
      request.body.purchaseUnitLabel !==
      undefined
    ) {
      ingredient.purchaseUnitLabel =
        getOptionalString(
          request.body
            .purchaseUnitLabel,
        );
    }

    if (
      request.body.category !==
      undefined
    ) {
      ingredient.category =
        getOptionalString(
          request.body.category,
        );
    }

    if (
      request.body.storageLocation !==
      undefined
    ) {
      ingredient.storageLocation =
        getOptionalString(
          request.body
            .storageLocation,
        );
    }

    if (
      typeof request.body
        .trackExpiration ===
      "boolean"
    ) {
      ingredient.trackExpiration =
        request.body
          .trackExpiration;
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

  if (
    request.body.type ===
      "adjustment" &&
    response.locals.admin
      ?.role !== "owner"
  ) {
    response.status(403).json({
      success: false,
      message:
        "Los ajustes directos requieren permisos del dueño.",
    });

    return;
  }

  const session =
    await mongoose.startSession();

  try {
    let savedIngredient:
      InstanceType<
        typeof Ingredient
      > | null = null;

    let savedMovement:
      InstanceType<
        typeof InventoryMovement
      > | null = null;

    await session.withTransaction(
      async () => {
        const ingredient =
          await Ingredient.findById(
            ingredientId,
          ).session(session);

        if (!ingredient) {
          throw new InventoryTrackingSettingsError(
            404,
            "El insumo no existe.",
          );
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
            throw new InventoryTrackingSettingsError(
              400,
              "La cantidad debe ser mayor a cero.",
            );
          }

          if (type === "restock") {
            newStock =
              previousStock +
              quantity;
          } else {
            if (
              quantity >
              previousStock
            ) {
              throw new InventoryTrackingSettingsError(
                400,
                "La merma no puede ser mayor al stock disponible.",
              );
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

          if (targetStock === null) {
            throw new InventoryTrackingSettingsError(
              400,
              "El nuevo stock debe ser un valor válido y no negativo.",
            );
          }

          newStock =
            targetStock;
        }

        const change =
          newStock -
          previousStock;

        if (change === 0) {
          throw new InventoryTrackingSettingsError(
            400,
            "El movimiento no modifica el stock actual.",
          );
        }

        const updated =
          await Ingredient.findOneAndUpdate(
            {
              _id:
                ingredient._id,
              stock:
                previousStock,
            },
            {
              $set: {
                stock:
                  newStock,
              },
            },
            {
              new: true,
              runValidators: true,
              session,
            },
          );

        if (!updated) {
          throw new InventoryTrackingSettingsError(
            409,
            "El stock cambió mientras realizabas el movimiento. Volvé a intentarlo.",
          );
        }

        let lotConsumptions:
          InventoryLotConsumption[] =
          [];

        if (change < 0) {
          lotConsumptions =
            await consumeInventoryLots(
              ingredient._id,
              Math.abs(change),
              previousStock,
              ingredient.unitCost,
              session,
            );
        } else {
          await createInventoryLot(
            {
              ingredient:
                ingredient._id,
              quantity:
                change,
              unitCost:
                ingredient.unitCost,
              source:
                type === "restock"
                  ? "manual_restock"
                  : "adjustment",
              batchNumber:
                getOptionalString(
                  request.body
                    .batchNumber,
                ),
              expirationDate:
                typeof request.body
                  .expirationDate ===
                  "string" &&
                request.body
                  .expirationDate
                  ? new Date(
                      request.body
                        .expirationDate,
                    )
                  : undefined,
            },
            session,
          );
        }

        const [movement] =
          await InventoryMovement.create(
            [
              {
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
                note:
                  getOptionalString(
                    request.body.note,
                  ),
                performedBy:
                  response.locals.admin
                    ?.id,
                performedByEmail:
                  response.locals.admin
                    ?.email,
                lotConsumptions,
              },
            ],
            {
              session,
            },
          );

        if (!movement) {
          throw new Error(
            "No se pudo registrar el historial del movimiento.",
          );
        }

        savedIngredient =
          updated;
        savedMovement =
          movement;
      },
    );

    response
      .status(201)
      .json({
        success: true,

        data: {
          ingredient:
            savedIngredient,
          movement:
            savedMovement,
        },
      });
  } catch (error) {
    if (
      error instanceof
      InventoryTrackingSettingsError
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
  } finally {
    await session.endSession();
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
            500,
          )
        : 30;

    const filter:
      Record<string, unknown> = {};

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

    const movementType =
      typeof request.query.type ===
      "string"
        ? request.query.type
        : undefined;

    const validMovementTypes:
      InventoryMovementType[] = [
        "initial",
        "restock",
        "waste",
        "adjustment",
        "sale",
        "reversal",
      ];

    if (movementType) {
      if (
        !validMovementTypes.includes(
          movementType as
            InventoryMovementType,
        )
      ) {
        response.status(400).json({
          success: false,
          message:
            "El tipo de movimiento no es válido.",
        });

        return;
      }

      filter.type =
        movementType;
    }

    const performedBy =
      typeof request.query
        .performedBy === "string"
        ? request.query
            .performedBy
        : undefined;

    if (performedBy) {
      if (
        !mongoose.Types.ObjectId.isValid(
          performedBy,
        )
      ) {
        response.status(400).json({
          success: false,
          message:
            "El administrador indicado no es válido.",
        });

        return;
      }

      filter.performedBy =
        new mongoose.Types.ObjectId(
          performedBy,
        );
    }

    const createdAt:
      Record<string, Date> = {};

    if (
      typeof request.query.from ===
        "string" &&
      request.query.from
    ) {
      const from =
        new Date(
          request.query.from,
        );

      if (!Number.isNaN(from.getTime())) {
        createdAt.$gte =
          from;
      }
    }

    if (
      typeof request.query.to ===
        "string" &&
      request.query.to
    ) {
      const to =
        new Date(
          request.query.to,
        );

      if (!Number.isNaN(to.getTime())) {
        to.setUTCHours(
          23,
          59,
          59,
          999,
        );
        createdAt.$lte =
          to;
      }
    }

    if (
      Object.keys(createdAt)
        .length > 0
    ) {
      filter.createdAt =
        createdAt;
    }

    const movements =
      await InventoryMovement.find(
        filter,
      )
        .populate(
          "ingredient",
          "name unit",
        )
        .populate(
          "performedBy",
          "email role",
        )
        .populate(
          "purchase",
          "invoiceNumber supplierName purchasedAt",
        )
        .sort({
          createdAt: -1,
        })
        .limit(limit)
        .lean();

    const data =
      response.locals.admin
        ?.role === "owner"
        ? movements
        : movements.map(
            (movement) => ({
              ...movement,
              unitCost: undefined,
              estimatedCost:
                undefined,
            }),
          );

    response
      .status(200)
      .json({
        success: true,
        data,
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
