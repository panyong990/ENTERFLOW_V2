import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountingService } from './accounting.service.js';

const actor = { accountType: 'employee', roleCode: 'accounting', userId: '9' };

function harness(rows = []) {
  const calls = [];
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params });
      return [rows.map(r=>({...r,outstandingAmount:r.outstandingAmount??'0.00'}))];
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
  assert.match(invoice.calls[0].sql, /FROM sales_invoice v/);
  assert.equal(invoice.calls[0].params[0], '501');
  assert.equal(invoice.calls[0].params[1], '25');

  const payment = harness([{ id: '601', verificationStatus: 'pending' }]);
  const payments = await payment.service.listPayments(actor, { limit: '10', status: 'pending', invoiceId: '501' });
  assert.equal(payments.success, true);
  assert.match(payment.calls[0].sql, /FROM proof_of_payment r/);
  assert.deepEqual(payment.calls[0].params, ['pending','501','10']);
});

test('Accounting read service rejects unsupported filters and excessive limits', async () => {
  const { service } = harness();
  assert.deepEqual(await service.listPayments(actor, { status: 'cancelled' }), { success: false, code: 'VALIDATION_ERROR' });
  assert.deepEqual(await service.listInvoices(actor, { limit: '101' }), { success: false, code: 'VALIDATION_ERROR' });
});

function proofProjectionHarness(paymentRows) {
  const calls = [];
  const db = { async getConnection() { return {
    async execute(sql, params) {
      calls.push({ sql, params });
      // Source contract + relational fixture, not execution of SQL against MySQL.
      assert.match(sql, /SELECT CAST\(MIN\(document_id\) AS CHAR\) FROM proof_of_payment_file f WHERE f.receipt_id=r.receipt_id/);
      assert.doesNotMatch(sql, /JOIN\s+proof_of_payment_file|SUM\(DISTINCT/i);
      assert.match(sql, /CASE WHEN r.review_status='verified' THEN \(SELECT SUM\(t.amount\) FROM payment_transaction/);
      const rows = sql.includes('WHERE 1=1 AND r.receipt_id=?') ? paymentRows.filter(row => row.id === params[0]) : paymentRows.slice(0, params.at(-1));
      return [rows.map(({ attachments, ...payment }) => {
        const proofs = attachments.filter(file => file.purpose === 'proof_of_payment')
          .toSorted((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0);
        return { ...payment, verifiedAmount: payment.verificationStatus === 'verified' ? payment.verifiedAmount : null, proofFileId: proofs[0]?.id ?? null };
      })];
    }, release() {},
  }; } };
  return { service: createAccountingService({ db }), calls };
}

for (const attachments of [
  [],
  [{ id: '10', purpose: 'proof_of_payment' }],
  [{ id: '10', purpose: 'proof_of_payment' }, { id: '1', purpose: 'receipt' }, { id: '2', purpose: 'proof_of_payment' }],
  [{ id: '1', purpose: 'receipt' }],
]) {
  test(`D07 Accounting list/detail preserve one payment with ${attachments.length} attachments`, async () => {
    const payment = { id: '9007199254740993', orderId: '91', invoiceId: '601', paymentType: 'DOWNPAYMENT', submittedAmount: '20.00', verifiedAmount: '20.00', verificationStatus: 'verified', attachments };
    const h = proofProjectionHarness([payment]);
    const listed = await h.service.listPayments(actor);
    const detail = await h.service.getPayment(actor, payment.id);
    assert.equal(listed.data.length, 1);
    assert.deepEqual(detail.data, listed.data[0]);
    assert.equal(detail.data.id, payment.id);
    assert.equal(detail.data.verifiedAmount, '20.00');
    assert.equal(detail.data.proofFileId, attachments.length === 3 ? '2' : attachments.some(file => file.purpose === 'proof_of_payment') ? '10' : null);
  });
}

test('D07 Accounting preserves equal-value payments, status masking and payment-level limits', async () => {
  const rows = ['verified', 'verified', 'pending', 'rejected'].map((verificationStatus, index) => ({
    id: String(9007199254740993n + BigInt(index)), orderId: '91', invoiceId: '601',
    submittedAmount: '10.00', verifiedAmount: verificationStatus === 'verified' ? '10.00' : null,
    verificationStatus, attachments: [{ id: '2', purpose: 'proof_of_payment' }, { id: '10', purpose: 'proof_of_payment' }],
  }));
  const h = proofProjectionHarness(rows);
  const listed = await h.service.listPayments(actor);
  assert.equal(listed.data.length, 4);
  assert.deepEqual(listed.data.map(row => row.verifiedAmount), ['10.00', '10.00', null, null]);
  assert.equal(new Set(listed.data.map(row => row.id)).size, 4);
  assert.equal((await h.service.listPayments(actor, { limit: '1' })).data.length, 1);
  assert.equal((await h.service.getPayment(actor, '999')).code, 'NOT_FOUND');
});

test('D07 invoice list/detail keep the payment-only verified sum and exact totals', async () => {
  const row = { id: '601', orderId: '91', amount: '100.00', requiredDownpayment: '20.00', verifiedAmount: '20.00',outstandingAmount:'80.00',paymentTermLabel:null,isOverdue:false };
  const h = harness([row]);
  const listed = await h.service.listInvoices(actor);
  const detail = await h.service.getInvoice(actor, row.id);
  assert.deepEqual(listed.data[0], row);
  assert.deepEqual(detail.data, row);
  for (const { sql } of h.calls) {
    assert.match(sql, /SELECT SUM\(t.amount\) FROM payment_transaction t WHERE t.invoice_id=v.invoice_id AND t.approval_status='approved'/);
    assert.doesNotMatch(sql, /payment_files|SUM\(DISTINCT/i);
  }
});
