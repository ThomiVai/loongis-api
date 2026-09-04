import {
  Schema,
  model,
  type Types,
} from "mongoose";

export interface InventoryPurchaseLine {
  ingredient: Types.ObjectId;
  ingredientName: string;
  presentationQuantity: number;
  presentationLabel: string;
  conversionFactor: number;
  baseQuantity: number;
  totalCost: number;
  unitCost: number;
  batchNumber?: string;
  expirationDate?: Date;
}

export interface InventoryPurchaseDocument {
  supplier?: Types.ObjectId;
  supplierName?: string;
  invoiceNumber?: string;
  purchasedAt: Date;
  lines: InventoryPurchaseLine[];
  totalCost: number;
  notes?: string;
  createdBy: Types.ObjectId;
  createdByEmail: string;
}

const purchaseLineSchema =
  new Schema<InventoryPurchaseLine>(
    {
      ingredient: {
        type: Schema.Types.ObjectId,
        ref: "Ingredient",
        required: true,
      },
      ingredientName: {
        type: String,
        required: true,
        trim: true,
      },
      presentationQuantity: {
        type: Number,
        required: true,
        min: 0.000001,
      },
      presentationLabel: {
        type: String,
        required: true,
        trim: true,
      },
      conversionFactor: {
        type: Number,
        required: true,
        min: 0.000001,
      },
      baseQuantity: {
        type: Number,
        required: true,
        min: 0.000001,
      },
      totalCost: {
        type: Number,
        required: true,
        min: 0,
      },
      unitCost: {
        type: Number,
        required: true,
        min: 0,
      },
      batchNumber: {
        type: String,
        trim: true,
        maxlength: 80,
        default: undefined,
      },
      expirationDate: {
        type: Date,
        default: undefined,
      },
    },
    {
      _id: false,
    },
  );

const inventoryPurchaseSchema =
  new Schema<InventoryPurchaseDocument>(
    {
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
      invoiceNumber: {
        type: String,
        trim: true,
        maxlength: 80,
        default: undefined,
      },
      purchasedAt: {
        type: Date,
        required: true,
        default: Date.now,
        index: true,
      },
      lines: {
        type: [purchaseLineSchema],
        required: true,
        validate: {
          validator(lines: InventoryPurchaseLine[]) {
            return lines.length > 0;
          },
          message: "La compra debe tener al menos un insumo.",
        },
      },
      totalCost: {
        type: Number,
        required: true,
        min: 0,
      },
      notes: {
        type: String,
        trim: true,
        maxlength: 500,
        default: undefined,
      },
      createdBy: {
        type: Schema.Types.ObjectId,
        ref: "Admin",
        required: true,
      },
      createdByEmail: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

inventoryPurchaseSchema.index({
  purchasedAt: -1,
});

export const InventoryPurchase =
  model<InventoryPurchaseDocument>(
    "InventoryPurchase",
    inventoryPurchaseSchema,
  );
