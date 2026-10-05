import { Fragment, useEffect, useRef, useState } from "react";
import {
  ClipboardList, MapPin, Truck, CreditCard, Upload, CheckCircle2, Circle,
  Building2, User as UserIcon, Info, Camera, Send, Plus, Trash2, ChevronDown,
  ChevronUp, FileCheck, X, Settings, ExternalLink, RotateCcw, Printer,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { hasValidSignedDeliveryReceipt, paymentDaysRemaining, useOrders, unitPrice, quotationTotal, paymentRecords, paymentState, type Inquiry, type PaymentStateSummary, type ProductLine, type ReplacementRequest, type PaymentType } from "../store/orders";
import { useNotifications } from "../store/notifications";
import { useSettings } from "../store/settings";
import { getClientCompanySettings, saveClientCompanySettings } from "../store/clientCompanySettings";
import { readFileAsDataUrl } from "../store/attachments";
import { NotificationBell } from "./NotificationBell";
import { JOTemplateModal, type JOTemplateData } from "./JOTemplateModal";
import { QuotationPreviewModal } from "./QuotationPreviewModal";
import { InvoicePreviewModal } from "./InvoicePreviewModal";
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
import { FILTER_TYPES as FILTER_TYPE_CATALOG, GROUP_DISPLAY, GROUP_TEMPLATES, DIMENSION_LABELS, groupForType, labelForType, type DimensionKey } from "../store/filterTemplates";

type Tab = "orders" | "status" | "logistics" | "accounting" | "settings";

const tabs: { id: Tab; label: string; icon: any }[] = [
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "status", label: "Status", icon: MapPin },
  { id: "logistics", label: "Logistics", icon: Truck },
  { id: "accounting", label: "Accounting", icon: CreditCard },
  { id: "settings", label: "Settings", icon: Settings },
];

const hasPORecord = (inquiry: Inquiry) => Boolean(inquiry.poFileDataUrl || (inquiry.poUploaded && inquiry.poFileName));

function Shell({ active, onChange, children, clientName, onLogout }: {
  active: Tab; onChange: (t: Tab) => void; children: React.ReactNode; clientName: string; onLogout?: () => void;
}) {
  return (
    <div className="size-full flex flex-col font-dm" style={{ backgroundColor: "#F4F6F9" }}>
      <Toaster position="bottom-right" richColors />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 flex items-center justify-between px-8" style={{ height: 64 }}>
        <div className="flex items-center gap-3">
          <span aria-hidden style={{ fontSize: 22, color: "#C8102E", fontWeight: 800 }}>▲</span>
          <div>
            <div className="font-syne" style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>ENTER-FIL</div>
            <div className="font-dm" style={{ fontSize: 11, color: "#64748B", letterSpacing: 0.4 }}>Industrial Products</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-dm" style={{ fontSize: 13, color: "#0F172A" }}>
            Welcome, <span style={{ fontWeight: 600 }}>{clientName}</span>
          </span>
          <NotificationBell role="client" clientName={clientName} onNavigate={(id) => tabs.some((tab) => tab.id === id) && onChange(id as Tab)} />
          <button onClick={onLogout} className="font-dm" style={{ fontSize: 13, color: "#C8102E", fontWeight: 600 }}>Logout</button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white border-b border-slate-200 px-8 flex gap-1">
        {tabs.map((t) => {
          const isActive = active === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className="flex items-center gap-2 px-4 py-4 font-dm transition-colors"
              style={{
                fontSize: 13, fontWeight: 600,
                color: isActive ? "#C8102E" : "#64748B",
                borderBottom: isActive ? "3px solid #C8102E" : "3px solid transparent",
                marginBottom: -1,
              }}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </nav>

      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}

/* ---------- Orders Tab ---------- */
const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;

const blankProduct = (id: string): ProductLine => ({
  id, type: "AIRFIL", filterName: "",
  od1: "", od2: "", id1: "", id2: "", height: "", overallHeight: "",
  length: "", width: "", thickness: "", depth: "", pocketCount: "",
  diameter: "", clothCuttingWidth: "", clothCuttingLength: "",
  springPlateCenterToCenter: "", springPlateWidth: "", springPlateLength: "",
  padOd: "", padId: "",
  media: "", innerCore: "", outerCore: "", oring: "", gasket: "", oem: "",
  qty: 10, notes: "",
});

const completedJobOrders = [
  { jo: "JO-2026-001", date: "Mar 31, 2026", po: "PO-2026-9901", item: "Air Filter 115×103×500mm", qty: 50, status: "Delivered", specs: { type: "Air Filter", od1: "115", id1: "103", height: "500", media: "Microglass Fiber", innerCore: "Expanded Metal Perfo 2mm", oem: "KF-OS.107.65.252", qty: 50 } },
  { jo: "JO-2025-082", date: "Feb 14, 2026", po: "PO-2026-9805", item: "Oil Separator Filter", qty: 20, status: "Delivered", specs: { type: "Oil Separator", od1: "200", id1: "108", height: "160", media: "Microglass Fiber", innerCore: "Perfo Steel 2mm", oem: "KF-OS.200/167.108.160", qty: 20 } },
];

/* Icon hint per filter type code — purely decorative */
const FILTER_TYPE_ICON: Record<string, string> = {
  OILSEP: "⚙️", WATSEP: "💧", SOLFIL: "🧪", HYDFIL: "🛢️",
  AIRFIL: "💨", OILFIL: "🛢️", FUELFIL: "⛽", COALFIL: "🌫️",
  SEPFIL: "🔀", PRIFIL: "🟦", PREFIL: "🟢", ACTIFIL: "⚫",
  SECFIL: "👜", HEPFIL: "🛡️", BAGFIL: "🏭", PADFIL: "⚪",
};

/* All 16 filter types ordered by group, used by the Step-1 picker grid. The user picks one type — the group is derived internally. */
const FILTER_TYPE_LIST = Object.values(FILTER_TYPE_CATALOG);

const FILTRATION_RATINGS = [
  { value: "1-micron",   label: "1 micron",   desc: "Ultra-fine · pharmaceutical grade" },
  { value: "5-micron",   label: "5 micron",   desc: "Fine · standard industrial" },
  { value: "10-micron",  label: "10 micron",  desc: "Medium · most common" },
  { value: "25-micron",  label: "25 micron",  desc: "Coarse · heavy particulates" },
  { value: "50-micron",  label: "50 micron",  desc: "Very coarse · pre-filter" },
  { value: "custom",     label: "Custom / Other", desc: "Specify in notes" },
];

function OrdersTab({ clientName, onSubmitted, onPayInvoice }: { clientName: string; onSubmitted: () => void; onPayInvoice: (inquiryId: string) => void }) {
  const { uploadPO, requestCancellation, byClient } = useOrders();
  const { push: pushNotif } = useNotifications();
  /* Active orders only — Job Orders and Transactions live in their own tabs now */
  const myOrders = byClient(clientName).filter((i) => !i.archived && (i.stage === "inquiry" || i.stage === "quotation" || i.stage === "po"));
  /* Sent invoices have their own visibility rule and remain available after the order advances. */
  const myInvoices = byClient(clientName).filter((i) =>
    !i.archived && !!i.invoiceNo && !!i.invoiceSentAt
  );

  const [poForId, setPoForId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showJobs, setShowJobs] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);

  return (
    <div className="px-8 py-8 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-syne" style={{ fontSize: 26, fontWeight: 800, color: "#0F172A" }}>My Orders</h2>
          <p className="font-dm mt-0.5" style={{ fontSize: 13, color: "#64748B" }}>Active inquiries, quotations, and POs · click <strong>+ New Order</strong> to start a new inquiry.</p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="font-dm flex items-center gap-2 px-5 py-3 rounded-md text-white hover:opacity-90 shadow-sm"
          style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.4 }}
        >
          <Plus size={16} strokeWidth={3} /> New Order
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setShowTransactions(true)} className="font-dm flex items-center gap-2 px-4 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50" style={{ fontSize: 12, fontWeight: 700, color: "#1A2B4A" }}>
          <ClipboardList size={14} /> View Transaction History
        </button>
        <button onClick={() => setShowJobs(true)} className="font-dm flex items-center gap-2 px-4 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50" style={{ fontSize: 12, fontWeight: 700, color: "#1A2B4A" }}>
          <FileCheck size={14} /> View Job Orders
        </button>
      </div>

      {myOrders.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200/70 p-10 text-center font-dm" style={{ fontSize: 13, color: "#64748B" }}>
          No active orders yet — click <strong>+ New Order</strong> to submit your first inquiry.
        </div>
      )}
      {myInvoices.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h3 className="font-syne" style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>Sent Invoices</h3>
            <p className="font-dm mt-0.5" style={{ fontSize: 12, color: "#64748B" }}>Invoices remain available as your order moves through production and delivery.</p>
          </div>
          {myInvoices.map((invoice) => {
            const state = paymentState(invoice);
            return (
              <div key={invoice.id} className="bg-white rounded-xl border border-emerald-200 p-4 flex items-center gap-4" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
                <div className="flex-1 min-w-0">
                  <div className="font-dm" style={{ fontSize: 11, fontWeight: 800, color: "#15803D", letterSpacing: 0.4 }}>INVOICE SENT</div>
                  <div className="font-mono-jb mt-1" style={{ fontSize: 13, fontWeight: 700, color: "#1A2B4A" }}>{invoice.invoiceNo}</div>
                  <div className="font-dm mt-1" style={{ fontSize: 12, color: "#475569" }}>{invoice.poNumber ?? invoice.poFileName ?? invoice.code} · {invoice.paymentTerms}</div>
                </div>
                <div className="text-right">
                  <div className="font-syne" style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>{peso(state.invoiceTotal)}</div>
                  <button onClick={() => onPayInvoice(invoice.id)} className="font-dm mt-1 px-3 py-1.5 rounded-md text-white" style={{ backgroundColor: "#1A2B4A", fontSize: 11, fontWeight: 700 }}>VIEW IN ACCOUNTING</button>
                </div>
              </div>
            );
          })}
        </section>
      )}
      {myOrders.map((inq) => (
        <ClientOrderCard
          key={inq.id}
          inquiry={inq}
          onPayInvoice={() => onPayInvoice(inq.id)}
          onUploadPO={() => setPoForId(inq.id)}
          onCancel={(reason) => {
            requestCancellation(inq.id, reason, "client");
            pushNotif({
              dept: "sales",
              title: `🚨 Cancellation request from ${clientName}`,
              body: `${inq.code} · Reason: ${reason} · awaiting your accept/decline`,
              link: "sales",
              recipients: ["owner", "operations", "sales"],
            });
            toast.info("Cancellation request sent", { description: "Enter-Fil will accept or decline soon. You'll be notified." });
          }}
        />
      ))}

      {showWizard && (
        <NewOrderWizardModal
          clientName={clientName}
          onClose={() => setShowWizard(false)}
          onSubmitted={() => { setShowWizard(false); onSubmitted(); }}
        />
      )}

      {poForId && (
        <POUploadOverlay
          onClose={() => setPoForId(null)}
          onSubmit={({ fileName, fileDataUrl, poNumber }) => { uploadPO(poForId, fileName, fileDataUrl, poNumber); setPoForId(null); toast.success("Purchase Order submitted ✅", { description: "Management has been notified" }); }}
        />
      )}
      {showJobs && (
        <ClientTableModal title="Job Orders" onClose={() => setShowJobs(false)}>
          <JobOrdersTab clientName={clientName} />
        </ClientTableModal>
      )}
      {showTransactions && (
        <ClientTableModal title="Transaction History" onClose={() => setShowTransactions(false)}>
          <TransactionsTab clientName={clientName} />
        </ClientTableModal>
      )}
    </div>
  );
}

/* ─────────── JobOrdersTab — paid/delivered JOs derived from store with reorder support ─────────── */
function ClientTableModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.55)" }} onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-6xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <h3 className="font-syne" style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center" aria-label="Close"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function JobOrdersTab({ clientName }: { clientName: string }) {
  const { byClient, addInquiry } = useOrders();
  const { push: pushNotif } = useNotifications();
  /* Derived: this client's JOs that have reached production (jo or beyond). */
  const jobOrders = byClient(clientName).filter((i) => !i.archived && (i.stage === "jo" || i.stage === "in_production" || i.stage === "quality_inspection" || i.stage === "ready_for_dispatch" || i.stage === "dispatched" || i.stage === "delivered" || i.stage === "paid"));

  const reorder = (inq: Inquiry) => {
    const code = addInquiry({
      clientName,
      contactPerson: inq.contactPerson,
      paymentTerms: inq.paymentTerms,
      generalNotes: `Reorder of ${inq.joNumber ?? inq.code}`,
      products: inq.products.map((p, i) => ({ ...p, id: `p${i + 1}` })),
    });
    pushNotif({
      dept: "sales",
      title: `🔁 Reorder from ${clientName}`,
      body: `${code} · based on ${inq.joNumber ?? inq.code} · ${inq.products.reduce((s, p) => s + p.qty, 0)} pcs total · awaiting validation`,
      link: "sales",
      recipients: ["owner", "operations", "sales"],
    });
    toast.success(`Reorder submitted as ${code}`, { description: "Sent to Sales for validation." });
  };

  return (
    <div className="px-8 py-8 flex flex-col gap-4">
      <div>
        <h1 className="font-syne" style={{ fontSize: 26, fontWeight: 800, color: "#0F172A" }}>My Job Orders</h1>
        <p className="font-dm mt-0.5" style={{ fontSize: 13, color: "#64748B" }}>Click <strong>Reorder</strong> on any past production order to duplicate its specs.</p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
        <table className="w-full">
          <thead style={{ backgroundColor: "#F4F6F9" }}>
            <tr>
              {["Job Order", "Date", "Item", "Qty", "Status", ""].map((h) => (
                <th key={h} className="font-dm text-left px-4 py-3" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobOrders.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-8 text-center font-dm" style={{ fontSize: 13, color: "#94A3B8" }}>No job orders yet.</td></tr>
            )}
            {jobOrders.map((inq) => {
              const item = inq.products[0]?.filterName || labelForType(inq.products[0]?.type ?? "");
              const qty = inq.products.reduce((s, p) => s + p.qty, 0);
              return (
                <tr key={inq.id} className="border-t border-slate-200/70 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 11, fontWeight: 700, color: "#1A2B4A" }}>{inq.joNumber ?? inq.code}</td>
                  <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>{inq.deliveredDate ?? inq.submittedDate}</td>
                  <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#0F172A" }}>{item}</td>
                  <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{qty} pcs</td>
                  <td className="px-4 py-3"><span className="font-dm px-2.5 py-1 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: "#DCFCE7", color: "#15803D" }}>{inq.stage}</span></td>
                  <td className="px-4 py-3">
                    <button onClick={() => reorder(inq)} className="flex items-center gap-1 px-3 py-1.5 rounded-md font-dm text-white hover:opacity-90" style={{ fontSize: 11, fontWeight: 700, backgroundColor: "#C8102E", letterSpacing: 0.3 }}>
                      <RotateCcw size={12} /> Reorder
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────── TransactionsTab — paid invoices only, derived from store ─────────── */
function TransactionsTab({ clientName }: { clientName: string }) {
  const { byClient } = useOrders();

  /* Include delivered + paid orders */
  const allOrders = byClient(clientName).filter((i) => !i.archived && ["delivered", "paid"].includes(i.stage));

  return (
    <div className="px-8 py-8 flex flex-col gap-4">
      <div>
        <h1 className="font-syne" style={{ fontSize: 26, fontWeight: 800, color: "#0F172A" }}>Transaction History</h1>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
        <table className="w-full">
          <thead style={{ backgroundColor: "#F4F6F9" }}>
            <tr>
              {["Date", "PO No.", "Item", "Amount", "Payment Terms", "Status"].map((h) => (
                <th key={h} className="font-dm text-left px-4 py-3" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allOrders.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-8 text-center font-dm" style={{ fontSize: 13, color: "#94A3B8" }}>No transactions yet.</td></tr>
            )}
            {allOrders.map((inq) => (
              <tr key={inq.id} className="border-t border-slate-200/70 hover:bg-slate-50">
                <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>{inq.deliveredDate ?? inq.submittedDate}</td>
                <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 11, fontWeight: 600, color: "#1A2B4A" }}>{inq.code}</td>
                <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#0F172A" }}>{inq.products[0]?.filterName ?? labelForType(inq.products[0]?.type ?? "")}</td>
                <td className="px-4 py-3 font-syne" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>₱{(inq.invoiceAmount ?? inq.quotedTotal ?? 0).toLocaleString("en-PH")}</td>
                <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>{inq.paymentTerms}</td>
                <td className="px-4 py-3">
                  <span className="font-dm px-2.5 py-1 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: inq.stage === "paid" ? "#DCFCE7" : "#DBEAFE", color: inq.stage === "paid" ? "#15803D" : "#1D4ED8" }}>
                    {inq.stage === "paid" ? "✅ Paid" : "📦 Delivered"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}

/* ─────────── NewOrderWizardModal — multi-product wizard with dynamic dimensions ─────────── */
function NewOrderWizardModal({ clientName, onClose, onSubmitted }: { clientName: string; onClose: () => void; onSubmitted: () => void }) {
  const { addInquiry } = useOrders();
  const { push: pushNotif } = useNotifications();

  const [step, setStep] = useState(1);
  const [contactPerson, setContactPerson] = useState("");
  const [paymentTerms, setPaymentTerms] = useState<"15-Day Terms" | "30-Day Terms">("30-Day Terms");
  const [generalNotes, setGeneralNotes] = useState("");
  /* Multi-product state — clients can add multiple filters per inquiry. */
  const [products, setProducts] = useState<ProductLine[]>([{ ...blankProduct("p1"), filtrationRating: "10-micron" }]);
  const [activeIdx, setActiveIdx] = useState(0);
  /* Per-product sketch files — keyed by product id (File objects can't live in the store) */
  const [sketchFiles, setSketchFiles] = useState<Record<string, File | null>>({});
  const [isRush, setIsRush] = useState(false);
  const [rushDate, setRushDate] = useState("");

  const active = products[activeIdx];
  const updateActive = (patch: Partial<ProductLine>) => {
    setProducts((prev) => prev.map((p, i) => (i === activeIdx ? { ...p, ...patch } : p)));
  };

  const STEPS = [
    { num: 1, label: "Filter Type" },
    { num: 2, label: "Dimensions & Material" },
    { num: 3, label: "Filtration Rating" },
    { num: 4, label: "Add-ons" },
    { num: 5, label: "Review" },
  ];

  /* Whether step is complete based on current active product. */
  const canProceed = () => {
    if (step === 1) return !!active.type && (active.filterName?.trim().length ?? 0) >= 3;
    if (step === 2) {
      const dims = GROUP_TEMPLATES[groupForType(active.type)].dimensions;
      const required = dims[0]; // first listed dim is the primary required field per group
      return ((active as any)[required] ?? "").toString().trim().length > 0 && (active.media ?? "").trim().length > 0;
    }
    if (step === 3) return !!(active.filtrationRating ?? "10-micron");
    if (step === 4) return active.qty >= 10;
    return true;
  };

  const submit = () => {
    if (!contactPerson.trim()) { toast.error("Contact person required"); return; }
    if (products.some((p) => p.qty < 10)) { toast.error("Each product must have qty ≥ 10"); return; }
    if (isRush && !rushDate.trim()) { toast.error("Please specify your required delivery date for rush orders"); return; }

    /* Stamp per-product filtrationRating and sketchFileName, then build the finalProducts array. */
    const finalProducts: ProductLine[] = products.map((p) => {
      const rating = p.filtrationRating ?? "10-micron";
      const sketchFileObj = sketchFiles[p.id] ?? null;
      return {
        ...p,
        sketchFileName: sketchFileObj?.name ?? p.sketchFileName,
        notes: p.notes || (rating === "custom" ? `Custom filtration · ${generalNotes}` : `Filtration: ${rating}`),
      };
    });

    const code = addInquiry({
      clientName, contactPerson, paymentTerms, generalNotes,
      products: finalProducts,
      urgent: isRush,
      dueDate: isRush ? rushDate : undefined,
      /* Legacy single-sketch field — show comma-joined list for multi-product */
      inquirySketch: finalProducts.map((p) => p.sketchFileName).filter(Boolean).join(", ") || undefined,
    });
    pushNotif({
      dept: "sales",
      title: `New inquiry from ${clientName}${isRush ? " 🚨 RUSH" : ""}`,
      body: `${code} · ${finalProducts.length} product${finalProducts.length > 1 ? "s" : ""} · ${finalProducts.reduce((s, p) => s + p.qty, 0)} pcs total · ${isRush ? `Required by ${rushDate}` : "Standard"}`,
      link: "sales",
      recipients: ["owner", "operations", "sales"],
    });
    toast.success(isRush ? "🚨 Rush inquiry submitted" : "Inquiry submitted", { description: `${code} sent — we'll respond within 1 business day` });
    onSubmitted();
  };

  const addAnotherFilter = () => {
    const id = `p${Date.now()}`;
    setProducts((prev) => [...prev, { ...blankProduct(id), filtrationRating: "10-micron" }]);
    setActiveIdx(products.length);
    setStep(1);
  };
  const removeProduct = (idx: number) => {
    if (products.length === 1) return;
    setProducts((prev) => prev.filter((_, i) => i !== idx));
    setActiveIdx(Math.max(0, idx - 1));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.6)" }} onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-3xl flex flex-col" style={{ boxShadow: "0 24px 48px rgba(0,0,0,0.3)", maxHeight: "92vh" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between" style={{ backgroundColor: "#1A2B4A" }}>
          <div>
            <h2 className="font-syne text-white" style={{ fontSize: 18, fontWeight: 700 }}>New Order Inquiry</h2>
            <p className="font-dm text-white/60 mt-0.5" style={{ fontSize: 12 }}>
              Filter #{activeIdx + 1} of {products.length} · Step {step} of 5 — {STEPS[step - 1].label}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-white/10 flex items-center justify-center" style={{ color: "white" }}><X size={16} /></button>
        </div>

        {/* Product tabs (multi-product) — always visible, with + Add Another */}
        <div className="px-6 py-3 border-b border-slate-200 flex items-center gap-2 overflow-auto" style={{ backgroundColor: "#FAFBFC" }}>
          {products.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setActiveIdx(i)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md font-dm whitespace-nowrap transition-all"
              style={{
                fontSize: 12, fontWeight: 700,
                border: i === activeIdx ? "2px solid #C8102E" : "1px solid #CBD5E1",
                backgroundColor: i === activeIdx ? "#FEF2F2" : "white",
                color: i === activeIdx ? "#C8102E" : "#475569",
              }}
            >
              {FILTER_TYPE_ICON[p.type] ?? "🔩"} Filter #{i + 1}{p.filterName ? ` · ${p.filterName}` : ""}
              {/* Show sketch indicator */}
              {(sketchFiles[p.id] ?? p.sketchFileName) && <span title="Sketch attached" style={{ fontSize: 10 }}>📎</span>}
              {products.length > 1 && (
                <span onClick={(e) => { e.stopPropagation(); removeProduct(i); }} className="ml-1 hover:text-red-700"><X size={12} /></span>
              )}
            </button>
          ))}
          {/* Always-visible + Add Another Filter button */}
          <button
            onClick={addAnotherFilter}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-dm whitespace-nowrap hover:bg-slate-100 transition-all"
            style={{ fontSize: 12, fontWeight: 700, color: "#475569", border: "1px dashed #CBD5E1", backgroundColor: "white" }}
          >
            <Plus size={11} /> Add Filter
          </button>
        </div>

        {/* Stepper */}
        <div className="px-6 py-4 border-b border-slate-200" style={{ backgroundColor: "#F8FAFC" }}>
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <Fragment key={s.num}>
                <button
                  onClick={() => s.num < step && setStep(s.num)}
                  disabled={s.num > step}
                  className="flex items-center gap-2 transition-opacity disabled:opacity-40"
                >
                  <span className="w-7 h-7 rounded-full flex items-center justify-center font-syne" style={{ fontSize: 12, fontWeight: 800, backgroundColor: s.num === step ? "#C8102E" : s.num < step ? "#16A34A" : "#E2E8F0", color: s.num <= step ? "white" : "#94A3B8" }}>
                    {s.num < step ? "✓" : s.num}
                  </span>
                  <span className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: s.num === step ? "#C8102E" : s.num < step ? "#15803D" : "#94A3B8", letterSpacing: 0.3 }}>{s.label}</span>
                </button>
                {i < STEPS.length - 1 && <div className="flex-1 h-0.5" style={{ backgroundColor: i < step - 1 ? "#16A34A" : "#E2E8F0" }} />}
              </Fragment>
            ))}
          </div>
        </div>

        <div className="p-6 overflow-auto flex flex-col gap-5" style={{ minHeight: 380 }}>
          {/* Inquiry-level info shown only on step 1 */}
          {step === 1 && (
            <div className="rounded-lg p-4 grid grid-cols-2 gap-3" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <Field label="Company"><input value={clientName} disabled className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 bg-slate-100" style={{ fontSize: 13, color: "#475569" }} /></Field>
              <Field label="Contact Person *"><input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Full name" className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} /></Field>
              <Field label="Payment Terms">
                <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value as any)} className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }}>
                  <option>15-Day Terms</option><option>30-Day Terms</option>
                </select>
              </Field>
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Notes <span style={{ color: "#94A3B8", fontWeight: 400 }}>(optional)</span></label>
                <textarea value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} placeholder="Special instructions, brand references..." rows={2} className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white resize-none" style={{ fontSize: 13 }} />
              </div>
            </div>
          )}

          {/* STEP 1 — Filter Type (16 types grouped by category, single click) */}
          {step === 1 && (
            <FilterTypePicker
              selectedType={active.type}
              filterName={active.filterName ?? ""}
              onTypeChange={(code) => updateActive({ type: code })}
              onNameChange={(name) => updateActive({ filterName: name })}
            />
          )}

          {/* STEP 2 — Dimensions & Material (group-driven dynamic fields) */}
          {step === 2 && (
            <DynamicDimensionFields product={active} onChange={updateActive} />
          )}

          {/* STEP 3 — Filtration Rating (per-product) */}
          {step === 3 && (
            <div>
              <div className="font-dm mb-1" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>What filtration rating do you need?</div>
              <div className="font-dm mb-3" style={{ fontSize: 11, color: "#94A3B8" }}>
                This rating applies to <span style={{ fontWeight: 700, color: "#1A2B4A" }}>Filter #{activeIdx + 1}{active.filterName ? ` · ${active.filterName}` : ""}</span> only.
              </div>
              <div className="grid grid-cols-2 gap-3">
                {FILTRATION_RATINGS.map((r) => {
                  const act = (active.filtrationRating ?? "10-micron") === r.value;
                  return (
                    <button key={r.value} onClick={() => updateActive({ filtrationRating: r.value })} className="rounded-lg p-3 flex flex-col items-start gap-0.5 text-left" style={{ border: act ? "2px solid #C8102E" : "1px solid #E2E8F0", backgroundColor: act ? "#FEF2F2" : "white", padding: act ? 11 : 12 }}>
                      <span className="font-syne" style={{ fontSize: 14, fontWeight: 700, color: act ? "#C8102E" : "#0F172A" }}>{r.label}</span>
                      <span className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>{r.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4 — Add-ons (qty + optional + sketch + rush) */}
          {step === 4 && (
            <div className="flex flex-col gap-4">
              <div>
                <div className="font-dm mb-3" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Quantity *</div>
                <input type="number" min={10} value={active.qty} onChange={(e) => updateActive({ qty: Number(e.target.value) })} className="w-full font-syne px-4 py-3 rounded-md border-2 border-slate-300 outline-none focus:border-slate-500 bg-white" style={{ fontSize: 24, fontWeight: 800, color: "#0F172A" }} />
                <div className="font-dm mt-1" style={{ fontSize: 11, color: active.qty < 10 ? "#C8102E" : "#94A3B8" }}>{active.qty < 10 ? "⚠️ Minimum order quantity is 10 pcs" : "Minimum 10 pcs"}</div>
              </div>
              <div>
                <div className="font-dm mb-2" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Optional components</div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Inner Core"><input value={active.innerCore ?? ""} onChange={(e) => updateActive({ innerCore: e.target.value })} placeholder="e.g. Perforated 2mm" className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} /></Field>
                  <Field label="Outer Core"><input value={active.outerCore ?? ""} onChange={(e) => updateActive({ outerCore: e.target.value })} className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} /></Field>
                  <Field label="O-Ring"><input value={active.oring ?? ""} onChange={(e) => updateActive({ oring: e.target.value })} className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} /></Field>
                  <Field label="Gasket"><input value={active.gasket ?? ""} onChange={(e) => updateActive({ gasket: e.target.value })} className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} /></Field>
                  <Field label="OEM Reference"><input value={active.oem ?? ""} onChange={(e) => updateActive({ oem: e.target.value })} placeholder="e.g. KF-OS.107.65.252" className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} /></Field>
                </div>
              </div>
              <div className="rounded-lg p-3" style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                <div className="font-dm mb-1" style={{ fontSize: 11, fontWeight: 700, color: "#1E3A8A", letterSpacing: 0.4, textTransform: "uppercase" }}>📎 Engineer Sketch (Optional)</div>
                <div className="font-dm mb-2" style={{ fontSize: 10, color: "#3B82F6" }}>
                  Sketch for <span style={{ fontWeight: 700 }}>Filter #{activeIdx + 1}{active.filterName ? ` · ${active.filterName}` : ""}</span> only — each filter has its own sketch.
                </div>
                {(() => {
                  const sketchFile = sketchFiles[active.id] ?? null;
                  const savedName = active.sketchFileName;
                  return sketchFile ? (
                    <div className="flex items-center gap-3 bg-white rounded-md px-3 py-2 border border-blue-200">
                      <FileCheck size={14} style={{ color: "#2563EB" }} />
                      <span className="font-dm flex-1" style={{ fontSize: 12, color: "#0F172A", fontWeight: 600 }}>{sketchFile.name}</span>
                      <button onClick={() => { setSketchFiles((prev) => ({ ...prev, [active.id]: null })); updateActive({ sketchFileName: undefined }); }} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                    </div>
                  ) : savedName ? (
                    <div className="flex items-center gap-3 bg-white rounded-md px-3 py-2 border border-blue-200">
                      <FileCheck size={14} style={{ color: "#2563EB" }} />
                      <span className="font-dm flex-1" style={{ fontSize: 12, color: "#0F172A", fontWeight: 600 }}>{savedName}</span>
                      <button onClick={() => updateActive({ sketchFileName: undefined })} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setSketchFiles((prev) => ({ ...prev, [active.id]: f })); updateActive({ sketchFileName: f.name }); } }} />
                      <span className="flex items-center gap-2 px-3 py-2 rounded-md font-dm hover:bg-blue-100" style={{ fontSize: 12, fontWeight: 600, color: "#1D4ED8", border: "1.5px dashed #93C5FD" }}>
                        <Camera size={13} /> Browse JPG / PNG / PDF
                      </span>
                    </label>
                  );
                })()}
              </div>
              <div className="rounded-lg p-3" style={{ backgroundColor: isRush ? "#FEF2F2" : "#F8FAFC", border: isRush ? "1.5px solid #FECACA" : "1px solid #E2E8F0" }}>
                <label className="flex items-center gap-3 cursor-pointer" onClick={() => setIsRush((r) => !r)}>
                  <div className="w-10 h-6 rounded-full transition-colors flex items-center px-1" style={{ backgroundColor: isRush ? "#C8102E" : "#CBD5E1" }}>
                    <div className="w-4 h-4 bg-white rounded-full shadow transition-transform" style={{ transform: isRush ? "translateX(16px)" : "translateX(0)" }} />
                  </div>
                  <div>
                    <div className="font-dm" style={{ fontSize: 13, fontWeight: 700, color: isRush ? "#C8102E" : "#0F172A" }}>🚨 Rush / Urgent Order</div>
                    <div className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>Specify your required delivery date</div>
                  </div>
                </label>
                {isRush && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    <input type="text" placeholder="e.g. May 5, 2026" value={rushDate} onChange={(e) => setRushDate(e.target.value)} className="font-dm px-3 py-2 rounded-md border border-red-200 outline-none focus:border-red-400 bg-white" style={{ fontSize: 13 }} />
                    {/* Email gateway not implemented */}
                    <p className="font-dm" style={{ fontSize: 11, color: "#C8102E" }}>Confirmation within 4 hours via email.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5 — Review */}
          {step === 5 && (
            <div className="flex flex-col gap-3">
              <div className="font-dm" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Review your order before submitting</div>
              {products.map((p, i) => (
                <div key={p.id} className="rounded-lg p-4" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                  <div className="font-syne mb-2" style={{ fontSize: 13, fontWeight: 800, color: "#1A2B4A" }}>Filter #{i + 1} — {labelForType(p.type)}</div>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                    <ReviewLine label="Filter Name" value={p.filterName ?? "—"} />
                    <ReviewLine label="Quantity" value={`${p.qty} pcs`} />
                    {GROUP_TEMPLATES[groupForType(p.type)].dimensions.map((dim) => (
                      <ReviewLine key={dim} label={DIMENSION_LABELS[dim]} value={(p as any)[dim] ? String((p as any)[dim]) : "—"} />
                    ))}
                    <ReviewLine label="Media" value={p.media || "—"} />
                    <ReviewLine label="OEM Ref" value={p.oem || "—"} />
                  </div>
                </div>
              ))}
              <div className="rounded-lg p-4 grid grid-cols-2 gap-y-2 gap-x-4" style={{ backgroundColor: "#FEF3C7", border: "1px solid #FDE68A" }}>
                <ReviewLine label="Payment Terms" value={paymentTerms} />
                {isRush && <ReviewLine label="🚨 Rush Date" value={rushDate} accent="#C8102E" />}
              </div>
              {/* Per-product filtration + sketch summary */}
              {products.map((p, i) => (
                <div key={p.id} className="rounded-md px-3 py-2 flex items-center gap-3 flex-wrap" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                  <span className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#1A2B4A" }}>Filter #{i + 1}{p.filterName ? ` · ${p.filterName}` : ""}</span>
                  <span className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>
                    Filtration: <span style={{ fontWeight: 600, color: "#0F172A" }}>{FILTRATION_RATINGS.find((r) => r.value === (p.filtrationRating ?? "10-micron"))?.label ?? p.filtrationRating ?? "10 micron"}</span>
                  </span>
                  <span className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>
                    Sketch: <span style={{ fontWeight: 600, color: (sketchFiles[p.id] ?? p.sketchFileName) ? "#16A34A" : "#94A3B8" }}>
                      {sketchFiles[p.id]?.name ?? p.sketchFileName ?? "Not attached"}
                    </span>
                  </span>
                </div>
              ))}
              {!contactPerson.trim() && (
                <div className="rounded-md p-3 font-dm" style={{ fontSize: 12, color: "#991B1B", backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }}>⚠️ Please add your contact person on Step 1 before submitting.</div>
              )}
            </div>
          )}
        </div>

        {/* Footer / nav */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2">
          <button onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1} className="font-dm px-4 py-2.5 rounded-md hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>← Back</button>
          <div className="flex items-center gap-2">
            {step < 5 ? (
              <button onClick={() => (canProceed() ? setStep((s) => s + 1) : toast.error("Please complete the required fields"))} disabled={!canProceed()} className="font-dm px-5 py-2.5 rounded-md text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2" style={{ backgroundColor: "#1A2B4A", fontSize: 13, fontWeight: 700, letterSpacing: 0.4 }}>
                Next: {STEPS[step].label} →
              </button>
            ) : (
              <button onClick={submit} className="font-dm flex items-center gap-2 px-5 py-2.5 rounded-md text-white hover:opacity-90" style={{ backgroundColor: isRush ? "#991B1B" : "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
                <ClipboardList size={15} strokeWidth={2.5} /> {isRush ? "🚨 Submit Rush Inquiry" : "Submit Inquiry"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Renders the 16 filter types grouped visually but each clickable directly. After selection, asks for filter name (≥3 chars). */
function FilterTypePicker({ selectedType, filterName, onTypeChange, onNameChange }: { selectedType: string; filterName: string; onTypeChange: (code: string) => void; onNameChange: (name: string) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="font-dm" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>What type of filter do you need?</div>
      {GROUP_DISPLAY.map(({ group, label }) => {
        const types = Object.values(FILTER_TYPE_CATALOG).filter((t) => t.group === group);
        if (types.length === 0) return null;
        return (
          <div key={group}>
            <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</div>
            <div className="grid grid-cols-3 gap-2">
              {types.map((t) => {
                const active = selectedType === t.code;
                return (
                  <button key={t.code} onClick={() => onTypeChange(t.code)} className="rounded-lg p-3 flex items-center gap-2 text-left transition-all" style={{ border: active ? "2px solid #C8102E" : "1px solid #E2E8F0", backgroundColor: active ? "#FEF2F2" : "white", padding: active ? 11 : 12 }}>
                    <span style={{ fontSize: 18 }}>{FILTER_TYPE_ICON[t.code] ?? "🔧"}</span>
                    <span className="font-dm" style={{ fontSize: 12, fontWeight: 700, color: active ? "#C8102E" : "#0F172A" }}>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="rounded-lg p-4" style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
        <label className="font-dm block mb-2" style={{ fontSize: 12, fontWeight: 700, color: "#1E3A8A" }}>Filter Name * <span style={{ fontWeight: 400, color: "#64748B" }}>(at least 3 characters)</span></label>
        <input value={filterName} onChange={(e) => onNameChange(e.target.value)} placeholder="e.g. Air/Oil Separator Filter" className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
      </div>
    </div>
  );
}

/* Group-driven dimension fields. Reads the group from the selected filter type. */
function DynamicDimensionFields({ product, onChange }: { product: ProductLine; onChange: (p: Partial<ProductLine>) => void }) {
  const group = groupForType(product.type);
  const dims = GROUP_TEMPLATES[group].dimensions;
  const setDim = (key: DimensionKey, v: string) => onChange({ [key]: v } as Partial<ProductLine>);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="font-dm mb-3" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Dimensions <span style={{ fontWeight: 400, color: "#94A3B8" }}>· {labelForType(product.type)}</span></div>
        <div className="grid grid-cols-3 gap-3">
          {dims.map((dim, i) => (
            <Field key={dim} label={`${DIMENSION_LABELS[dim]}${i === 0 ? " *" : ""}`}>
              <input
                type="number"
                value={(product as any)[dim] ?? ""}
                onChange={(e) => setDim(dim, e.target.value)}
                className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white"
                style={{ fontSize: 13 }}
              />
            </Field>
          ))}
        </div>
      </div>
      <div>
        <div className="font-dm mb-2" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Filter Media *</div>
        <input value={product.media ?? ""} onChange={(e) => onChange({ media: e.target.value })} placeholder="e.g. Microglass Fiber, Pleated ZS20, Cellulose, Stainless mesh..." className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
      </div>
    </div>
  );
}


function ProductCard({ index, product, isOpen, onToggle, onChange, onRemove }: {
  index: number; product: ProductLine; isOpen: boolean;
  onToggle: () => void; onChange: (p: Partial<ProductLine>) => void; onRemove?: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: isOpen ? "#1A2B4A" : "#F4F6F9" }}>
        <button onClick={onToggle} className="flex-1 flex items-center gap-2 text-left">
          <span className="font-syne" style={{ fontSize: 13, fontWeight: 700, color: isOpen ? "white" : "#0F172A" }}>Product #{index + 1} — {product.type}</span>
          <span className="font-dm" style={{ fontSize: 12, color: isOpen ? "rgba(255,255,255,0.7)" : "#64748B" }}>· Qty {product.qty}</span>
        </button>
        <div className="flex items-center gap-1">
          {onRemove && (
            <button onClick={onRemove} aria-label="Remove product" className="w-7 h-7 rounded-md hover:bg-white/20 flex items-center justify-center" style={{ color: isOpen ? "white" : "#C8102E" }}>
              <Trash2 size={14} />
            </button>
          )}
          <button onClick={onToggle} className="w-7 h-7 rounded-md hover:bg-white/20 flex items-center justify-center" style={{ color: isOpen ? "white" : "#475569" }}>
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="p-4 flex flex-col gap-3">
          <Field label="Filter Type">
            <select value={product.type} onChange={(e) => onChange({ type: e.target.value })} className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }}>
              <option>Air Filter</option><option>Oil Filter</option><option>Oil Separator</option><option>Column Filter</option>
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="OD 1 (mm)"><Num v={product.od1 ?? ""} onChange={(v) => onChange({ od1: v })} /></Field>
            <Field label="OD 2 (mm)"><Num v={product.od2 ?? ""} onChange={(v) => onChange({ od2: v })} /></Field>
            <Field label="Height (mm)"><Num v={product.height ?? ""} onChange={(v) => onChange({ height: v })} /></Field>
            <Field label="ID 1 (mm)"><Num v={product.id1 ?? ""} onChange={(v) => onChange({ id1: v })} /></Field>
            <Field label="ID 2 (mm)"><Num v={product.id2 ?? ""} onChange={(v) => onChange({ id2: v })} /></Field>
            <Field label="OEM Ref."><Txt v={product.oem ?? ""} onChange={(v) => onChange({ oem: v })} /></Field>
          </div>
          <Field label="Filter Media"><Txt v={product.media ?? ""} onChange={(v) => onChange({ media: v })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Inner Core"><Txt v={product.innerCore ?? ""} onChange={(v) => onChange({ innerCore: v })} /></Field>
            <Field label="Outer Core"><Txt v={product.outerCore ?? ""} onChange={(v) => onChange({ outerCore: v })} /></Field>
            <Field label="O-Ring"><Txt v={product.oring ?? ""} onChange={(v) => onChange({ oring: v })} /></Field>
            <Field label="Gasket"><Txt v={product.gasket ?? ""} onChange={(v) => onChange({ gasket: v })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity *">
              <input type="number" min={10} value={product.qty} onChange={(e) => onChange({ qty: Number(e.target.value) })} className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />
              <div className="font-dm mt-1" style={{ fontSize: 11, color: "#64748B" }}>Min: 10 pcs</div>
            </Field>
            <Field label="Line Notes"><Txt v={product.notes ?? ""} onChange={(v) => onChange({ notes: v })} /></Field>
          </div>
        </div>
      )}
    </div>
  );
}

function ClientOrderCard({ inquiry, onUploadPO, onCancel, onPayInvoice }: { inquiry: Inquiry; onUploadPO: () => void; onCancel: (reason: string) => void; onPayInvoice: () => void }) {
  const { updateInquiry } = useOrders();
  const { push: pushNotif } = useNotifications();
  const [open, setOpen] = useState(inquiry.stage === "quotation");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  /* Section C — revision request modal */
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionNoteDraft, setRevisionNoteDraft] = useState("");
  /* View full quotation doc */
  const [showQuotationDoc, setShowQuotationDoc] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  /* View terms & conditions */
  const [showTerms, setShowTerms] = useState(false);
  const total = inquiry.quotationDoc?.total ?? quotationTotal(inquiry);
  const invoicePayment = paymentState(inquiry);
  const invoiceDownpaymentPercent = inquiry.quotationDoc?.downpaymentPercent ?? inquiry.downpaymentPercent ?? 0;
  const submittedPayments = paymentRecords(inquiry);
  const latestSubmittedPayment = submittedPayments[submittedPayments.length - 1];

  const submitRevision = () => {
    const note = revisionNoteDraft.trim();
    if (note.length < 5) { toast.error("Please describe what you'd like changed (at least a few words)"); return; }
    updateInquiry(inquiry.id, { revisionNote: note });
    pushNotif({
      dept: "sales",
      title: `📝 Revision request from ${inquiry.clientName}`,
      body: `${inquiry.code} · ${note}`,
      link: "sales",
      recipients: ["sales"],
    });
    toast.success("Revision request sent", { description: "Sales will review and send a revised quotation soon." });
    setShowRevisionModal(false);
    setRevisionNoteDraft("");
  };

  const badge =
    inquiry.stage === "inquiry" ? { bg: "#E2E8F0", fg: "#475569", label: "Awaiting Quotation" } :
    inquiry.stage === "quotation" ? { bg: "#FEF3C7", fg: "#B45309", label: "Quotation Received" } :
    hasPORecord(inquiry)
      ? { bg: "#DCFCE7", fg: "#15803D", label: "PO Submitted ✅" }
      : { bg: "#E2E8F0", fg: "#475569", label: "Awaiting Client PO" };

  return (
    <article className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50">
        <div className="flex items-center gap-3 flex-wrap text-left">
          <span className="font-mono-jb" style={{ fontSize: 13, fontWeight: 600, color: "#1A2B4A" }}>{inquiry.code}</span>
          <span className="font-dm" style={{ fontSize: 13, color: "#0F172A", fontWeight: 600 }}>{inquiry.products.length} {inquiry.products.length === 1 ? "product" : "products"}</span>
          <span className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>· {inquiry.submittedDate}</span>
        </div>
        <div className="flex items-center gap-3">
          {inquiry.urgent && <span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 800, backgroundColor: "#FEE2E2", color: "#C8102E", letterSpacing: 0.3 }}>🚨 RUSH</span>}
          <span className="font-dm px-2.5 py-1 rounded-full" style={{ fontSize: 11, fontWeight: 600, backgroundColor: badge.bg, color: badge.fg }}>{badge.label}</span>
          {total > 0 && <span className="font-syne" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{peso(total)}</span>}
          {open ? <ChevronUp size={16} style={{ color: "#64748B" }} /> : <ChevronDown size={16} style={{ color: "#64748B" }} />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-slate-200" style={{ backgroundColor: "#FAFBFC" }}>
          {inquiry.stage === "inquiry" && (
            <div className="py-4 font-dm" style={{ fontSize: 13, color: "#64748B" }}>
              We've received your inquiry — our team will send a quotation within 1 business day.
            </div>
          )}

          {inquiry.invoiceNo && inquiry.invoiceSentAt && (
            <div className="my-4 rounded-lg p-4" style={{ backgroundColor: "#F0FDF4", border: "1.5px solid #86EFAC" }}>
              <div className="font-dm mb-3" style={{ fontSize: 12, fontWeight: 800, color: "#15803D", letterSpacing: 0.4 }}>INVOICE</div>
              <div className="grid grid-cols-2 gap-2 font-dm" style={{ fontSize: 12, color: "#475569" }}>
                <span>Invoice No.</span><strong>{inquiry.invoiceNo}</strong>
                <span>PO No.</span><strong>{inquiry.poNumber ?? inquiry.poFileName ?? "—"}</strong>
                <span>Invoice Total</span><strong>{peso(invoicePayment.invoiceTotal)}</strong>
                <span>Payment Terms</span><strong>{inquiry.quotationDoc?.termsOfPayment ?? inquiry.paymentTerms}</strong>
                {invoiceDownpaymentPercent > 0 && <>
                  <span>DOWNPAYMENT REQUIRED</span><strong>{invoiceDownpaymentPercent}%</strong>
                  <span>AMOUNT DUE</span><strong>{peso(invoicePayment.requiredDownpaymentAmount)}</strong>
                  <span>REMAINING BALANCE</span><strong>{peso(invoicePayment.remainingInvoiceBalance)}</strong>
                </>}
              </div>
              {invoicePayment.state === "FULLY_PAID" ? (
                <div className="mt-3 rounded-md p-2 font-dm" style={{ backgroundColor: "#DCFCE7", color: "#166534", fontSize: 12, fontWeight: 800 }}>✓ PAYMENT VERIFIED · FULLY PAID</div>
              ) : invoiceDownpaymentPercent > 0 && invoicePayment.downpaymentStatus === "COMPLETE" ? (
                <div className="mt-3 rounded-md p-2 font-dm" style={{ backgroundColor: "#DCFCE7", color: "#166534", fontSize: 12, fontWeight: 800 }}>
                  ✓ DOWNPAYMENT VERIFIED · {peso(invoicePayment.verifiedDownpaymentAmount)} verified · Remaining balance {peso(invoicePayment.remainingInvoiceBalance)}
                </div>
              ) : latestSubmittedPayment?.verificationStatus === "rejected" ? (
                <div className="mt-3 rounded-md p-2 font-dm" style={{ backgroundColor: "#FEF2F2", color: "#991B1B", fontSize: 12, fontWeight: 800 }}>PAYMENT REJECTED · Please resubmit proof in Accounting</div>
              ) : latestSubmittedPayment?.verificationStatus === "pending" ? (
                <div className="mt-3 rounded-md p-2 font-dm" style={{ backgroundColor: "#EFF6FF", color: "#1E40AF", fontSize: 12, fontWeight: 800 }}>PAYMENT SUBMITTED · AWAITING ACCOUNTING VERIFICATION</div>
              ) : null}
              <div className="flex gap-2 mt-4">
                <button onClick={() => setShowInvoice(true)} className="flex-1 rounded-md px-3 py-2 font-dm" style={{ backgroundColor: "#FFFFFF", border: "1px solid #86EFAC", color: "#166534", fontSize: 11, fontWeight: 800 }}>VIEW INVOICE</button>
                {invoicePayment.currentPaymentType && <button onClick={onPayInvoice} className="flex-1 rounded-md px-3 py-2 font-dm text-white" style={{ backgroundColor: "#1A2B4A", fontSize: 11, fontWeight: 800 }}>MAKE PAYMENT</button>}
              </div>
            </div>
          )}

          {inquiry.quotation && (
            <div className="py-4 flex flex-col gap-3">
              <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                <table className="w-full">
                  <thead style={{ backgroundColor: "#F4F6F9" }}>
                    <tr>
                      {["Product", "Qty", "Unit Price", "Subtotal"].map((h) => (
                        <th key={h} className="font-dm text-left px-3 py-2" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {inquiry.products.map((p, i) => {
                      const l = inquiry.quotation!.lines.find((ll) => ll.productId === p.id);
                      if (!l) return null;
                      const docLine = inquiry.quotationDoc?.lineItems[i];
                      const u = docLine?.unitPrice ?? unitPrice(l);
                      const rowQty = docLine?.qty ?? p.qty;
                      return (
                        <tr key={p.id} className="border-t border-slate-200">
                          <td className="px-3 py-3 font-dm" style={{ fontSize: 13, color: "#0F172A" }}>
                            <span style={{ fontWeight: 700 }}>#{i + 1}</span> {p.type}{p.oem && <span className="font-mono-jb ml-1" style={{ fontSize: 11, color: "#64748B" }}>· {p.oem}</span>}
                          </td>
                          <td className="px-3 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{rowQty}</td>
                          <td className="px-3 py-3 font-syne" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{peso(u)}</td>
                          <td className="px-3 py-3 font-syne" style={{ fontSize: 14, fontWeight: 800, color: "#C8102E" }}>{peso(u * rowQty)}</td>
                        </tr>
                      );
                    })}
                    <tr style={{ backgroundColor: "#1A2B4A" }}>
                      <td colSpan={3} className="px-3 py-3 font-dm text-white/70" style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>Total</td>
                      <td className="px-3 py-3 font-syne text-white" style={{ fontSize: 18, fontWeight: 800 }}>{peso(total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>
                Pricing based on Raw Materials + Labor + Markup. Lead time: <span style={{ fontWeight: 700, color: "#0F172A" }}>{inquiry.quotation.leadTimeDays} business days</span>. MOQ: 10 pcs per product.
              </div>
              {inquiry.quotationDoc?.discounts?.map((discount) => (
                <div key={`${discount.label}-${discount.percent}`} className="font-dm" style={{ fontSize: 12, color: "#15803D", fontWeight: 700 }}>
                  {discount.label}: {discount.percent}%
                </div>
              ))}

              {/* View Full Quotation Document — available when quotationDoc is set */}
              {inquiry.quotationDoc && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setShowQuotationDoc(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-md font-dm hover:bg-blue-50"
                    style={{ fontSize: 12, fontWeight: 700, color: "#1D4ED8", border: "1px solid #BFDBFE", backgroundColor: "#EFF6FF" }}
                  >
                    📄 View Full Quotation Document ({inquiry.quotationDoc.quotationNo})
                  </button>
                  <button
                    onClick={() => setShowTerms((v) => !v)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-md font-dm hover:bg-amber-50 transition-colors"
                    style={{ fontSize: 12, fontWeight: 700, color: "#92400E", border: "1px solid #FDE68A", backgroundColor: showTerms ? "#FEF3C7" : "#FFFBEB" }}
                  >
                    📋 {showTerms ? "Hide" : "View"} Terms &amp; Conditions
                    {showTerms ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                </div>
              )}

              {/* Collapsible T&C panel */}
              {showTerms && inquiry.quotationDoc && (
                <div className="rounded-xl p-4 flex flex-col gap-2" style={{ backgroundColor: "#FFFBEB", border: "1.5px solid #FDE68A" }}>
                  <div className="font-dm flex items-center gap-2 mb-1" style={{ fontSize: 11, fontWeight: 800, color: "#92400E", letterSpacing: 0.5, textTransform: "uppercase" }}>
                    📋 Terms &amp; Conditions — Included with Quotation
                  </div>

                  {/* Downpayment note — only when set */}
                  {inquiry.quotationDoc.downpaymentPercent && inquiry.quotationDoc.downpaymentAmount ? (
                    <div className="rounded-lg px-3 py-2.5 flex items-start gap-2" style={{ backgroundColor: "#EFF6FF", border: "1.5px solid #BFDBFE" }}>
                      <span style={{ fontSize: 16, lineHeight: 1 }}>💳</span>
                      <div className="font-dm" style={{ fontSize: 12, color: "#1E3A8A", lineHeight: 1.5 }}>
                        <span style={{ fontWeight: 800 }}>Downpayment Required — {inquiry.quotationDoc.downpaymentPercent}%:</span>{" "}
                        A downpayment of{" "}
                        <span className="font-mono-jb" style={{ fontWeight: 800, color: "#1D4ED8" }}>
                          ₱{inquiry.quotationDoc.downpaymentAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>{" "}
                        is required before production begins. The remaining balance of{" "}
                        <span className="font-mono-jb" style={{ fontWeight: 700 }}>
                          ₱{((inquiry.quotationDoc.total ?? inquiry.quotationDoc.lineItems.reduce((s, li) => s + li.unitPrice * li.qty, 0)) - inquiry.quotationDoc.downpaymentAmount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>{" "}
                        is due upon delivery.
                      </div>
                    </div>
                  ) : null}

                  <div className="font-dm flex flex-col gap-1.5" style={{ fontSize: 12, color: "#78350F", lineHeight: 1.6 }}>
                    <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
                      <li><span style={{ fontWeight: 700 }}>Payment:</span>{" "}Payment terms are indicated in the quotation. Required downpayments must be verified before the order proceeds.</li>
                      <li><span style={{ fontWeight: 700 }}>No Refunds:</span>{" "}All sales are final. No refunds will be issued once the order has been confirmed and processed.</li>
                      <li><span style={{ fontWeight: 700 }}>No Replacements:</span>{" "}Products are not eligible for replacement after delivery.</li>
                      <li><span style={{ fontWeight: 700 }}>Delivery:</span>{" "}Delivery arrangements and schedules are based on the confirmed order. Actual delivery may vary depending on production completion and logistics.</li>
                      <li><span style={{ fontWeight: 700 }}>Contact:</span>{" "}Tel: +63 (2) 8861-5737 / +63 (2) 8653-3750 · Mobile: +63 (956) 657-3837 · Email: <a href="mailto:enterfil.filtration@yahoo.com" style={{ color: "#78350F", textDecoration: "underline" }}>enterfil.filtration@yahoo.com</a> / <a href="mailto:zluetaellen@gmail.com" style={{ color: "#78350F", textDecoration: "underline" }}>zuluetaellen@gmail.com</a></li>
                      <li><span style={{ fontWeight: 700 }}>Office Hours:</span>{" "}Monday–Friday, 8:00 AM–6:00 PM · Sitio Hulo, Brgy. Balasing – San Jose Rd, Santa Maria, 3022 Bulacan</li>
                    </ul>
                  </div>
                </div>
              )}

              {inquiry.stage === "quotation" && (
                <>
                  {inquiry.revisionNote && !inquiry.quotationHistory?.length && (
                    <div className="rounded-md p-3 font-dm" style={{ fontSize: 12, color: "#92400E", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
                      ⏳ Revision requested: <em>{inquiry.revisionNote}</em> — Enter-Fil will send a revised quotation soon.
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <button onClick={onUploadPO} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-md text-white font-dm hover:opacity-90" style={{ backgroundColor: "#16A34A", fontSize: 13, fontWeight: 700, letterSpacing: 0.4 }}>
                      <FileCheck size={15} strokeWidth={2.5} /> APPROVE &amp; UPLOAD PURCHASE ORDER
                    </button>
                    <button onClick={() => setShowRevisionModal(true)} className="px-4 py-3 rounded-md font-dm border-2 hover:bg-slate-50" style={{ borderColor: "#1A2B4A", color: "#1A2B4A", fontSize: 13, fontWeight: 700 }}>
                      Request Revision
                    </button>
                  </div>
                </>
              )}
              {inquiry.stage === "po" && inquiry.poFileName && (
                <div className="rounded-md p-3 font-dm" style={{ backgroundColor: "#DCFCE7", border: "1px solid #86EFAC", fontSize: 13, color: "#166534" }}>
                  ✅ PO submitted: <span style={{ fontWeight: 700 }}>{inquiry.poFileName}</span> — {invoicePayment.state === "FULLY_PAID"
                    ? "payment verified in full; order is ready for Job Order processing."
                    : invoiceDownpaymentPercent > 0 && invoicePayment.downpaymentStatus === "COMPLETE"
                    ? `required downpayment verified; remaining balance ${peso(invoicePayment.remainingInvoiceBalance)}.`
                    : latestSubmittedPayment?.verificationStatus === "pending"
                    ? "payment submitted; awaiting Accounting verification."
                    : latestSubmittedPayment?.verificationStatus === "rejected"
                    ? "payment rejected; please resubmit proof in Accounting."
                    : inquiry.invoiceSentAt
                    ? "invoice sent; awaiting required payment."
                    : "awaiting invoice and required payment; production has not started."}
                </div>
              )}

              {/* Downpayment confirmed — success badge */}
              {(inquiry.downpaymentAmount ?? 0) > 0 && inquiry.downpaymentConfirmed && (
                <div className="rounded-md p-3 font-dm flex items-center gap-2" style={{ fontSize: 13, color: "#166534", backgroundColor: "#DCFCE7", border: "1px solid #86EFAC" }}>
                  ✅ Downpayment received & confirmed by Accounting — ₱{(inquiry.downpaymentAmount ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({inquiry.downpaymentPercent}%). Production is greenlit.
                </div>
              )}
            </div>
          )}

          {/* Cancel — pending approval */}
          {inquiry.pendingCancellation && (
            <div className="pt-3 border-t border-slate-200 mt-2">
              <div className="rounded-lg p-3 font-dm flex items-start gap-2" style={{ fontSize: 12, color: "#92400E", backgroundColor: "#FFFBEB", border: "1.5px solid #FDE68A" }}>
                <span style={{ fontSize: 16 }}>⏳</span>
                <div>
                  <div style={{ fontWeight: 700 }}>Cancellation pending Enter-Fil approval</div>
                  <div className="mt-0.5">Reason: {inquiry.pendingCancellation.reason}</div>
                  <div className="mt-0.5" style={{ color: "#B45309" }}>Requested {inquiry.pendingCancellation.requestedAt} · they may contact you via email if they decline.</div>
                </div>
              </div>
            </div>
          )}

          {/* Cancel order — only before PO is confirmed and not already pending */}
          {inquiry.stage !== "po" && !inquiry.pendingCancellation && (
            <div className="pt-3 border-t border-slate-200 mt-2">
              {!confirmCancel ? (
                <button
                  onClick={() => setConfirmCancel(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-md font-dm border-2 hover:bg-red-50 transition-colors"
                  style={{ fontSize: 12, fontWeight: 700, color: "#C8102E", borderColor: "#FECACA", backgroundColor: "white", letterSpacing: 0.4 }}
                >
                  ⚠️ CANCEL THIS ORDER
                </button>
              ) : (
                <div className="rounded-lg p-4 flex flex-col gap-3" style={{ backgroundColor: "#FEF2F2", border: "1.5px solid #FECACA" }}>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 16 }}>⚠️</span>
                    <span className="font-dm" style={{ fontSize: 13, fontWeight: 700, color: "#991B1B" }}>Cancel this order</span>
                  </div>
                  {/* Order details preview */}
                  <div className="rounded-md p-3 font-dm bg-white" style={{ fontSize: 12, color: "#0F172A", border: "1px solid #FECACA" }}>
                    <div><span style={{ color: "#64748B" }}>Order:</span> <span className="font-mono-jb" style={{ fontWeight: 700 }}>{inquiry.code}</span></div>
                    <div><span style={{ color: "#64748B" }}>Submitted:</span> {inquiry.submittedDate}</div>
                    <div><span style={{ color: "#64748B" }}>Items:</span> {inquiry.products.length} product(s) · {inquiry.products.reduce((s, p) => s + p.qty, 0)} pcs total</div>
                    {total > 0 && <div><span style={{ color: "#64748B" }}>Total:</span> <span style={{ fontWeight: 700 }}>₱{total.toLocaleString("en-PH")}</span></div>}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#991B1B", letterSpacing: 0.4, textTransform: "uppercase" }}>Reason for cancellation *</label>
                    <textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="e.g. Order placed by mistake · changed requirements · budget constraints"
                      rows={2}
                      className="font-dm px-3 py-2 rounded border border-red-200 outline-none focus:border-red-400 bg-white resize-none"
                      style={{ fontSize: 13, color: "#0F172A" }}
                      autoFocus
                    />
                  </div>
                  <div className="rounded-md p-2.5 font-dm" style={{ fontSize: 11, color: "#92400E", backgroundColor: "#FFFBEB", border: "1px dashed #FDE68A" }}>
                    ℹ️ This will <strong>not</strong> cancel instantly. Enter-Fil will be notified and may accept or decline. If declined, they'll contact you via email.
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setConfirmCancel(false); setCancelReason(""); }} className="font-dm px-3 py-2 rounded-md hover:bg-white" style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>Keep Order</button>
                    <button
                      onClick={() => {
                        if (!cancelReason.trim()) { toast.error("A reason is required"); return; }
                        onCancel(cancelReason.trim());
                        setConfirmCancel(false); setCancelReason("");
                      }}
                      disabled={!cancelReason.trim()}
                      className="font-dm px-3 py-2 rounded-md text-white hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5"
                      style={{ fontSize: 12, fontWeight: 700, backgroundColor: "#C8102E" }}
                    >
                      ⚠️ Send Cancellation Request
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Full Quotation Document Modal */}
      {showQuotationDoc && inquiry.quotationDoc && (
        <QuotationPreviewModal
          inquiry={inquiry}
          doc={inquiry.quotationDoc}
          vatLabel={inquiry.quotationDoc.termsOfPayment === "15-Day Terms" ? "VAT EXCLUSIVE" : "VAT EXCLUSIVE"}
          total={inquiry.quotationDoc.total ?? inquiry.quotationDoc.lineItems.reduce((s, li) => s + li.unitPrice * li.qty, 0)}
          preparedBy={inquiry.quotationDoc.preparedBy ?? "Enter-Fil"}
          onClose={() => setShowQuotationDoc(false)}
        />
      )}

      {showInvoice && inquiry.invoiceNo && inquiry.invoiceSentAt && (
        <InvoicePreviewModal inquiry={inquiry} onClose={() => setShowInvoice(false)} />
      )}

      {/* Section C — Revision Request Modal */}
      {showRevisionModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.6)" }} onClick={() => setShowRevisionModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg flex flex-col" style={{ boxShadow: "0 24px 48px rgba(0,0,0,0.3)", maxHeight: "85vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2" style={{ backgroundColor: "#FFFBEB" }}>
              <span style={{ fontSize: 18 }}>📝</span>
              <h3 className="font-syne" style={{ fontSize: 16, fontWeight: 700, color: "#92400E" }}>Request Quotation Revision</h3>
              <button onClick={() => setShowRevisionModal(false)} className="ml-auto w-8 h-8 rounded-md hover:bg-amber-100 flex items-center justify-center"><X size={16} /></button>
            </div>
            <div className="p-5 overflow-auto flex flex-col gap-4">
              <div className="rounded-lg p-3" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                <div className="font-dm mb-1" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Current Quotation</div>
                <div className="flex items-baseline gap-2">
                  <span className="font-syne" style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>{peso(total)}</span>
                  <span className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>· {inquiry.products.length} item{inquiry.products.length > 1 ? "s" : ""} · {inquiry.paymentTerms}</span>
                </div>
                <div className="font-dm mt-1" style={{ fontSize: 11, color: "#64748B" }}>Lead time: {inquiry.quotation?.leadTimeDays ?? "—"} days</div>
              </div>
              <div>
                <label className="font-dm block mb-1.5" style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>What would you like changed? *</label>
                <textarea value={revisionNoteDraft} onChange={(e) => setRevisionNoteDraft(e.target.value)} placeholder="e.g. Reduce unit price · Adjust media spec · Increase quantity · etc." rows={5} className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white resize-none" style={{ fontSize: 13 }} autoFocus />
              </div>
              {!!inquiry.quotationHistory?.length && (
                <div className="rounded-md p-3 font-dm" style={{ fontSize: 11, color: "#1E40AF", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                  ℹ️ This quotation has been revised {inquiry.quotationHistory.length} time{inquiry.quotationHistory.length > 1 ? "s" : ""} already.
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => setShowRevisionModal(false)} className="font-dm px-4 py-2 rounded-md hover:bg-slate-100" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Cancel</button>
              <button onClick={submitRevision} disabled={revisionNoteDraft.trim().length < 5} className="font-dm px-4 py-2 rounded-md text-white hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5" style={{ fontSize: 13, fontWeight: 700, backgroundColor: "#C8102E" }}>
                Send Revision Request
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function POUploadOverlay({ onClose, onSubmit }: { onClose: () => void; onSubmit: (po: { fileName: string; fileDataUrl: string; poNumber: string }) => void }) {
  const { generatePONumber } = useOrders();
  const [file, setFile] = useState<File | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  /* Section J — auto-generated PO reference shown to the client; on submit, prefer the uploaded filename, but fall back to this reference. */
  const [autoRef] = useState(() => generatePONumber());
  const readPOFile = (nextFile: File) => {
    setFile(nextFile);
    setFileDataUrl(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setFileDataUrl(reader.result);
      else toast.error("Could not read purchase order file");
    };
    reader.onerror = () => toast.error("Could not read purchase order file");
    reader.readAsDataURL(nextFile);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.5)" }} onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg" style={{ boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-syne" style={{ fontSize: 18, fontWeight: 700, color: "#0F172A" }}>Upload Purchase Order</h3>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <label onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) readPOFile(f); }} className="flex flex-col items-center justify-center gap-2 py-10 rounded-lg cursor-pointer transition-colors" style={{ border: `2px dashed ${drag ? "#C8102E" : "#CBD5E1"}`, backgroundColor: drag ? "#FEF2F2" : "#F8FAFC" }}>
            <Upload size={28} style={{ color: file ? "#16A34A" : "#94A3B8" }} />
            <span className="font-dm" style={{ fontSize: 13, color: "#0F172A", fontWeight: 600 }}>{file ? file.name : "Drop your PO here or click to browse"}</span>
            <span className="font-dm" style={{ fontSize: 11, color: "#94A3B8" }}>Accepts PDF, JPG, PNG</span>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { const selected = e.target.files?.[0]; if (selected) readPOFile(selected); e.currentTarget.value = ""; }} />
          </label>
          <div className="rounded-md p-2 font-dm flex items-center justify-between" style={{ fontSize: 11, backgroundColor: "#F1F5F9", color: "#64748B" }}>
            <span>Auto-generated reference</span>
            <span className="font-mono-jb" style={{ color: "#0F172A", fontWeight: 700 }}>{autoRef}</span>
          </div>
          {/* Section E — always submit the auto-generated reference, never the uploaded file's name */}
          <button onClick={() => file && fileDataUrl && onSubmit({ fileName: file.name, fileDataUrl, poNumber: autoRef })} disabled={!file || !fileDataUrl} className="flex items-center justify-center gap-2 py-3 rounded-md text-white font-dm hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
            SUBMIT PURCHASE ORDER ({autoRef})
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Status Tab ---------- */
const DEMO_JO_DATA: JOTemplateData = {
  jo: "JO-2026-001", client: "B.E. Aerospace", product: "Air / Oil Separator Filter",
  qty: 50, date: "Apr 26, 2026", itemCode: "OILSEP-00001", enterFilPN: "KF-OS.107.65.252",
  poRef: "PO-2026-9901",
  specs: { od1: "115", od2: "103", id1: "64.6", height: "500", endCap: "E.G. (1.0mm)", media: "Microglass Fiber / Inside", innerCore: "Expanded Metal Perfo 2mm", oem: "—", brand: "Hitachi Comp." },
  preparedBy: "Tricia (Management)",
};

interface ActiveOrder {
  po: string;
  product: string;
  qty: number;
  client: string;
  paid: boolean; /* if paid, hidden from tracker */
  badge: { label: string; bg: string; fg: string };
  steps: Step[];
}

/* DERIVED: build the live ActiveOrder timeline from a store inquiry. Each step's `state` (done/current/pending) is computed from the inquiry's stage. */
function inquiryToActiveOrder(inq: Inquiry): ActiveOrder {
  const downstreamOfJO = ["in_production", "quality_inspection", "ready_for_dispatch", "dispatched", "delivered", "paid", "overdue"];
  const payment = paymentState(inq);
  const requiredPaymentVerified = payment.state === "FULLY_PAID"
    || (payment.requiredDownpaymentAmount > 0 && payment.downpaymentStatus === "COMPLETE");
  /* Keep client milestones in business order; drafts remain invisible until sentAt exists. */
  const STAGE_ORDER: { key: string; label: string; matches: (i: Inquiry) => "done" | "current" | "pending"; detailFn: (i: Inquiry) => string }[] = [
    { key: "inquiry",    label: "Inquiry Submitted",     matches: (i) => i.stage === "inquiry" ? "current" : "done",
      detailFn: (i) => `Submitted ${i.submittedDate}${i.inquirySketch ? " · sketch attached" : ""}` },
    { key: "quotation",  label: "Quotation Received",    matches: (i) => i.stage === "quotation" ? "current" : (["po","jo","in_production","quality_inspection","ready_for_dispatch","delivered","paid","overdue"].includes(i.stage) ? "done" : "pending"),
      detailFn: (i) => i.quotation ? `${i.quotation.leadTimeDays}-day lead time · ${i.paymentTerms}` : "Awaiting our team's quote" },
    { key: "po",         label: "PO Approved & Uploaded", matches: (i) => !hasPORecord(i) ? "pending" : i.stage === "po" && !i.poReceived ? "current" : i.poReceived || downstreamOfJO.includes(i.stage) ? "done" : "pending",
      detailFn: (i) => hasPORecord(i) ? `${i.poNumber ?? i.poFileName} · ${i.poReceived ? "received by Sales" : "uploaded"}` : "Upload signed PO to proceed" },
    { key: "invoiced",   label: "Invoiced",               matches: (i) => !i.invoiceSentAt || !i.invoiceNo ? "pending" : (requiredPaymentVerified || downstreamOfJO.includes(i.stage) ? "done" : "current"),
      detailFn: (i) => i.invoiceSentAt && i.invoiceNo ? `${i.invoiceNo}${i.paymentCycleStartedAt && i.invoiceDueDate ? ` · due ${i.invoiceDueDate}` : ""}` : "Awaiting invoice from Enter-Fil" },
    { key: "paid",       label: "Payment Cleared",        matches: () => requiredPaymentVerified ? "done" : "pending",
      detailFn: () => payment.state === "FULLY_PAID" ? "Full payment verified" : requiredPaymentVerified ? `Required downpayment verified · ${peso(payment.verifiedDownpaymentAmount)}` : "Awaiting required payment verification" },
    { key: "jo",         label: "Job Order Created",      matches: (i) => {
        if (!i.invoiceSentAt || !requiredPaymentVerified) return "pending";
        return i.stage === "jo" ? "current" : downstreamOfJO.includes(i.stage) ? "done" : "pending";
      },
      detailFn: (i) => i.joNumber ? `${i.joNumber} · production queued` : "Awaiting JO" },
    { key: "in_production", label: "In Production",        matches: (i) => i.stage === "in_production" ? "current" : (["quality_inspection","ready_for_dispatch","dispatched","delivered","paid","overdue"].includes(i.stage) ? "done" : "pending"),
      detailFn: (i) => `Stage ${Math.min((i.currentStage ?? 0) + 1, 9)} of 9${i.paused ? " · ⏸ ON HOLD" : ""}` },
    { key: "quality_inspection", label: "Quality Inspection", matches: (i) => i.stage === "quality_inspection" ? "current" : (["ready_for_dispatch","dispatched","delivered","paid","overdue"].includes(i.stage) ? "done" : "pending"),
      detailFn: () => "Final QC checkpoint before dispatch" },
    { key: "ready_for_dispatch", label: "Ready for Dispatch", matches: (i) => i.stage === "ready_for_dispatch" ? "current" : (["dispatched","delivered","paid","overdue"].includes(i.stage) ? "done" : "pending"),
      detailFn: () => "Waybill prepared · awaiting logistics" },
    { key: "delivered",  label: "Delivered",              matches: (i) => i.stage === "delivered" ? "current" : (["paid","overdue"].includes(i.stage) ? "done" : "pending"),
      detailFn: (i) => i.deliveredDate ? `Delivered ${i.deliveredDate}` : "Signed DR confirms delivery" },
  ];

  return {
    po: inq.poFileName?.replace(/\.\w+$/, "") ?? `INQ-${inq.code.replace("INQ-", "")}`,
    product: inq.products.length > 1
      ? `${inq.products.length} filters · ${inq.products.map((p) => p.type).join(", ")}`
      : `${inq.products[0]?.type ?? "Filter"}${inq.products[0]?.height ? ` ${inq.products[0].od1 ?? ""}×${inq.products[0].id1 ?? ""}×${inq.products[0].height}mm` : ""}`,
    qty: inq.products.length > 1
      ? inq.products.reduce((s, p) => s + p.qty, 0)
      : (inq.products[0]?.qty ?? 0),
    client: inq.clientName,
    paid: inq.stage === "paid",
    badge: stageBadgeForClient(inq),
    steps: STAGE_ORDER.map((s) => ({
      label: s.label,
      date: s.matches(inq) === "done" ? "✓" : s.matches(inq) === "current" ? (inq.paused ? "On hold" : "now") : "—",
      state: s.matches(inq),
      detail: s.detailFn(inq),
    })),
  };
}

function stageBadgeForClient(inq: Inquiry): { label: string; bg: string; fg: string } {
  switch (inq.stage) {
    case "inquiry":            return { label: "Awaiting Quotation",  bg: "#E2E8F0", fg: "#475569" };
    case "quotation":          return { label: "Quotation Received",  bg: "#FEF3C7", fg: "#B45309" };
    case "po":                 return { label: "PO Submitted ✓",       bg: "#DCFCE7", fg: "#15803D" };
    case "jo":                 return { label: "JO Created",          bg: "#FEE2E2", fg: "#991B1B" };
    case "in_production":      return inq.paused
      ? { label: "On Hold",                                            bg: "#FEF3C7", fg: "#92400E" }
      : { label: "In Production",                                      bg: "#DBEAFE", fg: "#1D4ED8" };
    case "quality_inspection": return { label: "Quality Inspection",   bg: "#EDE9FE", fg: "#6D28D9" };
    case "ready_for_dispatch": return { label: "Ready for Dispatch",   bg: "#FFEDD5", fg: "#C2410C" };
    case "dispatched":         return { label: "Out for Delivery",     bg: "#EDE9FE", fg: "#6D28D9" };
    case "delivered":          return { label: "Delivered",            bg: "#DCFCE7", fg: "#15803D" };
    case "paid":               return { label: "Paid & Closed",        bg: "#DCFCE7", fg: "#15803D" };
    case "overdue":             return { label: "⚠️ Overdue",          bg: "#FEE2E2", fg: "#C8102E" };
    default:                   return { label: inq.stage,              bg: "#E2E8F0", fg: "#475569" };
  }
}

function StatusTab({ clientName }: { clientName: string }) {
  const { byClient } = useOrders();
  const [showJO, setShowJO] = useState(false);
  const [searchOrders, setSearchOrders] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  /* DERIVED: pull this client's inquiries, exclude paid + cancelled, map to ActiveOrder timelines */
  const myInquiries = byClient(clientName).filter((i) => !i.archived && i.stage !== "paid");
  const activeOrders = myInquiries.map((inquiry) => ({ inquiry, order: inquiryToActiveOrder(inquiry) }));
  const [expandedPO, setExpandedPO] = useState<string | null>(activeOrders[0]?.order.po ?? null);
  const statusBadgeLabels: Record<string, string> = {
    po: "PO Submitted ✓",
    production: "In Production",
    dispatch: "Ready for Dispatch",
    delivery: "Out for Delivery",
    delivered: "Delivered",
  };
  const filteredOrders = activeOrders
    .filter(({ inquiry, order }) => {
      const query = searchOrders.trim().toLowerCase();
      const matchesSearch = !query || [
        inquiry.code,
        inquiry.poFileName,
        inquiry.poNumber,
        inquiry.clientName,
        inquiry.contactPerson,
        order.po,
        order.product,
      ].some((value) => value?.toLowerCase().includes(query));
      const matchesStatus = statusFilter === "all"
        || order.badge.label === statusBadgeLabels[statusFilter];
      return matchesSearch && matchesStatus;
    });

  return (
    <div className="px-8 py-8 flex flex-col gap-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>Order Status Tracker</h1>
          <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>Real-time updates · click any order to expand its full timeline</p>
        </div>
        <span className="font-dm px-3 py-1.5 rounded-full" style={{ fontSize: 11, fontWeight: 700, backgroundColor: "#DBEAFE", color: "#1D4ED8", letterSpacing: 0.4 }}>
          {activeOrders.length} active order{activeOrders.length === 1 ? "" : "s"} · paid orders hidden
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/70 bg-white p-3">
        <input
          type="search"
          value={searchOrders}
          onChange={(event) => setSearchOrders(event.target.value)}
          placeholder="Search orders, PO, inquiry, or product..."
          aria-label="Search orders"
          className="font-dm min-w-[220px] flex-1 rounded-md border border-slate-200 px-3 py-2 outline-none focus:border-slate-400"
          style={{ fontSize: 12, color: "#0F172A" }}
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter orders by status"
          className="font-dm rounded-md border border-slate-200 bg-white px-3 py-2 outline-none focus:border-slate-400"
          style={{ fontSize: 12, color: "#475569" }}
        >
          <option value="all">All Orders</option>
          <option value="po">PO Submitted</option>
          <option value="production">In Production</option>
          <option value="dispatch">Ready for Dispatch</option>
          <option value="delivery">Out for Delivery</option>
          <option value="delivered">Delivered</option>
        </select>
      </div>

      {activeOrders.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center font-dm" style={{ fontSize: 13, color: "#94A3B8" }}>
          ✅ All your orders are fully paid and archived. Submit a new inquiry to track progress here.
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center font-dm" style={{ fontSize: 13, color: "#94A3B8" }}>
          No orders match your search or status filter.
        </div>
      ) : filteredOrders.map(({ order, inquiry }) => {
        const expanded = expandedPO === order.po;
        /* Section F — JO exists only once the inquiry reaches the "jo" stage or later. */
        const hasJO = (["jo", "in_production", "quality_inspection", "ready_for_dispatch", "dispatched", "delivered", "paid", "overdue"] as const).includes(inquiry.stage as any);
        return (
          <CollapsibleStatusCard
            key={inquiry.id}
            order={order}
            expanded={expanded}
            onToggle={() => setExpandedPO(expanded ? null : order.po)}
            onViewJO={() => setShowJO(true)}
            hasJO={hasJO}
          />
        );
      })}

      {/* Section O — pass live inquiry data so the JO doc shows the user-entered filterName, not the type code */}
      {showJO && (() => {
        const jo = myInquiries.find((i) => i.joNumber);
        if (!jo) return <JOTemplateModal data={DEMO_JO_DATA} onClose={() => setShowJO(false)} />;
        const p0 = jo.products[0];
        const liveData: JOTemplateData = {
          jo: jo.joNumber!,
          client: jo.clientName,
          product: p0?.filterName || labelForType(p0?.type ?? ""),
          qty: jo.products.reduce((s, p) => s + p.qty, 0),
          date: jo.submittedDate,
          itemCode: `${p0?.type ?? "FILTER"}-${jo.code.replace(/[^0-9]/g, "")}`,
          enterFilPN: p0?.oem ?? "—",
          poRef: jo.poFileName?.replace(/\.[^.]+$/, "") ?? "—",
          specs: jo.joSpecs ?? { od1: p0?.od1, id1: p0?.id1, height: p0?.height, media: p0?.media, oem: p0?.oem },
          preparedBy: "Enter-Fil Management",
        };
        return <JOTemplateModal data={liveData} onClose={() => setShowJO(false)} />;
      })()}

    </div>
  );
}

function CollapsibleStatusCard({ order, expanded, onToggle, onViewJO, hasJO }: {
  order: ActiveOrder;
  expanded: boolean;
  onToggle: () => void;
  onViewJO: () => void;
  hasJO?: boolean;
}) {
  const stepCount = order.steps.length;
  const doneCount = order.steps.filter(s => s.state === "done").length;
  const pct = Math.round((doneCount / stepCount) * 100);
  return (
    <article className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      {/* Compact header (always visible) */}
      <button onClick={onToggle} className="w-full px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50 transition-colors text-left">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <span className="font-mono-jb shrink-0" style={{ fontSize: 14, fontWeight: 700, color: "#1A2B4A" }}>{order.po}</span>
          <div className="hidden md:block w-px h-6 bg-slate-200" />
          <div className="min-w-0 flex-1">
            <div className="font-syne truncate" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{order.product}</div>
            <div className="font-dm mt-1" style={{ fontSize: 12, color: "#64748B" }}>Qty {order.qty}</div>
          </div>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-3 shrink-0">
          <div className="flex flex-col items-start sm:items-end gap-1">
            <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: 0.4, textTransform: "uppercase" }}>{doneCount} of {stepCount} stages</div>
            <div className="w-32 h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: "#16A34A" }} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-dm px-2.5 py-1 rounded-full whitespace-nowrap" style={{ fontSize: 11, fontWeight: 600, backgroundColor: order.badge.bg, color: order.badge.fg }}>{order.badge.label}</span>
          <span className="text-slate-400" style={{ fontSize: 18 }}>{expanded ? "▴" : "▾"}</span>
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-200">
          {/* Action bar */}
          <div className="px-6 py-3 flex items-center justify-end gap-2 border-b border-slate-100" style={{ backgroundColor: "#F8FAFC" }}>
            <button
              onClick={onViewJO}
              disabled={!hasJO}
              title={hasJO ? undefined : "Job order not created yet"}
              className="flex items-center gap-2 px-3 py-2 rounded-md font-dm border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ fontSize: 12, fontWeight: 700, color: "#1A2B4A" }}
            >
              📄 View Job Order
            </button>
          </div>

          {/* Vertical timeline with real-time stage details */}
          <ol className="px-6 py-5 flex flex-col gap-1 relative">
            {order.steps.map((s, i) => (
              <li key={s.label} className="flex items-start gap-4 relative pb-3">
                {i < order.steps.length - 1 && (
                  <span className="absolute left-[11px] top-6 bottom-0 w-px" style={{ backgroundColor: s.state === "done" ? "#16A34A" : "#E2E8F0" }} />
                )}
                <div className="relative z-10 mt-0.5">
                  {s.state === "done" ? (
                    <span className="w-[22px] h-[22px] rounded-full flex items-center justify-center" style={{ backgroundColor: "#16A34A" }}>
                      <span style={{ color: "white", fontSize: 13, fontWeight: 800 }}>✓</span>
                    </span>
                  ) : s.state === "current" ? (
                    <span className="w-[22px] h-[22px] rounded-full flex items-center justify-center" style={{ backgroundColor: "#C8102E", boxShadow: "0 0 0 4px rgba(200,16,46,0.15)" }}>
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    </span>
                  ) : (
                    <span className="w-[22px] h-[22px] rounded-full border-2" style={{ borderColor: "#CBD5E1", display: "block" }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-dm" style={{ fontSize: 13, fontWeight: s.state === "current" ? 700 : 600, color: s.state === "pending" ? "#94A3B8" : s.state === "current" ? "#C8102E" : "#0F172A" }}>{s.label}</span>
                    {s.state === "current" && <span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 9, fontWeight: 700, backgroundColor: "#FEE2E2", color: "#C8102E", letterSpacing: 0.4, textTransform: "uppercase" }}>NOW</span>}
                  </div>
                  <div className="font-dm mt-0.5" style={{ fontSize: 12, color: s.state === "pending" ? "#CBD5E1" : "#475569" }}>{s.date}</div>
                  {s.detail && s.state !== "pending" && (
                    <div className="font-dm mt-1 rounded-md px-3 py-2" style={{ fontSize: 11, color: s.state === "current" ? "#7F1D1D" : "#475569", backgroundColor: s.state === "current" ? "#FEF2F2" : "#F8FAFC", border: s.state === "current" ? "1px solid #FECACA" : "1px solid #E2E8F0" }}>
                      {s.detail}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </article>
  );
}

/* ───────── Pipeline progress bar ───────── */
function PipelineProgress({ currentStage, po, product, qty }: {
  currentStage: "inquiry" | "quotation" | "po" | "jo" | "in_production" | "quality_inspection" | "ready_for_dispatch" | "delivered" | "paid";
  po: string; product: string; qty: number;
}) {
  const stages = [
    { id: "inquiry",            label: "Inquiry",      icon: "📝" },
    { id: "quotation",          label: "Quotation",    icon: "💰" },
    { id: "po",                 label: "PO",           icon: "📄" },
    { id: "jo",                 label: "JO Created",   icon: "🏭" },
    { id: "in_production",      label: "Producing",    icon: "⚙️" },
    { id: "quality_inspection", label: "QC",           icon: "🔍" },
    { id: "ready_for_dispatch", label: "Dispatch",     icon: "📦" },
    { id: "delivered",          label: "Delivered",    icon: "🚚" },
    { id: "paid",               label: "Paid",         icon: "✅" },
  ];
  const currentIdx = stages.findIndex(s => s.id === currentStage);
  return (
    <div className="bg-white rounded-xl border border-slate-200/70 p-5" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="font-mono-jb" style={{ fontSize: 13, fontWeight: 700, color: "#1A2B4A" }}>{po}</div>
          <div className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>{product} · {qty} pcs</div>
        </div>
        <span className="font-dm px-3 py-1 rounded-full" style={{ fontSize: 11, fontWeight: 700, backgroundColor: "#DBEAFE", color: "#1D4ED8", letterSpacing: 0.4, textTransform: "uppercase" }}>
          {stages[currentIdx]?.label}
        </span>
      </div>
      {/* Horizontal progress */}
      <div className="flex items-center gap-1">
        {stages.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <Fragment key={s.id}>
              <div className="flex flex-col items-center gap-1.5" style={{ minWidth: 60 }}>
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: done ? "#16A34A" : active ? "#C8102E" : "#E2E8F0",
                    color: "white",
                    fontSize: 14,
                    boxShadow: active ? "0 0 0 4px rgba(200,16,46,0.15)" : "none",
                  }}
                >
                  {done ? "✓" : s.icon}
                </div>
                <span className="font-dm text-center" style={{ fontSize: 9, fontWeight: 700, color: done ? "#15803D" : active ? "#C8102E" : "#94A3B8", letterSpacing: 0.3, textTransform: "uppercase" }}>{s.label}</span>
              </div>
              {i < stages.length - 1 && (
                <div className="flex-1 h-0.5 rounded-full" style={{ backgroundColor: i < currentIdx ? "#16A34A" : "#E2E8F0", marginTop: -16 }} />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

interface Step { label: string; date: string; state: "done" | "current" | "pending"; detail?: string }
function TimelineCard({ po, product, qty, client, badge, steps, action }: {
  po: string; product: string; qty: number; client: string;
  badge: { label: string; bg: string; fg: string };
  steps: Step[]; action?: React.ReactNode;
}) {
  return (
    <article className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <div className="px-6 py-4 border-b border-slate-200/70 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono-jb" style={{ fontSize: 14, fontWeight: 600, color: "#1A2B4A" }}>{po}</span>
          <span className="font-syne" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>· {product}</span>
          <span className="font-dm" style={{ fontSize: 13, color: "#64748B" }}>· Qty: {qty} · {client}</span>
        </div>
        <span className="font-dm px-2.5 py-1 rounded-full" style={{ fontSize: 11, fontWeight: 600, backgroundColor: badge.bg, color: badge.fg }}>{badge.label}</span>
      </div>

      <div className="px-6 py-5">
        <ol className="flex flex-col gap-1 relative">
          {steps.map((s, i) => (
            <li key={s.label} className="flex items-start gap-4 relative pb-3">
              {i < steps.length - 1 && (
                <span className="absolute left-[11px] top-6 bottom-0 w-px" style={{ backgroundColor: s.state === "done" ? "#16A34A" : "#E2E8F0" }} />
              )}
              <div className="relative z-10 mt-0.5">
                {s.state === "done" ? (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: "#16A34A" }}>
                    <CheckCircle2 size={14} className="text-white" strokeWidth={3} />
                  </div>
                ) : s.state === "current" ? (
                  <div className="relative w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: "#2563EB" }}>
                    <span className="absolute inset-0 rounded-full animate-ping" style={{ backgroundColor: "#2563EB", opacity: 0.4 }} />
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                ) : (
                  <Circle size={24} style={{ color: "#CBD5E1" }} />
                )}
              </div>
              <div className="flex-1 flex items-center justify-between">
                <span className="font-dm" style={{ fontSize: 14, fontWeight: s.state === "current" ? 700 : 500, color: s.state === "done" ? "#475569" : s.state === "current" ? "#0F172A" : "#94A3B8" }}>
                  {s.label}
                  {s.state === "current" && (
                    <span className="font-dm ml-2 px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: "#DBEAFE", color: "#1D4ED8", letterSpacing: 0.4 }}>CURRENT</span>
                  )}
                </span>
                <span className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>{s.date}</span>
              </div>
            </li>
          ))}
        </ol>
        {action && <div className="mt-4 pt-4 border-t border-slate-200 flex justify-end">{action}</div>}
      </div>
    </article>
  );
}

/* ---------- Logistics Tab ---------- */
type DeliveryMethod = NonNullable<Inquiry["deliveryMethod"]>;
type ClientDeliveryStatus =
  | "Job Order Created"
  | "In Production"
  | "Quality Inspection"
  | "Ready for Dispatch"
  | "In Transit"
  | "Delivered"
  | "Fulfillment Completed"
  | "Not Yet in Logistics";

interface LogisticsRow {
  id: string;
  clientName: string;
  po: string; joNumber?: string; item: string; qty: number; method?: DeliveryMethod;
  status: ClientDeliveryStatus;
  statusBg: string; statusFg: string;
  trackingNumber?: string; trackingLink?: string;
  paymentTerms: Inquiry["paymentTerms"];
  paymentCycleStartedAt?: string; paymentDueDate?: string;
  paymentState: PaymentStateSummary;
  paymentIsFullyPaid: boolean;
  hasPendingPayment: boolean;
  deliveryReceiptNumber?: string; deliveryReceiptSentAt?: string;
  signedDRFileName?: string; signedDRSubmittedBy?: string; signedDRReceivedAt?: string;
  signedDRNumber?: string; signedDRDataUrl?: string;
  pendingSignedDRFileName?: string; pendingSignedDRSubmittedBy?: string; pendingSignedDRDataUrl?: string;
  dateISO?: string;
}

function inquiryToLogisticsRow(inq: Inquiry): LogisticsRow {
  const signedDRReceived = hasValidSignedDeliveryReceipt(inq);
  const orderPaymentState = paymentState(inq);
  const stageStatus: ClientDeliveryStatus = ({
    jo: "Job Order Created",
    in_production: "In Production",
    quality_inspection: "Quality Inspection",
    ready_for_dispatch: "Ready for Dispatch",
    dispatched: "In Transit",
    delivered: "Delivered",
    paid: "Delivered",
    overdue: "Delivered",
  } as Partial<Record<Inquiry["stage"], ClientDeliveryStatus>>)[inq.stage] ?? "Not Yet in Logistics";
  const status: ClientDeliveryStatus = signedDRReceived ? "Fulfillment Completed" : stageStatus;
  const statusColors: Record<ClientDeliveryStatus, { bg: string; fg: string }> = {
    "Job Order Created": { bg: "#E2E8F0", fg: "#475569" },
    "In Production": { bg: "#DBEAFE", fg: "#1D4ED8" },
    "Quality Inspection": { bg: "#EDE9FE", fg: "#6D28D9" },
    "Ready for Dispatch": { bg: "#FFE4E6", fg: "#9F1239" },
    "In Transit": { bg: "#DBEAFE", fg: "#1D4ED8" },
    Delivered: { bg: "#DCFCE7", fg: "#15803D" },
    "Fulfillment Completed": { bg: "#DCFCE7", fg: "#166534" },
    "Not Yet in Logistics": { bg: "#E2E8F0", fg: "#475569" },
  };
  const { bg: statusBg, fg: statusFg } = statusColors[status];
  const firstProduct = inq.products[0];
  const item = firstProduct?.filterName || firstProduct?.type || "—";
  const qty = inq.products.reduce((sum, product) => sum + product.qty, 0);
  const signedDRMatchesOrder = signedDRReceived;
  const dateISO = inq.deliveredDate ?? inq.dueDate ?? inq.submittedDate;
  return {
    id: inq.id,
    clientName: inq.clientName,
    po: inq.code,
    joNumber: inq.joNumber,
    item,
    qty,
    method: inq.deliveryMethod,
    status,
    statusBg,
    statusFg,
    paymentTerms: inq.paymentTerms,
    paymentCycleStartedAt: signedDRReceived
      && inq.paymentCycleStartedAt === inq.signedDeliveryReceiptReceivedAt
      ? inq.paymentCycleStartedAt
      : undefined,
    paymentDueDate: signedDRReceived
      && inq.paymentCycleStartedAt === inq.signedDeliveryReceiptReceivedAt
      ? inq.invoiceDueDate
      : undefined,
    paymentState: orderPaymentState,
    paymentIsFullyPaid: inq.stage === "paid"
      || (orderPaymentState.invoiceTotal > 0 && orderPaymentState.state === "FULLY_PAID"),
    hasPendingPayment: paymentRecords(inq).some((payment) => payment.verificationStatus === "pending"),
    deliveryReceiptNumber: inq.deliveryReceiptNumber,
    deliveryReceiptSentAt: inq.deliveryReceiptSentAt,
    trackingNumber: inq.trackingRef,
    trackingLink: inq.deliveryTrackingLink,
    signedDRFileName: signedDRMatchesOrder ? inq.signedDeliveryReceiptFileName : undefined,
    signedDRSubmittedBy: signedDRMatchesOrder ? inq.signedDeliveryReceiptSubmittedBy : undefined,
    signedDRReceivedAt: signedDRMatchesOrder ? inq.signedDeliveryReceiptReceivedAt : undefined,
    signedDRNumber: signedDRMatchesOrder ? inq.signedDeliveryReceiptNumber : undefined,
    signedDRDataUrl: signedDRMatchesOrder ? inq.signedDeliveryReceiptDataUrl : undefined,
    pendingSignedDRFileName: inq.pendingSignedDeliveryReceiptFileName,
    pendingSignedDRSubmittedBy: inq.pendingSignedDeliveryReceiptSubmittedBy,
    pendingSignedDRDataUrl: inq.pendingSignedDeliveryReceiptDataUrl,
    dateISO,
  };
}

function trackingHref(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function ClientDeliveryReceiptModal({ row, onClose }: { row: LogisticsRow; onClose: () => void }) {
  if (!row.deliveryReceiptNumber || !row.deliveryReceiptSentAt) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="Delivery Receipt">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #client-delivery-receipt-print, #client-delivery-receipt-print * { visibility: visible !important; }
          #client-delivery-receipt-print { position: fixed; inset: 0; width: 100%; padding: 32px; background: white; }
          .client-delivery-receipt-actions { display: none !important; }
        }
      `}</style>
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
        <div id="client-delivery-receipt-print" className="rounded-lg border-2 border-slate-200 p-8">
          <div className="mb-6 flex items-start justify-between border-b border-slate-200 pb-4">
            <div>
              <div className="font-syne text-xl font-extrabold text-slate-900">ENTER-FIL</div>
              <div className="font-dm text-xs text-slate-500">Industrial Products · Delivery Receipt</div>
            </div>
            <div className="text-right">
              <div className="font-dm text-[11px] font-bold uppercase tracking-wider text-slate-500">Delivery Receipt</div>
              <div className="font-mono-jb text-lg font-bold text-slate-900">{row.deliveryReceiptNumber}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 font-dm text-sm">
            <InfoPair label="Job Order" value={row.joNumber ?? "—"} />
            <InfoPair label="Order Reference" value={row.po} />
            <InfoPair label="Client" value={row.clientName} />
            <InfoPair label="Delivery Method" value={row.method ?? "Not specified"} />
            <InfoPair label="Tracking Number" value={row.trackingNumber ?? "—"} />
            <InfoPair label="Item" value={row.item} />
            <InfoPair label="Quantity" value={`${row.qty}`} />
            <InfoPair label="Delivery Status" value={row.status} />
            <InfoPair label="Receipt Shared" value={new Date(row.deliveryReceiptSentAt).toLocaleString()} />
          </div>
          {row.trackingLink && <div className="mt-4 break-all font-dm text-xs text-slate-600">Tracking Link: {row.trackingLink}</div>}
        </div>
        <div className="client-delivery-receipt-actions mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 font-dm text-sm font-semibold text-slate-700 hover:bg-slate-50">Close</button>
          <button onClick={() => window.print()} className="flex items-center gap-2 rounded-md bg-[#1A2B4A] px-4 py-2 font-dm text-sm font-bold text-white hover:opacity-90">
            <Printer size={15} /> DOWNLOAD / PRINT
          </button>
        </div>
      </div>
    </div>
  );
}

function LogisticsTab({ clientName }: { clientName: string }) {
  const { byClient, savePendingSignedDeliveryReceipt, submitPendingSignedDeliveryReceipt } = useOrders();
  const [filter, setFilter] = useState<ClientDeliveryStatus | "All">("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewReceiptId, setViewReceiptId] = useState<string | null>(null);
  const [uploadingSignedDRId, setUploadingSignedDRId] = useState<string | null>(null);
  const [submitSignedDRId, setSubmitSignedDRId] = useState<string | null>(null);
  const signedDRSubmitInProgress = useRef(false);
  const [now, setNow] = useState(() => new Date());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "status">("date-desc");
  const filters: (ClientDeliveryStatus | "All")[] = [
    "All", "Job Order Created", "In Production", "Quality Inspection",
    "Ready for Dispatch", "In Transit", "Delivered", "Fulfillment Completed",
  ];

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  /* Each JO/delivery remains its own order record and receipt. */
  const myInquiries = byClient(clientName).filter((i) =>
    !i.archived && ["jo", "in_production", "quality_inspection", "ready_for_dispatch", "dispatched", "delivered", "paid", "overdue"].includes(i.stage)
  );
  const rows: LogisticsRow[] = myInquiries.map(inquiryToLogisticsRow);
  const receiptRow = rows.find((row) => row.id === viewReceiptId);
  const submitInquiry = myInquiries.find((inquiry) => inquiry.id === submitSignedDRId);
  const stageSignedDR = async (id: string, file: File, drNumber: string) => {
    if (signedDRSubmitInProgress.current) return;
    signedDRSubmitInProgress.current = true;
    setUploadingSignedDRId(id);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await savePendingSignedDeliveryReceipt(id, file.name, dataUrl, "Client");
      toast.success("Signed Delivery Receipt uploaded", { description: `${drNumber} · pending submission` });
    } catch (error) {
      toast.error("Could not upload the pending Signed Delivery Receipt", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      signedDRSubmitInProgress.current = false;
      setUploadingSignedDRId(null);
    }
  };
  const confirmSignedDRSubmission = async () => {
    if (!submitInquiry || signedDRSubmitInProgress.current) return;
    signedDRSubmitInProgress.current = true;
    setUploadingSignedDRId(submitInquiry.id);
    try {
      await submitPendingSignedDeliveryReceipt(submitInquiry.id);
      toast.success("Signed Delivery Receipt submitted", { description: "The official receipt has been saved and delivery completed." });
      setSubmitSignedDRId(null);
    } catch (error) {
      toast.error("Could not submit the Signed Delivery Receipt", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      signedDRSubmitInProgress.current = false;
      setUploadingSignedDRId(null);
    }
  };

  const methodIcon = (method?: DeliveryMethod) => method === "Company Vehicle" ? Building2 : method === "Client Pick-up" ? UserIcon : Truck;
  const methodColor = (method?: DeliveryMethod) => method === "Company Vehicle" ? "#1A2B4A" : method === "Lalamove" ? "#7C3AED" : method === "Client Pick-up" ? "#0D9488" : "#2563EB";

  let visible = filter === "All" ? rows : rows.filter((row) => row.status === filter);
  visible = visible.filter((r) => {
    if (dateFrom && (r.dateISO ?? "") < dateFrom) return false;
    if (dateTo && (r.dateISO ?? "") > dateTo) return false;
    return true;
  });
  visible = [...visible].sort((left, right) => {
    if (sortBy === "date-desc") return (right.dateISO ?? "").localeCompare(left.dateISO ?? "");
    if (sortBy === "date-asc") return (left.dateISO ?? "").localeCompare(right.dateISO ?? "");
    return left.status.localeCompare(right.status);
  });

  return (
    <div className="px-8 py-8 flex flex-col gap-6">
      <div>
        <h1 className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>DELIVERY &amp; TRACKING</h1>
        <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>Delivery method, live tracking, order status, and receipts for each of your orders.</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {filters.map((f) => {
            const active = filter === f;
            return (
              <button key={f} onClick={() => setFilter(f)} className="font-dm px-4 py-2 rounded-full transition-colors" style={{ fontSize: 12, fontWeight: 700, backgroundColor: active ? "#C8102E" : "#FFFFFF", color: active ? "#FFFFFF" : "#0F172A", border: active ? "1px solid #C8102E" : "1px solid #CBD5E1" }}>
                {f}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <span className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>From</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="font-dm px-2 py-1.5 rounded-md border border-slate-200 bg-white outline-none" style={{ fontSize: 12 }} />
          <span className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>To</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="font-dm px-2 py-1.5 rounded-md border border-slate-200 bg-white outline-none" style={{ fontSize: 12 }} />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="font-dm px-3 py-1.5 rounded-md border border-slate-200 bg-white outline-none" style={{ fontSize: 12, color: "#0F172A" }}>
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="status">By status</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {visible.map((r) => {
          const isExpanded = expandedId === r.id;
          const Icon = methodIcon(r.method);
          const receiptIsAvailable = Boolean(r.deliveryReceiptNumber && r.deliveryReceiptSentAt);
          const hasSignedDR = Boolean(r.signedDRFileName && r.signedDRNumber === r.deliveryReceiptNumber);
          const trackUrl = trackingHref(r.trackingLink);
          return (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
              {/* Row Header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : r.id)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 text-left"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#F1F5F9" }}>
                  <Icon size={18} style={{ color: methodColor(r.method) }} />
                </div>
                <div className="flex-1 grid grid-cols-4 gap-3 items-center">
                  <div>
                    <div className="font-mono-jb" style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}>{r.joNumber ?? r.po}</div>
                    <div className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>{r.item} · Qty {r.qty}</div>
                  </div>
                  <div className="font-dm" style={{ fontSize: 13, color: methodColor(r.method), fontWeight: 600 }}>{r.method ?? "Delivery method not specified"}</div>
                  <span className="font-dm px-3 py-1.5 rounded-full justify-self-start" style={{ fontSize: 12, fontWeight: 800, backgroundColor: r.statusBg, color: r.statusFg }}>{r.status}</span>
                  <div className="flex justify-end">
                    {isExpanded ? <ChevronUp size={16} style={{ color: "#64748B" }} /> : <ChevronDown size={16} style={{ color: "#64748B" }} />}
                  </div>
                </div>
              </button>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="px-5 py-5 border-t border-slate-200" style={{ backgroundColor: "#FAFBFC" }}>
                  <section className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="font-syne text-base font-extrabold text-slate-900">DELIVERY &amp; TRACKING</div>
                      <span className="rounded-full px-4 py-2 font-dm text-sm font-extrabold" style={{ backgroundColor: r.statusBg, color: r.statusFg }}>{r.status}</span>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <InfoPair label="Delivery Method" value={r.method ?? "Not specified"} />
                      <InfoPair label="Delivery Status" value={r.status} />
                      <InfoPair label="Job Order" value={r.joNumber ?? "—"} />
                      <InfoPair label="Order Reference" value={r.po} />
                      <InfoPair label="Tracking Number" value={r.trackingNumber ?? "Not provided"} />
                      <div>
                        <div className="font-dm text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tracking Link</div>
                        {trackUrl ? (
                          <a href={trackUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 break-all font-dm text-sm font-semibold text-blue-700 underline">
                            {r.trackingLink} <ExternalLink size={13} />
                          </a>
                        ) : <div className="mt-1 font-dm text-sm text-slate-700">{r.trackingLink || "Not provided"}</div>}
                      </div>
                    </div>
                    <div className="mt-4">
                      {trackUrl ? (
                        <a href={trackUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#1A2B4A] px-4 py-3 font-dm text-sm font-bold text-white hover:opacity-90">
                          <ExternalLink size={15} /> TRACK DELIVERY
                        </a>
                      ) : (
                        <button type="button" disabled className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-slate-200 px-4 py-3 font-dm text-sm font-bold text-slate-500" title="A tracking link has not been provided">
                          <ExternalLink size={15} /> TRACK DELIVERY · LINK NOT AVAILABLE
                        </button>
                      )}
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="font-syne text-base font-extrabold text-slate-900">DELIVERY RECEIPT</div>
                    {receiptIsAvailable ? (
                      <>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <span className="font-mono-jb text-lg font-bold text-slate-900">{r.deliveryReceiptNumber}</span>
                          <span className="rounded-full bg-green-100 px-3 py-1 font-dm text-xs font-extrabold text-green-800">AVAILABLE</span>
                        </div>
                        <button type="button" onClick={() => setViewReceiptId(r.id)} className="mt-4 rounded-md border border-slate-300 px-4 py-2.5 font-dm text-sm font-bold text-[#1A2B4A] hover:bg-slate-50">
                          VIEW DELIVERY RECEIPT
                        </button>
                      </>
                    ) : (
                      <p className="mt-2 font-dm text-sm text-slate-600">
                        The Delivery Receipt will appear here after Logistics shares it for this order.
                      </p>
                    )}
                  </section>

                  <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
                    <div className="font-syne text-base font-extrabold text-slate-900">SIGNED DELIVERY RECEIPT</div>
                    {hasSignedDR ? (
                      <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-4">
                        <div className="font-dm font-extrabold text-green-800">✓ RECEIVED</div>
                        <div className="mt-2 font-dm text-sm text-slate-700">Submitted by: {r.signedDRSubmittedBy ?? "—"}</div>
                        <div className="font-dm text-sm text-slate-700">Received: {r.signedDRReceivedAt ? new Date(r.signedDRReceivedAt).toLocaleString() : "—"}</div>
                        <div className="mt-1 font-dm text-xs text-slate-600">{r.signedDRFileName}</div>
                        {r.signedDRDataUrl && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <a href={r.signedDRDataUrl} target="_blank" rel="noreferrer" className="rounded-md border border-green-300 bg-white px-3 py-2 font-dm text-xs font-bold text-green-800 hover:bg-green-50">VIEW SIGNED DR</a>
                            <a href={r.signedDRDataUrl} download={r.signedDRFileName} className="rounded-md border border-green-300 bg-white px-3 py-2 font-dm text-xs font-bold text-green-800 hover:bg-green-50">DOWNLOAD SIGNED DR</a>
                          </div>
                        )}
                      </div>
                    ) : receiptIsAvailable ? (
                      <>
                        {r.pendingSignedDRFileName && (
                          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                            <div className="font-dm text-sm font-extrabold text-amber-900">SIGNED DR UPLOADED — PENDING SUBMISSION</div>
                            <div className="mt-2 font-dm break-all text-xs text-slate-700">{r.pendingSignedDRFileName}</div>
                            {r.pendingSignedDRDataUrl && (
                              <a
                                href={r.pendingSignedDRDataUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 inline-flex items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-2 font-dm text-xs font-bold text-amber-900 hover:bg-amber-100"
                              >
                                VIEW PENDING SIGNED DR
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => setSubmitSignedDRId(r.id)}
                              disabled={uploadingSignedDRId === r.id || !r.pendingSignedDRDataUrl}
                              className="mt-3 block rounded-md bg-[#1A2B4A] px-4 py-2.5 font-dm text-xs font-extrabold text-white hover:bg-[#263d62] disabled:cursor-wait disabled:opacity-60"
                            >
                              SUBMIT SIGNED DR
                            </button>
                          </div>
                        )}
                        <label className={`mt-3 inline-flex items-center gap-2 rounded-md px-4 py-3 font-dm text-sm font-bold text-white ${uploadingSignedDRId === r.id ? "cursor-wait bg-slate-500" : "cursor-pointer bg-[#1A2B4A] hover:opacity-90"}`}>
                          <Upload size={15} /> {uploadingSignedDRId === r.id ? "UPLOADING SIGNED DELIVERY RECEIPT..." : r.pendingSignedDRFileName ? "UPLOAD A DIFFERENT SIGNED DR" : "UPLOAD SIGNED DELIVERY RECEIPT"}
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            disabled={uploadingSignedDRId === r.id}
                            onChange={(event) => {
                              const file = event.currentTarget.files?.[0];
                              event.currentTarget.value = "";
                              if (!file || uploadingSignedDRId === r.id) return;
                              void stageSignedDR(r.id, file, r.deliveryReceiptNumber ?? "—");
                            }}
                          />
                        </label>
                      </>
                    ) : (
                      <p className="mt-2 font-dm text-sm text-slate-600">
                        Signed DR upload is available after Logistics sends this order's Delivery Receipt.
                      </p>
                    )}
                  </section>

                  <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
                    <div className="font-syne text-base font-extrabold text-slate-900">PAYMENT CYCLE</div>
                    {!hasSignedDR ? (
                      <div className="mt-3 rounded-lg bg-slate-100 p-4 font-dm text-sm font-bold text-slate-600">
                        PAYMENT CYCLE NOT ACTIVE · AWAITING SIGNED DELIVERY RECEIPT
                      </div>
                    ) : (
                      (() => {
                        const daysRemaining = r.paymentDueDate ? paymentDaysRemaining(r.paymentDueDate, now) : undefined;
                        const isOverdue = !r.paymentIsFullyPaid
                          && r.paymentState.remainingInvoiceBalance > 0
                          && daysRemaining !== undefined
                          && daysRemaining < 0;
                        const status = r.paymentIsFullyPaid
                          ? "FULLY PAID"
                          : isOverdue
                            ? "PAYMENT OVERDUE"
                            : r.paymentCycleStartedAt
                              ? "PAYMENT CYCLE ACTIVE"
                              : "PAYMENT CYCLE STARTING";
                        const statusClass = r.paymentIsFullyPaid
                          ? "bg-green-100 text-green-800"
                          : isOverdue
                            ? "bg-red-100 text-red-800"
                            : r.paymentCycleStartedAt
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-700";
                        const remainingTime = daysRemaining === undefined
                          ? "Due date unavailable"
                          : daysRemaining < 0
                            ? `${Math.abs(daysRemaining)} ${Math.abs(daysRemaining) === 1 ? "day" : "days"} overdue`
                            : daysRemaining === 0
                              ? "Due today"
                              : `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} remaining`;
                        return (
                          <>
                            <div className="mt-3">
                              <span className={`rounded-full px-3 py-1.5 font-dm text-xs font-extrabold ${statusClass}`}>{status}</span>
                            </div>
                            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                              <InfoPair label="Payment Terms" value={r.paymentTerms} />
                              <InfoPair label="Payment Cycle Started" value={r.paymentCycleStartedAt ? new Date(r.paymentCycleStartedAt).toLocaleString() : "—"} />
                              <InfoPair label="Payment Due" value={r.paymentDueDate ?? "—"} />
                              <InfoPair label="Remaining" value={r.paymentIsFullyPaid
                                ? "Fully paid"
                                : `${remainingTime}${isOverdue ? ` · ₱${r.paymentState.remainingInvoiceBalance.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} overdue` : ""}`} />
                            </div>
                            {r.hasPendingPayment && !r.paymentIsFullyPaid && (
                              <p className="mt-3 font-dm text-xs font-semibold text-blue-700">A submitted payment is awaiting Accountant verification.</p>
                            )}
                          </>
                        );
                      })()
                    )}
                  </section>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {visible.length === 0 && <div className="rounded-xl border border-slate-200 bg-white p-6 font-dm text-sm text-slate-600">No orders match this delivery filter.</div>}
      {receiptRow && <ClientDeliveryReceiptModal row={receiptRow} onClose={() => setViewReceiptId(null)} />}
      <AlertDialog open={Boolean(submitSignedDRId)} onOpenChange={(open) => {
        if (!signedDRSubmitInProgress.current) setSubmitSignedDRId(open ? submitSignedDRId : null);
      }}>
        <AlertDialogContent onEscapeKeyDown={(event) => {
          if (signedDRSubmitInProgress.current) event.preventDefault();
        }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-syne text-[#1A2B4A]">SUBMIT SIGNED DELIVERY RECEIPT?</AlertDialogTitle>
            <AlertDialogDescription className="font-dm text-slate-600">
              Confirming will make this file the official Signed Delivery Receipt and complete delivery for this order.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {submitInquiry?.pendingSignedDeliveryReceiptFileName && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="font-dm text-sm text-slate-700"><span className="font-bold">JO:</span> {submitInquiry.joNumber ?? submitInquiry.code}</div>
              <div className="font-dm text-sm text-slate-700"><span className="font-bold">DR:</span> {submitInquiry.deliveryReceiptNumber}</div>
              <div className="font-dm break-all text-xs text-slate-600">{submitInquiry.pendingSignedDeliveryReceiptFileName}</div>
              {submitInquiry.pendingSignedDeliveryReceiptDataUrl?.startsWith("data:image/") ? (
                <img src={submitInquiry.pendingSignedDeliveryReceiptDataUrl} alt="Pending signed Delivery Receipt preview" className="max-h-64 w-full rounded border border-slate-200 bg-white object-contain" />
              ) : submitInquiry.pendingSignedDeliveryReceiptDataUrl?.startsWith("data:application/pdf") ? (
                <iframe src={submitInquiry.pendingSignedDeliveryReceiptDataUrl} title="Pending signed Delivery Receipt preview" className="h-64 w-full rounded border border-slate-200 bg-white" />
              ) : (
                <div className="rounded border border-slate-200 bg-white p-4 font-dm text-xs text-slate-600">Preview is unavailable for this file type.</div>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(uploadingSignedDRId)} className="font-dm">CANCEL</AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(uploadingSignedDRId) || !submitInquiry?.pendingSignedDeliveryReceiptFileName || !submitInquiry.pendingSignedDeliveryReceiptDataUrl}
              className="font-dm bg-[#1A2B4A] text-white hover:bg-[#263d62]"
              onClick={(event) => {
                event.preventDefault();
                void confirmSignedDRSubmission();
              }}
            >
              {uploadingSignedDRId ? "SUBMITTING..." : "CONFIRM / SUBMIT SIGNED DR"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InfoPair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</div>
      <div className="font-dm mt-0.5" style={{ fontSize: 13, color: "#0F172A", fontWeight: 500 }}>{value}</div>
    </div>
  );
}

/* DERIVED: build an invoice row for the client portal from a store inquiry. Reads confirmedPayments off the inquiry. */
function inquiryToClientInvoice(inq: Inquiry) {
  const state = paymentState(inq);
  const isPaid = inq.stage === "paid" || state.state === "FULLY_PAID";
  return {
    id: inq.id,
    inv: inq.invoiceNo ?? `SI-${inq.code.replace("PO-", "")}`,
    po: inq.poNumber ?? inq.poFileName ?? inq.code,
    item: inq.products[0]?.filterName || inq.products[0]?.type || "—",
    amount: state.invoiceTotal,
    payment: inq.paymentTerms,
    due: inq.paymentCycleStartedAt ? inq.invoiceDueDate ?? "—" : "—",
    status: (isPaid ? "paid" : "pending") as "paid" | "pending",
    paidDate: inq.paidAt ?? "",
    payments: paymentRecords(inq),
    paymentState: state,
    downpaymentPercent: inq.quotationDoc?.downpaymentPercent ?? inq.downpaymentPercent ?? 0,
  };
}

/* ---------- Accounting Tab ---------- */
function ClientAccountingTab({ clientName, focusInvoiceId }: { clientName: string; focusInvoiceId?: string | null }) {
  const { byClient, submitPayment } = useOrders();
  /* Section M — payment instructions come from the Settings store, not hardcoded */
  const { settings } = useSettings();
  const bank = settings.bankDetails;
  const { push: pushNotif } = useNotifications();
  const [receiptForm, setReceiptForm] = useState<Record<string, { amount: string; reference: string; note: string; file: string; receiptDataUrl?: string; methodId?: string }>>({});
  const [view, setView] = useState<"active" | "history">("active");

  /* DERIVED: pull this client's invoiced inquiries (delivered / overdue / paid). PO/quotation/in-production aren't yet billable. */
  const myInvoiced = byClient(clientName).filter((i) => !i.archived && !!i.invoiceSentAt && !!i.invoiceNo);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const invoiceToView = myInvoiced.find((i) => i.id === invoiceId);
  const rows = myInvoiced.map(inquiryToClientInvoice);

  const activeRows = rows.filter(r => r.paymentState.state !== "FULLY_PAID");
  const historyRows = rows.filter(r => r.paymentState.state === "FULLY_PAID");
  const visibleRows = view === "active" ? activeRows : historyRows;

  const [openId, setOpenId] = useState<string | null>(focusInvoiceId ?? activeRows[0]?.id ?? null);

  const submitReceipt = (rowId: string, invNo: string) => {
    const f = receiptForm[rowId];
    if (!f?.file || !f.receiptDataUrl) { toast.error("Please attach a receipt file first"); return; }
    const amt = parseFloat(f.amount);
    if (isNaN(amt) || amt <= 0) { toast.error("Please enter the amount paid"); return; }
    const selectedMethod = settings.paymentMethods.find((m) => m.id === f.methodId) ?? settings.paymentMethods[0];
    submitPayment(rowId, {
      invoiceNo: invNo,
      submittedAmount: amt,
      method: selectedMethod?.label ?? bank.bankName,
      referenceNumber: f.reference || f.note || "—",
      receiptFile: f.file,
      receiptDataUrl: f.receiptDataUrl,
      paymentDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      note: f.note || undefined,
    });
    pushNotif({
      dept: "payments",
      title: `Receipt uploaded by ${clientName}`,
      body: `${invNo} · ₱${amt.toLocaleString("en-PH")}${f.note ? ` · ${f.note}` : ""}`,
      link: "accounting",
      recipients: ["owner", "operations", "accounting"],
    });
    toast.success("Receipt sent to Enter-Fil", { description: "The secretary will verify and update your account." });
    setReceiptForm((prev) => ({ ...prev, [rowId]: { amount: "", reference: "", note: "", file: "", receiptDataUrl: "", methodId: settings.paymentMethods[0]?.id } }));
  };

  const pill = (label: string, value: string, color = "#0F172A") => (
    <div className="bg-white rounded-xl border border-slate-200/70 p-4" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <div className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</div>
      <div className="font-syne mt-1" style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
    </div>
  );

  return (
    <div className="px-8 py-8 flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          {view === "history" && (
            <button onClick={() => setView("active")} className="font-dm flex items-center gap-1 hover:underline mb-1" style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>
              ← Back to active
            </button>
          )}
          <h1 className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>
            {view === "active" ? "My Invoices & Payments" : "Paid Transactions History"}
          </h1>
          <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>
            {view === "active" ? "Pending and partial payments only · paid transactions are archived" : "Read-only history of fully cleared invoices"}
          </p>
        </div>
        {view === "active" && historyRows.length > 0 && (
          <button onClick={() => setView("history")} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white font-dm hover:bg-slate-50" style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>
            View Paid Transactions ({historyRows.length}) →
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-4">
        {pill("Total Invoices", String(rows.length))}
        {pill("Paid", String(historyRows.length), "#16A34A")}
        {pill("Pending", String(activeRows.length), "#D97706")}
        {pill("Amount Due", `₱${activeRows.reduce((s, r) => s + r.paymentState.remainingInvoiceBalance, 0).toLocaleString("en-PH")}`, "#C8102E")}
      </div>
      <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
        <table className="w-full">
          <thead style={{ backgroundColor: "#F4F6F9" }}>
            <tr>
              {(view === "active"
                ? ["Invoice No.", "PO", "Item", "Amount", "Payment Type", "Due Date", "Status"]
                : ["Invoice No.", "PO", "Item", "Amount", "Payment Method", "Date Paid", "Status"]
              ).map((h) => (
                <th key={h} className="font-dm text-left px-4 py-3" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-8 text-center font-dm" style={{ fontSize: 13, color: "#94A3B8" }}>
                {view === "active" ? "✅ No pending invoices · all caught up!" : "No paid transactions yet."}
              </td></tr>
            )}
            {visibleRows.map((r) => {
              const isOpen = openId === r.id;
              const state = r.paymentState;
              const payments = r.payments;
              const pendingPayments = payments.filter((p) => p.verificationStatus === "pending");
              const rejectedPayments = payments.filter((p) => p.verificationStatus === "rejected");
              const isPayable = state.currentPaymentType !== null;
              const isPartial = state.totalVerifiedPayments > 0 && isPayable;
              const status = pendingPayments.length > 0
                ? { bg: "#DBEAFE", fg: "#1D4ED8", label: "Awaiting Verification" }
                : state.state === "FULLY_PAID"
                ? { bg: "#DCFCE7", fg: "#15803D", label: "Fully Paid" }
                : isPartial
                ? { bg: "#DBEAFE", fg: "#1D4ED8", label: "Partial" }
                : { bg: "#FEF3C7", fg: "#B45309", label: "Payment Required" };
              const rf = receiptForm[r.id] ?? { amount: "", reference: "", note: "", file: "", receiptDataUrl: "", methodId: settings.paymentMethods[0]?.id };
              const selectedMethod = settings.paymentMethods.find((m) => m.id === rf.methodId) ?? settings.paymentMethods[0];
              const paymentTypeLabel: Record<PaymentType, string> = {
                DOWNPAYMENT: "REQUIRED DOWNPAYMENT",
                BALANCE_PAYMENT: "REMAINING BALANCE",
                FULL_PAYMENT: "FULL PAYMENT",
              };
              const currentRequirement = state.currentPaymentType ? paymentTypeLabel[state.currentPaymentType] : "FULLY PAID";
              const submissionLabel = state.currentPaymentType === "DOWNPAYMENT"
                ? "SUBMIT DOWNPAYMENT RECEIPT"
                : state.currentPaymentType === "BALANCE_PAYMENT"
                ? "SUBMIT BALANCE PAYMENT"
                : "SUBMIT FULL PAYMENT";
              const confirmed = payments
                .filter((p) => p.verificationStatus === "verified")
                .map((p) => ({ method: p.method ?? "Payment", date: p.paymentDate, ref: p.referenceNumber ?? "—", amount: p.verifiedAmount ?? p.submittedAmount }));
              const totalConfirmed = state.totalVerifiedPayments;
              const remaining = state.remainingInvoiceBalance;
              const isPending = isPayable;
              const s = status;
              return (
                <Fragment key={r.id}>
                  <tr className="border-t border-slate-200/70 hover:bg-slate-50" style={{ cursor: isPayable ? "pointer" : "default" }} onClick={() => isPayable && setOpenId(isOpen ? null : r.id)}>
                    <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}>{r.inv}<button onClick={(e) => { e.stopPropagation(); setInvoiceId(r.id); }} className="block mt-1 font-dm" style={{ fontSize: 10, color: "#C8102E", fontWeight: 800 }}>VIEW INVOICE</button></td>
                    <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, color: "#475569" }}>{r.po}</td>
                    <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#0F172A" }}>{r.item}</td>
                    <td className="px-4 py-3 font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>
                      ₱{r.amount.toLocaleString("en-PH")}
                      {(isPayable || state.state === "FULLY_PAID") && (
                        <div className="font-dm" style={{ fontSize: 11, fontWeight: 500, color: "#1D4ED8" }}>
                          ₱{totalConfirmed.toLocaleString("en-PH")} paid · ₱{remaining.toLocaleString("en-PH")} left
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{r.payment}</td>
                    <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: isPending ? "#D97706" : "#475569", fontWeight: isPending ? 600 : 400 }}>{view === "history" ? r.paidDate : r.due}</td>
                    <td className="px-4 py-3"><span className="font-dm px-2.5 py-1 rounded-full" style={{ fontSize: 11, fontWeight: 600, backgroundColor: status.bg, color: status.fg }}>{status.label}</span></td>
                  </tr>
                  {isOpen && isPayable && (
                    <tr style={{ backgroundColor: "#FAFBFC" }}>
                      <td colSpan={7} className="px-6 py-5">
                        <div className="grid grid-cols-2 gap-6">
                          {/* Payment instructions + confirmed ledger */}
                          <div>
                            <div className="font-syne mb-3" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Payment Status</div>
                            <div className="rounded-lg p-4 mb-3" style={{ backgroundColor: state.currentPaymentType === "DOWNPAYMENT" ? "#EFF6FF" : "#F8FAFC", border: "1.5px solid #BFDBFE" }}>
                              <div className="font-dm" style={{ fontSize: 11, fontWeight: 800, color: "#1E3A8A", letterSpacing: 0.5, textTransform: "uppercase" }}>{currentRequirement}</div>
                              {state.currentPaymentType === "DOWNPAYMENT" && (
                                <div className="font-dm mt-1" style={{ fontSize: 12, color: "#1D4ED8", fontWeight: 700 }}>
                                  {r.downpaymentPercent}% · ₱{state.requiredDownpaymentAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              )}
                              {state.currentPaymentType === "BALANCE_PAYMENT" && (
                                <div className="font-syne mt-1" style={{ fontSize: 22, fontWeight: 800, color: "#1D4ED8" }}>₱{remaining.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                              )}
                              {state.currentPaymentType === "FULL_PAYMENT" && (
                                <div className="font-syne mt-1" style={{ fontSize: 22, fontWeight: 800, color: "#1D4ED8" }}>₱{state.invoiceTotal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                              )}
                              {state.currentPaymentType === "DOWNPAYMENT" && (
                                <div className="font-dm mt-2" style={{ fontSize: 11, color: "#1E3A8A" }}>This required downpayment must be verified before the order can proceed to Job Order processing.</div>
                              )}
                              {state.currentPaymentType === "DOWNPAYMENT" && (
                                <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-blue-200 font-dm" style={{ fontSize: 11, color: "#1E3A8A" }}>
                                  <span>Verified Downpayment</span><strong>₱{state.verifiedDownpaymentAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                  <span>Remaining Downpayment</span><strong>₱{state.remainingDownpayment.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                </div>
                              )}
                              {state.currentPaymentType === "BALANCE_PAYMENT" && (
                                <>
                                  <div className="font-dm mt-2" style={{ fontSize: 11, fontWeight: 800, color: "#15803D", textTransform: "uppercase" }}>✓ DOWNPAYMENT VERIFIED</div>
                                  <div className="font-dm mt-1" style={{ fontSize: 11, color: "#1E3A8A" }}>Downpayment paid: ₱{state.verifiedDownpaymentAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                </>
                              )}
                            </div>
                            <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                              <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 800, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" }}>Invoice Summary</div>
                              <div className="grid grid-cols-2 gap-2 font-dm" style={{ fontSize: 12, color: "#475569" }}>
                                <span>Invoice</span><strong>{r.inv}</strong>
                                <span>PO</span><strong>{r.po}</strong>
                                <span>Invoice Total</span><strong>₱{state.invoiceTotal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                <span>Verified / Paid</span><strong>₱{state.totalVerifiedPayments.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                <span>Remaining</span><strong>₱{state.remainingInvoiceBalance.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                              </div>
                            </div>
                            {/* Loan-app style balance card */}
                            <div className="rounded-lg p-4 mb-3 flex flex-col gap-2" style={{ background: "linear-gradient(135deg, #1A2B4A 0%, #2C4170 100%)", color: "white" }}>
                              <div className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: 0.5, textTransform: "uppercase" }}>Remaining Balance</div>
                              <div className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: remaining <= 0 ? "#86EFAC" : "white", lineHeight: 1 }}>₱{remaining.toLocaleString("en-PH")}</div>
                              <div className="h-1.5 rounded-full mt-2 overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
                                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (totalConfirmed / r.amount) * 100)}%`, backgroundColor: "#16A34A" }} />
                              </div>
                              <div className="flex items-center justify-between font-dm mt-1" style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
                                <span>Total: ₱{r.amount.toLocaleString("en-PH")}</span>
                                <span>Paid: ₱{totalConfirmed.toLocaleString("en-PH")}</span>
                              </div>
                            </div>
                            {/* Confirmed payments ledger — synced from secretary */}
                            {confirmed.length > 0 && (
                              <div className="rounded-lg overflow-hidden mb-3" style={{ border: "1px solid #BBF7D0" }}>
                                <div className="px-3 py-2 flex items-center gap-2" style={{ backgroundColor: "#F0FDF4" }}>
                                  <CheckCircle2 size={13} style={{ color: "#16A34A" }} />
                                  <span className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#15803D", letterSpacing: 0.4, textTransform: "uppercase" }}>Confirmed by Enter-Fil</span>
                                </div>
                                <div className="bg-white">
                                  {confirmed.map((p, i) => (
                                    <div key={i} className="px-3 py-2 flex items-center justify-between border-t border-slate-100" style={{ borderTopColor: i === 0 ? "#BBF7D0" : "#F1F5F9" }}>
                                      <div className="flex flex-col">
                                        <span className="font-mono-jb" style={{ fontSize: 11, fontWeight: 600, color: "#0F172A" }}>{p.method}</span>
                                        <span className="font-dm" style={{ fontSize: 10, color: "#64748B" }}>{p.date} · {p.ref}</span>
                                      </div>
                                      <span className="font-syne" style={{ fontSize: 14, fontWeight: 700, color: "#16A34A" }}>+ ₱{p.amount.toLocaleString("en-PH")}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {pendingPayments.length > 0 && (
                              <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                                <div className="font-dm" style={{ fontSize: 11, fontWeight: 800, color: "#1D4ED8", letterSpacing: 0.4, textTransform: "uppercase" }}>PAYMENT SUBMITTED · AWAITING ACCOUNTING VERIFICATION</div>
                                {pendingPayments.map((p) => (
                                  <div key={p.id} className="font-dm mt-1" style={{ fontSize: 12, color: "#1E3A8A" }}>₱{p.submittedAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · {p.paymentDate}</div>
                                ))}
                              </div>
                            )}
                            {rejectedPayments.length > 0 && (
                              <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }}>
                                <div className="font-dm" style={{ fontSize: 11, fontWeight: 800, color: "#C8102E", letterSpacing: 0.4, textTransform: "uppercase" }}>PAYMENT REJECTED</div>
                                {rejectedPayments.map((p) => (
                                  <div key={p.id} className="font-dm mt-1" style={{ fontSize: 12, color: "#991B1B" }}>{p.paymentType.replace("_", " ")} · ₱{p.submittedAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{p.referenceNumber ? ` · Ref ${p.referenceNumber}` : ""} · Please submit a new payment if appropriate.</div>
                                ))}
                              </div>
                            )}
                            {/* Payment instructions */}
                            <div className="rounded-lg p-4 flex flex-col gap-2 mb-3" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                              <div className="font-dm mb-1" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" }}>Payment Instructions</div>
                              <select value={rf.methodId ?? selectedMethod?.id ?? ""} onChange={(e) => setReceiptForm(p => ({ ...p, [r.id]: { ...rf, methodId: e.target.value } }))} className="font-dm px-3 py-2 rounded-md border border-slate-200 bg-white outline-none focus:border-slate-400" style={{ fontSize: 12 }}>
                                {settings.paymentMethods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                              </select>
                              {selectedMethod ? (
                                <>
                                  <Row label="Method" value={selectedMethod.label} />
                                  <Row label="Instructions" value={selectedMethod.details} />
                                </>
                              ) : (
                                <>
                                  <Row label="Bank" value={bank.bankName} />
                                  <Row label="Account Name" value={bank.accountName} />
                                  <Row label="Account No." value={bank.accountNumber} mono />
                                </>
                              )}
                            </div>
                            <div className="rounded-lg p-3" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
                              <div className="font-dm" style={{ fontSize: 12, color: "#92400E", fontWeight: 600 }}>Payment terms run from delivery date.</div>
                              <div className="font-dm mt-1" style={{ fontSize: 11, color: "#92400E" }}>Due: {r.due} · Contact us via email for disputes.</div>
                            </div>
                          </div>

                          {/* Receipt upload */}
                          <div>
                            <div className="font-syne mb-3" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{submissionLabel}</div>
                            <div className="rounded-lg p-4 flex flex-col gap-3" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0" }}>
                              {/* File pick */}
                              <div>
                                <label className="font-dm block mb-1" style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>Receipt File (photo or PDF)</label>
                                <label className="flex items-center gap-2 px-3 py-2.5 rounded-md border-2 border-dashed cursor-pointer hover:bg-slate-50"
                                  style={{ borderColor: rf.file ? "#16A34A" : "#CBD5E1" }}>
                                  <Upload size={14} style={{ color: rf.file ? "#16A34A" : "#94A3B8" }} />
                                  <span className="font-dm" style={{ fontSize: 12, color: rf.file ? "#16A34A" : "#64748B", fontWeight: rf.file ? 600 : 400 }}>
                                    {rf.file || "Click to attach receipt..."}
                                  </span>
                                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) {
                                        const reader = new FileReader();
                                        reader.onload = () => {
                                          if (typeof reader.result !== "string") {
                                            toast.error("Could not read receipt file");
                                            return;
                                          }
                                          setReceiptForm(p => ({ ...p, [r.id]: { ...rf, file: f.name, receiptDataUrl: reader.result as string } }));
                                        };
                                        reader.onerror = () => toast.error("Could not read receipt file");
                                        reader.readAsDataURL(f);
                                      }
                                      e.currentTarget.value = "";
                                    }}
                                  />
                                </label>
                              </div>
                              {/* Amount */}
                              <div>
                                <label className="font-dm block mb-1" style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>Amount Paid (₱)</label>
                                <input type="number" placeholder={`e.g. ${r.amount}`} value={rf.amount}
                                  onChange={(e) => setReceiptForm(p => ({ ...p, [r.id]: { ...rf, amount: e.target.value } }))}
                                  className="font-dm w-full px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white"
                                  style={{ fontSize: 13 }}
                                />
                              </div>
                              {/* Reference */}
                              <div>
                                <label className="font-dm block mb-1" style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>Reference Number <span style={{ fontWeight: 400, color: "#94A3B8" }}>(optional)</span></label>
                                <input placeholder="e.g. BDO-2026-04100" value={rf.reference}
                                  onChange={(e) => setReceiptForm(p => ({ ...p, [r.id]: { ...rf, reference: e.target.value } }))}
                                  className="font-dm w-full px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white"
                                  style={{ fontSize: 13 }}
                                />
                              </div>
                              {/* Note */}
                              <div>
                                <label className="font-dm block mb-1" style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>Note <span style={{ fontWeight: 400, color: "#94A3B8" }}>(optional)</span></label>
                                <input placeholder="e.g. partial payment, BDO ref no." value={rf.note}
                                  onChange={(e) => setReceiptForm(p => ({ ...p, [r.id]: { ...rf, note: e.target.value } }))}
                                  className="font-dm w-full px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white"
                                  style={{ fontSize: 13 }}
                                />
                              </div>
                              <button
                                onClick={() => submitReceipt(r.id, r.inv)}
                                className="flex items-center justify-center gap-2 py-2.5 rounded-md text-white font-dm hover:opacity-90"
                                style={{ backgroundColor: "#1A2B4A", fontSize: 12, fontWeight: 700, letterSpacing: 0.3 }}
                              >
                                <Send size={14} strokeWidth={2.5} /> {submissionLabel}
                              </button>
                            </div>
                            <div className="font-dm italic mt-2" style={{ fontSize: 11, color: "#64748B" }}>
                              Your account will be cleared after the secretary verifies your receipt.
                            </div>
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
      {invoiceToView && <InvoicePreviewModal inquiry={invoiceToView} onClose={() => setInvoiceId(null)} />}
    </div>
  );
}

function ReviewLine({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: 0.4, textTransform: "uppercase", minWidth: 100 }}>{label}</span>
      <span className="font-dm" style={{ fontSize: 13, fontWeight: 600, color: accent ?? "#0F172A" }}>{value}</span>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between font-dm" style={{ fontSize: 13 }}>
      <span style={{ color: "#64748B" }}>{label}</span>
      <span className={mono ? "font-mono-jb" : ""} style={{ color: "#0F172A", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

/* ---------- Settings Tab ---------- */
function SettingsTab({ clientName }: { clientName: string }) {
  const [initialCompanySettings] = useState(() => getClientCompanySettings(clientName));
  const [companyName, setCompanyName] = useState(initialCompanySettings?.companyName ?? clientName);
  const [industry, setIndustry] = useState(initialCompanySettings?.industry ?? "Aerospace");
  const [address1, setAddress1] = useState(initialCompanySettings?.addressLine1 ?? "");
  const [address2, setAddress2] = useState(initialCompanySettings?.addressLine2 ?? "");
  const [cityProvince, setCityProvince] = useState(initialCompanySettings?.cityProvince ?? "");
  const [zip, setZip] = useState(initialCompanySettings?.zip ?? "");
  const [contactName, setContactName] = useState("M. Rivera");
  const [phone, setPhone] = useState("+63 917 555 1212");
  const [email] = useState("procurement@be-aerospace.ph");
  const [deliveryMethod, setDeliveryMethod] = useState<"Company Vehicle" | "Lalamove" | "AP Cargo" | "Fast Cargo" | "Client Pick-up">("Company Vehicle");
  /* Password change */
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwdSection, setShowPwdSection] = useState(false);
  const changePassword = () => {
    if (!currentPwd) { toast.error("Current password is required"); return; }
    if (newPwd.length < 8) { toast.error("New password must be at least 8 characters"); return; }
    if (newPwd !== confirmPwd) { toast.error("Passwords do not match"); return; }
    toast.success("Password changed", { description: "You'll use the new password on your next login." });
    setCurrentPwd(""); setNewPwd(""); setConfirmPwd(""); setShowPwdSection(false);
  };
  const [pickupName, setPickupName] = useState("");
  const [pickupPhone, setPickupPhone] = useState("");
  /* Notification preferences */
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [notifTriggers, setNotifTriggers] = useState({
    quotationReceived: true,
    joCreated: true,
    inProduction: false,
    readyForDispatch: true,
    deliveryUpdate: true,
    invoiceIssued: true,
    paymentReminders: true,
    overdueAlerts: true,
  });

  const save = () => {
    try {
      saveClientCompanySettings(clientName, {
        companyName,
        industry,
        addressLine1: address1,
        addressLine2: address2,
        cityProvince,
        zip,
      });
      toast.success("Settings saved", { description: "Your company information has been updated." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Company settings could not be saved.";
      toast.error("Unable to save settings", { description: message });
    }
  };

  return (
    <div className="px-8 py-8 max-w-2xl">
      <h1 className="font-syne mb-6" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>Company Settings</h1>

      {/* Company Info */}
      <section className="bg-white rounded-xl border border-slate-200/70 p-6 mb-6" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
        <div className="font-syne mb-4" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Company Information</div>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <SField label="Company Name">
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />
            </SField>
            <SField label="Industry">
              <input value={industry} onChange={(e) => setIndustry(e.target.value)} className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />
            </SField>
          </div>
          <SField label="Address Line 1">
            <input value={address1} onChange={(e) => setAddress1(e.target.value)} className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />
          </SField>
          <SField label="Address Line 2">
            <input value={address2} onChange={(e) => setAddress2(e.target.value)} placeholder="Apt, suite, building (optional)" className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />
          </SField>
          <div className="grid grid-cols-2 gap-4">
            <SField label="City / Province">
              <input value={cityProvince} onChange={(e) => setCityProvince(e.target.value)} className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />
            </SField>
            <SField label="ZIP Code">
              <input value={zip} onChange={(e) => setZip(e.target.value)} className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />
            </SField>
          </div>
        </div>
      </section>

      {/* Contact Person */}
      <section className="bg-white rounded-xl border border-slate-200/70 p-6 mb-6" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
        <div className="font-syne mb-4" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Contact Person</div>
        <div className="flex flex-col gap-4">
          <SField label="Full Name">
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />
          </SField>
          <SField label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />
          </SField>
          <SField label="Email">
            <input value={email} disabled className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 bg-slate-50" style={{ fontSize: 13, color: "#94A3B8" }} />
            <p className="font-dm mt-1" style={{ fontSize: 11, color: "#94A3B8" }}>Contact your Enter-Fil account manager to change your login email.</p>
          </SField>
        </div>
      </section>

      {/* Delivery Preferences */}
      <section className="bg-white rounded-xl border border-slate-200/70 p-6 mb-6" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
        <div className="font-syne mb-4" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Delivery Preferences</div>
        <div className="font-dm mb-3" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Preferred Delivery Method <span className="text-slate-400 font-normal">(Enter-Fil has final approval)</span></div>
        <div className="flex flex-col gap-2 mb-4">
          {([
            { id: "Company Vehicle", desc: "Batangas / Laguna / nearby provinces" },
            { id: "Lalamove",        desc: "Local · urgent same-day" },
            { id: "AP Cargo",        desc: "Cagayan / Isabela / northern provinces" },
            { id: "Fast Cargo",      desc: "Davao / Mindanao / southern provinces" },
            { id: "Client Pick-up",  desc: "Pick up from Enter-Fil warehouse" },
          ] as const).map((m) => {
            const active = deliveryMethod === m.id;
            return (
              <label key={m.id} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer" style={{ border: active ? "2px solid #C8102E" : "1px solid #CBD5E1", backgroundColor: active ? "#FEF2F2" : "white", padding: active ? 11 : 12 }}>
                <input type="radio" checked={active} onChange={() => setDeliveryMethod(m.id)} style={{ accentColor: "#C8102E" }} />
                <div className="flex-1">
                  <div className="font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{m.id}</div>
                  <div className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>{m.desc}</div>
                </div>
              </label>
            );
          })}
        </div>

        {deliveryMethod === "Client Pick-up" && (
          <div className="flex flex-col gap-4 pt-4 border-t border-slate-200">
            <div className="font-dm mb-1" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Pick-up Person</div>
            <div className="grid grid-cols-2 gap-4">
              <SField label="Name">
                <input value={pickupName} onChange={(e) => setPickupName(e.target.value)} placeholder="Full name" className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />
              </SField>
              <SField label="Phone">
                <input value={pickupPhone} onChange={(e) => setPickupPhone(e.target.value)} placeholder="+63..." className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />
              </SField>
            </div>
          </div>
        )}
      </section>

      {/* Change Password */}
      <section className="bg-white rounded-xl border border-slate-200/70 p-6 mb-6" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-syne" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>🔒 Change Password</div>
            <p className="font-dm mt-0.5" style={{ fontSize: 12, color: "#64748B" }}>Update your portal login password</p>
          </div>
          {!showPwdSection && (
            <button onClick={() => setShowPwdSection(true)} className="font-dm px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50" style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}>
              Change password
            </button>
          )}
        </div>
        {showPwdSection && (
          <div className="rounded-lg p-4 flex flex-col gap-3" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
            <SField label="Current Password">
              <input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
            </SField>
            <SField label="New Password">
              <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Min 8 characters" className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
            </SField>
            <SField label="Confirm New Password">
              <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
            </SField>
            <div className="flex justify-end gap-2 mt-1">
              <button onClick={() => { setShowPwdSection(false); setCurrentPwd(""); setNewPwd(""); setConfirmPwd(""); }} className="font-dm px-4 py-2 rounded-md hover:bg-slate-100" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Cancel</button>
              <button onClick={changePassword} className="font-dm px-4 py-2 rounded-md text-white hover:opacity-90" style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700 }}>Update Password</button>
            </div>
          </div>
        )}
      </section>

      {/* Notification Preferences */}
      <section className="bg-white rounded-xl border border-slate-200/70 p-6 mb-6" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
        <div className="font-syne mb-1" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Notification Preferences</div>
        <p className="font-dm mb-4" style={{ fontSize: 12, color: "#64748B" }}>Choose how Enter-Fil reaches you with order updates</p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <ChannelToggle
            icon="✉️"
            label="Email Alerts"
            email={email}
            enabled={emailAlerts}
            onToggle={() => setEmailAlerts(v => !v)}
            accent="#2563EB"
          />
        </div>

        <div className="rounded-lg p-4" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
          <div className="font-dm mb-3" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" }}>Notify me about:</div>
          <div className="flex flex-col gap-2">
            {[
              ["quotationReceived", "Quotation received from Enter-Fil"],
              ["joCreated", "Job order created (production starting)"],
              ["inProduction", "Production stage updates"],
              ["readyForDispatch", "Order ready for dispatch"],
              ["deliveryUpdate", "Delivery in transit / delivered"],
              ["invoiceIssued", "Invoice issued"],
              ["paymentReminders", "Payment reminders before due date"],
              ["overdueAlerts", "Overdue payment alerts"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer hover:bg-white rounded p-2">
                <input
                  type="checkbox"
                  checked={notifTriggers[key as keyof typeof notifTriggers]}
                  onChange={() => setNotifTriggers(p => ({ ...p, [key]: !p[key as keyof typeof notifTriggers] }))}
                  style={{ accentColor: "#C8102E" }}
                />
                <span className="font-dm flex-1" style={{ fontSize: 13, color: "#0F172A" }}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-md p-3 mt-3 font-dm" style={{ fontSize: 11, color: "#1E40AF", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
          ℹ️ Email alerts via SendGrid. You can unsubscribe anytime.
        </div>
      </section>

      <button
        onClick={save}
        className="w-full py-3 rounded-md text-white font-dm hover:opacity-90"
        style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}
      >
        💾 Save Settings
      </button>
    </div>
  );
}

function ChannelToggle({ icon, label, email, enabled, onToggle, accent }: {
  icon: string; label: string; email: string; enabled: boolean; onToggle: () => void; accent: string;
}) {
  return (
    <div className="rounded-lg p-3 flex items-center gap-3" style={{ border: enabled ? `1.5px solid ${accent}` : "1px solid #E2E8F0", backgroundColor: enabled ? `${accent}10` : "white" }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-dm" style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{label}</div>
        <div className="font-dm truncate" style={{ fontSize: 10, color: "#64748B" }}>{email}</div>
      </div>
      <button
        onClick={onToggle}
        className="relative w-10 h-5 rounded-full transition-colors shrink-0"
        style={{ backgroundColor: enabled ? accent : "#CBD5E1" }}
      >
        <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: enabled ? 22 : 2, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
      </button>
    </div>
  );
}

function SField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>{label}</label>
      {children}
    </div>
  );
}

/* ---------- Shared form helpers ---------- */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>{label}</label>
      {children}
    </div>
  );
}
function Num({ v, onChange }: { v: string; onChange: (v: string) => void }) {
  return <input type="number" value={v} onChange={(e) => onChange(e.target.value)} className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />;
}
function Txt({ v, onChange }: { v: string; onChange: (v: string) => void }) {
  return <input type="text" value={v} onChange={(e) => onChange(e.target.value)} className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />;
}

/* ---------- Main Export ---------- */
export function ClientPortal({ onLogout, clientName = "B.E. Aerospace" }: { onLogout?: () => void; clientName?: string } = {}) {
  const [tab, setTab] = useState<Tab>("orders");
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string | null>(null);
  return (
    <Shell active={tab} onChange={setTab} clientName={clientName} onLogout={onLogout}>
      {tab === "orders" && <OrdersTab clientName={clientName} onSubmitted={() => setTab("status")} onPayInvoice={(id) => { setPaymentInvoiceId(id); setTab("accounting"); }} />}
      {tab === "status" && <StatusTab clientName={clientName} />}
      {tab === "logistics" && <LogisticsTab clientName={clientName} />}
      {tab === "accounting" && <ClientAccountingTab clientName={clientName} focusInvoiceId={paymentInvoiceId} />}
      {tab === "settings" && <SettingsTab clientName={clientName} />}
    </Shell>
  );
}
