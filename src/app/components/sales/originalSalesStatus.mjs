import { verifiedInvoicePaid, readyForJobOrder } from './pipelineModel.mjs';

export function matchesOriginalSalesStatus(row, detail, status) {
  const requests = detail?.requests ?? [];
  const revision = requests.some(request => ['quotation_revision', 'revision'].includes(request.kind) && request.status === 'pending');
  if (status === 'all') return true;
  if (status === 'newInquiry') return row.stageCode === 'inquiry';
  if (status === 'quotationAwaitingPO') return row.stageCode === 'quotation' && row.latestQuotationStatus === 'sent' && !revision;
  if (status === 'revisionRequested') return revision;
  if (status === 'readyForJobOrder') return readyForJobOrder(detail);
  if (status === 'cancellationRequested') return requests.some(request => request.kind === 'cancellation' && request.status === 'pending');
  if (status === 'poApproved') return Boolean(detail?.purchaseOrders?.some(po => po.clearedAt));
  // The detail API does not return rejection or review status. Keep these
  // original filters visible and unavailable rather than inferring a decision.
  if (['poPending', 'poRejected'].includes(status)) return false;
  return (detail?.invoices ?? []).some(invoice => {
    if (status === 'invoiceDraft') return !invoice.sentAt;
    if (!['invoiceAwaitingPayment', 'downpaymentPending'].includes(status) || !invoice.sentAt) return false;
    const required = status === 'downpaymentPending' ? invoice.requiredDownpayment : invoice.amount;
    if (!/^\d+(\.\d+)?$/.test(String(required)) || !/[1-9]/.test(String(required))) return false;
    return !verifiedInvoicePaid(detail, invoice.id, required);
  });
}
