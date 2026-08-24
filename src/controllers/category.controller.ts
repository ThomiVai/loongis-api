import type {
  Request,
  Response,
} from "express";

import mongoose from "mongoose";

import { Category } from "../models/category.model";

function createSlug(
  value: string,
): string {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .trim()
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    );
}

function getParam(
  value:
    | string
    | string[]
    | undefined,
): string | null {
  if (
    typeof value === "string"
  ) {
    return value;
  }

  if (
    Array.isArray(value) &&
    value.length > 0
  ) {
    return value[0] ?? null;
  }

  return null;
}

function isValidId(
  id: string,
): boolean {
  return mongoose.Types.ObjectId.isValid(
    id,
  );
}

export async function getCategories(
  _request: Request,
  response: Response,
): Promise<void> {
  try {
    const categories =
      await Category.find().sort({
        order: 1,
        name: 1,
      });

    response.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error(
      "Error obteniendo categorías:",
      error,
    );

    response.status(500).json({
      success: false,
      message:
        "No se pudieron obtener las categorías.",
    });
  }
}

export async function getCategoryById(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const id = getParam(
      request.params.id,
    );

    if (
      !id ||
      !isValidId(id)
    ) {
      response.status(400).json({
        success: false,
        message:
          "El ID de la categoría no es válido.",
      });

      return;
    }

    const category =
      await Category.findById(id);

    if (!category) {
      response.status(404).json({
        success: false,
        message:
          "La categoría no existe.",
      });

      return;
    }

    response.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error(
      "Error obteniendo categoría:",
      error,
    );

    response.status(500).json({
      success: false,
      message:
        "No se pudo obtener la categoría.",
    });
  }
}

export async function createCategory(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const {
      name,
      active = true,
      order = 0,
    } = request.body;

    if (
      typeof name !== "string" ||
      !name.trim()
    ) {
      response.status(400).json({
        success: false,
        message:
          "El nombre de la categoría es obligatorio.",
      });

      return;
    }

    const normalizedName =
      name.trim();

    const slug =
      createSlug(
        normalizedName,
      );

    if (!slug) {
      response.status(400).json({
        success: false,
        message:
          "No se pudo generar un slug válido para la categoría.",
      });

      return;
    }

    const existingCategory =
      await Category.findOne({
        $or: [
          {
            name: {
              $regex: `^${normalizedName}$`,
              $options: "i",
            },
          },
          {
            slug,
          },
        ],
      });

    if (existingCategory) {
      response.status(409).json({
        success: false,
        message:
          "Ya existe una categoría con ese nombre.",
      });

      return;
    }

    const category =
      await Category.create({
        name: normalizedName,
        slug,
        active:
          typeof active ===
          "boolean"
            ? active
            : true,
        order:
          typeof order ===
            "number" &&
          order >= 0
            ? order
            : 0,
      });

    response.status(201).json({
      success: true,
      message:
        "Categoría creada correctamente.",
      data: category,
    });
  } catch (error) {
    console.error(
      "Error creando categoría:",
      error,
    );

    response.status(500).json({
      success: false,
      message:
        "No se pudo crear la categoría.",
    });
  }
}

export async function updateCategory(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const id = getParam(
      request.params.id,
    );

    if (
      !id ||
      !isValidId(id)
    ) {
      response.status(400).json({
        success: false,
        message:
          "El ID de la categoría no es válido.",
      });

      return;
    }

    const category =
      await Category.findById(id);

    if (!category) {
      response.status(404).json({
        success: false,
        message:
          "La categoría no existe.",
      });

      return;
    }

    const {
      name,
      active,
      order,
    } = request.body;

    if (
      name !== undefined
    ) {
      if (
        typeof name !==
          "string" ||
        !name.trim()
      ) {
        response.status(400).json({
          success: false,
          message:
            "El nombre de la categoría no es válido.",
        });

        return;
      }

      const normalizedName =
        name.trim();

      const newSlug =
        createSlug(
          normalizedName,
        );

      if (!newSlug) {
        response.status(400).json({
          success: false,
          message:
            "No se pudo generar un slug válido para la categoría.",
        });

        return;
      }

      const duplicate =
        await Category.findOne({
          _id: {
            $ne: category._id,
          },
          $or: [
            {
              name: {
                $regex: `^${normalizedName}$`,
                $options: "i",
              },
            },
            {
              slug: newSlug,
            },
          ],
        });

      if (duplicate) {
        response.status(409).json({
          success: false,
          message:
            "Ya existe otra categoría con ese nombre.",
        });

        return;
      }

      category.name =
        normalizedName;

      category.slug =
        newSlug;
    }

    if (
      active !== undefined
    ) {
      if (
        typeof active !==
        "boolean"
      ) {
        response.status(400).json({
          success: false,
          message:
            "El campo active debe ser verdadero o falso.",
        });

        return;
      }

      category.active =
        active;
    }

    if (
      order !== undefined
    ) {
      if (
        typeof order !==
          "number" ||
        order < 0
      ) {
        response.status(400).json({
          success: false,
          message:
            "El orden debe ser un número mayor o igual a cero.",
        });

        return;
      }

      category.order =
        order;
    }

    await category.save();

    response.status(200).json({
      success: true,
      message:
        "Categoría actualizada correctamente.",
      data: category,
    });
  } catch (error) {
    console.error(
      "Error actualizando categoría:",
      error,
    );

    response.status(500).json({
      success: false,
      message:
        "No se pudo actualizar la categoría.",
    });
  }
}

export async function deleteCategory(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const id = getParam(
      request.params.id,
    );

    if (
      !id ||
      !isValidId(id)
    ) {
      response.status(400).json({
        success: false,
        message:
          "El ID de la categoría no es válido.",
      });

      return;
    }

    const category =
      await Category.findByIdAndDelete(
        id,
      );

    if (!category) {
      response.status(404).json({
        success: false,
        message:
          "La categoría no existe.",
      });

      return;
    }

    response.status(200).json({
      success: true,
      message:
        "Categoría eliminada correctamente.",
      data: category,
    });
  } catch (error) {
    console.error(
      "Error eliminando categoría:",
      error,
    );

    response.status(500).json({
      success: false,
      message:
        "No se pudo eliminar la categoría.",
    });
  }
}