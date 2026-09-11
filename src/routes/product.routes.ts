import {
  Router,
  raw,
} from "express";

import {
  createProduct,
  deleteProduct,
  getProductById,
  getProducts,
  updateProduct,
} from "../controllers/product.controller";
import {
  deleteProductImage,
  getProductImage,
  uploadProductImage,
} from "../controllers/productImage.controller";

import {
  requireAdmin,
  requireOwner,
} from "../middlewares/requireAdmin";

export const productRouter =
  Router();

/* ========================================
   RUTAS PÚBLICAS
======================================== */

productRouter.get(
  "/",
  getProducts,
);

productRouter.get(
  "/images/:imageId",
  getProductImage,
);

productRouter.post(
  "/images",
  requireAdmin,
  requireOwner,
  raw({
    type: [
      "image/jpeg",
      "image/png",
      "image/webp",
    ],
    limit: "5mb",
  }),
  uploadProductImage,
);

productRouter.delete(
  "/images/:imageId",
  requireAdmin,
  requireOwner,
  deleteProductImage,
);

productRouter.get(
  "/:id",
  getProductById,
);

/* ========================================
   RUTAS PROTEGIDAS - ADMIN
======================================== */

productRouter.post(
  "/",
  requireAdmin,
  requireOwner,
  createProduct,
);

productRouter.put(
  "/:id",
  requireAdmin,
  requireOwner,
  updateProduct,
);

productRouter.delete(
  "/:id",
  requireAdmin,
  requireOwner,
  deleteProduct,
);
