import { Fragment, useState, useEffect } from "react";
import { FileText, ClipboardList, Search, Plus, CheckCircle2, X, Send, AlertTriangle, ChevronDown, ChevronUp, PlusCircle, Receipt, Eye, History, Pencil, Download } from "lucide-react";
import { useOrders } from "../store/orders";
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
  client: string;
  item: string;
  amount: number;
  payment: string;
  status: Status;
  deliveredDate?: string;
  dueDate?: string;
}

const initial: Invoice[] = [
  { id: "i1", date: "2026-02-28", inv: "SI-2026-9805", po: "PO-2026-9805", client: "B.E. Aerospace", item: "Oil Separator Filter (20 pcs)", amount: 45000, payment: "Cash", status: "paid", deliveredDate: "Feb 28, 2026" },
  { id: "i2", date: "2026-03-31", inv: "SI-2026-9901", po: "PO-2026-9901", client: "B.E. Aerospace", item: "Air Filter 115×103×500mm (50 pcs)", amount: 78000, payment: "Bank Transfer · BDO", status: "paid", deliveredDate: "Mar 31, 2026" },
  { id: "i3", date: "2026-03-31", inv: "SI-2026-9531", po: "PO-2026-9531", client: "Maynilad", item: "Pleated Filter ZS20 (100 pcs)", amount: 50040, payment: "Bank Transfer · MetroBank", status: "paid", deliveredDate: "Mar 31, 2026" },
  { id: "i4", date: "2026-03-30", inv: "SI-2026-9533", po: "PO-2026-9533", client: "Maynilad", item: "Pleated Filter 5-Micron (100 pcs)", amount: 46800, payment: "30-Day Terms", status: "pending", deliveredDate: "Mar 30, 2026", dueDate: "Apr 29, 2026" },
  { id: "i5", date: "2026-04-10", inv: "SI-2026-0418", po: "PO-2026-0418", client: "B.E. Aerospace", item: "Air Filter KF-OS.107 (30 pcs)", amount: 46800, payment: "30-Day Terms", status: "pending", deliveredDate: "Apr 10, 2026", dueDate: "May 10, 2026" },
];

type GranularStatus = "Paid" | "Partial" | "Overdue" | "Pending";
function granularStatus(inv: Invoice, totalPaid: number): GranularStatus {
  if (inv.status === "paid") return "Paid";
  /* compute overdue from dueDate */
  if (inv.dueDate) {
    const due = new Date(inv.dueDate);
    if (!isNaN(due.getTime()) && due.getTime() < Date.now()) return "Overdue";
  }
  if (totalPaid > 0 && totalPaid < inv.amount) return "Partial";
  return "Pending";
}

const granularStyle: Record<GranularStatus, { bg: string; fg: string }> = {
  Paid:    { bg: "#DCFCE7", fg: "#15803D" },
  Partial: { bg: "#DBEAFE", fg: "#1D4ED8" },
  Pending: { bg: "#FEF3C7", fg: "#B45309" },
  Overdue: { bg: "#FEE2E2", fg: "#C8102E" },
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

const seedPayments: Record<string, PaymentEntry[]> = {
  "i4": [
    { id: "pe1", date: "Apr 10, 2026", amount: 23400, method: "BDO Bank Transfer", ref: "BDO-2026-04100" },
  ],
  "i5": [],
};

export function Accounting() {
  const [rows, setRows] = useState<Invoice[]>(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [payments, setPayments] = useState<Record<string, PaymentEntry[]>>(seedPayments);
  const [newPmt, setNewPmt] = useState<Record<string, { amount: string; method: string; ref: string; datePaid: string }>>({});
  const [viewReceiptsId, setViewReceiptsId] = useState<string | null>(null);
  const [view, setView] = useState<"active" | "history">("active");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingReceipt, setEditingReceipt] = useState<{ invoiceId: string; receipt: PaymentEntry } | null>(null);
  const { byClient, markPOCleared, confirmClientPayment } = useOrders();
  const { push: pushNotif } = useNotifications();
  const [showOverdueModal, setShowOverdueModal] = useState(false);

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
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "paid", payment: "Cleared" } : r)));
    markPOCleared(inv.po); /* sync → auto-removes from Logistics active */
    pushNotif({
      dept: "payments",
      title: `Payment cleared: ${inv.inv}`,
      body: `${inv.client} · ₱${inv.amount.toLocaleString("en-PH")} · fully settled`,
      link: "accounting",
      recipients: ["owner", "operations", "sales"],
    });
    setOpenId(null);
    toast.success("Account cleared", { description: `${inv.client} · ${inv.inv} fully settled · Removed from Logistics active queue` });
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
              ? "Order-to-cash billing — COD · 15-Day Terms · 30-Day Terms"
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
                const isPending = r.status === "pending";
                return (
                  <Fragment key={r.id}>
                    <tr
                      className="border-t border-slate-200/70 hover:bg-slate-50 transition-colors"
                      style={{ cursor: isPending ? "pointer" : "default" }}
                      onClick={() => isPending && setOpenId(isOpen ? null : r.id)}
                    >
                      <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, color: "#475569" }}>{r.date}</td>
                      <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}>{r.inv}</td>
                      <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, color: "#475569" }}>{r.po}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{r.client}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{r.item}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>₱{r.amount.toLocaleString("en-PH")}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{r.payment}</td>
                      <td className="px-4 py-3"><StatusPill status={granularStatus(r, (payments[r.id] ?? []).reduce((s, p) => s + p.amount, 0))} /></td>
                    </tr>
                    {isOpen && isPending && (() => {
                      const pmts = payments[r.id] ?? [];
                      const totalPaid = pmts.reduce((s, p) => s + p.amount, 0);
                      const remaining = r.amount - totalPaid;
                      const pf = newPmt[r.id] ?? { amount: "", method: "", ref: "", datePaid: "" };
                      const clientInquiries = byClient(r.client);
                      const clientReceipts = clientInquiries.flatMap(i => i.clientPaymentReceipts ?? []);
                      const dd = overdueDueDates[r.id];
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
                                        className="font-dm flex items-center gap-1 px-2 py-1 rounded-md border border-blue-200 hover:bg-blue-100"
                                        style={{ fontSize: 11, fontWeight: 600, color: "#2563EB" }}
                                        onClick={() => toast.info(`Viewing: ${cr.filename}`, { description: "In production, this opens the uploaded file" })}
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
                Review pending invoices below. Click "Send Reminder" to notify the client via email/SMS.
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
