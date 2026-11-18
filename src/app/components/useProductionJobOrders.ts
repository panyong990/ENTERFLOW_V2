import { useCallback, useEffect, useRef, useState } from "react";
import { getProductionJobOrder, listProductionJobOrders, mapProductionJobOrder } from "../api/productionJobOrders.js";

export interface ProductionJobOrder {
  id: string; reference: string; orderId: string; clientId: string; clientName: string; inquiryReference: string;
  orderItemId: string; specificationId: string; filterTypeCode: string | null; filterName: string | null;
  quantity: number; productionDueDate: string | null; createdAt: string | null; status: string; currentStageCursor: number;
  currentStageLabel: string | null; paused: boolean; pauseReason: string | null; acceptedQuotationId: string | null;
  purchaseOrderId: string | null; purchaseOrderReference: string | null; poDocumentAvailable: boolean;
  trace?: { acceptedQuotationReference: string | null; purchaseOrderReference: string | null; poDocumentAvailable: boolean; createdBy?: string | null; createdAt?: string | null };
  [key: string]: unknown;
}

export function useProductionJobOrders(filters: { q: string; status: string }, selectedId: string | null) {
  const [items, setItems] = useState<ProductionJobOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<ProductionJobOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [version, setVersion] = useState(0);
  const sequence = useRef(0);
  const refresh = useCallback(() => setVersion(value => value + 1), []);
  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    const controller = new AbortController(); const token = ++sequence.current;
    setLoading(true); setError("");
    listProductionJobOrders({ ...filters, page: 1, pageSize: 100 }, controller.signal)
      .then(result => { if (token === sequence.current) { const data = result as { items?: ProductionJobOrder[]; total?: number }; setItems((data.items ?? []).map(mapProductionJobOrder)); setTotal(Number(data.total ?? 0)); } })
      .catch(cause => { if (token === sequence.current && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load Production Job Orders."); })
      .finally(() => { if (token === sequence.current && !controller.signal.aborted) setLoading(false); });
    return () => { ++sequence.current; controller.abort(); };
  // filterKey intentionally tracks both query fields.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, version]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); setDetailLoading(false); setDetailError(""); return undefined; }
    const controller = new AbortController(); setDetailLoading(true); setDetailError("");
    getProductionJobOrder(selectedId, controller.signal)
      .then(result => setDetail(mapProductionJobOrder(result as ProductionJobOrder)))
      .catch(cause => { if (!controller.signal.aborted) setDetailError(cause instanceof Error ? cause.message : "Unable to load Job Order details."); })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [selectedId]);

  return { items, total, loading, error, detail, detailLoading, detailError, refresh };
}
