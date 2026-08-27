import {
  Router,
} from "express";

import {
  createOrder,
  getOrderById,
  getOrders,
  updateOrderStatus,
} from "../controllers/order.controller";

import {
  requireAdmin,
} from "../middlewares/requireAdmin";

export const orderRouter =
  Router();

/* ========================================
   RUTAS PÚBLICAS
======================================== */

orderRouter.post(
  "/",
  createOrder,
);

/* ========================================
   RUTAS PROTEGIDAS - ADMIN
======================================== */

orderRouter.get(
  "/",
  requireAdmin,
  getOrders,
);

orderRouter.get(
  "/:id",
  requireAdmin,
  getOrderById,
);

orderRouter.patch(
  "/:id/status",
  requireAdmin,
  updateOrderStatus,
);
