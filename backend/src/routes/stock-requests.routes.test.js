import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createStockRequestsRouter } from './stock-requests.routes.js';

async function harness(t, roleCode) {
  const app = express();
  app.use('/api/stock-requests', createStockRequestsRouter({
    service: { list: async () => ({ success: true, data: [] }) },
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
