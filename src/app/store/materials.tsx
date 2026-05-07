import { createContext, useContext, useState, type ReactNode } from "react";

/* ─────────── Types ─────────── */

export type PartCategory =
  | "filter_media"
  | "endcap"
  | "inner_core"
  | "outer_core"
  | "bonding_adhesive"
  | "oring_gasket"
  | "packaging";

export const partCategoryMeta: Record<PartCategory, { label: string; icon: string }> = {
  filter_media:     { label: "Filter Media",        icon: "🧻" },
  endcap:           { label: "End Cap / Frame",     icon: "🔲" },
  inner_core:       { label: "Inner Core",          icon: "⚙️" },
  outer_core:       { label: "Outer Core",          icon: "⛓️" },
  bonding_adhesive: { label: "Bonding / Adhesive",  icon: "🧴" },
  oring_gasket:     { label: "O-Ring / Gasket",     icon: "⭕" },
  packaging:        { label: "Packaging",           icon: "📦" },
};

export type Unit = "roll" | "plate" | "sheet" | "kg" | "gal" | "pcs" | "set" | "m";

export interface AuditEntry {
  id: string;
  date: string;            // ISO timestamp
  user: string;            // "F. Santos · Warehouse" / "System (auto-deduct)"
  oldQty: number;
  newQty: number;
  reason: string;          // free-form / from preset list
  reference?: string;      // PO ref / JO number
}

export interface RawMaterial {
  id: string;
  name: string;
  category: PartCategory;
  unit: Unit;
  unitPrice: number;       // ₱ per unit
  qtyInStock: number;      // fractional
  threshold: number;
  supplier?: string;
  history: AuditEntry[];
}

export interface BOMLine {
  materialId: string;
  partCategory: PartCategory;
  qtyConsumed: number;     // per filter unit
  wastePct?: number;       // informational only
}

export type VatType = "Exclusive" | "Inclusive" | "Zero-Rated";

export interface CostConfig {
  laborCost: number;
  markupPct: number;
  vatType: VatType;
  vatRate: number;         // default 12
  includeLabor: boolean;
  applyMarkup: boolean;
  applyVAT: boolean;
}

export interface BOMTemplate {
  id: string;
  name: string;            // "Pocket Bag 610×610×560 8P"
  filterType: string;      // "Pocket Bag" | "Air Filter" | "Oil Separator" ...
  size?: "Large" | "Medium" | "Small";
  bom: BOMLine[];
  costConfig: CostConfig;
  notes?: string;
}

/* ─────────── Pure compute helpers ─────────── */

export function computeUnitPrice(
  bom: BOMLine[],
  cfg: CostConfig,
  materials: RawMaterial[]
): { material: number; total: number; withMarkup: number; withVat: number } {
  const material = bom.reduce((sum, line) => {
    const m = materials.find((mm) => mm.id === line.materialId);
    if (!m) return sum;
    return sum + m.unitPrice * line.qtyConsumed;
  }, 0);
  const total = material + (cfg.includeLabor ? cfg.laborCost : 0);
  const withMarkup = cfg.applyMarkup ? total * (1 + cfg.markupPct / 100) : total;
  let withVat = withMarkup;
  if (cfg.applyVAT) {
    if (cfg.vatType === "Exclusive") withVat = withMarkup * (1 + cfg.vatRate / 100);
    /* Inclusive / Zero-Rated leave the value as-is (Inclusive: VAT already inside; Zero-Rated: no VAT) */
  }
  return { material, total, withMarkup, withVat };
}

/**
 * Auto-fill BOM lines for a given filter type + size based on the formulas
 * spec'd by the client. Returns suggestions; staff can override any value.
 */
export function autofillBOMForType(
  filterType: string,
  size: "Large" | "Medium" | "Small" | undefined,
  dims: { depthMm?: number; pockets?: number },
  materials: RawMaterial[]
): { line: BOMLine; note?: string }[] {
  const find = (cat: PartCategory, hint?: string) =>
    materials.find((m) => m.category === cat && (!hint || m.name.toLowerCase().includes(hint.toLowerCase())));

  const out: { line: BOMLine; note?: string }[] = [];

  if (filterType.toLowerCase().includes("pocket bag")) {
    /* Filter media: meters per filter = depth × pockets */
    const depth = dims.depthMm ?? 560;
    const pockets = dims.pockets ?? 8;
    const meters = (depth / 1000) * pockets;
    const rollLength = 100;
    const filtersPerRoll = Math.floor(rollLength / meters);
    const wastePct = ((rollLength - filtersPerRoll * meters) / rollLength) * 100;
    const media = find("filter_media", "F8");
    if (media) {
      out.push({
        line: { materialId: media.id, partCategory: "filter_media", qtyConsumed: meters, wastePct },
        note: `${meters.toFixed(2)} m per filter · ${filtersPerRoll} filters per 100m roll · waste ${wastePct.toFixed(2)}%`,
      });
    }
    /* Frame: 60mm width from 1220×2440 plate */
    const frame = find("endcap", "GI Frame") ?? find("endcap", "GI Steel");
    if (frame) {
      const framesPerPlate = Math.floor(1220 / 60);
      const plates = 1 / framesPerPlate;
      const fwaste = ((1220 - framesPerPlate * 60) / 1220) * 100;
      out.push({
        line: { materialId: frame.id, partCategory: "endcap", qtyConsumed: plates, wastePct: fwaste },
        note: `${framesPerPlate} frames per plate · waste ${fwaste.toFixed(2)}%`,
      });
    }
  } else if (filterType.toLowerCase().includes("air filter")) {
    const sz = size ?? "Medium";
    /* Filter media kg */
    const mediaKg = sz === "Large" ? 3.3 : sz === "Small" ? 0.5 : 1.0;
    const media = find("filter_media", "Cellulose");
    if (media) out.push({ line: { materialId: media.id, partCategory: "filter_media", qtyConsumed: mediaKg } });

    /* Adhesive */
    const adh = sz === "Large" ? 1 / 6 : sz === "Small" ? 1 / 25 : 1 / 20;
    const adhMat = find("bonding_adhesive", "Polyurethane");
    if (adhMat) out.push({ line: { materialId: adhMat.id, partCategory: "bonding_adhesive", qtyConsumed: adh }, note: `${(1 / adh).toFixed(0)} filters per gallon` });

    /* Inner core */
    const inner = sz === "Large" ? 1 / 2 : sz === "Small" ? 1 / 12 : 1 / 8;
    const innerMat = find("inner_core", "Expanded Metal");
    if (innerMat) out.push({ line: { materialId: innerMat.id, partCategory: "inner_core", qtyConsumed: inner } });

    /* Outer core */
    const outer = sz === "Large" ? 1 / 2 : sz === "Small" ? 1 / 9 : 1 / 6;
    const outerMat = find("outer_core", "Perforated");
    if (outerMat) out.push({ line: { materialId: outerMat.id, partCategory: "outer_core", qtyConsumed: outer } });

    /* End cap (caps per plate) */
    const endcap = sz === "Large" ? 1 / 8 : sz === "Small" ? 1 / 50 : 1 / 32;
    const capMat = find("endcap", "GI Steel") ?? find("endcap", "GI Plate");
    if (capMat) out.push({ line: { materialId: capMat.id, partCategory: "endcap", qtyConsumed: endcap }, note: `${(1 / endcap).toFixed(0)} caps per plate` });
  }

  return out;
}

/* ─────────── Seed data ─────────── */

const MAT = (
  id: string,
  name: string,
  category: PartCategory,
  unit: Unit,
  unitPrice: number,
  qtyInStock: number,
  threshold: number,
  supplier?: string
): RawMaterial => ({ id, name, category, unit, unitPrice, qtyInStock, threshold, supplier, history: [] });

const seedMaterials: RawMaterial[] = [
  /* Filter Media */
  MAT("fm-f8",       "F8 Yellow (Pocket Bag)",          "filter_media", "roll", 8500, 4.5, 5,  "Local"),
  MAT("fm-mglass",   "Microglass Fiber / Inside",        "filter_media", "roll", 6200, 3.2, 5),
  MAT("fm-cell",     "Cellulose Paper (Air Filter)",     "filter_media", "kg",    180, 22.5, 10),
  MAT("fm-fglass",   "Fiberglass H13 (Column / HEPA)",   "filter_media", "roll", 12000, 2.0, 3),
  MAT("fm-nomex",    "NOMEX (Dust Collector)",           "filter_media", "roll", 15000, 1.5, 2),
  MAT("fm-pp100",    "PP 100 MIC (Dust Collector)",      "filter_media", "roll", 4500,  3.0, 3),

  /* End Cap / Frame */
  MAT("ec-gi06",     "GI Steel Plate 1220×2440mm, 0.6mm T", "endcap", "plate",  850, 18, 5),
  MAT("ec-eg10",     "EG Plate 1.0mm T",                    "endcap", "plate",  920, 12, 5),
  MAT("ec-eg15",     "EG Plate 1.5mm T",                    "endcap", "plate", 1050,  8, 5),
  MAT("ec-frame60",  "GI Frame Stock (60mm std)",           "endcap", "plate",  780, 15, 5),

  /* Inner Core / Outer Core */
  MAT("ic-expmet",   "Expanded Metal Perfo 2mm T",          "inner_core", "plate", 650, 10, 4),
  MAT("ic-perf3",    "Perforated Steel 3mm Ø, 0.6mm T",     "inner_core", "plate", 580, 14, 4),
  MAT("oc-perf6",    "Perfo 6mm Ø × 0.6mm T (Outer)",       "outer_core", "plate", 610,  9, 4),
  MAT("ic-tin06",    "Tin Plate 0.6mm T",                   "inner_core", "plate", 490,  6, 3),

  /* Bonding / Adhesive */
  MAT("ba-pu",       "Polyurethane Adhesive",               "bonding_adhesive", "gal", 1200, 2.5, 3),
  MAT("ba-epoxy",    "Epoxy Resin (oil-resistant)",         "bonding_adhesive", "set",  950, 2,   3),

  /* O-Ring / Gasket */
  MAT("og-nbr",      "Nitrile Rubber O-Ring (NBR)",         "oring_gasket", "pcs", 35, 145, 50),
  MAT("og-green",    "Gasket — Green (TOP, standard)",      "oring_gasket", "pcs", 42,  80, 30),
  MAT("og-felt",     "Mechanical Felt Gasket",              "oring_gasket", "pcs", 28,  60, 30),

  /* Packaging */
  MAT("pk-std",      "Corrugated Box (standard)",            "packaging", "pcs",  85, 38, 50),
  MAT("pk-large",    "Corrugated Box (large)",               "packaging", "pcs", 120, 22, 20),
];

/* Pre-saved BOM templates */
const seedTemplates: BOMTemplate[] = [
  {
    id: "tpl-pocket-610",
    name: "Pocket Bag — 610×610×560mm, 8 pockets",
    filterType: "Pocket Bag",
    bom: [
      { materialId: "fm-f8",     partCategory: "filter_media", qtyConsumed: 4.48, wastePct: 1.44 },
      { materialId: "ec-frame60", partCategory: "endcap",      qtyConsumed: 0.05, wastePct: 1.64 },
    ],
    costConfig: { laborCost: 450, markupPct: 30, vatType: "Inclusive", vatRate: 12, includeLabor: true, applyMarkup: true, applyVAT: true },
    notes: "Allied Pharma standard recipe",
  },
  {
    id: "tpl-air-large",
    name: "Air Filter — Large (488×328×490mm)",
    filterType: "Air Filter",
    size: "Large",
    bom: [
      { materialId: "fm-cell",   partCategory: "filter_media",     qtyConsumed: 3.3 },
      { materialId: "ic-expmet", partCategory: "inner_core",       qtyConsumed: 0.5 },
      { materialId: "oc-perf6",  partCategory: "outer_core",       qtyConsumed: 0.5 },
      { materialId: "ec-gi06",   partCategory: "endcap",           qtyConsumed: 0.125 },
      { materialId: "ba-pu",     partCategory: "bonding_adhesive", qtyConsumed: 0.17 },
    ],
    costConfig: { laborCost: 380, markupPct: 25, vatType: "Exclusive", vatRate: 12, includeLabor: true, applyMarkup: true, applyVAT: true },
    notes: "B.E. Aerospace standard recipe",
  },
  {
    id: "tpl-air-small",
    name: "Air Filter — Small (203×76×292mm)",
    filterType: "Air Filter",
    size: "Small",
    bom: [
      { materialId: "fm-cell",   partCategory: "filter_media",     qtyConsumed: 0.5 },
      { materialId: "ic-expmet", partCategory: "inner_core",       qtyConsumed: 0.083 },
      { materialId: "oc-perf6",  partCategory: "outer_core",       qtyConsumed: 0.111 },
      { materialId: "ec-gi06",   partCategory: "endcap",           qtyConsumed: 0.020 },
      { materialId: "ba-pu",     partCategory: "bonding_adhesive", qtyConsumed: 0.04 },
    ],
    costConfig: { laborCost: 150, markupPct: 20, vatType: "Exclusive", vatRate: 12, includeLabor: true, applyMarkup: true, applyVAT: true },
    notes: "ASL Printing standard recipe",
  },
];

/* ─────────── Backward-compat: legacy MaterialKey for old code paths ─────────── */

export type MaterialKey = "mediaLocal" | "mediaImported" | "adhesive" | "box";
export interface Material {
  key: MaterialKey;
  label: string;
  unit: string;
  available: number;
  threshold: number;
  leadTime: string;
}

/** Legacy-shape view derived from the new raw-material list — kept for any
 *  remaining code paths that still consume the old 4-card grid. */
function deriveLegacy(rm: RawMaterial[]): Material[] {
  const byId: Record<MaterialKey, string> = {
    mediaLocal:    "fm-f8",
    mediaImported: "fm-fglass",
    adhesive:      "ba-pu",
    box:           "pk-std",
  };
  const meta: Record<MaterialKey, { label: string; leadTime: string }> = {
    mediaLocal:    { label: "Filter Media (Local)",    leadTime: "Next day" },
    mediaImported: { label: "Filter Media (Imported)", leadTime: "Months (customs)" },
    adhesive:      { label: "Adhesive",                leadTime: "Next day" },
    box:           { label: "Corrugated Box",          leadTime: "~2 weeks" },
  };
  return (Object.keys(byId) as MaterialKey[]).map((k) => {
    const m = rm.find((x) => x.id === byId[k])!;
    return { key: k, label: meta[k].label, unit: m.unit, available: Math.floor(m.qtyInStock), threshold: m.threshold, leadTime: meta[k].leadTime };
  });
}

/* ─────────── Context ─────────── */

interface Ctx {
  rawMaterials: RawMaterial[];
  templates: BOMTemplate[];
  /* Legacy compat */
  materials: Material[];
  get: (k: MaterialKey) => Material;
  /* Actions */
  updateStock: (id: string, newQty: number, reason: string, reference?: string, by?: string) => void;
  addMaterial: (m: Omit<RawMaterial, "id" | "history">) => void;
  saveBOMTemplate: (t: Omit<BOMTemplate, "id">) => string;
  findBOMTemplate: (filterType: string, size?: string) => BOMTemplate | undefined;
  /* JO lifecycle */
  deductForJO: (joNumber: string, bom: BOMLine[], by?: string) => { ok: boolean; shortages: { name: string; needed: number; available: number; unit: string }[] };
  restoreFromJO: (joNumber: string, bom: BOMLine[], by?: string) => void;
}

const MaterialsContext = createContext<Ctx | null>(null);

export function MaterialsProvider({ children }: { children: ReactNode }) {
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>(seedMaterials);
  const [templates, setTemplates] = useState<BOMTemplate[]>(seedTemplates);

  const stamp = (by: string) => ({
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date: new Date().toISOString(),
    user: by,
  });

  const updateStock: Ctx["updateStock"] = (id, newQty, reason, reference, by = "F. Santos · Warehouse") => {
    setRawMaterials((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const entry: AuditEntry = { ...stamp(by), oldQty: m.qtyInStock, newQty, reason, reference };
        return { ...m, qtyInStock: newQty, history: [entry, ...m.history] };
      })
    );
  };

  const addMaterial: Ctx["addMaterial"] = (m) => {
    const id = `mat-${Date.now()}`;
    setRawMaterials((prev) => [...prev, { ...m, id, history: [{ ...stamp("System"), oldQty: 0, newQty: m.qtyInStock, reason: "Initial stock added" }] }]);
  };

  const saveBOMTemplate: Ctx["saveBOMTemplate"] = (t) => {
    const id = `tpl-${Date.now()}`;
    setTemplates((prev) => [...prev, { ...t, id }]);
    return id;
  };

  const findBOMTemplate: Ctx["findBOMTemplate"] = (filterType, size) => {
    return templates.find(
      (t) =>
        t.filterType.toLowerCase() === filterType.toLowerCase() &&
        (size ? t.size === size : true)
    );
  };

  const deductForJO: Ctx["deductForJO"] = (joNumber, bom, by = "System (auto-deduct)") => {
    /* Pre-flight: gather shortages without mutating */
    const shortages: { name: string; needed: number; available: number; unit: string }[] = [];
    for (const line of bom) {
      const m = rawMaterials.find((x) => x.id === line.materialId);
      if (!m) continue;
      if (line.qtyConsumed > m.qtyInStock) {
        shortages.push({ name: m.name, needed: line.qtyConsumed, available: m.qtyInStock, unit: m.unit });
      }
    }
    if (shortages.length > 0) return { ok: false, shortages };

    setRawMaterials((prev) =>
      prev.map((m) => {
        const line = bom.find((b) => b.materialId === m.id);
        if (!line) return m;
        const newQty = Math.max(0, m.qtyInStock - line.qtyConsumed);
        const entry: AuditEntry = {
          ...stamp(by),
          oldQty: m.qtyInStock,
          newQty,
          reason: `Production used: ${joNumber} · ${line.qtyConsumed.toFixed(3)} ${m.unit}`,
          reference: joNumber,
        };
        return { ...m, qtyInStock: newQty, history: [entry, ...m.history] };
      })
    );
    return { ok: true, shortages: [] };
  };

  const restoreFromJO: Ctx["restoreFromJO"] = (joNumber, bom, by = "System") => {
    setRawMaterials((prev) =>
      prev.map((m) => {
        const line = bom.find((b) => b.materialId === m.id);
        if (!line) return m;
        const newQty = m.qtyInStock + line.qtyConsumed;
        const entry: AuditEntry = {
          ...stamp(by),
          oldQty: m.qtyInStock,
          newQty,
          reason: `Returned to stock — JO cancelled (${joNumber})`,
          reference: joNumber,
        };
        return { ...m, qtyInStock: newQty, history: [entry, ...m.history] };
      })
    );
  };

  const materials = deriveLegacy(rawMaterials);
  const get: Ctx["get"] = (k) => materials.find((m) => m.key === k)!;

  return (
    <MaterialsContext.Provider
      value={{ rawMaterials, templates, materials, get, updateStock, addMaterial, saveBOMTemplate, findBOMTemplate, deductForJO, restoreFromJO }}
    >
      {children}
    </MaterialsContext.Provider>
  );
}

export function useMaterials() {
  const c = useContext(MaterialsContext);
  if (!c) throw new Error("useMaterials must be used inside MaterialsProvider");
  return c;
}
