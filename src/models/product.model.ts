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

export interface ProductChoiceOption {
  id: string;
  label: string;
  kind: "burger" | "beverage";
  productLegacyId?: number;
  sizeId?: "simple" | "doble";
  ingredients: string[];
}

export interface ProductChoiceGroup {
  id: string;
  label: string;
  options: ProductChoiceOption[];
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
  dailyPromo: boolean;
  active: boolean;
  order: number;

  sizes: ProductOption[];
  extras: ProductOption[];
  ingredients: string[];
  choiceGroups: ProductChoiceGroup[];
  dailyComboBurgerId?:
    | "solo-queso"
    | "clasic"
    | "bacon"
    | "crispy";
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

const productChoiceOptionSchema =
  new Schema<ProductChoiceOption>(
    {
      id: {
        type: String,
        required: true,
        trim: true,
      },
      label: {
        type: String,
        required: true,
        trim: true,
      },
      kind: {
        type: String,
        enum: ["burger", "beverage"],
        required: true,
      },
      productLegacyId: {
        type: Number,
        required: false,
        min: 1,
      },
      sizeId: {
        type: String,
        enum: ["simple", "doble"],
        required: false,
      },
      ingredients: {
        type: [String],
        default: [],
      },
    },
    { _id: false },
  );

const productChoiceGroupSchema =
  new Schema<ProductChoiceGroup>(
    {
      id: {
        type: String,
        required: true,
        trim: true,
      },
      label: {
        type: String,
        required: true,
        trim: true,
      },
      options: {
        type: [productChoiceOptionSchema],
        required: true,
        validate: {
          validator(options: ProductChoiceOption[]) {
            return options.length > 0;
          },
          message: "Cada elección debe tener opciones.",
        },
      },
    },
    { _id: false },
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

      dailyPromo: {
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

      choiceGroups: {
        type: [productChoiceGroupSchema],
        default: [],
      },

      dailyComboBurgerId: {
        type: String,
        enum: [
          "solo-queso",
          "clasic",
          "bacon",
          "crispy",
        ],
        required: false,
        default: undefined,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

/*
  Protección adicional de base de datos:
  puede existir como máximo un producto
  con dailyPromo = true.
*/
productSchema.index(
  {
    dailyPromo: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      dailyPromo: true,
    },
  },
);

export const Product =
  model<ProductDocument>(
    "Product",
    productSchema,
  );
