import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, actor, result } from '../../test/phase2-service-fixture.mjs';
import { createClientPortalService, createSalesOrdersService } from './workflows.js';
function requests(options = {}) {
  const h = fixture({
    ...options,
    handler(sql, p, s) {
      if (sql.startsWith('SELECT request_id FROM')) return [];
      if (sql.startsWith('SELECT DATE_FORMAT(submitted_at')) return [{
        requestedAt: '2026-11-22T00:00:00Z'
      }];
      if (sql.startsWith('SELECT * FROM cancellation_request') || sql.startsWith('SELECT rr.*')) return options.missing ? [] : [{
        request_id: '49',
        quotation_id: '59',
        reason: 'Original request',
        status: options.status ?? 'pending'
      }];
      if (sql.includes('SELECT (EXISTS(')) return [{
        blocked: options.blocked ? 1 : 0
      }];
      if (sql.startsWith('UPDATE cancellation_request') || sql.startsWith('UPDATE quotation_revision_request')) {
        s.writes.push({
          sql,
          params: p
        });
        return {
          affectedRows: 1
        };
      }
      if (sql.includes('FROM quotation WHERE inquiry_id=')) return options.noQuote ? [] : [{
        id: '59',
        revisionNumber: 3
      }];
      if (sql.includes('FROM quotation WHERE quotation_id=')) return options.noQuote ? [] : [{
        is_current: 1,
        downpayment_percent: '20',
        downpayment_amount: '20.00',
        total_amount: '100.00',
        status: options.quoteStatus ?? 'sent',
        valid_until: options.expired ? '2000-01-01' : '2099-01-01'
      }];
      if (sql.startsWith('UPDATE quotation SET')) {
        s.writes.push({
          sql,
          params: p
        });
        return {
          affectedRows: 1
        };
      }
      if (sql.startsWith('INSERT INTO cancellation_request') || sql.startsWith('INSERT INTO quotation_revision_request')) {
        if (options.duplicate) throw Object.assign(new Error('duplicate'), {
          code: 'ER_DUP_ENTRY'
        });
        s.writes.push({
          sql,
          params: p
        });
        return {
          insertId: '49',
          affectedRows: 1
        };
      }
      if (sql.includes('FROM user_account u JOIN role r') && !sql.includes('FOR SHARE')) return [];
    }
  });
  if (options.role === 'client') h.state.inquiry.status = 'quotation';
  return h;
}
for (const [decision, status] of [['approved', 'approved'], ['declined', 'rejected'], ['rejected', 'rejected']]) test(`Sales cancellation ${decision} preserves request evidence and records actor atomically`, async () => {
  const h = requests();
  const value = result(await createSalesOrdersService(h).reviewCancellation('19', '49', decision, actor('sales'), {}, {
    reason: 'Review reason'
  }));
  assert.equal(value.status, status);
  const update = h.wrote('cancellation_request')[0];
  assert.deepEqual(update.params, [status, '9', status === 'approved' ? null : 'Review reason', '49']);
  assert.match(update.sql, /reviewed_at=UTC_TIMESTAMP\(3\)/);
  assert.equal(h.wrote('inquiry').length, status === 'approved' ? 1 : 0);
  assert(h.calls.find(c => c.sql.includes('inquiry WHERE')).sql.endsWith('FOR UPDATE'));
  assert(h.calls.findIndex(c => c.sql.includes('inquiry WHERE')) < h.calls.findIndex(c => c.sql.includes('FROM cancellation_request')));
  const audit = h.wrote('audit_event')[0];
  assert.equal(audit.params[0], '9');
  assert.equal(audit.params[1], 'cancellation.' + status);
  assert.equal(h.state.writes.some(c => /DELETE/.test(c.sql)), false);
});
for (const options of [{
  blocked: true
}, {
  status: 'approved'
}, {
  missing: true
}, {
  role: 'warehouse'
}]) test('Cancellation review rejects ' + JSON.stringify(options), async () => {
  const h = requests(options),
    code = options.blocked ? 'CANCELLATION_NOT_ELIGIBLE' : options.status ? 'CANCELLATION_ALREADY_DECIDED' : options.missing ? 'NOT_FOUND' : 'FORBIDDEN';
  result(await createSalesOrdersService(h).reviewCancellation('19', '49', 'approved', actor(options.role ?? 'sales')), code);
  if (options.role) assert.equal(h.calls.length, 0);else h.assertRolledBack();
});
for (const failAt of [/UPDATE inquiry/, /INSERT INTO audit_event/, /INSERT INTO notification/]) test('Cancellation rolls back decision and status when ' + failAt + ' fails', async () => {
  const h = requests({
    failAt
  });
  result(await createSalesOrdersService(h).reviewCancellation('19', '49', 'approved', actor('sales')), 'SERVICE_UNAVAILABLE');
  h.assertRolledBack();
});
test('Lost cancellation commit acknowledgement never auto-retries', async () => {
  const h = requests({
    commitLost: true
  });
  result(await createSalesOrdersService(h).reviewCancellation('19', '49', 'approved', actor('sales')), 'WRITE_OUTCOME_UNKNOWN');
  assert.equal(h.calls.filter(c => c.sql === 'COMMIT').length, 1);
  assert(h.calls.some(c => c.sql === 'DESTROY'));
});
for (const decision of ['approved', 'rejected']) test('Revision review ' + decision + ' does not manufacture a quote or alter inquiry/PO', async () => {
  const h = requests();
  result(await createSalesOrdersService(h).reviewRevision('19', '49', {
    decision,
    reason: 'Review reason'
  }, actor('sales')));
  assert.equal(h.wrote('quotation_revision_request').length, 1);
  assert.equal(h.wrote('quotation').length, 0);
  assert.equal(h.wrote('inquiry').length, 0);
  assert.equal(h.wrote('purchase_order').length, 0);
  assert(h.wrote('audit_event').some(c => c.params[1] === 'quotation.revision_' + decision));
});
for (const [kind, body] of [['requestCancellation', {
  reason: 'Changed requirements',
  termsAcknowledged: true
}], ['requestQuotationRevision', {
  reason: 'Please revise delivery'
}]]) {
  test(kind + ' binds ownership and records only a pending request', async () => {
    const h = requests({
      role: 'client'
    });
    const value = result(await createClientPortalService(h)[kind]('29', '9', '19', body));
    assert.equal(value.status, 'pending');
    const lock = h.calls.find(c => c.sql.includes('FROM inquiry WHERE'));
    assert.deepEqual(lock.params, ['19', '29']);
    assert.equal(h.wrote('inquiry').length, 0);
    assert.equal(h.wrote('payment_transaction').length, 0);
    assert.equal(h.wrote('audit_event').length, 1);
  });
  test(kind + ' denies a forged client relationship before parent/child writes', async () => {
    const h = requests({
      role: 'client'
    });
    result(await createClientPortalService(h)[kind]('30', '9', '19', body), 'FORBIDDEN');
    assert.equal(h.wrote(kind === 'requestCancellation' ? 'cancellation_request' : 'quotation_revision_request').length, 0);
    h.assertRolledBack();
  });
  test(kind + ' maps the unique pending constraint to conflict without retries', async () => {
    const h = requests({
      role: 'client',
      duplicate: true
    });
    result(await createClientPortalService(h)[kind]('29', '9', '19', body), 'CONFLICT');
    h.assertRolledBack();
  });
}
for (const body of [{
  reason: 'Changed requirements'
}, {
  reason: 'x',
  termsAcknowledged: true
}, {
  reason: 'Changed requirements',
  termsAcknowledged: true,
  actorId: '8'
}]) test('Cancellation submission validates ' + JSON.stringify(body), async () => {
  const h = requests({
    role: 'client'
  });
  result(await createClientPortalService(h).requestCancellation('29', '9', '19', body), 'VALIDATION_ERROR');
  if (body.reason === 'x') h.assertRolledBack();else assert.equal(h.calls.length, 0);
});
for (const decision of ['accepted', 'rejected']) test('Client quote ' + decision + ' locks owned inquiry and preserves revision identity', async () => {
  const h = requests({
    role: 'client'
  });
  result(await createClientPortalService(h).decideQuotation('29', '9', '19', '59', {
    decision,
    reason: 'Buyer reason'
  }));
  const update = h.wrote('quotation')[0];
  assert.deepEqual(update.params, [decision, '59', 'sent']);
  assert.doesNotMatch(update.sql, /is_current|revision_no|quotation_item/);
  assert.equal(h.wrote('audit_event').length, 1);
});
for (const options of [{
  expired: true
}, {
  quoteStatus: 'accepted'
}, {
  noQuote: true
}]) test('Quote decision rejects ineligible target ' + JSON.stringify(options), async () => {
  const h = requests({
    role: 'client',
    ...options
  });
  result(await createClientPortalService(h).decideQuotation('29', '9', '19', '59', {
    decision: 'accepted'
  }), 'QUOTATION_NOT_ELIGIBLE');
  h.assertRolledBack();
});
test('Cancelled inquiry cannot accept a sent quote', async () => {
  const h = requests({
    role: 'client'
  });
  h.state.inquiry.status = 'cancelled';
  result(await createClientPortalService(h).decideQuotation('29', '9', '19', '59', {
    decision: 'accepted'
  }), 'INVALID_STATE');
  h.assertRolledBack();
});
