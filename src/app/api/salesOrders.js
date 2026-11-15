import { api, queryString } from './client';

export function salesOrdersPath(filters) {
  return `/api/sales/orders?${queryString(filters)}`;
}

export function listSalesOrders(filters, signal) {
  return api(salesOrdersPath(filters), { signal });
}

export function getSalesOrder(id, signal) {
  return api(`/api/sales/orders/${encodeURIComponent(id)}`, { signal });
}

export function mapSalesPayment(payment) {
  return {
    ...payment,
    id: payment.id == null ? payment.id : String(payment.id),
    invoiceId: payment.invoiceId == null ? payment.invoiceId : String(payment.invoiceId),
  };
}

function addDecimalStrings(left, right) {
  const [leftWhole, leftFraction = ''] = String(left).split('.');
  const [rightWhole, rightFraction = ''] = String(right).split('.');
  const scale = Math.max(leftFraction.length, rightFraction.length);
  const leftInteger = BigInt(`${leftWhole || '0'}${leftFraction.padEnd(scale, '0')}`);
  const rightInteger = BigInt(`${rightWhole || '0'}${rightFraction.padEnd(scale, '0')}`);
  const total = (leftInteger + rightInteger).toString().padStart(scale + 1, '0');
  return scale === 0 ? total : `${total.slice(0, -scale)}.${total.slice(-scale)}`;
}

export function sumVerifiedPaymentAmounts(payments = []) {
  return payments
    .filter(payment => payment.verificationStatus === 'verified' && payment.verifiedAmount != null)
    .reduce((total, payment) => addDecimalStrings(total, payment.verifiedAmount), '0');
}

export function mapSalesOrder(row) {
  return {
    ...row,
    id: String(row.id),
    clientId: row.clientId == null ? null : String(row.clientId),
    archived: Boolean(row.archived),
    urgent: Boolean(row.urgent),
    ...(Array.isArray(row.payments) ? { payments: row.payments.map(mapSalesPayment) } : {}),
  };
}
