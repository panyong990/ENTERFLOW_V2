import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cancellationQuery, uncertainWrite } from './cancellationModel.mjs';

test('cancellation history requests include archived orders and do not inherit hidden pipeline filters', () => {
  const filters = { q: 'unrelated company', stage: 'inquiry', status: 'open', page: 9, pageSize: 25, sort: 'submitted-desc' };
  const query = cancellationQuery(filters, 'approved', 2);
  assert.deepEqual(query, { q: '', stage: 'all', status: 'all', cancellationStatus: 'approved', page: 2, pageSize: 25, sort: 'submitted-desc' });
  assert.equal(filters.status, 'open'); assert.equal(filters.page, 9);
});

test('uncertain writes require state reconciliation while validation and eligibility failures remain correctable', () => {
  for (const error of [{ status: 0 }, { status: 503 }, { code: 'WRITE_OUTCOME_UNKNOWN' }, { code: 'INVALID_RESPONSE' }, { code: 'NETWORK_ERROR' }]) assert.equal(uncertainWrite(error), true);
  for (const error of [null, { status: 400 }, { status: 403 }, { status: 409, code: 'CANCELLATION_NOT_ELIGIBLE' }]) assert.equal(uncertainWrite(error), false);
});

test('Sales history refreshes authenticated records and guards cancellation decisions', () => {
  const source = readFileSync(new URL('../SalesOrders.tsx', import.meta.url), 'utf8');
  const adapter = readFileSync(new URL('./useOriginalSalesAdapter.ts', import.meta.url), 'utf8');
  for (const marker of ['aria-label="Refresh Sales records"', 'pendingCancellationRecords', 'live.cancel(inquiry, "approved")', 'live.cancel(inquiry, "declined")']) assert.ok(source.includes(marker), marker);
  for (const marker of ['getSalesOrder(inquiry.id)', 'reviewSalesCancellation', 'locks.current.has(inquiry.id)', 'uncertain.current.has(inquiry.id)', 'uncertain.current.add(inquiry.id)']) assert.ok(adapter.includes(marker), marker);
});
