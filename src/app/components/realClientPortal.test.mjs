import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./RealClientPortal.tsx", import.meta.url), "utf8");
const app = await readFile(new URL("../App.tsx", import.meta.url), "utf8");

test("Real Client Portal uses the authenticated client branch and does not replace Demo ClientPortal", () => {
  assert.match(app, /identity\.accountType==='client'.*<RealClientPortal/s);
  assert.match(app, /session\.role === "client".*<ClientPortal/s);
  assert.match(source, /clientPortalApi\.profile/);
  assert.match(source, /clientPortalApi\.dashboard/);
  assert.match(source, /clientPortalApi\.orders/);
  assert.doesNotMatch(source, /localStorage|CLIENTS_DATA|byClient\(/);
});

test("Real Client Portal loads all supported read surfaces and protects request lifecycles", () => {
  for (const method of ["order", "quotations", "purchaseOrder", "jobOrders", "delivery", "invoices", "payments", "notifications", "markNotificationRead"]) assert.match(source, new RegExp(`clientPortalApi\\.${method}`));
  assert.match(source, /new AbortController\(\)/);
  assert.match(source, /detailController\.current\?\.abort\(\)/);
  assert.match(source, /role="status"/);
  assert.match(source, /role="alert"/);
  assert.match(source, /Retry/);
});
