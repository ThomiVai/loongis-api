import {
  Router,
} from "express";

import {
  createOrder,
} from "../controllers/order.controller";

export const orderRouter =
  Router();

/* ========================================
   RUTAS PÚBLICAS
======================================== */

orderRouter.post(
  "/",
  createOrder,
);
