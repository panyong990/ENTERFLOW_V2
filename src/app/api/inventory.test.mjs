import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire, Module } from 'node:module';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const require = createRequire(import.meta.url);

function adapter() {
  let captured;
  const source = readFileSync(new URL('./inventory.js', import.meta.url), 'utf8');
  const compiled = transformSync(source, { loader: 'js', format: 'cjs' });
  const module = new Module(new URL('./inventory.fixture.cjs', import.meta.url).pathname);
  module.paths = require.resolve.paths('react');
  module.require = request => request === './client'
    ? { api: (path, options) => { captured = { path, options }; return Promise.resolve({ materials: [], finishedGoods: [] }); } }
    : require(request);
  module._compile(compiled.code, 'inventory.fixture.cjs');
  return { ...module.exports, captured: () => captured };
}

test('authenticated inventory retrieval forwards cancellation', async () => {
  const service = adapter();
  const signal = new AbortController().signal;
  assert.deepEqual(await service.getInventory(signal), { materials: [], finishedGoods: [] });
  assert.deepEqual(service.captured(), { path: '/api/inventory', options: { signal } });
});

test('Warehouse material maintenance uses only the approved create and detail-update API contracts', async () => {
  const service = adapter();
  const signal = new AbortController().signal;
  const material = { itemCode: 'RM-NEW-1', name: 'New material', unit: 'BUNDLE', category: null, threshold: null, supplier: null };
  await service.createInventoryMaterial(material, signal);
  assert.deepEqual(service.captured(), { path: '/api/inventory/materials', options: { method: 'POST', body: material, signal } });

  const updates = { name: 'Updated material', threshold: '0' };
  await service.updateInventoryMaterial('61', updates, signal);
  assert.deepEqual(service.captured(), { path: '/api/inventory/materials/61', options: { method: 'PATCH', body: updates, signal } });
});
