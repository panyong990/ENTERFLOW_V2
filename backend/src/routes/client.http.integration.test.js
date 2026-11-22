import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createClientRouter } from './client.routes.js';

const token = 'b'.repeat(64);

async function harness(t, { accountType = 'client', roleCode = 'client', clientId = '21', userId = '9', allowed = true, service, notificationsService, inquiryService } = {}) {
  const calls = [];
  const router = createClientRouter({
    appOrigin: 'http://localhost:5173',
    service: service ?? {
      async profile(id) { calls.push(['profile', id]); return { success: true, data: { id, companyName: 'Example' } }; },
      async listOrders(id, query) { calls.push(['list', id, query]); return { success: true, data: { items: [], total: 0, page: 1, pageSize: 25 } }; },
      async detailOrder(client, id) {
        calls.push(['detail', client, id]);
        return /^[1-9][0-9]{0,19}$/.test(id) ? { success: true, data: { id, items: [] } } : { success: false, code: 'VALIDATION_ERROR', errors: { id: 'Invalid order identifier.' } };
      },
      async quotations(client, id) { calls.push(['quotations', client, id]); return { success: true, data: [] }; },
      async decideQuotation(client, user, orderId, quotationId, body) { calls.push(['decide-quotation', client, user, orderId, quotationId, body]); return { success: true, data: { quotationId, orderId, decision: body.decision } }; },
      async submitPurchaseOrder(client, user, orderId, body) { calls.push(['submit-po', client, user, orderId, body]); return { success: true, data: { id: '77', orderId, reference: body.reference, status: 'received' } }; },
      async requestCancellation(client, user, orderId, body) { calls.push(['cancellation', client, user, orderId, body]); return { success: true, data: { id: '802', orderId, status: 'pending', requestedBy: 'client' } }; },
      async purchaseOrder(client, id) { calls.push(['purchase-order', client, id]); return { success: true, data: null }; },
      async jobOrders(client, id) { calls.push(['job-orders', client, id]); return { success: true, data: { orderId: id, jobOrders: [] } }; },
      async delivery(client, id) { calls.push(['delivery', client, id]); return { success: true, data: { orderId: id, shipments: [] } }; },
      async invoices(client, id) { calls.push(['invoices', client, id]); return { success: true, data: [] }; },
      async payments(client, id) { calls.push(['payments', client, id]); return { success: true, data: [] }; },
      async dashboard(id) { calls.push(['dashboard', id]); return { success: true, data: { activeOrders: 0, pendingInquiries: 0, sentQuotations: 0, openInvoices: 0, recentOrderActivity: [], upcomingDeliveries: [] } }; }
    },
    notificationsService: notificationsService ?? {
      async list(id, query) { calls.push(['notifications-list', id, query]); return { success: true, data: { items: [], total: 0, page: 1, pageSize: 25 } }; },
      async markRead(id, notificationId) { calls.push(['notifications-read', id, notificationId]); return { success: true, data: { notificationId, isRead: true } }; }
    },
    validateSessionService: async value => value === token ? { userId, sessionId: '10', active: 1, accountType, roleCode, clientId, displayName: 'Client' } : null,
    updateSessionActivityService: async value => value === token,
    inquiryService,
    permissionChecker: (role, resource, action) => allowed && role === 'client' &&
      ((resource === 'dashboard' && action === 'read') || (resource === 'clients' && action === 'read') || (resource === 'orders' && action === 'read') || (resource === 'inquiries' && (action === 'read' || action === 'create')) || (resource === 'quotations' && (action === 'read' || action === 'update')) || (resource === 'invoices' && action === 'read') || (resource === 'payments' && action === 'read') || (resource === 'notifications' && (action === 'read' || action === 'update')))
  });
  const app = express();
  app.use('/api/client', router);
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  return { calls, request: (path, authenticated = true, extra = {}) => fetch(`http://127.0.0.1:${server.address().port}/api/client${path}`, { ...extra, headers: { Origin: 'http://localhost:5173', ...(authenticated ? { Cookie: `enterflow_session=${token}` } : {}), ...(extra.headers ?? {}) } }) };
}

test('client routes require an authenticated client account with a valid client identity', async t => {
  assert.equal((await (await harness(t)).request('/profile', false)).status, 401);
  assert.equal((await (await harness(t, { accountType: 'employee', roleCode: 'sales' })).request('/profile')).status, 403);
  assert.equal((await (await harness(t, { accountType: 'client', roleCode: 'sales' })).request('/profile')).status, 403);
  assert.equal((await (await harness(t, { clientId: null })).request('/profile')).status, 403);
  assert.equal((await (await harness(t, { allowed: false })).request('/profile')).status, 403);
});

test('client inquiry submission uses authenticated client and user identities', async t => {
  const calls = [];
  const h = await harness(t, { inquiryService: { async createInquiry(clientId, userId, body) { calls.push({ clientId, userId, body }); return { success: true, data: { id: '91', reference: 'INQ-2026-000007' } }; } } });
  const response = await h.request('/orders', true, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: '999', contactPerson: 'Client Contact' }) });
  assert.equal(response.status, 201);
  assert.deepEqual(calls[0], { clientId: '21', userId: '9', body: { clientId: '999', contactPerson: 'Client Contact' } });
  const denied = await harness(t, { allowed: false, inquiryService: { async createInquiry() { throw new Error('must not call'); } } });
  assert.equal((await denied.request('/orders', true, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
});

test('client dashboard requires authentication, client role, dashboard:read, and uses authenticated clientId', async t => {
  assert.equal((await (await harness(t)).request('/dashboard', false)).status, 401);
  assert.equal((await (await harness(t, { accountType: 'employee', roleCode: 'sales' })).request('/dashboard')).status, 403);
  assert.equal((await (await harness(t, { allowed: false })).request('/dashboard')).status, 403);
  const h = await harness(t);
  assert.equal((await h.request('/dashboard?clientId=999')).status, 200);
  assert.deepEqual(h.calls[0], ['dashboard', '21']);
});

test('profile and orders use authenticated clientId, not caller-supplied ownership', async t => {
  const h = await harness(t);
  assert.equal((await h.request('/profile?clientId=999')).status, 200);
  assert.equal((await h.request('/orders?clientId=999&page=2&pageSize=10')).status, 200);
  assert.equal((await h.request('/orders/9007199254740993', true)).status, 200);
  assert.deepEqual(h.calls[0], ['profile', '21']);
  assert.equal(h.calls[1][0], 'list');
  assert.equal(h.calls[1][1], '21');
  assert.deepEqual(h.calls[2], ['detail', '21', '9007199254740993']);
});

test('cross-client and nonexistent orders share the same public not-found response', async t => {
  const h = await harness(t, { service: {
    async profile() { return { success: true, data: {} }; },
    async listOrders() { return { success: true, data: { items: [], total: 0, page: 1, pageSize: 25 } }; },
    async detailOrder() { return { success: false, code: 'NOT_FOUND' }; }
  } });
  const first = await h.request('/orders/100');
  const second = await h.request('/orders/101');
  assert.equal(first.status, 404);
  assert.equal(second.status, 404);
  assert.deepEqual(await first.json(), await second.json());
});

test('invalid order identifiers produce a validation response', async t => {
  const h = await harness(t);
  const response = await h.request('/orders/not-an-id');
  assert.equal(response.status, 400);
  assert.equal(h.calls.length, 1);
});

test('quotation and purchase-order routes use authenticated ownership and existing permissions', async t => {
  const h = await harness(t);
  assert.equal((await h.request('/orders/9007199254740993/quotations?clientId=999')).status, 200);
  assert.equal((await h.request('/orders/9007199254740993/purchase-order?clientId=999')).status, 200);
  assert.deepEqual(h.calls.slice(-2), [
    ['quotations', '21', '9007199254740993'],
    ['purchase-order', '21', '9007199254740993']
  ]);
  const denied = await harness(t, { allowed: false });
  assert.equal((await denied.request('/orders/1/quotations')).status, 403);
  assert.equal((await denied.request('/orders/1/purchase-order')).status, 403);
});

test('client quotation decisions use authenticated client/user identities and quotation update permission', async t => {
  const h = await harness(t);
  const response = await h.request('/orders/91/quotations/301/decision', true, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' }, body: JSON.stringify({ clientId: '999', decision: 'accepted' }) });
  assert.equal(response.status, 200);
  assert.deepEqual(h.calls.at(-1), ['decide-quotation', '21', '9', '91', '301', { clientId: '999', decision: 'accepted' }]);
  const denied = await harness(t, { allowed: false });
  assert.equal((await denied.request('/orders/91/quotations/301/decision', true, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: 'accepted' }) })).status, 403);
});

test('client purchase-order submission uses authenticated ownership and reference-only recording', async t => {
  const h = await harness(t);
  const response = await h.request('/orders/91/purchase-order', true, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' }, body: JSON.stringify({ clientId: '999', reference: 'PO-CLIENT-1' }) });
  assert.equal(response.status, 201);
  assert.deepEqual(h.calls.at(-1), ['submit-po', '21', '9', '91', { clientId: '999', reference: 'PO-CLIENT-1' }]);
});

test('Client cancellation request uses authenticated ownership, inquiry-create permission, and origin protection', async t => {
  const h = await harness(t);
  const response = await h.request('/orders/91/cancellation', true, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Changed requirements.', termsAcknowledged: true, clientId: 'forged' })
  });
  assert.equal(response.status, 201);
  assert.deepEqual(h.calls.at(-1), ['cancellation', '21', '9', '91', { reason: 'Changed requirements.', termsAcknowledged: true, clientId: 'forged' }]);
  const denied = await harness(t, { allowed: false });
  const blocked = await denied.request('/orders/91/cancellation', true, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Changed requirements.', termsAcknowledged: true })
  });
  assert.equal(blocked.status, 403);
  assert.equal(denied.calls.length, 0);
  const wrongOrigin = await harness(t);
  const originResponse = await wrongOrigin.request('/orders/91/cancellation', true, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.invalid' },
    body: JSON.stringify({ reason: 'Changed requirements.', termsAcknowledged: true })
  });
  assert.equal(originResponse.status, 403);
  assert.equal(wrongOrigin.calls.length, 0);
});

test('cross-client and nonexistent parents return equivalent public 404 responses', async t => {
  const h = await harness(t, { service: {
    async profile() { return { success: true, data: {} }; },
    async listOrders() { return { success: true, data: { items: [], total: 0, page: 1, pageSize: 25 } }; },
    async detailOrder() { return { success: true, data: {} }; },
    async quotations() { return { success: false, code: 'NOT_FOUND' }; },
    async purchaseOrder() { return { success: false, code: 'NOT_FOUND' }; },
    async jobOrders() { return { success: false, code: 'NOT_FOUND' }; },
    async delivery() { return { success: false, code: 'NOT_FOUND' }; },
    async invoices() { return { success: false, code: 'NOT_FOUND' }; },
    async payments() { return { success: false, code: 'NOT_FOUND' }; }
  } });
  for (const suffix of ['/quotations', '/purchase-order', '/job-orders', '/delivery']) {
    const first = await h.request(`/orders/100${suffix}`);
    const second = await h.request(`/orders/101${suffix}`);
    assert.equal(first.status, 404);
    assert.deepEqual(await first.json(), await second.json());
  }
});

test('invoice and payment routes enforce their existing client permissions and authenticated ownership', async t => {
  const h = await harness(t);
  assert.equal((await h.request('/orders/9007199254740993/invoices?clientId=999')).status, 200);
  assert.equal((await h.request('/orders/9007199254740993/payments?clientId=999')).status, 200);
  assert.deepEqual(h.calls.slice(-2), [
    ['invoices', '21', '9007199254740993'],
    ['payments', '21', '9007199254740993']
  ]);
  const denied = await harness(t, { allowed: false });
  assert.equal((await denied.request('/orders/1/invoices')).status, 403);
  assert.equal((await denied.request('/orders/1/payments')).status, 403);
});

test('client notifications are user-scoped and read mutation requires notification permissions', async t => {
  const h = await harness(t);
  assert.equal((await h.request('/notifications?page=2&pageSize=10&status=unread')).status, 200);
  assert.equal((await h.request('/notifications/9007199254740993/read', true, { method: 'PATCH',headers:{'Content-Type':'application/json'} })).status, 200);
  assert.equal(h.calls.at(-2)[0], 'notifications-list');
  assert.equal(h.calls.at(-2)[1], '9');
  assert.deepEqual({ ...h.calls.at(-2)[2] }, { page: '2', pageSize: '10', status: 'unread' });
  assert.deepEqual(h.calls.at(-1), ['notifications-read', '9', '9007199254740993']);
  const denied = await harness(t, { allowed: false });
  assert.equal((await denied.request('/notifications')).status, 403);
  assert.equal((await denied.request('/notifications/1/read', true, { method: 'PATCH',headers:{'Content-Type':'application/json'} })).status, 403);
});

test('job-order and delivery routes use authenticated ownership and orders:read', async t => {
  const h = await harness(t);
  assert.equal((await h.request('/orders/9007199254740993/job-orders?clientId=999')).status, 200);
  assert.equal((await h.request('/orders/9007199254740993/delivery?clientId=999')).status, 200);
  assert.deepEqual(h.calls.slice(-2), [
    ['job-orders', '21', '9007199254740993'],
    ['delivery', '21', '9007199254740993']
  ]);
  const denied = await harness(t, { allowed: false });
  assert.equal((await denied.request('/orders/1/job-orders')).status, 403);
  assert.equal((await denied.request('/orders/1/delivery')).status, 403);
});
