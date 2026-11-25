import test from 'node:test';
import assert from 'node:assert/strict';
import { createStockRequestsService } from './stock-requests.service.js';


function harness({
  quantityOnHand = '2',
  quantityStatus = 'verified',
  existingRequest = false,
} = {}) {
  const calls = [];

  const connection = {
    async beginTransaction() { calls.push('BEGIN'); },
    async commit() { calls.push('COMMIT'); },
    async rollback() { calls.push('ROLLBACK'); },
    release() {},

    async execute(sql, params) {
      calls.push({ sql, params });

      if (sql.includes('FROM user_account')) {
        return [[{
          userId: '8',
          roleCode: 'sales',
          status: 'active',
          mustChangePassword: 0,
          clientId: null,
        }]];
      }

      if (sql.includes('FROM inquiry WHERE')) {
        return [[{ id: '91', clientId: '7', status: 'quotation' }]];
      }
      if (sql.includes('FROM stock_request WHERE inquiry_id=?')) {
  return existingRequest
    ? [[{ id: '501' }]]
    : [[]];
}

      if (sql.includes('FROM inquiry_item')) {
        return [[{ id: '301' }]];
      }

      if (sql.includes('COUNT(cm.estimate_material_id)')) {
        return [[{
          itemId: '301',
          materialCount: 1,
          invalidCount: 0,
        }]];
      }

      if (sql.includes('SUM(cm.qty_per_filter * qi.quantity)')) {
        return [[{
          materialId: '61',
          requiredQuantity: '5.0000',
          quantityOnHand,
          quantityStatus,
        }]];
      }

      if (sql.includes('FROM quotation')) {
        return [[{ id: '201', reference: 'QT-91-R2' }]];
      }

      if (
        sql.includes('FROM raw_material') &&
        sql.includes('is_active=1')
      ) {
        return [[{
          material_id: '61',
          material_name: 'Media',
          uom_id: '1',
          qty_in_stock: quantityOnHand,
          quantity_status: quantityStatus,
        }]];
      }

      if (sql.startsWith('INSERT INTO stock_request(')) {
        return [{ affectedRows: 1, insertId: 501 }];
      }

      if (sql.startsWith('INSERT INTO stock_request_item')) {
        return [{ affectedRows: 1, insertId: '1' }];
      }

      if (sql.startsWith('INSERT INTO audit_event')) {
        return [{ affectedRows: 1, insertId: '1' }];
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };

  return {
    calls,
    service: createStockRequestsService({
      db: { getConnection: async () => connection },
    }),
  };
}


test('Sales creates an explicit stock request without reserving or deducting inventory', async () => {
  const h = harness();
  const result = await h.service.create({ accountType: 'employee', roleCode: 'sales', userId: '8' }, { orderId: '91', lines: [{ materialId: '61', quantity: 5 }] });
  assert.equal(result.success, true); assert.equal(result.data.status, 'pending');
  assert.equal(h.calls.some(call => typeof call === 'object' && /UPDATE raw_material|stock_movement/i.test(call.sql)), false);
});

test('Sales cannot create a second Stock Request for the same inquiry', async () => {
  const h = harness({ existingRequest: true });

  const result = await h.service.create(
    { accountType: 'employee', roleCode: 'sales', userId: '8' },
    {
      orderId: '91',
      lines: [{ materialId: '61', quantity: 5 }],
    }
  );

  assert.equal(result.code, 'DUPLICATE_REQUEST');
  assert.ok(h.calls.includes('ROLLBACK'));

  assert.equal(
    h.calls.some(
      call => typeof call === 'object' && call.sql?.startsWith('INSERT')
    ),
    false
  );
});


test('Sales Stock Request rejects unknown inventory but accepts verified zero', async () => {
  const unknown = harness({ quantityOnHand: null, quantityStatus: 'unknown' });

  const rejected = await unknown.service.create(
    { accountType: 'employee', roleCode: 'sales', userId: '8' },
    { orderId: '91', lines: [{ materialId: '61', quantity: 5 }] }
  );

  assert.equal(rejected.code, 'INVENTORY_UNAVAILABLE');
  assert.ok(unknown.calls.includes('ROLLBACK'));
  assert.equal(
    unknown.calls.some(call => typeof call === 'object' && call.sql?.startsWith('INSERT')),
    false
  );

  const verifiedZero = harness({ quantityOnHand: '0.0000', quantityStatus: 'verified' });

  const result = await verifiedZero.service.create(
    { accountType: 'employee', roleCode: 'sales', userId: '8' },
    { orderId: '91', lines: [{ materialId: '61', quantity: 5 }] }
  );

  assert.equal(result.success, true);

  const snapshot = verifiedZero.calls.find(
    call => call.sql?.startsWith('INSERT INTO stock_request_item')
  );

  assert.deepEqual(snapshot.params.slice(3, 5), ['0.0000', '5.0000']);
});


test('Sales Stock Request retains the quotation reference and rejects malformed recorded inventory', async () => {
  const quoted = harness();
  const result = await quoted.service.create({ accountType: 'employee', roleCode: 'sales', userId: '8' }, { orderId: '91', quotationId: '201', lines: [{ materialId: '61', quantity: 5 }] });
  assert.equal(result.data.clientReference, 'QT-91-R2');
  assert.equal(JSON.parse(quoted.calls.find(call=>call.sql?.startsWith('INSERT INTO audit_event')).params[5]).clientReference,'QT-91-R2');

  const invalid = harness({ quantityOnHand: '-1' });
  assert.equal(
  (await invalid.service.create(
    { accountType: 'employee', roleCode: 'sales', userId: '8' },
    { orderId: '91', lines: [{ materialId: '61', quantity: 5 }] }
  )).code,
  'VALIDATION_ERROR'
);
  assert.equal(invalid.calls.some(call => call.sql?.startsWith('INSERT')), false);
  assert.ok(invalid.calls.includes('ROLLBACK'));
});

test('Stock request creation rejects unauthorized roles and invalid quantities before database access', async () => {
  const h = harness();
  assert.equal((await h.service.create({ accountType: 'employee', roleCode: 'warehouse', userId: '8' }, { orderId: '91', lines: [{ materialId: '61', quantity: 1 }] })).code, 'FORBIDDEN');
  assert.equal((await h.service.create({ accountType: 'employee', roleCode: 'sales', userId: '8' }, { orderId: '91', lines: [{ materialId: '61', quantity: 0 }] })).code, 'VALIDATION_ERROR');
  assert.equal(h.calls.some(call=>/^(INSERT|UPDATE)/.test(call.sql??'')),false);
});

for (const [quantityStatus, quantityOnHand, expectedStock, expectedShortage] of [
  ['verified', '2.0000', 2, 3], ['verified', '0.0000', 0, 5], ['verified', '8.0000', 8, 0],
  ['unknown', null, null, null], ['unknown', '10.0000', null, null],
  ['provisional_sample', '10.0000', null, null], ['provisional_sample', '0.0000', null, null],
  ['verified', null, null, null], ['invalid', '10.0000', null, null], [null, '10.0000', null, null],
]) {
  test(`Q02 Stock Request snapshots ${quantityStatus} ${quantityOnHand} without claiming unverified stock`, async () => {
    const h = harness({ quantityStatus, quantityOnHand });
    const result = await h.service.create({ accountType: 'employee', roleCode: 'sales', userId: '8' }, { orderId: '91', lines: [{ materialId: '61', quantity: 5 }] });
    if (quantityStatus !== 'verified' || quantityOnHand === null) {
  assert.equal(result.code, 'INVENTORY_UNAVAILABLE');
  assert.ok(h.calls.includes('ROLLBACK'));
  assert.equal(
    h.calls.some(call => typeof call === 'object' && call.sql?.startsWith('INSERT')),
    false
  );
  return;
}

if (Number(quantityOnHand) >= 5) {
  assert.equal(result.code, 'STOCK_REQUIREMENTS_MISMATCH');
  assert.ok(h.calls.includes('ROLLBACK'));
  assert.equal(
    h.calls.some(call => typeof call === 'object' && call.sql?.startsWith('INSERT')),
    false
  );
  return;
}

assert.equal(result.success, true);
    const materialRead = h.calls.find(call => call.sql?.includes('FROM raw_material'));
    assert.match(materialRead.sql, /SELECT \* FROM raw_material/);
    assert.deepEqual(materialRead.params, ['61']);
    const snapshot = h.calls.find(call => call.sql?.startsWith('INSERT INTO stock_request_item'));
    assert.deepEqual(snapshot.params.slice(3,5),[expectedStock===null?null:Number(expectedStock).toFixed(4),expectedShortage===null?null:Number(expectedShortage).toFixed(4)]);
    assert.equal(h.calls.some(call => /^(UPDATE|DELETE)/i.test(call.sql ?? '')), false);
    assert.ok(h.calls.includes('COMMIT'));
  });
}

function processingHarness({ materialFound = true, requestStatus = 'pending' } = {}) {
  const calls=[];
  const connection={async beginTransaction(){calls.push('BEGIN');},async commit(){calls.push('COMMIT');},async rollback(){calls.push('ROLLBACK');},release(){},async execute(sql,params){
    calls.push({sql,params});assert.equal((sql.match(/\?/g)??[]).length,params.length);
    if(sql.includes('FROM user_account'))return [[{userId:'9',roleCode:'warehouse',status:'active',clientId:null,mustChangePassword:0}]];
    if(sql.includes('FROM inquiry WHERE'))return [[{id:'91',clientId:'7',status:'quotation'}]];
    if(sql.includes('SELECT CAST(inquiry_id AS CHAR) id FROM stock_request'))return [[{id:'91'}]];
    if(sql.includes('FROM stock_request WHERE'))return [[{stock_request_id:'501',inquiry_id:'91',status:requestStatus}]];
    if(sql.includes('FROM stock_request_item'))return [[{stock_request_item_id:'601',raw_material_id:'61',qty_requested:'5.0000'}]];
    if(sql.includes('FROM raw_material WHERE'))return [materialFound?[{material_id:'61',uom_id:'1',qty_in_stock:null,quantity_status:'unknown'}]:[]];
    if(sql.startsWith('INSERT INTO stock_responses'))return [{insertId:'701',affectedRows:1}];
    if(sql.startsWith('INSERT')||sql.startsWith('UPDATE'))return [{affectedRows:1,insertId:'1'}];
    throw new Error('Unexpected test SQL');
  }};
  return {calls,service:createStockRequestsService({db:{getConnection:async()=>connection}})};
}
const warehouse={accountType:'employee',roleCode:'warehouse',userId:'9'};
const zeroResponse={status:'updated',reason:'Explicit offline stock count',lines:[{lineId:'601',currentQuantity:0,shortageQuantity:5}],inventoryUpdates:[{materialId:'61',quantityOnHand:0}]};
test('Warehouse can record a verified zero, with explicit material update and audit values',async()=>{
  const h=processingHarness();const result=await h.service.process(warehouse,'501',zeroResponse);
  assert.equal(result.success,true);assert.ok(h.calls.includes('COMMIT'));
  assert.deepEqual(h.calls.find(call=>call.sql?.startsWith('UPDATE raw_material')).params,['0.0000','61']);
  const audit=h.calls.find(call=>call.sql?.startsWith('INSERT INTO audit_event'));
  assert.deepEqual(JSON.parse(audit.params[5]).inventoryUpdates,zeroResponse.inventoryUpdates);
});
test('reviewing records a response without changing material stock',async()=>{
  const h=processingHarness();assert.equal((await h.service.process(warehouse,'501',{status:'responded',lines:zeroResponse.lines})).success,true);
  assert.equal(h.calls.some(call=>call.sql?.startsWith('UPDATE raw_material')),false);
});
test('Warehouse can revise a response without changing material stock', async () => {
  const h = processingHarness({ requestStatus: 'responded' });

  const result = await h.service.process(warehouse, '501', {
    status: 'responded',
    lines: zeroResponse.lines
  });

  assert.equal(result.success, true, result.code);
  assert.ok(h.calls.includes('COMMIT'));
  assert.equal(
    h.calls.some(call => call.sql?.startsWith('UPDATE raw_material')),
    false
  );
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

test('Warehouse manual updates require the referenced active material to remain present', async () => {
  const h = processingHarness({ materialFound: false });
  assert.equal((await h.service.process(warehouse, '501', zeroResponse)).code, 'MATERIAL_NOT_FOUND');
  assert.equal(h.calls.some(call => call.sql?.startsWith('INSERT') || call.sql?.startsWith('UPDATE')), false);
  assert.ok(h.calls.includes('ROLLBACK'));
});

test('Sales and Warehouse see the same latest response without rewriting request snapshots',async()=>{
  const calls=[];const connection={release(){},async execute(sql,params){calls.push({sql,params});
    if(sql.includes('FROM stock_request sr'))return [[{id:'501',reference:'SR-1',orderId:'91',orderReference:'ORD-91',clientReference:'QT-91-R2',status:'updated'}]];
    if(sql.includes('FROM stock_request_item s'))return [[{id:'601',materialId:'61',stockAtRequest:null,shortageAtRequest:null,requiredQuantity:'5.0000',currentQuantity:'0.0000',respondedAt:'2026-11-18'}]];
    if(sql.includes('FROM stock_response_lines srl'))return [[{lineId:'601',currentQuantity:'0.0000',shortageQuantity:'5.0000',respondedAt:'2026-11-18'}]];
    throw new Error('Unexpected test SQL');
  }};
  const service=createStockRequestsService({db:{getConnection:async()=>connection}});
  const sales=await service.list({...warehouse,roleCode:'sales'}),wh=await service.list(warehouse);
  assert.deepEqual(sales,wh);assert.equal(sales.data[0].lines[0].stockAtRequest,null);
  assert.equal(sales.data[0].orderReference,'ORD-91');assert.equal(sales.data[0].clientReference,'QT-91-R2');
  assert.equal(sales.data[0].lines[0].latestResponse.currentQuantity,'0.0000');
  assert.ok(calls.every(call=>call.sql.startsWith('SELECT')));
});
