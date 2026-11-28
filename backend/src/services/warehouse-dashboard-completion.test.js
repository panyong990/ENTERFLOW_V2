import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { resolveFinishedGoodsOEM } from './finished-goods-oem.js';
import { assembleOrderHistory } from './finished-goods-read.service.js';
import { loadJOHandoverActivity } from './warehouse-dashboard-dispatch.js';
import { createWarehouseRouter } from '../routes/warehouse.routes.js';

test('Dedicated OEM is preserved', () => {
  assert.equal(resolveFinishedGoodsOEM(' PN-001 ', null), 'PN-001');
});

test('OEM is recovered from stored JSON', () => {
  assert.equal(
    resolveFinishedGoodsOEM(null, '{"oem_part_number":"PN-002"}'),
    'PN-002'
  );
});

test('Equivalent OEM references agree', () => {
  assert.equal(
    resolveFinishedGoodsOEM('PN-001', { oem: ' pn-001 ' }),
    'PN-001'
  );
});

test('Conflicting OEM references are rejected', () => {
  assert.throws(
    () => resolveFinishedGoodsOEM(
      'PN-001', { oem_part_number: 'PN-002' }
    ),
    /Conflicting/
  );
});

test('Unknown OEM remains null', () => {
  assert.equal(resolveFinishedGoodsOEM(null, {}), null);
});

test('Malformed specifications are rejected', () => {
  assert.throws(
    () => resolveFinishedGoodsOEM(null, '{invalid')
  );
});

test('Order assembler recovers JSON OEM', () => {
  const orders = assembleOrderHistory([{
    orderId: '1',
    clientId: '2',
    lineId: '3',
    filterTypeId: '4',
    status: 'inquiry',
    oem: null,
    specifications: { oem: 'PN-001' }
  }]);

  assert.equal(orders[0].products[0].oem, 'PN-001');
});

test('JO activity uses recorded production completion', async () => {
  const result = await loadJOHandoverActivity(
    {},
    async (connection, sql) => {
      assert.match(sql, /j\.completed_at IS NOT NULL/);
      assert.match(sql, /j\.archived_at IS NULL/);
      assert.match(sql, /js\.marked_by_user_id/);
      assert.match(sql, /LIMIT 6/);

      return [{
        id: '1',
        joNumber: 'JO-TEST',
        product: 'Test Filter',
        actorId: '9',
        date: '2026-11-28T09:00:00Z'
      }];
    }
  );

  assert.equal(result[0].title, 'Job order handed over to Warehouse');
  assert.equal(result[0].actorId, '9');
});

const token = 'd'.repeat(64);

async function harness(t, {
  role = 'warehouse',
  deniedResource = '',
  serviceUnavailable = false
} = {}) {
  const calls = [];

  const service = {
    async getDashboard(actor) {
      calls.push(['dashboard', actor]);

      return serviceUnavailable
        ? { success: false, code: 'SERVICE_UNAVAILABLE' }
        : { success: true, data: { trackedRawMaterialItems: 1 } };
    },

    async listFinishedGoods(actor, query) {
      calls.push(['finishedGoods', actor, query]);

      return query.month === '99'
        ? { success: false, code: 'VALIDATION_ERROR' }
        : { success: true, data: { items: [] } };
    }
  };

  const app = express();

  app.use('/api/warehouse', createWarehouseRouter({
    service,

    validateSessionService: async value =>
      value === token
        ? {
            userId: '9',
            sessionId: 's',
            active: 1,
            roleCode: role,
            accountType: 'employee',
            displayName: 'Warehouse'
          }
        : null,

    updateSessionActivityService: async value =>
      value === token,

    permissionChecker: (roleCode, resource, action) =>
      roleCode === 'warehouse' &&
      action === 'read' &&
      resource !== deniedResource
  }));

  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(
      0, '127.0.0.1', () => resolve(instance)
    );

    instance.once('error', reject);
  });

  t.after(() => new Promise(resolve => server.close(resolve)));

  return {
    calls,
    request: (path, authenticated = true) =>
      fetch(
        `http://127.0.0.1:${server.address().port}/api/warehouse${path}`,
        {
          headers: authenticated
            ? { Cookie: `enterflow_session=${token}` }
            : {}
        }
      )
  };
}

test('Both endpoints require authentication', async t => {
  const h = await harness(t);

  for (const path of ['/dashboard', '/finished-goods']) {
    assert.equal((await h.request(path, false)).status, 401);
  }

  assert.equal(h.calls.length, 0);
});

test('Non-Warehouse roles are denied', async t => {
  const h = await harness(t, { role: 'sales' });

  for (const path of ['/dashboard', '/finished-goods']) {
    assert.equal((await h.request(path)).status, 403);
  }

  assert.equal(h.calls.length, 0);
});

test('Both endpoints require inventory read permission', async t => {
  const h = await harness(t, { deniedResource: 'inventory' });

  for (const path of ['/dashboard', '/finished-goods']) {
    assert.equal((await h.request(path)).status, 403);
  }

  assert.equal(h.calls.length, 0);
});

test('Dashboard requires additional read permissions', async t => {
  for (const resource of ['production', 'deliveries', 'waybills']) {
    const h = await harness(t, { deniedResource: resource });
    assert.equal((await h.request('/dashboard')).status, 403);
    assert.equal(h.calls.length, 0);
  }
});

test('Authorized responses are not cacheable', async t => {
  const h = await harness(t);

  for (const path of ['/dashboard', '/finished-goods']) {
    const response = await h.request(path);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).success, true);
  }
});

test('Invalid filters return HTTP 400', async t => {
  const h = await harness(t);
  assert.equal(
    (await h.request('/finished-goods?month=99')).status, 400
  );
});

test('Unavailable dashboard returns HTTP 503', async t => {
  const h = await harness(t, { serviceUnavailable: true });
  const response = await h.request('/dashboard');

  assert.equal(response.status, 503);
  assert.equal((await response.json()).success, false);
});
