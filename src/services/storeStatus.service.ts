import {
  StoreSettings,
  type StoreOrderMode,
} from "../models/storeSettings.model";

import {
  calculateStoreStatus,
  type CalculatedStoreStatus,
} from "../utils/storeSchedule";

export type StoreStatus =
  CalculatedStoreStatus & {
    updatedAt: string | null;
  };

const STORE_SETTINGS_ID =
  "main";

async function getSettings() {
  const settings =
    await StoreSettings.findByIdAndUpdate(
      STORE_SETTINGS_ID,
      {
        $setOnInsert: {
          orderMode:
            "automatic",
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

  if (!settings) {
    throw new Error(
      "No se pudo obtener la configuración del local.",
    );
  }

  return settings;
}

function createStoreStatus(
  orderMode: StoreOrderMode,
  updatedAt: Date | undefined,
): StoreStatus {
  return {
    ...calculateStoreStatus(
      orderMode,
    ),

    updatedAt:
      updatedAt
        ? updatedAt.toISOString()
        : null,
  };
}

export async function getStoreStatus():
  Promise<StoreStatus> {
  const settings =
    await getSettings();

  return createStoreStatus(
    settings.orderMode,
    settings.updatedAt,
  );
}

export async function updateStoreOrderMode(
  orderMode: StoreOrderMode,
): Promise<StoreStatus> {
  const settings =
    await StoreSettings.findByIdAndUpdate(
      STORE_SETTINGS_ID,
      {
        $set: {
          orderMode,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

  if (!settings) {
    throw new Error(
      "No se pudo actualizar la configuración del local.",
    );
  }

  return createStoreStatus(
    settings.orderMode,
    settings.updatedAt,
  );
}
