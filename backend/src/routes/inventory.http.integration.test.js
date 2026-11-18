import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createInventoryRouter } from './inventory.routes.js';
import { createStockRequestsRouter } from './stock-requests.routes.js';
import { createOriginMiddleware } from '../middleware/origin.middleware.js';

async function harness(t, { role = 'warehouse', failure = false } = {}) {
  const calls = [];
  const auth = {
    validateSessionService: async () => ({ userId: '9', sessionId: '10', roleCode: role, accountType: 'employee', active: 1, displayName: 'Synthetic' }),
    updateSessionActivityService: async () => true,
  };
  const inventoryService = {
    async list(actor) {
      calls.push({ type: 'inventory-read', actor: actor.roleCode });
      if (failure) throw new Error('Synthetic database failure');
      return { success: true, data: { materials: [], finishedGoods: [] } };
    },
    async create(actor, body, context) {
      calls.push({ type: 'material-create', actor: actor.roleCode, body, context });
      return { success: true, data: { id: '61', itemCode: body.itemCode } };
    },
    async update(actor, id, body, context) {
      calls.push({ type: 'material-update', actor: actor.roleCode, id, body, context });
      return { success: true, data: { id, ...body } };
    },
  };
  const app = express();
  app.use('/api/inventory', createInventoryRouter({
    ...auth,
    service: inventoryService,
    originMiddleware: () => createOriginMiddleware({ appOrigin: 'http://localhost:5173' }),
  }));
  app.use('/api/stock-requests', createStockRequestsRouter({
    ...auth,
    service: {
      async process(actor, id, body) {
        calls.push({ type: 'stock-request', actor: actor.roleCode, id, body });
        return { success: true, data: { id, status: 'updated' } };
      },
    },
  }));
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  return {
    calls,
    request: (path, { authenticated = true, ...options } = {}) => fetch(
      `http://127.0.0.1:${server.address().port}${path}`,
      {
        ...options,
        headers: {
          ...(authenticated ? { cookie: `enterflow_session=${'a'.repeat(64)}` } : {}),
          ...options.headers,
        },
      },
    ),
  };
}

test('inventory API requires authentication and existing read permissions', async t => {
  const warehouse = await harness(t);
  assert.equal((await warehouse.request('/api/inventory', { authenticated: false })).status, 401);
  assert.equal(warehouse.calls.length, 0);
  assert.deepEqual(await (await warehouse.request('/api/inventory')).json(), {
    success: true,
    data: { materials: [], finishedGoods: [] },
  });
  const denied = await harness(t, { role: 'accounting' });
  assert.equal((await denied.request('/api/inventory')).status, 403);
  assert.equal(denied.calls.length, 0);
  const sales = await harness(t, { role: 'sales' });
  assert.equal((await sales.request('/api/inventory')).status, 200);
});

test('inventory failures are safe 503 responses, not successful empty arrays', async t => {
  const instance = await harness(t, { failure: true });
  const response = await instance.request('/api/inventory');
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.success, false);
  assert.equal(body.code, 'SERVICE_UNAVAILABLE');
  assert.doesNotMatch(JSON.stringify(body), /Synthetic database/);
});

test('material create and edit are Warehouse/Admin-only, origin protected, and use existing inventory update permission', async t => {
  const payload = { itemCode: 'RM-NEW-1', name: 'New material', unit: 'BUNDLE', category: null };
  const options = {
    method: 'POST',
    headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
  const sales = await harness(t, { role: 'sales' });
  assert.equal((await sales.request('/api/inventory/materials', options)).status, 403);
  assert.equal(sales.calls.length, 0);

  const warehouse = await harness(t);
  assert.equal((await warehouse.request('/api/inventory/materials', {
    ...options,
    headers: { ...options.headers, Origin: 'https://untrusted.invalid' },
  })).status, 403);
  assert.equal(warehouse.calls.length, 0);
  const created = await warehouse.request('/api/inventory/materials', options);
  assert.equal(created.status, 201);
  assert.deepEqual(warehouse.calls[0], {
    type: 'material-create',
    actor: 'warehouse',
    body: payload,
    context: { requestId: undefined },
  });

  const updated = await warehouse.request('/api/inventory/materials/61', {
    method: 'PATCH',
    headers: options.headers,
    body: JSON.stringify({ threshold: '0' }),
  });
  assert.equal(updated.status, 200);
  assert.deepEqual(warehouse.calls[1], {
    type: 'material-update',
    actor: 'warehouse',
    id: '61',
    body: { threshold: '0' },
    context: { requestId: undefined },
  });

  const admin = await harness(t, { role: 'admin' });
  assert.equal((await admin.request('/api/inventory/materials', options)).status, 201);
});

test('Stock Request manual update remains Warehouse-only and origin protected', async t => {
  const options = {
    method: 'PATCH',
    headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'updated',
      lines: [{ lineId: '601', currentQuantity: 0, shortageQuantity: 5 }],
      inventoryUpdates: [{ materialId: '61', quantityOnHand: 0 }],
    }),
  };
  const sales = await harness(t, { role: 'sales' });
  assert.equal((await sales.request('/api/stock-requests/501', options)).status, 403);
  assert.equal(sales.calls.length, 0);
  const warehouse = await harness(t);
  assert.equal((await warehouse.request('/api/stock-requests/501', {
    ...options,
    headers: { ...options.headers, Origin: 'https://untrusted.invalid' },
  })).status, 403);
  assert.equal(warehouse.calls.length, 0);
  assert.equal((await warehouse.request('/api/stock-requests/501', options)).status, 200);
  assert.equal(warehouse.calls[0].actor, 'warehouse');
});
