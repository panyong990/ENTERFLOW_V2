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
