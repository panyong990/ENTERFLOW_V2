import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createWarehouseMaterialHistoryService
} from './warehouse-material-history.service.js';

const warehouse = {
  accountType: 'employee',
  roleCode: 'warehouse',
  userId: '1'
};

const opening = {
  id: '1',
  date: '2026-11-28T10:23:40.647Z',
  actorId: '1',
  employee: 'Waybill Test Warehouse',
  quantityStatusBefore: 'unknown',
  oldQty: null,
  newQty: '100.0000',
  change: null,
  unit: 'roll',
  reason: 'Synthetic opening stock observation',
  reference: null,
  jobOrder: null
};

function setup({
  exists = true,
  movements = [opening],
  fail = false
} = {}) {
  const calls = [];

  async function run(sql, params = []) {
    calls.push({ sql, params });

    if (/^(SET|START)\b/.test(sql.trim())) {
      return [[], []];
    }

    if (fail) throw new Error('Test database unavailable');

    if (sql.includes('FROM raw_material')) {
      return [
        exists ? [{ id: '1', name: 'WHIT Test Filter Media' }] : [],
        []
      ];
    }

    if (sql.includes('FROM stock_movement')) {
      return [movements, []];
    }

    throw new Error('Unexpected test SQL');
  }

  const service = createWarehouseMaterialHistoryService({
    db: {
      async getConnection() {
        calls.push({ operation: 'connect' });

        return {
          query: run,
          execute: run,
          async rollback() {
            calls.push({ operation: 'rollback' });
          },
          release() {
            calls.push({ operation: 'release' });
          },
          destroy() {
            calls.push({ operation: 'destroy' });
          }
        };
      }
    }
  });

  return { service, calls };
}

test('opening observation preserves unknown previous quantity', async () => {
  const { service, calls } = setup();

  const result = await service.list(warehouse, '1');

  assert.equal(result.success, true);
  assert.deepEqual(result.data.items, [opening]);
  assert.equal(result.data.hasMore, false);

  const query = calls.find(c => c.sql?.includes('FROM stock_movement'));

  assert.deepEqual(query.params, ['1', 51, 0]);
  assert.match(query.sql, /ORDER BY sm.created_at DESC, sm.movement_id DESC/);
  assert.ok(calls.some(c => c.operation === 'rollback'));
  assert.ok(calls.some(c => c.operation === 'release'));
});

test('non-Warehouse actors cannot access movement history', async () => {
  const { service, calls } = setup();

  for (const roleCode of ['sales', 'admin', 'operations']) {
    const result = await service.list({ ...warehouse, roleCode }, '1');

    assert.equal(result.code, 'FORBIDDEN');
  }

  assert.equal(calls.length, 0);
});

test('invalid material IDs and pagination are rejected', async () => {
  const { service, calls } = setup();

  for (const value of ['0', '-1', 'abc', '18446744073709551616']) {
    assert.equal(
      (await service.list(warehouse, value)).code,
      'VALIDATION_ERROR'
    );
  }

  for (const query of [{page: '0'}, {page: '10001'}, {q: 'bad'}]) {
    assert.equal(
      (await service.list(warehouse, '1', query)).code,
      'VALIDATION_ERROR'
    );
  }

  assert.equal(calls.length, 0);
});

test('missing material is distinct from empty history', async () => {
  const missing = setup({ exists: false });
  const empty = setup({ movements: [] });

  assert.equal(
    (await missing.service.list(warehouse, '1')).code,
    'NOT_FOUND'
  );

  const result = await empty.service.list(warehouse, '1');

  assert.equal(result.success, true);
  assert.deepEqual(result.data.items, []);
});

test('history is limited to 50 records per page', async () => {
  const movements = Array.from({ length: 51 }, (_, index) => ({
    ...opening,
    id: String(index + 1)
  }));

  const { service, calls } = setup({ movements });

  const result = await service.list(warehouse, '1', { page: '2' });

  assert.equal(result.success, true);
  assert.equal(result.data.items.length, 50);
  assert.equal(result.data.page, 2);
  assert.equal(result.data.hasMore, true);

  const query = calls.find(c => c.sql?.includes('FROM stock_movement'));

  assert.deepEqual(query.params, ['1', 51, 50]);
});

test('database failures are not returned as empty history', async () => {
  const { service, calls } = setup({ fail: true });

  const result = await service.list(warehouse, '1');

  assert.equal(result.success, false);
  assert.ok(calls.some(c => c.operation === 'rollback'));
  assert.ok(calls.some(c => c.operation === 'release'));
});