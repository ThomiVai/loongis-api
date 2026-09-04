import {
  Router,
} from "express";

import {
  getCurrentAdmin,
  loginAdmin,
  changeOwnPassword,
} from "../controllers/auth.controller";

import {
  requireAdmin,
} from "../middlewares/requireAdmin";

export const authRouter =
  Router();

/* ========================================
   LOGIN
======================================== */

authRouter.post(
  "/login",
  loginAdmin,
);

/* ========================================
   ADMIN ACTUAL
======================================== */

authRouter.get(
  "/me",
  requireAdmin,
  getCurrentAdmin,
);

authRouter.patch(
  "/password",
  requireAdmin,
  changeOwnPassword,
);
