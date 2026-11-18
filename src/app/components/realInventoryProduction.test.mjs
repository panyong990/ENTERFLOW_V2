import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const inventory = await readFile(new URL('./Inventory.tsx', import.meta.url), 'utf8');
const materials = await readFile(new URL('../store/materials.tsx', import.meta.url), 'utf8');
const production = await readFile(new URL('./ProductionFloor.tsx', import.meta.url), 'utf8');
const operationsProduction = await readFile(new URL('./OperationsProductionFloor.tsx', import.meta.url), 'utf8');
const workspace = await readFile(new URL('./RealRoleWorkspace.tsx', import.meta.url), 'utf8');

test('Real Inventory keeps the existing interface and routes maintenance through authenticated APIs', async () => {
  assert.match(inventory, /const realMode = mode === "real"/);
  assert.match(inventory, /onContextMenu=\{\(event\) =>/);
  assert.match(inventory, /Pencil size=\{13\} \/> Update/);
  assert.match(inventory, /quantityOnHand/);
  assert.match(inventory, /realMode \? "—"/);
  assert.match(inventory, /const canMaintainRealMaterials = realMode && \(role === "warehouse" \|\| role === "admin"\)/);
  assert.match(inventory, /createInventoryMaterialRequest/);
  assert.match(inventory, /updateInventoryMaterialRequest/);
  assert.match(inventory, /INCOMING STOCK REQUESTS/);
  assert.match(await readFile(new URL('./RealWarehouseStockRequests.tsx', import.meta.url), 'utf8'), /<StockRequestsModal/);
  assert.match(await readFile(new URL('../api/stockRequests.js', import.meta.url), 'utf8'), /normalizeStockRequests/);
  const workspaceSource = await readFile(new URL('./RealRoleWorkspace.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(workspaceSource, /LiveDataNotice/);
  assert.doesNotMatch(workspaceSource, /inventoryHasItsOwnDataState/);
});

test('Real MaterialsProvider preserves catalog references and uses an explicit database identity map', () => {
  const catalogEntries = (materials.match(/MAT\(/g) ?? []).length - 1;
  assert.ok(catalogEntries >= 1);
  assert.match(materials, /export const materialCatalog/);
  assert.match(materials, /mergeInventoryCatalog/);
  assert.match(materials, /inventoryError/);
  assert.match(inventory, /Not recorded/);
});

test('Sales quotation material lookup uses authenticated records and approved prices without manufacturing BOM inputs', async () => {
  const costing = await readFile(new URL('./CostEstimationPanel.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(costing, /Authenticated material lookup/);
  assert.match(costing, /serverCosting/);
  assert.match(costing, /Material requirements and prices are calculated from saved records/);
  assert.match(materials, /getInventory\(controller\.signal\)/);
});

test('Real Inventory exposes unknown stock separately and shows Finished Goods quantities and status', async () => {
  assert.match(inventory, /<option value="unavailable">Not recorded<\/option>/);
  assert.match(materials, /available: Number\.NaN/);
  const finishedGoods = await readFile(new URL('./FinishedGoodsOrderActivity.tsx', import.meta.url), 'utf8');
  assert.match(finishedGoods, /getFinishedGoodStockStatus/);
  assert.match(finishedGoods, /Number\.isFinite\(item\.qtyInStock\) \? `\$\{item\.qtyInStock\} pcs` : "Not recorded"/);
  assert.match(finishedGoods, /stockStatus\.label/);
});

test('Real Stock Request views retain order, quotation, original stock snapshots, and quantity limits', async () => {
  const warehouseRequests = await readFile(new URL('./RealWarehouseStockRequests.tsx', import.meta.url), 'utf8');
  const salesRequests = await readFile(new URL('./sales/RealSalesStockRequests.tsx', import.meta.url), 'utf8');
  assert.match(warehouseRequests, /<StockRequestsModal/);
  assert.match(warehouseRequests, /inventoryUpdates/);
  assert.match(salesRequests, /<StockRequestsModal/);
  assert.match(salesRequests, /createStockRequest/);
  assert.match(salesRequests, /stockRequestReady/);
  assert.match(salesRequests, /disabled=\{!ready \|\| uncertain\}/);
});

test('Real Production uses authenticated Job Order retrieval while keeping the existing screen read-only', async () => {
  assert.match(production, /const realMode = mode === "real"/);
  assert.match(production, /const readOnly = requestedReadOnly \|\| realMode/);
  assert.match(production, /useProductionJobOrders/);
  assert.doesNotMatch(production, /if \(realMode\) return <ProductionRealJobOrders/);
  assert.match(await readFile(new URL('./ProductionRealJobOrders.tsx', import.meta.url), 'utf8'), /export \{ ProductionFloor as ProductionRealJobOrders \} from "\.\/ProductionFloor"/);
  const productionReal = await readFile(new URL('./productionJobOrderPresentation.tsx', import.meta.url), 'utf8');
  assert.match(productionReal, /Outer diameter 1/);
  assert.doesNotMatch(productionReal, /label=\{key\} value=\{detail\[key\]\}/);
  assert.match(await readFile(new URL('../api/productionJobOrders.js', import.meta.url), 'utf8'), /\/api\/production\/job-orders/);
  assert.match(operationsProduction, /const realMode = mode === "real"/);
  assert.match(operationsProduction, /realMode \? "—"/);
  assert.match(operationsProduction, /useProductionJobOrders/);
  assert.match(operationsProduction, /Job Orders are loaded from the authenticated Production API/);
});

test('Real role routing continues to use the existing Inventory and Production components', () => {
  assert.match(workspace, /route === "production"/);
  assert.match(workspace, /route === "inventory" \|\| route === "inventory-finished"/);
  assert.doesNotMatch(workspace, /RealInventory|RealProduction/);
});
