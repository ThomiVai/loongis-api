import bcrypt from "bcryptjs";

import type {
  Request,
  Response,
} from "express";

import jwt from "jsonwebtoken";

import { Admin } from "../models/admin.model";
import {
  normalizeAdminRole,
} from "../models/admin.model";

/* ========================================
   LOGIN ADMIN
======================================== */

export async function loginAdmin(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const {
      email,
      password,
    } = request.body;

    /* =====================================
       VALIDACIÓN BÁSICA
    ===================================== */

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      response.status(400).json({
        success: false,
        message:
          "Email y contraseña son obligatorios.",
      });

      return;
    }

    /* =====================================
       BUSCAR ADMINISTRADOR
    ===================================== */

    const normalizedEmail =
      email
        .trim()
        .toLowerCase();

    const admin =
      await Admin.findOne({
        email: normalizedEmail,
        active: true,
      }).select("+password");

    if (!admin) {
      response.status(401).json({
        success: false,
        message:
          "Email o contraseña incorrectos.",
      });

      return;
    }

    /* =====================================
       COMPARAR CONTRASEÑA
    ===================================== */

    const passwordMatches =
      await bcrypt.compare(
        password,
        admin.password,
      );

    if (!passwordMatches) {
      response.status(401).json({
        success: false,
        message:
          "Email o contraseña incorrectos.",
      });

      return;
    }

    /* =====================================
       JWT
    ===================================== */

    const jwtSecret =
      process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error(
        "La variable JWT_SECRET no está definida.",
      );
    }

    const token =
      jwt.sign(
        {
          adminId:
            admin._id.toString(),
          role:
            normalizeAdminRole(
              admin.role,
            ),
        },
        jwtSecret,
        {
          expiresIn: "8h",
        },
      );

    /* =====================================
       RESPUESTA
    ===================================== */

    response.status(200).json({
      success: true,
      message:
        "Inicio de sesión correcto.",

      token,

      admin: {
        id:
          admin._id.toString(),
        email:
          admin.email,
        role:
          normalizeAdminRole(
            admin.role,
          ),
      },
    });
  } catch (error) {
    console.error(
      "Error iniciando sesión:",
      error,
    );

    response.status(500).json({
      success: false,
      message:
        "Ocurrió un error al iniciar sesión.",
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
    const currentPassword =
      request.body
        ?.currentPassword;

    const newPassword =
      request.body
        ?.newPassword;

    if (
      typeof currentPassword !==
        "string" ||
      typeof newPassword !==
        "string" ||
      newPassword.length < 10
    ) {
      response.status(400).json({
        success: false,
        message:
          "La contraseña actual es obligatoria y la nueva debe tener al menos 10 caracteres.",
      });

      return;
    }

    const currentAdmin =
      response.locals.admin;

    const admin =
      await Admin.findById(
        currentAdmin?.id,
      ).select("+password");

    if (!admin) {
      response.status(401).json({
        success: false,
        message:
          "La sesión ya no es válida.",
      });

      return;
    }

    const matches =
      await bcrypt.compare(
        currentPassword,
        admin.password,
      );

    if (!matches) {
      response.status(400).json({
        success: false,
        message:
          "La contraseña actual no es correcta.",
      });

      return;
    }

    admin.password =
      await bcrypt.hash(
        newPassword,
        12,
      );

    await admin.save();

    response.status(200).json({
      success: true,
      message:
        "Contraseña actualizada correctamente.",
    });
  } catch (error) {
    console.error(
      "Error cambiando contraseña:",
      error,
    );

    response.status(500).json({
      success: false,
      message:
        "No se pudo cambiar la contraseña.",
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
  const admin =
    response.locals.admin;

  if (!admin) {
    response.status(401).json({
      success: false,
      message:
        "No hay una sesión válida.",
    });

    return;
  }

  response.status(200).json({
    success: true,
    data: admin,
  });
}
