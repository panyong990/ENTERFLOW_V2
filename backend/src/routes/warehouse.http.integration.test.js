import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createWarehouseRouter } from './warehouse.routes.js';

const token = 'd'.repeat(64);

async function harness(t, { role = 'warehouse', allowed = true, waybillAllowed = true } = {}) {
  const calls = [];
  const service = {
    async listShipments(actor, query) { calls.push(['list', actor, query]); return { success: true, data: [{ id: '41', status: 'pending' }] }; },
    async listWaybillHistory(actor, query) {
      calls.push(['history', actor, query]);
      return {
        success: true,
        data: {
          items: [{ id: '6', waybillNo: 'WB-TEST' }],
          page: 1,
          pageSize: 25,
          hasMore: false
        }
      };
    },
    async getShipment(actor, id) { calls.push(['detail', actor, id]); return { success: true, data: { id, waybills: [], deliveryReceipts: [] } }; }
  };
  const app = express();
  app.use('/api/warehouse', createWarehouseRouter({
    service,
    validateSessionService: async value => value === token
      ? { userId: '9', sessionId: 's', active: 1, roleCode: role, accountType: 'employee', displayName: 'Warehouse' }
      : null,
    updateSessionActivityService: async value => value === token,
    permissionChecker: (roleCode, resource, action) =>
      allowed && roleCode === 'warehouse' && ['deliveries', 'waybills'].includes(resource) && action === 'read' && (resource !== 'waybills' || waybillAllowed)
  }));
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/warehouse`;
  return {
    calls,
    request: (path, authenticated = true) => fetch(`${base}${path}`, {
      headers: authenticated ? { Cookie: `enterflow_session=${token}` } : {}
    })
  };
}

test('Warehouse shipment routes require authentication, Warehouse role, and deliveries read permission', async t => {
  const unauthenticated = await harness(t);
  assert.equal((await unauthenticated.request('/shipments', false)).status, 401);
  assert.equal(unauthenticated.calls.length, 0);
  const wrongRole = await harness(t, { role: 'logistics' });
  assert.equal((await wrongRole.request('/shipments')).status, 403);
  assert.equal(wrongRole.calls.length, 0);
  const denied = await harness(t, { allowed: false });
  assert.equal((await denied.request('/shipments')).status, 403);
  assert.equal(denied.calls.length, 0);
});

test('Warehouse can list and retrieve shipment metadata', async t => {
  const h = await harness(t);
  assert.equal((await h.request('/shipments?status=pending&limit=25')).status, 200);
  assert.equal((await h.request('/shipments/41')).status, 200);
  assert.deepEqual(h.calls.map(call => call[0]), ['list', 'detail']);
  assert.equal(h.calls[0][2].status, 'pending');
  assert.equal(h.calls[1][2], '41');
});

test('Waybill-bearing detail requires its existing waybills.read permission', async t => {
  const h = await harness(t, { waybillAllowed: false });
  assert.equal((await h.request('/shipments/41')).status, 403); assert.equal(h.calls.length, 0);
});


test('Waybill History route enforces authentication, role and both read permissions', async t => {
  const anonymous = await harness(t);

  assert.equal(
    (await anonymous.request('/waybill-history', false)).status,
    401
  );

  assert.equal(anonymous.calls.length, 0);

  for (const options of [
    { role: 'logistics' },
    { role: 'sales' },
    { role: 'owner' },
    { allowed: false },
    { waybillAllowed: false }
  ]) {
    const h = await harness(t, options);

    assert.equal(
      (await h.request('/waybill-history')).status,
      403
    );

    assert.equal(h.calls.length, 0);
  }
});

test('Waybill History route returns authorized records and forwards search parameters', async t => {
  const h = await harness(t);

  const response = await h.request(
    '/waybill-history?q=WB-TEST&page=1&pageSize=25'
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');

  const result = await response.json();

  assert.equal(result.success, true);
  assert.equal(result.data.items[0].id, '6');
  assert.equal(result.data.hasMore, false);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0][0], 'history');
  assert.equal(h.calls[0][1].roleCode, 'warehouse');
  assert.equal(h.calls[0][2].q, 'WB-TEST');
  assert.equal(h.calls[0][2].page, '1');
});
