import { Router } from "express";

import {
  createProduct,
  deleteProduct,
  getProductById,
  getProducts,
  updateProduct,
} from "../controllers/product.controller";

export const productRouter =
  Router();

productRouter.get(
  "/",
  getProducts,
);

productRouter.get(
  "/:id",
  getProductById,
);

productRouter.post(
  "/",
  createProduct,
);

productRouter.put(
  "/:id",
  updateProduct,
);

productRouter.delete(
  "/:id",
  deleteProduct,
);