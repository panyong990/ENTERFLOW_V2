import { api, queryString } from './client';

export function productionJobOrdersPath(filters = {}) {
  return `/api/production/job-orders?${queryString(filters)}`;
}

export function listProductionJobOrders(filters = {}, signal) {
  return api(productionJobOrdersPath(filters), { signal });
}

export function getProductionJobOrder(id, signal) {
  return api(`/api/production/job-orders/${encodeURIComponent(id)}`, { signal });
}

function stringId(value) { return value == null ? value : String(value); }

export function mapProductionJobOrder(jobOrder) {
  if (!jobOrder) return null;
  return {
    ...jobOrder,
    id: stringId(jobOrder.id), orderId: stringId(jobOrder.orderId), clientId: stringId(jobOrder.clientId),
    orderItemId: stringId(jobOrder.orderItemId), specificationId: stringId(jobOrder.specificationId),
    acceptedQuotationId: stringId(jobOrder.acceptedQuotationId), purchaseOrderId: stringId(jobOrder.purchaseOrderId),
    quantity: Number(jobOrder.quantity), currentStageCursor: Number(jobOrder.currentStageCursor), paused: Boolean(Number(jobOrder.paused)),
  };
}
