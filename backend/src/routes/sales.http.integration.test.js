import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createSalesRouter } from './sales.routes.js';

const token = 'a'.repeat(64);

async function harness(t, { role = 'sales', accountType = 'employee', allowed = true, quotationAllowed = true, dashboardAllowed = true, notificationsAllowed = true, service, ordersService, dashboardService, notificationsService } = {}) {
  const calls = [];
  const router = createSalesRouter({
    service: service ?? {
      async list(query) { calls.push(['list', query]); return { success: true, data: { items: [], total: 0, page: 1, pageSize: 25 } }; },
      async detail(id) { calls.push(['detail', id]); return { success: true, data: { id, companyName: 'Example', active: false, status: 'inactive' } }; }
    },
    ordersService: ordersService ?? {
      async list(query) { calls.push(['orders-list', query]); return { success: true, data: { items: [], total: 0, page: 1, pageSize: 25 } }; },
      async detail(id) { calls.push(['orders-detail', id]); return { success: true, data: { id, reference: 'ORD-1', stageCode: 'inquiry', items: [] } }; },
      async quotations(id) { calls.push(['quotations', id]); return { success: true, data: [] }; },
      async purchaseOrder(id) { calls.push(['purchase-order', id]); return { success: true, data: null }; },
      async jobOrders(id) { calls.push(['job-orders', id]); return { success: true, data: { orderId: id, jobOrders: [] } }; },
      async delivery(id) { calls.push(['delivery', id]); return { success: true, data: { orderId: id, shipments: [], waybills: [], deliveryReceipts: [] } }; }
    },
    dashboardService: dashboardService ?? {
      async dashboard() { calls.push(['dashboard']); return { success: true, data: { pendingInquiries: 0, quotationsSent: 0, purchaseOrdersReceived: 0, verifiedRevenue: '0', monthlyVerifiedRevenue: [] } }; }
    },
    notificationsService: notificationsService ?? {
      async list(userId, query) { calls.push(['notifications', userId, query]); return { success: true, data: { items: [], total: 0, page: 1, pageSize: 25 } }; }
    },
    validateSessionService: async value => value === token ? {
      userId: '71', sessionId: 'session-internal', active: 1,
      roleCode: role, accountType, displayName: 'Test Employee'
    } : null,
    updateSessionActivityService: async value => value === token,
    permissionChecker: (roleCode, resource, action) => allowed && roleCode === 'sales' &&
      ((resource === 'clients' && action === 'read') || (resource === 'orders' && action === 'read') || (resource === 'quotations' && action === 'read' && quotationAllowed) || (resource === 'inquiries' && action === 'read' && dashboardAllowed) || (resource === 'notifications' && action === 'read' && notificationsAllowed))
  });
  const app = express();
  app.use('/api/sales', router);
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/sales`;
  return { calls, request: (path, authenticated = true) => fetch(`${base}${path}`, {
    headers: authenticated ? { Cookie: `enterflow_session=${token}` } : {}
  }) };
}

test('Sales client routes require authentication, employee account, Sales role, and clients:read', async t => {
  const unauthenticated = await harness(t);
  assert.equal((await unauthenticated.request('/clients', false)).status, 401);
  const denied = await harness(t, { allowed: false });
  assert.equal((await denied.request('/clients')).status, 403);
  assert.equal(denied.calls.length, 0);
  const wrongRole = await harness(t, { role: 'operations' });
  assert.equal((await wrongRole.request('/clients')).status, 403);
  const clientAccount = await harness(t, { accountType: 'client' });
  assert.equal((await clientAccount.request('/clients')).status, 403);
});

test('Sales client list accepts pagination and detail route retrieves one client', async t => {
  const h = await harness(t);
  const list = await h.request('/clients?page=2&pageSize=10&sort=id-desc');
  assert.equal(list.status, 200);
  assert.equal((await list.json()).success, true);
  assert.deepEqual(h.calls[0][0], 'list');
  assert.deepEqual({ ...h.calls[0][1] }, { page: '2', pageSize: '10', sort: 'id-desc' });
  const detail = await h.request('/clients/42');
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).data.id, '42');
  assert.deepEqual(h.calls[1], ['detail', '42']);
});

test('Sales client routes preserve not-found and validation responses', async t => {
  const h = await harness(t, { service: {
    async list() { return { success: false, code: 'VALIDATION_ERROR', errors: { query: 'Invalid' } }; },
    async detail() { return { success: false, code: 'NOT_FOUND' }; }
  } });
  assert.equal((await h.request('/clients?bad=1')).status, 400);
  assert.equal((await h.request('/clients/999')).status, 404);
});

test('Sales order routes require orders:read and preserve company-wide read access', async t => {
  const denied = await harness(t, { allowed: false });
  assert.equal((await denied.request('/orders')).status, 403);
  assert.equal(denied.calls.length, 0);
  const h = await harness(t);
  assert.equal((await h.request('/orders')).status, 200);
  assert.equal((await h.request('/orders/9007199254740993')).status, 200);
  assert.equal(h.calls[0][0], 'orders-list');
  assert.equal(h.calls[1][0], 'orders-detail');
  assert.equal(h.calls[1][1], '9007199254740993');
});

test('Sales quotation and purchase-order routes enforce their existing permissions and preserve BIGINT order IDs', async t => {
  const denied = await harness(t, { allowed: false });
  assert.equal((await denied.request('/orders/1/quotations')).status, 403);
  assert.equal((await denied.request('/orders/1/purchase-order')).status, 403);
  assert.equal(denied.calls.length, 0);
  const h = await harness(t);
  assert.equal((await h.request('/orders/9007199254740993/quotations')).status, 200);
  assert.equal((await h.request('/orders/9007199254740993/purchase-order')).status, 200);
  assert.deepEqual(h.calls.slice(0, 2), [['quotations', '9007199254740993'], ['purchase-order', '9007199254740993']]);
  const quotationDenied = await harness(t, { quotationAllowed: false });
  assert.equal((await quotationDenied.request('/orders/1/quotations')).status, 403);
  assert.equal((await quotationDenied.request('/orders/1/purchase-order')).status, 200);
});

test('Sales dashboard requires all existing read permissions and uses the authenticated Sales employee scope', async t => {
  const denied = await harness(t, { allowed: false });
  assert.equal((await denied.request('/dashboard')).status, 403);
  assert.equal(denied.calls.length, 0);
  const h = await harness(t);
  const response = await h.request('/dashboard');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.verifiedRevenue, '0');
  assert.deepEqual(h.calls, [['dashboard']]);
  const inquiryDenied = await harness(t, { dashboardAllowed: false });
  assert.equal((await inquiryDenied.request('/dashboard')).status, 403);
  assert.equal(inquiryDenied.calls.length, 0);
});

test('Sales job-order and delivery routes require orders:read and preserve company-wide BIGINT order IDs', async t => {
  const denied = await harness(t, { allowed: false });
  assert.equal((await denied.request('/orders/1/job-orders')).status, 403);
  assert.equal((await denied.request('/orders/1/delivery')).status, 403);
  assert.equal(denied.calls.length, 0);
  const h = await harness(t);
  assert.equal((await h.request('/orders/9007199254740993/job-orders')).status, 200);
  assert.equal((await h.request('/orders/9007199254740993/delivery')).status, 200);
  assert.deepEqual(h.calls.slice(0, 2), [['job-orders', '9007199254740993'], ['delivery', '9007199254740993']]);
});

test('Sales notifications require authentication, employee Sales role, and notifications:read without mutation', async t => {
  const unauthenticated = await harness(t);
  assert.equal((await unauthenticated.request('/notifications', false)).status, 401);
  const denied = await harness(t, { allowed: false });
  assert.equal((await denied.request('/notifications')).status, 403);
  assert.equal(denied.calls.length, 0);
  const wrongRole = await harness(t, { role: 'operations' });
  assert.equal((await wrongRole.request('/notifications')).status, 403);
  const clientAccount = await harness(t, { accountType: 'client' });
  assert.equal((await clientAccount.request('/notifications')).status, 403);
  const permissionDenied = await harness(t, { notificationsAllowed: false });
  assert.equal((await permissionDenied.request('/notifications')).status, 403);
  assert.equal(permissionDenied.calls.length, 0);
  const h = await harness(t);
  assert.equal((await h.request('/notifications?page=2&pageSize=10&status=unread&sort=created-asc')).status, 200);
  assert.equal(h.calls[0][0], 'notifications');
  assert.equal(h.calls[0][1], '71');
  assert.deepEqual({ ...h.calls[0][2] }, { page: '2', pageSize: '10', status: 'unread', sort: 'created-asc' });
});
