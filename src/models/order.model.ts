import {
  Schema,
  model,
  type Types,
} from "mongoose";

export type OrderDeliveryMethod =
  | "delivery"
  | "pickup";

export type OrderPaymentMethod =
  | "cash"
  | "transfer";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "cancelled";

export interface OrderOptionSnapshot {
  id: string;
  name: string;
  label: string;
  priceModifier: number;
}

export interface OrderCustomizationSnapshot {
  size?: OrderOptionSnapshot;
  extras: OrderOptionSnapshot[];
  removedIngredients: string[];
  notes: string;
  choices: OrderChoiceSnapshot[];
}

export interface OrderChoiceSnapshot {
  groupId: string;
  groupLabel: string;
  optionId: string;
  optionLabel: string;
  kind: "burger" | "beverage";
  productLegacyId?: number;
  sizeId?: "simple" | "doble";
  removedIngredients: string[];
}

export interface OrderCustomerSnapshot {
  name: string;
  phone: string;
  address: string;
}

export interface OrderItemSnapshot {
  product: Types.ObjectId;
  legacyId: number;

  name: string;

  basePrice: number;
  unitPrice: number;

  quantity: number;
  lineTotal: number;

  customization:
    OrderCustomizationSnapshot;
}

export interface OrderDocument {
  orderNumber: number;

  customer:
    OrderCustomerSnapshot;

  deliveryMethod:
    OrderDeliveryMethod;

  paymentMethod:
    OrderPaymentMethod;

  items: OrderItemSnapshot[];

  productsTotal: number;

  deliveryCost:
    number | null;

  total: number;

  status: OrderStatus;

  generalNotes: string;
}

const orderOptionSnapshotSchema =
  new Schema<OrderOptionSnapshot>(
    {
      id: {
        type: String,
        required: true,
        trim: true,
      },

      name: {
        type: String,
        required: true,
        trim: true,
      },

      label: {
        type: String,
        required: true,
        trim: true,
      },

      priceModifier: {
        type: Number,
        required: true,
      },
    },
    {
      _id: false,
    },
  );

const orderCustomizationSchema =
  new Schema<OrderCustomizationSnapshot>(
    {
      size: {
        type:
          orderOptionSnapshotSchema,
        required: false,
        default: undefined,
      },

      extras: {
        type: [
          orderOptionSnapshotSchema,
        ],
        default: [],
      },

      removedIngredients: {
        type: [String],
        default: [],
      },

      notes: {
        type: String,
        default: "",
        trim: true,
        maxlength: 300,
      },

      choices: {
        type: [
          new Schema<OrderChoiceSnapshot>(
            {
              groupId: { type: String, required: true, trim: true },
              groupLabel: { type: String, required: true, trim: true },
              optionId: { type: String, required: true, trim: true },
              optionLabel: { type: String, required: true, trim: true },
              kind: {
                type: String,
                enum: ["burger", "beverage"],
                required: true,
              },
              productLegacyId: { type: Number, required: false, min: 1 },
              sizeId: {
                type: String,
                enum: ["simple", "doble"],
                required: false,
              },
              removedIngredients: { type: [String], default: [] },
            },
            { _id: false },
          ),
        ],
        default: [],
      },
    },
    {
      _id: false,
    },
  );

const orderCustomerSchema =
  new Schema<OrderCustomerSnapshot>(
    {
      name: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 100,
      },

      phone: {
        type: String,
        required: true,
        trim: true,
        minlength: 6,
        maxlength: 30,
      },

      address: {
        type: String,
        default: "",
        trim: true,
        maxlength: 220,
      },
    },
    {
      _id: false,
    },
  );

const orderItemSchema =
  new Schema<OrderItemSnapshot>(
    {
      product: {
        type:
          Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },

      legacyId: {
        type: Number,
        required: true,
        min: 1,
      },

      name: {
        type: String,
        required: true,
        trim: true,
      },

      basePrice: {
        type: Number,
        required: true,
        min: 0,
      },

      unitPrice: {
        type: Number,
        required: true,
        min: 0,
      },

      quantity: {
        type: Number,
        required: true,
        min: 1,
      },

      lineTotal: {
        type: Number,
        required: true,
        min: 0,
      },

      customization: {
        type:
          orderCustomizationSchema,
        required: true,
      },
    },
    {
      _id: false,
    },
  );

const orderSchema =
  new Schema<OrderDocument>(
    {
      orderNumber: {
        type: Number,
        required: true,
        unique: true,
        min: 1,
      },

      customer: {
        type:
          orderCustomerSchema,
        required: true,
      },

      deliveryMethod: {
        type: String,
        enum: [
          "delivery",
          "pickup",
        ],
        required: true,
      },

      paymentMethod: {
        type: String,
        enum: [
          "cash",
          "transfer",
        ],
        required: true,
      },

      items: {
        type: [
          orderItemSchema,
        ],
        required: true,
        validate: {
          validator(
            items:
              OrderItemSnapshot[],
          ) {
            return (
              Array.isArray(items) &&
              items.length > 0
            );
          },

          message:
            "El pedido debe tener al menos un producto.",
        },
      },

      productsTotal: {
        type: Number,
        required: true,
        min: 0,
      },

      deliveryCost: {
        type: Number,
        default: null,
        min: 0,
      },

      total: {
        type: Number,
        required: true,
        min: 0,
      },

      status: {
        type: String,
        enum: [
          "pending",
          "confirmed",
          "cancelled",
        ],
        default: "pending",
        index: true,
      },

      generalNotes: {
        type: String,
        default: "",
        trim: true,
        maxlength: 300,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

orderSchema.index({
  createdAt: -1,
});

orderSchema.index({
  status: 1,
  createdAt: -1,
});

export const Order =
  model<OrderDocument>(
    "Order",
    orderSchema,
  );
