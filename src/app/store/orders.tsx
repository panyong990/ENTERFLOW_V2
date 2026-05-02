import { createContext, useContext, useState, type ReactNode } from "react";

export type Stage =
  | "inquiry"
  | "quotation"
  | "po"
  | "jo"
  | "in_production"
  | "quality_inspection"
  | "ready_for_dispatch"
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
  delivered:         { bg: "#CCFBF1", fg: "#0F766E" },
  paid:              { bg: "#DCFCE7", fg: "#166534" },
  overdue:           { bg: "#FEE2E2", fg: "#C8102E" },
};

export interface ProductLine {
  id: string;
  type: string;
  od1?: string; od2?: string; id1?: string; id2?: string; height?: string;
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
  /* — already-generated JO (seed for demo) — */
  {
    id: "i0", code: "INQ-001", clientName: "B.E. Aerospace", contactPerson: "M. Rivera",
    paymentTerms: "30-Day Terms", submittedDate: "Mar 28, 2026", stage: "jo",
    poFileName: "PO-2026-9901.pdf", urgent: false,
    products: [
      { id: "p1", type: "Air Filter", od1: "115", od2: "103", id1: "64.6", height: "500", media: "Microglass Fiber", innerCore: "Expanded Metal Perfo 2mm", oem: "KF-OS.107.65.252", qty: 50 },
    ],
    quotation: { sentDate: "Mar 29, 2026", leadTimeDays: 14, lines: [{ productId: "p1", materialCost: 800, labor: 400, markupPct: 30 }] },
    joNumber: "JO-2026-001",
    joSpecs: { od1: "115", od2: "103", id1: "64.6", height: "500", overallHeight: "512", endCap: "E.G. (1.0mm)", media: "Microglass Fiber / Inside", innerCore: "Expanded Metal Perfo 2mm", brand: "Hitachi Comp.", oem: "KF-OS.107.65.252" },
    joSketch: "KF-OS.107.65.252_drawing.pdf",
    signedQuotationFile: "QT-2026-9901-signed.pdf",
    dpReceiptFile: "DP-receipt-BE-Mar2026.jpg",
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
  addClientReceipt: (inquiryId: string, receipt: Omit<ClientReceipt, "id">) => void;
  markPOCleared: (po: string) => void;
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
    (i) => !i.archived && (i.stage === "jo" || i.stage === "in_production" || i.stage === "quality_inspection" || i.stage === "ready_for_dispatch" || i.stage === "delivered" || i.stage === "paid" || i.stage === "overdue")
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

  const confirmClientPayment: Ctx["confirmClientPayment"] = (inquiryId, payment) => {
    const id = `cp-${Date.now()}`;
    setAllInquiries((prev) => prev.map((x) => x.id === inquiryId ? {
      ...x,
      confirmedPayments: [...(x.confirmedPayments ?? []), { ...payment, id }],
    } : x));
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
    const joNum = `JO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;
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
      confirmClientPayment,
      addClientReceipt, reorderToProduction, markPOCleared,
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
