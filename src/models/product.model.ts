import {
  Schema,
  model,
  type Types,
} from "mongoose";

export interface ProductOption {
  id: string;
  name: string;
  label: string;
  priceModifier: number;
}

export interface ProductDocument {
  legacyId?: number;

  name: string;
  slug: string;
  description: string;
  price: number;

  image: string;
  imageAlt: string;

  category: Types.ObjectId;

  featured: boolean;
  active: boolean;
  order: number;

  sizes: ProductOption[];
  extras: ProductOption[];
  ingredients: string[];
}

const productOptionSchema =
  new Schema<ProductOption>(
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
        default: 0,
      },
    },
    {
      _id: false,
    },
  );

const productSchema =
  new Schema<ProductDocument>(
    {
      legacyId: {
        type: Number,
        min: 1,
        unique: true,
        sparse: true,
      },

      name: {
        type: String,
        required: [
          true,
          "El nombre del producto es obligatorio.",
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

      description: {
        type: String,
        required: [
          true,
          "La descripción es obligatoria.",
        ],
        trim: true,
        maxlength: 500,
      },

      price: {
        type: Number,
        required: [
          true,
          "El precio es obligatorio.",
        ],
        min: [
          0,
          "El precio no puede ser negativo.",
        ],
      },

      image: {
        type: String,
        required: [
          true,
          "La imagen es obligatoria.",
        ],
        trim: true,
      },

      imageAlt: {
        type: String,
        required: [
          true,
          "El texto alternativo de la imagen es obligatorio.",
        ],
        trim: true,
      },

      category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
        required: [
          true,
          "La categoría es obligatoria.",
        ],
      },

      featured: {
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

      sizes: {
        type: [productOptionSchema],
        default: [],
      },

      extras: {
        type: [productOptionSchema],
        default: [],
      },

      ingredients: {
        type: [String],
        default: [],
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

export const Product =
  model<ProductDocument>(
    "Product",
    productSchema,
  );