import { useEffect, useRef, useState } from "react";
import { getSalesOrder, mapSalesOrder } from "../../api/salesOrders.js";
import type { SalesOrderDetail, SalesOrderRow } from "../useSalesOrders";

// Fetch the current result only, with bounded concurrency and cancellation.
// Keep the row and its detail together so a filter/refresh never exposes stale data.
export function usePipelineDetails(rows: SalesOrderRow[] | undefined, enabled: boolean) {
  const [state, setState] = useState<{ rows?: SalesOrderRow[]; records: Record<string, SalesOrderDetail>; errors: Record<string, string>; loading: boolean }>({ records: {}, errors: {}, loading: false });
  const sequence = useRef(0);
  useEffect(() => {
    const token = ++sequence.current, controller = new AbortController();
    if (!enabled || !rows) return;
    setState({ rows, records: {}, errors: {}, loading: rows.length > 0 });
    let next = 0;
    const worker = async () => {
      while (next < rows.length && !controller.signal.aborted) {
        const row = rows[next++];
        try {
          const data = mapSalesOrder(await getSalesOrder(row.id, controller.signal)) as SalesOrderDetail;
          if (sequence.current === token && !controller.signal.aborted) setState(current => ({ ...current, records: { ...current.records, [row.id]: data } }));
        } catch (cause) {
          if (sequence.current === token && !controller.signal.aborted) setState(current => ({ ...current, errors: { ...current.errors, [row.id]: cause instanceof Error ? cause.message : "Order detail unavailable" } }));
        }
      }
    };
    void Promise.all(Array.from({ length: Math.min(4, rows.length) }, worker)).then(() => {
      if (sequence.current === token && !controller.signal.aborted) setState(current => ({ ...current, loading: false }));
    });
    return () => { ++sequence.current; controller.abort(); };
  }, [rows, enabled]);
  return state.rows === rows && enabled ? state : { records: {}, errors: {}, loading: enabled };
}
