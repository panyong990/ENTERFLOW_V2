import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api/client";

export interface SalesDashboardData {
  pendingInquiries: number; quotationsSent: number; purchaseOrdersReceived: number;
  verifiedRevenue: string; monthlyVerifiedRevenue: { month: string; amount: string }[];
}
export interface SalesNotification {
  id: string; category: string; title: string; message: string; type: string | null;
  orderId: string | null; createdAt: string; readAt: string | null; isRead: boolean;
}
export interface SalesNotificationResult { items: SalesNotification[]; total: number; page: number; pageSize: number }

export function useSalesWorkspaceData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [version, setVersion] = useState(0), sequence = useRef(0);
  const refresh = useCallback(() => setVersion(v => v + 1), []);
  useEffect(() => {
    const controller = new AbortController(), token = ++sequence.current;
    setData(null); setError(""); setLoading(true);
    api<T>(path, { signal: controller.signal }).then(value => {
      if (token === sequence.current) setData(value);
    }).catch(cause => {
      if (token === sequence.current && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Sales records unavailable.");
    }).finally(() => {
      if (token === sequence.current && !controller.signal.aborted) setLoading(false);
    });
    return () => { ++sequence.current; controller.abort(); };
  }, [path, version]);
  return { data, loading, error, refresh };
}
