import test from 'node:test';
import assert from 'node:assert/strict';
import { createInventoryService } from './inventory.service.js';

function observationHarness({ current = {}, failAudit = false } = {}) {
  const calls = [], audits = [];
  const persisted = { id: '61', itemCode: 'RM-TEST-1', name: 'Media', category: null,
    unitCode: 'pcs', sourceUnit: 'pc', quantityOnHand: '10.0000', quantityStatus: 'provisional_sample',
    threshold: '2.0000', thresholdStatus: 'provisional_sample', supplier: null, ...current };
  let staged, stagedAudit;
  const fields = { quantity_on_hand: 'quantityOnHand', quantity_status: 'quantityStatus', reorder_threshold: 'threshold', threshold_status: 'thresholdStatus', name: 'name' };
  const connection = {
    async beginTransaction() { calls.push('BEGIN'); staged = { ...persisted }; },
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT CAST(id AS CHAR)')) return [[{ ...staged }]];
      if (sql.startsWith('UPDATE materials')) {
        const assignments = sql.slice(sql.indexOf(' SET ') + 5, sql.indexOf(',updated_at=' )).split(',');
        assignments.forEach((assignment, index) => {
          assert.match(assignment, /^[a-z_]+=\?$/);
          const field = fields[assignment.slice(0, -2)];
          assert.ok(field, `Unexpected observation field ${assignment}`);
          staged[field] = params[index];
        });
        assert.equal(params.at(-1), '61');
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith('INSERT INTO audit_events')) {
        if (failAudit) throw new Error('Synthetic audit failure');
        stagedAudit = { before: JSON.parse(params[4]), after: JSON.parse(params[5]) };
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Unexpected SQL in observation fixture: ${sql}`);
    },
    async commit() { calls.push('COMMIT'); Object.assign(persisted, staged); if (stagedAudit) audits.push(stagedAudit); },
    async rollback() { calls.push('ROLLBACK'); staged = undefined; stagedAudit = undefined; }, release() {},
  };
  return { service: createInventoryService({ db: { async getConnection() { calls.push('CONNECT_DOUBLE'); return connection; } } }), calls, persisted, audits };
}

for (const scenario of [
  { name: 'changed sample quantity', body: { quantityOnHand: '15' }, expected: { quantityOnHand: '15', quantityStatus: 'verified', thresholdStatus: 'provisional_sample' } },
  { name: 'same sample quantity', body: { quantityOnHand: '10' }, expected: { quantityStatus: 'verified', thresholdStatus: 'provisional_sample' } },
  { name: 'same sample threshold', body: { threshold: '2' }, expected: { quantityStatus: 'provisional_sample', thresholdStatus: 'verified' } },
  { name: 'same sample quantity and threshold', body: { quantityOnHand: '10.0000', threshold: '2.0000' }, expected: { quantityStatus: 'verified', thresholdStatus: 'verified' } },
  { name: 'same sample zero is verified', current: { quantityOnHand: '0.0000' }, body: { quantityOnHand: '0' }, expected: { quantityOnHand: '0', quantityStatus: 'verified', thresholdStatus: 'provisional_sample' } },
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
    const result = await h.service.update({ userId: '9', accountType: 'employee', roleCode: 'warehouse' }, '61', scenario.body);
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
  await assert.rejects(h.service.update({ userId: '9', accountType: 'employee', roleCode: 'admin' }, '61', { quantityOnHand: '10', threshold: '2' }), /Synthetic audit failure/);
  assert.ok(h.calls.some(call => call.sql?.startsWith('UPDATE materials')));
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
  const h = observationHarness();
  assert.equal((await h.service.update({ userId: '9', accountType: 'employee', roleCode: 'admin' }, '61', { quantityStatus: 'verified' })).code, 'VALIDATION_ERROR');
  assert.equal(h.calls.length, 0);
  assert.equal((await h.service.update({ userId: '9', accountType: 'employee', roleCode: 'admin' }, '61', { quantityOnHand: '10' })).data.quantityStatus, 'verified');
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
      if (sql.includes('FROM materials')) return [materialRows, []];
      return [[{ id: '71', itemCode: 'FG-1', enterFilPN: 'PN-1', qtyInStock: null, bufferMin: 1, demand: 'STABLE' }], []];
    },
    release() {},
  };
  return { service: createInventoryService({ db: { getConnection: async () => connection } }), calls };
}

test('inventory read preserves source identity, reference prices, approved prices, unknown, and zero stock', async () => {
  const { service, calls } = listService();
  const result = await service.list({ roleCode: 'warehouse' });
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

test('Sales inventory reads retain approved prices but omit unapproved reference prices', async () => {
  const { service } = listService();
  const result = await service.list({ roleCode: 'sales' });
  assert.equal(result.data.materials[0].referenceUnitPrice, null);
  assert.equal(result.data.materials[0].referencePriceText, null);
  assert.equal(result.data.materials[0].approvedCostingPrice, null);
  assert.equal(result.data.materials[1].approvedCostingPrice, '4.5000');
});

test('material maintenance denies Sales and rejects stock or price writes', async () => {
  let connectionRequested = false;
  const service = createInventoryService({ db: { getConnection: async () => { connectionRequested = true; throw new Error('unexpected'); } } });
  assert.deepEqual(await service.create({ userId: '9', accountType: 'employee', roleCode: 'sales' }, {}), { success: false, code: 'FORBIDDEN' });
  const invalidCreate = await service.create(
    { userId: '9', accountType: 'employee', roleCode: 'warehouse' },
    { name: 'Media', unit: 'kg', quantityOnHand: 5 },
  );
  assert.equal(invalidCreate.code, 'VALIDATION_ERROR');
  assert.ok(invalidCreate.errors.quantityOnHand);
  const invalidUpdate = await service.update(
    { userId: '9', accountType: 'employee', roleCode: 'warehouse' },
    '61',
    { approvedCostingPrice: 1 },
  );
  assert.equal(invalidUpdate.code, 'VALIDATION_ERROR');
  assert.ok(invalidUpdate.errors.approvedCostingPrice);
  assert.equal(connectionRequested, false);
});

test('Warehouse material creation starts with unknown stock, threshold, and costing price', async () => {
  const calls = [];
  const connection = {
    async beginTransaction() {},
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT CAST(id AS CHAR)')) return [[], []];
      if (sql.startsWith('INSERT INTO materials')) return [{ affectedRows: 1, insertId: '82' }, []];
      if (sql.startsWith('INSERT INTO audit_events')) return [{ affectedRows: 1 }, []];
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    async commit() {},
    async rollback() { assert.fail('creation should commit'); },
    release() {},
  };
  const service = createInventoryService({ db: { getConnection: async () => connection } });
  const result = await service.create(
    { userId: '9', accountType: 'employee', roleCode: 'warehouse' },
    { itemCode: 'RM-NEW-1', name: 'New material', category: null, unit: 'BUNDLE' },
    { requestId: 'request-1' },
  );
  assert.equal(result.success, true);
  assert.equal(result.data.qtyInStock, null);
  assert.equal(result.data.threshold, null);
  assert.equal(result.data.approvedCostingPrice, null);
  const insert = calls.find(call => call.sql.startsWith('INSERT INTO materials'));
  assert.match(insert.sql, /unit_price,reference_unit_price,[\s\S]*quantity_on_hand,reorder_threshold/);
  assert.match(insert.sql, /VALUES \(\?,\?,\?,\?,\?,0,NULL,NULL,NULL,\?,\?,TRUE,'unknown',\?\)/);
  assert.deepEqual(insert.params, ['RM-NEW-1', 'New material', null, 'pcs', 'BUNDLE', null, null, 'unknown']);
  assert.equal(calls.find(call => call.sql.startsWith('INSERT INTO audit_events')).params[1], 'inventory.material.created');
  const observedThreshold = await service.create(
    { userId: '9', accountType: 'employee', roleCode: 'warehouse' },
    { name: 'Threshold observation', unit: 'pcs', threshold: '2' },
  );
  assert.equal(observedThreshold.data.thresholdStatus, 'verified');
  assert.equal(observedThreshold.data.quantityStatus, 'unknown');
  const audit = calls.filter(call => call.sql.startsWith('INSERT INTO audit_events')).at(-1);
  assert.equal(JSON.parse(audit.params[4]).thresholdStatus, 'verified');
});

test('Warehouse detail edits can set a threshold to zero but cannot update stock or prices', async () => {
  const calls = [];
  const connection = {
    async beginTransaction() {},
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT CAST(id AS CHAR)')) return [[{
        id: '61', itemCode: 'RM-TEST-1', name: 'Media', category: null, unitCode: 'pcs',
        sourceUnit: 'pc', threshold: null, supplier: null,
      }], []];
      if (sql.startsWith('UPDATE materials')) return [{ affectedRows: 1 }, []];
      if (sql.startsWith('INSERT INTO audit_events')) return [{ affectedRows: 1 }, []];
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    async commit() {},
    async rollback() { assert.fail('update should commit'); },
    release() {},
  };
  const service = createInventoryService({ db: { getConnection: async () => connection } });
  const result = await service.update(
    { userId: '9', accountType: 'employee', roleCode: 'warehouse' },
    '61',
    { unit: 'pc/gal', threshold: '0' },
  );
  assert.equal(result.success, true);
  assert.equal(result.data.unit, 'pc/gal');
  assert.equal(result.data.threshold, '0');
  const update = calls.find(call => call.sql.startsWith('UPDATE materials'));
  assert.match(update.sql, /unit_code=\?,source_unit=\?,reorder_threshold=\?/);
  assert.doesNotMatch(update.sql, /unit_price|quantity_on_hand|approved_costing_price/);
});

test('Warehouse detail edits persist stock quantity and mark it verified', async () => {
  const calls = [];
  const connection = {
    async beginTransaction() {},
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT CAST(id AS CHAR)')) return [[{
        id: '61', itemCode: 'RM-TEST-1', name: 'Media', category: null, unitCode: 'pcs',
        sourceUnit: 'pc', quantityOnHand: '10.0000', quantityStatus: 'provisional_sample',
        threshold: '2.0000', thresholdStatus: 'provisional_sample', supplier: null,
      }], []];
      if (sql.startsWith('UPDATE materials')) return [{ affectedRows: 1 }, []];
      if (sql.startsWith('INSERT INTO audit_events')) return [{ affectedRows: 1 }, []];
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    async commit() {},
    async rollback() { assert.fail('stock update should commit'); },
    release() {},
  };
  const service = createInventoryService({ db: { getConnection: async () => connection } });
  const result = await service.update(
    { userId: '9', accountType: 'employee', roleCode: 'warehouse' },
    '61',
    { quantityOnHand: '37.2500', threshold: '4.5000' },
  );
  assert.equal(result.success, true);
  assert.equal(result.data.quantityOnHand, '37.2500');
  assert.equal(result.data.quantityStatus, 'verified');
  assert.equal(result.data.threshold, '4.5000');
  assert.equal(result.data.thresholdStatus, 'verified');
  const update = calls.find(call => call.sql.startsWith('UPDATE materials'));
  assert.match(update.sql, /reorder_threshold=\?,threshold_status=\?,quantity_on_hand=\?,quantity_status=\?/);
  assert.deepEqual(update.params, ['4.5000', 'verified', '37.2500', 'verified', '61']);
  assert.doesNotMatch(update.sql, /approved_costing_price|unit_price/);
});
