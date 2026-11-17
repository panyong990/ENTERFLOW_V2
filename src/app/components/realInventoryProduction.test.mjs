import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const inventory = await readFile(new URL('./Inventory.tsx', import.meta.url), 'utf8');
const production = await readFile(new URL('./ProductionFloor.tsx', import.meta.url), 'utf8');
const operationsProduction = await readFile(new URL('./OperationsProductionFloor.tsx', import.meta.url), 'utf8');
const workspace = await readFile(new URL('./RealRoleWorkspace.tsx', import.meta.url), 'utf8');

test('Real Inventory keeps the complete interface while excluding Demo data and writes', () => {
  assert.match(inventory, /const realMode = mode === "real"/);
  assert.match(inventory, /Real Inventory records are not connected/);
  assert.match(inventory, /realMode \? "—"/);
  assert.match(inventory, /const readOnly = isOperationsReadOnly \|\| realMode/);
});

test('Real Production keeps monitoring and detail surfaces read-only with unavailable data states', () => {
  assert.match(production, /const realMode = mode === "real"/);
  assert.match(production, /const readOnly = requestedReadOnly \|\| realMode/);
  assert.match(production, /Real Production records are not connected/);
  assert.match(production, /realMode \? "Production records are unavailable"/);
  assert.match(operationsProduction, /const realMode = mode === "real"/);
  assert.match(operationsProduction, /realMode \? "—"/);
  assert.match(operationsProduction, /Real Production records are not connected/);
});

test('Real role routing continues to use the existing Inventory and Production components', () => {
  assert.match(workspace, /route === "production"/);
  assert.match(workspace, /route === "inventory" \|\| route === "inventory-finished"/);
  assert.doesNotMatch(workspace, /RealInventory|RealProduction/);
});
