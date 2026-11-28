import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeInventoryCatalog, assessMaterialStock, operationalInventoryNumber, materialObservationFields, normalizeOperationalAvailability, stockAvailabilityQuantityLabel } from './inventoryModel.js';
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

test('Q02 raw samples remain editable while operational quantity and threshold are independent', () => {
  const material = { ...row, qtyInStock: '10.0000', threshold: '2.0000', quantityStatus: 'provisional_sample', thresholdStatus: 'provisional_sample' };
  const mapped = mergeInventoryCatalog([], { materials: [material], finishedGoods: [] }).materials[0];
  assert.equal(mapped.qtyInStock, 10);
  assert.equal(mapped.threshold, 2);
  assert.equal(mapped.quantityStatus, 'provisional_sample');
  assert.equal(mapped.thresholdStatus, 'provisional_sample');
  assert.ok(Number.isNaN(operationalInventoryNumber(mapped.qtyInStock, mapped.quantityStatus)));
  assert.ok(Number.isNaN(operationalInventoryNumber(mapped.threshold, mapped.thresholdStatus)));
  assert.equal(operationalInventoryNumber(mapped.qtyInStock, 'verified'), 10);
  assert.ok(Number.isNaN(operationalInventoryNumber(mapped.threshold, mapped.thresholdStatus)));
  assert.equal(operationalInventoryNumber('0.0000', 'verified'), 0);
  for (const status of [undefined, null, 'unknown', 'invalid', 'provisional_sample']) {
    assert.ok(Number.isNaN(operationalInventoryNumber(10, status)));
  }
});

test('Q02 form observations include only explicitly edited fields, including same values and zero', () => {
  const fields = { quantity: '10', threshold: '2', quantityObserved: false, thresholdObserved: false };
  assert.deepEqual(materialObservationFields(fields), {});
  assert.deepEqual(materialObservationFields({ ...fields, quantityObserved: true }), { quantityOnHand: '10' });
  assert.deepEqual(materialObservationFields({ ...fields, thresholdObserved: true }), { threshold: '2' });
  assert.deepEqual(materialObservationFields({ ...fields, quantity: '0', quantityObserved: true }), { quantityOnHand: '0' });
  assert.deepEqual(materialObservationFields({ ...fields, quantity: '', quantityObserved: true }), { quantityOnHand: null });
  assert.deepEqual(materialObservationFields({ ...fields, threshold: '', thresholdObserved: true }), { threshold: null });
});

test('Q02 Sales adapter cannot show legacy, sample, unknown or contradictory availability as operational', () => {
  const base = { stockChanged: false, overallStatus: 'available', unmappedItems: [], assessments: [
    { classification: 'raw_material', quantityStatus: 'verified', availableQuantity: 10, requiredQuantity: 5, shortageQuantity: 0, inventoryState: 'recorded', status: 'available' },
  ] };
  for (const quantityStatus of ['unknown', 'provisional_sample', 'invalid', null, undefined]) {
    const result = normalizeOperationalAvailability({ ...base, assessments: [{ ...base.assessments[0], quantityStatus }] });
    assert.equal(result.overallStatus, 'unavailable');
    assert.equal(result.assessments[0].availableQuantity, null);
    assert.equal(result.assessments[0].shortageQuantity, null);
    assert.equal(result.assessments[0].status, 'inventory_unavailable');
    assert.equal(stockAvailabilityQuantityLabel(result.assessments[0]), quantityStatus === 'provisional_sample' ? 'Sample · Quantity unavailable' : 'Quantity unavailable');
  }
  const unknown = normalizeOperationalAvailability({ ...base, assessments: [{ ...base.assessments[0], availableQuantity: null }] });
  assert.equal(unknown.overallStatus, 'unavailable');
  assert.equal(stockAvailabilityQuantityLabel({ ...base.assessments[0], quantityStatus: 'unknown' }), 'Quantity unavailable');
  const zero = normalizeOperationalAvailability({ ...base, assessments: [{ ...base.assessments[0], availableQuantity: 0 }] });
  assert.equal(zero.overallStatus, 'insufficient');
  assert.equal(zero.assessments[0].shortageQuantity, 5);
  assert.equal(stockAvailabilityQuantityLabel(zero.assessments[0]), 'Recorded 0');
  assert.equal(normalizeOperationalAvailability(base).overallStatus, 'available');
  assert.equal(normalizeOperationalAvailability({ ...base, unmappedItems: [{ itemId: '1' }] }).overallStatus, 'unmapped');
  assert.equal(base.assessments[0].availableQuantity, 10);
});


test('Sales backend requires explicit BOM completeness and retains mapped quantities only with complete metadata', () => {
  const incomplete = {
    orderId: '13',
    overallStatus: 'unmapped',
    requirementsAvailable: false,
    stockChanged: false,
    materials: [],
    assessments: []
  };
  assert.throws(() => normalizeOperationalAvailability(incomplete), /completeness/);
  const unmapped = normalizeOperationalAvailability({...incomplete,unmappedItems:[]});

  assert.equal(unmapped.overallStatus, 'unmapped');
  assert.deepEqual(unmapped.unmappedItems, []);
  assert.equal(unmapped.assessments.length, 0);

  const available = normalizeOperationalAvailability({
    orderId: '13',
    overallStatus: 'available',
    requirementsAvailable: true,
    unmappedItems: [],
    stockChanged: false,
    materials: [],
    assessments: [{
      materialId: '1',
      materialName: 'Test material',
      unitCode: 'pc',
      classification: 'raw_material',
      quantityStatus: 'verified',
      requiredQuantity: '10.0000',
      availableQuantity: '200.0000',
      shortageQuantity: '0.0000',
      status: 'available'
    }]
  });

  assert.equal(available.overallStatus, 'available');
  assert.equal(available.assessments[0].inventoryId, '1');
  assert.equal(available.assessments[0].description, 'Test material');
  assert.equal(available.assessments[0].unit, 'pc');
  assert.equal(available.assessments[0].availableQuantity, 200);
  assert.equal(available.assessments[0].shortageQuantity, 0);
  assert.equal(available.stockChanged,false);
  assert.equal(normalizeOperationalAvailability({...available,requirementsAvailable:false}).overallStatus,'unmapped');
});
