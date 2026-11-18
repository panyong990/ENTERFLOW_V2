import test from 'node:test';
import assert from 'node:assert/strict';
import { createStockRequestsService } from './stock-requests.service.js';

function harness() {
  const calls = [];
  const connection = {
    async beginTransaction() { calls.push('BEGIN'); }, async commit() { calls.push('COMMIT'); }, async rollback() { calls.push('ROLLBACK'); }, release() {},
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('FROM orders')) return [[{ id: '91', clientId: '7' }]];
      if (sql.includes('FROM materials') && sql.includes('active=TRUE')) return [[{ id: '61', name: 'Media', unitCode: 'pcs', quantityOnHand: '2' }]];
      if (sql.startsWith('INSERT INTO stock_requests')) return [{ affectedRows: 1, insertId: 501 }];
      if (sql.startsWith('INSERT INTO stock_request_lines')) return [{ affectedRows: 1 }];
      if (sql.startsWith('INSERT INTO audit_events')) return [{ affectedRows: 1 }];
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };
  return { calls, service: createStockRequestsService({ db: { getConnection: async () => connection } }) };
}

test('Sales creates an explicit stock request without reserving or deducting inventory', async () => {
  const h = harness();
  const result = await h.service.create({ accountType: 'employee', roleCode: 'sales', userId: '8' }, { orderId: '91', lines: [{ materialId: '61', quantity: 5 }] });
  assert.equal(result.success, true); assert.equal(result.data.status, 'pending');
  assert.equal(h.calls.some(call => typeof call === 'object' && /UPDATE materials|material_movements/i.test(call.sql)), false);
});

test('Stock request creation rejects unauthorized roles and invalid quantities before database access', async () => {
  const h = harness();
  assert.equal((await h.service.create({ accountType: 'employee', roleCode: 'warehouse', userId: '8' }, { orderId: '91', lines: [{ materialId: '61', quantity: 1 }] })).code, 'FORBIDDEN');
  assert.equal((await h.service.create({ accountType: 'employee', roleCode: 'sales', userId: '8' }, { orderId: '91', lines: [{ materialId: '61', quantity: 0 }] })).code, 'VALIDATION_ERROR');
  assert.equal(h.calls.length, 0);
});

function processingHarness() {
  const calls=[];
  const connection={async beginTransaction(){calls.push('BEGIN');},async commit(){calls.push('COMMIT');},async rollback(){calls.push('ROLLBACK');},release(){},async execute(sql,params){
    calls.push({sql,params});assert.equal((sql.match(/\?/g)??[]).length,params.length);
    if(sql.includes('FROM stock_requests'))return [[{id:'501',orderId:'91',status:'pending'}]];
    if(sql.includes('FROM stock_request_lines'))return [[{id:'601',materialId:'61',requiredQuantity:'5.0000'}]];
    if(sql.startsWith('INSERT INTO stock_responses'))return [{insertId:'701',affectedRows:1}];
    if(sql.startsWith('INSERT')||sql.startsWith('UPDATE'))return [{affectedRows:1}];
    throw new Error('Unexpected test SQL');
  }};
  return {calls,service:createStockRequestsService({db:{getConnection:async()=>connection}})};
}
const warehouse={accountType:'employee',roleCode:'warehouse',userId:'9'};
const zeroResponse={status:'updated',lines:[{lineId:'601',currentQuantity:0,shortageQuantity:5}],inventoryUpdates:[{materialId:'61',quantityOnHand:0}]};
test('Warehouse can record a verified zero, with explicit material update and audit values',async()=>{
  const h=processingHarness();const result=await h.service.process(warehouse,'501',zeroResponse);
  assert.equal(result.success,true);assert.ok(h.calls.includes('COMMIT'));
  assert.deepEqual(h.calls.find(call=>call.sql?.startsWith('UPDATE materials')).params,[0,'61']);
  const audit=h.calls.find(call=>call.sql?.startsWith('INSERT INTO audit_events'));
  assert.deepEqual(JSON.parse(audit.params[4]).inventoryUpdates,zeroResponse.inventoryUpdates);
});
test('reviewing records a response without changing material stock',async()=>{
  const h=processingHarness();assert.equal((await h.service.process(warehouse,'501',{status:'responded',lines:zeroResponse.lines})).success,true);
  assert.equal(h.calls.some(call=>call.sql?.startsWith('UPDATE materials')),false);
});
test('unknown, duplicate, unrelated or inconsistent manual stock updates fail before writes',async()=>{
  for(const body of [
    {...zeroResponse,lines:[{lineId:'601',currentQuantity:'',shortageQuantity:5}]},
    {...zeroResponse,lines:[{lineId:'601',currentQuantity:0,shortageQuantity:0}]},
    {...zeroResponse,lines:[...zeroResponse.lines,...zeroResponse.lines]},
    {...zeroResponse,inventoryUpdates:[{materialId:'62',quantityOnHand:0}]},
    {...zeroResponse,inventoryUpdates:[{materialId:'61',quantityOnHand:5}]},
    {...zeroResponse,inventoryUpdates:[{materialId:'61',quantityOnHand:null}]}
  ]) {const h=processingHarness();assert.equal((await h.service.process(warehouse,'501',body)).code,'VALIDATION_ERROR');assert.equal(h.calls.some(call=>/^(INSERT|UPDATE)/.test(call.sql??'')),false);}
  const h=processingHarness();assert.equal((await h.service.process({...warehouse,roleCode:'sales'},'501',zeroResponse)).code,'FORBIDDEN');assert.equal(h.calls.length,0);
});

test('Sales and Warehouse see the same latest response without rewriting request snapshots',async()=>{
  const calls=[];const connection={release(){},async execute(sql,params){calls.push({sql,params});
    if(sql.includes('FROM stock_requests sr'))return [[{id:'501',reference:'SR-1',orderId:'91',status:'updated'}]];
    if(sql.includes('FROM stock_request_lines srl'))return [[{id:'601',materialId:'61',stockAtRequest:null,shortageAtRequest:null}]];
    if(sql.includes('FROM stock_response_lines srl'))return [[{lineId:'601',currentQuantity:'0.0000',shortageQuantity:'5.0000',respondedAt:'2026-11-18'}]];
    throw new Error('Unexpected test SQL');
  }};
  const service=createStockRequestsService({db:{getConnection:async()=>connection}});
  const sales=await service.list({...warehouse,roleCode:'sales'}),wh=await service.list(warehouse);
  assert.deepEqual(sales,wh);assert.equal(sales.data[0].lines[0].stockAtRequest,null);
  assert.equal(sales.data[0].lines[0].latestResponse.currentQuantity,'0.0000');
  assert.ok(calls.every(call=>call.sql.startsWith('SELECT')));
});
