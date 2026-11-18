import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { transformSync } from 'esbuild';

const require = createRequire(import.meta.url);

function adapter() {
  const source = readFileSync(new URL('./salesOrderDocuments.js', import.meta.url), 'utf8');
  const compiled = transformSync(source, { loader: 'js', format: 'cjs' });
  const module = new Module(new URL('./salesOrderDocuments.fixture.cjs', import.meta.url).pathname);
  module.paths = require.resolve.paths('react');
  module.require = request => {
    if (request === './client') return { api: (path, options) => ({ path, options }) };
    return require(request);
  };
  module._compile(compiled.code, 'salesOrderDocuments.fixture.cjs');
  return module.exports;
}

test('quotation and purchase-order adapters construct exact order-scoped endpoints', () => {
  const { listSalesQuotations, getSalesPurchaseOrder, processSalesPurchaseOrder } = adapter();
  const signal = new AbortController().signal;
  assert.equal(listSalesQuotations('18446744073709551615', signal).path, '/api/sales/orders/18446744073709551615/quotations');
  assert.equal(getSalesPurchaseOrder('18446744073709551615', signal).path, '/api/sales/orders/18446744073709551615/purchase-order');
  assert.equal(listSalesQuotations('1', signal).options.signal, signal);
  assert.deepEqual(processSalesPurchaseOrder('18446744073709551615', { decision: 'validated' }, signal), {
    path: '/api/sales/orders/18446744073709551615/purchase-order/process',
    options: { method: 'POST', body: { decision: 'validated' }, signal },
  });
});

test('quotation mapping preserves revision status and monetary strings', () => {
  const { mapSalesQuotation } = adapter();
  const result = mapSalesQuotation({ id: '9007199254740993', revisionNumber: 2, status: 'superseded', totalAmount: '123456789012345678.90', sent: false, lines: [{ id: '3', quotationId: '9007199254740993', orderItemId: '4' }], files: [{ id: '5', quotationId: '9007199254740993' }] });
  assert.equal(result.id, '9007199254740993');
  assert.equal(result.revisionNumber, 2);
  assert.equal(result.status, 'superseded');
  assert.equal(result.totalAmount, '123456789012345678.90');
  assert.equal(result.lines[0].orderItemId, '4');
  assert.equal(result.files[0].id, '5');
});

test('purchase-order mapping preserves received and cleared distinctions and safe file metadata', () => {
  const { mapSalesPurchaseOrder } = adapter();
  const result = mapSalesPurchaseOrder({ id: '18446744073709551615', acceptedQuotationId: '9007199254740993', received: false, cleared: false, files: [{ id: '7', originalFilename: 'purchase-order.pdf', mimeType: 'application/pdf' }] });
  assert.equal(result.id, '18446744073709551615');
  assert.equal(result.acceptedQuotationId, '9007199254740993');
  assert.equal(result.received, false);
  assert.equal(result.cleared, false);
  assert.deepEqual(result.files[0], { id: '7', originalFilename: 'purchase-order.pdf', mimeType: 'application/pdf' });
});

test('document adapters do not create file URLs or file contents', () => {
  const { mapSalesQuotation, mapSalesPurchaseOrder } = adapter();
  const quotation = mapSalesQuotation({ files: [{ id: '1', originalFilename: 'quote.pdf', state: 'available' }] });
  const purchaseOrder = mapSalesPurchaseOrder({ files: [{ id: '2', originalFilename: 'po.pdf', state: 'available' }] });
  for (const file of [...quotation.files, ...purchaseOrder.files]) {
    assert.equal(Object.hasOwn(file, 'dataUrl'), false);
    assert.equal(Object.hasOwn(file, 'downloadUrl'), false);
    assert.equal(Object.hasOwn(file, 'storagePath'), false);
  }
});
