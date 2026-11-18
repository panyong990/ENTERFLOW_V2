import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build } from "esbuild";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const directory = fileURLToPath(new URL(".", import.meta.url));
const ordersSource = readFileSync(new URL("../store/orders.tsx", import.meta.url), "utf8");
const stages = JSON.parse(ordersSource.match(/export const PRODUCTION_STAGES = (\[[\s\S]*?\]) as const/)[1].replace(/,\s*]/, "]"));
const stubs = {
  "./useProductionJobOrders": 'export const useProductionJobOrders = (...args) => runtime.remote(...args);',
  "../store/session": 'export const useSession = () => ({ mode: runtime.mode });',
  "../store/orders": `export const PRODUCTION_STAGES = ${JSON.stringify(stages)}; export const useOrders = () => runtime.orders; export const poNumberForDisplay = record => record.poNumber; export const stageColor = { jo: { bg: "white", fg: "black" }, in_production: { bg: "white", fg: "black" } }; export const stageLabel = { jo: "Active", in_production: "In Production", cancelled: "Cancelled" };`,
  "../store/notifications": 'export const useNotifications = () => ({ push: () => { throw Error("Unexpected notification"); } });',
  "./NotificationBell": 'export const NotificationBell = () => null;',
  "sonner": 'export const Toaster = () => null; export const toast = { error() {}, info() {}, success() {} };',
};
const result = await build({
  stdin: { contents: 'export { ProductionFloor } from "./ProductionFloor"; export { OperationsProductionFloor } from "./OperationsProductionFloor"; export * from "./ProductionRealJobOrders"; export * from "./productionJobOrderPresentation";', resolveDir: directory },
  bundle: true, write: false, format: "cjs", platform: "node", jsx: "automatic", packages: "external", external: ["production-test-runtime"], tsconfigRaw: { compilerOptions: {} },
  plugins: [{ name: "production-render-fixtures", setup(builder) {
    builder.onResolve({ filter: /^(react|sonner|\.\/useProductionJobOrders|\.\/NotificationBell|\.\.\/store\/(orders|session|notifications))$/ }, args => {
      if (args.path === "react") return { path: "production-test-react", external: true };
      if (stubs[args.path]) return { path: args.path, namespace: "fixture" };
    });
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: 'import runtime from "production-test-runtime"; ' + stubs[args.path], loader: "js" }));
  } }],
});
let stateOverrides;
let hookIndex;
let runtime;
const testReact = {
  ...React, useMemo: fn => fn(),
  useState(initial) {
    const index = hookIndex++;
    const value = stateOverrides.has(index) ? stateOverrides.get(index) : typeof initial === "function" ? initial() : initial;
    return [value, next => runtime.writes.push([index, typeof next === "function" ? next(value) : next])];
  },
};
const testJsxRuntime = Object.fromEntries(Object.entries(jsxRuntime).map(([name, fn]) => [name, ["jsx", "jsxs"].includes(name) ? (type, props, key) => {
  if (type === "button") runtime.buttons.push(props);
  return fn(type, props, key);
} : fn]));
const module = { exports: {} };
new Function("require", "module", "exports", result.outputFiles[0].text)(name => name === "production-test-react" ? testReact : name === "react/jsx-runtime" ? testJsxRuntime : name === "production-test-runtime" ? { get remote() { return runtime.remote; }, get orders() { return runtime.orders; }, get mode() { return runtime.mode; } } : require(name), module, module.exports);
const components = module.exports;
test("the former Real Production page is an alias of the original ProductionFloor", () => {
  assert.equal(components.ProductionRealJobOrders, components.ProductionFloor);
});
const job = {
  id: "501", reference: "JO-SAVED", orderId: "91", orderItemId: "11", specificationId: "22", clientId: "7",
  clientName: "Persisted client", inquiryReference: "ORD-SAVED", filterTypeCode: "OILSEP", filterName: "Saved filter",
  quantity: 12, productionDueDate: "2026-12-31", createdAt: null, status: "in_production", currentStageCursor: 4,
  currentStageLabel: stages[4], paused: false, pauseReason: null, purchaseOrderReference: "PO-SAVED", poDocumentAvailable: false,
  od1: "100", overallHeight: "250", springPlateWidth: "22", oring: "Stored O-ring", filtrationRating: "5 micron", notes: "Saved notes",
};
const event = (id, stagePosition, action, extra = {}) => ({ id, stagePosition, stageLabel: stages[stagePosition], action, reason: null, performedBy: "8", occurredAt: "2026-11-18T10:02:00Z", ...extra });
const detail = { ...job, productionEvents: [event("4", 1, "paused"), event("3", 1, "reverted", { reason: "Stored rework reason" }), event("2", 1, "done"), event("1", 0, "done")], stages: stages.map((label, position) => ({ label, position })) };

function render(name, states = [], remoteOverrides = {}, props = {}) {
  hookIndex = 0;
  stateOverrides = new Map(states);
  runtime = {
    mode: "real",
    writes: [], buttons: [],
    orders: { completedJOs: [{ id: "501", clientName: "DEMO MUST NOT LEAK", products: [{ type: "DEMO PRODUCT" }] }], updateInquiry() { throw Error("Unexpected local mutation"); } },
    remote: (...args) => { runtime.args = args; return { items: [job], total: 1, loading: false, error: "", detail, detailLoading: false, detailError: "", refresh() {}, retryDetail() {}, ...remoteOverrides }; },
  };
  const html = renderToStaticMarkup(React.createElement(components[name], props));
  assert.doesNotMatch(html, /DEMO MUST NOT LEAK|DEMO PRODUCT/);
  return html;
}

test("Operations preserves its original drawer and hydrates saved specifications and event history", () => {
  const html = render("OperationsProductionFloor", [[4, "501"]]);
  for (const text of ["Job Order Details", "Ordered Products", "Production Stage Tracker", "Job Order Document", "Spring plate width: 22", "Stored rework reason", "User ID: 8"]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /Production handoff|Mae Z\.|Tricia|J\. Reyes/);
  assert.equal((html.match(/text-green-600/g) ?? []).length, 1, "only stage 0 has a stored done event that was not reverted");
  assert.match(html, /Not recorded/);
  assert.equal(runtime.args[1], "501");
});

test("Operations does not derive completion history from an advanced or completed cursor", () => {
  const completed = { ...detail, currentStageCursor: 9, status: "ready_for_dispatch", productionEvents: [] };
  const html = render("OperationsProductionFloor", [[4, "501"]], { items: [completed], detail: completed });
  assert.match(html, /No production events recorded/);
  assert.equal((html.match(/text-green-600/g) ?? []).length, 0);
  assert.doesNotMatch(html, /Completed Nov|User ID:/);
});

test("Operations keeps the drawer open during detail loading and retry without showing stale history", () => {
  const stale = { ...detail, id: "999", notes: "STALE DETAIL", productionEvents: [event("999", 0, "done", { reason: "STALE EVENT" })] };
  const loading = render("OperationsProductionFloor", [[4, "501"]], { detail: stale, detailLoading: true });
  assert.match(loading, /Loading Job Order details/);
  assert.match(loading, /Job Order Details/);
  assert.doesNotMatch(loading, /STALE DETAIL|STALE EVENT|No production events recorded/);
  const failed = render("OperationsProductionFloor", [[4, "501"]], { detail: stale, detailError: "Detail API failed" });
  assert.match(failed, /Detail API failed/);
  assert.match(failed, /Retry details/);
  assert.doesNotMatch(failed, /STALE EVENT|No production events recorded/);
});

test("both original JO document actions show the actual template with saved data and no default preparer", () => {
  for (const [name, states] of [["OperationsProductionFloor", [[5, "501"]]], ["ProductionFloor", [[10, { id: "501" }]]]]) {
    const html = render(name, states);
    for (const text of ["Job Order Document", "PO-SAVED", "100", "PREPARED BY", "Unavailable"]) assert.ok(html.includes(text), `${name}: ${text}`);
    assert.doesNotMatch(html, /Mae Z\.|Tricia|Apr 26, 2026|OILSEP-00001|Production handoff/);
    assert.equal(runtime.args[1], "501");
  }
});

test("JO document loading and failed retrieval do not render a different record or fabricate an empty preview", () => {
  const stale = { ...detail, id: "999", reference: "STALE DOCUMENT" };
  const props = { selectedId: "501", detail: stale, loading: false, error: "", retry() {}, onClose() {} };
  const loading = render("ProductionJobOrderDocument", [], {}, props);
  assert.match(loading, /Loading Job Order details/);
  assert.doesNotMatch(loading, /STALE DOCUMENT|PREPARED BY/);
  const failed = render("ProductionJobOrderDocument", [], {}, { ...props, error: "Document detail failed" });
  assert.match(failed, /Document detail failed/);
  assert.match(failed, /Retry details/);
});

test("Production uses its original full stage page and disables unsupported mutations", () => {
  const html = render("ProductionFloor", [[8, "501"]]);
  for (const text of ["Back to Production Floor", "Production Timeline", "Stored rework reason", "Production event history"]) assert.ok(html.includes(text), text);
  for (const action of ["COMPLETE STAGE", "Edit/Revert", "Complete JO", "Pause Production", "Resume Production"]) {
    const button = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(match => match[0]).find(button => button.includes(action));
    assert.ok(button, action);
    assert.match(button, /^<button[^>]*disabled=""/, action);
  }
  assert.equal((html.match(/✅ Done/g) ?? []).length, 1);
  assert.match(html, /Not recorded/);
  assert.doesNotMatch(html, /Marked by Tricia|Marked by F\. Santos|Apr 26/);
});

test("original Production buttons select distinct details, stage and document views", () => {
  render("ProductionFloor", [[6, new Set(["501"])]]);
  runtime.buttons.find(button => Array.isArray(button.children) && button.children.includes(" View Stages →")).onClick();
  assert.deepEqual(runtime.writes.pop(), [8, "501"]);
  runtime.buttons.find(button => button["aria-label"] === "View full details for JO-SAVED").onClick();
  assert.deepEqual(runtime.writes.pop(), [7, "501"]);
  runtime.buttons.find(button => button["aria-label"] === "View JO file for JO-SAVED").onClick();
  const [index, selected] = runtime.writes.pop();
  assert.equal(index, 10);
  assert.equal(selected.id, "501");
});

test("Production retains the original full detail drawer and all saved specification fields", () => {
  const html = render("ProductionFloor", [[7, "501"]]);
  for (const text of ["Job details JO-SAVED", "Stage Timeline", "Assigned Operators", "Assigned operators are unavailable", "Uploaded Documents", "Overall height: 250", "O-ring: Stored O-ring", "Filtration rating: 5 micron", "Saved notes", "User ID: 8"]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /J\. Reyes|F\. Santos|M\. Tan|Production handoff/);
});

test("stage projection preserves reverts and does not turn pause, cursor or JO completion into stage done events", () => {
  assert.equal(components.latestProductionStageEvent(detail, 0).action, "done");
  assert.equal(components.latestProductionStageEvent(detail, 1).action, "reverted");
  assert.equal(components.latestProductionStageEvent({ ...detail, currentStageCursor: 9, productionEvents: [event("5", null, "completed")] }, 8), undefined);
  assert.equal(components.latestProductionStageEvent(null, 0), undefined);
});

test("missing history stays unavailable, and events without dates or actors never acquire invented metadata", () => {
  const absent = render("ProductionEventHistory", [], {}, { detail: job });
  assert.match(absent, /Production event history unavailable/);
  assert.doesNotMatch(absent, /No production events recorded/);
  const html = render("ProductionEventHistory", [], {}, { detail: { ...detail, productionEvents: [event("5", 0, "done", { occurredAt: null, performedBy: null })] } });
  assert.match(html, /Date unavailable/);
  assert.match(html, /Operator unavailable/);
  const document = components.productionDocumentData(job);
  assert.equal(document.preparedBy, "Unavailable");
  assert.equal(document.date, "Unavailable");
  assert.equal(document.dueDate, "Unavailable");
  assert.equal(document.specs.springPlateWidth, "22");
  assert.equal(document.specs.oring, "Stored O-ring");
  assert.ok(!("quotedTotal" in document));
});

test("list loading, API errors, verified empty results, and pagination limits stay distinct", () => {
  for (const name of ["ProductionFloor", "OperationsProductionFloor"]) {
    assert.match(render(name, [], { loading: true }), /Loading Job Orders/);
    assert.match(render(name, [], { error: "List API failed" }), /List API failed/);
    assert.match(render(name, [], { items: [] }), /No matching job orders/i);
    assert.match(render(name, [], { total: 101 }), /Showing 1 of 101 matching Job Orders/);
  }
});

test("Operations overdue filtering uses the saved production date without inventing client delivery", () => {
  const overdue = { ...job, productionDueDate: "2000-01-01" };
  const html = render("OperationsProductionFloor", [[2, { stage: "all", status: "overdue", dueDate: "overdue" }]], { items: [overdue] });
  assert.match(html, /JO-SAVED/);
  assert.match(html, /Overdue/);
  assert.doesNotMatch(html, /No matching job orders/);
});
