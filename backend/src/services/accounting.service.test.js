import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountingService } from './accounting.service.js';

const actor = { accountType: 'employee', roleCode: 'accounting', userId: '9' };

function harness(rows = []) {
  const calls = [];
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params });
      return [rows];
    },
    release() {}
  };
  const db = { async getConnection() { return connection; } };
  return { service: createAccountingService({ db }), calls };
}

test('Accounting read service rejects unauthorized actors and invalid IDs', async () => {
  const { service } = harness();
  assert.deepEqual(await service.listInvoices({ accountType: 'client', roleCode: 'client', userId: '9' }), { success: false, code: 'FORBIDDEN' });
  assert.deepEqual(await service.getInvoice(actor, '0'), { success: false, code: 'VALIDATION_ERROR' });
  assert.deepEqual(await service.getPayment(actor, '18446744073709551616'), { success: false, code: 'VALIDATION_ERROR' });
});

test('Accounting invoice and payment reads use parameterized bounded SQL', async () => {
  const invoice = harness([{ id: '501', reference: 'SI-2026-0501' }]);
  const invoices = await invoice.service.listInvoices(actor, { limit: '25', orderId: '501' });
  assert.equal(invoices.success, true);
  assert.match(invoice.calls[0].sql, /FROM invoices i/);
  assert.equal(invoice.calls[0].params[0], '501');
  assert.equal(invoice.calls[0].params[1], 25);

  const payment = harness([{ id: '601', verificationStatus: 'pending' }]);
  const payments = await payment.service.listPayments(actor, { limit: '10', status: 'pending', invoiceId: '501' });
  assert.equal(payments.success, true);
  assert.match(payment.calls[0].sql, /FROM payments p/);
  assert.deepEqual(payment.calls[0].params, ['501', 'pending', 10]);
});

test('Accounting read service rejects unsupported filters and excessive limits', async () => {
  const { service } = harness();
  assert.deepEqual(await service.listPayments(actor, { status: 'cancelled' }), { success: false, code: 'VALIDATION_ERROR' });
  assert.deepEqual(await service.listInvoices(actor, { limit: '101' }), { success: false, code: 'VALIDATION_ERROR' });
});
