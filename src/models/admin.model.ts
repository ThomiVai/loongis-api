import {
  Schema,
  model,
} from "mongoose";

/* ========================================
   TIPO ADMIN
======================================== */

export type AdminRole =
  | "admin";

/* ========================================
   SCHEMA
======================================== */

const adminSchema =
  new Schema(
    {
      email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
      },

      password: {
        type: String,
        required: true,
        select: false,
      },

      role: {
        type: String,
        enum: ["admin"],
        default: "admin",
      },

      active: {
        type: Boolean,
        default: true,
      },
    },
    {
      timestamps: true,
    },
  );

/* ========================================
   MODELO
======================================== */

export const Admin =
  model(
    "Admin",
    adminSchema,
  );