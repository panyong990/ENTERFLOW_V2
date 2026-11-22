import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, actor, result } from '../../test/phase2-service-fixture.mjs';
import { createClientPortalService, createSalesOrdersService } from './workflows.js';
import { createAccountingService } from './accounting.js';
import { createSalesNotificationsService } from './notifications.js';
import { createSalesDashboardService } from './dashboard.js';
import { invoiceDisplay } from './reads.js';
const methods = ['detailOrder', 'quotations', 'purchaseOrder', 'jobOrders', 'delivery', 'invoices', 'payments'];
for (const method of methods) {
  test('Unowned ' + method + ' stops at inquiry ownership check', async () => {
    const h = fixture({
      handler: s => s.includes('FROM inquiry i JOIN client') ? [] : undefined
    });
    result(await createClientPortalService(h)[method]('30', '19'), 'NOT_FOUND');
    assert.equal(h.calls.filter(c => c.params).length, 1);
    assert.deepEqual(h.calls[0].params, ['19', '30']);
    assert.match(h.calls[0].sql, /i.client_id=\?/);
  });
  for (const invalid of ['0', '18446744073709551616', 19, "1' OR 1=1"]) test(method + ' rejects invalid identifier ' + JSON.stringify(invalid), async () => {
    const h = fixture();
    result(await createClientPortalService(h)[method]('29', invalid), 'VALIDATION_ERROR');
    assert.equal(h.calls.filter(c => c.params).length, 0);
  });
}
test('Sales list binds search, cancellation decision and stage in both count and page SQL', async () => {
  const h = fixture({
    handler: s => s.startsWith('SELECT COUNT') ? [{
      total: '1'
    }] : s.includes('FROM inquiry i JOIN client') ? [{
      id: '9007199254740993',
      status: 'quotation',
      paymentTermCode: 'NET30'
    }] : undefined
  });
  const data = result(await createSalesOrdersService(h).list({
    q: "' OR 1=1",
    stage: 'quotation',
    cancellationStatus: 'declined',
    page: '2',
    pageSize: '10'
  }));
  assert.equal(data.page, 1);
  assert.equal(data.items[0].id, '9007199254740993');
  assert.equal(data.items[0].paymentTermLabel, '30-Day Terms');
  for (const c of h.calls.filter(c => c.params)) {
    assert(!c.sql.includes("' OR 1=1"));
    assert(c.params.includes("%' OR 1=1%"));
    assert(c.params.includes('rejected'));
    assert.match(c.sql, /EXISTS\(SELECT 1 FROM cancellation_request/);
  }
  assert.deepEqual(h.calls.filter(c => c.params).at(-1).params.slice(-2), ['10', '0']);
});
for (const query of [{
  creatorId: '8'
}, {
  cancellationStatus: 'bogus'
}, {
  stage: 'drop'
}, {
  sort: 'RAND()'
}, {
  page: '0'
}, {
  pageSize: '101'
}]) test('Sales list rejects unsupported query ' + JSON.stringify(query), async () => {
  const h = fixture();
  result(await createSalesOrdersService(h).list(query), 'VALIDATION_ERROR');
  assert.equal(h.calls.length, 0);
});
test('Invoice overdue calculation uses unpaid balance and due date rather than uploaded proofs', () => {
  assert.equal(invoiceDisplay({
    paymentTermCode: 'NET15',
    status: 'partially_paid',
    outstandingAmount: '0.01',
    dueOn: '2000-01-01'
  }).isOverdue, true);
  assert.equal(invoiceDisplay({
    paymentTermCode: 'NET30',
    status: 'paid',
    outstandingAmount: '0.00',
    dueOn: '2000-01-01'
  }).isOverdue, false);
  assert.equal(invoiceDisplay({
    paymentTermCode: 'NET30',
    status: 'issued',
    outstandingAmount: '100.00',
    dueOn: null
  }).isOverdue, false);
});
test('Invoice accounting SQL sums actual approved payments independently of proof-file multiplicity', async () => {
  const h = fixture({
    handler: sql => {
      assert.match(sql, /SELECT SUM\(t.amount\) FROM payment_transaction/);
      assert.match(sql, /approval_status='approved'/);
      assert(!/JOIN proof_of_payment_file|SUM\(DISTINCT/.test(sql));
      return [{
        id: '9007199254740993',
        status: 'issued',
        outstandingAmount: '80.00',
        paymentTermCode: 'NET15'
      }];
    }
  });
  const data = result(await createAccountingService(h).listInvoices(actor('accounting'), {
    orderId: '19',
    limit: '1'
  }));
  assert.equal(data[0].paymentTermLabel, '15-Day Terms');
  assert.deepEqual(h.calls[0].params, ['19', '1']);
});
for (const method of ['listInvoices', 'listPayments']) test('Accounting ' + method + ' rejects unrelated identity and query fields', async () => {
  const h = fixture();
  result(await createAccountingService(h)[method](actor('sales'), {}), 'FORBIDDEN');
  result(await createAccountingService(h)[method](actor('accounting'), {
    actorId: '9'
  }), 'VALIDATION_ERROR');
  assert.equal(h.calls.filter(c => c.params).length, 0);
});
test('Proof queue uses one deterministic available proof file and masks unverified money', async () => {
  const h = fixture({
    handler: sql => {
      assert.match(sql, /CASE WHEN r.review_status='verified'/);
      assert.match(sql, /SELECT SUM\(t.amount\) FROM payment_transaction/);
      assert.match(sql, /SELECT CAST\(MIN\(document_id\)/);
      assert(!/JOIN proof_of_payment_file/.test(sql));
      return [{
        id: '99',
        verifiedAmount: null
      }];
    }
  });
  result(await createAccountingService(h).listPayments(actor('accounting'), {
    status: 'pending'
  }));
  assert.deepEqual(h.calls[0].params, ['pending', '25']);
});
test('Self notification updates bind both identifiers and retain original read timestamp', async () => {
  const h = fixture({
    handler: (sql, p) => {
      assert.match(sql, /WHERE notification_id=\? AND user_id=\?/);
      assert.match(sql, /read_at=COALESCE\(read_at,UTC_TIMESTAMP\(3\)\)/);
      assert.deepEqual(p, ['9007199254740993', '9']);
      return {
        affectedRows: 1
      };
    }
  });
  result(await createSalesNotificationsService(h).markRead('9', '9007199254740993'));
});
test('Another user cannot mark a notification read', async () => {
  const h = fixture({
    handler: () => ({
      affectedRows: 0
    })
  });
  result(await createSalesNotificationsService(h).markRead('10', '99'), 'NOT_FOUND');
  assert.deepEqual(h.calls[0].params, ['99', '10']);
});
test('Management revenue aggregates approved transactions once without many-to-many joins', async () => {
  const h = fixture({
    handler: sql => {
      assert(!/JOIN|SUM\(DISTINCT/i.test(sql));
      assert.match(sql, /payment_transaction/);
      assert.match(sql, /approval_status='approved'/);
      return sql.includes('pendingInquiries') ? [{
        pendingInquiries: '1',
        quotationsSent: '2',
        purchaseOrdersReceived: '3',
        verifiedRevenue: '9007199254740993.00'
      }] : [{
        month: '2026-11',
        amount: '9007199254740993.00'
      }];
    }
  });
  const data = result(await createSalesDashboardService(h).dashboard());
  assert.equal(data.verifiedRevenue, '9007199254740993.00');
  assert.equal(data.monthlyVerifiedRevenue[0].amount, data.verifiedRevenue);
});
