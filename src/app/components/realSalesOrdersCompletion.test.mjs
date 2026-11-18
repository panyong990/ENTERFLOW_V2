import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(`./${path}`, import.meta.url), "utf8");

test("Real Sales uses the original pipeline and archive sections with authenticated data", () => {
  const screen = read("SalesOrders.tsx");
  const adapter = read("sales/useOriginalSalesAdapter.ts");
  for (const label of ["NEW INQUIRY", "QUOTATION SENT", "READY FOR JOB ORDER", "Active Pipeline", "Cancellation Requests", "Cancelled", "Completed"]) {
    assert.ok(screen.includes(label), label);
  }
  assert.match(screen, /useOriginalSalesAdapter/);
  assert.match(screen, /live\.error/);
  assert.match(screen, /live\.refresh/);
  assert.match(adapter, /fulfillmentCompletedAt/);
  assert.match(adapter, /listSalesOrders/);
  assert.match(screen, /Client inquiries are loaded from authenticated Sales records/);
  assert.doesNotMatch(screen, /authenticated Sales API returned no inquiries or orders/);
});

test("Sales API mapping preserves identifiers and server-owned record data", () => {
  const source = read("../api/salesOrders.js");
  assert.match(source, /export function mapSalesOrder/);
  assert.match(source, /id: String\(row\.id\)/);
  assert.match(source, /export function listSalesOrders/);
  assert.match(source, /export function getSalesOrder/);
  assert.match(source, /export function rejectSalesInquiry/);
});

test("Authenticated Sales detail flow retains loading, error, document, delivery, and retry states", () => {
  const actions = read("sales/LiveSalesActions.tsx");
  const details = read("sales/SalesDocumentSections.tsx");
  for (const marker of ["Loading current order details", "remote.error", "remote.retry", "OrderDetail", "PurchaseOrderSection"]) {
    assert.ok(actions.includes(marker), marker);
  }
  for (const marker of ["Loading order details", "role=\"alert\"", "QuotationHistory", "PurchaseOrderSection", "JobOrderSection", "DeliverySection", "PaymentSection", "Retry"]) {
    assert.ok(details.includes(marker), marker);
  }
});

test("Real Sales records have human-readable status filters and an explicit refresh control", () => {
  const source = read("SalesOrders.tsx");
  assert.match(source, /label: "All Statuses"/);
  assert.match(source, /aria-label="Refresh Sales records"/);
  assert.match(source, /onClick=\{live\.refresh\}/);
  assert.match(source, /disabled=\{live\.loading\}/);
});

test("Real Sales dashboard uses the established summary adapter without Demo dashboard refresh controls", () => {
  const dashboard = read("Dashboard.tsx");
  assert.match(dashboard, /useSalesWorkspaceData/);
  assert.match(dashboard, /\/api\/sales\/dashboard/);
  assert.doesNotMatch(dashboard, /Refresh Sales dashboard|refreshSalesDashboard/);
});

test("Sales search and status filters are scoped to the active pipeline", () => {
  const source = read("SalesOrders.tsx");
  const screenStart = source.indexOf('export function OriginalSalesOrders');
  const header = source.slice(screenStart, source.indexOf('liveMessage &&', screenStart));
  assert.match(header, /workspaceSection === "pipeline" && <>[\s\S]*placeholder="Search inquiries\.\.\."[\s\S]*Filter Sales & Orders by status/);
  assert.match(source, /aria-label="Sales & Orders sections"/);
  assert.match(source, /SalesWorkspaceRecords/);
});

test("Sales stock requests remain explicit integration-pending instead of fabricating success", () => {
  const source = read("sales/RealSalesStockRequests.tsx");
  assert.match(source, /createStockRequest/);
  assert.match(source, /stockRequestReady/);
  assert.match(source, /No authenticated materials are available/);
  assert.match(source, /Inventory was not reserved or deducted/);
  assert.match(source, /Submission could not be confirmed/);
});
