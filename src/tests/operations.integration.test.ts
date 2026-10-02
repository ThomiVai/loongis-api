import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { app } from '../app';
import { Admin } from '../models/admin.model';
import { Ingredient } from '../models/ingredient.model';
import { InventoryMovement } from '../models/inventoryMovement.model';
import { InventoryLot } from '../models/inventoryLot.model';
import { Product } from '../models/product.model';
import { ProductImage } from '../models/productImage.model';
import { ProductRecipe } from '../models/productRecipe.model';
import { StoreSettings } from '../models/storeSettings.model';
import { Order } from '../models/order.model';
import { InventoryCount } from '../models/inventoryCount.model';
import { migrateDoubleCombos } from '../services/comboMigration';

test('operaciones completas en MongoDB temporal, sin usar configuración de producción', {timeout:240000}, async t => {
 const mongo=await MongoMemoryReplSet.create({replSet:{count:1},binary:{version:'7.0.24'}});
 let server:ReturnType<typeof app.listen>|undefined;
 try {
  process.env.JWT_SECRET='test-only-random-secret-for-isolated-integration';
  await mongoose.connect(mongo.getUri(),{dbName:'loongis_operations_test'});
  await Promise.all([Ingredient.init(),Order.init()]);
  const owner=await Admin.create({email:'owner@example.test',password:'unused',role:'owner'});
  const manager=await Admin.create({email:'manager@example.test',password:'unused',role:'manager'});
  const token=(id:string,role:string)=>jwt.sign({adminId:id,role},process.env.JWT_SECRET!);
  const ownerToken=token(owner.id,'owner');const managerToken=token(manager.id,'manager');
  server=app.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();assert.ok(address&&typeof address!=='string');const base=`http://127.0.0.1:${address.port}`;
  async function call(path:string,method='GET',body?:unknown,auth=ownerToken){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${auth}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,...await r.json() as {data:any;message?:string}};}
  async function rawCall(path:string,body:Uint8Array,contentType:string,auth=ownerToken){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':contentType,'X-File-Name':encodeURIComponent('hamburguesa.png'),...(auth?{Authorization:`Bearer ${auth}`}:{})},body:Buffer.from(body)});return {status:r.status,...await r.json() as {data:any;message?:string}};}
  async function download(path:string,auth=ownerToken){const r=await fetch(base+path,{headers:auth?{Authorization:`Bearer ${auth}`}:{}});const bytes=new Uint8Array(await r.arrayBuffer());return {status:r.status,type:r.headers.get('content-type'),disposition:r.headers.get('content-disposition'),hasBom:bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf,text:new TextDecoder().decode(bytes)};}
  const row=(name:string,stock=10)=>({name,unit:'unit',stock,minimumStock:2,targetStock:20,unitCost:100,purchaseUnitFactor:12,purchaseUnitLabel:'Caja',category:'Prueba',storageLocation:'Depósito',trackExpiration:false});
  await t.test('permisos, importación y rechazo de duplicados sin escrituras parciales',async()=>{
   assert.equal((await call('/api/inventory/ingredients/import','POST',{rows:[row('Pan')]},managerToken)).status,403);
   assert.equal((await call('/api/inventory/ingredients/import','POST',{rows:[row('Pan'),row('Carne')]})).status,201);
   assert.equal(await InventoryMovement.countDocuments({type:'initial'}),2);assert.equal(await InventoryLot.countDocuments(),2);
   assert.equal((await call('/api/inventory/ingredients/import','POST',{rows:[row('Nuevo'),row('Pan')]})).status,409);
   assert.equal(await Ingredient.countDocuments({name:'Nuevo'}),0);
   assert.equal((await call('/api/inventory/ingredients/import','POST',{rows:[row('Duplicado'),row('Dúplicado')]})).status,400);
  });
  await t.test('edición masiva atómica rechaza una fila desactualizada y conserva stock',async()=>{
   const items=await Ingredient.find().lean();const first=items[0]!;const second=items[1]!;
   const data=(item:any)=>({...row(item.name),id:String(item._id),updatedAt:item.updatedAt.toISOString(),minimumStock:7,stock:999});
   const bad={...data(second),updatedAt:new Date(0).toISOString()};
   assert.equal((await call('/api/inventory/ingredients/batch','PATCH',{rows:[data(first),bad]})).status,409);
   assert.equal((await Ingredient.findById(first._id))!.minimumStock,2);
   assert.equal((await call('/api/inventory/ingredients/batch','PATCH',{rows:items.map(data)})).status,200);
   assert.equal((await Ingredient.findById(first._id))!.stock,10);
  });
  await t.test('habituales compartidas no mueven stock; compras convierten y ponderan',async()=>{
   const pan=(await Ingredient.findOne({name:'Pan'}))!;
   const line={ingredientId:pan.id,presentationQuantity:2,presentationLabel:'Caja',conversionFactor:12};
   const habitual=await call('/api/inventory/purchase-templates','POST',{name:'Pan semanal',lines:[{...line,totalCost:999,batchNumber:'ANTERIOR'}]},managerToken);
   assert.equal(habitual.status,201);assert.equal(habitual.data.lines[0].totalCost,undefined);assert.equal(habitual.data.lines[0].batchNumber,undefined);assert.equal((await Ingredient.findById(pan.id))!.stock,10);
   assert.equal((await call('/api/inventory/purchase-templates','GET',undefined,managerToken)).data.length,1);
   assert.equal((await call(`/api/inventory/purchase-templates/${habitual.data._id}`,'DELETE',undefined,managerToken)).status,403);
   const purchase=await call('/api/inventory/purchases','POST',{purchasedAt:new Date().toISOString(),lines:[{...line,totalCost:4800,batchNumber:'NUEVO'}]},managerToken);
   assert.equal(purchase.status,201,purchase.message ?? "Compra rechazada");const changed=(await Ingredient.findById(pan.id))!;assert.equal(changed.stock,34);assert.ok(Math.abs(changed.unitCost-5800/34)<.01);
  });
  await t.test('imágenes de productos se validan, persisten y se sirven públicamente',async()=>{
   const png=Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
   assert.equal((await rawCall('/api/products/images',png,'image/png',managerToken)).status,403);
   assert.equal((await rawCall('/api/products/images',Uint8Array.from([1,2,3]),'image/png')).status,400);
   const uploaded=await rawCall('/api/products/images',png,'image/png');assert.equal(uploaded.status,201,uploaded.message ?? 'Imagen rechazada');assert.match(uploaded.data.url,/^\/api\/products\/images\/[a-f0-9]{24}$/);
   assert.equal(await ProductImage.countDocuments(),1);
   const response=await fetch(base+uploaded.data.url);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');assert.deepEqual(new Uint8Array(await response.arrayBuffer()),png);
  });
  await t.test('pedido concurrente se registra una vez; confirma y reintegra una sola vez',async()=>{
   await StoreSettings.create({_id:'main',orderMode:'open',inventoryTrackingEnabled:true});
   const pan=(await Ingredient.findOne({name:'Pan'}))!;
   const product=await Product.create({legacyId:999,name:'Producto de prueba',slug:'producto-prueba',description:'Solo para la prueba',price:1000,image:'/test.jpg',imageAlt:'Prueba',category:new mongoose.Types.ObjectId(),active:true});
   await ProductRecipe.create({product:product._id,active:true,baseItems:[{ingredient:pan._id,quantity:1}],sizeModifiers:[],extraModifiers:[],choiceModifiers:[]});
   const body={requestKey:crypto.randomUUID(),customer:{name:'Cliente Prueba',phone:'1123456789',address:'Dirección de prueba 123'},deliveryMethod:'delivery',paymentMethod:'cash',items:[{legacyId:999,quantity:2,customization:{extraIds:[],removedIngredients:[],choices:[],notes:''}}],generalNotes:''};
   const results=await Promise.all([call('/api/orders','POST',body,''),call('/api/orders','POST',body,'')]);
   assert.ok(results.every(r=>r.status===200||r.status===201),JSON.stringify(results));assert.equal(results[0].data._id,results[1].data._id);assert.equal(await Order.countDocuments(),1);
   assert.equal(results[0].data.requestKey,undefined);assert.equal(results[1].data.requestHash,undefined);
   assert.equal((await call('/api/orders','POST',{...body,generalNotes:'cambio'},'')).status,409);
   const id=results[0].data._id;assert.equal((await Ingredient.findById(pan.id))!.stock,34);
   assert.equal((await call(`/api/orders/${id}/status`,'PATCH',{status:'confirmed'},managerToken)).status,200);
   assert.equal((await Ingredient.findById(pan.id))!.stock,32);
   assert.equal((await call(`/api/orders/${id}/status`,'PATCH',{status:'confirmed'},managerToken)).status,200);assert.equal((await Ingredient.findById(pan.id))!.stock,32);
   assert.equal((await call(`/api/orders/${id}/status`,'PATCH',{status:'cancelled',restoreInventory:true},managerToken)).status,200);assert.equal((await Ingredient.findById(pan.id))!.stock,34);
   assert.equal((await call(`/api/orders/${id}/status`,'PATCH',{status:'cancelled',restoreInventory:true},managerToken)).status,200);assert.equal((await Ingredient.findById(pan.id))!.stock,34);
  });
  await t.test('ventas excluye pendientes y cancelados, respeta límites argentinos y no suma envío',async()=>{
   assert.equal((await call('/api/orders/sales?from=2026-01-01&to=2026-01-02','GET',undefined,'')).status,401);
   assert.equal((await call('/api/orders/sales?from=2026-02-30&to=2026-03-01')).status,400);
   await Order.collection.insertMany([
    {createdAt:new Date('2026-01-01T02:59:59Z'),status:'confirmed',productsTotal:999},
    {createdAt:new Date('2026-01-01T03:00:00Z'),status:'confirmed',productsTotal:1000,total:1500},
    {createdAt:new Date('2026-01-02T02:59:59Z'),status:'confirmed',productsTotal:2000,total:2500},
    {createdAt:new Date('2026-01-02T03:00:00Z'),status:'pending',productsTotal:9000},
    {createdAt:new Date('2026-01-02T04:00:00Z'),status:'cancelled',productsTotal:9000},
    {createdAt:new Date('2026-01-03T03:00:00Z'),status:'confirmed',productsTotal:999},
   ].map((item,index)=>({...item,orderNumber:9000+index})));
   const report=await call('/api/orders/sales?from=2026-01-01&to=2026-01-02');
   assert.equal(report.status,200);assert.equal(report.data.sales,3000);assert.equal(report.data.orders,2);assert.equal(report.data.averageTicket,1500);
   assert.deepEqual(report.data.days,[{date:'2026-01-01',sales:3000,orders:2},{date:'2026-01-02',sales:0,orders:0}]);
  });
  await t.test('exportaciones entregan CSV completos solo al dueño',async()=>{
   assert.equal((await download('/api/exports/orders.csv',managerToken)).status,403);
   for(const dataset of ['orders','sales','purchases','movements']){const exported=await download(`/api/exports/${dataset}.csv`);assert.equal(exported.status,200);assert.match(exported.type??'',/^text\/csv/);assert.match(exported.disposition??'',/attachment/);assert.ok(exported.hasBom);assert.ok(exported.text.startsWith('"'));}
  });
  await t.test('reinicio seguro pone existencias en cero y conserva trazabilidad',async()=>{
   assert.equal((await call('/api/inventory/reset-stock','POST',{confirmation:'REINICIAR'},managerToken)).status,403);
   assert.equal((await call('/api/inventory/reset-stock','POST',{confirmation:'reiniciar'})).status,400);
   const before=await InventoryMovement.countDocuments();const result=await call('/api/inventory/reset-stock','POST',{confirmation:'REINICIAR'});assert.equal(result.status,201,result.message ?? 'Reinicio rechazado');
   assert.equal(await Ingredient.countDocuments({active:true,stock:{$ne:0}}),0);assert.equal(await InventoryCount.countDocuments({label:'Reinicio de stock'}),1);assert.ok(await InventoryMovement.countDocuments()>before);
  });
  await t.test('migración de combos conserva precios y exige las dos hamburguesas al registrar',async()=>{
   await StoreSettings.updateOne({_id:'main'},{$set:{orderMode:'open',inventoryTrackingEnabled:false}});
   for(const legacyId of [101,110])await Product.create({legacyId,name:'Combo anterior',slug:`combo-${legacyId}`,description:'Anterior',price:12345,image:'/original.png',imageAlt:'Original',category:new mongoose.Types.ObjectId(),active:true});
   await migrateDoubleCombos();
   for(const legacyId of [101,110]){
    const product=(await Product.findOne({legacyId}))!;
    assert.equal(product.price,12345);assert.equal(product.image,'/original.png');assert.equal(product.choiceGroups.length,2);
    const choices=product.choiceGroups.map(group=>({groupId:group.id,optionId:group.options[0].id,removedIngredients:[]}));
    const body={requestKey:crypto.randomUUID(),customer:{name:'Prueba Combo',phone:'1123456789',address:'Prueba 123'},deliveryMethod:'delivery',paymentMethod:'cash',items:[{legacyId,quantity:1,customization:{extraIds:[],removedIngredients:[],choices,notes:''}}],generalNotes:''};
    const created=await call('/api/orders','POST',body,'');assert.equal(created.status,201,created.message ?? 'Pedido rechazado');assert.equal(created.data.items[0].name,legacyId===101?'Combo Gula':'Combo Tranka');assert.equal(created.data.items[0].customization.choices.length,2);
    body.requestKey=crypto.randomUUID();body.items[0].customization.choices=choices.slice(0,1);assert.equal((await call('/api/orders','POST',body,'')).status,400);
   }
   await Product.updateOne({legacyId:101},{$set:{description:'Edición posterior'}});
   await migrateDoubleCombos();assert.equal((await Product.findOne({legacyId:101}))!.description,'Edición posterior');
  });
 }finally{if(server)await new Promise<void>(resolve=>server!.close(()=>resolve()));await mongoose.disconnect();await mongo.stop();}
});
