import type {
  Request,
  Response,
} from "express";

import mongoose from "mongoose";

import { Product } from "../models/product.model";
import { ProductImage } from "../models/productImage.model";

const MAX_IMAGE_SIZE =
  5 * 1024 * 1024;

type AllowedImageType =
  | "image/jpeg"
  | "image/png"
  | "image/webp";

const allowedTypes =
  new Set<AllowedImageType>([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

function isAllowedImageType(
  value: string,
): value is AllowedImageType {
  return allowedTypes.has(
    value as AllowedImageType,
  );
}

function getImageId(
  value: string | string[] | undefined,
): string | null {
  return typeof value === "string"
    ? value
    : null;
}

function matchesSignature(
  data: Buffer,
  contentType: string,
): boolean {
  if (contentType === "image/jpeg") {
    return (
      data.length >= 3 &&
      data[0] === 0xff &&
      data[1] === 0xd8 &&
      data[2] === 0xff
    );
  }

  if (contentType === "image/png") {
    return (
      data.length >= 8 &&
      data.subarray(0, 8).equals(
        Buffer.from([
          0x89, 0x50, 0x4e, 0x47,
          0x0d, 0x0a, 0x1a, 0x0a,
        ]),
      )
    );
  }

  return (
    contentType === "image/webp" &&
    data.length >= 12 &&
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

export async function uploadProductImage(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    const contentType =
      request.headers["content-type"]
        ?.split(";")[0]
        ?.trim()
        .toLowerCase() ?? "";

    const data =
      Buffer.isBuffer(request.body)
        ? request.body
        : Buffer.alloc(0);

    if (
      !isAllowedImageType(contentType) ||
      data.length === 0 ||
      data.length > MAX_IMAGE_SIZE ||
      !matchesSignature(data, contentType)
    ) {
      response.status(400).json({
        success: false,
        message:
          "Elegí una imagen JPG, PNG o WebP de hasta 5 MB.",
      });
      return;
    }

    const actor =
      response.locals.admin;

    const originalNameHeader =
      request.headers["x-file-name"];

    const originalName =
      typeof originalNameHeader === "string"
        ? decodeURIComponent(originalNameHeader)
            .replace(/[\\/]/g, "-")
            .slice(0, 180)
        : "producto";

    const image =
      await ProductImage.create({
        originalName,
        contentType,
        size: data.length,
        data,
        uploadedBy: actor.id,
        uploadedByEmail: actor.email,
      });

    response.status(201).json({
      success: true,
      message:
        "Imagen cargada correctamente.",
      data: {
        id: image._id,
        url:
          `/api/products/images/${image._id}`,
      },
    });
  } catch (error) {
    console.error(
      "Error cargando imagen de producto:",
      error,
    );

    response.status(500).json({
      success: false,
      message:
        "No se pudo cargar la imagen.",
    });
  }
}

export async function getProductImage(
  request: Request,
  response: Response,
): Promise<void> {
  const imageId =
    getImageId(
      request.params.imageId,
    );

  if (
    !imageId ||
    !mongoose.Types.ObjectId.isValid(imageId)
  ) {
    response.status(404).end();
    return;
  }

  const image =
    await ProductImage.findById(imageId)
      .select("+data contentType size")
      .lean();

  if (!image) {
    response.status(404).end();
    return;
  }

  response.set({
    "Cache-Control":
      "public, max-age=31536000, immutable",
    "Content-Type": image.contentType,
    "Content-Length": String(image.size),
    "Cross-Origin-Resource-Policy":
      "cross-origin",
  });
  response.status(200).send(image.data);
}

export async function deleteProductImage(
  request: Request,
  response: Response,
): Promise<void> {
  const imageId =
    getImageId(
      request.params.imageId,
    );

  if (
    !imageId ||
    !mongoose.Types.ObjectId.isValid(imageId)
  ) {
    response.status(400).json({
      success: false,
      message:
        "La imagen indicada no es válida.",
    });
    return;
  }

  const imagePath =
    `/api/products/images/${imageId}`;

  if (
    await Product.exists({
      image: imagePath,
    })
  ) {
    response.status(409).json({
      success: false,
      message:
        "La imagen todavía está asignada a un producto.",
    });
    return;
  }

  await ProductImage.findByIdAndDelete(
    imageId,
  );

  response.status(200).json({
    success: true,
    data: null,
  });
}
