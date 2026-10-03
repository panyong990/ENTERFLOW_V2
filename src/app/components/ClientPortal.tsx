import { Fragment, useState } from "react";
import {
  ClipboardList, MapPin, Truck, CreditCard, Upload, CheckCircle2, Circle,
  Building2, User as UserIcon, Info, Camera, Send, Plus, Trash2, ChevronDown,
  ChevronUp, FileCheck, X, Settings, ExternalLink,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { useOrders, unitPrice, quotationTotal, type Inquiry, type ProductLine, type ReplacementRequest } from "../store/orders";
import { useNotifications } from "../store/notifications";
import { useSettings } from "../store/settings";
import { NotificationBell } from "./NotificationBell";
import { JOTemplateModal, type JOTemplateData } from "./JOTemplateModal";
import { QuotationPreviewModal } from "./QuotationPreviewModal";
import { FILTER_TYPES as FILTER_TYPE_CATALOG, GROUP_DISPLAY, GROUP_TEMPLATES, DIMENSION_LABELS, groupForType, labelForType, type DimensionKey } from "../store/filterTemplates";

type Tab = "orders" | "status" | "logistics" | "accounting" | "settings";

const tabs: { id: Tab; label: string; icon: any }[] = [
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "status", label: "Status", icon: MapPin },
  { id: "logistics", label: "Logistics", icon: Truck },
  { id: "accounting", label: "Accounting", icon: CreditCard },
  { id: "settings", label: "Settings", icon: Settings },
];

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
          <NotificationBell role="client" />
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

function OrdersTab({ clientName, onSubmitted }: { clientName: string; onSubmitted: () => void }) {
  const { uploadPO, requestCancellation, byClient } = useOrders();
  const { push: pushNotif } = useNotifications();
  /* Active orders only — Job Orders and Transactions live in their own tabs now */
  const myOrders = byClient(clientName).filter((i) => !i.archived && (i.stage === "inquiry" || i.stage === "quotation" || i.stage === "po"));

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
      {myOrders.map((inq) => (
        <ClientOrderCard
          key={inq.id}
          inquiry={inq}
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
          onSubmit={(name) => { uploadPO(poForId, name); setPoForId(null); toast.success("Purchase Order submitted ✅", { description: "Management has been notified" }); }}
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
                    <button onClick={() => reorder(inq)} className="flex items-center gap-1 px-3 py-1.5 rounded-md font-dm hover:opacity-90" style={{ fontSize: 11, fontWeight: 700, backgroundColor: "#C9A84C", color: "white", letterSpacing: 0.3 }}>
                      🔁 Reorder
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
/* ── Replacement window helpers ── */
function replacementWindowDays(paymentTerms: string): number {
  return paymentTerms === "15-Day Terms" ? 7 : 14;
}
function isInReplacementWindow(inq: Inquiry): boolean {
  if (!inq.deliveredDate) return false;
  const d = new Date(inq.deliveredDate);
  if (isNaN(d.getTime())) return false;
  const windowDays = replacementWindowDays(inq.paymentTerms);
  const expires = new Date(d); expires.setDate(expires.getDate() + windowDays);
  return new Date() <= expires;
}
function replacementWindowExpiry(inq: Inquiry): string {
  if (!inq.deliveredDate) return "—";
  const d = new Date(inq.deliveredDate);
  if (isNaN(d.getTime())) return "—";
  const windowDays = replacementWindowDays(inq.paymentTerms);
  const expires = new Date(d); expires.setDate(expires.getDate() + windowDays);
  return expires.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function TransactionsTab({ clientName }: { clientName: string }) {
  const { byClient, addReplacementRequest, resolveReplacement, updateInquiry } = useOrders();
  const { push: pushNotif } = useNotifications();

  /* Include delivered + paid orders */
  const allOrders = byClient(clientName).filter((i) => !i.archived && ["delivered", "paid"].includes(i.stage));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replacementModal, setReplacementModal] = useState<Inquiry | null>(null);

  return (
    <div className="px-8 py-8 flex flex-col gap-4">
      <div>
        <h1 className="font-syne" style={{ fontSize: 26, fontWeight: 800, color: "#0F172A" }}>Transaction History</h1>
        <p className="font-dm mt-0.5" style={{ fontSize: 13, color: "#64748B" }}>
          Delivered and paid orders · Replacement requests can be made within the replacement window.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
        <table className="w-full">
          <thead style={{ backgroundColor: "#F4F6F9" }}>
            <tr>
              {["Date", "PO No.", "Item", "Amount", "Payment Terms", "Status", "Replace Window", ""].map((h) => (
                <th key={h} className="font-dm text-left px-4 py-3" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allOrders.length === 0 && (
              <tr><td colSpan={8} className="px-6 py-8 text-center font-dm" style={{ fontSize: 13, color: "#94A3B8" }}>No transactions yet.</td></tr>
            )}
            {allOrders.map((inq) => {
              const inWindow = isInReplacementWindow(inq);
              const reqCount = (inq.replacementRequests ?? []).length;
              const maxReached = reqCount >= 2;
              const canRequest = inWindow && !maxReached;
              const isExpanded = expandedId === inq.id;
              const pendingRequests = (inq.replacementRequests ?? []).filter(r => r.status !== "resolved");

              return (
                <Fragment key={inq.id}>
                  <tr className="border-t border-slate-200/70 hover:bg-slate-50 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : inq.id)}>
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
                    <td className="px-4 py-3">
                      {inWindow ? (
                        <span className="font-dm" style={{ fontSize: 11, color: "#15803D", fontWeight: 600 }}>Open · until {replacementWindowExpiry(inq)}</span>
                      ) : (
                        <span className="font-dm" style={{ fontSize: 11, color: "#94A3B8" }}>Closed</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canRequest ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); setReplacementModal(inq); }}
                          className="font-dm px-3 py-1.5 rounded-md text-white hover:opacity-90"
                          style={{ fontSize: 11, fontWeight: 700, backgroundColor: "#C8102E" }}
                        >
                          Request Replacement
                        </button>
                      ) : maxReached ? (
                        <span className="font-dm" style={{ fontSize: 11, color: "#94A3B8" }}>Max 2 replacements</span>
                      ) : null}
                      {pendingRequests.length > 0 && (
                        <span className="font-dm ml-2 px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: "#FEF3C7", color: "#B45309" }}>
                          {pendingRequests.length} pending
                        </span>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (inq.replacementRequests ?? []).length > 0 && (
                    <tr key={`${inq.id}-expanded`}>
                      <td colSpan={8} className="px-4 py-3 bg-slate-50">
                        <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Replacement Requests</div>
                        <div className="flex flex-col gap-2">
                          {(inq.replacementRequests ?? []).map((req) => (
                            <div key={req.id} className="rounded-md p-3 bg-white border border-slate-200 flex items-start justify-between gap-4">
                              <div className="flex flex-col gap-1">
                                <div className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>
                                  Replace {req.qty} pcs · {req.reason}
                                </div>
                                <div className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>{req.defectDescription}</div>
                                <div className="font-dm" style={{ fontSize: 10, color: "#94A3B8" }}>
                                  Requested {new Date(req.requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  {req.proofFileName && ` · Photo: ${req.proofFileName}`}
                                  {req.joNumber && ` · Replacement JO: ${req.joNumber}`}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-dm px-2.5 py-1 rounded-full shrink-0" style={{ fontSize: 10, fontWeight: 700,
                                  backgroundColor: req.status === "resolved" ? "#DCFCE7" : req.status === "processing" ? "#DBEAFE" : "#FEF3C7",
                                  color: req.status === "resolved" ? "#15803D" : req.status === "processing" ? "#1D4ED8" : "#B45309" }}>
                                  {req.status === "resolved" ? "✅ Resolved" : req.status === "processing" ? "🔧 Processing" : "⏳ Pending"}
                                </span>
                                {req.status === "processing" && (
                                  <button
                                    onClick={() => {
                                      resolveReplacement(inq.id, req.id);
                                      toast.success("Marked as resolved", { description: "Thank you! The replacement has been received." });
                                    }}
                                    className="font-dm px-3 py-1.5 rounded-md text-white hover:opacity-90"
                                    style={{ fontSize: 11, fontWeight: 700, backgroundColor: "#16A34A" }}
                                  >
                                    Mark as Received
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
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

      {/* Replacement Request Modal */}
      {replacementModal && (
        <ReplacementRequestModal
          inquiry={replacementModal}
          onClose={() => setReplacementModal(null)}
          onSubmit={(req) => {
            addReplacementRequest(replacementModal.id, req);
            pushNotif({
              dept: "operations",
              title: `Replacement request: ${replacementModal.code}`,
              body: `${replacementModal.clientName} · ${req.qty} pcs · ${req.reason}`,
              link: "production",
              recipients: ["owner", "operations"],
            });
            toast.success("Replacement request submitted", { description: "Operations will process your request within 1-2 business days." });
            setReplacementModal(null);
          }}
        />
      )}
    </div>
  );
}

function ReplacementRequestModal({ inquiry, onClose, onSubmit }: {
  inquiry: Inquiry;
  onClose: () => void;
  onSubmit: (req: { reason: string; defectDescription: string; qty: number; proofFileName?: string }) => void;
}) {
  const [reason, setReason] = useState("");
  const [defect, setDefect] = useState("");
  const [qty, setQty] = useState(1);
  const [proofFile, setProofFile] = useState("");
  const maxQty = inquiry.products.reduce((s, p) => s + p.qty, 0);

  const submit = () => {
    if (!reason.trim()) { toast.error("Please select a reason"); return; }
    if (!defect.trim()) { toast.error("Please describe the issue"); return; }
    if (qty <= 0 || qty > maxQty) { toast.error(`Qty must be between 1 and ${maxQty}`); return; }
    onSubmit({ reason, defectDescription: defect, qty, proofFileName: proofFile || undefined });
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.6)" }} onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg flex flex-col" style={{ boxShadow: "0 24px 48px rgba(0,0,0,0.3)", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2" style={{ backgroundColor: "#FEF2F2" }}>
          <span style={{ fontSize: 18 }}>🔄</span>
          <h3 className="font-syne" style={{ fontSize: 16, fontWeight: 700, color: "#991B1B" }}>Request Item Replacement</h3>
          <button onClick={onClose} className="ml-auto w-8 h-8 rounded-md hover:bg-red-100 flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="p-5 overflow-auto flex flex-col gap-4">
          {/* Order summary */}
          <div className="rounded-lg p-3" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
            <div className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>
              {inquiry.code} · {inquiry.products[0]?.filterName ?? inquiry.products[0]?.type}
            </div>
            <div className="font-dm mt-0.5" style={{ fontSize: 11, color: "#64748B" }}>
              Delivered: {inquiry.deliveredDate ?? "—"} · Window expires: {replacementWindowExpiry(inquiry)}
            </div>
            <div className="font-dm mt-1" style={{ fontSize: 11, color: "#C8102E", fontWeight: 600 }}>
              Max 2 replacement requests per order ({(inquiry.replacementRequests ?? []).length}/2 used)
            </div>
          </div>

          {/* T&C reminder */}
          <div className="rounded-md p-3" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
            <div className="font-dm" style={{ fontSize: 11, color: "#92400E", lineHeight: 1.5 }}>
              <span style={{ fontWeight: 700 }}>Reminder:</span> No refunds. Replacements only. Defect/damage photos are required. Enter-Fil reserves the right to inspect the claim before processing.
            </div>
          </div>

          {/* Reason */}
          <div className="flex flex-col gap-1">
            <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.4, textTransform: "uppercase" }}>Reason *</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }}>
              <option value="">Select a reason...</option>
              <option value="Defective / damaged on arrival">Defective / damaged on arrival</option>
              <option value="Wrong specifications received">Wrong specifications received</option>
              <option value="Quality does not match sample">Quality does not match sample</option>
              <option value="Premature failure during installation">Premature failure during installation</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Defect description */}
          <div className="flex flex-col gap-1">
            <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.4, textTransform: "uppercase" }}>Describe the issue *</label>
            <textarea
              value={defect}
              onChange={(e) => setDefect(e.target.value)}
              placeholder="e.g. Filter media has tears, seams are not properly sealed, dimensions don't match the JO specs..."
              rows={3}
              className="font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white resize-none"
              style={{ fontSize: 13 }}
            />
          </div>

          {/* Qty */}
          <div className="flex flex-col gap-1">
            <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.4, textTransform: "uppercase" }}>
              Pieces to Replace * (max {maxQty})
            </label>
            <input
              type="number"
              min={1}
              max={maxQty}
              value={qty}
              onChange={(e) => setQty(Math.min(maxQty, Math.max(1, Number(e.target.value))))}
              className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white"
              style={{ fontSize: 13 }}
            />
          </div>

          {/* Proof photo upload */}
          <div className="flex flex-col gap-1">
            <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.4, textTransform: "uppercase" }}>
              Photo of Defect / Damage
            </label>
            <label className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-dashed border-slate-300 cursor-pointer hover:bg-slate-50 font-dm" style={{ fontSize: 12, color: proofFile ? "#16A34A" : "#64748B" }}>
              <Camera size={14} />
              {proofFile ? proofFile : "Upload photo (JPG, PNG, PDF)"}
              <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setProofFile(f.name);
                e.currentTarget.value = "";
              }} />
            </label>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="font-dm px-4 py-2 rounded-md hover:bg-slate-100" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Cancel</button>
          <button onClick={submit} className="font-dm px-4 py-2 rounded-md text-white hover:opacity-90" style={{ fontSize: 13, fontWeight: 700, backgroundColor: "#C8102E" }}>
            Submit Replacement Request
          </button>
        </div>
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

function ClientOrderCard({ inquiry, onUploadPO, onCancel }: { inquiry: Inquiry; onUploadPO: () => void; onCancel: (reason: string) => void }) {
  const { updateInquiry, uploadDownpaymentReceipt } = useOrders();
  const { push: pushNotif } = useNotifications();
  const [open, setOpen] = useState(inquiry.stage === "quotation");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  /* Section C — revision request modal */
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionNoteDraft, setRevisionNoteDraft] = useState("");
  /* View full quotation doc */
  const [showQuotationDoc, setShowQuotationDoc] = useState(false);
  /* View terms & conditions */
  const [showTerms, setShowTerms] = useState(false);
  const total = quotationTotal(inquiry);

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
    { bg: "#DCFCE7", fg: "#15803D", label: "PO Submitted ✅" };

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
                      const u = unitPrice(l);
                      return (
                        <tr key={p.id} className="border-t border-slate-200">
                          <td className="px-3 py-3 font-dm" style={{ fontSize: 13, color: "#0F172A" }}><span style={{ fontWeight: 700 }}>#{i + 1}</span> {p.type}{p.oem && <span className="font-mono-jb ml-1" style={{ fontSize: 11, color: "#64748B" }}>· {p.oem}</span>}</td>
                          <td className="px-3 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{p.qty}</td>
                          <td className="px-3 py-3 font-syne" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{peso(u)}</td>
                          <td className="px-3 py-3 font-syne" style={{ fontSize: 14, fontWeight: 800, color: "#C8102E" }}>{peso(u * p.qty)}</td>
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
                          ₱{(inquiry.quotationDoc.lineItems.reduce((s, li) => s + li.unitPrice * li.qty, 0) - inquiry.quotationDoc.downpaymentAmount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>{" "}
                        is due upon delivery.
                      </div>
                    </div>
                  ) : null}

                  <div className="font-dm flex flex-col gap-1.5" style={{ fontSize: 12, color: "#78350F", lineHeight: 1.6 }}>
                    <div>
                      <span style={{ fontWeight: 700 }}>Replacement Policy:</span>{" "}
                      Clients on <strong>15-Day Terms</strong> may request item replacement within <strong>1 week</strong> of delivery.
                      Clients on <strong>30-Day Terms</strong> may request replacement within <strong>2 weeks</strong> of delivery.
                      {inquiry.quotationDoc.termsOfPayment && (
                        <> Currently selected: <span style={{ fontWeight: 700, color: "#C8102E" }}>{inquiry.quotationDoc.termsOfPayment}</span>
                        {" "}— replacement window: <span style={{ fontWeight: 700, color: "#C8102E" }}>{inquiry.quotationDoc.termsOfPayment === "15-Day Terms" ? "1 week" : "2 weeks"}</span> from delivery date.</>
                      )}
                    </div>
                    <div>
                      <span style={{ fontWeight: 700 }}>No Refunds.</span>{" "}
                      All sales are final. Replacement requests only — no monetary refunds will be issued.
                    </div>
                    <div>
                      <span style={{ fontWeight: 700 }}>For replacement requests or concerns, contact Enter-Fil:</span>{" "}
                      Tel: +63 (2) 8861-5737 / +63 (2) 8653-3750 · Mobile: +63 (956) 657-3837 · Email: enterfil.filtration@yahoo.com / zuluetaellen@gmail.com
                    </div>
                    <div style={{ color: "#92400E", fontSize: 11 }}>
                      Office Hours: Monday – Friday, 8:00 AM – 6:00 PM · Sitio Hulo, Brgy. Balasing – San Jose Rd, Santa Maria, 3022 Bulacan
                    </div>
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
                  ✅ PO submitted: <span style={{ fontWeight: 700 }}>{inquiry.poFileName}</span> — production will begin shortly.
                </div>
              )}

              {/* ── Downpayment action card — shown when DP is required but not yet confirmed ── */}
              {(inquiry.downpaymentAmount ?? 0) > 0 && !inquiry.downpaymentConfirmed && inquiry.stage !== "inquiry" && inquiry.stage !== "quotation" && (
                <div className="rounded-xl p-4 flex flex-col gap-3" style={{ backgroundColor: "#EFF6FF", border: "1.5px solid #BFDBFE" }}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="font-dm flex items-center gap-2" style={{ fontSize: 12, fontWeight: 800, color: "#1E3A8A", letterSpacing: 0.4, textTransform: "uppercase" }}>
                      💳 Downpayment Required — {inquiry.downpaymentPercent}%
                    </div>
                    <div className="font-syne" style={{ fontSize: 16, fontWeight: 800, color: "#1D4ED8" }}>
                      ₱{(inquiry.downpaymentAmount ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {!inquiry.downpaymentPaymentDetails && (
                    <div className="font-dm rounded-md p-3" style={{ fontSize: 12, color: "#475569", backgroundColor: "#fff", border: "1px solid #BFDBFE" }}>
                      ⏳ Awaiting payment details from Enter-Fil Accounting. You will be notified here once details are sent.
                    </div>
                  )}

                  {inquiry.downpaymentPaymentDetails && (
                    <div className="rounded-md p-3 flex flex-col gap-1.5" style={{ backgroundColor: "#fff", border: "1px solid #BFDBFE" }}>
                      <div className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.4, textTransform: "uppercase" }}>Payment Details</div>
                      <div className="font-dm" style={{ fontSize: 13, color: "#0F172A" }}>
                        <span style={{ fontWeight: 700 }}>Method:</span> {inquiry.downpaymentPaymentDetails.method}
                        {inquiry.downpaymentPaymentDetails.bankName ? ` · ${inquiry.downpaymentPaymentDetails.bankName}` : ""}
                      </div>
                      {inquiry.downpaymentPaymentDetails.accountName && (
                        <div className="font-dm" style={{ fontSize: 13, color: "#0F172A" }}>
                          <span style={{ fontWeight: 700 }}>Account Name:</span> {inquiry.downpaymentPaymentDetails.accountName}
                        </div>
                      )}
                      <div className="font-dm" style={{ fontSize: 13, color: "#0F172A" }}>
                        <span style={{ fontWeight: 700 }}>{inquiry.downpaymentPaymentDetails.method === "GCash" ? "GCash Number" : inquiry.downpaymentPaymentDetails.method === "Check" ? "Reference" : "Account Number"}:</span>{" "}
                        <span className="font-mono-jb">{inquiry.downpaymentPaymentDetails.accountNumber}</span>
                      </div>
                      {inquiry.downpaymentPaymentDetails.note && (
                        <div className="font-dm mt-1 rounded p-2" style={{ fontSize: 12, color: "#92400E", backgroundColor: "#FFFBEB", border: "1px dashed #FDE68A" }}>
                          📝 {inquiry.downpaymentPaymentDetails.note}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Receipt upload — only when payment details have been sent */}
                  {inquiry.downpaymentPaymentDetails && !inquiry.downpaymentReceiptFile && (
                    <label className="block w-full rounded-md border-2 border-dashed cursor-pointer hover:bg-white p-4 flex flex-col items-center justify-center gap-1 font-dm transition-colors" style={{ borderColor: "#BFDBFE", color: "#1D4ED8", fontSize: 12 }}>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          uploadDownpaymentReceipt(inquiry.id, f.name);
                          pushNotif({
                            dept: "payments",
                            title: `Downpayment receipt uploaded: ${inquiry.code}`,
                            body: `${inquiry.clientName} · ₱${(inquiry.downpaymentAmount ?? 0).toLocaleString("en-PH")} · ${f.name}`,
                            link: "accounting",
                            recipients: ["owner", "operations", "accounting"],
                          });
                          toast.success("Downpayment receipt uploaded", { description: "Enter-Fil Accounting will confirm shortly." });
                          e.currentTarget.value = "";
                        }}
                      />
                      <span style={{ fontWeight: 700 }}>📤 Upload Downpayment Receipt</span>
                      <span style={{ fontSize: 10, color: "#64748B" }}>PNG, JPG or PDF · proof of transfer / GCash screenshot</span>
                    </label>
                  )}

                  {inquiry.downpaymentReceiptFile && !inquiry.downpaymentConfirmed && (
                    <div className="rounded-md p-3 font-dm flex items-center gap-2" style={{ fontSize: 12, color: "#1E40AF", backgroundColor: "#fff", border: "1px solid #BFDBFE" }}>
                      ⏳ Receipt uploaded: <strong>{inquiry.downpaymentReceiptFile}</strong> — awaiting confirmation from Accounting.
                    </div>
                  )}
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
          total={inquiry.quotationDoc.lineItems.reduce((s, li) => s + li.unitPrice * li.qty, 0)}
          preparedBy={inquiry.quotationDoc.preparedBy ?? "Enter-Fil"}
          onClose={() => setShowQuotationDoc(false)}
        />
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

function POUploadOverlay({ onClose, onSubmit }: { onClose: () => void; onSubmit: (fileName: string) => void }) {
  const { generatePONumber } = useOrders();
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  /* Section J — auto-generated PO reference shown to the client; on submit, prefer the uploaded filename, but fall back to this reference. */
  const [autoRef] = useState(() => generatePONumber());
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.5)" }} onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg" style={{ boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-syne" style={{ fontSize: 18, fontWeight: 700, color: "#0F172A" }}>Upload Purchase Order</h3>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <label onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); }} className="flex flex-col items-center justify-center gap-2 py-10 rounded-lg cursor-pointer transition-colors" style={{ border: `2px dashed ${drag ? "#C8102E" : "#CBD5E1"}`, backgroundColor: drag ? "#FEF2F2" : "#F8FAFC" }}>
            <Upload size={28} style={{ color: file ? "#16A34A" : "#94A3B8" }} />
            <span className="font-dm" style={{ fontSize: 13, color: "#0F172A", fontWeight: 600 }}>{file ? file.name : "Drop your PO here or click to browse"}</span>
            <span className="font-dm" style={{ fontSize: 11, color: "#94A3B8" }}>Accepts PDF, JPG, PNG</span>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <div className="rounded-md p-2 font-dm flex items-center justify-between" style={{ fontSize: 11, backgroundColor: "#F1F5F9", color: "#64748B" }}>
            <span>Auto-generated reference</span>
            <span className="font-mono-jb" style={{ color: "#0F172A", fontWeight: 700 }}>{autoRef}</span>
          </div>
          {/* Section E — always submit the auto-generated reference, never the uploaded file's name */}
          <button onClick={() => onSubmit(autoRef)} disabled={!file} className="flex items-center justify-center gap-2 py-3 rounded-md text-white font-dm hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
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
  /* Stage progression maps to a 10-step timeline visible to the client */
  const STAGE_ORDER: { key: string; label: string; matches: (i: Inquiry) => "done" | "current" | "pending"; detailFn: (i: Inquiry) => string }[] = [
    { key: "inquiry",    label: "Inquiry Submitted",     matches: (i) => i.stage === "inquiry" ? "current" : "done",
      detailFn: (i) => `Submitted ${i.submittedDate}${i.inquirySketch ? " · sketch attached" : ""}` },
    { key: "quotation",  label: "Quotation Received",    matches: (i) => i.stage === "quotation" ? "current" : (["po","jo","in_production","quality_inspection","ready_for_dispatch","delivered","paid","overdue"].includes(i.stage) ? "done" : "pending"),
      detailFn: (i) => i.quotation ? `${i.quotation.leadTimeDays}-day lead time · ${i.paymentTerms}` : "Awaiting our team's quote" },
    { key: "po",         label: "PO Approved & Uploaded", matches: (i) => i.stage === "po" ? "current" : (["jo","in_production","quality_inspection","ready_for_dispatch","delivered","paid","overdue"].includes(i.stage) ? "done" : "pending"),
      detailFn: (i) => i.poFileName ? `${i.poFileName} · approved` : "Upload signed PO to proceed" },
    { key: "jo",         label: "Job Order Created",      matches: (i) => i.stage === "jo" ? "current" : (["in_production","quality_inspection","ready_for_dispatch","delivered","paid","overdue"].includes(i.stage) ? "done" : "pending"),
      detailFn: (i) => i.joNumber ? `${i.joNumber} · production queued` : "Awaiting JO" },
    { key: "in_production", label: "In Production",        matches: (i) => i.stage === "in_production" ? "current" : (["quality_inspection","ready_for_dispatch","delivered","paid","overdue"].includes(i.stage) ? "done" : "pending"),
      detailFn: (i) => `Stage ${(i.currentStage ?? 0) + 1} of 10${i.paused ? " · ⏸ ON HOLD" : ""}` },
    { key: "quality_inspection", label: "Quality Inspection", matches: (i) => i.stage === "quality_inspection" ? "current" : (["ready_for_dispatch","delivered","paid","overdue"].includes(i.stage) ? "done" : "pending"),
      detailFn: () => "Final QC checkpoint before dispatch" },
    { key: "ready_for_dispatch", label: "Ready for Dispatch", matches: (i) => i.stage === "ready_for_dispatch" ? "current" : (["delivered","paid","overdue"].includes(i.stage) ? "done" : "pending"),
      detailFn: () => "Waybill prepared · awaiting logistics" },
    { key: "delivered",  label: "Delivered",              matches: (i) => i.stage === "delivered" ? "current" : (["paid","overdue"].includes(i.stage) ? "done" : "pending"),
      detailFn: (i) => i.deliveredDate ? `Delivered ${i.deliveredDate}` : "Signed DR confirms delivery" },
    { key: "invoiced",   label: "Invoiced",               matches: (i) => (i.invoiceNo && i.stage !== "paid") ? "current" : (i.stage === "paid" ? "done" : "pending"),
      detailFn: (i) => i.invoiceNo ? `${i.invoiceNo}${i.invoiceDueDate ? ` · due ${i.invoiceDueDate}` : ""}` : "Invoice will be issued" },
    { key: "paid",       label: "Payment Cleared",        matches: (i) => i.stage === "paid" ? "done" : "pending",
      detailFn: (i) => i.paidAt ? `Cleared ${new Date(i.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "Account fully settled" },
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
    case "po":                 return { label: "PO Submitted ✅",      bg: "#DCFCE7", fg: "#15803D" };
    case "jo":                 return { label: "JO Created",          bg: "#FEE2E2", fg: "#991B1B" };
    case "in_production":      return inq.paused
      ? { label: "On Hold",                                            bg: "#FEF3C7", fg: "#92400E" }
      : { label: "In Production",                                      bg: "#DBEAFE", fg: "#1D4ED8" };
    case "quality_inspection": return { label: "Quality Inspection",   bg: "#EDE9FE", fg: "#6D28D9" };
    case "ready_for_dispatch": return { label: "Ready for Dispatch",   bg: "#FFE4E6", fg: "#9F1239" };
    case "delivered":          return { label: "Delivered",            bg: "#CCFBF1", fg: "#0F766E" };
    case "paid":               return { label: "Paid & Closed",        bg: "#DCFCE7", fg: "#15803D" };
    case "overdue":             return { label: "⚠️ Overdue",          bg: "#FEE2E2", fg: "#C8102E" };
    default:                   return { label: inq.stage,              bg: "#E2E8F0", fg: "#475569" };
  }
}

function StatusTab({ clientName }: { clientName: string }) {
  const { byClient } = useOrders();
  const [showJO, setShowJO] = useState(false);

  /* DERIVED: pull this client's inquiries, exclude paid + cancelled, map to ActiveOrder timelines */
  const myInquiries = byClient(clientName).filter((i) => !i.archived && i.stage !== "paid");
  const activeOrders = myInquiries.map(inquiryToActiveOrder);
  const [expandedPO, setExpandedPO] = useState<string | null>(activeOrders[0]?.po ?? null);

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

      {activeOrders.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center font-dm" style={{ fontSize: 13, color: "#94A3B8" }}>
          ✅ All your orders are fully paid and archived. Submit a new inquiry to track progress here.
        </div>
      ) : activeOrders.map((order, idx) => {
        const expanded = expandedPO === order.po;
        const currentStep = order.steps.find(s => s.state === "current");
        /* Section F — JO exists only once the inquiry reaches the "jo" stage or later. */
        const inq = myInquiries[idx];
        const hasJO = !!inq && (["jo", "in_production", "quality_inspection", "ready_for_dispatch", "dispatched", "delivered", "paid", "overdue"] as const).includes(inq.stage as any);
        return (
          <CollapsibleStatusCard
            key={order.po}
            order={order}
            expanded={expanded}
            onToggle={() => setExpandedPO(expanded ? null : order.po)}
            onViewJO={() => setShowJO(true)}
            currentStep={currentStep}
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

function CollapsibleStatusCard({ order, expanded, onToggle, onViewJO, currentStep, hasJO }: {
  order: ActiveOrder;
  expanded: boolean;
  onToggle: () => void;
  onViewJO: () => void;
  currentStep?: Step;
  hasJO?: boolean;
}) {
  const stepCount = order.steps.length;
  const doneCount = order.steps.filter(s => s.state === "done").length;
  const pct = Math.round((doneCount / stepCount) * 100);
  return (
    <article className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      {/* Compact header (always visible) */}
      <button onClick={onToggle} className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <span className="font-mono-jb" style={{ fontSize: 14, fontWeight: 700, color: "#1A2B4A" }}>{order.po}</span>
          <div className="hidden md:block w-px h-6 bg-slate-200" />
          <div className="min-w-0 flex-1">
            <div className="font-syne truncate" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{order.product}</div>
            <div className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>Qty {order.qty} · {currentStep?.label ?? order.badge.label}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Inline progress bar */}
          <div className="hidden lg:flex flex-col items-end gap-1">
            <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: 0.4, textTransform: "uppercase" }}>{doneCount} of {stepCount} stages</div>
            <div className="w-32 h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: "#16A34A" }} />
            </div>
          </div>
          <span className="font-dm px-2.5 py-1 rounded-full" style={{ fontSize: 11, fontWeight: 600, backgroundColor: order.badge.bg, color: order.badge.fg }}>{order.badge.label}</span>
          <span className="text-slate-400" style={{ fontSize: 18 }}>{expanded ? "▴" : "▾"}</span>
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
type DeliveryMethod = "Company Vehicle" | "Lalamove" | "Client Pick-up";
interface LogisticsRow {
  po: string; item: string; qty: number; method: DeliveryMethod;
  status: "Pending" | "In Transit" | "Delivered";
  statusBg: string; statusFg: string;
  trackingNumber?: string; hasSignedDR?: boolean;
  driverName?: string; estimatedDate?: string;
  dateISO?: string;
}

/* DERIVED: build a LogisticsRow from a store inquiry. Status maps cleanly off the inquiry stage. */
function inquiryToLogisticsRow(inq: Inquiry): LogisticsRow {
  const method: DeliveryMethod = (inq.deliveryMethod ?? "Company Vehicle") as DeliveryMethod;
  const isDelivered = inq.stage === "delivered" || inq.stage === "paid" || inq.stage === "overdue";
  const isInTransit = inq.stage === "ready_for_dispatch" && !!inq.trackingRef;
  const status = isDelivered ? "Delivered" : isInTransit ? "In Transit" : "Pending";
  const statusBg = isDelivered ? "#DCFCE7" : isInTransit ? "#DBEAFE" : "#E2E8F0";
  const statusFg = isDelivered ? "#15803D" : isInTransit ? "#1D4ED8" : "#475569";
  const firstProduct = inq.products[0];
  const item = firstProduct?.product ?? "—";
  const qty = inq.products.reduce((s, p) => s + p.quantity, 0);
  const dateISO = inq.deliveredDate ?? inq.dueDate ?? inq.submittedDate;
  return {
    po: inq.code,
    item,
    qty,
    method,
    status: status as any,
    statusBg,
    statusFg,
    hasSignedDR: !!inq.drFileName,
    driverName: method === "Company Vehicle" ? "D. Santos" : undefined,
    estimatedDate: inq.deliveredDate ?? inq.dueDate ?? "—",
    trackingNumber: inq.trackingRef,
    dateISO,
  };
}

function LogisticsTab({ clientName }: { clientName: string }) {
  const { byClient } = useOrders();
  /* Section H — client contact pulled from settings (email only, no phone). */
  const { settings } = useSettings();
  const [filter, setFilter] = useState("All");
  const [expandedPo, setExpandedPo] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "status">("date-desc");
  const filters = ["All", "Pending", "In Transit", "Delivered"];

  /* DERIVED: this client's inquiries that have entered the logistics phase (jo onward) — exclude inquiry/quotation/po stages */
  const myInquiries = byClient(clientName).filter((i) =>
    !i.archived && ["in_production", "quality_inspection", "ready_for_dispatch", "delivered", "paid", "overdue"].includes(i.stage)
  );
  const rows: LogisticsRow[] = myInquiries.map(inquiryToLogisticsRow);

  const methodIcon = (m: DeliveryMethod) => m === "Company Vehicle" ? Building2 : m === "Lalamove" ? Truck : UserIcon;
  const methodColor = (m: DeliveryMethod) => m === "Company Vehicle" ? "#1A2B4A" : m === "Lalamove" ? "#7C3AED" : "#0D9488";

  let visible = filter === "All" ? rows : rows.filter((r) => r.status === filter);
  visible = visible.filter((r) => {
    if (dateFrom && (r.dateISO ?? "") < dateFrom) return false;
    if (dateTo && (r.dateISO ?? "") > dateTo) return false;
    return true;
  });
  visible = [...visible].sort((a, b) => {
    if (sortBy === "date-desc") return (b.dateISO ?? "").localeCompare(a.dateISO ?? "");
    if (sortBy === "date-asc")  return (a.dateISO ?? "").localeCompare(b.dateISO ?? "");
    return a.status.localeCompare(b.status);
  });

  return (
    <div className="px-8 py-8 flex flex-col gap-6">
      <div>
        <h1 className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>My Deliveries</h1>
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
          const isExpanded = expandedPo === r.po;
          const Icon = methodIcon(r.method);
          return (
            <div key={r.po} className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
              {/* Row Header */}
              <button
                onClick={() => setExpandedPo(isExpanded ? null : r.po)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 text-left"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#F1F5F9" }}>
                  <Icon size={18} style={{ color: methodColor(r.method) }} />
                </div>
                <div className="flex-1 grid grid-cols-4 gap-3 items-center">
                  <div>
                    <div className="font-mono-jb" style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}>{r.po}</div>
                    <div className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>{r.item} · Qty {r.qty}</div>
                  </div>
                  <div className="font-dm" style={{ fontSize: 13, color: methodColor(r.method), fontWeight: 600 }}>{r.method}</div>
                  <span className="font-dm px-2.5 py-1 rounded-full justify-self-start" style={{ fontSize: 11, fontWeight: 600, backgroundColor: r.statusBg, color: r.statusFg }}>{r.status}</span>
                  <div className="flex justify-end">
                    {isExpanded ? <ChevronUp size={16} style={{ color: "#64748B" }} /> : <ChevronDown size={16} style={{ color: "#64748B" }} />}
                  </div>
                </div>
              </button>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="px-5 py-5 border-t border-slate-200" style={{ backgroundColor: "#FAFBFC" }}>
                  {r.method === "Company Vehicle" && (
                    <div className="flex flex-col gap-3">
                      <div className="font-syne mb-1" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Company Vehicle Delivery</div>
                      <div className="grid grid-cols-2 gap-3">
                        <InfoPair label="Enter-Fil Contact" value={settings.email} />
                        <InfoPair label="Driver" value={r.driverName ?? "—"} />
                        <InfoPair label="Estimated Delivery" value={r.estimatedDate ?? "—"} />
                        <InfoPair label="Signed DR" value={r.hasSignedDR ? "Available" : "Not yet uploaded"} />
                      </div>
                      {r.hasSignedDR && (
                        <button onClick={() => toast("Opening signed DR photo...")} className="self-start font-dm px-4 py-2 rounded-md border border-slate-200 hover:bg-white flex items-center gap-2" style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}>
                          📸 View Signed DR Photo
                        </button>
                      )}
                    </div>
                  )}

                  {r.method === "Lalamove" && (
                    <div className="flex flex-col gap-3">
                      <div className="font-syne mb-1" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Lalamove Delivery</div>
                      <div className="grid grid-cols-2 gap-3">
                        <InfoPair label="Tracking Number" value={r.trackingNumber ?? "—"} />
                        <InfoPair label="Enter-Fil Contact" value={settings.email} />
                      </div>
                      {r.trackingNumber && (
                        <button
                          onClick={() => window.open("https://www.lalamove.com", "_blank")}
                          className="self-start font-dm px-4 py-2 rounded-md text-white flex items-center gap-2 hover:opacity-90"
                          style={{ backgroundColor: "#7C3AED", fontSize: 12, fontWeight: 700 }}
                        >
                          <ExternalLink size={13} /> 🔗 Track on Lalamove
                        </button>
                      )}
                      <div className="rounded-md px-3 py-2 font-dm" style={{ fontSize: 12, color: "#92400E", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
                        For live tracking, use the Lalamove app with tracking number <span style={{ fontWeight: 700 }}>{r.trackingNumber}</span>.
                      </div>
                    </div>
                  )}

                  {r.method === "Client Pick-up" && (
                    <div className="flex flex-col gap-3">
                      <div className="font-syne mb-1" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Client Pick-up Instructions</div>
                      <div className="rounded-lg p-4 flex flex-col gap-2" style={{ backgroundColor: "#F4F6F9", border: "1px solid #E2E8F0" }}>
                        <div className="font-dm" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>📍 Enter-Fil Industrial Products</div>
                        <div className="font-dm" style={{ fontSize: 13, color: "#475569" }}>123 Industrial Ave., Valenzuela City, Metro Manila 1440</div>
                        <div className="font-dm" style={{ fontSize: 13, color: "#475569" }}>✉️ {settings.email}</div>
                        <div className="font-dm" style={{ fontSize: 13, color: "#475569" }}>🕐 Mon–Sat, 8:00 AM – 5:00 PM</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => window.open("https://www.google.com/maps/search/Enter-Fil+Industrial+Products", "_blank")}
                          className="font-dm px-4 py-2 rounded-md border border-slate-200 hover:bg-white flex items-center gap-2"
                          style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}
                        >
                          🗺 Get Directions
                        </button>
                      </div>
                      <div className="rounded-md px-3 py-2 font-dm" style={{ fontSize: 12, color: "#92400E", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
                        Please bring valid ID upon pick-up.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-lg p-4 flex items-start gap-3" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
        <Info size={16} style={{ color: "#D97706", marginTop: 2 }} />
        <span className="font-dm" style={{ fontSize: 13, color: "#92400E" }}>
          For Lalamove deliveries, tracking is done through the Lalamove app. Contact us for the tracking link.
        </span>
      </div>
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
  const amount = inq.invoiceAmount ?? inq.quotedTotal ?? 0;
  const isPaid = inq.stage === "paid";
  return {
    id: inq.id,
    inv: inq.invoiceNo ?? `SI-${inq.code.replace("PO-", "")}`,
    po: inq.code,
    item: inq.products[0]?.product ?? "—",
    amount,
    payment: inq.paymentTerms,
    due: inq.invoiceDueDate ?? "—",
    status: (isPaid ? "paid" : "pending") as "paid" | "pending",
    paidDate: inq.paidAt ?? "",
    confirmedPayments: inq.confirmedPayments ?? [],
  };
}

/* ---------- Accounting Tab ---------- */
function ClientAccountingTab({ clientName }: { clientName: string }) {
  const { byClient, addClientReceipt } = useOrders();
  /* Section M — payment instructions come from the Settings store, not hardcoded */
  const { settings } = useSettings();
  const bank = settings.bankDetails;
  const { push: pushNotif } = useNotifications();
  const [receiptForm, setReceiptForm] = useState<Record<string, { amount: string; note: string; file: string; methodId?: string }>>({});
  const [view, setView] = useState<"active" | "history">("active");

  /* DERIVED: pull this client's invoiced inquiries (delivered / overdue / paid). PO/quotation/in-production aren't yet billable. */
  const myInvoiced = byClient(clientName).filter((i) =>
    !i.archived && ["delivered", "overdue", "paid"].includes(i.stage)
  );
  const rows = myInvoiced.map(inquiryToClientInvoice);

  const activeRows = rows.filter(r => r.status === "pending");
  const historyRows = rows.filter(r => r.status === "paid");
  const visibleRows = view === "active" ? activeRows : historyRows;

  const [openId, setOpenId] = useState<string | null>(activeRows[0]?.id ?? null);

  const submitReceipt = (rowId: string, invNo: string) => {
    const f = receiptForm[rowId];
    if (!f?.file) { toast.error("Please attach a receipt file first"); return; }
    const amt = parseFloat(f.amount);
    if (isNaN(amt) || amt <= 0) { toast.error("Please enter the amount paid"); return; }
    /* Link to the specific inquiry being paid */
    addClientReceipt(rowId, {
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      filename: f.file,
      amount: amt,
      note: f.note || invNo,
    });
    pushNotif({
      dept: "payments",
      title: `Receipt uploaded by ${clientName}`,
      body: `${invNo} · ₱${amt.toLocaleString("en-PH")}${f.note ? ` · ${f.note}` : ""}`,
      link: "accounting",
      recipients: ["owner", "operations", "accounting"],
    });
    toast.success("Receipt sent to Enter-Fil", { description: "The secretary will verify and update your account." });
    setReceiptForm((prev) => ({ ...prev, [rowId]: { amount: "", note: "", file: "", methodId: settings.paymentMethods[0]?.id } }));
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
        {pill("Amount Due", `₱${activeRows.reduce((s, r) => s + r.amount - r.confirmedPayments.reduce((p, c) => p + c.amount, 0), 0).toLocaleString("en-PH")}`, "#C8102E")}
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
              const isPending = r.status === "pending";
              const confirmed = r.confirmedPayments;
              const totalConfirmed = confirmed.reduce((s, p) => s + p.amount, 0);
              const remaining = r.amount - totalConfirmed;
              const isPartial = isPending && totalConfirmed > 0;
              const s = isPartial
                ? { bg: "#DBEAFE", fg: "#1D4ED8", label: "Partial" }
                : isPending
                ? { bg: "#FEF3C7", fg: "#B45309", label: "Pending" }
                : { bg: "#DCFCE7", fg: "#15803D", label: "Paid" };
              const rf = receiptForm[r.id] ?? { amount: "", note: "", file: "", methodId: settings.paymentMethods[0]?.id };
              const selectedMethod = settings.paymentMethods.find((m) => m.id === rf.methodId) ?? settings.paymentMethods[0];
              return (
                <Fragment key={r.id}>
                  <tr className="border-t border-slate-200/70 hover:bg-slate-50" style={{ cursor: isPending ? "pointer" : "default" }} onClick={() => isPending && setOpenId(isOpen ? null : r.id)}>
                    <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}>{r.inv}</td>
                    <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, color: "#475569" }}>{r.po}</td>
                    <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#0F172A" }}>{r.item}</td>
                    <td className="px-4 py-3 font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>
                      ₱{r.amount.toLocaleString("en-PH")}
                      {isPartial && (
                        <div className="font-dm" style={{ fontSize: 11, fontWeight: 500, color: "#1D4ED8" }}>
                          ₱{totalConfirmed.toLocaleString("en-PH")} paid · ₱{remaining.toLocaleString("en-PH")} left
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{r.payment}</td>
                    <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: isPending ? "#D97706" : "#475569", fontWeight: isPending ? 600 : 400 }}>{view === "history" ? r.paidDate : r.due}</td>
                    <td className="px-4 py-3"><span className="font-dm px-2.5 py-1 rounded-full" style={{ fontSize: 11, fontWeight: 600, backgroundColor: s.bg, color: s.fg }}>{s.label}</span></td>
                  </tr>
                  {isOpen && isPending && (
                    <tr style={{ backgroundColor: "#FAFBFC" }}>
                      <td colSpan={7} className="px-6 py-5">
                        <div className="grid grid-cols-2 gap-6">
                          {/* Payment instructions + confirmed ledger */}
                          <div>
                            <div className="font-syne mb-3" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Payment Status</div>
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
                            <div className="font-syne mb-3" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Already paid? Send your receipt:</div>
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
                                      if (f) setReceiptForm(p => ({ ...p, [r.id]: { ...rf, file: f.name } }));
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
                                <Send size={14} strokeWidth={2.5} /> Send Receipt to Enter-Fil
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
  const [companyName, setCompanyName] = useState(clientName);
  const [industry, setIndustry] = useState("Aerospace");
  const [address1, setAddress1] = useState("Clark Freeport");
  const [address2, setAddress2] = useState("");
  const [cityProvince, setCityProvince] = useState("Pampanga");
  const [zip, setZip] = useState("2009");
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

  const save = () => toast.success("Settings saved", { description: "Your company information has been updated." });

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
  return (
    <Shell active={tab} onChange={setTab} clientName={clientName} onLogout={onLogout}>
      {tab === "orders" && <OrdersTab clientName={clientName} onSubmitted={() => setTab("status")} />}
      {tab === "status" && <StatusTab clientName={clientName} />}
      {tab === "logistics" && <LogisticsTab clientName={clientName} />}
      {tab === "accounting" && <ClientAccountingTab clientName={clientName} />}
      {tab === "settings" && <SettingsTab clientName={clientName} />}
    </Shell>
  );
}
