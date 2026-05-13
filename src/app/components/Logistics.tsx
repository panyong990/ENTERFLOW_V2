import { useMemo, useState } from "react";
import { Search, Download, ChevronRight, Camera, X, History, CheckCircle2, Send, Truck } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useOrders, type Inquiry } from "../store/orders";
import { useNotifications } from "../store/notifications";
import { NotificationBell } from "./NotificationBell";

type Status = "pending" | "dr_uploaded" | "delivered";

const statusStyle: Record<Status, { bg: string; fg: string; label: string }> = {
  pending:    { bg: "#E2E8F0", fg: "#475569", label: "Pending Delivery" },
  dr_uploaded:{ bg: "#FEF3C7", fg: "#B45309", label: "DR Uploaded" },
  delivered:  { bg: "#DBEAFE", fg: "#1D4ED8", label: "Delivered" },
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
  statusBg: string;
  statusFg: string;
  statusLabel: string;
  delivery?: string;
  trackingRef?: string;
  drFileName?: string;
  isReplacement?: boolean;
  inq: Inquiry;
}

function inquiryToRow(inq: Inquiry): Row {
  /* Both ready_for_dispatch and dispatched belong to the active Logistics queue:
     • ready_for_dispatch → waiting to be picked up
     • dispatched         → waybill scanned, courier en route — driver/proof still needs to come back */
  const isDispatch = inq.stage === "ready_for_dispatch" || inq.stage === "dispatched";
  const status: Status = isDispatch
    ? (inq.drFileName ? "dr_uploaded" : "pending")
    : "delivered";
  const s = statusStyle[status];
  return {
    id: inq.id,
    date: isDispatch ? inq.submittedDate : (inq.deliveredDate ?? inq.submittedDate),
    po: inq.poFileName?.replace(/\.\w+$/, "") ?? `PO-${inq.code}`,
    si: inq.invoiceNo ?? "—",
    dr: inq.drFileName ? `DR-${inq.code.replace("INQ-", "")}` : "—",
    customer: inq.clientName,
    item: inq.products[0]?.type ?? "—",
    qty: inq.products.reduce((s, p) => s + p.qty, 0),
    amount: inq.invoiceAmount ?? inq.quotedTotal ?? 0,
    status,
    statusBg: s.bg,
    statusFg: s.fg,
    statusLabel: s.label,
    delivery: inq.deliveryMethod,
    trackingRef: inq.trackingRef,
    drFileName: inq.drFileName,
    isReplacement: inq.isReplacement,
    inq,
  };
}

/* Delivery method picker */
function DeliveryPicker({
  rowId,
  initialMethod,
  initialLink,
  onChange,
}: {
  rowId: string;
  initialMethod?: string;
  initialLink?: string;
  onChange?: (method: string, link: string) => void;
}) {
  const [method, setMethod] = useState(initialMethod ?? "Lalamove");
  const [link, setLink] = useState(initialLink ?? "");
  const methods = [
    { id: "Lalamove",        help: "Local · urgent" },
    { id: "AP Cargo",        help: "Cagayan / Isabela / N. provinces" },
    { id: "Fast Cargo",      help: "Davao / Mindanao / S. provinces" },
    { id: "Company Vehicle", help: "Batangas / Laguna / nearby" },
    { id: "Client Pick-up",  help: "Customer collects" },
  ];

  const setM = (m: string) => { setMethod(m); onChange?.(m, link); };
  const setL = (l: string) => { setLink(l); onChange?.(method, l); };

  return (
    <div className="flex flex-col gap-2">
      {methods.map((opt) => (
        <label key={opt.id} className="flex items-center gap-2 font-dm" style={{ fontSize: 13, color: "#0F172A" }}>
          <input type="radio" name={`delivery-${rowId}`} checked={method === opt.id} onChange={() => setM(opt.id)} style={{ accentColor: "#C8102E" }} />
          <span style={{ fontWeight: 600 }}>{opt.id}</span>
          <span style={{ color: "#94A3B8", fontSize: 11 }}>· {opt.help}</span>
        </label>
      ))}
      {method === "Lalamove" && (
        <div className="mt-1 rounded-md p-3" style={{ backgroundColor: "#F5F3FF", border: "1px solid #DDD6FE" }}>
          <label className="font-dm flex items-center gap-1 mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "#6D28D9", letterSpacing: 0.4, textTransform: "uppercase" }}>🚚 Lalamove Tracking Link</label>
          <input value={link} onChange={(e) => setL(e.target.value)} placeholder="https://share.lalamove.com/..." className="w-full font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-purple-400 bg-white" style={{ fontSize: 12 }} />
          <p className="font-dm mt-1.5" style={{ fontSize: 11, color: "#7C3AED" }}>Paste the share link so the client can track in real time.</p>
        </div>
      )}
      {(method === "AP Cargo" || method === "Fast Cargo") && (
        <div className="mt-1 rounded-md p-3" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
          <label className="font-dm flex items-center gap-1 mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "#92400E", letterSpacing: 0.4, textTransform: "uppercase" }}>📦 {method} Waybill Number</label>
          <input value={link} onChange={(e) => setL(e.target.value)} placeholder="e.g. APC-2026-04823" className="w-full font-mono-jb px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-amber-500 bg-white" style={{ fontSize: 12 }} />
        </div>
      )}
      {method === "Company Vehicle" && (
        <div className="mt-1 rounded-md p-3" style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
          <label className="font-dm flex items-center gap-1 mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "#1E40AF", letterSpacing: 0.4, textTransform: "uppercase" }}>🚗 Driver / ETA</label>
          <input value={link} onChange={(e) => setL(e.target.value)} placeholder="Driver name · ETA" className="w-full font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-blue-400 bg-white" style={{ fontSize: 12 }} />
        </div>
      )}
      {method === "Client Pick-up" && (
        <div className="mt-1 rounded-md p-3" style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0" }}>
          <div className="font-dm" style={{ fontSize: 11, color: "#166534", fontWeight: 600 }}>📍 Sitio Hulo, Brgy. Balasing – San Jose Rd, Santa Maria, Bulacan</div>
          <div className="font-dm" style={{ fontSize: 11, color: "#15803D" }}>Mon–Fri · 8:00 AM – 6:00 PM</div>
        </div>
      )}
    </div>
  );
}

/* Full-screen detail modal */
function DeliveryDetailModal({
  row,
  onClose,
  onUploadDR,
  onMarkDelivered,
  onSendToClient,
  onMethodChange,
}: {
  row: Row;
  onClose: () => void;
  onUploadDR: (id: string, fileName: string) => void;
  onMarkDelivered: (id: string) => void;
  onSendToClient: (id: string) => void;
  onMethodChange: (method: string, link: string) => void;
}) {
  const isDelivered = row.status === "delivered";
  const drUploaded = !!row.drFileName;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center" style={{ backgroundColor: "rgba(15,23,42,0.6)" }}>
      <div className="bg-white w-full h-full overflow-auto" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <header className="bg-white border-b border-slate-200/70 px-8 py-5 sticky top-0 z-10 flex items-center justify-between">
          <div>
            <button onClick={onClose} className="font-dm flex items-center gap-1 hover:underline mb-1" style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>
              ← Back to Logistics
            </button>
            <h1 className="font-syne" style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>
              Delivery Detail — {row.po}
            </h1>
            <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>
              {row.customer} · {row.item} · {row.qty} pcs · ₱{row.amount.toLocaleString("en-PH")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Status pill */}
            <span className="font-dm px-2.5 py-1 rounded-full" style={{ fontSize: 11, fontWeight: 600, backgroundColor: row.statusBg, color: row.statusFg }}>
              {row.statusLabel}
            </span>

            {/* Mark as Delivered — only visible once DR is uploaded */}
            {!isDelivered && drUploaded && (
              <button
                onClick={() => onMarkDelivered(row.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-dm hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "#1A2B4A", color: "#fff", fontSize: 12, fontWeight: 700 }}
              >
                <Truck size={13} strokeWidth={2.5} />
                Mark as Delivered
              </button>
            )}

            <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-md border border-slate-200 hover:bg-slate-100 flex items-center justify-center">
              <X size={16} />
            </button>
          </div>
        </header>

        {/* ── DR Upload hint banner (shows only when no DR yet) ── */}
        {!isDelivered && !drUploaded && (
          <div className="mx-8 mt-5 rounded-lg px-4 py-3 flex items-center gap-3 font-dm" style={{ backgroundColor: "#FEF3C7", border: "1px solid #FDE68A", fontSize: 12, color: "#92400E" }}>
            <Camera size={14} />
            <span>Upload a signed DR photo below to enable the <strong>Mark as Delivered</strong> button.</span>
          </div>
        )}

        <div className="px-8 py-8 grid gap-6" style={{ gridTemplateColumns: "1.2fr 1fr 1fr" }}>

          {/* ── Delivery Method + Tracking ── */}
          <div className="bg-white rounded-xl border border-slate-200/70 p-5" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
            <div className="font-dm mb-3" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Delivery Method</div>
            <DeliveryPicker
              rowId={row.id}
              initialMethod={row.delivery ?? "Lalamove"}
              initialLink={row.trackingRef ?? ""}
              onChange={onMethodChange}
            />
            {row.trackingRef && (
              <div className="mt-4 rounded-md p-3" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                <div className="font-dm mb-1" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Saved Tracking Link</div>
                <div className="font-mono-jb break-all" style={{ fontSize: 11, color: "#1A2B4A" }}>{row.trackingRef}</div>
              </div>
            )}

            {/* Send Delivery Details to Client — anchored to delivery method (Figma) */}
            {!isDelivered && (
              <button
                onClick={() => onSendToClient(row.id)}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-dm hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "#16A34A", color: "#fff", fontSize: 12, fontWeight: 700 }}
              >
                <Send size={13} strokeWidth={2.5} />
                Send Delivery Details to Client
              </button>
            )}
          </div>

          {/* ── Signed DR Upload ── */}
          <div className="bg-white rounded-xl border border-slate-200/70 p-5" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
            <div className="font-dm mb-1 flex items-center gap-2" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>
              Signed DR / Proof Photo
              {drUploaded && (
                <span className="font-dm px-1.5 py-0.5 rounded-full" style={{ fontSize: 9, fontWeight: 700, backgroundColor: "#FEF3C7", color: "#B45309", letterSpacing: 0.3, textTransform: "none" }}>
                  DR Uploaded
                </span>
              )}
            </div>
            <p className="font-dm mb-3" style={{ fontSize: 11, color: "#94A3B8" }}>
              Uploading the signed DR changes status to <strong>DR Uploaded</strong> only. Use <strong>Mark as Delivered</strong> to finalize.
            </p>
            <label
              className="block w-full h-36 rounded-lg border-2 border-dashed cursor-pointer hover:bg-slate-50 flex flex-col items-center justify-center gap-1.5 font-dm transition-colors"
              style={{
                borderColor: drUploaded ? "#16A34A" : "#CBD5E1",
                color: drUploaded ? "#16A34A" : "#64748B",
                fontSize: 12,
                pointerEvents: isDelivered ? "none" : "auto",
              }}
            >
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                disabled={isDelivered}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  onUploadDR(row.id, f.name);
                  toast.success(`DR uploaded — ${f.name}`, { description: "Status: DR Uploaded. Use the Mark as Delivered button when ready." });
                  e.currentTarget.value = "";
                }}
              />
              {drUploaded ? (
                <>
                  <CheckCircle2 size={22} />
                  <span style={{ fontWeight: 700 }}>Signed DR on file</span>
                  <span className="font-dm" style={{ fontSize: 10 }}>{row.drFileName} · Click to replace</span>
                </>
              ) : (
                <>
                  <Camera size={22} />
                  <span style={{ fontWeight: 600 }}>Upload signed DR photo</span>
                  <span className="font-dm" style={{ fontSize: 10 }}>PNG, JPG or PDF</span>
                </>
              )}
            </label>

            {/* Mark as Delivered inline button (inside DR card, secondary reference) */}
            {!isDelivered && drUploaded && (
              <button
                onClick={() => onMarkDelivered(row.id)}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-dm hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "#1A2B4A", color: "#fff", fontSize: 12, fontWeight: 700 }}
              >
                <Truck size={13} strokeWidth={2.5} />
                Mark as Delivered
              </button>
            )}
          </div>

          {/* ── Notes ── */}
          <div className="bg-white rounded-xl border border-slate-200/70 p-5" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
            <div className="font-dm mb-3" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Notes</div>
            <textarea
              placeholder="Add delivery or payment notes..."
              className="w-full h-40 rounded-lg border border-slate-300 p-3 outline-none focus:border-slate-400 font-dm resize-none bg-white"
              style={{ fontSize: 13 }}
            />
          </div>
        </div>

        {/* ── Order Summary (bottom strip) ── */}
        <div className="mx-8 mb-8 rounded-xl border border-slate-200/70 bg-white p-5" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
          <div className="font-dm mb-3" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Order Summary</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(6,1fr)" }}>
            {[
              { label: "PO No.", value: row.po },
              { label: "SI No.", value: row.si },
              { label: "DR No.", value: row.dr },
              { label: "Customer", value: row.customer },
              { label: "Items", value: `${row.qty} pcs` },
              { label: "Amount", value: `₱${row.amount.toLocaleString("en-PH")}` },
            ].map((f) => (
              <div key={f.label}>
                <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: 0.4, textTransform: "uppercase" }}>{f.label}</div>
                <div className="font-dm mt-0.5" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Logistics() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"active" | "history">("active");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { inquiriesByStage, updateInquiry, markDelivered } = useOrders();
  const { push: pushNotif } = useNotifications();

  const activeInquiries = useMemo(() => inquiriesByStage(["ready_for_dispatch", "dispatched"]), [inquiriesByStage]);
  const historyInquiries = useMemo(() => inquiriesByStage(["delivered", "paid", "overdue"]), [inquiriesByStage]);
  const rows = useMemo(() => [...activeInquiries, ...historyInquiries].map(inquiryToRow), [activeInquiries, historyInquiries]);
  const activeRows = useMemo(() => rows.filter((r) => r.status === "pending" || r.status === "dr_uploaded"), [rows]);
  const historyRows = useMemo(() => rows.filter((r) => r.status === "delivered"), [rows]);

  const visible = useMemo(() => {
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
  }, [filter, query, view, dateFrom, dateTo, activeRows, historyRows]);

  const counts = useMemo(() => ({
    billed: rows.reduce((s, r) => s + r.amount, 0),
    pending: activeRows.filter(r => r.status === "pending").length,
    drUploaded: activeRows.filter(r => r.status === "dr_uploaded").length,
    delivered: historyRows.length,
  }), [rows, activeRows, historyRows]);

  const [methodDrafts, setMethodDrafts] = useState<Record<string, { method: string; link: string }>>({});

  /* Upload DR → status becomes "DR Uploaded" (NOT delivered) */
  const handleUploadDR = (id: string, fileName: string) => {
    updateInquiry(id, {
      drFileName: fileName,
      drUploadedAt: new Date().toISOString(),
    });
  };

  /* Mark as Delivered — only callable after DR is uploaded */
  const handleMarkDelivered = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row || !row.drFileName) return; // guard: DR must be uploaded first
    const invoiceNo = `SI-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    markDelivered(id, today, invoiceNo, row.amount);
    const draft = methodDrafts[id];
    const trackingRef = draft?.link || row.trackingRef;
    const deliveryMethod = (draft?.method || row.delivery) as Inquiry["deliveryMethod"];
    const patch: Partial<Inquiry> = {};
    if (trackingRef) patch.trackingRef = trackingRef;
    if (deliveryMethod) patch.deliveryMethod = deliveryMethod;
    const ts = new Date().toISOString();
    patch.waybillLog = [...(row.inq.waybillLog ?? []), { ts, status: "Delivered", note: row.drFileName ?? invoiceNo }];
    updateInquiry(id, patch);
    toast.success("Status: Delivered", { description: "Payments Ledger updated · Terms clock starts now" });
    pushNotif({
      dept: "payments",
      title: `Delivery confirmed: ${row.po}`,
      body: `${row.customer} · ₱${row.amount.toLocaleString("en-PH")} · invoice ${invoiceNo} · payment terms clock starts now`,
      link: "accounting",
      recipients: ["owner", "operations", "accounting"],
    });
    setOpenId(null);
  };

  /* Send tracking info to client */
  const handleSendToClient = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const draft = methodDrafts[id];
    const method = draft?.method || row.delivery || "—";
    const link = draft?.link || row.trackingRef || "";
    pushNotif({
      dept: "operations",
      title: `Delivery details shared: ${row.po}`,
      body: `${row.customer} · via ${method}${link ? ` · ${link}` : ""}`,
      link: "client-portal",
      recipients: ["client"],
    });
    toast.success("Delivery details sent to client!", {
      description: `Method: ${method}${link ? ` · ${link}` : ""}`,
    });
  };

  const onMethodChange = (id: string) => (method: string, link: string) => {
    setMethodDrafts((prev) => ({ ...prev, [id]: { method, link } }));
    const patch: Partial<Inquiry> = { deliveryMethod: method as Inquiry["deliveryMethod"] };
    if (link) patch.trackingRef = link;
    updateInquiry(id, patch);
  };

  const openRow = rows.find((r) => r.id === openId);

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
            {view === "active" ? "Logistics" : "Delivered History"}
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
              <History size={14} /> Delivered History →
            </button>
          )}
          <NotificationBell />
        </div>
      </header>

      <div className="px-8 py-8 flex flex-col gap-6">
        {/* Status tabs */}
        {view === "active" && (
          <div className="flex items-center gap-2 border-b border-slate-200">
            {([
              { key: "all",        label: `ALL · ₱${counts.billed.toLocaleString("en-PH")}` },
              { key: "pending",    label: `PENDING · ${counts.pending}` },
              { key: "dr_uploaded",label: `DR UPLOADED · ${counts.drUploaded}` },
            ] as { key: "all" | Status; label: string }[]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className="font-dm px-4 py-2.5 transition-colors"
                style={{
                  fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
                  borderBottom: filter === tab.key ? "3px solid #1A2B4A" : "3px solid transparent",
                  color: filter === tab.key ? "#1A2B4A" : "#64748B",
                  marginBottom: -1,
                }}
              >
                {tab.label}
              </button>
            ))}
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
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="font-dm px-3 py-2.5 rounded-lg border border-slate-200 bg-white outline-none" style={{ fontSize: 13, color: "#0F172A" }} title="From" />
              <span className="font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>→</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="font-dm px-3 py-2.5 rounded-lg border border-slate-200 bg-white outline-none" style={{ fontSize: 13, color: "#0F172A" }} title="To" />
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
                  <th key={h} className="font-dm text-left px-4 py-3" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-t border-slate-200/70 hover:bg-slate-50 cursor-pointer" onClick={() => setOpenId(r.id)}>
                  <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, color: "#475569" }}>{r.date}</td>
                  <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}>{r.po}</td>
                  <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, color: "#475569" }}>{r.si}</td>
                  <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, color: "#475569" }}>{r.dr}</td>
                  <td className="px-4 py-3 font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>
                    {r.customer}
                    {r.isReplacement && (
                      <span className="ml-1.5 font-dm px-1.5 py-0.5 rounded-full" style={{ fontSize: 9, fontWeight: 700, backgroundColor: "#EDE9FE", color: "#7C3AED", verticalAlign: "middle" }}>REPLACEMENT</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{r.item}</td>
                  <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{r.qty}</td>
                  <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>₱{r.amount.toLocaleString("en-PH")}</td>
                  <td className="px-4 py-3">
                    <span className="font-dm px-2.5 py-1 rounded-full" style={{ fontSize: 11, fontWeight: 600, backgroundColor: r.statusBg, color: r.statusFg }}>
                      {r.statusLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button aria-label="Open delivery detail" className="w-7 h-7 rounded-md hover:bg-slate-100 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); setOpenId(r.id); }}>
                      <ChevronRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>No deliveries match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openRow && (
        <DeliveryDetailModal
          row={openRow}
          onClose={() => setOpenId(null)}
          onUploadDR={handleUploadDR}
          onMarkDelivered={handleMarkDelivered}
          onSendToClient={handleSendToClient}
          onMethodChange={onMethodChange(openRow.id)}
        />
      )}
    </div>
  );
}
