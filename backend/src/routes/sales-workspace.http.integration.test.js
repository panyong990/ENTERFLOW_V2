import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createSalesWorkspaceRouter } from './sales-workspace.routes.js';

const token = 'a'.repeat(64);

async function harness(t, { role = 'sales', accountType = 'employee', allowed = true } = {}) {
  const app = express();
  const router = createSalesWorkspaceRouter({
    validateSessionService: async value => value === token ? {
      userId: '71', sessionId: 'session-internal', active: 1,
      roleCode: role, accountType, displayName: 'Test Employee'
    } : null,
    updateSessionActivityService: async value => value === token,
    permissionChecker: (roleCode, resource, action) => allowed && roleCode === 'sales' &&
      ((resource === 'inquiries' && action === 'read') || (resource === 'clients' && action === 'read'))
  });
  app.use('/api/workspace/sales', router);
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/workspace/sales`;
  return (path = '/readiness', init = {}) => fetch(`${base}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), ...(init.auth === false ? {} : { Cookie: `enterflow_session=${token}` }) }
  });
}

test('Sales readiness rejects unauthenticated requests', async t => {
  const request = await harness(t);
  const response = await request('/readiness', { auth: false });
  assert.equal(response.status, 401);
});

test('Sales readiness rejects authenticated employees with another role', async t => {
  const request = await harness(t, { role: 'production' });
  const response = await request();
  assert.equal(response.status, 403);
});

test('Sales readiness rejects a non-employee account even if its role code matches', async t => {
  const request = await harness(t, { accountType: 'client' });
  assert.equal((await request()).status, 403);
});

test('Sales readiness applies resource/action checks and returns only a safe capability status', async t => {
  const deniedRequest = await harness(t, { allowed: false });
  assert.equal((await deniedRequest()).status, 403);

  const request = await harness(t);
  const response = await request();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), {
    success: true,
    data: {
      roleCode: 'sales',
      operationalDataAvailable: false,
      unavailableAreas: ['dashboard-metrics', 'sales-orders', 'client-records', 'notifications']
    }
  });
});

test('Sales readiness route exposes no mutating operation', async t => {
  const request = await harness(t);
  assert.equal((await request('/readiness', { method: 'POST' })).status, 404);
});
