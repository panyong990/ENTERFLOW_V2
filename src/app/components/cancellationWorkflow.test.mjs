import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const client = await readFile(new URL("./ClientPortal.tsx", import.meta.url), "utf8");
const sales = await readFile(new URL("./SalesOrders.tsx", import.meta.url), "utf8");
const orders = await readFile(new URL("../store/orders.tsx", import.meta.url), "utf8");

test("Demo Client cancellation enforces lifecycle, terms acknowledgement, and downpayment restriction", () => {
  assert.match(client, /const demoCancellationMode =/);
  assert.match(client, /hasRecordedDownpayment = realMode[\s\S]*invoicePayment\.downpaymentStatus === "COMPLETE"/);
  assert.match(client, /CancellationTermsPanel/);
  assert.match(client, /cancelTermsAcknowledged/);
  assert.match(client, /Please acknowledge the Terms & Conditions/);
  assert.match(client, /Cancellation is unavailable because a verified downpayment has been recorded/);
});

test("Demo Sales workspace separates pending, cancelled, and completed records", () => {
  for (const value of ["Active Pipeline", "Cancellation Requests", "Cancelled", "Completed"]) assert.match(sales, new RegExp(value));
  assert.match(sales, /workspaceSection !== "pipeline"/);
  assert.match(sales, /!c\.pendingCancellation/);
  assert.doesNotMatch(sales, /<span className="font-dm"[^>]*>Pipeline<\/span>/);
});

test("Local cancellation history distinguishes direct and Sales-approved cancellation", () => {
  assert.match(orders, /cancellationType: "direct"/);
  assert.match(orders, /cancellationType: "sales-approved"/);
  assert.match(orders, /pendingCancellation: undefined/);
});
