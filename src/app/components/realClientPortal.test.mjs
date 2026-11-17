import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./RealClientPortal.tsx", import.meta.url), "utf8");
const data = await readFile(new URL("./client/data.tsx", import.meta.url), "utf8");
const portal = await readFile(new URL("./client/ClientPortal.tsx", import.meta.url), "utf8");
const app = await readFile(new URL("../App.tsx", import.meta.url), "utf8");

test("authenticated Client routing selects the scoped original portal without changing employee routing", () => {
  assert.match(app, /identity\.accountType==='client'.*<RealClientPortal/s);
  assert.match(app, /identity\.roleCode!==['"]admin['"].*<RealEmployeeShell/);
  assert.match(source, /ClientDataProvider/);
  assert.match(source, /<ClientPortal clientName=/);
});

test("Client business data has no Demo persistence and all unsupported commands fail closed", () => {
  assert.doesNotMatch(data, /localStorage|sessionStorage|indexedDB|createDemoInquiries|fetch\(/);
  assert.doesNotMatch(portal, /toast\.success|DEMO_JO_DATA|B\.E\. Aerospace/);
  assert.match(data, /throw new Error\(unavailableMessage\)/);
  assert.match(data, /await clientPortalApi\.markNotificationRead/);
  assert.match(data, /controller\.abort\(\)/);
});

test("Real Client Orders keeps the target layout and separates unavailable, empty, and filtered states", () => {
  for (const marker of ["My Orders", "Create Order", "View Transaction History", "Search My Orders", "Filter My Orders by status", "Sort My Orders by submission date"]) assert.match(portal, new RegExp(marker));
  assert.match(portal, /Loading authenticated orders/);
  assert.match(portal, /Unable to load authenticated orders/);
  assert.match(portal, /No orders are available for this account/);
  assert.match(portal, /No orders match your search or status filter/);
  assert.doesNotMatch(portal, /Refresh records/);
  assert.doesNotMatch(portal, /Real Client records\. Drafts are unsaved/);
});

test("Real Client Portal keeps populated sections while making unsupported writes explicit", () => {
  for (const marker of ["Order Status Tracker", "Delivery &amp; Tracking", "My Invoices", "Company Settings", "Transaction History"]) assert.match(portal, new RegExp(marker));
  for (const marker of ["Order creation and reorder submission are unavailable", "Purchase-order submission is unavailable", "Quotation revision requests are unavailable", "Payment methods and bank instructions are unavailable", "Profile details are read-only in Real Mode", "Password change unavailable", "SIGNED DR SUBMISSION UNAVAILABLE"]) assert.match(portal, new RegExp(marker));
  assert.match(portal, /Submission unavailable/);
});

test("Real Client Portal keeps unavailable notification mutations disabled and preserves Demo routing", async () => {
  const notifications = await readFile(new URL("./client/NotificationsCenter.tsx", import.meta.url), "utf8");
  const demo = await readFile(new URL("./ClientPortal.tsx", import.meta.url), "utf8");
  assert.match(notifications, /title="Mark all as read is unavailable in Real Mode"/);
  assert.match(notifications, /title="Clearing notifications is unavailable in Real Mode"/);
  assert.match(notifications, /disabled[\s\S]*Hide notification from your history/);
  assert.match(demo, /from "\.\.\/store\/orders"/);
  assert.doesNotMatch(demo, /RealModePending/);
});
