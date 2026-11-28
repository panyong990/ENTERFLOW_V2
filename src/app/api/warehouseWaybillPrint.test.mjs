import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { Module, createRequire } from 'node:module';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PNG } from 'pngjs';
import { QRCodeReader, BinaryBitmap, HybridBinarizer, RGBLuminanceSource } from '@zxing/library';
import { prepareRealWaybill, storedWaybillForPrint, validateWaybillResponse } from './warehouseWaybillPrint.js';

const shipment = { id: '20', jobOrderId: '30', jobOrderReference: 'JO-actual', companyName: 'Synthetic Client',
  purchaseOrderReference: 'PO-actual', salesInvoiceReference: null, deliveryMethodLabel: 'Delivery',
  clientAddress: null, dispatchedAt: null, estimatedDeliveryDate: null,
  waybillItems: [{ name: 'Filter', quantity: '3' }],
  waybills: [{ id: '9007199254740993', shipmentId: '20', reference: 'WB-stored-number', qrIdentifier: 'QR-stored-payload', printedAt: null }] };
export function decodeQr(dataUrl) {
  const image = PNG.sync.read(Buffer.from(dataUrl.split(',')[1], 'base64'));
  const luminance = new Uint8ClampedArray(image.width * image.height);
  for (let i = 0; i < luminance.length; i++) luminance[i] = (image.data[4 * i] + image.data[4 * i + 1] + image.data[4 * i + 2]) / 3;
  return new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminance, image.width, image.height)))).getText();
}
test('actual QR image decodes to the exact stored identifier, independently of Waybill number', async () => {
  const first = await prepareRealWaybill(shipment), reprint = await prepareRealWaybill(shipment);
  assert.equal(decodeQr(first.document.qrDataUrl), 'QR-stored-payload');
  assert.equal(decodeQr(reprint.document.qrDataUrl), 'QR-stored-payload');
  assert.equal(first.document.shipment.waybillIdentifier, 'WB-stored-number');
  assert.equal(first.document.dispatchDate, 'Not scheduled'); assert.equal(first.document.clientAddress, 'Not available');
});
test('missing or mismatched backend QR and nonstring BIGINT IDs fail without generating a fallback', async () => {
  for (const row of [{ ...shipment.waybills[0], qrIdentifier: '' }, { ...shipment.waybills[0], shipmentId: '99' }, { ...shipment.waybills[0], id: 51 }]) {
    const bad = { ...shipment, waybills: [row] }; assert.throws(() => storedWaybillForPrint(bad));
  }
  assert.throws(() => storedWaybillForPrint({ ...shipment, waybills: [] }));
});
test('opaque stored payload is preserved byte-for-byte, never trimmed or derived from display data', async () => {
  let payload;
  const value = await prepareRealWaybill({ ...shipment, waybills: [{ ...shipment.waybills[0], qrIdentifier: ' QR-legacy ' }] },
    { encode: async id => { payload = id; return 'data:image/png;base64,AAAA'; } });
  assert.equal(payload, ' QR-legacy '); assert.equal(value.waybill.qrIdentifier, payload);
});
test('print response must retain delivery, Waybill ID, reference, QR and persisted print timestamp', () => {
  const row = { id: '51', deliveryId: '20', reference: 'WB', qrIdentifier: 'QR', printedAt: '2026-11-26T00:00:00Z' };
  const expected = { waybillId: '51', reference: 'WB', qrIdentifier: 'QR' };
  validateWaybillResponse(row, '20', expected, true);
  for (const change of [{ deliveryId: '21' }, { qrIdentifier: 'rotated' }, { id: '52' }, { reference: 'new' }, { printedAt: null }]) {
    assert.throws(() => validateWaybillResponse({ ...row, ...change }, '20', expected, true));
  }
});
test('missing persisted line items, noninteger quantities and unsafe image sources block printing', async () => {
  for (const waybillItems of [[], [{ name: 'Filter', quantity: '0' }], [{ name: 'Filter', quantity: '1.5' }]]) {
    await assert.rejects(() => prepareRealWaybill({ ...shipment, waybillItems }));
  }
  await assert.rejects(() => prepareRealWaybill(shipment, { encode: async () => 'https://external.test/qr' }));
});
test('quantity totals remain exact strings and empty invoice fields are never invented', async () => {
  const value = await prepareRealWaybill({ ...shipment, waybillItems: [{ name: 'A', quantity: '4294967295' }, { name: 'B', quantity: '4294967295' }] },
    { encode: async () => 'data:image/png;base64,AAAA' });
  assert.equal(value.document.shipment.qty, '8589934590'); assert.equal(value.document.shipment.si, 'Not available');
});
test('shared document retains the reviewed current Demo markup and escapes backend text', async () => {
  const bundle = await build({ entryPoints: ['src/app/components/WaybillDocument.tsx'], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react-dom'] });
  const mod = new Module(resolve('waybill-document-fixture.cjs')); mod.paths = createRequire(import.meta.url).resolve.paths('react');
  mod._compile(bundle.outputFiles[0].text, resolve('waybill-document-fixture.cjs'));
  const data = { shipment: { waybillIdentifier: 'WB-BASELINE', jo: 'JO-BASELINE', client: 'Synthetic Client', item: 'Filter', qty: 3, po: 'PO-BASELINE', si: 'SI-BASELINE', method: 'Delivery' },
    qrDataUrl: 'data:image/png;base64,AAAA', dispatchDate: '2026-11-26', clientAddress: 'Synthetic Address' };
  const html = renderToStaticMarkup(React.createElement(mod.exports.WaybillDocument, { data }));
  // The current layout predates this integration task. An independent render
  // with this task's reference wrappers removed produced the same digest.
  assert.equal(createHash('sha256').update(html).digest('hex'), 'e1edc9f1817f17d9a023a40902289f19972759a1939ed104869f3b4f49f6b5b8');
  data.clientAddress = '<script>bad()</script>';
  const escaped = renderToStaticMarkup(React.createElement(mod.exports.WaybillDocument, { data }));
  assert.ok(escaped.includes('&lt;script&gt;')); assert.equal(escaped.includes('<script>'), false);
});
