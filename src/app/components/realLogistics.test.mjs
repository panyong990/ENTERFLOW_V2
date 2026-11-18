import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { transformSync } from "esbuild";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const read = name => fs.readFileSync(new URL(name, import.meta.url), "utf8");
function compile(source, dependencies = {}) {
  const module = { exports: {} };
  const code = transformSync(source, { loader: "tsx", format: "cjs", jsx: "automatic" }).code;
  new Function("require", "module", "exports", code)(name => dependencies[name] ?? require(name), module, module.exports);
  return module.exports;
}
const client = compile(read("../api/client.ts"));
const api = compile(read("../api/logisticsShipments.ts"), { "./client": client });
const source = read("./Logistics.tsx");
const layerSource = read("./RealLogisticsShipments.tsx");
const projection = compile(layerSource, {
  "../api/client": client,
  "../api/logisticsShipments": api,
  "../store/session": { useSession: () => ({ role: "logistics", userId: "11" }) },
});

function shipment(overrides = {}) {
  return {
    id: "900719925474099312345", jobOrderId: "900719925474099312344", orderId: "900719925474099312343",
    orderReference: "ORDER-1", jobOrderReference: "JO-1", companyName: "Actual Customer",
    deliveryMethodLabel: "Company Vehicle", status: "pending", trackingReference: "TRACK-1", trackingLink: null,
    waybillReference: "WB-1", waybillPrintedAt: "2026-11-12T08:00:00Z",
    deliveryReceiptReference: "DR-1", deliveryReceiptGeneratedAt: "2026-11-12T07:00:00Z",
    deliveryReceiptSentToLogisticsAt: "2026-11-19T08:00:00Z",
    dispatchedAt: null, deliveredAt: null, estimatedDeliveryDate: null, expectedPickupDate: null, updatedAt: null,
    ...overrides,
  };
}

test("shipment projection preserves string identities and leaves unprovided business data unknown", () => {
  const row = shipment();
  const record = projection.toLogisticsRecord(row);
  assert.equal(record.id, row.id);
  assert.equal(record.shipment, row);
  assert.equal(record.joNumber, "JO-1");
  assert.equal(record.code, "ORDER-1");
  assert.equal(record.clientName, "Actual Customer");
  assert.deepEqual(record.products, []);
  for (const field of ["stage", "submittedDate", "invoiceAmount", "quotedTotal", "invoiceNo", "poNumber", "signedDeliveryReceiptReceivedAt", "paymentCycleStartedAt"]) {
    assert.equal(record[field], undefined, field);
  }
  assert.equal(projection.toLogisticsRecord(shipment({ deliveryMethodLabel: null })).deliveryMethod, undefined);
});

test("receipt send evidence belongs to the matching receipt, never another receipt", () => {
  const row = shipment({ deliveryReceipts: [
    { id: "1", reference: "DR-other", sentToClientAt: "2026-11-19T08:00:00Z" },
    { id: "2", reference: "DR-1", sentToClientAt: null },
  ] });
  assert.equal(projection.toLogisticsRecord(row).deliveryReceiptSentAt, undefined);
  row.deliveryReceipts[1].sentToClientAt = "2026-11-19T09:00:00Z";
  assert.equal(projection.toLogisticsRecord(row).deliveryReceiptSentAt, row.deliveryReceipts[1].sentToClientAt);
  assert.equal(projection.toLogisticsRecord(shipment({ deliveryReceiptReference: null, deliveryReceipts: [{ reference: null, sentToClientAt: "2026-11-19T09:00:00Z" }] })).deliveryReceiptSentAt, undefined);
});

test("API statuses remain authoritative without inferred dispatch, delivery or pickup completion", () => {
  assert.equal(projection.shipmentStatus(shipment()).label, "PENDING");
  assert.equal(projection.shipmentStatus(shipment({ status: "in_transit" })).label, "IN TRANSIT");
  assert.equal(projection.shipmentStatus(shipment({ status: "picked_up" })).label, "PICKED UP");
  assert.equal(projection.shipmentStatus(shipment({ status: "delivered" })).label, "DELIVERED");
  assert.equal(projection.shipmentStatus(shipment({ status: "custom" })).label, "custom");
});

test("search covers actual order, JO, customer, tracking, waybill, receipt and delivery method", () => {
  for (const query of [" order-1 ", "jo-1", "ACTUAL CUSTOMER", "track-1", "wb-1", "dr-1", "company vehicle"]) {
    assert.ok(projection.matchesShipmentFilters(shipment(), query, "all", false), query);
  }
  assert.equal(projection.matchesShipmentFilters(shipment({ trackingReference: null }), "fake", "all", false), false);
});

test("date filters use local calendar boundaries and distinct handoff/history dates", () => {
  const now = new Date(2026, 10, 19, 12);
  const local = day => new Date(2026, 10, day, 8).toISOString();
  const row = shipment({ deliveryReceiptSentToLogisticsAt: local(19), deliveredAt: local(12) });
  assert.ok(projection.matchesShipmentFilters(row, "", "today", false, now));
  assert.equal(projection.matchesShipmentFilters(row, "", "today", true, now), false);
  assert.equal(projection.matchesShipmentFilters(row, "", "7days", true, now), false);
  assert.ok(projection.matchesShipmentFilters({ ...row, deliveredAt: local(13) }, "", "7days", true, now));
  assert.ok(projection.matchesShipmentFilters(row, "", "30days", true, now));
  for (const value of [null, "invalid", local(20)]) {
    assert.equal(projection.matchesShipmentFilters({ ...row, deliveredAt: value }, "", "today", true, now), false);
  }
  assert.equal(projection.shipmentDate(shipment({ deliveredAt: null }), true), undefined);
  assert.ok(projection.matchesShipmentFilters(shipment({ deliveredAt: null }), "", "all", true, now));
});

// Exercise the actual hook's state transitions with controlled effects and unresolved reads.
function hookHarness() {
  const cells = [];
  const effects = [];
  let cursor = 0;
  let pending = [];
  let current;
  let args = [true, null];
  let session = { role: "logistics", userId: "11" };
  const calls = [];
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in cells)) cells[index] = typeof initial === "function" ? initial() : initial;
      return [cells[index], value => { cells[index] = typeof value === "function" ? value(cells[index]) : value; }];
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      if (!effects[index] || dependencies.some((value, i) => !Object.is(value, effects[index].dependencies[i]))) {
        effects[index]?.cleanup?.();
        effects[index] = { dependencies };
        pending.push(() => { effects[index].cleanup = effect(); });
      }
    },
  };
  const request = (kind, id, signal) => new Promise((resolve, reject) => calls.push({ kind, id, signal, resolve, reject }));
  const layer = compile(layerSource, {
    react,
    "../api/client": client,
    "../api/logisticsShipments": {
      listLogisticsShipments: options => request("list", null, options.signal),
      getLogisticsShipment: (id, signal) => request("detail", id, signal),
    },
    "../store/session": { useSession: () => session },
  });
  const render = () => { cursor = 0; current = layer.useRealLogisticsShipments(...args); return current; };
  const flush = () => { const queued = pending; pending = []; queued.forEach(effect => effect()); return render(); };
  return {
    calls, render, flush,
    setArgs: (...value) => { args = value; },
    setSession: value => { session = value; },
  };
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

test("Demo never fetches; list loading, errors, retry and refresh cannot expose stale rows", async () => {
  const h = hookHarness();
  h.setArgs(false, null);
  assert.equal(h.render().loading, false);
  h.flush();
  assert.equal(h.calls.length, 0);
  h.setArgs(true, null);
  assert.equal(h.render().loading, true);
  h.flush();
  h.calls[0].resolve([shipment()]);
  await settle();
  assert.equal(h.render().rows[0].id, shipment().id);
  h.render().refresh();
  assert.deepEqual(h.render().rows, []);
  h.flush();
  h.calls[1].reject(new client.ApiError(403, "Access denied"));
  await settle();
  assert.equal(h.render().error, "Access denied");
  assert.deepEqual(h.render().rows, []);
  h.render().refresh();
  h.render(); h.flush();
  h.calls[2].resolve([]);
  await settle();
  assert.equal(h.render().loading, false);
  assert.equal(h.render().error, "");
  assert.deepEqual(h.render().rows, []);
});

test("detail close, newer selections, and session changes abort and suppress stale responses", async () => {
  const h = hookHarness();
  h.render(); h.flush();
  h.setArgs(true, shipment().id);
  assert.equal(h.render().detailLoading, true);
  h.flush();
  const first = h.calls[1];
  assert.equal(first.id, shipment().id);
  h.setArgs(true, "other-string-id");
  assert.equal(h.render().detail, null);
  h.flush();
  assert.ok(first.signal.aborted);
  first.resolve(shipment());
  h.calls[2].resolve(shipment({ id: "other-string-id" }));
  await settle();
  assert.equal(h.render().detail.id, "other-string-id");
  h.setArgs(true, null);
  assert.equal(h.render().detail, null);
  h.flush();
  h.setArgs(true, shipment().id);
  h.render(); h.flush();
  const pendingDetail = h.calls.at(-1);
  h.setSession({ role: "logistics", userId: "22" });
  assert.deepEqual(h.render().rows, []);
  assert.equal(h.render().detail, null);
  h.flush();
  assert.ok(pendingDetail.signal.aborted);
  pendingDetail.resolve(shipment());
  await settle();
  assert.equal(h.render().detail, null);
});

test("detail failures do not replace list data and have an independent retry", async () => {
  const h = hookHarness();
  h.setArgs(true, shipment().id);
  h.render(); h.flush();
  h.calls[0].resolve([shipment()]);
  h.calls[1].reject(new client.ApiError(404, "Shipment not found"));
  await settle();
  assert.equal(h.render().rows.length, 1);
  assert.equal(h.render().error, "");
  assert.equal(h.render().detailError, "Shipment not found");
  h.render().retryDetail();
  h.render(); h.flush();
  assert.equal(h.calls.length, 3);
  h.calls[2].resolve(shipment());
  await settle();
  assert.equal(h.render().detail.id, shipment().id);
  assert.equal(h.render().detailError, "");
});

const ordersSource = read("../store/orders.tsx");
const receiptValidation = compile(ordersSource.slice(
  ordersSource.indexOf("export function hasValidSignedDeliveryReceipt("),
  ordersSource.indexOf("export function paymentDaysRemaining("),
));
let mode = "real";
let initialView = "active";
let demoReads = 0;
let writes = 0;
let remote = { rows: [], loading: false, error: "", detail: null, detailLoading: false, detailError: "", refresh() {}, retryDetail() {} };
let demoRows = [];
const ui = compile(source + "\nexport { DeliveryDetailModal };", {
  react: { ...React, useState: initial => React.useState(initial === "active" ? initialView : initial) },
  "../store/orders": {
    ...receiptValidation,
    useOrders: () => ({
      inquiriesByStage(stages) { demoReads++; return demoRows.filter(row => stages.includes(row.stage)); },
      updateInquiry() { writes++; }, markDeliveryReceiptSent() { writes++; },
      savePendingSignedDeliveryReceipt() { writes++; }, submitPendingSignedDeliveryReceipt() { writes++; },
    }),
  },
  "../store/attachments": { readFileAsDataUrl() { writes++; } },
  "../store/notifications": { useNotifications: () => ({ push() { writes++; } }) },
  "../store/session": { useSession: () => ({ mode, role: "logistics", userId: "11" }) },
  "./NotificationBell": { NotificationBell: () => null },
  "./RealLogisticsShipments": { ...projection, useRealLogisticsShipments: () => remote },
  "./ui/alert-dialog": Object.fromEntries(["AlertDialog", "AlertDialogAction", "AlertDialogCancel", "AlertDialogContent", "AlertDialogDescription", "AlertDialogFooter", "AlertDialogHeader", "AlertDialogTitle"].map(name => [name, ({ open, children }) => name === "AlertDialog" && !open ? null : React.createElement("div", null, children)])),
});
const render = component => renderToStaticMarkup(React.createElement(component));
function button(html, label) {
  const found = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].find(match => match[2].replace(/<[^>]*>/g, "").includes(label));
  assert.ok(found, label);
  return found[1];
}

test("Real Logistics renders original table columns and history from API records without Demo reads", () => {
  mode = "real"; demoReads = 0; initialView = "active";
  remote = { ...remote, loading: false, error: "", rows: [
    shipment(), shipment({ id: "pickup", status: "picked_up", jobOrderReference: "JO-PICKUP" }),
    shipment({ id: "complete", status: "delivered", jobOrderReference: "JO-DELIVERED", deliveredAt: "2026-11-19T09:00:00Z" }),
  ] };
  const html = render(ui.Logistics);
  for (const text of ["<table", "Date", "JO No.", "SI / Invoice", "Customer", "Item", "Qty", "Amount", "Delivery Status", "OPEN DELIVERY", "JO-PICKUP", "PICKED UP"]) assert.ok(html.includes(text), text);
  assert.ok(!html.includes("JO-DELIVERED"));
  assert.ok(!html.includes("Shipment handoffs</h1>"));
  assert.equal(demoReads, 0);
  initialView = "history";
  const history = render(ui.Logistics);
  assert.ok(history.includes("JO-DELIVERED"));
  assert.ok(!history.includes("JO-PICKUP"));
  initialView = "active";
});

test("loading and API failures show unknown counts and read errors rather than pretend-empty states", () => {
  mode = "real";
  remote = { ...remote, rows: [], loading: true, error: "" };
  const loading = render(ui.Logistics);
  assert.ok(loading.includes("Loading Logistics shipments"));
  assert.ok(!loading.includes("No deliveries have been handed over"));
  remote = { ...remote, loading: false, error: "Forbidden" };
  const error = render(ui.Logistics);
  assert.ok(error.includes('role="alert"'));
  assert.ok(error.includes("Forbidden"));
  assert.ok(error.includes("Retry shipments"));
  assert.ok(!error.includes("No deliveries have been handed over"));
  assert.ok(error.includes("—"));
});

test("original delivery modal shows real detail and all unavailable actions without invented values or unsafe links", () => {
  const inquiry = projection.toLogisticsRecord(shipment({
    status: "delivered", recipientName: "Actual Recipient", deliveryAddress: "Actual Address",
    driverName: "Actual Driver", vehiclePlate: "REAL-1", trackingLink: "javascript:alert(1)",
    deliveredAt: "2026-11-19T09:00:00Z", fulfillmentCompletedAt: "2026-11-19T10:00:00Z",
  }));
  const html = renderToStaticMarkup(React.createElement(ui.DeliveryDetailModal, { inquiry, onClose() {}, onStageSignedDR() { writes++; }, onSubmitSignedDR() { writes++; }, onMarkDelivered() { writes++; }, onSendToClient() { writes++; }, onTrackingLinkChange() { writes++; } }));
  for (const text of ["DELIVERY DETAILS", "DELIVERY RECEIPT", "TRACKING", "SEND TO CLIENT", "SIGNED DELIVERY RECEIPT", "FULFILLMENT", "Actual Recipient", "Actual Address", "Actual Driver", "REAL-1"]) assert.ok(html.includes(text), text);
  for (const label of ["MARK DELIVERED", "VIEW DELIVERY RECEIPT", "PRINT DELIVERY RECEIPT", "SEND DR &amp; TRACKING TO CLIENT", "VIEW SIGNED DR", "UPLOAD SIGNED DELIVERY RECEIPT", "SUBMIT SIGNED DR"]) assert.match(button(html, label), /\sdisabled=""/);
  assert.match(html, /<input[^>]*disabled/);
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(!html.includes("0 pcs"));
  assert.ok(!html.includes("SIGNED DR RECEIVED"));
  assert.ok(!html.includes("Payment Cycle Started"));
  assert.equal(writes, 0);
});

test("Demo still uses original handoff rules, quantities, amounts and enabled delivery actions", () => {
  mode = "demo"; demoReads = 0;
  const inquiry = {
    id: "demo-1", code: "DEMO-1", clientName: "Demo Customer", stage: "ready_for_dispatch",
    submittedDate: "2026-11-18", products: [{ type: "Demo Item", qty: 7 }],
    deliveryMethod: "Company Vehicle", invoiceAmount: 123,
    waybillPrintedAt: "2026-11-19", deliveryReceiptNumber: "DEMO-DR", deliveryReceiptSentToLogisticsAt: "2026-11-19",
  };
  demoRows = [inquiry, { ...inquiry, id: "not-handed-over", clientName: "Hidden Demo", deliveryReceiptSentToLogisticsAt: undefined }];
  const html = render(ui.Logistics);
  assert.ok(html.includes("Demo Customer"));
  assert.ok(html.includes("Demo Item"));
  assert.ok(!html.includes("Hidden Demo"));
  assert.ok(!html.includes("Actual Customer"));
  assert.ok(demoReads > 0);
  const detail = renderToStaticMarkup(React.createElement(ui.DeliveryDetailModal, { inquiry, onClose() {} }));
  assert.ok(detail.includes("7 pcs"));
  assert.doesNotMatch(button(detail, "MARK DELIVERED"), /\sdisabled=""/);
  assert.doesNotMatch(button(detail, "VIEW DELIVERY RECEIPT"), /\sdisabled=""/);
  assert.doesNotMatch(button(detail, "SEND DR &amp; TRACKING TO CLIENT"), /\sdisabled=""/);
});

test("secondary Logistics views retain tables and navigation without Demo reads or false empty/count claims in Real", () => {
  mode = "real"; demoReads = 0;
  demoRows = [
    { id: "fake-job", code: "FAKE-JOB", clientName: "Hidden Job Customer", stage: "jo", products: [] },
    { id: "fake-delivery", code: "FAKE-DELIVERY", clientName: "Hidden Delivery Customer", stage: "delivered", products: [], waybillPrintedAt: "2026-11-19", deliveryReceiptNumber: "FAKE-DR", deliveryReceiptSentToLogisticsAt: "2026-11-19" },
  ];
  const jobs = renderToStaticMarkup(React.createElement(ui.LogisticsActiveJobs, { onBack() {} }));
  for (const text of ["<table", "JO Code", "Current Stage", "Search active jobs", "Back to Logistics Dashboard", "Active job records are unavailable"]) assert.ok(jobs.includes(text), text);
  assert.ok(!jobs.includes("No active jobs match"));
  for (const view of ["active", "history"]) {
    initialView = view;
    const operations = render(ui.OperationsLogistics);
    for (const text of ["<table", "JO / Waybill", "Logistics summary", "Delivery views", "Filter delivery records", "Delivery records are unavailable", "—"]) assert.ok(operations.includes(text), text);
    assert.ok(!operations.includes("No delivered records yet"));
    assert.ok(!operations.includes("No active deliveries have been handed over"));
    assert.ok(!operations.includes(">0<"));
    assert.ok(!operations.includes("Hidden Delivery Customer"));
  }
  initialView = "active";
  assert.ok(!jobs.includes("Hidden Job Customer"));
  assert.equal(demoReads, 0);
});

test("Logistics API transport retains same-origin read-only requests and encoded string IDs", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options });
    return { ok: true, status: 200, json: async () => ({ success: true, data: path.includes("?") ? [] : shipment() }) };
  };
  try {
    client.enableRealRequests(true);
    await api.listLogisticsShipments();
    await api.getLogisticsShipment("900719925474099312345/a?b");
    assert.equal(calls[0].path, "/api/logistics/shipments?limit=100");
    assert.equal(calls[1].path, "/api/logistics/shipments/900719925474099312345%2Fa%3Fb");
    for (const { options } of calls) {
      assert.equal(options.method, "GET");
      assert.equal(options.credentials, "same-origin");
      assert.equal(options.cache, "no-store");
      assert.equal(options.body, undefined);
    }
    client.enableRealRequests(false);
    await assert.rejects(api.listLogisticsShipments(), /Demo Preview/);
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    client.enableRealRequests(false);
  }
});
