import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import type {
  Request,
  Response,
} from "express";

import {
  Admin,
  normalizeAdminRole,
} from "../models/admin.model";

function getParam(
  value:
    | string
    | string[]
    | undefined,
): string | null {
  return typeof value === "string"
    ? value
    : Array.isArray(value)
      ? value[0] ?? null
      : null;
}

function isRole(
  value: unknown,
): value is
  | "owner"
  | "manager" {
  return (
    value === "owner" ||
    value === "manager"
  );
}

export async function getAdminUsers(
  _request: Request,
  response: Response,
): Promise<void> {
  try {
    const admins =
      await Admin.find()
        .select(
          "email role active createdAt updatedAt",
        )
        .sort({
          active: -1,
          email: 1,
        })
        .lean();

    response.status(200).json({
      success: true,
      data:
        admins.map(
          (admin) => ({
            ...admin,
            role:
              normalizeAdminRole(
                admin.role,
              ),
          }),
        ),
    });
  } catch (error) {
    console.error(
      "Error listando usuarios administrativos:",
      error,
    );

    response.status(500).json({
      success: false,
      message:
        "No se pudieron cargar los accesos administrativos.",
    });
  }
}

export async function createAdminUser(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const email =
      typeof request.body
        ?.email === "string"
        ? request.body.email
            .trim()
            .toLowerCase()
        : "";

    const password =
      request.body
        ?.password;

    const role =
      request.body
        ?.role;

    if (
      !email ||
      !email.includes("@") ||
      typeof password !==
        "string" ||
      password.length < 10 ||
      !isRole(role)
    ) {
      response.status(400).json({
        success: false,
        message:
          "Ingresá un correo válido, un rol y una contraseña temporal de al menos 10 caracteres.",
      });

      return;
    }

    const existing =
      await Admin.findOne({
        email,
      });

    if (existing) {
      response.status(409).json({
        success: false,
        message:
          "Ya existe una cuenta con ese correo.",
      });

      return;
    }

    const admin =
      await Admin.create({
        email,
        password:
          await bcrypt.hash(
            password,
            12,
          ),
        role,
        active: true,
      });

    response.status(201).json({
      success: true,
      message:
        "Acceso administrativo creado.",
      data: {
        _id:
          admin._id,
        email:
          admin.email,
        role:
          normalizeAdminRole(
            admin.role,
          ),
        active:
          admin.active,
        createdAt:
          admin.createdAt,
        updatedAt:
          admin.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      "Error creando usuario administrativo:",
      error,
    );

    response.status(500).json({
      success: false,
      message:
        "No se pudo crear el acceso administrativo.",
    });
  }
}

export async function updateAdminUser(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const adminId =
      getParam(
        request.params.id,
      );

    if (
      !adminId ||
      !mongoose.Types.ObjectId.isValid(
        adminId,
      )
    ) {
      response.status(400).json({
        success: false,
        message:
          "El usuario indicado no es válido.",
      });

      return;
    }

    const currentAdmin =
      response.locals.admin;

    const target =
      await Admin.findById(
        adminId,
      );

    if (!target) {
      response.status(404).json({
        success: false,
        message:
          "El acceso administrativo no existe.",
      });

      return;
    }

    if (
      typeof request.body
        ?.role !== "undefined"
    ) {
      if (
        !isRole(
          request.body.role,
        )
      ) {
        response.status(400).json({
          success: false,
          message:
            "El rol indicado no es válido.",
        });

        return;
      }

      if (
        currentAdmin?.id ===
          adminId &&
        request.body.role !==
          "owner"
      ) {
        response.status(400).json({
          success: false,
          message:
            "No podés quitarte tus propios permisos de dueño.",
        });

        return;
      }

      if (
        normalizeAdminRole(
          target.role,
        ) === "owner" &&
        request.body.role ===
          "manager"
      ) {
        const otherOwners =
          await Admin.countDocuments({
            _id: {
              $ne:
                target._id,
            },
            active: true,
            role: {
              $in: [
                "owner",
                "admin",
              ],
            },
          });

        if (otherOwners === 0) {
          response.status(400).json({
            success: false,
            message:
              "Debe quedar al menos una cuenta de dueño activa.",
          });

          return;
        }
      }

      target.role =
        request.body.role;
    }

    if (
      typeof request.body
        ?.active === "boolean"
    ) {
      if (
        currentAdmin?.id ===
          adminId &&
        !request.body.active
      ) {
        response.status(400).json({
          success: false,
          message:
            "No podés desactivar tu propia cuenta.",
        });

        return;
      }

      if (
        !request.body.active &&
        normalizeAdminRole(
          target.role,
        ) === "owner"
      ) {
        const otherOwners =
          await Admin.countDocuments({
            _id: {
              $ne:
                target._id,
            },
            active: true,
            role: {
              $in: [
                "owner",
                "admin",
              ],
            },
          });

        if (otherOwners === 0) {
          response.status(400).json({
            success: false,
            message:
              "No se puede desactivar la única cuenta de dueño.",
          });

          return;
        }
      }

      target.active =
        request.body.active;
    }

    const newPassword =
      request.body
        ?.newPassword;

    if (
      typeof newPassword ===
      "string"
    ) {
      if (
        newPassword.length < 10
      ) {
        response.status(400).json({
          success: false,
          message:
            "La nueva contraseña debe tener al menos 10 caracteres.",
        });

        return;
      }

      target.password =
        await bcrypt.hash(
          newPassword,
          12,
        );
    }

    await target.save();

    response.status(200).json({
      success: true,
      message:
        "Acceso actualizado.",
      data: {
        _id:
          target._id,
        email:
          target.email,
        role:
          normalizeAdminRole(
            target.role,
          ),
        active:
          target.active,
        createdAt:
          target.createdAt,
        updatedAt:
          target.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      "Error actualizando usuario administrativo:",
      error,
    );

    response.status(500).json({
      success: false,
      message:
        "No se pudo actualizar el acceso.",
    });
  }
}
