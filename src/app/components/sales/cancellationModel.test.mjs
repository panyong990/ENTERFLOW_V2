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

test('Sales history wires server pagination, failed-detail feedback, synchronous locking and explicit state recheck', () => {
  const source = readFileSync(new URL('./SalesPipeline.tsx', import.meta.url), 'utf8');
  for (const marker of ['cancellationQuery(filters, cancellationFilter, cancellationPage)', 'setCancellationPage(1)', 'Cancellation history pages', 'details.errors', 'Check latest cancellation state', 'decisionLock.current || uncertain', 'getSalesOrder(orderId)']) assert.ok(source.includes(marker), marker);
});
