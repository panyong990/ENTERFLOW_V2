import { useMemo, useState } from "react";
import { Search, Download, ChevronRight, Camera, History, CheckCircle2, Send, Truck, Filter, ArrowLeft } from "lucide-react";
import { Toaster, toast } from "sonner";
import { PRODUCTION_STAGES, stageColor, stageLabel, useOrders, type Inquiry } from "../store/orders";
import { useNotifications } from "../store/notifications";
import { NotificationBell } from "./NotificationBell";

type Status = "pending" | "delivered";

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
  const statusColors = stageColor[inq.stage];
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
    statusBg: statusColors.bg,
    statusFg: statusColors.fg,
    statusLabel: stageLabel[inq.stage],
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
        <header className="bg-white border-b border-slate-200/70 px-4 py-4 sm:px-8 sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <button onClick={onClose} className="font-dm flex items-center gap-1 hover:underline mb-1" style={{ fontSize: 12, color: "#64748B", fontWeight: 500 }}>
              ← Back to Logistics
            </button>
            <h1 className="font-syne" style={{ fontSize: 24, fontWeight: 650, color: "#0F172A", lineHeight: 1.2 }}>
              Delivery Detail — {row.po}
            </h1>
            <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>
              {row.customer} · {row.item} · {row.qty} pcs · ₱{row.amount.toLocaleString("en-PH")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-dm px-2.5 py-1 rounded-full whitespace-nowrap" style={{ fontSize: 11, fontWeight: 600, backgroundColor: row.statusBg, color: row.statusFg }}>
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

          </div>
        </header>

        {/* ── DR Upload hint banner (shows only when no DR yet) ── */}
        {!isDelivered && isCompanyVehicle && !drUploaded && (
          <div className="mx-4 mt-4 rounded-lg px-4 py-3 flex items-center gap-3 font-dm sm:mx-8" style={{ backgroundColor: "#FEF3C7", border: "1px solid #FDE68A", fontSize: 12, color: "#92400E" }}>
            <Camera size={14} />
            <span>Upload Logistics delivery documentation here. Confirm delivery separately; the client signed DR controls payment-cycle activation.</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 px-4 py-5 md:grid-cols-2 xl:grid-cols-3 sm:px-8 sm:py-6">

          {/* ── Delivery Method + Tracking ── */}
          <div className="bg-white rounded-xl border border-slate-200/70 p-5" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
            <h2 className="font-dm mb-4" style={{ fontSize: 15, fontWeight: 600, color: "#0F172A" }}>Delivery Information</h2>
            <div className="font-dm mb-1" style={{ fontSize: 11, fontWeight: 500, color: "#64748B" }}>Delivery Method</div>
            <div className="font-dm mb-5" style={{ fontSize: 14, fontWeight: 600, color: "#1A2B4A" }}>{row.delivery || "Not selected by Sales"}</div>
            <label className="font-dm block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>
              Tracking / Waybill No.
            </label>
            <input
              value={row.trackingRef ?? ""}
              onChange={(event) => onTrackingRefChange(row.id, event.target.value)}
              placeholder="Enter tracking or waybill number"
              aria-label="Tracking or waybill number"
              className="w-full font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white"
              style={{ fontSize: 13, color: "#1A2B4A" }}
            />
            {row.trackingRef && (
              <div className="mt-4 rounded-md p-3" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                <div className="font-dm mb-1" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Saved Tracking / Waybill No.</div>
                <div className="font-dm break-all" style={{ fontSize: 12, color: "#1A2B4A" }}>{row.trackingRef}</div>
              </div>
            )}

            {/* Send Delivery Details to Client — anchored to delivery method (Figma) */}
            {!isDelivered && (
              <button
                onClick={() => onSendToClient(row.id)}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 font-dm text-slate-700 hover:bg-slate-50 transition-colors"
                style={{ fontSize: 12, fontWeight: 500 }}
              >
                <Send size={13} strokeWidth={2.5} />
                Send Delivery Details to Client
              </button>
            )}
          </div>

          {/* ── Signed DR Upload ── */}
          <div className="bg-white rounded-xl border border-slate-200/70 p-5" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
            <h2 className="font-dm mb-3" style={{ fontSize: 15, fontWeight: 600, color: "#0F172A" }}>
              {isCompanyVehicle ? "Signed Delivery Receipt" : "Delivery Proof"}
            </h2>
            {isCompanyVehicle && drUploaded && (
              <div className="font-dm mb-1 flex items-center gap-2" style={{ fontSize: 11, fontWeight: 500, color: "#64748B" }}>
                <span className="font-dm px-1.5 py-0.5 rounded-full" style={{ fontSize: 9, fontWeight: 700, backgroundColor: "#FEF3C7", color: "#B45309", letterSpacing: 0.3, textTransform: "none" }}>
                  Signed DR Uploaded
                </span>
              </div>
            )}
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
              <div className="rounded-lg p-3 font-dm" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", fontSize: 12, color: "#64748B" }}>
                Signed delivery receipt uploads are not configured for third-party carriers.
              </div>
            )}
          </div>

          {/* ── Notes ── */}
          <div className="bg-white rounded-xl border border-slate-200/70 p-5" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
            <h2 className="font-dm mb-3" style={{ fontSize: 15, fontWeight: 600, color: "#0F172A" }}>Notes</h2>
            <textarea
              placeholder="Add delivery or payment notes..."
              aria-label="Delivery notes"
              className="w-full h-28 rounded-lg border border-slate-300 p-3 outline-none focus:border-slate-400 font-dm resize-y bg-white"
              style={{ fontSize: 13 }}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

export function LogisticsActiveJobs({ onBack }: { onBack: () => void }) {
  const [query, setQuery] = useState("");
  const { inquiriesByStage } = useOrders();
  const activeJobs = useMemo(
    () => inquiriesByStage(["jo", "in_production", "quality_inspection"]),
    [inquiriesByStage]
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleJobs = useMemo(() => activeJobs.filter((inquiry) => {
    if (!normalizedQuery) return true;
    const searchableValues = [
      inquiry.joNumber ?? `JO-${inquiry.code}`,
      inquiry.code,
      inquiry.clientName,
      inquiry.dueDate ?? "",
      stageLabel[inquiry.stage],
      ...inquiry.products.flatMap((product) => [product.type, product.filterName ?? "", product.oem ?? ""]),
    ];
    return searchableValues.some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  }), [activeJobs, normalizedQuery]);

  return (
    <div className="flex-1 h-full overflow-auto" style={{ backgroundColor: "#F4F6F9" }}>
      <header className="bg-white border-b border-slate-200/70 px-4 py-4 sm:px-8 sticky top-0 z-10">
        <button
          onClick={onBack}
          className="font-dm mb-2 inline-flex items-center gap-1.5 hover:underline"
          style={{ fontSize: 12, color: "#64748B", fontWeight: 500 }}
        >
          <ArrowLeft size={14} /> Back to Logistics Dashboard
        </button>
        <h1 className="font-syne" style={{ fontSize: 26, fontWeight: 650, color: "#0F172A", lineHeight: 1.2 }}>
          Active Jobs
        </h1>
        <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>
          Read-only view of active job orders
        </p>
      </header>

      <div className="px-4 py-5 flex flex-col gap-4 sm:px-8 sm:py-6">
        <div className="relative w-full max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search JO, client, or product..."
            aria-label="Search active jobs"
            className="font-dm w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-slate-400 bg-white"
            style={{ fontSize: 13 }}
          />
        </div>

        <div className="bg-white rounded-xl border border-slate-200/70 overflow-x-auto" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
          <table className="w-full min-w-[900px]">
            <thead style={{ backgroundColor: "#F4F6F9" }}>
              <tr>
                {["JO Code", "Client", "Product / Item", "Qty", "Current Stage", "Due Date", "Current Status"].map((heading) => (
                  <th
                    key={heading}
                    className="font-dm text-left px-4 py-3"
                    style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.2, textTransform: "uppercase" }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleJobs.map((inquiry) => {
                const currentStage = inquiry.currentStage === undefined
                  ? stageLabel[inquiry.stage]
                  : PRODUCTION_STAGES[Math.min(inquiry.currentStage, PRODUCTION_STAGES.length - 1)];
                const statusColors = stageColor[inquiry.stage];
                return (
                  <tr key={inquiry.id} className="border-t border-slate-200/70">
                    <td className="px-4 py-3 font-dm whitespace-nowrap" style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}>
                      {inquiry.joNumber ?? `JO-${inquiry.code}`}
                    </td>
                    <td className="px-4 py-3 font-dm" style={{ fontSize: 13, fontWeight: 500, color: "#0F172A" }}>
                      {inquiry.clientName}
                    </td>
                    <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>
                      {inquiry.products.map((product) => product.filterName ?? product.type).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 font-dm whitespace-nowrap" style={{ fontSize: 13, color: "#475569" }}>
                      {inquiry.products.reduce((total, product) => total + product.qty, 0)}
                    </td>
                    <td className="px-4 py-3 font-dm whitespace-nowrap" style={{ fontSize: 13, color: "#475569" }}>
                      {currentStage}
                    </td>
                    <td className="px-4 py-3 font-dm whitespace-nowrap" style={{ fontSize: 13, color: "#475569" }}>
                      {inquiry.dueDate ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="font-dm whitespace-nowrap px-2.5 py-1 rounded-full"
                        style={{ fontSize: 11, fontWeight: 500, backgroundColor: statusColors.bg, color: statusColors.fg }}
                      >
                        {stageLabel[inquiry.stage]}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {visibleJobs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>
                    No active jobs match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
        r.po,
        r.inq.code,
        r.inq.joNumber ?? "",
        r.inq.contactPerson,
        r.inq.contactEmail,
        r.si,
        r.customer,
        r.item,
        r.delivery ?? "",
        r.trackingRef ?? "",
        r.inq.waybillNumber ?? "",
        r.inq.waybillIdentifier ?? "",
        ...r.inq.products.flatMap((product) => [product.type, product.filterName ?? ""]),
      ];
      const searchOk = !searchTerm || searchableValues.some((value) => value.toLocaleLowerCase().includes(searchTerm));
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
    const invoiceNo = `SI-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    markDelivered(id, today, invoiceNo, row.amount);
    const patch: Partial<Inquiry> = {};
    const ts = new Date().toISOString();
    patch.waybillLog = [...(row.inq.waybillLog ?? []), { ts, status: "Delivered", note: row.trackingRef ?? invoiceNo }];
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

  const exportHistoryCsv = () => {
    const csvValue = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const header = ["Date", "JO No.", "SI No.", "Customer", "Item", "Quantity", "Delivery Method", "Status"];
    const lines = [
      header.map(csvValue).join(","),
      ...visible.map((row) => [
        row.date,
        row.inq.joNumber ?? "—",
        row.si,
        row.customer,
        row.item,
        row.qty,
        row.delivery ?? "—",
        row.statusLabel,
      ].map(csvValue).join(",")),
    ];
    const url = URL.createObjectURL(new Blob([`\uFEFF${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "enter-flow-delivered-history.csv";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    toast.success("Delivered history exported", { description: `${visible.length} rows` });
  };

  const openRow = rows.find((r) => r.id === openId);

  return (
    <div className="flex-1 h-full overflow-auto" style={{ backgroundColor: "#F4F6F9" }}>
      <Toaster position="bottom-right" richColors />

      <header className="bg-white border-b border-slate-200/70 px-4 py-4 sm:px-8 sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3">
        <div>
          {view === "history" && (
            <button onClick={() => setView("active")} className="font-dm flex items-center gap-1 hover:underline mb-1" style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>
              ← Back to active
            </button>
          )}
          <h1 className="font-syne" style={{ fontSize: 26, fontWeight: 650, color: "#0F172A", lineHeight: 1.2 }}>
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

      <div className="px-4 py-5 flex flex-col gap-5 sm:px-8 sm:py-6">
        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-full min-w-0 max-w-md flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={view === "history" ? "Search JO, SI, customer, item, or waybill..." : "Search JO, PO, customer, item, or waybill..."}
              aria-label="Search by JO, PO, SI, customer, item, or waybill"
              className="font-dm w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-slate-400 bg-white"
              style={{ fontSize: 13 }}
            />
          </div>
          <div className="relative shrink-0">
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
          {view === "history" && (
            <button
              onClick={exportHistoryCsv}
              className="flex shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 font-dm hover:bg-slate-50"
              style={{ color: "#1A2B4A", fontSize: 12, fontWeight: 500 }}
            >
              <Download size={14} /> Export History CSV
            </button>
          )}
        </div>

        {view === "history" && (
          <div className="rounded-lg p-3 flex items-center gap-2 font-dm" style={{ fontSize: 12, color: "#1E40AF", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
            <History size={14} /> Read-only delivery history. Delivered orders are automatically removed from active deliveries.
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200/70 overflow-x-auto" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
          <table className="w-full table-auto">
            <thead style={{ backgroundColor: "#F4F6F9" }}>
              <tr>
                {(view === "history"
                  ? ["Date", "JO No.", "SI No.", "Customer", "Item", "Qty", "Delivery Method", "Status"]
                  : ["Date", "JO No.", "SI No.", "Customer", "Item", "Qty", "Amount", "Status", ""]
                ).map((h) => (
                  <th key={h} className={`font-dm text-left px-3 py-3 sm:px-4 ${h === "SI No." ? "hidden lg:table-cell" : ""} ${h === "Amount" ? "hidden xl:table-cell" : ""}`} style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.2, textTransform: "uppercase" }}>{h}</th>
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
                  <td className="px-3 py-3 font-dm sm:px-4" style={{ fontSize: 12, color: "#475569" }}>{r.date}</td>
                  <td className="px-3 py-3 font-dm sm:px-4" style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}>
                    {r.inq.joNumber ?? "—"}
                  </td>
                  <td className="hidden px-3 py-3 font-dm lg:table-cell sm:px-4" style={{ fontSize: 12, color: "#475569" }}>{r.si}</td>
                  <td className="px-3 py-3 font-dm sm:px-4" style={{ fontSize: 13, fontWeight: 500, color: "#0F172A" }}>
                    {r.customer}
                    {r.isReplacement && (
                      <span className="ml-1.5 font-dm px-1.5 py-0.5 rounded-full" style={{ fontSize: 9, fontWeight: 700, backgroundColor: "#EDE9FE", color: "#7C3AED", verticalAlign: "middle" }}>REPLACEMENT</span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-dm sm:px-4" style={{ fontSize: 13, color: "#475569" }}>{r.item}</td>
                  <td className="px-3 py-3 font-dm sm:px-4" style={{ fontSize: 13, color: "#475569" }}>{r.qty}</td>
                  {view === "history" ? (
                    <td className="px-3 py-3 font-dm sm:px-4" style={{ fontSize: 13, color: "#475569" }}>{r.delivery ?? "—"}</td>
                  ) : (
                    <td className="hidden px-3 py-3 font-dm xl:table-cell sm:px-4" style={{ fontSize: 13, color: "#475569" }}>₱{r.amount.toLocaleString("en-PH")}</td>
                  )}
                  <td className="px-3 py-3 sm:px-4">
                    <span className="font-dm whitespace-nowrap px-2.5 py-1 rounded-full" style={{ fontSize: 11, fontWeight: 500, backgroundColor: r.statusBg, color: r.statusFg }}>
                      {r.statusLabel}
                    </span>
                  </td>
                  {view === "active" && (
                    <td className="px-3 py-3 sm:px-4">
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
