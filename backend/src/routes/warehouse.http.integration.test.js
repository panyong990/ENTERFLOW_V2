import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createWarehouseRouter } from './warehouse.routes.js';

const token = 'd'.repeat(64);

async function harness(t, { role = 'warehouse', allowed = true } = {}) {
  const calls = [];
  const service = {
    async listShipments(actor, query) { calls.push(['list', actor, query]); return { success: true, data: [{ id: '41', status: 'pending' }] }; },
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
      allowed && roleCode === 'warehouse' && resource === 'deliveries' && action === 'read'
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
