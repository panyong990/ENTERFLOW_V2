import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (name) => fs.readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

test("General Notifications Center preserves the complete interface in Real Mode", () => {
  const source = read("NotificationsCenter.tsx");
  for (const section of ["Notifications", "Mark all read", "Clear read", "Search notifications", "Department:", "Status:", "OfficialReceiptPreviewModal"]) {
    assert.match(source, new RegExp(section.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(source, /session\.mode === "real"/);
  assert.match(source, /Real notifications are unavailable/);
  assert.match(source, /realMode \? "—"/);
});

test("General notification mutations do not report fake success in Real Mode", () => {
  const source = read("NotificationsCenter.tsx");
  assert.match(source, /No authenticated general notification API is connected/);
  for (const operation of ["Mark all as read", "Clear read notifications", "Notification replies", "Hide notification"]) {
    assert.match(source, new RegExp(`unavailable\\(\"${operation}\"\\)`));
  }
  assert.match(source, /if \(!realMode\) markRead/);
});

test("Sales keeps its separate remote notification implementation", () => {
  const source = read("sales/SalesNotificationsCenter.tsx");
  assert.match(source, /useSalesNotificationStore/);
  assert.match(source, /pendingIntegration/);
  assert.match(source, /Refresh notifications/);
});
