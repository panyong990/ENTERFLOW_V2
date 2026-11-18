import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createStockRequestsRouter } from './stock-requests.routes.js';

async function harness(t, roleCode, service = {}) {
  const app = express();
  app.use('/api/stock-requests', createStockRequestsRouter({
    service: { list: async () => ({ success: true, data: [] }), ...service },
    validateSessionService: async () => ({ userId: '8', sessionId: '9', roleCode, accountType: 'employee', active: 1, displayName: 'Synthetic' }),
    updateSessionActivityService: async () => true,
  }));
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  t.after(() => server.close());
  return `http://127.0.0.1:${server.address().port}/api/stock-requests`;
}

test('Warehouse can retrieve an authenticated empty Stock Request collection', async t => {
  const url = await harness(t, 'warehouse');
  const response = await fetch(url, { headers: { cookie: `enterflow_session=${'a'.repeat(64)}` } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, data: [] });
});

test('Stock Request retrieval rejects unauthenticated and unauthorized roles', async t => {
  const unauthenticated = await harness(t, 'warehouse');
  assert.equal((await fetch(unauthenticated)).status, 401);
  const unauthorized = await harness(t, 'accounting');
  assert.equal((await fetch(unauthorized, { headers: { cookie: `enterflow_session=${'b'.repeat(64)}` } })).status, 403);
});

test('Sales submits an authenticated Stock Request through the existing POST contract', async t => {
  const calls = [];
  const origin = 'http://localhost:5173';
  const previousOrigin = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = origin;
  let url;
  try {
    url = await harness(t, 'sales', {
      async create(actor, body) {
        calls.push({ actor, body });
        return { success: true, data: { id: '501', orderId: body.orderId, status: 'pending' } };
      }
    });
  } finally {
    if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previousOrigin;
  }
  const request = { orderId: '91', lines: [{ materialId: '61', quantity: 1.25 }] };
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      cookie: `enterflow_session=${'c'.repeat(64)}`,
      Origin: origin,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { success: true, data: { id: '501', orderId: '91', status: 'pending' } });
  assert.equal(calls[0].actor.roleCode, 'sales');
  assert.equal(calls[0].actor.userId, '8');
  assert.deepEqual(calls[0].body, request);
});
