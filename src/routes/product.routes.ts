import { Router } from "express";

import {
  createProduct,
  deleteProduct,
  getProductById,
  getProducts,
  updateProduct,
} from "../controllers/product.controller";

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
