import type { BOMLine, CostConfig } from "../../store/materials";
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
  shipping?: {
    label: string;
    amount: number;
    includeInUnit: boolean;
    transitEstimate?: {
      minCalendarDays: number;
      maxCalendarDays: number;
      isPlaceholder: boolean;
    };
  };
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
  | "overdue"
  | "unavailable";

export const stageLabel: Record<Stage, string> = {
  unavailable: "Unavailable",
  inquiry: "New Inquiry",
  quotation: "Quotation Sent",
  po: "PO Validation",
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
  unavailable: { bg: "#F1F5F9", fg: "#475569" },
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

export interface OfficialReceipt {
  orNumber: string;
  issueDate: string;
  invoiceId: string;
  invoiceNo: string;
  clientName: string;
  amount: number;
  issuedBy: string;
  status: "issued";
  documentDataUrl: string;
}

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
  rejectionReason?: string;
  proofFileId?: string;
  proofFilename?: string;
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

export interface CancellationRequestHistory {
  reason: string;
  requestedAt: string;
  requestedBy: "client" | "management";
  resolution: "pending" | "approved" | "declined" | "completed";
  response?: string;
  resolvedAt?: string;
}

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
  poFileId?: string;
  poNumber?: string;
  poFileDataUrl?: string;
  poUploadedAt?: string;
  /** Sales confirmation state for a client-uploaded PO. */
  poReceived?: boolean;
  poStatus?: "Pending Sales Review" | "Approved" | "Rejected";
  poSubmissions?: POSubmission[];
  urgent?: boolean;
  dueDate?: string;
  productionDueDate?: string;
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
  /* Accounting-issued Official Receipt; separate from payment completion. */
  officialReceipt?: OfficialReceipt;
  /* — cancellation approval flow — */
  pendingCancellation?: { reason: string; requestedAt: string; requestedBy: "client" | "management" };
  cancellationHistory?: CancellationRequestHistory[];
  /* — bill of materials + cost config (set during quotation, carried into JO) — */
  billOfMaterials?: BOMLine[];
  costConfig?: CostConfig;
  unitPrice?: number;
  quotedTotal?: number;
  /* — formal quotation document (Tab 3 output) — */
  quotationDoc?: QuotationDoc;
  quotationId?: string;
  quotationStatus?: "sent" | "superseded";
  quotationIsLatestRevision?: boolean;
  quotationDecision?: "accepted" | "rejected" | null;
  quotationDecisionReason?: string | null;
  quotationDecidedAt?: string | null;
  quotationDownpaymentValid?: boolean;
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
  revisionRequests?: {
    id: string;
    note: string;
    requestedAt: string;
    quotationNo?: string;
    status: "pending" | "processed";
    processedAt?: string;
    responseQuotationNo?: string;
  }[];
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
  reorderSourceInquiryId?: string;
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

export interface POSubmission {
  id: string;
  fileName: string;
  poNumber: string;
  submittedAt: string;
  status: "Pending Sales Review" | "Approved" | "Rejected";
  fileDataUrl?: string;
  rejectionReason?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export function latestPOSubmission(inquiry: Inquiry): POSubmission | undefined {
  return inquiry.poSubmissions?.[inquiry.poSubmissions.length - 1];
}

export function poReviewStatus(inquiry: Inquiry): POSubmission["status"] | undefined {
  return inquiry.poStatus
    ?? latestPOSubmission(inquiry)?.status
    ?? (inquiry.poReceived
      ? "Approved"
      : inquiry.poFileName && (inquiry.poUploaded || inquiry.poFileDataUrl)
        ? "Pending Sales Review"
        : undefined);
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

export function poNumberForDisplay(inquiry: Pick<Inquiry, "poNumber" | "poFileName">): string | undefined {
  const storedPONumber = inquiry.poNumber?.trim();
  if (storedPONumber && /^PO-\d{4}-\d+$/i.test(storedPONumber)) return storedPONumber;

  const filenameReference = inquiry.poFileName?.replace(/\.[^.]+$/, "");
  return filenameReference && /^PO-\d{4}-\d+$/i.test(filenameReference)
    ? filenameReference
    : undefined;
}

export interface FinalizeJOData {
  joNumber: string;
  productionDueDate: string;
  deliveryMethod: NonNullable<Inquiry["deliveryMethod"]>;
  joSpecs?: JOSpecs;
  joSketch?: string;
  dpReceiptFile?: string;
  signedQuotationFile?: string;
}

export function isValidProductionDueDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const unitPrice = (l: QuotationLine) => Math.round((l.materialCost + l.labor) * (1 + l.markupPct / 100));
export const lineSubtotal = (line: QuotationLine, qty: number) => unitPrice(line) * qty;
export const quotationTotal = (inq: Inquiry) =>
  (inq.quotation?.lines ?? []).reduce((sum, l) => {
    const p = inq.products.find((p) => p.id === l.productId);
    return sum + (p ? lineSubtotal(l, p.qty) : 0);
  }, 0);

export const toMoneyCents = (amount: number): number => Math.round(amount * 100);
export const fromMoneyCents = (cents: number): number => cents / 100;
export const formatMoney = (amount: number): string =>
  fromMoneyCents(toMoneyCents(amount)).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const invoiceTotal = (inq: Inquiry): number =>
  fromMoneyCents(toMoneyCents(inq.invoiceAmount ?? inq.quotedTotal ?? quotationTotal(inq)));

export const requiredDownpaymentAmount = (inq: Inquiry): number => {
  if (inq.downpaymentAmount !== undefined) return inq.downpaymentAmount;
  const percent = inq.quotationDoc?.downpaymentPercent ?? inq.downpaymentPercent ?? 0;
  return fromMoneyCents(Math.round(toMoneyCents(invoiceTotal(inq)) * percent / 100));
};

export const paymentRecords = (inq: Inquiry): PaymentRecord[] => inq.payments ?? [];

export const verifiedPayments = (inq: Inquiry): PaymentRecord[] =>
  paymentRecords(inq).filter((payment) => payment.verificationStatus === "verified");

export const paymentState = (inq: Inquiry): PaymentStateSummary => {
  const total = invoiceTotal(inq);
  const requiredDp = requiredDownpaymentAmount(inq);
  const totalCents = toMoneyCents(total);
  const requiredDpCents = toMoneyCents(requiredDp);
  const verified = verifiedPayments(inq);
  const verifiedDpCents = verified
    .filter((payment) => payment.paymentType === "DOWNPAYMENT")
    .reduce((sum, payment) => sum + toMoneyCents(payment.verifiedAmount ?? payment.submittedAmount), 0);
  const totalVerifiedCents = verified.reduce(
    (sum, payment) => sum + toMoneyCents(payment.verifiedAmount ?? payment.submittedAmount),
    0,
  );
  const verifiedDp = fromMoneyCents(verifiedDpCents);
  const totalVerified = fromMoneyCents(totalVerifiedCents);
  const remainingDp = fromMoneyCents(Math.max(0, requiredDpCents - verifiedDpCents));
  const remainingBalance = fromMoneyCents(Math.max(0, totalCents - totalVerifiedCents));

  if (remainingBalance === 0) {
    return {
      invoiceTotal: total,
      requiredDownpaymentAmount: requiredDp,
      verifiedDownpaymentAmount: verifiedDp,
      remainingDownpayment: remainingDp,
      downpaymentStatus: requiredDpCents > 0 ? "COMPLETE" : "NOT_REQUIRED",
      totalVerifiedPayments: totalVerified,
      remainingInvoiceBalance: 0,
      currentPaymentType: null,
      state: "FULLY_PAID",
    };
  }
  if (requiredDpCents > 0 && verifiedDpCents < requiredDpCents) {
    return {
      invoiceTotal: total,
      requiredDownpaymentAmount: requiredDp,
      verifiedDownpaymentAmount: verifiedDp,
      remainingDownpayment: remainingDp,
      downpaymentStatus: verifiedDpCents > 0 ? "PARTIAL" : "REQUIRED",
      totalVerifiedPayments: totalVerified,
      remainingInvoiceBalance: remainingBalance,
      currentPaymentType: "DOWNPAYMENT",
      state: verifiedDpCents > 0 ? "DOWNPAYMENT_PARTIAL" : "DOWNPAYMENT_REQUIRED",
    };
  }
  return {
    invoiceTotal: total,
    requiredDownpaymentAmount: requiredDp,
    verifiedDownpaymentAmount: verifiedDp,
    remainingDownpayment: 0,
    downpaymentStatus: requiredDpCents > 0 ? "COMPLETE" : "NOT_REQUIRED",
    totalVerifiedPayments: totalVerified,
    remainingInvoiceBalance: remainingBalance,
    currentPaymentType: requiredDpCents > 0 ? "BALANCE_PAYMENT" : "FULL_PAYMENT",
    state: requiredDpCents > 0 ? "BALANCE_PAYMENT_REQUIRED" : "FULL_PAYMENT_REQUIRED",
  };
};

export function paymentSubmissionAllowance(inq: Inquiry): { paymentType: PaymentType | null; maxAmount: number } {
  const state = paymentState(inq);
  const paymentType = state.currentPaymentType;
  if (!paymentType || inq.stage === "paid") return { paymentType: null, maxAmount: 0 };

  const records = paymentRecords(inq);
  if (records.some((payment) => payment.verificationStatus === "pending")) {
    return { paymentType: null, maxAmount: 0 };
  }

  if (
    paymentType === "BALANCE_PAYMENT"
    && (!hasValidSignedDeliveryReceipt(inq)
      || inq.paymentCycleStartedAt !== inq.signedDeliveryReceiptReceivedAt)
  ) return { paymentType: null, maxAmount: 0 };

  const pendingAmountCents = records
    .filter((payment) => payment.verificationStatus === "pending")
    .reduce((sum, payment) => sum + toMoneyCents(payment.submittedAmount), 0);
  const availableBalanceCents = Math.max(0, toMoneyCents(state.remainingInvoiceBalance) - pendingAmountCents);
  const typeBalanceCents = paymentType === "DOWNPAYMENT"
    ? toMoneyCents(state.remainingDownpayment)
    : toMoneyCents(state.remainingInvoiceBalance);
  const maxAmount = fromMoneyCents(Math.min(availableBalanceCents, typeBalanceCents));

  return maxAmount > 0
    ? { paymentType, maxAmount }
    : { paymentType: null, maxAmount: 0 };
}

export const exactDownpaymentValidationMessage = (inq: Inquiry, submittedAmount: number): string | undefined => {
  const requiredCents = toMoneyCents(requiredDownpaymentAmount(inq));
  if (toMoneyCents(submittedAmount) === requiredCents) return undefined;
  return `Please enter the exact required downpayment amount of ₱${formatMoney(fromMoneyCents(requiredCents))}. Partial or excess downpayment amounts are not accepted.`;
};
