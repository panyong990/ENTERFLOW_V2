import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createLogisticsRouter } from './logistics.routes.js';

const token = 'e'.repeat(64);

async function harness(t, { role = 'logistics', allowed = true, waybillsAllowed = true } = {}) {
  const calls = [];
  const service = {
    async listShipments(actor, query) {
      calls.push(['list', actor, query]);
      return { success: true, data: [{ id: '41', status: 'pending' }] };
    },
    async getShipment(actor, id) {
      calls.push(['detail', actor, id]);
      return { success: true, data: { id, waybills: [], deliveryReceipts: [] } };
    }
  };
  const app = express();
  app.use('/api/logistics', createLogisticsRouter({
    service,
    validateSessionService: async value => value === token
      ? { userId: '9', sessionId: 's', active: 1, roleCode: role, accountType: 'employee', displayName: 'Logistics' }
      : null,
    updateSessionActivityService: async value => value === token,
    permissionChecker: (roleCode, resource, action) =>
      roleCode === 'logistics' && action === 'read' &&
      (resource === 'deliveries' ? allowed : resource === 'waybills' && waybillsAllowed)
  }));
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/logistics`;
  return {
    calls,
    request: (path, authenticated = true) => fetch(`${base}${path}`, {
      headers: authenticated ? { Cookie: `enterflow_session=${token}` } : {}
    })
  };
}

test('Logistics shipment routes require authentication, Logistics role, and deliveries read permission', async t => {
  const unauthenticated = await harness(t);
  assert.equal((await unauthenticated.request('/shipments', false)).status, 401);
  assert.equal(unauthenticated.calls.length, 0);
  const wrongRole = await harness(t, { role: 'warehouse' });
  assert.equal((await wrongRole.request('/shipments')).status, 403);
  assert.equal(wrongRole.calls.length, 0);
  const denied = await harness(t, { allowed: false });
  assert.equal((await denied.request('/shipments')).status, 403);
  assert.equal(denied.calls.length, 0);
  const waybillsDenied = await harness(t, { waybillsAllowed: false });
  assert.equal((await waybillsDenied.request('/shipments')).status, 403);
  assert.equal(waybillsDenied.calls.length, 0);
});

test('Logistics can list and retrieve shipment metadata through read-only routes', async t => {
  const h = await harness(t);
  const list = await h.request('/shipments?status=pending&limit=25');
  assert.equal(list.status, 200);
  assert.deepEqual((await list.json()).data, [{ id: '41', status: 'pending' }]);
  assert.equal((await h.request('/shipments/41')).status, 200);
  assert.deepEqual(h.calls.map(call => call[0]), ['list', 'detail']);
  assert.equal(h.calls[0][2].status, 'pending');
  assert.equal(h.calls[1][2], '41');
});

test('Logistics routes do not expose delivery mutation endpoints', async t => {
  const h = await harness(t);
  const response = await h.request('/shipments/41/status', true);
  assert.equal(response.status, 404);
  assert.equal(h.calls.length, 0);
});
