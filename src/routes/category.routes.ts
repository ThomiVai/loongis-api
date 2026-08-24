import { Router } from "express";

import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
  updateCategory,
} from "../controllers/category.controller";

export const categoryRouter =
  Router();

categoryRouter.get(
  "/",
  getCategories,
);

categoryRouter.get(
  "/:id",
  getCategoryById,
);

categoryRouter.post(
  "/",
  createCategory,
);

categoryRouter.put(
  "/:id",
  updateCategory,
);

categoryRouter.delete(
  "/:id",
  deleteCategory,
);