import { Fragment, useState } from "react";
import {
  ClipboardList, MapPin, Truck, CreditCard, Upload, CheckCircle2, Circle,
  Building2, User as UserIcon, Info, Camera, Send, Plus, Trash2, ChevronDown,
  ChevronUp, FileCheck, X, Settings, ExternalLink,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { useOrders, unitPrice, quotationTotal, type Inquiry, type ProductLine } from "../store/orders";
import { useNotifications } from "../store/notifications";
import { NotificationBell } from "./NotificationBell";
import { JOTemplateModal, type JOTemplateData } from "./JOTemplateModal";

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
  id, type: "Air Filter", od1: "", od2: "", id1: "", id2: "", height: "",
  media: "", innerCore: "", outerCore: "", oring: "", gasket: "", oem: "",
  qty: 10, notes: "",
});

const completedJobOrders = [
  { jo: "JO-2026-001", date: "Mar 31, 2026", po: "PO-2026-9901", item: "Air Filter 115×103×500mm", qty: 50, status: "Delivered", specs: { type: "Air Filter", od1: "115", id1: "103", height: "500", media: "Microglass Fiber", innerCore: "Expanded Metal Perfo 2mm", oem: "KF-OS.107.65.252", qty: 50 } },
  { jo: "JO-2025-082", date: "Feb 14, 2026", po: "PO-2026-9805", item: "Oil Separator Filter", qty: 20, status: "Delivered", specs: { type: "Oil Separator", od1: "200", id1: "108", height: "160", media: "Microglass Fiber", innerCore: "Perfo Steel 2mm", oem: "KF-OS.200/167.108.160", qty: 20 } },
];

const FILTER_TYPES = [
  { id: "Air Filter",       icon: "💨", desc: "General air filtration" },
  { id: "Oil Filter",       icon: "🛢️", desc: "Lubricant filtration" },
  { id: "Oil Separator",    icon: "⚙️", desc: "Air/oil separation" },
  { id: "Water Filter",     icon: "💧", desc: "Water purification" },
  { id: "Industrial",       icon: "🏭", desc: "Heavy-duty industrial" },
  { id: "Custom",           icon: "🛠️", desc: "Bring your own specs" },
];

const FILTRATION_RATINGS = [
  { value: "1-micron",   label: "1 micron",   desc: "Ultra-fine · pharmaceutical grade" },
  { value: "5-micron",   label: "5 micron",   desc: "Fine · standard industrial" },
  { value: "10-micron",  label: "10 micron",  desc: "Medium · most common" },
  { value: "25-micron",  label: "25 micron",  desc: "Coarse · heavy particulates" },
  { value: "50-micron",  label: "50 micron",  desc: "Very coarse · pre-filter" },
  { value: "custom",     label: "Custom / Other", desc: "Specify in notes" },
];

function OrdersTab({ clientName, onSubmitted }: { clientName: string; onSubmitted: () => void }) {
  const { addInquiry, byClient, uploadPO, cancelInquiry, reorderToProduction } = useOrders();
  const { push: pushNotif } = useNotifications();
  const clientInqs = byClient(clientName);
  const myOrders = byClient(clientName);

  /* Wizard state */
  const [step, setStep] = useState(1);
  const [contactPerson, setContactPerson] = useState("");
  const [paymentTerms, setPaymentTerms] = useState<"COD" | "15-Day Terms" | "30-Day Terms">("30-Day Terms");
  const [generalNotes, setGeneralNotes] = useState("");
  const [filterType, setFilterType] = useState("Air Filter");
  const [od1, setOd1] = useState(""); const [od2, setOd2] = useState("");
  const [id1, setId1] = useState(""); const [id2, setId2] = useState("");
  const [height, setHeight] = useState("");
  const [media, setMedia] = useState("");
  const [filtrationRating, setFiltrationRating] = useState("10-micron");
  const [innerCore, setInnerCore] = useState("");
  const [outerCore, setOuterCore] = useState("");
  const [oring, setOring] = useState("");
  const [gasket, setGasket] = useState("");
  const [oem, setOem] = useState("");
  const [qty, setQty] = useState(10);
  const [poForId, setPoForId] = useState<string | null>(null);
  const [sketchFile, setSketchFile] = useState<File | null>(null);
  const [isRush, setIsRush] = useState(false);
  const [rushDate, setRushDate] = useState("");
  /* Reorder review-and-modify modal */
  const [reorderRow, setReorderRow] = useState<typeof completedJobOrders[0] | null>(null);

  const STEPS = [
    { num: 1, label: "Filter Type", icon: "🎯" },
    { num: 2, label: "Dimensions & Material", icon: "📐" },
    { num: 3, label: "Filtration Rating", icon: "🔬" },
    { num: 4, label: "Add-ons", icon: "⚙️" },
    { num: 5, label: "Review", icon: "✅" },
  ];

  const canProceed = () => {
    if (step === 1) return !!filterType;
    if (step === 2) return od1.trim().length > 0 && height.trim().length > 0 && media.trim().length > 0;
    if (step === 3) return !!filtrationRating;
    if (step === 4) return qty >= 10;
    return true;
  };

  const submit = () => {
    if (!contactPerson.trim()) { toast.error("Contact person required"); return; }
    if (qty < 10) { toast.error("Minimum order quantity is 10 pcs"); return; }
    if (isRush && !rushDate.trim()) { toast.error("Please specify your required delivery date for rush orders"); return; }
    const product: ProductLine = {
      id: "p1", type: filterType, od1, od2, id1, id2, height,
      media, innerCore, outerCore, oring, gasket, oem, qty,
      notes: filtrationRating === "custom" ? `Custom filtration · ${generalNotes}` : `Filtration: ${filtrationRating} · ${generalNotes}`,
    };
    const code = addInquiry({
      clientName, contactPerson, paymentTerms, generalNotes,
      products: [product],
      urgent: isRush,
      dueDate: isRush ? rushDate : undefined,
      inquirySketch: sketchFile?.name,
    });
    pushNotif({
      dept: "sales",
      title: `New inquiry from ${clientName}${isRush ? " 🚨 RUSH" : ""}`,
      body: `${code} · ${filterType} · ${qty} pcs · ${filtrationRating} · ${isRush ? `Required by ${rushDate}` : "Standard"}`,
      link: "sales",
      recipients: ["owner", "operations", "sales"],
    });
    toast.success(isRush ? "🚨 Rush inquiry submitted" : "Inquiry submitted", { description: `${code} sent — we'll respond within 1 business day` });
    /* reset */
    setStep(1); setContactPerson(""); setGeneralNotes("");
    setOd1(""); setOd2(""); setId1(""); setId2(""); setHeight("");
    setMedia(""); setFiltrationRating("10-micron");
    setInnerCore(""); setOuterCore(""); setOring(""); setGasket(""); setOem("");
    setQty(10); setSketchFile(null); setIsRush(false); setRushDate("");
    onSubmitted();
  };

  return (
    <div className="px-8 py-8 grid gap-6" style={{ gridTemplateColumns: "5fr 6fr" }}>
      <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
        {/* Wizard header */}
        <div className="px-6 py-5 border-b border-slate-200" style={{ backgroundColor: "#1A2B4A" }}>
          <h2 className="font-syne text-white" style={{ fontSize: 18, fontWeight: 700 }}>New Order Inquiry</h2>
          <p className="font-dm text-white/60 mt-0.5" style={{ fontSize: 12 }}>Step {step} of 5 — {STEPS[step - 1].label}</p>
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
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center font-syne"
                    style={{
                      fontSize: 12, fontWeight: 800,
                      backgroundColor: s.num === step ? "#C8102E" : s.num < step ? "#16A34A" : "#E2E8F0",
                      color: s.num <= step ? "white" : "#94A3B8",
                    }}
                  >
                    {s.num < step ? "✓" : s.num}
                  </span>
                  <span className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: s.num === step ? "#C8102E" : s.num < step ? "#15803D" : "#94A3B8", letterSpacing: 0.3 }}>
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && <div className="flex-1 h-0.5" style={{ backgroundColor: i < step - 1 ? "#16A34A" : "#E2E8F0" }} />}
              </Fragment>
            ))}
          </div>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Common header info — collapsed on later steps */}
          {step === 1 && (
            <div className="rounded-lg p-4 grid grid-cols-2 gap-3" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <Field label="Company"><input value={clientName} disabled className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 bg-slate-100" style={{ fontSize: 13, color: "#475569" }} /></Field>
              <Field label="Contact Person *"><input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Full name" className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} /></Field>
              <Field label="Payment Terms">
                <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value as any)} className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }}>
                  <option>COD</option><option>15-Day Terms</option><option>30-Day Terms</option>
                </select>
              </Field>
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Notes <span style={{ color: "#94A3B8", fontWeight: 400 }}>(optional)</span></label>
                <textarea value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} placeholder="Special instructions, brand references..." rows={2} className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white resize-none" style={{ fontSize: 13 }} />
              </div>
            </div>
          )}

          {/* STEP 1 — Filter Type (with custom multi-select for dual/triple) */}
          {step === 1 && (
            <div>
              <div className="font-dm mb-3" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>What type of filter do you need?</div>
              <div className="grid grid-cols-3 gap-3">
                {FILTER_TYPES.map((f) => {
                  const isCustom = f.id === "Custom";
                  const active = isCustom ? filterType.startsWith("Custom") : filterType === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setFilterType(isCustom ? "Custom" : f.id)}
                      className="rounded-lg p-3 flex flex-col items-start gap-1 text-left transition-all"
                      style={{
                        border: active ? "2px solid #C8102E" : "1px solid #E2E8F0",
                        backgroundColor: active ? "#FEF2F2" : "white",
                        padding: active ? 11 : 12,
                      }}
                    >
                      <span style={{ fontSize: 22 }}>{f.icon}</span>
                      <span className="font-dm" style={{ fontSize: 13, fontWeight: 700, color: active ? "#C8102E" : "#0F172A" }}>{f.id}</span>
                      <span className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>{f.desc}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom multi-select picker */}
              {filterType.startsWith("Custom") && (
                <div className="mt-4 rounded-lg p-4" style={{ backgroundColor: "#FFFBEB", border: "1.5px solid #FDE68A" }}>
                  <div className="font-dm mb-2" style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>🛠️ Custom — combine multiple filter functions</div>
                  <p className="font-dm mb-3" style={{ fontSize: 11, color: "#B45309" }}>Some filters serve dual or three-in-one purposes. Pick all that apply:</p>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {["Air", "Oil", "Oil Separator", "Water", "Coolant", "Hydraulic", "Industrial", "Pleated"].map((cat) => {
                      const tags = filterType.replace(/^Custom\s*/, "").replace(/^[(\s]+|[)\s]+$/g, "").split(/\s*\+\s*/).filter(Boolean);
                      const selected = tags.includes(cat);
                      return (
                        <label key={cat} className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer" style={{ border: selected ? "1.5px solid #C8102E" : "1px solid #FCD34D", backgroundColor: selected ? "#FEF2F2" : "white" }}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => {
                              const next = selected ? tags.filter(t => t !== cat) : [...tags, cat];
                              setFilterType(next.length > 0 ? `Custom (${next.join(" + ")})` : "Custom");
                            }}
                            style={{ accentColor: "#C8102E" }}
                          />
                          <span className="font-dm" style={{ fontSize: 12, color: "#0F172A", fontWeight: selected ? 700 : 500 }}>{cat}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="font-dm rounded-md px-3 py-2" style={{ fontSize: 11, color: "#92400E", backgroundColor: "#FEF3C7", border: "1px dashed #FBBF24" }}>
                    Selected: <span className="font-mono-jb" style={{ fontWeight: 700 }}>{filterType}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2 — Dimensions & Material */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div>
                <div className="font-dm mb-3" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Dimensions <span style={{ fontWeight: 400, color: "#94A3B8" }}>(in mm)</span></div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="OD 1 *"><input value={od1} onChange={(e) => setOd1(e.target.value)} type="number" className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} /></Field>
                  <Field label="OD 2"><input value={od2} onChange={(e) => setOd2(e.target.value)} type="number" className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} /></Field>
                  <Field label="ID 1"><input value={id1} onChange={(e) => setId1(e.target.value)} type="number" className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} /></Field>
                  <Field label="ID 2"><input value={id2} onChange={(e) => setId2(e.target.value)} type="number" className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} /></Field>
                  <Field label="Height *"><input value={height} onChange={(e) => setHeight(e.target.value)} type="number" className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} /></Field>
                </div>
              </div>
              <div>
                <div className="font-dm mb-2" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Filter Media *</div>
                <input value={media} onChange={(e) => setMedia(e.target.value)} placeholder="e.g. Microglass Fiber, Pleated ZS20, Cellulose, Stainless mesh..." className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
              </div>
            </div>
          )}

          {/* STEP 3 — Filtration Rating */}
          {step === 3 && (
            <div>
              <div className="font-dm mb-3" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>What filtration rating do you need?</div>
              <div className="grid grid-cols-2 gap-3">
                {FILTRATION_RATINGS.map((r) => {
                  const active = filtrationRating === r.value;
                  return (
                    <button
                      key={r.value}
                      onClick={() => setFiltrationRating(r.value)}
                      className="rounded-lg p-3 flex flex-col items-start gap-0.5 text-left transition-all"
                      style={{
                        border: active ? "2px solid #C8102E" : "1px solid #E2E8F0",
                        backgroundColor: active ? "#FEF2F2" : "white",
                        padding: active ? 11 : 12,
                      }}
                    >
                      <span className="font-syne" style={{ fontSize: 14, fontWeight: 700, color: active ? "#C8102E" : "#0F172A" }}>{r.label}</span>
                      <span className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>{r.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4 — Add-ons */}
          {step === 4 && (
            <div className="flex flex-col gap-4">
              <div>
                <div className="font-dm mb-3" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Quantity *</div>
                <input type="number" min={10} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-full font-syne px-4 py-3 rounded-md border-2 border-slate-300 outline-none focus:border-slate-500 bg-white" style={{ fontSize: 24, fontWeight: 800, color: "#0F172A" }} />
                <div className="font-dm mt-1" style={{ fontSize: 11, color: qty < 10 ? "#C8102E" : "#94A3B8" }}>{qty < 10 ? "⚠️ Minimum order quantity is 10 pcs" : "Minimum 10 pcs"}</div>
              </div>
              <div>
                <div className="font-dm mb-2" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Optional components</div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Inner Core"><input value={innerCore} onChange={(e) => setInnerCore(e.target.value)} placeholder="e.g. Perforated 2mm" className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} /></Field>
                  <Field label="Outer Core"><input value={outerCore} onChange={(e) => setOuterCore(e.target.value)} placeholder="Optional" className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} /></Field>
                  <Field label="O-Ring"><input value={oring} onChange={(e) => setOring(e.target.value)} placeholder="Optional" className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} /></Field>
                  <Field label="Gasket"><input value={gasket} onChange={(e) => setGasket(e.target.value)} placeholder="Optional" className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} /></Field>
                  <Field label="OEM Reference"><input value={oem} onChange={(e) => setOem(e.target.value)} placeholder="e.g. KF-OS.107.65.252" className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} /></Field>
                </div>
              </div>
              {/* Sketch */}
              <div className="rounded-lg p-3" style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#1E3A8A", letterSpacing: 0.4, textTransform: "uppercase" }}>📎 Engineer Sketch (Optional)</div>
                {sketchFile ? (
                  <div className="flex items-center gap-3 bg-white rounded-md px-3 py-2 border border-blue-200">
                    <FileCheck size={14} style={{ color: "#2563EB" }} />
                    <span className="font-dm flex-1" style={{ fontSize: 12, color: "#0F172A", fontWeight: 600 }}>{sketchFile.name}</span>
                    <button onClick={() => setSketchFile(null)} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setSketchFile(f); }} />
                    <span className="flex items-center gap-2 px-3 py-2 rounded-md font-dm hover:bg-blue-100" style={{ fontSize: 12, fontWeight: 600, color: "#1D4ED8", border: "1.5px dashed #93C5FD" }}>
                      <Camera size={13} /> Browse JPG / PNG / PDF
                    </span>
                  </label>
                )}
              </div>
              {/* Rush */}
              <div className="rounded-lg p-3" style={{ backgroundColor: isRush ? "#FEF2F2" : "#F8FAFC", border: isRush ? "1.5px solid #FECACA" : "1px solid #E2E8F0" }}>
                <label className="flex items-center gap-3 cursor-pointer" onClick={() => setIsRush(r => !r)}>
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
                    <p className="font-dm" style={{ fontSize: 11, color: "#C8102E" }}>Confirmation within 4 hours via Viber or email.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5 — Review */}
          {step === 5 && (
            <div className="flex flex-col gap-3">
              <div className="font-dm mb-1" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Review your order before submitting</div>
              <div className="rounded-lg p-4 grid grid-cols-2 gap-y-2 gap-x-4" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                <ReviewLine label="Filter Type" value={filterType} />
                <ReviewLine label="Filtration Rating" value={FILTRATION_RATINGS.find(r => r.value === filtrationRating)?.label ?? filtrationRating} />
                <ReviewLine label="OD 1" value={od1 ? `${od1}mm` : "—"} />
                <ReviewLine label="OD 2" value={od2 ? `${od2}mm` : "—"} />
                <ReviewLine label="ID 1" value={id1 ? `${id1}mm` : "—"} />
                <ReviewLine label="ID 2" value={id2 ? `${id2}mm` : "—"} />
                <ReviewLine label="Height" value={height ? `${height}mm` : "—"} />
                <ReviewLine label="Media" value={media} />
                <ReviewLine label="Inner Core" value={innerCore || "—"} />
                <ReviewLine label="Outer Core" value={outerCore || "—"} />
                <ReviewLine label="O-Ring" value={oring || "—"} />
                <ReviewLine label="Gasket" value={gasket || "—"} />
                <ReviewLine label="OEM Ref" value={oem || "—"} />
                <ReviewLine label="Quantity" value={`${qty} pcs`} />
                <ReviewLine label="Payment Terms" value={paymentTerms} />
                <ReviewLine label="Sketch" value={sketchFile?.name ?? "Not attached"} />
                {isRush && <ReviewLine label="🚨 Rush Date" value={rushDate} accent="#C8102E" />}
              </div>
              {!contactPerson.trim() && (
                <div className="rounded-md p-3 font-dm" style={{ fontSize: 12, color: "#991B1B", backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }}>
                  ⚠️ Please add your contact person on Step 1 before submitting.
                </div>
              )}
            </div>
          )}

          {/* Wizard nav */}
          <div className="flex items-center justify-between mt-2">
            <button
              onClick={() => setStep(s => Math.max(1, s - 1))}
              disabled={step === 1}
              className="font-dm px-4 py-2.5 rounded-md hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}
            >
              ← Back
            </button>
            {step < 5 ? (
              <button
                onClick={() => canProceed() ? setStep(s => s + 1) : toast.error("Please complete the required fields")}
                disabled={!canProceed()}
                className="font-dm px-5 py-2.5 rounded-md text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                style={{ backgroundColor: "#1A2B4A", fontSize: 13, fontWeight: 700, letterSpacing: 0.4 }}
              >
                Next: {STEPS[step].label} →
              </button>
            ) : (
              <button
                onClick={submit}
                className="font-dm flex items-center gap-2 px-5 py-2.5 rounded-md text-white hover:opacity-90"
                style={{ backgroundColor: isRush ? "#991B1B" : "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}
              >
                <ClipboardList size={15} strokeWidth={2.5} /> {isRush ? "🚨 Submit Rush Inquiry" : "Submit Inquiry"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="font-syne" style={{ fontSize: 22, fontWeight: 700, color: "#0F172A" }}>My Orders</h2>
        {myOrders.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200/70 p-8 text-center font-dm" style={{ fontSize: 13, color: "#64748B" }}>
            No active orders yet. Submit an inquiry to get started.
          </div>
        )}
        {myOrders.map((inq) => (
          <ClientOrderCard
            key={inq.id}
            inquiry={inq}
            onUploadPO={() => setPoForId(inq.id)}
            onCancel={() => {
              cancelInquiry(inq.id);
              pushNotif({
                dept: "sales",
                title: `Order cancelled by ${clientName}`,
                body: `${inq.code} · ${inq.products[0]?.type ?? ""} · contact client to confirm`,
                link: "sales",
                recipients: ["owner", "operations", "sales"],
              });
            }}
          />
        ))}

        {/* Past Job Orders — with Reorder */}
        <div className="mt-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-syne" style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>My Job Orders</h3>
            <span className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>Click Reorder to duplicate a previous production order</span>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
            <table className="w-full">
              <thead style={{ backgroundColor: "#F4F6F9" }}>
                <tr>
                  {["Job Order", "Date", "Item", "Qty", "Status", ""].map(h => (
                    <th key={h} className="font-dm text-left px-4 py-3" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {completedJobOrders.map((row, i) => (
                  <tr key={i} className="border-t border-slate-200/70 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 11, fontWeight: 700, color: "#1A2B4A" }}>{row.jo}</td>
                    <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>{row.date}</td>
                    <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#0F172A" }}>{row.item}</td>
                    <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{row.qty} pcs</td>
                    <td className="px-4 py-3">
                      <span className="font-dm px-2.5 py-1 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: "#DCFCE7", color: "#15803D" }}>✅ {row.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setReorderRow(row)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-md font-dm hover:opacity-90"
                        style={{ fontSize: 11, fontWeight: 700, backgroundColor: "#C9A84C", color: "white", letterSpacing: 0.3 }}
                      >
                        🔁 Reorder
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transaction History — financial records only, no reorder */}
        <div className="mt-2">
          <h3 className="font-syne mb-3" style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Transaction History</h3>
          <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
            <table className="w-full">
              <thead style={{ backgroundColor: "#F4F6F9" }}>
                <tr>
                  {["Date", "PO No.", "Item", "Amount", "Payment", "Status"].map(h => (
                    <th key={h} className="font-dm text-left px-4 py-3" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { date: "Mar 31, 2026", po: "PO-2026-9901", item: "Air Filter 115×103×500mm (50 pcs)", amount: 78000, payment: "BDO Transfer", status: "Paid" },
                  { date: "Feb 14, 2026", po: "PO-2026-9805", item: "Oil Separator Filter (20 pcs)", amount: 45000, payment: "Cash", status: "Paid" },
                ].map((row, i) => (
                  <tr key={i} className="border-t border-slate-200/70 hover:bg-slate-50">
                    <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>{row.date}</td>
                    <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 11, fontWeight: 600, color: "#1A2B4A" }}>{row.po}</td>
                    <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#0F172A" }}>{row.item}</td>
                    <td className="px-4 py-3 font-syne" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>₱{row.amount.toLocaleString("en-PH")}</td>
                    <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>{row.payment}</td>
                    <td className="px-4 py-3">
                      <span className="font-dm px-2.5 py-1 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: "#DCFCE7", color: "#15803D" }}>✅ {row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {poForId && (
        <POUploadOverlay
          onClose={() => setPoForId(null)}
          onSubmit={(name) => { uploadPO(poForId, name); setPoForId(null); toast.success("Purchase Order submitted ✅", { description: "Management has been notified" }); }}
        />
      )}

      {reorderRow && (
        <ReorderModal
          row={reorderRow}
          clientName={clientName}
          onClose={() => setReorderRow(null)}
          onSubmit={(modified) => {
            const code = addInquiry({
              clientName,
              contactPerson: contactPerson || "—",
              paymentTerms,
              generalNotes: `Reorder of ${reorderRow.jo} · ${modified.notes}`,
              products: [{
                id: "p1", type: modified.type, od1: modified.od1, od2: "", id1: modified.id1, id2: "",
                height: modified.height, media: modified.media, innerCore: modified.innerCore,
                outerCore: "", oring: "", gasket: "", oem: modified.oem, qty: modified.qty,
              }],
              urgent: modified.isRush,
              dueDate: modified.isRush ? modified.rushDate : undefined,
            });
            pushNotif({
              dept: "sales",
              title: `🔁 Reorder from ${clientName}`,
              body: `${code} · based on ${reorderRow.jo} · ${modified.qty} pcs · awaiting validation`,
              link: "sales",
              recipients: ["owner", "operations", "sales"],
            });
            toast.success(`Reorder submitted as ${code}`, { description: "Sent to Sales for confirmation & validation. Track it in My Orders below." });
            setReorderRow(null);
          }}
        />
      )}
    </div>
  );
}

/* ───────── Reorder Review & Modify Modal ───────── */
function ReorderModal({ row, clientName, onClose, onSubmit }: {
  row: typeof completedJobOrders[0];
  clientName: string;
  onClose: () => void;
  onSubmit: (modified: { type: string; od1: string; id1: string; height: string; media: string; innerCore: string; oem: string; qty: number; notes: string; isRush: boolean; rushDate: string }) => void;
}) {
  const s = row.specs;
  const [type, setType] = useState(s.type);
  const [od1, setOd1] = useState(s.od1 ?? "");
  const [id1, setId1] = useState(s.id1 ?? "");
  const [height, setHeight] = useState(s.height ?? "");
  const [media, setMedia] = useState(s.media ?? "");
  const [innerCore, setInnerCore] = useState(s.innerCore ?? "");
  const [oem, setOem] = useState(s.oem ?? "");
  const [qty, setQty] = useState(s.qty ?? 10);
  const [notes, setNotes] = useState("");
  const [isRush, setIsRush] = useState(false);
  const [rushDate, setRushDate] = useState("");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.6)" }} onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl flex flex-col" style={{ boxShadow: "0 24px 48px rgba(0,0,0,0.3)", maxHeight: "90vh" }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between" style={{ backgroundColor: "#FEF3C7" }}>
          <div>
            <h3 className="font-syne flex items-center gap-2" style={{ fontSize: 18, fontWeight: 700, color: "#92400E" }}>🔁 Reorder — Review & Modify</h3>
            <p className="font-dm mt-0.5" style={{ fontSize: 12, color: "#B45309" }}>
              Based on <span className="font-mono-jb" style={{ fontWeight: 700 }}>{row.jo}</span> · {row.item} · You can modify any field before submitting.
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-amber-100 flex items-center justify-center"><X size={16} /></button>
        </div>

        <div className="p-6 overflow-auto flex flex-col gap-4">
          <div className="rounded-md p-3 font-dm" style={{ fontSize: 12, color: "#1E40AF", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
            ℹ️ Reorders go to Sales as a new inquiry for confirmation. Once validated, it'll move into production. You'll see it in <strong>My Orders</strong>.
          </div>
          <div>
            <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.4, textTransform: "uppercase" }}>Product Details</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Filter Type"><input value={type} onChange={(e) => setType(e.target.value)} className="w-full font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} /></Field>
              <Field label="OEM Reference"><input value={oem} onChange={(e) => setOem(e.target.value)} className="w-full font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} /></Field>
              <Field label="OD 1 (mm)"><input value={od1} onChange={(e) => setOd1(e.target.value)} type="number" className="w-full font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} /></Field>
              <Field label="ID 1 (mm)"><input value={id1} onChange={(e) => setId1(e.target.value)} type="number" className="w-full font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} /></Field>
              <Field label="Height (mm)"><input value={height} onChange={(e) => setHeight(e.target.value)} type="number" className="w-full font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} /></Field>
              <Field label="Filter Media"><input value={media} onChange={(e) => setMedia(e.target.value)} className="w-full font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} /></Field>
              <Field label="Inner Core"><input value={innerCore} onChange={(e) => setInnerCore(e.target.value)} className="w-full font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} /></Field>
              <Field label="Quantity (min 10)"><input value={qty} onChange={(e) => setQty(Number(e.target.value))} type="number" min={10} className="w-full font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} /></Field>
            </div>
          </div>
          <Field label="Changes / Notes (optional)">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. increase qty to 100, change filter media, etc." rows={2} className="w-full font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white resize-none" style={{ fontSize: 13 }} />
          </Field>
          <div className="rounded-lg p-3" style={{ backgroundColor: isRush ? "#FEF2F2" : "#F8FAFC", border: isRush ? "1.5px solid #FECACA" : "1px solid #E2E8F0" }}>
            <label className="flex items-center gap-3 cursor-pointer" onClick={() => setIsRush(r => !r)}>
              <div className="w-10 h-6 rounded-full transition-colors flex items-center px-1" style={{ backgroundColor: isRush ? "#C8102E" : "#CBD5E1" }}>
                <div className="w-4 h-4 bg-white rounded-full shadow transition-transform" style={{ transform: isRush ? "translateX(16px)" : "translateX(0)" }} />
              </div>
              <div className="font-dm" style={{ fontSize: 13, fontWeight: 700, color: isRush ? "#C8102E" : "#0F172A" }}>🚨 Mark as Rush</div>
            </label>
            {isRush && (
              <input value={rushDate} onChange={(e) => setRushDate(e.target.value)} placeholder="Required by · e.g. May 5, 2026" className="font-dm px-3 py-2 rounded-md border border-red-200 outline-none focus:border-red-400 bg-white mt-2" style={{ fontSize: 13, width: "100%" }} />
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="font-dm px-4 py-2 rounded-md hover:bg-slate-100" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Cancel</button>
          <button
            onClick={() => {
              if (qty < 10) { toast.error("Minimum order quantity is 10"); return; }
              if (isRush && !rushDate.trim()) { toast.error("Please specify your required delivery date"); return; }
              onSubmit({ type, od1, id1, height, media, innerCore, oem, qty, notes, isRush, rushDate });
            }}
            className="font-dm px-5 py-2.5 rounded-md text-white hover:opacity-90 flex items-center gap-2"
            style={{ backgroundColor: isRush ? "#991B1B" : "#C8102E", fontSize: 13, fontWeight: 700 }}
          >
            <ClipboardList size={14} /> {isRush ? "🚨 Submit Rush Reorder" : "Submit Reorder"}
          </button>
        </div>
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

function ClientOrderCard({ inquiry, onUploadPO, onCancel }: { inquiry: Inquiry; onUploadPO: () => void; onCancel: () => void }) {
  const [open, setOpen] = useState(inquiry.stage === "quotation");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const total = quotationTotal(inquiry);

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
              {inquiry.stage === "quotation" && (
                <div className="flex items-center gap-3">
                  <button onClick={onUploadPO} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-md text-white font-dm hover:opacity-90" style={{ backgroundColor: "#16A34A", fontSize: 13, fontWeight: 700, letterSpacing: 0.4 }}>
                    <FileCheck size={15} strokeWidth={2.5} /> APPROVE &amp; UPLOAD PURCHASE ORDER
                  </button>
                  <button onClick={() => toast("Revision request sent to sales")} className="px-4 py-3 rounded-md font-dm border-2 hover:bg-slate-50" style={{ borderColor: "#1A2B4A", color: "#1A2B4A", fontSize: 13, fontWeight: 700 }}>
                    Request Revision
                  </button>
                </div>
              )}
              {inquiry.stage === "po" && inquiry.poFileName && (
                <div className="rounded-md p-3 font-dm" style={{ backgroundColor: "#DCFCE7", border: "1px solid #86EFAC", fontSize: 13, color: "#166534" }}>
                  ✅ PO submitted: <span style={{ fontWeight: 700 }}>{inquiry.poFileName}</span> — production will begin shortly.
                </div>
              )}
            </div>
          )}

          {/* Cancel order — only before PO is confirmed */}
          {inquiry.stage !== "po" && (
            <div className="pt-3 border-t border-slate-200 mt-2">
              {!confirmCancel ? (
                <button
                  onClick={() => setConfirmCancel(true)}
                  className="font-dm"
                  style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8" }}
                >
                  Cancel this inquiry
                </button>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }}>
                  <span className="font-dm flex-1" style={{ fontSize: 12, color: "#991B1B" }}>Are you sure? This cannot be undone. For further details contact us via Viber or email.</span>
                  <button onClick={() => setConfirmCancel(false)} className="font-dm px-3 py-1.5 rounded-md hover:bg-slate-100" style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>Keep</button>
                  <button
                    onClick={() => { onCancel(); toast.info("Inquiry cancelled", { description: "Management has been notified" }); }}
                    className="font-dm px-3 py-1.5 rounded-md text-white hover:opacity-90"
                    style={{ fontSize: 12, fontWeight: 700, backgroundColor: "#C8102E" }}
                  >
                    Confirm Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function POUploadOverlay({ onClose, onSubmit }: { onClose: () => void; onSubmit: (fileName: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
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
          <button onClick={() => onSubmit(file?.name ?? "PO.pdf")} disabled={!file} className="flex items-center justify-center gap-2 py-3 rounded-md text-white font-dm hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
            SUBMIT PURCHASE ORDER
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

const seedActiveOrders: ActiveOrder[] = [
  {
    po: "PO-2026-9901", product: "Air Filter 115×103×500mm", qty: 50, client: "B.E. Aerospace", paid: false,
    badge: { label: "In Production", bg: "#DBEAFE", fg: "#1D4ED8" },
    steps: [
      { label: "Inquiry Submitted",    date: "Mar 28, 2026 · 10:14 AM", state: "done", detail: "Submitted via portal · Air Filter spec confirmed" },
      { label: "Quotation Received",   date: "Mar 29, 2026 · 02:30 PM", state: "done", detail: "Total ₱78,000 · 14-day lead time · 30-Day Terms" },
      { label: "PO Approved & Uploaded", date: "Mar 30, 2026 · 09:00 AM", state: "done", detail: "PO-2026-9901.pdf · approved by Enter-Fil" },
      { label: "Job Order Created",    date: "Mar 30, 2026 · 11:45 AM", state: "done", detail: "JO-2026-001 · production queued · sketch attached" },
      { label: "In Production",        date: "Stage 9 of 10 · Quality Inspection · Est. Apr 30", state: "current", detail: "F. Santos marked Stage 8 done at 2:15 PM today · Stage 9 in progress" },
      { label: "Quality Inspection",   date: "—", state: "pending", detail: "Final QC checkpoint before dispatch" },
      { label: "Ready for Dispatch",   date: "—", state: "pending", detail: "Waybill prepared · awaiting logistics pickup" },
      { label: "Delivered",            date: "—", state: "pending", detail: "Signed DR confirms delivery · payment terms clock starts" },
      { label: "Invoiced",             date: "—", state: "pending", detail: "Sales invoice issued · 30-day terms" },
      { label: "Payment Cleared",      date: "—", state: "pending", detail: "Account fully settled · order archived" },
    ],
  },
  {
    po: "PO-2026-9531", product: "Filter", qty: 100, client: "Maynilad", paid: false,
    badge: { label: "Quotation Received", bg: "#FEF3C7", fg: "#B45309" },
    steps: [
      { label: "Inquiry Submitted",    date: "Mar 25, 2026 · 03:20 PM", state: "done", detail: "Submitted via portal" },
      { label: "Quotation Received",   date: "Awaiting your PO upload",  state: "current", detail: "Total ₱50,040 · please upload signed PO to proceed" },
      { label: "PO Uploaded",          date: "—", state: "pending", detail: "—" },
      { label: "Job Order Created",    date: "—", state: "pending", detail: "—" },
      { label: "In Production",        date: "—", state: "pending", detail: "—" },
      { label: "Delivered",            date: "—", state: "pending", detail: "—" },
    ],
  },
  /* Already paid — hidden from active tracker */
  {
    po: "PO-2026-9805", product: "Oil Separator Filter", qty: 20, client: "B.E. Aerospace", paid: true,
    badge: { label: "Paid & Closed", bg: "#DCFCE7", fg: "#15803D" },
    steps: [],
  },
];

function StatusTab() {
  const [showJO, setShowJO] = useState(false);
  const [requestingUrgent, setRequestingUrgent] = useState<string | null>(null);
  const [urgentDate, setUrgentDate] = useState("");
  const [expandedPO, setExpandedPO] = useState<string | null>(seedActiveOrders[0]?.po ?? null);
  const { push: pushNotif } = useNotifications();

  /* Hide paid/cleared orders from tracker */
  const activeOrders = seedActiveOrders.filter(o => !o.paid);

  const requestUrgentUpgrade = () => {
    if (!urgentDate.trim()) { toast.error("Please specify your required delivery date"); return; }
    pushNotif({
      dept: "production",
      title: "🚨 Urgent upgrade requested by client",
      body: `${requestingUrgent} · B.E. Aerospace · requested delivery by ${urgentDate}`,
      link: "production",
      recipients: ["owner", "operations", "production"],
    });
    toast.success("Urgent upgrade request sent", { description: "Production manager will review and confirm via Viber/email" });
    setRequestingUrgent(null); setUrgentDate("");
  };

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
      ) : activeOrders.map((order) => {
        const expanded = expandedPO === order.po;
        const currentStep = order.steps.find(s => s.state === "current");
        return (
          <CollapsibleStatusCard
            key={order.po}
            order={order}
            expanded={expanded}
            onToggle={() => setExpandedPO(expanded ? null : order.po)}
            onViewJO={() => setShowJO(true)}
            onRequestUrgent={() => setRequestingUrgent(order.po)}
            currentStep={currentStep}
          />
        );
      })}

      {showJO && <JOTemplateModal data={DEMO_JO_DATA} onClose={() => setShowJO(false)} />}

      {/* Urgent upgrade modal */}
      {requestingUrgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.6)" }} onClick={() => setRequestingUrgent(null)}>
          <div className="bg-white rounded-xl w-full max-w-md flex flex-col" style={{ boxShadow: "0 24px 48px rgba(0,0,0,0.3)" }} onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2" style={{ backgroundColor: "#FEF2F2" }}>
              <span style={{ fontSize: 20 }}>🚨</span>
              <h3 className="font-syne" style={{ fontSize: 16, fontWeight: 700, color: "#991B1B" }}>Request Urgent Upgrade</h3>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <p className="font-dm" style={{ fontSize: 13, color: "#475569" }}>
                Need <span className="font-mono-jb" style={{ fontWeight: 700 }}>{requestingUrgent}</span> sooner? Tell us your required delivery date — we'll confirm via Viber or email within 4 hours.
              </p>
              <div className="flex flex-col gap-1.5">
                <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#991B1B", letterSpacing: 0.4, textTransform: "uppercase" }}>Required Delivery Date</label>
                <input
                  value={urgentDate}
                  onChange={(e) => setUrgentDate(e.target.value)}
                  placeholder="e.g. May 5, 2026"
                  className="font-dm px-3 py-2 rounded-md border border-red-200 outline-none focus:border-red-400 bg-white"
                  style={{ fontSize: 13 }}
                  autoFocus
                />
              </div>
              <div className="rounded-md p-3 font-dm" style={{ fontSize: 11, color: "#92400E", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
                ⚠️ Rush upgrades may incur additional cost. We will confirm before adjusting.
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => { setRequestingUrgent(null); setUrgentDate(""); }} className="font-dm px-4 py-2 rounded-md hover:bg-slate-100" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Cancel</button>
              <button onClick={requestUrgentUpgrade} className="font-dm px-4 py-2 rounded-md text-white hover:opacity-90 flex items-center gap-2" style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700 }}>
                🚨 Send Urgent Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CollapsibleStatusCard({ order, expanded, onToggle, onViewJO, onRequestUrgent, currentStep }: {
  order: ActiveOrder;
  expanded: boolean;
  onToggle: () => void;
  onViewJO: () => void;
  onRequestUrgent: () => void;
  currentStep?: Step;
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
              onClick={onRequestUrgent}
              className="flex items-center gap-2 px-3 py-2 rounded-md font-dm hover:opacity-90"
              style={{ fontSize: 12, fontWeight: 700, backgroundColor: "#FEE2E2", color: "#C8102E", letterSpacing: 0.3 }}
            >
              🚨 Request Urgent Upgrade
            </button>
            <button
              onClick={onViewJO}
              className="flex items-center gap-2 px-3 py-2 rounded-md font-dm border border-slate-200 hover:bg-white"
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

function LogisticsTab() {
  const [filter, setFilter] = useState("All");
  const [expandedPo, setExpandedPo] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "status">("date-desc");
  const filters = ["All", "Pending", "In Transit", "Delivered"];

  const rows: LogisticsRow[] = [
    { po: "PO-2026-9901", item: "Air Filter", qty: 50, method: "Company Vehicle", status: "Delivered", statusBg: "#DCFCE7", statusFg: "#15803D", hasSignedDR: true, driverName: "D. Santos", estimatedDate: "Mar 31, 2026", dateISO: "2026-03-31" },
    { po: "PO-2026-9531", item: "Filter", qty: 100, method: "Lalamove", status: "In Transit", statusBg: "#DBEAFE", statusFg: "#1D4ED8", trackingNumber: "LL-2026-8821", dateISO: "2026-04-25" },
    { po: "PO-2026-9533", item: "Filter", qty: 100, method: "Client Pick-up", status: "Pending", statusBg: "#E2E8F0", statusFg: "#475569", dateISO: "2026-04-22" },
  ];

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
                        <InfoPair label="Enter-Fil Contact" value="+63 2 8721 9000" />
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
                        <InfoPair label="Enter-Fil Contact" value="+63 2 8721 9000" />
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
                        <div className="font-dm" style={{ fontSize: 13, color: "#475569" }}>📞 +63 2 8721 9000</div>
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

/* ---------- Accounting Tab ---------- */
function ClientAccountingTab({ clientName }: { clientName: string }) {
  const { byClient, addClientReceipt } = useOrders();
  const { push: pushNotif } = useNotifications();
  const [openId, setOpenId] = useState<string | null>("a3");
  const [receiptForm, setReceiptForm] = useState<Record<string, { amount: string; note: string; file: string }>>({});
  const [view, setView] = useState<"active" | "history">("active");

  /* Track partial-payment progress per invoice — secretary-confirmed payments */
  const [confirmedPayments, setConfirmedPayments] = useState<Record<string, { amount: number; date: string; method: string; ref: string }[]>>({
    /* a3 already has one partial payment confirmed by secretary */
    a3: [{ amount: 23400, date: "Apr 10, 2026", method: "BDO Bank Transfer", ref: "BDO-2026-04100" }],
  });

  const rows = [
    { id: "a1", inv: "SI-2026-9905", po: "PO-2026-9905", item: "Air Filter", amount: 78000, payment: "Bank Transfer · BDO", due: "—",            status: "paid" as const,    paidDate: "Apr 2, 2026" },
    { id: "a2", inv: "SI-2026-9531", po: "PO-2026-9531", item: "Pleated Filter ZS20", amount: 50040, payment: "30-Day Terms",  due: "Apr 30, 2026", status: "paid" as const,    paidDate: "Apr 28, 2026" },
    { id: "a3", inv: "SI-2026-9533", po: "PO-2026-9533", item: "Pleated Filter 5-Micron", amount: 46800, payment: "30-Day Terms", due: "Apr 29, 2026", status: "pending" as const, paidDate: "" },
  ];

  const activeRows = rows.filter(r => r.status === "pending");
  const historyRows = rows.filter(r => r.status === "paid");
  const visibleRows = view === "active" ? activeRows : historyRows;

  /* Match client's inquiries to link receipt to the right inquiry */
  const clientInqs = byClient(clientName);

  const submitReceipt = (rowId: string, invNo: string) => {
    const f = receiptForm[rowId];
    if (!f?.file) { toast.error("Please attach a receipt file first"); return; }
    const amt = parseFloat(f.amount);
    if (isNaN(amt) || amt <= 0) { toast.error("Please enter the amount paid"); return; }
    /* Link to the most recent inquiry of this client */
    const targetInq = clientInqs[clientInqs.length - 1];
    if (targetInq) {
      addClientReceipt(targetInq.id, {
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        filename: f.file,
        amount: amt,
        note: f.note || invNo,
      });
    }
    pushNotif({
      dept: "payments",
      title: `Receipt uploaded by ${clientName}`,
      body: `${invNo} · ₱${amt.toLocaleString("en-PH")}${f.note ? ` · ${f.note}` : ""}`,
      link: "accounting",
      recipients: ["owner", "operations", "accounting"],
    });
    toast.success("Receipt sent to Enter-Fil", { description: "The secretary will verify and update your account." });
    setReceiptForm((prev) => ({ ...prev, [rowId]: { amount: "", note: "", file: "" } }));
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
        {pill("Amount Due", `₱${activeRows.reduce((s, r) => s + r.amount - (confirmedPayments[r.id] ?? []).reduce((p, c) => p + c.amount, 0), 0).toLocaleString("en-PH")}`, "#C8102E")}
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
              const confirmed = confirmedPayments[r.id] ?? [];
              const totalConfirmed = confirmed.reduce((s, p) => s + p.amount, 0);
              const remaining = r.amount - totalConfirmed;
              const isPartial = isPending && totalConfirmed > 0;
              const s = isPartial
                ? { bg: "#DBEAFE", fg: "#1D4ED8", label: "Partial" }
                : isPending
                ? { bg: "#FEF3C7", fg: "#B45309", label: "Pending" }
                : { bg: "#DCFCE7", fg: "#15803D", label: "Paid" };
              const rf = receiptForm[r.id] ?? { amount: "", note: "", file: "" };
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
                              <Row label="Bank" value="BDO Savings Account" />
                              <Row label="Account Name" value="Enter-Fil Industrial Products" />
                              <Row label="Account No." value="XXXX-XXXX-XXXX" mono />
                            </div>
                            <div className="rounded-lg p-3" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
                              <div className="font-dm" style={{ fontSize: 12, color: "#92400E", fontWeight: 600 }}>Payment terms run from delivery date.</div>
                              <div className="font-dm mt-1" style={{ fontSize: 11, color: "#92400E" }}>Due: {r.due} · Contact us via Viber or email for disputes.</div>
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
  const [smsAlerts, setSmsAlerts] = useState(true);
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
          <ChannelToggle
            icon="📱"
            label="SMS Alerts"
            email={phone}
            enabled={smsAlerts}
            onToggle={() => setSmsAlerts(v => !v)}
            accent="#16A34A"
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
          ℹ️ Email alerts via SendGrid · SMS via Semaphore PH. You can unsubscribe anytime.
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
      {tab === "status" && <StatusTab />}
      {tab === "logistics" && <LogisticsTab />}
      {tab === "accounting" && <ClientAccountingTab clientName={clientName} />}
      {tab === "settings" && <SettingsTab clientName={clientName} />}
    </Shell>
  );
}
