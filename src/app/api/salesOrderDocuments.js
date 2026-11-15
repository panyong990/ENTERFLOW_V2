import { api } from './client';

export function salesQuotationsPath(orderId) {
  return `/api/sales/orders/${encodeURIComponent(orderId)}/quotations`;
}

export function salesPurchaseOrderPath(orderId) {
  return `/api/sales/orders/${encodeURIComponent(orderId)}/purchase-order`;
}

export function listSalesQuotations(orderId, signal) {
  return api(salesQuotationsPath(orderId), { signal });
}

export function getSalesPurchaseOrder(orderId, signal) {
  return api(salesPurchaseOrderPath(orderId), { signal });
}

function stringId(value) {
  return value == null ? value : String(value);
}

export function mapSalesQuotation(quotation) {
  return {
    ...quotation,
    id: stringId(quotation.id),
    lines: (quotation.lines ?? []).map(line => ({ ...line, id: stringId(line.id), quotationId: stringId(line.quotationId), orderItemId: stringId(line.orderItemId) })),
    costing: (quotation.costing ?? []).map(item => ({ ...item, id: stringId(item.id), quotationId: stringId(item.quotationId), orderItemId: stringId(item.orderItemId) })),
    discounts: quotation.discounts ?? [],
    addons: (quotation.addons ?? []).map(addon => ({ ...addon, id: stringId(addon.id), quotationId: stringId(addon.quotationId), materialId: stringId(addon.materialId) })),
    files: (quotation.files ?? []).map(file => ({ ...file, id: stringId(file.id), quotationId: stringId(file.quotationId) })),
  };
}

export function mapSalesPurchaseOrder(purchaseOrder) {
  if (!purchaseOrder) return null;
  return {
    ...purchaseOrder,
    id: stringId(purchaseOrder.id),
    acceptedQuotationId: stringId(purchaseOrder.acceptedQuotationId),
    files: (purchaseOrder.files ?? []).map(file => ({
      ...file,
      id: stringId(file.id),
      ...(file.purchaseOrderId == null ? {} : { purchaseOrderId: stringId(file.purchaseOrderId) }),
    })),
  };
}
