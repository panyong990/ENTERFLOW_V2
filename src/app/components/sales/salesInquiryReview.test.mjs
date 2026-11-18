import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pipeline = await readFile(new URL('./SalesPipeline.tsx', import.meta.url), 'utf8');
const clientData = await readFile(new URL('../client/data.tsx', import.meta.url), 'utf8');
const salesApi = await readFile(new URL('../../api/salesOrders.js', import.meta.url), 'utf8');

test('client inquiry submission signals an open Sales pipeline to refresh', () => {
  assert.match(clientData, /client-inquiry-submitted/);
  assert.match(pipeline, /addEventListener\("enterflow:client-inquiry-submitted"/);
  assert.match(pipeline, /remote\.refresh\(\)/);
  assert.match(pipeline, /removeEventListener\("enterflow:client-inquiry-submitted"/);
});

test('Sales review uses the existing authenticated order list and detail APIs', () => {
  assert.match(pipeline, /useSalesOrders\(!recordsView, filters\)/);
  assert.match(pipeline, /useSalesOrderDetail\(Boolean\(selected\), selected\)/);
  for (const field of ['row.reference', 'row.companyName', 'row.contactPerson', 'detail.items', 'item.quantity']) {
    assert.match(pipeline, new RegExp(field.replace('.', '\\.'), 's'));
  }
  assert.match(salesApi, /\/api\/sales\/orders/);
  assert.match(salesApi, /getSalesOrder/);
});

test('Real Sales review preserves authenticated rejection behavior and does not infer unsupported PO states', () => {
  assert.match(pipeline, /rejectSalesInquiry\(row\.id,value,detail!\.revision!\)/);
  assert.match(pipeline, /rejectionLock\.current/);
  assert.match(pipeline, /PO review status is unavailable/);
  assert.match(pipeline, /No record has been changed/);
});
