import { api, queryString } from './client';

export interface LogisticsShipment {
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
  waybillReference: string | null;
  waybillPrintedAt: string | null;
  deliveryReceiptReference: string | null;
  deliveryReceiptGeneratedAt: string | null;
  deliveryReceiptSentToLogisticsAt: string | null;
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
  waybills?: { id: string; reference: string | null; shipmentId: string; printedAt: string | null }[];
  deliveryReceipts?: { id: string; reference: string | null; generatedAt: string | null; sentToLogisticsAt: string | null; sentToClientAt: string | null }[];
}

export function listLogisticsShipments(options: { limit?: number; status?: string; signal?: AbortSignal } = {}) {
  const { signal, ...filters } = options;
  return api<LogisticsShipment[]>(`/api/logistics/shipments?${queryString({ limit: filters.limit ?? 100, ...(filters.status ? { status: filters.status } : {}) })}`, { signal });
}

export function getLogisticsShipment(id: string, signal?: AbortSignal) {
  return api<LogisticsShipment>(`/api/logistics/shipments/${encodeURIComponent(id)}`, { signal });
}
