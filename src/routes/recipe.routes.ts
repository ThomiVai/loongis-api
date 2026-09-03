import {
  Router,
} from "express";

import {
  getRecipeByProductId,
  getRecipes,
  upsertRecipeByProductId,
} from "../controllers/recipe.controller";

import {
  requireAdmin,
} from "../middlewares/requireAdmin";

export const recipeRouter =
  Router();

/* ========================================
   TODAS LAS RECETAS SON ADMIN
======================================== */

recipeRouter.get(
  "/",
  requireAdmin,
  getRecipes,
);

recipeRouter.get(
  "/product/:productId",
  requireAdmin,
  getRecipeByProductId,
);

recipeRouter.put(
  "/product/:productId",
  requireAdmin,
  upsertRecipeByProductId,
);
