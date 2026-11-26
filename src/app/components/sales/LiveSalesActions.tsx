import { useRef, useState } from "react";
import { ArrowRight, Calculator, FileText, CheckCircle2, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { Inquiry } from "../../store/orders";
import type { SalesOrderDetail } from "../useSalesOrders";
import { useSalesOrderDetail } from "../useSalesOrders";
import { useSalesOrderDocuments } from "../useSalesOrderDocuments";
import { getSalesOrder, mapSalesOrder, sumVerifiedPaymentAmounts } from "../../api/salesOrders.js";
import { generateSalesInvoice, getSalesPurchaseOrder, processSalesPurchaseOrder, reviewSalesQuotationRevision } from "../../api/salesOrderDocuments.js";
import { createSalesJobOrders } from "../../api/salesJobOrders.js";
import { RealQuotationPreparation } from "./RealQuotationPreparation";
import { ModalShell } from "./QuotationModalShell";
import { readyForJobOrder } from "./pipelineModel.mjs";
import { uncertainWrite } from "./cancellationModel.mjs";
import type { LiveInquiry, OriginalSalesAdapter } from "./useOriginalSalesAdapter";
import { PurchaseOrderSection, OrderDetail } from "./SalesDocumentSections";

const actionClass = "flex items-center justify-center gap-2 rounded-md px-3 py-2.5 font-dm text-xs font-bold disabled:opacity-40";
// Unknown outcomes survive closing a dialog. Reopening cannot repeat the write.
const unresolvedWrites = new Set<string>();

export function LiveSalesCardActions({ inquiry, adapter, onAction, onReject }: { inquiry: LiveInquiry; adapter: OriginalSalesAdapter; onAction: (action: string) => void; onReject: (reason: string) => void | Promise<void> }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [revisionBusy, setRevisionBusy] = useState(false);
  const revisionLock = useRef(false);
  const reviewRevision = async (requestId: string) => {
    if (revisionLock.current) return;
    revisionLock.current = true; setRevisionBusy(true);
    try {
      await reviewSalesQuotationRevision(inquiry.id, requestId, {decision:'approved'});
      adapter.refresh();
      toast.success('Revision request approved. Prepare and send the revised quotation.');
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Revision review failed.'); }
    finally { revisionLock.current = false; setRevisionBusy(false); }
  };
    const row = inquiry.salesRecord, detail = inquiry.salesDetail;
  const ready = readyForJobOrder(detail);

  const quotations = (detail?.quotations ?? []) as {
    id?: string;
    totalAmount?: string;
    status?: string;
    reference?: string;
    isCurrent?: boolean;
    isLatestRevision?: boolean;
  }[];

  const latestQuotation =
    quotations.find(quote => quote.isCurrent || quote.isLatestRevision)
    ?? quotations.at(-1);

  const invoice = detail?.invoices?.[0] as { reference?: string; amount?: string; requiredDownpayment?: string; sentAt?: string } | undefined;
  const error = adapter.details.errors[inquiry.id];

  const latestRevisionRequest = detail?.revisionRequests?.at(-1);

const approvedRevisionAwaitingQuote = Boolean(
  latestRevisionRequest?.status === "approved" &&
  Number(latestRevisionRequest.fulfilled ?? 0) !== 1
);

  const effectiveStageCode = detail?.stageCode ?? row.stageCode;
  const effectiveQuotationStatus =
    latestQuotation?.status ?? detail?.latestQuotationStatus ?? row.latestQuotationStatus;

  const canQuote = Boolean(
    detail?.items.length &&
    !row.archivedAt &&
    (
      effectiveStageCode === "inquiry" ||
      (effectiveStageCode === "quotation" &&
        approvedRevisionAwaitingQuote)
    ) &&
    latestQuotation?.status !== "accepted" &&
    !inquiry.pendingCancellation
  );
  return <div className="flex flex-col gap-3">
    {!detail && (error ? <p role="alert" className="text-xs text-red-700">Product details unavailable. {error} <button onClick={adapter.refresh} className="underline">Retry details</button></p> : <p role="status" className="text-xs text-slate-500">Loading product specifications…</p>)}
    <button onClick={() => onAction("history")} className={`${actionClass} self-start border border-red-200 text-red-700`}><FileText size={12} /> View Quotation, PO &amp; Document History</button>
    {row.latestQuotationReference && <p className="text-xs text-slate-600">Quotation: {row.latestQuotationReference} · {row.latestQuotationStatus || "Status unavailable"}</p>}
    {latestQuotation && <p className="font-syne text-sm font-bold text-slate-900">Quotation total: ₱{latestQuotation.totalAmount ?? "Unavailable"}</p>}
    {!!inquiry.revisionRequests?.length && <section className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"><b>Quotation Revision &amp; Document History</b>{inquiry.revisionRequests.map(request => <div key={request.id} className="mt-2"><b>{request.status === "pending" ? "Revision Requested" : "Processed"}</b> · {request.requestedAt || "Date unavailable"}<p className="mt-1 whitespace-pre-wrap">{request.note}</p></div>)}</section>}
    {detail?.revisionRequests?.map(request => <div key={request.id} className="text-xs text-slate-600"><p>{request.quotationReference || 'Quotation'} · Revision {request.revisionNumber} · {request.status}</p>{request.status === 'pending' && <button type="button" disabled={revisionBusy || adapter.busy} onClick={() => void reviewRevision(request.id)} className={`${actionClass} border border-amber-300 text-amber-950`}>Approve revision request</button>}</div>)}
    {!inquiry.pendingCancellation && effectiveStageCode === 'inquiry' && <button disabled={!canQuote} onClick={() => onAction("quotation")} className={`${actionClass} bg-[#1A2B4A] text-white`}><Calculator size={13} />REVIEW &amp; SEND QUOTATION<ArrowRight size={14} /></button>}
    {!inquiry.pendingCancellation && effectiveStageCode === 'quotation' && approvedRevisionAwaitingQuote && <button disabled={!canQuote} onClick={() => onAction("quotation")} className={`${actionClass} bg-[#1A2B4A] text-white`}><Calculator size={13} />PREPARE QUOTATION REVISION<ArrowRight size={14} /></button>}
    {effectiveStageCode === "quotation" &&
  ["sent", "accepted"].includes(effectiveQuotationStatus ?? "") && (
    <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-center text-xs font-bold text-amber-900">
      QUOTATION SENT · AWAITING PO SUBMISSION
    </p>
  )}
    {row.stageCode === "po" && !inquiry.pendingCancellation && <>
      <div className="flex gap-2"><button disabled={!detail} onClick={() => onAction("approve")} className={`${actionClass} flex-1 bg-green-600 text-white`}><CheckCircle2 size={13} /> APPROVE PO</button><button disabled={!detail} onClick={() => onAction("reject")} className={`${actionClass} flex-1 border border-red-200 text-red-700`}><X size={13} /> REJECT PO</button></div>
      <p className="text-xs text-slate-500">PO: {row.purchaseOrderReference || "Reference unavailable"}. Open the PO to review its current server status and submission history.</p>
      {invoice && <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs"><b>Invoice: {invoice.reference || "Reference unavailable"}</b><p>Amount: ₱{invoice.amount ?? "Unavailable"} · Required downpayment: ₱{invoice.requiredDownpayment ?? "Unavailable"}</p><p>Verified payments: ₱{sumVerifiedPaymentAmounts(detail?.payments ?? [])}</p></div>}
      <button disabled={!detail} onClick={() => onAction("invoice")} className={`${actionClass} border border-orange-200 text-orange-800`}>{invoice ? "VIEW INVOICE" : "GENERATE INVOICE"}</button>
      {ready && <div className="rounded-md border border-green-300 bg-green-50 p-3 text-xs font-bold text-green-800">PAYMENT VERIFIED · READY FOR JOB ORDER</div>}
      <button disabled={!ready} onClick={() => onAction("jo")} className={`${actionClass} bg-[#C8102E] text-white`}>CONFIGURE / GENERATE JOB ORDER</button>
      {!ready && <p className="text-xs text-slate-500">A received and cleared PO, accepted quotation, sent invoice and verified payment assigned to that invoice are required. Server validation also applies.</p>}
    </>}
    {row.stageCode === "inquiry" && !row.archivedAt && <div className="border-t border-slate-100 pt-2">
      {!rejecting ? <button disabled={!detail?.revision || adapter.busy} onClick={() => setRejecting(true)} className={`${actionClass} w-full border-2 border-red-200 text-red-700`}><AlertTriangle size={12} /> REJECT INQUIRY</button> : <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3"><label className="text-xs font-bold text-red-900">Reason for rejection (required)<textarea aria-label="Rejection reason" disabled={adapter.busy} value={reason} onChange={event => setReason(event.target.value)} className="mt-2 w-full rounded border border-red-200 bg-white p-2 text-xs" /></label><div className="flex justify-end gap-2"><button disabled={adapter.busy} onClick={() => setRejecting(false)} className="text-xs">Cancel</button><button disabled={adapter.busy || !reason.trim()} onClick={() => void onReject(reason)} className={`${actionClass} bg-red-700 text-white`}>Reject &amp; Notify Client</button></div></div>}
    </div>}
  </div>;
}

export function LiveSalesModal({ inquiry, action, onClose, onSaved, renderJO }: { inquiry: LiveInquiry; action: string; onClose: () => void; onSaved: () => void; renderJO: (inquiry: Inquiry, footer: React.ReactNode) => React.ReactNode }) {
  const remote = useSalesOrderDetail(true, inquiry.id);
  const documents = useSalesOrderDocuments(Boolean(remote.data) && !remote.loading && !remote.error, inquiry.id);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");
  const [dueDate, setDueDate] = useState("");
  const writeKey = `${inquiry.id}:${action}`;
  const [uncertain, setUncertain] = useState(unresolvedWrites.has(writeKey));
  const lock = useRef(false);
  const close = () => { if (!lock.current) onClose(); };
  const detail = remote.data;
  const write = async (operation: (latest: SalesOrderDetail) => Promise<unknown>) => {
    if (lock.current || uncertain) return;
    lock.current = true; setSaving(true); setError("");
    try {
      const latest = mapSalesOrder(await getSalesOrder(inquiry.id)) as SalesOrderDetail;
      if (latest.archivedAt || latest.requests.some((request: any) => request.kind === "cancellation" && request.status === "pending")) throw new Error("This order is archived or has a pending cancellation. Review its latest state.");
      await operation(latest);
      onSaved(); onClose();
    } catch (cause) {
      if (uncertainWrite(cause)) { unresolvedWrites.add(writeKey); setUncertain(true); }
      setError(cause instanceof Error ? cause.message : "The action could not be confirmed.");
    } finally { lock.current = false; setSaving(false); }
  };
  const checkOutcome = async () => {
    if (lock.current) return;
    lock.current = true; setSaving(true);
    try {
      const latest = await getSalesOrder(inquiry.id) as SalesOrderDetail;
      const po = ["approve", "reject"].includes(action) ? await getSalesPurchaseOrder(inquiry.id) : null;
      const confirmed = action === "invoice" ? latest.invoices.length > 0 : action === "jo" ? latest.jobOrders.length > 0 : po?.status === (action === "reject" ? "rejected" : "validated");
      if (confirmed) { unresolvedWrites.delete(writeKey); onSaved(); onClose(); }
      else setError("No completed result has been confirmed. Submission remains disabled because the original request may still be completing. Check again before proceeding.");
    } catch { setError("The latest state could not be confirmed. Submission remains disabled."); }
    finally { lock.current = false; setSaving(false); }
  };
  const feedback = <>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}{uncertain && <div role="alert" className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">The previous write could not be confirmed. Further submission is disabled.<button disabled={saving} onClick={() => void checkOutcome()} className="ml-3 underline">Check latest document state</button></div>}</>;
  if (remote.loading || remote.error || !detail) return <ModalShell title={action === "jo" ? "Generate Job Order" : "Sales order review"} subtitle={inquiry.code} onClose={close} size="lg">{remote.error ? <p role="alert">{remote.error} <button onClick={remote.retry}>Retry</button></p> : <p role="status">Loading current order details…</p>}</ModalShell>;
  if (action === "quotation") return <RealQuotationPreparation orderId={inquiry.id} detail={detail} onClose={close} onSaved={status => { onSaved(); onClose(); toast.success(status === "sent" ? "Quotation sent and saved." : "Quotation draft saved."); }} />;
  if (action === "history") return <OrderDetail detail={detail} loading={remote.loading} error={remote.error} retry={remote.retry} onClose={close} readOnly />;
  const purchaseOrder = documents.purchaseOrder;
  const poReady = !documents.purchaseOrderLoading && !documents.purchaseOrderError && purchaseOrder?.status === "validated";
  const invoice = detail.invoices[0] as { reference?: string; amount?: string; requiredDownpayment?: string; issuedOn?: string; sentAt?: string; dueOn?: string } | undefined;
  if (action === "jo") return <>{renderJO(inquiry, <div className="mt-5 border-t border-slate-200 pt-4"><p className="text-sm text-slate-600">Generate from recorded specifications and accepted quotation quantities. Creation does not reserve or deduct stock, or start production.</p><label className="mt-3 block text-xs font-bold">Production due date<input type="date" aria-label="Production due date" value={dueDate} disabled={saving || uncertain} onChange={event => setDueDate(event.target.value)} className="mt-2 block rounded border border-slate-300 p-2" /></label><button disabled={saving || uncertain || !readyForJobOrder(detail) || !dueDate} onClick={() => void write(async latest => {
    if (!readyForJobOrder(latest)) throw new Error("Job Order prerequisites are no longer satisfied. Refresh the order before continuing.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new Error("Select a valid production due date.");
    return createSalesJobOrders(inquiry.id, { productionDueDate: dueDate });
  })} className={`${actionClass} mt-4 bg-[#C8102E] text-white`}>{saving ? "Creating…" : "CONFIRM & GENERATE JO"}</button>{feedback}</div>)}</>;
  if (action === "invoice") return <ModalShell title={`Invoice · ${detail.reference}`} subtitle={detail.companyName} onClose={close} size="lg">
    <div className="rounded-lg border border-slate-200 p-5"><h3 className="font-syne text-lg font-bold">{invoice?.reference || "Review invoice issuance"}</h3>{invoice ? <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><dt>Amount</dt><dd>₱{invoice.amount ?? "Unavailable"}</dd><dt>Required downpayment</dt><dd>₱{invoice.requiredDownpayment ?? "Unavailable"}</dd><dt>Issued</dt><dd>{invoice.issuedOn || "Unavailable"}</dd><dt>Sent</dt><dd>{invoice.sentAt || "Not recorded"}</dd><dt>Due date</dt><dd>{invoice.dueOn || "Unavailable"}</dd></dl> : <><p className="mt-3 text-sm">A validated purchase order and its accepted quotation are required. Issuance does not record payment; Accounting must verify payment proof.</p><button disabled={!poReady || saving || uncertain} onClick={() => void write(async latest => {
      if (latest.invoices.length) throw new Error("An invoice already exists. Close and review the latest history.");
      return generateSalesInvoice(inquiry.id);
    })} className={`${actionClass} mt-4 bg-[#1A2B4A] text-white`}>{saving ? "Issuing…" : "GENERATE INVOICE"}</button></>}<p className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm">Invoice line allocation, original invoice document preview and separate invoice sending are unavailable from the Sales API.</p></div>{documents.purchaseOrderError && <p role="alert">{documents.purchaseOrderError} <button onClick={documents.refresh}>Retry PO</button></p>}{feedback}
  </ModalShell>;
  return <ModalShell title={`${action === "reject" ? "Reject" : "Approve"} Purchase Order · ${detail.reference}`} subtitle={detail.companyName} onClose={close} size="lg">
    <PurchaseOrderSection purchaseOrder={purchaseOrder} loading={documents.purchaseOrderLoading} error={documents.purchaseOrderError} retry={documents.refresh} client={{clientName:detail.companyName,contactPerson:detail.contactPerson || "Unavailable"}} processPurchaseOrder={async () => {}} actionLoading={false} actionError="" readOnly />
    {action === "reject" && <label className="mt-4 block text-xs font-bold">Rejection reason (required)<textarea aria-label="PO rejection reason" disabled={saving || uncertain} value={reason} onChange={event => setReason(event.target.value)} className="mt-2 w-full rounded border border-slate-300 p-3 text-sm" /></label>}
    <p className="mt-4 text-xs text-slate-500">No inventory or Job Order is created by this action.</p>
    <button disabled={saving || uncertain || documents.purchaseOrderLoading || Boolean(documents.purchaseOrderError) || !purchaseOrder || !["pending", "received"].includes(purchaseOrder.status || "") || (action === "reject" && !reason.trim())} onClick={() => void write(() => processSalesPurchaseOrder(inquiry.id, { decision: action === "reject" ? "rejected" : "validated", ...(action === "reject" ? { reason: reason.trim() } : {}) }))} className={`${actionClass} mt-4 bg-[#C8102E] text-white`}>{saving ? "Saving…" : action === "reject" ? "REJECT PO" : "APPROVE PO"}</button>{feedback}
  </ModalShell>;
}
