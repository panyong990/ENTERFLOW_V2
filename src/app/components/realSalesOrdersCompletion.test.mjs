import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`./${path}`, import.meta.url), "utf8");

test("Real Sales pipeline exposes all order-state views without Demo fallback", () => {
  const source = read("sales/SalesPipeline.tsx");
  for (const label of ["New Inquiry", "Quotation Sent", "Ready for Job Order", "Cancellation Requested"]) {
    assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(source, /useSalesOrders/);
  assert.match(source, /remote\.error/);
  assert.match(source, /remote\.refresh/);
  assert.match(source, /fulfillmentCompletedAt/);
  assert.doesNotMatch(source, /authenticated Sales API returned no inquiries or orders/);
  assert.doesNotMatch(source, /Refresh records/);
  assert.doesNotMatch(source, /aria-label="Record status"/);
  assert.doesNotMatch(source, /aria-label="Order sort"/);
  assert.doesNotMatch(source, /Page \{page\}/);
  assert.match(source, /aria-label="Cancellation history pages"/);
  assert.match(source, /cancellationQuery\(filters, cancellationFilter, cancellationPage\)/);
  assert.match(source, /remote.data\?\.total/);
  assert.match(source, /All Order Records & Stages/);
  assert.match(source, /No inquiries/);
  for (const label of ["Active Pipeline", "Cancellation Requests", "All Order Records & Stages", "All Requests", "Pending Review", "Approved \/ Cancelled", "Declined"]) assert.match(source, new RegExp(label));
  assert.match(source, /workspaceSection/);
  assert.match(source, /min-h-\[420px\]/);
  assert.doesNotMatch(source, /New inquiries appear automatically/);
});

test("Sales API mapping normalizes live identifiers and preserves live order data", () => {
  const source = read("../api/salesOrders.js");
  assert.match(source, /export function mapSalesOrder/);
  assert.match(source, /id: String\(row\.id\)/);
  assert.match(source, /export function listSalesOrders/);
  assert.match(source, /export function getSalesOrder/);
  assert.match(source, /export function rejectSalesInquiry/);
});

test("Real Sales record browser keeps loading, error, detail, document, delivery, and pagination states", () => {
  const source = read("sales/SalesRecordBrowser.tsx");
  for (const marker of ["Loading Sales orders", "role=\"alert\"", "Order details", "QuotationHistory", "PurchaseOrderSection", "JobOrderSection", "DeliverySection", "PaymentSection", "Previous", "Next"]) {
    assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(source, /remote\.loading \|\| remote\.error \|\| !remote\.data \? "—"/);
});

test("Real Sales records use human-readable status labels without a visible refresh control", () => {
  const source = read("sales/SalesRecordBrowser.tsx");
  assert.match(source, /<option value="all">All Statuses<\/option>/);
  assert.doesNotMatch(source, /RefreshCw|> Refresh<|>Refresh<|aria-label="Refresh/);
});

test("Real Sales dashboard has no visible refresh control while retaining automatic data hooks", () => {
  const source = read("sales/SalesDashboard.tsx");
  assert.match(source, /useSalesWorkspaceData/);
  assert.doesNotMatch(source, /RefreshCw|refreshSalesDashboard|Refresh Sales dashboard|>Refresh<|> Refresh</);
});

test("Sales section controls are scoped to their selected workspace", () => {
  const source = read("sales/SalesPipeline.tsx");
  assert.match(source, /workspaceSection === "pipeline" && <>[\s\S]*aria-label="Search inquiries"[\s\S]*Filter Sales & Orders by status/);
  assert.match(source, /aria-label="Cancellation request filters"/);
  assert.doesNotMatch(source, /aria-label="Order stage"/);
});

test("Sales stock requests remain explicit integration-pending instead of fabricating success", () => {
  const source = read("sales/StockRequestsModal.tsx");
  assert.match(source, /Stock request submission/);
  assert.match(source, /Warehouse stock response/);
  assert.match(source, /unavailable.*Sales API|Sales API.*unavailable/);
});
