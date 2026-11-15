async function withConnection(db, work) {
  const connection = await db.getConnection();
  try { return await work(connection); } finally { connection.release(); }
}

export function createSalesDashboardService({ db }) {
  if (!db || typeof db.getConnection !== 'function') throw new TypeError('A database pool is required.');

  async function dashboard() {
    return withConnection(db, async connection => {
      const [[metrics]] = await connection.execute(`SELECT
        (SELECT COUNT(*) FROM orders WHERE stage_code='inquiry' AND archived_at IS NULL) pendingInquiries,
        (SELECT COUNT(*) FROM orders WHERE stage_code='quotation' AND archived_at IS NULL) quotationsSent,
        (SELECT COUNT(*) FROM orders WHERE stage_code='po' AND archived_at IS NULL) purchaseOrdersReceived,
        (SELECT COALESCE(SUM(p.verified_amount), 0) FROM payments p
          WHERE p.verification_status='verified' AND p.verified_amount IS NOT NULL) verifiedRevenue`);
      const [monthly] = await connection.execute(`SELECT DATE_FORMAT(p.paid_on, '%Y-%m') month,
        COALESCE(SUM(p.verified_amount), 0) amount
        FROM payments p
        WHERE p.verification_status='verified' AND p.verified_amount IS NOT NULL
        GROUP BY YEAR(p.paid_on), MONTH(p.paid_on), DATE_FORMAT(p.paid_on, '%Y-%m')
        ORDER BY YEAR(p.paid_on), MONTH(p.paid_on)`);
      return {
        success: true,
        data: {
          pendingInquiries: Number(metrics.pendingInquiries ?? 0),
          quotationsSent: Number(metrics.quotationsSent ?? 0),
          purchaseOrdersReceived: Number(metrics.purchaseOrdersReceived ?? 0),
          verifiedRevenue: metrics.verifiedRevenue ?? '0',
          monthlyVerifiedRevenue: monthly.map(row => ({ month: row.month, amount: row.amount ?? '0' }))
        }
      };
    });
  }

  return { dashboard };
}
