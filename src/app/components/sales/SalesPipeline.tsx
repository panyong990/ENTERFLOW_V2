import { useEffect, useRef, useState } from "react";
import { ArrowRight, Calculator, ChevronDown, ChevronUp, FileText, RefreshCw, Search } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useSalesOrders, type SalesOrderFilters, type SalesOrderRow, type SalesOrderDetail } from "../useSalesOrders";
import { SalesRecordBrowser, OrderDetail } from "./SalesRecordBrowser";
import { useSalesOrderDetail } from "../useSalesOrders";
import { GenerateJOModal } from "./OriginalSalesForms";
import { RealQuotationPreparation } from "./RealQuotationPreparation";
import { inquiryDraft, pendingIntegration } from "./drafts";
import { pipelineColumn, moneyAtLeast } from "./pipelineModel.mjs";
import { getSalesOrder, rejectSalesInquiry, reviewSalesCancellation, sumVerifiedPaymentAmounts } from "../../api/salesOrders.js";
import { cancellationQuery, uncertainWrite } from './cancellationModel.mjs';
import { usePipelineDetails } from "./usePipelineDetails";
import { SalesInvoicePreparation } from "./SalesInvoicePreparation";
import { RealSalesStockRequests as SalesStockRequests } from "./RealSalesStockRequests";
import { SalesNotificationBell } from "./SalesNotifications";

const columns = [
  { id: "inquiry", title: "NEW INQUIRY", tint: "#64748B" },
  { id: "quotation", title: "QUOTATION SENT", tint: "#D97706" },
  { id: "ready", title: "READY FOR JOB ORDER", tint: "#C9A84C" },
];
const statusOptions = [
  ["all", "All Statuses"], ["inquiry", "New Inquiry"], ["quotation", "Quotation Sent · Awaiting Client PO"],
  ["revision", "Revision Requested"], ["po", "PO Pending Sales Review"], ["approved", "PO Approved"],
  ["rejected", "PO Rejected · Resubmission Required"], ["ready", "Ready for Job Order · Payment Verified"],
  ["invoice-sent", "Invoice Sent · Awaiting Client Payment"], ["invoice-draft", "Invoice Draft · Ready for Sales Review"],
  ["downpayment", "Required Downpayment Pending"], ["cancellation", "Cancellation Requested"],
];
const cancellationFilters = [
  ["all", "All Requests"], ["pending", "Pending Review"], ["approved", "Approved / Cancelled"], ["declined", "Declined"],
] as const;

export function SalesPipeline({ targetInquiryId }: { targetInquiryId?: string } = {}) {
  const [filters, setFilters] = useState<SalesOrderFilters>({ q: "", status: "open", stage: "all", sort: "submitted-desc", page: 1, pageSize: 25 });
  const [status, setStatus] = useState("all");
  const [recordsView, setRecordsView] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [workspaceSection, setWorkspaceSection] = useState<"pipeline" | "cancellations" | "records">("pipeline");
  const [cancellationFilter, setCancellationFilter] = useState<(typeof cancellationFilters)[number][0]>("all");
  useEffect(() => { if (targetInquiryId) setSelected(targetInquiryId); }, [targetInquiryId]);
  const [cancellationPage, setCancellationPage] = useState(1);
  const remote = useSalesOrders(!recordsView, workspaceSection === 'cancellations' ? cancellationQuery(filters, cancellationFilter, cancellationPage) : filters);
  useEffect(() => {
    const onClientInquirySubmitted = () => remote.refresh();
    window.addEventListener("enterflow:client-inquiry-submitted", onClientInquirySubmitted);
    return () => window.removeEventListener("enterflow:client-inquiry-submitted", onClientInquirySubmitted);
  }, [remote.refresh]);
  const details = usePipelineDetails(remote.data?.items, !recordsView && !remote.loading && !remote.error);
  const selectedDetail = useSalesOrderDetail(Boolean(selected), selected);
  const update = (patch: Partial<SalesOrderFilters>) => setFilters(current => ({ ...current, page: 1, ...patch }));
  const rows = remote.data?.items ?? [];
  const cancellationRows = rows.filter(row => hasCancellationRequest(details.records[row.id], cancellationFilter));
  return <main className="h-full overflow-auto bg-[#F4F6F9]">
    <Toaster position="bottom-right" richColors />
    {recordsView ? <SalesRecordBrowser /> : <>
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/70 bg-white px-8 py-5">
        <div><h1 className="font-syne text-[28px] font-extrabold leading-tight text-slate-900">Sales &amp; Orders</h1><p className="mt-1 font-dm text-[13px] text-slate-500">Pipeline overview · Inquiry → Quotation → PO → JO</p></div>
        <div className="flex flex-wrap items-center gap-3">
          {workspaceSection === "pipeline" && <>
          <label className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input maxLength={254} aria-label="Search inquiries" placeholder="Search inquiries..." value={filters.q} onChange={e => update({ q: e.target.value })} className="w-64 rounded-lg border border-slate-200 bg-[#F4F6F9] py-2.5 pl-9 pr-4 text-[13px]" /></label>
          <select aria-label="Filter Sales & Orders by status" value={status} onChange={e => setStatus(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs">
            {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          </>}
          <button type="button" aria-label="Refresh Sales inquiries" onClick={remote.refresh} disabled={remote.loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
            <RefreshCw size={14} className={remote.loading ? "animate-spin" : ""} />
            {remote.loading ? "Refreshing…" : "Refresh"}
          </button>
          <button onClick={() => setStockOpen(true)} className="rounded-lg bg-[#1A2B4A] px-4 py-2.5 text-xs font-bold text-white">Stock Requests</button>
          <SalesNotificationBell />
        </div>
      </header>
      <nav aria-label="Sales & Orders sections" className="flex flex-wrap gap-2 border-b border-slate-200/70 bg-white px-8 py-3">
        {([
          ["pipeline", "Active Pipeline"], ["cancellations", "Cancellation Requests"], ["records", "All Order Records & Stages"],
        ] as const).map(([value, label]) => <button key={value} type="button" onClick={() => value === "records" ? setRecordsView(true) : setWorkspaceSection(value)} aria-current={workspaceSection === value ? "page" : undefined} className={`rounded-lg px-3 py-2 text-xs font-semibold ${workspaceSection === value ? "bg-[#1A2B4A] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{label}</button>)}
      </nav>
      {remote.loading && <p role="status" className="px-8 pt-4 text-sm">Loading Sales inquiries…</p>}
      {remote.error && !remote.loading && <p role="alert" className="m-8 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">{remote.error} <button onClick={remote.refresh}>Retry</button></p>}
      {!remote.loading && !remote.error && <>
        {workspaceSection === "pipeline" && <>
        {["po", "approved", "rejected"].includes(status) && <p role="status" className="mx-8 mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-xs">This detailed PO review status is unavailable from the Sales API. PO records remain accessible through All Statuses and All order records; no approval or rejection is inferred.</p>}
        {details.loading && <p role="status" className="px-8 pt-4 text-sm text-slate-500">Loading product specifications and readiness checks…</p>}
        <h2 className="px-8 pt-6 font-syne text-lg font-bold text-slate-900">Active Pipeline</h2>
        <div className="overflow-x-auto px-8 py-6"><div className="grid min-w-[900px] grid-cols-3 gap-6">
          {columns.map(column => {
            const visible = rows.filter(row => pipelineColumn(row, details.records[row.id]) === column.id && matches(row, details.records[row.id], status));
            return <section key={column.id} className="flex min-h-[420px] flex-col rounded-xl border border-slate-200/70 bg-white">
              <div className="flex items-center justify-between rounded-t-xl border-b border-slate-200/70 bg-[#F4F6F9] px-5 py-4"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: column.tint }} /><h2 className="font-syne text-[13px] font-bold tracking-wide text-slate-900">{column.title}</h2></div><span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold">{visible.length}</span></div>
              <div className="flex flex-1 flex-col gap-3 p-4">{visible.length ? visible.map(row => <PipelineCard key={row.id} row={row} detail={details.records[row.id]} error={details.errors[row.id]} ready={column.id === "ready"} onRecords={() => setSelected(row.id)} retry={remote.refresh} />) : <div className="flex flex-1 items-center justify-center text-xs text-slate-400">{details.loading ? "Checking records…" : "No inquiries"}</div>}</div>
            </section>;
          })}
        </div></div>
        </>}
        {workspaceSection === "cancellations" && <>
          {details.loading && <p role="status" className="px-8 py-3">Loading cancellation history…</p>}
          {Object.keys(details.errors).length > 0 && <p role="alert" className="px-8 py-3">Some cancellation history could not be loaded. <button onClick={remote.refresh}>Retry history</button></p>}
          <CancellationSection filter={cancellationFilter} setFilter={value => { setCancellationFilter(value); setCancellationPage(1); }} title="Cancellation Requests" rows={cancellationRows} details={details.records} empty={details.loading ? 'Loading cancellation history…' : Object.keys(details.errors).length ? 'Cancellation history is unavailable for some orders.' : 'No cancellation requests were returned by the authenticated Sales API.'} onSelect={setSelected} onDecision={remote.refresh} />
          <nav aria-label="Cancellation history pages" className="mx-8 mb-6 flex items-center gap-3 text-sm">
            <button disabled={(remote.data?.page ?? 1) <= 1} onClick={() => setCancellationPage((remote.data?.page ?? 1) - 1)}>Previous</button>
            <span>Page {remote.data?.page ?? 1} of {Math.max(1, Math.ceil((remote.data?.total ?? 0) / (remote.data?.pageSize ?? 25)))}</span>
            <button disabled={(remote.data?.page ?? 1) * (remote.data?.pageSize ?? 25) >= (remote.data?.total ?? 0)} onClick={() => setCancellationPage((remote.data?.page ?? 1) + 1)}>Next</button>
          </nav>
        </>}
      </>}
    </>}
    {selected && <OrderDetail detail={selectedDetail.data} loading={selectedDetail.loading} error={selectedDetail.error} retry={selectedDetail.retry} onClose={() => setSelected(null)} />}
    {stockOpen && <SalesStockRequests onClose={() => setStockOpen(false)} rows={rows} />}
  </main>;
}

function matches(row: SalesOrderRow, detail: SalesOrderDetail | undefined, status: string) {
  const requests = (detail?.requests ?? []) as { kind: string; status: string }[];
  if (status === "all") return true;
  if (status === "ready") return pipelineColumn(row, detail) === "ready";
  if (status === "revision") return requests.some(r => ["quotation_revision", "revision"].includes(r.kind) && r.status === "pending");
  if (status === "cancellation") return requests.some(r => r.kind === "cancellation" && r.status === "pending");
  // PO review/rejection status is not returned by the current API. Never infer it.
  if (["approved", "rejected", "po"].includes(status)) return false;
  if (["invoice-sent", "invoice-draft", "downpayment"].includes(status)) return (detail?.invoices as { id: string; sentAt: string | null; amount: string; requiredDownpayment: string }[] | undefined)?.some(invoice => {
    if (status === "invoice-draft") return !invoice.sentAt;
    const required = status === "downpayment" ? invoice.requiredDownpayment : invoice.amount;
    if (!invoice.sentAt || !/^\d+(\.\d+)?$/.test(String(required)) || !/[1-9]/.test(String(required))) return false;
    const paid = sumVerifiedPaymentAmounts((detail?.payments ?? []).filter(payment => String(payment.invoiceId) === String(invoice.id)));
    return !moneyAtLeast(paid, required);
  }) ?? false;
  return row.stageCode === status;
}

function hasCancellationRequest(detail: SalesOrderDetail | undefined, filter = "all") {
  return (detail?.requests ?? []).some((request) => {
    const value = request as { kind?: string; status?: string };
    return value.kind === "cancellation" && (filter === "all" || value.status === filter || (filter === "approved" && value.status === "cancelled") || (filter === "declined" && value.status === "rejected"));
  });
}

function CancellationSection({ title, rows, details, empty, onSelect, onDecision, filter, setFilter }: { title: string; rows: SalesOrderRow[]; details: Record<string, SalesOrderDetail>; empty: string; onSelect: (id: string) => void; onDecision: () => void; filter: string; setFilter: (value: (typeof cancellationFilters)[number][0]) => void }) {
  return <section aria-label={title} className="mx-8 mb-8 rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3"><h2 className="font-syne font-bold text-slate-900">{title}</h2><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{rows.length}</span></div>
    <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Cancellation request filters">{cancellationFilters.map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${filter === value ? "bg-[#1A2B4A] text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{label}</button>)}</div>
    <div className="mt-3 flex flex-col gap-2">{rows.length ? rows.map(row => {
      const requests = (details[row.id]?.requests ?? []).filter((request) => (request as { kind?: string }).kind === "cancellation") as { id?: string; reason?: string; requestedAt?: string; status?: string }[];
      const pending = requests.find(request => request.status === "pending");
      return <article key={row.id} className="rounded border border-amber-100 bg-amber-50/40 p-3 text-xs">
        <button type="button" onClick={() => onSelect(row.id)} className="text-left hover:underline"><b>{row.reference}</b> · {row.companyName}</button>
        <div className="mt-1 text-slate-600">{requests.map((request, index) => <span key={`${row.id}-${index}`}>{request.status || "Status unavailable"} · {request.reason || "Reason unavailable"}{request.requestedAt ? ` · ${request.requestedAt}` : " · Timestamp unavailable"}{index < requests.length - 1 ? " | " : ""}</span>)}</div>
        {pending?.id && <CancellationReview orderId={row.id} request={{ id: pending.id, reason: pending.reason, requestedAt: pending.requestedAt }} onResolved={onDecision} />}
      </article>;
    }) : <p className="text-xs text-slate-400">{empty}</p>}</div>
  </section>;
}

type CancellationRequestRow = { id: string; reason?: string; requestedAt?: string };

function CancellationReview({ orderId, request, onResolved }: { orderId: string; request: CancellationRequestRow; onResolved: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const decisionLock = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const checkState = async () => {
    if (decisionLock.current) return;
    decisionLock.current = true; setSubmitting(true);
    try {
      const latest = await getSalesOrder(orderId) as SalesOrderDetail;
      const current = (latest.requests ?? []).find((row: any) => row.id === request.id) as { status?: string } | undefined;
      if (!current) { setError('The request state could not be confirmed. Check again before retrying.'); return; }
      if (current.status !== 'pending') { onResolved(); setError(`Cancellation is ${current.status}. Refreshing history.`); }
      else { setUncertain(false); setError('The request is still pending. Review before submitting another decision.'); }
    } catch { setError('The request state could not be confirmed. Check again before retrying.'); }
    finally { decisionLock.current = false; setSubmitting(false); }
  };
  const decide = async (decision: "approved" | "declined") => {
    if (decisionLock.current || uncertain) return;
    decisionLock.current = true;
    setSubmitting(true);
    setError("");
    try {
      await reviewSalesCancellation(orderId, request.id, decision);
      toast.success(decision === "approved" ? "Cancellation accepted and archived." : "Cancellation declined; inquiry restored.");
      onResolved();
    } catch (cause) {
      if (uncertainWrite(cause)) setUncertain(true);
      const message = cause instanceof Error ? cause.message : "The cancellation decision could not be confirmed.";
      setError(message);
      toast.error(message);
    } finally {
      decisionLock.current = false;
      setSubmitting(false);
    }
  };
  return <section aria-label="Cancellation review" className="mt-3 rounded-md border border-amber-300 bg-white p-3 text-xs text-amber-950">
    <div className="font-bold">Cancellation Requested</div>
    <div className="mt-1">Client reason: {request.reason || "Reason unavailable"}</div>
    <div className="mt-1">Request date: {request.requestedAt || "Date unavailable"}</div>
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled={submitting || uncertain} onClick={() => void decide("approved")} className="rounded bg-red-700 px-3 py-2 font-bold text-white disabled:opacity-50">{submitting ? "Saving…" : "ACCEPT CANCEL"}</button>
      <button type="button" disabled={submitting || uncertain} onClick={() => void decide("declined")} className="rounded border border-slate-300 px-3 py-2 font-bold text-slate-700 disabled:opacity-50">DECLINE</button>
      {uncertain && <button type="button" disabled={submitting} onClick={() => void checkState()}>Check latest cancellation state</button>}
    </div>
  </section>;
}

function RecordSection({ title, rows, empty, onSelect }: { title: string; rows: SalesOrderRow[]; empty: string; onSelect: (id: string) => void }) {
  return <section aria-label={title} className="mx-8 mb-8 rounded-xl border bg-white p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-syne font-bold">{title}</h2><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{rows.length}</span></div><div className="mt-3 flex flex-wrap gap-3">{rows.map(row => <button key={row.id} onClick={() => onSelect(row.id)} className="rounded border p-3 text-left text-xs"><b>{row.reference}</b> · {row.companyName}<br />{row.stageLabel} · {row.archiveReason || (row.fulfillmentCompletedAt ? "Completed" : "Record available")}</button>)}{rows.length === 0 && <p className="text-xs text-slate-400">{empty}</p>}</div></section>;
}

function PipelineCard({ row, detail, error, ready, onRecords, retry }: { row: SalesOrderRow; detail?: SalesOrderDetail; error?: string; ready: boolean; onRecords: () => void; retry: () => void }) {
  const [expanded, setExpanded] = useState(row.stageCode === "inquiry");
  const [productsOpen, setProductsOpen] = useState(false);
  const [action, setAction] = useState<"quotation" | "jo" | "invoice" | "approve" | "reject" | "reject-inquiry" | null>(null);
  const [reason, setReason] = useState("");

  const [rejecting,setRejecting] = useState(false), [rejectionError,setRejectionError] = useState('');
  const rejectionLock = useRef(false);
  const cancellationRequest = (detail?.requests ?? []).find((request) => {
    const value = request as { kind?: string; status?: string };
    return value.kind === "cancellation" && value.status === "pending";
  }) as { id?: string; reason?: string; requestedAt?: string } | undefined;
  const eligible = row.stageCode === 'inquiry' && !row.archivedAt && detail?.stageCode === 'inquiry' && !detail.archivedAt && !!detail.revision;
  const submitRejection = async () => {
    if (rejectionLock.current || !eligible) return;
    const value=reason.trim();
    if(!value || !value.isWellFormed() || [...value].length>1000) {setRejectionError('Enter a valid reason of 1 to 1000 Unicode characters.');return;}
    rejectionLock.current=true;setRejecting(true);setRejectionError('');
    try {
      const result=await rejectSalesInquiry(row.id,value,detail!.revision!);
      setAction(null);setReason('');
      toast.success('Inquiry rejected and archived.');
      if(result.notification?.clientRecipientAvailable===false)toast.warning('No eligible Client portal notification recipient was available. Rejection was saved.');
      retry();
    } catch(cause) {
      setRejectionError(cause instanceof Error?cause.message:'Rejection could not be confirmed. Refresh before retrying.');
      const code=(cause as {code?:string}).code;
      if(['STALE_RECORD','INQUIRY_ALREADY_REJECTED','INVALID_STATE','WRITE_OUTCOME_UNKNOWN','NETWORK_ERROR'].includes(code??'')) {setAction(null);toast.error(cause instanceof Error?cause.message:'Refresh before retrying.');retry();}
    } finally {rejectionLock.current=false;setRejecting(false);}
  };
  const draft = detail ? inquiryDraft(detail) : null;
  return <article className="rounded-lg border bg-white p-5 transition-all hover:shadow-sm" style={{ borderColor: ready ? "#BBF7D0" : "#E2E8F0" }}>
    <div className="mb-3 flex items-center justify-between gap-2"><b className="font-mono-jb text-xs text-[#1A2B4A]">{row.reference}</b><div className="flex items-center gap-2">{row.urgent && <span className="rounded-full bg-red-100 px-2 text-[10px] font-bold text-red-700">RUSH</span>}<button aria-label={expanded ? "Collapse order details" : "Expand order details"} aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="rounded-full p-1 hover:bg-slate-100">{expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button></div></div>
    <div className="mb-1.5 text-sm font-semibold text-slate-900">{row.companyName}</div><div className="mb-2 text-xs text-slate-500">{row.contactPerson || "Contact unavailable"} · {row.paymentTermLabel}</div>
    <span className="mb-3 inline-block rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">{cancellationRequest ? "CANCELLATION REQUESTED" : row.stageLabel}</span>
    {expanded && <div className="flex flex-col gap-3">
      {cancellationRequest ? cancellationRequest.id
        ? <CancellationReview orderId={row.id} request={{ id: cancellationRequest.id, reason: cancellationRequest.reason, requestedAt: cancellationRequest.requestedAt }} onResolved={retry} />
        : <div role="status" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"><div className="font-bold">Cancellation Requested</div><div>{cancellationRequest.reason || "Reason unavailable"} · {cancellationRequest.requestedAt || "Date unavailable"}</div><div className="mt-1">The request identifier is unavailable; refresh before reviewing.</div></div>
        : <>
      {detail ? <><button onClick={() => setProductsOpen(!productsOpen)} className="flex items-center gap-1 self-start rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">{detail.items.length} products {productsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</button>{productsOpen && <div className="space-y-2 rounded bg-slate-50 p-3">{detail.items.map(item => <div key={item.id} className="text-xs"><b>{item.filterName || item.filterTypeCode}</b> × {item.quantity}<div className="mt-1 grid grid-cols-2 gap-1 text-slate-500">{Object.entries(item).filter(([key, value]) => !["id", "lineNumber", "quantity", "filterName", "filterTypeCode"].includes(key) && value != null).map(([key, value]) => <span key={key}>{key}: {String(value)}</span>)}</div></div>)}</div>}</> : error ? <p role="alert" className="text-xs text-red-700">{error} <button onClick={retry}>Retry details</button></p> : <p role="status" className="text-xs text-slate-500">Loading product specifications…</p>}
      <button onClick={onRecords} className="flex items-center gap-1 self-start rounded-md border border-red-200 px-2.5 py-1.5 text-[11px] font-semibold text-red-700"><FileText size={12} />View Quotation, PO &amp; Document History</button>
      {row.latestQuotationReference && <p className="text-xs text-slate-500">Quotation: {row.latestQuotationReference} · {row.latestQuotationStatus || "Status unavailable"}</p>}
      {detail?.quotations?.length > 0 && <p className="font-syne text-sm font-bold text-slate-900">Latest quotation total: ₱{(detail.quotations[0] as { totalAmount?: string }).totalAmount ?? "Unavailable"}</p>}
      {row.purchaseOrderReference && <p className="text-xs text-slate-500">PO: {row.purchaseOrderReference} · Review and resubmission status unavailable from the Sales API</p>}
      <button disabled={!draft || !draft.products.length} onClick={() => setAction("quotation")} className="flex items-center justify-center gap-2 rounded-md bg-[#1A2B4A] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-40"><Calculator size={13} />{row.stageCode === "inquiry" ? "REVIEW & SEND QUOTATION" : "PREPARE QUOTATION REVISION"}<ArrowRight size={14} /></button>
      {row.stageCode === "po" && <><div className="flex gap-2"><button onClick={() => setAction("approve")} className="flex-1 rounded bg-green-600 py-2 text-xs font-bold text-white">APPROVE PO</button><button onClick={() => { setReason(""); setAction("reject"); }} className="flex-1 rounded border border-red-200 py-2 text-xs font-bold text-red-700">REJECT PO</button></div><button disabled={!draft?.products.length} onClick={() => setAction("invoice")} className="rounded border px-3 py-2 text-xs font-bold disabled:opacity-40">PREPARE INVOICE</button><button disabled={!draft?.products.length} onClick={() => setAction("jo")} className="rounded bg-[#C8102E] px-3 py-2 text-xs font-bold text-white disabled:opacity-40">CONFIGURE / GENERATE JOB ORDER</button><p className="text-[11px] text-slate-500">Readiness uses received and cleared PO, accepted quotation, sent invoices and their verified payments. Server validation is required to generate a JO.</p></>}
      {eligible && <button onClick={() => { setReason('');setRejectionError('');setAction('reject-inquiry'); }} className="text-xs text-red-700">Reject inquiry</button>}
      <button onClick={() => pendingIntegration("Cancellation review")} className="text-xs text-slate-500">Review cancellation</button>
        </>}
    </div>}
    {detail && action === "quotation" && <RealQuotationPreparation orderId={row.id} detail={detail} onClose={() => setAction(null)} onSaved={(savedStatus) => { setAction(null); retry(); toast.success(savedStatus === "sent" ? "Quotation sent and saved." : "Quotation draft saved."); }} />}
    {draft && action === "jo" && <GenerateJOModal inquiry={draft} onClose={() => setAction(null)} onConfirm={() => pendingIntegration("Job Order generation")} />}
    {draft && action === "invoice" && <SalesInvoicePreparation inquiry={draft} onClose={() => setAction(null)} />}
    {["approve", "reject", "reject-inquiry"].includes(action || "") && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><section role="dialog" aria-modal="true" aria-label="Sales review" className="w-full max-w-lg rounded-xl bg-white p-6"><h3 className="font-syne text-lg font-bold">{action === "approve" ? "Approve Purchase Order" : action === "reject" ? "Reject Purchase Order" : "Reject inquiry"}</h3><p className="my-3 text-sm">{action==='reject-inquiry'?'Reject and archive this inquiry, preserving its history. Pending cancellation requests will be completed. In-app notifications will be recorded.':'Backend integration pending. This review cannot be saved or sent. No client notification or resubmission request will be created.'}</p>{action==='reject-inquiry'&&rejectionError&&<p role="alert">{rejectionError}</p>}{action !== "approve" && <textarea disabled={rejecting} aria-label="Rejection reason" placeholder="Reason for rejection" value={reason} onChange={e => setReason(e.target.value)} className="w-full rounded border p-3" />}<div className="mt-4 flex justify-end gap-3"><button disabled={rejecting} onClick={() => {setAction(null);setReason('');setRejectionError('');}}>Cancel</button><button disabled={rejecting || (action !== 'approve' && !reason.trim()) || (action==='reject-inquiry'&&!eligible)} onClick={() => action==='reject-inquiry'?void submitRejection():pendingIntegration(action === 'approve' ? 'PO approval' : 'Rejection')} className="rounded bg-red-700 px-4 py-2 text-white disabled:opacity-40">{rejecting?'Rejecting…':'Confirm review'}</button></div></section></div>}
  </article>;
}
