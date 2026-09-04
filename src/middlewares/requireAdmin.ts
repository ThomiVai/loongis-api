import type {
  NextFunction,
  Request,
  Response,
} from "express";

import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import { Admin } from "../models/admin.model";
import {
  normalizeAdminRole,
  type AdminRole,
} from "../models/admin.model";

function isAdminRole(
  value: unknown,
): value is AdminRole {
  return (
    value === "owner" ||
    value === "manager" ||
    value === "admin"
  );
}

/* ========================================
   MIDDLEWARE REQUIRE ADMIN
======================================== */

export async function requireAdmin(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    /* =====================================
       HEADER AUTHORIZATION
    ===================================== */

    const authorizationHeader =
      request.headers.authorization;

    if (!authorizationHeader) {
      response.status(401).json({
        success: false,
        message:
          "Se requiere autenticación.",
      });

      return;
    }

    /* =====================================
       BEARER TOKEN
    ===================================== */

    const [
      scheme,
      token,
    ] =
      authorizationHeader.split(
        " ",
      );

    if (
      scheme !== "Bearer" ||
      !token
    ) {
      response.status(401).json({
        success: false,
        message:
          "Token de autenticación inválido.",
      });

      return;
    }

    /* =====================================
       JWT SECRET
    ===================================== */

    const jwtSecret =
      process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error(
        "La variable JWT_SECRET no está definida.",
      );
    }

    /* =====================================
       VERIFICAR TOKEN
    ===================================== */

    const decodedToken =
      jwt.verify(
        token,
        jwtSecret,
      );

    if (
      typeof decodedToken ===
      "string"
    ) {
      response.status(401).json({
        success: false,
        message:
          "Token de autenticación inválido.",
      });

      return;
    }

    const adminId =
      decodedToken.adminId;

    const role =
      decodedToken.role;

    if (
      typeof adminId !==
        "string" ||
      !isAdminRole(role) ||
      !mongoose.Types.ObjectId.isValid(
        adminId,
      )
    ) {
      response.status(401).json({
        success: false,
        message:
          "Token de autenticación inválido.",
      });

      return;
    }

    /* =====================================
       VERIFICAR ADMIN EN BASE DE DATOS
    ===================================== */

    const admin =
      await Admin.findOne({
        _id: adminId,
        active: true,
      });

    if (!admin) {
      response.status(401).json({
        success: false,
        message:
          "La sesión ya no es válida.",
      });

      return;
    }

    /* =====================================
       DATOS DISPONIBLES PARA LA RUTA
    ===================================== */

    response.locals.admin = {
      id:
        admin._id.toString(),
      email:
        admin.email,
      role:
        normalizeAdminRole(
          admin.role,
        ),
    };

    next();
  } catch (error) {
    if (
      error instanceof
      jwt.TokenExpiredError
    ) {
      response.status(401).json({
        success: false,
        message:
          "La sesión expiró. Volvé a iniciar sesión.",
      });

      return;
    }

    if (
      error instanceof
      jwt.JsonWebTokenError
    ) {
      response.status(401).json({
        success: false,
        message:
          "Token de autenticación inválido.",
      });

      return;
    }

    console.error(
      "Error verificando autenticación:",
      error,
    );

    response.status(500).json({
      success: false,
      message:
        "Ocurrió un error verificando la autenticación.",
    });
  }
}

export function requireOwner(
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  const admin =
    response.locals.admin;

  if (
    !admin ||
    admin.role !== "owner"
  ) {
    response.status(403).json({
      success: false,
      message:
        "Esta acción requiere permisos del dueño.",
    });

    return;
  }

  next();
}
