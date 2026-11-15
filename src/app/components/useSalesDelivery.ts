import { useCallback, useEffect, useRef, useState } from "react";
import { getSalesDelivery, mapSalesDelivery } from "../api/salesDelivery.js";

export interface SalesShipment {
  id: string;
  jobOrderId: string | null;
  deliveryMethodCode?: string | null;
  deliveryMethodLabel?: string | null;
  status: string | null;
  trackingReference: string | null;
  trackingLink: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  deliveryAddress?: string | null;
  driverName?: string | null;
  vehiclePlate?: string | null;
  pickupPerson?: string | null;
  pickupPhone?: string | null;
  pickupEmail?: string | null;
  estimatedDeliveryDate: string | null;
  expectedPickupDate: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  fulfillmentCompletedAt: string | null;
}

export interface SalesWaybill { id: string; shipmentId: string | null; reference: string | null; printedAt: string | null; [key: string]: unknown; }
export interface SalesSignedReceipt { id: string; deliveryReceiptId: string | null; fileId: string | null; uploadedAt: string | null; receivedAt: string | null; acceptedSlot: string | null; discardedAt: string | null; originalFilename: string | null; mimeType: string | null; sizeBytes: string | number | null; fileState: string | null; [key: string]: unknown; }
export interface SalesDeliveryReceipt { id: string; shipmentId: string | null; reference: string | null; generatedAt: string | null; sentToLogisticsAt: string | null; sentToClientAt: string | null; signedReceipts: SalesSignedReceipt[]; [key: string]: unknown; }
export interface SalesDelivery { orderId: string; shipments: SalesShipment[]; waybills: SalesWaybill[]; deliveryReceipts: SalesDeliveryReceipt[]; }

export function useSalesDelivery(enabled: boolean, orderId: string | null) {
  const [data, setData] = useState<SalesDelivery | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const sequence = useRef(0);
  const refresh = useCallback(() => setVersion(value => value + 1), []);

  useEffect(() => {
    if (!enabled || !orderId) { setData(null); setLoading(false); setError(""); return undefined; }
    const token = ++sequence.current;
    const controller = new AbortController();
    setData(null); setLoading(true); setError("");
    getSalesDelivery(orderId, controller.signal)
      .then(result => { if (token === sequence.current) setData(mapSalesDelivery(result as SalesDelivery)); })
      .catch(cause => { if (token === sequence.current && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load delivery information."); })
      .finally(() => { if (token === sequence.current && !controller.signal.aborted) setLoading(false); });
    return () => { ++sequence.current; controller.abort(); };
  }, [enabled, orderId, version]);

  return { data, loading, error, refresh };
}
