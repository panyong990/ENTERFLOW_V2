import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { transformSync } from 'esbuild';

const require = createRequire(import.meta.url);

function adapter() {
  const source = readFileSync(new URL('./salesClients.js', import.meta.url), 'utf8');
  const compiled = transformSync(source, { loader: 'js', format: 'cjs' });
  const module = new Module(new URL('./salesClients.fixture.cjs', import.meta.url).pathname);
  module.paths = require.resolve.paths('react');
  module.require = request => {
    if (request === './client') return {
      api: (path, options) => ({ path, options }),
      queryString: values => new URLSearchParams(Object.entries(values).map(([key, value]) => [key, String(value)])).toString(),
    };
    return require(request);
  };
  module._compile(compiled.code, 'salesClients.fixture.cjs');
  return module.exports;
}

test('Sales client list adapter uses the exact endpoint contract and forwards cancellation', () => {
  const { listSalesClients } = adapter();
  const signal = new AbortController().signal;
  const result = listSalesClients({ q: 'Acme', status: 'inactive', sort: 'name-desc', page: 2, pageSize: 10 }, signal);
  assert.equal(result.path, '/api/sales/clients?q=Acme&status=inactive&sort=name-desc&page=2&pageSize=10');
  assert.equal(result.options.signal, signal);
});

test('Sales client detail adapter preserves BIGINT identifiers as URL strings', () => {
  const { getSalesClient } = adapter();
  const result = getSalesClient('18446744073709551615');
  assert.equal(result.path, '/api/sales/clients/18446744073709551615');
  assert.equal(result.options.signal, undefined);
});
