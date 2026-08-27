import bcrypt from "bcryptjs";

import type {
  Request,
  Response,
} from "express";

import jwt from "jsonwebtoken";

import { Admin } from "../models/admin.model";

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
            admin.role,
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
          admin.role,
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