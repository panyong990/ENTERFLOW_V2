import test from 'node:test';
import assert from 'node:assert/strict';
import { createSalesOrdersService } from './sales-orders.service.js';

const order = {
  id: '9007199254740993', reference: 'ORD-2026-001', clientId: '7', companyName: 'Acme Filters',
  contactPerson: 'Buyer', stageCode: 'quotation', stageLabel: 'Quotation Sent', stageDisplayOrder: 2,
  paymentTermCode: 'NET15', paymentTermLabel: '15-Day Terms', deliveryMethodCode: null, deliveryMethodLabel: null,
  submittedAt: '2026-01-01T00:00:00.000000Z', urgent: 0, requestedDeliveryDate: null,
  archiveReason: null, archivedAt: null, fulfillmentCompletedAt: null, updatedAt: '2026-01-01T00:00:00.000000Z',
  quotationCount: 2, latestQuotationReference: 'Q-1', latestQuotationStatus: 'sent', latestQuotationRevision: 1,
  purchaseOrderReference: null, purchaseOrderReceivedAt: null, jobOrderCount: 0, invoiceReference: null,
  invoiceAmount: null, verifiedPaymentAmount: '0'
};

function database({ rows = [order], detailRows = [order] } = {}) {
  const calls = [];
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT COUNT(*)')) return [[{ total: rows.length }]];
      if (sql.startsWith('SELECT CAST(o.id AS CHAR) id')) return [sql.includes('WHERE o.id=?') ? detailRows : rows];
      if (sql.includes('FROM order_items')) return [[{ id: '11', lineNumber: 1, quantity: 10, specificationId: '22', filterTypeCode: 'OILSEP', filterName: 'Filter' }]];
      if (sql.includes('FROM quotations q')) return [[{ id: '31', reference: 'Q-1', revisionNumber: 1, status: 'sent', noteHighlighted: 0 }]];
      if (sql.includes('FROM quotation_lines')) return [[{ id: '41', quotationId: '31', lineNumber: 1, description: 'Filter' }]];
      if (sql.includes('FROM purchase_orders')) return [[]];
      if (sql.includes('FROM job_orders')) return [[]];
      if (sql.includes('FROM invoices')) return [[]];
      if (sql.includes('FROM payments')) return [[]];
      if (sql.includes('FROM shipments')) return [[]];
      if (sql.includes('FROM order_requests')) return [[]];
      return [rows];
    },
    release() {}
  };
  return { db: { async getConnection() { return connection; } }, calls };
}

test('Sales order list is company-wide, filtered, sorted, paginated, and not duplicated', async () => {
  const h = database({ rows: [order] });
  const result = await createSalesOrdersService(h).list({ q: 'Acme', status: 'open', stage: 'quotation', sort: 'submitted-desc', page: '2', pageSize: '10' });
  assert.equal(result.success, true);
  assert.equal(result.data.items.length, 1);
  assert.equal(result.data.items[0].id, '9007199254740993');
  assert.equal(result.data.items[0].archived, false);
  assert.equal(h.calls.length, 2);
  assert.match(h.calls[1].sql, /ORDER BY o\.submitted_at DESC, o\.id DESC/);
  assert.deepEqual(h.calls[1].params.slice(-2), ['10', '0']);
});

test('Sales order detail preserves BIGINT IDs and loads related records independently', async () => {
  const h = database();
  const result = await createSalesOrdersService(h).detail('9007199254740993');
  assert.equal(result.success, true);
  assert.equal(result.data.id, '9007199254740993');
  assert.equal(result.data.items.length, 1);
  assert.equal(result.data.items[0].specificationId, '22');
  assert.equal(result.data.quotations[0].lines[0].quotationId, '31');
  assert.deepEqual(result.data.jobOrders, []);
  assert.deepEqual(result.data.payments, []);
  assert.ok(h.calls.length >= 8);
});

test('Sales order detail returns not found and validates IDs before SQL', async () => {
  const missing = database({ detailRows: [] });
  assert.deepEqual(await createSalesOrdersService(missing).detail('1'), { success: false, code: 'NOT_FOUND' });
  const invalid = database();
  assert.equal((await createSalesOrdersService(invalid).detail('0')).code, 'VALIDATION_ERROR');
  assert.equal(invalid.calls.length, 0);
});

test('Sales order list rejects unsupported query fields', async () => {
  const h = database();
  assert.equal((await createSalesOrdersService(h).list({ creatorId: '8' })).code, 'VALIDATION_ERROR');
  assert.equal(h.calls.length, 0);
});
