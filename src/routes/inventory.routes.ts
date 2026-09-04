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
  createInventoryCount,
  createPurchase,
  createSupplier,
  getInventoryAlerts,
  getInventoryCounts,
  getInventoryReport,
  getPublicAvailability,
  getPurchases,
  getSuppliers,
  updateSupplier,
} from "../controllers/inventoryOperations.controller";

import {
  requireAdmin,
  requireOwner,
} from "../middlewares/requireAdmin";

export const inventoryRouter =
  Router();

inventoryRouter.get(
  "/availability",
  getPublicAvailability,
);

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
  requireOwner,
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
  requireOwner,
  createIngredient,
);

inventoryRouter.put(
  "/ingredients/:id",
  requireAdmin,
  requireOwner,
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

inventoryRouter.get(
  "/suppliers",
  requireAdmin,
  getSuppliers,
);

inventoryRouter.post(
  "/suppliers",
  requireAdmin,
  createSupplier,
);

inventoryRouter.patch(
  "/suppliers/:id",
  requireAdmin,
  updateSupplier,
);

inventoryRouter.get(
  "/purchases",
  requireAdmin,
  getPurchases,
);

inventoryRouter.post(
  "/purchases",
  requireAdmin,
  createPurchase,
);

inventoryRouter.get(
  "/counts",
  requireAdmin,
  getInventoryCounts,
);

inventoryRouter.post(
  "/counts",
  requireAdmin,
  createInventoryCount,
);

inventoryRouter.get(
  "/alerts",
  requireAdmin,
  getInventoryAlerts,
);

inventoryRouter.get(
  "/report",
  requireAdmin,
  requireOwner,
  getInventoryReport,
);
