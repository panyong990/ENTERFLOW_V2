import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const portal = await readFile(new URL("./ClientPortal.tsx", import.meta.url), "utf8");
const sales = await readFile(new URL("./SalesOrders.tsx", import.meta.url), "utf8");
const salesAdapter = await readFile(new URL("./sales/useOriginalSalesAdapter.ts", import.meta.url), "utf8");
const data = await readFile(new URL("./client/data.tsx", import.meta.url), "utf8");
const api = await readFile(new URL("../api/clientPortal.ts", import.meta.url), "utf8");

test("Real Client cancellation uses the authenticated workflow while preserving eligibility and terms guards", () => {
  assert.match(portal, /realMode \? !inquiry\.archived && cancellationStage && !inquiry\.pendingCancellation/);
  assert.match(portal, /hasRecordedDownpayment/);
  assert.match(portal, /Please acknowledge the Terms & Conditions/);
  assert.match(portal, /requestCancellation\(\(inq as ClientView\)\.orderId, \{ reason, termsAcknowledged \}\)/);
  assert.match(portal, /disabled=\{cancellationSubmitting \|\| !cancelReason.trim\(\) \|\| !cancelTermsAcknowledged\}/);
  assert.match(portal, /demoCancellationMode/);
  assert.match(data, /if \(!input.termsAcknowledged\) throw new Error/);
  assert.match(data, /await clientPortalApi.requestCancellation\(orderId, \{ reason: input.reason, termsAcknowledged: true \}\)/);
  assert.match(api, /\/api\/client\/orders\/\$\{encodeURIComponent\(orderId\)\}\/cancellation/);
  assert.match(portal, /setCancellationError\(message\)/);
});

test("Real Sales workspace centralizes cancellation outcomes without inventing actions", () => {
  for (const label of ["Active Pipeline", "Cancellation Requests", "Cancelled", "Completed"]) assert.match(sales, new RegExp(label));
  assert.match(sales, /pendingCancellationRecords/);
  assert.match(sales, /live\.cancel\(inquiry, "approved"\)/);
  assert.match(sales, /live\.cancel\(inquiry, "declined"\)/);
  assert.match(salesAdapter, /reviewSalesCancellation/);
  assert.match(salesAdapter, /request\.kind === "cancellation" && request\.status === "pending"/);
  assert.match(salesAdapter, /uncertain\.current\.add\(inquiry\.id\)/);
});

test("Real mode does not fall back to Demo cancellation persistence", () => {
  assert.doesNotMatch(data, /localStorage|sessionStorage|indexedDB|createDemoInquiries/);
  assert.match(data, /throw new Error\(unavailableMessage\)/);
});
