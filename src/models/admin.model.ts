import {
  Schema,
  model,
} from "mongoose";

/* ========================================
   TIPO ADMIN
======================================== */

export type AdminRole =
  | "owner"
  | "manager"
  | "admin";

export function normalizeAdminRole(
  role: AdminRole,
): Exclude<AdminRole, "admin"> {
  return role === "manager"
    ? "manager"
    : "owner";
}

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

      passwordResetTokenHash: {
        type: String,
        select: false,
      },

      passwordResetExpiresAt: {
        type: Date,
        select: false,
      },

      passwordResetRequestedAt: {
        type: Date,
        select: false,
      },

      tokenVersion: {
        type: Number,
        default: 0,
        select: false,
      },

      role: {
        type: String,
        enum: [
          "owner",
          "manager",
          "admin",
        ],
        default: "manager",
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
