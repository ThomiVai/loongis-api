import { Router } from "express";

import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
  updateCategory,
} from "../controllers/category.controller";

import {
  requireAdmin,
} from "../middlewares/requireAdmin";

export const categoryRouter =
  Router();

/* ========================================
   RUTAS PÚBLICAS
======================================== */

categoryRouter.get(
  "/",
  getCategories,
);

categoryRouter.get(
  "/:id",
  getCategoryById,
);

/* ========================================
   RUTAS PROTEGIDAS - ADMIN
======================================== */

categoryRouter.post(
  "/",
  requireAdmin,
  createCategory,
);

categoryRouter.put(
  "/:id",
  requireAdmin,
  updateCategory,
);

categoryRouter.delete(
  "/:id",
  requireAdmin,
  deleteCategory,
);