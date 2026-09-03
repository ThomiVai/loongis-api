import {
  Router,
} from "express";

import {
  createIngredient,
  createInventoryMovement,
  getIngredients,
  getInventorySettings,
  getInventoryMovements,
  updateIngredient,
  updateInventorySettings,
} from "../controllers/inventory.controller";

import {
  requireAdmin,
} from "../middlewares/requireAdmin";

export const inventoryRouter =
  Router();

/* ========================================
   TODO EL INVENTARIO ES ADMIN
======================================== */

inventoryRouter.get(
  "/settings",
  requireAdmin,
  getInventorySettings,
);

inventoryRouter.patch(
  "/settings",
  requireAdmin,
  updateInventorySettings,
);

inventoryRouter.get(
  "/ingredients",
  requireAdmin,
  getIngredients,
);

inventoryRouter.post(
  "/ingredients",
  requireAdmin,
  createIngredient,
);

inventoryRouter.put(
  "/ingredients/:id",
  requireAdmin,
  updateIngredient,
);

inventoryRouter.post(
  "/ingredients/:id/movements",
  requireAdmin,
  createInventoryMovement,
);

inventoryRouter.get(
  "/movements",
  requireAdmin,
  getInventoryMovements,
);
