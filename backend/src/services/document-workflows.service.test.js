import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocumentWorkflowsService } from './document-workflows.service.js';
import { createMockDocumentStorage } from '../storage/document-storage.js';

test('purchase-order upload validates a valid PDF and stores its attachment', async () => {
  const calls = [];

  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql) {
      calls.push(sql);

      if (sql.includes('FROM orders o')) {
        return [[{ id: '1', clientId: '2' }]];
      }
      if (sql.includes('FROM quotations q')) {
        return [[{ id: '3', status: 'sent', downpaymentPercent: 20 }]];
      }
      if (sql.includes('SELECT action FROM audit_events')) {
        return [[{ action: 'quotation.accepted' }]];
      }
      if (sql.includes('FROM purchase_orders WHERE')) {
        return [[{ id: '4', reference: 'PO-TEST' }]];
      }
      if (sql.startsWith('INSERT INTO files')) {
        return [{ affectedRows: 1, insertId: 5 }];
      }
      if (sql.startsWith('UPDATE files')) {
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith('INSERT INTO purchase_order_files')) {
        return [{ affectedRows: 1 }];
      }
      return [{ affectedRows: 1 }];
    }
  };

  const service = createDocumentWorkflowsService({
    db: { async getConnection() { return connection; } },
    storage: createMockDocumentStorage()
  });

  const result = await service.uploadPurchaseOrder({
    clientId: '2',
    userId: '6',
    orderId: '1',
    reference: 'PO-TEST',
    file: {
      filename: 'purchase-order.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7\nsynthetic test document')
    }
  });

  assert.equal(result.success, true, JSON.stringify(result));
  assert.ok(calls.some(sql => sql.startsWith('INSERT INTO files')));
});

test('payment-proof upload accepts a valid PDF and links its attachment', async () => {
  const calls = [];
  let committed = false;

  const connection = {
    async beginTransaction() {},
    async commit() { committed = true; },
    async rollback() {},
    release() {},
    async execute(sql) {
      calls.push(sql);

      if (sql.includes('FROM invoices i JOIN orders o')) {
        return [[{
          invoiceId: '10',
          orderId: '1',
          clientId: '2',
          requiredDownpayment: '500.00',
          sentAt: '2026-11-18',
          purchaseOrderId: '4',
          receivedAt: '2026-11-18',
          clearedAt: '2026-11-18'
        }]];
      }
      if (sql.startsWith('INSERT INTO payments')) {
        return [{ affectedRows: 1, insertId: 20 }];
      }
      if (sql.startsWith('INSERT INTO files')) {
        return [{ affectedRows: 1, insertId: 21 }];
      }
      if (sql.startsWith('UPDATE files')) {
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith('INSERT INTO payment_files')) {
        return [{ affectedRows: 1 }];
      }
      return [{ affectedRows: 1 }];
    }
  };

  const service = createDocumentWorkflowsService({
    db: { async getConnection() { return connection; } },
    storage: createMockDocumentStorage()
  });

  const result = await service.uploadPaymentProof({
    clientId: '2',
    userId: '6',
    orderId: '1',
    invoiceId: '10',
    amount: '500.00',
    method: 'bank_transfer',
    referenceNumber: 'TEST-REFERENCE',
    file: {
      filename: 'payment-proof.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7\nsynthetic payment proof')
    }
  });

  assert.equal(result.success, true, JSON.stringify(result));
  assert.equal(committed, true);
  assert.ok(calls.some(sql => sql.startsWith('INSERT INTO files')));
  assert.ok(calls.some(sql => sql.startsWith('INSERT INTO payment_files')));
});

test('D07 review queue returns one proof-only representative per payment without hiding recorded decisions', async () => {
  const payments = [
    { id: '9007199254740993', paymentType: 'DOWNPAYMENT', verificationStatus: 'pending', attachments: [] },
    { id: '9007199254740994', paymentType: 'DOWNPAYMENT', verificationStatus: 'pending', attachments: [{ id: '1', purpose: 'receipt' }] },
    { id: '9007199254740995', paymentType: 'DOWNPAYMENT', verificationStatus: 'pending', attachments: [{ id: '10', purpose: 'proof_of_payment' }, { id: '1', purpose: 'receipt' }, { id: '2', purpose: 'proof_of_payment' }] },
    { id: '9007199254740996', paymentType: 'DOWNPAYMENT', verificationStatus: 'verified', attachments: [{ id: '9007199254740995', purpose: 'proof_of_payment' }] },
    { id: '9007199254740997', paymentType: 'DOWNPAYMENT', verificationStatus: 'rejected', attachments: [{ id: '3', purpose: 'proof_of_payment' }] },
    { id: '9007199254740998', paymentType: 'BALANCE_PAYMENT', verificationStatus: 'pending', attachments: [{ id: '4', purpose: 'proof_of_payment' }] },
  ];
  const calls = [];
  const connection = {
    async execute(sql) {
      calls.push(sql);
      assert.match(sql, /pf.file_id=\(SELECT MIN\(proof.file_id\) FROM payment_files proof\s+WHERE proof.payment_id=p.id AND proof.purpose='proof_of_payment'\)/);
      assert.match(sql, /JOIN payment_files pf ON pf.payment_id=p.id AND pf.purpose='proof_of_payment'/);
      assert.match(sql, /WHERE p.payment_type='DOWNPAYMENT' ORDER BY p.submitted_at DESC, p.id DESC/);
      assert.doesNotMatch(sql, /verification_status='pending'|SUM\(DISTINCT/i);
      // SQL shape assertions protect the one-row contract. These synthetic rows
      // model that contract; they do not execute or validate MySQL SQL syntax.
      return [payments.filter(row => row.paymentType === 'DOWNPAYMENT').flatMap(row => {
        const proof = row.attachments.filter(file => file.purpose === 'proof_of_payment')
          .toSorted((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0)[0];
        return proof ? [{ id: row.id, orderId: '91', invoiceId: '601', fileId: proof.id, verificationStatus: row.verificationStatus, submittedAmount: '20.00' }] : [];
      })];
    }, release() {},
  };
  const service = createDocumentWorkflowsService({ db: { async getConnection() { return connection; } }, storage: createMockDocumentStorage() });
  const result = await service.paymentQueue();
  assert.equal(result.data.length, 3);
  assert.equal(new Set(result.data.map(row => row.id)).size, 3);
  assert.deepEqual(result.data.map(row => row.fileId), ['2', '9007199254740995', '3']);
  assert.deepEqual(result.data.map(row => row.verificationStatus), ['pending', 'verified', 'rejected']);
  assert.equal(calls.length, 1);
});

test('D07 leaves payment verification, required amounts and rejection rules intact', async () => {
  for (const scenario of [
    { decision: 'verified', status: 'pending', amount: '20.00', success: true },
    { decision: 'rejected', status: 'pending', amount: '20.00', reason: 'Proof mismatch', success: true },
    { decision: 'rejected', status: 'pending', amount: '20.00', reason: '', code: 'VALIDATION_ERROR' },
    { decision: 'verified', status: 'verified', amount: '20.00', code: 'PAYMENT_ALREADY_DECIDED' },
    { decision: 'verified', status: 'rejected', amount: '20.00', code: 'PAYMENT_ALREADY_DECIDED' },
    { decision: 'verified', status: 'pending', amount: '7.00', code: 'DOWNPAYMENT_AMOUNT_MISMATCH' },
  ]) {
    const calls = [];
    const connection = {
      async beginTransaction() {}, async commit() { calls.push('COMMIT'); }, async rollback() { calls.push('ROLLBACK'); }, release() {},
      async execute(sql, params) {
        calls.push({ sql, params });
        if (sql.includes('FROM payments p JOIN invoices i')) return [[{ id: '901', verificationStatus: scenario.status, submittedAmount: scenario.amount, requiredDownpayment: '20.00' }]];
        if (/^(UPDATE payments|INSERT INTO audit_events)/.test(sql)) return [{ affectedRows: 1 }];
        throw new Error(`Unexpected SQL in review regression: ${sql}`);
      },
    };
    const service = createDocumentWorkflowsService({ db: { async getConnection() { return connection; } }, storage: createMockDocumentStorage() });
    const result = await service.reviewPayment({ paymentId: '901', actorId: '9', decision: scenario.decision, reason: scenario.reason });
    if (scenario.success) {
      assert.equal(result.success, true);
      assert.equal(result.data.verificationStatus, scenario.decision);
      assert.equal(result.data.verifiedAmount, scenario.decision === 'verified' ? '20.00' : null);
      assert.ok(calls.includes('COMMIT'));
      const write = calls.find(call => call.sql?.startsWith('UPDATE payments'));
      assert.match(write.sql, /WHERE id=\? AND verification_status='pending'/);
    } else {
      assert.equal(result.code, scenario.code);
      assert.equal(calls.some(call => /^UPDATE|^INSERT/.test(call.sql ?? '')), false);
    }
  }
});
