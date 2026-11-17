import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./sales/SalesRecordBrowser.tsx', import.meta.url), 'utf8');
const hook = await readFile(new URL('./useSalesOrders.ts', import.meta.url), 'utf8');
const jobHook = await readFile(new URL('./useSalesJobOrders.ts', import.meta.url), 'utf8');
const deliveryApi = await readFile(new URL('../api/salesDelivery.js', import.meta.url), 'utf8');
const deliveryHook = await readFile(new URL('./useSalesDelivery.ts', import.meta.url), 'utf8');
const screen = await readFile(new URL('./SalesOrders.tsx', import.meta.url), 'utf8');

test('Real Sales Orders uses the backend-supported filters and pagination', () => {
  for (const value of ['status', 'sort', 'page', 'pageSize']) assert.match(source, new RegExp(`filters\\.${value}|"${value}"`));
  assert.match(source, /useSalesOrders\(true, filters\)/);
  assert.match(source, /No inquiries or orders match/);
});

test('All Order Records exposes only production and subsequent stage filters', () => {
  const stageSection = source.slice(source.indexOf('const stages'), source.indexOf('function recordStatusLabel'));
  for (const stage of ['all', 'in_production', 'quality_inspection', 'ready_for_dispatch', 'dispatched', 'delivered', 'paid', 'overdue']) {
    assert.match(stageSection, new RegExp(`value: "${stage}"`));
  }
  for (const earlyStage of ['inquiry', 'quotation', 'po', 'jo']) {
    assert.doesNotMatch(stageSection, new RegExp(`value: "${earlyStage}"`));
  }
  assert.match(source, /aria-label="Order stage"/);
  assert.match(source, /updateFilter\("stage", event\.target\.value/);
});

test('All Order Records keeps lifecycle categories separate from cancellation-request rejection', () => {
  const lifecycleSection = source.slice(source.indexOf('aria-label="Record lifecycle"'), source.indexOf('aria-label="Order sort"'));
  for (const label of ['All records', 'Active and progressing', 'Completed orders', 'Cancelled records']) assert.match(lifecycleSection, new RegExp(label));
  assert.doesNotMatch(lifecycleSection, /Rejected inquiries/);
  assert.match(source, /recordStatus === "cancelled"/);
  assert.match(source, /archiveReason === "rejected"/);
});

test('All Order Records is a document register without Inquiry as a bookkeeping type', () => {
  for (const label of ['All Documents', 'Quotation', 'Purchase Order', 'Job Order', 'Invoice']) assert.match(source, new RegExp(label));
  assert.match(source, /aria-label="Document type"/);
  assert.match(source, /documentTypesFor/);
  for (const field of ['latestQuotationReference', 'purchaseOrderReference', 'jobOrderCount', 'invoiceReference']) assert.match(source, new RegExp(`row\\.${field}`));
  assert.doesNotMatch(source, /value: "inquiry"/);
});

test('Real Sales Orders loads detail records and displays only returned product specifications', () => {
  assert.match(source, /useSalesOrderDetail\(true, selectedId\)/);
  assert.match(source, /detail\.items\.map/);
  assert.match(source, /No product specifications are available/);
  for (const unsupported of ['jobOrders', 'shipments']) assert.doesNotMatch(source, new RegExp(`detail\\.${unsupported}`));
});

test('Real order details display backend payment records without inventing balance or receipt data', () => {
  assert.match(source, /<PaymentSection payments=\{detail\.payments\} \/>/);
  for (const value of ['submittedAmount', 'verifiedAmount', 'paymentType', 'method', 'referenceNumber', 'paidOn', 'verificationStatus', 'submittedAt', 'reviewedAt']) assert.match(source, new RegExp(value));
  assert.match(source, /sumVerifiedPaymentAmounts/);
  assert.match(source, /No payment records are available/);
  assert.doesNotMatch(source, /outstanding balance|balance due|proof-of-payment/);
});

test('Real order details integrate Job Orders without fabricating production history or BOM materials', () => {
  assert.match(source, /useSalesJobOrders\(Boolean\(detail\)/);
  assert.match(source, /jobOrder\.currentStageCursor/);
  assert.match(source, /jobOrder\.currentStageLabel/);
  assert.match(source, /jobOrder\.productionEvents/);
  assert.match(source, /jobOrder\.bomLineCount/);
  assert.match(source, /No production events are available/);
  assert.match(source, /No stage label for cursor/);
  assert.match(jobHook, /new AbortController\(\)/);
  assert.match(jobHook, /token === sequence\.current/);
});

test('Real Sales Orders request lifecycle guards stale responses and supports retry', () => {
  assert.match(hook, /new AbortController\(\)/);
  assert.match(hook, /controller\.abort\(\)/);
  assert.match(hook, /token === sequence\.current/);
  assert.match(hook, /setError/);
  assert.match(source, /onClick=\{remote\.refresh\}/);
  assert.match(source, /onClick=\{retry\}/);
});

test('SalesOrders keeps the existing Demo workflow isolated from the Real Mode branch', () => {
  assert.match(screen, /session\.mode === "real" && session\.role === "sales"/);
  assert.match(screen, /return <RealSalesOrders \/>/);
  assert.match(screen, /return <DemoSalesOrders \/>/);
});

test('Real order details integrate delivery without mixing shipment and receipt states', () => {
  assert.match(source, /useSalesDelivery\(Boolean\(detail\)/);
  for (const value of ['shipment.status', 'trackingReference', 'estimatedDeliveryDate', 'expectedPickupDate', 'dispatchedAt', 'deliveredAt', 'fulfillmentCompletedAt', 'waybills', 'deliveryReceipts', 'signedReceipts']) assert.match(source, new RegExp(value));
  assert.match(source, /Tracking link unavailable/);
  assert.match(source, /No signed receipt submission is available/);
  assert.match(source, /safeTrackingLink/);
  assert.match(deliveryHook, /new AbortController\(\)/);
  assert.match(deliveryHook, /token === sequence\.current/);
  assert.match(deliveryApi, /encodeURIComponent\(orderId\)/);
});
