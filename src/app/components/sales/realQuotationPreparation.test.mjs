import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./RealQuotationPreparation.tsx', import.meta.url), 'utf8');
const pipeline = readFileSync(new URL('./SalesPipeline.tsx', import.meta.url), 'utf8');
const builder = readFileSync(new URL('../QuotationBuilder.tsx', import.meta.url), 'utf8');
const costing = readFileSync(new URL('../CostEstimationPanel.tsx', import.meta.url), 'utf8');
const specifications = readFileSync(new URL('./OriginalSalesForms.tsx', import.meta.url), 'utf8');
const drafts = readFileSync(new URL('./drafts.ts', import.meta.url), 'utf8');

test('uncertain quotation writes preserve edits and require history reconciliation without automatic retry', () => {
  assert.match(source, /lock.current \|\| uncertain/);
  assert.match(source, /uncertainWrite\(cause\)/);
  assert.match(source, /disabled=\{saving \|\| uncertain\}/);
  assert.match(source, /Check saved quotation state/);
  assert.match(source, /listSalesQuotations\(orderId\)/);
  assert.match(source, /original request may still be completing/);
  const recheck = source.slice(source.indexOf('const checkOutcome'), source.indexOf('return <ModalShell title=', source.indexOf('const checkOutcome')));
  assert.doesNotMatch(recheck, /createSalesQuotation|setCosts|setUncertain\(false\)/);
});

test('Real quotation preparation is connected to the Sales inquiry detail and authenticated quotation adapter', () => {
  assert.match(pipeline, /<RealQuotationPreparation orderId=\{row\.id\}/);
  assert.match(source, /createSalesQuotation/);
  assert.match(source, /useSalesStockAvailability/);
  assert.match(builder, /Save draft/);
  assert.match(builder, /Send to Client/);
});

test('Client inquiry, Sales quotation, and quotation revisions retain authoritative record references', () => {
  assert.match(drafts, /id: order\.id, code: order\.reference, clientName: order\.companyName/);
  assert.match(pipeline, /<RealQuotationPreparation orderId=\{row\.id\} detail=\{detail\}/);
  assert.match(source, /createSalesQuotation\(orderId/);
  assert.match(source, /detail\.reference/);
  assert.match(source, /baseQuotationId: restored\.latest\?\.id/);
});

test('Real quotation preparation keeps costing inputs explicit and renders backend-authoritative results', () => {
  assert.match(costing, /Labor cost per unit/);
  assert.match(costing, /Markup percentage/);
  assert.match(source, /manufacturingUnitCost=\{Number.NaN\}/);
  assert.match(costing, /Raw Materials/);
  assert.match(builder, /Downpayment/);
  assert.doesNotMatch(source, /useMaterials|useOrders|useStockRequests/);
  assert.match(source, /costing: detail.items.map/);
});

test('Real quotation preparation exposes only mandatory 20% and 50% downpayment choices', () => {
  assert.match(source, /\[20, 50\].includes/);
  assert.doesNotMatch(source, /\["0", "20", "50"\]/);
});

test('Real quotation preparation presents friendly specifications and distinct stock states', () => {
  assert.match(source, /<InquiryDetailsTab/);
  assert.match(specifications, /Product Specifications/);
  assert.match(source, /Available/);
  assert.match(source, /Insufficient stock/);
  assert.match(source, /Unmapped requirements/);
  assert.match(source, /no stock is reserved or deducted/);
  assert.doesNotMatch(source, /Object\.entries\(item\)/);
});

test('Real quotation preparation validates approved inputs before calling the quotation API', () => {
  assert.match(source, /Place of delivery is required/);
  assert.match(source, /non-negative labor cost and markup/);
  assert.match(source, /Select the required 20% or 50% downpayment/);
  assert.match(costing, /cfg.vatRate > 100/);
  assert.match(source, /lock.current/);
});
