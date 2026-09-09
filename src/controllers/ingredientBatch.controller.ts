import type { Request, Response } from "express";
import mongoose from "mongoose";
import { Ingredient } from "../models/ingredient.model";
import { InventoryMovement } from "../models/inventoryMovement.model";
import { InventoryLot } from "../models/inventoryLot.model";
import { BatchError, batchRows, ingredientMetadata, newIngredient } from "../services/ingredientBatch";

export async function importIngredients(req: Request, res: Response): Promise<void> {
  let session: mongoose.ClientSession | undefined;
  try {
    const rows = batchRows(req.body).map((r, i) => {
      try { return newIngredient(r); } catch (e) { throw new BatchError(`Fila ${i+1}: ${(e as Error).message}`); }
    });
    if (new Set(rows.map(r => r.slug)).size !== rows.length) throw new BatchError("Hay nombres duplicados en la planilla.");
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const existing = await Ingredient.findOne({slug: {$in: rows.map(r => r.slug)}}).session(session!);
      if (existing) throw new BatchError(`Ya existe el insumo ${existing.name}. La importación solo crea insumos nuevos.`, 409);
      for (const row of rows) {
        const [item] = await Ingredient.create([row], {session});
        if (row.stock > 0) {
          await InventoryMovement.create([{ingredient: item!._id, type: "initial", change: row.stock, previousStock: 0, newStock: row.stock, unitCost: row.unitCost, estimatedCost: row.stock * row.unitCost, note: "Stock inicial por importación", performedBy: res.locals.admin.id, performedByEmail: res.locals.admin.email}], {session});
          await InventoryLot.create([{ingredient: item!._id, receivedAt: new Date(), initialQuantity: row.stock, remainingQuantity: row.stock, unitCost: row.unitCost, source: "initial"}], {session});
        }
      }
    });
    res.status(201).json({success: true, data: {count: rows.length}});
  } catch (e) { batchFailure(res, e); } finally { await session?.endSession(); }
}
export async function updateIngredientsBatch(req: Request, res: Response): Promise<void> {
  let session: mongoose.ClientSession | undefined;
  try {
    const rows = batchRows(req.body).map(r => {
      if (typeof r.id !== "string" || !mongoose.isValidObjectId(r.id) || typeof r.updatedAt !== "string" || !Number.isFinite(Date.parse(r.updatedAt))) throw new BatchError("Identificador o fecha inválidos. Actualizá el inventario.");
      return {id: r.id, updatedAt: new Date(r.updatedAt), values: ingredientMetadata(r)};
    });
    if (new Set(rows.map(r=>r.id)).size !== rows.length) throw new BatchError("Hay insumos repetidos.");
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      for (const row of rows) {
        const result = await Ingredient.updateOne({_id: row.id, updatedAt: row.updatedAt}, {$set: row.values}, {session, runValidators: true});
        if (!result.matchedCount) throw new BatchError("Un insumo cambió desde que abriste la tabla. Actualizá y revisá tus cambios; no se guardó ninguna fila.", 409);
      }
    });
    res.json({success: true, data: {count: rows.length}});
  } catch (e) { batchFailure(res, e); } finally { await session?.endSession(); }
}
function batchFailure(res: Response, e: unknown) {
  const duplicate = (e as {code?: number})?.code === 11000;
  res.status(e instanceof BatchError ? e.status : duplicate ? 409 : 500).json({success:false,message: e instanceof BatchError ? e.message : duplicate ? "Uno de los insumos ya existe. No se guardó la importación." : "No se pudo guardar la operación. Actualizá el inventario antes de reintentar."});
}
