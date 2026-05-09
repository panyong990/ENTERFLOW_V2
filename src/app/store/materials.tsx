import { createContext, useContext, useState, type ReactNode } from "react";

/* ─────────── Types ─────────── */

export type PartCategory =
  | "filter_media"
  | "endcap"
  | "inner_core"
  | "outer_core"
  | "bonding_adhesive"
  | "oring"
  | "gasket"
  | "packaging";

export const partCategoryMeta: Record<PartCategory, { label: string; icon: string }> = {
  filter_media:     { label: "Filter Media",        icon: "🧻" },
  endcap:           { label: "End Cap / Frame",     icon: "🔲" },
  inner_core:       { label: "Inner Core",          icon: "⚙️" },
  outer_core:       { label: "Outer Core",          icon: "⛓️" },
  bonding_adhesive: { label: "Bonding / Adhesive",  icon: "🧴" },
  oring:            { label: "O-Ring",              icon: "⭕" },
  gasket:           { label: "Gasket",              icon: "🟫" },
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
/**
 * Real formulas per "RAW MATERIALS COMPUTATION" doc (Section B of the master prompt).
 *
 * Cylindrical air filters use:
 *   - height-based size bucket: Large ≥ 400mm, Medium ≥ 200mm, else Small.
 *   - filter media (kg/filter), adhesive (gal/filter), inner/outer core (plates/filter), end cap (plates/filter).
 *
 * Pocket-bag filters use a meter-based formula where filter media is metered (m), not kg.
 */
export function autofillBOMForType(
  filterType: string,
  size: "Large" | "Medium" | "Small" | undefined,
  dims: { depthMm?: number; pockets?: number; heightMm?: number },
  materials: RawMaterial[]
): { line: BOMLine; note?: string }[] {
  const find = (cat: PartCategory, hint?: string) =>
    materials.find((m) => m.category === cat && (!hint || m.name.toLowerCase().includes(hint.toLowerCase())));

  const out: { line: BOMLine; note?: string }[] = [];
  const ft = filterType.toLowerCase();
  const isPocketBag = ft.includes("pocket") || ft.includes("secfil") || ft.includes("bag");
  const isCylindrical = ft.includes("air") || ft.includes("oil") || ft.includes("hyd") || ft.includes("fuel") || ft.includes("water") || ft.includes("solvent") || ft.includes("coalescence") || ft.includes("separator") || /^(oilsep|watsep|solfil|hydfil|airfil|oilfil|fuelfil|coalfil|sepfil)$/i.test(filterType);

  if (isPocketBag) {
    /* Pocket bag: filter media in meters (special-case unit). */
    const depth = dims.depthMm ?? 560;
    const pockets = dims.pockets ?? 8;
    const meters = (depth / 1000) * pockets;
    const rollLength = 100;
    const filtersPerRoll = Math.max(1, Math.floor(rollLength / meters));
    const wastePct = ((rollLength - filtersPerRoll * meters) / rollLength) * 100;
    const media = find("filter_media", "POCKET FILTER MEDIA F8") ?? find("filter_media", "POCKET");
    if (media) {
      out.push({
        line: { materialId: media.id, partCategory: "filter_media", qtyConsumed: meters, wastePct },
        note: `Pocket bag formula · ${meters.toFixed(2)} m per filter · ${filtersPerRoll} filters per 100m roll · waste ${wastePct.toFixed(2)}%`,
      });
    }
    const frame = find("endcap", "PERFORATED G.I 0.8") ?? find("endcap");
    if (frame) {
      out.push({ line: { materialId: frame.id, partCategory: "endcap", qtyConsumed: 0.05 }, note: "1 frame per filter (~20 frames/sheet)" });
    }
  } else if (isCylindrical) {
    /* Determine size from height if provided, else use the override, else Medium. */
    const h = dims.heightMm ?? 0;
    const sz = size ?? (h >= 400 ? "Large" : h >= 200 ? "Medium" : "Small");
    /* Filter media (kg) per Section B */
    const mediaKg = sz === "Large" ? 3.3 : sz === "Small" ? 0.5 : 1.0;
    const media = find("filter_media", "PK-120300HX") ?? find("filter_media", "FILTER MEDIA");
    if (media) out.push({ line: { materialId: media.id, partCategory: "filter_media", qtyConsumed: mediaKg }, note: `Air filter ${sz} · ${mediaKg} kg/filter` });

    /* Adhesive (gal/filter) */
    const adhGal = sz === "Large" ? 0.17 : sz === "Small" ? 0.04 : 0.05;
    const adhMat = find("bonding_adhesive", "PIONEER EPOXY LV") ?? find("bonding_adhesive");
    if (adhMat) out.push({ line: { materialId: adhMat.id, partCategory: "bonding_adhesive", qtyConsumed: adhGal }, note: `${(1 / adhGal).toFixed(0)} filters per gallon` });

    /* Inner core (plates/filter) */
    const inner = sz === "Large" ? 0.5 : sz === "Small" ? 0.083 : 0.125;
    const innerMat = find("inner_core", "EXPANDED METAL B.I") ?? find("inner_core");
    if (innerMat) out.push({ line: { materialId: innerMat.id, partCategory: "inner_core", qtyConsumed: inner }, note: `${(1 / inner).toFixed(1)} filters per plate/roll` });

    /* Outer core (plates/filter) */
    const outer = sz === "Large" ? 0.5 : sz === "Small" ? 0.111 : 0.167;
    const outerMat = find("outer_core", "PERFORATED G.I 1mm") ?? find("outer_core");
    if (outerMat) out.push({ line: { materialId: outerMat.id, partCategory: "outer_core", qtyConsumed: outer }, note: `${(1 / outer).toFixed(1)} filters per plate` });

    /* End cap (plates/filter) */
    const endcap = sz === "Large" ? 0.125 : sz === "Small" ? 0.020 : 0.031;
    const capMat = find("endcap", "PLATE G.I 0.6") ?? find("endcap");
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

/**
 * Real raw materials list from "RAW MATERIALS COMPUTATION & LIST" (Section B).
 * Item codes from the source document are used as IDs so they remain stable across reorders.
 * Filter media is uniformly tracked in kg (Section B — Filter media unit change), except for
 * spring plates and a few legacy roll-only stocks.
 */
const seedMaterials: RawMaterial[] = [
  /* ───── Filter Media (kg unit per Section B) ───── */
  MAT("F-FMI.FM-043",  "FILTER120 1/4\"T × 82\"W × 20m L",                      "filter_media", "kg", 1600,  35, 10),
  MAT("F-FMI.FM-044",  "FILTER200 1/2\" T × 82\" W × 20m L",                    "filter_media", "kg", 2640,  30, 10),
  MAT("F-FMI.FM-045",  "FILTER250 3/4\" T × 82\" W × 20m L",                    "filter_media", "kg", 3000,  20,  8),
  MAT("F-FMI.FM-047",  "FILTER290 W/ ONE RESIN 1\" T × 96\"W × 30m L",          "filter_media", "kg", 5940,  15,  5),
  MAT("F-FMI.FM-048",  "FILTER350 1\"T × 82\"W × 20m L",                         "filter_media", "kg", 3800,  18,  6),
  MAT("F-NNWOV.FM-058","NONWOVEN FR-1 3120 M.GREEN 80\" × 50m L",                "filter_media", "kg", 4657,  12,  4),
  MAT("F-NNWOV.FM-059","NONWOVEN FR-1 3320 80\" × 20m L",                        "filter_media", "kg", 4726,   8,  3),
  MAT("F-SNNX.FM-057", "SUNNEX PBM240-15mm 1/2\"T × 2m W × 20m L",               "filter_media", "kg", 1960,  10,  4),
  MAT("RM-FM-095",     "FILTER MEDIA PP5MICRON",                                  "filter_media", "kg", 17907,  6,  3),
  MAT("RM-FM-096-1",   "FILTER MEDIA C-F8, 860mm HT, 38kgs/roll",                 "filter_media", "kg", 25286,  5,  3),
  MAT("RM-FM-098-1",   "FILTER MEDIA ZS20, 610mm HT, 35kgs/roll",                 "filter_media", "kg", 17952,  8,  3),
  MAT("RM-FM-098-2",   "FILTER MEDIA ZS20, 1000mm HT, 50kgs/roll",                "filter_media", "kg", 17952,  6,  3),
  MAT("RM-FM-099-1",   "FILTER MEDIA ZSUI, 610mm HT, 35kgs/roll",                 "filter_media", "kg", 15147,  5,  3),
  MAT("RM-FM-100-1",   "FILTER MEDIA ZSH3, 610mm HT, 35kgs/roll",                 "filter_media", "kg", 15708,  5,  3),
  MAT("RM-FM-101-1",   "FILTER MEDIA ZSH5, 610mm HT, 35kgs/roll",                 "filter_media", "kg", 20196,  4,  3),
  MAT("RM-FM-102-1",   "FILTER MEDIA ZS10, 610mm HT, 35kgs/roll",                 "filter_media", "kg", 17952,  5,  3),
  MAT("RM-FM-103",     "FILTER MEDIA JZCY-H13, 28kgs/roll",                       "filter_media", "kg", 15147,  4,  3),
  MAT("RM-PFM-110",    "POCKET FILTER MEDIA F6 GREEN",                            "filter_media", "kg",  4998, 12,  4),
  MAT("RM-PFM-111",    "POCKET FILTER MEDIA F8 YELLOW 720mm W",                   "filter_media", "kg",  6426, 10,  4),
  MAT("RM-PFM-112",    "POCKET FILTER MEDIA F7 PINK",                             "filter_media", "kg",  5712,  9,  4),
  MAT("F-ACWF-037",    "ACTIVATED CARBON AMETEK C1-20, 20\" L",                  "filter_media", "pcs",  855, 24, 10),
  MAT("F-ACWF-038",    "ACTIVATED CARBON WATER CHECK WCB-05, 20\"L",             "filter_media", "pcs",  855, 18, 10),
  MAT("F-ACG-039",     "ACTIVATED CARBON GRANULE 4×8, 25kg/sack",                "filter_media", "kg", 2200,  4,  3),
  MAT("F-LNCON.FG-042","FIBERGLASS 50mmT × 2mW × 20m L",                          "filter_media", "kg", 10500,  3,  3),
  MAT("RM-FC-080",     "FILTERCLOTH NEEDLEFELT FSQHAF550G",                       "filter_media", "kg", 13977,  2,  2),
  MAT("RM-FC-083",     "FILTERCLOTH NEEDLEFELT PP100MICRON",                      "filter_media", "kg", 15989,  3,  2),
  MAT("RM-FC-084",     "FILTERCLOTH NEEDLEFELT PP50MICRON",                       "filter_media", "kg", 15989,  3,  2),
  MAT("RM-FC-090",     "FILTERCLOTH NEEDLEFELT FS NOMEX 550G",                    "filter_media", "kg", 82620,  1,  1),
  MAT("RM-FP-104",     "FILTER PAPER PK-135250",                                  "filter_media", "kg",  6336,  6,  3),
  MAT("RM-FP-108-1",   "FILTER PAPER PK-120300HX, 610mm HT, 42kgs/roll",          "filter_media", "kg", 10819,  5,  3),

  /* ───── End Cap / Frame (plates and sheets) ───── */
  MAT("RM-PERPO.GI-116","PERFORATED G.I 0.8mm × 4×8 × 3mm HOLES",                 "endcap", "sheet", 2375, 22, 5),
  MAT("RM-PLATE.GI-126","PLATE G.I 0.6 × 4×8",                                    "endcap", "sheet",  700, 30, 5),
  MAT("RM-PLATE.GI-127","PLATE G.I 1mm × 4×8",                                    "endcap", "sheet", 1120, 18, 5),
  MAT("RM-PLATE.EG-128","PLATE E.G 0.5 × 4×8",                                    "endcap", "sheet",  630, 25, 5),
  MAT("RM-PLATE.EG-129","PLATE E.G 1mm × 4×8",                                    "endcap", "sheet",  810, 20, 5),
  MAT("RM-PLATE.EG-130","PLATE E.G 1.5 × 4×4",                                    "endcap", "sheet",  798, 14, 5),
  MAT("RM-PLATE.ALUM-131","PLATE ALUMINUM 0.6 × 4×8",                             "endcap", "sheet",  860, 12, 4),
  MAT("RM-PLATE.ALUM-132","PLATE ALUMINUM 0.8 × 4×8",                             "endcap", "sheet", 1150, 10, 4),
  MAT("RM-PLATE.SS304-124","PLATE S/S304 0.8mm × 4×8",                            "endcap", "sheet", 2540,  6, 3),
  MAT("RM-PLATE.SS304-125","PLATE S/S304 1mm × 4×8",                              "endcap", "sheet", 4900,  4, 3),

  /* ───── Inner Core / Outer Core (perforated/expanded) ───── */
  MAT("RM-PERPO.EG-120","PERFORATED E.G 2mm × 4×8 × 3mm Ø HOLES",                 "inner_core", "sheet", 2761, 18, 5),
  MAT("RM-PERPO.BI-121","PERFORATED B.I 2mm × 4×8 × 7.9mm HOLES",                 "inner_core", "sheet", 2660, 14, 5),
  MAT("RM-PERPO.SS304-123","PERFORATED S/S304 1mm × 4×8 × 4mm HOLES",             "inner_core", "sheet", 6400,  6, 3),
  MAT("RM-EXPNDEDMTL.BI-133","EXPANDED METAL B.I #2413 4×8",                      "inner_core", "roll",  500, 22, 5),
  MAT("RM-EXPNDEDMTL.BI-134","EXPANDED METAL B.I #1819 4×8",                      "inner_core", "roll",  900, 14, 5),
  MAT("RM-PERPO.GI-117","PERFORATED G.I 1mm × 4×8 × 5mm HOLES",                   "outer_core", "sheet", 2620, 16, 5),
  MAT("RM-PERPO.BI-122","PERFORATED B.I 3mm × 4×8 × 7.9mm HOLES",                 "outer_core", "sheet", 4100, 10, 4),
  MAT("RM-EXPNDED.ALUM-135","EXPANDED WIRE ALUMINUM (4ftW)",                      "outer_core", "roll", 2400,  8, 3),
  MAT("RM-CHCKENWIRE-136","CHICKENWIRE G.I (4ftW)",                                "outer_core", "roll", 1200, 12, 4),

  /* ───── Bonding / Adhesive ───── */
  MAT("RM-EMJ.EPOX-062","EPOXY HARDENER/RESIN",                                    "bonding_adhesive", "set", 2143, 12, 3),
  MAT("RM-EMJ.EPOX-063","EPOXY PUTTY & FILLER HARDENER/RESIN",                     "bonding_adhesive", "set", 2143,  8, 3),
  MAT("RM-PSBSI-144",   "1CML2009 PIONEER EPOXY LV",                               "bonding_adhesive", "gal", 3050,  6, 3),
  MAT("RM-PSBSI-146",   "STRUCTURAL EPOXY",                                        "bonding_adhesive", "gal", 2367,  6, 3),
  MAT("RM-NNPAO.ADHSV-064-1","HOTMELT ADHESIVE HM-595T, 25kg/sack",                "bonding_adhesive", "kg",  278, 75, 25),
  MAT("RM-HNKL.ADHSV-064-2","HOTMELT ADHESIVE SUPRA, 25kgs/bag",                   "bonding_adhesive", "kg", 5125, 50, 25),

  /* ───── O-Ring (Section B5 — split) ───── */
  MAT("OR-NBR-STD",     "Nitrile Rubber O-Ring (NBR, standard)",                   "oring", "pcs", 35, 145, 50),
  MAT("OR-VITON",       "Viton O-Ring (heat-resistant)",                           "oring", "pcs", 65,  60, 30),

  /* ───── Gasket (Section B5 — split) ───── */
  MAT("GS-GREEN",       "Gasket — Green (TOP, standard)",                          "gasket", "pcs",  42,  80, 30),
  MAT("GS-FELT",        "Mechanical Felt Gasket",                                  "gasket", "pcs",  28,  60, 30),
  MAT("RM-SPRNGPLTESS-113","SPRING PLATE STAINLESS 25mmW",                         "gasket", "roll", 19125, 4, 2),

  /* ───── Packaging (cardboard, foam, boxes) ───── */
  MAT("RM-NAPPCO.DCCB-065","NAPPCO DIECUT CARDBOARD 1\" × 23\" × 23\"",            "packaging", "pcs", 41.66, 240, 50),
  MAT("RM-NAPPCO.DCCB-066-1","NAPPCO DIECUT CARDBOARD 2\" × 23\" × 23\"",          "packaging", "pcs", 41.66, 200, 50),
  MAT("RM-NAPPCO.DCCB-070","NAPPCO DIECUT CARDBOARD 2\" × 24 1/2\" × 24 1/2\"",   "packaging", "pcs", 41.66, 180, 50),
  MAT("RM-NAPPCO.CB-140","NAPPCO CARDBOARD 23 35\" × 30\"",                        "packaging", "pcs", 14.80, 320, 80),
  MAT("RM-GSPACK.CBP-143","CORRUGATED BOX PLAIN 4ft × 8ft",                        "packaging", "pcs", 84.80,  60, 20),
  MAT("RM-GSPACK.CBP-148","CORRUGATED BOX PLAIN 14 3/4W × 14 3/4L × 14\" H SMALL", "packaging", "pcs", 38.00, 110, 30),
  MAT("RM-GSPACK.CBP-149","CORRUGATED BOX PLAIN 14 3/4W × 14 3/4L × 20\" H BIG",   "packaging", "pcs", 35.00,  80, 30),
  MAT("RM-MLTIFLX.FB-077-1","FOAM BLUE 3mm × 110cm × 7ft",                          "packaging", "sheet", 60.60, 50, 20),

  /* ───── Office docs (kept here for inventory completeness) ───── */
  MAT("OFF-SI-137",    "SALES INVOICE",       "packaging", "pcs", 260, 24, 8),
  MAT("OFF-DR-138",    "DELIVERY RECEIPT",    "packaging", "pcs", 190, 30, 8),
  MAT("OFF-CR-139",    "COLLECTION RECEIPT",  "packaging", "pcs", 190, 28, 8),
];

/* Pre-saved BOM templates — material IDs match the new seedMaterials list. */
const seedTemplates: BOMTemplate[] = [
  {
    id: "tpl-pocket-610",
    name: "Pocket Bag — 610×610×560mm, 8 pockets",
    filterType: "Pocket Bag",
    bom: [
      { materialId: "RM-PFM-111",     partCategory: "filter_media", qtyConsumed: 4.48, wastePct: 1.44 },
      { materialId: "RM-PERPO.GI-116", partCategory: "endcap",      qtyConsumed: 0.05, wastePct: 1.64 },
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
      { materialId: "RM-FP-108-1",         partCategory: "filter_media",     qtyConsumed: 3.3 },
      { materialId: "RM-EXPNDEDMTL.BI-133", partCategory: "inner_core",       qtyConsumed: 0.5 },
      { materialId: "RM-PERPO.GI-117",      partCategory: "outer_core",       qtyConsumed: 0.5 },
      { materialId: "RM-PLATE.GI-126",      partCategory: "endcap",           qtyConsumed: 0.125 },
      { materialId: "RM-PSBSI-144",         partCategory: "bonding_adhesive", qtyConsumed: 0.17 },
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
      { materialId: "RM-FP-108-1",         partCategory: "filter_media",     qtyConsumed: 0.5 },
      { materialId: "RM-EXPNDEDMTL.BI-133", partCategory: "inner_core",       qtyConsumed: 0.083 },
      { materialId: "RM-PERPO.GI-117",      partCategory: "outer_core",       qtyConsumed: 0.111 },
      { materialId: "RM-PLATE.GI-126",      partCategory: "endcap",           qtyConsumed: 0.020 },
      { materialId: "RM-PSBSI-144",         partCategory: "bonding_adhesive", qtyConsumed: 0.04 },
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
  /* Pick representative items from the new catalogue to back the legacy 4-card view. */
  const byId: Record<MaterialKey, string> = {
    mediaLocal:    "RM-PFM-111",  // Pocket F8 yellow (locally stocked roll converted to kg)
    mediaImported: "F-LNCON.FG-042", // Fiberglass (imported)
    adhesive:      "RM-PSBSI-144", // Pioneer Epoxy LV
    box:           "RM-GSPACK.CBP-148", // small corrugated box
  };
  const meta: Record<MaterialKey, { label: string; leadTime: string }> = {
    mediaLocal:    { label: "Filter Media (Local)",    leadTime: "Next day" },
    mediaImported: { label: "Filter Media (Imported)", leadTime: "Months (customs)" },
    adhesive:      { label: "Adhesive",                leadTime: "Next day" },
    box:           { label: "Corrugated Box",          leadTime: "~2 weeks" },
  };
  return (Object.keys(byId) as MaterialKey[]).map((k) => {
    const m = rm.find((x) => x.id === byId[k]);
    /* Defensive fallback: if the catalogue is later edited and the legacy id is missing, return zeros so the legacy panel stays alive. */
    if (!m) return { key: k, label: meta[k].label, unit: "pcs", available: 0, threshold: 0, leadTime: meta[k].leadTime };
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
  /* Section B — delete a raw material from the inventory entirely. */
  deleteMaterial: (id: string) => void;
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

  const deleteMaterial: Ctx["deleteMaterial"] = (id) => {
    setRawMaterials((prev) => prev.filter((m) => m.id !== id));
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
      value={{ rawMaterials, templates, materials, get, updateStock, addMaterial, deleteMaterial, saveBOMTemplate, findBOMTemplate, deductForJO, restoreFromJO }}
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
