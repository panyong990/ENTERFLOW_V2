import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (name) => fs.readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

test("logistics and delivery receipts expose complete Real Mode structures without Demo records", () => {
  const logistics = read("Logistics.tsx");
  const receipts = read("DeliveryReceipts.tsx");

  for (const source of [logistics, receipts]) {
    assert.match(source, /useSession/);
    assert.match(source, /mode === "real"/);
    assert.match(source, /Real .*records are unavailable/);
  }
  assert.match(receipts, /realMode \? "—"/);
  assert.match(logistics, /realMode \? "—"/);
  assert.match(logistics, /No authenticated .*API is connected/);
});

test("waybill scanner, history, and monitoring retain their UI while excluding Demo records in Real Mode", () => {
  for (const name of ["WaybillScanner.tsx", "WaybillHistory.tsx", "WaybillMonitoring.tsx"]) {
    const source = read(name);
    assert.match(source, /useSession/);
    assert.match(source, /mode === "real"/);
    assert.match(source, /Real .*unavailable/);
  }

  const scanner = read("WaybillScanner.tsx");
  assert.match(scanner, /if \(realMode\)/);
  assert.match(scanner, /no scan was started/);
  assert.match(scanner, /disabled=\{realMode\}/);
});
