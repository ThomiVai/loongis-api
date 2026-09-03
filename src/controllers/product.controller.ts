import type {
  Request,
  Response,
} from "express";

import mongoose from "mongoose";

import {
  createDailyComboChoiceGroups,
  getDailyComboPresentation,
  isBurgerChoiceId,
} from "../config/menuChoices";
import { Category } from "../models/category.model";
import {
  Product,
  type ProductOption,
} from "../models/product.model";

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

function getRequiredString(
  value: unknown,
): string | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized.length > 0
    ? normalized
    : null;
}

function isPositiveInteger(
  value: unknown,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0
  );
}

function isNonNegativeInteger(
  value: unknown,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0
  );
}

function parseOptions(
  value: unknown,
): ProductOption[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const options: ProductOption[] =
    [];

  for (const item of value) {
    if (
      typeof item !== "object" ||
      item === null
    ) {
      return null;
    }

    const option =
      item as Record<
        string,
        unknown
      >;

    const id =
      getRequiredString(
        option.id,
      );

    const name =
      getRequiredString(
        option.name,
      );

    const label =
      getRequiredString(
        option.label,
      );

    const priceModifier =
      option.priceModifier;

    if (
      !id ||
      !name ||
      !label ||
      typeof priceModifier !==
        "number" ||
      !Number.isFinite(
        priceModifier,
      )
    ) {
      return null;
    }

    options.push({
      id,
      name,
      label,
      priceModifier,
    });
  }

  return options;
}

function parseIngredients(
  value: unknown,
): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const ingredients: string[] =
    [];

  for (const item of value) {
    const ingredient =
      getRequiredString(item);

    if (!ingredient) {
      return null;
    }

    ingredients.push(
      ingredient,
    );
  }

  return ingredients;
}

export async function getProducts(
  _request: Request,
  response: Response,
): Promise<void> {
  try {
    const products =
      await Product.find()
        .populate(
          "category",
          "name slug active order",
        )
        .sort({
          order: 1,
          name: 1,
        });

    response.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error(
      "Error obteniendo productos:",
      error,
    );

    response.status(500).json({
      success: false,
      message:
        "No se pudieron obtener los productos.",
    });
  }
}

export async function getProductById(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const identifier =
      getParam(
        request.params.id,
      );

    if (!identifier) {
      response.status(400).json({
        success: false,
        message:
          "El ID del producto no es válido.",
      });

      return;
    }

    const isMongoId =
      mongoose.Types.ObjectId.isValid(
        identifier,
      );

    const isLegacyId =
      /^\d+$/.test(
        identifier,
      );

    if (
      !isMongoId &&
      !isLegacyId
    ) {
      response.status(400).json({
        success: false,
        message:
          "El ID del producto no es válido.",
      });

      return;
    }

    const product =
      isMongoId
        ? await Product.findById(
            identifier,
          ).populate(
            "category",
            "name slug active order",
          )
        : await Product.findOne({
            legacyId: Number(
              identifier,
            ),
          }).populate(
            "category",
            "name slug active order",
          );

    if (!product) {
      response.status(404).json({
        success: false,
        message:
          "El producto no existe.",
      });

      return;
    }

    response.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error(
      "Error obteniendo producto:",
      error,
    );

    response.status(500).json({
      success: false,
      message:
        "No se pudo obtener el producto.",
    });
  }
}

export async function createProduct(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const {
      legacyId,
      name,
      description,
      price,
      image,
      imageAlt,
      category,
      featured = false,
      dailyPromo = false,
      active = true,
      order = 0,
      sizes = [],
      extras = [],
      ingredients = [],
    } = request.body;

    if (
      legacyId !== undefined &&
      !isPositiveInteger(
        legacyId,
      )
    ) {
      response.status(400).json({
        success: false,
        message:
          "El legacyId debe ser un número entero mayor a cero.",
      });

      return;
    }

    const normalizedName =
      getRequiredString(name);

    if (!normalizedName) {
      response.status(400).json({
        success: false,
        message:
          "El nombre del producto es obligatorio.",
      });

      return;
    }

    const normalizedDescription =
      getRequiredString(
        description,
      );

    if (
      !normalizedDescription
    ) {
      response.status(400).json({
        success: false,
        message:
          "La descripción del producto es obligatoria.",
      });

      return;
    }

    if (
      typeof price !==
        "number" ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      response.status(400).json({
        success: false,
        message:
          "El precio debe ser un número mayor o igual a cero.",
      });

      return;
    }

    const normalizedImage =
      getRequiredString(image);

    if (!normalizedImage) {
      response.status(400).json({
        success: false,
        message:
          "La imagen del producto es obligatoria.",
      });

      return;
    }

    const normalizedImageAlt =
      getRequiredString(
        imageAlt,
      );

    if (
      !normalizedImageAlt
    ) {
      response.status(400).json({
        success: false,
        message:
          "El texto alternativo de la imagen es obligatorio.",
      });

      return;
    }

    if (
      typeof category !==
        "string" ||
      !mongoose.Types.ObjectId.isValid(
        category,
      )
    ) {
      response.status(400).json({
        success: false,
        message:
          "La categoría del producto no es válida.",
      });

      return;
    }

    const categoryDocument =
      await Category.findById(
        category,
      ).select(
        "slug",
      );

    if (!categoryDocument) {
      response.status(404).json({
        success: false,
        message:
          "La categoría indicada no existe.",
      });

      return;
    }

    if (
      typeof featured !==
      "boolean"
    ) {
      response.status(400).json({
        success: false,
        message:
          "El campo featured debe ser verdadero o falso.",
      });

      return;
    }

    if (
      typeof dailyPromo !==
      "boolean"
    ) {
      response.status(400).json({
        success: false,
        message:
          "El campo dailyPromo debe ser verdadero o falso.",
      });

      return;
    }

    if (
      dailyPromo &&
      categoryDocument.slug !==
        "combos"
    ) {
      response.status(400).json({
        success: false,
        message:
          "Solo un producto de la categoría Combos puede ser el combo del día.",
      });

      return;
    }

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

    if (
      !isNonNegativeInteger(
        order,
      )
    ) {
      response.status(400).json({
        success: false,
        message:
          "El orden debe ser un número entero mayor o igual a cero.",
      });

      return;
    }

    const parsedSizes =
      parseOptions(sizes);

    if (!parsedSizes) {
      response.status(400).json({
        success: false,
        message:
          "Los tamaños del producto no tienen un formato válido.",
      });

      return;
    }

    const parsedExtras =
      parseOptions(extras);

    if (!parsedExtras) {
      response.status(400).json({
        success: false,
        message:
          "Los extras del producto no tienen un formato válido.",
      });

      return;
    }

    const parsedIngredients =
      parseIngredients(
        ingredients,
      );

    if (
      !parsedIngredients
    ) {
      response.status(400).json({
        success: false,
        message:
          "Los ingredientes del producto no tienen un formato válido.",
      });

      return;
    }

    const slug =
      createSlug(
        normalizedName,
      );

    if (!slug) {
      response.status(400).json({
        success: false,
        message:
          "No se pudo generar un slug válido para el producto.",
      });

      return;
    }

    const duplicateSlug =
      await Product.exists({
        slug,
      });

    if (duplicateSlug) {
      response.status(409).json({
        success: false,
        message:
          "Ya existe un producto con ese nombre.",
      });

      return;
    }

    if (
      legacyId !== undefined
    ) {
      const duplicateLegacyId =
        await Product.exists({
          legacyId,
        });

      if (
        duplicateLegacyId
      ) {
        response.status(409).json({
          success: false,
          message:
            "Ya existe un producto con ese legacyId.",
        });

        return;
      }
    }

    if (dailyPromo) {
      await Product.updateMany(
        {
          dailyPromo: true,
        },
        {
          $set: {
            dailyPromo: false,
          },
        },
      );
    }

    const product =
      await Product.create({
        legacyId,
        name: normalizedName,
        slug,
        description:
          normalizedDescription,
        price,
        image:
          normalizedImage,
        imageAlt:
          normalizedImageAlt,
        category,
        featured,
        dailyPromo,
        active,
        order,
        sizes:
          parsedSizes,
        extras:
          parsedExtras,
        ingredients:
          parsedIngredients,
      });

    await product.populate(
      "category",
      "name slug active order",
    );

    response.status(201).json({
      success: true,
      message:
        "Producto creado correctamente.",
      data: product,
    });
  } catch (error) {
    console.error(
      "Error creando producto:",
      error,
    );

    response.status(500).json({
      success: false,
      message:
        "No se pudo crear el producto.",
    });
  }
}

export async function updateProduct(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const id =
      getParam(
        request.params.id,
      );

    if (
      !id ||
      !mongoose.Types.ObjectId.isValid(
        id,
      )
    ) {
      response.status(400).json({
        success: false,
        message:
          "El ID del producto no es válido.",
      });

      return;
    }

    const product =
      await Product.findById(id);

    if (!product) {
      response.status(404).json({
        success: false,
        message:
          "El producto no existe.",
      });

      return;
    }

    const {
      legacyId,
      name,
      description,
      price,
      image,
      imageAlt,
      category,
      featured,
      dailyPromo,
      active,
      order,
      sizes,
      extras,
      ingredients,
      dailyComboBurgerId,
    } = request.body;

    if (
      legacyId !== undefined
    ) {
      if (
        !isPositiveInteger(
          legacyId,
        )
      ) {
        response.status(400).json({
          success: false,
          message:
            "El legacyId debe ser un número entero mayor a cero.",
        });

        return;
      }

      const duplicateLegacyId =
        await Product.exists({
          _id: {
            $ne: product._id,
          },
          legacyId,
        });

      if (
        duplicateLegacyId
      ) {
        response.status(409).json({
          success: false,
          message:
            "Ya existe otro producto con ese legacyId.",
        });

        return;
      }

      product.legacyId =
        legacyId;
    }

    if (name !== undefined) {
      const normalizedName =
        getRequiredString(name);

      if (!normalizedName) {
        response.status(400).json({
          success: false,
          message:
            "El nombre del producto no es válido.",
        });

        return;
      }

      const newSlug =
        createSlug(
          normalizedName,
        );

      if (!newSlug) {
        response.status(400).json({
          success: false,
          message:
            "No se pudo generar un slug válido para el producto.",
        });

        return;
      }

      const duplicate =
        await Product.exists({
          _id: {
            $ne: product._id,
          },
          slug: newSlug,
        });

      if (duplicate) {
        response.status(409).json({
          success: false,
          message:
            "Ya existe otro producto con ese nombre.",
        });

        return;
      }

      product.name =
        normalizedName;

      product.slug =
        newSlug;
    }

    if (
      description !== undefined
    ) {
      const normalizedDescription =
        getRequiredString(
          description,
        );

      if (
        !normalizedDescription
      ) {
        response.status(400).json({
          success: false,
          message:
            "La descripción del producto no es válida.",
        });

        return;
      }

      product.description =
        normalizedDescription;
    }

    if (price !== undefined) {
      if (
        typeof price !==
          "number" ||
        !Number.isFinite(price) ||
        price < 0
      ) {
        response.status(400).json({
          success: false,
          message:
            "El precio debe ser un número mayor o igual a cero.",
        });

        return;
      }

      product.price =
        price;
    }

    if (image !== undefined) {
      const normalizedImage =
        getRequiredString(image);

      if (!normalizedImage) {
        response.status(400).json({
          success: false,
          message:
            "La imagen del producto no es válida.",
        });

        return;
      }

      product.image =
        normalizedImage;
    }

    if (
      imageAlt !== undefined
    ) {
      const normalizedImageAlt =
        getRequiredString(
          imageAlt,
        );

      if (
        !normalizedImageAlt
      ) {
        response.status(400).json({
          success: false,
          message:
            "El texto alternativo de la imagen no es válido.",
        });

        return;
      }

      product.imageAlt =
        normalizedImageAlt;
    }

    if (
      category !== undefined
    ) {
      if (
        typeof category !==
          "string" ||
        !mongoose.Types.ObjectId.isValid(
          category,
        )
      ) {
        response.status(400).json({
          success: false,
          message:
            "La categoría del producto no es válida.",
        });

        return;
      }

      const categoryExists =
        await Category.exists({
          _id: category,
        });

      if (!categoryExists) {
        response.status(404).json({
          success: false,
          message:
            "La categoría indicada no existe.",
        });

        return;
      }

      product.category =
        new mongoose.Types.ObjectId(
          category,
        );
    }

    if (
      featured !== undefined
    ) {
      if (
        typeof featured !==
        "boolean"
      ) {
        response.status(400).json({
          success: false,
          message:
            "El campo featured debe ser verdadero o falso.",
        });

        return;
      }

      product.featured =
        featured;
    }

    if (
      dailyPromo !== undefined
    ) {
      if (
        typeof dailyPromo !==
        "boolean"
      ) {
        response.status(400).json({
          success: false,
          message:
            "El campo dailyPromo debe ser verdadero o falso.",
        });

        return;
      }

      product.dailyPromo =
        dailyPromo;
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

      product.active =
        active;
    }

    if (
      order !== undefined
    ) {
      if (
        !isNonNegativeInteger(
          order,
        )
      ) {
        response.status(400).json({
          success: false,
          message:
            "El orden debe ser un número entero mayor o igual a cero.",
        });

        return;
      }

      product.order =
        order;
    }

    if (sizes !== undefined) {
      const parsedSizes =
        parseOptions(sizes);

      if (!parsedSizes) {
        response.status(400).json({
          success: false,
          message:
            "Los tamaños del producto no tienen un formato válido.",
        });

        return;
      }

      product.sizes =
        parsedSizes;
    }

    if (extras !== undefined) {
      const parsedExtras =
        parseOptions(extras);

      if (!parsedExtras) {
        response.status(400).json({
          success: false,
          message:
            "Los extras del producto no tienen un formato válido.",
        });

        return;
      }

      product.extras =
        parsedExtras;
    }

    if (
      ingredients !== undefined
    ) {
      const parsedIngredients =
        parseIngredients(
          ingredients,
        );

      if (
        !parsedIngredients
      ) {
        response.status(400).json({
          success: false,
          message:
            "Los ingredientes del producto no tienen un formato válido.",
        });

        return;
      }

      product.ingredients =
        parsedIngredients;
    }

    if (
      dailyComboBurgerId !==
      undefined
    ) {
      if (
        product.legacyId !== 109
      ) {
        response.status(400).json({
          success: false,
          message:
            "La hamburguesa del día solo puede configurarse en el Combo del Día.",
        });

        return;
      }

      if (
        !isBurgerChoiceId(
          dailyComboBurgerId,
        )
      ) {
        response.status(400).json({
          success: false,
          message:
            "La hamburguesa seleccionada para el Combo del Día no es válida.",
        });

        return;
      }

      product.dailyComboBurgerId =
        dailyComboBurgerId;

      product.choiceGroups =
        createDailyComboChoiceGroups(
          dailyComboBurgerId,
        );

      const presentation =
        getDailyComboPresentation(
          dailyComboBurgerId,
        );

      product.image =
        presentation.image;

      product.imageAlt =
        presentation.imageAlt;
    }

    const finalCategory =
      await Category.findById(
        product.category,
      ).select(
        "slug",
      );

    if (!finalCategory) {
      response.status(404).json({
        success: false,
        message:
          "La categoría indicada no existe.",
      });

      return;
    }

    if (
      product.dailyPromo &&
      finalCategory.slug !==
        "combos"
    ) {
      response.status(400).json({
        success: false,
        message:
          "Solo un producto de la categoría Combos puede ser el combo del día.",
      });

      return;
    }

    if (product.dailyPromo) {
      await Product.updateMany(
        {
          _id: {
            $ne: product._id,
          },
          dailyPromo: true,
        },
        {
          $set: {
            dailyPromo: false,
          },
        },
      );
    }

    await product.save();

    await product.populate(
      "category",
      "name slug active order",
    );

    response.status(200).json({
      success: true,
      message:
        "Producto actualizado correctamente.",
      data: product,
    });
  } catch (error) {
    console.error(
      "Error actualizando producto:",
      error,
    );

    response.status(500).json({
      success: false,
      message:
        "No se pudo actualizar el producto.",
    });
  }
}

export async function deleteProduct(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const id =
      getParam(
        request.params.id,
      );

    if (
      !id ||
      !mongoose.Types.ObjectId.isValid(
        id,
      )
    ) {
      response.status(400).json({
        success: false,
        message:
          "El ID del producto no es válido.",
      });

      return;
    }

    const product =
      await Product.findById(
        id,
      );

    if (!product) {
      response.status(404).json({
        success: false,
        message:
          "El producto no existe.",
      });

      return;
    }

    if (
      product.legacyId === 109
    ) {
      response.status(409).json({
        success: false,
        message:
          "El Combo del Día es un producto fijo del sistema y no se puede eliminar.",
      });

      return;
    }

    await product.deleteOne();

    response.status(200).json({
      success: true,
      message:
        "Producto eliminado correctamente.",
      data: product,
    });
  } catch (error) {
    console.error(
      "Error eliminando producto:",
      error,
    );

    response.status(500).json({
      success: false,
      message:
        "No se pudo eliminar el producto.",
    });
  }
}
