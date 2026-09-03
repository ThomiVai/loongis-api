import {
  Schema,
  model,
  type Types,
} from "mongoose";

export type InventoryMovementType =
  | "initial"
  | "restock"
  | "waste"
  | "adjustment"
  | "sale";

export interface InventoryMovementDocument {
  ingredient: Types.ObjectId;

  order?: Types.ObjectId;
  orderNumber?: number;

  type: InventoryMovementType;

  change: number;
  previousStock: number;
  newStock: number;

  unitCost: number;
  estimatedCost: number;

  note?: string;
}

const inventoryMovementSchema =
  new Schema<InventoryMovementDocument>(
    {
      ingredient: {
        type: Schema.Types.ObjectId,
        ref: "Ingredient",
        required: true,
        index: true,
      },

      order: {
        type: Schema.Types.ObjectId,
        ref: "Order",
        required: false,
        index: true,
      },

      orderNumber: {
        type: Number,
        required: false,
        min: 1,
        index: true,
      },

      type: {
        type: String,
        required: true,
        enum: [
          "initial",
          "restock",
          "waste",
          "adjustment",
          "sale",
        ],
        index: true,
      },

      change: {
        type: Number,
        required: true,
      },

      previousStock: {
        type: Number,
        required: true,
        min: 0,
      },

      newStock: {
        type: Number,
        required: true,
        min: 0,
      },

      unitCost: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
      },

      estimatedCost: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
      },

      note: {
        type: String,
        trim: true,
        maxlength: 300,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

inventoryMovementSchema.index({
  createdAt: -1,
});

inventoryMovementSchema.index({
  order: 1,
  createdAt: -1,
});

export const InventoryMovement =
  model<InventoryMovementDocument>(
    "InventoryMovement",
    inventoryMovementSchema,
  );
