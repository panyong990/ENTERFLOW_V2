import { Fragment, useMemo, useState } from "react";
import { Search, Download, FileText, ChevronDown, ChevronUp, Camera, X, ArrowLeft, History } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useOrders } from "../store/orders";
import { useNotifications } from "../store/notifications";
import { NotificationBell } from "./NotificationBell";

type Status = "pending" | "delivered";

const statusStyle: Record<Status, { bg: string; fg: string; label: string }> = {
  pending: { bg: "#E2E8F0", fg: "#475569", label: "Pending Delivery" },
  delivered: { bg: "#DBEAFE", fg: "#1D4ED8", label: "Delivered" },
};

interface Row {
  id: string;
  date: string;
  po: string;
  si: string;
  dr: string;
  customer: string;
  item: string;
  qty: number;
  amount: number;
  status: Status;
  delivery?: string;
}

const initial: Row[] = [
  { id: "r1", date: "2026-03-31", po: "PO-2026-9901", si: "SI-2026-9901", dr: "DR-2026-0901", customer: "B.E. Aerospace", item: "Air Filter 115×103×500mm", qty: 50, amount: 78000, status: "delivered" },
  { id: "r2", date: "2026-03-31", po: "PO-2026-9531", si: "SI-2026-9531", dr: "DR-2026-9531", customer: "Maynilad", item: "Pleated Filter ZS20", qty: 100, amount: 50040, status: "delivered" },
  { id: "r3", date: "2026-03-30", po: "PO-2026-9533", si: "SI-2026-9533", dr: "DR-2026-9533", customer: "Maynilad", item: "Pleated Filter 5-Micron", qty: 100, amount: 46800, status: "delivered" },
  { id: "r4", date: "2026-02-28", po: "PO-2026-9805", si: "SI-2026-9805", dr: "DR-2026-9805", customer: "B.E. Aerospace", item: "Oil Separator Filter", qty: 20, amount: 45000, status: "delivered" },
  { id: "r5", date: "2026-04-10", po: "PO-2026-0418", si: "SI-2026-0418", dr: "—", customer: "B.E. Aerospace", item: "Air Filter KF-OS.107", qty: 30, amount: 46800, status: "pending" },
  { id: "r6", date: "2026-04-12", po: "PO-2026-0421", si: "SI-2026-0421", dr: "—", customer: "G.U. Engineering", item: "Oil Separator Filter", qty: 30, amount: 67500, status: "pending" },
];

function DeliveryPicker({ rowId }: { rowId: string }) {
  const [method, setMethod] = useState("Lalamove");
  const [link, setLink] = useState("");
  const methods = [
    { id: "Lalamove",        help: "Local · urgent" },
    { id: "AP Cargo",        help: "Cagayan / Isabela / N. provinces" },
    { id: "Fast Cargo",      help: "Davao / Mindanao / S. provinces" },
    { id: "Company Vehicle", help: "Batangas / Laguna / nearby" },
    { id: "Client Pick-up",  help: "Customer collects" },
  ];
  return (
    <div className="flex flex-col gap-2">
      {methods.map((opt) => (
        <label key={opt.id} className="flex items-center gap-2 font-dm" style={{ fontSize: 13, color: "#0F172A" }}>
          <input type="radio" name={`delivery-${rowId}`} checked={method === opt.id} onChange={() => setMethod(opt.id)} style={{ accentColor: "#C8102E" }} />
          <span style={{ fontWeight: 600 }}>{opt.id}</span>
          <span style={{ color: "#94A3B8", fontSize: 11 }}>· {opt.help}</span>
        </label>
      ))}
      {method === "Lalamove" && (
        <div className="mt-1 rounded-md p-3" style={{ backgroundColor: "#F5F3FF", border: "1px solid #DDD6FE" }}>
          <label className="font-dm flex items-center gap-1 mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "#6D28D9", letterSpacing: 0.4, textTransform: "uppercase" }}>🚚 Lalamove Tracking Link</label>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://share.lalamove.com/..." className="w-full font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-purple-400 bg-white" style={{ fontSize: 12 }} />
          <p className="font-dm mt-1.5" style={{ fontSize: 11, color: "#7C3AED" }}>Paste the share link so the client can track in real time.</p>
        </div>
      )}
      {(method === "AP Cargo" || method === "Fast Cargo") && (
        <div className="mt-1 rounded-md p-3" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
          <label className="font-dm flex items-center gap-1 mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "#92400E", letterSpacing: 0.4, textTransform: "uppercase" }}>📦 {method} Waybill Number</label>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="e.g. APC-2026-04823" className="w-full font-mono-jb px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-amber-500 bg-white" style={{ fontSize: 12 }} />
        </div>
      )}
      {method === "Company Vehicle" && (
        <div className="mt-1 rounded-md p-3" style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
          <label className="font-dm flex items-center gap-1 mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "#1E40AF", letterSpacing: 0.4, textTransform: "uppercase" }}>🚐 Driver / ETA</label>
          <input placeholder="Driver name · ETA" className="w-full font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-blue-400 bg-white" style={{ fontSize: 12 }} />
        </div>
      )}
      {method === "Client Pick-up" && (
        <div className="mt-1 rounded-md p-3" style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0" }}>
          <div className="font-dm" style={{ fontSize: 11, color: "#166534", fontWeight: 600 }}>📍 #25 EDSA, Cubao, Quezon City</div>
          <div className="font-dm" style={{ fontSize: 11, color: "#15803D" }}>Mon–Sat · 8:00 AM – 5:00 PM</div>
        </div>
      )}
    </div>
  );
}

export function Logistics() {
  const [rows, setRows] = useState<Row[]>(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"active" | "history">("active");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { clearedPOs, completedJOs, markDelivered } = useOrders();
  const { push: pushNotif } = useNotifications();

  /* Active = pending and PO not yet cleared by Accounting. History = delivered + paid. */
  const activeRows = rows.filter((r) => r.status === "pending" && !clearedPOs.includes(r.po));
  const historyRows = rows.filter((r) => r.status === "delivered" || clearedPOs.includes(r.po));

  const visible = useMemo(
    () => {
      const source = view === "active" ? activeRows : historyRows;
      return source.filter((r) => {
        const statusOk = filter === "all" || r.status === filter;
        const searchOk = query === "" ||
          r.po.toLowerCase().includes(query.toLowerCase()) ||
          r.customer.toLowerCase().includes(query.toLowerCase());
        const fromOk = !dateFrom || r.date >= dateFrom;
        const toOk = !dateTo || r.date <= dateTo;
        return statusOk && searchOk && fromOk && toOk;
      });
    },
    [rows, filter, query, view, dateFrom, dateTo, activeRows, historyRows]
  );

  const counts = useMemo(() => ({
    billed: rows.reduce((s, r) => s + r.amount, 0),
    pending: activeRows.length,
    delivered: historyRows.length,
  }), [rows]);

  const setStatus = (id: string, status: Status) => {
    const inv = rows.find(r => r.id === id);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    if (status === "delivered" && inv) {
      /* Sync to orders store: mark inquiry as delivered, generate invoice */
      const matchInquiry = completedJOs.find(c => c.poFileName?.includes(inv.po) || c.poFileName === inv.po);
      if (matchInquiry) {
        markDelivered(
          matchInquiry.id,
          new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          inv.si,
          inv.amount,
        );
      }
      toast.success("Status: Delivered", { description: "Payments Ledger ingested · Terms clock starts now" });
      pushNotif({
        dept: "payments",
        title: `Delivery confirmed: ${inv.po}`,
        body: `${inv.customer} · ₱${inv.amount.toLocaleString("en-PH")} · invoice ${inv.si} · payment terms clock starts now`,
        link: "accounting",
        recipients: ["owner", "operations", "accounting"],
      });
    }
  };

  return (
    <div className="flex-1 h-full overflow-auto" style={{ backgroundColor: "#F4F6F9" }}>
      <Toaster position="bottom-right" richColors />

      <header className="bg-white border-b border-slate-200/70 px-8 py-5 sticky top-0 z-10 flex items-start justify-between">
        <div>
          {view === "history" && (
            <button onClick={() => setView("active")} className="font-dm flex items-center gap-1 hover:underline mb-1" style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>
              ← Back to active
            </button>
          )}
          <h1 className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>
            {view === "active" ? "Logistics" : "Delivered & Paid History"}
          </h1>
          <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>
            {view === "active"
              ? "Delivery tracking — Company Vehicle · Lalamove · AP Cargo · Fast Cargo · Client Pick-up"
              : "Read-only history of completed deliveries"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {view === "active" && (
            <button
              onClick={() => setView("history")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white font-dm hover:bg-slate-50"
              style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}
            >
              <History size={14} /> View Delivered & Paid History →
            </button>
          )}
          <NotificationBell />
        </div>
      </header>

      <div className="px-8 py-8 flex flex-col gap-6">
        {/* Summary pills (no Delivered filter — that's in History) */}
        {view === "active" && (
          <div className="flex items-center gap-2 border-b border-slate-200">
            <button
              onClick={() => setFilter("all")}
              className="font-dm px-4 py-2.5 transition-colors"
              style={{
                fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
                borderBottom: filter === "all" ? "3px solid #1A2B4A" : "3px solid transparent",
                color: filter === "all" ? "#1A2B4A" : "#64748B",
                marginBottom: -1,
              }}
            >
              S · TOTAL BILLED — ₱{counts.billed.toLocaleString("en-PH")}
            </button>
            <button
              onClick={() => setFilter("pending")}
              className="font-dm px-4 py-2.5 transition-colors flex items-center gap-2"
              style={{
                fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
                borderBottom: filter === "pending" ? "3px solid #D97706" : "3px solid transparent",
                color: filter === "pending" ? "#D97706" : "#64748B",
                marginBottom: -1,
              }}
            >
              PENDING <span className="font-syne px-2 py-0.5 rounded-full text-white" style={{ fontSize: 10, backgroundColor: "#D97706" }}>{counts.pending}</span>
            </button>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search PO or customer..."
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
            </>
          )}
          <button
            onClick={() => toast.success("Export started", { description: `Generating ${view === "history" ? "history" : "active"} CSV · ${visible.length} rows` })}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 bg-white font-dm hover:bg-slate-50"
            style={{ borderColor: "#1A2B4A", color: "#1A2B4A", fontSize: 13, fontWeight: 600 }}
          >
            <Download size={14} strokeWidth={2.5} /> Export {view === "history" ? "History CSV" : "CSV"}
          </button>
        </div>

        {/* History note */}
        {view === "history" && (
          <div className="rounded-lg p-3 flex items-center gap-2 font-dm" style={{ fontSize: 12, color: "#1E40AF", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
            <History size={14} /> Read-only — these orders were both delivered and fully paid. Auto-removed from active table.
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
          <table className="w-full">
            <thead style={{ backgroundColor: "#F4F6F9" }}>
              <tr>
                {["Date", "PO No.", "SI No.", "DR No.", "Customer", "Item", "Qty", "Amount", "Status", ""].map((h) => (
                  <th key={h} className="font-dm text-left px-4 py-3" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const isOpen = openId === r.id;
                const s = statusStyle[r.status];
                return (
                  <Fragment key={r.id}>
                    <tr className="border-t border-slate-200/70 hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, color: "#475569" }}>{r.date}</td>
                      <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}>{r.po}</td>
                      <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, color: "#475569" }}>{r.si}</td>
                      <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, color: "#475569" }}>{r.dr}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{r.customer}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{r.item}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{r.qty}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>₱{r.amount.toLocaleString("en-PH")}</td>
                      <td className="px-4 py-3">
                        <select
                          value={r.status}
                          onChange={(e) => setStatus(r.id, e.target.value as Status)}
                          className="font-dm rounded-full px-3 py-1 outline-none cursor-pointer"
                          style={{ fontSize: 11, fontWeight: 600, backgroundColor: s.bg, color: s.fg, border: "none" }}
                        >
                          <option value="pending">Pending Delivery</option>
                          <option value="delivered">Delivered</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setOpenId(isOpen ? null : r.id)}
                          aria-label={isOpen ? "Collapse row" : "Expand row"}
                          className="w-7 h-7 rounded-md hover:bg-slate-100 flex items-center justify-center"
                        >
                          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr style={{ backgroundColor: "#FAFBFC" }}>
                        <td colSpan={10} className="px-6 py-5">
                          <div className="grid gap-6" style={{ gridTemplateColumns: "1.2fr 1fr 1fr" }}>
                            <div>
                              <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Delivery Method</div>
                              <DeliveryPicker rowId={r.id} />
                            </div>
                            <div>
                              <div className="font-dm mb-2 flex items-center gap-1" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>
                                Signed DR Photo {r.status === "pending" && <span className="font-dm ml-1 px-1.5 py-0.5 rounded-full" style={{ fontSize: 9, fontWeight: 700, backgroundColor: "#FEE2E2", color: "#C8102E", letterSpacing: 0.3, textTransform: "none" }}>triggers Delivered</span>}
                              </div>
                              <label className="block w-full h-32 rounded-lg border-2 border-dashed cursor-pointer hover:bg-white flex flex-col items-center justify-center gap-1 font-dm transition-colors"
                                style={{ borderColor: r.status === "delivered" ? "#16A34A" : "#CBD5E1", color: r.status === "delivered" ? "#16A34A" : "#64748B", fontSize: 12 }}>
                                <input
                                  type="file"
                                  accept="image/*,.pdf"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (!f) return;
                                    /* Upload triggers Delivered */
                                    setStatus(r.id, "delivered");
                                    toast.success(`Signed DR uploaded · ${f.name}`, { description: "Status → Delivered · Payments Ledger ingested" });
                                    e.currentTarget.value = "";
                                  }}
                                />
                                {r.status === "delivered" ? (
                                  <>
                                    <CheckCircle2 size={20} />
                                    <span style={{ fontWeight: 700 }}>Signed DR on file</span>
                                    <span className="font-dm" style={{ fontSize: 10 }}>Click to replace</span>
                                  </>
                                ) : (
                                  <>
                                    <Camera size={20} />
                                    <span>Upload signed DR photo</span>
                                    <span className="font-dm" style={{ fontSize: 10 }}>Marks order as Delivered</span>
                                  </>
                                )}
                              </label>
                            </div>
                            <div>
                              <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Notes</div>
                              <textarea
                                placeholder="Add delivery or payment notes..."
                                className="w-full h-24 rounded-lg border border-slate-300 p-3 outline-none focus:border-slate-400 font-dm resize-none bg-white"
                                style={{ fontSize: 13 }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
