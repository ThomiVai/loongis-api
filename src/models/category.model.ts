import {
  Schema,
  model,
} from "mongoose";

export interface CategoryDocument {
  name: string;
  slug: string;
  active: boolean;
  order: number;
}

const categorySchema =
  new Schema<CategoryDocument>(
    {
      name: {
        type: String,
        required: [
          true,
          "El nombre de la categoría es obligatorio.",
        ],
        trim: true,
        minlength: 2,
        maxlength: 50,
      },

      slug: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true,
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

export const Category = model<CategoryDocument>(
  "Category",
  categorySchema,
);