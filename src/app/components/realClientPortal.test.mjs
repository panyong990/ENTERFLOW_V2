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
  assert.doesNotMatch(portal, /DEMO_JO_DATA|B\.E\. Aerospace/);
  assert.match(data, /throw new Error\(unavailableMessage\)/);
  assert.match(data, /clientPortalApi\.createInquiry/);
  assert.match(data, /await clientPortalApi\.markNotificationRead/);
  assert.match(data, /controller\.abort\(\)/);
});

test("Real Client Orders keeps the target layout and separates unavailable, empty, and filtered states", () => {
  for (const marker of ["My Orders", "Create Order", "View Transaction History", "Search My Orders", "Filter My Orders by status", "Sort My Orders by submission date"]) assert.match(portal, new RegExp(marker));
  assert.match(portal, /aria-label="Refresh My Orders"[\s\S]*onClick=\{refresh\}[\s\S]*disabled=\{loading\}/);
  assert.match(portal, /Loading authenticated orders/);
  assert.match(portal, /Unable to load authenticated orders/);
  assert.match(portal, /No orders are available for this account/);
  assert.match(portal, /No orders match your search or status filter/);
  assert.doesNotMatch(portal, /Refresh records/);
  assert.doesNotMatch(portal, /Real Client records\. Drafts are unsaved/);
});

test("Client inquiry form validates API limits and keeps sketch retries within upload limits", async () => {
  const validation = await readFile(new URL("./client/inquiryValidation.mjs", import.meta.url), "utf8");
  assert.match(portal, /validateClientInquiryDraft\(input\)/);
  assert.match(portal, /validateInquirySketchFile\(file, existing\)/);
  for (const marker of ["160", "200", "1_000_000", "MAX_INQUIRY_PRODUCTS", "MAX_SKETCH_FILE_BYTES", "MAX_SKETCH_TOTAL_BYTES"]) {
    assert.ok(validation.includes(marker), marker);
  }
  assert.match(portal, /Retry checks the original inquiry and resends the same details and sketches safely/);
});

test("Real Client Portal keeps populated sections while making unsupported writes explicit", () => {
  for (const marker of ["Order Status Tracker", "Delivery &amp; Tracking", "My Invoices", "Company Settings", "Transaction History"]) assert.match(portal, new RegExp(marker));
  for (const marker of ["Upload the actual PO document", "Your request will be recorded for Sales review", "Payment methods and bank instructions are unavailable", "Profile details are read-only in Real Mode", "Password change unavailable", "SIGNED DR SUBMISSION UNAVAILABLE"]) assert.match(portal, new RegExp(marker));
  assert.match(portal, /Submit Inquiry/);
  assert.doesNotMatch(portal, /Order creation and reorder submission are unavailable/);
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

test("Real Client quotation projection exposes public status and never exposes costing internals", async () => {
  const adapters = await readFile(new URL("./client/adapters.ts", import.meta.url), "utf8");
  assert.match(adapters, /quotationStatus: latest\?\./);
  assert.match(adapters, /quotationIsLatestRevision: latest\?\.isLatestRevision/);
  assert.match(adapters, /revisionRequests: order\.revisionRequests\?\.map/);
  assert.doesNotMatch(adapters, /rawMaterial|laborCost|markupPercent|quantityPerFilter|wastePercent/);
  assert.match(portal, /Quotation status/);
  assert.match(portal, /No sent quotation is available for this order/);
  assert.match(portal, /Internal costing is unavailable from the Client API/);
});

test("Client can request one revision only from the active sent quotation and sees refreshed pending state", () => {
  assert.match(portal, /REQUEST QUOTATION REVISION/);
  assert.match(portal, /quotationIsLatestRevision === false/);
  assert.match(portal, /quotationStatus !== "sent"/);
  assert.match(portal, /Revision requested · Awaiting Sales/);
  assert.match(portal, /revisionSubmitting \? "Submitting…"/);
  assert.doesNotMatch(portal, /\{false \? \([\s\S]{0,400}Request Revision/);
});
