import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createProductionRouter } from './production.routes.js';

const token = 'b'.repeat(64);

async function harness(t, { role = 'production', accountType = 'employee', allowed = true } = {}) {
  const calls = [];
  const service = { async list(query) { calls.push(['list', query]); return { success: true, data: { items: [], total: 0, page: 1, pageSize: 25 } }; }, async detail(id) { calls.push(['detail', id]); return { success: true, data: { id, reference: 'JO-1', status: 'jo' } }; } };
  const router = createProductionRouter({ service, validateSessionService: async value => value === token ? { userId: '8', sessionId: 's', active: 1, roleCode: role, accountType, displayName: 'Production' } : null, updateSessionActivityService: async value => value === token, permissionChecker: (roleCode, resource, action) => allowed && resource === 'production' && action === 'read' && ['production', 'admin', 'owner', 'operations'].includes(roleCode) });
  const app = express(); app.use('/api/production', router);
  const server = await new Promise((resolve, reject) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); instance.once('error', reject); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/production`;
  return { calls, request: (path, authenticated = true, options = {}) => fetch(`${base}${path}`, { ...options, headers: { ...(options.headers ?? {}), ...(authenticated ? { Cookie: `enterflow_session=${token}` } : {}) } }) };
}

test('Production Job Order routes require authenticated employee Production access', async t => {
  assert.equal((await (await harness(t)).request('/job-orders', false)).status, 401);
  assert.equal((await (await harness(t, { role: 'sales' })).request('/job-orders')).status, 403);
  assert.equal((await (await harness(t, { accountType: 'client' })).request('/job-orders')).status, 403);
  const denied = await harness(t, { allowed: false });
  assert.equal((await denied.request('/job-orders')).status, 403);
  assert.equal(denied.calls.length, 0);
});

test('Authorized Production users can list and retrieve the same persisted Job Order path', async t => {
  const h = await harness(t);
  assert.equal((await h.request('/job-orders?q=JO-1&status=jo')).status, 200);
  assert.equal((await h.request('/job-orders/501')).status, 200);
  assert.deepEqual(h.calls.map(call => call[0]), ['list', 'detail']);
});

test('Production status mutation paths remain absent until a state machine is approved', async t => {
  const h = await harness(t);
  const response = await h.request('/job-orders/501/status', true, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'in_production' })
  });
  assert.equal(response.status, 404);
  assert.equal(h.calls.length, 0);
});
