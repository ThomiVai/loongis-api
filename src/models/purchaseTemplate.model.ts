import { Schema, model } from "mongoose";
const line = new Schema({
  ingredientId: {type: Schema.Types.ObjectId, ref: "Ingredient", required: true},
  presentationQuantity: {type: Number, required: true, min: 0.000001},
  presentationLabel: {type: String, required: true, maxlength: 60},
  conversionFactor: {type: Number, required: true, min: 0.000001},
}, {_id:false});
const schema = new Schema({
  name: {type: String, required: true, trim: true, maxlength: 80},
  supplierId: {type: Schema.Types.ObjectId, ref: "Supplier"},
  lines: {type: [line], required: true},
  createdBy: {type: Schema.Types.ObjectId, ref: "Admin", required: true},
}, {timestamps:true});
export const PurchaseTemplate = model("PurchaseTemplate", schema);
