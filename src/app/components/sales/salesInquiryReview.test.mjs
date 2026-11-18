import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pipeline = await readFile(new URL('../SalesOrders.tsx', import.meta.url), 'utf8');
const adapter = await readFile(new URL('./useOriginalSalesAdapter.ts', import.meta.url), 'utf8');
const actions = await readFile(new URL('./LiveSalesActions.tsx', import.meta.url), 'utf8');
const details = await readFile(new URL('./SalesDocumentSections.tsx', import.meta.url), 'utf8');
const clientData = await readFile(new URL('../client/data.tsx', import.meta.url), 'utf8');
const salesApi = await readFile(new URL('../../api/salesOrders.js', import.meta.url), 'utf8');

test('client inquiry submission signals an open Sales pipeline to refresh', () => {
  assert.match(clientData, /client-inquiry-submitted/);
  assert.match(adapter, /addEventListener\("enterflow:client-inquiry-submitted", refresh\)/);
  assert.match(adapter, /removeEventListener\("enterflow:client-inquiry-submitted", refresh\)/);
  assert.match(pipeline, /onSaved=\{live\.refresh\}/);
});

test('Sales can explicitly refresh inquiries received in a different client session', () => {
  assert.match(pipeline, /aria-label="Refresh Sales records"/);
  assert.match(pipeline, /onClick=\{live\.refresh\}/);
  assert.match(pipeline, /disabled=\{live\.loading\}/);
});

test('Sales review uses the existing authenticated order list and detail APIs', () => {
  assert.match(adapter, /listSalesOrders/);
  assert.match(adapter, /getSalesOrder\(inquiry\.id\)/);
  assert.match(adapter, /originalSalesInquiry\(row, details\.records\[row\.id\]\)/);
  assert.match(adapter, /page \* result\.pageSize >= result\.total/);
  assert.match(salesApi, /\/api\/sales\/orders/);
  assert.match(salesApi, /getSalesOrder/);
});

test('Real Sales review preserves authenticated rejection behavior and does not infer unsupported PO states', () => {
  assert.match(adapter, /rejectSalesInquiry\(inquiry\.id, reason\.trim\(\), detail\.revision\)/);
  assert.match(adapter, /locks\.current/);
  assert.match(details, /purchaseOrder\.status \|\| "Unavailable"/);
  assert.match(actions, /No inventory or Job Order is created by this action/);
});
