import {
  Router,
} from "express";

import {
  getCurrentAdmin,
  loginAdmin,
  changeOwnPassword,
  requestPasswordReset,
  resetPassword,
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

authRouter.post(
  "/forgot-password",
  requestPasswordReset,
);

authRouter.post(
  "/reset-password",
  resetPassword,
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
