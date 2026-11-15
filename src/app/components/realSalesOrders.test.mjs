import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./RealSalesOrders.tsx', import.meta.url), 'utf8');
const hook = await readFile(new URL('./useSalesOrders.ts', import.meta.url), 'utf8');
const jobHook = await readFile(new URL('./useSalesJobOrders.ts', import.meta.url), 'utf8');
const deliveryApi = await readFile(new URL('../api/salesDelivery.js', import.meta.url), 'utf8');
const deliveryHook = await readFile(new URL('./useSalesDelivery.ts', import.meta.url), 'utf8');
const screen = await readFile(new URL('./SalesOrders.tsx', import.meta.url), 'utf8');

test('Real Sales Orders uses the backend-supported filters and pagination', () => {
  for (const value of ['status', 'stage', 'sort', 'page', 'pageSize']) assert.match(source, new RegExp(`filters\\.${value}|"${value}"`));
  for (const value of ['inquiry', 'quotation', 'po', 'in_production', 'quality_inspection', 'ready_for_dispatch', 'dispatched', 'delivered', 'paid', 'overdue']) assert.match(source, new RegExp(`"${value}"`));
  assert.match(source, /useSalesOrders\(true, filters\)/);
  assert.match(source, /No inquiries or orders match/);
});

test('Real Sales Orders loads detail records and displays only returned product specifications', () => {
  assert.match(source, /useSalesOrderDetail\(true, selectedId\)/);
  assert.match(source, /detail\.items\.map/);
  assert.match(source, /No product specifications are available/);
  for (const unsupported of ['purchaseOrders', 'jobOrders', 'shipments', 'invoices']) assert.doesNotMatch(source, new RegExp(`detail\\.${unsupported}`));
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
