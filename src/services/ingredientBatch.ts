import type { IngredientUnit } from "../models/ingredient.model";

export class BatchError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const ingredientSlug = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const units = ["unit", "portion", "gram", "kilogram", "milliliter", "liter"];
export function batchRows(body: unknown): Record<string, unknown>[] {
  if (!body || typeof body !== "object" || !Array.isArray((body as {rows?:unknown}).rows)) throw new BatchError("Enviá una lista de insumos.");
  const rows = (body as {rows: unknown[]}).rows;
  if (!rows.length || rows.length > 200) throw new BatchError("La operación admite entre 1 y 200 insumos.");
  return rows.map((r, i) => {
    if (!r || typeof r !== "object" || Array.isArray(r)) throw new BatchError(`Fila ${i+1}: datos inválidos.`);
    return r as Record<string, unknown>;
  });
}
export function numeric(value: unknown, label: string, positive = false): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || (positive && value < 0.000001) || value > 1e12) throw new BatchError(`${label}: ingresá un número ${positive ? "mayor a cero" : "no negativo"} válido.`);
  return value;
}
function optionalText(value: unknown, label: string, max: number): string {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > max) throw new BatchError(`${label}: texto inválido (máximo ${max} caracteres).`);
  return value.trim();
}
export function ingredientMetadata(r: Record<string, unknown>) {
  return {
    minimumStock: numeric(r.minimumStock, "Stock mínimo"),
    targetStock: numeric(r.targetStock, "Stock objetivo"),
    unitCost: numeric(r.unitCost, "Costo unitario"),
    purchaseUnitFactor: numeric(r.purchaseUnitFactor, "Equivalencia", true),
    purchaseUnitLabel: optionalText(r.purchaseUnitLabel, "Presentación", 60),
    category: optionalText(r.category, "Categoría", 60),
    storageLocation: optionalText(r.storageLocation, "Ubicación", 80),
  };
}
export function newIngredient(r: Record<string, unknown>) {
  const name = optionalText(r.name, "Nombre", 100);
  if (name.length < 2 || !ingredientSlug(name)) throw new BatchError("Nombre: usá entre 2 y 100 caracteres y al menos una letra o número.");
  if (typeof r.unit !== "string" || !units.includes(r.unit)) throw new BatchError(`${name}: unidad inválida.`);
  if (typeof r.trackExpiration !== "boolean") throw new BatchError(`${name}: vencimientos debe ser Sí o No.`);
  return { ...ingredientMetadata(r), name, slug: ingredientSlug(name), unit: r.unit as IngredientUnit, stock: numeric(r.stock, "Stock inicial"), trackExpiration: r.trackExpiration, active: true, order: 0 };
}
