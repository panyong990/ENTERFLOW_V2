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

function stockDatabase({ unmapped = false, noFinishedGoods = false } = {}) {
  const calls = [];
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('FROM orders o WHERE o.id')) return [[{ id: '9007199254740993', clientId: '7' }]];
      if (sql.includes('FROM order_items')) return [[{ itemId: '11', quantity: 2, specificationId: '22', filterTypeCode: 'OILSEP', filterName: 'Oil separator', height: 300, oemPartNumber: 'OEM-1' }]];
      if (sql.includes('FROM bom_templates')) return [unmapped ? [] : [{ templateId: '51', sizeLabel: 'Medium', materialId: '61', quantityPerFilter: 3, inventoryName: 'Media', categoryCode: 'media', unitCode: 'pcs', inventoryId: '61', availableQuantity: 4 }]];
      if (sql.includes('FROM finished_goods')) return noFinishedGoods ? [[]] : [[{ inventoryId: '71', itemCode: 'FG-1', partNumber: 'OEM-1', availableQuantity: 1, bufferMinimum: 1, unitCode: 'pcs', demand: '2' }]];
      throw new Error(`Unexpected SQL in stock test: ${sql}`);
    },
    release() {}
  };
  return { db: { async getConnection() { return connection; } }, calls };
}

test('Sales stock availability maps existing BOM and finished-good records without changing stock', async () => {
  const h = stockDatabase();
  const result = await createSalesOrdersService(h).stockAvailability('9007199254740993');
  assert.equal(result.success, true);
  assert.equal(result.data.overallStatus, 'insufficient');
  assert.equal(result.data.stockChanged, false);
  assert.deepEqual(result.data.assessments.map(item => [item.classification, item.requiredQuantity, item.availableQuantity, item.shortageQuantity]), [
    ['raw_material', 6, 4, 2], ['finished_good', 2, 1, 1]
  ]);
  assert.equal(h.calls.some(call => /\b(UPDATE|INSERT|DELETE)\b/i.test(call.sql)), false);
});

test('Sales stock availability reports unmapped products instead of inventing zero stock', async () => {
  const h = stockDatabase({ unmapped: true, noFinishedGoods: true });
  const result = await createSalesOrdersService(h).stockAvailability('9007199254740993');
  assert.equal(result.success, true);
  assert.equal(result.data.overallStatus, 'unmapped');
  assert.equal(result.data.assessments.length, 0);
  assert.equal(result.data.unmappedItems.length, 1);
});

test('Sales stock availability validates the order identifier before opening a database connection', async () => {
  const h = stockDatabase();
  assert.equal((await createSalesOrdersService(h).stockAvailability('0')).code, 'VALIDATION_ERROR');
  assert.equal(h.calls.length, 0);
});

function quotationDatabase({ missingPrice = false } = {}) {
  const calls = [];
  let insertedId = 100;
  const connection = {
    async beginTransaction() { calls.push({ sql: 'BEGIN' }); },
    async commit() { calls.push({ sql: 'COMMIT' }); },
    async rollback() { calls.push({ sql: 'ROLLBACK' }); },
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('FROM orders o WHERE o.id=? FOR UPDATE')) return [[{ id: '91', clientId: '7', reference: 'ORD-91', stageCode: 'inquiry', archivedAt: null, paymentTermCode: 'NET15' }]];
      if (sql.includes('FROM order_items')) return [[{ orderItemId: '11', quantity: 2, specificationId: '22', filterTypeCode: 'OILSEP', filterName: 'Oil separator', height: 300 }]];
      if (sql.includes('FROM bom_templates')) return [[{ templateId: '51', materialId: '61', quantityPerFilter: 2, wastePercent: 0, materialName: 'Media', unitCode: 'pcs', unitPrice: missingPrice ? null : 10 }]];
      if (sql.includes('FROM quotations WHERE order_id')) return [[]];
      if (sql.includes('FROM quotation_references')) return [[]];
      if (sql.startsWith('INSERT')) return [{ insertId: insertedId++ }];
      if (sql.startsWith('UPDATE')) return [{ affectedRows: 1 }];
      throw new Error(`Unexpected SQL in quotation test: ${sql}`);
    },
    release() {}
  };
  return { db: { async getConnection() { return connection; } }, calls };
}

const quotationBody = {
  status: 'sent', issuedOn: '2026-11-18', validUntil: '2026-12-18', paymentTermCode: 'NET15',
  timeOfDelivery: '14 days', placeOfDelivery: 'Client site', note: 'Prepared estimate', noteHighlighted: false,
  downpaymentPercent: 20, vatType: 'Exclusive', vatRate: 12, includeLabor: true, applyMarkup: true, applyVat: false,
  discountPercent: 0, costing: [{ orderItemId: '11', laborCost: 5, markupPercent: 10 }]
};

test('Sales quotation preparation calculates server-side costing, persists a sent revision, and never writes inventory', async () => {
  const h = quotationDatabase();
  const result = await createSalesOrdersService(h).createQuotation('91', quotationBody, { userId: '8', roleCode: 'sales', accountType: 'employee' });
  assert.equal(result.success, true);
  assert.equal(result.data.totalAmount, '55.00');
  assert.equal(result.data.rawMaterialCost, '40.00');
  assert.equal(result.data.laborCost, '10.00');
  assert.equal(result.data.markupAmount, '5.00');
  assert.equal(result.data.downpaymentAmount, '11.00');
  assert.equal(h.calls.some(call => /\b(UPDATE|INSERT|DELETE)\b/i.test(call.sql) && /materials|finished_goods|quantity_on_hand|stock_responses/i.test(call.sql)), false);
  assert.equal(h.calls.some(call => call.sql === 'COMMIT'), true);
});

test('Sales quotation preparation fails closed when material pricing is missing and leaves the transaction uncommitted', async () => {
  const h = quotationDatabase({ missingPrice: true });
  const result = await createSalesOrdersService(h).createQuotation('91', quotationBody, { userId: '8', roleCode: 'sales', accountType: 'employee' });
  assert.equal(result.success, false);
  assert.equal(result.code, 'MATERIAL_COSTING_INCOMPLETE');
  assert.equal(h.calls.some(call => call.sql === 'COMMIT'), false);
  assert.equal(h.calls.some(call => call.sql === 'ROLLBACK'), true);
});

test('Sales quotation preparation rejects unauthorized actors before opening a transaction', async () => {
  const h = quotationDatabase();
  const result = await createSalesOrdersService(h).createQuotation('91', quotationBody, { userId: '8', roleCode: 'owner', accountType: 'employee' });
  assert.deepEqual(result, { success: false, code: 'FORBIDDEN' });
  assert.equal(h.calls.length, 0);
});

test('Sales quotation preparation requires a mandatory 20% or 50% downpayment', async () => {
  for (const downpaymentPercent of [undefined, 0, 10, 100]) {
    const h = quotationDatabase();
    const body = { ...quotationBody };
    if (downpaymentPercent === undefined) delete body.downpaymentPercent;
    else body.downpaymentPercent = downpaymentPercent;
    const result = await createSalesOrdersService(h).createQuotation('91', body, { userId: '8', roleCode: 'sales', accountType: 'employee' });
    assert.equal(result.success, false);
    assert.equal(result.code, 'VALIDATION_ERROR');
    assert.equal(h.calls.length, 0);
  }
  for (const downpaymentPercent of [20, 50]) {
    const h = quotationDatabase();
    const result = await createSalesOrdersService(h).createQuotation('91', { ...quotationBody, downpaymentPercent }, { userId: '8', roleCode: 'sales', accountType: 'employee' });
    assert.equal(result.success, true);
    assert.equal(result.data.downpaymentPercent, downpaymentPercent);
  }
});

function jobOrderDatabase({ poDecision = 'purchase_order.validated', existingJobs = [], verifiedAmount = '20.00', invoiceRows = [{ id: '601' }] } = {}) {
  const calls = [];
  let insertId = 501;
  const connection = {
    async beginTransaction() { calls.push({ sql: 'BEGIN' }); },
    async commit() { calls.push({ sql: 'COMMIT' }); },
    async rollback() { calls.push({ sql: 'ROLLBACK' }); },
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('FROM orders o WHERE o.id=? FOR UPDATE')) return [[{ id: '91', clientId: '7', stageCode: 'po' }]];
      if (sql.includes('FROM purchase_orders po WHERE po.order_id=? FOR UPDATE')) return [[{ id: '401', acceptedQuotationId: '31', reference: 'PO-1' }]];
      if (sql.includes("subject_type='purchase_order'")) return [[{ action: poDecision }]];
      if (sql.includes('FROM quotations q WHERE q.id=? AND q.order_id=?')) return [[{ id: '31', reference: 'Q-1', revisionNumber: 2, status: 'sent', totalAmount: '100.00', downpaymentPercent: 20, downpaymentAmount: '20.00' }]];
      if (sql.includes('FROM quotations WHERE order_id=?')) return [[{ id: '31' }]];
      if (sql.includes("subject_type='quotation'")) return [[{ action: 'quotation.accepted' }]];
      if (sql.includes('FROM invoices WHERE order_id=?')) return [invoiceRows];
      if (sql.includes('FROM payments p JOIN payment_files') || sql.includes('FROM payments WHERE order_id=?')) return [[{ verifiedAmount }]];
      if (sql.includes('FROM job_orders WHERE order_id=?')) return [existingJobs];
      if (sql.includes('FROM order_items oi')) return [[{ orderItemId: '11', specificationId: '22', inquiryQuantity: 10, quotationQuantity: 10, costingId: '61' }]];
      if (sql.includes('FROM job_orders WHERE reference LIKE')) return [[]];
      if (sql.startsWith('INSERT INTO job_orders')) return [{ affectedRows: 1, insertId: insertId++ }];
      if (sql.startsWith('INSERT INTO audit_events')) return [{ affectedRows: 1 }];
      throw new Error(`Unexpected SQL in Job Order test: ${sql}`);
    },
    release() {}
  };
  return { db: { async getConnection() { return connection; } }, calls };
}

test('Job Order creation requires a validated PO and preserves accepted quote quantities without inventory or production writes', async () => {
  const h = jobOrderDatabase();
  const result = await createSalesOrdersService(h).createJobOrders('91', { userId: '8', roleCode: 'sales', accountType: 'employee' }, { productionDueDate: '2026-12-31' });
  assert.equal(result.success, true);
  assert.equal(result.data.jobOrders[0].status, 'jo');
  assert.equal(result.data.jobOrders[0].quantity, 10);
  assert.equal(result.data.acceptedQuotationId, '31');
  assert.equal(result.data.purchaseOrderId, '401');
  assert.equal(h.calls.some(call => /inventory|material_movements|production_events/i.test(call.sql)), false);
  assert.equal(h.calls.some(call => call.sql === 'COMMIT'), true);
});

test('Job Order creation rejects unvalidated or duplicate transactions before writes', async () => {
  const rejected = jobOrderDatabase({ poDecision: 'purchase_order.rejected' });
  assert.equal((await createSalesOrdersService(rejected).createJobOrders('91', { userId: '8', roleCode: 'sales', accountType: 'employee' }, { productionDueDate: '2026-12-31' })).code, 'PURCHASE_ORDER_NOT_VALIDATED');
  assert.equal(rejected.calls.some(call => /^INSERT/i.test(call.sql)), false);
  const duplicate = jobOrderDatabase({ existingJobs: [{ id: '501', reference: 'JO-2026-0001' }] });
  assert.equal((await createSalesOrdersService(duplicate).createJobOrders('91', { userId: '8', roleCode: 'sales', accountType: 'employee' }, { productionDueDate: '2026-12-31' })).code, 'JOB_ORDER_ALREADY_EXISTS');
});

test('Job Order creation requires Accounting verification of the authoritative quotation downpayment', async () => {
  const pending = jobOrderDatabase({ verifiedAmount: '0.00' });
  const result = await createSalesOrdersService(pending).createJobOrders('91', { userId: '8', roleCode: 'sales', accountType: 'employee' }, { productionDueDate: '2026-12-31' });
  assert.equal(result.code, 'DOWNPAYMENT_NOT_VERIFIED');
  assert.equal(pending.calls.some(call => /^INSERT/i.test(call.sql)), false);
});

test('Job Order creation requires an issued invoice before payment verification can qualify', async () => {
  const missingInvoice = jobOrderDatabase({ invoiceRows: [] });
  const result = await createSalesOrdersService(missingInvoice).createJobOrders('91', { userId: '8', roleCode: 'sales', accountType: 'employee' }, { productionDueDate: '2026-12-31' });
  assert.equal(result.code, 'INVOICE_NOT_ISSUED');
  assert.equal(missingInvoice.calls.some(call => /^INSERT/i.test(call.sql)), false);
});
