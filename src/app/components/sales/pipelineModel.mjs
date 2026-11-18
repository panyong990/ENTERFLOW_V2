// Decimal arithmetic is deliberately separate from the Demo number-based
// estimator. Server money is never rounded or passed through Number here.
function decimal(value) {
  if (value == null || !/^\d+(\.\d+)?$/.test(String(value))) return null;
  const [whole, fraction = ''] = String(value).split('.');
  return { integer: BigInt(whole + fraction), scale: fraction.length };
}
export function moneyAtLeast(actual, required) {
  const a = decimal(actual), b = decimal(required);
  if (!a || !b) return false;
  const scale = Math.max(a.scale, b.scale);
  return a.integer * 10n ** BigInt(scale - a.scale) >= b.integer * 10n ** BigInt(scale - b.scale);
}
export function exactLineAmount(unitPrice, quantity) {
  const price = decimal(unitPrice);
  if (!price || !Number.isSafeInteger(quantity) || quantity < 0) return 'Unavailable';
  const digits = (price.integer * BigInt(quantity)).toString().padStart(price.scale + 1, '0');
  return price.scale ? `${digits.slice(0, -price.scale)}.${digits.slice(-price.scale)}` : digits;
}
export function verifiedInvoicePaid(order, invoiceId, required) {
  if (!decimal(required)) return false;
  const values = (order.payments || []).filter(p => String(p.invoiceId) === String(invoiceId) && p.verificationStatus === 'verified').map(p => decimal(p.verifiedAmount));
  if (values.some(value => !value)) return false;
  const scale = Math.max(decimal(required).scale, ...values.map(value => value.scale));
  const total = values.reduce((sum, value) => sum + value.integer * 10n ** BigInt(scale - value.scale), 0n);
  return total >= decimal(required).integer * 10n ** BigInt(scale - decimal(required).scale);
}
export function readyForJobOrder(order) {
  if (!order || order.archivedAt || order.stageCode !== 'po' || !Array.isArray(order.jobOrders) || order.jobOrders.length || !Array.isArray(order.purchaseOrders) || order.purchaseOrders.length !== 1) return false;
  const po = order.purchaseOrders[0];
  if (!po.receivedAt || !po.clearedAt || !po.acceptedQuotationId) return false;
  if (!order.quotations?.some(q => String(q.id) === String(po.acceptedQuotationId))) return false;
  if (!order.invoices?.length) return false;
  return order.invoices.every(invoice => {
    if (!invoice.sentAt || !decimal(invoice.amount) || !decimal(invoice.requiredDownpayment)) return false;
    const amount = decimal(invoice.amount);
    if (amount.integer <= 0n) return false;
    const required = decimal(invoice.requiredDownpayment).integer > 0n ? invoice.requiredDownpayment : invoice.amount;
    // Only verified amounts assigned to this invoice satisfy its requirement.
    return verifiedInvoicePaid(order, invoice.id, required);
  });
}
export function pipelineColumn(row, detail) {
  if (row.archivedAt || !['inquiry', 'quotation', 'po'].includes(row.stageCode)) return 'other';
  if (row.stageCode === 'inquiry') return 'inquiry';
  return readyForJobOrder(detail) ? 'ready' : 'quotation';
}
