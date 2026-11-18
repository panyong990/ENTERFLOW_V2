import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSalesOrder, listSalesOrders, mapSalesOrder, rejectSalesInquiry, reviewSalesCancellation } from "../../api/salesOrders.js";
import type { SalesOrderDetail, SalesOrderListResult, SalesOrderRow } from "../useSalesOrders";
import type { Inquiry } from "../../store/orders";
import { inquiryDraft } from "./drafts";
import { usePipelineDetails } from "./usePipelineDetails";
import { uncertainWrite } from "./cancellationModel.mjs";

export type LiveInquiry = Inquiry & { salesRecord: SalesOrderRow; salesDetail?: SalesOrderDetail };

export function originalSalesInquiry(row: SalesOrderRow, detail?: SalesOrderDetail): LiveInquiry {
  const base = detail ? inquiryDraft(detail) : {
    id: String(row.id), code: row.reference, clientName: row.companyName,
    contactPerson: row.contactPerson || "Unavailable", paymentTerms: row.paymentTermLabel as Inquiry["paymentTerms"],
    products: [], stage: row.stageCode as Inquiry["stage"], submittedDate: row.submittedAt,
    urgent: row.urgent, generalNotes: row.generalNotes || undefined,
  };
  const requests = (detail?.requests ?? []) as { id: string; kind: string; reason?: string; requestedAt?: string; status: string; resolvedAt?: string }[];
  const pending = requests.find(request => request.kind === "cancellation" && request.status === "pending");
  return {
    ...base, salesRecord: row, salesDetail: detail,
    archived: Boolean(row.archivedAt), archiveReason: row.archiveReason as Inquiry["archiveReason"],
    archiveDate: row.archivedAt || undefined, archiveNote: row.archiveNote || undefined,
    fulfillmentCompletedAt: row.fulfillmentCompletedAt || undefined,
    pendingCancellation: pending ? { reason: pending.reason || "Reason unavailable", requestedAt: pending.requestedAt || "Date unavailable", requestedBy: "client" } : undefined,
    revisionRequests: requests.filter(request => ["quotation_revision", "revision"].includes(request.kind)).map(request => ({
      id: String(request.id), note: request.reason || "Revision details unavailable", requestedAt: request.requestedAt || "",
      status: request.status === "pending" ? "pending" : "processed",
    })),
  };
}

// The original pipeline has no page controls. Read every server page before
// publishing a snapshot so history and column counts never silently truncate.
export function useOriginalSalesAdapter() {
  const [state, setState] = useState<{ rows?: SalesOrderRow[]; loading: boolean; error: string }>({ loading: true, error: "" });
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, error: "" });
    void (async () => {
      const rows: SalesOrderRow[] = [];
      let page = 1;
      while (!controller.signal.aborted) {
        const result = await listSalesOrders({ q: "", status: "all", stage: "all", sort: "submitted-desc", page, pageSize: 100 }, controller.signal) as SalesOrderListResult;
        if (!Array.isArray(result.items) || !Number.isSafeInteger(result.total) || result.total < 0 || !Number.isSafeInteger(result.pageSize) || result.pageSize < 1 || result.page !== page) throw new Error("Sales records could not be verified. Retry loading the pipeline.");
        rows.push(...result.items.map(mapSalesOrder));
        if (page * result.pageSize >= result.total) break;
        if (!result.items.length) throw new Error("Sales records changed while loading. Retry the pipeline.");
        page += 1;
      }
      if (!controller.signal.aborted) setState({ rows: Array.from(new Map(rows.map(row => [row.id, row])).values()), loading: false, error: "" });
    })().catch(cause => { if (!controller.signal.aborted) setState({ loading: false, error: cause instanceof Error ? cause.message : "Sales records unavailable." }); });
    return () => controller.abort();
  }, [version]);
  useEffect(() => {
    window.addEventListener("enterflow:client-inquiry-submitted", refresh);
    return () => window.removeEventListener("enterflow:client-inquiry-submitted", refresh);
  }, [refresh]);
  const details = usePipelineDetails(state.rows, !state.loading && !state.error);
  const records = useMemo(() => (state.rows ?? []).map(row => originalSalesInquiry(row, details.records[row.id])), [state.rows, details.records]);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const locks = useRef(new Set<string>());
  const uncertain = useRef(new Set<string>());
  const write = async (inquiry: Inquiry, operation: (detail: SalesOrderDetail) => Promise<unknown>) => {
    if (locks.current.has(inquiry.id)) return false;
    if (uncertain.current.has(inquiry.id)) { setActionError("The previous action could not be confirmed. Check the latest order history before another decision."); return false; }
    locks.current.add(inquiry.id); setBusy(true); setActionError("");
    try {
      const detail = mapSalesOrder(await getSalesOrder(inquiry.id)) as SalesOrderDetail;
      await operation(detail);
      refresh();
      return true;
    } catch (cause) {
      if (uncertainWrite(cause)) uncertain.current.add(inquiry.id);
      setActionError(cause instanceof Error ? cause.message : "The action could not be confirmed.");
      refresh();
      return false;
    } finally { locks.current.delete(inquiry.id); setBusy(locks.current.size > 0); }
  };
  const reject = (inquiry: Inquiry, reason: string) => write(inquiry, async detail => {
    if (detail.stageCode !== "inquiry" || detail.archivedAt || !detail.revision) throw new Error("This inquiry is no longer eligible for rejection.");
    if (!reason.trim() || !reason.isWellFormed() || [...reason.trim()].length > 1000) throw new Error("Enter a reason of 1 to 1000 Unicode characters.");
    const result = await rejectSalesInquiry(inquiry.id, reason.trim(), detail.revision);
    if (result.notification?.clientRecipientAvailable === false) setActionError("Rejection saved. No eligible Client portal notification recipient was available.");
  });
  const cancel = (inquiry: Inquiry, decision: "approved" | "declined") => write(inquiry, async detail => {
    const request = (detail.requests as { id?: string; kind?: string; status?: string }[]).find(row => row.kind === "cancellation" && row.status === "pending");
    if (!request?.id) throw new Error("No pending cancellation request is available for review.");
    await reviewSalesCancellation(inquiry.id, String(request.id), decision);
  });
  return {
    ...state, details, refresh, actionError, busy, reject, cancel,
    inquiries: records.filter(record => !record.archived && !record.fulfillmentCompletedAt && ["inquiry", "quotation", "po"].includes(record.stage)),
    archivedInquiries: records.filter(record => record.archived),
    completedJOs: records.filter(record => !record.archived && (Boolean(record.fulfillmentCompletedAt) || !["inquiry", "quotation", "po"].includes(record.stage))),
  };
}

export type OriginalSalesAdapter = ReturnType<typeof useOriginalSalesAdapter>;
