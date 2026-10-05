import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { BOMLine, CostConfig } from "./materials";
import { loadInquiryAttachments, promotePendingSignedDeliveryReceipt, saveInquiryAttachments } from "./attachments";

/* Quotation document — what the client sees */
export interface QuotationLineItem {
  no: number;
  qty: number;
  unit: string;             // "pcs"
  description: string;      // "FILTER BAG"
  subDescription?: string;  // "SIZE : 135mm × 99 INCHES"
  unitPrice: number;
  materialAvailability?: {
    materialId: string;
    materialName: string;
    unit: string;
    requiredQuantity: number;
    stockQuantity: number;
    status: "on_stock" | "not_on_stock";
    shortageQuantity?: number;
  }[];
}

export interface WarehouseStockResponseSnapshot {
  requestId: string;
  responseAt: string;
  respondedBy: string;
  type: "initial" | "updated";
  materials: {
    materialId: string;
    materialName: string;
    unit: string;
    requiredQuantity: number;
    currentQuantity: number;
    status: "sufficient" | "shortage";
    shortageQuantity?: number;
  }[];
}

export interface QuotationDoc {
  quotationNo: string;       // "Q-2026-001"
  date: string;              // "Apr 26, 2026"
  validUntil: string;        // "May 26, 2026"
  lineItems: QuotationLineItem[];
  discounts?: { label: string; percent: number }[];
  total?: number;
  note: string;
  noteHighlighted: boolean;
  /* Packaging add-on */
  packaging?: { materialId: string; materialName: string; qty: number; unitPrice: number; includeInUnit: boolean };
  /* Shipping add-on */
  shipping?: { label: string; amount: number; includeInUnit: boolean };
  /* Terms */
  termsOfPayment: "15-Day Terms" | "30-Day Terms";
  timeOfDelivery: string;    // "3–4 working weeks upon receipt of P.O."
  placeOfDelivery: string;
  preparedBy: string;
  /* Send tracking */
  sentAt?: string;
  sentBy?: string;
  stockCheckedAt?: string;
  warehouseStockResponse?: WarehouseStockResponseSnapshot;
  /* Downpayment (Section D) — staff sets this in Tab 3 of the quotation builder */
  downpaymentPercent?: number;
  downpaymentAmount?: number;
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
  /* Per-product wizard state — stored so each filter keeps its own settings */
  filtrationRating?: string;   // e.g. "5-micron" / "custom"
  sketchFileName?: string;     // filename of the engineer sketch attached to THIS product
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
  length?: string; width?: string; thickness?: string; depth?: string; pocketCount?: string;
  diameter?: string;
  clothCuttingWidth?: string; clothCuttingLength?: string;
  springPlateCenterToCenter?: string; springPlateWidth?: string; springPlateLength?: string;
  padOd?: string; padId?: string;
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

export type PaymentType = "DOWNPAYMENT" | "BALANCE_PAYMENT" | "FULL_PAYMENT";
export type PaymentVerificationStatus = "pending" | "verified" | "rejected";
export type PaymentState =
  | "DOWNPAYMENT_REQUIRED"
  | "DOWNPAYMENT_PARTIAL"
  | "DOWNPAYMENT_COMPLETE"
  | "FULL_PAYMENT_REQUIRED"
  | "BALANCE_PAYMENT_REQUIRED"
  | "FULLY_PAID";

/* Canonical payment record used by the payment workflow. Legacy receipt and
   confirmed-payment fields remain on Inquiry for existing UI compatibility. */
export interface PaymentRecord {
  id: string;
  inquiryId?: string;
  invoiceNo?: string;
  paymentType: PaymentType;
  submittedAmount: number;
  verifiedAmount?: number;
  method?: string;
  referenceNumber?: string;
  receiptFile?: string;
  receiptDataUrl?: string;
  paymentDate: string;
  verificationStatus: PaymentVerificationStatus;
  verifiedAt?: string;
  rejectedAt?: string;
  note?: string;
}

export interface PaymentStateSummary {
  invoiceTotal: number;
  requiredDownpaymentAmount: number;
  verifiedDownpaymentAmount: number;
  remainingDownpayment: number;
  downpaymentStatus: "NOT_REQUIRED" | "REQUIRED" | "PARTIAL" | "COMPLETE";
  totalVerifiedPayments: number;
  remainingInvoiceBalance: number;
  currentPaymentType: PaymentType | null;
  state: PaymentState;
}

/* Replacement request — submitted by client, processed by operations */
export interface ReplacementRequest {
  id: string;
  requestedAt: string;         // ISO timestamp
  reason: string;              // why they want replacement
  defectDescription: string;   // what's wrong
  qty: number;                 // how many pcs to replace
  proofFileName?: string;      // photo of defect
  status: "pending" | "processing" | "resolved";
  resolvedAt?: string;
  joNumber?: string;           // replacement JO number once created
}

/* Production stage history entry */
export interface StageEntry {
  stage: number;            // 0-8 (9 production stages, see PRODUCTION_STAGES below)
  completedAt: string;      // ISO timestamp
  completedBy: string;
  reason?: string;          // for reverts
  status: "done" | "reverted";
}

/* The 9 production stages — single source of truth */
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
] as const;

export interface Inquiry {
  id: string;
  code: string;
  clientName: string;
  contactPerson: string;
  generalNotes?: string;
  paymentTerms: "15-Day Terms" | "30-Day Terms";
  products: ProductLine[];
  stage: Stage;
  submittedDate: string;
  quotation?: Quotation;
  poUploaded?: boolean;
  poFileName?: string;
  poNumber?: string;
  poFileDataUrl?: string;
  poUploadedAt?: string;
  /** Sales confirmation state for a client-uploaded PO. */
  poReceived?: boolean;
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
  joCompletedAt?: string;
  joSpecs?: JOSpecs;
  joSketch?: string;
  dpReceiptFile?: string;
  signedQuotationFile?: string;
  /* — delivery / invoicing — */
  deliveredDate?: string;
  invoiceNo?: string;
  invoiceAmount?: number;
  invoiceDate?: string;
  invoiceDueDate?: string;
  clientSignedDRFileName?: string;
  clientSignedDRUploadedAt?: string;
  paymentCycleStartedAt?: string;
  /** Invoice exists as a Sales draft until Sales explicitly sends it. */
  invoiceSentAt?: string;
  /* — client-uploaded payment receipts — */
  clientPaymentReceipts?: ClientReceipt[];
  /* — confirmed payments (secretary-confirmed amounts that show on the client side) — */
  confirmedPayments?: { id: string; date: string; amount: number; method: string; ref: string }[];
  payments?: PaymentRecord[];
  /* — cancellation approval flow — */
  pendingCancellation?: { reason: string; requestedAt: string; requestedBy: "client" | "management" };
  /* — bill of materials + cost config (set during quotation, carried into JO) — */
  billOfMaterials?: BOMLine[];
  costConfig?: CostConfig;
  unitPrice?: number;
  quotedTotal?: number;
  /* — formal quotation document (Tab 3 output) — */
  quotationDoc?: QuotationDoc;
  /* — flag set when this JO's materials have been deducted during JO generation — */
  inventoryDeducted?: boolean;
  /* — production tracking — */
  currentStage?: number;             // 0-9 cursor into the 9 production stages
  stageHistory?: StageEntry[];
  paused?: boolean;
  pauseReason?: string;
  /* — payment tracking — */
  amountPaid?: number;
  paidAt?: string;
  /* — logistics / delivery receipt workflow — */
  deliveryMethod?: "Lalamove" | "AP Cargo" | "Fast Cargo" | "Company Vehicle" | "Client Pick-up";
  trackingRef?: string;
  deliveryTrackingLink?: string;
  drFileName?: string;
  drUploadedAt?: string;
  deliveryReceiptNumber?: string;
  deliveryReceiptGeneratedAt?: string;
  deliveryReceiptGeneratedBy?: string;
  deliveryReceiptSentToLogisticsAt?: string;
  deliveryReceiptSentAt?: string;
  pendingSignedDeliveryReceiptFileName?: string;
  pendingSignedDeliveryReceiptSubmittedBy?: string;
  pendingSignedDeliveryReceiptDataUrl?: string;
  signedDeliveryReceiptFileName?: string;
  signedDeliveryReceiptSubmittedBy?: string;
  signedDeliveryReceiptReceivedAt?: string;
  signedDeliveryReceiptNumber?: string;
  signedDeliveryReceiptDataUrl?: string;
  fulfillmentCompletedAt?: string;
  /* — quotation revision flow (client requests, sales reviews, version history) — */
  revisionNote?: string;
  quotationHistory?: QuotationDoc[];
  /* — urgent upgrade two-way comm — */
  urgentUpgradeRequested?: boolean;
  urgentUpgradeResponse?: string;
  /* — waybill / dispatch (used by WaybillScanner) — */
  waybillNumber?: string;
  waybillIdentifier?: string;
  waybillPrintedAt?: string;
  waybillLog?: { ts: string; status: string; note?: string }[];
  dispatchedAt?: string;
  /* — Downpayment workflow (Section D) — */
  downpaymentPercent?: number;          // e.g. 30 for 30%
  downpaymentAmount?: number;           // computed at quotation time
  /* Accounting → Client: payment details sent for downpayment */
  downpaymentPaymentDetails?: {
    method: "Bank Transfer" | "GCash" | "Check" | "Other";
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
    note?: string;
    sentAt: string;
  };
  /* Client → Accounting: receipt uploaded */
  downpaymentReceiptFile?: string;      // client-uploaded proof
  downpaymentReceiptUploadedAt?: string;
  /* Accounting confirms DP received; ops/sales can then mark "received" badge */
  downpaymentConfirmed?: boolean;       // set true once secretary confirms the DP receipt
  downpaymentConfirmedAt?: string;
  downpaymentConfirmedBy?: string;
  /* — Multiple JOs per inquiry (Section F) — */
  parentInquiryId?: string;             // child JOs reference the original inquiry's id
  /* — Per-product BOM/cost data (Sections C/N) — */
  productsBillOfMaterials?: (BOMLine[] | null)[];
  productsCostConfig?: (CostConfig | null)[];
  productsUnitPrice?: (number | null)[];
  productsQuotedTotal?: (number | null)[];
  productIndex?: number;
  /* — Replacement requests (client-initiated, max 2 per order) — */
  replacementRequests?: ReplacementRequest[];
  /* — This inquiry is itself a replacement JO — */
  isReplacement?: boolean;
  replacementParentId?: string;   // id of the original inquiry
}

function paymentDueDate(paymentTerms: Inquiry["paymentTerms"], receiptAt: string): string | undefined {
  const due = new Date(receiptAt);
  if (Number.isNaN(due.getTime())) return undefined;
  due.setDate(due.getDate() + (paymentTerms === "30-Day Terms" ? 30 : 15));
  return due.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function hasValidSignedDeliveryReceipt(inquiry: Inquiry): boolean {
  return Boolean(
    inquiry.signedDeliveryReceiptFileName
    && inquiry.deliveryReceiptNumber
    && inquiry.signedDeliveryReceiptNumber === inquiry.deliveryReceiptNumber
    && inquiry.signedDeliveryReceiptReceivedAt
    && !Number.isNaN(Date.parse(inquiry.signedDeliveryReceiptReceivedAt)),
  );
}

export function paymentDaysRemaining(invoiceDueDate: string, now = new Date()): number | undefined {
  const dueDate = new Date(invoiceDueDate);
  if (Number.isNaN(dueDate.getTime())) return undefined;
  dueDate.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((dueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export function resolveProductBOM(inquiry: Inquiry, productIndex: number): BOMLine[] | undefined {
  const productBOM = inquiry.productsBillOfMaterials?.[productIndex];
  if (productBOM && productBOM.length > 0) return productBOM;

  if (inquiry.products.length === 1) {
    const sharedBOM = inquiry.billOfMaterials;
    if (sharedBOM && sharedBOM.length > 0) return sharedBOM;
  }
  return undefined;
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

const paymentEpsilon = 0.005;

export const invoiceTotal = (inq: Inquiry): number =>
  inq.invoiceAmount ?? inq.quotedTotal ?? quotationTotal(inq);

export const requiredDownpaymentAmount = (inq: Inquiry): number => {
  const percent = inq.quotationDoc?.downpaymentPercent ?? inq.downpaymentPercent ?? 0;
  return invoiceTotal(inq) * (percent / 100);
};

const legacyPaymentRecords = (inq: Inquiry): PaymentRecord[] => {
  const requiredDp = requiredDownpaymentAmount(inq);
  const legacy = inq.confirmedPayments ?? [];
  if (legacy.length > 0) {
    return legacy.map((payment) => ({
      id: payment.id,
      inquiryId: inq.id,
      invoiceNo: inq.invoiceNo,
      paymentType: requiredDp > 0 ? "DOWNPAYMENT" : "FULL_PAYMENT",
      submittedAmount: payment.amount,
      verifiedAmount: payment.amount,
      method: payment.method,
      referenceNumber: payment.ref,
      paymentDate: payment.date,
      verificationStatus: "verified",
    }));
  }
  if ((inq.amountPaid ?? 0) > 0) {
    return [{
      id: `legacy-paid-${inq.id}`,
      inquiryId: inq.id,
      invoiceNo: inq.invoiceNo,
      paymentType: requiredDp > 0 ? "DOWNPAYMENT" : "FULL_PAYMENT",
      submittedAmount: inq.amountPaid ?? 0,
      verifiedAmount: inq.amountPaid ?? 0,
      paymentDate: inq.paidAt ?? inq.deliveredDate ?? inq.submittedDate,
      verificationStatus: "verified",
    }];
  }
  return [];
};

export const paymentRecords = (inq: Inquiry): PaymentRecord[] => {
  const canonical = inq.payments ?? [];
  const canonicalIds = new Set(canonical.map((payment) => payment.id));
  return [
    ...legacyPaymentRecords(inq).filter((payment) => !canonicalIds.has(payment.id)),
    ...canonical,
  ];
};

export const verifiedPayments = (inq: Inquiry): PaymentRecord[] =>
  paymentRecords(inq).filter((payment) => payment.verificationStatus === "verified");

export const paymentState = (inq: Inquiry): PaymentStateSummary => {
  const total = invoiceTotal(inq);
  const requiredDp = requiredDownpaymentAmount(inq);
  const verified = verifiedPayments(inq);
  const verifiedDp = verified
    .filter((payment) => payment.paymentType === "DOWNPAYMENT")
    .reduce((sum, payment) => sum + (payment.verifiedAmount ?? payment.submittedAmount), 0);
  const totalVerified = verified.reduce(
    (sum, payment) => sum + (payment.verifiedAmount ?? payment.submittedAmount),
    0,
  );
  const remainingDp = Math.max(0, requiredDp - verifiedDp);
  const remainingBalance = Math.max(0, total - totalVerified);

  if (remainingBalance <= paymentEpsilon) {
    return {
      invoiceTotal: total,
      requiredDownpaymentAmount: requiredDp,
      verifiedDownpaymentAmount: verifiedDp,
      remainingDownpayment: remainingDp,
      downpaymentStatus: requiredDp > paymentEpsilon ? "COMPLETE" : "NOT_REQUIRED",
      totalVerifiedPayments: totalVerified,
      remainingInvoiceBalance: 0,
      currentPaymentType: null,
      state: "FULLY_PAID",
    };
  }
  if (requiredDp > paymentEpsilon && verifiedDp + paymentEpsilon < requiredDp) {
    return {
      invoiceTotal: total,
      requiredDownpaymentAmount: requiredDp,
      verifiedDownpaymentAmount: verifiedDp,
      remainingDownpayment: remainingDp,
      downpaymentStatus: verifiedDp > paymentEpsilon ? "PARTIAL" : "REQUIRED",
      totalVerifiedPayments: totalVerified,
      remainingInvoiceBalance: remainingBalance,
      currentPaymentType: "DOWNPAYMENT",
      state: verifiedDp > paymentEpsilon ? "DOWNPAYMENT_PARTIAL" : "DOWNPAYMENT_REQUIRED",
    };
  }
  return {
    invoiceTotal: total,
    requiredDownpaymentAmount: requiredDp,
    verifiedDownpaymentAmount: verifiedDp,
    remainingDownpayment: 0,
    downpaymentStatus: requiredDp > paymentEpsilon ? "COMPLETE" : "NOT_REQUIRED",
    totalVerifiedPayments: totalVerified,
    remainingInvoiceBalance: remainingBalance,
    currentPaymentType: requiredDp > paymentEpsilon ? "BALANCE_PAYMENT" : "FULL_PAYMENT",
    state: requiredDp > paymentEpsilon ? "BALANCE_PAYMENT_REQUIRED" : "FULL_PAYMENT_REQUIRED",
  };
};

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
    paymentTerms: "15-Day Terms", submittedDate: "Apr 22, 2026", stage: "inquiry",
    products: [
      { id: "p1", type: "Air Oil Separator", media: "Microglass Fiber", oem: "MNC-AOS-3.0", qty: 50 },
      { id: "p2", type: "Oil Filter", media: "Pleated 5-micron", qty: 30 },
    ],
  },
  {
    id: "i5", code: "INQ-008", clientName: "Emerald Vinyl", contactPerson: "R. Lim",
    paymentTerms: "15-Day Terms", submittedDate: "Apr 25, 2026", stage: "inquiry",
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
    stageHistory: Array.from({ length: 9 }, (_, i) => ({ stage: i, completedAt: new Date(Date.now() - (9 - i) * 24 * 60 * 60 * 1000).toISOString(), completedBy: "F. Santos", status: "done" as const })),
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
    stageHistory: Array.from({ length: 9 }, (_, i) => ({ stage: i, completedAt: new Date(Date.now() - (14 - i) * 24 * 60 * 60 * 1000).toISOString(), completedBy: "F. Santos", status: "done" as const })),
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
  /* ── DEMO: freshly delivered B.E. Aerospace transaction with NO replacement filed yet.
        Drops into the client portal's Transactions tab inside the open replacement window
        (30-Day Terms → 2-week window). Click "Request Replacement" on this row to walk
        the full flow: client files request → sales creates replacement JO → production picks it up. ── */
  {
    id: "i10", code: "INQ-009", clientName: "B.E. Aerospace", contactPerson: "M. Rivera",
    paymentTerms: "30-Day Terms",
    submittedDate: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    stage: "delivered",
    poFileName: "PO-2026-9560.pdf",
    products: [
      { id: "p1", type: "Oil Filter", od1: "95", id1: "30", height: "180", media: "Cellulose / Resin Impregnated", oem: "KF-OF.95.30.180", qty: 25 },
    ],
    quotation: { sentDate: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), leadTimeDays: 12, lines: [{ productId: "p1", materialCost: 520, labor: 250, markupPct: 30 }] },
    joNumber: "JO-2026-009",
    joSpecs: { od1: "95", id1: "30", height: "180", media: "Cellulose / Resin Impregnated", oem: "KF-OF.95.30.180" },
    joSketch: "KF-OF.95.30.180_drawing.pdf",
    billOfMaterials: [],
    costConfig: { laborCost: 250, markupPct: 30, vatType: "Exclusive", includeLabor: true },
    unitPrice: 1001,
    quotedTotal: 25025,
    currentStage: 9,
    stageHistory: Array.from({ length: 9 }, (_, i) => ({ stage: i, completedAt: new Date(Date.now() - (9 - i) * 24 * 60 * 60 * 1000).toISOString(), completedBy: "F. Santos", status: "done" as const })),
    inventoryDeducted: true,
    /* Delivered 3 days ago → still well inside the 2-week replacement window */
    deliveredDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    invoiceNo: "SI-2026-9560",
    invoiceAmount: 25025,
    invoiceDueDate: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    deliveryMethod: "Lalamove",
    drFileName: "DR-2026-9560-signed.jpg",
  },
  /* ── DEMO: delivered B.E. Aerospace order WITH a replacement request already filed.
        Pair with i9 (the replacement JO in production) to demo the full replacement flow
        without having to walk through inquiry → quotation → PO → JO → delivery. ── */
  {
    id: "i8", code: "INQ-005", clientName: "B.E. Aerospace", contactPerson: "M. Rivera",
    paymentTerms: "30-Day Terms", submittedDate: "Apr 2, 2026", stage: "delivered",
    poFileName: "PO-2026-9551.pdf",
    products: [
      { id: "p1", type: "Air Filter", od1: "107", id1: "64.6", height: "252", media: "Microglass Fiber", innerCore: "Expanded Metal Perfo 2mm", oem: "KF-OS.107.65.252", qty: 40 },
    ],
    quotation: { sentDate: "Apr 3, 2026", leadTimeDays: 14, lines: [{ productId: "p1", materialCost: 800, labor: 400, markupPct: 30 }] },
    joNumber: "JO-2026-005",
    joSpecs: { od1: "107", id1: "64.6", height: "252", media: "Microglass Fiber", innerCore: "Expanded Metal Perfo 2mm", oem: "KF-OS.107.65.252" },
    joSketch: "KF-OS.107.65.252_drawing.pdf",
    billOfMaterials: [],
    costConfig: { laborCost: 400, markupPct: 30, vatType: "Exclusive", includeLabor: true },
    unitPrice: 1560,
    quotedTotal: 62400,
    currentStage: 9,
    stageHistory: Array.from({ length: 9 }, (_, i) => ({ stage: i, completedAt: new Date(Date.now() - (11 - i) * 24 * 60 * 60 * 1000).toISOString(), completedBy: "F. Santos", status: "done" as const })),
    inventoryDeducted: true,
    deliveredDate: "Apr 28, 2026",
    invoiceNo: "SI-2026-9551",
    invoiceAmount: 62400,
    invoiceDueDate: "May 28, 2026",
    deliveryMethod: "Lalamove",
    drFileName: "DR-2026-9551-signed.jpg",
    /* Client filed a replacement request 5 days after delivery — within 30-Day window */
    replacementRequests: [
      {
        id: "rr-seed-1",
        requestedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        reason: "Defective seals on 5 units — air leaks during pressure test",
        defectDescription: "Endcap adhesive failure causing perimeter leak on 5/40 units. Photos attached.",
        qty: 5,
        proofFileName: "BE-defect-photo-Apr30.jpg",
        status: "processing",
        joNumber: "JO-2026-005R",
      },
    ],
  },
  /* ── DEMO: the replacement JO created from i8's request — already in production, stage 4 ── */
  {
    id: "i9", code: "INQ-005R", clientName: "B.E. Aerospace", contactPerson: "M. Rivera",
    paymentTerms: "30-Day Terms",
    submittedDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    stage: "in_production",
    generalNotes: "REPLACEMENT for INQ-005 — Defective seals on 5 units — air leaks during pressure test",
    products: [
      { id: "p1-r", type: "Air Filter", od1: "107", id1: "64.6", height: "252", media: "Microglass Fiber", innerCore: "Expanded Metal Perfo 2mm", oem: "KF-OS.107.65.252", qty: 5 },
    ],
    joNumber: "JO-2026-005R",
    joSpecs: { od1: "107", id1: "64.6", height: "252", media: "Microglass Fiber", innerCore: "Expanded Metal Perfo 2mm", oem: "KF-OS.107.65.252" },
    joSketch: "KF-OS.107.65.252_drawing.pdf",
    billOfMaterials: [],
    costConfig: { laborCost: 400, markupPct: 30, vatType: "Exclusive", includeLabor: true },
    unitPrice: 1560,
    quotedTotal: 7800,
    urgent: true,
    isReplacement: true,
    replacementParentId: "i8",
    currentStage: 4,
    stageHistory: Array.from({ length: 4 }, (_, i) => ({ stage: i, completedAt: new Date(Date.now() - (4 - i) * 24 * 60 * 60 * 1000).toISOString(), completedBy: ["F. Santos", "J. Reyes", "M. Tan", "J. Reyes"][i], status: "done" as const })),
    inventoryDeducted: true,
  },
];

interface Ctx {
  inquiries: Inquiry[];
  archivedInquiries: Inquiry[];
  completedJOs: Inquiry[];
  clearedPOs: string[];
  addInquiry: (i: Omit<Inquiry, "id" | "code" | "stage" | "submittedDate" | "archived" | "archiveReason" | "archiveDate">) => string;
  sendQuotation: (id: string, q: Quotation) => void;
  uploadPO: (id: string, fileName: string, fileDataUrl: string, poNumber: string) => void;
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
  submitPayment: (inquiryId: string, payment: Omit<PaymentRecord, "id" | "inquiryId" | "paymentType" | "verificationStatus" | "verifiedAmount">) => void;
  verifyPayment: (inquiryId: string, paymentId: string, verifiedAmount?: number) => void;
  rejectPayment: (inquiryId: string, paymentId: string) => void;
  /* BOM lifecycle */
  setBillOfMaterials: (id: string, bom: BOMLine[], costConfig: CostConfig, unitPrice: number, quotedTotal: number) => void;
  setProductsCosting: (id: string, data: { boms: (BOMLine[] | null)[]; configs: (CostConfig | null)[]; unitPrices: (number | null)[]; totals: (number | null)[] }) => void;
  markInventoryDeducted: (joNumber: string) => void;
  /* Quotation document */
  setQuotationDoc: (id: string, doc: QuotationDoc) => void;
  generateQuotationNumber: () => string;
  /* Auto-incrementing PO + JO numbers (PO-YYYY-NNNN / JO-YYYY-NNNN) */
  generatePONumber: () => string;
  generateJONumber: () => string;
  generateInvoice: (id: string) => string | undefined;
  generateDeliveryReceipt: (id: string) => string | undefined;
  sendDeliveryReceiptToLogistics: (id: string) => boolean;
  markDeliveryReceiptSent: (id: string, trackingLink?: string) => void;
  sendInvoice: (id: string) => boolean;
  finalizeProductJOs: (id: string, data: FinalizeJOData[]) => string[];
  addClientReceipt: (inquiryId: string, receipt: Omit<ClientReceipt, "id">) => void;
  addReplacementRequest: (inquiryId: string, req: Omit<ReplacementRequest, "id" | "status" | "requestedAt">) => void;
  resolveReplacement: (inquiryId: string, requestId: string) => void;
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
  savePendingSignedDeliveryReceipt: (
    id: string,
    fileName: string,
    fileDataUrl: string,
    submittedBy: "Client" | "Logistics Staff",
  ) => Promise<void>;
  submitPendingSignedDeliveryReceipt: (id: string) => Promise<void>;
  /* — Downpayment workflow (Section D) — */
  sendDownpaymentDetails: (id: string, details: NonNullable<Inquiry["downpaymentPaymentDetails"]>) => void;
  uploadDownpaymentReceipt: (id: string, fileName: string) => void;
  confirmDownpayment: (id: string, confirmedBy?: string) => void;
  /* — Replacement: create a JO directly from a parent inquiry's replacement request — */
  createReplacementJO: (parentInquiryId: string, requestId: string, qty: number, reason: string) => string;
  reorderToProduction: (sourceInquiryId: string) => string;
  byClient: (name: string) => Inquiry[];
  isNewClient: (name: string) => boolean;
}

const OrdersContext = createContext<Ctx | null>(null);

const ORDERS_STORAGE_KEY = "enterflow.orders.v1";

interface PersistedOrdersState {
  inquiries: Inquiry[];
  clearedPOs: string[];
}

function businessState(inquiries: Inquiry[]): Inquiry[] {
  return inquiries.map(({ poFileDataUrl, pendingSignedDeliveryReceiptDataUrl, signedDeliveryReceiptDataUrl, payments, ...inquiry }) => ({
    ...inquiry,
    payments: payments?.map(({ receiptDataUrl, ...payment }) => payment),
  }));
}

function repairPersistedDemoOilfilBom(inquiries: Inquiry[]): { inquiries: Inquiry[]; changed: boolean } {
  const matches = inquiries.filter((inquiry) => {
    if (inquiry.products.length !== 1) return false;
    const product = inquiry.products[0];
    const productCode = product.type.trim().toUpperCase();
    const filterCode = product.filterName?.trim().toUpperCase();
    return (productCode === "OILFIL" || filterCode === "OILFIL")
      && Number(product.od1) === 175
      && Number(product.id1) === 20
      && Number(product.height) === 87
      && product.qty === 20;
  });

  if (matches.length !== 1) return { inquiries, changed: false };
  const target = matches[0];
  const productBOM = target.productsBillOfMaterials?.[0];
  const activeBOM = productBOM && productBOM.length > 0 ? productBOM : target.billOfMaterials;
  if (!activeBOM) return { inquiries, changed: false };

  const matchingLines = activeBOM.filter((line) => line.materialId === "OR-NBR-STD");
  if (matchingLines.length !== 1) return { inquiries, changed: false };
  const line = matchingLines[0];
  if (Number.isFinite(line.qtyConsumed) && line.qtyConsumed > 0) return { inquiries, changed: false };

  // Demo/test data repair only; this is not an authoritative manufacturing quantity.
  const repairedBOM = activeBOM.map((bomLine) =>
    bomLine === line ? { ...bomLine, qtyConsumed: 1 } : bomLine
  );
  const repairedInquiry: Inquiry = productBOM && productBOM.length > 0
    ? {
        ...target,
        productsBillOfMaterials: target.productsBillOfMaterials?.map((bom, index) => index === 0 ? repairedBOM : bom),
      }
    : { ...target, billOfMaterials: repairedBOM };

  return {
    inquiries: inquiries.map((inquiry) => inquiry.id === target.id ? repairedInquiry : inquiry),
    changed: true,
  };
}

function attachmentState(inquiry: Inquiry) {
  return {
    poFileDataUrl: inquiry.poFileDataUrl,
    pendingSignedDeliveryReceiptDataUrl: inquiry.pendingSignedDeliveryReceiptDataUrl,
    signedDeliveryReceiptDataUrl: inquiry.signedDeliveryReceiptDataUrl,
    paymentReceiptDataUrls: Object.fromEntries(
      (inquiry.payments ?? [])
        .filter((payment): payment is typeof payment & { receiptDataUrl: string } => Boolean(payment.receiptDataUrl))
        .map((payment) => [payment.id, payment.receiptDataUrl]),
    ),
  };
}

function loadPersistedOrders(): PersistedOrdersState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ORDERS_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const value = parsed as Partial<PersistedOrdersState>;
    if (!Array.isArray(value.inquiries) || !Array.isArray(value.clearedPOs)) return null;
    if (!value.inquiries.every((inquiry) => (
      inquiry && typeof inquiry === "object"
      && typeof (inquiry as Inquiry).id === "string"
      && typeof (inquiry as Inquiry).clientName === "string"
      && typeof (inquiry as Inquiry).stage === "string"
    ))) return null;
    if (!value.clearedPOs.every((po) => typeof po === "string")) return null;
    const repaired = repairPersistedDemoOilfilBom(value.inquiries as Inquiry[]);
    if (repaired.changed) {
      window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify({
        inquiries: businessState(repaired.inquiries),
        clearedPOs: value.clearedPOs,
      }));
    }
    return { inquiries: repaired.inquiries, clearedPOs: value.clearedPOs as string[] };
  } catch {
    return null;
  }
}

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [savedOrders] = useState<PersistedOrdersState | null>(() => loadPersistedOrders());
  const [allInquiries, setAllInquiries] = useState<Inquiry[]>(() => savedOrders?.inquiries ?? seed);
  const [clearedPOs, setClearedPOs] = useState<string[]>(() => savedOrders?.clearedPOs ?? []);
  const signedDRUploadsInProgress = useRef(new Set<string>());

  useEffect(() => {
    setAllInquiries((current) => {
      let changed = false;
      const next = current.map((inquiry) => {
        if (!hasValidSignedDeliveryReceipt(inquiry)) {
          if (!inquiry.fulfillmentCompletedAt && !inquiry.paymentCycleStartedAt) return inquiry;
          changed = true;
          return {
            ...inquiry,
            fulfillmentCompletedAt: undefined,
            paymentCycleStartedAt: undefined,
            invoiceDueDate: undefined,
          };
        }
        const receivedAt = inquiry.signedDeliveryReceiptReceivedAt!;
        const dueDate = paymentDueDate(inquiry.paymentTerms, receivedAt);
        if (
          inquiry.fulfillmentCompletedAt === receivedAt
          && inquiry.paymentCycleStartedAt === receivedAt
          && inquiry.invoiceDueDate === dueDate
        ) return inquiry;
        changed = true;
        return {
          ...inquiry,
          fulfillmentCompletedAt: receivedAt,
          paymentCycleStartedAt: receivedAt,
          invoiceDueDate: dueDate,
        };
      });
      return changed ? next : current;
    });
  }, [allInquiries]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const value: PersistedOrdersState = { inquiries: businessState(allInquiries), clearedPOs };
      window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(value));
    } catch (error) {
      console.error("[EnterFlow] Could not persist order state to localStorage.", error);
    }
  }, [allInquiries, clearedPOs]);

  useEffect(() => {
    if (!savedOrders) return;
    let cancelled = false;
    const hydrate = async () => {
      try {
        const loaded = await Promise.all(allInquiries.map(async (inquiry) => ({
          inquiry,
          attachments: await loadInquiryAttachments(inquiry.id),
        })));
        if (cancelled) return;
        setAllInquiries((current) => current.map((inquiry) => {
          const entry = loaded.find((item) => item.inquiry.id === inquiry.id);
          if (!entry) return inquiry;
          const paymentReceiptDataUrls = entry.attachments.paymentReceiptDataUrls;
          return {
            ...inquiry,
            poFileDataUrl: entry.attachments.poFileDataUrl ?? inquiry.poFileDataUrl,
            pendingSignedDeliveryReceiptDataUrl: entry.attachments.pendingSignedDeliveryReceiptDataUrl ?? inquiry.pendingSignedDeliveryReceiptDataUrl,
            signedDeliveryReceiptDataUrl: entry.attachments.signedDeliveryReceiptDataUrl ?? inquiry.signedDeliveryReceiptDataUrl,
            payments: inquiry.payments?.map((payment) => ({
              ...payment,
              receiptDataUrl: payment.receiptDataUrl ?? paymentReceiptDataUrls[payment.id],
            })),
          };
        }));
      } catch (error) {
        console.error("[EnterFlow] Could not hydrate order attachments from IndexedDB.", error);
      }
    };
    void hydrate();
    return () => { cancelled = true; };
  }, [savedOrders]);

  useEffect(() => {
    const persistAttachments = async () => {
      try {
        await Promise.all(allInquiries.map((inquiry) => saveInquiryAttachments(inquiry.id, attachmentState(inquiry))));
      } catch (error) {
        console.error("[EnterFlow] Could not persist order attachments to IndexedDB.", error);
      }
    };
    void persistAttachments();
  }, [allInquiries]);

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

  const uploadPO: Ctx["uploadPO"] = (id, fileName, fileDataUrl, poNumber) => {
    setAllInquiries((prev) => prev.map((x) => (x.id === id ? {
      ...x,
      stage: "po",
      poUploaded: true,
      poFileName: fileName,
      poNumber,
      poFileDataUrl: fileDataUrl,
      poUploadedAt: new Date().toISOString(),
      poReceived: false,
    } : x)));
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

  const setProductsCosting: Ctx["setProductsCosting"] = (id, data) => {
    setAllInquiries((prev) => prev.map((x) => (x.id === id ? {
      ...x,
      productsBillOfMaterials: data.boms,
      productsCostConfig: data.configs,
      productsUnitPrice: data.unitPrices,
      productsQuotedTotal: data.totals,
      billOfMaterials: data.boms[0] ?? x.billOfMaterials,
      costConfig: data.configs[0] ?? x.costConfig,
      unitPrice: data.unitPrices[0] ?? x.unitPrice,
      quotedTotal: data.totals.reduce((s, v) => s + (v ?? 0), 0),
    } : x)));
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

  /* SI-YYYY-NNNN — creates a shared invoice draft. Sending is a separate action. */
  const generateInvoice: Ctx["generateInvoice"] = (id) => {
    const inquiry = allInquiries.find((x) => x.id === id);
    if (!inquiry || inquiry.invoiceNo) return inquiry?.invoiceNo;

    const year = new Date().getFullYear();
    const used = allInquiries
      .map((x) => x.invoiceNo ?? "")
      .map((n) => {
        const m = n.match(new RegExp(`SI-${year}-(\\d+)`));
        return m ? parseInt(m[1], 10) : 0;
      });
    const next = ((used.length ? Math.max(...used) : 0) + 1).toString().padStart(4, "0");
    const invoiceNo = `SI-${year}-${next}`;
    const invoiceAmount = invoiceTotal(inquiry);
    const invoiceDate = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const deliveryConfirmed = inquiry.stage === "delivered" || inquiry.stage === "paid" || inquiry.stage === "overdue";
    const paymentCycleStartedAt = deliveryConfirmed ? inquiry.clientSignedDRUploadedAt : undefined;
    const invoiceDueDate = paymentCycleStartedAt
      ? paymentDueDate(inquiry.paymentTerms, paymentCycleStartedAt)
      : undefined;

    setAllInquiries((prev) => prev.map((x) => x.id === id ? {
      ...x,
      invoiceNo,
      invoiceAmount,
      invoiceDate,
      invoiceDueDate,
      paymentCycleStartedAt,
      invoiceSentAt: undefined,
    } : x));
    return invoiceNo;
  };

  const generateDeliveryReceipt: Ctx["generateDeliveryReceipt"] = (id) => {
    const inquiry = allInquiries.find((x) => x.id === id);
    if (!inquiry) return undefined;
    if (inquiry.deliveryReceiptNumber) return inquiry.deliveryReceiptNumber;

    const year = new Date().getFullYear();
    const used = allInquiries
      .map((x) => x.deliveryReceiptNumber ?? "")
      .map((n) => {
        const m = n.match(new RegExp(`DR-${year}-(\\d+)`));
        return m ? parseInt(m[1], 10) : 0;
      });
    const next = ((used.length ? Math.max(...used) : 0) + 1).toString().padStart(4, "0");
    const deliveryReceiptNumber = `DR-${year}-${next}`;
    const timestamp = new Date().toISOString();

    setAllInquiries((prev) => prev.map((x) => x.id === id ? {
      ...x,
      deliveryReceiptNumber,
      deliveryReceiptGeneratedAt: timestamp,
      deliveryReceiptGeneratedBy: "Accountant",
    } : x));
    return deliveryReceiptNumber;
  };

  const sendDeliveryReceiptToLogistics: Ctx["sendDeliveryReceiptToLogistics"] = (id) => {
    const inquiry = allInquiries.find((x) => x.id === id);
    if (!inquiry?.deliveryReceiptNumber || !inquiry.waybillPrintedAt) return false;
    if (inquiry.deliveryReceiptSentToLogisticsAt) return true;

    setAllInquiries((prev) => prev.map((x) => x.id === id ? {
      ...x,
      deliveryReceiptSentToLogisticsAt: new Date().toISOString(),
    } : x));
    return true;
  };

  const markDeliveryReceiptSent: Ctx["markDeliveryReceiptSent"] = (id, trackingLink) => {
    setAllInquiries((prev) => prev.map((x) => x.id === id ? {
      ...x,
      deliveryReceiptSentAt: new Date().toISOString(),
      deliveryTrackingLink: trackingLink ?? x.deliveryTrackingLink,
    } : x));
  };

  const sendInvoice: Ctx["sendInvoice"] = (id) => {
    const invoice = allInquiries.find((x) => x.id === id);
    if (!invoice?.invoiceNo) return false;
    const invoiceSentAt = new Date().toISOString();
    setAllInquiries((prev) => prev.map((x) => x.id === id ? { ...x, invoiceSentAt } : x));
    return true;
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

  const finalizeProductJOs: Ctx["finalizeProductJOs"] = (id, data) => {
    const src = allInquiries.find((i) => i.id === id);
    if (!src || src.stage !== "po" || src.joNumber || allInquiries.some((i) => i.parentInquiryId === id && i.stage === "jo")) return [];
    const parentInquiryId = src.parentInquiryId ?? src.id;
    const childIds: string[] = [];
    setAllInquiries((prev) => {
      const current = prev.find((inquiry) => inquiry.id === id);
      if (!current || current.stage !== "po" || current.joNumber || prev.some((inquiry) => inquiry.parentInquiryId === id && inquiry.stage === "jo")) return prev;
      const withoutSrc = prev.filter((x) => x.id !== id);
      const children = current.products.map((product, idx) => {
        const jo = data[idx] ?? data[0];
        const childId = idx === 0 ? id : `${id}-jo-${idx + 1}-${Date.now()}`;
        childIds.push(childId);
        return {
          ...current,
          id: childId,
          products: [product],
          productIndex: idx,
          parentInquiryId,
          stage: "jo" as Stage,
          joNumber: jo.joNumber,
          joSpecs: jo.joSpecs,
          joSketch: jo.joSketch,
          dpReceiptFile: jo.dpReceiptFile,
          signedQuotationFile: jo.signedQuotationFile,
          billOfMaterials: resolveProductBOM(current, idx),
          costConfig: current.productsCostConfig?.[idx] ?? current.costConfig,
          unitPrice: current.productsUnitPrice?.[idx] ?? current.unitPrice,
          quotedTotal: current.productsQuotedTotal?.[idx] ?? ((current.productsUnitPrice?.[idx] ?? current.unitPrice ?? 0) * product.qty),
          currentStage: 0,
          stageHistory: [],
          inventoryDeducted: false,
        };
      });
      return [...withoutSrc, ...children];
    });
    return childIds;
  };

  const confirmClientPayment: Ctx["confirmClientPayment"] = (inquiryId, payment) => {
    const id = `cp-${Date.now()}`;
    setAllInquiries((prev) => prev.map((x) => {
      if (x.id !== inquiryId || paymentState(x).currentPaymentType === null) return x;
      return {
        ...x,
      payments: [
        ...(x.payments ?? []),
        {
          id,
          inquiryId,
          invoiceNo: x.invoiceNo,
          paymentType: paymentState(x).currentPaymentType ?? "FULL_PAYMENT",
          submittedAmount: payment.amount,
          verifiedAmount: payment.amount,
          method: payment.method,
          referenceNumber: payment.ref,
          paymentDate: payment.date,
          verificationStatus: "verified" as const,
        },
      ],
      confirmedPayments: [...(x.confirmedPayments ?? []), { ...payment, id }],
      };
    }));
  };

  const submitPayment: Ctx["submitPayment"] = (inquiryId, payment) => {
    const id = `pmt-${Date.now()}`;
    setAllInquiries((prev) => prev.map((x) => {
      if (x.id !== inquiryId) return x;
      const state = paymentState(x);
      const pendingDownpayment = paymentRecords(x).some((record) =>
        record.paymentType === "DOWNPAYMENT" && record.verificationStatus === "pending",
      );
      if (state.currentPaymentType === null || (state.currentPaymentType === "DOWNPAYMENT" && pendingDownpayment)) return x;
      return {
        ...x,
      clientPaymentReceipts: payment.receiptFile
        ? [
            ...(x.clientPaymentReceipts ?? []),
            {
              id,
              date: payment.paymentDate,
              filename: payment.receiptFile,
              amount: payment.submittedAmount,
              note: payment.note ?? payment.referenceNumber,
            },
          ]
        : x.clientPaymentReceipts,
      payments: [
        ...(x.payments ?? []),
        {
          ...payment,
          id,
          inquiryId,
          invoiceNo: payment.invoiceNo ?? x.invoiceNo,
          paymentType: (() => {
            const state = paymentState(x);
            if (state.currentPaymentType === "DOWNPAYMENT") {
              return payment.submittedAmount + paymentEpsilon >= state.remainingInvoiceBalance
                ? "FULL_PAYMENT"
                : "DOWNPAYMENT";
            }
            return state.currentPaymentType ?? "FULL_PAYMENT";
          })(),
          verificationStatus: "pending" as const,
        },
      ],
      };
    }));
  };

  const verifyPayment: Ctx["verifyPayment"] = (inquiryId, paymentId, verifiedAmount) => {
    setAllInquiries((prev) => prev.map((x) => {
      if (x.id !== inquiryId) return x;
      const payments = (x.payments ?? []).map((payment) => payment.id === paymentId
        && payment.verificationStatus === "pending"
        && payment.submittedAmount > 0
        ? {
            ...payment,
            verifiedAmount: verifiedAmount ?? payment.submittedAmount,
            verificationStatus: "verified" as const,
            verifiedAt: new Date().toISOString(),
          }
        : payment);
      const verifiedInquiry = { ...x, payments };
      const state = paymentState(verifiedInquiry);
      const downpaymentConfirmed = state.requiredDownpaymentAmount > paymentEpsilon
        && state.verifiedDownpaymentAmount + paymentEpsilon >= state.requiredDownpaymentAmount;
      return downpaymentConfirmed
        ? {
            ...verifiedInquiry,
            downpaymentConfirmed: true,
            downpaymentConfirmedAt: new Date().toISOString(),
            downpaymentConfirmedBy: "Accounting Secretary",
          }
        : verifiedInquiry;
    }));
  };

  const rejectPayment: Ctx["rejectPayment"] = (inquiryId, paymentId) => {
    setAllInquiries((prev) => prev.map((x) => x.id === inquiryId ? {
      ...x,
      payments: (x.payments ?? []).map((payment) => payment.id === paymentId && payment.verificationStatus === "pending" ? {
        ...payment,
        verifiedAmount: undefined,
        verificationStatus: "rejected" as const,
        rejectedAt: new Date().toISOString(),
      } : payment),
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
      const receiptAt = x.clientSignedDRUploadedAt;
      const dueDate = receiptAt ? paymentDueDate(x.paymentTerms, receiptAt) : undefined;
      return {
        ...x,
        stage: "delivered",
        deliveredDate,
        invoiceNo,
        invoiceAmount,
        paymentCycleStartedAt: receiptAt,
        invoiceDueDate: dueDate,
      };
    }));
  };

  const savePendingSignedDeliveryReceipt: Ctx["savePendingSignedDeliveryReceipt"] = async (id, fileName, fileDataUrl, submittedBy) => {
    const inquiry = allInquiries.find((x) => x.id === id);
    if (!inquiry) throw new Error("Delivery order was not found");
    if (!inquiry.deliveryReceiptNumber) throw new Error("Generate a delivery receipt before uploading its signed copy");
    if (inquiry.signedDeliveryReceiptFileName) throw new Error("A signed delivery receipt has already been received for this order");
    if (signedDRUploadsInProgress.current.has(id)) throw new Error("A signed delivery receipt is already being processed for this order");
    if (!/^data:(application\/pdf|image\/jpeg|image\/png);base64,/.test(fileDataUrl)) {
      throw new Error("Upload a valid PDF, JPG, or PNG signed receipt");
    }

    signedDRUploadsInProgress.current.add(id);
    try {
      await saveInquiryAttachments(id, {
        paymentReceiptDataUrls: {},
        pendingSignedDeliveryReceiptDataUrl: fileDataUrl,
      });
      setAllInquiries((prev) => prev.map((x) => x.id === id ? {
        ...x,
        pendingSignedDeliveryReceiptFileName: fileName,
        pendingSignedDeliveryReceiptSubmittedBy: submittedBy,
        pendingSignedDeliveryReceiptDataUrl: fileDataUrl,
      } : x));
    } finally {
      signedDRUploadsInProgress.current.delete(id);
    }
  };

  const submitPendingSignedDeliveryReceipt: Ctx["submitPendingSignedDeliveryReceipt"] = async (id) => {
    const inquiry = allInquiries.find((x) => x.id === id);
    if (!inquiry) throw new Error("Delivery order was not found");
    if (!inquiry.deliveryReceiptNumber) throw new Error("Generate a delivery receipt before submitting its signed copy");
    if (inquiry.signedDeliveryReceiptFileName) throw new Error("A signed delivery receipt has already been received for this order");
    if (!inquiry.pendingSignedDeliveryReceiptFileName || !inquiry.pendingSignedDeliveryReceiptSubmittedBy) {
      throw new Error("Upload a signed Delivery Receipt before submitting it");
    }
    if (signedDRUploadsInProgress.current.has(id)) throw new Error("A signed delivery receipt is already being processed for this order");

    signedDRUploadsInProgress.current.add(id);
    try {
      const receivedAt = new Date().toISOString();
      const signedDeliveryReceiptDataUrl = await promotePendingSignedDeliveryReceipt(id);
      setAllInquiries((prev) => prev.map((x) => x.id === id ? {
        ...x,
        pendingSignedDeliveryReceiptFileName: undefined,
        pendingSignedDeliveryReceiptSubmittedBy: undefined,
        pendingSignedDeliveryReceiptDataUrl: undefined,
        signedDeliveryReceiptFileName: inquiry.pendingSignedDeliveryReceiptFileName,
        signedDeliveryReceiptSubmittedBy: inquiry.pendingSignedDeliveryReceiptSubmittedBy,
        signedDeliveryReceiptReceivedAt: receivedAt,
        signedDeliveryReceiptNumber: inquiry.deliveryReceiptNumber,
        signedDeliveryReceiptDataUrl,
      } : x));
    } finally {
      signedDRUploadsInProgress.current.delete(id);
    }
  };

  /* — Downpayment workflow actions — */
  const sendDownpaymentDetails: Ctx["sendDownpaymentDetails"] = (id, details) => {
    setAllInquiries((prev) => prev.map((x) => x.id === id ? { ...x, downpaymentPaymentDetails: details } : x));
  };
  const uploadDownpaymentReceipt: Ctx["uploadDownpaymentReceipt"] = (id, fileName) => {
    setAllInquiries((prev) => prev.map((x) => x.id === id ? {
      ...x,
      downpaymentReceiptFile: fileName,
      downpaymentReceiptUploadedAt: new Date().toISOString(),
    } : x));
  };
  const confirmDownpayment: Ctx["confirmDownpayment"] = (id, confirmedBy) => {
    setAllInquiries((prev) => prev.map((x) => x.id === id ? {
      ...x,
      downpaymentConfirmed: true,
      downpaymentConfirmedAt: new Date().toISOString(),
      downpaymentConfirmedBy: confirmedBy,
    } : x));
  };

  /* Atomically create a replacement JO from a parent inquiry's replacement request.
     Mirrors product specs/BOM, jumps straight to "jo" stage, and updates the parent's
     replacement request to "processing" with the new JO number. */
  const createReplacementJO: Ctx["createReplacementJO"] = (parentInquiryId, requestId, qty, reason) => {
    const parent = allInquiries.find((i) => i.id === parentInquiryId);
    if (!parent) return "";
    const id = `inq-${Date.now()}`;
    const num = String(allInquiries.length + 4).padStart(3, "0");
    const code = `INQ-${num}`;
    const joNumber = `JO-${new Date().getFullYear()}-${String(allInquiries.filter((i) => i.joNumber).length + 1).padStart(3, "0")}`;
    const newInq: Inquiry = {
      id, code,
      clientName: parent.clientName,
      contactPerson: parent.contactPerson,
      paymentTerms: parent.paymentTerms,
      generalNotes: `REPLACEMENT for ${parent.code} — ${reason}`,
      submittedDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      products: parent.products.map((p) => ({ ...p, id: `${p.id}-r`, qty })),
      /* Carry over costing/BOM so production has materials info */
      billOfMaterials: parent.billOfMaterials,
      costConfig: parent.costConfig,
      unitPrice: parent.unitPrice,
      quotedTotal: parent.unitPrice ? parent.unitPrice * qty : undefined,
      productsBillOfMaterials: parent.productsBillOfMaterials,
      productsCostConfig: parent.productsCostConfig,
      productsUnitPrice: parent.productsUnitPrice,
      stage: "jo",
      joNumber,
      urgent: true,
      isReplacement: true,
      replacementParentId: parentInquiryId,
      currentStage: 0,
      stageHistory: [],
    };
    setAllInquiries((prev) => [
      ...prev.map((x) => x.id === parentInquiryId
        ? {
            ...x,
            replacementRequests: (x.replacementRequests ?? []).map((r) =>
              r.id === requestId ? { ...r, status: "processing" as const, joNumber } : r
            ),
          }
        : x),
      newInq,
    ]);
    return joNumber;
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
        trackingRef: undefined,
        deliveryTrackingLink: undefined,
        drFileName: undefined,
        drUploadedAt: undefined,
        deliveryReceiptNumber: undefined,
        deliveryReceiptGeneratedAt: undefined,
        deliveryReceiptGeneratedBy: undefined,
        deliveryReceiptSentToLogisticsAt: undefined,
        deliveryReceiptSentAt: undefined,
        clientSignedDRFileName: undefined,
        clientSignedDRUploadedAt: undefined,
        signedDeliveryReceiptFileName: undefined,
        signedDeliveryReceiptSubmittedBy: undefined,
        signedDeliveryReceiptReceivedAt: undefined,
        signedDeliveryReceiptNumber: undefined,
        signedDeliveryReceiptDataUrl: undefined,
        fulfillmentCompletedAt: undefined,
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
          ? {
              ...x,
              clientPaymentReceipts: [...(x.clientPaymentReceipts ?? []), { ...receipt, id }],
              payments: [
                ...(x.payments ?? []),
                {
                  id,
                  inquiryId,
                  invoiceNo: x.invoiceNo,
                  paymentType: paymentState(x).currentPaymentType ?? "FULL_PAYMENT",
                  submittedAmount: receipt.amount,
                  method: "Not specified",
                  referenceNumber: receipt.note,
                  receiptFile: receipt.filename,
                  paymentDate: receipt.date,
                  verificationStatus: "pending" as const,
                  note: receipt.note,
                },
              ],
            }
          : x
      )
    );
  };

  const addReplacementRequest: Ctx["addReplacementRequest"] = (inquiryId, req) => {
    const id = `rr-${Date.now()}`;
    setAllInquiries((prev) =>
      prev.map((x) =>
        x.id === inquiryId
          ? {
              ...x,
              replacementRequests: [
                ...(x.replacementRequests ?? []),
                { ...req, id, status: "pending" as const, requestedAt: new Date().toISOString() },
              ],
            }
          : x
      )
    );
  };

  const resolveReplacement: Ctx["resolveReplacement"] = (inquiryId, requestId) => {
    setAllInquiries((prev) =>
      prev.map((x) =>
        x.id === inquiryId
          ? {
              ...x,
              replacementRequests: (x.replacementRequests ?? []).map((r) =>
                r.id === requestId ? { ...r, status: "resolved" as const, resolvedAt: new Date().toISOString() } : r
              ),
            }
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
      confirmClientPayment, submitPayment, verifyPayment, rejectPayment,
      setBillOfMaterials, setProductsCosting, markInventoryDeducted,
      setQuotationDoc, generateQuotationNumber, generatePONumber, generateJONumber, generateInvoice, generateDeliveryReceipt, sendDeliveryReceiptToLogistics, markDeliveryReceiptSent, sendInvoice, finalizeProductJOs,
      addClientReceipt, addReplacementRequest, resolveReplacement, reorderToProduction, markPOCleared,
      updateInquiry, inquiriesByStage,
      setStage, setUrgent, setDueDate, markDelivered, savePendingSignedDeliveryReceipt, submitPendingSignedDeliveryReceipt,
      sendDownpaymentDetails, uploadDownpaymentReceipt, confirmDownpayment,
      createReplacementJO,
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
