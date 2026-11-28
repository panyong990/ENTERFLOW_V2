import test from 'node:test';
import assert from 'node:assert/strict';
import { createInventoryService } from './inventory.service.js';

function observationHarness({current={},failAudit=false,role='warehouse'}={}){
  const calls=[],audits=[],persisted={id:'61',name:'Media',quantityOnHand:'10.0000',quantityStatus:'provisional_sample',threshold:'2.0000',thresholdStatus:'provisional_sample',supplier:null,...current};let staged,stagedAudit;
  const raw=()=>({material_id:'61',material_name:staged.name,material_category_id:null,uom_id:'1',qty_in_stock:staged.quantityOnHand,quantity_status:staged.quantityStatus,reorder_threshold:staged.threshold,threshold_status:staged.thresholdStatus,supplier_name:staged.supplier,unit_price:null});
  const connection={async beginTransaction(){calls.push('BEGIN');staged={...persisted};},async commit(){calls.push('COMMIT');Object.assign(persisted,staged);if(stagedAudit)audits.push(stagedAudit);},async rollback(){calls.push('ROLLBACK');},release(){},async execute(sql,params=[]){
    calls.push({sql,params});
    if(sql.includes('FROM user_account u JOIN role r'))return [[{userId:'9',roleCode:role,status:'active',clientId:null,mustChangePassword:0}]];
    if(sql.startsWith('SELECT * FROM raw_material'))return [[raw()]];
    if(sql.includes('FROM unit_of_measure'))return [[{uom_id:'1'}]];
    if(sql.startsWith('UPDATE raw_material SET material_name'))Object.assign(staged,{name:params[0],threshold:params[3],thresholdStatus:params[4],supplier:params[5]});
    else if(sql.startsWith('UPDATE raw_material SET qty_in_stock=NULL'))Object.assign(staged,{quantityOnHand:null,quantityStatus:'unknown'});
    else if(sql.startsWith('UPDATE raw_material SET qty_in_stock='))Object.assign(staged,{quantityOnHand:params[0],quantityStatus:'verified'});
    else if(sql.startsWith('INSERT INTO audit_event')){if(failAudit)throw new Error('Synthetic audit failure');stagedAudit={before:JSON.parse(params[4]),after:JSON.parse(params[5])};}
    else if(!sql.startsWith('INSERT INTO stock_movement'))throw new Error('Unhandled offline SQL: '+sql);
    return [{affectedRows:1,insertId:'1'}];
  }};
  return {service:createInventoryService({db:{async getConnection(){calls.push('CONNECT_DOUBLE');return connection;}}}),calls,persisted,audits};
}

for (const scenario of [
  { name: 'changed sample quantity', body: { quantityOnHand: '15' }, expected: { quantityOnHand: '15.0000', quantityStatus: 'verified', thresholdStatus: 'provisional_sample' } },
  { name: 'same sample quantity', body: { quantityOnHand: '10' }, expected: { quantityStatus: 'verified', thresholdStatus: 'provisional_sample' } },
  { name: 'same sample threshold', body: { threshold: '2' }, expected: { quantityStatus: 'provisional_sample', thresholdStatus: 'verified' } },
  { name: 'same sample quantity and threshold', body: { quantityOnHand: '10.0000', threshold: '2.0000' }, expected: { quantityStatus: 'verified', thresholdStatus: 'verified' } },
  { name: 'same sample zero is verified', current: { quantityOnHand: '0.0000' }, body: { quantityOnHand: '0' }, expected: { quantityOnHand: '0.0000', quantityStatus: 'verified', thresholdStatus: 'provisional_sample' } },
  { name: 'sample cleared to unknown', body: { quantityOnHand: null }, expected: { quantityOnHand: null, quantityStatus: 'unknown', thresholdStatus: 'provisional_sample' } },
  { name: 'threshold cleared independently', body: { threshold: null }, expected: { quantityStatus: 'provisional_sample', threshold: null, thresholdStatus: 'unknown' } },
  { name: 'details edit does not verify observations', body: { name: 'Renamed media' }, expected: { name: 'Renamed media', quantityStatus: 'provisional_sample', thresholdStatus: 'provisional_sample' } },
  { name: 'verified unchanged quantity is a no-op', current: { quantityStatus: 'verified' }, body: { quantityOnHand: '10' }, noOp: true },
  { name: 'verified unchanged threshold is a no-op', current: { thresholdStatus: 'verified' }, body: { threshold: '2.0000' }, noOp: true },
  { name: 'unchanged unknown remains unknown', current: { quantityOnHand: null, quantityStatus: 'unknown' }, body: { quantityOnHand: null }, noOp: true },
]) {
  test(`Q02 explicit observation: ${scenario.name}`, async () => {
    const h = observationHarness({ current: scenario.current });
    const before = { ...h.persisted };
    const result = await h.service.update({ userId: '9', accountType: 'employee', roleCode: 'warehouse' }, '61', {...scenario.body,reason:'Explicit offline observation'});
    assert.equal(result.success, true);
    assert.ok(h.calls.includes('COMMIT'));
    if (scenario.noOp) {
      assert.deepEqual(h.persisted, before);
      assert.equal(h.calls.some(call => /^(UPDATE|INSERT)/.test(call.sql ?? '')), false);
      assert.equal(h.audits.length, 0);
    } else {
      for (const [key, value] of Object.entries(scenario.expected)) {
        assert.equal(result.data[key], value);
        assert.equal(h.persisted[key], value);
      }
      assert.equal(h.audits.length, 1);
      assert.equal(h.audits[0].before.quantityStatus, before.quantityStatus);
      assert.equal(h.audits[0].before.thresholdStatus, before.thresholdStatus);
      assert.equal(h.audits[0].after.quantityStatus, h.persisted.quantityStatus);
      assert.equal(h.audits[0].after.thresholdStatus, h.persisted.thresholdStatus);
    }
    assert.equal(h.calls.some(call => /approved_costing_price|material_movements/.test(call.sql ?? '')), false);
  });
}

test('Q02 audit failure rolls back a provenance-only observation in the transaction double', async () => {
  const h = observationHarness({ failAudit: true });
  const before = { ...h.persisted };
  assert.equal((await h.service.update({ userId:'9',accountType:'employee',roleCode:'warehouse'},'61',{quantityOnHand:'10',threshold:'2',reason:'Explicit observation'})).code,'SERVICE_UNAVAILABLE');
  assert.ok(h.calls.some(call => call.sql?.startsWith('UPDATE raw_material')));
  assert.ok(h.calls.includes('ROLLBACK'));
  assert.equal(h.calls.includes('COMMIT'), false);
  assert.deepEqual(h.persisted, before);
  assert.deepEqual(h.audits, []);
});

test('Q02 only authorized maintenance actors can establish an observation; provenance cannot be forged directly', async () => {
  for (const actor of [{ userId: '9', accountType: 'employee', roleCode: 'sales' }, { userId: '9', accountType: 'client', roleCode: 'warehouse' }]) {
    const h = observationHarness();
    assert.equal((await h.service.update(actor, '61', { quantityOnHand: '10' })).code, 'FORBIDDEN');
    assert.equal(h.calls.length, 0);
  }
  const h = observationHarness({role:'admin'});
  assert.equal((await h.service.update({ userId: '9', accountType: 'employee', roleCode: 'admin' }, '61', { quantityStatus: 'verified' })).code, 'VALIDATION_ERROR');
  assert.equal(h.calls.length, 0);
  assert.equal((await h.service.update({ userId: '9', accountType: 'employee', roleCode: 'admin' }, '61', { quantityOnHand: '10',reason:'Explicit observation' })).data.quantityStatus, 'verified');
});

const materialRows = [
  {
    id: '61', itemCode: 'RM-TEST-1', name: 'Media', category: null, unit: 'pc',
    referenceUnitPrice: '10.0000', referencePriceText: '10.00',
    referencePriceSource: 'client.pdf', referencePriceStatus: 'unreviewed',
    approvedCostingPrice: null, qtyInStock: null, threshold: null, supplier: null,
  },
  {
    id: '62', itemCode: 'RM-TEST-2', name: 'Adhesive', category: 'bonding_adhesive', unit: 'kg',
    referenceUnitPrice: '5.0000', referencePriceText: '5.00',
    referencePriceSource: 'client.pdf', referencePriceStatus: 'unreviewed',
    approvedCostingPrice: '4.5000', qtyInStock: '0.0000', threshold: '2', supplier: 'Supplier',
  },
];

function listService() {
  const calls = [];
  const connection = {
    async execute(sql) {
      calls.push(sql);
      if (sql.includes('FROM raw_material')) return [materialRows, []];
      return [[{ id: '71', itemCode: 'FG-1', enterFilPN: 'PN-1', qtyInStock: null, bufferMin: 1, demand: 'STABLE' }], []];
    },
    release() {},
  };
  return { service: createInventoryService({ db: { getConnection: async () => connection } }), calls };
}

test('inventory read preserves source identity, reference prices, approved prices, unknown, and zero stock', async () => {
  const { service, calls } = listService();
  const result = await service.list({userId:'9',accountType:'employee',roleCode:'warehouse'});
  assert.equal(result.success, true);
  assert.equal(result.data.materials[0].itemCode, 'RM-TEST-1');
  assert.equal(result.data.materials[0].referenceUnitPrice, '10.0000');
  assert.equal(result.data.materials[0].approvedCostingPrice, null);
  assert.equal(result.data.materials[0].qtyInStock, null);
  assert.equal(result.data.materials[1].approvedCostingPrice, '4.5000');
  assert.equal(result.data.materials[1].qtyInStock, '0.0000');
  assert.equal(result.data.finishedGoods[0].itemCode, 'FG-1');
  assert.equal(calls.length, 2);
});

test('Sales inventory reads distinguish reference prices from approved costing prices', async () => {
  const { service } = listService();
  const result = await service.list({userId:'9',accountType:'employee',roleCode:'sales'});
  assert.equal(result.data.materials[0].referenceUnitPrice, '10.0000');
  assert.equal(result.data.materials[0].referencePriceText, null);
  assert.equal(result.data.materials[0].approvedCostingPrice, null);
  assert.equal(result.data.materials[1].approvedCostingPrice, '4.5000');
});

test('material maintenance denies Sales and rejects malformed quantities or approved-price writes', async () => {
  let connectionRequested = false;
  const service = createInventoryService({ db: { getConnection: async () => { connectionRequested = true; throw new Error('unexpected'); } } });
  assert.deepEqual(await service.create({ userId: '9', accountType: 'employee', roleCode: 'sales' }, {}), { success: false, code: 'FORBIDDEN' });
  const invalidCreate = await service.create(
    { userId: '9', accountType: 'employee', roleCode: 'warehouse' },
    { name: 'Media', unit: 'kg', quantityOnHand: 'invalid' },
  );
  assert.equal(invalidCreate.code, 'VALIDATION_ERROR');
  assert.equal(connectionRequested,false);
  const invalidUpdate = await service.update(
    { userId: '9', accountType: 'employee', roleCode: 'warehouse' },
    '61',
    { approvedCostingPrice: 1 },
  );
  assert.equal(invalidUpdate.code, 'VALIDATION_ERROR');
  assert.equal(connectionRequested,false);
  assert.equal(connectionRequested, false);
});

test('Warehouse material creation uses a configured unit and leaves stock and prices unknown',async()=>{
 const calls=[],c={async beginTransaction(){},async commit(){},async rollback(){},release(){},async execute(sql,p){calls.push({sql,p});if(sql.includes('FROM user_account'))return [[{userId:'9',roleCode:'warehouse',status:'active',clientId:null,mustChangePassword:0}]];if(sql.includes('FROM unit_of_measure'))return [[{uom_id:'1'}]];return [{affectedRows:1,insertId:'82'}];}};
 const s=createInventoryService({db:{getConnection:async()=>c}}),a={userId:'9',accountType:'employee',roleCode:'warehouse'};
 const value=await s.create(a,{name:'Explicit test fixture',uomId:'1'});assert.equal(value.success,true);assert.equal(value.data.quantityOnHand,null);assert.equal(value.data.quantityStatus,'unknown');assert.equal(value.data.approvedCostingPrice,null);assert.equal(value.data.threshold,null);
 const insert=calls.find(c=>c.sql.startsWith('INSERT INTO raw_material'));assert.deepEqual(insert.p,['Explicit test fixture',null,'1',null,'unknown',null,null]);assert.doesNotMatch(insert.sql,/\bunit_price\b|qty_in_stock/);
 const threshold=await s.create(a,{name:'Observed threshold',uomId:'1',threshold:'2'});assert.equal(threshold.data.thresholdStatus,'verified');assert.equal(threshold.data.quantityStatus,'unknown');
});
test('Warehouse threshold zero preserves sample quantity and never changes costing prices',async()=>{const h=observationHarness();const value=await h.service.update({userId:'9',accountType:'employee',roleCode:'warehouse'},'61',{threshold:'0'});assert.equal(value.data.threshold,'0.0000');assert.equal(value.data.quantityStatus,'provisional_sample');assert(h.calls.filter(c=>c.sql?.startsWith('UPDATE')).every(c=>!/\bunit_price\b|qty_in_stock/.test(c.sql)));});
test('Warehouse quantity observation appends movement and records before/after provenance',async()=>{const h=observationHarness();const value=await h.service.update({userId:'9',accountType:'employee',roleCode:'warehouse'},'61',{quantityOnHand:'37.2500',threshold:'4.5000',reason:'Explicit count'});assert.equal(value.data.quantityStatus,'verified');assert.equal(value.data.quantityOnHand,'37.2500');assert.equal(value.data.thresholdStatus,'verified');const ledger=h.calls.find(c=>c.sql?.startsWith('INSERT INTO stock_movement'));assert.equal(ledger.params[2],'provisional_sample');assert.equal(ledger.params[3],null);assert.equal(ledger.params[5],null);assert.equal(h.audits[0].before.quantityStatus,'provisional_sample');assert.equal(h.audits[0].after.quantityStatus,'verified');});
