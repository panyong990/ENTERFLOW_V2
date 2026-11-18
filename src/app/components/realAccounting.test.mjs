import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createRequire, Module } from "node:module";
import { resolve } from "node:path";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const read = (name) => fs.readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

test("Accounting preserves the full ledger and invoice UI while isolating Real Mode financial data", () => {
  const source = read("Accounting.tsx");
  assert.match(source, /Payments Ledger/);
  assert.match(source, /Paid & Closed History/);
  assert.match(source, /Invoice No\./);
  assert.match(source, /payment history/i);
  assert.match(source, /useSession/);
  assert.match(source, /mode === "real"/);
  assert.match(source, /realMode \? remote.rows : invoiceInquiries.map\(inquiryToInvoice\)/);
  assert.match(source, /<AccountingLedger key=\{mode\}/);
  assert.doesNotMatch(source, /<RealAccounting|<RealPaymentProofQueue/);
  for (const label of ["DOWNPAYMENT / PAYMENT SETUP", "ACTIVE PAYMENT CYCLE", "FULFILLMENT COMPLETED", "Client Payment Submissions", "Record Payment", "DELIVERY &amp; PAYMENT CYCLE"]) assert.ok(source.includes(label), label);
  assert.match(source, /mode === "real" \? "—"/);
});

test("Accounting mutations remain explicitly unavailable in Real Mode", () => {
  const source = read("Accounting.tsx");
  for (const operation of [
    "Receipt updates",
    "Payment recording",
    "Account clearing",
    "Payment reminders",
    "Official Receipt issuance",
  ]) {
    assert.match(source, new RegExp(`unavailableFinancialOperation\\("${operation.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}"\\)`));
  }
  assert.match(source, /This operation has no authenticated financial API/);
  assert.match(source, /<fieldset disabled=\{realMode\}/);
  assert.match(source, /disabled=\{realMode \|\| remaining > 0\}/);
  assert.match(source, /disabled=\{realMode\} title=\{realMode \? "Paid and closed history/);
  assert.match(source, /Official Receipt issuance is unavailable/);
});

test("Real Accounting reads invoices and payments from the backend APIs", () => {
  const source = read("RealAccounting.tsx");
  assert.match(read("Accounting.tsx"), /useRealAccounting\(realMode\)/);
  assert.doesNotMatch(source, /<section|<table|<aside|export function RealAccounting/);
  for (const marker of ["listAccountingInvoices", "listAccountingPayments", "getAccountingInvoice", "getAccountingPayment", "paymentProofQueue", "documentWorkflowApi.verifyPayment", "documentWorkflowApi.rejectPayment"]) {
    assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")), marker);
  }
  for (const marker of ["Loading Accounting records", "Retry", "remote.proofError", "remote.reviewError"]) assert.ok(read("Accounting.tsx").includes(marker), marker);
});

test("the accounting dashboard KPI component masks Real Mode financial metrics", () => {
  const source = read("KPICard.tsx");
  assert.match(source, /mode === "real" \? "—"/);
  assert.match(source, /Live metric unavailable/);
});

// Compile only the Accounting adapter/fixture in memory; this is not an app build.
const require = createRequire(import.meta.url);
async function fixture(contents, plugins = []) {
  const filename = resolve('accounting-regression-fixture.cjs');
  const result = await build({ stdin: { contents, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic', define: { 'import.meta.env.DEV': 'true' }, plugins });
  const compiled = new Module(filename);
  compiled.paths = require.resolve.paths('react');
  compiled._compile(result.outputFiles[0].text, filename);
  return compiled.exports;
}
const adapter = await fixture("export * from './src/app/components/RealAccounting.tsx'; export {enableRealRequests} from './src/app/api/client.ts';");
const invoice = { id: 'invoice-real', orderId: 'order-real', orderReference: 'ORDER-BACKEND', companyName: 'Backend Client', reference: 'SI-BACKEND', issuedOn: '2026-11-01', amount: '9007199254740993.25', requiredDownpayment: '15.50', paymentTermCode: 'NET_30', dueOn: '2026-12-01', sentAt: null, verifiedAmount: '15.50' };
const payment = { id: 'payment-real', orderId: invoice.orderId, invoiceId: invoice.id, paymentType: 'DOWNPAYMENT', submittedAmount: '15.50', verifiedAmount: null, method: null, referenceNumber: null, rejectionReason: null, verificationStatus: 'pending', paidOn: null, submittedAt: '2026-11-19T00:00:00Z', reviewedAt: null, proofFileId: 'file-real' };
const proof = { ...payment, fileId: payment.proofFileId, companyName: invoice.companyName, orderReference: invoice.orderReference, invoiceReference: invoice.reference };

test('API projection retains backend values without deriving balances, percentages, fulfillment, or settlement', () => {
  const row = adapter.accountingInvoiceRow(invoice, [payment, { ...payment, id: 'wrong-invoice', invoiceId: 'another' }, { ...payment, id: 'wrong-order', orderId: 'another' }]);
  assert.deepEqual(row.paymentRecords.map(item => item.id), [payment.id]);
  assert.equal(row.backend.invoice, invoice);
  assert.equal(row.backend.payments[0], payment);
  assert.equal(row.status, 'unavailable');
  assert.equal(row.fulfillmentCompleted, null);
  assert.equal(row.paymentState.state, 'UNAVAILABLE');
  for (const field of ['remainingInvoiceBalance', 'remainingDownpayment', 'verifiedDownpaymentAmount']) assert.ok(Number.isNaN(row.paymentState[field]), field);
  assert.ok(Number.isNaN(row.downpaymentPercent));
  assert.equal(row.paymentCycleStartedAt, undefined);
  assert.equal(row.deliveredDate, undefined);
  assert.equal(row.po, '—');
  assert.equal(row.item, '—');
  assert.equal(adapter.accountingMoney(invoice.amount), '₱9007199254740993.25');
  assert.equal(adapter.accountingMoney(null), '—');
  assert.equal(adapter.accountingMoney(Number.NaN), '—');
  assert.equal(adapter.accountingMoney('0.00'), '₱0.00');
  assert.equal(row.paymentRecords[0].paymentDate, '');
  assert.match(row.paymentRecords[0].receiptDataUrl, /payment-files\/file-real\?paymentId=payment-real$/);
  const verified = adapter.accountingInvoiceRow({ ...invoice, verifiedAmount: invoice.amount }, [{ ...payment, verificationStatus: 'verified', verifiedAmount: invoice.amount }]);
  assert.equal(verified.status, 'unavailable', 'even an equal verified amount is not a clearing contract');
});

test('record loading joins proof and payment invoices outside the bounded lists', async () => {
  const originalFetch = globalThis.fetch;
  const paths = [];
  adapter.enableRealRequests(true);
  globalThis.fetch = async path => {
    paths.push(path);
    const data = path.includes('/invoices?') || path.includes('/payments?') ? []
      : path.endsWith('/payment-proof-queue') ? [proof]
      : path.endsWith(`/payments/${payment.id}`) ? payment
      : path.endsWith(`/invoices/${invoice.id}`) ? invoice : assert.fail(path);
    return { ok: true, status: 200, json: async () => ({ success: true, data }) };
  };
  try {
    const records = await adapter.loadAccountingRecords(new AbortController().signal);
    assert.deepEqual(records.invoices, [invoice]);
    assert.deepEqual(records.payments, [payment]);
    assert.deepEqual(records.proofs, [proof]);
    assert.equal(paths.length, 5);
  } finally { globalThis.fetch = originalFetch; adapter.enableRealRequests(false); }
});

test('a failed proof queue preserves invoice/payment reads but exposes review unavailability', async () => {
  const originalFetch = globalThis.fetch;
  adapter.enableRealRequests(true);
  globalThis.fetch = async path => ({ ok: !path.endsWith('/payment-proof-queue'), status: 503, json: async () => path.endsWith('/payment-proof-queue') ? { success: false, message: 'Proof review offline' } : { success: true, data: path.includes('/invoices?') ? [invoice] : [payment] } });
  try {
    const records = await adapter.loadAccountingRecords(new AbortController().signal);
    assert.deepEqual(records.invoices, [invoice]);
    assert.deepEqual(records.payments, [payment]);
    assert.deepEqual(records.proofs, []);
    assert.equal(records.proofError, 'Proof review offline');
  } finally { globalThis.fetch = originalFetch; adapter.enableRealRequests(false); }
});

// A small hook host exercises async effects and action locks without a browser or
// extra dependencies. The service and document API clients remain the real code.
function hookHost() {
  const slots = [];
  let cursor = 0, dirty = true, enabled = true, current;
  const effects = [];
  const changed = (old, next) => !old || next.some((value, index) => !Object.is(old[index], value));
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], update => { const next = typeof update === 'function' ? update(slots[index]) : update; if (!Object.is(slots[index], next)) { slots[index] = next; dirty = true; } }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useMemo(fn, deps) { const index = cursor++; if (changed(slots[index]?.deps, deps)) slots[index] = { deps, value: fn() }; return slots[index].value; },
    useCallback(fn, deps) { return hooks.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const index = cursor++;
      if (changed(slots[index]?.deps, deps)) effects.push(() => { slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; });
    },
  };
  return {
    hooks,
    get value() { return current; },
    setEnabled(value) { enabled = value; dirty = true; },
    async settle(service) {
      for (let i = 0; i < 12; i++) {
        if (dirty) { dirty = false; cursor = 0; current = service.useRealAccounting(enabled); while (effects.length) effects.shift()(); }
        await new Promise(resolve => setImmediate(resolve));
      }
    },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

test('backend proof reviews lock duplicate submissions, reload authoritative records, and block uncertain retries', async () => {
  const host = hookHost();
  globalThis.__accountingHooks = host.hooks;
  const service = await fixture("export * from './src/app/components/RealAccounting.tsx'; export {enableRealRequests} from './src/app/api/client.ts';", [{ name: 'accounting-hook-host', setup(build) {
    build.onResolve({ filter: /^react$/ }, () => ({ path: 'hooks', namespace: 'hook-host' }));
    build.onLoad({ filter: /.*/, namespace: 'hook-host' }, () => ({ contents: ['useCallback', 'useEffect', 'useMemo', 'useRef', 'useState'].map(name => `export const ${name} = (...args) => globalThis.__accountingHooks.${name}(...args);`).join('\n') }));
  } }]);
  const originalFetch = globalThis.fetch;
  let reviewed = false, release, rejectNext = false, posts = [];
  service.enableRealRequests(true);
  globalThis.fetch = async (path, options) => {
    if (options.method === 'POST') {
      posts.push({ path, body: JSON.parse(options.body) });
      if (rejectNext) throw new Error('connection lost');
      await new Promise(resolve => { release = resolve; });
      reviewed = true;
      return { ok: true, status: 200, json: async () => ({ success: true, data: { paymentId: payment.id, verificationStatus: 'verified' } }) };
    }
    const data = path.includes('/invoices?') ? [{ ...invoice, verifiedAmount: reviewed ? '7.25' : '0.00' }]
      : path.includes('/payments?') ? [{ ...payment, verificationStatus: reviewed ? 'verified' : 'pending', verifiedAmount: reviewed ? '7.25' : null }]
      : [{ ...proof, verificationStatus: reviewed ? 'verified' : 'pending' }];
    return { ok: true, status: 200, json: async () => ({ success: true, data }) };
  };
  try {
    host.setEnabled(false); await host.settle(service);
    assert.equal(host.value.rows.length, 0);
    assert.equal(host.value.canReview(payment.id), false);
    host.setEnabled(true); await host.settle(service);
    assert.equal(host.value.canReview(payment.id), true);
    assert.equal(await host.value.reviewPayment(payment.id, 'reject', '  '), false);
    const pending = host.value.reviewPayment(payment.id, 'verify');
    assert.equal(await host.value.reviewPayment(payment.id, 'verify'), false);
    release(); assert.equal(await pending, true);
    assert.equal(await host.value.reviewPayment(payment.id, 'verify'), false, 'stale callbacks stay locked until fresh records arrive');
    await host.settle(service);
    assert.equal(host.value.rows[0].backend.invoice.verifiedAmount, '7.25');
    assert.equal(host.value.rows[0].status, 'unavailable');
    assert.equal(host.value.canReview(payment.id), false);
    assert.equal(posts.length, 1);
    assert.match(posts[0].path, /\/payments\/payment-real\/verify$/);
    reviewed = false; host.value.refresh(); await host.settle(service);
    rejectNext = true;
    assert.equal(await host.value.reviewPayment(payment.id, 'reject', '  Receipt mismatch  '), false);
    await host.settle(service);
    assert.match(host.value.reviewError, /Refresh records before another review/);
    assert.equal(host.value.canReview(payment.id), false);
    assert.equal(await host.value.reviewPayment(payment.id, 'reject', 'Receipt mismatch'), false);
    assert.equal(posts.length, 2);
    assert.match(posts[1].path, /\/payments\/payment-real\/reject$/);
    assert.deepEqual(posts[1].body, { reason: 'Receipt mismatch' });
    host.value.refresh(); await host.settle(service);
    assert.equal(host.value.canReview(payment.id), true);
  } finally { host.unmount(); globalThis.fetch = originalFetch; service.enableRealRequests(false); delete globalThis.__accountingHooks; }
});

test('original Accounting rows and expanded details render Real records without duplicate API panels', async () => {
  const row = adapter.accountingInvoiceRow(invoice, [payment, { ...payment, id: 'verified-payment', verificationStatus: 'verified', verifiedAmount: '12.30' }]);
  globalThis.__accountingRegression = { rows: [row], loading: false, error: '', proofError: '', reviewError: '', busy: false, refresh() {}, canReview() { return true; }, reviewPayment() {} };
  const ui = await fixture("export {Accounting} from './src/app/components/Accounting.tsx';", [{ name: 'accounting-only-dependencies', setup(build) {
    build.onResolve({ filter: /RealAccounting$|store\/session$|store\/orders$|store\/notifications$|NotificationBell$|OfficialReceiptPreviewModal$/ }, args => ({ path: args.path, namespace: 'accounting-fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'accounting-fixture' }, args => {
      if (args.path.endsWith('RealAccounting')) return { contents: "export const useRealAccounting = () => globalThis.__accountingRegression; export const accountingMoney = value => value == null || value === '' || (typeof value === 'number' && !Number.isFinite(value)) ? '—' : '₱' + value;" };
      if (args.path.endsWith('store/session')) return { contents: "export const useSession = () => ({mode:'real', name:'Accounting'});" };
      if (args.path.endsWith('store/notifications')) return { contents: "export const useNotifications = () => ({push(){throw new Error('Real mode must not emit demo notifications')}});" };
      if (args.path.endsWith('store/orders')) return { contents: "export const useOrders = () => ({inquiriesByStage:()=>[], byClient:()=>{throw new Error('Real mode must not read demo client receipts')}}); export const paymentDaysRemaining=()=>undefined; export const formatMoney=v=>Number.isFinite(v)?String(v):'INVALID'; export const toMoneyCents=()=>{throw new Error('Real mode must not calculate finances')}; export const fromMoneyCents=toMoneyCents; export const paymentState=toMoneyCents; export const paymentRecords=toMoneyCents; export const hasValidSignedDeliveryReceipt=toMoneyCents; export const paymentSubmissionAllowance=toMoneyCents; export const poNumberForDisplay=toMoneyCents;" };
      return { contents: args.path.endsWith('NotificationBell') ? 'export const NotificationBell=()=>null;' : 'export const OfficialReceiptPreviewModal=()=>null;' };
    });
  } }]);
  try {
    const markup = renderToStaticMarkup(React.createElement(ui.Accounting));
    for (const marker of ['SI-BACKEND', 'Backend Client', 'ORDER-BACKEND', '₱9007199254740993.25', '₱12.30', 'DOWNPAYMENT / PAYMENT SETUP', 'ACTIVE PAYMENT CYCLE', 'Client Payment Submissions', 'Payment Ledger', 'Record Payment', 'FULFILLMENT UNAVAILABLE', 'PAYMENT CYCLE UNAVAILABLE', 'Issue Official Receipt']) assert.ok(markup.includes(marker), marker);
    assert.match(markup, /<fieldset disabled=""/);
    for (const forbidden of ['Issued invoices', 'Payment records</h2>', 'Record detail', 'Invoice records', 'NaN', 'INVALID', 'FULLY PAID', '₱0.00']) assert.ok(!markup.includes(forbidden), forbidden);
  } finally { delete globalThis.__accountingRegression; }
});

test('Demo retains the original ledger backed by the existing Demo order fixtures', async () => {
  const demo = await fixture("export {Accounting} from './src/app/components/Accounting.tsx'; export {OrdersProvider} from './src/app/store/orders.tsx'; export {NotificationsProvider} from './src/app/store/notifications.tsx'; export {SessionProvider} from './src/app/store/session.tsx';");
  const child = React.createElement(demo.SessionProvider, { role: 'accounting', name: 'Demo Accountant', mode: 'demo' },
    React.createElement(demo.NotificationsProvider, { mode: 'demo' },
      React.createElement(demo.OrdersProvider, { mode: 'demo' }, React.createElement(demo.Accounting))));
  const markup = renderToStaticMarkup(child);
  for (const marker of ['Payments Ledger', 'B.E. Aerospace', 'DOWNPAYMENT / PAYMENT SETUP', 'ACTIVE PAYMENT CYCLE', 'View Paid &amp; Closed History', 'Send Payment Reminders']) assert.ok(markup.includes(marker), marker);
  assert.ok(!markup.includes('Accounting records are unavailable'));
  assert.ok(!markup.includes('FULFILLMENT UNAVAILABLE'));
  assert.ok(!markup.includes('<fieldset disabled=""'));
});
