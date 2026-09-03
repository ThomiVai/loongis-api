import type {
  Request,
  Response,
} from "express";

import mongoose from "mongoose";

import type {
  ProductOption,
} from "../models/product.model";

import {
  Product,
} from "../models/product.model";

import {
  Counter,
} from "../models/counter.model";

import {
  Order,
} from "../models/order.model";

import {
  getStoreStatus,
} from "../services/storeStatus.service";

import {
  confirmOrderWithInventory,
  OrderInventoryError,
} from "../services/orderInventory.service";

import type {
  OrderItemSnapshot,
  OrderChoiceSnapshot,
  OrderOptionSnapshot,
  OrderStatus,
} from "../models/order.model";

/* ========================================
   ERRORES DE SOLICITUD
======================================== */

class OrderRequestError
  extends Error {
  statusCode: number;

  constructor(
    statusCode: number,
    message: string,
  ) {
    super(message);

    this.name =
      "OrderRequestError";

    this.statusCode =
      statusCode;
  }
}

/* ========================================
   HELPERS
======================================== */

function isObject(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getString(
  value: unknown,
): string {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function getOptionalString(
  value: unknown,
): string | undefined {
  const normalized =
    getString(value);

  return normalized ||
    undefined;
}

function getStringArray(
  value: unknown,
): string[] | null {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const values =
    value.map(
      getString,
    );

  if (
    values.some(
      (item) =>
        !item,
    )
  ) {
    return null;
  }

  return [
    ...new Set(values),
  ];
}

function createOptionSnapshot(
  option: ProductOption,
): OrderOptionSnapshot {
  return {
    id: option.id,

    name: option.name,

    label: option.label,

    priceModifier:
      option.priceModifier,
  };
}

/* ========================================
   NÚMERO DE PEDIDO
======================================== */

async function getNextOrderNumber():
  Promise<number> {
  const counter =
    await Counter.findByIdAndUpdate(
      "orders",
      {
        $inc: {
          sequence: 1,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert:
          true,
      },
    );

  if (!counter) {
    throw new Error(
      "No se pudo generar el número de pedido.",
    );
  }

  return counter.sequence;
}

/* ========================================
   CREAR PEDIDO
======================================== */

export async function createOrder(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const storeStatus =
      await getStoreStatus();

    if (!storeStatus.canOrder) {
      throw new OrderRequestError(
        409,
        `No estamos tomando pedidos en este momento. ${storeStatus.detailLabel}`,
      );
    }

    if (!isObject(request.body)) {
      throw new OrderRequestError(
        400,
        "El pedido no tiene un formato válido.",
      );
    }

    const customer =
      request.body.customer;

    if (!isObject(customer)) {
      throw new OrderRequestError(
        400,
        "Los datos del cliente no son válidos.",
      );
    }

    const customerName =
      getString(
        customer.name,
      );

    const phone =
      getString(
        customer.phone,
      );

    const address =
      getString(
        customer.address,
      );

    if (
      customerName.length < 2 ||
      customerName.length > 100
    ) {
      throw new OrderRequestError(
        400,
        "El nombre del cliente no es válido.",
      );
    }

    if (
      phone.length < 6 ||
      phone.length > 30
    ) {
      throw new OrderRequestError(
        400,
        "El teléfono del cliente no es válido.",
      );
    }

    const deliveryMethod =
      request.body.deliveryMethod;

    if (
      deliveryMethod !==
        "delivery"
    ) {
      throw new OrderRequestError(
        400,
        "La forma de entrega no es válida.",
      );
    }

    if (!address) {
      throw new OrderRequestError(
        400,
        "La dirección es obligatoria para los envíos.",
      );
    }

    if (
      address.length > 220
    ) {
      throw new OrderRequestError(
        400,
        "La dirección es demasiado extensa.",
      );
    }

    const paymentMethod =
      request.body.paymentMethod;

    if (
      paymentMethod !==
        "cash" &&
      paymentMethod !==
        "transfer"
    ) {
      throw new OrderRequestError(
        400,
        "La forma de pago no es válida.",
      );
    }

    const generalNotes =
      getString(
        request.body.generalNotes,
      );

    if (
      generalNotes.length > 300
    ) {
      throw new OrderRequestError(
        400,
        "Las aclaraciones generales no pueden superar los 300 caracteres.",
      );
    }

    const rawItems =
      request.body.items;

    if (
      !Array.isArray(rawItems) ||
      rawItems.length === 0
    ) {
      throw new OrderRequestError(
        400,
        "El pedido debe tener al menos un producto.",
      );
    }

    if (
      rawItems.length > 30
    ) {
      throw new OrderRequestError(
        400,
        "El pedido contiene demasiadas líneas de productos.",
      );
    }

    const parsedItems =
      rawItems.map(
        (
          rawItem,
          index,
        ) => {
          if (!isObject(rawItem)) {
            throw new OrderRequestError(
              400,
              `El producto ${index + 1} del pedido no es válido.`,
            );
          }

          const legacyId =
            rawItem.legacyId;

          const quantity =
            rawItem.quantity;

          if (
            typeof legacyId !==
              "number" ||
            !Number.isInteger(
              legacyId,
            ) ||
            legacyId <= 0
          ) {
            throw new OrderRequestError(
              400,
              `El producto ${index + 1} no tiene un ID válido.`,
            );
          }

          if (
            typeof quantity !==
              "number" ||
            !Number.isInteger(
              quantity,
            ) ||
            quantity <= 0 ||
            quantity > 50
          ) {
            throw new OrderRequestError(
              400,
              `La cantidad del producto ${index + 1} no es válida.`,
            );
          }

          const rawCustomization =
            rawItem.customization;

          if (
            rawCustomization !==
              undefined &&
            !isObject(
              rawCustomization,
            )
          ) {
            throw new OrderRequestError(
              400,
              `La personalización del producto ${index + 1} no es válida.`,
            );
          }

          const customization =
            isObject(
              rawCustomization,
            )
              ? rawCustomization
              : {};

          const sizeId =
            getOptionalString(
              customization.sizeId,
            );

          const extraIds =
            getStringArray(
              customization.extraIds,
            );

          if (
            extraIds === null
          ) {
            throw new OrderRequestError(
              400,
              `Los extras del producto ${index + 1} no son válidos.`,
            );
          }

          const removedIngredients =
            getStringArray(
              customization.removedIngredients,
            );

          if (
            removedIngredients ===
            null
          ) {
            throw new OrderRequestError(
              400,
              `Los ingredientes quitados del producto ${index + 1} no son válidos.`,
            );
          }

          const notes =
            getString(
              customization.notes,
            );

          if (
            notes.length > 300
          ) {
            throw new OrderRequestError(
              400,
              `La aclaración del producto ${index + 1} no puede superar los 300 caracteres.`,
            );
          }

          const rawChoices =
            customization.choices ?? [];

          if (!Array.isArray(rawChoices)) {
            throw new OrderRequestError(
              400,
              `Las elecciones del producto ${index + 1} no son válidas.`,
            );
          }

          const choices = rawChoices.map(
            (rawChoice) => {
              if (!isObject(rawChoice)) {
                throw new OrderRequestError(
                  400,
                  `Una elección del producto ${index + 1} no es válida.`,
                );
              }

              const groupId = getString(rawChoice.groupId);
              const optionId = getString(rawChoice.optionId);
              const removed = getStringArray(
                rawChoice.removedIngredients,
              );

              if (!groupId || !optionId || removed === null) {
                throw new OrderRequestError(
                  400,
                  `Una elección del producto ${index + 1} está incompleta.`,
                );
              }

              return {
                groupId,
                optionId,
                removedIngredients: removed,
              };
            },
          );

          return {
            legacyId,
            quantity,
            sizeId,
            extraIds,
            removedIngredients,
            notes,
            choices,
          };
        },
      );

    const legacyIds = [
      ...new Set(
        parsedItems.map(
          (item) =>
            item.legacyId,
        ),
      ),
    ];

    const products =
      await Product.find({
        legacyId: {
          $in: legacyIds,
        },
      });

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
            ],
          ),
      );

    const orderItems:
      OrderItemSnapshot[] = [];

    let productsTotal = 0;

    for (
      const parsedItem of
      parsedItems
    ) {
      const product =
        productsByLegacyId.get(
          parsedItem.legacyId,
        );

      if (!product) {
        throw new OrderRequestError(
          404,
          `El producto con ID ${parsedItem.legacyId} ya no existe.`,
        );
      }

      if (!product.active) {
        throw new OrderRequestError(
          409,
          `${product.name} ya no está disponible.`,
        );
      }

      let selectedSize:
        ProductOption | undefined;

      if (
        product.sizes.length >
        0
      ) {
        if (parsedItem.sizeId) {
          selectedSize =
            product.sizes.find(
              (size) =>
                size.id ===
                parsedItem.sizeId,
            );

          if (!selectedSize) {
            throw new OrderRequestError(
              400,
              `El tamaño elegido para ${product.name} ya no está disponible.`,
            );
          }
        } else {
          selectedSize =
            product.sizes.find(
              (size) =>
                size.priceModifier ===
                0,
            ) ??
            product.sizes[0];
        }
      } else if (
        parsedItem.sizeId
      ) {
        throw new OrderRequestError(
          400,
          `${product.name} no admite selección de tamaño.`,
        );
      }

      const selectedExtras =
        parsedItem.extraIds.map(
          (extraId) => {
            const extra =
              product.extras.find(
                (
                  productExtra,
                ) =>
                  productExtra.id ===
                  extraId,
              );

            if (!extra) {
              throw new OrderRequestError(
                400,
                `Uno de los extras elegidos para ${product.name} ya no está disponible.`,
              );
            }

            return extra;
          },
        );

      const validIngredients =
        new Set(
          product.ingredients,
        );

      const invalidRemovedIngredient =
        parsedItem
          .removedIngredients
          .find(
            (ingredient) =>
              !validIngredients.has(
                ingredient,
              ),
          );

      if (
        invalidRemovedIngredient
      ) {
        throw new OrderRequestError(
          400,
          `No se puede quitar "${invalidRemovedIngredient}" de ${product.name}.`,
        );
      }

      const choiceSnapshots: OrderChoiceSnapshot[] = [];

      if (
        parsedItem.choices.length !==
        product.choiceGroups.length
      ) {
        throw new OrderRequestError(
          400,
          `Completá todas las elecciones de ${product.name}.`,
        );
      }

      for (const group of product.choiceGroups) {
        const submitted = parsedItem.choices.find(
          (choice) => choice.groupId === group.id,
        );

        const option = submitted
          ? group.options.find(
              (candidate) =>
                candidate.id === submitted.optionId,
            )
          : undefined;

        if (!submitted || !option) {
          throw new OrderRequestError(
            400,
            `Una elección de ${product.name} ya no está disponible.`,
          );
        }

        const allowedIngredients = new Set(
          option.ingredients,
        );

        if (
          submitted.removedIngredients.some(
            (ingredient) =>
              !allowedIngredients.has(ingredient),
          )
        ) {
          throw new OrderRequestError(
            400,
            `Los ingredientes quitados de ${group.label} no son válidos.`,
          );
        }

        choiceSnapshots.push({
          groupId: group.id,
          groupLabel: group.label,
          optionId: option.id,
          optionLabel: option.label,
          kind: option.kind,
          productLegacyId: option.productLegacyId,
          sizeId: option.sizeId,
          removedIngredients:
            submitted.removedIngredients,
        });
      }

      const extrasPrice =
        selectedExtras.reduce(
          (
            total,
            extra,
          ) =>
            total +
            extra.priceModifier,
          0,
        );

      const sizePrice =
        selectedSize
          ?.priceModifier ??
        0;

      const unitPrice =
        Math.max(
          0,
          product.price +
            sizePrice +
            extrasPrice,
        );

      const lineTotal =
        unitPrice *
        parsedItem.quantity;

      productsTotal +=
        lineTotal;

      orderItems.push({
        product:
          product._id,

        legacyId:
          parsedItem.legacyId,

        name:
          product.name,

        basePrice:
          product.price,

        unitPrice,

        quantity:
          parsedItem.quantity,

        lineTotal,

        customization: {
          size:
            selectedSize
              ? createOptionSnapshot(
                  selectedSize,
                )
              : undefined,

          extras:
            selectedExtras.map(
              createOptionSnapshot,
            ),

          removedIngredients:
            parsedItem
              .removedIngredients,

          notes:
            parsedItem.notes,

          choices: choiceSnapshots,
        },
      });
    }

    const orderNumber =
      await getNextOrderNumber();

    const order =
      await Order.create({
        orderNumber,

        customer: {
          name:
            customerName,

          phone,

          address,
        },

        deliveryMethod,

        paymentMethod,

        items:
          orderItems,

        productsTotal,

        /*
          Por ahora el costo de envío
          se confirma por WhatsApp.
        */
        deliveryCost: null,

        total:
          productsTotal,

        status:
          "pending",

        generalNotes,
      });

    response
      .status(201)
      .json({
        success: true,

        message:
          "Pedido registrado correctamente.",

        data:
          order.toObject(),
      });
  } catch (error) {
    if (
      error instanceof
      OrderRequestError
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
      "Error al crear pedido:",
      error,
    );

    response
      .status(500)
      .json({
        success: false,
        message:
          "No se pudo registrar el pedido.",
      });
  }
}

/* ========================================
   ESTADOS DE PEDIDO
======================================== */

const orderStatuses:
  OrderStatus[] = [
    "pending",
    "confirmed",
    "cancelled",
  ];

function isOrderStatus(
  value: string,
): value is OrderStatus {
  return orderStatuses.includes(
    value as OrderStatus,
  );
}

function getOrderId(
  request: Request,
): string | null {
  const value =
    request.params.id;

  if (
    typeof value !== "string" ||
    !mongoose.isValidObjectId(
      value,
    )
  ) {
    return null;
  }

  return value;
}

/* ========================================
   LISTAR PEDIDOS - ADMIN
======================================== */

export async function getOrders(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const status =
      getString(
        request.query.status,
      );

    if (
      status &&
      !isOrderStatus(status)
    ) {
      response
        .status(400)
        .json({
          success: false,
          message:
            "El estado solicitado no es válido.",
        });

      return;
    }

    const filter =
      isOrderStatus(status)
        ? {
            status,
          }
        : undefined;

    const orders =
      await Order.find(
        filter,
      )
        .sort({
          createdAt: -1,
          orderNumber: -1,
        })
        .lean();

    response
      .status(200)
      .json({
        success: true,
        data: orders,
      });
  } catch (error) {
    console.error(
      "Error al obtener pedidos:",
      error,
    );

    response
      .status(500)
      .json({
        success: false,
        message:
          "No se pudieron cargar los pedidos.",
      });
  }
}

/* ========================================
   OBTENER PEDIDO - ADMIN
======================================== */

export async function getOrderById(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const orderId =
      getOrderId(request);

    if (!orderId) {
      response
        .status(400)
        .json({
          success: false,
          message:
            "El identificador del pedido no es válido.",
        });

      return;
    }

    const order =
      await Order.findById(
        orderId,
      ).lean();

    if (!order) {
      response
        .status(404)
        .json({
          success: false,
          message:
            "El pedido solicitado no existe.",
        });

      return;
    }

    response
      .status(200)
      .json({
        success: true,
        data: order,
      });
  } catch (error) {
    console.error(
      "Error al obtener pedido:",
      error,
    );

    response
      .status(500)
      .json({
        success: false,
        message:
          "No se pudo cargar el pedido.",
      });
  }
}

/* ========================================
   CAMBIAR ESTADO - ADMIN
======================================== */

export async function updateOrderStatus(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const orderId =
      getOrderId(request);

    if (!orderId) {
      response
        .status(400)
        .json({
          success: false,
          message:
            "El identificador del pedido no es válido.",
        });

      return;
    }

    if (!isObject(request.body)) {
      response
        .status(400)
        .json({
          success: false,
          message:
            "La actualización no tiene un formato válido.",
        });

      return;
    }

    const nextStatus =
      getString(
        request.body.status,
      );

    if (
      nextStatus !==
        "confirmed" &&
      nextStatus !==
        "cancelled"
    ) {
      response
        .status(400)
        .json({
          success: false,
          message:
            "El pedido solo puede confirmarse o cancelarse.",
        });

      return;
    }

    if (
      nextStatus ===
      "confirmed"
    ) {
      const result =
        await confirmOrderWithInventory(
          orderId,
        );

      response
        .status(200)
        .json({
          success: true,
          message:
            result.alreadyConfirmed
              ? "El pedido ya estaba confirmado."
              : "Pedido confirmado y stock descontado correctamente.",
          data:
            result.order.toObject(),
        });

      return;
    }

    const order =
      await Order.findOneAndUpdate(
        {
          _id:
            orderId,
          status:
            "pending",
        },
        {
          $set: {
            status:
              "cancelled",
          },
        },
        {
          new:
            true,
        },
      );

    if (!order) {
      const existingOrder =
        await Order.findById(
          orderId,
        );

      if (!existingOrder) {
        response
          .status(404)
          .json({
            success: false,
            message:
              "El pedido solicitado no existe.",
          });

        return;
      }

      if (
        existingOrder.status ===
        "cancelled"
      ) {
        response
          .status(200)
          .json({
            success: true,
            message:
              "El pedido ya estaba cancelado.",
            data:
              existingOrder.toObject(),
          });

        return;
      }

      response
        .status(409)
        .json({
          success: false,
          message:
            "Un pedido confirmado o cancelado no puede volver a modificarse.",
        });

      return;
    }

    response
      .status(200)
      .json({
        success: true,
        message:
          "Pedido cancelado correctamente.",
        data:
          order.toObject(),
      });
  } catch (error) {
    if (
      error instanceof
      OrderInventoryError
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
      "Error al actualizar estado del pedido:",
      error,
    );

    response
      .status(500)
      .json({
        success: false,
        message:
          "No se pudo actualizar el estado del pedido.",
      });
  }
}
