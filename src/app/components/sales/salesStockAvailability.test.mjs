import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const detailSource = readFileSync(new URL('./SalesDocumentSections.tsx', import.meta.url), 'utf8');
const actionsSource = readFileSync(new URL('./LiveSalesActions.tsx', import.meta.url), 'utf8');
const hookSource = readFileSync(new URL('../useSalesOrders.ts', import.meta.url), 'utf8');

test('Sales order detail presents a read-only stock availability section with loading, error, refresh, and unavailable states', () => {
  assert.match(detailSource, /StockAvailabilitySection/);
  assert.match(detailSource, /Stock availability check/);
  assert.match(detailSource, /Refresh stock/);
  assert.match(detailSource, /Checking recorded inventory/);
  assert.match(detailSource, /Stock availability is unavailable/);
  assert.match(detailSource, /Transient result.*no stock changed/);
});

test('Real Sales stock availability uses its authenticated adapter and never imports Demo inventory data', () => {
  assert.match(hookSource, /getSalesStockAvailability/);
  assert.match(hookSource, /useSalesStockAvailability/);
  assert.doesNotMatch(detailSource, /useMaterials|productBOM|buildStockRequestMaterials/);
  assert.match(hookSource, /stockChanged/);
});

test('Sales detail exposes authenticated purchase-order review actions without downstream claims', () => {
  assert.match(actionsSource, /APPROVE PO/);
  assert.match(actionsSource, /REJECT PO/);
  assert.match(actionsSource, /processSalesPurchaseOrder/);
  assert.match(actionsSource, /No inventory or Job Order is created by this action/);
});
