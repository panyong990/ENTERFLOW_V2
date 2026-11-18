import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('authenticated route entry points retain the original role page layouts', () => {
  const accounting = read('./Accounting.tsx');
  const logistics = read('./Logistics.tsx');
  const production = read('./ProductionFloor.tsx');
  assert.doesNotMatch(accounting, /return mode === "real" \? <RealAccounting/);
  assert.doesNotMatch(logistics, /return mode === "real" \? <RealLogisticsShipments/);
  assert.doesNotMatch(production, /if \(realMode\) return <ProductionRealJobOrders/);
  assert.doesNotMatch(accounting, /<RealAccounting\b/);
  assert.doesNotMatch(logistics, /<RealLogisticsShipments\b/);
  assert.match(accounting, /useRealAccounting/);
  assert.match(logistics, /useRealLogisticsShipments/);
  assert.match(production, /production-floor flex-1/);
  assert.match(production, /Production event history|recordedProductionHistory|ProductionEventHistory/);
});
test('Owner and Operations API integrations live in the components reached by the router', () => {
  const workspace = read('./RealRoleWorkspace.tsx');
  assert.match(workspace, /<OperationsProductionFloor/);
  assert.match(workspace, /<AnalyticsFullView/);
  assert.match(workspace, /<Dashboard variant=\{role\}/);
  assert.match(read('./AnalyticsFullView.tsx'), /'\/api\/owner\/dashboard', realMode && role === 'owner'/);
  assert.match(read('./Dashboard.tsx'), /useProductionJobOrders/);
  assert.match(read('./OperationsProductionFloor.tsx'), /useProductionJobOrders/);
});
test('unavailable material controls and uncertain stock submissions cannot run the mutation', () => {
  const source = read('./sales/RealSalesStockRequests.tsx');
  assert.match(source, /recordedMaterials.length > 0/);
  assert.match(source, /if \(!ready \|\| lock.current \|\| uncertain\) return/);
  assert.match(source, /disabled=\{!ready \|\| uncertain\}/);
  assert.match(source, /setUncertain\(unknown\)/);
  assert.match(source, /<StockRequestsModal/);
});
