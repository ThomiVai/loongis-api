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
  requireOwner,
} from "../middlewares/requireAdmin";

export const recipeRouter =
  Router();

/* ========================================
   TODAS LAS RECETAS SON ADMIN
======================================== */

recipeRouter.get(
  "/",
  requireAdmin,
  requireOwner,
  getRecipes,
);

recipeRouter.get(
  "/product/:productId",
  requireAdmin,
  requireOwner,
  getRecipeByProductId,
);

recipeRouter.put(
  "/product/:productId",
  requireAdmin,
  requireOwner,
  upsertRecipeByProductId,
);
