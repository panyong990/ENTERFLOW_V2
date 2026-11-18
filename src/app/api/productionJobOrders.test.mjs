import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { transformSync } from 'esbuild';

const require = createRequire(import.meta.url);
function adapter() {
  const source = readFileSync(new URL('./productionJobOrders.js', import.meta.url), 'utf8');
  const compiled = transformSync(source, { loader: 'js', format: 'cjs' });
  const module = new Module(new URL('./productionJobOrders.fixture.cjs', import.meta.url).pathname);
  module.paths = require.resolve.paths('react');
  module.require = request => request === './client' ? { api: (path, options) => ({ path, options }), queryString: values => new URLSearchParams(Object.entries(values).map(([key, value]) => [key, String(value)])).toString() } : require(request);
  module._compile(compiled.code, 'productionJobOrders.fixture.cjs');
  return module.exports;
}

test('Production Job Order adapters use authenticated list/detail endpoints and preserve IDs', () => {
  const { productionJobOrdersPath, listProductionJobOrders, getProductionJobOrder, mapProductionJobOrder } = adapter();
  const signal = new AbortController().signal;
  assert.equal(productionJobOrdersPath({ q: 'JO-1', status: 'jo', page: 2, pageSize: 10 }), '/api/production/job-orders?q=JO-1&status=jo&page=2&pageSize=10');
  assert.equal(listProductionJobOrders({ status: 'jo' }, signal).options.signal, signal);
  assert.equal(getProductionJobOrder('18446744073709551615', signal).path, '/api/production/job-orders/18446744073709551615');
  const result = mapProductionJobOrder({ id: '18446744073709551615', orderId: '9007199254740993', clientId: '7', quantity: '10', currentStageCursor: '0', paused: 0 });
  assert.equal(result.id, '18446744073709551615');
  assert.equal(result.quantity, 10);
});
