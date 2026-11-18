import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const portal = await readFile(new URL("./client/ClientPortal.tsx", import.meta.url), "utf8");
const sales = await readFile(new URL("./sales/SalesPipeline.tsx", import.meta.url), "utf8");
const data = await readFile(new URL("./client/data.tsx", import.meta.url), "utf8");
const api = await readFile(new URL("../api/clientPortal.ts", import.meta.url), "utf8");

test("Real Client cancellation uses the authenticated workflow while preserving eligibility and terms guards", () => {
  assert.match(portal, /Cancellation history is unavailable from the authenticated Client API/);
  assert.match(portal, /hasRecordedDownpayment/);
  assert.match(portal, /Please acknowledge the Terms & Conditions/);
  assert.match(portal, /await onCancel\(cancelReason.trim\(\), cancelTermsAcknowledged\)/);
  assert.match(portal, /disabled=\{cancellationSubmitting \|\| !cancelReason.trim\(\) \|\| !cancelTermsAcknowledged\}/);
  assert.match(portal, /cancellationIsDirect/);
  assert.match(data, /if \(!input.termsAcknowledged\) throw new Error/);
  assert.match(data, /await clientPortalApi.requestCancellation\(orderId, \{ reason: input.reason, termsAcknowledged: true \}\)/);
  assert.match(api, /\/api\/client\/orders\/\$\{encodeURIComponent\(orderId\)\}\/cancellation/);
  assert.match(portal, /setCancellationError\(message\)/);
});

test("Real Sales workspace centralizes cancellation outcomes without inventing actions", () => {
  for (const label of ["Active Pipeline", "Cancellation Requests", "All Order Records & Stages", "All Requests", "Pending Review", "Approved / Cancelled", "Declined"]) assert.match(sales, new RegExp(label));
  assert.match(sales, /reason \|\| "Reason unavailable"/);
  assert.match(sales, /requestedAt \? ` · \$\{request\.requestedAt\}` : " · Timestamp unavailable"/);
  assert.match(sales, /await reviewSalesCancellation\(orderId, request.id, decision\)/);
  assert.match(sales, /decisionLock.current \|\| uncertain/);
  assert.match(sales, /Check latest cancellation state/);
  assert.match(sales, /getSalesOrder\(orderId\)/);
  assert.match(sales, /hasCancellationRequest/);
  assert.match(sales, /border-slate-200\/70 bg-white p-5 shadow-sm/);
  assert.match(sales, /bg-\[#1A2B4A\] text-white/);
  assert.match(sales, /bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600/);
  assert.doesNotMatch(sales, /border-amber-200 bg-white p-5/);
  assert.doesNotMatch(sales, /bg-amber-700 text-white/);
});

test("Real mode does not fall back to Demo cancellation persistence", () => {
  assert.doesNotMatch(data, /localStorage|sessionStorage|indexedDB|createDemoInquiries/);
  assert.match(data, /throw new Error\(unavailableMessage\)/);
});
