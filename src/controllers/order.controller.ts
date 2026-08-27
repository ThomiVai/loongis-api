import type {
  Request,
  Response,
} from "express";

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

import type {
  OrderItemSnapshot,
  OrderOptionSnapshot,
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
        "delivery" &&
      deliveryMethod !==
        "pickup"
    ) {
      throw new OrderRequestError(
        400,
        "La forma de entrega no es válida.",
      );
    }

    if (
      deliveryMethod ===
        "delivery" &&
      !address
    ) {
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

          return {
            legacyId,
            quantity,
            sizeId,
            extraIds,
            removedIngredients,
            notes,
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

          address:
            deliveryMethod ===
              "delivery"
              ? address
              : "",
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
