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
  createProduct,
);

productRouter.put(
  "/:id",
  requireAdmin,
  updateProduct,
);

productRouter.delete(
  "/:id",
  requireAdmin,
  deleteProduct,
);