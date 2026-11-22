import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, actor, result } from '../../test/phase2-service-fixture.mjs';
import { createAccountingService } from './accounting.js';
import { createDocumentWorkflowsService } from './documents.js';
import { createMockDocumentStorage } from '../storage/document-storage.js';
function payment(options = {}) {
  return fixture({
    role: 'accounting',
    ...options,
    handler(sql, p, s) {
      if (sql.includes('FROM proof_of_payment r JOIN sales_invoice')) return [{
        id: '19'
      }];
      if (sql.startsWith('SELECT * FROM proof_of_payment')) return [{
        invoice_id: '69',
        payment_method_id: '79',
        amount_declared: options.amount ?? '20.00',
        review_status: options.status ?? 'pending'
      }];
      if (sql.startsWith('SELECT * FROM sales_invoice')) return [{
        invoice_id: '69',
        po_id: '89',
        total_amount: '100.00',
        status: options.invoiceStatus ?? 'issued'
      }];
      if (sql.includes('COALESCE(SUM(amount),0)')) return [{
        amount: options.paid ?? '0.00'
      }];
      if (sql.includes('FROM proof_of_payment_file f JOIN document')) return [{
        total: 1,
        available: 1
      }];
      if (sql.includes('SELECT q.downpayment_amount')) return [{
        downpayment_amount: '20.00'
      }];
      if (sql.includes('FROM payment_transaction WHERE operation_key')) return options.prior ? [{
        id: '109',
        proofId: options.prior
      }] : [];
      if (/^(INSERT INTO payment_transaction|UPDATE sales_invoice|UPDATE proof_of_payment)/.test(sql)) {
        s.writes.push({
          sql,
          params: p
        });
        return {
          insertId: '109',
          affectedRows: 1
        };
      }
    }
  });
}
for (const [amount, paid, type, status] of [['5.00', '0.00', 'DOWNPAYMENT', 'partially_paid'], ['20.00', '0.00', 'DOWNPAYMENT', 'partially_paid'], ['80.00', '20.00', 'BALANCE', 'paid']]) test(`Confirm ${amount} after ${paid}: exact balance and ${type}`, async () => {
  const h = payment({
    amount,
    paid
  });
  result(await createAccountingService(h).reviewProof({
    paymentId: '99',
    actor: actor('accounting'),
    decision: 'verified',
    operationKey: 'proof:99'
  }));
  const insert = h.wrote('payment_transaction')[0];
  assert.equal(insert.params[2], type);
  assert.equal(insert.params[3], amount);
  assert.equal(insert.params[4], '99');
  assert.equal(insert.params.at(-1), 'proof:99');
  assert.equal(h.wrote('sales_invoice')[0].params[0], status);
  assert.equal(h.wrote('audit_event').length, 2);
  assert(h.calls.findIndex(c => c.sql.includes('FROM inquiry WHERE')) < h.calls.findIndex(c => c.sql.startsWith('SELECT * FROM proof_of_payment')));
});
test('Reject proof records reviewer/note but never creates money or modifies invoice', async () => {
  const h = payment();
  result(await createAccountingService(h).reviewProof({
    paymentId: '99',
    actor: actor('accounting'),
    decision: 'rejected',
    reason: 'Unreadable proof'
  }));
  assert.equal(h.wrote('payment_transaction').length, 0);
  assert.equal(h.wrote('sales_invoice').length, 0);
  assert.deepEqual(h.wrote('proof_of_payment')[0].params, ['rejected', '9', 'Unreadable proof', '99']);
});
for (const opts of [{
  amount: '0.00'
}, {
  amount: '100.01'
}, {
  amount: '80.01',
  paid: '20.00'
}]) test('Payment amount bounds ' + JSON.stringify(opts), async () => {
  const h = payment(opts);
  result(await createAccountingService(h).reviewProof({
    paymentId: '99',
    actor: actor('accounting'),
    decision: 'verified'
  }), 'PAYMENT_AMOUNT_EXCEEDED');
  h.assertRolledBack();
});
test('Same proof operation key replays result without new payment/audit', async () => {
  const h = payment({
    status: 'verified',
    prior: '99'
  });
  const value = result(await createAccountingService(h).reviewProof({
    paymentId: '99',
    actor: actor('accounting'),
    decision: 'verified',
    operationKey: 'same-key'
  }));
  assert(value.idempotent);
  assert.equal(h.wrote('payment_transaction').length, 0);
  assert.equal(h.wrote('audit_event').length, 0);
});
for (const opts of [{
  status: 'rejected'
}, {
  status: 'verified',
  prior: '100'
}, {
  status: 'verified'
}]) test('Another proof or decided state cannot replay ' + JSON.stringify(opts), async () => {
  const h = payment(opts);
  result(await createAccountingService(h).reviewProof({
    paymentId: '99',
    actor: actor('accounting'),
    decision: 'verified',
    operationKey: 'same-key'
  }), 'PAYMENT_ALREADY_DECIDED');
  h.assertRolledBack();
});
for (const failAt of [/INSERT INTO payment_transaction/, /UPDATE sales_invoice/, /UPDATE proof_of_payment/, /INSERT INTO audit_event/, /INSERT INTO notification/]) test('Payment confirmation is atomic when ' + failAt + ' fails', async () => {
  const h = payment({
    failAt
  });
  result(await createAccountingService(h).reviewProof({
    paymentId: '99',
    actor: actor('accounting'),
    decision: 'verified'
  }), 'SERVICE_UNAVAILABLE');
  h.assertRolledBack();
});
test('Cancellation and accounting use same inquiry mutex before child records', async () => {
  const h = payment();
  h.state.inquiry.status = 'cancelled';
  result(await createAccountingService(h).reviewProof({
    paymentId: '99',
    actor: actor('accounting'),
    decision: 'verified'
  }), 'INVALID_STATE');
  assert.equal(h.wrote('payment_transaction').length, 0);
  assert.match(h.calls.find(c => c.sql.includes('FROM inquiry WHERE')).sql, /FOR UPDATE$/);
  h.assertRolledBack();
});
test('Accounting review rechecks actual role; request role cannot grant authority', async () => {
  const h = payment({
    role: 'sales'
  });
  result(await createAccountingService(h).reviewProof({
    paymentId: '99',
    actor: actor('accounting'),
    decision: 'verified'
  }), 'FORBIDDEN');
  h.assertRolledBack();
});
for (const key of ['', 'spaces forbidden', 'x'.repeat(121), {}, 'a\nb']) test('Invalid operation key rejected ' + JSON.stringify(key), async () => {
  const h = payment();
  result(await createAccountingService(h).reviewProof({
    paymentId: '99',
    actor: actor('accounting'),
    decision: 'verified',
    operationKey: key
  }), 'VALIDATION_ERROR');
  h.assertRolledBack();
});
function proof(options = {}) {
  return fixture({
    role: 'client',
    handler(sql, p, s) {
      if (sql.startsWith('SELECT v.* FROM sales_invoice')) return options.unowned ? [] : [{
        invoice_id: '69',
        total_amount: '100.00',
        status: 'issued'
      }];
      if (sql.includes('COALESCE(SUM(amount),0)')) return [{
        amount: '0.00'
      }];
      if (sql.includes('FROM payment_method')) return options.noMethod ? [] : [{
        id: '79'
      }];
      if (sql.startsWith('INSERT INTO proof_of_payment')) {
        s.writes.push({
          sql,
          params: p
        });
        return {
          insertId: '99',
          affectedRows: 1
        };
      }
      if (sql.startsWith('INSERT INTO document')) {
        s.writes.push({
          sql,
          params: p
        });
        return {
          insertId: String(200 + s.writes.length),
          affectedRows: 1
        };
      }
      if (sql.startsWith('UPDATE document')) {
        s.writes.push({
          sql,
          params: p
        });
        return {
          affectedRows: 1
        };
      }
    }
  });
}
const pdf = {
  filename: 'proof.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\ntest')
};
test('Multiple proof files record documents and links after confirmed storage, without payment', async () => {
  const h = proof(),
    storage = createMockDocumentStorage(),
    s = createDocumentWorkflowsService({
      ...h,
      storage,
      bucketName: 'explicit-test'
    });
  const value = result(await s.uploadPaymentProof({
    clientId: '29',
    userId: '9',
    orderId: '19',
    invoiceId: '69',
    amount: '5.00',
    paymentMethodId: '79',
    files: [pdf, pdf]
  }));
  assert.equal(value.verificationStatus, 'pending');
  assert.equal(value.fileIds.length, 2);
  assert.equal(h.wrote('document').filter(c => c.sql.startsWith('INSERT')).length, 2);
  assert.equal(h.wrote('proof_of_payment_file').length, 2);
  assert.equal(h.wrote('payment_transaction').length, 0);
  assert.equal(h.wrote('sales_invoice').length, 0);
});
for (const options of [{
  unowned: true
}, {
  noMethod: true
}]) test('Proof upload prerequisites ' + JSON.stringify(options), async () => {
  const h = proof(options),
    s = createDocumentWorkflowsService({
      ...h,
      storage: createMockDocumentStorage(),
      bucketName: 'explicit-test'
    });
  result(await s.uploadPaymentProof({
    clientId: '29',
    userId: '9',
    orderId: '19',
    invoiceId: '69',
    amount: '5.00',
    paymentMethodId: '79',
    file: pdf
  }), options.unowned ? 'INVOICE_NOT_ISSUED' : 'REFERENCE_DATA_MISSING');
  assert.equal(h.wrote('document').length, 0);
  h.assertRolledBack();
});
test('Failed storage rolls metadata and proof back, compensating staged object', async () => {
  const h = proof(),
    calls = [],
    storage = {
      put: async () => {
        throw new Error('provider failure');
      },
      delete: async item => calls.push(item)
    };
  const s = createDocumentWorkflowsService({
    ...h,
    storage,
    bucketName: 'explicit-test'
  });
  result(await s.uploadPaymentProof({
    clientId: '29',
    userId: '9',
    orderId: '19',
    invoiceId: '69',
    amount: '5.00',
    paymentMethodId: '79',
    file: pdf
  }), 'SERVICE_UNAVAILABLE');
  h.assertRolledBack();
  assert.equal(calls.length, 1);
});
