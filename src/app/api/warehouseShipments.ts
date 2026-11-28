import { api } from './client';
import { scanRequest, scanResponse } from './warehouseWaybillScan.js';

export interface WarehouseShipment {
  id: string;
  jobOrderId: string;
  orderId: string;
  orderReference: string;
  companyName: string;
  jobOrderReference: string;
  deliveryMethodLabel: string | null;
  status: string;
  trackingReference: string | null;
  trackingLink: string | null;
  estimatedDeliveryDate: string | null;
  expectedPickupDate: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  updatedAt: string | null;
  contactPerson?: string | null;
  receivedBy?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  deliveryAddress?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  vehiclePlate?: string | null;
  pickupPerson?: string | null;
  pickupPhone?: string | null;
  pickupEmail?: string | null;
  pickupVehiclePlate?: string | null;
  fulfillmentCompletedAt?: string | null;
  purchaseOrderReference?: string | null;
  salesInvoiceReference?: string | null;
  salesInvoiceCount?: string;
  clientAddress?: string | null;
  waybillItems?: { name: string; quantity: string }[];
  waybills?: { id: string; reference: string | null; shipmentId?: string; qrIdentifier?: string | null; printedAt: string | null }[];
  deliveryReceipts?: { id: string; reference: string | null; generatedAt: string | null; sentToLogisticsAt: string | null; sentToClientAt: string | null }[];
}

export function listWarehouseShipments(limit = 100, signal?: AbortSignal, pendingOnly = false) {
  return api<WarehouseShipment[]>(`/api/warehouse/shipments?limit=${limit}${pendingOnly ? '&view=pending-waybills' : ''}`, { signal });
}

export function getWarehouseShipment(id: string, signal?: AbortSignal) {
  return api<WarehouseShipment>(`/api/warehouse/shipments/${encodeURIComponent(id)}`, { signal });
}

export interface StoredWarehouseWaybill {
  id: string; deliveryId: string; reference: string; qrIdentifier: string; printedAt: string | null;
}
export function saveWarehouseWaybill(deliveryId: string, printed = false) {
  if (!/^[1-9]\d{0,19}$/.test(deliveryId) || BigInt(deliveryId) > 18446744073709551615n) throw new Error('Invalid shipment identifier.');
  return api<StoredWarehouseWaybill>(`/api/phase2/warehouse/deliveries/${encodeURIComponent(deliveryId)}/waybill`, {
    method: 'POST', body: { printed },
  });
}
export async function verifyWarehouseWaybill(deliveryId: string, scannedIdentifier: string) {
  const request=scanRequest(deliveryId,scannedIdentifier);
  return scanResponse(await api(request.path,{method:'POST',body:request.body}),deliveryId);
}
