import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreQuotationInputs } from './quotationDraft.js';

test('quotation revision restores the newest editable inputs by exact item ID without converting prices', () => {
  const item = { id: '90071992547409931', quantity: 3, filterName: 'Filter' };
  const row = { orderItemId: item.id, laborCost: '12.5', markupPercent: '30', discountPercent: '99', vatType: 'Inclusive', vatRate: '12', includeLabor: false, applyMarkup: true, applyVat: true };
  const quote = { revisionNumber: 3, reference: 'Q-1', status: 'draft', note: 'Keep this note', noteHighlighted: true, paymentTermCode: 'NET15', timeOfDelivery: 'Custom delivery term', placeOfDelivery: 'Saved location', validUntil: '2027-01-01', downpaymentPercent: '50', discountPercent: '5', costing: [row], totalAmount: '9007199254740993.12' };
  const input = [quote, { ...quote, revisionNumber: 2, note: 'Old note' }];
  const restored = restoreQuotationInputs(input, [item, { ...item, id: '90071992547409932' }]);
  assert.equal(restored.document.note, 'Keep this note');
  assert.equal(restored.document.timeOfDelivery, 'Custom delivery term');
  assert.equal(restored.document.downpaymentPercent, 50);
  assert.equal(restored.costs[0].laborCost, 12.5);
  assert.equal(restored.costs[0].discountPct, 5);
  assert.equal(restored.costs[0].includeLabor, false);
  assert.equal(restored.costs[1], undefined);
  assert.ok(Number.isNaN(restored.document.lineItems[0].unitPrice));
  assert.equal(quote.totalAmount, '9007199254740993.12');
  assert.equal(input[0], quote);
});

test('new inquiries have no fabricated saved quotation and legacy downpayments need explicit correction', () => {
  assert.deepEqual(restoreQuotationInputs([], []), { costs: {}, document: undefined, latest: undefined });
  const restored = restoreQuotationInputs([{ status: 'sent', revisionNumber: 1, downpaymentPercent: '30' }], []);
  assert.equal(restored.document.downpaymentPercent, 30);
});

test('a superseded latest record can seed a fresh revision without changing its historical status', () => {
  const quote = { id: '9007199254740993', status: 'superseded', revisionNumber: 3, downpaymentPercent: '20' };
  const restored = restoreQuotationInputs([quote], []);
  assert.equal(restored.latest.id, quote.id);
  assert.equal(quote.status, 'superseded');
});
