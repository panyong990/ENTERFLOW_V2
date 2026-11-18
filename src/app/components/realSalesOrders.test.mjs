import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const screen = await read('./SalesOrders.tsx');
const adapter = await read('./sales/useOriginalSalesAdapter.ts');
const actions = await read('./sales/LiveSalesActions.tsx');
const details = await read('./sales/SalesDocumentSections.tsx');
const orderHook = await read('./useSalesOrders.ts');
const jobHook = await read('./useSalesJobOrders.ts');
const documentsHook = await read('./useSalesOrderDocuments.ts');
const deliveryApi = await read('../api/salesDelivery.js');
const deliveryHook = await read('./useSalesDelivery.ts');

test('Real Sales uses the original status filters and loads all authenticated record pages', () => {
  const options = screen.slice(screen.indexOf('const salesOrdersStatusOptions'), screen.indexOf('function matchesSalesOrdersStatus'));
  for (const value of ['all', 'newInquiry', 'quotationAwaitingPO', 'revisionRequested', 'poPending', 'poApproved', 'poRejected', 'readyForJobOrder', 'invoiceAwaitingPayment', 'invoiceDraft', 'downpaymentPending', 'cancellationRequested']) {
    assert.match(options, new RegExp(`value: "${value}"`));
  }
  assert.match(screen, /aria-label="Filter Sales & Orders by status"/);
  assert.match(screen, /matchesSalesOrdersStatus\(i, statusFilter\)/);
  assert.match(adapter, /listSalesOrders\(\{ q: "", status: "all", stage: "all", sort: "submitted-desc", page, pageSize: 100 \}/);
  assert.match(adapter, /page \* result\.pageSize >= result\.total/);
  assert.match(adapter, /new Map\(rows\.map/);
});

test('Original Sales history separates pending cancellation, cancelled, rejected, and completed records', () => {
  assert.match(screen, /const pendingCancellationRecords = inquiries\.filter/);
  assert.match(screen, /const cancelledRecords = archivedInquiries\.filter\(\(inquiry\) => inquiry\.archiveReason === "cancelled"\)/);
  assert.match(screen, /const rejectedRecords = archivedInquiries\.filter\(\(inquiry\) => inquiry\.archiveReason === "rejected"\)/);
  assert.match(adapter, /fulfillmentCompletedAt/);
  assert.match(screen, /"Cancellation Requests"/);
  assert.match(screen, /"Cancelled"/);
  assert.match(screen, /"Completed"/);
  assert.match(adapter, /archivedInquiries: records\.filter\(record => record\.archived\)/);
  assert.match(adapter, /completedJOs: records\.filter/);
});

test('Sales record history opens the authenticated quotation and purchase-order detail sections', () => {
  assert.match(actions, /View Quotation, PO &amp; Document History/);
  assert.match(actions, /action === "history"\) return <OrderDetail/);
  assert.match(details, /<QuotationHistory quotations=\{documents\.quotations\}/);
  assert.match(details, /<PurchaseOrderSection purchaseOrder=\{documents\.purchaseOrder\}/);
  assert.match(details, /useSalesOrderDocuments/);
});

test('Sales document history uses associated quotation and purchase-order records, not an Inquiry document type', () => {
  assert.match(documentsHook, /listSalesQuotations\(orderId, controller\.signal\)/);
  assert.match(documentsHook, /getSalesPurchaseOrder\(orderId, controller\.signal\)/);
  assert.match(details, /No quotations are associated with this order/);
  assert.match(details, /No purchase order is associated with this order/);
  assert.doesNotMatch(details, /All Documents|documentType\s*[:=]\s*["']Inquiry["']/i);
});

test('Authenticated Sales details load only returned product specifications', () => {
  assert.match(actions, /useSalesOrderDetail\(true, inquiry\.id\)/);
  assert.match(details, /detail\.items\.map/);
  assert.match(details, /No product specifications are available for this order/);
  assert.match(details, /Loading order details/);
  assert.match(details, /Retry/);
  assert.doesNotMatch(details, /detail\.jobOrders|detail\.shipments/);
});

test('Sales order detail shows verified payment records without fabricating balances or receipts', () => {
  assert.match(details, /<PaymentSection payments=\{detail\.payments\} \/>/);
  assert.match(details, /Verified payments total/);
  assert.match(details, /No payment records are available for this order/);
  assert.match(details, /verification status “verified” and a verified amount/);
  assert.doesNotMatch(details, /balance due|outstanding balance|Official Receipt/);
});

test('Sales order detail reads actual Job Orders and production events without inventing BOM data', () => {
  assert.match(details, /useSalesJobOrders\(Boolean\(detail\)/);
  assert.match(details, /jobOrder\.currentStageCursor/);
  assert.match(details, /jobOrder\.currentStageLabel/);
  assert.match(details, /jobOrder\.productionEvents/);
  assert.match(details, /No production events are available/);
  assert.match(jobHook, /new AbortController\(\)/);
  assert.match(jobHook, /token === sequence\.current/);
});

test('Sales list and detail requests cancel stale reads and expose retry paths', () => {
  assert.match(adapter, /new AbortController\(\)/);
  assert.match(adapter, /return \(\) => controller\.abort\(\)/);
  assert.match(details, /onClick=\{retry\}/);
  assert.match(actions, /remote\.retry/);
  assert.match(orderHook, /new AbortController\(\)/);
  assert.match(orderHook, /controller\.abort\(\)/);
  assert.match(orderHook, /token === sequence\.current/);
});

test('SalesOrders keeps the Demo workflow isolated from its authenticated branch', () => {
  assert.match(screen, /session\.mode === "real" && session\.role === "sales"\) return <ApiSalesOrders/);
  assert.match(screen, /return <DemoSalesOrders targetInquiryId=\{targetInquiryId\} \/>/);
  assert.match(screen, /session\.mode === "real"\) return <OperationsSalesMonitoring/);
});

test('Sales detail uses authenticated delivery reads without mixing shipment and receipt states', () => {
  assert.match(details, /useSalesDelivery\(Boolean\(detail\)/);
  for (const value of ['trackingReference', 'waybills', 'deliveryReceipts', 'signedReceipts', 'No signed receipt submission is available']) {
    assert.match(details, new RegExp(value));
  }
  assert.match(deliveryHook, /new AbortController\(\)/);
  assert.match(deliveryHook, /token === sequence\.current/);
  assert.match(deliveryApi, /encodeURIComponent\(orderId\)/);
});
