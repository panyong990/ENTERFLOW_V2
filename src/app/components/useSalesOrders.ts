import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeOperationalAvailability } from "../store/inventoryModel.js";
import { getSalesOrder, getSalesStockAvailability, listSalesOrders, mapSalesOrder } from "../api/salesOrders.js";

export type SalesOrderStatus = "all" | "open" | "archived";
export type SalesOrderStage = "all" | "inquiry" | "quotation" | "po" | "jo" | "in_production" | "quality_inspection" | "ready_for_dispatch" | "dispatched" | "delivered" | "paid" | "overdue";
export type SalesOrderSort = "submitted-asc" | "submitted-desc" | "client-asc" | "client-desc" | "id-asc" | "id-desc";

export interface SalesOrderFilters {
  cancellationStatus?: 'all' | 'pending' | 'approved' | 'declined';
  q: string;
  status: SalesOrderStatus;
  stage: SalesOrderStage;
  sort: SalesOrderSort;
  page: number;
  pageSize: number;
}

export interface SalesOrderRow {
  id: string;
  reference: string;
  clientId: string | null;
  companyName: string;
  contactPerson: string | null;
  stageCode: Exclude<SalesOrderStage, "all">;
  stageLabel: string;
  stageDisplayOrder: number;
  paymentTermCode: string;
  paymentTermLabel: string;
  deliveryMethodCode: string | null;
  deliveryMethodLabel: string | null;
  submittedAt: string;
  urgent: boolean;
  requestedDeliveryDate: string | null;
  generalNotes: string | null;
  revision?: string;
  archiveNote?: string | null;
  archiveReason: string | null;
  archivedAt: string | null;
  fulfillmentCompletedAt: string | null;
  updatedAt: string;
  quotationCount: number;
  latestQuotationReference: string | null;
  latestQuotationStatus: string | null;
  latestQuotationRevision: number | null;
  purchaseOrderReference: string | null;
  purchaseOrderReceivedAt: string | null;
  jobOrderCount: number;
  invoiceReference: string | null;
  invoiceAmount: string | null;
  verifiedPaymentAmount: string;
}

export interface SalesOrderItem {
  id: string;
  lineNumber: number;
  quantity: number;
  specificationId: string;
  filterTypeCode: string | null;
  filterName: string | null;
  od1: string | null;
  od2: string | null;
  id1: string | null;
  id2: string | null;
  height: string | null;
  overallHeight: string | null;
  length: string | null;
  width: string | null;
  thickness: string | null;
  depth: string | null;
  pocketCount: string | null;
  diameter: string | null;
  media: string | null;
  innerCore: string | null;
  outerCore: string | null;
  oring: string | null;
  gasket: string | null;
  endCap: string | null;
  oemPartNumber: string | null;
  brand: string | null;
  filtrationRating: string | null;
  others: string | null;
  notes: string | null;
}

export interface SalesPayment {
  id: string;
  invoiceId: string | null;
  paymentType: string | null;
  submittedAmount: string | null;
  verifiedAmount: string | null;
  method: string | null;
  referenceNumber: string | null;
  paidOn: string | null;
  verificationStatus: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
}

export type SalesOrderDetail = SalesOrderRow & {
  items: SalesOrderItem[];
  quotations: unknown[];
  purchaseOrders: unknown[];
  jobOrders: unknown[];
  invoices: unknown[];
  payments: SalesPayment[];
  shipments: unknown[];
  requests: unknown[];
};

export interface SalesStockAssessment {
  materialId?: string;
  materialName?: string;
  unitCode?: string | null;
  quantityStatus?: "unknown" | "provisional_sample" | "verified";
  inventoryId: string | null; description: string; classification: "raw_material" | "finished_good";
  categoryCode: string | null; requiredQuantity: number | null; availableQuantity: number | null;
  shortageQuantity: number | null; unit: string | null; inventoryState: "recorded" | "zero_stock" | "inventory_unavailable";
  status: "available" | "insufficient" | "inventory_unavailable"; source: "bom_template" | "finished_goods";
  itemId: string; specificationId: string; filterTypeCode: string | null; filterName: string | null;
  checkedAt: string; itemCode?: string; partNumber?: string; bufferMinimum?: number | null; demand?: string;
}
export interface SalesStockAvailability {
  requirementsAvailable?: boolean;
  orderId: string; checkedAt: string;
  overallStatus: "available" | "insufficient" | "partially_available" | "unavailable" | "unmapped";
  assessments: SalesStockAssessment[];
  unmappedItems: { itemId: string; specificationId: string; filterTypeCode: string | null; filterName: string | null; reason: string }[];
  stockChanged: false;
}

export interface SalesOrderListResult {
  items: SalesOrderRow[];
  total: number;
  page: number;
  pageSize: number;
}

export function useSalesOrders(enabled: boolean, filters: SalesOrderFilters) {
  const [data, setData] = useState<SalesOrderListResult | null>(null);
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
    listSalesOrders(filters, controller.signal)
      .then(result => {
        if (token === sequence.current) {
          const response = result as SalesOrderListResult;
          setData({ ...response, items: response.items.map(mapSalesOrder) as SalesOrderRow[] });
        }
      })
      .catch(cause => {
        if (token === sequence.current && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load Sales orders.");
      })
      .finally(() => {
        if (token === sequence.current && !controller.signal.aborted) setLoading(false);
      });
    return () => {
      ++sequence.current;
      controller.abort();
    };
  // filterKey makes each filter value part of the request identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, filterKey, version]);

  return { data, loading, error, refresh };
}

export function useSalesOrderDetail(enabled: boolean, id: string | null) {
  const [data, setData] = useState<SalesOrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const sequence = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const retry = useCallback(() => setVersion(value => value + 1), []);

  useEffect(() => {
    controllerRef.current?.abort();
    if (!enabled || !id) {
      setData(null);
      setLoading(false);
      setError("");
      return undefined;
    }
    const token = ++sequence.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError("");
    getSalesOrder(id, controller.signal)
      .then(result => {
        if (token === sequence.current) setData(mapSalesOrder(result as SalesOrderDetail) as SalesOrderDetail);
      })
      .catch(cause => {
        if (token === sequence.current && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load order details.");
      })
      .finally(() => {
        if (token === sequence.current && !controller.signal.aborted) setLoading(false);
      });
    return () => {
      ++sequence.current;
      controller.abort();
    };
  }, [enabled, id, retry, version]);

  return { data, loading, error, retry };
}

export function useSalesStockAvailability(enabled: boolean, id: string | null) {
  const [data, setData] = useState<SalesStockAvailability | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const sequence = useRef(0);
  const refresh = useCallback(() => setVersion(value => value + 1), []);
  useEffect(() => {
    if (!enabled || !id) { setData(null); setLoading(false); setError(""); return undefined; }
    const token = ++sequence.current;
    const controller = new AbortController();
    setLoading(true); setError("");
    getSalesStockAvailability(id, controller.signal)
      .then(result => { if (token === sequence.current) setData(normalizeOperationalAvailability(result) as SalesStockAvailability); })
      .catch(cause => { if (token === sequence.current && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Stock availability is unavailable."); })
      .finally(() => { if (token === sequence.current && !controller.signal.aborted) setLoading(false); });
    return () => { ++sequence.current; controller.abort(); };
  }, [enabled, id, refresh, version]);
  return { data, loading, error, refresh };
}
