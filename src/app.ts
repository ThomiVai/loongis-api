import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { categoryRouter } from "./routes/category.routes";
import { healthRouter } from "./routes/health.routes";
import { productRouter } from "./routes/product.routes";

/* ========================================
   APP
======================================== */

export const app =
  express();

/* ========================================
   CONFIGURACIÓN
======================================== */

app.disable(
  "x-powered-by",
);

/* ========================================
   SEGURIDAD
======================================== */

app.use(
  helmet(),
);

/* ========================================
   CORS
======================================== */

const allowedOrigins =
  (
    process.env
      .FRONTEND_URLS ??
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
        Requests como Postman,
        PowerShell o health checks
        pueden venir sin Origin.
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
   BODY
======================================== */

app.use(
  express.json(),
);

app.use(
  express.urlencoded({
    extended: true,
  }),
);

/* ========================================
   LOGS
======================================== */

app.use(
  morgan("dev"),
);

/* ========================================
   RUTAS
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
   404
======================================== */

app.use(
  (
    _request,
    response,
  ) => {
    response
      .status(404)
      .json({
        success: false,
        message:
          "La ruta solicitada no existe.",
      });
  },
);