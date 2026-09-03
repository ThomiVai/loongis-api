import type {
  Request,
  Response,
} from "express";

import type {
  StoreOrderMode,
} from "../models/storeSettings.model";

import {
  getStoreStatus,
  updateStoreOrderMode,
} from "../services/storeStatus.service";

const storeOrderModes:
  StoreOrderMode[] = [
    "automatic",
    "open",
    "paused",
  ];

function isObject(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export async function getPublicStoreStatus(
  _request: Request,
  response: Response,
): Promise<void> {
  try {
    const status =
      await getStoreStatus();

    response.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error(
      "Error al obtener el estado del local:",
      error,
    );

    response.status(500).json({
      success: false,
      message:
        "No se pudo obtener el estado del local.",
    });
  }
}

export async function updateStoreStatus(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    if (!isObject(request.body)) {
      response.status(400).json({
        success: false,
        message:
          "La configuración enviada no es válida.",
      });

      return;
    }

    const orderMode =
      request.body.orderMode;

    if (
      typeof orderMode !==
        "string" ||
      !storeOrderModes.includes(
        orderMode as
          StoreOrderMode,
      )
    ) {
      response.status(400).json({
        success: false,
        message:
          "El modo de pedidos no es válido.",
      });

      return;
    }

    const status =
      await updateStoreOrderMode(
        orderMode as
          StoreOrderMode,
      );

    response.status(200).json({
      success: true,
      message:
        "Estado del local actualizado correctamente.",
      data: status,
    });
  } catch (error) {
    console.error(
      "Error al actualizar el estado del local:",
      error,
    );

    response.status(500).json({
      success: false,
      message:
        "No se pudo actualizar el estado del local.",
    });
  }
}
