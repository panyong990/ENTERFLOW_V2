import { Fragment, useState, useEffect, useMemo } from "react";
import { FileText, ClipboardList, Search, Plus, CheckCircle2, X, Send, AlertTriangle, ChevronDown, ChevronUp, PlusCircle, Receipt, Eye, History, Pencil, Download } from "lucide-react";
import { hasValidSignedDeliveryReceipt, useOrders, paymentDaysRemaining, paymentRecords, paymentState, type Inquiry, type PaymentRecord, type PaymentType } from "../store/orders";
import { useNotifications } from "../store/notifications";
import { NotificationBell } from "./NotificationBell";
import { Toaster, toast } from "sonner";

type Status = "paid" | "pending";

interface PaymentEntry {
  id: string;
  date: string;
  amount: number;
  method: string;
  ref: string;
}

interface Invoice {
  id: string;
  date: string;
  inv: string;
  po: string;
  joNumber?: string;
  deliveryReceiptNumber?: string;
  client: string;
  item: string;
  amount: number;
  payment: string;
  paymentType: string;
  paymentState: ReturnType<typeof paymentState>;
  paymentRecords: PaymentRecord[];
  downpaymentPercent: number;
  status: Status;
  deliveredDate?: string;
  paymentCycleStartedAt?: string;
  dueDate?: string;
  fulfillmentCompleted: boolean;
  signedDeliveryReceiptFileName?: string;
  signedDeliveryReceiptSubmittedBy?: string;
  signedDeliveryReceiptReceivedAt?: string;
  signedDeliveryReceiptDataUrl?: string;
}

/* Derive an Invoice row from an Inquiry. Anything in delivered/paid/overdue stage is invoiced. */
function inquiryToInvoice(inq: Inquiry): Invoice {
  const state = paymentState(inq);
  const isPaid = inq.stage === "paid" || state.state === "FULLY_PAID";
  const signedDRReceived = hasValidSignedDeliveryReceipt(inq);
  const typeLabel: Record<PaymentType, string> = {
    DOWNPAYMENT: `REQUIRED DOWNPAYMENT · ${inq.quotationDoc?.downpaymentPercent ?? inq.downpaymentPercent ?? 0}%`,
    BALANCE_PAYMENT: "BALANCE PAYMENT",
    FULL_PAYMENT: "FULL PAYMENT",
  };
  return {
    id: inq.id,
    date: inq.deliveredDate ?? inq.submittedDate,
    inv: inq.invoiceNo ?? `SI-${inq.code.replace("INQ-", "")}`,
    po: inq.poFileName?.replace(/\.\w+$/, "") ?? `PO-${inq.code}`,
    joNumber: inq.joNumber,
    deliveryReceiptNumber: inq.deliveryReceiptNumber,
    client: inq.clientName,
    item: `${inq.products[0]?.type ?? "Filter"} (${inq.products.reduce((s, p) => s + p.qty, 0)} pcs)`,
    amount: state.invoiceTotal,
    payment: isPaid ? "Cleared" : inq.paymentTerms,
    paymentType: state.currentPaymentType ? typeLabel[state.currentPaymentType] : "FULLY PAID",
    paymentState: state,
    paymentRecords: paymentRecords(inq),
    downpaymentPercent: inq.quotationDoc?.downpaymentPercent ?? inq.downpaymentPercent ?? 0,
    status: isPaid ? "paid" : "pending",
    deliveredDate: inq.deliveredDate,
    paymentCycleStartedAt: signedDRReceived
      && inq.paymentCycleStartedAt === inq.signedDeliveryReceiptReceivedAt
      ? inq.paymentCycleStartedAt
      : undefined,
    dueDate: signedDRReceived && inq.paymentCycleStartedAt === inq.signedDeliveryReceiptReceivedAt
      ? inq.invoiceDueDate
      : undefined,
    fulfillmentCompleted: signedDRReceived,
    signedDeliveryReceiptFileName: signedDRReceived ? inq.signedDeliveryReceiptFileName : undefined,
    signedDeliveryReceiptSubmittedBy: signedDRReceived ? inq.signedDeliveryReceiptSubmittedBy : undefined,
    signedDeliveryReceiptReceivedAt: signedDRReceived ? inq.signedDeliveryReceiptReceivedAt : undefined,
    signedDeliveryReceiptDataUrl: signedDRReceived ? inq.signedDeliveryReceiptDataUrl : undefined,
  };
}

type GranularStatus = "Paid" | "Partial" | "Overdue" | "Pending" | "Awaiting Verification" | "Rejected";
function granularStatus(inv: Invoice, totalPaid: number, now = new Date()): GranularStatus {
  if (inv.status === "paid") return "Paid";
  if (inv.paymentRecords.some((payment) => payment.verificationStatus === "pending")) return "Awaiting Verification";
  if (inv.paymentRecords.some((payment) => payment.verificationStatus === "rejected")) return "Rejected";
  const daysRemaining = inv.dueDate ? paymentDaysRemaining(inv.dueDate, now) : undefined;
  if (daysRemaining !== undefined && daysRemaining < 0) return "Overdue";
  if (totalPaid > 0 && totalPaid < inv.amount) return "Partial";
  return "Pending";
}

const granularStyle: Record<GranularStatus, { bg: string; fg: string }> = {
  Paid:    { bg: "#DCFCE7", fg: "#15803D" },
  Partial: { bg: "#DBEAFE", fg: "#1D4ED8" },
  Pending: { bg: "#FEF3C7", fg: "#B45309" },
  Overdue: { bg: "#FEE2E2", fg: "#C8102E" },
  "Awaiting Verification": { bg: "#DBEAFE", fg: "#1D4ED8" },
  Rejected: { bg: "#FEE2E2", fg: "#C8102E" },
};

function StatusPill({ status }: { status: GranularStatus }) {
  const s = granularStyle[status];
  return (
    <span className="font-dm px-2.5 py-1 rounded-full" style={{ fontSize: 11, fontWeight: 600, backgroundColor: s.bg, color: s.fg }}>
      {status === "Overdue" ? "⚠️ " : ""}{status}
    </span>
  );
}

function KPI({ label, value, accent = "#0F172A" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/70 p-5" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <div className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</div>
      <div className="font-syne mt-2" style={{ fontSize: 28, fontWeight: 800, color: accent, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

export function Accounting() {
  const [query, setQuery] = useState("");
  const [payments, setPayments] = useState<Record<string, PaymentEntry[]>>({});
  const [newPmt, setNewPmt] = useState<Record<string, { amount: string; method: string; ref: string; datePaid: string }>>({});
  const [viewReceiptsId, setViewReceiptsId] = useState<string | null>(null);
  const [view, setView] = useState<"active" | "history">("active");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingReceipt, setEditingReceipt] = useState<{ invoiceId: string; receipt: PaymentEntry } | null>(null);
  const [proofToView, setProofToView] = useState<{ filename: string; dataUrl: string } | null>(null);
  const { byClient, inquiriesByStage, updateInquiry, markPOCleared, confirmClientPayment, verifyPayment, rejectPayment } = useOrders();
  const { push: pushNotif } = useNotifications();
  const [showOverdueModal, setShowOverdueModal] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  /* DERIVED: invoices come from the orders store. Anything past delivery is invoiced. */
  const trackedInquiries = useMemo(
    () => inquiriesByStage(["po", "jo", "in_production", "quality_inspection", "ready_for_dispatch", "dispatched", "delivered", "overdue", "paid"]),
    [inquiriesByStage]
  );
  const invoiceInquiries = useMemo(
    () => trackedInquiries.filter((inquiry) => !!inquiry.invoiceSentAt && !!inquiry.invoiceNo),
    [trackedInquiries]
  );
  const rows = useMemo(() => invoiceInquiries.map(inquiryToInvoice), [invoiceInquiries]);
  const fulfillmentRows = useMemo(
    () => trackedInquiries
      .filter((inquiry) => hasValidSignedDeliveryReceipt(inquiry) && !inquiry.invoiceSentAt)
      .map(inquiryToInvoice),
    [trackedInquiries]
  );
  const [openId, setOpenId] = useState<string | null>(() =>
    rows.find((row) => row.paymentRecords.some((payment) => payment.verificationStatus === "pending"))?.id ?? null
  );

  /* Hydrate seeded confirmed payments from the inquiry into the local payments map (for the running-balance ledger UI) */
  useEffect(() => {
    setPayments((prev) => {
      const next = { ...prev };
      invoiceInquiries.forEach((inq) => {
        if (inq.confirmedPayments && inq.confirmedPayments.length > 0 && !prev[inq.id]) {
          next[inq.id] = inq.confirmedPayments.map((cp) => ({ id: cp.id, date: cp.date, amount: cp.amount, method: cp.method, ref: cp.ref }));
        }
      });
      return next;
    });
  }, [invoiceInquiries]);

  const matchesSearch = (r: Invoice) =>
    query === "" || r.inv.toLowerCase().includes(query.toLowerCase()) || r.client.toLowerCase().includes(query.toLowerCase());
  const inDateRange = (r: Invoice) => {
    if (!dateFrom && !dateTo) return true;
    const d = r.date;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  };
  const activeInvoices = rows.filter((r) => r.status === "pending" && matchesSearch(r) && inDateRange(r));
  const historyInvoices = rows.filter((r) => r.status === "paid" && matchesSearch(r) && inDateRange(r));
  const visible = view === "active" ? activeInvoices : historyInvoices;

  /* Auto-overdue notification: fire once per overdue invoice on mount */
  const [overdueNotified, setOverdueNotified] = useState<Set<string>>(new Set());
  useEffect(() => {
    rows.forEach((r) => {
      if (r.status !== "pending" || !r.dueDate) return;
      const due = new Date(r.dueDate);
      if (isNaN(due.getTime()) || due.getTime() >= Date.now()) return;
      if (overdueNotified.has(r.id)) return;
      pushNotif({
        dept: "payments",
        title: `⚠️ Invoice overdue: ${r.inv}`,
        body: `${r.client} · ₱${r.amount.toLocaleString("en-PH")} · was due ${r.dueDate}`,
        link: "accounting",
        recipients: ["owner", "operations", "accounting"],
      });
      setOverdueNotified(prev => new Set(prev).add(r.id));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const [reportMonth, setReportMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const monthlyExport = () => {
    const [yr, mo] = reportMonth.split("-");
    const monthName = new Date(Number(yr), Number(mo) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    toast.success(`Generating report — ${monthName}`, {
      description: `${visible.length} rows · CSV + PDF download started`,
    });
    setShowMonthPicker(false);
  };

  const editReceipt = (invId: string, oldEntry: PaymentEntry, next: { amount: number; method: string; ref: string; date: string }) => {
    setPayments(prev => ({
      ...prev,
      [invId]: (prev[invId] ?? []).map(p => p.id === oldEntry.id ? { ...p, ...next } : p),
    }));
    toast.success("Receipt updated");
  };

  const addPayment = (id: string) => {
    const f = newPmt[id];
    if (!f?.amount || !f?.method) { toast.error("Amount and method required"); return; }
    const amt = parseFloat(f.amount);
    if (isNaN(amt) || amt <= 0) { toast.error("Invalid amount"); return; }
    const entryDate = f.datePaid?.trim()
      ? f.datePaid
      : new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const entry: PaymentEntry = {
      id: `pe-${Date.now()}`, date: entryDate,
      amount: amt, method: f.method, ref: f.ref || "—",
    };
    setPayments((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), entry] }));
    setNewPmt((prev) => ({ ...prev, [id]: { amount: "", method: "", ref: "", datePaid: "" } }));
    /* Sync to client portal — find matching inquiry by client name */
    const inv = rows.find(r => r.id === id);
    if (inv) {
      const clientInqs = byClient(inv.client);
      const target = clientInqs.find(i => i.poFileName?.includes(inv.po) || i.invoiceNo === inv.inv) ?? clientInqs[clientInqs.length - 1];
      if (target) {
        confirmClientPayment(target.id, { date: entryDate, amount: amt, method: f.method, ref: f.ref || "—" });
        pushNotif({
          dept: "payments",
          title: `Payment confirmed for ${inv.client}`,
          body: `₱${amt.toLocaleString("en-PH")} · ${inv.inv} · synced to client portal`,
          link: "accounting",
          recipients: ["client"],
        });
      }
    }
    toast.success("Payment recorded", { description: `₱${amt.toLocaleString("en-PH")} via ${f.method} · synced to client portal` });
  };

  const clearAccount = (id: string) => {
    const inv = rows.find(r => r.id === id);
    if (!inv) return;
    /* Single store write — `paid` stage triggers derived removal from active table everywhere */
    updateInquiry(id, { stage: "paid", paidAt: new Date().toISOString(), amountPaid: inv.amount });
    markPOCleared(inv.po); /* sync → auto-removes from Logistics active too */
    pushNotif({
      dept: "payments",
      title: `Payment cleared: ${inv.inv}`,
      body: `${inv.client} · ₱${inv.amount.toLocaleString("en-PH")} · fully settled`,
      link: "accounting",
      recipients: ["owner", "operations", "sales"],
    });
    setOpenId(null);
    toast.success("Account cleared", { description: `${inv.client} · ${inv.inv} fully settled · removed from active tables` });
  };

  const handleVerifyClientPayment = (invoice: Invoice, payment: PaymentRecord) => {
    if (payment.verificationStatus !== "pending" || payment.submittedAmount <= 0 || !payment.receiptDataUrl) return;
    const remaining = Math.max(0, invoice.paymentState.remainingInvoiceBalance - payment.submittedAmount);
    const verifiedDownpayment = invoice.paymentState.verifiedDownpaymentAmount
      + (payment.paymentType === "DOWNPAYMENT" ? payment.submittedAmount : 0);
    const requiredDownpayment = invoice.paymentState.requiredDownpaymentAmount;
    const requirementMet = requiredDownpayment > 0
      ? (payment.paymentType === "FULL_PAYMENT" ? remaining <= 0.005 : verifiedDownpayment + 0.005 >= requiredDownpayment)
      : remaining <= 0.005;
    const typeLabel = payment.paymentType === "DOWNPAYMENT" ? "DOWNPAYMENT"
      : payment.paymentType === "BALANCE_PAYMENT" ? "BALANCE PAYMENT" : "FULL PAYMENT";

    verifyPayment(invoice.id, payment.id);
    pushNotif({
      dept: "payments",
      title: "Payment Verified",
      body: `${invoice.inv} · ${typeLabel} · ₱${payment.submittedAmount.toLocaleString("en-PH")} verified · remaining balance ₱${remaining.toLocaleString("en-PH")}`,
      link: "accounting",
      clientName: invoice.client,
      recipients: ["client"],
    });
    pushNotif({
      dept: "payments",
      title: `PAYMENT VERIFIED: ${invoice.inv}`,
      body: `${invoice.client} · ${typeLabel} of ₱${payment.submittedAmount.toLocaleString("en-PH")} verified · ${requirementMet ? "required payment condition satisfied; order is ready for Job Order generation" : "required payment condition is not yet satisfied"}`,
      link: "sales",
      recipients: ["owner", "operations", "sales"],
    });
    toast.success("Payment verified", { description: `${invoice.inv} · ${typeLabel}` });
  };

  const handleRejectClientPayment = (invoice: Invoice, payment: PaymentRecord) => {
    if (payment.verificationStatus !== "pending") return;
    rejectPayment(invoice.id, payment.id);
    pushNotif({
      dept: "payments",
      title: `Payment Rejected: ${invoice.inv}`,
      body: `${invoice.client} · ${payment.paymentType.replace("_", " ")} · ₱${payment.submittedAmount.toLocaleString("en-PH")} · Please review and resubmit proof of payment.`,
      link: "accounting",
      clientName: invoice.client,
      recipients: ["client"],
    });
    toast.info("Payment rejected", { description: `${invoice.inv} · client notified to resubmit` });
  };

  const overdueRows = rows.filter(r => r.status === "pending");
  const overdueDueDates: Record<string, { due: string; daysOverdue: number }> = {
    "i4": { due: "Apr 29, 2026", daysOverdue: 0 },
    "i5": { due: "May 10, 2026", daysOverdue: 0 },
  };

  return (
    <div className="flex-1 h-full overflow-auto" style={{ backgroundColor: "#F4F6F9" }}>
      <Toaster position="bottom-right" richColors />

      <header className="bg-white border-b border-slate-200/70 px-8 py-5 sticky top-0 z-10 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            {view === "history" && (
              <button onClick={() => setView("active")} className="font-dm flex items-center gap-1 hover:underline" style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>
                ← Back to active
              </button>
            )}
          </div>
          <h1 className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>
            {view === "active" ? "Payments Ledger" : "Paid & Closed History"}
          </h1>
          <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>
            {view === "active"
              ? "Order-to-cash billing — 15-Day Terms · 30-Day Terms"
              : "Read-only history of fully cleared invoices"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {view === "active" && (
            <>
              <button
                onClick={() => setView("history")}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white font-dm hover:bg-slate-50"
                style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}
              >
                <History size={13} /> View Paid & Closed History →
              </button>
              <button
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-dm hover:opacity-90"
                style={{ backgroundColor: "#FEF3C7", color: "#B45309", fontSize: 12, fontWeight: 700, border: "1px solid #FDE68A" }}
              >
                <FileText size={14} /> {rows.filter(r => r.status === "pending").length} Pending Invoices
              </button>
              <button
                onClick={() => setShowOverdueModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 bg-white font-dm hover:bg-slate-50"
                style={{ borderColor: "#C8102E", color: "#C8102E", fontSize: 12, fontWeight: 700 }}
              >
                <AlertTriangle size={14} /> Send Overdue Reminders
              </button>
            </>
          )}
          <NotificationBell />
        </div>
      </header>

      <div className="px-8 py-8 flex flex-col gap-6">
        <div className="grid grid-cols-4 gap-6">
          <KPI label="Total Invoices" value={String(rows.length)} />
          <KPI label="Total Billed" value={`₱${rows.reduce((s, r) => s + r.amount, 0).toLocaleString("en-PH")}`} accent="#1A2B4A" />
          <KPI label="Pending Collection" value={`₱${rows.filter(r => r.status === "pending").reduce((s, r) => s + r.amount, 0).toLocaleString("en-PH")}`} accent="#D97706" />
          <KPI label="Paid & Closed" value={`₱${rows.filter(r => r.status === "paid").reduce((s, r) => s + r.amount, 0).toLocaleString("en-PH")}`} accent="#16A34A" />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search invoice, PO, or client..."
              className="font-dm w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-slate-400 bg-white"
              style={{ fontSize: 13 }}
            />
          </div>
          {view === "history" && (
            <>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="font-dm px-3 py-2.5 rounded-lg border border-slate-200 bg-white outline-none"
                style={{ fontSize: 13, color: "#0F172A" }}
                title="From"
              />
              <span className="font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>→</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="font-dm px-3 py-2.5 rounded-lg border border-slate-200 bg-white outline-none"
                style={{ fontSize: 13, color: "#0F172A" }}
                title="To"
              />
              <div className="relative">
                <button
                  onClick={() => setShowMonthPicker(v => !v)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 bg-white font-dm hover:bg-slate-50"
                  style={{ borderColor: "#16A34A", color: "#16A34A", fontSize: 13, fontWeight: 700 }}
                >
                  <Download size={14} /> Generate Monthly Report
                </button>
                {showMonthPicker && (
                  <div className="absolute right-0 top-12 z-10 bg-white rounded-lg p-3 flex flex-col gap-2" style={{ boxShadow: "0 8px 24px rgba(15,23,42,0.15)", border: "1px solid #E2E8F0", minWidth: 220 }}>
                    <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.4, textTransform: "uppercase" }}>Pick month to report</label>
                    <input
                      type="month"
                      value={reportMonth}
                      onChange={(e) => setReportMonth(e.target.value)}
                      className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white"
                      style={{ fontSize: 13 }}
                    />
                    <button onClick={monthlyExport} className="font-dm px-3 py-2 rounded-md text-white hover:opacity-90 flex items-center justify-center gap-2" style={{ backgroundColor: "#16A34A", fontSize: 12, fontWeight: 700 }}>
                      <Download size={12} /> Generate Report
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {view === "active" && fulfillmentRows.length > 0 && (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="font-syne mb-1" style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>FULFILLMENT COMPLETED · PAYMENT CYCLE</div>
            <p className="font-dm mb-4" style={{ fontSize: 12, color: "#64748B" }}>Signed-receipt orders whose invoices have not been sent yet. Invoice and payment verification controls are unchanged.</p>
            <div className="flex flex-col gap-3">
              {fulfillmentRows.map((r) => {
                const daysRemaining = r.dueDate ? paymentDaysRemaining(r.dueDate, now) : undefined;
                const isOverdue = r.status !== "paid"
                  && daysRemaining !== undefined
                  && daysRemaining < 0
                  && r.paymentState.remainingInvoiceBalance > 0;
                const status = r.status === "paid"
                  ? "FULLY PAID"
                  : isOverdue
                    ? "PAYMENT OVERDUE"
                    : "PAYMENT CYCLE ACTIVE";
                return (
                  <div key={r.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-syne" style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{r.joNumber ?? r.po} · {r.deliveryReceiptNumber}</div>
                        <div className="font-dm mt-1" style={{ fontSize: 12, color: "#64748B" }}>{r.client} · {r.po}</div>
                      </div>
                      <span className="rounded-full bg-green-100 px-3 py-1.5 font-dm text-xs font-extrabold text-green-800">FULFILLMENT COMPLETED</span>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Signed DR Received</div>
                        <div className="font-dm mt-1" style={{ fontSize: 12, color: "#0F172A" }}>{r.signedDeliveryReceiptReceivedAt ? new Date(r.signedDeliveryReceiptReceivedAt).toLocaleString() : "—"}</div>
                      </div>
                      <div>
                        <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Payment Terms</div>
                        <div className="font-dm mt-1" style={{ fontSize: 12, color: "#0F172A" }}>{r.payment}</div>
                      </div>
                      <div>
                        <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Payment Cycle Started</div>
                        <div className="font-dm mt-1" style={{ fontSize: 12, color: "#0F172A" }}>{r.paymentCycleStartedAt ? new Date(r.paymentCycleStartedAt).toLocaleString() : "—"}</div>
                      </div>
                      <div>
                        <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Payment Due</div>
                        <div className="font-dm mt-1" style={{ fontSize: 12, color: "#0F172A" }}>{r.dueDate ?? "—"}</div>
                      </div>
                      <div>
                        <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Payment Status</div>
                        <div className="font-dm mt-1" style={{ fontSize: 12, fontWeight: 800, color: isOverdue ? "#C8102E" : r.status === "paid" ? "#15803D" : "#1D4ED8" }}>{status}</div>
                      </div>
                      <div>
                        <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Remaining Balance</div>
                        <div className="font-dm mt-1" style={{ fontSize: 12, fontWeight: 700, color: r.paymentState.remainingInvoiceBalance > 0 ? "#C8102E" : "#15803D" }}>
                          ₱{r.paymentState.remainingInvoiceBalance.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                    {r.signedDeliveryReceiptDataUrl && (
                      <button
                        onClick={() => setProofToView({
                          filename: r.signedDeliveryReceiptFileName ?? "Signed Delivery Receipt",
                          dataUrl: r.signedDeliveryReceiptDataUrl!,
                        })}
                        className="mt-3 inline-flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 font-dm hover:bg-green-100"
                        style={{ fontSize: 11, fontWeight: 700, color: "#166534" }}
                      >
                        <Eye size={13} /> VIEW SIGNED DR
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
          <table className="w-full">
            <thead style={{ backgroundColor: "#F4F6F9" }}>
              <tr>
                {["Date", "Invoice No.", "Source PO No.", "Client", "Item", "Amount", "Payment", "Status"].map((h) => (
                  <th key={h} className="font-dm text-left px-4 py-3" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const isOpen = openId === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr
                      className="border-t border-slate-200/70 hover:bg-slate-50 transition-colors"
                      style={{ cursor: "pointer" }}
                      onClick={() => setOpenId(isOpen ? null : r.id)}
                    >
                      <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, color: "#475569" }}>{r.date}</td>
                      <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}>{r.inv}</td>
                      <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, color: "#475569" }}>{r.po}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{r.client}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{r.item}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>₱{r.amount.toLocaleString("en-PH")}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>
                        <div style={{ fontWeight: 700, color: "#1A2B4A" }}>{r.paymentType}</div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>{r.payment}</div>
                      </td>
                      <td className="px-4 py-3"><StatusPill status={granularStatus(r, r.paymentState.totalVerifiedPayments, now)} /></td>
                    </tr>
                    {isOpen && (() => {
                      const pmts = payments[r.id] ?? [];
                      const clientPayments = r.paymentRecords;
                      const localPaid = pmts.reduce((s, p) => s + p.amount, 0);
                      const verifiedClientPayments = clientPayments.filter((payment) => payment.verificationStatus === "verified");
                      const unlistedVerifiedPayments = verifiedClientPayments.filter((payment) => !pmts.some((entry) =>
                        entry.id === payment.id
                        || (entry.date === payment.paymentDate
                          && entry.amount === (payment.verifiedAmount ?? payment.submittedAmount)
                          && entry.method === payment.method
                          && entry.ref === (payment.referenceNumber ?? "—"))
                      ));
                      const totalPaid = Math.max(localPaid, r.paymentState.totalVerifiedPayments);
                      const remaining = Math.max(0, r.amount - totalPaid);
                      const pf = newPmt[r.id] ?? { amount: "", method: "", ref: "", datePaid: "" };
                      const clientInquiries = byClient(r.client);
                      const clientReceipts = clientInquiries.flatMap(i => i.clientPaymentReceipts ?? []);
                      const dd = overdueDueDates[r.id];
                      const signedDRReceived = Boolean(r.signedDeliveryReceiptReceivedAt);
                      const cycleDaysRemaining = r.dueDate ? paymentDaysRemaining(r.dueDate, now) : undefined;
                      const paymentCycleOverdue = signedDRReceived
                        && cycleDaysRemaining !== undefined
                        && cycleDaysRemaining < 0
                        && r.paymentState.remainingInvoiceBalance > 0;
                      const paymentStatus = r.status === "paid"
                        ? "FULLY PAID"
                        : paymentCycleOverdue
                          ? "PAYMENT OVERDUE"
                          : signedDRReceived
                            ? granularStatus(r, r.paymentState.totalVerifiedPayments, now).toUpperCase()
                            : "NOT ACTIVE — SIGNED DR NOT RECEIVED";
                      return (
                        <tr style={{ backgroundColor: "#FAFBFC" }}>
                          <td colSpan={8} className="px-6 py-5">
                            {/* Header: client ledger info */}
                            <div className="flex items-start justify-between mb-4 pb-4 border-b border-slate-200">
                              <div>
                                <div className="font-syne" style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>{r.client} — {r.inv}</div>
                                <div className="font-dm mt-0.5" style={{ fontSize: 12, color: "#64748B" }}>
                                  {r.payment} · Delivered: {r.deliveredDate ?? r.date} · Due: <span style={{ fontWeight: 600, color: dd?.daysOverdue > 0 ? "#C8102E" : "#0F172A" }}>{r.dueDate ?? "—"}</span>
                                  {dd?.daysOverdue > 0 && <span className="ml-2 font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: "#FEE2E2", color: "#C8102E" }}>⚠️ {dd.daysOverdue} DAYS OVERDUE</span>}
                                </div>
                              </div>
                              <div className="flex gap-6 text-right">
                                <div>
                                  <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Invoice Total</div>
                                  <div className="font-syne" style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>₱{r.amount.toLocaleString("en-PH")}</div>
                                </div>
                                <div>
                                  <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Paid</div>
                                  <div className="font-syne" style={{ fontSize: 18, fontWeight: 800, color: "#16A34A" }}>₱{totalPaid.toLocaleString("en-PH")}</div>
                                </div>
                                <div>
                                  <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Balance Due</div>
                                  <div className="font-syne" style={{ fontSize: 18, fontWeight: 800, color: remaining > 0 ? "#C8102E" : "#16A34A" }}>₱{remaining.toLocaleString("en-PH")}</div>
                                </div>
                              </div>
                            </div>

                            <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
                              <div className="font-syne mb-3" style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>DELIVERY &amp; PAYMENT CYCLE</div>
                              <div className="mb-3 flex flex-wrap items-center gap-2">
                                <span className="rounded-full px-3 py-1.5 font-dm" style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  backgroundColor: signedDRReceived ? "#DCFCE7" : "#E2E8F0",
                                  color: signedDRReceived ? "#166534" : "#475569",
                                }}>
                                  {r.fulfillmentCompleted ? "FULFILLMENT COMPLETED" : "FULFILLMENT NOT COMPLETED"}
                                </span>
                                <span className="rounded-full px-3 py-1.5 font-dm" style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  backgroundColor: signedDRReceived ? (paymentCycleOverdue ? "#FEE2E2" : "#DBEAFE") : "#E2E8F0",
                                  color: signedDRReceived ? (paymentCycleOverdue ? "#C8102E" : "#1D4ED8") : "#475569",
                                }}>
                                  {paymentStatus}
                                </span>
                              </div>
                              {signedDRReceived ? (
                                <>
                                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    <div>
                                      <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Signed DR Received</div>
                                      <div className="font-dm mt-1" style={{ fontSize: 12, color: "#0F172A" }}>{new Date(r.signedDeliveryReceiptReceivedAt!).toLocaleString()}</div>
                                    </div>
                                    <div>
                                      <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Submitted By</div>
                                      <div className="font-dm mt-1" style={{ fontSize: 12, color: "#0F172A" }}>{r.signedDeliveryReceiptSubmittedBy ?? "—"}</div>
                                    </div>
                                    <div>
                                      <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Payment Terms</div>
                                      <div className="font-dm mt-1" style={{ fontSize: 12, color: "#0F172A" }}>{r.payment}</div>
                                    </div>
                                    <div>
                                      <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Payment Cycle Started</div>
                                      <div className="font-dm mt-1" style={{ fontSize: 12, color: "#0F172A" }}>{r.paymentCycleStartedAt ? new Date(r.paymentCycleStartedAt).toLocaleString() : "Pending state update"}</div>
                                    </div>
                                    <div>
                                      <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Payment Due</div>
                                      <div className="font-dm mt-1" style={{ fontSize: 12, color: "#0F172A" }}>{r.dueDate ?? "—"}</div>
                                    </div>
                                    <div>
                                      <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Remaining Balance</div>
                                      <div className="font-dm mt-1" style={{ fontSize: 12, fontWeight: 700, color: r.paymentState.remainingInvoiceBalance > 0 ? "#C8102E" : "#15803D" }}>
                                        ₱{r.paymentState.remainingInvoiceBalance.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </div>
                                    </div>
                                  </div>
                                  {r.signedDeliveryReceiptDataUrl && (
                                    <button
                                      onClick={() => setProofToView({
                                        filename: r.signedDeliveryReceiptFileName ?? "Signed Delivery Receipt",
                                        dataUrl: r.signedDeliveryReceiptDataUrl!,
                                      })}
                                      className="mt-3 inline-flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 font-dm hover:bg-green-100"
                                      style={{ fontSize: 11, fontWeight: 700, color: "#166534" }}
                                    >
                                      <Eye size={13} /> VIEW SIGNED DR
                                    </button>
                                  )}
                                </>
                              ) : (
                                <div className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>
                                  Payment cycle starts only when this order’s signed Delivery Receipt is received.
                                </div>
                              )}
                            </div>

                            {clientPayments.length > 0 && (
                              <div className="rounded-lg p-4 mb-4" style={{ backgroundColor: "#EFF6FF", border: "1.5px solid #BFDBFE" }}>
                                <div className="font-dm mb-3" style={{ fontSize: 11, fontWeight: 800, color: "#1E40AF", letterSpacing: 0.5, textTransform: "uppercase" }}>Client Payment Submissions</div>
                                {clientPayments.map((p) => {
                                  const paymentType = p.paymentType === "DOWNPAYMENT" ? "DOWNPAYMENT"
                                    : p.paymentType === "BALANCE_PAYMENT" ? "BALANCE PAYMENT" : "FULL PAYMENT";
                                  const statusLabel = p.verificationStatus === "pending" ? "AWAITING VERIFICATION"
                                    : p.verificationStatus === "verified" ? "VERIFIED" : "REJECTED";
                                  const statusColor = p.verificationStatus === "pending" ? "#1D4ED8"
                                    : p.verificationStatus === "verified" ? "#15803D" : "#C8102E";
                                  const dpPercent = r.downpaymentPercent;
                                  const remainingAfter = Math.max(0, r.paymentState.remainingInvoiceBalance - p.submittedAmount);
                                  return (
                                  <div key={p.id} className="rounded-md p-3 mb-2 last:mb-0 bg-white border border-blue-200">
                                    <div className="flex items-center justify-between gap-3 mb-3">
                                      <div className="font-dm" style={{ fontSize: 12, fontWeight: 800, color: "#1A2B4A" }}>PAYMENT {p.verificationStatus === "pending" ? "SUBMITTED" : statusLabel}</div>
                                      <span className="font-dm px-2 py-1 rounded-full" style={{ fontSize: 10, fontWeight: 800, color: statusColor, backgroundColor: `${statusColor}18` }}>{statusLabel}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-5 gap-y-1 font-dm" style={{ fontSize: 12, color: "#475569" }}>
                                      <span>Client</span><strong>{r.client}</strong>
                                      <span>Invoice</span><strong>{p.invoiceNo ?? r.inv}</strong>
                                      <span>PO</span><strong>{r.po}</strong>
                                      <span>PAYMENT TYPE</span><strong>{paymentType}</strong>
                                      <span>Invoice Total</span><strong>₱{r.paymentState.invoiceTotal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                      {p.paymentType === "DOWNPAYMENT" ? <>
                                        <span>DOWNPAYMENT REQUIRED</span><strong>{dpPercent}%</strong>
                                        <span>Required Amount</span><strong>₱{r.paymentState.requiredDownpaymentAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                      </> : p.paymentType === "BALANCE_PAYMENT" ? <>
                                        <span>Previously Verified</span><strong>₱{r.paymentState.totalVerifiedPayments.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                        <span>Balance Due</span><strong>₱{r.paymentState.remainingInvoiceBalance.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                      </> : <>
                                        <span>FULL PAYMENT REQUIRED</span><strong>₱{r.paymentState.remainingInvoiceBalance.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                      </>}
                                      <span>Submitted Amount</span><strong>₱{p.submittedAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                      <span>Remaining Balance</span><strong>₱{remainingAfter.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                      <span>Date Submitted</span><strong>{p.paymentDate}</strong>
                                      <span>Payment Method</span><strong>{p.method ?? "Not specified"}</strong>
                                      <span>Reference Number</span><strong>{p.referenceNumber ?? "—"}</strong>
                                      {p.verifiedAt && <><span>Date Verified</span><strong>{new Date(p.verifiedAt).toLocaleString()}</strong></>}
                                    </div>
                                    <div className="flex items-center gap-2 mt-3">
                                      <button onClick={() => p.receiptDataUrl && setProofToView({ filename: p.receiptFile ?? "Uploaded receipt", dataUrl: p.receiptDataUrl })} disabled={!p.receiptDataUrl} className="font-dm flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-blue-200 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed" style={{ fontSize: 11, fontWeight: 700, color: "#2563EB" }}><Eye size={11} /> VIEW PROOF OF PAYMENT</button>
                                      {p.verificationStatus === "pending" && <>
                                        <button onClick={() => handleRejectClientPayment(r, p)} className="font-dm flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-red-200 hover:bg-red-50" style={{ fontSize: 11, fontWeight: 700, color: "#C8102E" }}><X size={11} /> Reject Payment</button>
                                        <button onClick={() => handleVerifyClientPayment(r, p)} disabled={!p.receiptDataUrl || p.submittedAmount <= 0} className="font-dm flex items-center gap-1 px-2.5 py-1.5 rounded-md text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed" style={{ fontSize: 11, fontWeight: 700, backgroundColor: "#15803D" }}><CheckCircle2 size={11} /> VERIFY PAYMENT</button>
                                      </>}
                                    </div>
                                  </div>
                                  );
                                })}
                              </div>
                            )}
                            <div className="grid gap-6" style={{ gridTemplateColumns: "3fr 2fr" }}>
                              {/* Running balance ledger */}
                              <div>
                                <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Payment Ledger</div>
                                <div className="rounded-lg overflow-hidden border border-slate-200">
                                  <table className="w-full">
                                    <thead style={{ backgroundColor: "#1A2B4A" }}>
                                      <tr>
                                        {["Date", "Transaction", "Charge", "Credit", "Balance"].map(h => (
                                          <th key={h} className="font-dm text-left px-3 py-2.5 text-white/70" style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr className="bg-white border-b border-slate-100">
                                        <td className="px-3 py-2.5 font-dm" style={{ fontSize: 12, color: "#475569" }}>{r.date}</td>
                                        <td className="px-3 py-2.5 font-mono-jb" style={{ fontSize: 11, color: "#1A2B4A", fontWeight: 600 }}>{r.inv} · Invoice Raised</td>
                                        <td className="px-3 py-2.5 font-dm" style={{ fontSize: 12, color: "#C8102E", fontWeight: 600 }}>₱{r.amount.toLocaleString("en-PH")}</td>
                                        <td className="px-3 py-2.5 font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>—</td>
                                        <td className="px-3 py-2.5 font-syne" style={{ fontSize: 12, fontWeight: 700, color: "#C8102E" }}>₱{r.amount.toLocaleString("en-PH")}</td>
                                      </tr>
                                      {pmts.reduce((acc, p) => {
                                        const prevBal = acc.balance;
                                        const newBal = prevBal - p.amount;
                                        acc.rows.push(
                                          <tr key={p.id} className="bg-white border-b border-slate-100 hover:bg-slate-50 group">
                                            <td className="px-3 py-2.5 font-dm" style={{ fontSize: 12, color: "#475569" }}>{p.date}</td>
                                            <td className="px-3 py-2.5 font-dm" style={{ fontSize: 12, color: "#0F172A" }}>
                                              <div className="flex items-center gap-2">
                                                <span>{p.method} {p.ref !== "—" ? `· ${p.ref}` : ""}</span>
                                                <button
                                                  onClick={() => setEditingReceipt({ invoiceId: r.id, receipt: p })}
                                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-700"
                                                  title="Edit receipt"
                                                >
                                                  <Pencil size={11} />
                                                </button>
                                              </div>
                                            </td>
                                            <td className="px-3 py-2.5 font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>—</td>
                                            <td className="px-3 py-2.5 font-dm" style={{ fontSize: 12, color: "#16A34A", fontWeight: 600 }}>₱{p.amount.toLocaleString("en-PH")}</td>
                                            <td className="px-3 py-2.5 font-syne" style={{ fontSize: 12, fontWeight: 700, color: newBal > 0 ? "#C8102E" : "#16A34A" }}>₱{newBal.toLocaleString("en-PH")}</td>
                                          </tr>
                                        );
                                        acc.balance = newBal;
                                        return acc;
                                      }, { balance: r.amount, rows: [] as React.ReactNode[] }).rows}
                                      {unlistedVerifiedPayments.reduce((acc, payment) => {
                                        const amount = payment.verifiedAmount ?? payment.submittedAmount;
                                        const balance = Math.max(0, acc.balance - amount);
                                        const type = payment.paymentType === "DOWNPAYMENT" ? "DOWNPAYMENT"
                                          : payment.paymentType === "BALANCE_PAYMENT" ? "BALANCE PAYMENT" : "FULL PAYMENT";
                                        acc.rows.push(
                                          <tr key={payment.id} className="bg-white border-b border-slate-100">
                                            <td className="px-3 py-2.5 font-dm" style={{ fontSize: 12, color: "#475569" }}>{payment.paymentDate}</td>
                                            <td className="px-3 py-2.5 font-dm" style={{ fontSize: 11, color: "#0F172A" }}>{type} · {payment.method ?? "Payment"}{payment.referenceNumber ? ` · ${payment.referenceNumber}` : ""}</td>
                                            <td className="px-3 py-2.5 font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>—</td>
                                            <td className="px-3 py-2.5 font-dm" style={{ fontSize: 12, color: "#16A34A", fontWeight: 600 }}>₱{amount.toLocaleString("en-PH")}</td>
                                            <td className="px-3 py-2.5 font-syne" style={{ fontSize: 12, fontWeight: 700, color: balance > 0 ? "#C8102E" : "#16A34A" }}>₱{balance.toLocaleString("en-PH")}</td>
                                          </tr>
                                        );
                                        acc.balance = balance;
                                        return acc;
                                      }, { balance: Math.max(0, r.amount - localPaid), rows: [] as React.ReactNode[] }).rows}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* Record new payment */}
                              <div className="flex flex-col gap-3">
                                <div className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Record Payment</div>
                                <div className="rounded-lg p-4 flex flex-col gap-3" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                                  <div className="flex flex-col gap-1">
                                    <label className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>Amount (₱)</label>
                                    <input
                                      type="number" min={0} placeholder="e.g. 23400"
                                      value={pf.amount}
                                      onChange={(e) => setNewPmt(p => ({ ...p, [r.id]: { ...pf, amount: e.target.value } }))}
                                      className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white"
                                      style={{ fontSize: 13 }}
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>Method</label>
                                    <select
                                      value={pf.method}
                                      onChange={(e) => setNewPmt(p => ({ ...p, [r.id]: { ...pf, method: e.target.value } }))}
                                      className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white"
                                      style={{ fontSize: 13 }}
                                    >
                                      <option value="">— Select —</option>
                                      <option>BDO Bank Transfer</option>
                                      <option>MetroBank Transfer</option>
                                      <option>GCash</option>
                                      <option>Cash</option>
                                      <option>Check</option>
                                    </select>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>Reference No. <span style={{ fontWeight: 400, color: "#94A3B8" }}>(optional)</span></label>
                                    <input
                                      placeholder="e.g. BDO-2026-04100"
                                      value={pf.ref}
                                      onChange={(e) => setNewPmt(p => ({ ...p, [r.id]: { ...pf, ref: e.target.value } }))}
                                      className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white"
                                      style={{ fontSize: 13 }}
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>Date Paid</label>
                                    <input
                                      type="date"
                                      value={pf.datePaid}
                                      onChange={(e) => setNewPmt(p => ({ ...p, [r.id]: { ...pf, datePaid: e.target.value } }))}
                                      className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white"
                                      style={{ fontSize: 13 }}
                                    />
                                  </div>
                                  <button
                                    onClick={() => addPayment(r.id)}
                                    className="flex items-center justify-center gap-2 py-2.5 rounded-md text-white font-dm hover:opacity-90"
                                    style={{ backgroundColor: "#1A2B4A", fontSize: 12, fontWeight: 700, letterSpacing: 0.4 }}
                                  >
                                    <PlusCircle size={14} /> Add Payment Entry
                                  </button>
                                </div>

                                <div className="flex items-center justify-between mt-1 pt-3 border-t border-slate-200">
                                  <span className="font-dm italic" style={{ fontSize: 11, color: "#64748B" }}>Secretary approval required</span>
                                  <button
                                    onClick={() => clearAccount(r.id)}
                                    disabled={remaining > 0}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-md text-white font-dm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                                    style={{ backgroundColor: "#16A34A", fontSize: 11, fontWeight: 700, letterSpacing: 0.4 }}
                                  >
                                    <CheckCircle2 size={12} strokeWidth={2.5} />
                                    {remaining > 0 ? `₱${remaining.toLocaleString("en-PH")} remaining` : "Mark Cleared ✓"}
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Client-uploaded receipts */}
                            {clientReceipts.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-slate-200">
                                <div className="flex items-center gap-2 mb-3">
                                  <Receipt size={14} style={{ color: "#1D4ED8" }} />
                                  <span className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#1D4ED8", letterSpacing: 0.5, textTransform: "uppercase" }}>
                                    Client-Sent Receipts ({clientReceipts.length})
                                  </span>
                                </div>
                                <div className="flex flex-col gap-2">
                                  {clientReceipts.map(cr => (
                                    <div key={cr.id} className="flex items-center gap-3 rounded-lg px-4 py-3 border" style={{ backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }}>
                                      <FileText size={16} style={{ color: "#2563EB" }} />
                                      <div className="flex-1">
                                        <div className="font-dm" style={{ fontSize: 12, fontWeight: 700, color: "#1E3A8A" }}>{cr.filename}</div>
                                        <div className="font-dm" style={{ fontSize: 11, color: "#3B82F6" }}>
                                          Sent {cr.date} · ₱{cr.amount.toLocaleString("en-PH")}
                                          {cr.note ? ` · ${cr.note}` : ""}
                                        </div>
                                      </div>
                                      <button
                                        disabled={!clientPayments.find((payment) => payment.id === cr.id)?.receiptDataUrl}
                                        className="font-dm flex items-center gap-1 px-2 py-1 rounded-md border border-blue-200 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                        style={{ fontSize: 11, fontWeight: 600, color: "#2563EB" }}
                                        onClick={() => {
                                          const dataUrl = clientPayments.find((payment) => payment.id === cr.id)?.receiptDataUrl;
                                          if (dataUrl) setProofToView({ filename: cr.filename, dataUrl });
                                        }}
                                      >
                                        <Eye size={11} /> View
                                      </button>
                                    </div>
                                  ))}
                                </div>
                                <div className="font-dm mt-2" style={{ fontSize: 11, color: "#64748B", fontStyle: "italic" }}>
                                  Use these as reference when recording payment above.
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })()}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Overdue Reminders Modal */}
      {/* Edit Receipt Modal */}
      {editingReceipt && (
        <EditReceiptModal
          receipt={editingReceipt.receipt}
          onClose={() => setEditingReceipt(null)}
          onSave={(next) => {
            editReceipt(editingReceipt.invoiceId, editingReceipt.receipt, next);
            setEditingReceipt(null);
          }}
        />
      )}

      {proofToView && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,.7)" }} onClick={() => setProofToView(null)}>
          <div className="bg-white rounded-xl w-full max-w-5xl flex flex-col overflow-hidden" style={{ height: "90vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="font-syne" style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Proof of Payment</div>
                <div className="font-dm mt-0.5" style={{ fontSize: 12, color: "#64748B" }}>{proofToView.filename}</div>
              </div>
              <button onClick={() => setProofToView(null)} aria-label="Close proof of payment" className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center"><X size={16} /></button>
            </div>
            <div className="flex-1 min-h-0 bg-slate-100 flex items-center justify-center p-3">
              {proofToView.dataUrl.startsWith("data:image/") ? (
                <img src={proofToView.dataUrl} alt={proofToView.filename} className="max-w-full max-h-full object-contain" />
              ) : proofToView.dataUrl.startsWith("data:application/pdf") ? (
                <iframe src={proofToView.dataUrl} title={proofToView.filename} className="w-full h-full bg-white" />
              ) : (
                <a href={proofToView.dataUrl} download={proofToView.filename} className="font-dm px-4 py-2 rounded-md bg-white border border-slate-300" style={{ fontSize: 13, fontWeight: 700, color: "#1A2B4A" }}>
                  Open or download {proofToView.filename}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {showOverdueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.6)" }} onClick={() => setShowOverdueModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg flex flex-col" style={{ boxShadow: "0 24px 48px rgba(0,0,0,0.3)", maxHeight: "85vh" }} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between" style={{ backgroundColor: "#FEF2F2" }}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} style={{ color: "#C8102E" }} />
                <h3 className="font-syne" style={{ fontSize: 16, fontWeight: 700, color: "#991B1B" }}>Overdue &amp; Pending Invoices</h3>
              </div>
              <button onClick={() => setShowOverdueModal(false)} className="w-8 h-8 rounded-md hover:bg-red-100 flex items-center justify-center"><X size={16} style={{ color: "#991B1B" }} /></button>
            </div>
            <div className="p-6 overflow-auto flex flex-col gap-3">
              <p className="font-dm" style={{ fontSize: 13, color: "#475569" }}>
                Review pending invoices below. Click "Send Reminder" to notify the client via email.
              </p>
              {overdueRows.length === 0 ? (
                <div className="rounded-lg p-6 text-center font-dm" style={{ fontSize: 13, color: "#16A34A", backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                  ✅ No pending invoices — all accounts are cleared!
                </div>
              ) : overdueRows.map(r => {
                const dd = overdueDueDates[r.id];
                const isOverdue = dd && dd.daysOverdue > 0;
                return (
                  <div key={r.id} className="rounded-lg p-4 border" style={{ backgroundColor: isOverdue ? "#FEF2F2" : "#FFFBEB", borderColor: isOverdue ? "#FECACA" : "#FDE68A" }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-jb" style={{ fontSize: 13, fontWeight: 700, color: "#1A2B4A" }}>{r.inv}</span>
                          {isOverdue ? (
                            <span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: "#FEE2E2", color: "#C8102E" }}>⚠️ {dd.daysOverdue} DAYS OVERDUE</span>
                          ) : (
                            <span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: "#FEF3C7", color: "#B45309" }}>DUE SOON</span>
                          )}
                        </div>
                        <div className="font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{r.client}</div>
                        <div className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>{r.item}</div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="font-syne" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>₱{r.amount.toLocaleString("en-PH")}</span>
                          <span className="font-dm" style={{ fontSize: 12, color: "#475569" }}>Due: {dd?.due ?? "—"}</span>
                          <span className="font-dm" style={{ fontSize: 12, color: "#475569" }}>{r.payment}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          toast.success(`Reminder sent to ${r.client}`, { description: `Invoice ${r.inv} · ₱${r.amount.toLocaleString("en-PH")}` });
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-md text-white font-dm hover:opacity-90 shrink-0"
                        style={{ backgroundColor: "#C8102E", fontSize: 12, fontWeight: 700, letterSpacing: 0.4 }}
                      >
                        <Send size={12} /> Send Reminder
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-between items-center">
              <span className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>{overdueRows.length} pending · {overdueRows.filter(r => overdueDueDates[r.id]?.daysOverdue > 0).length} overdue</span>
              <div className="flex gap-2">
                <button onClick={() => setShowOverdueModal(false)} className="font-dm px-4 py-2 rounded-md hover:bg-slate-100" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Close</button>
                <button
                  onClick={() => {
                    overdueRows.forEach(r => toast.success(`Reminder sent to ${r.client}`));
                    setShowOverdueModal(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-md text-white font-dm hover:opacity-90"
                  style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700 }}
                >
                  <Send size={14} /> Send All Reminders
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* ───────── Edit Receipt Modal ───────── */
function EditReceiptModal({ receipt, onClose, onSave }: {
  receipt: PaymentEntry;
  onClose: () => void;
  onSave: (next: { amount: number; method: string; ref: string; date: string }) => void;
}) {
  const [amount, setAmount] = useState(String(receipt.amount));
  const [method, setMethod] = useState(receipt.method);
  const [ref, setRef] = useState(receipt.ref === "—" ? "" : receipt.ref);
  const [date, setDate] = useState(receipt.date);
  const [replaceFile, setReplaceFile] = useState<string | null>(null);

  const submit = () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { toast.error("Invalid amount"); return; }
    if (!method.trim()) { toast.error("Method required"); return; }
    onSave({ amount: amt, method, ref: ref.trim() || "—", date });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.6)" }} onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md flex flex-col" style={{ boxShadow: "0 24px 48px rgba(0,0,0,0.3)" }} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-syne flex items-center gap-2" style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}><Pencil size={14} /> Edit Receipt</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="p-5 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Amount Paid (₱)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }}>
              <option>BDO Bank Transfer</option><option>MetroBank Transfer</option><option>GCash</option><option>Cash</option><option>Check</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Reference No.</label>
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. BDO-2026-04100" className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Date Paid</label>
            <input value={date} onChange={(e) => setDate(e.target.value)} className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Replace Receipt File <span style={{ fontWeight: 400, color: "#94A3B8" }}>(optional)</span></label>
            <label className="flex items-center gap-2 px-3 py-2 rounded-md border-2 border-dashed cursor-pointer hover:bg-slate-50" style={{ borderColor: replaceFile ? "#16A34A" : "#CBD5E1" }}>
              <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setReplaceFile(f.name); e.currentTarget.value = ""; }} />
              <span className="font-dm" style={{ fontSize: 12, color: replaceFile ? "#16A34A" : "#64748B", fontWeight: replaceFile ? 600 : 400 }}>
                {replaceFile ? `✅ ${replaceFile}` : "Click to upload a replacement photo/PDF"}
              </span>
            </label>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="font-dm px-4 py-2 rounded-md hover:bg-slate-100" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Cancel</button>
          <button onClick={submit} className="font-dm px-4 py-2 rounded-md text-white hover:opacity-90" style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700 }}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}
