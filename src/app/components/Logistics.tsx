import { useMemo, useState } from "react";
import { Search, Download, ChevronRight, Camera, X, History, CheckCircle2, Send, Truck, Filter } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useOrders, poNumberForDisplay, type Inquiry } from "../store/orders";
import { useNotifications } from "../store/notifications";
import { NotificationBell } from "./NotificationBell";

type Status = "pending" | "delivered";

const statusStyle: Record<Status, { bg: string; fg: string; label: string }> = {
  pending:    { bg: "#E2E8F0", fg: "#475569", label: "Pending Delivery" },
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
  clientSignedDRFileName?: string;
  clientSignedDRUploadedAt?: string;
  paymentCycleStartedAt?: string;
  invoiceDueDate?: string;
  paymentTerms: Inquiry["paymentTerms"];
  isReplacement?: boolean;
  inq: Inquiry;
}

function inquiryToRow(inq: Inquiry): Row {
  /* Both ready_for_dispatch and dispatched belong to the active Logistics queue:
     • ready_for_dispatch → waiting to be picked up
     • dispatched         → waybill scanned, courier en route — driver/proof still needs to come back */
  const isDispatch = inq.stage === "ready_for_dispatch" || inq.stage === "dispatched";
  const status: Status = isDispatch ? "pending" : "delivered";
  const s = statusStyle[status];
  return {
    id: inq.id,
    date: isDispatch ? inq.submittedDate : (inq.deliveredDate ?? inq.submittedDate),
    po: poNumberForDisplay(inq) ?? inq.code,
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
    clientSignedDRFileName: inq.clientSignedDRFileName,
    clientSignedDRUploadedAt: inq.clientSignedDRUploadedAt,
    paymentCycleStartedAt: inq.paymentCycleStartedAt,
    invoiceDueDate: inq.paymentCycleStartedAt ? inq.invoiceDueDate : undefined,
    paymentTerms: inq.paymentTerms,
    isReplacement: inq.isReplacement,
    inq,
  };
}

/* Full-screen detail modal */
function DeliveryDetailModal({
  row,
  onClose,
  onUploadDR,
  onMarkDelivered,
  onSendToClient,
  onTrackingRefChange,
}: {
  row: Row;
  onClose: () => void;
  onUploadDR: (id: string, fileName: string) => void;
  onMarkDelivered: (id: string) => void;
  onSendToClient: (id: string) => void;
  onTrackingRefChange: (id: string, trackingRef: string) => void;
}) {
  const isDelivered = row.status === "delivered";
  const isCompanyVehicle = row.delivery === "Company Vehicle";
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

            {!isDelivered && isCompanyVehicle && (
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
        {!isDelivered && isCompanyVehicle && !drUploaded && (
          <div className="mx-8 mt-5 rounded-lg px-4 py-3 flex items-center gap-3 font-dm" style={{ backgroundColor: "#FEF3C7", border: "1px solid #FDE68A", fontSize: 12, color: "#92400E" }}>
            <Camera size={14} />
            <span>Upload Logistics delivery documentation here. Confirm delivery separately; the client signed DR controls payment-cycle activation.</span>
          </div>
        )}

        <div className="px-8 py-8 grid gap-6" style={{ gridTemplateColumns: "1.2fr 1fr 1fr" }}>

          {/* ── Delivery Method + Tracking ── */}
          <div className="bg-white rounded-xl border border-slate-200/70 p-5" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
            <div className="font-dm mb-3" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Delivery Method</div>
            <div className="font-syne mb-4" style={{ fontSize: 16, fontWeight: 700, color: "#1A2B4A" }}>{row.delivery || "Not selected by Sales"}</div>
            <label className="font-dm block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>
              Tracking / Waybill No.
            </label>
            <input
              value={row.trackingRef ?? ""}
              onChange={(event) => onTrackingRefChange(row.id, event.target.value)}
              placeholder="Enter tracking or waybill number"
              aria-label="Tracking or waybill number"
              className="w-full font-mono-jb px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white"
              style={{ fontSize: 12, color: "#1A2B4A" }}
            />
            {row.trackingRef && (
              <div className="mt-4 rounded-md p-3" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                <div className="font-dm mb-1" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Saved Tracking / Waybill No.</div>
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
              {isCompanyVehicle ? "Signed Delivery Receipt" : "Delivery Proof"}
              {isCompanyVehicle && drUploaded && (
                <span className="font-dm px-1.5 py-0.5 rounded-full" style={{ fontSize: 9, fontWeight: 700, backgroundColor: "#FEF3C7", color: "#B45309", letterSpacing: 0.3, textTransform: "none" }}>
                  Signed DR Uploaded
                </span>
              )}
            </div>
            {isCompanyVehicle ? (
              <>
                <p className="font-dm mb-3" style={{ fontSize: 11, color: "#94A3B8" }}>
                  Logistics may upload its signed DR as delivery documentation. Client confirmation is required separately to start payment terms.
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
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      onUploadDR(row.id, file.name);
                      event.currentTarget.value = "";
                    }}
                  />
                  {drUploaded ? (
                    <>
                      <CheckCircle2 size={22} />
                      <span style={{ fontWeight: 700 }}>Signed DR on file</span>
                      <span className="font-dm" style={{ fontSize: 10 }}>{row.drFileName}</span>
                    </>
                  ) : (
                    <>
                      <Camera size={22} />
                      <span style={{ fontWeight: 600 }}>Upload signed DR photo</span>
                      <span className="font-dm" style={{ fontSize: 10 }}>PNG, JPG or PDF</span>
                    </>
                  )}
                </label>
              </>
            ) : (
              <div className="rounded-lg p-4 font-dm" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", fontSize: 12, color: "#64748B" }}>
                Signed DR upload is available for Company Vehicle deliveries only.
              </div>
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

      </div>
    </div>
  );
}

export function Logistics() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"active" | "history">("active");
  const [activeDateFilter, setActiveDateFilter] = useState<"today" | "7days" | "30days" | "all">("all");
  const [isActiveFilterOpen, setIsActiveFilterOpen] = useState(false);
  const [historyDateFilter, setHistoryDateFilter] = useState<"today" | "7days" | "30days" | "all">("all");
  const [isHistoryFilterOpen, setIsHistoryFilterOpen] = useState(false);

  const { inquiriesByStage, updateInquiry, markDelivered } = useOrders();
  const { push: pushNotif } = useNotifications();

  const activeInquiries = useMemo(
    () => inquiriesByStage(["ready_for_dispatch", "dispatched"]).filter(
      (inquiry) => inquiry.stage === "dispatched" || Boolean(inquiry.waybillPrintedAt)
    ),
    [inquiriesByStage]
  );
  const historyInquiries = useMemo(() => inquiriesByStage(["delivered", "paid", "overdue"]), [inquiriesByStage]);
  const rows = useMemo(() => [...activeInquiries, ...historyInquiries].map(inquiryToRow), [activeInquiries, historyInquiries]);
  const activeRows = useMemo(() => rows.filter((r) => r.status === "pending"), [rows]);
  const historyRows = useMemo(() => rows.filter((r) => r.status === "delivered"), [rows]);

  const visible = useMemo(() => {
    const source = view === "active" ? activeRows : historyRows;
    const searchTerm = query.trim().toLocaleLowerCase();
    const dateFilter = view === "active" ? activeDateFilter : historyDateFilter;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const cutoff = new Date(today);
    if (dateFilter === "7days") cutoff.setDate(cutoff.getDate() - 6);
    if (dateFilter === "30days") cutoff.setDate(cutoff.getDate() - 29);

    return source.filter((r) => {
      const searchableValues = [
        r.inq.joNumber ?? "",
        r.si,
        r.customer,
        r.item,
        r.delivery ?? "",
        ...r.inq.products.flatMap((product) => [product.type, product.filterName ?? ""]),
      ];
      const searchOk = !searchTerm || (view === "history"
        ? searchableValues.some((value) => value.toLocaleLowerCase().includes(searchTerm))
        : (r.inq.joNumber ?? "").toLocaleLowerCase().includes(searchTerm) || r.customer.toLocaleLowerCase().includes(searchTerm));
      const rowDate = new Date(r.date);
      const dateOk = dateFilter === "all" ||
        (!Number.isNaN(rowDate.getTime()) && rowDate >= cutoff && rowDate < tomorrow);
      return searchOk && dateOk;
    });
  }, [query, view, activeDateFilter, historyDateFilter, activeRows, historyRows]);

  /* Logistics documentation is separate from the client's receipt confirmation. */
  const handleUploadDR = (id: string, fileName: string) => {
    const row = rows.find((candidate) => candidate.id === id);
    if (!row || row.delivery !== "Company Vehicle" || row.status === "delivered") {
      toast.error("Signed DR upload is available for active Company Vehicle deliveries only.");
      return;
    }
    updateInquiry(id, {
      drFileName: fileName,
      drUploadedAt: new Date().toISOString(),
    });
    toast.success(`Logistics DR uploaded — ${fileName}`, { description: "Delivery status and payment cycle were not changed." });
  };

  /* Delivery confirmation never activates terms unless a client-signed DR is already recorded. */
  const handleMarkDelivered = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row || row.status === "delivered") return;
    const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    markDelivered(id, today);
    const patch: Partial<Inquiry> = {};
    const ts = new Date().toISOString();
    patch.waybillLog = [...(row.inq.waybillLog ?? []), { ts, status: "Delivered", note: row.trackingRef ?? row.dr }];
    updateInquiry(id, patch);
    const paymentCycleActive = Boolean(row.clientSignedDRUploadedAt);
    toast.success("Delivery status: Delivered", {
      description: paymentCycleActive
        ? `Client receipt confirmed · ${row.paymentTerms} payment term is active from the receipt date.`
        : "Payment terms remain inactive until the client uploads a signed DR.",
    });
    if (paymentCycleActive) {
      pushNotif({
        dept: "payments",
        title: `Payment cycle started: ${row.po}`,
        body: `${row.customer} · ${row.paymentTerms} · due ${row.inq.invoiceDueDate ?? "calculated from client receipt date"}`,
        link: "accounting",
        recipients: ["owner", "operations", "accounting"],
      });
    }
    setOpenId(null);
  };

  /* Send tracking info to client */
  const handleSendToClient = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const method = row.delivery || "—";
    const link = row.trackingRef || "";
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

  const handleTrackingRefChange = (id: string, trackingRef: string) => {
    updateInquiry(id, { trackingRef });
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
        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={view === "history" ? "Search JO, customer, item..." : "Search PO or customer..."}
              className="font-dm w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-slate-400 bg-white"
              style={{ fontSize: 13 }}
            />
          </div>
          {(
            <div className="relative">
              <button
                type="button"
                onClick={() => view === "history"
                  ? setIsHistoryFilterOpen((open) => !open)
                  : setIsActiveFilterOpen((open) => !open)}
                aria-label={`Filter ${view === "history" ? "delivered history" : "logistics deliveries"} by date`}
                aria-expanded={view === "history" ? isHistoryFilterOpen : isActiveFilterOpen}
                className="font-dm flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                style={{ color: (view === "history" ? historyDateFilter : activeDateFilter) !== "all" ? "#1A2B4A" : "#64748B" }}
              >
                <Filter size={15} />
              </button>
              {(view === "history" ? isHistoryFilterOpen : isActiveFilterOpen) && (
                <div role="group" aria-label="Date filter" className="absolute right-0 top-11 z-20 w-40 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
                  {([
                    ["today", "Today"],
                    ["7days", "Last 7 days"],
                    ["30days", "Last 30 days"],
                    ["all", "All"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        if (view === "history") {
                          setHistoryDateFilter(value);
                          setIsHistoryFilterOpen(false);
                        } else {
                          setActiveDateFilter(value);
                          setIsActiveFilterOpen(false);
                        }
                      }}
                      aria-pressed={(view === "history" ? historyDateFilter : activeDateFilter) === value}
                      className="font-dm block w-full rounded-md px-3 py-2 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      style={{ fontSize: 12, fontWeight: (view === "history" ? historyDateFilter : activeDateFilter) === value ? 700 : 500, color: "#0F172A" }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
                {(view === "history"
                  ? ["Date", "JO No.", "SI No.", "Customer", "Item", "Qty", "Delivery Method", "Status"]
                  : ["Date", "JO No.", "SI No.", "Customer", "Item", "Qty", "Amount", "Status", ""]
                ).map((h) => (
                  <th key={h} className="font-dm text-left px-4 py-3" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.id}
                  className={`border-t border-slate-200/70 hover:bg-slate-50${view === "active" ? " cursor-pointer" : ""}`}
                  onClick={view === "active" ? () => setOpenId(r.id) : undefined}
                >
                  <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, color: "#475569" }}>{r.date}</td>
                  <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}>
                    {r.inq.joNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, color: "#475569" }}>{r.si}</td>
                  <td className="px-4 py-3 font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>
                    {r.customer}
                    {r.isReplacement && (
                      <span className="ml-1.5 font-dm px-1.5 py-0.5 rounded-full" style={{ fontSize: 9, fontWeight: 700, backgroundColor: "#EDE9FE", color: "#7C3AED", verticalAlign: "middle" }}>REPLACEMENT</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{r.item}</td>
                  <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{r.qty}</td>
                  {view === "history" ? (
                    <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{r.delivery ?? "—"}</td>
                  ) : (
                    <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>₱{r.amount.toLocaleString("en-PH")}</td>
                  )}
                  <td className="px-4 py-3">
                    <span className="font-dm px-2.5 py-1 rounded-full" style={{ fontSize: 11, fontWeight: 600, backgroundColor: r.statusBg, color: r.statusFg }}>
                      {r.statusLabel}
                    </span>
                  </td>
                  {view === "active" && (
                    <td className="px-4 py-3">
                      <button aria-label="Open delivery detail" className="w-7 h-7 rounded-md hover:bg-slate-100 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); setOpenId(r.id); }}>
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={view === "history" ? 8 : 9} className="px-4 py-8 text-center font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>No deliveries match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {view === "active" && openRow && (
        <DeliveryDetailModal
          row={openRow}
          onClose={() => setOpenId(null)}
          onUploadDR={handleUploadDR}
          onMarkDelivered={handleMarkDelivered}
          onSendToClient={handleSendToClient}
          onTrackingRefChange={handleTrackingRefChange}
        />
      )}
    </div>
  );
}
