import { useMemo, useState } from "react";
import { ArrowRight, FileText, Search, X, Calculator, ChevronDown, ChevronUp, Info, Upload, Paperclip, Trash2, Factory, CheckCircle2, Maximize2, RotateCcw, AlertTriangle, Eye } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useOrders, unitPrice, quotationTotal, paymentState, verifiedPayments, resolveProductBOM, poNumberForDisplay, type Inquiry, type ProductLine, type Quotation, type QuotationLine, type Stage, type FinalizeJOData, type JOSpecs } from "../store/orders";
import { useMaterials, type Material, type BOMLine, type CostConfig } from "../store/materials";
import { useNotifications } from "../store/notifications";
import { NotificationBell } from "./NotificationBell";
import { CostEstimationPanel } from "./CostEstimationPanel";
import { QuotationBuilder } from "./QuotationBuilder";
import { StockRequestsModal } from "./StockRequestsModal";
import { useStockRequests } from "../store/stockRequests";
import type { QuotationDoc } from "../store/orders";
import { FILTER_TYPES as FILTER_TYPES_CATALOG, DIMENSION_LABELS as DIMENSION_LABELS_CATALOG, GROUP_TEMPLATES, groupForType } from "../store/filterTemplates";
import { InvoicePreviewModal } from "./InvoicePreviewModal";
import { useSession } from "../store/session";

const columns: { id: Stage | "readyForJobOrder"; title: string; tint: string }[] = [
  { id: "inquiry", title: "NEW INQUIRY", tint: "#64748B" },
  { id: "quotation", title: "QUOTATION SENT", tint: "#D97706" },
  { id: "readyForJobOrder", title: "READY FOR JOB ORDER", tint: "#C9A84C" },
];

const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;
const hasPORecord = (inquiry: Inquiry) => Boolean(inquiry.poFileDataUrl || (inquiry.poUploaded && inquiry.poFileName));

export function SalesOrders() {
  const { inquiries, archivedInquiries, completedJOs, addInquiry, sendQuotation, generateInvoice, sendInvoice, finalizeProductJOs, markInventoryDeducted, rejectInquiry, approveCancellation, declineCancellation, setBillOfMaterials, setProductsCosting, setQuotationDoc, isNewClient, updateInquiry, inquiriesByStage } = useOrders();
  const { validateGeneratedJOs, deductForGeneratedJOs, rawMaterials, findBOMTemplate } = useMaterials();
  const { requests: stockRequests } = useStockRequests();
  const { push: pushNotif } = useNotifications();
  const session = useSession();
  const [query, setQuery] = useState("");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [viewQuoteId, setViewQuoteId] = useState<string | null>(null);
  const [poViewId, setPoViewId] = useState<string | null>(null);
  const [generateId, setGenerateId] = useState<string | null>(null);
  const [generateJoId, setGenerateJoId] = useState<string | null>(null);
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null);
  const [showNewInquiry, setShowNewInquiry] = useState(false);
  const [showStockRequests, setShowStockRequests] = useState(false);
  const [expandedCards, setExpandedCards] = useState<{ quotation: string | null; readyForJobOrder: string | null }>({
    quotation: null,
    readyForJobOrder: null,
  });

  const filtered = useMemo(
    () => inquiries.filter((i) =>
      query === "" ||
      i.code.toLowerCase().includes(query.toLowerCase()) ||
      i.clientName.toLowerCase().includes(query.toLowerCase())
    ),
    [inquiries, query]
  );

  const salesStockRequestCount = stockRequests.filter((request) => request.status === "responded" || request.status === "updated").length;

  const reviewing = inquiries.find((i) => i.id === reviewId);
  const viewing = inquiries.find((i) => i.id === viewQuoteId);
  const poViewing = inquiries.find((i) => i.id === poViewId);
  const generating = inquiries.find((i) => i.id === generateId);
  const generatingJO = inquiries.find((i) => i.id === generateJoId);
  const viewingInvoice = inquiries.find((i) => i.id === viewInvoiceId);

  const sendInvoiceToClient = (invoice: Inquiry, closePreview: () => void) => {
    if (!sendInvoice(invoice.id)) return;
    const invoicePayment = paymentState(invoice);
    const downpaymentPercent = invoice.quotationDoc?.downpaymentPercent ?? invoice.downpaymentPercent ?? 0;
    pushNotif({ dept: "payments", title: `INVOICE RECEIVED: ${invoice.invoiceNo}`, body: `${invoice.clientName} · ${peso(invoice.invoiceAmount ?? 0)}${downpaymentPercent > 0 ? ` · DOWNPAYMENT REQUIRED ${peso(invoicePayment.requiredDownpaymentAmount)}` : ""}`, link: "accounting", clientName: invoice.clientName, recipients: ["owner", "accounting", "operations", "client"] });
    toast.success("Invoice sent to client", { description: `${invoice.invoiceNo} · client portal updated` });
    closePreview();
  };

  const isReadyForJobOrder = (inquiry: Inquiry) => {
    if (inquiry.stage !== "po" || !hasPORecord(inquiry) || !inquiry.poFileName || !inquiry.poReceived || !inquiry.invoiceNo || !inquiry.invoiceSentAt) return false;
    const state = paymentState(inquiry);
    if (state.invoiceTotal <= 0) return false;
    return state.requiredDownpaymentAmount > 0
      ? state.downpaymentStatus === "COMPLETE"
      : state.state === "FULLY_PAID";
  };

  return (
    <div className="flex-1 h-full overflow-auto" style={{ backgroundColor: "#F4F6F9" }}>
      <Toaster position="bottom-right" richColors />

      <header className="bg-white border-b border-slate-200/70 px-8 py-5 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>
            Sales &amp; Orders
          </h1>
          <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>
            Pipeline overview · Inquiry → Quotation → PO → JO
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search inquiries..."
              className="font-dm pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-slate-400 w-64"
              style={{ fontSize: 13, backgroundColor: "#F4F6F9" }}
            />
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-slate-200">
            <span className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Pipeline</span>
            <span className="font-syne" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{inquiries.length} items</span>
          </div>
          <button onClick={() => setShowStockRequests(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg" style={{ backgroundColor: "#1A2B4A" }}>
            <span className="font-dm text-white/75" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>Stock Requests</span>
            <span className="font-syne text-white px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,.16)", fontSize: 12, fontWeight: 800 }}>{salesStockRequestCount}</span>
          </button>
          <button
            onClick={() => setShowNewInquiry(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white font-dm hover:opacity-90"
            style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.4 }}
          >
            <ArrowRight size={15} strokeWidth={2.5} /> New Inquiry
          </button>
          <NotificationBell />
        </div>
      </header>

      <div className="px-8 pt-6">
        <div className="flex items-start gap-2 rounded-lg px-4 py-3" style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
          <Info size={16} style={{ color: "#1D4ED8", marginTop: 2 }} />
          <span className="font-dm" style={{ fontSize: 13, color: "#1E3A8A" }}>
            New inquiries appear automatically when clients submit through the Client Portal.
          </span>
        </div>
      </div>

      <div className="px-8 pt-4 pb-0">
        {archivedInquiries.length > 0 && (
          <details className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <summary className="px-5 py-3 flex items-center gap-2 cursor-pointer font-dm select-none" style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>
              🗂 Archived / Rejected Inquiries ({archivedInquiries.length})
            </summary>
            <div className="border-t border-slate-200 p-4 grid grid-cols-3 gap-3">
              {archivedInquiries.map(i => (
                <div key={i.id} className="rounded-lg border border-slate-200 p-3 flex flex-col gap-1" style={{ backgroundColor: "#FAFBFC" }}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono-jb" style={{ fontSize: 11, color: "#1A2B4A", fontWeight: 600 }}>{i.code}</span>
                    <span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: i.archiveReason === "rejected" ? "#FEE2E2" : "#E2E8F0", color: i.archiveReason === "rejected" ? "#C8102E" : "#64748B" }}>
                      {i.archiveReason === "rejected" ? "Rejected" : "Cancelled"} · {i.archiveDate}
                    </span>
                  </div>
                  <div className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{i.clientName}</div>
                  <div className="font-dm" style={{ fontSize: 11, color: "#94A3B8" }}>{i.submittedDate} · {i.paymentTerms}</div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="px-8 py-6">
        <div className="grid grid-cols-3 gap-6">
          {columns.map((col) => {
            /* Part 4B will provide the payment-verified source for the ready-for-job-order column. */
            const isCollapsibleColumn = col.id === "quotation" || col.id === "readyForJobOrder";
            const colCards = col.id === "readyForJobOrder"
              ? filtered.filter(isReadyForJobOrder)
              : filtered.filter((c) => col.id === "quotation"
                ? (c.stage === "quotation" || (c.stage === "po" && !isReadyForJobOrder(c)))
                : c.stage === col.id);
            return (
              <div key={col.id} className="rounded-xl border border-slate-200/70 flex flex-col bg-white" style={{ minHeight: 600 }}>
                <div className="px-5 py-4 border-b border-slate-200/70 flex items-center justify-between rounded-t-xl" style={{ backgroundColor: "#F4F6F9" }}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.tint }} aria-hidden />
                    <h3 className="font-syne" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", letterSpacing: 0.6 }}>{col.title}</h3>
                  </div>
                  <span className="font-dm px-2 py-0.5 rounded-full bg-white border border-slate-200" style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>
                    {colCards.length}
                  </span>
                </div>

                <div className="flex-1 p-4 flex flex-col gap-3">
                  {colCards.length === 0 && (
                    <div className="flex-1 flex items-center justify-center font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>No items</div>
                  )}

                  {colCards.map((c) => (
                    <InquiryCard
                      key={c.id}
                      inquiry={c}
                      isNew={isNewClient(c.clientName)}
                      isReadyForJobOrder={col.id === "readyForJobOrder"}
                      collapsible={isCollapsibleColumn}
                      expanded={!isCollapsibleColumn || expandedCards[col.id] === c.id}
                      onToggle={() => {
                        if (!isCollapsibleColumn) return;
                        const columnId = col.id === "quotation" ? "quotation" : "readyForJobOrder";
                        setExpandedCards((current) => ({
                          ...current,
                          [columnId]: current[columnId] === c.id ? null : c.id,
                        }));
                      }}
                      onReview={() => setReviewId(c.id)}
                      onViewQuote={() => setViewQuoteId(c.id)}
                      onViewPO={() => setPoViewId(c.id)}
                      onMarkPOReceived={() => {
                        if (!hasPORecord(c)) return;
                        updateInquiry(c.id, { poReceived: true });
                        toast.success("PO marked received", { description: `${c.code} · ${poNumberForDisplay(c) ?? c.code}` });
                      }}
                      onGenerateJO={() => {
                        const existingJO = completedJOs.find((job) => job.id === c.id || job.parentInquiryId === c.id);
                        if (c.joNumber || existingJO) {
                          toast.info("Job Order already exists", { description: existingJO?.joNumber ?? c.joNumber });
                          return;
                        }
                        setGenerateJoId(c.id);
                      }}
                      onGenerateInvoice={() => {
                        const invoiceNo = generateInvoice(c.id);
                        if (invoiceNo) {
                          setGenerateId(c.id);
                          toast.success("Invoice builder opened", { description: `${invoiceNo} · review before sending` });
                        }
                      }}
                      onViewInvoice={() => setViewInvoiceId(c.id)}
                      onReject={(reason) => {
                        rejectInquiry(c.id, reason);
                        pushNotif({
                          dept: "sales",
                          title: `Inquiry rejected: ${c.code}`,
                          body: `${c.clientName} · Reason: ${reason}`,
                          link: "sales",
                          recipients: ["owner", "operations", "sales", "client"],
                        });
                        toast.info("Inquiry rejected", { description: `${c.code} archived · client notified with reason` });
                      }}
                      onAcceptCancel={() => {
                        approveCancellation(c.id);
                        pushNotif({
                          dept: "sales",
                          title: `Cancellation accepted: ${c.code}`,
                          body: `${c.clientName} · order archived as cancelled`,
                          link: "sales",
                          recipients: ["client"],
                        });
                        toast.success("Cancellation accepted", { description: `${c.code} archived · client notified` });
                      }}
                      onDeclineCancel={() => {
                        declineCancellation(c.id);
                        pushNotif({
                          dept: "sales",
                          title: `Cancellation declined: ${c.code}`,
                          body: `${c.clientName} · please reach out via email to discuss`,
                          link: "sales",
                          recipients: ["client"],
                        });
                        toast.info("Cancellation declined", { description: `Contact ${c.clientName} via email to discuss` });
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {reviewing && (
        <ReviewQuotationModal
          inquiry={reviewing}
          onClose={() => setReviewId(null)}
          onSubmit={(q, bomData, quotationDoc) => {
            sendQuotation(reviewing.id, q);
            if (bomData) {
              setBillOfMaterials(reviewing.id, bomData.bom, bomData.costConfig, bomData.unitPrice, bomData.total);
            }
            if (reviewing.products.length > 1) {
              setProductsCosting(reviewing.id, {
                boms: reviewing.products.map((_, i) => i === (bomData as any)?.productIndex ? bomData?.bom ?? null : reviewing.productsBillOfMaterials?.[i] ?? null),
                configs: reviewing.products.map((_, i) => i === (bomData as any)?.productIndex ? bomData?.costConfig ?? null : reviewing.productsCostConfig?.[i] ?? null),
                unitPrices: reviewing.products.map((_, i) => i === (bomData as any)?.productIndex ? bomData?.unitPrice ?? null : reviewing.productsUnitPrice?.[i] ?? null),
                totals: reviewing.products.map((_, i) => i === (bomData as any)?.productIndex ? bomData?.total ?? null : reviewing.productsQuotedTotal?.[i] ?? null),
              });
            }
            if (quotationDoc) {
              setQuotationDoc(reviewing.id, quotationDoc);
              updateInquiry(reviewing.id, {
                downpaymentPercent: quotationDoc.downpaymentPercent,
                downpaymentAmount: quotationDoc.downpaymentAmount,
                downpaymentConfirmed: quotationDoc.downpaymentPercent ? false : undefined,
              });
            }
            /* Section C2 — when this is a revision response, archive the previous quotationDoc and clear the revisionNote */
            if (reviewing.revisionNote) {
              const previousVersions = reviewing.quotationHistory ?? [];
              const archivedDoc = reviewing.quotationDoc;
              const newHistory = archivedDoc ? [...previousVersions, archivedDoc] : previousVersions;
              updateInquiry(reviewing.id, { quotationHistory: newHistory, revisionNote: undefined });
              pushNotif({
                dept: "sales",
                title: `📝 Revised quotation sent to ${reviewing.clientName}`,
                body: `${reviewing.code} · v${newHistory.length + 1}${quotationDoc ? ` · ${quotationDoc.quotationNo}` : ""}`,
                link: "orders",
                recipients: ["client"],
              });
            }
            pushNotif({
              dept: "sales",
              title: `Quotation sent: ${quotationDoc?.quotationNo ?? reviewing.code}`,
              body: `${reviewing.clientName} · awaiting PO · ${q.leadTimeDays} day lead time${bomData ? ` · ₱${bomData.unitPrice.toFixed(2)}/unit` : ""}`,
              link: "sales",
              recipients: ["owner", "operations", "sales", "client"],
            });
            setReviewId(null);
            toast.success(reviewing.revisionNote ? "Revised quotation sent" : "Quotation sent to client", { description: `${reviewing.clientName} notified in portal${quotationDoc ? ` · ${quotationDoc.quotationNo}` : ""}` });
          }}
        />
      )}

      {viewing && viewing.quotation && (
        <QuotationDetailModal inquiry={viewing} onClose={() => setViewQuoteId(null)} />
      )}

      {poViewing && (
        <POViewerModal inquiry={poViewing} onClose={() => setPoViewId(null)} />
      )}

      {generating && (
        <InvoicePreviewModal
          inquiry={generating}
          onClose={() => setGenerateId(null)}
          canSend={!!generating.invoiceNo && !generating.invoiceSentAt}
          onSend={() => sendInvoiceToClient(generating, () => setGenerateId(null))}
        />
      )}
      {showStockRequests && <StockRequestsModal mode="sales" onClose={() => setShowStockRequests(false)} />}
      {generatingJO && (
        <GenerateJOModal
          inquiry={generatingJO}
          onClose={() => setGenerateJoId(null)}
          onConfirm={(data) => {
            const jobOrders = Array.isArray(data) ? data : [data];
            const materialRequirements = jobOrders.map((job, index) => ({
              joNumber: job.joNumber,
              quantity: generatingJO.products[index]?.qty ?? 0,
              bom: resolveProductBOM(generatingJO, index),
              alreadyDeducted: completedJOs.some((existingJO) =>
                existingJO.joNumber === job.joNumber && existingJO.inventoryDeducted
              ),
            }));
            const validationResults = validateGeneratedJOs(materialRequirements);
            const validationWarnings = validationResults
              .filter((result) => result.status !== "ready" && result.status !== "already-deducted")
              .map((result) => {
                const detail = result.details?.join("; ");
                if (result.status === "no-bom") return `${result.joNumber}: no BOM is associated with this product; inventory was not deducted`;
                return `${result.joNumber}: ${result.status}${detail ? ` — ${detail}` : ""}`;
              });
            if (validationWarnings.length > 0) {
              toast.error("Cannot generate Job Order: inventory requirements could not be met", {
                description: validationWarnings.join(" · "),
                duration: 10000,
              });
              return;
            }

            const createdIds = finalizeProductJOs(generatingJO.id, jobOrders);
            if (createdIds.length === 0) {
              toast.info("Job Order already exists", { description: `${generatingJO.code} has already been submitted to Production` });
              setGenerateJoId(null);
              return;
            }
            const deductionResults = deductForGeneratedJOs(materialRequirements);
            deductionResults.forEach((result) => {
              if (result.status === "deducted" || result.status === "already-deducted") {
                markInventoryDeducted(result.joNumber);
              }
            });
            const deductionWarnings = deductionResults
              .filter((result) => result.status !== "deducted" && result.status !== "already-deducted")
              .map((result) => {
                const detail = result.details?.join("; ");
                if (result.status === "no-bom") return `${result.joNumber}: no BOM is associated with this product; inventory was not deducted`;
                return `${result.joNumber}: ${result.status}${detail ? ` — ${detail}` : ""}`;
              });
            if (deductionWarnings.length > 0) {
              toast.error("Inventory deduction was not completed for all Job Orders", {
                description: deductionWarnings.join(" · "),
                duration: 10000,
              });
            }
            const joNumbers = jobOrders.map((job) => job.joNumber);
            pushNotif({
              dept: "production",
              title: `Job Order created: ${joNumbers.join(", ")}`,
              body: `${generatingJO.clientName} · ${generatingJO.code} · ${generatingJO.products.reduce((sum, product) => sum + product.qty, 0)} pcs · submitted to Production`,
              link: "production",
              recipients: ["owner", "operations", "production"],
            });
            toast.success("JOB ORDER CREATED", { description: `${joNumbers.join(", ")} has been created and submitted to Production.` });
            setGenerateJoId(null);
          }}
        />
      )}
      {viewingInvoice && (
        <InvoicePreviewModal
          inquiry={viewingInvoice}
          onClose={() => setViewInvoiceId(null)}
          canSend={!!viewingInvoice.invoiceNo && !viewingInvoice.invoiceSentAt}
          onSend={() => sendInvoiceToClient(viewingInvoice, () => setViewInvoiceId(null))}
        />
      )}
      {showNewInquiry && (
        <ManagementNewInquiryModal
          onClose={() => setShowNewInquiry(false)}
          onSubmit={(data) => {
            const code = addInquiry(data);
            setShowNewInquiry(false);
            toast.success(`${code} created`, { description: `Inquiry for ${data.clientName} added to pipeline` });
          }}
        />
      )}
    </div>
  );
}

/* ---- Inquiry Card with collapsible product list ---- */
function InquiryCard({ inquiry, isNew, isReadyForJobOrder, collapsible, expanded, onToggle, onReview, onViewQuote, onViewPO, onMarkPOReceived, onGenerateJO, onGenerateInvoice, onViewInvoice, onReject, onAcceptCancel, onDeclineCancel }: {
  inquiry: Inquiry; isNew: boolean; isReadyForJobOrder: boolean; collapsible: boolean; expanded: boolean; onToggle: () => void; onReview: () => void; onViewQuote: () => void; onViewPO: () => void; onMarkPOReceived: () => void; onGenerateJO: () => void; onGenerateInvoice: () => void; onViewInvoice: () => void; onReject: (reason: string) => void; onAcceptCancel: () => void; onDeclineCancel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const total = quotationTotal(inquiry);
  const payment = paymentState(inquiry);
  const verifiedPaymentRecords = verifiedPayments(inquiry);
  const latestVerifiedPayment = verifiedPaymentRecords[verifiedPaymentRecords.length - 1];
  const verifiedTypeLabel = latestVerifiedPayment?.paymentType === "DOWNPAYMENT" ? "DOWNPAYMENT"
    : latestVerifiedPayment?.paymentType === "BALANCE_PAYMENT" ? "BALANCE PAYMENT"
    : latestVerifiedPayment?.paymentType === "FULL_PAYMENT" ? "FULL PAYMENT"
    : payment.requiredDownpaymentAmount > 0 ? "DOWNPAYMENT" : "FULL PAYMENT";
  const isDownpaymentPending = inquiry.stage === "po" && inquiry.poReceived && !isReadyForJobOrder
    && payment.requiredDownpaymentAmount > 0 && payment.downpaymentStatus !== "COMPLETE";
  const isAwaitingClientPayment = inquiry.stage === "po" && inquiry.poReceived && !isReadyForJobOrder
    && !!inquiry.invoiceNo && !!inquiry.invoiceSentAt;
  const isGenerateInvoicePending = inquiry.stage === "po" && inquiry.poReceived && !inquiry.invoiceNo;
  const cardBorderColor = inquiry.pendingCancellation ? "#FBBF24"
    : inquiry.urgent ? "#FECACA"
    : isReadyForJobOrder ? "#BBF7D0"
    : isDownpaymentPending || isGenerateInvoicePending ? "#FDBA74"
    : isAwaitingClientPayment ? "#FDE68A"
    : inquiry.stage === "po" && inquiry.poReceived ? "#BBF7D0"
    : "#E2E8F0";

  return (
    <article
      onClick={(event) => {
        if (!collapsible || (event.target instanceof Element && event.target.closest("button, a, input, textarea, select"))) return;
        onToggle();
      }}
      className={`rounded-lg border bg-white p-5 hover:shadow-sm transition-all ${collapsible ? "cursor-pointer" : ""}`}
      style={{ borderColor: cardBorderColor, borderWidth: inquiry.pendingCancellation ? 2 : 1 }}
    >
      {/* Pending cancellation banner */}
      {(!collapsible || expanded) && inquiry.pendingCancellation && (
        <div className="rounded-md p-3 mb-3" style={{ backgroundColor: "#FFFBEB", border: "1.5px solid #FDE68A" }}>
          <div className="flex items-center gap-2 mb-1">
            <span style={{ fontSize: 14 }}>⏳</span>
            <span className="font-dm" style={{ fontSize: 11, fontWeight: 800, color: "#92400E", letterSpacing: 0.4, textTransform: "uppercase" }}>Cancellation Requested by {inquiry.pendingCancellation.requestedBy === "client" ? "Client" : "Management"}</span>
          </div>
          <div className="font-dm mb-2" style={{ fontSize: 12, color: "#92400E" }}>Reason: <span style={{ fontWeight: 600 }}>{inquiry.pendingCancellation.reason}</span></div>
          <div className="font-dm mb-2" style={{ fontSize: 11, color: "#B45309" }}>Requested {inquiry.pendingCancellation.requestedAt}</div>
          <div className="flex items-center gap-2">
            <button onClick={onAcceptCancel} className="font-dm flex items-center gap-1 px-2.5 py-1.5 rounded-md text-white" style={{ fontSize: 11, fontWeight: 700, backgroundColor: "#C8102E" }}>
              <CheckCircle2 size={11} /> Accept Cancel
            </button>
            <button onClick={onDeclineCancel} className="font-dm flex items-center gap-1 px-2.5 py-1.5 rounded-md border" style={{ fontSize: 11, fontWeight: 700, color: "#475569", borderColor: "#CBD5E1" }}>
              <X size={11} /> Decline
            </button>
            <span className="font-dm ml-auto" style={{ fontSize: 10, color: "#92400E", fontStyle: "italic" }}>If decline, contact client via email</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3 gap-2">
        <span className="font-mono-jb" style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}>{inquiry.code}</span>
        <div className="flex items-center gap-2">
          {inquiry.urgent && (
            <span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.4, backgroundColor: "#FEE2E2", color: "#C8102E" }}>🚨 RUSH</span>
          )}
          {isNew && inquiry.stage === "inquiry" && (
            <span className="font-syne px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, backgroundColor: "#FFEDD5", color: "#9A3412" }}>
              NEW CLIENT
            </span>
          )}
          {total > 0 && (
            <span className="font-syne" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>₱{total.toLocaleString("en-PH")}</span>
          )}
          {collapsible && (
            <button
              type="button"
              onClick={onToggle}
              className="flex items-center justify-center rounded-full p-1 hover:bg-slate-100"
              style={{ color: "#64748B" }}
              aria-label={expanded ? "Collapse order details" : "Expand order details"}
              aria-expanded={expanded}
            >
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          )}
        </div>
      </div>

      <div className="font-dm mb-1.5" style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>{inquiry.clientName}</div>
      <div className="font-dm mb-2" style={{ fontSize: 12, color: "#64748B" }}>{inquiry.contactPerson} · {inquiry.paymentTerms}</div>
      {collapsible && !expanded && (
        <div className="flex flex-col items-start gap-2">
          <span className="font-dm px-2.5 py-1 rounded-full flex items-center gap-1" style={{ fontSize: 11, fontWeight: 700, color: "#92400E", backgroundColor: "#FEF3C7" }}>
            {inquiry.products.length} {inquiry.products.length === 1 ? "product" : "products"}
          </span>
          <div className="flex flex-col items-start gap-1.5">
            {isReadyForJobOrder && (
              <span className="font-dm px-2 py-1 rounded-full" style={{ fontSize: 10, fontWeight: 700, color: "#15803D", backgroundColor: "#F0FDF4" }}>PAYMENT VERIFIED</span>
            )}
            {!isReadyForJobOrder && inquiry.stage === "po" && inquiry.poReceived && inquiry.invoiceNo && inquiry.invoiceSentAt && (
              <span className="font-dm px-2 py-1 rounded-full" style={{ fontSize: 10, fontWeight: 700, color: "#92400E", backgroundColor: "#FFFBEB" }}>INVOICE SENT · AWAITING CLIENT PAYMENT</span>
            )}
            {inquiry.stage === "quotation" && !hasPORecord(inquiry) && (
              <span className="font-dm px-2 py-1 rounded-full" style={{ fontSize: 10, fontWeight: 700, color: "#92400E", backgroundColor: "#FFFBEB" }}>QUOTATION SENT · AWAITING CLIENT PO</span>
            )}
            {isDownpaymentPending && (
              <span className="font-dm px-2 py-1 rounded-full" style={{ fontSize: 10, fontWeight: 700, color: "#C2410C", backgroundColor: "#FFF7ED" }}>REQUIRED DOWNPAYMENT PENDING</span>
            )}
          </div>
        </div>
      )}
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${!collapsible || expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        inert={collapsible && !expanded}
      >
        <div className="min-h-0 overflow-hidden">
          <div className={collapsible ? "pt-2" : ""}>
      {inquiry.urgent && inquiry.dueDate && (
        <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 600, color: "#C8102E" }}>⏰ Required by: {inquiry.dueDate}</div>
      )}

      <div className="flex flex-col items-start mb-4 gap-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="font-dm px-2.5 py-1 rounded-full flex items-center gap-1"
          style={{ fontSize: 11, fontWeight: 700, color: "#92400E", backgroundColor: "#FEF3C7" }}
        >
          {inquiry.products.length} {inquiry.products.length === 1 ? "product" : "products"}
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {((inquiry.stage === "quotation" || inquiry.stage === "po") && inquiry.quotation)
          || (inquiry.stage === "po" && hasPORecord(inquiry) && inquiry.poFileName) ? (
          <div className="flex flex-wrap items-center gap-2">
            {(inquiry.stage === "quotation" || inquiry.stage === "po") && inquiry.quotation && (
              <button onClick={onViewQuote} className="font-dm flex items-center gap-1 px-2.5 py-1.5 rounded-md hover:bg-red-50" style={{ fontSize: 11, fontWeight: 600, color: "#C8102E", border: "1px solid #FECACA" }}>
                <Calculator size={12} /> View Quotation
              </button>
            )}
            {inquiry.stage === "po" && hasPORecord(inquiry) && inquiry.poFileName && (
              <button onClick={onViewPO} className="font-dm flex items-center gap-1 px-2.5 py-1.5 rounded-md hover:bg-green-50" style={{ fontSize: 11, color: "#16A34A", fontWeight: 700, border: "1px solid #BBF7D0" }} title="View client-submitted PO">
                <Eye size={11} /> View PO
              </button>
            )}
          </div>
        ) : null}
      </div>

      {open && (
        <div className="rounded-md mb-4 p-2.5 flex flex-col gap-1.5" style={{ backgroundColor: "#F8FAFC" }}>
          {inquiry.products.map((p, i) => (
            <div key={p.id} className="font-dm flex items-start justify-between gap-2" style={{ fontSize: 12 }}>
              <span style={{ color: "#0F172A" }}>
                <span style={{ fontWeight: 700 }}>#{i + 1} {p.filterName || p.type}</span>
                {p.oem && <span style={{ color: "#64748B" }}> · {p.oem}</span>}
              </span>
              <span style={{ color: "#475569", fontWeight: 600, whiteSpace: "nowrap" }}>×{p.qty}</span>
            </div>
          ))}
        </div>
      )}

      {inquiry.stage === "inquiry" && (
        <button
          onClick={onReview}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-white font-dm hover:opacity-90"
          style={{ backgroundColor: "#1A2B4A", fontSize: 12, fontWeight: 700, letterSpacing: 0.4 }}
        >
          <Calculator size={13} /> REVIEW &amp; SEND QUOTATION <ArrowRight size={14} />
        </button>
      )}
      {inquiry.stage === "quotation" && inquiry.revisionNote && (
        <button
          onClick={onReview}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-white font-dm hover:opacity-90 mb-2"
          style={{ backgroundColor: "#D97706", fontSize: 12, fontWeight: 700, letterSpacing: 0.4 }}
          title={`Client note: ${inquiry.revisionNote}`}
        >
          📝 Review Revision Request →
        </button>
      )}
      {inquiry.stage === "quotation" && !hasPORecord(inquiry) && (
        <div className="w-full rounded-md px-3 py-2 font-dm text-center" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", fontSize: 11, fontWeight: 700, color: "#92400E" }}>
          QUOTATION SENT · AWAITING CLIENT PO
        </div>
      )}
      {inquiry.stage === "po" && hasPORecord(inquiry) && inquiry.poFileName && !inquiry.poReceived && (
        <button
          onClick={onMarkPOReceived}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md font-dm border border-slate-300 hover:bg-slate-50"
          style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}
        >
          <Upload size={13} /> MARK PO RECEIVED
        </button>
      )}
      {inquiry.stage === "po" && hasPORecord(inquiry) && inquiry.poReceived && (
        <div className="w-full mb-3 rounded-md px-3 py-2.5" style={{ backgroundColor: "#F0FDF4", border: "1.5px solid #86EFAC", color: "#15803D", fontSize: 12, fontWeight: 800, letterSpacing: 0.4 }}>
          ✓ PO RECEIVED
        </div>
      )}
      {isReadyForJobOrder && (
        <div className="flex flex-col gap-3">
          <div className="rounded-md p-3.5" style={{ backgroundColor: "#F0FDF4", border: "1.5px solid #86EFAC" }}>
            <div className="font-dm flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 800, color: "#15803D", letterSpacing: 0.4 }}>
              ✓ PAYMENT VERIFIED
            </div>
            <div className="font-dm mt-1" style={{ fontSize: 11, color: "#166534" }}>
              Invoice: <strong>{inquiry.invoiceNo}</strong>
            </div>
            <div className="font-dm mt-1" style={{ fontSize: 11, color: "#166534" }}>
              Payment: <strong>{verifiedTypeLabel}</strong> · Verified: <strong>{peso(payment.totalVerifiedPayments)}</strong>
            </div>
            <div className="font-dm mt-1" style={{ fontSize: 11, color: "#166534" }}>
              Remaining Balance: <strong>{peso(payment.remainingInvoiceBalance)}</strong>
            </div>
          </div>
          <button
            onClick={onGenerateJO}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-white font-dm hover:opacity-90"
            style={{ backgroundColor: "#C8102E", fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}
          >
            <FileText size={14} strokeWidth={2.5} /> GENERATE JO <ArrowRight size={14} strokeWidth={2.5} />
          </button>
        </div>
      )}
      {inquiry.stage === "po" && !isReadyForJobOrder && hasPORecord(inquiry) && inquiry.poFileName && inquiry.poReceived && (
        <>
          {/* ── Downpayment Banner ── */}
          {(inquiry.downpaymentPercent ?? 0) > 0 && (
            <div className="mb-2 rounded-md p-3" style={{ backgroundColor: payment.downpaymentStatus === "COMPLETE" ? "#F0FDF4" : "#FFF7ED", border: `1.5px solid ${payment.downpaymentStatus === "COMPLETE" ? "#86EFAC" : "#FDBA74"}` }}>
              <div className="font-dm flex items-center gap-1.5 mb-1" style={{ fontSize: 11, fontWeight: 800, color: payment.downpaymentStatus === "COMPLETE" ? "#15803D" : "#C2410C", letterSpacing: 0.4, textTransform: "uppercase" }}>
                {payment.downpaymentStatus === "COMPLETE" ? "✅ Required Downpayment Verified" : "⏳ Required Downpayment Pending"}
              </div>
              <div className="font-dm" style={{ fontSize: 12, color: payment.downpaymentStatus === "COMPLETE" ? "#166534" : "#9A3412" }}>
                {inquiry.downpaymentPercent}% of total
                {inquiry.downpaymentAmount ? ` = ₱${inquiry.downpaymentAmount.toLocaleString("en-PH")}` : ""}
              </div>
              {payment.verifiedDownpaymentAmount > 0 && payment.downpaymentStatus !== "COMPLETE" && (
                <div className="font-dm mt-1" style={{ fontSize: 10, color: "#C2410C" }}>
                  Verified so far: {peso(payment.verifiedDownpaymentAmount)} · Remaining: {peso(payment.remainingDownpayment)}
                </div>
              )}
              {payment.downpaymentStatus === "COMPLETE" && (
                <div className="font-dm mt-1" style={{ fontSize: 10, color: "#64748B" }}>
                  Accounting verification complete · balance may remain payable
                </div>
              )}
            </div>
          )}
          {inquiry.invoiceNo ? (
            <div className="rounded-md mt-3 p-3.5" style={{ backgroundColor: "#F0FDF4", border: "1.5px solid #86EFAC" }}>
              {!!inquiry.invoiceNo && !!inquiry.invoiceSentAt && (
                <div className="font-dm flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 800, color: "#15803D", letterSpacing: 0.4 }}>
                  ✓ INVOICE SENT
                </div>
              )}
              <div className="font-dm flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 800, color: "#15803D", letterSpacing: 0.4 }}>
                ✓ INVOICE GENERATED
              </div>
              <div className="font-mono-jb mt-1" style={{ fontSize: 12, fontWeight: 700, color: "#166534" }}>{inquiry.invoiceNo}</div>
              <div className="font-syne" style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{peso(inquiry.invoiceAmount ?? total)}</div>
              {!!inquiry.invoiceNo && !!inquiry.invoiceSentAt ? (
                <div className="font-dm mt-1" style={{ fontSize: 10, fontWeight: 700, color: "#92400E", letterSpacing: 0.35 }}>INVOICE SENT · AWAITING CLIENT PAYMENT</div>
              ) : (
                <>
                  <div className="font-dm mt-1" style={{ fontSize: 10, fontWeight: 700, color: "#92400E", letterSpacing: 0.35 }}>DRAFT — NOT SENT</div>
                  <div className="font-dm mt-1" style={{ fontSize: 10, fontWeight: 700, color: "#166534", letterSpacing: 0.35 }}>READY FOR SALES REVIEW</div>
                </>
              )}
              <button onClick={onViewInvoice} className="w-full mt-2 rounded-md px-3 py-2 font-dm" style={{ backgroundColor: "#FFFFFF", border: "1px solid #86EFAC", color: "#166534", fontSize: 11, fontWeight: 800 }}>VIEW INVOICE</button>
            </div>
          ) : (
            <button
              onClick={onGenerateInvoice}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-white font-dm hover:opacity-90"
              style={{ backgroundColor: "#D97706", fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}
            >
              <FileText size={14} strokeWidth={2.5} /> GENERATE INVOICE <ArrowRight size={14} strokeWidth={2.5} />
            </button>
          )}
        </>
      )}

      {/* Reject inquiry — only on New Inquiry stage. Prominent red button with warning icon. */}
      {inquiry.stage === "inquiry" && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          {!confirmReject ? (
            <button
              onClick={() => setConfirmReject(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md font-dm border-2 hover:bg-red-50 transition-colors"
              style={{ fontSize: 11, fontWeight: 700, color: "#C8102E", borderColor: "#FECACA", backgroundColor: "#FFFFFF", letterSpacing: 0.4 }}
            >
              <AlertTriangle size={12} strokeWidth={2.5} /> REJECT INQUIRY
            </button>
          ) : (
            <div className="rounded-md p-2.5 flex flex-col gap-2" style={{ backgroundColor: "#FEF2F2", border: "1.5px solid #FECACA" }}>
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={12} style={{ color: "#C8102E" }} />
                <span className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#991B1B" }}>Reason for rejection (required)</span>
              </div>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Specs cannot be produced · client unreachable · price negotiation failed"
                rows={2}
                className="font-dm px-2 py-1.5 rounded border border-red-200 outline-none focus:border-red-400 bg-white resize-none"
                style={{ fontSize: 11, color: "#0F172A" }}
              />
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => { setConfirmReject(false); setRejectReason(""); }} className="font-dm px-2 py-1 rounded hover:bg-white" style={{ fontSize: 11, color: "#64748B" }}>Cancel</button>
                <button
                  onClick={() => {
                    if (!rejectReason.trim()) { toast.error("A reason is required"); return; }
                    onReject(rejectReason.trim());
                  }}
                  disabled={!rejectReason.trim()}
                  className="font-dm px-2.5 py-1 rounded text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                  style={{ fontSize: 11, fontWeight: 700, backgroundColor: "#C8102E" }}
                >
                  <AlertTriangle size={10} /> Reject &amp; Notify Client
                </button>
              </div>
            </div>
          )}
        </div>
      )}
          </div>
        </div>
      </div>
    </article>
  );
}

/* ---- Review & Send Quotation Modal (with Raw Materials Plan) ---- */
interface OtherMat { id: string; name: string }
interface MatPlan {
  mediaSource: "Local" | "Imported";
  mediaRolls: number;
  adhesiveSets: number;
  boxPcs: number;
  others: OtherMat[];
}
const blankPlan = (qty: number): MatPlan => ({
  mediaSource: "Local",
  mediaRolls: 0,
  adhesiveSets: 0,
  boxPcs: qty,
  others: [],
});

function ReviewQuotationModal({ inquiry, onClose, onSubmit }: { inquiry: Inquiry; onClose: () => void; onSubmit: (q: Quotation, bomData?: { bom: BOMLine[]; costConfig: CostConfig; unitPrice: number; total: number; productIndex?: number }, quotationDoc?: QuotationDoc) => void }) {
  const { isNewClient } = useOrders();
  const [leadDays, setLeadDays] = useState(inquiry.quotation?.leadTimeDays ?? 14);
  /* Section H — default to inquiry tab for ALL clients, not just new ones */
  const [activeTab, setActiveTab] = useState<"inquiry" | "cost" | "quote">("inquiry");
  /* Per-product BOM data — one slot per product, null until that product's Tab 2 is applied */
  const [perProductBomData, setPerProductBomData] = useState<Array<{ bom: BOMLine[]; costConfig: CostConfig; unitPrice: number; total: number; productIndex?: number } | null>>(
    inquiry.products.map(() => null)
  );
  const [lines, setLines] = useState<QuotationLine[]>(
    inquiry.products.map((p) => {
      const existing = inquiry.quotation?.lines.find((l) => l.productId === p.id);
      return existing ?? { productId: p.id, materialCost: 0, labor: 0, markupPct: 30 };
    })
  );
  const [plans, setPlans] = useState<MatPlan[]>(inquiry.products.map((p) => blankPlan(p.qty)));

  const updateLine = (idx: number, patch: Partial<QuotationLine>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };
  const updatePlan = (idx: number, patch: Partial<MatPlan>) => {
    setPlans((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const total = lines.reduce((sum, l) => {
    const p = inquiry.products.find((pp) => pp.id === l.productId);
    return sum + (p ? unitPrice(l) * p.qty : 0);
  }, 0);

  /* Derive a single bomData reference for legacy callers — use the last non-null product entry */
  const bomData = perProductBomData.reduce<typeof perProductBomData[0]>((acc, d) => d ?? acc, null);
  const discounts = inquiry.products.flatMap((product, index) => {
    const percent = perProductBomData[index]?.costConfig.discountPct
      ?? inquiry.productsCostConfig?.[index]?.discountPct
      ?? (index === 0 ? inquiry.costConfig?.discountPct : undefined)
      ?? 0;
    return percent > 0
      ? [{ label: inquiry.products.length === 1 ? "Discount" : (product.filterName || product.type), percent }]
      : [];
  });

  const submit = () => {
    onSubmit(
      {
        sentDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        leadTimeDays: leadDays,
        lines,
      },
      bomData ?? undefined
    );
  };

  return (
    <ModalShell title={`Review & Send Quotation · ${inquiry.code}`} subtitle={`${inquiry.clientName} · ${inquiry.contactPerson} · ${inquiry.paymentTerms}`} onClose={onClose} size="lg">
      <div className="flex gap-1 border-b border-slate-200 mb-5 -mt-2">
        {[
          { id: "inquiry" as const, label: "1 · Inquiry Details" },
          { id: "cost" as const,    label: "2 · Cost & Material Estimation" },
          { id: "quote" as const,   label: "3 · Quotation" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="px-4 py-2.5 font-dm transition-colors"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: activeTab === t.id ? "#C8102E" : "#64748B",
              borderBottom: activeTab === t.id ? "3px solid #C8102E" : "3px solid transparent",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {inquiry.generalNotes && (
        <div className="mb-4 rounded-lg p-3 font-dm" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", fontSize: 12, color: "#92400E" }}>
          <span style={{ fontWeight: 700 }}>Client notes:</span> {inquiry.generalNotes}
        </div>
      )}

      {activeTab === "inquiry" && (
        <InquiryDetailsTab inquiry={inquiry} isNew={isNewClient(inquiry.clientName)} onStart={() => setActiveTab("cost")} />
      )}

      {activeTab === "cost" && (
        <CostEstimationPanel
          inquiry={inquiry}
          qty={inquiry.products.reduce((s, p) => s + p.qty, 0)}
          onApply={(data) => {
            const idx = data.productIndex ?? 0;
            /* Store BOM result only for this product — don't overwrite other products */
            setPerProductBomData((prev) => prev.map((d, i) => i === idx ? data : d));
            /* Mirror the BOM-derived per-unit price into ONLY this product's quotation line */
            setLines((prev) => prev.map((l, i) => i === idx ? {
              ...l,
              materialCost: data.costConfig.includeLabor ? data.unitPrice / (1 + data.costConfig.markupPct / 100) - data.costConfig.laborCost : data.unitPrice / (1 + data.costConfig.markupPct / 100),
              labor: data.costConfig.laborCost,
              markupPct: data.costConfig.markupPct,
            } : l));
            setActiveTab("quote");
          }}
        />
      )}

      {activeTab === "quote" && (
        <QuotationBuilder
          inquiry={inquiry}
          productBoms={inquiry.products.map((_, index) =>
            perProductBomData[index]?.bom ?? resolveProductBOM(inquiry, index) ?? null
          )}
          manufacturingUnitCost={bomData?.unitPrice ?? inquiry.unitPrice ?? 0}
          productsManufacturingUnitCosts={perProductBomData.map((d) => d?.unitPrice ?? null)}
          discounts={discounts}
          vatType={bomData?.costConfig.vatType ?? inquiry.costConfig?.vatType ?? "Exclusive"}
          onSendToClient={(doc, total, leadTimeDays) => {
            /* Sync quotation lines per-product using the per-product BOM data */
            const newLines: QuotationLine[] = inquiry.products.map((p, i) => {
              const pd = perProductBomData[i];
              return {
                productId: p.id,
                materialCost: pd?.costConfig.includeLabor
                  ? (pd.unitPrice) / (1 + (pd.costConfig.markupPct) / 100) - (pd.costConfig.laborCost)
                  : (pd?.unitPrice ?? 0) / (1 + ((pd?.costConfig.markupPct ?? 0)) / 100),
                labor: pd?.costConfig.laborCost ?? 0,
                markupPct: pd?.costConfig.markupPct ?? 0,
              };
            });
            setLines(newLines);
            setLeadDays(leadTimeDays);
            const q: Quotation = { sentDate: doc.date, leadTimeDays, lines: newLines };
            onSubmit(q, bomData ?? undefined, doc);
            void total;
          }}
        />
      )}
    </ModalShell>
  );
}

function InquiryDetailsTab({ inquiry, isNew, onStart }: { inquiry: Inquiry; isNew: boolean; onStart: () => void }) {
  const totalQty = inquiry.products.reduce((s, p) => s + p.qty, 0);
  const sketch = inquiry.inquirySketch;

  return (
    <div className="flex flex-col gap-4">
      {/* RUSH banner */}
      {inquiry.urgent && (
        <div className="rounded-lg p-3 flex items-center gap-2.5" style={{ backgroundColor: "#FEF2F2", border: "1.5px solid #FECACA" }}>
          <span style={{ fontSize: 18 }}>🚨</span>
          <div>
            <div className="font-dm" style={{ fontSize: 13, fontWeight: 800, color: "#991B1B", letterSpacing: 0.4 }}>RUSH ORDER — priority production</div>
            {inquiry.dueDate && <div className="font-dm mt-0.5" style={{ fontSize: 12, color: "#7F1D1D" }}>Required by: <strong>{inquiry.dueDate}</strong></div>}
          </div>
        </div>
      )}

      {/* New client banner */}
      {isNew && (
        <div className="rounded-lg p-4 flex items-start gap-3" style={{ backgroundColor: "#FFEDD5", border: "1px solid #FDBA74" }}>
          <Info size={16} style={{ color: "#9A3412", marginTop: 2 }} />
          <div className="font-dm" style={{ fontSize: 13, color: "#9A3412" }}>
            <span style={{ fontWeight: 700 }}>New client · Custom filter order.</span> Review the full inquiry below — including any sketch the client uploaded — before pricing in Tab 2.
          </div>
        </div>
      )}

      {/* Client / submission card */}
      <div className="rounded-xl border border-slate-200 overflow-hidden" style={{ backgroundColor: "white" }}>
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between" style={{ backgroundColor: "#F8FAFC" }}>
          <div className="font-syne" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>📋 Client Submission</div>
          <span className="font-mono-jb" style={{ fontSize: 11, color: "#64748B" }}>{inquiry.code} · submitted {inquiry.submittedDate}</span>
        </div>
        <div className="grid grid-cols-4 gap-4 p-5">
          <DetailField label="Company">{inquiry.clientName}</DetailField>
          <DetailField label="Contact Person">{inquiry.contactPerson}</DetailField>
          <DetailField label="Payment Terms">{inquiry.paymentTerms}</DetailField>
          <DetailField label="Total Qty">{totalQty} pcs across {inquiry.products.length} product{inquiry.products.length === 1 ? "" : "s"}</DetailField>
        </div>
        {inquiry.generalNotes && (
          <div className="px-5 pb-5">
            <div className="font-dm mb-1" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>General Notes from Client</div>
            <div className="rounded-md p-3 font-dm" style={{ fontSize: 13, color: "#0F172A", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", lineHeight: 1.5 }}>
              {inquiry.generalNotes}
            </div>
          </div>
        )}
      </div>

      {/* Sketch viewer */}
      <div className="rounded-xl border border-slate-200 overflow-hidden" style={{ backgroundColor: "white" }}>
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between" style={{ backgroundColor: "#EFF6FF" }}>
          <div className="font-syne flex items-center gap-2" style={{ fontSize: 13, fontWeight: 700, color: "#1E40AF" }}>
            <Paperclip size={13} /> Engineer Sketch / Drawing
            {sketch ? (
              <span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: "#DBEAFE", color: "#1D4ED8" }}>ATTACHED</span>
            ) : (
              <span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: "#E2E8F0", color: "#64748B" }}>NOT ATTACHED</span>
            )}
          </div>
          {sketch && (
            <button onClick={() => toast.info(`Opening: ${sketch}`, { description: "In production, this opens the actual file" })} className="font-dm flex items-center gap-1 px-2.5 py-1 rounded-md hover:bg-blue-100" style={{ fontSize: 11, fontWeight: 700, color: "#1A2B4A", border: "1px solid #BFDBFE" }}>
              <Eye size={11} /> Open Drawing
            </button>
          )}
        </div>
        <div className="p-5">
          {sketch ? (
            <div className="rounded-lg flex flex-col items-center justify-center py-8 gap-3" style={{ backgroundColor: "#F8FAFC", border: "1.5px dashed #93C5FD", minHeight: 200 }}>
              {sketch.match(/\.(png|jpe?g|gif|webp|svg)$/i) ? (
                <img src={sketch} alt="Client sketch" style={{ maxWidth: "100%", maxHeight: 320, objectFit: "contain" }} />
              ) : (
                <>
                  <div style={{ width: 64, height: 80, backgroundColor: "white", border: "2px solid #1A2B4A", borderRadius: 4, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <span style={{ fontSize: 22 }}>📄</span>
                    <span className="font-dm" style={{ fontSize: 8, fontWeight: 800, color: "#1A2B4A", letterSpacing: 0.5 }}>
                      {sketch.match(/\.([a-z]+)$/i)?.[1].toUpperCase() ?? "FILE"}
                    </span>
                  </div>
                  <div className="text-center">
                    <div className="font-mono-jb" style={{ fontSize: 13, fontWeight: 700, color: "#1A2B4A", wordBreak: "break-all", maxWidth: 360 }}>{sketch}</div>
                    <div className="font-dm mt-1" style={{ fontSize: 11, color: "#64748B" }}>Client-uploaded drawing — review before pricing</div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="rounded-lg p-6 text-center font-dm" style={{ fontSize: 12, color: "#94A3B8", backgroundColor: "#F8FAFC", border: "1px dashed #CBD5E1" }}>
              No sketch attached. The client described their requirements via the inquiry form fields above and notes below.
              <br /><span style={{ fontSize: 11 }}>If a drawing is needed, request one via email before quoting.</span>
            </div>
          )}
        </div>
      </div>

      {/* Product specs table */}
      <div className="rounded-xl border border-slate-200 overflow-hidden" style={{ backgroundColor: "white" }}>
        <div className="px-5 py-3 border-b border-slate-200" style={{ backgroundColor: "#F8FAFC" }}>
          <div className="font-syne" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Product Specifications · {inquiry.products.length} item{inquiry.products.length === 1 ? "" : "s"}</div>
        </div>
        <table className="w-full">
          <thead style={{ backgroundColor: "#F4F6F9" }}>
            <tr>
              {["#", "Type", "OD1/OD2", "ID1/ID2", "H", "Media", "Inner / Outer", "O-Ring / Gasket", "OEM", "Qty", "Line Notes"].map((h) => (
                <th key={h} className="font-dm text-left px-3 py-2" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inquiry.products.map((p, i) => (
              <tr key={p.id} className="border-t border-slate-200 align-top">
                <td className="px-3 py-2.5 font-syne" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>#{i + 1}</td>
                <td className="px-3 py-2.5 font-dm" style={{ fontSize: 13, color: "#0F172A", fontWeight: 600 }}>{p.type}</td>
                <td className="px-3 py-2.5 font-mono-jb" style={{ fontSize: 11, color: "#475569" }}>{p.od1 || "—"} / {p.od2 || "—"}</td>
                <td className="px-3 py-2.5 font-mono-jb" style={{ fontSize: 11, color: "#475569" }}>{p.id1 || "—"} / {p.id2 || "—"}</td>
                <td className="px-3 py-2.5 font-mono-jb" style={{ fontSize: 11, color: "#475569" }}>{p.height || "—"}</td>
                <td className="px-3 py-2.5 font-dm" style={{ fontSize: 12, color: "#475569" }}>{p.media || "—"}</td>
                <td className="px-3 py-2.5 font-dm" style={{ fontSize: 12, color: "#475569" }}>{p.innerCore || "—"} / {p.outerCore || "—"}</td>
                <td className="px-3 py-2.5 font-dm" style={{ fontSize: 12, color: "#475569" }}>{p.oring || "—"} / {p.gasket || "—"}</td>
                <td className="px-3 py-2.5 font-mono-jb" style={{ fontSize: 11, color: "#475569" }}>{p.oem || "—"}</td>
                <td className="px-3 py-2.5 font-syne" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{p.qty}</td>
                <td className="px-3 py-2.5 font-dm" style={{ fontSize: 12, color: "#475569" }}>{p.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={onStart}
          className="font-dm px-4 py-2.5 rounded-md text-white hover:opacity-90 flex items-center gap-2"
          style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.4 }}
        >
          📋 START QUOTATION <ArrowRight size={14} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</div>
      <div className="font-dm mt-0.5" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{children}</div>
    </div>
  );
}

function MaterialPlanBlock({ index, product, plan, onChange, onAcceptLead }: {
  index: number; product: ProductLine; plan: MatPlan;
  onChange: (p: Partial<MatPlan>) => void; onAcceptLead: (days: number) => void;
}) {
  const { get } = useMaterials();
  const media = get(plan.mediaSource === "Local" ? "mediaLocal" : "mediaImported");
  const adhesive = get("adhesive");
  const box = get("box");

  const checks: { mat: Material; need: number }[] = [
    { mat: media, need: plan.mediaRolls },
    { mat: adhesive, need: plan.adhesiveSets },
    { mat: box, need: plan.boxPcs },
  ];

  const shortages = checks.filter((c) => c.need > 0 && c.need > c.mat.available);
  const hasInputs = checks.some((c) => c.need > 0);
  const longest = shortages.find((s) => s.mat.key === "box") || shortages[0];
  const suggested = longest ? 28 : 14;

  const addOther = () =>
    onChange({ others: [...plan.others, { id: `o-${Date.now()}`, name: "" }] });
  const updateOther = (id: string, name: string) =>
    onChange({ others: plan.others.map((o) => (o.id === id ? { ...o, name } : o)) });
  const removeOther = (id: string) =>
    onChange({ others: plan.others.filter((o) => o.id !== id) });

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-2.5" style={{ backgroundColor: "#F4F6F9" }}>
        <div className="font-syne" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
          PRODUCT {index + 1} — {product.type}
          {product.od1 && <span className="font-dm ml-1" style={{ fontWeight: 500, color: "#475569" }}>{product.od1}×{product.id1}×{product.height}mm</span>}
          <span className="font-dm ml-2" style={{ fontSize: 12, fontWeight: 500, color: "#64748B" }}>· Qty: {product.qty}</span>
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Filter Media Type">
              <select value={plan.mediaSource} onChange={(e) => onChange({ mediaSource: e.target.value as "Local" | "Imported" })} className="form-input-sm">
                <option>Local</option><option>Imported</option>
              </select>
            </Field>
            <Field label={`Rolls Needed (${media.unit})`}>
              <input type="number" value={plan.mediaRolls} onChange={(e) => onChange({ mediaRolls: Number(e.target.value) })} className="form-input-sm" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Adhesive Sets">
              <input type="number" value={plan.adhesiveSets} onChange={(e) => onChange({ adhesiveSets: Number(e.target.value) })} className="form-input-sm" />
            </Field>
            <Field label="Corrugated Box (pcs)">
              <input type="number" value={plan.boxPcs} onChange={(e) => onChange({ boxPcs: Number(e.target.value) })} className="form-input-sm" />
            </Field>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Other Materials (optional)</span>
            {plan.others.map((o) => (
              <div key={o.id} className="flex items-center gap-2">
                <input value={o.name} onChange={(e) => updateOther(o.id, e.target.value)} placeholder="Material name" className="form-input-sm flex-1" />
                <button onClick={() => removeOther(o.id)} className="w-7 h-7 rounded-md hover:bg-slate-100 flex items-center justify-center" style={{ color: "#64748B" }}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <button onClick={addOther} className="font-dm self-start" style={{ fontSize: 12, color: "#C8102E", fontWeight: 600 }}>
              + Add other material
            </button>
            <span className="font-dm" style={{ fontSize: 11, color: "#94A3B8" }}>Other materials are tracked here for reference only — not in inventory system.</span>
          </div>
        </div>

        <div>
          <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" }}>📊 Stock Check Result</div>
          {!hasInputs ? (
            <div className="rounded-md p-3 font-dm" style={{ backgroundColor: "#F8FAFC", border: "1px dashed #CBD5E1", fontSize: 12, color: "#94A3B8" }}>
              Enter material quantities to check stock.
            </div>
          ) : (
            <div className="rounded-md p-3 flex flex-col gap-2.5" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              {checks.map((c) => {
                if (c.need <= 0) return null;
                const ok = c.need <= c.mat.available;
                const short = ok ? 0 : c.need - c.mat.available;
                return (
                  <div key={c.mat.key} className="font-dm" style={{ fontSize: 12 }}>
                    <div style={{ color: "#0F172A", fontWeight: 600 }}>{c.mat.label}: {c.mat.available} {c.mat.unit} available</div>
                    <div style={{ color: ok ? "#16A34A" : "#C8102E", fontWeight: 700 }}>
                      You need: {c.need} {c.mat.unit} → {ok ? "✅ Sufficient" : "⚠️ LOW STOCK"}
                    </div>
                    {!ok && (
                      <div style={{ color: "#92400E", fontSize: 11 }}>
                        Shortfall: {short} {c.mat.unit} · Lead time: {c.mat.leadTime}
                      </div>
                    )}
                  </div>
                );
              })}
              {shortages.length > 0 && (
                <div className="mt-1 pt-2 border-t border-slate-200 flex flex-col gap-2">
                  <div className="font-dm" style={{ fontSize: 12, color: "#92400E" }}>
                    ⚠️ Recommendation: Add 14+ days to lead time. Suggested: <span style={{ fontWeight: 700 }}>{suggested} days</span> instead of 14.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => onAcceptLead(suggested)}
                      className="font-dm px-3 py-1.5 rounded-md text-white"
                      style={{ backgroundColor: "#1A2B4A", fontSize: 11, fontWeight: 700, letterSpacing: 0.3 }}
                    >
                      Accept Suggested Lead Time
                    </button>
                    <button
                      onClick={() => onAcceptLead(14)}
                      className="font-dm px-3 py-1.5 rounded-md border border-slate-300 hover:bg-white"
                      style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}
                    >
                      Keep Original
                    </button>
                    <button
                      onClick={() => toast("Opening inventory order form...")}
                      className="font-dm px-3 py-1.5 rounded-md border-2"
                      style={{ borderColor: "#C8102E", color: "#C8102E", fontSize: 11, fontWeight: 700, letterSpacing: 0.3 }}
                    >
                      📦 Order Boxes Now
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductCostBlock({ index, product, line, onChange }: { index: number; product: ProductLine; line: QuotationLine; onChange: (p: Partial<QuotationLine>) => void }) {
  const unit = unitPrice(line);
  const sub = unit * product.qty;
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: "#F4F6F9" }}>
        <div className="font-syne" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
          Product #{index + 1} — {product.type}
          {product.oem && <span className="font-mono-jb ml-2" style={{ fontSize: 12, fontWeight: 500, color: "#64748B" }}>· {product.oem}</span>}
        </div>
        <span className="font-dm" style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>Qty: {product.qty}</span>
      </div>
      <div className="px-4 py-3">
        <div className="font-dm mb-3" style={{ fontSize: 12, color: "#64748B" }}>
          {[product.od1 && `OD1 ${product.od1}`, product.id1 && `ID1 ${product.id1}`, product.height && `H ${product.height}`, product.media].filter(Boolean).join(" · ")}
        </div>
        <div className="grid grid-cols-4 gap-3 items-end">
          <Field label="Raw Materials (₱)">
            <input type="number" value={line.materialCost} onChange={(e) => onChange({ materialCost: Number(e.target.value) })} className="form-input-sm" />
          </Field>
          <Field label="Labor (₱)">
            <input type="number" value={line.labor} onChange={(e) => onChange({ labor: Number(e.target.value) })} className="form-input-sm" />
          </Field>
          <Field label="Markup (%)">
            <input type="number" value={line.markupPct} onChange={(e) => onChange({ markupPct: Number(e.target.value) })} className="form-input-sm" />
          </Field>
          <div className="flex flex-col gap-1 text-right">
            <span className="font-dm" style={{ fontSize: 11, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 600 }}>Unit · Subtotal</span>
            <span className="font-syne" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{peso(unit)} <span style={{ color: "#64748B", fontWeight: 500 }}>× {product.qty}</span></span>
            <span className="font-syne" style={{ fontSize: 16, fontWeight: 800, color: "#C8102E" }}>{peso(sub)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Quotation Detail (read-only management view) ---- */
function QuotationDetailModal({ inquiry, onClose }: { inquiry: Inquiry; onClose: () => void }) {
  const q = inquiry.quotation!;
  const total = quotationTotal(inquiry);
  return (
    <ModalShell title={`Quotation · ${inquiry.code}`} subtitle={`${inquiry.clientName} · Sent ${q.sentDate} · ${q.leadTimeDays} day lead time`} onClose={onClose} size="lg">
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead style={{ backgroundColor: "#F4F6F9" }}>
            <tr>
              {["Product", "Qty", "Materials", "Labor", "Markup", "Unit", "Subtotal"].map((h) => (
                <th key={h} className="font-dm text-left px-3 py-2" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inquiry.products.map((p, i) => {
              const l = q.lines.find((ll) => ll.productId === p.id);
              if (!l) return null;
              return (
                <tr key={p.id} className="border-t border-slate-200">
                  <td className="px-3 py-3 font-dm" style={{ fontSize: 13, color: "#0F172A" }}><span style={{ fontWeight: 700 }}>#{i + 1}</span> {p.type}</td>
                  <td className="px-3 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{p.qty}</td>
                  <td className="px-3 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{peso(l.materialCost)}</td>
                  <td className="px-3 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{peso(l.labor)}</td>
                  <td className="px-3 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{l.markupPct}%</td>
                  <td className="px-3 py-3 font-syne" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{peso(unitPrice(l))}</td>
                  <td className="px-3 py-3 font-syne" style={{ fontSize: 14, fontWeight: 800, color: "#C8102E" }}>{peso(unitPrice(l) * p.qty)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 rounded-lg p-4 flex items-center justify-between" style={{ backgroundColor: "#1A2B4A" }}>
        <span className="font-dm text-white/60" style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>Total Quoted</span>
        <span className="font-syne text-white" style={{ fontSize: 22, fontWeight: 800 }}>{peso(total)}</span>
      </div>
      <div className="flex justify-end pt-4 mt-4 border-t border-slate-200">
        <button onClick={onClose} className="font-dm px-4 py-2 rounded-md hover:bg-slate-100" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Close</button>
      </div>
    </ModalShell>
  );
}

/* ---- PO Viewer ---- */
function POViewerModal({ inquiry, onClose }: { inquiry: Inquiry; onClose: () => void }) {
  const poFile = inquiry.poFileName;
  const poReference = poNumberForDisplay(inquiry) ?? inquiry.code;
  const poDataUrl = inquiry.poFileDataUrl;

  return (
    <ModalShell title="PURCHASE ORDER" subtitle={`${inquiry.clientName} · ${poFile ?? "Client-submitted document"}`} onClose={onClose} size="lg">
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div>
          <div className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>PO Number</div>
          <div className="font-mono-jb mt-1" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{poReference}</div>
        </div>
        <div>
          <div className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Client</div>
          <div className="font-dm mt-1" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{inquiry.clientName}</div>
        </div>
        <div>
          <div className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Uploaded</div>
          <div className="font-dm mt-1" style={{ fontSize: 13, color: "#0F172A" }}>{inquiry.poUploadedAt ? new Date(inquiry.poUploadedAt).toLocaleString() : "—"}</div>
        </div>
      </div>
      {poDataUrl?.startsWith("data:image/") ? (
        <div className="rounded-lg border border-slate-200 bg-slate-100 p-3 flex items-center justify-center" style={{ minHeight: 360, maxHeight: "65vh" }}>
          <img src={poDataUrl} alt={`${inquiry.clientName} purchase order ${poReference}`} className="max-w-full max-h-[62vh] object-contain" />
        </div>
      ) : poDataUrl?.startsWith("data:application/pdf") ? (
        <iframe src={poDataUrl} title={`${inquiry.clientName} purchase order ${poReference}`} className="w-full rounded-lg border border-slate-200 bg-white" style={{ height: "65vh" }} />
      ) : poDataUrl ? (
        <div className="rounded-lg border border-slate-200 p-5 flex items-center justify-center" style={{ minHeight: 240 }}>
          <a href={poDataUrl} download={poFile ?? "purchase-order"} className="font-dm px-4 py-2 rounded-md border border-slate-300" style={{ fontSize: 13, fontWeight: 700, color: "#1A2B4A" }}>Open or download {poFile ?? "purchase order"}</a>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 p-5" style={{ backgroundColor: "#FFFBEB" }}>
          <div className="font-dm" style={{ fontSize: 12, fontWeight: 800, color: "#92400E", textTransform: "uppercase" }}>Original upload unavailable</div>
          <p className="font-dm mt-2" style={{ fontSize: 13, color: "#78350F" }}>This earlier record contains the PO reference but not the uploaded document data. New client uploads are stored on the order and open here.</p>
        </div>
      )}
    </ModalShell>
  );
}

/* ---- Generate JO confirmation w/ final specs + physical document uploads ---- */
interface UploadedDoc { id: string; name: string; size: number; ts: string; label?: string }

function GenerateJOModal({ inquiry, onClose, onConfirm }: {
  inquiry: Inquiry;
  onClose: () => void;
  onConfirm: (data: FinalizeJOData | FinalizeJOData[]) => void;
}) {
  const { generateJONumber } = useOrders();
  const [otherDocs, setOtherDocs] = useState<UploadedDoc[]>([]);
  const [otherLabel, setOtherLabel] = useState("");
  const [checks, setChecks] = useState({ verified: false, matches: false, terms: false, dpConfirmed: false });
  const [poFullscreen, setPoFullscreen] = useState(false);
  const [showSpecs, setShowSpecs] = useState(true);
  /* Active product tab for multi-product JO editing */
  const [activeProductTab, setActiveProductTab] = useState(0);

  /* ── Per-product state: JO numbers, specs, sketches, Enter-Fil PN ── */
  const initJoNumbers = (): string[] => {
    const base = generateJONumber();
    const match = base.match(/^(JO-\d{4}-)(\d+)$/);
    return inquiry.products.map((_, idx) =>
      match ? `${match[1]}${String(Number(match[2]) + idx).padStart(match[2].length, "0")}` : idx === 0 ? base : `${base}-${idx + 1}`
    );
  };
  const [joNumbers, setJoNumbers] = useState<string[]>(initJoNumbers);

  const initProductSpecs = (): JOSpecs[] =>
    inquiry.products.map((p) => ({
      od1: p.od1 ?? "", od2: p.od2 ?? "",
      id1: p.id1 ?? "", id2: p.id2 ?? "",
      height: p.height ?? "", overallHeight: "",
      endCap: "", media: p.media ?? "",
      innerCore: p.innerCore ?? "", outerCore: p.outerCore ?? "",
      oring: p.oring ?? "", gasket: p.gasket ?? "",
      oem: p.oem ?? "", brand: "", others: "",
      length: p.length ?? "", width: p.width ?? "", thickness: p.thickness ?? "",
      depth: p.depth ?? "", pocketCount: p.pocketCount ?? "",
      diameter: p.diameter ?? "",
      clothCuttingWidth: p.clothCuttingWidth ?? "", clothCuttingLength: p.clothCuttingLength ?? "",
      springPlateCenterToCenter: p.springPlateCenterToCenter ?? "",
      springPlateWidth: p.springPlateWidth ?? "", springPlateLength: p.springPlateLength ?? "",
      padOd: p.padOd ?? "", padId: p.padId ?? "",
    }));
  const [productSpecs, setProductSpecs] = useState<JOSpecs[]>(initProductSpecs);
  const setSpecForProduct = (pIdx: number, k: keyof JOSpecs, v: string) =>
    setProductSpecs((prev) => prev.map((s, i) => i === pIdx ? { ...s, [k]: v } : s));

  /* Per-product sketch docs */
  const [productSketches, setProductSketches] = useState<UploadedDoc[][]>(() => inquiry.products.map(() => []));
  const addSketch = (pIdx: number, file: File) => {
    const doc: UploadedDoc = {
      id: `sketch-${pIdx}-${Date.now()}`,
      name: file.name,
      size: file.size,
      ts: new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    };
    setProductSketches((prev) => prev.map((arr, i) => i === pIdx ? [...arr, doc] : arr));
  };
  const removeSketch = (pIdx: number, id: string) =>
    setProductSketches((prev) => prev.map((arr, i) => i === pIdx ? arr.filter((d) => d.id !== id) : arr));

  /* Per-product Enter-Fil PN */
  const [enterFilPNs, setEnterFilPNs] = useState<string[]>(() => inquiry.products.map((p) => p.oem ?? ""));

  /* Payment terms (set by Enter-Fil during quotation, can be edited here after negotiation) */
  const [paymentTerms, setPaymentTerms] = useState<"15-Day Terms" | "30-Day Terms">(inquiry.paymentTerms);
  /* Delivery method (Enter-Fil's final say) */
  const [deliveryMethod, setDeliveryMethod] = useState<"Lalamove" | "AP Cargo" | "Fast Cargo" | "Company Vehicle" | "Client Pick-up">("Company Vehicle");
  /* Sales-invoice issuance — some orders skip SI */
  const [issueSI, setIssueSI] = useState(true);

  const allSketchesAttached = productSketches.every((s) => s.length > 0);
  const dpRequired = (inquiry.downpaymentPercent ?? 0) > 0;
  const dpOk = !dpRequired || inquiry.downpaymentConfirmed === true || checks.dpConfirmed;
  const allChecked = checks.verified && checks.matches && checks.terms && allSketchesAttached && dpOk;

  const poFile = inquiry.poFileName ?? null;
  const isImage = poFile ? /\.(jpe?g|png|gif|webp)$/i.test(poFile) : false;

  const addOtherDoc = (file: File, label?: string) => {
    const doc: UploadedDoc = {
      id: `other-${Date.now()}`,
      name: file.name, size: file.size,
      ts: new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      label,
    };
    setOtherDocs((prev) => [...prev, doc]);
  };

  const buildFinalizePayload = (): FinalizeJOData[] =>
    inquiry.products.map((_, idx) => ({
      joNumber: joNumbers[idx] ?? `${joNumbers[0]}-${idx + 1}`,
      joSpecs: { ...productSpecs[idx], oem: enterFilPNs[idx] || productSpecs[idx]?.oem },
      joSketch: productSketches[idx]?.[0]?.name,
    }));

  const totalQty = inquiry.products.reduce((s, p) => s + p.qty, 0);
  const summary = inquiry.products.map((p) => `${p.type}${p.od1 ? ` ${p.od1}×${p.id1}×${p.height}mm` : ""} · Qty ${p.qty}`).join(" · ");

  return (
    <ModalShell title="Generate Job Order" subtitle={`${inquiry.code} · ${inquiry.clientName}`} onClose={onClose} size="lg">

      {/* ─── PO Document Preview ─── */}
      {poFile && (
        <div className="rounded-lg border border-slate-200 overflow-hidden mb-5" style={{ backgroundColor: "#FAFBFC" }}>
          <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between" style={{ backgroundColor: "#F4F6F9" }}>
            <div className="flex items-center gap-2">
              <FileText size={15} style={{ color: "#C8102E" }} />
              <span className="font-syne" style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", letterSpacing: 0.5 }}>PURCHASE ORDER DOCUMENT</span>
              <span className="font-mono-jb" style={{ fontSize: 11, color: "#64748B" }}>{poFile}</span>
            </div>
            <button
              onClick={() => setPoFullscreen(true)}
              className="flex items-center gap-1.5 font-dm px-3 py-1.5 rounded-md border border-slate-200 hover:bg-white"
              style={{ fontSize: 11, fontWeight: 600, color: "#1A2B4A" }}
            >
              <Maximize2 size={12} /> 🔍 Open Full Screen
            </button>
          </div>

          <div className="p-4">
            <div
              className="relative rounded-lg overflow-hidden flex items-center justify-center"
              style={{ backgroundColor: "#E2E8F0", minHeight: 200, border: "1px solid #CBD5E1" }}
            >
              {isImage ? (
                <div className="flex flex-col items-center gap-3 py-8 px-6 text-center">
                  <div className="w-16 h-16 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#DBEAFE" }}>
                    <FileText size={28} style={{ color: "#2563EB" }} />
                  </div>
                  <div>
                    <div className="font-syne" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{poFile}</div>
                    <div className="font-dm mt-1" style={{ fontSize: 12, color: "#64748B" }}>Image file · Click "Open Full Screen" to view</div>
                  </div>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center py-2">
                  <div className="bg-white mx-auto rounded shadow border border-slate-300 p-5 my-3" style={{ width: 260 }}>
                    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-200">
                      <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: "#1A2B4A" }}>
                        <span style={{ color: "#C8102E", fontSize: 12, fontWeight: 800 }}>▲</span>
                      </div>
                      <div>
                        <div className="font-syne" style={{ fontSize: 9, fontWeight: 800, color: "#0F172A", letterSpacing: 0.5 }}>PURCHASE ORDER</div>
                        <div className="font-mono-jb" style={{ fontSize: 8, color: "#64748B" }}>{poFile}</div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {[100, 75, 90, 60, 80].map((w, i) => (
                        <div key={i} className="h-2 rounded" style={{ backgroundColor: i === 0 ? "#94A3B8" : "#E2E8F0", width: `${w}%` }} />
                      ))}
                      <div className="mt-2 pt-2 border-t border-slate-200">
                        {inquiry.products.map((_, i) => (
                          <div key={i} className="h-2 rounded mb-1" style={{ backgroundColor: "#DBEAFE", width: `${85 - i * 10}%` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="font-dm pb-2" style={{ fontSize: 11, color: "#64748B" }}>PDF document — scroll to read full contents</div>
                </div>
              )}
            </div>
            <div className="mt-2 flex justify-end">
              <button
                onClick={() => toast("To replace: ask the client to resubmit their PO via the portal.")}
                className="font-dm flex items-center gap-1 hover:underline"
                style={{ fontSize: 11, color: "#94A3B8" }}
              >
                <RotateCcw size={11} /> 🔄 Replace Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Per-product JO tabs (one tab per filter product) ── */}
      <div className="rounded-lg border border-slate-200 mb-5 overflow-hidden">
        <div className="px-5 py-3 flex items-center gap-3 flex-wrap" style={{ backgroundColor: "#1A2B4A" }}>
          <span className="font-syne text-white" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>JOB ORDERS</span>
          <span className="font-dm text-white/60" style={{ fontSize: 11 }}>— {inquiry.products.length} filter{inquiry.products.length > 1 ? "s" : ""} · {inquiry.products.length} separate JO{inquiry.products.length > 1 ? "s" : ""} · delivered together</span>
          {inquiry.products.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setActiveProductTab(i)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md font-dm whitespace-nowrap"
              style={{
                fontSize: 11, fontWeight: 700,
                backgroundColor: i === activeProductTab ? "white" : "rgba(255,255,255,0.1)",
                color: i === activeProductTab ? "#1A2B4A" : "rgba(255,255,255,0.7)",
              }}
            >
              #{i + 1} {p.filterName ?? p.type}
              {productSketches[i]?.length > 0 && <span style={{ fontSize: 9 }}>📎</span>}
            </button>
          ))}
        </div>

        {/* Active product panel */}
        {inquiry.products.map((product, pIdx) => pIdx !== activeProductTab ? null : (
          <div key={product.id} className="p-5 flex flex-col gap-4" style={{ backgroundColor: "#FAFBFC" }}>
            {/* JO Number for this product */}
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <div className="font-syne" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>JO Number — Filter #{pIdx + 1}</div>
                <div className="font-dm mt-0.5" style={{ fontSize: 11, color: "#64748B" }}>{product.filterName ?? product.type} · Qty {product.qty}</div>
              </div>
              <input
                value={joNumbers[pIdx] ?? ""}
                onChange={(e) => setJoNumbers((prev) => prev.map((n, i) => i === pIdx ? e.target.value : n))}
                className="form-input"
                style={{ maxWidth: 200, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: "#1A2B4A" }}
              />
            </div>

            {/* Enter-Fil PN (required) */}
            <div className="flex flex-col gap-1">
              <label className="font-dm flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.4, textTransform: "uppercase" }}>
                Enter-Fil PN
                <span className="font-dm px-1.5 py-0.5 rounded-full" style={{ fontSize: 8, fontWeight: 800, backgroundColor: "#C8102E", color: "white" }}>REQUIRED</span>
              </label>
              <input
                value={enterFilPNs[pIdx] ?? ""}
                onChange={(e) => setEnterFilPNs((prev) => prev.map((n, i) => i === pIdx ? e.target.value : n))}
                className="form-input"
                placeholder="e.g. KF-OS.107.65.252"
              />
            </div>

            {/* Specs */}
            <button
              onClick={() => setShowSpecs((v) => !v)}
              className="w-full px-4 py-2.5 flex items-center justify-between rounded-md"
              style={{ backgroundColor: "#E2E8F0", border: "1px solid #CBD5E1" }}
            >
              <span className="font-syne" style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>📐 Technical Specifications</span>
              <span className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>{showSpecs ? "▲ collapse" : "▼ expand"} · pre-filled from inquiry</span>
            </button>
            {showSpecs && (
              <div>
                {/* Group-specific dimension fields */}
                {(() => {
                  const group = groupForType(product.type ?? "AIRFIL");
                  const dimKeys = GROUP_TEMPLATES[group]?.dimensions ?? GROUP_TEMPLATES.cylindrical.dimensions;
                  const curSpecs = productSpecs[pIdx] ?? {};
                  return (
                    <>
                      <div className="font-dm mb-1 flex items-center gap-2" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" }}>
                        Dimensions
                        <span className="font-dm px-1.5 py-0.5 rounded-full" style={{ fontSize: 9, fontWeight: 700, backgroundColor: "#EDE9FE", color: "#7C3AED" }}>{group}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        {dimKeys.map((k) => (
                          <div key={k} className="flex flex-col gap-1">
                            <label className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>{DIMENSION_LABELS_CATALOG[k] ?? k}</label>
                            <input value={(curSpecs as any)[k] ?? ""} onChange={(e) => setSpecForProduct(pIdx, k as keyof JOSpecs, e.target.value)} className="form-input-sm" placeholder="—" />
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
                <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" }}>Components</div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {([["End Cap", "endCap"], ["Filter Media", "media"], ["Inner Core", "innerCore"], ["Outer Core", "outerCore"], ["O-Ring", "oring"], ["Gasket", "gasket"]] as [string, keyof JOSpecs][]).map(([lbl, k]) => (
                    <div key={k} className="flex flex-col gap-1">
                      <label className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>{lbl}</label>
                      <input value={(productSpecs[pIdx] as any)?.[k] ?? ""} onChange={(e) => setSpecForProduct(pIdx, k, e.target.value)} className="form-input-sm" placeholder="—" />
                    </div>
                  ))}
                </div>
                <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" }}>Other Technical Specs</div>
                <div className="grid grid-cols-3 gap-3">
                  {([["OEM PN", "oem"], ["Brand", "brand"], ["Others", "others"]] as [string, keyof JOSpecs][]).map(([lbl, k]) => (
                    <div key={k} className="flex flex-col gap-1">
                      <label className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>{lbl}</label>
                      <input value={(productSpecs[pIdx] as any)?.[k] ?? ""} onChange={(e) => setSpecForProduct(pIdx, k, e.target.value)} className="form-input-sm" placeholder="—" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Per-product sketch (REQUIRED) */}
            {(() => {
              const sketches = productSketches[pIdx] ?? [];
              const attached = sketches.length > 0;
              return (
                <div className="rounded-lg border-2 p-4" style={{ backgroundColor: attached ? "#F0FDF4" : "#FEF2F2", borderColor: attached ? "#86EFAC" : "#FECACA" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-syne" style={{ fontSize: 13, fontWeight: 700, color: attached ? "#15803D" : "#991B1B" }}>
                      📎 Sketch / Drawing — Filter #{pIdx + 1}
                    </span>
                    <span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 9, fontWeight: 800, backgroundColor: "#C8102E", color: "white" }}>REQUIRED</span>
                  </div>
                  <div className="font-dm mb-3" style={{ fontSize: 12, color: attached ? "#15803D" : "#7F1D1D" }}>
                    Each filter needs its own approved drawing — production will follow this exact sketch.
                  </div>
                  <UploadSlot
                    label="Upload Sketch / Drawing"
                    help="PDF, JPG, or PNG · the approved drawing for this specific filter"
                    files={sketches}
                    onAdd={(f) => addSketch(pIdx, f)}
                    onRemove={(id) => removeSketch(pIdx, id)}
                  />
                </div>
              );
            })()}
          </div>
        ))}
      </div>

      {/* ── Payment Terms + Delivery Method (Enter-Fil's final say) ── */}
      <div className="rounded-lg border border-slate-200 p-5 mb-5" style={{ backgroundColor: "#FAFBFC" }}>
        <div className="font-syne mb-3" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Payment Terms &amp; Delivery</div>
        <div className="font-dm mb-3" style={{ fontSize: 12, color: "#64748B" }}>
          Set by Enter-Fil during quotation. Editable here after negotiation.
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Payment Terms (Enter-Fil's decision)">
            <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value as any)} className="form-input">
              <option value="15-Day Terms">15-Day Terms · post-delivery</option>
              <option value="30-Day Terms">30-Day Terms · post-delivery</option>
            </select>
          </Field>
          <Field label="Delivery Method (Enter-Fil's final say)">
            <select value={deliveryMethod} onChange={(e) => setDeliveryMethod(e.target.value as any)} className="form-input">
              <option value="Company Vehicle">Company Vehicle — Batangas / Laguna / nearby</option>
              <option value="Lalamove">Lalamove — local, urgent</option>
              <option value="AP Cargo">AP Cargo — Cagayan / Isabela / north</option>
              <option value="Fast Cargo">Fast Cargo — Davao / Mindanao / south</option>
              <option value="Client Pick-up">Client Pick-up</option>
            </select>
          </Field>
        </div>
        <label className="flex items-start gap-2 mt-3 p-2 rounded-md cursor-pointer hover:bg-white" style={{ backgroundColor: issueSI ? "transparent" : "#FFFBEB" }}>
          <input type="checkbox" checked={issueSI} onChange={(e) => setIssueSI(e.target.checked)} style={{ accentColor: "#C8102E", marginTop: 3 }} />
          <div>
            <div className="font-dm" style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>Issue Sales Invoice on delivery</div>
            <div className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>Uncheck if this order has no SI (e.g. internal sample, special arrangement)</div>
          </div>
        </label>
      </div>

      {/* ── Other Documents (optional) ── */}
      <div className="rounded-lg border border-slate-200 p-5 mb-5" style={{ backgroundColor: "#FAFBFC" }}>
        <div className="font-syne mb-1" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Other Documents <span style={{ fontWeight: 400, color: "#94A3B8" }}>(optional)</span></div>
        <div className="font-dm mb-3" style={{ fontSize: 12, color: "#64748B" }}>
          Attach any extra reference documents (lab tests, certifications, special agreements).
        </div>
        <div className="flex flex-col gap-2 max-w-md">
          <input
            value={otherLabel}
            onChange={(e) => setOtherLabel(e.target.value)}
            placeholder="Document name (e.g. Lab Test Cert)"
            className="form-input-sm"
          />
          <UploadSlot
            label="Upload any other document"
            help="Label it above so it's searchable later"
            files={otherDocs}
            onAdd={(f) => addOtherDoc(f, otherLabel || "Other document")}
            onRemove={(id) => setOtherDocs((prev) => prev.filter((d) => d.id !== id))}
            compact
          />
        </div>
      </div>

      {/* Verification checklist */}
      <div className="rounded-lg p-4 mb-5" style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
        <div className="font-syne mb-3" style={{ fontSize: 13, fontWeight: 700, color: "#1E3A8A", letterSpacing: 0.4 }}>VERIFICATION CHECKLIST</div>
        <div className="flex flex-col gap-2">
          <Check label="PO document verified and matches client's quotation" checked={checks.verified} onChange={(v) => setChecks((p) => ({ ...p, verified: v }))} />
          <Check label="Product specifications & quantities match" checked={checks.matches} onChange={(v) => setChecks((p) => ({ ...p, matches: v }))} />
          <Check label="Payment terms confirmed with client" checked={checks.terms} onChange={(v) => setChecks((p) => ({ ...p, terms: v }))} />
          {/* Per-product sketch status summary */}
          <div className="rounded-md p-2 font-dm flex flex-col gap-1" style={{ backgroundColor: allSketchesAttached ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${allSketchesAttached ? "#86EFAC" : "#FECACA"}`, fontSize: 11 }}>
            <span style={{ fontWeight: 700, color: allSketchesAttached ? "#15803D" : "#991B1B" }}>
              {allSketchesAttached ? "✅" : "❌"} Sketches / Drawings ({productSketches.filter((s) => s.length > 0).length}/{inquiry.products.length} attached)
            </span>
            {inquiry.products.map((p, i) => (
              <span key={p.id} style={{ color: productSketches[i]?.length > 0 ? "#15803D" : "#991B1B", paddingLeft: 8 }}>
                {productSketches[i]?.length > 0 ? "✓" : "○"} Filter #{i + 1} {p.filterName ?? p.type}: {productSketches[i]?.[0]?.name ?? "not attached"}
              </span>
            ))}
          </div>
          {/* Downpayment confirmation — only shown if downpayment % was set on the inquiry */}
          {dpRequired && (
            <div className="flex flex-col gap-1">
              {inquiry.downpaymentConfirmed ? (
                <div className="flex items-center gap-2 font-dm" style={{ fontSize: 13, color: "#15803D" }}>
                  <CheckCircle2 size={14} style={{ color: "#16A34A" }} />
                  <span style={{ fontWeight: 700 }}>Downpayment received &amp; confirmed</span>
                  <span className="font-dm px-1.5 py-0.5 rounded-full" style={{ fontSize: 10, backgroundColor: "#DCFCE7", color: "#166534" }}>
                    {inquiry.downpaymentPercent}%{inquiry.downpaymentAmount ? ` · ₱${inquiry.downpaymentAmount.toLocaleString("en-PH")}` : ""}
                  </span>
                </div>
              ) : (
                <div className="rounded-md p-2" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
                  <div className="font-dm mb-1" style={{ fontSize: 11, fontWeight: 700, color: "#92400E" }}>
                    ⚠️ Downpayment required before JO generation: {inquiry.downpaymentPercent}%{inquiry.downpaymentAmount ? ` = ₱${inquiry.downpaymentAmount.toLocaleString("en-PH")}` : ""}
                  </div>
                  <Check
                    label="Downpayment proof received and confirmed by accounting"
                    checked={checks.dpConfirmed}
                    onChange={(v) => setChecks((p) => ({ ...p, dpConfirmed: v }))}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation summary */}
      <div className="rounded-lg p-5 mb-1" style={{ backgroundColor: "#1A2B4A", color: "white" }}>
        <div className="flex items-center gap-2 mb-3">
          <Factory size={18} style={{ color: "#C8102E" }} />
          <span className="font-syne" style={{ fontSize: 16, fontWeight: 700 }}>Generate Job Order</span>
        </div>
        <div className="font-dm text-white/70 mb-3" style={{ fontSize: 12 }}>JO will be created for:</div>
        <div className="grid grid-cols-2 gap-y-2 gap-x-6 font-dm" style={{ fontSize: 13 }}>
          <Detail label="Client" value={inquiry.clientName} />
          <Detail label="PO" value={poNumberForDisplay(inquiry) ?? inquiry.code} mono />
          <Detail label="Items" value={summary || `${inquiry.products.length} products`} span2 />
          <Detail label="Total Qty" value={String(totalQty)} />
          <Detail label="Payment" value={inquiry.paymentTerms} />
        </div>
        <div className="mt-4 pt-3 border-t border-white/10 font-dm text-white/70" style={{ fontSize: 12 }}>
          The JO will appear on the Production Floor immediately and will be visible to the client in their portal under the Status tab.
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 mt-5 border-t border-slate-200">
        <button onClick={onClose} className="font-dm px-4 py-2 rounded-md hover:bg-slate-100" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>
          Cancel
        </button>
        <button
          onClick={() => onConfirm(buildFinalizePayload())}
          disabled={!allChecked}
          className="font-dm px-5 py-2.5 rounded-md text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.4 }}
        >
          <CheckCircle2 size={15} strokeWidth={2.5} /> CONFIRM &amp; GENERATE JO
        </button>
      </div>

      {/* Fullscreen PO Preview */}
      {poFullscreen && poFile && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
          onClick={() => setPoFullscreen(false)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-3xl overflow-auto p-8 flex flex-col items-center gap-4"
            style={{ maxHeight: "92vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between mb-2">
              <span className="font-syne" style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>📄 {poFile}</span>
              <button onClick={() => setPoFullscreen(false)} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <div className="bg-white border border-slate-300 rounded-lg shadow-xl p-10 w-full" style={{ minHeight: 500 }}>
              <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-slate-800">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#1A2B4A" }}>
                  <span style={{ color: "#C8102E", fontSize: 20, fontWeight: 800 }}>▲</span>
                </div>
                <div>
                  <div className="font-syne" style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>PURCHASE ORDER</div>
                  <div className="font-mono-jb" style={{ fontSize: 12, color: "#64748B" }}>{poFile}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6 mb-6">
                {([["Client", inquiry.clientName], ["Contact", inquiry.contactPerson], ["Payment Terms", inquiry.paymentTerms], ["Date Submitted", inquiry.submittedDate]] as [string, string][]).map(([k, v]) => (
                  <div key={k}>
                    <div className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.4 }}>{k}</div>
                    <div className="font-dm mt-1" style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 pt-4">
                <div className="font-syne mb-3" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>ORDER ITEMS</div>
                <div className="flex flex-col gap-2">
                  {inquiry.products.map((p, i) => (
                    <div key={p.id} className="rounded-lg px-4 py-3 border border-slate-200" style={{ backgroundColor: "#F8FAFC" }}>
                      <div className="font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>#{i + 1} {p.filterName || p.type}{p.oem ? ` · ${p.oem}` : ""}</div>
                      <div className="font-dm mt-0.5" style={{ fontSize: 12, color: "#64748B" }}>
                        {[p.od1 && `OD ${p.od1}mm`, p.id1 && `ID ${p.id1}mm`, p.height && `H ${p.height}mm`, p.media].filter(Boolean).join(" · ")}
                      </div>
                      <div className="font-syne mt-1" style={{ fontSize: 13, fontWeight: 700, color: "#C8102E" }}>Qty: {p.qty} pcs</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200 font-dm" style={{ fontSize: 12, color: "#94A3B8", textAlign: "center" }}>
                This is a simulated PO viewer. In production, the actual uploaded PDF/image file is displayed here.
              </div>
            </div>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function UploadSlot({ label, help, files, onAdd, onRemove, compact }: {
  label: string; help: string; files: UploadedDoc[];
  onAdd: (f: File) => void; onRemove: (id: string) => void; compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors hover:bg-white"
        style={{ border: "2px dashed #CBD5E1", backgroundColor: "white", padding: compact ? "12px" : "16px" }}>
        <Paperclip size={16} style={{ color: "#64748B" }} />
        <span className="font-dm text-center" style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>📎 {label}</span>
        {!compact && <span className="font-dm text-center" style={{ fontSize: 11, color: "#94A3B8" }}>{help}</span>}
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onAdd(f);
            e.currentTarget.value = "";
          }}
        />
      </label>
      {files.map((f) => (
        <div key={f.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 bg-white border border-slate-200">
          <FileText size={14} style={{ color: "#C8102E" }} />
          <div className="flex-1 min-w-0">
            <div className="font-dm truncate" style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{f.label ? `${f.label} · ` : ""}{f.name}</div>
            <div className="font-dm" style={{ fontSize: 10, color: "#94A3B8" }}>{(f.size / 1024).toFixed(1)} KB · {f.ts}</div>
          </div>
          <button onClick={() => onRemove(f.id)} aria-label="Remove" className="w-6 h-6 rounded hover:bg-slate-100 flex items-center justify-center" style={{ color: "#64748B" }}>
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: "#1D4ED8" }} />
      <span className="font-dm" style={{ fontSize: 13, color: "#1E3A8A" }}>{label}</span>
    </label>
  );
}

function Detail({ label, value, span2, mono }: { label: string; value: string; span2?: boolean; mono?: boolean }) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <div className="font-dm text-white/50" style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</div>
      <div className={`mt-0.5 ${mono ? "font-mono-jb" : "font-dm"} text-white`} style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

/* ---- shared bits ---- */
function ModalShell({ title, subtitle, onClose, children, size = "md" }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; size?: "md" | "lg" }) {
  const max = size === "lg" ? "max-w-5xl" : "max-w-lg";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.5)" }} onClick={onClose}>
      <div className={`bg-white rounded-xl w-full ${max} max-h-[90vh] flex flex-col`} style={{ boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between">
          <div>
            <h3 className="font-syne" style={{ fontSize: 18, fontWeight: 700, color: "#0F172A" }}>{title}</h3>
            {subtitle && <p className="font-dm mt-0.5" style={{ fontSize: 12, color: "#64748B" }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="p-6 overflow-auto">{children}</div>
      </div>
      <style>{`
        .form-input { font-family: 'DM Sans', sans-serif; font-size: 13px; padding: 10px 12px; border: 1px solid #E2E8F0; border-radius: 6px; outline: none; width: 100%; background: white; }
        .form-input:focus { border-color: #94A3B8; }
        .form-input-sm { font-family: 'DM Sans', sans-serif; font-size: 13px; padding: 8px 10px; border: 1px solid #E2E8F0; border-radius: 6px; outline: none; width: 100%; background: white; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</label>
      {children}
    </div>
  );
}

/* ─── Management: New Inquiry Modal ─── */
function ManagementNewInquiryModal({ onClose, onSubmit }: {
  onClose: () => void;
  onSubmit: (data: { clientName: string; contactPerson: string; paymentTerms: "15-Day Terms" | "30-Day Terms"; generalNotes: string; products: ProductLine[]; urgent?: boolean; dueDate?: string; inquirySketch?: string }) => void;
}) {
  const [clientName, setClientName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [paymentTerms, setPaymentTerms] = useState<"15-Day Terms" | "30-Day Terms">("30-Day Terms");
  const [generalNotes, setGeneralNotes] = useState("");
  /* Section A3/A4 — type code from FILTER_TYPES catalogue + filterName + dynamic dimensions */
  const [filterType, setFilterType] = useState("AIRFIL");
  const [filterName, setFilterName] = useState("");
  const [dims, setDims] = useState<Record<string, string>>({});
  const [media, setMedia] = useState("");
  const [innerCore, setInnerCore] = useState("");
  const [oem, setOem] = useState("");
  const [qty, setQty] = useState(10);
  const [sketchFile, setSketchFile] = useState<string | null>(null);
  const [isRush, setIsRush] = useState(false);
  const [rushDate, setRushDate] = useState("");

  /* Auto-due-date when NOT rush: today + 14 days */
  const autoDueDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const group = groupForType(filterType);
  const dimensionList = GROUP_TEMPLATES[group].dimensions;

  const submit = () => {
    if (!clientName.trim()) { toast.error("Client name required"); return; }
    if (!contactPerson.trim()) { toast.error("Contact person required"); return; }
    if (filterName.trim().length < 3) { toast.error("Filter name (≥3 characters) required"); return; }
    if (qty < 10) { toast.error("Minimum order quantity is 10 pcs"); return; }
    if (isRush && !rushDate.trim()) { toast.error("Required delivery date needed for rush order"); return; }
    const product: ProductLine = { id: "p1", type: filterType, filterName: filterName.trim(), ...dims, media, innerCore, oem, qty };
    const finalDueDate = isRush ? rushDate : autoDueDate();
    onSubmit({
      clientName, contactPerson, paymentTerms, generalNotes,
      products: [product],
      urgent: isRush,
      dueDate: finalDueDate,
      inquirySketch: sketchFile ?? undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.6)" }} onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl flex flex-col" style={{ boxShadow: "0 24px 48px rgba(0,0,0,0.3)", maxHeight: "90vh" }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between" style={{ backgroundColor: "#1A2B4A" }}>
          <div>
            <h3 className="font-syne" style={{ fontSize: 18, fontWeight: 700, color: "white" }}>+ New Inquiry</h3>
            <p className="font-dm mt-0.5" style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Create a new inquiry on behalf of a client — will appear in the pipeline immediately</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-white/10"><X size={16} style={{ color: "white" }} /></button>
        </div>

        <div className="p-6 overflow-auto flex flex-col gap-5">
          {/* Client Info */}
          <div>
            <div className="font-dm mb-3" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.6, textTransform: "uppercase" }}>Client Information</div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Client / Company Name *">
                <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. B.E. Aerospace" className="form-input" />
              </Field>
              <Field label="Contact Person *">
                <input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Full name" className="form-input" />
              </Field>
              <Field label="Payment Terms">
                <select value={paymentTerms} onChange={e => setPaymentTerms(e.target.value as any)} className="form-input">
                  <option>15-Day Terms</option><option>30-Day Terms</option>
                </select>
              </Field>
              <Field label="General Notes">
                <input value={generalNotes} onChange={e => setGeneralNotes(e.target.value)} placeholder="Optional" className="form-input" />
              </Field>
            </div>
          </div>

          {/* Product Spec — Section A3 catalogue + Section A4 dynamic dimensions */}
          <div>
            <div className="font-dm mb-3" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.6, textTransform: "uppercase" }}>Product Specification</div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Filter Type *">
                <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setDims({}); }} className="form-input">
                  {Object.values(FILTER_TYPES_CATALOG).map((t) => (
                    <option key={t.code} value={t.code}>{t.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Filter Name * (min 3 chars)">
                <input value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="e.g. Air/Oil Separator Filter" className="form-input" />
              </Field>
              <Field label="OEM Reference / Part No.">
                <input value={oem} onChange={e => setOem(e.target.value)} placeholder="e.g. KF-OS.107.65.252" className="form-input" />
              </Field>
              {dimensionList.map((d, i) => (
                <Field key={d} label={`${DIMENSION_LABELS_CATALOG[d]}${i === 0 ? " *" : ""}`}>
                  <input
                    value={dims[d] ?? ""}
                    onChange={(e) => setDims((prev) => ({ ...prev, [d]: e.target.value }))}
                    type="number"
                    className="form-input"
                  />
                </Field>
              ))}
              <Field label="Filter Media"><input value={media} onChange={e => setMedia(e.target.value)} placeholder="e.g. Microglass Fiber" className="form-input" /></Field>
              <Field label="Inner Core"><input value={innerCore} onChange={e => setInnerCore(e.target.value)} placeholder="e.g. Expanded Metal Perfo 2mm" className="form-input" /></Field>
              <div className="flex flex-col gap-1.5">
                <label className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Quantity (min 10)</label>
                <input value={qty} onChange={e => setQty(Number(e.target.value))} type="number" min={10} className="form-input" />
              </div>
            </div>
          </div>

          {/* Sketch Upload */}
          <div className="rounded-lg p-4" style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
            <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#1E3A8A", letterSpacing: 0.5, textTransform: "uppercase" }}>📎 Attach Design Sketch (Optional)</div>
            <p className="font-dm mb-2" style={{ fontSize: 11, color: "#1E40AF" }}>For clients who provide engineer drawings — helps quotation accuracy</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setSketchFile(f.name);
                  e.currentTarget.value = "";
                }}
              />
              {sketchFile ? (
                <span className="font-dm flex items-center gap-2 px-4 py-2 rounded-md" style={{ fontSize: 12, color: "#16A34A", fontWeight: 600, backgroundColor: "white", border: "1.5px solid #BBF7D0" }}>
                  ✅ {sketchFile}
                  <button onClick={(e) => { e.preventDefault(); setSketchFile(null); }} className="ml-2 text-red-500 hover:text-red-700">✕</button>
                </span>
              ) : (
                <span className="flex items-center gap-2 px-4 py-2 rounded-md font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#1D4ED8", border: "1.5px dashed #93C5FD", cursor: "pointer" }}>
                  📁 Upload sketch or drawing (JPG, PNG, PDF)
                </span>
              )}
            </label>
          </div>

          {/* Rush / Urgent toggle */}
          <div className="rounded-lg p-4" style={{ backgroundColor: isRush ? "#FEF2F2" : "#F8FAFC", border: isRush ? "1.5px solid #FECACA" : "1px solid #E2E8F0" }}>
            <label className="flex items-center gap-3 cursor-pointer" onClick={() => setIsRush(r => !r)}>
              <div className="w-10 h-6 rounded-full transition-colors flex items-center px-1" style={{ backgroundColor: isRush ? "#C8102E" : "#CBD5E1" }}>
                <div className="w-4 h-4 bg-white rounded-full shadow transition-transform" style={{ transform: isRush ? "translateX(16px)" : "translateX(0)" }} />
              </div>
              <div>
                <div className="font-dm" style={{ fontSize: 13, fontWeight: 700, color: isRush ? "#C8102E" : "#0F172A" }}>🚨 Mark as Rush / Urgent Order</div>
                <div className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>Flags this order for priority production scheduling</div>
              </div>
            </label>
            {isRush ? (
              <div className="mt-3">
                <label className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#991B1B" }}>Required Delivery Date *</label>
                <input
                  value={rushDate} onChange={e => setRushDate(e.target.value)}
                  placeholder="e.g. May 5, 2026"
                  className="form-input mt-1.5"
                  style={{ width: "100%", borderColor: "#FECACA" }}
                />
              </div>
            ) : (
              <div className="mt-3 rounded-md p-2.5 font-dm" style={{ fontSize: 11, color: "#64748B", backgroundColor: "white", border: "1px solid #E2E8F0" }}>
                ℹ️ Auto-set due date: <span style={{ color: "#0F172A", fontWeight: 700 }}>{autoDueDate()}</span> (today + 14 days, standard 1–2 week production norm)
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="font-dm px-4 py-2 rounded-md hover:bg-slate-100" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Cancel</button>
          <button onClick={submit} className="flex items-center gap-2 px-5 py-2.5 rounded-md text-white font-dm hover:opacity-90" style={{ backgroundColor: isRush ? "#991B1B" : "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.4 }}>
            <ArrowRight size={14} strokeWidth={2.5} /> {isRush ? "🚨 Create Rush Inquiry" : "Create Inquiry"}
          </button>
        </div>
      </div>
    </div>
  );
}
