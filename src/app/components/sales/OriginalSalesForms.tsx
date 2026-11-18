import { Fragment, useEffect, useState } from "react";
import { ArrowRight, FileText, X, Calculator, ChevronDown, ChevronUp, Info, Upload, Paperclip, Trash2, Factory, CheckCircle2, Maximize2, RotateCcw, AlertTriangle, Eye } from "lucide-react";
import { toast } from "sonner";
import { unitPrice, quotationTotal, paymentState, verifiedPayments, resolveProductBOM, poNumberForDisplay, poReviewStatus, type Inquiry, type ProductLine, type Quotation, type QuotationLine, type FinalizeJOData, type JOSpecs, type QuotationDoc } from "../../store/orders";
import { calculateProductionDeadline, DELIVERY_TRANSIT_ESTIMATE_NOTICE, formatDeliveryTransitEstimate, getDeliveryTransitEstimate } from "../../store/productionDeadline";
import { useMaterials, type Material, type BOMLine, type CostConfig } from "../../store/materials";
import { CostEstimationPanel } from "./CostEstimationPanel";
import { QuotationBuilder } from "./QuotationBuilder";
import { quotationVatLabel, QuotationPreviewModal } from "./QuotationPreviewModal";
import { FILTER_TYPES as FILTER_TYPES_CATALOG, DIMENSION_LABELS as DIMENSION_LABELS_CATALOG, GROUP_TEMPLATES, groupForType } from "../../store/filterTemplates";
import { pendingIntegration } from "./drafts";
const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;
interface OtherMat { id: string; name: string }
interface MatPlan {
  mediaSource: "Local" | "Imported";
  mediaRolls: number;
  adhesiveSets: number;
  boxPcs: number;
  others: OtherMat[];
}
const blankPlan = (qty: number): MatPlan => ({
  mediaSource: "Local",
  mediaRolls: 0,
  adhesiveSets: 0,
  boxPcs: qty,
  others: [],
});

export function ReviewQuotationModal({ inquiry, onClose, onSubmit }: { inquiry: Inquiry; onClose: () => void; onSubmit: (q: Quotation, bomData?: { bom: BOMLine[]; costConfig: CostConfig; unitPrice: number; total: number; productIndex?: number }, quotationDoc?: QuotationDoc) => void }) {
  const isNewClient = (_name: string) => false;
  const [leadDays, setLeadDays] = useState(inquiry.quotation?.leadTimeDays ?? 14);
  /* Section H — default to inquiry tab for ALL clients, not just new ones */
  const [activeTab, setActiveTab] = useState<"inquiry" | "cost" | "quote">("inquiry");
  /* Per-product BOM data — one slot per product, null until that product's Tab 2 is applied */
  const [perProductBomData, setPerProductBomData] = useState<Array<{ bom: BOMLine[]; costConfig: CostConfig; unitPrice: number; total: number; productIndex?: number } | null>>(
    inquiry.products.map(() => null)
  );
  const [lines, setLines] = useState<QuotationLine[]>(
    inquiry.products.map((p) => {
      const existing = inquiry.quotation?.lines.find((l) => l.productId === p.id);
      return existing ?? { productId: p.id, materialCost: 0, labor: 0, markupPct: 30 };
    })
  );
  const [plans, setPlans] = useState<MatPlan[]>(inquiry.products.map((p) => blankPlan(p.qty)));

  const updateLine = (idx: number, patch: Partial<QuotationLine>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };
  const updatePlan = (idx: number, patch: Partial<MatPlan>) => {
    setPlans((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const total = lines.reduce((sum, l) => {
    const p = inquiry.products.find((pp) => pp.id === l.productId);
    return sum + (p ? unitPrice(l) * p.qty : 0);
  }, 0);

  /* Derive a single bomData reference for legacy callers — use the last non-null product entry */
  const bomData = perProductBomData.reduce<typeof perProductBomData[0]>((acc, d) => d ?? acc, null);
  const discounts = inquiry.products.flatMap((product, index) => {
    const percent = perProductBomData[index]?.costConfig.discountPct
      ?? inquiry.productsCostConfig?.[index]?.discountPct
      ?? (index === 0 ? inquiry.costConfig?.discountPct : undefined)
      ?? 0;
    return percent > 0
      ? [{ label: inquiry.products.length === 1 ? "Discount" : (product.filterName || product.type), percent }]
      : [];
  });

  const submit = () => {
    onSubmit(
      {
        sentDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        leadTimeDays: leadDays,
        lines,
      },
      bomData ?? undefined
    );
  };

  return (
    <ModalShell title={`Review & Send Quotation · ${inquiry.code}`} subtitle={`${inquiry.clientName} · ${inquiry.contactPerson} · ${inquiry.paymentTerms}`} onClose={onClose} size="lg">
      <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Unsaved draft · Backend integration pending. Sending will not create a quotation or notify the client.</p>
      <div className="flex gap-1 border-b border-slate-200 mb-5 -mt-2">
        {[
          { id: "inquiry" as const, label: "1 · Inquiry Details" },
          { id: "cost" as const,    label: "2 · Cost & Material Estimation" },
          { id: "quote" as const,   label: "3 · Quotation" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="px-4 py-2.5 font-dm transition-colors"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: activeTab === t.id ? "#C8102E" : "#64748B",
              borderBottom: activeTab === t.id ? "3px solid #C8102E" : "3px solid transparent",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {inquiry.generalNotes && (
        <div className="mb-4 rounded-lg p-3 font-dm" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", fontSize: 12, color: "#92400E" }}>
          <span style={{ fontWeight: 700 }}>Client notes:</span> {inquiry.generalNotes}
        </div>
      )}

      {activeTab === "inquiry" && (
        <InquiryDetailsTab inquiry={inquiry} isNew={isNewClient(inquiry.clientName)} onStart={() => setActiveTab("cost")} />
      )}

      <DraftTab active={activeTab === "cost"}>
        <CostEstimationPanel
          inquiry={inquiry}
          qty={inquiry.products.reduce((s, p) => s + p.qty, 0)}
          onApply={(data) => {
            const idx = data.productIndex ?? 0;
            /* Store BOM result only for this product — don't overwrite other products */
            setPerProductBomData((prev) => prev.map((d, i) => i === idx ? data : d));
            /* Mirror the BOM-derived per-unit price into ONLY this product's quotation line */
            setLines((prev) => prev.map((l, i) => i === idx ? {
              ...l,
              materialCost: data.costConfig.includeLabor ? data.unitPrice / (1 + data.costConfig.markupPct / 100) - data.costConfig.laborCost : data.unitPrice / (1 + data.costConfig.markupPct / 100),
              labor: data.costConfig.laborCost,
              markupPct: data.costConfig.markupPct,
            } : l));
            setActiveTab("quote");
          }}
        />
      </DraftTab>

      <DraftTab active={activeTab === "quote"}>
        <QuotationBuilder
          key={JSON.stringify(perProductBomData)}
          inquiry={inquiry}
          productBoms={inquiry.products.map((_, index) =>
            perProductBomData[index]?.bom ?? resolveProductBOM(inquiry, index) ?? null
          )}
          manufacturingUnitCost={bomData?.unitPrice ?? inquiry.unitPrice ?? 0}
          productsManufacturingUnitCosts={perProductBomData.map((d) => d?.unitPrice ?? null)}
          discounts={discounts}
          vatType={bomData?.costConfig.vatType ?? inquiry.costConfig?.vatType ?? "Exclusive"}
          onSendToClient={(doc, total, leadTimeDays) => {
            /* Sync quotation lines per-product using the per-product BOM data */
            const newLines: QuotationLine[] = inquiry.products.map((p, i) => {
              const pd = perProductBomData[i];
              return {
                productId: p.id,
                materialCost: pd?.costConfig.includeLabor
                  ? (pd.unitPrice) / (1 + (pd.costConfig.markupPct) / 100) - (pd.costConfig.laborCost)
                  : (pd?.unitPrice ?? 0) / (1 + ((pd?.costConfig.markupPct ?? 0)) / 100),
                labor: pd?.costConfig.laborCost ?? 0,
                markupPct: pd?.costConfig.markupPct ?? 0,
              };
            });
            setLines(newLines);
            setLeadDays(leadTimeDays);
            const q: Quotation = { sentDate: doc.date, leadTimeDays, lines: newLines };
            onSubmit(q, bomData ?? undefined, doc);
            void total;
          }}
        />
      </DraftTab>
    </ModalShell>
  );
}

export function InquiryDetailsTab({ inquiry, isNew, onStart }: { inquiry: Inquiry; isNew: boolean; onStart: () => void }) {
  const totalQty = inquiry.products.reduce((s, p) => s + p.qty, 0);
  const [expandedSketches, setExpandedSketches] = useState<Record<string, boolean>>({});

  return (
    <div className="flex flex-col gap-4">
      {/* RUSH banner */}
      {inquiry.urgent && (
        <div className="rounded-lg p-3 flex items-center gap-2.5" style={{ backgroundColor: "#FEF2F2", border: "1.5px solid #FECACA" }}>
          <span style={{ fontSize: 18 }}>🚨</span>
          <div>
            <div className="font-dm" style={{ fontSize: 13, fontWeight: 800, color: "#991B1B", letterSpacing: 0.4 }}>RUSH ORDER — priority production</div>
            {inquiry.dueDate && <div className="font-dm mt-0.5" style={{ fontSize: 12, color: "#7F1D1D" }}>Required by: <strong>{inquiry.dueDate}</strong></div>}
          </div>
        </div>
      )}

      {/* New client banner */}
      {isNew && (
        <div className="rounded-lg p-4 flex items-start gap-3" style={{ backgroundColor: "#FFEDD5", border: "1px solid #FDBA74" }}>
          <Info size={16} style={{ color: "#9A3412", marginTop: 2 }} />
          <div className="font-dm" style={{ fontSize: 13, color: "#9A3412" }}>
            <span style={{ fontWeight: 700 }}>New client · Custom filter order.</span> Review the full inquiry below — including any sketch the client uploaded — before pricing in Tab 2.
          </div>
        </div>
      )}

      {/* Client / submission card */}
      <div className="rounded-xl border border-slate-200 overflow-hidden" style={{ backgroundColor: "white" }}>
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between" style={{ backgroundColor: "#F8FAFC" }}>
          <div className="font-syne" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>📋 Client Submission</div>
          <span className="font-mono-jb" style={{ fontSize: 11, color: "#64748B" }}>{inquiry.code} · submitted {inquiry.submittedDate}</span>
        </div>
        <div className="grid grid-cols-4 gap-4 p-5">
          <DetailField label="Company">{inquiry.clientName}</DetailField>
          <DetailField label="Contact Person">{inquiry.contactPerson}</DetailField>
          <DetailField label="Payment Terms">{inquiry.paymentTerms}</DetailField>
          <DetailField label="Total Qty">{totalQty} pcs across {inquiry.products.length} product{inquiry.products.length === 1 ? "" : "s"}</DetailField>
        </div>
        {inquiry.generalNotes && (
          <div className="px-5 pb-5">
            <div className="font-dm mb-1" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>General Notes from Client</div>
            <div className="rounded-md p-3 font-dm" style={{ fontSize: 13, color: "#0F172A", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", lineHeight: 1.5 }}>
              {inquiry.generalNotes}
            </div>
          </div>
        )}
      </div>

      {/* Product specs table */}
      <details className="rounded-lg border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold">All returned product specifications</summary>{inquiry.products.map(product => <div key={product.id} className="mt-3 border-t pt-3"><b className="text-sm">{product.filterName || product.type}</b><div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">{Object.entries(product).filter(([, value]) => value != null && value !== "").map(([key, value]) => <span key={key}>{key}: {String(value)}</span>)}</div></div>)}</details>
      <div className="rounded-xl border border-slate-200 overflow-hidden" style={{ backgroundColor: "white" }}>
        <div className="px-5 py-3 border-b border-slate-200" style={{ backgroundColor: "#F8FAFC" }}>
          <div className="font-syne" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Product Specifications · {inquiry.products.length} item{inquiry.products.length === 1 ? "" : "s"}</div>
        </div>
        <table className="w-full">
          <thead style={{ backgroundColor: "#F4F6F9" }}>
            <tr>
              {["#", "Type", "OD1/OD2", "ID1/ID2", "H", "Media", "Inner / Outer", "O-Ring / Gasket", "OEM", "Qty", "Line Notes"].map((h) => (
                <th key={h} className="font-dm text-left px-3 py-2" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inquiry.products.map((p, i) => {
              const isExpanded = Boolean(expandedSketches[p.id]);
              const sketchRegionId = `quotation-product-sketch-${i}`;

              return (
                <Fragment key={p.id}>
                  <tr className="group border-t border-slate-200 align-top transition-colors hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        aria-label={`Toggle sketch for product ${i + 1}: ${p.filterName || p.type}`}
                        aria-expanded={isExpanded}
                        aria-controls={isExpanded ? sketchRegionId : undefined}
                        onClick={() => setExpandedSketches((current) => ({
                          ...current,
                          [p.id]: !current[p.id],
                        }))}
                        className="flex items-center gap-1.5 rounded text-left font-syne text-slate-700 transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                        style={{ fontSize: 13, fontWeight: 700 }}
                      >
                        <span>#{i + 1}</span>
                        <ChevronDown
                          size={14}
                          aria-hidden="true"
                          className="shrink-0 text-slate-400 transition-transform duration-200 group-hover:text-blue-700"
                          style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                        />
                      </button>
                    </td>
                    <td className="px-3 py-2.5 font-dm" style={{ fontSize: 13, color: "#0F172A", fontWeight: 600 }}>{p.type}</td>
                    <td className="px-3 py-2.5 font-mono-jb" style={{ fontSize: 11, color: "#475569" }}>{p.od1 || "—"} / {p.od2 || "—"}</td>
                    <td className="px-3 py-2.5 font-mono-jb" style={{ fontSize: 11, color: "#475569" }}>{p.id1 || "—"} / {p.id2 || "—"}</td>
                    <td className="px-3 py-2.5 font-mono-jb" style={{ fontSize: 11, color: "#475569" }}>{p.height || "—"}</td>
                    <td className="px-3 py-2.5 font-dm" style={{ fontSize: 12, color: "#475569" }}>{p.media || "—"}</td>
                    <td className="px-3 py-2.5 font-dm" style={{ fontSize: 12, color: "#475569" }}>{p.innerCore || "—"} / {p.outerCore || "—"}</td>
                    <td className="px-3 py-2.5 font-dm" style={{ fontSize: 12, color: "#475569" }}>{p.oring || "—"} / {p.gasket || "—"}</td>
                    <td className="px-3 py-2.5 font-mono-jb" style={{ fontSize: 11, color: "#475569" }}>{p.oem || "—"}</td>
                    <td className="px-3 py-2.5 font-syne" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{p.qty}</td>
                    <td className="px-3 py-2.5 font-dm" style={{ fontSize: 12, color: "#475569" }}>{p.notes || "—"}</td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-t border-slate-200 bg-slate-50">
                      <td colSpan={11} className="px-4 py-3">
                        <div
                          id={sketchRegionId}
                          role="region"
                          aria-label={`Engineer sketch for product ${i + 1}: ${p.filterName || p.type}`}
                        >
                          <div className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>
                            Product ID: {p.id} · Filter type: {p.type}
                          </div>
                          <OperationsProductSketch
                            key={`${inquiry.id}:${p.id}`}
                            inquiryId={inquiry.id}
                            productId={p.id}
                            product={p}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={onStart}
          className="font-dm px-4 py-2.5 rounded-md text-white hover:opacity-90 flex items-center gap-2"
          style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.4 }}
        >
          📋 START QUOTATION <ArrowRight size={14} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</div>
      <div className="font-dm mt-0.5" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{children}</div>
    </div>
  );
}

function MaterialPlanBlock({ index, product, plan, onChange, onAcceptLead }: {
  index: number; product: ProductLine; plan: MatPlan;
  onChange: (p: Partial<MatPlan>) => void; onAcceptLead: (days: number) => void;
}) {
  const { get } = useMaterials();
  const media = get(plan.mediaSource === "Local" ? "mediaLocal" : "mediaImported");
  const adhesive = get("adhesive");
  const box = get("box");

  const checks: { mat: Material; need: number }[] = [
    { mat: media, need: plan.mediaRolls },
    { mat: adhesive, need: plan.adhesiveSets },
    { mat: box, need: plan.boxPcs },
  ];

  const shortages = checks.filter((c) => c.need > 0 && c.need > c.mat.available);
  const hasInputs = checks.some((c) => c.need > 0);
  const longest = shortages.find((s) => s.mat.key === "box") || shortages[0];
  const suggested = longest ? 28 : 14;

  const addOther = () =>
    onChange({ others: [...plan.others, { id: `o-${Date.now()}`, name: "" }] });
  const updateOther = (id: string, name: string) =>
    onChange({ others: plan.others.map((o) => (o.id === id ? { ...o, name } : o)) });
  const removeOther = (id: string) =>
    onChange({ others: plan.others.filter((o) => o.id !== id) });

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-2.5" style={{ backgroundColor: "#F4F6F9" }}>
        <div className="font-syne" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
          PRODUCT {index + 1} — {product.type}
          {product.od1 && <span className="font-dm ml-1" style={{ fontWeight: 500, color: "#475569" }}>{product.od1}×{product.id1}×{product.height}mm</span>}
          <span className="font-dm ml-2" style={{ fontSize: 12, fontWeight: 500, color: "#64748B" }}>· Qty: {product.qty}</span>
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Filter Media Type">
              <select value={plan.mediaSource} onChange={(e) => onChange({ mediaSource: e.target.value as "Local" | "Imported" })} className="form-input-sm">
                <option>Local</option><option>Imported</option>
              </select>
            </Field>
            <Field label={`Rolls Needed (${media.unit})`}>
              <input type="number" value={plan.mediaRolls} onChange={(e) => onChange({ mediaRolls: Number(e.target.value) })} className="form-input-sm" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Adhesive Sets">
              <input type="number" value={plan.adhesiveSets} onChange={(e) => onChange({ adhesiveSets: Number(e.target.value) })} className="form-input-sm" />
            </Field>
            <Field label="Corrugated Box (pcs)">
              <input type="number" value={plan.boxPcs} onChange={(e) => onChange({ boxPcs: Number(e.target.value) })} className="form-input-sm" />
            </Field>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Other Materials (optional)</span>
            {plan.others.map((o) => (
              <div key={o.id} className="flex items-center gap-2">
                <input value={o.name} onChange={(e) => updateOther(o.id, e.target.value)} placeholder="Material name" className="form-input-sm flex-1" />
                <button onClick={() => removeOther(o.id)} className="w-7 h-7 rounded-md hover:bg-slate-100 flex items-center justify-center" style={{ color: "#64748B" }}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <button onClick={addOther} className="font-dm self-start" style={{ fontSize: 12, color: "#C8102E", fontWeight: 600 }}>
              + Add other material
            </button>
            <span className="font-dm" style={{ fontSize: 11, color: "#94A3B8" }}>Other materials are tracked here for reference only — not in inventory system.</span>
          </div>
        </div>

        <div>
          <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" }}>📊 Stock Check Result</div>
          {!hasInputs ? (
            <div className="rounded-md p-3 font-dm" style={{ backgroundColor: "#F8FAFC", border: "1px dashed #CBD5E1", fontSize: 12, color: "#94A3B8" }}>
              Enter material quantities to check stock.
            </div>
          ) : (
            <div className="rounded-md p-3 flex flex-col gap-2.5" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              {checks.map((c) => {
                if (c.need <= 0) return null;
                const ok = c.need <= c.mat.available;
                const short = ok ? 0 : c.need - c.mat.available;
                return (
                  <div key={c.mat.key} className="font-dm" style={{ fontSize: 12 }}>
                    <div style={{ color: "#0F172A", fontWeight: 600 }}>{c.mat.label}: {c.mat.available} {c.mat.unit} available</div>
                    <div style={{ color: ok ? "#16A34A" : "#C8102E", fontWeight: 700 }}>
                      You need: {c.need} {c.mat.unit} → {ok ? "✅ Sufficient" : "⚠️ LOW STOCK"}
                    </div>
                    {!ok && (
                      <div style={{ color: "#92400E", fontSize: 11 }}>
                        Shortfall: {short} {c.mat.unit} · Lead time: {c.mat.leadTime}
                      </div>
                    )}
                  </div>
                );
              })}
              {shortages.length > 0 && (
                <div className="mt-1 pt-2 border-t border-slate-200 flex flex-col gap-2">
                  <div className="font-dm" style={{ fontSize: 12, color: "#92400E" }}>
                    ⚠️ Recommendation: Add 14+ days to lead time. Suggested: <span style={{ fontWeight: 700 }}>{suggested} days</span> instead of 14.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => onAcceptLead(suggested)}
                      className="font-dm px-3 py-1.5 rounded-md text-white"
                      style={{ backgroundColor: "#1A2B4A", fontSize: 11, fontWeight: 700, letterSpacing: 0.3 }}
                    >
                      Accept Suggested Lead Time
                    </button>
                    <button
                      onClick={() => onAcceptLead(14)}
                      className="font-dm px-3 py-1.5 rounded-md border border-slate-300 hover:bg-white"
                      style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}
                    >
                      Keep Original
                    </button>
                    <button
                      onClick={() => toast("Opening inventory order form...")}
                      className="font-dm px-3 py-1.5 rounded-md border-2"
                      style={{ borderColor: "#C8102E", color: "#C8102E", fontSize: 11, fontWeight: 700, letterSpacing: 0.3 }}
                    >
                      📦 Order Boxes Now
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductCostBlock({ index, product, line, onChange }: { index: number; product: ProductLine; line: QuotationLine; onChange: (p: Partial<QuotationLine>) => void }) {
  const unit = unitPrice(line);
  const sub = unit * product.qty;
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: "#F4F6F9" }}>
        <div className="font-syne" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
          Product #{index + 1} — {product.type}
          {product.oem && <span className="font-mono-jb ml-2" style={{ fontSize: 12, fontWeight: 500, color: "#64748B" }}>· {product.oem}</span>}
        </div>
        <span className="font-dm" style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>Qty: {product.qty}</span>
      </div>
      <div className="px-4 py-3">
        <div className="font-dm mb-3" style={{ fontSize: 12, color: "#64748B" }}>
          {[product.od1 && `OD1 ${product.od1}`, product.id1 && `ID1 ${product.id1}`, product.height && `H ${product.height}`, product.media].filter(Boolean).join(" · ")}
        </div>
        <div className="grid grid-cols-4 gap-3 items-end">
          <Field label="Raw Materials (₱)">
            <input type="number" value={line.materialCost} onChange={(e) => onChange({ materialCost: Number(e.target.value) })} className="form-input-sm" />
          </Field>
          <Field label="Labor (₱)">
            <input type="number" value={line.labor} onChange={(e) => onChange({ labor: Number(e.target.value) })} className="form-input-sm" />
          </Field>
          <Field label="Markup (%)">
            <input type="number" value={line.markupPct} onChange={(e) => onChange({ markupPct: Number(e.target.value) })} className="form-input-sm" />
          </Field>
          <div className="flex flex-col gap-1 text-right">
            <span className="font-dm" style={{ fontSize: 11, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 600 }}>Unit · Subtotal</span>
            <span className="font-syne" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{peso(unit)} <span style={{ color: "#64748B", fontWeight: 500 }}>× {product.qty}</span></span>
            <span className="font-syne" style={{ fontSize: 16, fontWeight: 800, color: "#C8102E" }}>{peso(sub)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Quotation Detail (read-only management view) ---- */
function QuotationDetailModal({ inquiry, onClose }: { inquiry: Inquiry; onClose: () => void }) {
  const q = inquiry.quotation!;
  const total = quotationTotal(inquiry);
  return (
    <ModalShell title={`Internal Cost Breakdown · ${inquiry.code}`} subtitle={`${inquiry.clientName} · Sent ${q.sentDate} · ${q.leadTimeDays} day lead time`} onClose={onClose} size="lg">
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead style={{ backgroundColor: "#F4F6F9" }}>
            <tr>
              {["Product", "Qty", "Materials", "Labor", "Markup", "Unit", "Subtotal"].map((h) => (
                <th key={h} className="font-dm text-left px-3 py-2" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inquiry.products.map((p, i) => {
              const l = q.lines.find((ll) => ll.productId === p.id);
              if (!l) return null;
              return (
                <tr key={p.id} className="border-t border-slate-200">
                  <td className="px-3 py-3 font-dm" style={{ fontSize: 13, color: "#0F172A" }}><span style={{ fontWeight: 700 }}>#{i + 1}</span> {p.type}</td>
                  <td className="px-3 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{p.qty}</td>
                  <td className="px-3 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{peso(l.materialCost)}</td>
                  <td className="px-3 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{peso(l.labor)}</td>
                  <td className="px-3 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{l.markupPct}%</td>
                  <td className="px-3 py-3 font-syne" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{peso(unitPrice(l))}</td>
                  <td className="px-3 py-3 font-syne" style={{ fontSize: 14, fontWeight: 800, color: "#C8102E" }}>{peso(unitPrice(l) * p.qty)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 rounded-lg p-4 flex items-center justify-between" style={{ backgroundColor: "#1A2B4A" }}>
        <span className="font-dm text-white/60" style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>Total Quoted</span>
        <span className="font-syne text-white" style={{ fontSize: 22, fontWeight: 800 }}>{peso(total)}</span>
      </div>
      <div className="flex justify-end pt-4 mt-4 border-t border-slate-200">
        <button onClick={onClose} className="font-dm px-4 py-2 rounded-md hover:bg-slate-100" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Close</button>
      </div>
    </ModalShell>
  );
}

/* ---- PO Viewer ---- */
export function POViewerModal({ inquiry, onClose }: { inquiry: Inquiry; onClose: () => void }) {
  const poFile = inquiry.poFileName;
  const poReference = poNumberForDisplay(inquiry) ?? inquiry.code;
  const poDataUrl = inquiry.poFileDataUrl;

  return (
    <ModalShell title="PURCHASE ORDER" subtitle={`${inquiry.clientName} · ${poFile ?? "Client-submitted document"}`} onClose={onClose} size="lg">
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div>
          <div className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>PO Number</div>
          <div className="font-mono-jb mt-1" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{poReference}</div>
        </div>
        <div>
          <div className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Client</div>
          <div className="font-dm mt-1" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{inquiry.clientName}</div>
        </div>
        <div>
          <div className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Uploaded</div>
          <div className="font-dm mt-1" style={{ fontSize: 13, color: "#0F172A" }}>{inquiry.poUploadedAt ? new Date(inquiry.poUploadedAt).toLocaleString() : "—"}</div>
        </div>
      </div>
      {poDataUrl?.startsWith("data:image/") ? (
        <div className="rounded-lg border border-slate-200 bg-slate-100 p-3 flex items-center justify-center" style={{ minHeight: 360, maxHeight: "65vh" }}>
          <img src={poDataUrl} alt={`${inquiry.clientName} purchase order ${poReference}`} className="max-w-full max-h-[62vh] object-contain" />
        </div>
      ) : poDataUrl?.startsWith("data:application/pdf") ? (
        <iframe src={poDataUrl} title={`${inquiry.clientName} purchase order ${poReference}`} className="w-full rounded-lg border border-slate-200 bg-white" style={{ height: "65vh" }} />
      ) : poDataUrl ? (
        <div className="rounded-lg border border-slate-200 p-5 flex items-center justify-center" style={{ minHeight: 240 }}>
          <a href={poDataUrl} download={poFile ?? "purchase-order"} className="font-dm px-4 py-2 rounded-md border border-slate-300" style={{ fontSize: 13, fontWeight: 700, color: "#1A2B4A" }}>Open or download {poFile ?? "purchase order"}</a>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 p-5" style={{ backgroundColor: "#FFFBEB" }}>
          <div className="font-dm" style={{ fontSize: 12, fontWeight: 800, color: "#92400E", textTransform: "uppercase" }}>Original upload unavailable</div>
          <p className="font-dm mt-2" style={{ fontSize: 13, color: "#78350F" }}>The Sales API returns document metadata. Original file content is unavailable through this API; preview and download integration is pending.</p>
        </div>
      )}
    </ModalShell>
  );
}

/* ---- Generate JO confirmation w/ final specs + physical document uploads ---- */
interface UploadedDoc { id: string; name: string; size: number; ts: string; label?: string }

export function GenerateJOModal({ inquiry, onClose, onConfirm }: {
  inquiry: Inquiry;
  onClose: () => void;
  onConfirm: (data: FinalizeJOData | FinalizeJOData[]) => void;
}) {
  const generateJONumber = () => "UNSAVED-JO-DRAFT";
  const [otherDocs, setOtherDocs] = useState<UploadedDoc[]>([]);
  const [otherLabel, setOtherLabel] = useState("");
  const [checks, setChecks] = useState({ verified: false, matches: false, terms: false, dpConfirmed: false });
  const [poFullscreen, setPoFullscreen] = useState(false);
  const [showSpecs, setShowSpecs] = useState(true);
  /* Active product tab for multi-product JO editing */
  const [activeProductTab, setActiveProductTab] = useState(0);

  /* ── Per-product state: JO numbers, specs, sketches, Enter-Fil PN ── */
  const initJoNumbers = (): string[] => {
    const base = generateJONumber();
    const match = base.match(/^(JO-\d{4}-)(\d+)$/);
    return inquiry.products.map((_, idx) =>
      match ? `${match[1]}${String(Number(match[2]) + idx).padStart(match[2].length, "0")}` : idx === 0 ? base : `${base}-${idx + 1}`
    );
  };
  const [joNumbers, setJoNumbers] = useState<string[]>(initJoNumbers);

  const initProductSpecs = (): JOSpecs[] =>
    inquiry.products.map((p) => ({
      od1: p.od1 ?? "", od2: p.od2 ?? "",
      id1: p.id1 ?? "", id2: p.id2 ?? "",
      height: p.height ?? "", overallHeight: p.overallHeight ?? "",
      endCap: p.endCap ?? "", media: p.media ?? "",
      innerCore: p.innerCore ?? "", outerCore: p.outerCore ?? "",
      oring: p.oring ?? "", gasket: p.gasket ?? "",
      oem: p.oem ?? "", brand: p.brand ?? "", others: p.others ?? "",
      length: p.length ?? "", width: p.width ?? "", thickness: p.thickness ?? "",
      depth: p.depth ?? "", pocketCount: p.pocketCount ?? "",
      diameter: p.diameter ?? "",
      clothCuttingWidth: p.clothCuttingWidth ?? "", clothCuttingLength: p.clothCuttingLength ?? "",
      springPlateCenterToCenter: p.springPlateCenterToCenter ?? "",
      springPlateWidth: p.springPlateWidth ?? "", springPlateLength: p.springPlateLength ?? "",
      padOd: p.padOd ?? "", padId: p.padId ?? "",
    }));
  const [productSpecs, setProductSpecs] = useState<JOSpecs[]>(initProductSpecs);
  const setSpecForProduct = (pIdx: number, k: keyof JOSpecs, v: string) =>
    setProductSpecs((prev) => prev.map((s, i) => i === pIdx ? { ...s, [k]: v } : s));

  /* Per-product sketch docs */
  const [productSketches, setProductSketches] = useState<UploadedDoc[][]>(() => inquiry.products.map(() => []));
  const addSketch = (pIdx: number, file: File) => {
    const doc: UploadedDoc = {
      id: `sketch-${pIdx}-${Date.now()}`,
      name: file.name,
      size: file.size,
      ts: new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    };
    setProductSketches((prev) => prev.map((arr, i) => i === pIdx ? [...arr, doc] : arr));
  };
  const removeSketch = (pIdx: number, id: string) =>
    setProductSketches((prev) => prev.map((arr, i) => i === pIdx ? arr.filter((d) => d.id !== id) : arr));

  /* Per-product Enter-Fil PN */
  const [enterFilPNs, setEnterFilPNs] = useState<string[]>(() => inquiry.products.map((p) => p.oem ?? ""));

  /* Payment terms (set by Enter-Fil during quotation, can be edited here after negotiation) */
  const [paymentTerms, setPaymentTerms] = useState<"15-Day Terms" | "30-Day Terms">(inquiry.paymentTerms);
  /* Delivery method (Enter-Fil's final say) */
  const [deliveryMethod, setDeliveryMethod] = useState<NonNullable<Inquiry["deliveryMethod"]>>(() => {
    const quotationMethod = inquiry.quotationDoc?.shipping?.label;
    return ["Lalamove", "AP Cargo", "Fast Cargo", "Company Vehicle", "Client Pick-up"].includes(quotationMethod ?? "")
      ? quotationMethod as NonNullable<Inquiry["deliveryMethod"]>
      : "Company Vehicle";
  });
  /* Sales-invoice issuance — some orders skip SI */
  const [issueSI, setIssueSI] = useState(true);

  const allSketchesAttached = productSketches.every((s) => s.length > 0);
  const dpRequired = (inquiry.downpaymentPercent ?? 0) > 0;
  const dpOk = !dpRequired || inquiry.downpaymentConfirmed === true || checks.dpConfirmed;
  const allChecked = checks.verified && checks.matches && checks.terms && allSketchesAttached && dpOk;

  const poFile = inquiry.poFileName ?? null;
  const isImage = poFile ? /\.(jpe?g|png|gif|webp)$/i.test(poFile) : false;

  const addOtherDoc = (file: File, label?: string) => {
    const doc: UploadedDoc = {
      id: `other-${Date.now()}`,
      name: file.name, size: file.size,
      ts: new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      label,
    };
    setOtherDocs((prev) => [...prev, doc]);
  };

  const productionDeadline = calculateProductionDeadline(
    inquiry.quotationDoc?.timeOfDelivery,
    deliveryMethod,
  );
  const deliveryTransitEstimate = getDeliveryTransitEstimate(deliveryMethod);

  const buildFinalizePayload = (): FinalizeJOData[] =>
    inquiry.products.map((_, idx) => ({
      joNumber: joNumbers[idx] ?? `${joNumbers[0]}-${idx + 1}`,
      productionDueDate: productionDeadline?.productionDueDate ?? "",
      deliveryMethod,
      joSpecs: { ...productSpecs[idx], oem: enterFilPNs[idx] || productSpecs[idx]?.oem },
      joSketch: productSketches[idx]?.[0]?.name,
    }));

  const handleConfirm = () => {
    pendingIntegration("Job Order generation");
  };

  const paymentVerificationDates = (inquiry.payments ?? [])
    .filter((payment) => payment.verificationStatus === "verified")
    .map((payment) => payment.verifiedAt)
    .filter((verifiedAt): verifiedAt is string => !!verifiedAt && !Number.isNaN(Date.parse(verifiedAt)))
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  const latestPaymentVerifiedAt = paymentVerificationDates[0];
  const latestPaymentVerifiedDisplay = latestPaymentVerifiedAt
    ? new Date(latestPaymentVerifiedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
    : "Not recorded";
  const clientDeliveryDate = inquiry.dueDate || "Not provided";
  const quotedDeliveryTerm = inquiry.quotationDoc?.timeOfDelivery || "Not recorded";

  const totalQty = inquiry.products.reduce((s, p) => s + p.qty, 0);
  const summary = inquiry.products.map((p) => `${p.type}${p.od1 ? ` ${p.od1}×${p.id1}×${p.height}mm` : ""} · Qty ${p.qty}`).join(" · ");

  return (
    <ModalShell title="Generate Job Order" subtitle={`${inquiry.code} · ${inquiry.clientName}`} onClose={onClose} size="lg"><p className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm">Unsaved JO configuration · Backend integration pending. Draft checkboxes and selected files do not verify payment or upload documents.</p>

      {/* ─── PO Document Preview ─── */}
      {poFile && (
        <div className="rounded-lg border border-slate-200 overflow-hidden mb-5" style={{ backgroundColor: "#FAFBFC" }}>
          <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between" style={{ backgroundColor: "#F4F6F9" }}>
            <div className="flex items-center gap-2">
              <FileText size={15} style={{ color: "#C8102E" }} />
              <span className="font-syne" style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", letterSpacing: 0.5 }}>PURCHASE ORDER DOCUMENT</span>
              <span className="font-mono-jb" style={{ fontSize: 11, color: "#64748B" }}>{poFile}</span>
            </div>
            <button
              onClick={() => setPoFullscreen(true)}
              className="flex items-center gap-1.5 font-dm px-3 py-1.5 rounded-md border border-slate-200 hover:bg-white"
              style={{ fontSize: 11, fontWeight: 600, color: "#1A2B4A" }}
            >
              <Maximize2 size={12} /> 🔍 Open Full Screen
            </button>
          </div>

          <div className="p-4">
            <div
              className="relative rounded-lg overflow-hidden flex items-center justify-center"
              style={{ backgroundColor: "#E2E8F0", minHeight: 200, border: "1px solid #CBD5E1" }}
            >
              {isImage ? (
                <div className="flex flex-col items-center gap-3 py-8 px-6 text-center">
                  <div className="w-16 h-16 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#DBEAFE" }}>
                    <FileText size={28} style={{ color: "#2563EB" }} />
                  </div>
                  <div>
                    <div className="font-syne" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{poFile}</div>
                    <div className="font-dm mt-1" style={{ fontSize: 12, color: "#64748B" }}>Image file · Click "Open Full Screen" to view</div>
                  </div>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center py-2">
                  <div className="bg-white mx-auto rounded shadow border border-slate-300 p-5 my-3" style={{ width: 260 }}>
                    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-200">
                      <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: "#1A2B4A" }}>
                        <span style={{ color: "#C8102E", fontSize: 12, fontWeight: 800 }}>▲</span>
                      </div>
                      <div>
                        <div className="font-syne" style={{ fontSize: 9, fontWeight: 800, color: "#0F172A", letterSpacing: 0.5 }}>PO REFERENCE SUMMARY — ORIGINAL FILE UNAVAILABLE</div>
                        <div className="font-mono-jb" style={{ fontSize: 8, color: "#64748B" }}>{poFile}</div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {[100, 75, 90, 60, 80].map((w, i) => (
                        <div key={i} className="h-2 rounded" style={{ backgroundColor: i === 0 ? "#94A3B8" : "#E2E8F0", width: `${w}%` }} />
                      ))}
                      <div className="mt-2 pt-2 border-t border-slate-200">
                        {inquiry.products.map((_, i) => (
                          <div key={i} className="h-2 rounded mb-1" style={{ backgroundColor: "#DBEAFE", width: `${85 - i * 10}%` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="font-dm pb-2" style={{ fontSize: 11, color: "#64748B" }}>PDF document — scroll to read full contents</div>
                </div>
              )}
            </div>
            <div className="mt-2 flex justify-end">
              <button
                onClick={() => toast("To replace: ask the client to resubmit their PO via the portal.")}
                className="font-dm flex items-center gap-1 hover:underline"
                style={{ fontSize: 11, color: "#94A3B8" }}
              >
                <RotateCcw size={11} /> 🔄 Replace Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Per-product JO tabs (one tab per filter product) ── */}
      <div className="rounded-lg border border-slate-200 mb-5 overflow-hidden">
        <div className="px-5 py-3 flex items-center gap-3 flex-wrap" style={{ backgroundColor: "#1A2B4A" }}>
          <span className="font-syne text-white" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>JOB ORDERS</span>
          <span className="font-dm text-white/60" style={{ fontSize: 11 }}>— {inquiry.products.length} filter{inquiry.products.length > 1 ? "s" : ""} · {inquiry.products.length} separate JO{inquiry.products.length > 1 ? "s" : ""} · delivered together</span>
          {inquiry.products.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setActiveProductTab(i)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md font-dm whitespace-nowrap"
              style={{
                fontSize: 11, fontWeight: 700,
                backgroundColor: i === activeProductTab ? "white" : "rgba(255,255,255,0.1)",
                color: i === activeProductTab ? "#1A2B4A" : "rgba(255,255,255,0.7)",
              }}
            >
              #{i + 1} {p.filterName ?? p.type}
              {productSketches[i]?.length > 0 && <span style={{ fontSize: 9 }}>📎</span>}
            </button>
          ))}
        </div>

        {/* Active product panel */}
        {inquiry.products.map((product, pIdx) => pIdx !== activeProductTab ? null : (
          <div key={product.id} className="p-5 flex flex-col gap-4" style={{ backgroundColor: "#FAFBFC" }}>
            {/* JO Number for this product */}
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <div className="font-syne" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>JO Number — Filter #{pIdx + 1}</div>
                <div className="font-dm mt-0.5" style={{ fontSize: 11, color: "#64748B" }}>{product.filterName ?? product.type} · Qty {product.qty}</div>
              </div>
              <input
                value={joNumbers[pIdx] ?? ""}
                onChange={(e) => setJoNumbers((prev) => prev.map((n, i) => i === pIdx ? e.target.value : n))}
                className="form-input"
                style={{ maxWidth: 200, fontFamily: '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 700, color: "#1A2B4A" }}
              />
            </div>

            {/* Enter-Fil PN (required) */}
            <div className="flex flex-col gap-1">
              <label className="font-dm flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.4, textTransform: "uppercase" }}>
                Enter-Fil PN
                <span className="font-dm px-1.5 py-0.5 rounded-full" style={{ fontSize: 8, fontWeight: 800, backgroundColor: "#C8102E", color: "white" }}>REQUIRED</span>
              </label>
              <input
                value={enterFilPNs[pIdx] ?? ""}
                onChange={(e) => setEnterFilPNs((prev) => prev.map((n, i) => i === pIdx ? e.target.value : n))}
                className="form-input"
                placeholder="e.g. KF-OS.107.65.252"
              />
            </div>

            {/* Specs */}
            <button
              onClick={() => setShowSpecs((v) => !v)}
              className="w-full px-4 py-2.5 flex items-center justify-between rounded-md"
              style={{ backgroundColor: "#E2E8F0", border: "1px solid #CBD5E1" }}
            >
              <span className="font-syne" style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>📐 Technical Specifications</span>
              <span className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>{showSpecs ? "▲ collapse" : "▼ expand"} · pre-filled from inquiry</span>
            </button>
            {showSpecs && (
              <div>
                {/* Group-specific dimension fields */}
                {(() => {
                  const group = groupForType(product.type ?? "AIRFIL");
                  const dimKeys = GROUP_TEMPLATES[group]?.dimensions ?? GROUP_TEMPLATES.cylindrical.dimensions;
                  const curSpecs = productSpecs[pIdx] ?? {};
                  return (
                    <>
                      <div className="font-dm mb-1 flex items-center gap-2" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" }}>
                        Dimensions
                        <span className="font-dm px-1.5 py-0.5 rounded-full" style={{ fontSize: 9, fontWeight: 700, backgroundColor: "#EDE9FE", color: "#7C3AED" }}>{group}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        {dimKeys.map((k) => (
                          <div key={k} className="flex flex-col gap-1">
                            <label className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>{DIMENSION_LABELS_CATALOG[k] ?? k}</label>
                            <input value={(curSpecs as any)[k] ?? ""} onChange={(e) => setSpecForProduct(pIdx, k as keyof JOSpecs, e.target.value)} className="form-input-sm" placeholder="—" />
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
                <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" }}>Components</div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {([["End Cap", "endCap"], ["Filter Media", "media"], ["Inner Core", "innerCore"], ["Outer Core", "outerCore"], ["O-Ring", "oring"], ["Gasket", "gasket"]] as [string, keyof JOSpecs][]).map(([lbl, k]) => (
                    <div key={k} className="flex flex-col gap-1">
                      <label className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>{lbl}</label>
                      <input value={(productSpecs[pIdx] as any)?.[k] ?? ""} onChange={(e) => setSpecForProduct(pIdx, k, e.target.value)} className="form-input-sm" placeholder="—" />
                    </div>
                  ))}
                </div>
                <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" }}>Other Technical Specs</div>
                <div className="grid grid-cols-3 gap-3">
                  {([["OEM PN", "oem"], ["Brand", "brand"], ["Others", "others"]] as [string, keyof JOSpecs][]).map(([lbl, k]) => (
                    <div key={k} className="flex flex-col gap-1">
                      <label className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>{lbl}</label>
                      <input value={(productSpecs[pIdx] as any)?.[k] ?? ""} onChange={(e) => setSpecForProduct(pIdx, k, e.target.value)} className="form-input-sm" placeholder="—" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Per-product sketch (REQUIRED) */}
            {(() => {
              const sketches = productSketches[pIdx] ?? [];
              const attached = sketches.length > 0;
              return (
                <div className="rounded-lg border-2 p-4" style={{ backgroundColor: attached ? "#F0FDF4" : "#FEF2F2", borderColor: attached ? "#86EFAC" : "#FECACA" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-syne" style={{ fontSize: 13, fontWeight: 700, color: attached ? "#15803D" : "#991B1B" }}>
                      📎 Sketch / Drawing — Filter #{pIdx + 1}
                    </span>
                    <span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 9, fontWeight: 800, backgroundColor: "#C8102E", color: "white" }}>REQUIRED</span>
                  </div>
                  <div className="font-dm mb-3" style={{ fontSize: 12, color: attached ? "#15803D" : "#7F1D1D" }}>
                    Each filter needs its own approved drawing — production will follow this exact sketch.
                  </div>
                  <UploadSlot
                    label="Upload Sketch / Drawing"
                    help="PDF, JPG, or PNG · the approved drawing for this specific filter"
                    files={sketches}
                    onAdd={(f) => addSketch(pIdx, f)}
                    onRemove={(id) => removeSketch(pIdx, id)}
                  />
                </div>
              );
            })()}
          </div>
        ))}
      </div>

      {/* ── Payment Terms + Delivery Method (Enter-Fil's final say) ── */}
      <div className="rounded-lg border border-slate-200 p-5 mb-5" style={{ backgroundColor: "#FAFBFC" }}>
        <div className="font-syne mb-3" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Payment Terms &amp; Delivery</div>
        <div className="font-dm mb-3" style={{ fontSize: 12, color: "#64748B" }}>
          Set by Enter-Fil during quotation. Editable here after negotiation.
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Payment Terms (Enter-Fil's decision)">
            <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value as any)} className="form-input">
              <option value="15-Day Terms">15-Day Terms · post-delivery</option>
              <option value="30-Day Terms">30-Day Terms · post-delivery</option>
            </select>
          </Field>
          <Field label="Delivery Method (Enter-Fil's final say)">
            <select value={deliveryMethod} onChange={(e) => setDeliveryMethod(e.target.value as NonNullable<Inquiry["deliveryMethod"]>)} className="form-input">
              <option value="Company Vehicle">Company Vehicle — Batangas / Laguna / nearby</option>
              <option value="Lalamove">Lalamove — local, urgent</option>
              <option value="AP Cargo">AP Cargo — Cagayan / Isabela / north</option>
              <option value="Fast Cargo">Fast Cargo — Davao / Mindanao / south</option>
              <option value="Client Pick-up">Client Pick-up</option>
            </select>
            <div className="font-dm mt-1.5" style={{ fontSize: 11, color: "#92400E" }}>
              {deliveryMethod === "Client Pick-up"
                ? "No transit days are deducted for client pick-up."
                : `Estimated transit: ${formatDeliveryTransitEstimate(deliveryMethod)}.`}
              {deliveryTransitEstimate?.isPlaceholder && (
                <div className="mt-0.5" style={{ fontSize: 10 }}>{DELIVERY_TRANSIT_ESTIMATE_NOTICE}</div>
              )}
            </div>
          </Field>
        </div>
        <label className="flex items-start gap-2 mt-3 p-2 rounded-md cursor-pointer hover:bg-white" style={{ backgroundColor: issueSI ? "transparent" : "#FFFBEB" }}>
          <input type="checkbox" checked={issueSI} onChange={(e) => setIssueSI(e.target.checked)} style={{ accentColor: "#C8102E", marginTop: 3 }} />
          <div>
            <div className="font-dm" style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>Issue Sales Invoice on delivery</div>
            <div className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>Uncheck if this order has no SI (e.g. internal sample, special arrangement)</div>
          </div>
        </label>
      </div>

      <div className="rounded-lg border border-slate-200 p-5 mb-5" style={{ backgroundColor: "#FAFBFC" }}>
        <div className="font-syne mb-3" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Production Deadline</div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#92400E", textTransform: "uppercase" }}>Client requested delivery date</div>
            <div className="font-dm mt-1" style={{ fontSize: 13, fontWeight: 700, color: "#78350F" }}>{clientDeliveryDate}</div>
          </div>
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
            <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#1E40AF", textTransform: "uppercase" }}>Latest payment verified at</div>
            <div className="font-dm mt-1" style={{ fontSize: 13, fontWeight: 700, color: "#1E3A8A" }}>{latestPaymentVerifiedDisplay}</div>
          </div>
        </div>
        <div className="font-dm mb-3" style={{ fontSize: 12, color: "#64748B" }}>
          Original quotation timeframe: {quotedDeliveryTerm} · Quotation method: {inquiry.quotationDoc?.shipping?.label || "Not recorded"}.
          <br />
          Final JO method: {deliveryMethod} · Transit estimate: {formatDeliveryTransitEstimate(deliveryMethod) ?? "Not configured"}.
        </div>
        {productionDeadline ? (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
            <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#1E40AF", textTransform: "uppercase" }}>Automatically calculated production deadline</div>
            <div className="font-dm mt-1" style={{ fontSize: 16, fontWeight: 700, color: "#1E3A8A" }}>
              {new Date(`${productionDeadline.productionDueDate}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </div>
            <div className="font-dm mt-1" style={{ fontSize: 11, color: "#1E40AF" }}>
              {productionDeadline.quotationCalendarDays} calendar days (quotation timeframe) − {productionDeadline.maximumTransitCalendarDays} calendar days (maximum final JO transit) = {productionDeadline.productionCalendarDays} calendar days of production, counted as working days excluding Saturdays and Sundays.
            </div>
            {deliveryTransitEstimate?.isPlaceholder && (
              <div className="font-dm mt-1" style={{ fontSize: 10, color: "#92400E" }}>{DELIVERY_TRANSIT_ESTIMATE_NOTICE}</div>
            )}
          </div>
        ) : (
          <p role="alert" className="font-dm rounded-md border border-amber-200 bg-amber-50 p-3" style={{ fontSize: 12, color: "#92400E" }}>
            Deadline unavailable: a valid quotation timeframe and supported final JO delivery method with a valid transit estimate are required. No deadline will be saved until the configuration is corrected.
          </p>
        )}
      </div>

      {/* ── Other Documents (optional) ── */}
      <div className="rounded-lg border border-slate-200 p-5 mb-5" style={{ backgroundColor: "#FAFBFC" }}>
        <div className="font-syne mb-1" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Other Documents <span style={{ fontWeight: 400, color: "#94A3B8" }}>(optional)</span></div>
        <div className="font-dm mb-3" style={{ fontSize: 12, color: "#64748B" }}>
          Attach any extra reference documents (lab tests, certifications, special agreements).
        </div>
        <div className="flex flex-col gap-2 max-w-md">
          <input
            value={otherLabel}
            onChange={(e) => setOtherLabel(e.target.value)}
            placeholder="Document name (e.g. Lab Test Cert)"
            className="form-input-sm"
          />
          <UploadSlot
            label="Upload any other document"
            help="Label it above so it's searchable later"
            files={otherDocs}
            onAdd={(f) => addOtherDoc(f, otherLabel || "Other document")}
            onRemove={(id) => setOtherDocs((prev) => prev.filter((d) => d.id !== id))}
            compact
          />
        </div>
      </div>

      {/* Verification checklist */}
      <div className="rounded-lg p-4 mb-5" style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
        <div className="font-syne mb-3" style={{ fontSize: 13, fontWeight: 700, color: "#1E3A8A", letterSpacing: 0.4 }}>VERIFICATION CHECKLIST</div>
        <div className="flex flex-col gap-2">
          <Check label="PO document verified and matches client's quotation" checked={checks.verified} onChange={(v) => setChecks((p) => ({ ...p, verified: v }))} />
          <Check label="Product specifications & quantities match" checked={checks.matches} onChange={(v) => setChecks((p) => ({ ...p, matches: v }))} />
          <Check label="Payment terms confirmed with client" checked={checks.terms} onChange={(v) => setChecks((p) => ({ ...p, terms: v }))} />
          {/* Per-product sketch status summary */}
          <div className="rounded-md p-2 font-dm flex flex-col gap-1" style={{ backgroundColor: allSketchesAttached ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${allSketchesAttached ? "#86EFAC" : "#FECACA"}`, fontSize: 11 }}>
            <span style={{ fontWeight: 700, color: allSketchesAttached ? "#15803D" : "#991B1B" }}>
              {allSketchesAttached ? "✅" : "❌"} Sketches / Drawings ({productSketches.filter((s) => s.length > 0).length}/{inquiry.products.length} attached)
            </span>
            {inquiry.products.map((p, i) => (
              <span key={p.id} style={{ color: productSketches[i]?.length > 0 ? "#15803D" : "#991B1B", paddingLeft: 8 }}>
                {productSketches[i]?.length > 0 ? "✓" : "○"} Filter #{i + 1} {p.filterName ?? p.type}: {productSketches[i]?.[0]?.name ?? "not attached"}
              </span>
            ))}
          </div>
          {/* Downpayment confirmation — only shown if downpayment % was set on the inquiry */}
          {dpRequired && (
            <div className="flex flex-col gap-1">
              {inquiry.downpaymentConfirmed ? (
                <div className="flex items-center gap-2 font-dm" style={{ fontSize: 13, color: "#15803D" }}>
                  <CheckCircle2 size={14} style={{ color: "#16A34A" }} />
                  <span style={{ fontWeight: 700 }}>Downpayment received &amp; confirmed</span>
                  <span className="font-dm px-1.5 py-0.5 rounded-full" style={{ fontSize: 10, backgroundColor: "#DCFCE7", color: "#166534" }}>
                    {inquiry.downpaymentPercent}%{inquiry.downpaymentAmount ? ` · ₱${inquiry.downpaymentAmount.toLocaleString("en-PH")}` : ""}
                  </span>
                </div>
              ) : (
                <div className="rounded-md p-2" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
                  <div className="font-dm mb-1" style={{ fontSize: 11, fontWeight: 700, color: "#92400E" }}>
                    ⚠️ Downpayment required before JO generation: {inquiry.downpaymentPercent}%{inquiry.downpaymentAmount ? ` = ₱${inquiry.downpaymentAmount.toLocaleString("en-PH")}` : ""}
                  </div>
                  <Check
                    label="Downpayment proof received and confirmed by accounting"
                    checked={checks.dpConfirmed}
                    onChange={(v) => setChecks((p) => ({ ...p, dpConfirmed: v }))}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation summary */}
      <div className="rounded-lg p-5 mb-1" style={{ backgroundColor: "#1A2B4A", color: "white" }}>
        <div className="flex items-center gap-2 mb-3">
          <Factory size={18} style={{ color: "#C8102E" }} />
          <span className="font-syne" style={{ fontSize: 16, fontWeight: 700 }}>Generate Job Order</span>
        </div>
        <div className="font-dm text-white/70 mb-3" style={{ fontSize: 12 }}>Unsaved JO configuration for:</div>
        <div className="grid grid-cols-2 gap-y-2 gap-x-6 font-dm" style={{ fontSize: 13 }}>
          <Detail label="Client" value={inquiry.clientName} />
          <Detail label="PO" value={poNumberForDisplay(inquiry) ?? inquiry.code} mono />
          <Detail label="Items" value={summary || `${inquiry.products.length} products`} span2 />
          <Detail label="Total Qty" value={String(totalQty)} />
          <Detail label="Payment" value={inquiry.paymentTerms} />
        </div>
        <div className="mt-4 pt-3 border-t border-white/10 font-dm text-white/70" style={{ fontSize: 12 }}>
          Backend integration pending. This configuration is unsaved; no Job Order, inventory deduction, or notification will be created.
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 mt-5 border-t border-slate-200">
        <button onClick={onClose} className="font-dm px-4 py-2 rounded-md hover:bg-slate-100" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={!allChecked}
          className="font-dm px-5 py-2.5 rounded-md text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.4 }}
        >
          <CheckCircle2 size={15} strokeWidth={2.5} /> CONFIRM &amp; GENERATE JO
        </button>
      </div>

      {/* Fullscreen PO Preview */}
      {poFullscreen && poFile && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
          onClick={() => setPoFullscreen(false)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-3xl overflow-auto p-8 flex flex-col items-center gap-4"
            style={{ maxHeight: "92vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between mb-2">
              <span className="font-syne" style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>📄 {poFile}</span>
              <button onClick={() => setPoFullscreen(false)} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <div className="bg-white border border-slate-300 rounded-lg shadow-xl p-10 w-full" style={{ minHeight: 500 }}>
              <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-slate-800">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#1A2B4A" }}>
                  <span style={{ color: "#C8102E", fontSize: 20, fontWeight: 800 }}>▲</span>
                </div>
                <div>
                  <div className="font-syne" style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>PO REFERENCE SUMMARY — ORIGINAL FILE UNAVAILABLE</div>
                  <div className="font-mono-jb" style={{ fontSize: 12, color: "#64748B" }}>{poFile}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6 mb-6">
                {([["Client", inquiry.clientName], ["Contact", inquiry.contactPerson], ["Payment Terms", inquiry.paymentTerms], ["Date Submitted", inquiry.submittedDate]] as [string, string][]).map(([k, v]) => (
                  <div key={k}>
                    <div className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.4 }}>{k}</div>
                    <div className="font-dm mt-1" style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 pt-4">
                <div className="font-syne mb-3" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>ORDER ITEMS</div>
                <div className="flex flex-col gap-2">
                  {inquiry.products.map((p, i) => (
                    <div key={p.id} className="rounded-lg px-4 py-3 border border-slate-200" style={{ backgroundColor: "#F8FAFC" }}>
                      <div className="font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>#{i + 1} {p.filterName || p.type}{p.oem ? ` · ${p.oem}` : ""}</div>
                      <div className="font-dm mt-0.5" style={{ fontSize: 12, color: "#64748B" }}>
                        {[p.od1 && `OD ${p.od1}mm`, p.id1 && `ID ${p.id1}mm`, p.height && `H ${p.height}mm`, p.media].filter(Boolean).join(" · ")}
                      </div>
                      <div className="font-syne mt-1" style={{ fontSize: 13, fontWeight: 700, color: "#C8102E" }}>Qty: {p.qty} pcs</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200 font-dm" style={{ fontSize: 12, color: "#94A3B8", textAlign: "center" }}>
                This is a simulated PO viewer. In production, the actual uploaded PDF/image file is displayed here.
              </div>
            </div>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function UploadSlot({ label, help, files, onAdd, onRemove, compact }: {
  label: string; help: string; files: UploadedDoc[];
  onAdd: (f: File) => void; onRemove: (id: string) => void; compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors hover:bg-white"
        style={{ border: "2px dashed #CBD5E1", backgroundColor: "white", padding: compact ? "12px" : "16px" }}>
        <Paperclip size={16} style={{ color: "#64748B" }} />
        <span className="font-dm text-center" style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>📎 {label}</span>
        {!compact && <span className="font-dm text-center" style={{ fontSize: 11, color: "#94A3B8" }}>{help}</span>}
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onAdd(f);
            e.currentTarget.value = "";
          }}
        />
      </label>
      {files.map((f) => (
        <div key={f.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 bg-white border border-slate-200">
          <FileText size={14} style={{ color: "#C8102E" }} />
          <div className="flex-1 min-w-0">
            <div className="font-dm truncate" style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{f.label ? `${f.label} · ` : ""}{f.name}</div>
            <div className="font-dm" style={{ fontSize: 10, color: "#94A3B8" }}>{(f.size / 1024).toFixed(1)} KB · {f.ts}</div>
          </div>
          <button onClick={() => onRemove(f.id)} aria-label="Remove" className="w-6 h-6 rounded hover:bg-slate-100 flex items-center justify-center" style={{ color: "#64748B" }}>
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: "#1D4ED8" }} />
      <span className="font-dm" style={{ fontSize: 13, color: "#1E3A8A" }}>{label}</span>
    </label>
  );
}

function Detail({ label, value, span2, mono }: { label: string; value: string; span2?: boolean; mono?: boolean }) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <div className="font-dm text-white/50" style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</div>
      <div className={`mt-0.5 ${mono ? "font-mono-jb" : "font-dm"} text-white`} style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

/* ---- shared bits ---- */
function ModalShell({ title, subtitle, onClose, children, size = "md" }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; size?: "md" | "lg" }) {
  const max = size === "lg" ? "max-w-5xl" : "max-w-lg";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.5)" }} onClick={onClose}>
      <div className={`bg-white rounded-xl w-full ${max} max-h-[90vh] flex flex-col`} style={{ boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between">
          <div>
            <h3 className="font-syne" style={{ fontSize: 18, fontWeight: 700, color: "#0F172A" }}>{title}</h3>
            {subtitle && <p className="font-dm mt-0.5" style={{ fontSize: 12, color: "#64748B" }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="p-6 overflow-auto">{children}</div>
      </div>
      <style>{`
        .form-input { font-family: "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 13px; padding: 10px 12px; border: 1px solid #E2E8F0; border-radius: 6px; outline: none; width: 100%; background: white; }
        .form-input:focus { border-color: #94A3B8; }
        .form-input-sm { font-family: "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 13px; padding: 8px 10px; border: 1px solid #E2E8F0; border-radius: 6px; outline: none; width: 100%; background: white; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</label>
      {children}
    </div>
  );
}

/* ─── Management: New Inquiry Modal ─── */

function OperationsProductSketch({ product }: { inquiryId: string; productId: string; product: ProductLine }) {
  return <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm">Sketch preview unavailable from the Sales API. {product.sketchFileName || "No file metadata returned."}</p>;
}

function DraftTab({ active, children }: { active: boolean; children: React.ReactNode }) {
  const [visited, setVisited] = useState(active);
  useEffect(() => { if (active) setVisited(true); }, [active]);
  return <div hidden={!active}>{(active || visited) && children}</div>;
}
