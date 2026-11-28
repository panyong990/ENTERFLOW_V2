import test from 'node:test';
import assert from 'node:assert/strict';

import {
  loadReadyForDispatch,
  loadWaybillActivity,
  mergeRecentActivity
} from './warehouse-dashboard-dispatch.js';

test('Dispatch eligibility follows JO status and print state', async () => {
  await loadReadyForDispatch({}, async (connection, sql) => {
    assert.match(sql, /j\.status = 'ready_for_dispatch'/);
    assert.match(sql, /j\.archived_at IS NULL/);
    assert.match(sql, /NOT EXISTS/);
    assert.match(sql, /w\.printed_at IS NOT NULL/);
    assert.doesNotMatch(sql, /scan_verified/);
    return [];
  });
});

test('Dispatch count is calculated before preview limitation', async () => {
  const result = await loadReadyForDispatch(
    {},
    async (connection, sql) => {
      assert.match(sql, /COUNT\(\*\) OVER\(\)/);
      assert.ok(
        sql.indexOf('COUNT(*) OVER()') <
        sql.indexOf('LIMIT 6')
      );

      return Array.from({ length: 6 }, (_, index) => ({
        id: String(index + 1),
        total: '21',
        status: 'ready_for_dispatch',
        totalQuantity: '10'
      }));
    }
  );

  assert.equal(result.total, '21');
  assert.equal(result.items.length, 6);
  assert.equal('total' in result.items[0], false);
});

test('No eligible job orders returns genuine zero', async () => {
  assert.deepEqual(
    await loadReadyForDispatch({}, async () => []),
    { total: '0', items: [] }
  );
});

test('Unresolved client and product quantities remain null', async () => {
  const result = await loadReadyForDispatch(
    {},
    async () => [{
      id: '1',
      total: '1',
      client: null,
      product: null,
      totalQuantity: null
    }]
  );

  assert.equal(result.items[0].client, null);
  assert.equal(result.items[0].totalQuantity, null);
});

test('Waybill activity uses an explicit event allowlist', async () => {
  const result = await loadWaybillActivity(
    {},
    async (connection, sql) => {
      assert.match(sql, /waybill\.printed/);
      assert.match(sql, /waybill\.scan_verified/);
      assert.match(sql, /LIMIT 6/);
      assert.doesNotMatch(sql, /qr_identifier/);
      assert.doesNotMatch(sql, /after_value/);

      return [{
        id: '9',
        kind: 'verified',
        date: '2026-11-28 10:00:00',
        joNumber: 'JO-001',
        waybillNumber: 'WB-001',
        actorId: '12'
      }];
    }
  );

  assert.equal(result[0].title, 'Waybill QR verified');
  assert.equal(result[0].subject, 'JO-001');
});

test('Historical print fallback does not invent an employee', async () => {
  const result = await loadWaybillActivity(
    {},
    async () => [{
      id: '9',
      kind: 'printed-record',
      actorId: null
    }]
  );

  assert.equal(result[0].actorId, null);
  assert.equal(result[0].title, 'Waybill printed');
});

test('Recent activity merges sources and retains latest six', () => {
  const events = Array.from({ length: 8 }, (_, index) => ({
    id: String(index),
    date: `2026-11-28T0${index}:00:00Z`
  }));

  const result = mergeRecentActivity(
    events.slice(0, 4),
    events.slice(4),
    [{ id: 'invalid', date: 'not-a-date' }]
  );

  assert.equal(result.length, 6);
  assert.equal(result[0].id, '7');
  assert.equal(result.at(-1).id, '2');
});

test('Activity sorting handles SQL UTC dates and ISO dates', () => {
  const result = mergeRecentActivity([
    { id: '1', date: '2026-11-28 08:00:00' },
    { id: '2', date: '2026-11-28T09:00:00Z' }
  ]);

  assert.equal(result[0].id, '2');
});
