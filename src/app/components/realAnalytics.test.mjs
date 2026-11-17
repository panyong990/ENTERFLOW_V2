import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const analytics = await readFile(new URL("./AnalyticsFullView.tsx", import.meta.url), "utf8");
const workspace = await readFile(new URL("./RealRoleWorkspace.tsx", import.meta.url), "utf8");
const orders = await readFile(new URL("../store/orders.tsx", import.meta.url), "utf8");
const materials = await readFile(new URL("../store/materials.tsx", import.meta.url), "utf8");

test("Real Mode routes to the complete Analytics interface", () => {
  assert.match(workspace, /route === "analytics"\) return <AnalyticsFullView \/>/);
  for (const section of ["Revenue", "Sales", "Production", "Inventory", "Logistics", "Payments", "Reports"]) assert.match(analytics, new RegExp(`label: "${section}"`));
  assert.match(analytics, /role="tablist"/);
  assert.match(analytics, /Reporting Period/);
});

test("Real analytics never presents empty Real stores as live metrics or exports", () => {
  assert.match(analytics, /const realMode = mode === "real"/);
  assert.match(analytics, /Live analytics data unavailable/);
  assert.match(analytics, /Live reporting data is unavailable from the authenticated APIs/);
  assert.match(analytics, /Report export is unavailable/);
  assert.match(analytics, /const companyHealth = realMode/);
  assert.match(orders, /realMode \? \[\] :/);
  assert.match(materials, /realMode \? \[\] :/);
});

test("Demo analytics behavior remains backed by Demo stores", () => {
  assert.match(analytics, /displayedValue = mode === "real" \? "—" : value/);
  assert.match(analytics, /downloadCsv\(`enter-flow-\$\{report\}/);
  assert.doesNotMatch(analytics, /localStorage|sessionStorage|indexedDB/);
});
