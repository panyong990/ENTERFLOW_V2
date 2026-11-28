import test from 'node:test';
import assert from 'node:assert/strict';

import {
  readWarehouseSnapshot,
  loadWarehouseStock,
  loadInventoryActivity,
  createWarehouseDashboardReadService
} from './warehouse-dashboard-read.service.js';

function mockDatabase() {
  const calls = [];

  const connection = {
    async query(sql) {
      calls.push(sql);
    },
    async rollback() {
      calls.push('rollback');
    },
    release() {
      calls.push('release');
    },
    destroy() {
      calls.push('destroy');
    }
  };

  const db = {
    async getConnection() {
      calls.push('getConnection');
      return connection;
    }
  };

  return { db, connection, calls };
}

const warehouse = {
  accountType: 'employee',
  roleCode: 'warehouse'
};

const material = {
  id: '1',
  name: 'Test Material',
  qtyInStock: '5',
  quantityStatus: 'verified',
  threshold: '10',
  thresholdStatus: 'verified',
  unit: 'kg'
};

const movement = {
  id: '9',
  itemType: 'raw_material',
  subject: 'Test Material',
  oldQty: null,
  newQty: '5.0000',
  quantityStatusBefore: 'unknown',
  reason: 'Physical count',
  unit: 'kg',
  actorId: '12',
  date: '2026-11-28T01:00:00.000Z'
};

test('Snapshot uses read-only repeatable-read transaction', async () => {
  const { db, calls } = mockDatabase();

  const value = await readWarehouseSnapshot(
    db,
    async () => 'result'
  );

  assert.equal(value, 'result');

  assert.deepEqual(calls, [
    'getConnection',
    'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ',
    'START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY',
    'rollback',
    'release'
  ]);
});

test('Snapshot failure rolls back and releases connection', async () => {
  const { db, calls } = mockDatabase();

  await assert.rejects(
    readWarehouseSnapshot(db, async () => {
      throw new Error('Query failed');
    }),
    /Query failed/
  );

  assert.deepEqual(calls.slice(-2), [
    'rollback', 'release'
  ]);
});

test('Failed transaction setup discards connection', async () => {
  const { db, connection, calls } = mockDatabase();

  connection.query = async () => {
    throw new Error('Setup failed');
  };

  await assert.rejects(
    readWarehouseSnapshot(db, async () => null)
  );

  assert.equal(calls.at(-1), 'destroy');
  assert.equal(calls.includes('release'), false);
});

test('Rollback failure discards connection', async () => {
  const { db, connection, calls } = mockDatabase();

  connection.rollback = async () => {
    throw new Error('Rollback failed');
  };

  await assert.rejects(
    readWarehouseSnapshot(db, async () => null)
  );

  assert.equal(calls.at(-1), 'destroy');
  assert.equal(calls.includes('release'), false);
});

test('Stock loader uses existing active inventory records', async () => {
  const calls = [];

  const result = await loadWarehouseStock(
    {},
    async (connection, sql) => {
      assert.match(sql.trim(), /^SELECT\b/i);
      assert.match(sql, /is_active = 1/);

      calls.push(sql);

      if (sql.includes('FROM raw_material')) {
        return [material];
      }

      return [{
        qtyInStock: '15',
        quantityStatus: 'verified'
      }];
    }
  );

  assert.equal(calls.length, 2);
  assert.equal(result.trackedRawMaterialItems, 1);
  assert.equal(result.lowStock.confirmedItems, 1);
  assert.equal(result.finishedGoods.totalQuantity, '15');
});

test('Inventory activity preserves unknown previous quantity', async () => {
  const activity = await loadInventoryActivity(
    {},
    async (connection, sql) => {
      assert.match(sql.trim(), /^SELECT\b/i);
      assert.match(sql, /LIMIT 6/);
      assert.match(sql, /ORDER BY s.created_at DESC/);

      return [movement];
    }
  );

  assert.equal(activity[0].oldQty, null);
  assert.equal(activity[0].newQty, '5.0000');
  assert.equal(activity[0].actorId, '12');
  assert.equal(
    activity[0].title,
    'Raw material stock updated'
  );
});

test('Finished goods activity uses pieces', async () => {
  const activity = await loadInventoryActivity(
    {},
    async () => [{
      ...movement,
      itemType: 'finished_good',
      unit: 'pcs'
    }]
  );

  assert.equal(activity[0].unit, 'pcs');

  assert.equal(
    activity[0].title,
    'Finished goods stock updated'
  );
});

test('Unauthorized actors cannot access dashboard data', async () => {
  const service = createWarehouseDashboardReadService({
    db: null
  });

  for (const actor of [
    null,
    { accountType: 'client', roleCode: 'warehouse' },
    { accountType: 'employee', roleCode: 'sales' },
    { accountType: 'employee', roleCode: 'admin' }
  ]) {
    assert.deepEqual(
      await service.getDashboard(actor),
      { success: false, code: 'FORBIDDEN' }
    );
  }
});

test('Dashboard stock and activity share one snapshot', async () => {
  const { db, connection, calls } = mockDatabase();

  const service = createWarehouseDashboardReadService({
    db,
    queryRows: async (conn, sql) => {
      assert.equal(conn, connection);

      if (sql.includes('FROM raw_material')) {
        return [material];
      }

      if (sql.includes('FROM stock_movement')) {
        return [movement];
      }

      return [];
    }
  });

  const result = await service.getDashboard(warehouse);

  assert.equal(result.success, true);
  assert.equal(result.data.trackedRawMaterialItems, 1);
  assert.equal(result.data.inventoryActivity.length, 1);

  assert.equal(
    calls.filter(call => call === 'getConnection').length,
    1
  );
});

test('Failed database query is unavailable, not empty inventory', async () => {
  const { db } = mockDatabase();

  const service = createWarehouseDashboardReadService({
    db,
    queryRows: async () => {
      throw new Error('Database unavailable');
    }
  });

  const result = await service.getDashboard(warehouse);

  assert.equal(result.success, false);
  assert.equal(result.code, 'SERVICE_UNAVAILABLE');
});
