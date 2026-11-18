import test from 'node:test';
import assert from 'node:assert/strict';
import { createSalesOrdersService } from './sales-orders.service.js';
import { validateCancellationRequest } from '../validation/sales.validation.js';

const actor = { userId: '7', roleCode: 'sales', accountType: 'employee' };
const context = { requestId: '11111111-1111-4111-8111-111111111111' };

test('Client cancellation request validation requires a bounded reason and explicit terms acknowledgment', () => {
  const valid = validateCancellationRequest({ reason: '  Changed requirements.  ', termsAcknowledged: true });
  assert.deepEqual(valid.data, { reason: 'Changed requirements.', termsAcknowledged: true });
  for (const body of [
    { reason: 'Changed requirements.' },
    { reason: 'Changed requirements.', termsAcknowledged: false },
    { reason: '  ', termsAcknowledged: true },
    { reason: 'Changed requirements.', termsAcknowledged: true, clientId: 'forged' },
    { reason: '😀'.repeat(1001), termsAcknowledged: true }
  ]) assert.equal(validateCancellationRequest(body).success, false);
});

function harness({ decision = 'approved', paid = false, fail = null, commitFailure = false, activeActor = true } = {}) {
  const state = {
    order: { id: '91', reference: 'INQ-91', clientId: '2', stageCode: 'inquiry', archiveReason: null, archiveNote: null, archivedAt: null, archivedBy: null, updatedAt: '2026-11-17T00:00:00.000000Z' },
    request: { id: '802', kind: 'cancellation', reason: 'Changed requirements.', requestedBy: '2', requestedAt: '2026-11-18T10:00:00.000000Z', status: 'pending', response: null, decidedAt: null, decidedBy: null },
    audit: []
  };
  const calls = [];
  let commits = 0, rollbacks = 0, destroyed = 0;
  let snapshot;
  const connection = {
    async beginTransaction() { snapshot = structuredClone(state); calls.push('BEGIN'); },
    async commit() { calls.push('COMMIT'); if (commitFailure) throw new Error('synthetic commit failure'); commits++; },
    async rollback() { calls.push('ROLLBACK'); rollbacks++; if (snapshot) Object.assign(state, snapshot); },
    release() { calls.push('RELEASE'); },
    destroy() { destroyed++; },
    async execute(sql, params = []) {
      calls.push({ sql, params });
      if (fail && sql.includes(fail)) throw new Error('synthetic query failure');
      if (sql.startsWith('SELECT id FROM users')) return [activeActor ? [{ id: '7' }] : []];
      if (sql.includes('FROM orders o WHERE o.id=?')) return [[{ ...state.order }]];
      if (sql.includes('FROM order_requests')) return [[{ ...state.request }]];
      if (sql.startsWith('SELECT id FROM payments')) return [paid ? [{ id: '901' }] : []];
      if (sql.startsWith('UPDATE orders SET')) {
        Object.assign(state.order, { archiveReason: 'cancelled', archiveNote: null, archivedBy: params[0], archivedAt: '2026-11-18T11:00:00.000000Z' });
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith('UPDATE order_requests SET')) {
        Object.assign(state.request, { status: params[0], response: params[1], decidedBy: params[2], decidedAt: '2026-11-18T11:00:00.000000Z' });
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith('SELECT CAST(id AS CHAR) id, reason, status')) return [[{ ...state.request, resolvedAt: state.request.decidedAt }]];
      if (sql.startsWith('INSERT INTO audit_events')) { state.audit.push(params); return [{ affectedRows: 1 }]; }
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };
  const service = createSalesOrdersService({ db: { getConnection: async () => connection } });
  return { state, calls, service, counts: () => ({ commits, rollbacks, destroyed }) };
}

test('accepting a pending cancellation archives the order and preserves request evidence in the audit', async () => {
  const h = harness();
  const result = await h.service.reviewCancellation('91', '802', 'approved', actor, context);
  assert.equal(result.success, true);
  assert.equal(result.data.archiveReason, 'cancelled');
  assert.equal(result.data.archived, true);
  assert.equal(result.data.stageCode, 'inquiry');
  assert.equal(h.state.order.archiveReason, 'cancelled');
  assert.equal(h.state.request.status, 'approved');
  assert.equal(h.state.request.reason, 'Changed requirements.');
  assert.equal(h.state.request.requestedAt, '2026-11-18T10:00:00.000000Z');
  assert.equal(h.state.request.decidedBy, actor.userId);
  assert.equal(h.state.audit.length, 1);
  assert.equal(h.state.audit[0][1], 'cancellation.approved');
  assert.equal(h.state.audit[0][5], 'Changed requirements.');
  assert.deepEqual(h.counts(), { commits: 1, rollbacks: 0, destroyed: 0 });
});

test('declining a cancellation resolves its request without archiving or changing the prior stage', async () => {
  const h = harness();
  h.state.order.stageCode = 'quotation';
  const result = await h.service.reviewCancellation('91', '802', 'declined', actor, context);
  assert.equal(result.success, true);
  assert.equal(result.data.archiveReason, null);
  assert.equal(result.data.archived, false);
  assert.equal(result.data.stageCode, 'quotation');
  assert.equal(h.state.order.stageCode, 'quotation');
  assert.equal(h.state.order.archiveReason, null);
  assert.equal(h.state.request.status, 'declined');
  assert.equal(h.state.request.reason, 'Changed requirements.');
  assert.equal(h.calls.some(call => typeof call === 'object' && call.sql.startsWith('UPDATE orders SET')), false);
  assert.equal(h.counts().commits, 1);
});

test('duplicate, paid, unauthorized, and unknown cancellation decisions cannot mutate records', async () => {
  const duplicate = harness();
  duplicate.state.request.status = 'declined';
  assert.equal((await duplicate.service.reviewCancellation('91', '802', 'approved', actor)).code, 'CANCELLATION_ALREADY_DECIDED');
  assert.equal(duplicate.state.order.archiveReason, null);

  const paid = harness({ paid: true });
  assert.equal((await paid.service.reviewCancellation('91', '802', 'approved', actor)).code, 'CANCELLATION_NOT_ELIGIBLE');
  assert.equal(paid.state.order.archiveReason, null);
  assert.equal(paid.state.request.status, 'pending');

  const unauthorized = harness({ activeActor: false });
  assert.equal((await unauthorized.service.reviewCancellation('91', '802', 'declined', actor)).code, 'FORBIDDEN');
  assert.equal(unauthorized.state.request.status, 'pending');

  const invalidActor = harness();
  assert.equal((await invalidActor.service.reviewCancellation('91', '802', 'approved', { ...actor, roleCode: 'owner' })).code, 'FORBIDDEN');
  assert.equal(invalidActor.calls.length, 0);
});

test('cancellation decision write failures roll back and uncertain commits are not retried', async () => {
  const failed = harness({ fail: 'INSERT INTO audit_events' });
  assert.equal((await failed.service.reviewCancellation('91', '802', 'approved', actor)).code, 'SERVICE_UNAVAILABLE');
  assert.equal(failed.state.order.archiveReason, null);
  assert.equal(failed.state.request.status, 'pending');
  assert.equal(failed.counts().commits, 0);
  assert.equal(failed.counts().rollbacks, 1);
  assert.equal(failed.counts().destroyed, 1);

  const uncertain = harness({ commitFailure: true });
  assert.equal((await uncertain.service.reviewCancellation('91', '802', 'approved', actor)).code, 'WRITE_OUTCOME_UNKNOWN');
  assert.equal(uncertain.calls.filter(call => call === 'COMMIT').length, 1);
  assert.equal(uncertain.counts().destroyed, 1);
});
