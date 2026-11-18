import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { createSalesQuotation } from "../../api/salesOrders.js";
import { ApiError } from "../../api/client";
import { useSalesStockAvailability, type SalesOrderDetail, type SalesStockAssessment } from "../useSalesOrders";
import { CostEstimationPanel } from "../CostEstimationPanel";
import { QuotationBuilder } from "../QuotationBuilder";
import type { CostConfig } from "../../store/materials";
import type { QuotationDoc } from "../../store/orders";
import { ModalShell } from "./QuotationModalShell";
import { InquiryDetailsTab } from "./OriginalSalesForms";
import { inquiryDraft } from "./drafts";
import { listSalesQuotations } from "../../api/salesOrderDocuments.js";
import type { SalesQuotation } from "../useSalesOrderDocuments";
import { restoreQuotationInputs } from "./quotationDraft.js";
import { uncertainWrite } from './cancellationModel.mjs';

type QuotationResult = { totalAmount: string; rawMaterialCost: string; laborCost: string; markupAmount: string; downpaymentPercent: number; downpaymentAmount: string; status: "draft" | "sent"; reference: string; revisionNumber: number };
type Props = { orderId: string; detail: SalesOrderDetail; onClose: () => void; onSaved: (status: "draft" | "sent", result: QuotationResult) => void };
function availabilityTone(status: SalesStockAssessment["status"]) { return status === "available" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : status === "insufficient" ? "border-amber-200 bg-amber-50 text-amber-950" : "border-slate-200 bg-slate-50 text-slate-700"; }
function availabilityLabel(status: SalesStockAssessment["status"]) { return status === "available" ? "Available" : status === "insufficient" ? "Insufficient stock" : "Unavailable"; }
function SectionTitle({ title, detail }: { title: string; detail?: string }) { return <div className="flex items-baseline justify-between gap-3"><h3 className="font-dm text-xs font-bold uppercase tracking-wide text-[#1A2B4A]">{title}</h3><span className="font-dm text-xs text-slate-400">{detail}</span></div>; }
function quotationFailureMessage(cause: unknown, detail: SalesOrderDetail): string {
  if (cause instanceof ApiError && cause.code === "MATERIAL_COSTING_INCOMPLETE") {
    const products = detail.items
      .filter(item => cause.errors?.[item.id])
      .map(item => item.filterName || "an inquiry product");
    const affected = products.length ? ` for ${Array.from(new Set(products)).join(", ")}` : "";
    return `Approved BOM/material data are incomplete${affected}. Verify approved material requirements, quantities, waste, and active prices before saving.`;
  }
  return cause instanceof Error ? cause.message : "Quotation could not be saved.";
}

export function RealQuotationPreparation({ orderId, detail, onClose, onSaved }: Props) {
  const [history, setHistory] = useState<SalesQuotation[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoadError("");
    listSalesQuotations(orderId, controller.signal).then(rows => {
      if (!controller.signal.aborted) setHistory(rows as SalesQuotation[]);
    }).catch(cause => {
      if (!controller.signal.aborted) setLoadError(cause instanceof Error ? cause.message : "Unable to load saved quotations.");
    });
    return () => controller.abort();
  }, [orderId, attempt]);
  if (!history) return <ModalShell title={`Review & Send Quotation · ${detail.reference}`} onClose={onClose} size="lg">
    {loadError ? <><p role="alert">{loadError}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Retry quotation history</button></> : <p role="status">Loading saved quotation inputs…</p>}
  </ModalShell>;
  return <QuotationPreparationForm key={orderId} orderId={orderId} detail={detail} onClose={onClose} onSaved={onSaved} history={history} />;
}

function QuotationPreparationForm({ orderId, detail, onClose, onSaved, history }: Props & { history: SalesQuotation[] }) {
  const restored = useMemo(() => restoreQuotationInputs(history, detail.items), [history, detail.items]);
  const [activeTab, setActiveTab] = useState<"inquiry" | "cost" | "quote">("inquiry");
  const [costs, setCosts] = useState<Record<number, CostConfig>>(restored.costs);
  const [dirtyProducts, setDirtyProducts] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [checkingOutcome, setCheckingOutcome] = useState(false);
  const lock = useRef(false);
  const stock = useSalesStockAvailability(true, orderId);
  const inquiry = useMemo(() => ({ ...inquiryDraft(detail), quotationDoc: restored.document as QuotationDoc | undefined, productsCostConfig: detail.items.map((_, index) => costs[index] ?? null) }), [detail, costs, restored]);
  const prepare = async (status: "draft" | "sent", doc: QuotationDoc) => {
    if (lock.current || uncertain) return;
    setError("");
    if (restored.latest?.addons?.length) { setError("This quotation has saved additional charges. Revising those charges is not yet supported; this quotation cannot be saved without preserving them."); return; }
    if (dirtyProducts.size) { setError("Apply your changed cost inputs for every edited product before saving or sending."); return; }
    if (detail.items.some((_, index) => !costs[index])) { setError("Apply cost inputs for every product in Cost & Material Estimation."); return; }
    if (!doc.placeOfDelivery.trim()) { setError("Place of delivery is required."); return; }
    if (!doc.timeOfDelivery.trim()) { setError("Time of delivery is required."); return; }
    if (![20, 50].includes(doc.downpaymentPercent ?? 0)) { setError("Select the required 20% or 50% downpayment."); return; }
    const validity = new Date(doc.validUntil);
    if (!Number.isFinite(validity.getTime())) { setError("Enter a valid quotation validity date."); return; }
    const configs = detail.items.map((_, index) => costs[index]);
    if (configs.some(config => !Number.isFinite(config.laborCost) || config.laborCost < 0 || !Number.isFinite(config.markupPct) || config.markupPct < 0)) { setError("Enter non-negative labor cost and markup."); return; }
    const config = configs[0];
    if (configs.some(row => row.vatType !== config.vatType || row.vatRate !== config.vatRate || row.includeLabor !== config.includeLabor || row.applyMarkup !== config.applyMarkup || row.applyVAT !== config.applyVAT || (row.discountPct ?? 0) !== (config.discountPct ?? 0))) { setError("Use the same VAT, discount and costing switches for every product. Labor and markup may differ per product."); return; }
    lock.current = true; setSaving(true);
    try {
      const result = await createSalesQuotation(orderId, {
        status, baseQuotationId: restored.latest?.id ?? null, issuedOn: new Date().toISOString().slice(0, 10), validUntil: /^\d{4}-\d{2}-\d{2}$/.test(doc.validUntil) ? doc.validUntil : `${validity.getFullYear()}-${String(validity.getMonth()+1).padStart(2,"0")}-${String(validity.getDate()).padStart(2,"0")}`,
        paymentTermCode: doc.termsOfPayment === "15-Day Terms" ? "NET15" : "NET30", timeOfDelivery: doc.timeOfDelivery, placeOfDelivery: doc.placeOfDelivery,
        note: doc.note || undefined, noteHighlighted: doc.noteHighlighted, downpaymentPercent: doc.downpaymentPercent,
        vatType: config.vatType, vatRate: config.vatRate, includeLabor: config.includeLabor, applyMarkup: config.applyMarkup,
        applyVat: config.applyVAT, discountPercent: config.discountPct ?? 0,
        costing: detail.items.map((item,index) => ({orderItemId: item.id, laborCost: costs[index].laborCost, markupPercent: costs[index].markupPct}))
      });
      onSaved(status, result as QuotationResult);
    } catch (cause) {
      if (uncertainWrite(cause)) setUncertain(true);
      setError(quotationFailureMessage(cause, detail));
    }
    finally { lock.current = false; setSaving(false); }
  };
  const checkOutcome = async () => {
    if (lock.current) return;
    lock.current = true; setCheckingOutcome(true);
    try {
      const latest = await listSalesQuotations(orderId) as SalesQuotation[];
      const current = restoreQuotationInputs(latest, detail.items).latest;
      setError(current?.id !== restored.latest?.id
        ? 'A different quotation revision is recorded. Keep a copy of your edits, then close and reopen this inquiry to review the saved revision before making changes.'
        : 'No newer quotation revision is confirmed yet. Your edits are retained. Check again before retrying; the original request may still be completing.');
    } catch { setError('Quotation history could not be checked. Your edits are retained; do not resubmit until the outcome is confirmed.'); }
    finally { lock.current = false; setCheckingOutcome(false); }
  };
  return <ModalShell title={`Review & Send Quotation · ${detail.reference}`} subtitle={`${detail.companyName} · ${detail.contactPerson || "Contact unavailable"} · ${detail.paymentTermLabel || detail.paymentTermCode}`} onClose={() => { if (!saving && !checkingOutcome) onClose(); }} size="lg">
    {uncertain && <section role="alert" className="mb-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
      <p>The save/send outcome is uncertain. Your edits are retained. Check saved quotation history before starting another submission.</p>
      <button type="button" disabled={checkingOutcome} onClick={() => void checkOutcome()}>{checkingOutcome ? 'Checking…' : 'Check saved quotation state'}</button>
      {error && <p>{error}</p>}
    </section>}
    <fieldset disabled={saving || uncertain} className="min-w-0">
    {restored.latest && <p className="mb-3 text-xs text-slate-600">Starting from {restored.latest.reference}, revision {restored.latest.revisionNumber}. Saving creates a new revision; prices are recalculated from current records.</p>}
    <div className="flex gap-1 border-b border-slate-200 mb-5 -mt-2" role="tablist" aria-label="Quotation preparation">
      {([{id:"inquiry",label:"1 · Inquiry Details"},{id:"cost",label:"2 · Cost & Material Estimation"},{id:"quote",label:"3 · Quotation"}] as const).map(tab => <button type="button" key={tab.id} role="tab" aria-selected={activeTab===tab.id} onClick={() => setActiveTab(tab.id)} className="px-4 py-2.5 font-dm transition-colors" style={{fontSize:13,fontWeight:600,color:activeTab===tab.id?"#C8102E":"#64748B",borderBottom:activeTab===tab.id?"3px solid #C8102E":"3px solid transparent",marginBottom:-1}}>{tab.label}</button>)}
    </div>
    {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div hidden={activeTab!=="inquiry"}><InquiryDetailsTab inquiry={inquiry} isNew={false} onStart={() => setActiveTab("cost")} />
        <section className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><SectionTitle title="Stock availability" detail="Read-only check" /><button type="button" onClick={stock.refresh} disabled={stock.loading} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 font-dm text-xs font-bold text-[#1A2B4A] hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={12} className={stock.loading ? "animate-spin" : ""} /> Refresh</button></div>{stock.loading && <p role="status" className="mt-4 rounded-md bg-slate-50 p-3 font-dm text-xs text-slate-500">Checking recorded inventory…</p>}{stock.error && <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 font-dm text-xs text-red-800">{stock.error}</p>}{stock.data && !stock.error && <div className="mt-4"><div className={`rounded-md border p-3 ${stock.data.overallStatus === "available" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : stock.data.overallStatus === "insufficient" || stock.data.overallStatus === "partially_available" ? "border-amber-200 bg-amber-50 text-amber-950" : "border-slate-200 bg-slate-50 text-slate-700"}`}><p className="font-dm text-sm font-bold">{stock.data.overallStatus === "available" ? "Available for the requested products" : stock.data.overallStatus === "insufficient" || stock.data.overallStatus === "partially_available" ? "Some required stock is insufficient" : "Availability cannot be fully confirmed"}</p><p className="mt-1 font-dm text-[11px] opacity-80">Informational only · no stock is reserved or deducted.</p></div><div className="mt-3 space-y-2">{stock.data.assessments.map(assessment => <div key={`${assessment.itemId}-${assessment.specificationId}`} className={`flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 ${availabilityTone(assessment.status)}`}><div><p className="font-dm text-xs font-bold">{assessment.description}</p><p className="mt-1 font-dm text-[11px] opacity-80">Required {assessment.requiredQuantity} {assessment.unit || "units"} · {assessment.inventoryState === "recorded" ? `Recorded ${assessment.availableQuantity ?? 0}` : "Quantity unavailable"}</p></div><span className="font-dm text-[11px] font-bold">{availabilityLabel(assessment.status)}</span></div>)}</div>{stock.data.unmappedItems.length > 0 && <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 font-dm text-xs text-amber-950"><p className="font-bold">Unmapped requirements</p><p className="mt-1">{stock.data.unmappedItems.length} product requirement{stock.data.unmappedItems.length === 1 ? "" : "s"} could not be matched to inventory. This does not mean stock is available.</p></div>}<p className="mt-3 font-dm text-[10px] text-slate-400">Checked {new Date(stock.data.checkedAt).toLocaleString()}</p></div>}</section>
    </div>
    <div hidden={activeTab!=="cost"}>
      {restored.latest?.costing?.some((row: any) => row.bomLines?.length) && <section aria-label="Saved material breakdown" className="mb-4 rounded-lg border border-slate-200 p-4"><h3 className="text-sm font-bold">Saved material breakdown · Revision {restored.latest.revisionNumber}</h3><p className="mt-1 text-xs text-slate-500">Historical prices and quantities. A new save recalculates from the current approved BOM and inventory prices.</p>{restored.latest.costing.map((row: any) => <div key={row.id ?? row.orderItemId} className="mt-3 text-xs"><b>{detail.items.find(item=>item.id===row.orderItemId)?.filterName || "Product"}</b>{row.bomLines?.map((line: any)=><p key={line.lineNumber}>{line.materialName} · {line.quantityPerFilter} {line.unit} per product · Unit price ₱{line.unitPrice} · Waste {line.wastePercent}%</p>)}</div>)}</section>}
      <CostEstimationPanel inquiry={inquiry} qty={detail.items.reduce((sum,item)=>sum+item.quantity,0)} serverCosting onDraftChange={index => setDirtyProducts(current => new Set(current).add(index))} onApply={data => { setCosts(current => ({...current,[data.productIndex]:data.costConfig})); setDirtyProducts(current => { const next = new Set(current); next.delete(data.productIndex); return next; }); setActiveTab("quote"); }} /></div>
    <div hidden={activeTab!=="quote"}><QuotationBuilder inquiry={inquiry} manufacturingUnitCost={Number.NaN} vatType={costs[0]?.vatType ?? "Exclusive"} onSendToClient={() => {}} serverPreparation={{busy:saving,onPrepare:(status,doc) => void prepare(status,doc)}} /></div>
    </fieldset>
  </ModalShell>;
}
