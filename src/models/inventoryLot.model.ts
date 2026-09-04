import {
  Schema,
  model,
  type Types,
} from "mongoose";

export type InventoryLotSource =
  | "legacy"
  | "initial"
  | "manual_restock"
  | "purchase"
  | "adjustment"
  | "reversal";

export interface InventoryLotDocument {
  ingredient: Types.ObjectId;
  purchase?: Types.ObjectId;
  supplier?: Types.ObjectId;
  supplierName?: string;
  batchNumber?: string;
  receivedAt: Date;
  expirationDate?: Date;
  initialQuantity: number;
  remainingQuantity: number;
  unitCost: number;
  source: InventoryLotSource;
}

const inventoryLotSchema =
  new Schema<InventoryLotDocument>(
    {
      ingredient: {
        type: Schema.Types.ObjectId,
        ref: "Ingredient",
        required: true,
        index: true,
      },
      purchase: {
        type: Schema.Types.ObjectId,
        ref: "InventoryPurchase",
        required: false,
        index: true,
      },
      supplier: {
        type: Schema.Types.ObjectId,
        ref: "Supplier",
        required: false,
      },
      supplierName: {
        type: String,
        trim: true,
        maxlength: 100,
        default: undefined,
      },
      batchNumber: {
        type: String,
        trim: true,
        maxlength: 80,
        default: undefined,
      },
      receivedAt: {
        type: Date,
        required: true,
        default: Date.now,
        index: true,
      },
      expirationDate: {
        type: Date,
        required: false,
        default: undefined,
        index: true,
      },
      initialQuantity: {
        type: Number,
        required: true,
        min: 0.000001,
      },
      remainingQuantity: {
        type: Number,
        required: true,
        min: 0,
        index: true,
      },
      unitCost: {
        type: Number,
        required: true,
        min: 0,
      },
      source: {
        type: String,
        required: true,
        enum: [
          "legacy",
          "initial",
          "manual_restock",
          "purchase",
          "adjustment",
          "reversal",
        ],
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

inventoryLotSchema.index({
  ingredient: 1,
  remainingQuantity: 1,
  expirationDate: 1,
});

export const InventoryLot =
  model<InventoryLotDocument>(
    "InventoryLot",
    inventoryLotSchema,
  );
