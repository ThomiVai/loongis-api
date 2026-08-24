import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_request, response) => {
  response.status(200).json({
    success: true,
    message: "La API de Loongis está funcionando.",
    timestamp: new Date().toISOString(),
  });
});