import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = name => fs.readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

test("Real Warehouse inventory and stock requests remain API-backed", () => {
  const source = read("Inventory.tsx");
  assert.match(source, /getInventory|useMaterials/);
  assert.match(source, /RealWarehouseStockRequests/);
  assert.match(source, /SHIPMENTS/);
  assert.match(source, /RealWarehouseShipments/);
});

test("Real Warehouse shipments provide list/detail, loading, empty, error, and retry states", () => {
  const source = read("RealWarehouseShipments.tsx");
  for (const marker of ["listWarehouseShipments", "getWarehouseShipment", "Loading shipments", "No shipment records were returned", "Retry", "Read-only shipment and handoff records"]) {
    assert.ok(source.includes(marker), marker);
  }
});

test("Inventory presents distinct empty, filtered, loading, unavailable, and retry states", () => {
  const inventory = read("Inventory.tsx");
  const finishedGoods = read("FinishedGoodsOrderActivity.tsx");
  assert.match(inventory, /No inventory material records are available/);
  assert.match(inventory, /No materials match the selected search and filters/);
  assert.match(inventory, /Number\.isFinite\(m\.threshold\) \? m\.threshold : "Not recorded"/);
  assert.match(finishedGoods, /Loading authenticated finished-good inventory/);
  assert.match(finishedGoods, /Finished-good inventory is unavailable/);
  assert.match(finishedGoods, /No finished-good inventory records are available/);
  assert.match(finishedGoods, /No finished goods match the selected search and filters/);
  assert.match(finishedGoods, /onClick=\{refreshInventory\}/);
  assert.match(finishedGoods, /item\.itemName \|\| "Not provided"/);
});
