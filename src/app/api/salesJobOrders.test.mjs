import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { transformSync } from 'esbuild';

const require = createRequire(import.meta.url);

function adapter() {
  const source = readFileSync(new URL('./salesJobOrders.js', import.meta.url), 'utf8');
  const compiled = transformSync(source, { loader: 'js', format: 'cjs' });
  const module = new Module(new URL('./salesJobOrders.fixture.cjs', import.meta.url).pathname);
  module.paths = require.resolve.paths('react');
  module.require = request => {
    if (request === './client') return { api: (path, options) => ({ path, options }) };
    return require(request);
  };
  module._compile(compiled.code, 'salesJobOrders.fixture.cjs');
  return module.exports;
}

test('Job Order adapter constructs the exact order-scoped endpoint and preserves BIGINT order IDs', () => {
  const { listSalesJobOrders, createSalesJobOrders } = adapter();
  const signal = new AbortController().signal;
  const result = listSalesJobOrders('18446744073709551615', signal);
  assert.equal(result.path, '/api/sales/orders/18446744073709551615/job-orders');
  assert.equal(result.options.signal, signal);
  assert.deepEqual(createSalesJobOrders('18446744073709551615', { productionDueDate: '2026-12-31' }, signal), {
    path: '/api/sales/orders/18446744073709551615/job-orders',
    options: { method: 'POST', body: { productionDueDate: '2026-12-31' }, signal },
  });
});

test('Job Order mapping keeps status, pause state, dates, BOM count, and IDs separate', () => {
  const { mapSalesJobOrder } = adapter();
  const result = mapSalesJobOrder({ id: '18446744073709551615', orderItemId: '9007199254740993', specificationId: '3', replacementRequestId: null, currentStageCursor: 8, currentStageLabel: 'Quality / Product Inspection', status: 'in_production', paused: 1, pauseReason: 'Material hold', bomLineCount: '4', productionEvents: [] });
  assert.equal(result.id, '18446744073709551615');
  assert.equal(result.orderItemId, '9007199254740993');
  assert.equal(result.currentStageCursor, 8);
  assert.equal(result.currentStageLabel, 'Quality / Product Inspection');
  assert.equal(result.status, 'in_production');
  assert.equal(result.paused, true);
  assert.equal(result.pauseReason, 'Material hold');
  assert.equal(result.bomLineCount, 4);
});

test('cursor 9 and missing labels remain explicit and do not receive an invented stage', () => {
  const { mapSalesJobOrder } = adapter();
  const result = mapSalesJobOrder({ id: '1', currentStageCursor: 9, currentStageLabel: null, status: 'completed', paused: 0, productionEvents: [] });
  assert.equal(result.currentStageCursor, 9);
  assert.equal(result.currentStageLabel, null);
  assert.equal(result.status, 'completed');
});

test('production events preserve backend order, optional fields, and string IDs', () => {
  const { mapSalesJobOrder } = adapter();
  const result = mapSalesJobOrder({ id: '1', currentStageCursor: 2, status: 'in_production', paused: 0, productionEvents: [
    { id: '9007199254740993', jobOrderId: '1', stagePosition: 0, stageLabel: 'Molding', action: 'done', reason: null, occurredAt: null },
    { id: '2', jobOrderId: '1', stagePosition: 2, stageLabel: null, action: 'reverted', reason: 'Rework', occurredAt: '2026-11-16T00:00:00.000Z' },
  ] });
  assert.deepEqual(result.productionEvents.map(event => event.id), ['9007199254740993', '2']);
  assert.equal(result.productionEvents[0].occurredAt, null);
  assert.equal(result.productionEvents[1].stageLabel, null);
  assert.equal(result.productionEvents[1].reason, 'Rework');
});

test('Job Order mapping does not fabricate BOM material details or production history', () => {
  const { mapSalesJobOrder } = adapter();
  const result = mapSalesJobOrder({ id: '1', currentStageCursor: 0, status: 'queued', paused: 0, bomLineCount: 0 });
  assert.deepEqual(result.productionEvents, []);
  assert.equal(Object.hasOwn(result, 'materials'), false);
  assert.equal(Object.hasOwn(result, 'materialNames'), false);
});
