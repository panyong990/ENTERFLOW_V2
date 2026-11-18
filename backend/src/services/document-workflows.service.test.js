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
