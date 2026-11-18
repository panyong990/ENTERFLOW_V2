import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { transformSync } from 'esbuild';

const require = createRequire(import.meta.url);

function adapter() {
  let captured;
  const source = readFileSync(new URL('./stockRequests.js', import.meta.url), 'utf8');
  const compiled = transformSync(source, { loader: 'js', format: 'cjs' });
  const module = new Module(new URL('./stockRequests.fixture.cjs', import.meta.url).pathname);
  module.paths = require.resolve.paths('react');
  module.require = request => request === './client'
    ? { api: (path, options) => { captured = { path, options }; return Promise.resolve([]); } }
    : require(request);
  module._compile(compiled.code, 'stockRequests.fixture.cjs');
  return { ...module.exports, captured: () => captured };
}

test('Warehouse Stock Request adapter validates array data', async () => {
  const service = adapter();
  const signal = new AbortController().signal;
  const result = await service.listStockRequests(signal);
  assert.deepEqual(result, []);
  assert.equal(service.captured().path, '/api/stock-requests');
  assert.equal(service.captured().options.signal, signal);
  assert.deepEqual(service.normalizeStockRequests([]), []);
  assert.throws(() => service.normalizeStockRequests({ items: [] }), /invalid response/);
});

test('Sales submission and Warehouse processing use the approved POST and PATCH contracts', async () => {
  const service = adapter();
  const createSignal = new AbortController().signal;
  const request = { orderId: '9007199254740993', lines: [{ materialId: '18446744073709551615', quantity: 1.25 }] };
  await service.createStockRequest(request, createSignal);
  assert.deepEqual(service.captured(), {
    path: '/api/stock-requests',
    options: { method: 'POST', body: request, signal: createSignal },
  });

  const processSignal = new AbortController().signal;
  const response = { status: 'updated', lines: [{ lineId: '601', currentQuantity: 0, shortageQuantity: 1.25 }], inventoryUpdates: [{ materialId: '18446744073709551615', quantityOnHand: 0 }] };
  await service.processStockRequest('18446744073709551615', response, processSignal);
  assert.deepEqual(service.captured(), {
    path: '/api/stock-requests/18446744073709551615',
    options: { method: 'PATCH', body: response, signal: processSignal },
  });
});
