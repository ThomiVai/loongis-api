import {
  Schema,
  model,
  type Types,
} from "mongoose";

export interface ProductImageDocument {
  originalName: string;
  contentType:
    | "image/jpeg"
    | "image/png"
    | "image/webp";
  size: number;
  data: Buffer;
  uploadedBy: Types.ObjectId;
  uploadedByEmail: string;
}

const productImageSchema =
  new Schema<ProductImageDocument>(
    {
      originalName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 180,
      },
      contentType: {
        type: String,
        required: true,
        enum: [
          "image/jpeg",
          "image/png",
          "image/webp",
        ],
      },
      size: {
        type: Number,
        required: true,
        min: 1,
        max: 5 * 1024 * 1024,
      },
      data: {
        type: Buffer,
        required: true,
        select: false,
      },
      uploadedBy: {
        type: Schema.Types.ObjectId,
        ref: "Admin",
        required: true,
      },
      uploadedByEmail: {
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

export const ProductImage =
  model<ProductImageDocument>(
    "ProductImage",
    productImageSchema,
  );
