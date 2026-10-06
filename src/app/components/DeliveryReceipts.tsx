import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  Eye,
  FileCheck2,
  FileText,
  Printer,
  Receipt,
  Search,
  Truck,
  X,
} from "lucide-react";
import { Toaster, toast } from "sonner";
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
import {
  hasValidSignedDeliveryReceipt,
  paymentState,
  useOrders,
  type Inquiry,
} from "../store/orders";
import { NotificationBell } from "./NotificationBell";

type DeliveryFilter = "all" | "ready" | "generated" | "signed";
type SortOrder = "newest" | "oldest";

const deliveryStages = ["ready_for_dispatch", "dispatched", "delivered", "paid", "overdue"] as const;

function hasReachedDeliveryHandoff(inquiry: Inquiry): boolean {
  return Boolean(inquiry.waybillPrintedAt);
}

function isSignedDRReceived(inquiry: Inquiry): boolean {
  return hasValidSignedDeliveryReceipt(inquiry);
}

function isFulfillmentCompleted(inquiry: Inquiry): boolean {
  return isSignedDRReceived(inquiry)
    && Boolean(inquiry.fulfillmentCompletedAt)
    && inquiry.fulfillmentCompletedAt === inquiry.signedDeliveryReceiptReceivedAt;
}

function deliveryTimestamp(inquiry: Inquiry): string | undefined {
  return inquiry.dispatchedAt
    ?? inquiry.waybillPrintedAt
    ?? inquiry.deliveredDate
    ?? inquiry.deliveryReceiptGeneratedAt;
}

function timestampValue(value?: string): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDate(value?: string, withTime = false): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, withTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" });
}

function formatAmount(amount?: number): string {
  if (amount === undefined || !Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
}

function orderReference(inquiry: Inquiry): string {
  return inquiry.joNumber ?? inquiry.code;
}

function purchaseOrderReference(inquiry: Inquiry): string | undefined {
  return inquiry.poNumber ?? inquiry.poFileName?.replace(/\.\w+$/, "");
}

function productName(product: Inquiry["products"][number]): string {
  return product.filterName || product.type || "Item";
}

function totalQuantity(inquiry: Inquiry): number {
  return inquiry.products.reduce((sum, product) => sum + product.qty, 0);
}

function itemAmount(inquiry: Inquiry, index: number): number | undefined {
  const quotedLineTotal = inquiry.productsQuotedTotal?.[index];
  if (typeof quotedLineTotal === "number" && Number.isFinite(quotedLineTotal)) return quotedLineTotal;
  const unitPrice = inquiry.productsUnitPrice?.[index];
  const quantity = inquiry.products[index]?.qty;
  return typeof unitPrice === "number" && typeof quantity === "number"
    ? unitPrice * quantity
    : undefined;
}

function receiptTotal(inquiry: Inquiry): number | undefined {
  if (typeof inquiry.invoiceAmount === "number") return inquiry.invoiceAmount;
  if (typeof inquiry.quotedTotal === "number") return inquiry.quotedTotal;
  const values = inquiry.products.map((_, index) => itemAmount(inquiry, index));
  return values.length > 0 && values.every((value): value is number => value !== undefined)
    ? values.reduce((sum, value) => sum + value, 0)
    : undefined;
}

function matchesFilter(inquiry: Inquiry, filter: DeliveryFilter): boolean {
  switch (filter) {
    case "ready":
      return !inquiry.deliveryReceiptNumber;
    case "generated":
      return Boolean(inquiry.deliveryReceiptNumber);
    case "signed":
      return isSignedDRReceived(inquiry);
    default:
      return true;
  }
}

function deliveryStatus(inquiry: Inquiry): { label: string; tone: "amber" | "blue" | "green" } {
  if (isSignedDRReceived(inquiry)) {
    return { label: "DELIVERED", tone: "green" };
  }
  if (inquiry.deliveryReceiptSentAt && (inquiry.deliveryTrackingLink || inquiry.trackingRef)) return { label: "IN TRANSIT", tone: "blue" };
  return { label: "READY FOR DISPATCH", tone: "amber" };
}

function DeliveryReceiptPreview({ inquiry, onClose }: { inquiry: Inquiry; onClose: () => void }) {
  if (!inquiry.deliveryReceiptNumber) return null;
  const receiptAmount = receiptTotal(inquiry);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="Delivery Receipt preview">
      <style>{`
        @page { size: portrait; margin: 14mm; }
        @media print {
          body * { visibility: hidden !important; }
          #accountant-delivery-receipt, #accountant-delivery-receipt * { visibility: visible !important; }
          #accountant-delivery-receipt { position: fixed; inset: 0; width: 100%; padding: 24px; background: white; color: #0f172a; }
          .accountant-dr-actions { display: none !important; }
        }
      `}</style>
      <div className="w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl sm:p-7">
        <article id="accountant-delivery-receipt" className="border border-slate-300 bg-white p-6 sm:p-9">
          <header className="mb-7 flex items-start justify-between gap-6 border-b-2 border-[#1A2B4A] pb-5">
            <div>
              <div className="font-syne text-2xl font-extrabold tracking-tight text-[#1A2B4A]">ENTER-FLOW</div>
              <div className="font-dm mt-5 flex items-center gap-2 text-base font-extrabold tracking-wide text-slate-900">
                <Receipt size={18} /> DELIVERY RECEIPT
              </div>
            </div>
            <div className="text-right">
              <div className="font-dm text-[10px] font-bold uppercase tracking-wider text-slate-500">DR Number</div>
              <div className="font-mono-jb mt-1 text-xl font-bold text-[#1A2B4A]">{inquiry.deliveryReceiptNumber}</div>
              <div className="font-dm mt-2 text-xs text-slate-600">Date: {formatDate(inquiry.deliveryReceiptGeneratedAt)}</div>
            </div>
          </header>

          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <ReceiptField label="JO Number" value={orderReference(inquiry)} />
            <ReceiptField label="PO Number" value={purchaseOrderReference(inquiry) ?? "—"} />
            <ReceiptField label="Customer" value={inquiry.clientName} />
            <ReceiptField label="Delivery Method" value={inquiry.deliveryMethod ?? "—"} />
            <ReceiptField label="Delivery Date" value={formatDate(deliveryTimestamp(inquiry))} />
            <ReceiptField label="Waybill / Reference" value={inquiry.waybillNumber ?? inquiry.waybillIdentifier ?? inquiry.trackingRef ?? "—"} />
          </div>

          <div className="mt-8 overflow-hidden border-y border-slate-300">
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 font-dm text-[10px] font-bold uppercase tracking-wider text-slate-600">
              Items
            </div>
            <div className="grid grid-cols-[1fr_90px_120px] gap-3 border-b border-slate-200 px-3 py-2 font-dm text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <span>Description</span><span className="text-right">Quantity</span><span className="text-right">Amount</span>
            </div>
            {inquiry.products.map((product, index) => (
              <div key={product.id} className="grid grid-cols-[1fr_90px_120px] gap-3 px-3 py-3 font-dm text-sm text-slate-800">
                <span>{productName(product)}</span>
                <span className="text-right">{product.qty}</span>
                <span className="text-right">{formatAmount(itemAmount(inquiry, index))}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-200 bg-slate-50 px-3 py-3 font-dm text-sm font-bold text-slate-900">
              <span>Total Quantity: {totalQuantity(inquiry)}</span>
              <span>Total: {formatAmount(receiptAmount)}</span>
            </div>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-12 font-dm text-xs text-slate-700">
            <div className="border-t border-slate-500 pt-2">Received By / Signature</div>
            <div className="border-t border-slate-500 pt-2">Date Received</div>
          </div>
        </article>
        <div className="accountant-dr-actions mt-5 flex flex-wrap justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 font-dm text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Close
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-md bg-[#1A2B4A] px-4 py-2 font-dm text-sm font-bold text-white hover:opacity-90">
            <Printer size={15} /> PRINT DELIVERY RECEIPT
          </button>
        </div>
      </div>
    </div>
  );
}

function ReceiptField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="font-dm text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-dm mt-1 break-words text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function SummaryCard({
  label,
  count,
  icon: Icon,
  tone,
}: {
  label: string;
  count: number;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <span className="font-dm text-[10px] font-extrabold uppercase tracking-wider text-slate-500 sm:text-xs">{label}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}><Icon size={17} /></span>
      </div>
      <div className="font-syne mt-4 text-3xl font-extrabold text-slate-900">{count}</div>
    </div>
  );
}

function StatusBadge({ children, tone }: { children: ReactNode; tone: "amber" | "blue" | "green" }) {
  const styles = {
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    blue: "bg-blue-50 text-blue-800 ring-blue-200",
    green: "bg-green-50 text-green-800 ring-green-200",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-dm text-[10px] font-extrabold uppercase tracking-wide ring-1 ring-inset ${styles[tone]}`}>{children}</span>;
}

const filters: { id: DeliveryFilter; label: string }[] = [
  { id: "all", label: "ALL" },
  { id: "ready", label: "READY FOR DR" },
  { id: "generated", label: "GENERATED" },
  { id: "signed", label: "SIGNED DR RECEIVED" },
];

export function DeliveryReceipts() {
  const { inquiriesByStage, generateDeliveryReceipt, sendDeliveryReceiptToLogistics } = useOrders();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DeliveryFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [expandedDeliveryId, setExpandedDeliveryId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [signedReceiptId, setSignedReceiptId] = useState<string | null>(null);
  const [pendingGenerationId, setPendingGenerationId] = useState<string | null>(null);
  const [pendingLogisticsSendId, setPendingLogisticsSendId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingToLogistics, setIsSendingToLogistics] = useState(false);
  const generationInProgress = useRef(false);
  const logisticsSendInProgress = useRef(false);

  const deliveries = useMemo(
    () => inquiriesByStage([...deliveryStages])
      .filter(hasReachedDeliveryHandoff)
      .sort((a, b) => timestampValue(deliveryTimestamp(b)) - timestampValue(deliveryTimestamp(a))),
    [inquiriesByStage],
  );

  const counts = useMemo(() => ({
    ready: deliveries.filter((inquiry) => !inquiry.deliveryReceiptNumber).length,
    generated: deliveries.filter((inquiry) => Boolean(inquiry.deliveryReceiptNumber)).length,
    signed: deliveries.filter(isSignedDRReceived).length,
    fulfilled: deliveries.filter(isFulfillmentCompleted).length,
  }), [deliveries]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visible = deliveries
    .filter((inquiry) => matchesFilter(inquiry, filter))
    .filter((inquiry) => {
      if (!normalizedQuery) return true;
      const searchable = [
        inquiry.deliveryReceiptNumber,
        inquiry.joNumber,
        inquiry.poNumber,
        inquiry.poFileName?.replace(/\.\w+$/, ""),
        inquiry.code,
        inquiry.clientName,
        inquiry.deliveryMethod,
        inquiry.waybillNumber,
        inquiry.waybillIdentifier,
        ...inquiry.products.map(productName),
      ];
      return searchable.some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
    })
    .sort((a, b) => {
      const direction = sortOrder === "newest" ? -1 : 1;
      return direction * (timestampValue(deliveryTimestamp(a)) - timestampValue(deliveryTimestamp(b)));
    });

  const previewInquiry = deliveries.find((inquiry) => inquiry.id === previewId);
  const signedInquiry = deliveries.find((inquiry) => inquiry.id === signedReceiptId);
  const pendingGeneration = deliveries.find((inquiry) => inquiry.id === pendingGenerationId);
  const pendingLogisticsSend = deliveries.find((inquiry) => inquiry.id === pendingLogisticsSendId);

  const requestGenerate = (inquiry: Inquiry) => {
    if (inquiry.deliveryReceiptNumber) {
      toast.info("A Delivery Receipt already exists for this order.", { description: inquiry.deliveryReceiptNumber });
      return;
    }
    setPendingGenerationId(inquiry.id);
  };

  const confirmGenerate = () => {
    if (generationInProgress.current || !pendingGenerationId) return;
    const inquiry = deliveries.find((item) => item.id === pendingGenerationId);
    if (!inquiry) {
      setPendingGenerationId(null);
      toast.error("This delivery is no longer available.");
      return;
    }
    if (inquiry.deliveryReceiptNumber) {
      setPendingGenerationId(null);
      toast.info("A Delivery Receipt already exists for this order.", { description: inquiry.deliveryReceiptNumber });
      return;
    }

    generationInProgress.current = true;
    setIsGenerating(true);
    try {
      const receiptNumber = generateDeliveryReceipt(inquiry.id);
      if (!receiptNumber) {
        toast.error("Could not generate a Delivery Receipt for this order.");
        return;
      }
      setPendingGenerationId(null);
      toast.success("Delivery Receipt generated", { description: receiptNumber });
    } catch (error) {
      toast.error("Could not generate a Delivery Receipt for this order.", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      generationInProgress.current = false;
      setIsGenerating(false);
    }
  };

  const confirmSendToLogistics = () => {
    if (logisticsSendInProgress.current || !pendingLogisticsSendId) return;
    const inquiry = deliveries.find((item) => item.id === pendingLogisticsSendId);
    if (!inquiry) {
      setPendingLogisticsSendId(null);
      toast.error("This delivery is no longer available.");
      return;
    }
    if (!inquiry.deliveryReceiptNumber || !inquiry.waybillPrintedAt) {
      setPendingLogisticsSendId(null);
      toast.error("A generated DR and printed Warehouse Waybill are required before sending to Logistics.");
      return;
    }
    if (inquiry.deliveryReceiptSentToLogisticsAt) {
      setPendingLogisticsSendId(null);
      return;
    }

    logisticsSendInProgress.current = true;
    setIsSendingToLogistics(true);
    try {
      const sent = sendDeliveryReceiptToLogistics(inquiry.id);
      if (!sent) {
        toast.error("Could not send this delivery to Logistics.");
        return;
      }
      setPendingLogisticsSendId(null);
      toast.success("Delivery sent to Logistics", {
        description: `${inquiry.deliveryReceiptNumber} · ${orderReference(inquiry)}`,
      });
    } catch (error) {
      toast.error("Could not send this delivery to Logistics.", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      logisticsSendInProgress.current = false;
      setIsSendingToLogistics(false);
    }
  };

  const emptyMessage = filter === "ready"
    ? "No deliveries are currently waiting for a Delivery Receipt."
    : filter === "generated"
      ? "No generated Delivery Receipts found."
      : filter === "signed"
        ? "No signed Delivery Receipts have been received yet."
          : "No deliveries have been handed over from Warehouse yet.";

  return (
    <main className="flex-1 h-full overflow-auto bg-[#F4F6F9]">
      <Toaster position="bottom-right" richColors />
      <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200/70 bg-white px-5 py-5 sm:px-8">
        <div>
          <div className="flex items-center gap-2 font-dm text-[10px] font-bold uppercase tracking-[0.18em] text-[#65748B]">
            <Receipt size={14} /> Warehouse handoff
          </div>
          <h1 className="font-syne mt-2 text-[25px] font-extrabold leading-tight text-[#1A2B4A] sm:text-[28px]">DELIVERY RECEIPTS</h1>
          <p className="font-dm mt-1 max-w-2xl text-[13px] text-slate-600">
            Generate, review, and manage Delivery Receipts for deliveries handed over from Warehouse.
          </p>
        </div>
        <NotificationBell />
      </header>

      <div className="flex flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8">
        <section aria-label="Delivery Receipt summaries" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <SummaryCard label="Ready for DR" count={counts.ready} icon={FileText} tone="bg-amber-50 text-amber-700" />
          <SummaryCard label="DR Generated" count={counts.generated} icon={Receipt} tone="bg-blue-50 text-blue-700" />
          <SummaryCard label="Signed DR Received" count={counts.signed} icon={FileCheck2} tone="bg-green-50 text-green-700" />
          <SummaryCard label="Fulfillment Completed" count={counts.fulfilled} icon={ClipboardCheck} tone="bg-emerald-50 text-emerald-700" />
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              {filters.map((item) => {
                const active = filter === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setFilter(item.id)}
                    aria-pressed={active}
                    className={`rounded-md px-3 py-2 font-dm text-[10px] font-extrabold tracking-wide transition-colors sm:text-xs ${
                      active ? "bg-[#1A2B4A] text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_190px]">
              <label className="relative block">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search DR, JO, PO, or client..."
                  aria-label="Search DR, JO, PO, or client"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 font-dm text-[13px] outline-none transition focus:border-[#1A2B4A] focus:ring-2 focus:ring-[#1A2B4A]/10"
                />
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 font-dm text-xs text-slate-500">
                <span className="shrink-0 font-bold">SORT</span>
                <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)} className="min-w-0 flex-1 bg-transparent py-2.5 font-semibold text-slate-800 outline-none">
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
            <div className="font-dm text-sm font-bold text-slate-800">Handover deliveries</div>
            <div className="font-dm text-xs text-slate-500">{visible.length} {visible.length === 1 ? "record" : "records"}</div>
          </div>

          {visible.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500"><Truck size={20} /></div>
              <div className="font-syne mt-4 text-sm font-bold text-slate-800">{emptyMessage}</div>
              {normalizedQuery && (
                <div className="font-dm mt-1 max-w-md text-xs text-slate-500">Try adjusting your search to see more handover records.</div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3 bg-slate-50/60 p-3 sm:gap-4 sm:p-4">
              {visible.map((inquiry) => {
                const signedDR = isSignedDRReceived(inquiry);
                const fulfillmentCompleted = isFulfillmentCompleted(inquiry);
                const paymentCycleActive = signedDR
                  && Boolean(inquiry.paymentCycleStartedAt)
                  && inquiry.paymentCycleStartedAt === inquiry.signedDeliveryReceiptReceivedAt;
                const payment = paymentState(inquiry);
                const isPaid = payment.state === "FULLY_PAID";
                const overdue = inquiry.stage === "overdue" && payment.remainingInvoiceBalance > 0;
                const paymentLabel = isPaid ? "PAID" : overdue ? "PAYMENT OVERDUE" : "PAYMENT CYCLE ACTIVE";
                const poReference = purchaseOrderReference(inquiry);
                const status = deliveryStatus(inquiry);
                const isExpanded = expandedDeliveryId === inquiry.id;
                const detailsId = `delivery-details-${inquiry.id}`;

                return (
                  <article key={inquiry.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <button
                      type="button"
                      onClick={() => setExpandedDeliveryId(isExpanded ? null : inquiry.id)}
                      aria-expanded={isExpanded}
                      aria-controls={detailsId}
                      className="w-full rounded-lg text-left outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#1A2B4A]/20"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono-jb text-base font-bold text-[#1A2B4A]">{orderReference(inquiry)}</span>
                            <span className="font-dm text-sm font-bold text-slate-900">{inquiry.clientName}</span>
                            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                          </div>
                          <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                            <ReceiptField label="Item(s)" value={inquiry.products.map(productName).join(", ") || "—"} />
                            <ReceiptField label="Quantity" value={`${totalQuantity(inquiry)} pcs`} />
                            <ReceiptField label="Waybill / Reference" value={inquiry.waybillNumber ?? inquiry.waybillIdentifier ?? "—"} />
                          </div>
                        </div>
                        <span className="flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2.5 py-2 font-dm text-[10px] font-extrabold uppercase tracking-wide text-[#1A2B4A]">
                          {isExpanded ? "Hide Details" : "View Details"}
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </span>
                      </div>
                    </button>

                    {isExpanded && <div id={detailsId} className="mt-4 rounded-lg border border-slate-100 bg-slate-50/70 px-3 pb-3 pt-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
                          {poReference && <ReceiptField label="PO Number" value={poReference} />}
                          {false && <>
                          <ReceiptField label="Item(s)" value={inquiry.products.map(productName).join(", ") || "—"} />
                          <ReceiptField label="Waybill / Reference" value={inquiry.waybillNumber ?? inquiry.waybillIdentifier ?? "—"} />
                        </>}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 lg:max-w-none lg:justify-end">
                        {inquiry.deliveryReceiptNumber ? (
                          <>
                            <div className="min-w-[150px] rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2">
                              <div className="font-dm text-[9px] font-bold uppercase tracking-wider text-blue-700">Delivery Receipt</div>
                              <div className="font-mono-jb mt-0.5 text-sm font-bold text-[#1A2B4A]">{inquiry.deliveryReceiptNumber}</div>
                            </div>
                            <button
                              onClick={() => setPreviewId(inquiry.id)}
                              className="inline-flex items-center gap-2 rounded-md bg-[#1A2B4A] px-3 py-2.5 font-dm text-xs font-bold text-white shadow-sm transition hover:bg-[#263d62]"
                            >
                              <Printer size={14} /> VIEW / PRINT
                            </button>
                            {inquiry.deliveryReceiptSentToLogisticsAt ? (
                              <span className="inline-flex items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-3 py-2.5 font-dm text-[10px] font-extrabold text-green-800">
                                <CheckCircle2 size={13} /> SENT TO LOGISTICS
                              </span>
                            ) : (
                              <button
                                onClick={() => setPendingLogisticsSendId(inquiry.id)}
                                disabled={!inquiry.waybillPrintedAt}
                                title={!inquiry.waybillPrintedAt ? "A printed Warehouse Waybill is required before sending to Logistics." : undefined}
                                className="inline-flex items-center gap-2 rounded-md border border-[#1A2B4A] bg-white px-3 py-2.5 font-dm text-xs font-bold text-[#1A2B4A] shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Truck size={14} /> SEND TO LOGISTICS
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            onClick={() => requestGenerate(inquiry)}
                            className="inline-flex items-center gap-2 rounded-md bg-[#1A2B4A] px-4 py-3 font-dm text-xs font-bold text-white shadow-sm transition hover:bg-[#263d62]"
                          >
                            <FileText size={14} /> GENERATE DELIVERY RECEIPT
                          </button>
                        )}
                      </div>
                    </div>

                    {(signedDR || fulfillmentCompleted) && (
                      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3">
                        {signedDR && (
                          <>
                            <div className="flex flex-wrap items-center gap-2 font-dm text-xs text-green-800">
                              <CheckCircle2 size={14} /> <span className="font-extrabold">SIGNED DR RECEIVED</span>
                            </div>
                            <div className="font-dm text-[11px] text-slate-600">
                              {inquiry.signedDeliveryReceiptSubmittedBy ?? "—"} · {formatDate(inquiry.signedDeliveryReceiptReceivedAt, true)}
                            </div>
                            {inquiry.signedDeliveryReceiptDataUrl && (
                              <button
                                onClick={() => setSignedReceiptId(inquiry.id)}
                                className="inline-flex items-center gap-1.5 rounded-md border border-green-200 bg-white px-2.5 py-1.5 font-dm text-[10px] font-bold text-green-900 hover:bg-green-50"
                              >
                                <Eye size={12} /> VIEW SIGNED DR
                              </button>
                            )}
                          </>
                        )}
                        {fulfillmentCompleted && <StatusBadge tone="green">FULFILLMENT COMPLETED</StatusBadge>}
                        {paymentCycleActive && <StatusBadge tone={isPaid ? "green" : overdue ? "amber" : "blue"}>{paymentLabel}</StatusBadge>}
                      </div>
                    )}

                    {fulfillmentCompleted && (
                      <div className="mt-3 rounded-lg bg-slate-50 px-4 py-3">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          {paymentCycleActive && (
                            <>
                              <ReceiptField label="Payment Cycle Started" value={formatDate(inquiry.paymentCycleStartedAt, true)} />
                              <ReceiptField label="Payment Terms" value={inquiry.paymentTerms} />
                              <ReceiptField label="Payment Due" value={inquiry.invoiceDueDate ?? "—"} />
                              <ReceiptField label="Remaining Balance" value={formatAmount(payment.remainingInvoiceBalance)} />
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    </div>}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {previewInquiry && <DeliveryReceiptPreview inquiry={previewInquiry} onClose={() => setPreviewId(null)} />}
      {signedInquiry?.signedDeliveryReceiptDataUrl && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-label="Signed Delivery Receipt">
          <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white">
            <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div>
                <div className="font-syne text-[15px] font-bold text-slate-900">Signed Delivery Receipt</div>
                <div className="font-dm mt-0.5 text-xs text-slate-500">
                  {signedInquiry.signedDeliveryReceiptFileName} · {orderReference(signedInquiry)}
                </div>
              </div>
              <button onClick={() => setSignedReceiptId(null)} aria-label="Close signed receipt" className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100">
                <X size={16} />
              </button>
            </header>
            <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-100 p-3">
              {signedInquiry.signedDeliveryReceiptDataUrl.startsWith("data:image/") ? (
                <img src={signedInquiry.signedDeliveryReceiptDataUrl} alt={signedInquiry.signedDeliveryReceiptFileName ?? "Signed Delivery Receipt"} className="max-h-full max-w-full object-contain" />
              ) : signedInquiry.signedDeliveryReceiptDataUrl.startsWith("data:application/pdf") ? (
                <iframe src={signedInquiry.signedDeliveryReceiptDataUrl} title={signedInquiry.signedDeliveryReceiptFileName ?? "Signed Delivery Receipt"} className="h-full w-full bg-white" />
              ) : (
                <a href={signedInquiry.signedDeliveryReceiptDataUrl} download={signedInquiry.signedDeliveryReceiptFileName} className="rounded-md border border-slate-300 bg-white px-4 py-2 font-dm text-sm font-bold text-[#1A2B4A]">
                  Download {signedInquiry.signedDeliveryReceiptFileName}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
      <AlertDialog
        open={Boolean(pendingGeneration)}
        onOpenChange={(open) => {
          if (!open && !isGenerating) setPendingGenerationId(null);
        }}
      >
        <AlertDialogContent onEscapeKeyDown={(event) => {
          if (isGenerating) event.preventDefault();
        }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-syne text-[#1A2B4A]">GENERATE DELIVERY RECEIPT</AlertDialogTitle>
            <AlertDialogDescription className="font-dm text-slate-600">
              Confirm generation for this delivery. A unique DR number will be assigned when you confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingGeneration && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="font-dm grid gap-2 text-sm text-slate-700">
                <div><span className="font-bold text-slate-500">JO:</span> {orderReference(pendingGeneration)}</div>
                <div><span className="font-bold text-slate-500">Customer:</span> {pendingGeneration.clientName}</div>
                <div><span className="font-bold text-slate-500">PO:</span> {purchaseOrderReference(pendingGeneration) ?? "—"}</div>
              </div>
            </div>
          )}
          <p className="font-dm text-xs leading-relaxed text-slate-600">
            Generating the DR does not make the delivery visible to Logistics. Send it separately when it is ready for Logistics processing.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isGenerating} className="font-dm" onClick={(event) => {
              if (isGenerating) event.preventDefault();
            }}>
              CANCEL
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isGenerating || !pendingGeneration}
              className="font-dm bg-[#1A2B4A] text-white hover:bg-[#263d62]"
              onClick={(event) => {
                event.preventDefault();
                confirmGenerate();
              }}
            >
              {isGenerating ? "GENERATING..." : "GENERATE DELIVERY RECEIPT"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(pendingLogisticsSend)}
        onOpenChange={(open) => {
          if (!open && !isSendingToLogistics) setPendingLogisticsSendId(null);
        }}
      >
        <AlertDialogContent onEscapeKeyDown={(event) => {
          if (isSendingToLogistics) event.preventDefault();
        }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-syne text-[#1A2B4A]">SEND DELIVERY RECEIPT TO LOGISTICS?</AlertDialogTitle>
            <AlertDialogDescription className="font-dm text-slate-600">
              This will make the delivery available to Logistics for delivery processing. It will not send anything to the client or change its delivery status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingLogisticsSend && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="font-dm grid gap-2 text-sm text-slate-700">
                <div><span className="font-bold text-slate-500">DR:</span> {pendingLogisticsSend.deliveryReceiptNumber}</div>
                <div><span className="font-bold text-slate-500">JO:</span> {orderReference(pendingLogisticsSend)}</div>
                <div><span className="font-bold text-slate-500">Customer:</span> {pendingLogisticsSend.clientName}</div>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSendingToLogistics} className="font-dm" onClick={(event) => {
              if (isSendingToLogistics) event.preventDefault();
            }}>
              CANCEL
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isSendingToLogistics || !pendingLogisticsSend}
              className="font-dm bg-[#1A2B4A] text-white hover:bg-[#263d62]"
              onClick={(event) => {
                event.preventDefault();
                confirmSendToLogistics();
              }}
            >
              {isSendingToLogistics ? "SENDING..." : "SEND TO LOGISTICS"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
