import { useEffect, useState } from "react";
import { ApiError } from "../api/client";
import { getLogisticsShipment, listLogisticsShipments, type LogisticsShipment } from "../api/logisticsShipments";
import type { Inquiry } from "../store/orders";
import { useSession } from "../store/session";

// A read projection, not an Inquiry inserted into the Demo order store.
export type LogisticsRecord = (Inquiry & { shipment?: never }) | (
  Partial<Omit<Inquiry, "deliveryMethod">> & Pick<Inquiry, "id" | "clientName" | "products"> & {
    shipment: LogisticsShipment;
    deliveryMethod?: string;
  }
);

export function toLogisticsRecord(shipment: LogisticsShipment): LogisticsRecord {
  const receipt = shipment.deliveryReceiptReference
    ? shipment.deliveryReceipts?.find(row => row.reference === shipment.deliveryReceiptReference)
    : undefined;
  return {
    shipment,
    id: shipment.id,
    code: shipment.orderReference,
    joNumber: shipment.jobOrderReference,
    clientName: shipment.companyName,
    products: [], // Item and quantity data are absent from this API contract.
    deliveryMethod: shipment.deliveryMethodLabel ?? undefined,
    trackingRef: shipment.trackingReference ?? undefined,
    deliveryTrackingLink: shipment.trackingLink ?? undefined,
    dispatchedAt: shipment.dispatchedAt ?? undefined,
    deliveredDate: shipment.deliveredAt ?? undefined,
    waybillNumber: shipment.waybillReference ?? undefined,
    waybillPrintedAt: shipment.waybillPrintedAt ?? undefined,
    deliveryReceiptNumber: shipment.deliveryReceiptReference ?? undefined,
    deliveryReceiptGeneratedAt: shipment.deliveryReceiptGeneratedAt ?? undefined,
    deliveryReceiptSentToLogisticsAt: shipment.deliveryReceiptSentToLogisticsAt ?? undefined,
    deliveryReceiptSentAt: receipt?.sentToClientAt ?? undefined,
    fulfillmentCompletedAt: shipment.fulfillmentCompletedAt ?? undefined,
  };
}

export function shipmentDate(shipment: LogisticsShipment, history = false): string | undefined {
  return (history ? shipment.deliveredAt : shipment.deliveryReceiptSentToLogisticsAt) ?? undefined;
}

export function shipmentStatus(shipment: LogisticsShipment): { label: string; tone: string } {
  switch (shipment.status) {
    case "delivered": return { label: "DELIVERED", tone: "bg-green-50 text-green-800 ring-green-200" };
    case "in_transit": return { label: "IN TRANSIT", tone: "bg-blue-50 text-blue-800 ring-blue-200" };
    case "picked_up": return { label: "PICKED UP", tone: "bg-blue-50 text-blue-800 ring-blue-200" };
    case "pending": return { label: "PENDING", tone: "bg-amber-50 text-amber-800 ring-amber-200" };
    default: return { label: shipment.status || "Unavailable", tone: "bg-slate-100 text-slate-700 ring-slate-200" };
  }
}

export function matchesShipmentFilters(shipment: LogisticsShipment, query: string, dateFilter: string, history: boolean, now = new Date()): boolean {
  const term = query.trim().toLocaleLowerCase();
  if (term && ![
    shipment.orderReference, shipment.jobOrderReference, shipment.companyName, shipment.deliveryMethodLabel,
    shipment.trackingReference, shipment.waybillReference, shipment.deliveryReceiptReference,
  ].some(value => value?.toLocaleLowerCase().includes(term))) return false;
  if (dateFilter === "all") return true;
  const value = shipmentDate(shipment, history);
  if (!value) return false;
  const timestamp = new Date(value);
  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  const tomorrow = new Date(cutoff);
  tomorrow.setDate(tomorrow.getDate() + 1);
  cutoff.setDate(cutoff.getDate() - (dateFilter === "7days" ? 6 : dateFilter === "30days" ? 29 : 0));
  return !Number.isNaN(timestamp.getTime()) && timestamp >= cutoff && timestamp < tomorrow;
}

function message(cause: unknown): string {
  return cause instanceof ApiError ? cause.message : "Logistics shipments are unavailable.";
}

export function useRealLogisticsShipments(enabled: boolean, selectedId: string | null = null) {
  const { userId, role } = useSession();
  const scope = enabled ? JSON.stringify([userId, role]) : "";
  const [version, setVersion] = useState(0);
  const [detailVersion, setDetailVersion] = useState(0);
  const listKey = JSON.stringify([scope, version]);
  const detailKey = JSON.stringify([listKey, selectedId, detailVersion]);
  const [list, setList] = useState<{ key: string; rows: LogisticsShipment[]; loading: boolean; error: string }>({ key: "", rows: [], loading: true, error: "" });
  const [detail, setDetail] = useState<{ key: string; row: LogisticsShipment | null; loading: boolean; error: string }>({ key: "", row: null, loading: true, error: "" });

  useEffect(() => {
    if (!enabled) {
      setList({ key: "", rows: [], loading: false, error: "" });
      return;
    }
    const controller = new AbortController();
    setList({ key: listKey, rows: [], loading: true, error: "" });
    listLogisticsShipments({ limit: 100, signal: controller.signal }).then(rows => {
      if (!controller.signal.aborted) setList({ key: listKey, rows, loading: false, error: "" });
    }).catch(cause => {
      if (!controller.signal.aborted) setList({ key: listKey, rows: [], loading: false, error: message(cause) });
    });
    return () => controller.abort();
  }, [enabled, listKey]);

  useEffect(() => {
    if (!enabled || selectedId === null) {
      setDetail({ key: "", row: null, loading: false, error: "" });
      return;
    }
    const controller = new AbortController();
    setDetail({ key: detailKey, row: null, loading: true, error: "" });
    getLogisticsShipment(selectedId, controller.signal).then(row => {
      if (!controller.signal.aborted) setDetail({ key: detailKey, row, loading: false, error: "" });
    }).catch(cause => {
      if (!controller.signal.aborted) setDetail({ key: detailKey, row: null, loading: false, error: message(cause) });
    });
    return () => controller.abort();
  }, [enabled, selectedId, detailKey]);

  return {
    rows: enabled && list.key === listKey ? list.rows : [],
    loading: enabled && (list.key !== listKey || list.loading),
    error: enabled && list.key === listKey ? list.error : "",
    detail: enabled && selectedId !== null && detail.key === detailKey ? detail.row : null,
    detailLoading: enabled && selectedId !== null && (detail.key !== detailKey || detail.loading),
    detailError: enabled && selectedId !== null && detail.key === detailKey ? detail.error : "",
    refresh: () => setVersion(value => value + 1),
    retryDetail: () => setDetailVersion(value => value + 1),
  };
}
