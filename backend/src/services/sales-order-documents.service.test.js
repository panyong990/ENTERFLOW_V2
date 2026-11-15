import test from 'node:test';
import assert from 'node:assert/strict';
import { createSalesOrdersService } from './sales-orders.service.js';

function database({ orderExists = true, quotationRows = [], poRows = [] } = {}) {
  const calls = [];
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql === 'SELECT id FROM orders WHERE id=?') return [orderExists ? [{ id: '9007199254740993' }] : []];
      if (sql.includes('FROM quotations q JOIN payment_terms')) return [quotationRows];
      if (sql.includes('FROM quotation_lines')) return [[{ id: '41', quotationId: '31', lineNumber: 1, orderItemId: '51', description: 'Filter', quantity: '10.0000', unitPrice: '125.2500' }]];
      if (sql.includes('FROM quotation_costing')) return [[{ id: '61', quotationId: '31', orderItemId: '51', laborCost: '10.2500', markupPercent: '20.0000', includeLabor: 1, applyMarkup: 1, applyVat: 0 }]];
      if (sql.includes('FROM quotation_discounts')) return [[{ quotationId: '31', lineNumber: 1, label: 'Trade', percent: '5.0000' }]];
      if (sql.includes('FROM quotation_addons')) return [[{ id: '71', quotationId: '31', kind: 'shipping', includeInUnitPrice: 0 }]];
      if (sql.includes('FROM quotation_files')) return [[{ quotationId: '31', id: '81', purpose: 'signed_quotation', originalFilename: 'quote.pdf', mimeType: 'application/pdf', sizeBytes: '100', state: 'available' }]];
      if (sql.includes('FROM purchase_orders po')) return [poRows];
      if (sql.includes('FROM purchase_order_files')) return [[{ purchaseOrderId: '91', id: '101', purpose: 'client_document', originalFilename: 'po.pdf', mimeType: 'application/pdf', sizeBytes: '200', state: 'available' }]];
      return [[]];
    },
    release() {}
  };
  return { db: { async getConnection() { return connection; } }, calls };
}

const quotation = {
  id: '31', reference: 'Q-2026-001', revisionNumber: 1, status: 'sent', issuedOn: '2026-01-01', validUntil: '2026-01-31',
  paymentTermCode: 'NET15', paymentTermLabel: '15-Day Terms', timeOfDelivery: '14 days', placeOfDelivery: 'Client site',
  totalAmount: '1252.5000', downpaymentPercent: '30.0000', downpaymentAmount: '375.7500', noteHighlighted: 0, sentAt: '2026-01-02T00:00:00.000000Z'
};

test('quotation history preserves revisions, exact monetary strings, safe files, and no duplicate revisions', async () => {
  const h = database({ quotationRows: [quotation, { ...quotation, id: '32', revisionNumber: 2, status: 'superseded', sentAt: null }] });
  const result = await createSalesOrdersService(h).quotations('9007199254740993');
  assert.equal(result.success, true);
  assert.equal(result.data.length, 2);
  assert.equal(result.data[0].revisionNumber, 1);
  assert.equal(result.data[1].status, 'superseded');
  assert.equal(result.data[0].totalAmount, '1252.5000');
  assert.equal(result.data[0].downpaymentAmount, '375.7500');
  assert.equal(result.data[0].lines.length, 1);
  assert.equal(result.data[0].costing[0].laborCost, '10.2500');
  assert.equal(result.data[0].files[0].originalFilename, 'quote.pdf');
  assert.equal('objectPath' in result.data[0].files[0], false);
  assert.equal(h.calls.filter(call => call.sql.includes('FROM quotations q JOIN payment_terms')).length, 1);
});

test('quotation reads verify order ownership and return an empty history for an existing order', async () => {
  const empty = database({ quotationRows: [] });
  assert.deepEqual(await createSalesOrdersService(empty).quotations('1'), { success: true, data: [] });
  const missing = database({ orderExists: false });
  assert.deepEqual(await createSalesOrdersService(missing).quotations('1'), { success: false, code: 'NOT_FOUND' });
  assert.equal(missing.calls.length, 1);
});

test('purchase-order read returns accepted quotation, lifecycle timestamps, metadata only, and preserves IDs', async () => {
  const h = database({ poRows: [{ id: '91', acceptedQuotationId: '31', acceptedQuotationReference: 'Q-2026-001', reference: 'PO-2026-001', clientReference: 'CLIENT-7', uploadedAt: '2026-01-03T00:00:00.000000Z', receivedAt: null, clearedAt: null }] });
  const result = await createSalesOrdersService(h).purchaseOrder('9007199254740993');
  assert.equal(result.success, true);
  assert.equal(result.data.id, '91');
  assert.equal(result.data.acceptedQuotationId, '31');
  assert.equal(result.data.received, false);
  assert.equal(result.data.files[0].id, '101');
  assert.equal('objectPath' in result.data.files[0], false);
});

test('purchase-order read distinguishes missing order from missing purchase order and validates IDs', async () => {
  const noPo = database({ poRows: [] });
  assert.deepEqual(await createSalesOrdersService(noPo).purchaseOrder('1'), { success: false, code: 'PURCHASE_ORDER_NOT_FOUND' });
  const noOrder = database({ orderExists: false });
  assert.deepEqual(await createSalesOrdersService(noOrder).purchaseOrder('1'), { success: false, code: 'NOT_FOUND' });
  const invalid = database();
  assert.equal((await createSalesOrdersService(invalid).purchaseOrder('0')).code, 'VALIDATION_ERROR');
  assert.equal(invalid.calls.length, 0);
});
