import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';
import { createOwnerEmployeeDirectoryRouter } from './owner-employee-directory.routes.js';

const token = 'a'.repeat(64);

async function harness(t, options = {}) {
  const calls = [];
  const dashboardCalls = [];
  const router = createOwnerEmployeeDirectoryRouter({
    service: { async list(query) { calls.push(query); if (options.throw) throw Error('PRIVATE_SQL'); return { success: true, data: { items: [{ id: '1', employeeId: 'EMP-1', name: 'Owner View', department: 'QA', jobTitle: 'Tester', email: 'owner@example.invalid', phone: null, roleCode: 'sales', active: true }], total: 1, page: 1, pageSize: 10, summary: { total: 1, active: 1, departments: ['QA'] } } }; } },
    dashboardService: { async dashboard() { dashboardCalls.push(true); if (options.dashboardThrow) throw Error('PRIVATE_SQL'); return { success: true, data: { pendingInquiries: 1, quotationsSent: 2, purchaseOrdersReceived: 3, verifiedRevenue: '4.00', monthlyVerifiedRevenue: [] } }; } },
    validateSessionService: async value => value === token ? { userId: '7', roleCode: options.role ?? 'owner', accountType: options.accountType ?? 'employee', active: options.active ?? 1, sessionId: '1' } : null,
    updateSessionActivityService: async () => true,
    permissionChecker: options.permissionChecker
  });
  const server = await new Promise(resolve => { const instance = createApp({ ownerEmployeeDirectory: router }).listen(0, '127.0.0.1', () => resolve(instance)); });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return { calls, dashboardCalls, request: path => fetch(`http://127.0.0.1:${server.address().port}/api/owner${path}`, { headers: { Cookie: `enterflow_session=${token}` } }) };
}

test('Owner can read the dedicated employee directory endpoint', async t => {
  const h = await harness(t);
  const response = await h.request('/employees?q=QA');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.items[0].employeeId, 'EMP-1');
  assert.equal(h.calls.length, 1);
});

test('Owner can read the dedicated business dashboard with established read permissions', async t => {
  const h = await harness(t);
  const response = await h.request('/dashboard');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.verifiedRevenue, '4.00');
  assert.deepEqual(h.dashboardCalls, [true]);
});

test('Owner dashboard requires every established read permission', async t => {
  const h = await harness(t, { permissionChecker: (role, resource, action) => resource !== 'reports' && action === 'read' });
  assert.equal((await h.request('/dashboard')).status, 403);
  assert.deepEqual(h.dashboardCalls, []);
});

for (const role of ['admin', 'sales', 'operations', 'accounting', 'production', 'warehouse', 'logistics', 'client']) {
  test(`${role} cannot read the Owner employee directory endpoint`, async t => {
    const h = await harness(t, { role, accountType: role === 'client' ? 'client' : 'employee' });
    assert.equal((await h.request('/employees')).status, 403);
    assert.equal(h.calls.length, 0);
  });
}

test('Owner endpoint rejects client account impersonation and hides service failures', async t => {
  const client = await harness(t, { accountType: 'client' });
  assert.equal((await client.request('/employees')).status, 403);
  const failed = await harness(t, { throw: true });
  const response = await failed.request('/employees');
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /PRIVATE_SQL|password_hash/);
});
