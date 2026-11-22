import { ok, read, rows, one } from './core.js';
export function createSalesDashboardService({
  db
}) {
  return {
    dashboard: () => read(db, async c => {
      const metrics = await one(c, `SELECT (SELECT COUNT(*) FROM inquiry WHERE status='inquiry') pendingInquiries,(SELECT COUNT(*) FROM quotation WHERE status='sent' AND is_current=1) quotationsSent,(SELECT COUNT(*) FROM purchase_order) purchaseOrdersReceived,(SELECT COALESCE(SUM(amount),0) FROM payment_transaction WHERE approval_status='approved') verifiedRevenue`);
      const monthly = await rows(c, "SELECT DATE_FORMAT(date_paid,'%Y-%m') month,SUM(amount) amount FROM payment_transaction WHERE approval_status='approved' GROUP BY DATE_FORMAT(date_paid,'%Y-%m') ORDER BY month");
      return ok({
        ...metrics,
        pendingInquiries: Number(metrics.pendingInquiries),
        quotationsSent: Number(metrics.quotationsSent),
        purchaseOrdersReceived: Number(metrics.purchaseOrdersReceived),
        monthlyVerifiedRevenue: monthly
      });
    })
  };
}
