import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";

import { Admin, normalizeAdminRole } from "../models/admin.model";
import { sendPasswordResetEmail } from "../services/passwordResetEmail";

const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const PASSWORD_RESET_COOLDOWN_MS = 60 * 1000;

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/* ========================================
   LOGIN ADMIN
======================================== */

export async function loginAdmin(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const { email, password } = request.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      response.status(400).json({
        success: false,
        message: "Email y contraseña son obligatorios.",
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const admin = await Admin.findOne({
      email: normalizedEmail,
      active: true,
    }).select("+password");

    if (!admin) {
      response.status(401).json({
        success: false,
        message: "Email o contraseña incorrectos.",
      });
      return;
    }

    const passwordMatches = await bcrypt.compare(
      password,
      admin.password,
    );

    if (!passwordMatches) {
      response.status(401).json({
        success: false,
        message: "Email o contraseña incorrectos.",
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error("La variable JWT_SECRET no está definida.");
    }

    const token = jwt.sign(
      {
        adminId: admin._id.toString(),
        role: normalizeAdminRole(admin.role),
        tokenVersion: admin.tokenVersion ?? 0,
      },
      jwtSecret,
      { expiresIn: "8h" },
    );

    response.status(200).json({
      success: true,
      message: "Inicio de sesión correcto.",
      token,
      admin: {
        id: admin._id.toString(),
        email: admin.email,
        role: normalizeAdminRole(admin.role),
      },
    });
  } catch (error) {
    console.error("Error iniciando sesión:", error);
    response.status(500).json({
      success: false,
      message: "Ocurrió un error al iniciar sesión.",
    });
  }
}

/* ========================================
   RECUPERAR CONTRASEÑA
======================================== */

export async function requestPasswordReset(
  request: Request,
  response: Response,
): Promise<void> {
  const genericMessage =
    "Si el email corresponde a una cuenta activa, vas a recibir un enlace para restablecer la contraseña.";

  try {
    const email = request.body?.email;

    if (
      typeof email !== "string" ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      response.status(400).json({
        success: false,
        message: "Ingresá un email válido.",
      });
      return;
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.PASSWORD_RESET_FROM;
    const baseUrl = process.env.PASSWORD_RESET_BASE_URL?.replace(/\/+$/, "");

    if (!apiKey || !from || !baseUrl) {
      response.status(503).json({
        success: false,
        message:
          "La recuperación todavía no está configurada. Contactá al administrador del sitio.",
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const admin = await Admin.findOne({
      email: normalizedEmail,
      active: true,
    });

    if (admin) {
      const now = new Date();
      const cooldownBefore = new Date(
        now.getTime() - PASSWORD_RESET_COOLDOWN_MS,
      );
      const rawToken = randomBytes(32).toString("hex");
      const resetTokenHash = hashResetToken(rawToken);

      const updatedAdmin = await Admin.findOneAndUpdate(
        {
          _id: admin._id,
          active: true,
          $or: [
            { passwordResetRequestedAt: { $exists: false } },
            { passwordResetRequestedAt: null },
            { passwordResetRequestedAt: { $lte: cooldownBefore } },
          ],
        },
        {
          $set: {
            passwordResetTokenHash: resetTokenHash,
            passwordResetExpiresAt: new Date(
              now.getTime() + PASSWORD_RESET_TTL_MS,
            ),
            passwordResetRequestedAt: now,
          },
        },
        { new: true },
      );

      if (updatedAdmin) {
        const resetUrl =
          baseUrl +
          "/admin/reset-password?token=" +
          encodeURIComponent(rawToken);

        try {
          await sendPasswordResetEmail({
            apiKey,
            from,
            to: normalizedEmail,
            resetUrl,
          });
        } catch (error) {
          await Admin.updateOne(
            {
              _id: updatedAdmin._id,
              passwordResetTokenHash: resetTokenHash,
            },
            {
              $unset: {
                passwordResetTokenHash: 1,
                passwordResetExpiresAt: 1,
              },
            },
          );
          console.error("No se pudo enviar el email de recuperación.");
        }
      }
    }

    response.status(200).json({
      success: true,
      message: genericMessage,
    });
  } catch (error) {
    console.error("Error solicitando recuperación de contraseña:", error);
    response.status(500).json({
      success: false,
      message: "No se pudo procesar la solicitud. Intentá más tarde.",
    });
  }
}

/* ========================================
   ESTABLECER NUEVA CONTRASEÑA
======================================== */

export async function resetPassword(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const token = request.body?.token;
    const newPassword = request.body?.newPassword;

    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/i.test(token) ||
      typeof newPassword !== "string" ||
      newPassword.length < 10 ||
      newPassword.length > 128
    ) {
      response.status(400).json({
        success: false,
        message:
          "El enlace no es válido o venció. Solicitá uno nuevo e intentá otra vez.",
      });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const admin = await Admin.findOneAndUpdate(
      {
        passwordResetTokenHash: hashResetToken(token),
        passwordResetExpiresAt: { $gt: new Date() },
        active: true,
      },
      {
        $set: { password: passwordHash },
        $unset: {
          passwordResetTokenHash: 1,
          passwordResetExpiresAt: 1,
          passwordResetRequestedAt: 1,
        },
        $inc: { tokenVersion: 1 },
      },
      { new: true },
    );

    if (!admin) {
      response.status(400).json({
        success: false,
        message:
          "El enlace no es válido o venció. Solicitá uno nuevo e intentá otra vez.",
      });
      return;
    }

    response.status(200).json({
      success: true,
      message:
        "La contraseña se actualizó. Ya podés iniciar sesión con la nueva clave.",
    });
  } catch (error) {
    console.error("Error restableciendo contraseña:", error);
    response.status(500).json({
      success: false,
      message: "No se pudo actualizar la contraseña. Intentá más tarde.",
    });
  }
}

/* ========================================
   CAMBIAR CONTRASEÑA PROPIA
======================================== */

export async function changeOwnPassword(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const currentPassword = request.body?.currentPassword;
    const newPassword = request.body?.newPassword;

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      newPassword.length < 10 ||
      newPassword.length > 128
    ) {
      response.status(400).json({
        success: false,
        message:
          "La contraseña actual es obligatoria y la nueva debe tener entre 10 y 128 caracteres.",
      });
      return;
    }

    const currentAdmin = response.locals.admin;
    const admin = await Admin.findById(currentAdmin?.id).select("+password");

    if (!admin) {
      response.status(401).json({
        success: false,
        message: "La sesión ya no es válida.",
      });
      return;
    }

    const matches = await bcrypt.compare(
      currentPassword,
      admin.password,
    );

    if (!matches) {
      response.status(400).json({
        success: false,
        message: "La contraseña actual no es correcta.",
      });
      return;
    }

    admin.password = await bcrypt.hash(newPassword, 12);
    await admin.save();

    response.status(200).json({
      success: true,
      message: "Contraseña actualizada correctamente.",
    });
  } catch (error) {
    console.error("Error cambiando contraseña:", error);
    response.status(500).json({
      success: false,
      message: "No se pudo cambiar la contraseña.",
    });
  }
}

/* ========================================
   ADMIN ACTUAL
======================================== */

export function getCurrentAdmin(
  _request: Request,
  response: Response,
): void {
  const admin = response.locals.admin;

  if (!admin) {
    response.status(401).json({
      success: false,
      message: "No hay una sesión válida.",
    });
    return;
  }

  response.status(200).json({
    success: true,
    data: admin,
  });
}
