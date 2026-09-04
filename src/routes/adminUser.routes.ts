import {
  Router,
} from "express";

import {
  createAdminUser,
  getAdminUsers,
  updateAdminUser,
} from "../controllers/adminUser.controller";

import {
  requireAdmin,
  requireOwner,
} from "../middlewares/requireAdmin";

export const adminUserRouter =
  Router();

adminUserRouter.use(
  requireAdmin,
  requireOwner,
);

adminUserRouter.get(
  "/",
  getAdminUsers,
);

adminUserRouter.post(
  "/",
  createAdminUser,
);

adminUserRouter.patch(
  "/:id",
  updateAdminUser,
);
