import { api } from './client';

export function salesJobOrdersPath(orderId) {
  return `/api/sales/orders/${encodeURIComponent(orderId)}/job-orders`;
}

export function listSalesJobOrders(orderId, signal) {
  return api(salesJobOrdersPath(orderId), { signal });
}

export function createSalesJobOrders(orderId, body, signal) {
  return api(salesJobOrdersPath(orderId), { method: 'POST', body, signal });
}

function stringId(value) {
  return value == null ? value : String(value);
}

export function mapSalesProductionEvent(event) {
  return {
    ...event,
    id: stringId(event.id),
    jobOrderId: stringId(event.jobOrderId),
    stagePosition: event.stagePosition == null ? null : Number(event.stagePosition),
  };
}

export function mapSalesJobOrder(jobOrder) {
  return {
    ...jobOrder,
    id: stringId(jobOrder.id),
    orderItemId: stringId(jobOrder.orderItemId),
    specificationId: stringId(jobOrder.specificationId),
    replacementRequestId: stringId(jobOrder.replacementRequestId),
    currentStageCursor: jobOrder.currentStageCursor == null ? null : Number(jobOrder.currentStageCursor),
    paused: Boolean(Number(jobOrder.paused)),
    bomLineCount: jobOrder.bomLineCount == null ? 0 : Number(jobOrder.bomLineCount),
    productionEvents: (jobOrder.productionEvents ?? []).map(mapSalesProductionEvent),
  };
}
