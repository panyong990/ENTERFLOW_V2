import { useCallback, useEffect, useRef, useState } from "react";
import { listSalesClients } from "../api/salesClients.js";
import type { ApiError } from "../api/client";

export interface SalesClientRow {
  id: string;
  companyName: string;
  industry: string | null;
  contactPerson: string | null;
  email: string;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  cityProvince: string | null;
  postalCode: string | null;
  paymentTermCode: string | null;
  paymentTermLabel: string | null;
  active: boolean;
  status: "active" | "inactive";
  joinedOn: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalesClientListResult {
  items: SalesClientRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SalesClientFilters {
  q: string;
  status: "all" | "active" | "inactive";
  sort: "name-asc" | "name-desc" | "id-asc" | "id-desc";
  page: number;
  pageSize: number;
}

export function useSalesClients(enabled: boolean, filters: SalesClientFilters) {
  const [data, setData] = useState<SalesClientListResult | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const sequence = useRef(0);
  const refresh = useCallback(() => setVersion(value => value + 1), []);
  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }

    const token = ++sequence.current;
    const controller = new AbortController();
    setLoading(true);
    setError("");

    listSalesClients(filters, controller.signal)
      .then(result => {
        if (token === sequence.current) setData(result as SalesClientListResult);
      })
      .catch((cause: ApiError) => {
        if (token === sequence.current && !controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Unable to load client records.");
        }
      })
      .finally(() => {
        if (token === sequence.current && !controller.signal.aborted) setLoading(false);
      });

    return () => {
      ++sequence.current;
      controller.abort();
    };
  // filterKey makes each filter value part of the request identity without
  // depending on a newly allocated filters object.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, filterKey, version]);

  return { data, loading, error, refresh };
}
