import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { categoryRouter } from "./routes/category.routes";
import { healthRouter } from "./routes/health.routes";
import { productRouter } from "./routes/product.routes";

export const app = express();

/* ========================================
   CONFIGURACIÓN GENERAL
======================================== */

app.disable("x-powered-by");

app.use(helmet());

/* ========================================
   CORS
======================================== */

const allowedOrigins =
  (
    process.env.FRONTEND_URLS ??
    "http://localhost:5173"
  )
    .split(",")
    .map((origin) =>
      origin.trim(),
    )
    .filter(Boolean);

app.use(
  cors({
    origin(
      origin,
      callback,
    ) {
      /*
        Permitimos requests sin Origin,
        como navegador directo, Postman,
        Render Health Checks, etc.
      */

      if (!origin) {
        callback(
          null,
          true,
        );

        return;
      }

      if (
        allowedOrigins.includes(
          origin,
        )
      ) {
        callback(
          null,
          true,
        );

        return;
      }

      callback(
        new Error(
          `Origen no permitido por CORS: ${origin}`,
        ),
      );
    },
  }),
);

/* ========================================
   MIDDLEWARES
======================================== */

app.use(
  express.json(),
);

app.use(
  express.urlencoded({
    extended: true,
  }),
);

app.use(
  morgan("dev"),
);

/* ========================================
   RUTA PRINCIPAL
======================================== */

app.get(
  "/",
  (
    _request,
    response,
  ) => {
    response.status(200).json({
      success: true,
      message:
        "Loongis API funcionando correctamente.",
      endpoints: {
        health:
          "/api/health",
        products:
          "/api/products",
        categories:
          "/api/categories",
      },
    });
  },
);

/* ========================================
   RUTAS API
======================================== */

app.use(
  "/api/health",
  healthRouter,
);

app.use(
  "/api/categories",
  categoryRouter,
);

app.use(
  "/api/products",
  productRouter,
);

/* ========================================
   RUTA NO ENCONTRADA
======================================== */

app.use(
  (
    _request,
    response,
  ) => {
    response.status(404).json({
      success: false,
      message:
        "La ruta solicitada no existe.",
    });
  },
);