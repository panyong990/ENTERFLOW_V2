import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchSummary,dispatchMatches,dispatchStatus,validDispatchIdentity} from './warehouseDispatch.js';
test('dispatch summaries use persisted items and integer-string quantities without invented units or fallback zero',()=>{
  const summary=dispatchSummary({waybillItems:[{name:'A',quantity:'4294967295'},{name:'B',quantity:'4294967295'}]});
  assert.equal(summary.quantity,'8589934590');assert.equal(summary.item,'A × 4294967295; B × 4294967295');
  for(const items of [undefined,[],[{name:'A',quantity:2}],[{name:'A',quantity:'0'}]])assert.deepEqual(dispatchSummary({waybillItems:items}),{item:'Not available',quantity:'Not available',available:false});
});
test('search uses authenticated records/items and date filters exclude unknown dates without inventing created timestamps',()=>{
  const row={id:'9007199254740993',jobOrderId:'2',jobOrderReference:'JO-A',companyName:'Synthetic',waybillItems:[{name:'Filter Alpha',quantity:'3'}],estimatedDeliveryDate:'2026-11-26'};
  assert.equal(validDispatchIdentity(row),true);assert.equal(validDispatchIdentity({...row,id:12}),false);
  assert.equal(dispatchMatches(row,{search:'alpha'}),true);assert.equal(dispatchMatches(row,{search:'not present'}),false);
  const filter={dateFilter:'today',now:new Date('2026-11-26T12:00:00')};assert.equal(dispatchMatches(row,filter),true);
  assert.equal(dispatchMatches({...row,estimatedDeliveryDate:null},filter),false);
  assert.equal(dispatchStatus('pending'),'Pending');assert.notEqual(dispatchStatus('pending'),'Ready for Dispatch');
});
