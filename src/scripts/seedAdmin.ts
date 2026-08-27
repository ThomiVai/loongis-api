import "dotenv/config";

import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import { connectDatabase } from "../config/database";
import { Admin } from "../models/admin.model";

/* ========================================
   CONFIGURACIÓN
======================================== */

const PASSWORD_SALT_ROUNDS = 12;

/* ========================================
   SEED ADMIN
======================================== */

async function seedAdmin(): Promise<void> {
  try {
    /* =====================================
       VARIABLES DE ENTORNO
    ===================================== */

    const adminEmail =
      process.env.ADMIN_EMAIL
        ?.trim()
        .toLowerCase();

    const adminPassword =
      process.env.ADMIN_PASSWORD;

    if (!adminEmail) {
      throw new Error(
        "La variable ADMIN_EMAIL no está definida.",
      );
    }

    if (!adminPassword) {
      throw new Error(
        "La variable ADMIN_PASSWORD no está definida.",
      );
    }

    if (adminPassword.length < 8) {
      throw new Error(
        "ADMIN_PASSWORD debe tener al menos 8 caracteres.",
      );
    }

    /* =====================================
       CONEXIÓN
    ===================================== */

    await connectDatabase();

    console.log("");
    console.log(
      "Inicializando administrador de Loongis...",
    );
    console.log("");

    /* =====================================
       HASH DE CONTRASEÑA
    ===================================== */

    const passwordHash =
      await bcrypt.hash(
        adminPassword,
        PASSWORD_SALT_ROUNDS,
      );

    /* =====================================
       CREAR / ACTUALIZAR ADMIN
    ===================================== */

    await Admin.findOneAndUpdate(
      {
        email: adminEmail,
      },
      {
        $set: {
          email: adminEmail,
          password: passwordHash,
          role: "admin",
          active: true,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    console.log(
      "✓ Administrador creado o actualizado correctamente.",
    );

    console.log("");
  } catch (error) {
    console.error("");
    console.error(
      "Error inicializando administrador:",
      error,
    );

    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();

    console.log(
      "Conexión con MongoDB cerrada.",
    );
  }
}

void seedAdmin();