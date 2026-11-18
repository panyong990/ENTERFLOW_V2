import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeInventoryCatalog, assessMaterialStock } from './inventoryModel.js';
import { stockRequestReady } from '../components/sales/stockRequestInput.mjs';
const reference={id:'BUSINESS-CODE',name:'Verified business material',category:'filter_media',unit:'kg',unitPrice:10,threshold:3};
const row={id:'9007199254740993',itemCode:reference.id,name:reference.name,category:reference.category,unit:reference.unit,referenceUnitPrice:'10.0000',approvedCostingPrice:null,threshold:'3.0000',qtyInStock:null};
test('authenticated materials join catalog references by exact item code without inventing stock or approved prices',()=>{
  const result=mergeInventoryCatalog([reference],{materials:[row],finishedGoods:[]});
  assert.equal(result.materials.length,1);
  assert.equal(result.materials[0].source,'database');
  assert.equal(result.materials[0].catalogCode,reference.id);
  assert.ok(Number.isNaN(result.materials[0].qtyInStock));
  assert.ok(Number.isNaN(result.materials[0].approvedCostingPrice));
  assert.equal(result.materials[0].referenceUnitPrice,10);
});
test('unmatched catalog references stay separate from authenticated materials',()=>{
  const result=mergeInventoryCatalog([{...reference,id:'UNMAPPED-CODE'}],{materials:[row],finishedGoods:[]});
  assert.equal(result.materials.length,2);
  assert.equal(result.materials[0].source,'catalog_reference');
  assert.ok(Number.isNaN(result.materials[0].qtyInStock));
  assert.equal(result.materials[1].source,'database');
});
test('authenticated API materials remain selectable by their database ID',()=>{
  const result=mergeInventoryCatalog([reference],{materials:[row],finishedGoods:[]});
  const input={orders:[{id:'91'}],materials:result.materials,orderId:'91',materialId:row.id,quantity:'1',loading:false,error:'',submitting:false};
  assert.equal(result.materials.find(material=>material.source==='database')?.databaseId,row.id);
  assert.equal(stockRequestReady(input),true);
  assert.equal(stockRequestReady({...input,materialId:reference.id}),false);
});
test('only an explicit matching mapping joins catalog and persisted records; conflicts fail closed',()=>{
  const unmappedRow={...row,itemCode:null,qtyInStock:'0.0000'};
  const result=mergeInventoryCatalog([reference],{materials:[unmappedRow],finishedGoods:[]},{'BUSINESS-CODE':row.id});
  assert.equal(result.materials.length,1);assert.equal(result.materials[0].qtyInStock,0);
  assert.equal(result.materials[0].catalogCode,reference.id);
  assert.throws(()=>mergeInventoryCatalog([reference],{materials:[{...unmappedRow,unit:'m'}],finishedGoods:[]},{'BUSINESS-CODE':row.id}),/conflicts/);
  assert.throws(()=>mergeInventoryCatalog([reference],{materials:[],finishedGoods:[]},{'BUSINESS-CODE':row.id}),/not returned/);
});
test('unknown, zero, insufficient and available stock stay distinct',()=>{
  for(const value of [null,undefined,NaN]) assert.equal(assessMaterialStock(2,value).status,'unavailable');
  assert.deepEqual(assessMaterialStock(2,0),{status:'insufficient',shortage:2});
  assert.equal(assessMaterialStock(2,1).status,'insufficient');
  assert.equal(assessMaterialStock(2,2).status,'available');
});
test('finished-good names are not fabricated from item codes when the API omits them',()=>{
  const result=mergeInventoryCatalog([],{materials:[],finishedGoods:[
    {id:'1',itemCode:'FG-001',enterFilPN:null,qtyInStock:null,bufferMin:null},
    {id:'2',itemCode:'FG-002',itemName:'Pleated Filter',enterFilPN:'PN-002',qtyInStock:'0',bufferMin:'0'},
  ]});
  assert.equal(result.finishedGoods[0].itemName,'');
  assert.equal(result.finishedGoods[0].itemCode,'FG-001');
  assert.equal(result.finishedGoods[0].enterFilPN,'');
  assert.ok(Number.isNaN(result.finishedGoods[0].qtyInStock));
  assert.equal(result.finishedGoods[1].itemName,'Pleated Filter');
  assert.equal(result.finishedGoods[1].qtyInStock,0);
});
test('malformed inventory contracts, duplicate codes and unsafe material IDs are rejected',()=>{
  for(const payload of [{},{materials:null,finishedGoods:[]},{materials:[row,row],finishedGoods:[]},{materials:[row,{...row,id:'62'}],finishedGoods:[]},{materials:[{...row,id:9007199254740993}],finishedGoods:[]},{materials:[{...row,qtyInStock:true}],finishedGoods:[]}]) assert.throws(()=>mergeInventoryCatalog([reference],payload));
});
