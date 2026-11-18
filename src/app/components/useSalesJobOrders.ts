import { useCallback, useEffect, useRef, useState } from "react";
import { createSalesJobOrders, listSalesJobOrders, mapSalesJobOrder } from "../api/salesJobOrders.js";

export interface SalesProductionEvent {
  id: string;
  jobOrderId: string;
  stagePosition: number | null;
  stageLabel: string | null;
  action: string;
  reason: string | null;
  occurredAt: string | null;
}

export interface SalesJobOrder {
  id: string;
  reference: string;
  orderItemId: string | null;
  specificationId: string | null;
  replacementRequestId: string | null;
  quantity: number;
  productionDueDate: string | null;
  currentStageCursor: number | null;
  currentStageLabel: string | null;
  status: string;
  paused: boolean;
  pauseReason: string | null;
  materialsDeductedAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
  bomLineCount: number;
  productionEvents: SalesProductionEvent[];
}

export function useSalesJobOrders(enabled: boolean, orderId: string | null) {
  const [jobOrders, setJobOrders] = useState<SalesJobOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const sequence = useRef(0);
  const refresh = useCallback(() => setVersion(value => value + 1), []);
  const createJobOrders = useCallback(async (productionDueDate: string) => {
    if (!orderId) return;
    setCreateLoading(true);
    setCreateError("");
    try {
      await createSalesJobOrders(orderId, { productionDueDate });
      refresh();
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : "Unable to create the Job Order.");
      throw cause;
    } finally {
      setCreateLoading(false);
    }
  }, [orderId, refresh]);

  useEffect(() => {
    if (!enabled || !orderId) {
      setJobOrders([]);
      setLoading(false);
      setError("");
      return undefined;
    }
    const token = ++sequence.current;
    const controller = new AbortController();
    setJobOrders([]);
    setLoading(true);
    setError("");
    listSalesJobOrders(orderId, controller.signal)
      .then(result => {
        if (token === sequence.current) setJobOrders(((result as { jobOrders?: SalesJobOrder[] }).jobOrders ?? []).map(mapSalesJobOrder));
      })
      .catch(cause => {
        if (token === sequence.current && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load Job Orders.");
      })
      .finally(() => {
        if (token === sequence.current && !controller.signal.aborted) setLoading(false);
      });
    return () => {
      ++sequence.current;
      controller.abort();
    };
  }, [enabled, orderId, version]);

  return { jobOrders, loading, error, refresh, createJobOrders, createLoading, createError };
}
