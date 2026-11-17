import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (name) => fs.readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

test("Accounting preserves the full ledger and invoice UI while isolating Real Mode financial data", () => {
  const source = read("Accounting.tsx");
  assert.match(source, /Payments Ledger/);
  assert.match(source, /Paid & Closed History/);
  assert.match(source, /Invoice No\./);
  assert.match(source, /payment history/i);
  assert.match(source, /useSession/);
  assert.match(source, /mode === "real"/);
  assert.match(source, /Real financial records are unavailable/);
  assert.match(source, /mode === "real" \? "—"/);
});

test("Accounting mutations remain explicitly unavailable in Real Mode", () => {
  const source = read("Accounting.tsx");
  for (const operation of [
    "Receipt updates",
    "Payment recording",
    "Account clearing",
    "Payment verification",
    "Payment rejection",
    "Payment reminders",
    "Official Receipt issuance",
  ]) {
    assert.match(source, new RegExp(`unavailableFinancialOperation\\("${operation.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}"\\)`));
  }
  assert.match(source, /No authenticated financial API is connected/);
});

test("the accounting dashboard KPI component masks Real Mode financial metrics", () => {
  const source = read("KPICard.tsx");
  assert.match(source, /mode === "real" \? "—"/);
  assert.match(source, /Live metric unavailable/);
});
