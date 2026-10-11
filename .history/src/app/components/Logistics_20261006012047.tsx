import { useMemo, useState } from "react";
import { Search, Download, ChevronRight, Camera, X, History, CheckCircle2, Send, Truck, Filter } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useOrders, type Inquiry } from "../store/orders";
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
  inquiry,
  onClose,
  onStageSignedDR,
  onSubmitSignedDR,
  onMarkDelivered,
  onSendToClient,
  onTrackingRefChange,
  onTrackingLinkChange,
}: {
  inquiry: Inquiry;
  onClose: () => void;
  onStageSignedDR: (id: string, file: File, fileDataUrl: string) => Promise<boolean>;
  onSubmitSignedDR: (id: string) => Promise<boolean>;
  onMarkDelivered: (id: string) => void;
  onSendToClient: (id: string) => void;
  onTrackingRefChange: (id: string, trackingRef: string) => void;
  onTrackingLinkChange: (id: string, trackingLink: string) => void;
}) {
  const [uploadingSignedDR, setUploadingSignedDR] = useState(false);
  const [submitSignedDRConfirmationOpen, setSubmitSignedDRConfirmationOpen] = useState(false);
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);
  const [printReceiptOnOpen, setPrintReceiptOnOpen] = useState(false);
  const [signedReceiptOpen, setSignedReceiptOpen] = useState(false);
  const [pendingSignedReceiptOpen, setPendingSignedReceiptOpen] = useState(false);
  const signedDRReceived = hasValidSignedDeliveryReceipt(inquiry);
  const delivered = isDelivered(inquiry);
  const status = stageStatus(inquiry);
  const itemNames = inquiry.products.map(productName).join(", ") || "—";
  const waybillRef = inquiry.waybillNumber ?? inquiry.waybillIdentifier ?? inquiry.trackingRef;
  const paymentCycleActive = signedDRReceived
    && Boolean(inquiry.paymentCycleStartedAt)
    && inquiry.paymentCycleStartedAt === inquiry.signedDeliveryReceiptReceivedAt;

  const stageSignedDR = async (file: File) => {
    if (uploadingSignedDR) return;
    setUploadingSignedDR(true);
    try {
      const fileDataUrl = await readFileAsDataUrl(file);
      await onStageSignedDR(inquiry.id, file, fileDataUrl);
    } catch (error) {
      toast.error("Could not prepare the signed Delivery Receipt", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setUploadingSignedDR(false);
    }
  };

  const confirmSignedDRSubmission = async () => {
    if (!inquiry.pendingSignedDeliveryReceiptFileName || uploadingSignedDR) return;
    setUploadingSignedDR(true);
    try {
      const submitted = await onSubmitSignedDR(inquiry.id);
      if (submitted) setSubmitSignedDRConfirmationOpen(false);
    } finally {
      setUploadingSignedDR(false);
    }
  };

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
              value={inquiry.trackingRef ?? ""}
              onChange={(event) => onTrackingRefChange(inquiry.id, event.target.value)}
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
      {receiptPreviewOpen && <DeliveryReceiptPreview inquiry={inquiry} onClose={() => setReceiptPreviewOpen(false)} printOnOpen={printReceiptOnOpen} />}
      {signedReceiptOpen && <SignedReceiptViewer dataUrl={inquiry.signedDeliveryReceiptDataUrl} fileName={inquiry.signedDeliveryReceiptFileName} onClose={() => setSignedReceiptOpen(false)} />}
      {pendingSignedReceiptOpen && <SignedReceiptViewer dataUrl={inquiry.pendingSignedDeliveryReceiptDataUrl} fileName={inquiry.pendingSignedDeliveryReceiptFileName} onClose={() => setPendingSignedReceiptOpen(false)} />}
      <AlertDialog open={submitSignedDRConfirmationOpen} onOpenChange={(open) => {
        if (!uploadingSignedDR) setSubmitSignedDRConfirmationOpen(open);
      }}>
        <AlertDialogContent onEscapeKeyDown={(event) => {
          if (uploadingSignedDR) event.preventDefault();
        }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-syne text-[#1A2B4A]">SUBMIT SIGNED DELIVERY RECEIPT?</AlertDialogTitle>
            <AlertDialogDescription className="font-dm text-slate-600">
              Confirming will make this file the official Signed Delivery Receipt and complete delivery for this order.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {inquiry.pendingSignedDeliveryReceiptFileName && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="font-dm text-sm text-slate-700"><span className="font-bold">JO:</span> {orderReference(inquiry)}</div>
              <div className="font-dm text-sm text-slate-700"><span className="font-bold">DR:</span> {inquiry.deliveryReceiptNumber}</div>
              <div className="font-dm break-all text-xs text-slate-600">{inquiry.pendingSignedDeliveryReceiptFileName}</div>
              {inquiry.pendingSignedDeliveryReceiptDataUrl?.startsWith("data:image/") ? (
                <img src={inquiry.pendingSignedDeliveryReceiptDataUrl} alt="Pending signed Delivery Receipt preview" className="max-h-64 w-full rounded border border-slate-200 bg-white object-contain" />
              ) : inquiry.pendingSignedDeliveryReceiptDataUrl?.startsWith("data:application/pdf") ? (
                <iframe src={inquiry.pendingSignedDeliveryReceiptDataUrl} title="Pending signed Delivery Receipt preview" className="h-64 w-full rounded border border-slate-200 bg-white" />
              ) : (
                <div className="rounded border border-slate-200 bg-white p-4 font-dm text-xs text-slate-600">Preview is unavailable for this file type.</div>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={uploadingSignedDR} className="font-dm">CANCEL</AlertDialogCancel>
            <AlertDialogAction
              disabled={uploadingSignedDR || !inquiry.pendingSignedDeliveryReceiptFileName || !inquiry.pendingSignedDeliveryReceiptDataUrl}
              className="font-dm bg-[#1A2B4A] text-white hover:bg-[#263d62]"
              onClick={(event) => {
                event.preventDefault();
                void confirmSignedDRSubmission();
              }}
            >
              {uploadingSignedDR ? "SUBMITTING..." : "CONFIRM / SUBMIT SIGNED DR"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  const [view, setView] = useState<LogisticsView>("active");
  const [activeDateFilter, setActiveDateFilter] = useState<DateFilter>("all");
  const [historyDateFilter, setHistoryDateFilter] = useState<DateFilter>("all");
  const { inquiriesByStage, updateInquiry, markDeliveryReceiptSent, savePendingSignedDeliveryReceipt, submitPendingSignedDeliveryReceipt } = useOrders();
  const { push: pushNotif } = useNotifications();
  const sendInProgress = useRef(new Set<string>());

  const deliveryInquiries = useMemo(
    () => inquiriesByStage([...deliveryStages])
      .filter(hasReachedLogistics)
      .sort((a, b) => Date.parse(deliveryDate(b)) - Date.parse(deliveryDate(a))),
    [inquiriesByStage],
  );
  const activeInquiries = useMemo(() => deliveryInquiries.filter((inquiry) => !isDelivered(inquiry)), [deliveryInquiries]);
  const historyInquiries = useMemo(() => deliveryInquiries.filter(isDelivered), [deliveryInquiries]);
  const visible = useMemo(() => {
    const source = view === "active" ? activeInquiries : historyInquiries;
    const searchTerm = query.trim().toLocaleLowerCase();
    const dateFilter = view === "active" ? activeDateFilter : historyDateFilter;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const cutoff = new Date(today);
    if (dateFilter === "7days") cutoff.setDate(cutoff.getDate() - 6);
    if (dateFilter === "30days") cutoff.setDate(cutoff.getDate() - 29);

    return source.filter((inquiry) => {
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
  }, [query, view, activeDateFilter, historyDateFilter, activeInquiries, historyInquiries]);

  const selectedInquiry = deliveryInquiries.find((inquiry) => inquiry.id === openId);

  const handleMarkDelivered = (id: string) => {
    const inquiry = deliveryInquiries.find((item) => item.id === id);
    if (!inquiry || isDelivered(inquiry)) return;
    const deliveredAt = new Date().toISOString();
    updateInquiry(id, {
      stage: "delivered",
      deliveredDate: deliveredAt,
      waybillLog: [
        ...(inquiry.waybillLog ?? []),
        { ts: deliveredAt, status: "Delivered", note: inquiry.trackingRef ?? inquiry.waybillNumber ?? "Delivery completed" },
      ],
    });
    toast.success("Delivery status updated", { description: `${orderReference(inquiry)} marked delivered.` });
  };

  const handleSendToClient = (id: string) => {
    const inquiry = deliveryInquiries.find((item) => item.id === id);
    if (!inquiry) return;
    if (!inquiry.deliveryReceiptNumber) {
      toast.error("The accountant must generate a Delivery Receipt before sending it to the client.");
      return;
    }
    if (inquiry.deliveryReceiptSentAt || sendInProgress.current.has(id)) {
      toast.info("The Delivery Receipt and tracking were already sent for this delivery.");
      return;
    }
    sendInProgress.current.add(id);
    const method = inquiry.deliveryMethod ?? "Delivery method not specified";
    const reference = orderReference(inquiry);
    try {
      pushNotif({
        dept: "logistics",
        title: `Delivery Receipt and tracking: ${reference}`,
        body: `${inquiry.clientName} · ${reference} · ${inquiry.deliveryReceiptNumber} · ${method} · Tracking ${inquiry.trackingRef || "not provided"}${inquiry.deliveryTrackingLink ? ` · ${inquiry.deliveryTrackingLink}` : ""}`,
        link: "logistics",
        recipients: ["client"],
        clientName: inquiry.clientName,
      });
      markDeliveryReceiptSent(id, inquiry.deliveryTrackingLink);
      toast.success("Delivery Receipt and tracking sent", {
        description: `${inquiry.deliveryReceiptNumber} · ${reference}`,
      });
    } catch (error) {
      toast.error("Could not send Delivery Receipt and tracking", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      sendInProgress.current.delete(id);
    }
  };

  const handleTrackingRefChange = (id: string, trackingRef: string) => updateInquiry(id, { trackingRef });
  const handleTrackingLinkChange = (id: string, deliveryTrackingLink: string) => updateInquiry(id, { deliveryTrackingLink });

  const handleStageSignedDR = async (id: string, file: File, fileDataUrl: string): Promise<boolean> => {
    try {
      await savePendingSignedDeliveryReceipt(id, file.name, fileDataUrl, "Logistics Staff");
      toast.success("Signed Delivery Receipt uploaded", { description: `${file.name} · pending submission` });
      return true;
    } catch (error) {
      toast.error("Could not upload the pending Signed Delivery Receipt", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
      return false;
    }
  };

  const handleSubmitSignedDR = async (id: string): Promise<boolean> => {
    try {
      await submitPendingSignedDeliveryReceipt(id);
      toast.success("Signed Delivery Receipt submitted", { description: "The official receipt has been saved and delivery completed." });
      return true;
    } catch (error) {
      toast.error("Could not submit the Signed Delivery Receipt", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
      return false;
    }
  };

  const handleTrackingRefChange = (id: string, trackingRef: string) => {
    updateInquiry(id, { trackingRef });
  };

  const openRow = rows.find((r) => r.id === openId);

  return (
    <main className="flex-1 h-full overflow-auto bg-[#F4F6F9]">
      <Toaster position="bottom-right" richColors />

      <header className="bg-white border-b border-slate-200/70 px-8 py-5 sticky top-0 z-10 flex items-start justify-between">
        <div>
          {view === "history" && (
            <button onClick={() => setView("active")} className="font-dm mb-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900">
              <ArrowLeft size={13} /> Back to active deliveries
            </button>
          )}
          <h1 className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>
            {view === "active" ? "Logistics" : "Delivered History"}
          </h1>
          <p className="font-dm mt-1 text-[13px] text-slate-600">
            {view === "active" ? "Manage Warehouse handoffs, tracking, Delivery Receipts, and signed delivery records." : "Delivery records marked delivered."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {view === "active" && (
            <button onClick={() => setView("history")} className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 font-dm text-xs font-semibold text-slate-800 hover:bg-slate-50 sm:inline-flex">
              <History size={14} /> DELIVERED HISTORY
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
      {selectedInquiry && (
        <DeliveryDetailModal
          inquiry={selectedInquiry}
          onClose={() => setOpenId(null)}
          onStageSignedDR={handleStageSignedDR}
          onSubmitSignedDR={handleSubmitSignedDR}
          onMarkDelivered={handleMarkDelivered}
          onSendToClient={handleSendToClient}
          onTrackingRefChange={handleTrackingRefChange}
          onTrackingLinkChange={handleTrackingLinkChange}
        />
      )}
    </main>
  );
}
