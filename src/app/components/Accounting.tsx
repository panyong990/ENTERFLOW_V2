import { Fragment, useState, useEffect, useMemo, useRef } from "react";
import { FileText, ClipboardList, Search, Plus, CheckCircle2, X, Send, AlertTriangle, ChevronDown, ChevronUp, PlusCircle, Receipt, Eye, History, Pencil, Download } from "lucide-react";
import { formatMoney, fromMoneyCents, hasValidSignedDeliveryReceipt, paymentSubmissionAllowance, paymentDaysRemaining, paymentRecords, paymentState, poNumberForDisplay, toMoneyCents, useOrders, type Inquiry, type PaymentRecord, type PaymentType } from "../store/orders";
import { useNotifications } from "../store/notifications";
import { useSession } from "../store/session";
import { NotificationBell } from "./NotificationBell";
import { OfficialReceiptPreviewModal } from "./OfficialReceiptPreviewModal";
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
  officialReceipt?: Inquiry["officialReceipt"];
}

type ReminderCategory = "dueSoon" | "overdue" | "remainingBalance";
type ReminderFilter = "all" | "remainingBalance" | "dueSoon" | "overdue";
const DUE_SOON_WINDOW_DAYS = 7;
const REMINDER_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
const REMINDER_HISTORY_STORAGE_KEY = "enterflow.paymentReminderHistory.v1";

function loadReminderHistory(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(REMINDER_HISTORY_STORAGE_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === "string"));
  } catch {
    return {};
  }
}

function reminderNextEligibleAt(lastReminderAt: string): number {
  return new Date(lastReminderAt).getTime() + REMINDER_COOLDOWN_MS;
}

function formatReminderDate(value: string | number): string {
  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isEligibleReminder(invoice: Invoice): boolean {
  const balance = invoice.paymentState.remainingInvoiceBalance;
  return Boolean(
    invoice.id
    && invoice.inv
    && invoice.client
    && invoice.status === "pending"
    && Number.isFinite(balance)
    && balance > 0
    && (!invoice.dueDate || paymentDaysRemaining(invoice.dueDate) !== undefined)
  );
}

function reminderCategory(invoice: Invoice, now: Date): ReminderCategory {
  const daysRemaining = invoice.dueDate ? paymentDaysRemaining(invoice.dueDate, now) : undefined;
  if (daysRemaining !== undefined && daysRemaining < 0) return "overdue";
  if (daysRemaining !== undefined && daysRemaining <= DUE_SOON_WINDOW_DAYS) return "dueSoon";
  return "remainingBalance";
}

function filterReminderRows(rows: Invoice[], filter: ReminderFilter, now: Date): Invoice[] {
  return rows.filter((invoice) => (
    filter === "all" || reminderCategory(invoice, now) === filter
  ));
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
    po: poNumberForDisplay(inq) ?? inq.code,
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
    officialReceipt: inq.officialReceipt,
  };
}

function hasActivePaymentCycle(inquiry: Inquiry): boolean {
  return hasValidSignedDeliveryReceipt(inquiry)
    && Boolean(inquiry.paymentCycleStartedAt)
    && inquiry.paymentCycleStartedAt === inquiry.signedDeliveryReceiptReceivedAt;
}

type GranularStatus = "Paid" | "Partial" | "Overdue" | "Pending" | "Awaiting Verification" | "Rejected" | "Verified" | "Paid/Completed";
function granularStatus(inv: Invoice, totalPaid: number, now = new Date()): GranularStatus {
  if (inv.status === "paid") return "Paid";
  if (inv.paymentRecords.some((payment) => payment.verificationStatus === "pending")) return "Awaiting Verification";
  if (inv.paymentRecords.some((payment) => payment.verificationStatus === "rejected")) return "Rejected";
  const daysRemaining = inv.dueDate ? paymentDaysRemaining(inv.dueDate, now) : undefined;
  if (daysRemaining !== undefined && daysRemaining < 0) return "Overdue";
  if (totalPaid > 0 && totalPaid < inv.amount) return "Partial";
  return "Pending";
}

function hasFullyPaidBalancePayment(inv: Invoice): boolean {
  return inv.status === "paid"
    && inv.paymentState.state === "FULLY_PAID"
    && inv.paymentState.remainingInvoiceBalance === 0
    && inv.paymentRecords.some((payment) =>
      payment.paymentType === "BALANCE_PAYMENT" && payment.verificationStatus === "verified",
    )
    && !inv.paymentRecords.some((payment) => payment.verificationStatus === "pending");
}

const granularStyle: Record<GranularStatus, { bg: string; fg: string; border: string }> = {
  Paid:    { bg: "#ECFDF3", fg: "#15803D", border: "#BBF7D0" },
  Partial: { bg: "#EFF6FF", fg: "#1D4ED8", border: "#BFDBFE" },
  Pending: { bg: "#FFFBEB", fg: "#B45309", border: "#FDE68A" },
  Overdue: { bg: "#FEF2F2", fg: "#C8102E", border: "#FECACA" },
  "Awaiting Verification": { bg: "#FFFBEB", fg: "#B45309", border: "#FDE68A" },
  Rejected: { bg: "#FEF2F2", fg: "#C8102E", border: "#FECACA" },
  Verified: { bg: "#ECFDF3", fg: "#15803D", border: "#BBF7D0" },
  "Paid/Completed": { bg: "#ECFDF3", fg: "#15803D", border: "#BBF7D0" },
};

function StatusPill({ status }: { status: GranularStatus }) {
  const s = granularStyle[status];
  return (
    <span
      className="inline-flex min-h-7 max-w-full shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-3 py-1 text-center font-dm text-[11px] font-semibold leading-4"
      style={{ backgroundColor: s.bg, color: s.fg, borderColor: s.border }}
    >
      {status}
    </span>
  );
}

function downpaymentDisplayStatus(inv: Invoice): GranularStatus {
  const downpaymentRecords = inv.paymentRecords.filter((payment) => payment.paymentType === "DOWNPAYMENT");
  if (downpaymentRecords.some((payment) => payment.verificationStatus === "pending")) return "Awaiting Verification";
  if (downpaymentRecords.some((payment) => payment.verificationStatus === "verified")) return "Verified";
  if (downpaymentRecords.some((payment) => payment.verificationStatus === "rejected")) return "Rejected";
  return inv.paymentState.downpaymentStatus === "COMPLETE" ? "Paid/Completed" : "Awaiting Verification";
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
  const [expandedClientPayments, setExpandedClientPayments] = useState<Set<string>>(() => new Set());
  const [downpaymentFilter, setDownpaymentFilter] = useState<"ALL" | "AWAITING VERIFICATION" | "VERIFIED" | "REJECTED" | "PAID/COMPLETED">("ALL");
  const [activeCycleFilter, setActiveCycleFilter] = useState<"ALL" | "PENDING" | "PARTIAL" | "PAID/COMPLETED" | "OVERDUE" | "AWAITING VERIFICATION" | "REJECTED">("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingReceipt, setEditingReceipt] = useState<{ invoiceId: string; receipt: PaymentEntry } | null>(null);
  const [receiptToIssue, setReceiptToIssue] = useState<Invoice | null>(null);
  const [proofToView, setProofToView] = useState<{ filename: string; dataUrl: string } | null>(null);
  const [receiptToView, setReceiptToView] = useState<NonNullable<Invoice["officialReceipt"]> | null>(null);
  const [paymentToReject, setPaymentToReject] = useState<{ invoice: Invoice; payment: PaymentRecord } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const { byClient, inquiriesByStage, updateInquiry, markPOCleared, confirmClientPayment, verifyPayment, rejectPayment, generateOfficialReceiptNumber, issueOfficialReceipt } = useOrders();
  const { push: pushNotif } = useNotifications();
  const { name: issuingStaff } = useSession();
  const [showOverdueModal, setShowOverdueModal] = useState(false);
  const [reminderFilter, setReminderFilter] = useState<ReminderFilter>("all");
  const [sendingReminderIds, setSendingReminderIds] = useState<Set<string>>(() => new Set());
  const [sendingAllReminders, setSendingAllReminders] = useState(false);
  const [reminderHistory, setReminderHistory] = useState<Record<string, string>>(loadReminderHistory);
  const sendingReminderIdsRef = useRef(new Set<string>());
  const sendingAllRemindersRef = useRef(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(REMINDER_HISTORY_STORAGE_KEY, JSON.stringify(reminderHistory));
    } catch (error) {
      console.error("[EnterFlow] Could not persist payment reminder history.", error);
    }
  }, [reminderHistory]);

  /* DERIVED: invoices come from the orders store. Anything past delivery is invoiced. */
  const trackedInquiries = useMemo(
    () => inquiriesByStage(["po", "jo", "in_production", "quality_inspection", "ready_for_dispatch", "dispatched", "delivered", "overdue", "paid"]),
    [inquiriesByStage]
  );
  const invoiceInquiries = useMemo(
    () => trackedInquiries.filter((inquiry) =>
      (!!inquiry.invoiceSentAt && !!inquiry.invoiceNo) || hasActivePaymentCycle(inquiry)
    ),
    [trackedInquiries]
  );
  const rows = useMemo(() => invoiceInquiries.map(inquiryToInvoice), [invoiceInquiries]);
  const fulfillmentRows = useMemo(
    () => trackedInquiries
      .filter((inquiry) => hasValidSignedDeliveryReceipt(inquiry) && !inquiry.invoiceSentAt && !hasActivePaymentCycle(inquiry))
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
  const isActivePaymentCycle = (r: Invoice) => Boolean(r.signedDeliveryReceiptReceivedAt && r.paymentCycleStartedAt);
  const isActiveBalancePaymentCycle = (r: Invoice) =>
    isActivePaymentCycle(r)
    && (r.paymentState.currentPaymentType === "BALANCE_PAYMENT" || r.paymentState.currentPaymentType === null);
  const downpaymentRows = visible.filter((r) =>
    !isActiveBalancePaymentCycle(r)
    && (r.paymentState.currentPaymentType === "DOWNPAYMENT"
      || r.paymentRecords.some((payment) => payment.paymentType === "DOWNPAYMENT"))
  );
  const activePaymentCycleRows = visible.filter((r) =>
    isActiveBalancePaymentCycle(r)
  );
  const fullyPaidHistoryRows = activePaymentCycleRows.filter((r) =>
    r.paymentState.state === "FULLY_PAID"
    && r.paymentState.remainingInvoiceBalance === 0
    && !r.paymentRecords.some((payment) => payment.verificationStatus === "pending")
  );
  const downpaymentRowsForFilter = (filter: typeof downpaymentFilter) => downpaymentRows.filter((r) => {
    if (filter === "ALL") return true;
    const records = r.paymentRecords.filter((payment) => payment.paymentType === "DOWNPAYMENT");
    if (filter === "AWAITING VERIFICATION") return records.some((payment) => payment.verificationStatus === "pending");
    if (filter === "VERIFIED") return records.some((payment) => payment.verificationStatus === "verified");
    if (filter === "REJECTED") return records.some((payment) => payment.verificationStatus === "rejected");
    return r.paymentState.downpaymentStatus === "COMPLETE";
  });
  const activePaymentCycleRowsForFilter = (filter: typeof activeCycleFilter, sourceRows = activePaymentCycleRows) => sourceRows.filter((r) => {
    if (filter === "ALL") return true;
    const status = granularStatus(r, r.paymentState.totalVerifiedPayments, now);
    if (filter === "PAID/COMPLETED") return status === "Paid";
    const statusMap: Record<Exclude<typeof activeCycleFilter, "ALL" | "PAID/COMPLETED">, GranularStatus> = {
      PENDING: "Pending",
      PARTIAL: "Partial",
      OVERDUE: "Overdue",
      "AWAITING VERIFICATION": "Awaiting Verification",
      REJECTED: "Rejected",
    };
    return status === statusMap[filter as keyof typeof statusMap];
  });
  const paymentSections = [
    {
      key: "downpayment",
      label: "DOWNPAYMENT / PAYMENT SETUP",
      description: "Downpayment-stage records, including awaiting verification, verified, and rejected submissions.",
      rows: downpaymentRowsForFilter(downpaymentFilter),
    },
    {
      key: "active-cycle",
      label: view === "history" ? "FULLY PAID / CLEARED" : "ACTIVE PAYMENT CYCLE",
      description: view === "history"
        ? "Invoices with fully verified payments and zero outstanding balance."
        : "Orders with a received signed Delivery Receipt and an active balance-payment cycle.",
      rows: activePaymentCycleRowsForFilter(
        activeCycleFilter,
        view === "history" ? fullyPaidHistoryRows : activePaymentCycleRows,
      ),
    },
  ].filter((section) => view !== "history" || section.key !== "downpayment");

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
    const inquiry = rows.find((row) => row.id === invId);
    const source = inquiry ? byClient(inquiry.client).find((item) => item.id === invId) : undefined;
    if (!source) {
      toast.error("Payment record could not be found.");
      return;
    }
    const record = paymentRecords(source).find((payment) => payment.id === oldEntry.id);
    const nextAmountCents = toMoneyCents(next.amount);
    if (!Number.isFinite(next.amount) || nextAmountCents <= 0) {
      toast.error("Invalid amount");
      return;
    }
    if (record) {
      const currentAmountCents = toMoneyCents(record.verifiedAmount ?? record.submittedAmount);
      const maximumAmountCents = toMoneyCents(paymentState(source).remainingInvoiceBalance) + currentAmountCents;
      const maximumDownpaymentCents = record.paymentType === "DOWNPAYMENT"
        ? toMoneyCents(paymentState(source).remainingDownpayment) + currentAmountCents
        : maximumAmountCents;
      if (nextAmountCents > Math.min(maximumAmountCents, maximumDownpaymentCents)) {
        toast.error("Payment exceeds the amount currently due.");
        return;
      }
      updateInquiry(invId, {
        payments: (source.payments ?? []).map((payment) => payment.id === record.id
          ? {
              ...payment,
              submittedAmount: fromMoneyCents(nextAmountCents),
              verifiedAmount: payment.verificationStatus === "verified" ? fromMoneyCents(nextAmountCents) : payment.verifiedAmount,
              method: next.method,
              referenceNumber: next.ref,
              paymentDate: next.date,
            }
          : payment),
        confirmedPayments: (source.confirmedPayments ?? []).map((payment) => payment.id === record.id
          ? { ...payment, amount: fromMoneyCents(nextAmountCents), method: next.method, ref: next.ref, date: next.date }
          : payment),
        ...(record.id === `legacy-paid-${source.id}` ? { amountPaid: fromMoneyCents(nextAmountCents), paidAt: next.date } : {}),
      });
    } else {
      toast.error("Payment record could not be matched to the invoice.");
      return;
    }
    setPayments(prev => ({
      ...prev,
      [invId]: (prev[invId] ?? []).map(p => p.id === oldEntry.id ? { ...p, ...next } : p),
    }));
    toast.success("Receipt updated");
  };

  const addPayment = (id: string) => {
    const invoice = rows.find((row) => row.id === id);
    if (!invoice || invoice.paymentState.currentPaymentType === null) {
      toast.info("This invoice is already fully paid; no further payment can be recorded.");
      return;
    }
    const f = newPmt[id];
    if (!f?.amount || !f?.method) { toast.error("Amount and method required"); return; }
    const enteredAmount = Number(f.amount);
    const amountCents = toMoneyCents(enteredAmount);
    if (!Number.isFinite(enteredAmount) || amountCents <= 0) { toast.error("Invalid amount"); return; }
    const target = byClient(invoice.client).find((inquiry) => inquiry.id === invoice.id);
    const allowance = target ? paymentSubmissionAllowance(target) : null;
    if (!allowance?.paymentType || amountCents > toMoneyCents(allowance.maxAmount)) {
      toast.error("Payment exceeds the amount currently due", {
        description: allowance?.maxAmount
          ? `Maximum payment: ₱${formatMoney(allowance.maxAmount)}`
          : "No payment is currently due for this invoice.",
      });
      return;
    }
    const amt = fromMoneyCents(amountCents);
    const entryDate = f.datePaid?.trim()
      ? f.datePaid
      : new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const reference = f.ref || "—";
    const paymentId = confirmClientPayment(target.id, { date: entryDate, amount: amt, method: f.method, ref: reference });
    if (!paymentId) {
      toast.error("Payment could not be recorded. Review the current balance and try again.");
      return;
    }
    const entry: PaymentEntry = {
      id: paymentId, date: entryDate,
      amount: amt, method: f.method, ref: reference,
    };
    setPayments((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), entry] }));
    setNewPmt((prev) => ({ ...prev, [id]: { amount: "", method: "", ref: "", datePaid: "" } }));
    pushNotif({
      dept: "payments",
      title: `Payment confirmed for ${invoice.client}`,
      body: `₱${amt.toLocaleString("en-PH")} · ${invoice.inv} · synced to client portal`,
      link: "accounting",
      recipients: ["client"],
    });
    toast.success("Payment recorded", { description: `₱${formatMoney(amt)} via ${f.method} · synced to client portal` });
  };

  const clearAccount = (id: string) => {
    const inv = rows.find(r => r.id === id);
    if (!inv) return;
    if (inv.paymentState.state !== "FULLY_PAID") {
      toast.info("Verify payments until the remaining balance reaches zero before clearing this account.");
      return;
    }
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
    const remainingCents = Math.max(0, toMoneyCents(invoice.paymentState.remainingInvoiceBalance) - toMoneyCents(payment.submittedAmount));
    const verifiedDownpaymentCents = toMoneyCents(invoice.paymentState.verifiedDownpaymentAmount)
      + (payment.paymentType === "DOWNPAYMENT" ? toMoneyCents(payment.submittedAmount) : 0);
    const requiredDownpaymentCents = toMoneyCents(invoice.paymentState.requiredDownpaymentAmount);
    const requirementMet = requiredDownpaymentCents > 0
      ? (payment.paymentType === "FULL_PAYMENT" ? remainingCents === 0 : verifiedDownpaymentCents >= requiredDownpaymentCents)
      : remainingCents === 0;
    const remaining = fromMoneyCents(remainingCents);
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
    setRejectionReason("");
    setPaymentToReject({ invoice, payment });
  };

  const confirmRejectClientPayment = () => {
    const reason = rejectionReason.trim();
    if (!paymentToReject || !reason) return;
    const { invoice, payment } = paymentToReject;
    if (!rejectPayment(invoice.id, payment.id, reason)) {
      toast.error("This payment is no longer awaiting verification.");
      setPaymentToReject(null);
      return;
    }
    pushNotif({
      dept: "payments",
      title: `Payment Rejected: ${invoice.inv}`,
      body: `${invoice.client} · ${payment.paymentType.replace("_", " ")} · ₱${payment.submittedAmount.toLocaleString("en-PH")} · Reason for Rejection: ${reason}`,
      link: "accounting",
      clientName: invoice.client,
      recipients: ["client"],
    });
    toast.info("Payment rejected", { description: `${invoice.inv} · client notified` });
    setPaymentToReject(null);
    setRejectionReason("");
  };

  const reminderCandidates = rows.filter(isEligibleReminder);
  const isReminderCoolingDown = (invoice: Invoice) => {
    const lastReminderAt = reminderHistory[invoice.id];
    if (!lastReminderAt) return false;
    const nextEligibleAt = reminderNextEligibleAt(lastReminderAt);
    return Number.isFinite(nextEligibleAt) && now.getTime() < nextEligibleAt;
  };
  const eligibleReminderRows = reminderCandidates.filter((invoice) => !isReminderCoolingDown(invoice));
  const dueSoonReminderCount = eligibleReminderRows.filter((r) => reminderCategory(r, now) === "dueSoon").length;
  const overdueReminderCount = eligibleReminderRows.filter((r) => reminderCategory(r, now) === "overdue").length;
  const filteredReminderRows = filterReminderRows(reminderCandidates, reminderFilter, now);

  const createReminderNotification = (invoice: Invoice) => {
    if (!isEligibleReminder(invoice)) {
      throw new Error("This invoice no longer has an eligible outstanding balance.");
    }
    const category = reminderCategory(invoice, now);
    const paymentType = invoice.paymentState.currentPaymentType?.replace(/_/g, " ") ?? "PAYMENT";
    pushNotif({
      dept: "payments",
      title: `Payment reminder: ${invoice.inv}`,
      body: `${invoice.client} · ${paymentType} · outstanding balance ₱${invoice.paymentState.remainingInvoiceBalance.toLocaleString("en-PH")} · ${category === "overdue" ? "overdue" : category === "dueSoon" ? "due soon" : "remaining balance"}`,
      link: "accounting",
      clientName: invoice.client,
      recipients: ["client"],
    });
    return true;
  };

  const sendInvoiceReminder = (invoice: Invoice) => {
    if (sendingAllRemindersRef.current || sendingReminderIdsRef.current.has(invoice.id) || isReminderCoolingDown(invoice)) return;
    sendingReminderIdsRef.current.add(invoice.id);
    setSendingReminderIds(new Set(sendingReminderIdsRef.current));
    try {
      createReminderNotification(invoice);
      const sentAt = new Date().toISOString();
      setReminderHistory((previous) => ({ ...previous, [invoice.id]: sentAt }));
    } catch (error) {
      console.error("[EnterFlow] Could not create invoice reminder notification.", error);
      toast.error("Reminder could not be sent", { description: `${invoice.inv} · Please try again.` });
      sendingReminderIdsRef.current.delete(invoice.id);
      setSendingReminderIds(new Set(sendingReminderIdsRef.current));
      return;
    }
    sendingReminderIdsRef.current.delete(invoice.id);
    setSendingReminderIds(new Set(sendingReminderIdsRef.current));
    toast.success("Reminder notification created", {
      description: `${invoice.client} · Invoice ${invoice.inv}. This is a prototype notification, not a delivered email.`,
    });
  };

  const sendFilteredReminders = () => {
    const eligibleInvoices = filteredReminderRows.filter((invoice) => !isReminderCoolingDown(invoice));
    if (sendingAllRemindersRef.current || eligibleInvoices.length === 0) return;
    sendingAllRemindersRef.current = true;
    const invoicesToSend = [...eligibleInvoices];
    const skippedCount = filteredReminderRows.length - invoicesToSend.length;
    invoicesToSend.forEach((invoice) => sendingReminderIdsRef.current.add(invoice.id));
    setSendingAllReminders(true);
    setSendingReminderIds(new Set(sendingReminderIdsRef.current));
    let sentCount = 0;
    const failedInvoices: string[] = [];
    try {
      invoicesToSend.forEach((invoice) => {
        try {
          createReminderNotification(invoice);
          const sentAt = new Date().toISOString();
          setReminderHistory((previous) => ({ ...previous, [invoice.id]: sentAt }));
          sentCount += 1;
        } catch (error) {
          console.error(`[EnterFlow] Could not create invoice reminder notification for ${invoice.inv}.`, error);
          failedInvoices.push(invoice.inv);
        }
      });
      if (sentCount > 0 || skippedCount > 0) {
        toast.success(`${sentCount} reminder${sentCount === 1 ? "" : "s"} sent successfully.`, {
          description: `${skippedCount} invoice${skippedCount === 1 ? "" : "s"} skipped because the reminder cooldown is still active.`,
        });
      }
      if (failedInvoices.length > 0) {
        toast.error(`${failedInvoices.length} reminder${failedInvoices.length === 1 ? "" : "s"} could not be sent`, {
          description: failedInvoices.join(", "),
        });
      }
    } finally {
      invoicesToSend.forEach((invoice) => sendingReminderIdsRef.current.delete(invoice.id));
      sendingAllRemindersRef.current = false;
      setSendingAllReminders(false);
      setSendingReminderIds(new Set(sendingReminderIdsRef.current));
    }
  };

  const beginOfficialReceipt = (invoice: Invoice) => {
    const current = rows.find((row) => row.id === invoice.id);
    if (!current || current.officialReceipt) {
      toast.error("This invoice already has an issued Official Receipt.");
      return;
    }
    const currentInquiry = byClient(current.client).find((inquiry) => inquiry.id === current.id);
    const currentState = currentInquiry ? paymentState(currentInquiry) : current.paymentState;
    const hasUnverifiedPayment = currentInquiry ? paymentRecords(currentInquiry).some((payment) => payment.verificationStatus === "pending") : true;
    if (currentState.state !== "FULLY_PAID" || currentState.remainingInvoiceBalance > 0 || hasUnverifiedPayment) {
      toast.error("Official Receipt issuance is unavailable until all payments are verified and the balance is zero.");
      return;
    }
    setReceiptToIssue(current);
  };

  const issueReceipt = (invoice: Invoice, orNumber: string) => {
    const succeeded = issueOfficialReceipt(invoice.id, orNumber, issuingStaff);
    if (!succeeded) {
      toast.error("Official Receipt could not be issued. Verify the invoice state and OR number.");
      return;
    }
    pushNotif({
      dept: "payments",
      title: `Official Receipt available: ${orNumber.trim()}`,
      body: `${invoice.client} · ${invoice.inv} · ₱${invoice.paymentState.totalVerifiedPayments.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
      link: "client-portal",
      recipients: ["client"],
      clientName: invoice.client,
      resourceType: "official-receipt",
      resourceId: invoice.id,
    });
    setReceiptToIssue(null);
    toast.success("Official Receipt issued", { description: `${orNumber.trim()} · prototype-generated document` });
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
                <AlertTriangle size={14} /> Send Payment Reminders
              </button>
            </>
          )}
          <NotificationBell />
        </div>
      </header>

      <div className="px-8 py-8 flex flex-col gap-6">
        <div className="grid grid-cols-4 gap-6">
          <KPI label="Total Invoices" value={String(rows.length)} />
          <KPI label="Total Billed" value={`₱${formatMoney(fromMoneyCents(rows.reduce((sum, row) => sum + toMoneyCents(row.amount), 0)))}`} accent="#1A2B4A" />
          <KPI label="Pending Collection" value={`₱${formatMoney(fromMoneyCents(rows.filter((row) => row.status === "pending").reduce((sum, row) => sum + toMoneyCents(row.amount), 0)))}`} accent="#D97706" />
          <KPI label="Paid & Closed" value={`₱${formatMoney(fromMoneyCents(rows.filter((row) => row.status === "paid").reduce((sum, row) => sum + toMoneyCents(row.amount), 0)))}`} accent="#16A34A" />
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
            <p className="font-dm mb-4" style={{ fontSize: 12, color: "#64748B" }}>Signed-receipt orders awaiting payment-cycle start. Invoice and payment verification controls are unchanged.</p>
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

        <div className="bg-white rounded-xl border border-slate-200/70 overflow-x-auto" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
          <table className="w-full min-w-[1180px] table-fixed">
            <colgroup>
              <col style={{ width: 115 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 175 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 165 }} />
              <col style={{ width: 235 }} />
            </colgroup>
            <thead style={{ backgroundColor: "#F4F6F9" }}>
              <tr>
                {["Date", "Invoice No.", "Source PO No.", "Client", "Item", "Amount", "Payment", "Status"].map((h) => (
                  <th key={h} className="font-dm text-left px-4 py-3" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            {paymentSections.map((section) => (
              <Fragment key={section.key}>
                <tbody>
                  <tr>
                    <td colSpan={8} className="border-t border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="font-syne" style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", letterSpacing: 0.4 }}>{section.label}</div>
                        <select
                          value={section.key === "downpayment" ? downpaymentFilter : activeCycleFilter}
                          onChange={(event) => section.key === "downpayment"
                            ? setDownpaymentFilter(event.target.value as typeof downpaymentFilter)
                            : setActiveCycleFilter(event.target.value as typeof activeCycleFilter)}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-dm outline-none"
                          style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}
                          aria-label={`${section.label} status filter`}
                        >
                          {(section.key === "downpayment"
                            ? ["ALL", "AWAITING VERIFICATION", "VERIFIED", "REJECTED", "PAID/COMPLETED"]
                            : ["ALL", "PENDING", "PARTIAL", "PAID/COMPLETED", "OVERDUE", "AWAITING VERIFICATION", "REJECTED"]
                          ).map((filter) => <option key={filter} value={filter}>{filter === "ALL" ? "All" : filter}</option>)}
                        </select>
                      </div>
                      <div className="font-dm mt-1" style={{ fontSize: 11, color: "#64748B" }}>{section.description}</div>
                    </td>
                  </tr>
                  {section.rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-4 font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>
                        No orders in this payment stage.
                      </td>
                    </tr>
                  )}
                  {section.rows.map((r) => {
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
                      <td className="px-4 py-3 font-dm break-words" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{r.client}</td>
                      <td className="px-4 py-3 font-dm break-words" style={{ fontSize: 13, color: "#475569" }}>{r.item}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>₱{formatMoney(r.amount)}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>
                        <div style={{ fontWeight: 700, color: "#1A2B4A" }}>{r.paymentType}</div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>{r.payment}</div>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <div className="flex min-w-0 items-center justify-between gap-2">
                          <StatusPill status={section.key === "downpayment" ? downpaymentDisplayStatus(r) : granularStatus(r, r.paymentState.totalVerifiedPayments, now)} />
                          {view === "history" && hasFullyPaidBalancePayment(r) && (
                            <button
                              type="button"
                              aria-label={`View payment history for ${r.inv}`}
                              onClick={(event) => { event.stopPropagation(); setOpenId(r.id); }}
                              className="shrink-0 whitespace-nowrap rounded-md px-1 py-1 font-dm text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-50 hover:text-blue-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                            >
                              View Payment History →
                            </button>
                          )}
                        </div>
                        {view === "history" && (
                          <div className="flex flex-col items-start gap-1">
                            {r.officialReceipt ? (
                              <button
                                onClick={(event) => { event.stopPropagation(); setReceiptToView(r.officialReceipt!); }}
                                className="font-dm rounded-md px-0 py-0.5 hover:bg-blue-50"
                                style={{ fontSize: 11, fontWeight: 700, color: "#1D4ED8" }}
                              >View Official Receipt</button>
                            ) : (
                              <button
                                onClick={(event) => { event.stopPropagation(); beginOfficialReceipt(r); }}
                                className="font-dm inline-flex items-center justify-center rounded-md px-3 py-2 text-white shadow-sm transition-opacity hover:opacity-90"
                                style={{ backgroundColor: "#C8102E", fontSize: 11, fontWeight: 700, lineHeight: 1.2, whiteSpace: "nowrap" }}
                              >Issue Official Receipt</button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                    {isOpen && (() => {
                      const pmts = payments[r.id] ?? [];
                      const clientPayments = r.paymentRecords;
                      const localPaidCents = pmts.reduce((sum, payment) => sum + toMoneyCents(payment.amount), 0);
                      const verifiedClientPayments = clientPayments.filter((payment) => payment.verificationStatus === "verified");
                      const unlistedVerifiedPayments = verifiedClientPayments.filter((payment) => !pmts.some((entry) =>
                        entry.id === payment.id
                        || (entry.date === payment.paymentDate
                          && entry.amount === (payment.verifiedAmount ?? payment.submittedAmount)
                          && entry.method === payment.method
                          && entry.ref === (payment.referenceNumber ?? "—"))
                      ));
                      const totalPaid = r.paymentState.totalVerifiedPayments;
                      const remaining = r.paymentState.remainingInvoiceBalance;
                      const pf = newPmt[r.id] ?? { amount: "", method: "", ref: "", datePaid: "" };
                      const clientInquiries = byClient(r.client);
                      const clientReceipts = clientInquiries.flatMap(i => i.clientPaymentReceipts ?? []);
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
                                  {r.payment} · Delivered: {r.deliveredDate ?? r.date} · Due: <span style={{ fontWeight: 600, color: paymentCycleOverdue ? "#C8102E" : "#0F172A" }}>{r.dueDate ?? "—"}</span>
                                  {paymentCycleOverdue && <span className="ml-2 font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: "#FEE2E2", color: "#C8102E" }}>⚠️ {Math.abs(cycleDaysRemaining ?? 0)} DAYS OVERDUE</span>}
                                </div>
                              </div>
                              <div className="flex gap-6 text-right">
                                <div>
                                  <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Invoice Total</div>
                                  <div className="font-syne" style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>₱{formatMoney(r.amount)}</div>
                                </div>
                                <div>
                                  <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Paid</div>
                                  <div className="font-syne" style={{ fontSize: 18, fontWeight: 800, color: "#16A34A" }}>₱{formatMoney(totalPaid)}</div>
                                </div>
                                <div>
                                  <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Balance Due</div>
                                  <div className="font-syne" style={{ fontSize: 18, fontWeight: 800, color: remaining > 0 ? "#C8102E" : "#16A34A" }}>₱{formatMoney(remaining)}</div>
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
                                  const statusColor = p.verificationStatus === "pending" ? "#B45309"
                                    : p.verificationStatus === "verified" ? "#15803D" : "#C8102E";
                                  const dpPercent = r.downpaymentPercent;
                                  const paymentBalanceCents = p.paymentType === "DOWNPAYMENT"
                                    ? toMoneyCents(r.paymentState.remainingDownpayment)
                                    : toMoneyCents(r.paymentState.remainingInvoiceBalance);
                                  const remainingAfterCents = p.verificationStatus === "pending"
                                    ? Math.max(0, paymentBalanceCents - toMoneyCents(p.submittedAmount))
                                    : paymentBalanceCents;
                                  const remainingAfter = fromMoneyCents(remainingAfterCents);
                                  const paymentKey = `${r.id}:${p.id}`;
                                  const isPaymentExpanded = expandedClientPayments.has(paymentKey);
                                  return (
                                  <div key={paymentKey} className="mb-2 last:mb-0 overflow-hidden rounded-lg border border-blue-200 bg-white shadow-sm">
                                    <button
                                      type="button"
                                      aria-expanded={isPaymentExpanded}
                                      aria-controls={`client-payment-details-${paymentKey}`}
                                      onClick={() => setExpandedClientPayments((previous) => {
                                        const next = new Set(previous);
                                        if (next.has(paymentKey)) next.delete(paymentKey);
                                        else next.add(paymentKey);
                                        return next;
                                      })}
                                      className="flex w-full flex-wrap items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-slate-50"
                                    >
                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate font-dm" style={{ fontSize: 12, fontWeight: 800, color: "#1A2B4A" }}>{r.client} · {p.invoiceNo ?? r.inv}</span>
                                        <span className="mt-0.5 block font-dm" style={{ fontSize: 10, fontWeight: 600, color: "#64748B" }}>{paymentType} · PAYMENT {p.verificationStatus === "pending" ? "SUBMITTED" : statusLabel}</span>
                                      </span>
                                      <span className="flex shrink-0 items-center gap-2">
                                        <span className="font-dm px-2 py-1 rounded-full" style={{ fontSize: 10, fontWeight: 800, color: statusColor, backgroundColor: `${statusColor}18` }}>{statusLabel}</span>
                                        {isPaymentExpanded ? <ChevronUp size={16} color="#64748B" /> : <ChevronDown size={16} color="#64748B" />}
                                      </span>
                                    </button>
                                    {isPaymentExpanded && <div id={`client-payment-details-${paymentKey}`} className="border-t border-blue-100 p-3">
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4 xl:grid-cols-6 font-dm" style={{ fontSize: 11, color: "#475569" }}>
                                      <span>Client</span><strong>{r.client}</strong>
                                      <span>Invoice</span><strong>{p.invoiceNo ?? r.inv}</strong>
                                      <span>PO</span><strong>{r.po}</strong>
                                      <span>PAYMENT TYPE</span><strong>{paymentType}</strong>
                                      <span>Invoice Total</span><strong>₱{formatMoney(r.paymentState.invoiceTotal)}</strong>
                                      {p.paymentType === "DOWNPAYMENT" ? <>
                                        <span>DOWNPAYMENT REQUIRED</span><strong>{dpPercent}%</strong>
                                        <span>Required Amount</span><strong>₱{formatMoney(r.paymentState.requiredDownpaymentAmount)}</strong>
                                      </> : p.paymentType === "BALANCE_PAYMENT" ? <>
                                        <span>Previously Verified</span><strong>₱{formatMoney(r.paymentState.totalVerifiedPayments)}</strong>
                                        <span>Balance Due</span><strong>₱{formatMoney(r.paymentState.remainingInvoiceBalance)}</strong>
                                      </> : <>
                                        <span>FULL PAYMENT REQUIRED</span><strong>₱{formatMoney(r.paymentState.remainingInvoiceBalance)}</strong>
                                      </>}
                                      <span>Submitted Amount</span><strong>₱{formatMoney(p.submittedAmount)}</strong>
                                      <span>Remaining Balance</span><strong>₱{formatMoney(remainingAfter)}</strong>
                                      <span>Date Submitted</span><strong>{p.paymentDate}</strong>
                                      <span>Payment Method</span><strong>{p.method ?? "Not specified"}</strong>
                                      <span>Reference Number</span><strong>{p.referenceNumber ?? "—"}</strong>
                                      {p.verifiedAt && <><span>Date Verified</span><strong>{new Date(p.verifiedAt).toLocaleString()}</strong></>}
                                      {p.rejectedAt && <><span>Date Rejected</span><strong>{new Date(p.rejectedAt).toLocaleString()}</strong></>}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-blue-100">
                                      <button onClick={() => p.receiptDataUrl && setProofToView({ filename: p.receiptFile ?? "Uploaded receipt", dataUrl: p.receiptDataUrl })} disabled={!p.receiptDataUrl} className="font-dm flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-blue-200 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed" style={{ fontSize: 11, fontWeight: 700, color: "#2563EB" }}><Eye size={11} /> VIEW PROOF OF PAYMENT</button>
                                      {p.verificationStatus === "pending" && <>
                                        <button onClick={() => handleRejectClientPayment(r, p)} className="font-dm flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-red-200 hover:bg-red-50" style={{ fontSize: 11, fontWeight: 700, color: "#C8102E" }}><X size={11} /> Reject Payment</button>
                                        <button onClick={() => handleVerifyClientPayment(r, p)} disabled={!p.receiptDataUrl || p.submittedAmount <= 0} className="font-dm flex items-center gap-1 px-2.5 py-1.5 rounded-md text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed" style={{ fontSize: 11, fontWeight: 700, backgroundColor: "#15803D" }}><CheckCircle2 size={11} /> VERIFY PAYMENT</button>
                                      </>}
                                    </div>
                                    </div>}
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
                                        <td className="px-3 py-2.5 font-dm" style={{ fontSize: 12, color: "#C8102E", fontWeight: 600 }}>₱{formatMoney(r.amount)}</td>
                                        <td className="px-3 py-2.5 font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>—</td>
                                        <td className="px-3 py-2.5 font-syne" style={{ fontSize: 12, fontWeight: 700, color: "#C8102E" }}>₱{formatMoney(r.amount)}</td>
                                      </tr>
                                      {pmts.reduce((acc, p) => {
                                        const newBalanceCents = Math.max(0, acc.balanceCents - toMoneyCents(p.amount));
                                        const newBal = fromMoneyCents(newBalanceCents);
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
                                            <td className="px-3 py-2.5 font-dm" style={{ fontSize: 12, color: "#16A34A", fontWeight: 600 }}>₱{formatMoney(p.amount)}</td>
                                            <td className="px-3 py-2.5 font-syne" style={{ fontSize: 12, fontWeight: 700, color: newBal > 0 ? "#C8102E" : "#16A34A" }}>₱{formatMoney(newBal)}</td>
                                          </tr>
                                        );
                                        acc.balanceCents = newBalanceCents;
                                        return acc;
                                      }, { balanceCents: toMoneyCents(r.amount), rows: [] as React.ReactNode[] }).rows}
                                      {unlistedVerifiedPayments.reduce((acc, payment) => {
                                        const amount = fromMoneyCents(toMoneyCents(payment.verifiedAmount ?? payment.submittedAmount));
                                        const balanceCents = Math.max(0, acc.balanceCents - toMoneyCents(amount));
                                        const balance = fromMoneyCents(balanceCents);
                                        const type = payment.paymentType === "DOWNPAYMENT" ? "DOWNPAYMENT"
                                          : payment.paymentType === "BALANCE_PAYMENT" ? "BALANCE PAYMENT" : "FULL PAYMENT";
                                        acc.rows.push(
                                          <tr key={payment.id} className="bg-white border-b border-slate-100">
                                            <td className="px-3 py-2.5 font-dm" style={{ fontSize: 12, color: "#475569" }}>{payment.paymentDate}</td>
                                            <td className="px-3 py-2.5 font-dm" style={{ fontSize: 11, color: "#0F172A" }}>{type} · {payment.method ?? "Payment"}{payment.referenceNumber ? ` · ${payment.referenceNumber}` : ""}</td>
                                            <td className="px-3 py-2.5 font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>—</td>
                                            <td className="px-3 py-2.5 font-dm" style={{ fontSize: 12, color: "#16A34A", fontWeight: 600 }}>₱{formatMoney(amount)}</td>
                                            <td className="px-3 py-2.5 font-syne" style={{ fontSize: 12, fontWeight: 700, color: balance > 0 ? "#C8102E" : "#16A34A" }}>₱{formatMoney(balance)}</td>
                                          </tr>
                                        );
                                        acc.balanceCents = balanceCents;
                                        return acc;
                                      }, { balanceCents: Math.max(0, toMoneyCents(r.amount) - localPaidCents), rows: [] as React.ReactNode[] }).rows}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* Record new payment */}
                              {view === "active" && (
                              <div className="flex flex-col gap-3">
                                <div className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Record Payment</div>
                                <div className="rounded-lg p-4 flex flex-col gap-3" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                                  <div className="flex flex-col gap-1">
                                    <label className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>Amount (₱)</label>
                                    <input
                                      type="number" min={0} step="0.01" placeholder="e.g. 23400.00"
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
                                    {remaining > 0 ? `₱${formatMoney(remaining)} remaining` : "Mark Cleared ✓"}
                                  </button>
                                </div>
                              </div>
                              )}
                            </div>

                          </td>
                        </tr>
                      );
                    })()}
                  </Fragment>
                );
                  })}
                </tbody>
              </Fragment>
            ))}
          </table>
        </div>
      </div>

      {/* Overdue Reminders Modal */}
      {/* Edit Receipt Modal */}
      {paymentToReject && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,.65)" }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-payment-title"
            className="bg-white rounded-xl w-full max-w-lg overflow-hidden"
            style={{ boxShadow: "0 24px 48px rgba(0,0,0,.25)" }}
          >
            <header className="px-6 py-4 border-b border-slate-200">
              <h2 id="reject-payment-title" className="font-syne" style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>Reject Payment</h2>
            </header>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-slate-50 p-4 font-dm" style={{ fontSize: 12, color: "#475569" }}>
                <span>Client</span><strong>{paymentToReject.invoice.client}</strong>
                <span>Invoice</span><strong>{paymentToReject.payment.invoiceNo ?? paymentToReject.invoice.inv}</strong>
                <span>Payment Type</span><strong>{paymentToReject.payment.paymentType.replace("_", " ")}</strong>
                <span>Submitted Amount</span><strong>₱{formatMoney(paymentToReject.payment.submittedAmount)}</strong>
              </div>
              <label htmlFor="payment-rejection-reason" className="font-dm block mt-5 mb-1.5" style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
                Reason for Rejection <span style={{ color: "#C8102E" }}>*</span>
              </label>
              <textarea
                id="payment-rejection-reason"
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Explain why this payment is being rejected..."
                rows={4}
                required
                className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white resize-y"
                style={{ fontSize: 13 }}
              />
            </div>
            <footer className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => { setPaymentToReject(null); setRejectionReason(""); }}
                className="font-dm px-4 py-2 rounded-md border border-slate-200 hover:bg-slate-50"
                style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}
              >
                Cancel
              </button>
              <button
                onClick={confirmRejectClientPayment}
                disabled={!rejectionReason.trim()}
                className="font-dm px-4 py-2 rounded-md text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ fontSize: 13, fontWeight: 700, backgroundColor: "#C8102E" }}
              >
                Reject Payment
              </button>
            </footer>
          </section>
        </div>
      )}

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

      {receiptToView && <OfficialReceiptPreviewModal receipt={receiptToView} onClose={() => setReceiptToView(null)} />}

      {showOverdueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.6)" }} onClick={() => setShowOverdueModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-[800px] h-[85vh] max-h-[85vh] flex flex-col" style={{ boxShadow: "0 24px 48px rgba(15,23,42,0.28)" }} onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between" style={{ backgroundColor: "#FEF2F2" }}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} style={{ color: "#C8102E" }} />
                <h3 className="font-syne" style={{ fontSize: 16, fontWeight: 700, color: "#991B1B" }}>Overdue &amp; Pending Invoices</h3>
              </div>
              <button onClick={() => setShowOverdueModal(false)} className="w-8 h-8 rounded-md hover:bg-red-100 flex items-center justify-center"><X size={16} style={{ color: "#991B1B" }} /></button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
              <p className="font-dm flex-none" style={{ fontSize: 13, color: "#475569" }}>
                Review eligible outstanding invoices and create a client reminder notification for each selected invoice.
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <label htmlFor="reminder-filter" className="font-dm" style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Filter reminders</label>
                <select
                  id="reminder-filter"
                  value={reminderFilter}
                  onChange={(event) => setReminderFilter(event.target.value as ReminderFilter)}
                  disabled={sendingAllReminders}
                  className="font-dm rounded-md border border-slate-300 bg-white px-2.5 py-1.5 outline-none focus:border-slate-500 disabled:opacity-60"
                  style={{ fontSize: 12, color: "#0F172A" }}
                >
                  <option value="all">All Reminders</option>
                  <option value="remainingBalance">Remaining Balance</option>
                  <option value="dueSoon">Due Soon</option>
                  <option value="overdue">Overdue</option>
                </select>
                <span className="font-dm w-full" style={{ fontSize: 11, color: "#64748B" }}>
                  {filteredReminderRows.filter((invoice) => !isReminderCoolingDown(invoice)).length} eligible · {dueSoonReminderCount} due soon · {overdueReminderCount} overdue
                </span>
                <span className="font-dm w-full" style={{ fontSize: 10, color: "#94A3B8" }}>
                  Due soon means due within 7 days; Remaining Balance includes later or undated invoices.
                </span>
              </div>
              <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
              {filteredReminderRows.length === 0 ? (
                <div className="rounded-lg p-5 text-center font-dm" style={{ fontSize: 13, color: "#16A34A", backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                  {eligibleReminderRows.length === 0
                    ? "✅ No eligible reminders — all invoices are cleared or have no outstanding balance."
                    : "No eligible invoices match this reminder filter."}
                </div>
              ) : filteredReminderRows.map(r => {
                const category = reminderCategory(r, now);
                const isOverdue = category === "overdue";
                const isDueSoon = category === "dueSoon";
                const lastReminderAt = reminderHistory[r.id];
                const reminderOnCooldown = isReminderCoolingDown(r);
                const nextEligibleAt = lastReminderAt ? reminderNextEligibleAt(lastReminderAt) : undefined;
                return (
                  <div key={r.id} className="rounded-lg border p-3" style={{ backgroundColor: isOverdue ? "#FEF2F2" : isDueSoon ? "#FFFBEB" : "#F8FAFC", borderColor: isOverdue ? "#FECACA" : isDueSoon ? "#FDE68A" : "#CBD5E1" }}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="font-mono-jb whitespace-nowrap" style={{ fontSize: 13, fontWeight: 700, color: "#1A2B4A" }}>{r.inv}</span>
                        <span
                          className="font-dm whitespace-nowrap rounded-full px-2 py-0.5"
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            backgroundColor: isOverdue ? "#FEE2E2" : isDueSoon ? "#FEF3C7" : "#E2E8F0",
                            color: isOverdue ? "#C8102E" : isDueSoon ? "#B45309" : "#475569",
                          }}
                        >
                          {isOverdue ? "OVERDUE" : isDueSoon ? "DUE SOON" : "REMAINING BALANCE"}
                        </span>
                      </div>
                      {reminderOnCooldown ? (
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="rounded-full bg-green-100 px-2 py-0.5 font-dm text-[10px] font-bold text-green-800">Reminder Sent</span>
                          {lastReminderAt && (
                            <div className="text-right font-dm" style={{ fontSize: 10, color: "#64748B", lineHeight: 1.35 }}>
                              <div>Last reminder: {formatReminderDate(lastReminderAt)}</div>
                              {nextEligibleAt !== undefined && <div>Next eligible: {formatReminderDate(nextEligibleAt)}</div>}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => sendInvoiceReminder(r)}
                          disabled={sendingAllReminders || sendingReminderIds.has(r.id)}
                          className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-white font-dm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                          style={{ backgroundColor: "#C8102E", fontSize: 11, fontWeight: 700, letterSpacing: 0.3 }}
                        >
                          <Send size={12} /> {sendingReminderIds.has(r.id) ? "Sending..." : "Send Reminder"}
                        </button>
                      )}
                    </div>
                    <div className="mt-2">
                      <div className="font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{r.client}</div>
                      <div className="font-dm mt-0.5" style={{ fontSize: 12, color: "#64748B" }}>{r.item}</div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 border-t border-slate-200/80 pt-2 sm:grid-cols-3 sm:gap-3">
                      <div>
                        <div className="font-dm uppercase" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.35 }}>Balance</div>
                        <div className="font-syne mt-0.5" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>₱{formatMoney(r.paymentState.remainingInvoiceBalance)}</div>
                      </div>
                      <div>
                        <div className="font-dm uppercase" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.35 }}>Due Date</div>
                        <div className="font-dm mt-0.5" style={{ fontSize: 12, color: "#475569" }}>{r.dueDate ?? "—"}</div>
                      </div>
                      <div>
                        <div className="font-dm uppercase" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.35 }}>Payment Terms</div>
                        <div className="font-dm mt-0.5" style={{ fontSize: 12, color: "#475569" }}>{r.payment}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
              <span className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>{filteredReminderRows.filter((invoice) => !isReminderCoolingDown(invoice)).length} eligible reminder{filteredReminderRows.filter((invoice) => !isReminderCoolingDown(invoice)).length === 1 ? "" : "s"}</span>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setShowOverdueModal(false)} className="font-dm rounded-md px-3 py-1.5 hover:bg-slate-100" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Close</button>
                <button
                  onClick={sendFilteredReminders}
                  disabled={filteredReminderRows.filter((invoice) => !isReminderCoolingDown(invoice)).length === 0 || sendingAllReminders}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-white font-dm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundColor: "#C8102E", fontSize: 11, fontWeight: 700 }}
                >
                  <Send size={14} /> {sendingAllReminders ? "Sending..." : "Send All Payment Reminders"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {receiptToIssue && (
        <OfficialReceiptModal
          invoice={receiptToIssue}
          suggestedNumber={generateOfficialReceiptNumber()}
          issuingStaff={issuingStaff}
          onCancel={() => setReceiptToIssue(null)}
          onIssue={(orNumber) => issueReceipt(receiptToIssue, orNumber)}
        />
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
    const amt = Number(amount);
    if (!Number.isFinite(amt) || toMoneyCents(amt) <= 0) { toast.error("Invalid amount"); return; }
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
            <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
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

function OfficialReceiptModal({ invoice, suggestedNumber, issuingStaff, onCancel, onIssue }: {
  invoice: Invoice;
  suggestedNumber: string;
  issuingStaff: string;
  onCancel: () => void;
  onIssue: (orNumber: string) => void;
}) {
  const [orNumber, setOrNumber] = useState(suggestedNumber);
  const [submitting, setSubmitting] = useState(false);
  const issue = () => {
    if (!orNumber.trim()) { toast.error("OR number is required"); return; }
    if (submitting) return;
    setSubmitting(true);
    onIssue(orNumber);
    setSubmitting(false);
  };
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.6)" }} onClick={onCancel}>
      <div className="bg-white rounded-xl w-full max-w-2xl flex flex-col" style={{ boxShadow: "0 24px 48px rgba(0,0,0,0.3)", maxHeight: "90vh" }} onClick={(event) => event.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div><h3 className="font-syne" style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Issue Official Receipt</h3><div className="font-dm mt-1" style={{ fontSize: 11, color: "#64748B" }}>Prototype-generated receipt · not BIR-compliant</div></div>
          <button onClick={onCancel} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="p-6 overflow-auto grid grid-cols-2 gap-4 font-dm" style={{ fontSize: 12, color: "#475569" }}>
          <label className="flex flex-col gap-1"><span className="font-semibold">OR Number</span><input value={orNumber} onChange={(event) => setOrNumber(event.target.value)} className="px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" /></label>
          <div><div className="font-semibold">Issue Date</div><div className="mt-2 px-3 py-2 rounded-md bg-slate-50">{new Date().toLocaleDateString("en-US")}</div></div>
          <div><div className="font-semibold">Client / Company</div><div className="mt-2 px-3 py-2 rounded-md bg-slate-50">{invoice.client}</div></div>
          <div><div className="font-semibold">Related Invoice</div><div className="mt-2 px-3 py-2 rounded-md bg-slate-50">{invoice.inv}</div></div>
          <div><div className="font-semibold">Original Invoice Amount</div><div className="mt-2 px-3 py-2 rounded-md bg-slate-50">₱{invoice.paymentState.invoiceTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</div></div>
          <div><div className="font-semibold">Amount Covered by OR</div><div className="mt-2 px-3 py-2 rounded-md bg-green-50 text-green-800">₱{invoice.paymentState.totalVerifiedPayments.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</div></div>
          <div><div className="font-semibold">Issuing Staff</div><div className="mt-2 px-3 py-2 rounded-md bg-slate-50">{issuingStaff}</div></div>
          <div><div className="font-semibold">Outstanding Balance</div><div className="mt-2 px-3 py-2 rounded-md bg-green-50 text-green-800">₱{invoice.paymentState.remainingInvoiceBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</div></div>
          <div className="col-span-2 rounded-md border border-slate-200 p-3"><div className="font-semibold mb-2">Verified Payments</div>{invoice.paymentRecords.filter((payment) => payment.verificationStatus === "verified").map((payment) => <div key={payment.id} className="flex justify-between py-1"><span>{payment.paymentDate} · {payment.paymentType}</span><strong>₱{(payment.verifiedAmount ?? payment.submittedAmount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</strong></div>)}</div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2"><button onClick={onCancel} className="font-dm px-4 py-2 rounded-md hover:bg-slate-100" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Cancel</button><button onClick={issue} disabled={submitting} className="font-dm px-4 py-2 rounded-md text-white hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700 }}>Issue Official Receipt</button></div>
      </div>
    </div>
  );
}
