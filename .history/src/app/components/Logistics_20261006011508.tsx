<<<<<<< HEAD
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileCheck2,
  FileText,
  History,
  Printer,
  Search,
  Send,
  Truck,
  X,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { hasValidSignedDeliveryReceipt, useOrders, type Inquiry } from "../store/orders";
import { readFileAsDataUrl } from "../store/attachments";
=======
import { useMemo, useState } from "react";
import { Search, Download, ChevronRight, Camera, History, CheckCircle2, Send, Truck, Filter, ArrowLeft } from "lucide-react";
import { Toaster, toast } from "sonner";
import { PRODUCTION_STAGES, stageColor, stageLabel, useOrders, type Inquiry } from "../store/orders";
>>>>>>> cdc01b4887d8ae2f2bb667bd0ffa6ecf14ca3fa1
import { useNotifications } from "../store/notifications";
import { NotificationBell } from "./NotificationBell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

type LogisticsView = "active" | "history";
type DateFilter = "today" | "7days" | "30days" | "all";

<<<<<<< HEAD
const deliveryStages = ["ready_for_dispatch", "dispatched", "delivered", "paid", "overdue"] as const;

function hasReachedLogistics(inquiry: Inquiry): boolean {
  return Boolean(
    inquiry.waybillPrintedAt
    && inquiry.deliveryReceiptNumber
    && inquiry.deliveryReceiptSentToLogisticsAt,
  );
}

function isDelivered(inquiry: Inquiry): boolean {
  return hasValidSignedDeliveryReceipt(inquiry)
    || inquiry.stage === "delivered"
    || inquiry.stage === "paid"
    || inquiry.stage === "overdue";
}

function deliveryDate(inquiry: Inquiry): string {
  return inquiry.deliveredDate ?? inquiry.dispatchedAt ?? inquiry.waybillPrintedAt ?? inquiry.submittedDate;
}

function formatDate(value?: string, withTime = false): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, withTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" });
}

function orderReference(inquiry: Inquiry): string {
  return inquiry.joNumber ?? inquiry.code;
}

function poReference(inquiry: Inquiry): string {
  return inquiry.poNumber ?? inquiry.poFileName?.replace(/\.\w+$/, "") ?? "—";
}

function productName(product: Inquiry["products"][number]): string {
  return product.filterName || product.type || "Item";
}

function quantity(inquiry: Inquiry): number {
  return inquiry.products.reduce((sum, product) => sum + product.qty, 0);
}

function currency(amount?: number): string | undefined {
  if (amount === undefined || !Number.isFinite(amount)) return undefined;
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
}

function stageStatus(inquiry: Inquiry): { label: string; tone: string } {
  if (isDelivered(inquiry)) return { label: "DELIVERED", tone: "bg-green-50 text-green-800 ring-green-200" };
  if (inquiry.waybillPrintedAt || inquiry.stage === "dispatched") return { label: "IN TRANSIT", tone: "bg-blue-50 text-blue-800 ring-blue-200" };
  return { label: "READY FOR DISPATCH", tone: "bg-amber-50 text-amber-800 ring-amber-200" };
}

function ReceiptField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="font-dm text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-dm mt-1 break-words text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function DeliveryReceiptPreview({ inquiry, onClose, printOnOpen = false }: { inquiry: Inquiry; onClose: () => void; printOnOpen?: boolean }) {
  useEffect(() => {
    if (!printOnOpen) return;
    const timer = window.setTimeout(() => window.print(), 100);
    return () => window.clearTimeout(timer);
  }, [printOnOpen]);

  if (!inquiry.deliveryReceiptNumber) return null;
  const amount = inquiry.invoiceAmount ?? inquiry.quotedTotal;
  const waybillRef = inquiry.waybillNumber ?? inquiry.waybillIdentifier ?? inquiry.trackingRef;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="Delivery Receipt preview">
      <style>{`
        @page { size: portrait; margin: 14mm; }
        @media print {
          body * { visibility: hidden !important; }
          #logistics-delivery-receipt, #logistics-delivery-receipt * { visibility: visible !important; }
          #logistics-delivery-receipt { position: fixed; inset: 0; width: 100%; padding: 24px; background: white; color: #0f172a; }
          .logistics-receipt-actions { display: none !important; }
        }
      `}</style>
      <div className="w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl sm:p-7">
        <article id="logistics-delivery-receipt" className="border border-slate-300 bg-white p-6 sm:p-9">
          <header className="mb-7 flex items-start justify-between gap-6 border-b-2 border-[#1A2B4A] pb-5">
            <div>
              <div className="font-syne text-2xl font-extrabold tracking-tight text-[#1A2B4A]">ENTER-FLOW</div>
              <div className="font-dm mt-5 text-base font-extrabold tracking-wide text-slate-900">DELIVERY RECEIPT</div>
            </div>
            <div className="text-right">
              <div className="font-dm text-[10px] font-bold uppercase tracking-wider text-slate-500">DR Number</div>
              <div className="font-mono-jb mt-1 text-xl font-bold text-[#1A2B4A]">{inquiry.deliveryReceiptNumber}</div>
              <div className="font-dm mt-2 text-xs text-slate-600">Date: {formatDate(inquiry.deliveryReceiptGeneratedAt)}</div>
            </div>
          </header>

          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <ReceiptField label="JO Number" value={orderReference(inquiry)} />
            <ReceiptField label="PO Number" value={poReference(inquiry)} />
            <ReceiptField label="Customer" value={inquiry.clientName} />
            <ReceiptField label="Delivery Method" value={inquiry.deliveryMethod ?? "Delivery method not specified"} />
            <ReceiptField label="Delivery Date" value={formatDate(deliveryDate(inquiry))} />
            <ReceiptField label="Waybill / Reference" value={waybillRef ?? "—"} />
          </div>

          <div className="mt-8 overflow-hidden border-y border-slate-300">
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 font-dm text-[10px] font-bold uppercase tracking-wider text-slate-600">
              Items
            </div>
            <div className="grid grid-cols-[1fr_90px] gap-3 border-b border-slate-200 px-3 py-2 font-dm text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <span>Description</span><span className="text-right">Quantity</span>
            </div>
            {inquiry.products.map((product) => (
              <div key={product.id} className="grid grid-cols-[1fr_90px] gap-3 px-3 py-3 font-dm text-sm text-slate-800">
                <span>{productName(product)}</span>
                <span className="text-right">{product.qty}</span>
              </div>
            ))}
            <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 bg-slate-50 px-3 py-3 font-dm text-sm font-bold text-slate-900">
              <span>Total Quantity: {quantity(inquiry)}</span>
              {amount !== undefined && <span>Amount: {currency(amount)}</span>}
            </div>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-12 font-dm text-xs text-slate-700">
            <div className="border-t border-slate-500 pt-2">Received By / Signature</div>
            <div className="border-t border-slate-500 pt-2">Date Received</div>
          </div>
        </article>
        <div className="logistics-receipt-actions mt-5 flex flex-wrap justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 font-dm text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Close
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-md bg-[#1A2B4A] px-4 py-2 font-dm text-sm font-bold text-white hover:bg-[#263d62]">
            <Printer size={15} /> PRINT DELIVERY RECEIPT
          </button>
        </div>
      </div>
    </div>
  );
}

function SignedReceiptViewer({ dataUrl, fileName, onClose }: { dataUrl?: string; fileName?: string; onClose: () => void }) {
  if (!dataUrl) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-label="Signed Delivery Receipt">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <div className="font-syne text-[15px] font-bold text-slate-900">Signed Delivery Receipt</div>
            <div className="font-dm mt-0.5 text-xs text-slate-500">
              {fileName ?? "Signed Delivery Receipt"}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close signed receipt" className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100">
            <X size={16} />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-100 p-3">
          {dataUrl.startsWith("data:image/") ? (
              <img src={dataUrl} alt={fileName ?? "Signed Delivery Receipt"} className="max-h-full max-w-full object-contain" />
          ) : dataUrl.startsWith("data:application/pdf") ? (
            <iframe src={dataUrl} title={fileName ?? "Signed Delivery Receipt"} className="h-full w-full bg-white" />
          ) : (
            <div className="rounded-md border border-slate-300 bg-white px-4 py-2 font-dm text-sm text-slate-600">Preview is unavailable for this file type.</div>
          )}
        </div>
      </div>
    </div>
  );
=======
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
>>>>>>> cdc01b4887d8ae2f2bb667bd0ffa6ecf14ca3fa1
}

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
<<<<<<< HEAD
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/60">
      <div className="h-full w-full overflow-auto bg-[#F4F6F9]" onClick={(event) => event.stopPropagation()}>
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200/70 bg-white px-5 py-4 sm:px-8">
          <div className="min-w-0">
            <button onClick={onClose} className="font-dm mb-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900">
              <ArrowLeft size={13} /> Back to Logistics
            </button>
            <h1 className="font-syne text-xl font-extrabold text-[#1A2B4A] sm:text-2xl">DELIVERY DETAILS</h1>
            <p className="font-dm mt-1 truncate text-xs text-slate-500">{inquiry.clientName} · {orderReference(inquiry)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={`rounded-full px-3 py-1.5 font-dm text-[10px] font-extrabold ring-1 ring-inset ${status.tone}`}>{status.label}</span>
            {!delivered && inquiry.deliveryMethod === "Company Vehicle" && (
              <button onClick={() => onMarkDelivered(inquiry.id)} className="hidden items-center gap-2 rounded-md bg-[#1A2B4A] px-3 py-2 font-dm text-xs font-bold text-white hover:bg-[#263d62] sm:inline-flex">
                <Truck size={14} /> MARK DELIVERED
              </button>
            )}
            <button onClick={onClose} aria-label="Close delivery details" className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50">
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 sm:px-8 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="mb-5 flex items-center gap-2">
              <Truck size={17} className="text-[#1A2B4A]" />
              <h2 className="font-syne text-sm font-bold text-slate-900">DELIVERY DETAILS</h2>
            </div>
            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
              <ReceiptField label="JO Number" value={orderReference(inquiry)} />
              <ReceiptField label="PO Number" value={poReference(inquiry)} />
              <ReceiptField label="Customer" value={inquiry.clientName} />
              <ReceiptField label="Delivery Method" value={inquiry.deliveryMethod ?? "Delivery method not specified"} />
              <ReceiptField label="Item(s)" value={itemNames} />
              <ReceiptField label="Quantity" value={`${quantity(inquiry)} pcs`} />
              <ReceiptField label="Waybill / Reference" value={waybillRef ?? "—"} />
              <ReceiptField label="Delivery Date" value={formatDate(deliveryDate(inquiry))} />
              <ReceiptField label="Delivery Status" value={status.label} />
              {inquiry.invoiceNo && <ReceiptField label="SI / Invoice No." value={inquiry.invoiceNo} />}
              {inquiry.invoiceAmount !== undefined && <ReceiptField label="Invoice Amount" value={currency(inquiry.invoiceAmount) ?? "—"} />}
            </div>
            {!delivered && inquiry.deliveryMethod === "Company Vehicle" && (
              <button onClick={() => onMarkDelivered(inquiry.id)} className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#1A2B4A] px-3 py-2.5 font-dm text-xs font-bold text-white hover:bg-[#263d62] sm:hidden">
                <Truck size={14} /> MARK DELIVERED
=======
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
>>>>>>> cdc01b4887d8ae2f2bb667bd0ffa6ecf14ca3fa1
              </button>
            )}
          </section>

<<<<<<< HEAD
          <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <FileText size={16} className="text-[#1A2B4A]" />
              <h2 className="font-syne text-sm font-bold text-slate-900">DELIVERY RECEIPT</h2>
            </div>
            {inquiry.deliveryReceiptNumber ? (
              <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-mono-jb text-base font-bold text-[#1A2B4A]">{inquiry.deliveryReceiptNumber}</div>
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 font-dm text-[10px] font-extrabold text-blue-800">GENERATED</span>
                </div>
                <div className="font-dm mt-2 text-xs text-slate-600">Generated {formatDate(inquiry.deliveryReceiptGeneratedAt, true)}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => { setPrintReceiptOnOpen(false); setReceiptPreviewOpen(true); }} className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-2 font-dm text-xs font-bold text-[#1A2B4A] hover:bg-blue-50">
                    <FileText size={13} /> VIEW DELIVERY RECEIPT
                  </button>
                  <button onClick={() => { setPrintReceiptOnOpen(true); setReceiptPreviewOpen(true); }} className="inline-flex items-center gap-2 rounded-md bg-[#1A2B4A] px-3 py-2 font-dm text-xs font-bold text-white hover:bg-[#263d62]">
                    <Printer size={13} /> PRINT DELIVERY RECEIPT
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                <div className="font-dm text-sm font-bold text-slate-800">Pending Accounting Generation</div>
                <p className="font-dm mt-1 text-xs text-slate-500">Logistics does not generate Delivery Receipts. Once Accounting generates the DR, it will appear here.</p>
=======
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
>>>>>>> cdc01b4887d8ae2f2bb667bd0ffa6ecf14ca3fa1
              </div>
            )}
          </section>

<<<<<<< HEAD
          <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Truck size={16} className="text-[#1A2B4A]" />
              <h2 className="font-syne text-sm font-bold text-slate-900">TRACKING</h2>
            </div>
            <label className="font-dm mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Tracking / Waybill No.</label>
            <input
              value={inquiry.trackingRef ?? ""}
              onChange={(event) => onTrackingRefChange(inquiry.id, event.target.value)}
              placeholder="Enter tracking or waybill number"
              className="w-full rounded-md border border-slate-200 px-3 py-2.5 font-mono-jb text-sm text-[#1A2B4A] outline-none focus:border-[#1A2B4A] focus:ring-2 focus:ring-[#1A2B4A]/10"
=======
          {/* ── Notes ── */}
          <div className="bg-white rounded-xl border border-slate-200/70 p-5" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
            <h2 className="font-dm mb-3" style={{ fontSize: 15, fontWeight: 600, color: "#0F172A" }}>Notes</h2>
            <textarea
              placeholder="Add delivery or payment notes..."
              aria-label="Delivery notes"
              className="w-full h-28 rounded-lg border border-slate-300 p-3 outline-none focus:border-slate-400 font-dm resize-y bg-white"
              style={{ fontSize: 13 }}
>>>>>>> cdc01b4887d8ae2f2bb667bd0ffa6ecf14ca3fa1
            />
            <label className="font-dm mb-1.5 mt-4 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Tracking Link</label>
            <input
              type="url"
              value={inquiry.deliveryTrackingLink ?? ""}
              onChange={(event) => onTrackingLinkChange(inquiry.id, event.target.value)}
              placeholder="https://..."
              aria-label="Tracking link"
              className="w-full rounded-md border border-slate-200 px-3 py-2.5 font-mono-jb text-sm text-[#1A2B4A] outline-none focus:border-[#1A2B4A] focus:ring-2 focus:ring-[#1A2B4A]/10"
            />
            <div className="font-dm mt-3 text-[11px] text-slate-500">Tracking updates are saved to this delivery.</div>
          </section>

          <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Send size={16} className="text-[#1A2B4A]" />
              <h2 className="font-syne text-sm font-bold text-slate-900">SEND TO CLIENT</h2>
            </div>
            {inquiry.deliveryReceiptSentAt ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-2 font-dm text-sm font-extrabold text-green-800"><CheckCircle2 size={16} /> DR &amp; TRACKING SENT</div>
                <div className="font-dm mt-2 text-xs text-green-900">Sent {formatDate(inquiry.deliveryReceiptSentAt, true)}</div>
                <div className="font-dm mt-1 text-xs text-slate-600">This delivery has already been sent to the client.</div>
              </div>
            ) : inquiry.deliveryReceiptNumber ? (
              <>
                <div className="font-dm mb-3 text-xs text-slate-600">
                  Sends {inquiry.deliveryReceiptNumber}, tracking details, and order reference {orderReference(inquiry)} to the client.
                </div>
                <button onClick={() => onSendToClient(inquiry.id)} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-700 px-4 py-3 font-dm text-xs font-extrabold text-white hover:bg-green-800">
                  <Send size={14} /> SEND DR &amp; TRACKING TO CLIENT
                </button>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 font-dm text-xs text-slate-600">
                Sending is available after Accounting generates the Delivery Receipt.
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <FileCheck2 size={16} className="text-[#1A2B4A]" />
              <h2 className="font-syne text-sm font-bold text-slate-900">SIGNED DELIVERY RECEIPT</h2>
            </div>
            {signedDRReceived ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-2 font-dm text-sm font-extrabold text-green-800"><CheckCircle2 size={16} /> SIGNED DR RECEIVED</div>
                <div className="font-dm mt-3 space-y-1 text-xs text-slate-700">
                  <div>Submitted by: <span className="font-semibold">{inquiry.signedDeliveryReceiptSubmittedBy ?? "—"}</span></div>
                  <div>Received: <span className="font-semibold">{formatDate(inquiry.signedDeliveryReceiptReceivedAt, true)}</span></div>
                  <div className="break-all">{inquiry.signedDeliveryReceiptFileName}</div>
                </div>
                {inquiry.signedDeliveryReceiptDataUrl && (
                  <button onClick={() => setSignedReceiptOpen(true)} className="mt-3 inline-flex items-center gap-2 rounded-md border border-green-300 bg-white px-3 py-2 font-dm text-xs font-bold text-green-900 hover:bg-green-100">
                    <FileText size={13} /> VIEW SIGNED DR
                  </button>
                )}
              </div>
            ) : inquiry.deliveryReceiptNumber ? (
              <>
                <p className="font-dm mb-3 text-xs text-slate-500">Upload the signed copy received for {inquiry.deliveryReceiptNumber}. Client and Logistics uploads share the same receipt state.</p>
                {inquiry.pendingSignedDeliveryReceiptFileName && (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="font-dm text-sm font-extrabold text-amber-900">SIGNED DR UPLOADED — PENDING SUBMISSION</div>
                    <div className="font-dm mt-2 break-all text-xs text-slate-700">{inquiry.pendingSignedDeliveryReceiptFileName}</div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {inquiry.pendingSignedDeliveryReceiptDataUrl && (
                        <button
                          type="button"
                          onClick={() => setPendingSignedReceiptOpen(true)}
                          className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-2 font-dm text-xs font-bold text-amber-900 hover:bg-amber-100"
                        >
                          <FileText size={13} /> VIEW SIGNED DR
                        </button>
                      )}
                      <button
                        onClick={() => setSubmitSignedDRConfirmationOpen(true)}
                        disabled={uploadingSignedDR || !inquiry.pendingSignedDeliveryReceiptDataUrl}
                        className="inline-flex rounded-md bg-[#1A2B4A] px-4 py-2.5 font-dm text-xs font-extrabold text-white hover:bg-[#263d62] disabled:cursor-wait disabled:opacity-60"
                      >
                        SUBMIT SIGNED DR
                      </button>
                    </div>
                  </div>
                )}
                {inquiry.pendingSignedDeliveryReceiptFileName ? (
                  <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 font-dm text-xs font-bold text-slate-700 hover:bg-slate-50">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      disabled={uploadingSignedDR}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        const input = event.currentTarget;
                        input.value = "";
                        if (!file || uploadingSignedDR) return;
                        void stageSignedDR(file);
                      }}
                    />
                    <FileCheck2 size={15} /> {uploadingSignedDR ? "REPLACING FILE..." : "REPLACE FILE"}
                  </label>
                ) : (
                  <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center transition hover:bg-slate-100">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      disabled={uploadingSignedDR}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        const input = event.currentTarget;
                        input.value = "";
                        if (!file || uploadingSignedDR) return;
                        void stageSignedDR(file);
                      }}
                    />
                    <FileCheck2 size={21} className="text-slate-500" />
                    <span className="font-dm text-xs font-bold text-slate-700">{uploadingSignedDR ? "UPLOADING SIGNED DELIVERY RECEIPT..." : "UPLOAD SIGNED DELIVERY RECEIPT"}</span>
                    <span className="font-dm text-[10px] text-slate-500">PDF, JPG, or PNG</span>
                  </label>
                )}
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 font-dm text-xs text-slate-600">
                A signed copy can be uploaded after the accountant-generated DR is available.
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <Clock3 size={16} className="text-[#1A2B4A]" />
              <h2 className="font-syne text-sm font-bold text-slate-900">FULFILLMENT</h2>
            </div>
            {signedDRReceived && inquiry.fulfillmentCompletedAt === inquiry.signedDeliveryReceiptReceivedAt ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-2 font-dm text-sm font-extrabold text-green-800"><CheckCircle2 size={16} /> FULFILLMENT COMPLETED</div>
                <div className="font-dm mt-2 text-xs text-slate-600">Signed DR received {formatDate(inquiry.signedDeliveryReceiptReceivedAt, true)}</div>
                {paymentCycleActive && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <ReceiptField label="Payment Cycle Started" value={formatDate(inquiry.paymentCycleStartedAt, true)} />
                    <ReceiptField label="Payment Due" value={inquiry.invoiceDueDate ?? "—"} />
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 font-dm text-xs text-slate-600">
                Fulfillment is completed automatically when a valid signed Delivery Receipt is received.
              </div>
            )}
          </section>
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
<<<<<<< HEAD
        inquiry.joNumber ?? "",
        inquiry.poNumber ?? "",
        inquiry.poFileName ?? "",
        inquiry.invoiceNo ?? "",
        inquiry.deliveryReceiptNumber ?? "",
        inquiry.clientName,
        inquiry.deliveryMethod ?? "",
        inquiry.waybillNumber ?? "",
        inquiry.waybillIdentifier ?? "",
        inquiry.trackingRef ?? "",
        ...inquiry.products.flatMap((product) => [product.type, product.filterName ?? ""]),
      ];
      const searchOk = !searchTerm || searchableValues.some((value) => value.toLocaleLowerCase().includes(searchTerm));
      const rowDate = new Date(deliveryDate(inquiry));
      const dateOk = dateFilter === "all" || (!Number.isNaN(rowDate.getTime()) && rowDate >= cutoff && rowDate < tomorrow);
=======
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
>>>>>>> cdc01b4887d8ae2f2bb667bd0ffa6ecf14ca3fa1
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

<<<<<<< HEAD
  const selectedDateFilter = view === "active" ? activeDateFilter : historyDateFilter;
  const setSelectedDateFilter = (value: DateFilter) => {
    if (view === "active") setActiveDateFilter(value);
    else setHistoryDateFilter(value);
  };
=======
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
>>>>>>> cdc01b4887d8ae2f2bb667bd0ffa6ecf14ca3fa1

  return (
    <main className="flex-1 h-full overflow-auto bg-[#F4F6F9]">
      <Toaster position="bottom-right" richColors />
<<<<<<< HEAD
      <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200/70 bg-white px-5 py-5 sm:px-8">
=======

      <header className="bg-white border-b border-slate-200/70 px-4 py-4 sm:px-8 sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3">
>>>>>>> cdc01b4887d8ae2f2bb667bd0ffa6ecf14ca3fa1
        <div>
          {view === "history" && (
            <button onClick={() => setView("active")} className="font-dm mb-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900">
              <ArrowLeft size={13} /> Back to active deliveries
            </button>
          )}
<<<<<<< HEAD
          <div className="font-dm flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#65748B]">
            <Truck size={14} /> Delivery operations
          </div>
          <h1 className="font-syne mt-2 text-[26px] font-extrabold leading-tight text-[#1A2B4A]">
            {view === "active" ? "LOGISTICS" : "DELIVERED HISTORY"}
=======
          <h1 className="font-syne" style={{ fontSize: 26, fontWeight: 650, color: "#0F172A", lineHeight: 1.2 }}>
            {view === "active" ? "Logistics" : "Delivered History"}
>>>>>>> cdc01b4887d8ae2f2bb667bd0ffa6ecf14ca3fa1
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

<<<<<<< HEAD
      <div className="flex flex-col gap-5 px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[240px] max-w-lg flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search JO, PO, invoice, customer, item..."
              aria-label="Search delivery records"
              className="font-dm w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-[13px] outline-none focus:border-[#1A2B4A] focus:ring-2 focus:ring-[#1A2B4A]/10"
=======
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
>>>>>>> cdc01b4887d8ae2f2bb667bd0ffa6ecf14ca3fa1
            />
          </label>
          <label className="font-dm flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-500">
            <span className="font-bold">DATE</span>
            <select value={selectedDateFilter} onChange={(event) => setSelectedDateFilter(event.target.value as DateFilter)} className="bg-transparent py-2.5 font-semibold text-slate-800 outline-none">
              <option value="today">Today</option>
              <option value="7days">Last 7 days</option>
              <option value="30days">Last 30 days</option>
              <option value="all">All dates</option>
            </select>
          </label>
          {view === "active" && (
            <button onClick={() => setView("history")} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-dm text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:hidden">
              <History size={14} /> HISTORY
            </button>
          )}
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5">
            <div>
              <h2 className="font-syne text-sm font-bold text-slate-900">{view === "active" ? "Active deliveries" : "Delivered history"}</h2>
              <p className="font-dm mt-1 text-xs text-slate-500">Only orders with a printed Warehouse Waybill appear here.</p>
            </div>
            <span className="font-dm rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{visible.length}</span>
          </div>
<<<<<<< HEAD

          {visible.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500"><Truck size={20} /></div>
              <div className="font-syne mt-4 text-sm font-bold text-slate-800">
                {query || selectedDateFilter !== "all"
                  ? "No deliveries match these filters."
                  : view === "active"
                    ? "No deliveries have been handed over from Warehouse."
                    : "No delivered records yet."}
              </div>
              <div className="font-dm mt-1 max-w-md text-xs text-slate-500">A delivery appears after Warehouse prints its Waybill.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px]">
                <thead className="bg-[#F8FAFC]">
                  <tr>
                    {["Date", "JO No.", "SI / Invoice", "Customer", "Item", "Qty", "Amount", "Delivery Status", ""].map((heading) => (
                      <th key={heading} className="font-dm px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((inquiry) => {
                    const status = stageStatus(inquiry);
                    const amount = inquiry.invoiceAmount ?? inquiry.quotedTotal;
                    return (
                      <tr key={inquiry.id} className="border-t border-slate-100 transition hover:bg-slate-50">
                        <td className="font-dm whitespace-nowrap px-4 py-3 text-xs text-slate-600">{formatDate(deliveryDate(inquiry))}</td>
                        <td className="font-mono-jb px-4 py-3 text-xs font-bold text-[#1A2B4A]">{orderReference(inquiry)}</td>
                        <td className="font-mono-jb px-4 py-3 text-xs text-slate-600">{inquiry.invoiceNo ?? "—"}</td>
                        <td className="font-dm px-4 py-3 text-xs font-semibold text-slate-900">{inquiry.clientName}</td>
                        <td className="font-dm max-w-[220px] px-4 py-3 text-xs text-slate-600">{inquiry.products.map(productName).join(", ") || "—"}</td>
                        <td className="font-dm px-4 py-3 text-xs text-slate-600">{quantity(inquiry)}</td>
                        <td className="font-dm whitespace-nowrap px-4 py-3 text-xs text-slate-600">{currency(amount) ?? "—"}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 font-dm text-[10px] font-extrabold ring-1 ring-inset ${status.tone}`}>{status.label}</span></td>
                        <td className="px-4 py-3">
                          <button onClick={() => setOpenId(inquiry.id)} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 font-dm text-[10px] font-bold text-[#1A2B4A] hover:border-[#1A2B4A] hover:bg-slate-50">
                            OPEN DELIVERY <ExternalLink size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
=======
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
>>>>>>> cdc01b4887d8ae2f2bb667bd0ffa6ecf14ca3fa1
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
