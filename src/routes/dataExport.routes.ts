import { Router } from "express";

import {
  exportMovements,
  exportOrders,
  exportPurchases,
  exportSales,
} from "../controllers/dataExport.controller";
import {
  requireAdmin,
  requireOwner,
} from "../middlewares/requireAdmin";

export const dataExportRouter =
  Router();

dataExportRouter.use(
  requireAdmin,
  requireOwner,
);

dataExportRouter.get(
  "/orders.csv",
  exportOrders,
);

dataExportRouter.get(
  "/sales.csv",
  exportSales,
);

dataExportRouter.get(
  "/purchases.csv",
  exportPurchases,
);

dataExportRouter.get(
  "/movements.csv",
  exportMovements,
);
