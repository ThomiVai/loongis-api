import {
  Schema,
  model,
  type Types,
} from "mongoose";

export interface InventoryCountItem {
  ingredient: Types.ObjectId;
  ingredientName: string;
  expectedStock: number;
  countedStock: number;
  difference: number;
  unitCost: number;
  estimatedDifferenceCost: number;
}

export interface InventoryCountDocument {
  countedAt: Date;
  label?: string;
  notes?: string;
  items: InventoryCountItem[];
  totalDifferenceCost: number;
  createdBy: Types.ObjectId;
  createdByEmail: string;
}

const inventoryCountItemSchema =
  new Schema<InventoryCountItem>(
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
      expectedStock: {
        type: Number,
        required: true,
        min: 0,
      },
      countedStock: {
        type: Number,
        required: true,
        min: 0,
      },
      difference: {
        type: Number,
        required: true,
      },
      unitCost: {
        type: Number,
        required: true,
        min: 0,
      },
      estimatedDifferenceCost: {
        type: Number,
        required: true,
      },
    },
    {
      _id: false,
    },
  );

const inventoryCountSchema =
  new Schema<InventoryCountDocument>(
    {
      countedAt: {
        type: Date,
        required: true,
        default: Date.now,
        index: true,
      },
      label: {
        type: String,
        trim: true,
        maxlength: 100,
        default: undefined,
      },
      notes: {
        type: String,
        trim: true,
        maxlength: 500,
        default: undefined,
      },
      items: {
        type: [inventoryCountItemSchema],
        required: true,
      },
      totalDifferenceCost: {
        type: Number,
        required: true,
        default: 0,
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

inventoryCountSchema.index({
  countedAt: -1,
});

export const InventoryCount =
  model<InventoryCountDocument>(
    "InventoryCount",
    inventoryCountSchema,
  );
