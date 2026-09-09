import assert from 'node:assert/strict';
import test from 'node:test';
import { batchRows, newIngredient, ingredientMetadata } from './ingredientBatch';
import { orderRequestHash, validRequestKey } from './orderIdempotency';
const row={name:'Pan brioche',unit:'unit',stock:48,minimumStock:10,targetStock:72,unitCost:500,purchaseUnitLabel:'Caja',purchaseUnitFactor:24,category:'Pan',storageLocation:'Depósito',trackExpiration:true};
test('valida importación y no confunde presentación con stock',()=>{assert.equal(newIngredient(row).stock,48);assert.equal(newIngredient(row).purchaseUnitFactor,24);assert.equal(newIngredient(row).slug,'pan-brioche');});
test('rechaza números vacíos, negativos, infinitos y conversiones nulas',()=>{for(const n of ['',null,-1,Infinity,NaN])assert.throws(()=>newIngredient({...row,stock:n}));assert.throws(()=>newIngredient({...row,purchaseUnitFactor:0}));assert.throws(()=>newIngredient({...row,unit:'caja'}));});
test('limita tamaño de importación y no permite modificar stock desde metadata',()=>{assert.throws(()=>batchRows({rows:Array(201).fill(row)}));assert.throws(()=>batchRows({rows:[]}));assert.equal('stock' in ingredientMetadata(row),false);});
test('identidad de reintento ignora orden de claves y distingue cambios de pedido',()=>{const a={customer:{name:'Test',phone:'123'},items:[{id:1,quantity:2}]};const b={items:[{quantity:2,id:1}],customer:{phone:'123',name:'Test'},requestKey:crypto.randomUUID()};assert.equal(orderRequestHash(a),orderRequestHash(b));assert.notEqual(orderRequestHash(a),orderRequestHash({...a,items:[{id:1,quantity:3}]}));assert.ok(validRequestKey(crypto.randomUUID()));assert.equal(validRequestKey('123'),false);});
