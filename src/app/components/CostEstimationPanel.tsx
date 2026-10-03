import { useState, useMemo, useEffect } from "react";
import { Pencil, Plus, Sparkles, Trash2, Info } from "lucide-react";
import { toast } from "sonner";
import {
  useMaterials,
  partCategoryMeta,
  computeUnitPrice,
  autofillBOMForType,
  type PartCategory,
  type BOMLine,
  type CostConfig,
  type RawMaterial,
} from "../store/materials";
import type { Inquiry, ProductLine } from "../store/orders";
import { GROUP_TEMPLATES, groupForType, PART_TO_CATEGORY } from "../store/filterTemplates";

/* Categories shown in the chip list — O-Ring and Gasket are now distinct (Section B5). Packaging stays excluded. */
const STANDARD_PART_CATEGORIES: PartCategory[] = [
  "filter_media",
  "endcap",
  "inner_core",
  "outer_core",
  "bonding_adhesive",
  "oring",
  "gasket",
];

/* Reference values shown in the ⓘ tooltip per filter part */
const REFERENCE_NOTES: Partial<Record<PartCategory, string>> = {
  filter_media:
    "Reference — Air Filter Small: ~0.5 kg/filter\nMedium: ~1.0 kg/filter\nLarge: ~3.3 kg/filter\nPocket Bag (depth × pockets ÷ 1000): meters per filter",
  endcap:
    "Reference — Small Air Filter: ~0.020 plates/filter\nMedium: ~0.031 plates/filter\nLarge: ~0.125 plates/filter\nGI 60mm frame: ~0.05 plates/filter (~20 frames per 1220mm plate)",
  inner_core:
    "Reference — Small Air Filter: ~0.083 plates/filter\nMedium: ~0.125 plates/filter\nLarge: ~0.5 plates/filter",
  outer_core:
    "Reference — Small Air Filter: ~0.111 plates/filter\nMedium: ~0.167 plates/filter\nLarge: ~0.5 plates/filter",
  bonding_adhesive:
    "Reference — Small Air Filter: ~0.04 gal/filter (25 filters per gallon)\nMedium: ~0.05 gal (20 per gal)\nLarge: ~0.17 gal (6 per gal)",
  oring:
    "Reference — Air Filter: 0–2 pcs depending on design",
  gasket:
    "Reference — Pocket Bag: 2 pcs (TOP & BOTTOM)",
};

interface Props {
  inquiry: Inquiry;
  qty: number;
  /* Returns the final BOM + cost config + computed prices when user clicks "Apply to Quotation" */
  onApply: (data: { bom: BOMLine[]; costConfig: CostConfig; unitPrice: number; total: number; productIndex: number }) => void;
}

export function CostEstimationPanel({ inquiry, qty, onApply }: Props) {
  const { rawMaterials, templates, findBOMTemplate } = useMaterials();
  const [activeProductIndex, setActiveProductIndex] = useState(0);
  const product = inquiry.products[activeProductIndex] ?? inquiry.products[0];
  const filterType = product?.type ?? "Air Filter";
  const size = inferSize(product);

  /* Initial BOM: from existing inquiry, else from matching template, else seeded from the group's mandatory parts (Section A5). */
  const initial = useMemo(() => {
    const savedProductBom = inquiry.productsBillOfMaterials?.[activeProductIndex];
    if (savedProductBom && savedProductBom.length > 0) return savedProductBom;
    if (activeProductIndex === 0 && inquiry.billOfMaterials && inquiry.billOfMaterials.length > 0) return inquiry.billOfMaterials;
    const tpl = findBOMTemplate(filterType, size);
    if (tpl) return tpl.bom;
    const auto = autofillBOMForType(filterType, size, {
      depthMm: num(product?.depth),
      pockets: num(product?.pocketCount),
      heightMm: num(product?.height),
    }, rawMaterials).map((x) => x.line);
    if (auto.length > 0) return auto;
    /* Seed from filter group template: pick the first available material per mandatory part category. */
    const group = groupForType(filterType);
    const required = GROUP_TEMPLATES[group].parts.always;
    const seeded: BOMLine[] = [];
    required.forEach((partKey) => {
      const cat = PART_TO_CATEGORY[partKey] as PartCategory | undefined;
      if (!cat) return;
      const mat = rawMaterials.find((m) => m.category === cat);
      if (mat) seeded.push({ materialId: mat.id, partCategory: cat, qtyConsumed: 0 });
    });
    return seeded;
  }, [activeProductIndex, filterType, size, inquiry, findBOMTemplate, product, rawMaterials]);

  const [bom, setBom] = useState<BOMLine[]>(initial);
  const [cfg, setCfg] = useState<CostConfig>(
    inquiry.productsCostConfig?.[activeProductIndex] ?? inquiry.costConfig ?? {
      laborCost: 380,
      markupPct: 30,
      vatType: "Exclusive",
      vatRate: 12,
      includeLabor: true,
      applyMarkup: true,
      applyVAT: true,
    }
  );
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState(0);
  /* Section I — tplName/showSaveTpl state removed */

  const matchingTemplate = findBOMTemplate(filterType, size);
  const computed = computeUnitPrice(bom, cfg, rawMaterials);
  const selectedQty = product?.qty ?? qty;
  const orderTotal = computed.withVat * selectedQty;

  useEffect(() => {
    setBom(initial);
    setCfg(inquiry.productsCostConfig?.[activeProductIndex] ?? inquiry.costConfig ?? {
      laborCost: 380,
      markupPct: 30,
      vatType: "Exclusive",
      vatRate: 12,
      includeLabor: true,
      applyMarkup: true,
      applyVAT: true,
    });
  }, [activeProductIndex, initial, inquiry.productsCostConfig, inquiry.costConfig]);

  /* All materials referenced by the current BOM (for the left "Raw Materials" panel) */
  const bomMaterials = bom
    .map((line) => rawMaterials.find((m) => m.id === line.materialId))
    .filter(Boolean) as RawMaterial[];

  const updateLine = (idx: number, patch: Partial<BOMLine>) => {
    setBom((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const removeLine = (idx: number) => {
    setBom((prev) => prev.filter((_, i) => i !== idx));
  };

  const addLine = (category: PartCategory) => {
    /* Add the first available material in that category */
    const candidate = rawMaterials.find((m) => m.category === category);
    if (!candidate) return;
    setBom((prev) => [...prev, { materialId: candidate.id, partCategory: category, qtyConsumed: 0 }]);
  };

  const handleApplyTemplate = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    setBom(tpl.bom);
    setCfg(tpl.costConfig);
    toast.success(`Loaded template: ${tpl.name}`);
  };

  /* Section I — handleSaveTemplate removed (Save Configuration as Template feature deprecated) */

  const handleApply = () => {
    onApply({
      bom,
      costConfig: cfg,
      unitPrice: computed.withVat,
      total: orderTotal,
      productIndex: activeProductIndex,
    });
    toast.success("Cost configuration applied to quotation");
  };

  return (
    <div className="flex flex-col gap-4">
      {inquiry.products.length > 1 && (
        <div className="rounded-lg p-3 flex flex-wrap items-center gap-2" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
          <span className="font-dm mr-1" style={{ fontSize: 11, fontWeight: 800, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Product</span>
          {inquiry.products.map((p, idx) => (
            <button
              key={p.id}
              onClick={() => setActiveProductIndex(idx)}
              className="font-dm px-3 py-1.5 rounded-md"
              style={{ fontSize: 12, fontWeight: 700, backgroundColor: idx === activeProductIndex ? "#1A2B4A" : "white", color: idx === activeProductIndex ? "white" : "#475569", border: "1px solid #CBD5E1" }}
            >
              #{idx + 1} {p.filterName || p.type} · {p.qty} pcs
            </button>
          ))}
        </div>
      )}
      {/* Suggestion banner */}
      {matchingTemplate && initial !== matchingTemplate.bom && (
        <div className="rounded-lg p-3 flex items-center gap-3" style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
          <Sparkles size={16} style={{ color: "#1D4ED8" }} />
          <span className="font-dm flex-1" style={{ fontSize: 12, color: "#1E40AF" }}>
            <strong>Based on similar past orders:</strong> {matchingTemplate.name}
          </span>
          <button
            onClick={() => handleApplyTemplate(matchingTemplate.id)}
            className="font-dm px-3 py-1 rounded-md text-white hover:opacity-90"
            style={{ fontSize: 11, fontWeight: 700, backgroundColor: "#2563EB" }}
          >
            Use this template
          </button>
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {/* ─────────── LEFT PANEL — Raw Materials in this BOM ─────────── */}
        <div className="rounded-xl border border-slate-200 overflow-hidden" style={{ backgroundColor: "white" }}>
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between" style={{ backgroundColor: "#F8FAFC" }}>
            <div className="flex items-center gap-2">
              <h4 className="font-syne" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Raw Materials</h4>
              <span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: "#E2E8F0", color: "#475569" }}>{bom.length} parts</span>
            </div>
            <span className="font-dm" style={{ fontSize: 11, color: "#94A3B8", fontStyle: "italic" }}>
              Fill quantities manually · hover ⓘ for reference values
            </span>
          </div>

          {/* Filter Part rows */}
          <div className="flex flex-col">
            {bom.length === 0 && (
              <div className="px-4 py-6 text-center font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>
                No filter parts yet. Add parts using the chips below — staff enters quantities manually.
              </div>
            )}
            {bom.map((line, idx) => {
              const m = rawMaterials.find((mm) => mm.id === line.materialId);
              if (!m) return null;
              const cost = m.unitPrice * line.qtyConsumed;
              const cat = partCategoryMeta[line.partCategory];
              const inEdit = editingPriceId === m.id;
              const refNote = REFERENCE_NOTES[line.partCategory];
              return (
                <div key={idx} className="px-4 py-3 border-t border-slate-100 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-dm px-1.5 py-0.5 rounded-full inline-flex items-center gap-1" style={{ fontSize: 9, fontWeight: 700, backgroundColor: "#F1F5F9", color: "#475569", letterSpacing: 0.4, textTransform: "uppercase" }}>
                      {cat.icon} {cat.label}
                    </span>
                    {refNote && (
                      <span className="relative group inline-flex items-center" tabIndex={0}>
                        <Info size={12} style={{ color: "#94A3B8", cursor: "help" }} />
                        <span
                          role="tooltip"
                          className="absolute left-5 top-0 z-20 hidden group-hover:block group-focus-within:block whitespace-pre rounded-md p-2.5 font-dm"
                          style={{ fontSize: 11, color: "#1E40AF", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", boxShadow: "0 4px 12px rgba(15,23,42,0.1)", minWidth: 240, lineHeight: 1.5 }}
                        >
                          {refNote}
                        </span>
                      </span>
                    )}
                    <button onClick={() => removeLine(idx)} className="ml-auto text-slate-400 hover:text-red-500" title="Remove this part"><Trash2 size={12} /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={line.materialId}
                      onChange={(e) => updateLine(idx, { materialId: e.target.value })}
                      className="font-dm flex-1 px-2 py-1.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white"
                      style={{ fontSize: 12 }}
                    >
                      {rawMaterials
                        .filter((mat) => mat.category === line.partCategory)
                        .map((mat) => (
                          <option key={mat.id} value={mat.id}>{mat.name} (₱{mat.unitPrice}/{mat.unit})</option>
                        ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <span className="font-dm" style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Qty</span>
                      <input
                        type="number" step="0.001" value={line.qtyConsumed}
                        onChange={(e) => updateLine(idx, { qtyConsumed: Number(e.target.value) })}
                        className="font-mono-jb px-2 py-1 rounded border border-slate-200 outline-none focus:border-slate-400 bg-white w-20"
                        style={{ fontSize: 12 }}
                      />
                      <span className="font-dm" style={{ fontSize: 11, color: "#475569" }}>{m.unit}/filter</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-dm" style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Price</span>
                      {inEdit ? (
                        <>
                          <input
                            type="number" value={editPrice}
                            onChange={(e) => setEditPrice(Number(e.target.value))}
                            className="font-mono-jb px-2 py-1 rounded border border-slate-200 outline-none focus:border-slate-400 bg-white w-24"
                            style={{ fontSize: 12 }}
                          />
                          <button
                            onClick={() => {
                              /* In a real backend this would PATCH the material; here we mutate via store action — but this demo allows price preview within the BOM. To keep it simple we just exit edit mode. */
                              toast("Price overrides are demo-only — go to Inventory to permanently change unit prices");
                              setEditingPriceId(null);
                            }}
                            className="font-dm px-2 py-0.5 rounded text-white"
                            style={{ fontSize: 10, fontWeight: 700, backgroundColor: "#16A34A" }}
                          >Save</button>
                        </>
                      ) : (
                        <>
                          <span className="font-mono-jb" style={{ fontSize: 12, color: "#0F172A" }}>₱{m.unitPrice}</span>
                          <button onClick={() => { setEditingPriceId(m.id); setEditPrice(m.unitPrice); }} className="text-slate-400 hover:text-slate-700"><Pencil size={10} /></button>
                        </>
                      )}
                    </div>
                    <div className="ml-auto font-syne" style={{ fontSize: 13, fontWeight: 700, color: "#C8102E" }}>
                      ₱{cost.toFixed(2)}
                    </div>
                  </div>
                  {line.wastePct !== undefined && (
                    <div className="flex items-center gap-1 font-dm" style={{ fontSize: 10, color: "#92400E" }}>
                      <Info size={10} /> Estimated waste: {line.wastePct.toFixed(2)}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Filter Part — only shows categories not yet added; falls back to custom input */}
          <AddPartFooter bom={bom} onAdd={addLine} />
        </div>

        {/* ─────────── RIGHT PANEL — Cost Estimation Setup ─────────── */}
        <div className="rounded-xl border border-slate-200 overflow-hidden" style={{ backgroundColor: "white" }}>
          <div className="px-4 py-3 border-b border-slate-200" style={{ backgroundColor: "#1A2B4A" }}>
            <h4 className="font-syne text-white" style={{ fontSize: 13, fontWeight: 700 }}>Cost Estimation Setup</h4>
            <p className="font-dm mt-0.5" style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>Labor + Markup · Discount before VAT</p>
          </div>
          <div className="p-4 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Labor Cost / Unit</label>
                <div className="flex items-center gap-1">
                  <span className="font-mono-jb" style={{ fontSize: 12, color: "#64748B" }}>₱</span>
                  <input type="number" value={cfg.laborCost} onChange={(e) => setCfg({ ...cfg, laborCost: Number(e.target.value) })} className="font-mono-jb flex-1 px-2 py-1.5 rounded border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Markup</label>
                <div className="flex items-center gap-1">
                  <input type="number" value={cfg.markupPct} onChange={(e) => setCfg({ ...cfg, markupPct: Number(e.target.value) })} className="font-mono-jb flex-1 px-2 py-1.5 rounded border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
                  <span className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>%</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <label className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Discount (%)</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={cfg.discountPct ?? 0}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setCfg({ ...cfg, discountPct: Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0 });
                    }}
                    className="font-mono-jb flex-1 px-2 py-1.5 rounded border border-slate-200 outline-none focus:border-slate-400 bg-white"
                    style={{ fontSize: 13 }}
                  />
                  <span className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>%</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>VAT Type</label>
                <select value={cfg.vatType} onChange={(e) => setCfg({ ...cfg, vatType: e.target.value as any })} className="font-dm px-2 py-1.5 rounded border border-slate-200 bg-white outline-none focus:border-slate-400" style={{ fontSize: 13, color: "#0F172A" }}>
                  <option value="Exclusive">Exclusive</option>
                  <option value="Inclusive">Inclusive</option>
                  <option value="Zero-Rated">Zero-Rated</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>VAT Rate</label>
                <div className="flex items-center gap-1">
                  <input type="number" value={cfg.vatRate} onChange={(e) => setCfg({ ...cfg, vatRate: Number(e.target.value) })} className="font-mono-jb flex-1 px-2 py-1.5 rounded border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
                  <span className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>%</span>
                </div>
              </div>
            </div>

            {/* Toggles */}
            <div className="rounded-lg p-3 flex flex-col gap-2" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <ToggleRow label="Include labor cost"  on={cfg.includeLabor} onChange={(v) => setCfg({ ...cfg, includeLabor: v })} />
              <ToggleRow label="Apply markup"        on={cfg.applyMarkup}  onChange={(v) => setCfg({ ...cfg, applyMarkup: v })} />
              <ToggleRow label="Apply VAT"           on={cfg.applyVAT}     onChange={(v) => setCfg({ ...cfg, applyVAT: v })} />
            </div>

            {/* Summary */}
            <div className="rounded-lg overflow-hidden" style={{ border: "1.5px solid #1A2B4A" }}>
              <div className="px-3 py-2 flex items-center justify-between font-dm" style={{ fontSize: 12, backgroundColor: "#F8FAFC" }}>
                <span style={{ color: "#475569", fontWeight: 600 }}>Material</span>
                <span className="font-mono-jb" style={{ color: "#0F172A", fontWeight: 700 }}>₱{computed.material.toFixed(2)}</span>
              </div>
              <div className="px-3 py-2 flex items-center justify-between font-dm border-t border-slate-100" style={{ fontSize: 12 }}>
                <span style={{ color: "#475569", fontWeight: 600 }}>Total Cost {cfg.applyMarkup ? "with markup" : ""}</span>
                <span className="font-mono-jb" style={{ color: "#0F172A", fontWeight: 700 }}>₱{computed.withMarkup.toFixed(2)}</span>
              </div>
              {(cfg.discountPct ?? 0) > 0 && (
                <div className="px-3 py-2 flex items-center justify-between font-dm border-t border-slate-100" style={{ fontSize: 12 }}>
                  <span style={{ color: "#475569", fontWeight: 600 }}>After {cfg.discountPct}% discount</span>
                  <span className="font-mono-jb" style={{ color: "#0F172A", fontWeight: 700 }}>₱{computed.afterDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="px-3 py-2.5 flex items-center justify-between font-dm border-t border-slate-200" style={{ fontSize: 13, backgroundColor: "#FEF2F2" }}>
                <span style={{ color: "#991B1B", fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", fontSize: 11 }}>With VAT</span>
                <span className="font-syne" style={{ fontSize: 18, fontWeight: 800, color: "#C8102E" }}>₱{computed.withVat.toFixed(2)}</span>
              </div>
              <div className="px-3 py-2 flex items-center justify-between font-dm border-t border-slate-100" style={{ fontSize: 11, backgroundColor: "#1A2B4A", color: "white" }}>
                <span style={{ opacity: 0.7 }}>× {selectedQty} pcs = Product Total</span>
                <span className="font-syne" style={{ fontSize: 16, fontWeight: 800 }}>₱{orderTotal.toLocaleString("en-PH", { maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              {/* Section I — "Save Configuration as Template" feature removed per spec */}
              <button onClick={handleApply} className="font-dm flex items-center justify-center gap-2 py-2.5 rounded-md text-white hover:opacity-90" style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.4 }}>
                Apply to Quotation →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── helpers ─────────── */

function inferSize(p?: ProductLine): "Large" | "Medium" | "Small" | undefined {
  if (!p?.height) return undefined;
  const h = parseFloat(p.height);
  if (isNaN(h)) return undefined;
  if (h >= 400) return "Large";
  if (h >= 200) return "Medium";
  return "Small";
}

function num(v?: string): number | undefined {
  if (!v) return undefined;
  const parsed = parseFloat(v);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function ToggleRow({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="font-dm" style={{ fontSize: 12, color: "#0F172A", fontWeight: 600 }}>{label}</span>
      <button
        onClick={() => onChange(!on)}
        className="relative w-9 h-5 rounded-full transition-colors"
        style={{ backgroundColor: on ? "#16A34A" : "#CBD5E1" }}
      >
        <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: on ? 18 : 2, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
      </button>
    </label>
  );
}

/* Add Filter Part — chips for unselected standard categories.
   When all standard categories are added, shows only a custom-part text input. */
function AddPartFooter({ bom, onAdd }: { bom: BOMLine[]; onAdd: (c: PartCategory) => void }) {
  const [customName, setCustomName] = useState("");
  const used = new Set(bom.map((l) => l.partCategory));
  const availableChips = STANDARD_PART_CATEGORIES.filter((c) => !used.has(c));
  const allStandardAdded = availableChips.length === 0;

  return (
    <div className="px-4 py-3 border-t border-slate-200" style={{ backgroundColor: "#F8FAFC" }}>
      <div className="font-dm mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.4, textTransform: "uppercase" }}>Add Filter Part</div>
      {allStandardAdded ? (
        <div className="flex items-center gap-2">
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Add custom part name (e.g. Heat Shield, Spacer)..."
            className="font-dm flex-1 px-3 py-1.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white"
            style={{ fontSize: 12 }}
          />
          <button
            disabled={!customName.trim()}
            onClick={() => {
              /* Custom parts go under endcap by default — staff can re-pick the material */
              onAdd("endcap");
              toast.info(`Custom part "${customName.trim()}" added — pick a material below`);
              setCustomName("");
            }}
            className="font-dm flex items-center gap-1 px-3 py-1.5 rounded-md text-white disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontSize: 11, fontWeight: 700, backgroundColor: "#1A2B4A" }}
          >
            <Plus size={11} /> Add Custom Part
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {availableChips.map((c) => (
            <button
              key={c}
              onClick={() => onAdd(c)}
              className="font-dm flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white"
              style={{ fontSize: 11, fontWeight: 600, color: "#475569", border: "1px dashed #CBD5E1" }}
            >
              <Plus size={11} /> {partCategoryMeta[c].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
