import { api } from './client.js';

export function salesDeliveryPath(orderId) {
  return `/api/sales/orders/${encodeURIComponent(orderId)}/delivery`;
}

export function getSalesDelivery(orderId, signal) {
  return api(salesDeliveryPath(orderId), { signal });
}

function stringId(value) {
  return value == null ? value : String(value);
}

export function mapSalesSignedReceipt(receipt) {
  return {
    ...receipt,
    id: stringId(receipt.id),
    deliveryReceiptId: stringId(receipt.deliveryReceiptId),
    fileId: stringId(receipt.fileId),
  };
}

export function mapSalesDeliveryReceipt(receipt) {
  return {
    ...receipt,
    id: stringId(receipt.id),
    shipmentId: stringId(receipt.shipmentId),
    signedReceipts: (receipt.signedReceipts ?? []).map(mapSalesSignedReceipt),
  };
}

export function mapSalesShipment(shipment) {
  return { ...shipment, id: stringId(shipment.id), jobOrderId: stringId(shipment.jobOrderId) };
}

export function mapSalesWaybill(waybill) {
  return { ...waybill, id: stringId(waybill.id), shipmentId: stringId(waybill.shipmentId) };
}

export function mapSalesDelivery(data) {
  return {
    ...data,
    orderId: stringId(data.orderId),
    shipments: (data.shipments ?? []).map(mapSalesShipment),
    waybills: (data.waybills ?? []).map(mapSalesWaybill),
    deliveryReceipts: (data.deliveryReceipts ?? []).map(mapSalesDeliveryReceipt),
  };
}
