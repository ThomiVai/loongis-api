import {
  Schema,
  model,
} from "mongoose";

export interface SupplierDocument {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  notes?: string;
  active: boolean;
}

const supplierSchema =
  new Schema<SupplierDocument>(
    {
      name: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 100,
        unique: true,
      },
      contactName: {
        type: String,
        trim: true,
        maxlength: 100,
        default: undefined,
      },
      phone: {
        type: String,
        trim: true,
        maxlength: 40,
        default: undefined,
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 140,
        default: undefined,
      },
      notes: {
        type: String,
        trim: true,
        maxlength: 400,
        default: undefined,
      },
      active: {
        type: Boolean,
        default: true,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

export const Supplier =
  model<SupplierDocument>(
    "Supplier",
    supplierSchema,
  );
