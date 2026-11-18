import { useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { createSalesQuotation } from "../../api/salesOrders.js";
import { useSalesStockAvailability, type SalesOrderDetail, type SalesStockAssessment } from "../useSalesOrders";
import { CostEstimationPanel } from "../CostEstimationPanel";
import { QuotationBuilder } from "../QuotationBuilder";
import type { CostConfig } from "../../store/materials";
import type { QuotationDoc } from "../../store/orders";
import { ModalShell } from "./QuotationModalShell";
import { InquiryDetailsTab } from "./OriginalSalesForms";
import { inquiryDraft } from "./drafts";

type QuotationResult = { totalAmount: string; rawMaterialCost: string; laborCost: string; markupAmount: string; downpaymentPercent: number; downpaymentAmount: string; status: "draft" | "sent"; reference: string; revisionNumber: number };
type Props = { orderId: string; detail: SalesOrderDetail; onClose: () => void; onSaved: (status: "draft" | "sent", result: QuotationResult) => void };
function availabilityTone(status: SalesStockAssessment["status"]) { return status === "available" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : status === "insufficient" ? "border-amber-200 bg-amber-50 text-amber-950" : "border-slate-200 bg-slate-50 text-slate-700"; }
function availabilityLabel(status: SalesStockAssessment["status"]) { return status === "available" ? "Available" : status === "insufficient" ? "Insufficient stock" : "Unavailable"; }
function SectionTitle({ title, detail }: { title: string; detail?: string }) { return <div className="flex items-baseline justify-between gap-3"><h3 className="font-dm text-xs font-bold uppercase tracking-wide text-[#1A2B4A]">{title}</h3><span className="font-dm text-xs text-slate-400">{detail}</span></div>; }

export function RealQuotationPreparation({ orderId, detail, onClose, onSaved }: Props) {
  const [activeTab, setActiveTab] = useState<"inquiry" | "cost" | "quote">("inquiry");
  const [costs, setCosts] = useState<Record<number, CostConfig>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const stock = useSalesStockAvailability(true, orderId);
  const inquiry = useMemo(() => ({ ...inquiryDraft(detail), productsCostConfig: detail.items.map((_, index) => costs[index] ?? null) }), [detail, costs]);
  const prepare = async (status: "draft" | "sent", doc: QuotationDoc) => {
    if (lock.current) return;
    setError("");
    if (detail.items.some((_, index) => !costs[index])) { setError("Apply cost inputs for every product in Cost & Material Estimation."); return; }
    if (!doc.placeOfDelivery.trim()) { setError("Place of delivery is required."); return; }
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
        status, issuedOn: new Date().toISOString().slice(0, 10), validUntil: `${validity.getFullYear()}-${String(validity.getMonth()+1).padStart(2,"0")}-${String(validity.getDate()).padStart(2,"0")}`,
        paymentTermCode: detail.paymentTermCode, timeOfDelivery: doc.timeOfDelivery, placeOfDelivery: doc.placeOfDelivery,
        note: doc.note || undefined, noteHighlighted: doc.noteHighlighted, downpaymentPercent: doc.downpaymentPercent,
        vatType: config.vatType, vatRate: config.vatRate, includeLabor: config.includeLabor, applyMarkup: config.applyMarkup,
        applyVat: config.applyVAT, discountPercent: config.discountPct ?? 0,
        costing: detail.items.map((item,index) => ({orderItemId: item.id, laborCost: costs[index].laborCost, markupPercent: costs[index].markupPct}))
      });
      onSaved(status, result as QuotationResult);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Quotation could not be saved."); }
    finally { lock.current = false; setSaving(false); }
  };
  return <ModalShell title={`Review & Send Quotation · ${detail.reference}`} subtitle={`${detail.companyName} · ${detail.contactPerson || "Contact unavailable"} · ${detail.paymentTermLabel || detail.paymentTermCode}`} onClose={() => { if (!saving) onClose(); }} size="lg">
    <div className="flex gap-1 border-b border-slate-200 mb-5 -mt-2" role="tablist" aria-label="Quotation preparation">
      {([{id:"inquiry",label:"1 · Inquiry Details"},{id:"cost",label:"2 · Cost & Material Estimation"},{id:"quote",label:"3 · Quotation"}] as const).map(tab => <button type="button" key={tab.id} role="tab" aria-selected={activeTab===tab.id} onClick={() => setActiveTab(tab.id)} className="px-4 py-2.5 font-dm transition-colors" style={{fontSize:13,fontWeight:600,color:activeTab===tab.id?"#C8102E":"#64748B",borderBottom:activeTab===tab.id?"3px solid #C8102E":"3px solid transparent",marginBottom:-1}}>{tab.label}</button>)}
    </div>
    {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div hidden={activeTab!=="inquiry"}><InquiryDetailsTab inquiry={inquiry} isNew={false} onStart={() => setActiveTab("cost")} />
        <section className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><SectionTitle title="Stock availability" detail="Read-only check" /><button type="button" onClick={stock.refresh} disabled={stock.loading} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 font-dm text-xs font-bold text-[#1A2B4A] hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={12} className={stock.loading ? "animate-spin" : ""} /> Refresh</button></div>{stock.loading && <p role="status" className="mt-4 rounded-md bg-slate-50 p-3 font-dm text-xs text-slate-500">Checking recorded inventory…</p>}{stock.error && <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 font-dm text-xs text-red-800">{stock.error}</p>}{stock.data && !stock.error && <div className="mt-4"><div className={`rounded-md border p-3 ${stock.data.overallStatus === "available" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : stock.data.overallStatus === "insufficient" || stock.data.overallStatus === "partially_available" ? "border-amber-200 bg-amber-50 text-amber-950" : "border-slate-200 bg-slate-50 text-slate-700"}`}><p className="font-dm text-sm font-bold">{stock.data.overallStatus === "available" ? "Available for the requested products" : stock.data.overallStatus === "insufficient" || stock.data.overallStatus === "partially_available" ? "Some required stock is insufficient" : "Availability cannot be fully confirmed"}</p><p className="mt-1 font-dm text-[11px] opacity-80">Informational only · no stock is reserved or deducted.</p></div><div className="mt-3 space-y-2">{stock.data.assessments.map(assessment => <div key={`${assessment.itemId}-${assessment.specificationId}`} className={`flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 ${availabilityTone(assessment.status)}`}><div><p className="font-dm text-xs font-bold">{assessment.description}</p><p className="mt-1 font-dm text-[11px] opacity-80">Required {assessment.requiredQuantity} {assessment.unit || "units"} · {assessment.inventoryState === "recorded" ? `Recorded ${assessment.availableQuantity ?? 0}` : "Quantity unavailable"}</p></div><span className="font-dm text-[11px] font-bold">{availabilityLabel(assessment.status)}</span></div>)}</div>{stock.data.unmappedItems.length > 0 && <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 font-dm text-xs text-amber-950"><p className="font-bold">Unmapped requirements</p><p className="mt-1">{stock.data.unmappedItems.length} product requirement{stock.data.unmappedItems.length === 1 ? "" : "s"} could not be matched to inventory. This does not mean stock is available.</p></div>}<p className="mt-3 font-dm text-[10px] text-slate-400">Checked {new Date(stock.data.checkedAt).toLocaleString()}</p></div>}</section>
    </div>
    <div hidden={activeTab!=="cost"}><CostEstimationPanel inquiry={inquiry} qty={detail.items.reduce((sum,item)=>sum+item.quantity,0)} serverCosting onApply={data => { setCosts(current => ({...current,[data.productIndex]:data.costConfig})); setActiveTab("quote"); }} /></div>
    <div hidden={activeTab!=="quote"}><QuotationBuilder inquiry={inquiry} manufacturingUnitCost={Number.NaN} vatType={costs[0]?.vatType ?? "Exclusive"} onSendToClient={() => {}} serverPreparation={{busy:saving,onPrepare:(status,doc) => void prepare(status,doc)}} /></div>
  </ModalShell>;
}
