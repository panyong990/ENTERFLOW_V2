import test from 'node:test';
import assert from 'node:assert/strict';
import { createSalesDashboardService } from './sales-dashboard.service.js';

function database({ metrics = {}, monthly = [] } = {}) {
  const calls = [];
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('verifiedRevenue')) return [[{
        pendingInquiries: metrics.pendingInquiries ?? 0,
        quotationsSent: metrics.quotationsSent ?? 0,
        purchaseOrdersReceived: metrics.purchaseOrdersReceived ?? 0,
        verifiedRevenue: metrics.verifiedRevenue ?? '0'
      }]];
      return [monthly];
    },
    release() {}
  };
  return { db: { async getConnection() { return connection; } }, calls };
}

test('Sales dashboard applies active stage definitions and verified-payment revenue only', async () => {
  const h = database({
    metrics: { pendingInquiries: 3, quotationsSent: 4, purchaseOrdersReceived: 2, verifiedRevenue: '1234567890.1250' },
    monthly: [{ month: '2026-01', amount: '100.1250' }, { month: '2026-02', amount: '200.0000' }]
  });
  const result = await createSalesDashboardService(h).dashboard();
  assert.deepEqual(result.data, {
    pendingInquiries: 3,
    quotationsSent: 4,
    purchaseOrdersReceived: 2,
    verifiedRevenue: '1234567890.1250',
    monthlyVerifiedRevenue: [{ month: '2026-01', amount: '100.1250' }, { month: '2026-02', amount: '200.0000' }]
  });
  assert.match(h.calls[0].sql, /FROM inquiry WHERE status='inquiry'/);
  assert.match(h.calls[0].sql, /FROM quotation WHERE status='sent' AND is_current=1/);
  assert.match(h.calls[0].sql, /FROM purchase_order/);
  assert.match(h.calls[0].sql, /approval_status='approved'/);
  assert.match(h.calls[0].sql, /SUM\(amount\)/);
  assert.doesNotMatch(h.calls[0].sql, /submitted_amount/);
  assert.doesNotMatch(h.calls[0].sql, /created_by/);
  assert.doesNotMatch(h.calls[0].sql, /JOIN/);
});

test('Sales dashboard groups verified revenue by paid_on and keeps empty results safe', async () => {
  const h = database({ metrics: { verifiedRevenue: '0' }, monthly: [] });
  const result = await createSalesDashboardService(h).dashboard();
  assert.equal(result.data.verifiedRevenue, '0');
  assert.deepEqual(result.data.monthlyVerifiedRevenue, []);
  assert.match(h.calls[1].sql, /DATE_FORMAT\(date_paid,'%Y-%m'\)/);
  assert.match(h.calls[1].sql, /GROUP BY DATE_FORMAT\(date_paid,'%Y-%m'\)/);
  assert.match(h.calls[1].sql, /approval_status='approved'/);
});

test('Sales dashboard uses independent aggregates so one-to-many payment/order joins cannot multiply revenue', async () => {
  const h = database({ metrics: { verifiedRevenue: '42.5000' } });
  await createSalesDashboardService(h).dashboard();
  assert.equal(h.calls.length, 2);
  assert.doesNotMatch(`${h.calls[0].sql} ${h.calls[1].sql}`, /JOIN\s+(orders|quotations|purchase_orders|invoices|job_orders|shipments)/i);
  assert.match(h.calls[1].sql, /FROM payment_transaction/);
});
