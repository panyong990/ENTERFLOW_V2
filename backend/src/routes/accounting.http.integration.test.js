import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createAccountingRouter } from './accounting.routes.js';

const token = 'c'.repeat(64);

async function harness(t, { role = 'accounting', allowed = true } = {}) {
  const calls = [];
  const service = {
    async listInvoices(actor, query) { calls.push(['listInvoices', actor, query]); return { success: true, data: [{ id: '501', reference: 'SI-2026-0501' }] }; },
    async getInvoice(actor, id) { calls.push(['getInvoice', actor, id]); return { success: true, data: { id, reference: 'SI-2026-0501' } }; },
    async listPayments(actor, query) { calls.push(['listPayments', actor, query]); return { success: true, data: [{ id: '601', verificationStatus: 'pending' }] }; },
    async getPayment(actor, id) { calls.push(['getPayment', actor, id]); return { success: true, data: { id, verificationStatus: 'verified' } }; }
  };
  const app = express();
  app.use('/api/accounting', createAccountingRouter({
    service,
    validateSessionService: async value => value === token
      ? { userId: '9', sessionId: 's', active: 1, roleCode: role, accountType: 'employee', displayName: 'Accounting' }
      : null,
    updateSessionActivityService: async value => value === token,
    permissionChecker: (roleCode, resource, action) =>
      allowed && roleCode === 'accounting' && (
        (resource === 'invoices' && action === 'read') ||
        (resource === 'payments' && (action === 'read' || action === 'verify'))
      )
  }));
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/accounting`;
  return {
    calls,
    request: (path, authenticated = true) => fetch(`${base}${path}`, {
      headers: authenticated ? { Cookie: `enterflow_session=${token}` } : {}
    })
  };
}

test('Accounting routes require authentication, Accounting role, and read permissions', async t => {
  const h = await harness(t);
  assert.equal((await h.request('/invoices', false)).status, 401);
  assert.equal((await h.request('/payments', false)).status, 401);
  assert.equal(h.calls.length, 0);

  const sales = await harness(t, { role: 'sales' });
  assert.equal((await sales.request('/invoices')).status, 403);
  assert.equal(sales.calls.length, 0);

  const denied = await harness(t, { allowed: false });
  assert.equal((await denied.request('/payments')).status, 403);
  assert.equal(denied.calls.length, 0);
});

test('Accounting invoice and payment reads return the service contract', async t => {
  const h = await harness(t);
  assert.equal((await h.request('/invoices?limit=25&orderId=501')).status, 200);
  assert.equal((await h.request('/invoices/501')).status, 200);
  assert.equal((await h.request('/payments?limit=25&status=pending')).status, 200);
  assert.equal((await h.request('/payments/601')).status, 200);
  assert.deepEqual(h.calls.map(call => call[0]), ['listInvoices', 'getInvoice', 'listPayments', 'getPayment']);
});
