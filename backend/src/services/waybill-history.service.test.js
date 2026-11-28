import test from 'node:test';
import assert from 'node:assert/strict';
import { createWaybillHistoryService } from './waybill-history.service.js';

const actor = {
  userId: '3',
  accountType: 'employee',
  roleCode: 'warehouse'
};

const record = (id, deliveryId) => ({
  id,
  deliveryId,
  waybillNo: `WB-${id}`,
  verifiedAt: new Date('2026-11-26T08:15:00.000Z'),
  jo: 'JO-TEST',
  client: 'Synthetic Test Client',
  method: 'Delivery',
  po: 'PO-TEST',
  si: null,
  contact: 'Test Contact',
  processedBy: 'Test Employee'
});

function setup(responses = []) {
  const calls = [];
  let connections = 0;
  let releases = 0;

  const db = {
    async getConnection() {
      connections++;

      return {
        async execute(sql, params) {
          calls.push({ sql, params });

          assert.match(sql.trim(), /^SELECT\b/i);

          if (!responses.length) {
            throw new Error('Unexpected query');
          }

          const result = responses.shift();

          if (result instanceof Error) throw result;

          return [result];
        },

        release() {
          releases++;
        }
      };
    }
  };

  return {
    service: createWaybillHistoryService({ db }),
    calls,
    connections: () => connections,
    releases: () => releases
  };
}

test('History rejects unauthorized actors before database access', async () => {
  const h = setup();

  for (const invalid of [
    null,
    { ...actor, roleCode: 'sales' },
    { ...actor, roleCode: 'logistics' },
    { ...actor, roleCode: 'owner' },
    { ...actor, accountType: 'client' },
    { ...actor, userId: 'invalid' }
  ]) {
    const result = await h.service.listWaybillHistory(invalid);

    assert.equal(result.success, false);
    assert.equal(result.code, 'FORBIDDEN');
  }

  assert.equal(h.connections(), 0);
});

test('History rejects malformed and unsupported query parameters', async () => {
  const h = setup();

  for (const query of [
    { page: '0' },
    { pageSize: '101' },
    { page: ['1', '2'] },
    { q: 'x'.repeat(201) },
    { q: ['invalid'] },
    { status: 'printed' },
    { from: '2026-11-26' },
    {
      from: '2026-11-27T00:00:00.000Z',
      to: '2026-11-26T00:00:00.000Z'
    }
  ]) {
    const result = await h.service.listWaybillHistory(actor, query);

    assert.equal(result.success, false);
    assert.equal(result.code, 'VALIDATION_ERROR');
  }

  assert.equal(h.connections(), 0);
});

test('History SQL requires successful scan evidence and selects the first verification', async () => {
  const h = setup([[]]);

  const result = await h.service.listWaybillHistory(actor);

  assert.equal(result.success, true);

  const sql = h.calls[0].sql;

  assert.match(sql, /first_scan\.subject_type='waybill'/);
  assert.match(sql, /first_scan\.subject_id=w\.waybill_id/);
  assert.match(sql, /first_scan\.action='waybill\.scan_verified'/);
  assert.match(sql, /first_scan\.occurred_at ASC/);
  assert.match(sql, /first_scan\.audit_event_id ASC/);
  assert.match(sql, /ORDER BY a\.occurred_at DESC/);
  assert.doesNotMatch(sql, /qr_identifier|password_hash|after_value/i);

  assert.deepEqual(result.data.items, []);
  assert.equal(result.data.hasMore, false);
  assert.equal(h.releases(), 1);
});

test('History uses parameterized search, dates and bounded pagination', async () => {
  const h = setup([[]]);
  const search = "WB-' OR 1=1 --";

  const result = await h.service.listWaybillHistory(actor, {
    q: search,
    page: '2',
    pageSize: '25',
    from: '2026-11-25T16:00:00.000Z',
    to: '2026-11-26T16:00:00.000Z'
  });

  assert.equal(result.success, true);

  const { sql, params } = h.calls[0];

  assert.ok(!sql.includes(search));
  assert.match(sql, /a\.occurred_at >= \? AND a\.occurred_at < \?/);
  assert.match(sql, /LIMIT \? OFFSET \?/);
  assert.match(sql, /sji\.jo_id=d\.jo_id/);

  assert.deepEqual(params, [
    search, search, search, search,
    '2026-11-25 16:00:00.000',
    '2026-11-26 16:00:00.000',
    '26',
    '25'
  ]);

  assert.equal(result.data.page, 2);
});

test('Split shipments retain their own item quantities', async () => {
  const h = setup([
    [record('8', '101'), record('9', '102')],
    [
      { deliveryId: '101', name: 'Filter A', quantity: '2' },
      { deliveryId: '101', name: 'Filter B', quantity: '1' },
      { deliveryId: '102', name: 'Filter A', quantity: '4' }
    ]
  ]);

  const result = await h.service.listWaybillHistory(actor);

  assert.equal(result.success, true);

  const [a, b] = result.data.items;

  assert.deepEqual(a.waybillItems, [
    { name: 'Filter A', quantity: '2' },
    { name: 'Filter B', quantity: '1' }
  ]);

  assert.deepEqual(b.waybillItems, [
    { name: 'Filter A', quantity: '4' }
  ]);

  assert.match(h.calls[1].sql, /ji\.jo_id=d\.jo_id/);
  assert.deepEqual(h.calls[1].params, ['101', '102']);
  assert.equal(h.releases(), 1);
});

test('History pagination does not expose the lookahead record', async () => {
  const h = setup([
    [record('8', '101'), record('9', '102')],
    [{ deliveryId: '101', name: 'Filter A', quantity: '1' }]
  ]);

  const result = await h.service.listWaybillHistory(actor, {
    page: '1',
    pageSize: '1'
  });

  assert.equal(result.success, true);
  assert.equal(result.data.hasMore, true);
  assert.equal(result.data.items.length, 1);
  assert.equal(result.data.items[0].id, '8');
  assert.deepEqual(h.calls[1].params, ['101']);
});

test('Database failures return a safe response and release the connection', async () => {
  const h = setup([new Error('Private database failure')]);

  const result = await h.service.listWaybillHistory(actor);

  assert.equal(result.success, false);
  assert.equal(result.code, 'SERVICE_UNAVAILABLE');
  assert.ok(!JSON.stringify(result).includes('Private database failure'));
  assert.equal(h.releases(), 1);
});
