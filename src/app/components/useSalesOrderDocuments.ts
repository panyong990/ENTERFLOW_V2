import { useCallback, useEffect, useRef, useState } from "react";
import { generateSalesInvoice, getSalesPurchaseOrder, listSalesQuotations, mapSalesPurchaseOrder, mapSalesQuotation, processSalesPurchaseOrder } from "../api/salesOrderDocuments.js";

export interface SalesQuotationFile { id: string; purpose?: string | null; originalFilename?: string | null; mimeType?: string | null; sizeBytes?: number | string | null; state?: string | null; uploadedAt?: string | null; quotationId?: string | null }
export interface SalesQuotationLine { id: string; quotationId: string; orderItemId: string; lineNumber: number; description: string; subDescription?: string | null; quantity: number; unitLabel: string; unitPrice: string | number | null }
export interface SalesQuotationCosting { bomLines?: {lineNumber:number;materialId:string;materialName:string;unit:string;unitPrice:string;quantityPerFilter:string;wastePercent:string}[]; id: string; quotationId: string; orderItemId: string; laborCost: string | number | null; markupPercent: string | number | null; discountPercent: string | number | null; vatType: string | null; vatRate: string | number | null; includeLabor: boolean; applyMarkup: boolean; applyVat: boolean; calculatedUnitPrice: string | number | null }
export interface SalesQuotation {
  id: string;
  reference: string;
  revisionNumber: number;
  status: string;
  issuedOn: string | null;
  validUntil: string | null;
  paymentTermCode: string | null;
  paymentTermLabel: string | null;
  timeOfDelivery: string | null;
  placeOfDelivery: string | null;
  note: string | null;
  noteHighlighted: boolean;
  totalAmount: string | number | null;
  downpaymentPercent: string | number | null;
  downpaymentAmount: string | number | null;
  stockCheckedAt: string | null;
  sentAt: string | null;
  downpaymentValid?: boolean;
  decision?: "accepted" | "rejected" | null;
  decisionReason?: string | null;
  decidedAt?: string | null;
  sent: boolean;
  lines: SalesQuotationLine[];
  costing: SalesQuotationCosting[];
  discounts: { quotationId?: string; lineNumber: number; label: string; percent: string | number }[];
  addons: { id: string; quotationId: string; kind: string; materialId: string | null; label: string; quantity: string | number; unitPrice: string | number; includeInUnitPrice: boolean }[];
  files: SalesQuotationFile[];
}

export interface SalesPurchaseOrder {
  id: string;
  acceptedQuotationId: string | null;
  acceptedQuotationReference: string | null;
  reference: string;
  clientReference: string | null;
  uploadedAt: string | null;
  receivedAt: string | null;
  clearedAt: string | null;
  status?: "pending" | "received" | "validated" | "rejected";
  decisionReason?: string | null;
  received: boolean;
  cleared: boolean;
  files: { id: string; purpose?: string | null; originalFilename?: string | null; mimeType?: string | null; sizeBytes?: number | string | null; state?: string | null; uploadedAt?: string | null; purchaseOrderId?: string | null }[];
}
export interface SalesIssuedInvoice { id: string; orderId: string; reference: string; issuedOn: string; amount: string | number; requiredDownpayment: string | number; status: "issued"; }

export function useSalesOrderDocuments(enabled: boolean, orderId: string | null) {
  const [quotations, setQuotations] = useState<SalesQuotation[]>([]);
  const [purchaseOrder, setPurchaseOrder] = useState<SalesPurchaseOrder | null>(null);
  const [quotationsLoading, setQuotationsLoading] = useState(false);
  const [purchaseOrderLoading, setPurchaseOrderLoading] = useState(false);
  const [quotationsError, setQuotationsError] = useState("");
  const [purchaseOrderError, setPurchaseOrderError] = useState("");
  const [purchaseOrderActionLoading, setPurchaseOrderActionLoading] = useState(false);
  const [purchaseOrderActionError, setPurchaseOrderActionError] = useState("");
  const [invoiceActionLoading, setInvoiceActionLoading] = useState(false);
  const [invoiceActionError, setInvoiceActionError] = useState("");
  const [issuedInvoice, setIssuedInvoice] = useState<SalesIssuedInvoice | null>(null);
  const [version, setVersion] = useState(0);
  const sequence = useRef(0);
  const refresh = useCallback(() => setVersion(value => value + 1), []);
  const processPurchaseOrder = useCallback(async (decision: "validated" | "rejected", reason?: string) => {
    if (!orderId) return;
    setPurchaseOrderActionLoading(true);
    setPurchaseOrderActionError("");
    try {
      await processSalesPurchaseOrder(orderId, { decision, ...(reason ? { reason } : {}) });
      refresh();
    } catch (cause) {
      setPurchaseOrderActionError(cause instanceof Error ? cause.message : "Unable to process the purchase order.");
      throw cause;
    } finally {
      setPurchaseOrderActionLoading(false);
    }
  }, [orderId, refresh]);
  const issueInvoice = useCallback(async () => {
    if (!orderId) return;
    setInvoiceActionLoading(true); setInvoiceActionError("");
    try { const result = await generateSalesInvoice(orderId) as SalesIssuedInvoice; setIssuedInvoice(result); refresh(); }
    catch (cause) { setInvoiceActionError(cause instanceof Error ? cause.message : "Unable to issue the invoice."); throw cause; }
    finally { setInvoiceActionLoading(false); }
  }, [orderId, refresh]);

  useEffect(() => {
    if (!enabled || !orderId) {
      setQuotations([]);
      setPurchaseOrder(null);
      setQuotationsLoading(false);
      setPurchaseOrderLoading(false);
      setQuotationsError("");
      setPurchaseOrderError("");
      return undefined;
    }
    const token = ++sequence.current;
    const controller = new AbortController();
    setQuotations([]);
    setPurchaseOrder(null);
    setQuotationsLoading(true);
    setPurchaseOrderLoading(true);
    setQuotationsError("");
    setPurchaseOrderError("");

    listSalesQuotations(orderId, controller.signal)
      .then(result => { if (token === sequence.current) setQuotations((result as SalesQuotation[]).map(mapSalesQuotation)); })
      .catch(cause => { if (token === sequence.current && !controller.signal.aborted) setQuotationsError(cause instanceof Error ? cause.message : "Unable to load quotation history."); })
      .finally(() => { if (token === sequence.current && !controller.signal.aborted) setQuotationsLoading(false); });

    getSalesPurchaseOrder(orderId, controller.signal)
      .then(result => { if (token === sequence.current) setPurchaseOrder(mapSalesPurchaseOrder(result as SalesPurchaseOrder)); })
      .catch(cause => {
        if (token !== sequence.current || controller.signal.aborted) return;
        if (cause?.status === 404 || cause?.code === "PURCHASE_ORDER_NOT_FOUND") setPurchaseOrder(null);
        else setPurchaseOrderError(cause instanceof Error ? cause.message : "Unable to load purchase-order information.");
      })
      .finally(() => { if (token === sequence.current && !controller.signal.aborted) setPurchaseOrderLoading(false); });

    return () => {
      ++sequence.current;
      controller.abort();
    };
  }, [enabled, orderId, version]);

  return { quotations, purchaseOrder, issuedInvoice, invoiceActionLoading, invoiceActionError, quotationsLoading, purchaseOrderLoading, quotationsError, purchaseOrderError, purchaseOrderActionLoading, purchaseOrderActionError, processPurchaseOrder, issueInvoice, refresh };
}
