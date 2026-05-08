import { createContext, useContext, useState, type ReactNode } from "react";
import type { BOMLine, CostConfig } from "./materials";

/* Quotation document — what the client sees */
export interface QuotationLineItem {
  no: number;
  qty: number;
  unit: string;             // "pcs"
  description: string;      // "FILTER BAG"
  subDescription?: string;  // "SIZE : 135mm × 99 INCHES"
  unitPrice: number;
}

export interface QuotationDoc {
  quotationNo: string;       // "Q-2026-001"
  date: string;              // "Apr 26, 2026"
  validUntil: string;        // "May 26, 2026"
  lineItems: QuotationLineItem[];
  note: string;
  noteHighlighted: boolean;
  /* Packaging add-on */
  packaging?: { materialId: string; materialName: string; qty: number; unitPrice: number; includeInUnit: boolean };
  /* Shipping add-on */
  shipping?: { label: string; amount: number; includeInUnit: boolean };
  /* Terms */
  termsOfPayment: "COD" | "15-Day Terms" | "30-Day Terms";
  timeOfDelivery: string;    // "3–4 working weeks upon receipt of P.O."
  placeOfDelivery: string;
  preparedBy: string;
  /* Send tracking */
  sentAt?: string;
  sentBy?: string;
}

export type Stage =
  | "inquiry"
  | "quotation"
  | "po"
  | "jo"
  | "in_production"
  | "quality_inspection"
  | "ready_for_dispatch"
  | "dispatched"
  | "delivered"
  | "paid"
  | "overdue";

export const stageLabel: Record<Stage, string> = {
  inquiry: "New Inquiry",
  quotation: "Quotation Sent",
  po: "PO Received",
  jo: "JO Created",
  in_production: "In Production",
  quality_inspection: "Quality Inspection",
  ready_for_dispatch: "Ready for Dispatch",
  dispatched: "Dispatched",
  delivered: "Delivered",
  paid: "Paid",
  overdue: "Overdue",
};

export const stageColor: Record<Stage, { bg: string; fg: string }> = {
  inquiry:           { bg: "#E2E8F0", fg: "#475569" },
  quotation:         { bg: "#FEF3C7", fg: "#B45309" },
  po:                { bg: "#DCFCE7", fg: "#15803D" },
  jo:                { bg: "#FEE2E2", fg: "#991B1B" },
  in_production:     { bg: "#DBEAFE", fg: "#1D4ED8" },
  quality_inspection:{ bg: "#EDE9FE", fg: "#6D28D9" },
  ready_for_dispatch:{ bg: "#FFE4E6", fg: "#9F1239" },
  dispatched:        { bg: "#FDE68A", fg: "#92400E" },
  delivered:         { bg: "#CCFBF1", fg: "#0F766E" },
  paid:              { bg: "#DCFCE7", fg: "#166534" },
  overdue:           { bg: "#FEE2E2", fg: "#C8102E" },
};

export interface ProductLine {
  id: string;
  /* Filter type code from FILTER_TYPES (e.g. "OILSEP"). Legacy seeds may have human strings. */
  type: string;
  /* Human-readable name entered by the client/staff (e.g. "Air/Oil Separator Filter"). Required for new orders. */
  filterName?: string;
  /* Cylindrical group dimensions (also used by legacy seeds) */
  od1?: string; od2?: string; id1?: string; id2?: string; height?: string; overallHeight?: string;
  /* Flat-panel / pocket-bag / HEPA dimensions */
  length?: string; width?: string; thickness?: string; depth?: string; pocketCount?: string;
  /* Bag / dust collector dimensions */
  diameter?: string;
  clothCuttingWidth?: string; clothCuttingLength?: string;
  springPlateCenterToCenter?: string; springPlateWidth?: string; springPlateLength?: string;
  /* Pad / disc dimensions (padOd / padId — avoid colliding with the row id field) */
  padOd?: string; padId?: string;
  /* Common spec fields */
  media?: string; innerCore?: string; outerCore?: string;
  oring?: string; gasket?: string; oem?: string;
  qty: number;
  notes?: string;
}

export interface QuotationLine {
  productId: string;
  materialCost: number;
  labor: number;
  markupPct: number;
}

export interface Quotation {
  sentDate: string;
  leadTimeDays: number;
  lines: QuotationLine[];
}

export interface JOSpecs {
  od1?: string; od2?: string; id1?: string; id2?: string;
  height?: string; overallHeight?: string;
  endCap?: string; media?: string; innerCore?: string; outerCore?: string;
  oring?: string; gasket?: string; oem?: string; brand?: string; others?: string;
}

export interface ClientReceipt {
  id: string;
  date: string;
  filename: string;
  amount: number;
  note?: string;
}

/* Production stage history entry */
export interface StageEntry {
  stage: number;            // 0-9 (10 stages, see PRODUCTION_STAGES below)
  completedAt: string;      // ISO timestamp
  completedBy: string;
  reason?: string;          // for reverts
  status: "done" | "reverted";
}

/* The 10 production stages — single source of truth */
export const PRODUCTION_STAGES = [
  "Molding",
  "Cutting of Steel Plate",
  "Spotting of Filter Core",
  "Assembling",
  "Inserting of Filter Media",
  "Trimming",
  "Top/Bottom Cap Sealing (Heating)",
  "Gasket / O-Ring Fitting",
  "Quality / Product Inspection",
  "Completed",
] as const;

export interface Inquiry {
  id: string;
  code: string;
  clientName: string;
  contactPerson: string;
  generalNotes?: string;
  paymentTerms: "COD" | "15-Day Terms" | "30-Day Terms";
  products: ProductLine[];
  stage: Stage;
  submittedDate: string;
  quotation?: Quotation;
  poUploaded?: boolean;
  poFileName?: string;
  urgent?: boolean;
  dueDate?: string;
  /* — sketch optionally uploaded at inquiry stage — */
  inquirySketch?: string;
  archived?: boolean;
  archiveReason?: "rejected" | "cancelled";
  archiveDate?: string;
  archiveNote?: string;
  /* — JO finalization — */
  joNumber?: string;
  joSpecs?: JOSpecs;
  joSketch?: string;
  dpReceiptFile?: string;
  signedQuotationFile?: string;
  /* — delivery / invoicing — */
  deliveredDate?: string;
  invoiceNo?: string;
  invoiceAmount?: number;
  invoiceDueDate?: string;
  /* — client-uploaded payment receipts — */
  clientPaymentReceipts?: ClientReceipt[];
  /* — confirmed payments (secretary-confirmed amounts that show on the client side) — */
  confirmedPayments?: { id: string; date: string; amount: number; method: string; ref: string }[];
  /* — cancellation approval flow — */
  pendingCancellation?: { reason: string; requestedAt: string; requestedBy: "client" | "management" };
  /* — bill of materials + cost config (set during quotation, carried into JO) — */
  billOfMaterials?: BOMLine[];
  costConfig?: CostConfig;
  unitPrice?: number;
  quotedTotal?: number;
  /* — formal quotation document (Tab 3 output) — */
  quotationDoc?: QuotationDoc;
  /* — flag set when materials have been deducted (avoid double-deducting on stage replays) — */
  inventoryDeducted?: boolean;
  /* — production tracking — */
  currentStage?: number;             // 0-9 index into PRODUCTION_STAGES
  stageHistory?: StageEntry[];
  paused?: boolean;
  pauseReason?: string;
  /* — payment tracking — */
  amountPaid?: number;
  paidAt?: string;
  /* — logistics — */
  deliveryMethod?: "Lalamove" | "AP Cargo" | "Fast Cargo" | "Company Vehicle" | "Client Pick-up";
  trackingRef?: string;
  drFileName?: string;
  drUploadedAt?: string;
  /* — quotation revision flow (client requests, sales reviews, version history) — */
  revisionNote?: string;
  quotationHistory?: QuotationDoc[];
  /* — urgent upgrade two-way comm — */
  urgentUpgradeRequested?: boolean;
  urgentUpgradeResponse?: string;
  /* — waybill / dispatch (used by WaybillScanner) — */
  waybillNumber?: string;
  waybillLog?: { ts: string; status: string; note?: string }[];
  dispatchedAt?: string;
}

export interface FinalizeJOData {
  joNumber: string;
  joSpecs?: JOSpecs;
  joSketch?: string;
  dpReceiptFile?: string;
  signedQuotationFile?: string;
}

export const unitPrice = (l: QuotationLine) => Math.round((l.materialCost + l.labor) * (1 + l.markupPct / 100));
export const lineSubtotal = (line: QuotationLine, qty: number) => unitPrice(line) * qty;
export const quotationTotal = (inq: Inquiry) =>
  (inq.quotation?.lines ?? []).reduce((sum, l) => {
    const p = inq.products.find((p) => p.id === l.productId);
    return sum + (p ? lineSubtotal(l, p.qty) : 0);
  }, 0);

const seed: Inquiry[] = [
  {
    id: "i1", code: "INQ-005", clientName: "B.E. Aerospace", contactPerson: "M. Rivera",
    paymentTerms: "30-Day Terms", submittedDate: "Apr 10, 2026", stage: "po", poUploaded: true,
    poFileName: "PO-2026-0418.pdf", urgent: true, dueDate: "Apr 30, 2026",
    products: [
      { id: "p1", type: "Air Filter", od1: "107", id1: "64.6", height: "252", media: "Microglass Fiber", innerCore: "Expanded Metal Perfo 2mm", oem: "KF-OS.107.65.252", qty: 30, notes: "Same spec as previous order" },
    ],
    quotation: { sentDate: "Apr 11, 2026", leadTimeDays: 14, lines: [{ productId: "p1", materialCost: 800, labor: 400, markupPct: 30 }] },
  },
  {
    id: "i2", code: "INQ-004", clientName: "G.U. Engineering", contactPerson: "A. Tan",
    paymentTerms: "15-Day Terms", submittedDate: "Apr 12, 2026", stage: "po", poUploaded: true,
    poFileName: "PO-2026-0421.pdf",
    products: [
      { id: "p1", type: "Oil Separator Filter", od1: "200", od2: "167", id1: "108", height: "160", media: "Microglass Fiber", innerCore: "Perfo Steel 2mm", outerCore: "Perfo 6mm", oem: "KF-OS.200/167.108.160", qty: 30 },
    ],
    quotation: { sentDate: "Apr 13, 2026", leadTimeDays: 18, lines: [{ productId: "p1", materialCost: 1350, labor: 600, markupPct: 25 }] },
  },
  {
    id: "i3", code: "INQ-006", clientName: "Maynilad", contactPerson: "J. Domingo",
    paymentTerms: "30-Day Terms", submittedDate: "Apr 20, 2026", stage: "quotation",
    products: [
      { id: "p1", type: "Pleated Filter ZS20", od1: "175", id1: "20", height: "87", media: "Pleated ZS20 w/ Double Alum Screen", oem: "KF-OF.175.20.87", qty: 200 },
    ],
    quotation: { sentDate: "Apr 21, 2026", leadTimeDays: 20, lines: [{ productId: "p1", materialCost: 320, labor: 180, markupPct: 35 }] },
  },
  {
    id: "i4", code: "INQ-007", clientName: "Monaco", contactPerson: "P. Garcia",
    paymentTerms: "COD", submittedDate: "Apr 22, 2026", stage: "inquiry",
    products: [
      { id: "p1", type: "Air Oil Separator", media: "Microglass Fiber", oem: "MNC-AOS-3.0", qty: 50 },
      { id: "p2", type: "Oil Filter", media: "Pleated 5-micron", qty: 30 },
    ],
  },
  {
    id: "i5", code: "INQ-008", clientName: "Emerald Vinyl", contactPerson: "R. Lim",
    paymentTerms: "COD", submittedDate: "Apr 25, 2026", stage: "inquiry",
    products: [
      { id: "p1", type: "Column Filter", height: "350", media: "Microglass Fiber", innerCore: "Perfo Steel 1.5mm", qty: 20 },
    ],
  },
  /* — already-generated JO (seed for demo, currently in production at stage 8) — */
  {
    id: "i0", code: "INQ-001", clientName: "B.E. Aerospace", contactPerson: "M. Rivera",
    paymentTerms: "30-Day Terms", submittedDate: "Mar 28, 2026", stage: "in_production",
    poFileName: "PO-2026-9901.pdf", urgent: true, dueDate: "Apr 30, 2026",
    products: [
      { id: "p1", type: "Air Filter", od1: "115", od2: "103", id1: "64.6", height: "500", media: "Microglass Fiber", innerCore: "Expanded Metal Perfo 2mm", oem: "KF-OS.107.65.252", qty: 50 },
    ],
    quotation: { sentDate: "Mar 29, 2026", leadTimeDays: 14, lines: [{ productId: "p1", materialCost: 800, labor: 400, markupPct: 30 }] },
    joNumber: "JO-2026-001",
    joSpecs: { od1: "115", od2: "103", id1: "64.6", height: "500", overallHeight: "512", endCap: "E.G. (1.0mm)", media: "Microglass Fiber / Inside", innerCore: "Expanded Metal Perfo 2mm", brand: "Hitachi Comp.", oem: "KF-OS.107.65.252" },
    joSketch: "KF-OS.107.65.252_drawing.pdf",
    signedQuotationFile: "QT-2026-9901-signed.pdf",
    dpReceiptFile: "DP-receipt-BE-Mar2026.jpg",
    currentStage: 8,
    stageHistory: Array.from({ length: 8 }, (_, i) => ({
      stage: i, completedAt: new Date(Date.now() - (8 - i) * 24 * 60 * 60 * 1000).toISOString(),
      completedBy: ["F. Santos", "J. Reyes", "M. Tan", "J. Reyes", "M. Tan", "M. Tan", "J. Reyes", "F. Santos"][i],
      status: "done" as const,
    })),
    inventoryDeducted: true,
    invoiceAmount: 78000,
  },
  /* — Maynilad — ready for dispatch, demo for Logistics — */
  {
    id: "i6", code: "INQ-002", clientName: "Maynilad", contactPerson: "J. Domingo",
    paymentTerms: "30-Day Terms", submittedDate: "Mar 25, 2026", stage: "ready_for_dispatch",
    poFileName: "PO-2026-9531.pdf", urgent: false, dueDate: "Apr 30, 2026",
    products: [
      { id: "p1", type: "Pleated Filter ZS20", od1: "175", id1: "20", height: "87", media: "Pleated ZS20 w/ Double Alum Screen", oem: "KF-OF.175.20.87", qty: 100 },
    ],
    quotation: { sentDate: "Mar 26, 2026", leadTimeDays: 18, lines: [{ productId: "p1", materialCost: 320, labor: 180, markupPct: 35 }] },
    joNumber: "JO-2026-002",
    joSpecs: { od1: "175", id1: "20", height: "87", media: "Pleated ZS20 w/ Double Alum Screen", oem: "KF-OF.175.20.87" },
    joSketch: "KF-OF.175.20.87_drawing.pdf",
    currentStage: 9,
    stageHistory: Array.from({ length: 10 }, (_, i) => ({ stage: i, completedAt: new Date(Date.now() - (10 - i) * 24 * 60 * 60 * 1000).toISOString(), completedBy: "F. Santos", status: "done" as const })),
    inventoryDeducted: true,
    invoiceAmount: 50040,
    deliveryMethod: "Lalamove",
  },
  /* — Maynilad delivered — pending payment, demo for Payments Ledger — */
  {
    id: "i7", code: "INQ-003", clientName: "Maynilad", contactPerson: "J. Domingo",
    paymentTerms: "30-Day Terms", submittedDate: "Mar 18, 2026", stage: "delivered",
    poFileName: "PO-2026-9533.pdf",
    products: [
      { id: "p1", type: "Pleated Filter 5-Micron", od1: "175", id1: "20", height: "87", media: "Pleated 5-Micron", oem: "KF-OF.175.20.87-5M", qty: 100 },
    ],
    quotation: { sentDate: "Mar 19, 2026", leadTimeDays: 14, lines: [{ productId: "p1", materialCost: 280, labor: 160, markupPct: 35 }] },
    joNumber: "JO-2026-003",
    joSpecs: { od1: "175", id1: "20", height: "87", media: "Pleated 5-Micron", oem: "KF-OF.175.20.87-5M" },
    currentStage: 9,
    stageHistory: Array.from({ length: 10 }, (_, i) => ({ stage: i, completedAt: new Date(Date.now() - (15 - i) * 24 * 60 * 60 * 1000).toISOString(), completedBy: "F. Santos", status: "done" as const })),
    inventoryDeducted: true,
    deliveredDate: "Mar 30, 2026",
    invoiceNo: "SI-2026-9533",
    invoiceAmount: 46800,
    invoiceDueDate: "Apr 29, 2026",
    deliveryMethod: "Lalamove",
    drFileName: "DR-2026-9533-signed.jpg",
    amountPaid: 23400,
    confirmedPayments: [{ id: "cp-seed-1", date: "Apr 10, 2026", amount: 23400, method: "BDO Bank Transfer", ref: "BDO-2026-04100" }],
  },
];

interface Ctx {
  inquiries: Inquiry[];
  archivedInquiries: Inquiry[];
  completedJOs: Inquiry[];
  clearedPOs: string[];
  addInquiry: (i: Omit<Inquiry, "id" | "code" | "stage" | "submittedDate" | "archived" | "archiveReason" | "archiveDate">) => string;
  sendQuotation: (id: string, q: Quotation) => void;
  uploadPO: (id: string, fileName: string) => void;
  finalizeJO: (id: string, data: FinalizeJOData) => void;
  rejectInquiry: (id: string, reason?: string) => void;
  cancelInquiry: (id: string, reason?: string) => void;
  cancelJOFromProduction: (joNumber: string, reason?: string) => void;
  /* Cancellation approval workflow */
  requestCancellation: (id: string, reason: string, requestedBy: "client" | "management") => void;
  approveCancellation: (id: string) => void;
  declineCancellation: (id: string) => void;
  /* Secretary confirms a client receipt — pushes it to confirmedPayments visible on client portal */
  confirmClientPayment: (inquiryId: string, payment: { date: string; amount: number; method: string; ref: string }) => void;
  /* BOM lifecycle */
  setBillOfMaterials: (id: string, bom: BOMLine[], costConfig: CostConfig, unitPrice: number, quotedTotal: number) => void;
  markInventoryDeducted: (joNumber: string) => void;
  /* Quotation document */
  setQuotationDoc: (id: string, doc: QuotationDoc) => void;
  generateQuotationNumber: () => string;
  /* Auto-incrementing PO + JO numbers (PO-YYYY-NNNN / JO-YYYY-NNNN) */
  generatePONumber: () => string;
  generateJONumber: () => string;
  addClientReceipt: (inquiryId: string, receipt: Omit<ClientReceipt, "id">) => void;
  markPOCleared: (po: string) => void;
  /* — Generic update — write any field on an inquiry. The single write-through used by all modules. */
  updateInquiry: (id: string, patch: Partial<Inquiry>) => void;
  /* — Filter helper for derived tables in modules — */
  inquiriesByStage: (stages: Stage[]) => Inquiry[];
  /* — pipeline progress — */
  setStage: (id: string, stage: Stage) => void;
  setUrgent: (id: string, urgent: boolean, dueDate?: string) => void;
  setDueDate: (id: string, due: string) => void;
  markDelivered: (id: string, deliveredDate: string, invoiceNo: string, invoiceAmount: number) => void;
  reorderToProduction: (sourceInquiryId: string) => string;
  byClient: (name: string) => Inquiry[];
  isNewClient: (name: string) => boolean;
}

const OrdersContext = createContext<Ctx | null>(null);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [allInquiries, setAllInquiries] = useState<Inquiry[]>(seed);
  const [clearedPOs, setClearedPOs] = useState<string[]>([]);

  /* "inquiries" = pipeline visible on Sales kanban (pre-JO).  Once JO is created, the order moves into production. */
  const inquiries = allInquiries.filter(
    (i) => !i.archived && (i.stage === "inquiry" || i.stage === "quotation" || i.stage === "po")
  );
  const archivedInquiries = allInquiries.filter((i) => i.archived);
  const completedJOs = allInquiries.filter(
    (i) => !i.archived && (i.stage === "jo" || i.stage === "in_production" || i.stage === "quality_inspection" || i.stage === "ready_for_dispatch" || i.stage === "dispatched" || i.stage === "delivered" || i.stage === "paid" || i.stage === "overdue")
  );

  const markPOCleared: Ctx["markPOCleared"] = (po) => {
    setClearedPOs((prev) => prev.includes(po) ? prev : [...prev, po]);
  };

  const addInquiry: Ctx["addInquiry"] = (data) => {
    const id = `inq-${Date.now()}`;
    const num = String(allInquiries.length + 4).padStart(3, "0");
    const code = `INQ-${num}`;
    setAllInquiries((prev) => [
      ...prev,
      {
        ...data,
        id, code, stage: "inquiry",
        submittedDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      },
    ]);
    return code;
  };

  const sendQuotation: Ctx["sendQuotation"] = (id, q) => {
    setAllInquiries((prev) => prev.map((x) => (x.id === id ? { ...x, stage: "quotation", quotation: q } : x)));
  };

  const uploadPO: Ctx["uploadPO"] = (id, fileName) => {
    setAllInquiries((prev) => prev.map((x) => (x.id === id ? { ...x, stage: "po", poUploaded: true, poFileName: fileName } : x)));
  };

  const finalizeJO: Ctx["finalizeJO"] = (id, data) => {
    setAllInquiries((prev) =>
      prev.map((x) =>
        x.id === id
          ? {
              ...x,
              stage: "jo",
              joNumber: data.joNumber,
              joSpecs: data.joSpecs,
              joSketch: data.joSketch,
              dpReceiptFile: data.dpReceiptFile,
              signedQuotationFile: data.signedQuotationFile,
            }
          : x
      )
    );
  };

  const rejectInquiry: Ctx["rejectInquiry"] = (id, reason) => {
    const now = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    setAllInquiries((prev) => prev.map((x) => x.id === id ? { ...x, archived: true, archiveReason: "rejected", archiveDate: now, archiveNote: reason } : x));
  };

  const cancelInquiry: Ctx["cancelInquiry"] = (id, reason) => {
    const now = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    setAllInquiries((prev) => prev.map((x) => x.id === id ? { ...x, archived: true, archiveReason: "cancelled", archiveDate: now, archiveNote: reason } : x));
  };

  const cancelJOFromProduction: Ctx["cancelJOFromProduction"] = (joNumber, reason) => {
    const now = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    setAllInquiries((prev) => prev.map((x) => x.joNumber === joNumber ? { ...x, archived: true, archiveReason: "cancelled", archiveDate: now, archiveNote: reason } : x));
  };

  /* Cancellation approval workflow — both sides go through this */
  const requestCancellation: Ctx["requestCancellation"] = (id, reason, requestedBy) => {
    const now = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    setAllInquiries((prev) => prev.map((x) => x.id === id ? { ...x, pendingCancellation: { reason, requestedAt: now, requestedBy } } : x));
  };

  const approveCancellation: Ctx["approveCancellation"] = (id) => {
    const now = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    setAllInquiries((prev) => prev.map((x) => {
      if (x.id !== id || !x.pendingCancellation) return x;
      return { ...x, archived: true, archiveReason: "cancelled", archiveDate: now, archiveNote: x.pendingCancellation.reason, pendingCancellation: undefined };
    }));
  };

  const declineCancellation: Ctx["declineCancellation"] = (id) => {
    setAllInquiries((prev) => prev.map((x) => x.id === id ? { ...x, pendingCancellation: undefined } : x));
  };

  const setBillOfMaterials: Ctx["setBillOfMaterials"] = (id, bom, costConfig, unitPrice, quotedTotal) => {
    setAllInquiries((prev) => prev.map((x) => (x.id === id ? { ...x, billOfMaterials: bom, costConfig, unitPrice, quotedTotal } : x)));
  };

  const markInventoryDeducted: Ctx["markInventoryDeducted"] = (joNumber) => {
    setAllInquiries((prev) => prev.map((x) => (x.joNumber === joNumber ? { ...x, inventoryDeducted: true } : x)));
  };

  const setQuotationDoc: Ctx["setQuotationDoc"] = (id, doc) => {
    setAllInquiries((prev) => prev.map((x) => (x.id === id ? { ...x, quotationDoc: doc } : x)));
  };

  const generateQuotationNumber: Ctx["generateQuotationNumber"] = () => {
    /* Sequential within current year based on existing quotation docs */
    const year = new Date().getFullYear();
    const used = allInquiries
      .map((i) => i.quotationDoc?.quotationNo)
      .filter((n): n is string => !!n && n.startsWith(`Q-${year}-`))
      .map((n) => parseInt(n.split("-")[2] ?? "0", 10));
    const next = (used.length === 0 ? 1 : Math.max(...used) + 1).toString().padStart(3, "0");
    return `Q-${year}-${next}`;
  };

  /* PO-YYYY-NNNN — sequential within year, scans existing poFileName prefixes */
  const generatePONumber: Ctx["generatePONumber"] = () => {
    const year = new Date().getFullYear();
    const used = allInquiries
      .map((i) => i.poFileName ?? "")
      .map((n) => {
        const m = n.match(new RegExp(`PO-${year}-(\\d+)`));
        return m ? parseInt(m[1], 10) : 0;
      });
    const next = ((used.length ? Math.max(...used) : 0) + 1).toString().padStart(4, "0");
    return `PO-${year}-${next}`;
  };

  /* JO-YYYY-NNNN — sequential within year */
  const generateJONumber: Ctx["generateJONumber"] = () => {
    const year = new Date().getFullYear();
    const used = allInquiries
      .map((i) => i.joNumber ?? "")
      .map((n) => {
        const m = n.match(new RegExp(`JO-${year}-(\\d+)`));
        return m ? parseInt(m[1], 10) : 0;
      });
    const next = ((used.length ? Math.max(...used) : 0) + 1).toString().padStart(4, "0");
    return `JO-${year}-${next}`;
  };

  const confirmClientPayment: Ctx["confirmClientPayment"] = (inquiryId, payment) => {
    const id = `cp-${Date.now()}`;
    setAllInquiries((prev) => prev.map((x) => x.id === inquiryId ? {
      ...x,
      confirmedPayments: [...(x.confirmedPayments ?? []), { ...payment, id }],
    } : x));
  };

  const updateInquiry: Ctx["updateInquiry"] = (id, patch) => {
    setAllInquiries((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const inquiriesByStage: Ctx["inquiriesByStage"] = (stages) => {
    const set = new Set(stages);
    return allInquiries.filter((i) => !i.archived && set.has(i.stage));
  };

  const setStage: Ctx["setStage"] = (id, stage) => {
    setAllInquiries((prev) => prev.map((x) => x.id === id ? { ...x, stage } : x));
  };

  const setUrgent: Ctx["setUrgent"] = (id, urgent, dueDate) => {
    setAllInquiries((prev) => prev.map((x) => x.id === id ? { ...x, urgent, dueDate: dueDate ?? x.dueDate } : x));
  };

  const setDueDate: Ctx["setDueDate"] = (id, due) => {
    setAllInquiries((prev) => prev.map((x) => x.id === id ? { ...x, dueDate: due } : x));
  };

  const markDelivered: Ctx["markDelivered"] = (id, deliveredDate, invoiceNo, invoiceAmount) => {
    setAllInquiries((prev) => prev.map((x) => {
      if (x.id !== id) return x;
      const days = x.paymentTerms === "30-Day Terms" ? 30 : x.paymentTerms === "15-Day Terms" ? 15 : 0;
      const due = new Date(); due.setDate(due.getDate() + days);
      const dueStr = due.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return { ...x, stage: "delivered", deliveredDate, invoiceNo, invoiceAmount, invoiceDueDate: dueStr };
    }));
  };

  const reorderToProduction: Ctx["reorderToProduction"] = (sourceInquiryId) => {
    /* For known repeat items: clone an existing JO inquiry, skip inquiry/quotation, mark stage "jo" with a fresh JO number */
    const src = allInquiries.find((i) => i.id === sourceInquiryId);
    if (!src) return "";
    const id = `inq-${Date.now()}`;
    const num = String(allInquiries.length + 4).padStart(3, "0");
    const code = `INQ-${num}`;
    /* Section J — sequential JO number, not random */
    const year = new Date().getFullYear();
    const used = allInquiries
      .map((i) => i.joNumber ?? "")
      .map((n) => {
        const m = n.match(new RegExp(`JO-${year}-(\\d+)`));
        return m ? parseInt(m[1], 10) : 0;
      });
    const next = ((used.length ? Math.max(...used) : 0) + 1).toString().padStart(4, "0");
    const joNum = `JO-${year}-${next}`;
    setAllInquiries((prev) => [
      ...prev,
      {
        ...src,
        id, code,
        stage: "jo",
        submittedDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        joNumber: joNum,
        clientPaymentReceipts: [],
        archived: false,
        archiveReason: undefined,
        archiveDate: undefined,
        urgent: false,
      },
    ]);
    return joNum;
  };

  const addClientReceipt: Ctx["addClientReceipt"] = (inquiryId, receipt) => {
    const id = `rcpt-${Date.now()}`;
    setAllInquiries((prev) =>
      prev.map((x) =>
        x.id === inquiryId
          ? { ...x, clientPaymentReceipts: [...(x.clientPaymentReceipts ?? []), { ...receipt, id }] }
          : x
      )
    );
  };

  const byClient: Ctx["byClient"] = (name) =>
    allInquiries.filter((i) => i.clientName === name);

  const isNewClient: Ctx["isNewClient"] = (name) => {
    const list = inquiries.filter((i) => i.clientName === name);
    if (list.length === 0) return true;
    return list.every((i) => i.stage === "inquiry");
  };

  return (
    <OrdersContext.Provider value={{
      inquiries, archivedInquiries, completedJOs, clearedPOs,
      addInquiry, sendQuotation, uploadPO, finalizeJO,
      rejectInquiry, cancelInquiry, cancelJOFromProduction,
      requestCancellation, approveCancellation, declineCancellation,
      confirmClientPayment, setBillOfMaterials, markInventoryDeducted,
      setQuotationDoc, generateQuotationNumber, generatePONumber, generateJONumber,
      addClientReceipt, reorderToProduction, markPOCleared,
      updateInquiry, inquiriesByStage,
      setStage, setUrgent, setDueDate, markDelivered,
      byClient, isNewClient,
    }}>
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const c = useContext(OrdersContext);
  if (!c) throw new Error("useOrders must be used inside OrdersProvider");
  return c;
}
