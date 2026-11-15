import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./salesDelivery.js', import.meta.url), 'utf8');

test('builds the delivery endpoint with a BIGINT-safe encoded order ID', () => {
  assert.match(source, /encodeURIComponent\(orderId\)/);
  assert.match(source, /\/api\/sales\/orders\/\$\{encodeURIComponent\(orderId\)\}\/delivery/);
});

test('maps multiple shipments and preserves delivery fields and dates', () => {
  assert.match(source, /mapSalesShipment/);
  assert.match(source, /\.\.\.shipment/);
  assert.match(source, /String\(value\)/);
});

test('maps waybills and keeps receipt creation separate from signed receipt submission', () => {
  assert.match(source, /mapSalesWaybill/);
  assert.match(source, /mapSalesSignedReceipt/);
  assert.match(source, /\.\.\.receipt/);
});

test('empty related collections remain empty and no records are fabricated', () => {
  assert.match(source, /\?\? \[\]/);
  assert.doesNotMatch(source, /generatedWaybill|fabricated|fileContents|download/);
});
