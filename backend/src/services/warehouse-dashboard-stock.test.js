import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyStock,
  summarizeWarehouseStock
} from './warehouse-dashboard-stock.js';

test('Verified zero is out of stock', () => {
  assert.equal(
    classifyStock('0', 'verified', '5', 'verified'),
    'out-of-stock'
  );
});

test('Quantity equal to threshold is low stock', () => {
  assert.equal(
    classifyStock('5.2500', 'verified', '5.25', 'verified'),
    'low-stock'
  );
});

test('Quantity below threshold is low stock', () => {
  assert.equal(
    classifyStock('4.9999', 'verified', '5', 'verified'),
    'low-stock'
  );
});

test('Quantity above threshold is in stock', () => {
  assert.equal(
    classifyStock('5.0001', 'verified', '5', 'verified'),
    'in-stock'
  );
});

test('Unknown quantity is not zero stock', () => {
  assert.equal(
    classifyStock(null, 'unknown', '5', 'verified'),
    'unverified'
  );
});

test('Provisional quantity is not confirmed stock', () => {
  assert.equal(
    classifyStock('0', 'provisional_sample', '5', 'verified'),
    'unverified'
  );
});

test('Positive quantity with unknown threshold is unverified', () => {
  assert.equal(
    classifyStock('10', 'verified', null, 'unknown'),
    'unverified'
  );
});

test('Verified zero remains out of stock with unknown threshold', () => {
  assert.equal(
    classifyStock('0', 'verified', null, 'unknown'),
    'out-of-stock'
  );
});

test('Dashboard counts raw material records, not quantities', () => {
  const material = {
    id: '1',
    name: 'Test Material',
    unit: 'kg',
    qtyInStock: '10',
    quantityStatus: 'verified',
    threshold: '5',
    thresholdStatus: 'verified'
  };

  const result = summarizeWarehouseStock([
    material,
    { ...material, id: '2', qtyInStock: '2' },
    { ...material, id: '3', qtyInStock: '0' }
  ], []);

  assert.equal(result.trackedRawMaterialItems, 3);
  assert.equal(result.lowStock.confirmedItems, 2);
  assert.equal(result.lowStockAlerts.length, 2);
});

test('Unverified stock is reported separately from alerts', () => {
  const result = summarizeWarehouseStock([{
    id: '1',
    qtyInStock: null,
    quantityStatus: 'unknown'
  }], []);

  assert.equal(result.lowStock.confirmedItems, 0);
  assert.equal(result.lowStock.unverifiedItems, 1);
  assert.equal(result.lowStock.complete, false);
});

test('Finished goods total uses verified whole quantities', () => {
  const result = summarizeWarehouseStock([], [
    { qtyInStock: '12', quantityStatus: 'verified' },
    { qtyInStock: '18', quantityStatus: 'verified' }
  ]);

  assert.equal(result.finishedGoods.recordedItems, 2);
  assert.equal(result.finishedGoods.totalQuantity, '30');
  assert.equal(result.finishedGoods.complete, true);
});

test('Incomplete finished goods total is not misleading', () => {
  const result = summarizeWarehouseStock([], [
    { qtyInStock: '12', quantityStatus: 'verified' },
    { qtyInStock: null, quantityStatus: 'unknown' }
  ]);

  assert.equal(result.finishedGoods.totalQuantity, null);
  assert.equal(result.finishedGoods.verifiedQuantity, '12');
  assert.equal(result.finishedGoods.unverifiedItems, 1);
});

test('An empty dataset has genuine zero totals', () => {
  const result = summarizeWarehouseStock([], []);

  assert.equal(result.trackedRawMaterialItems, 0);
  assert.equal(result.finishedGoods.totalQuantity, '0');
  assert.equal(result.lowStock.confirmedItems, 0);
  assert.equal(result.lowStock.complete, true);
});

test('Invalid or fractional finished goods are not counted', () => {
  const result = summarizeWarehouseStock([], [
    { qtyInStock: '-1', quantityStatus: 'verified' },
    { qtyInStock: '1.5', quantityStatus: 'verified' }
  ]);

  assert.equal(result.finishedGoods.totalQuantity, null);
  assert.equal(result.finishedGoods.unverifiedItems, 2);
});
