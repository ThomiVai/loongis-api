import {
  Router,
} from "express";

import {
  getPublicStoreStatus,
  updateStoreStatus,
} from "../controllers/store.controller";

import {
  requireAdmin,
} from "../middlewares/requireAdmin";

export const storeRouter =
  Router();

storeRouter.get(
  "/status",
  getPublicStoreStatus,
);

storeRouter.patch(
  "/status",
  requireAdmin,
  updateStoreStatus,
);
