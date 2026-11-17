import test from 'node:test';
import assert from 'node:assert/strict';
import { createClientPortalService } from './client-portal.service.js';

test('owned rejection history exposes approved narrative and date without archival actor or audit data',async()=>{
  const row={id:'91',reference:'INQ-91',stageLabel:'Inquiry',archiveReason:'rejected',archiveNote:'Synthetic reason',archivedAt:'2026-11-17T00:00:00Z',archivedBy:'7',audit:'private',itemCount:0};
  const h=harness({orderRows:[row]});const result=await h.service.detailOrder('2','91');
  assert.equal(result.data.archiveReason,'rejected');assert.equal(result.data.archiveNote,'Synthetic reason');assert.equal(result.data.archivedAt,row.archivedAt);
  assert.equal('archivedBy' in result.data,false);assert.equal('audit' in result.data,false);
  assert.deepEqual(h.calls[0].params,['91','2']);assert.match(h.calls[0].sql,/WHERE o.id=\? AND o.client_id=\?/);
});
test('another client cannot retrieve rejection narrative from a missing owned parent',async()=>{
  const h=harness();const result=await h.service.detailOrder('3','91');assert.equal(result.code,'NOT_FOUND');assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0].params,['91','3']);
});

function harness({ profileRows = [], orderRows = [], itemRows = [], quotationRows = [], quotationLineRows = [], purchaseOrderRows = [], jobOrderRows = [], shipmentRows = [], invoiceRows = [], paymentRows = [], dashboardCounts = {}, activityRows = [], deliveryRows = [], total = 0 } = {}) {
  const calls = [];
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params });
      if (/activeOrders/.test(sql)) return [[dashboardCounts]];
      if (/SELECT COUNT\(\*\) total/.test(sql)) return [[{ total }]];
      if (/WHERE o\.id=\? AND o\.client_id=\?/.test(sql)) return [orderRows];
      if (/LIMIT \? OFFSET \?/.test(sql)) return [orderRows];
      if (/FROM orders o JOIN order_stages/.test(sql)) return [activityRows];
      if (/FROM shipments s JOIN orders/.test(sql)) return [deliveryRows];
      if (/FROM clients/.test(sql)) return [profileRows];
      if (/FROM orders/.test(sql)) return [orderRows];
      if (/FROM order_items/.test(sql)) return [itemRows];
      if (/FROM quotation_lines/.test(sql)) return [quotationLineRows];
      if (/FROM quotations/.test(sql)) return [quotationRows];
      if (/FROM purchase_orders/.test(sql)) return [purchaseOrderRows];
      if (/FROM job_orders/.test(sql)) return [jobOrderRows];
      if (/FROM shipments/.test(sql)) return [shipmentRows];
      if (/FROM invoices/.test(sql)) return [invoiceRows];
      if (/FROM payments/.test(sql)) return [paymentRows];
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {}
  };
  return { calls, service: createClientPortalService({ db: { getConnection: async () => connection } }) };
}

test('profile projection excludes internal notes and preserves BIGINT id', async () => {
  const h = harness({ profileRows: [{ id: '9007199254740993', companyName: 'Acme', active: 1, internalNotes: 'private' }] });
  const result = await h.service.profile('9007199254740993');
  assert.equal(result.success, true);
  assert.equal(result.data.id, '9007199254740993');
  assert.equal(result.data.active, true);
  assert.equal('internalNotes' in result.data, false);
  assert.doesNotMatch(h.calls[0].sql, /internal_notes/);
  assert.deepEqual(h.calls[0].params, ['9007199254740993']);
});

test('order list is scoped by authenticated client, supports pagination, and hides stage code', async () => {
  const h = harness({ total: 1, orderRows: [{ id: '9007199254740993', stageCode: 'inquiry', stageLabel: 'Inquiry', itemCount: '2', generalNotes: 'private' }] });
  const result = await h.service.listOrders('21', { page: '1', pageSize: '10', sort: 'id-desc' });
  assert.equal(result.success, true);
  assert.equal(result.data.items[0].id, '9007199254740993');
  assert.equal(result.data.items[0].itemCount, 2);
  assert.equal('stageCode' in result.data.items[0], false);
  assert.equal('generalNotes' in result.data.items[0], false);
  assert.match(h.calls[0].sql, /o\.client_id=\?/);
  assert.deepEqual(h.calls[0].params, ['21']);
  assert.deepEqual(h.calls[1].params.slice(-2), ['10', '0']);
});

test('order detail scopes parent and child rows to authenticated client and retains item BIGINT ids', async () => {
  const h = harness({
    orderRows: [{ id: '9007199254740993', stageCode: 'quotation', stageLabel: 'Quotation', itemCount: '1' }],
    itemRows: [{ id: '9007199254740994', specificationId: '9007199254740995', quantity: '3' }]
  });
  const result = await h.service.detailOrder('21', '9007199254740993');
  assert.equal(result.success, true);
  assert.equal(result.data.id, '9007199254740993');
  assert.equal(result.data.items[0].id, '9007199254740994');
  assert.equal(result.data.items[0].specificationId, '9007199254740995');
  assert.match(h.calls[0].sql, /o\.id=\? AND o\.client_id=\?/);
  assert.deepEqual(h.calls[0].params, ['9007199254740993', '21']);
  assert.match(h.calls[1].sql, /oi\.order_id=\? AND oi\.client_id=\?/);
  assert.deepEqual(h.calls[1].params, ['9007199254740993', '21']);
});

test('invalid client identity is rejected before database access', async () => {
  const h = harness();
  const result = await h.service.listOrders(null, {});
  assert.equal(result.success, false);
  assert.equal(result.code, 'FORBIDDEN');
  assert.equal(h.calls.length, 0);
});

test('quotation history is client-scoped, excludes drafts, preserves IDs and decimal strings, and omits internal fields', async () => {
  const h = harness({
    orderRows: [{ id: '1' }],
    quotationRows: [{ id: '9007199254740993', reference: 'Q-1', revisionNumber: '2', status: 'sent', totalAmount: '1234567890123.45', downpaymentAmount: '100.10', internalNote: 'private' }],
    quotationLineRows: [{ id: '9007199254740994', quotationId: '9007199254740993', description: 'Filter', quantity: '2.00', unitPrice: '10.25', laborCost: 'private' }]
  });
  const result = await h.service.quotations('21', '1');
  assert.equal(result.success, true);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].id, '9007199254740993');
  assert.equal(result.data[0].totalAmount, '1234567890123.45');
  assert.equal(result.data[0].lines[0].id, '9007199254740994');
  assert.equal(result.data[0].lines[0].unitPrice, '10.25');
  assert.equal('internalNote' in result.data[0], false);
  assert.equal('laborCost' in result.data[0].lines[0], false);
  assert.match(h.calls[0].sql, /id=\? AND client_id=\?/);
  assert.match(h.calls[1].sql, /q\.status <> 'draft'/);
  assert.match(h.calls[2].sql, /q\.status <> 'draft'/);
});

test('quotation endpoint returns an empty array and purchase order returns null for an owned order without records', async () => {
  const h = harness({ orderRows: [{ id: '1' }] });
  const quotations = await h.service.quotations('21', '1');
  const purchaseOrder = await h.service.purchaseOrder('21', '1');
  assert.deepEqual(quotations.data, []);
  assert.equal(purchaseOrder.success, true);
  assert.equal(purchaseOrder.data, null);
});

test('purchase order projection preserves BIGINT IDs and timestamps without status or storage metadata', async () => {
  const h = harness({
    orderRows: [{ id: '1' }],
    purchaseOrderRows: [{ id: '9007199254740995', acceptedQuotationId: '9007199254740993', acceptedQuotationReference: 'Q-2', reference: 'PO-1', clientReference: 'CLIENT-PO', uploadedAt: '2026-01-01T00:00:00.000000Z', receivedAt: null, clearedAt: null, status: 'invented', storagePath: 'private' }]
  });
  const result = await h.service.purchaseOrder('21', '1');
  assert.equal(result.success, true);
  assert.equal(result.data.id, '9007199254740995');
  assert.equal(result.data.acceptedQuotationId, '9007199254740993');
  assert.equal('status' in result.data, false);
  assert.equal('storagePath' in result.data, false);
  assert.equal(result.data.receivedAt, null);
});

test('job-order projection maps grounded statuses, preserves IDs, and excludes internal production data', async () => {
  const h = harness({
    orderRows: [{ id: '1' }],
    jobOrderRows: [{ id: '9007199254740996', reference: 'JO-1', quantity: 4, productionDueDate: '2026-03-01', status: 'in_production', productionStageLabel: 'Assembling', completedAt: null, currentStageCursor: 3, pauseReason: 'private' }]
  });
  const result = await h.service.jobOrders('21', '1');
  assert.equal(result.success, true);
  const job = result.data.jobOrders[0];
  assert.equal(job.id, '9007199254740996');
  assert.equal(job.status, 'In production');
  assert.equal(job.productionStageLabel, 'Assembling');
  assert.equal(job.completed, false);
  assert.equal('currentStageCursor' in job, false);
  assert.equal('pauseReason' in job, false);
  assert.match(h.calls[0].sql, /id=\? AND client_id=\?/);
  assert.match(h.calls[1].sql, /jo\.order_id=\? AND jo\.client_id=\?/);
  assert.deepEqual(h.calls[1].params, ['1', '21']);
});

test('delivery projection maps grounded statuses, preserves IDs, and excludes tracking links and internal actors', async () => {
  const h = harness({
    orderRows: [{ id: '1' }],
    shipmentRows: [{ id: '9007199254740997', jobOrderId: '9007199254740996', deliveryMethodLabel: 'Lalamove', status: 'in_transit', trackingReference: 'TRACK-1', trackingLink: 'private/unvalidated', dispatchedAt: '2026-03-02T00:00:00.000000Z', driverName: 'private', vehiclePlate: 'private' }]
  });
  const result = await h.service.delivery('21', '1');
  assert.equal(result.success, true);
  const shipment = result.data.shipments[0];
  assert.equal(shipment.id, '9007199254740997');
  assert.equal(shipment.jobOrderId, '9007199254740996');
  assert.equal(shipment.status, 'In transit');
  assert.equal(shipment.trackingReference, 'TRACK-1');
  assert.equal('trackingLink' in shipment, false);
  assert.equal('driverName' in shipment, false);
  assert.equal('vehiclePlate' in shipment, false);
});

test('job-order and delivery reads return empty collections for an owned order', async () => {
  const h = harness({ orderRows: [{ id: '1' }] });
  assert.deepEqual((await h.service.jobOrders('21', '1')).data.jobOrders, []);
  assert.deepEqual((await h.service.delivery('21', '1')).data.shipments, []);
});

test('invoice reads include sent invoices only, preserve IDs and decimals, and exclude accounting internals', async () => {
  const h = harness({
    orderRows: [{ id: '1' }],
    invoiceRows: [{ id: '9007199254740998', reference: 'INV-1', issuedOn: '2026-03-01', dueOn: '2026-03-31', paymentTermLabel: '30 days', amount: '1234567890123.45', requiredDownpayment: '100.10', sentAt: '2026-03-01T00:00:00.000000Z', createdBy: 'private', sentBy: 'private' }]
  });
  const result = await h.service.invoices('21', '1');
  assert.equal(result.success, true);
  assert.equal(result.data[0].id, '9007199254740998');
  assert.equal(result.data[0].amount, '1234567890123.45');
  assert.equal(result.data[0].requiredDownpayment, '100.10');
  assert.equal('createdBy' in result.data[0], false);
  assert.equal('sentBy' in result.data[0], false);
  assert.match(h.calls[1].sql, /i\.sent_at IS NOT NULL/);
});

test('payment reads preserve submitted and verified amounts and hide review metadata', async () => {
  const h = harness({
    orderRows: [{ id: '1' }],
    paymentRows: [
      { id: '9007199254740999', invoiceId: null, paymentType: 'DOWNPAYMENT', submittedAmount: '100.10', verifiedAmount: null, method: 'Bank', referenceNumber: 'PAY-1', paidOn: '2026-03-02', verificationStatus: 'pending', submittedAt: '2026-03-02T00:00:00.000000Z', reviewedBy: 'private', note: 'private' },
      { id: '9007199254741000', invoiceId: '8', paymentType: 'BALANCE_PAYMENT', submittedAmount: '200.20', verifiedAmount: '200.20', method: 'Bank', referenceNumber: 'PAY-2', paidOn: '2026-03-03', verificationStatus: 'verified', submittedAt: '2026-03-03T00:00:00.000000Z', reviewedBy: 'private' }
    ]
  });
  const result = await h.service.payments('21', '1');
  assert.equal(result.success, true);
  assert.equal(result.data[0].id, '9007199254740999');
  assert.equal(result.data[0].submittedAmount, '100.10');
  assert.equal(result.data[0].verifiedAmount, null);
  assert.equal(result.data[1].id, '9007199254741000');
  assert.equal(result.data[1].submittedAmount, '200.20');
  assert.equal(result.data[1].verifiedAmount, '200.20');
  assert.equal('reviewedBy' in result.data[0], false);
  assert.equal('note' in result.data[0], false);
});

test('invoice and payment reads return empty collections for an owned order', async () => {
  const h = harness({ orderRows: [{ id: '1' }] });
  assert.deepEqual((await h.service.invoices('21', '1')).data, []);
  assert.deepEqual((await h.service.payments('21', '1')).data, []);
});

test('dashboard aggregates are client-scoped, use safe counts, and preserve activity/delivery BIGINT IDs', async () => {
  const h = harness({
    dashboardCounts: { activeOrders: '3', pendingInquiries: '1', sentQuotations: '2', openInvoices: '1', internalRevenue: '999' },
    activityRows: [{ id: '9007199254741001', reference: 'ORD-1', stageLabel: 'In Production', updatedAt: '2026-03-01T00:00:00.000000Z', submittedAt: '2026-02-01T00:00:00.000000Z', stageCode: 'private' }],
    deliveryRows: [{ id: '9007199254741002', orderId: '9007199254741003', jobOrderId: '9007199254741004', deliveryMethodLabel: 'Lalamove', status: 'in_transit', trackingReference: 'TRACK-1', estimatedDeliveryDate: '2026-03-10', expectedPickupDate: null, driverName: 'private' }]
  });
  const result = await h.service.dashboard('21');
  assert.equal(result.success, true);
  assert.deepEqual({ activeOrders: result.data.activeOrders, pendingInquiries: result.data.pendingInquiries, sentQuotations: result.data.sentQuotations, openInvoices: result.data.openInvoices }, { activeOrders: 3, pendingInquiries: 1, sentQuotations: 2, openInvoices: 1 });
  assert.equal(result.data.recentOrderActivity[0].id, '9007199254741001');
  assert.equal('stageCode' in result.data.recentOrderActivity[0], false);
  assert.equal(result.data.upcomingDeliveries[0].orderId, '9007199254741003');
  assert.equal(result.data.upcomingDeliveries[0].status, 'In transit');
  assert.equal('driverName' in result.data.upcomingDeliveries[0], false);
  assert.equal(h.calls.length, 3);
  assert.deepEqual(h.calls[0].params, ['21', '21', '21', '21']);
  assert.deepEqual(h.calls[1].params, ['21']);
  assert.deepEqual(h.calls[2].params, ['21']);
});

test('dashboard safely handles empty data without financial totals', async () => {
  const h = harness({ dashboardCounts: { activeOrders: 0, pendingInquiries: 0, sentQuotations: 0, openInvoices: 0 } });
  const result = await h.service.dashboard('21');
  assert.deepEqual(result.data, { activeOrders: 0, pendingInquiries: 0, sentQuotations: 0, openInvoices: 0, recentOrderActivity: [], upcomingDeliveries: [] });
  assert.equal('revenue' in result.data, false);
  assert.equal('verifiedPayments' in result.data, false);
});
