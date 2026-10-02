import mongoose from "mongoose";
import { Product } from "../models/product.model";
import { getComboConfiguration } from "./comboConfiguration";

const migrationId = "gula-tranka-two-double-burgers-v1";

export async function migrateDoubleCombos(): Promise<void> {
  const migrations = mongoose.connection.collection("app_migrations");
  if (await migrations.findOne({ migrationId })) return;

  // Only menu configuration changes: prices, stock, recipes and existing orders stay intact.
  for (const legacyId of [101, 110] as const) {
    await Product.updateOne(
      { legacyId },
      { $set: getComboConfiguration(legacyId) },
      { runValidators: true },
    );
  }
  await migrations.updateOne(
    { migrationId },
    { $setOnInsert: { migrationId, appliedAt: new Date() } },
    { upsert: true },
  );
  console.log("Configuración de Combo Gula y Combo Tranka actualizada.");
}
