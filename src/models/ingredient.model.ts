import {
  Schema,
  model,
} from "mongoose";

export type IngredientUnit =
  | "unit"
  | "portion"
  | "gram"
  | "kilogram"
  | "milliliter"
  | "liter";

export interface IngredientDocument {
  name: string;
  slug: string;

  unit: IngredientUnit;

  stock: number;
  minimumStock: number;
  targetStock: number;

  unitCost: number;

  purchaseUnitLabel?: string;
  purchaseUnitFactor: number;

  category?: string;
  storageLocation?: string;
  trackExpiration: boolean;

  active: boolean;
  order: number;
}

const ingredientSchema =
  new Schema<IngredientDocument>(
    {
      name: {
        type: String,
        required: [
          true,
          "El nombre del insumo es obligatorio.",
        ],
        trim: true,
        minlength: 2,
        maxlength: 100,
      },

      slug: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true,
      },

      unit: {
        type: String,
        required: true,
        enum: [
          "unit",
          "portion",
          "gram",
          "kilogram",
          "milliliter",
          "liter",
        ],
      },

      stock: {
        type: Number,
        required: true,
        default: 0,
        min: [
          0,
          "El stock no puede ser negativo.",
        ],
      },

      minimumStock: {
        type: Number,
        required: true,
        default: 0,
        min: [
          0,
          "El stock mínimo no puede ser negativo.",
        ],
      },

      targetStock: {
        type: Number,
        required: true,
        default: 0,
        min: [
          0,
          "El stock objetivo no puede ser negativo.",
        ],
      },

      unitCost: {
        type: Number,
        required: true,
        default: 0,
        min: [
          0,
          "El costo unitario no puede ser negativo.",
        ],
      },

      purchaseUnitLabel: {
        type: String,
        trim: true,
        maxlength: 60,
        default: undefined,
      },

      purchaseUnitFactor: {
        type: Number,
        required: true,
        default: 1,
        min: [
          0.000001,
          "La conversión de compra debe ser mayor a cero.",
        ],
      },

      category: {
        type: String,
        trim: true,
        maxlength: 60,
        default: undefined,
      },

      storageLocation: {
        type: String,
        trim: true,
        maxlength: 80,
        default: undefined,
      },

      trackExpiration: {
        type: Boolean,
        default: false,
      },

      active: {
        type: Boolean,
        default: true,
      },

      order: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

export const Ingredient =
  model<IngredientDocument>(
    "Ingredient",
    ingredientSchema,
  );
