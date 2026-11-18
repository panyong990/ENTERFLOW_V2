import { api } from './client';

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

export function listWarehouseShipments(limit = 100, signal?: AbortSignal) {
  return api<WarehouseShipment[]>(`/api/warehouse/shipments?limit=${limit}`, { signal });
}

export function getWarehouseShipment(id: string, signal?: AbortSignal) {
  return api<WarehouseShipment>(`/api/warehouse/shipments/${encodeURIComponent(id)}`, { signal });
}
