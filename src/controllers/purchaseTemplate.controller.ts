import type { Request, Response } from "express";
import mongoose from "mongoose";
import { PurchaseTemplate } from "../models/purchaseTemplate.model";
import { Ingredient } from "../models/ingredient.model";
import { Supplier } from "../models/supplier.model";
import { BatchError, numeric } from "../services/ingredientBatch";
export async function getPurchaseTemplates(_req: Request, res: Response) {
  try { res.json({success:true, data: await PurchaseTemplate.find().sort({name:1}).limit(200).lean()}); }
  catch { res.status(500).json({success:false,message:"No se pudieron cargar las compras habituales."}); }
}
export async function savePurchaseTemplate(req: Request, res: Response) {
  try {
    const body = req.body;
    if (!body || typeof body.name !== "string" || body.name.trim().length < 2 || body.name.length > 80 || !Array.isArray(body.lines) || !body.lines.length || body.lines.length > 100) throw new BatchError("Completá un nombre y entre 1 y 100 insumos.");
    const lines = body.lines.map((r: Record<string,unknown>) => {
      if (!r || typeof r.ingredientId !== "string" || !mongoose.isValidObjectId(r.ingredientId) || typeof r.presentationLabel !== "string" || !r.presentationLabel.trim() || r.presentationLabel.length > 60) throw new BatchError("Revisá el insumo y la presentación de cada fila.");
      return {ingredientId:r.ingredientId, presentationLabel:r.presentationLabel.trim(), presentationQuantity:numeric(r.presentationQuantity,"Cantidad",true), conversionFactor:numeric(r.conversionFactor,"Equivalencia",true)};
    });
    const ids = [...new Set(lines.map((r: {ingredientId:string})=>r.ingredientId))];
    if (await Ingredient.countDocuments({_id:{$in:ids},active:true}) !== ids.length) throw new BatchError("Hay insumos que ya no están activos.");
    if (body.supplierId && (typeof body.supplierId !== "string" || !mongoose.isValidObjectId(body.supplierId) || !await Supplier.exists({_id:body.supplierId,active:true}))) throw new BatchError("El proveedor no está disponible.");
    const item = await PurchaseTemplate.create({name:body.name.trim(),supplierId:body.supplierId || undefined,lines,createdBy:res.locals.admin.id});
    res.status(201).json({success:true,data:item});
  } catch (e) {res.status(e instanceof BatchError ? e.status : 500).json({success:false,message:e instanceof BatchError ? e.message : "No se pudo guardar la compra habitual."});}
}
export async function deletePurchaseTemplate(req: Request, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) {res.status(400).json({success:false,message:"Compra habitual inválida."});return;}
  try {await PurchaseTemplate.deleteOne({_id:req.params.id});res.json({success:true,data:null});}
  catch {res.status(500).json({success:false,message:"No se pudo eliminar la compra habitual."});}
}
