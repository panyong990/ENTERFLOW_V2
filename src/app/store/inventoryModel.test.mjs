import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeInventoryCatalog, assessMaterialStock } from './inventoryModel.js';
const reference={id:'BUSINESS-CODE',name:'Verified business material',category:'filter_media',unit:'kg',unitPrice:10,threshold:3};
const row={...reference,id:'9007199254740993',unitPrice:'10.0000',threshold:'3.0000',qtyInStock:null};
test('catalog reference never receives fabricated stock or guesses a numeric ID mapping',()=>{
  const result=mergeInventoryCatalog([reference],{materials:[row],finishedGoods:[]});
  assert.equal(result.materials.length,2);
  assert.ok(Number.isNaN(result.materials[0].qtyInStock));
  assert.equal(result.materials[0].source,'catalog_reference');
  assert.equal(result.materials[1].id,'9007199254740993');
  assert.ok(Number.isNaN(result.materials[1].qtyInStock));
});
test('only an explicit matching mapping joins catalog and persisted records; conflicts fail closed',()=>{
  const result=mergeInventoryCatalog([reference],{materials:[{...row,qtyInStock:'0.0000'}],finishedGoods:[]},{'BUSINESS-CODE':row.id});
  assert.equal(result.materials.length,1);assert.equal(result.materials[0].qtyInStock,0);
  assert.equal(result.materials[0].catalogCode,reference.id);
  assert.throws(()=>mergeInventoryCatalog([reference],{materials:[{...row,unit:'m'}],finishedGoods:[]},{'BUSINESS-CODE':row.id}),/conflicts/);
  assert.throws(()=>mergeInventoryCatalog([reference],{materials:[],finishedGoods:[]},{'BUSINESS-CODE':row.id}),/not returned/);
});
test('unknown, zero, insufficient and available stock stay distinct',()=>{
  for(const value of [null,undefined,NaN]) assert.equal(assessMaterialStock(2,value).status,'unavailable');
  assert.deepEqual(assessMaterialStock(2,0),{status:'insufficient',shortage:2});
  assert.equal(assessMaterialStock(2,1).status,'insufficient');
  assert.equal(assessMaterialStock(2,2).status,'available');
});
test('malformed inventory contracts and duplicate/unsafe material IDs are rejected',()=>{
  for(const payload of [{},{materials:null,finishedGoods:[]},{materials:[row,row],finishedGoods:[]},{materials:[{...row,id:9007199254740993}],finishedGoods:[]},{materials:[{...row,qtyInStock:true}],finishedGoods:[]}]) assert.throws(()=>mergeInventoryCatalog([reference],payload));
});
