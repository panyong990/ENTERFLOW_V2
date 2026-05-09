import { useState } from "react";
import {
  Search, Plus, Building2, Phone, Mail, MapPin, X, FileText, Factory,
  ChevronDown, ChevronUp, RotateCcw, Eye, Save, RefreshCw, KeyRound, Paperclip,
} from "lucide-react";
import { useOrders } from "../store/orders";
import { NotificationBell } from "./NotificationBell";

function genPortalPassword() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
import { toast, Toaster } from "sonner";

interface LinkedDoc { type: string; ref: string }
interface Transaction {
  id: string; date: string; po: string; item: string; amount: number;
  status: "Paid" | "Pending" | "In Production";
  specs?: string; paymentInfo?: string; deliveryInfo?: string;
  docs?: LinkedDoc[];
}
interface JobSpecs {
  od1?: string; od2?: string; id1?: string; id2?: string; height?: string;
  media?: string; innerCore?: string; outerCore?: string; endCap?: string; oem?: string; brand?: string;
}
interface JobOrder {
  id: string; jo: string; product: string; qty: number; stage: string;
  status: "active" | "completed"; specs?: JobSpecs; progress?: number;
  docs?: LinkedDoc[];
}
interface Client {
  id: string; name: string; industry: string; contact: string;
  email: string; phone: string; address: string; since: string;
  totalOrders: number; totalRevenue: number; status: "active" | "inactive";
  paymentTerms?: string; lastOrder?: string; notes?: string;
  transactions: Transaction[]; jobs: JobOrder[];
}

const CLIENTS_DATA: Client[] = [
  {
    id: "c1", name: "B.E. Aerospace", industry: "Aerospace", contact: "M. Rivera",
    email: "procurement@be-aerospace.ph", phone: "+63 917 555 1212",
    address: "Clark Freeport, Pampanga", since: "Mar 2023",
    totalOrders: 14, totalRevenue: 1248600, status: "active",
    paymentTerms: "30-Day Terms", lastOrder: "Apr 10, 2026",
    notes: "Prefers morning delivery. Primary contact is M. Rivera only. Large-volume client — priority lane.",
    transactions: [
      {
        id: "t1", date: "Mar 31, 2026", po: "PO-2026-9901", item: "Air Filter 115×103×500mm",
        amount: 78000, status: "Paid",
        specs: "Air Filter · OD 115mm · ID 103mm · H 500mm · Microglass Fiber · Qty 50",
        paymentInfo: "Bank Transfer · BDO · Cleared Apr 2, 2026",
        deliveryInfo: "Company Vehicle · Delivered Mar 31, 2026 · Received by M. Rivera",
        docs: [
          { type: "QT", ref: "QT-2026-9901" }, { type: "PO", ref: "PO-2026-9901" },
          { type: "JO", ref: "JO-2026-001" }, { type: "SI", ref: "SI-2026-9901" }, { type: "DR", ref: "DR-2026-9901" },
        ],
      },
      {
        id: "t2", date: "Apr 10, 2026", po: "PO-2026-0418", item: "Air Filter KF-OS.107.65.252",
        amount: 46800, status: "In Production",
        specs: "Air Filter · OD 107mm · ID 64.6mm · H 252mm · Microglass Fiber · Qty 30",
        paymentInfo: "30-Day Terms · Due Apr 27, 2026",
        deliveryInfo: "Lalamove · Awaiting production completion",
        docs: [
          { type: "QT", ref: "QT-2026-0418" }, { type: "PO", ref: "PO-2026-0418" },
          { type: "JO", ref: "JO-2026-008" },
        ],
      },
      {
        id: "t3", date: "Feb 14, 2026", po: "PO-2026-9805", item: "Oil Separator Filter",
        amount: 45000, status: "Paid",
        specs: "Oil Separator · OD 200mm · ID 108mm · H 160mm · Microglass Fiber · Qty 20",
        paymentInfo: "Cash · Cleared Feb 15, 2026",
        deliveryInfo: "Client Pick-up · Feb 15, 2026 · ID: 9845-AB",
        docs: [
          { type: "QT", ref: "QT-2026-9805" }, { type: "PO", ref: "PO-2026-9805" },
          { type: "JO", ref: "JO-2025-082" }, { type: "SI", ref: "SI-2026-9805" }, { type: "DR", ref: "DR-2026-9805" },
        ],
      },
    ],
    jobs: [
      {
        id: "j1", jo: "JO-2026-001", product: "Air Filter 115×103×500mm", qty: 50,
        stage: "Quality / Product Inspection", status: "active", progress: 90,
        specs: { od1: "115", od2: "103", id1: "64.6", height: "500", media: "Microglass Fiber / Inside", innerCore: "Expanded Metal Perfo 2mm", endCap: "E.G. (1.0mm)", oem: "KF-OS.107.65.252", brand: "Hitachi Comp." },
        docs: [{ type: "PO", ref: "PO-2026-9901" }, { type: "JO", ref: "JO-2026-001" }],
      },
      {
        id: "j2", jo: "JO-2025-082", product: "Oil Separator KF-OS.200", qty: 30,
        stage: "Completed", status: "completed", progress: 100,
        specs: { od1: "200", id1: "108", height: "160", media: "Microglass Fiber", innerCore: "Perfo Steel 2mm", endCap: "E.G. (1.2mm)", brand: "Generic" },
        docs: [{ type: "PO", ref: "PO-2026-9805" }, { type: "JO", ref: "JO-2025-082" }, { type: "DR", ref: "DR-2026-9805" }],
      },
    ],
  },
  {
    id: "c2", name: "Maynilad", industry: "Utilities / Water", contact: "J. Domingo",
    email: "supplies@maynilad.com.ph", phone: "+63 2 8888 5555",
    address: "MWSS Compound, Quezon City", since: "Jan 2022",
    totalOrders: 22, totalRevenue: 2108400, status: "active",
    paymentTerms: "30-Day Terms", lastOrder: "Mar 31, 2026",
    notes: "Government-linked utility. Requires official receipts for all transactions.",
    transactions: [
      { id: "t1", date: "Mar 31, 2026", po: "PO-2026-9531", item: "Pleated Filter ZS20 (100 pcs)", amount: 50040, status: "Paid", docs: [{ type: "PO", ref: "PO-2026-9531" }, { type: "SI", ref: "SI-2026-9531" }] },
      { id: "t2", date: "Mar 30, 2026", po: "PO-2026-9533", item: "Pleated Filter 5-Micron (100 pcs)", amount: 46800, status: "Pending", docs: [{ type: "PO", ref: "PO-2026-9533" }] },
    ],
    jobs: [
      { id: "j1", jo: "JO-2026-002", product: "Filter KF-OF.175.20.87", qty: 100, stage: "Assembling", status: "active", progress: 40, specs: { od1: "175", id1: "20", height: "87", media: "Pleated ZS20 w/ Double Alum Screen", oem: "KF-OF.175.20.87" } },
    ],
  },
  {
    id: "c3", name: "G.U. Engineering", industry: "Industrial", contact: "A. Tan",
    email: "ops@gu-eng.ph", phone: "+63 917 222 3344",
    address: "Cabuyao, Laguna", since: "Aug 2024",
    totalOrders: 6, totalRevenue: 368100, status: "active",
    paymentTerms: "15-Day Terms", lastOrder: "Apr 12, 2026",
    transactions: [
      { id: "t1", date: "Apr 12, 2026", po: "PO-2026-0421", item: "Oil Separator Filter (30 pcs)", amount: 67500, status: "In Production", docs: [{ type: "PO", ref: "PO-2026-0421" }, { type: "JO", ref: "JO-2026-003" }] },
    ],
    jobs: [
      { id: "j1", jo: "JO-2026-003", product: "Oil Separator KF-OS.200/167", qty: 30, stage: "Molding", status: "active", progress: 10, specs: { od1: "200", id1: "108", height: "160", media: "Microglass Fiber", outerCore: "Perfo 6mm", oem: "KF-OS.200/167.108.160" } },
    ],
  },
  {
    id: "c4", name: "Emerald Vinyl", industry: "Manufacturing", contact: "R. Lim",
    email: "purchasing@emeraldvinyl.ph", phone: "+63 2 8721 9000",
    address: "Marikina City", since: "Nov 2025",
    totalOrders: 2, totalRevenue: 85200, status: "active",
    paymentTerms: "15-Day Terms",
    transactions: [],
    jobs: [{ id: "j1", jo: "JO-2026-004", product: "Column Filter", qty: 20, stage: "Holding", status: "active", progress: 5 }],
  },
  {
    id: "c5", name: "Monaco", industry: "Automotive", contact: "P. Garcia",
    email: "sales@monaco-ph.com", phone: "+63 917 444 9090",
    address: "Cebu City", since: "Jul 2025",
    totalOrders: 1, totalRevenue: 4680, status: "inactive",
    transactions: [], jobs: [],
  },
];

const txStyle: Record<string, { bg: string; fg: string }> = {
  Paid: { bg: "#DCFCE7", fg: "#15803D" },
  Pending: { bg: "#FEF3C7", fg: "#B45309" },
  "In Production": { bg: "#DBEAFE", fg: "#1D4ED8" },
};

export function Clients() {
  const { byClient } = useOrders();
  const [rawClients, setClients] = useState<Client[]>(CLIENTS_DATA);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Client | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  /* DERIVED: override totalOrders + totalRevenue with live values from the orders store. The seed values are used only as a baseline for clients with historical orders that pre-date the store seed. */
  const clients = rawClients.map((c) => {
    const inqs = byClient(c.name).filter((i) => !i.archived);
    const liveOrders = inqs.length;
    const livePaidRevenue = inqs
      .filter((i) => i.stage === "paid")
      .reduce((s, i) => s + (i.invoiceAmount ?? i.quotedTotal ?? 0), 0);
    /* Use live count when this client has any orders in the store; otherwise keep historical seed */
    return liveOrders > 0
      ? { ...c, totalOrders: liveOrders, totalRevenue: livePaidRevenue || c.totalRevenue }
      : c;
  });

  const visible = clients.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.industry.toLowerCase().includes(query.toLowerCase())
  );

  // Add Client form state
  const [addForm, setAddForm] = useState({
    name: "", industry: "", contact: "", phone: "", email: "",
    address: "", paymentTerms: "30-Day Terms", notes: "",
  });
  const [portalPwd, setPortalPwd] = useState(() => genPortalPassword());

  const saveClient = () => {
    if (!addForm.name.trim()) { toast.error("Company name required"); return; }
    const newClient: Client = {
      id: `c${Date.now()}`,
      name: addForm.name.trim(),
      industry: addForm.industry,
      contact: addForm.contact,
      email: addForm.email,
      phone: addForm.phone,
      address: addForm.address,
      since: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      totalOrders: 0, totalRevenue: 0, status: "active",
      paymentTerms: addForm.paymentTerms,
      notes: addForm.notes,
      transactions: [], jobs: [],
    };
    setClients((prev) => [...prev, newClient]);
    toast.success("Client account created", { description: `${addForm.name} — portal credentials generated` });
    setShowAdd(false);
    setAddForm({ name: "", industry: "", contact: "", phone: "", email: "", address: "", paymentTerms: "30-Day Terms", notes: "" });
    setPortalPwd(genPortalPassword());
  };

  return (
    <div className="flex-1 h-full overflow-auto" style={{ backgroundColor: "#F4F6F9" }}>
      <Toaster position="bottom-right" richColors />

      <header className="bg-white border-b border-slate-200/70 px-8 py-5 sticky top-0 z-10 flex items-start justify-between">
        <div>
          <h1 className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>
            Client Management
          </h1>
          <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>
            Customer directory · transaction history · associated job orders
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white font-dm hover:opacity-90"
            style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.3 }}
          >
            <Plus size={15} strokeWidth={2.5} aria-hidden /> Add Client
          </button>
          <NotificationBell />
        </div>
      </header>

      <div className="px-8 py-8 flex flex-col gap-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-6">
          {[
            { label: "Total Clients", value: String(clients.length) },
            { label: "Active", value: String(clients.filter((c) => c.status === "active").length), color: "#16A34A" },
            { label: "Active Job Orders", value: String(clients.reduce((s, c) => s + c.jobs.filter((j) => j.status === "active").length, 0)), color: "#2563EB" },
            { label: "Inactive", value: String(clients.filter((c) => c.status === "inactive").length), color: "#94A3B8" },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200/70 p-5" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
              <div className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>{k.label}</div>
              <div className="font-syne mt-2" style={{ fontSize: 28, fontWeight: 800, color: k.color ?? "#0F172A", lineHeight: 1.1 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by client name or industry..."
            className="font-dm w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-slate-400 bg-white"
            style={{ fontSize: 13 }}
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
          <table className="w-full">
            <thead style={{ backgroundColor: "#F4F6F9" }}>
              <tr>
                {["Client", "Industry", "Contact", "Total Orders", "Active Jobs", "Status", ""].map((h) => (
                  <th key={h} className="font-dm text-left px-4 py-3" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-slate-200/70 hover:bg-slate-50 cursor-pointer"
                  onClick={() => setSelected(c)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center font-syne text-white shrink-0"
                        style={{ backgroundColor: "#1A2B4A", fontSize: 12, fontWeight: 700 }}
                        aria-hidden
                      >
                        {c.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <div className="font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{c.name}</div>
                        <div className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>Since {c.since}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{c.industry}</td>
                  <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{c.contact}</td>
                  <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#0F172A", fontWeight: 600 }}>{c.totalOrders}</td>
                  <td className="px-4 py-3">
                    <span
                      className="font-dm px-2.5 py-1 rounded-full"
                      style={{ fontSize: 11, fontWeight: 600, backgroundColor: c.jobs.filter((j) => j.status === "active").length > 0 ? "#DBEAFE" : "#E2E8F0", color: c.jobs.filter((j) => j.status === "active").length > 0 ? "#1D4ED8" : "#475569" }}
                    >
                      {c.jobs.filter((j) => j.status === "active").length} active
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="font-dm px-2.5 py-1 rounded-full"
                      style={{ fontSize: 11, fontWeight: 600, backgroundColor: c.status === "active" ? "#DCFCE7" : "#E2E8F0", color: c.status === "active" ? "#15803D" : "#475569" }}
                    >
                      {c.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelected(c); }}
                      className="font-dm px-3 py-1.5 rounded-md border border-slate-200 hover:bg-white"
                      style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Client Detail Drawer */}
      {selected && (
        <ClientDetailDrawer
          client={selected}
          onClose={() => setSelected(null)}
          onUpdate={(updated) => {
            setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            setSelected(updated);
          }}
        />
      )}

      {/* Add Client Modal */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(15,23,42,0.5)" }}
          onClick={() => setShowAdd(false)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-auto"
            style={{ boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-syne" style={{ fontSize: 18, fontWeight: 700, color: "#0F172A" }}>
                  Add New Client
                </h3>
                <p className="font-dm mt-0.5" style={{ fontSize: 12, color: "#64748B" }}>
                  Create a client profile and set their payment terms.
                </p>
              </div>
              <button onClick={() => setShowAdd(false)} aria-label="Close" className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              {/* Company Name */}
              <div className="flex flex-col gap-1.5">
                <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Company Name *</label>
                <input value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. ABC Corporation" className="font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />
              </div>

              {/* Industry */}
              <div className="flex flex-col gap-1.5">
                <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Industry</label>
                <input value={addForm.industry} onChange={(e) => setAddForm((p) => ({ ...p, industry: e.target.value }))} placeholder="e.g. Aerospace, Water Utilities" className="font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />
              </div>

              {/* Contact Person + Phone side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Contact Person</label>
                  <input value={addForm.contact} onChange={(e) => setAddForm((p) => ({ ...p, contact: e.target.value }))} placeholder="Full name" className="font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Phone</label>
                  <input value={addForm.phone} onChange={(e) => setAddForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+63 9XX XXX XXXX" className="font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />
                </div>
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Email</label>
                <input type="email" value={addForm.email} onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))} placeholder="contact@company.com" className="font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />
              </div>

              {/* Address */}
              <div className="flex flex-col gap-1.5">
                <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Address</label>
                <input value={addForm.address} onChange={(e) => setAddForm((p) => ({ ...p, address: e.target.value }))} placeholder="Full address" className="font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />
              </div>

              {/* Payment Terms */}
              <div className="flex flex-col gap-2">
                <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Payment Terms</label>
                <div className="flex flex-col gap-2">
                  {(["15-Day Terms", "30-Day Terms"] as const).map((term) => {
                    const active = addForm.paymentTerms === term;
                    return (
                      <label
                        key={term}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer"
                        style={{
                          border: active ? "2px solid #C8102E" : "1px solid #CBD5E1",
                          backgroundColor: active ? "#FEF2F2" : "#FFFFFF",
                          padding: active ? 11 : 12,
                        }}
                      >
                        <input
                          type="radio"
                          name="addPaymentTerms"
                          checked={active}
                          onChange={() => setAddForm((p) => ({ ...p, paymentTerms: term }))}
                          style={{ accentColor: "#C8102E" }}
                        />
                        <div className="flex-1">
                          <div className="font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{term}</div>
                          <div className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>
                            {term === "15-Day Terms" ? "Invoice due 15 days after delivery" :
                             "Invoice due 30 days after delivery"}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Notes <span style={{ color: "#94A3B8", fontWeight: 400 }}>(optional)</span></label>
                <textarea value={addForm.notes} onChange={(e) => setAddForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Internal notes about this client..." rows={2} className="font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 resize-none" style={{ fontSize: 13 }} />
              </div>

              {/* Portal Login Credentials */}
              <div className="rounded-lg p-4 flex flex-col gap-3" style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                <div className="flex items-center gap-2">
                  <KeyRound size={14} style={{ color: "#2563EB" }} />
                  <span className="font-dm" style={{ fontSize: 12, fontWeight: 700, color: "#1E3A8A", letterSpacing: 0.4, textTransform: "uppercase" }}>Client Portal Access</span>
                </div>
                <p className="font-dm" style={{ fontSize: 12, color: "#1D4ED8" }}>
                  This creates a login account for the client to access the Enter-Fil Client Portal. Their username will be their email address.
                </p>
                <div className="flex flex-col gap-1.5">
                  <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#1E3A8A" }}>
                    Temporary Password <span style={{ color: "#93C5FD", fontWeight: 400 }}>(auto-generated, shown once)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 font-mono-jb px-3 py-2.5 rounded-md border border-blue-200 bg-white" style={{ fontSize: 13, color: "#0F172A", letterSpacing: 1 }}>
                      {portalPwd}
                    </div>
                    <button
                      onClick={() => setPortalPwd(genPortalPassword())}
                      className="w-10 h-10 rounded-md border border-blue-200 flex items-center justify-center hover:bg-blue-50 bg-white"
                      aria-label="Regenerate password"
                    >
                      <RefreshCw size={14} style={{ color: "#2563EB" }} />
                    </button>
                  </div>
                  <p className="font-dm" style={{ fontSize: 11, color: "#3B82F6" }}>
                    Copy this password and share it with the client — it won't be shown again. The client will be asked to change it on first login.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <button onClick={saveClient} className="w-full flex items-center justify-center gap-2 py-3 rounded-md text-white font-dm hover:opacity-90" style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.4 }}>
                <Save size={14} /> Create Client Account
              </button>
              <p className="font-dm text-center" style={{ fontSize: 12, color: "#64748B" }}>
                Client will receive their login credentials and can access the portal to complete their profile.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Client Detail Drawer (580px) ─── */
function ClientDetailDrawer({
  client, onClose, onUpdate,
}: {
  client: Client; onClose: () => void; onUpdate: (c: Client) => void;
}) {
  const [tab, setTab] = useState<"overview" | "transactions" | "jobs" | "documents">("overview");
  const [draft, setDraft] = useState({ ...client });
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [expandedJo, setExpandedJo] = useState<string | null>(null);
  const { byClient, reorderToProduction } = useOrders();
  const clientInquiries = byClient(client.name);

  const saveOverview = () => {
    onUpdate(draft);
    toast.success("Client updated", { description: draft.name });
  };

  const reorder = (label: string) => {
    /* Reorder from a known repeat item — skip inquiry/quotation, send direct to production */
    const matchInquiry = clientInquiries.find(i => i.products.some(p =>
      p.type === label || p.oem === label || (label && label.includes(p.oem ?? "__nope__"))
    ));
    if (matchInquiry) {
      const joNum = reorderToProduction(matchInquiry.id);
      toast.success(`Reorder created · ${joNum}`, { description: `${label} sent direct to Production Floor (skipped inquiry/quotation)` });
    } else {
      toast.success("Reorder initiated", { description: `Pre-filling inquiry for: ${label}` });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end"
      style={{ backgroundColor: "rgba(15,23,42,0.5)" }}
      onClick={onClose}
    >
      <div
        className="bg-white h-full overflow-auto flex flex-col"
        style={{ width: 580, boxShadow: "-20px 0 40px rgba(0,0,0,0.2)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`${client.name} details`}
      >
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center font-syne text-white"
              style={{ backgroundColor: "#1A2B4A", fontSize: 16, fontWeight: 700 }}
              aria-hidden
            >
              {client.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
            </div>
            <div>
              <h2 className="font-syne" style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>{client.name}</h2>
              <p className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>{client.industry} · Client since {client.since}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center">
            <X size={16} aria-hidden />
          </button>
        </div>

        {/* Tabs */}
        <nav className="px-6 border-b border-slate-200 flex gap-1 shrink-0">
          {([["overview", "Overview"], ["transactions", "Transactions"], ["jobs", "Job Orders"], ["documents", "Documents"]] as const).map(([id, label]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="font-dm px-4 py-3 transition-colors"
                style={{
                  fontSize: 13, fontWeight: 600,
                  color: active ? "#C8102E" : "#64748B",
                  borderBottom: active ? "3px solid #C8102E" : "3px solid transparent",
                  marginBottom: -1,
                }}
              >
                {label}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 flex flex-col gap-5">
          {/* ─── OVERVIEW TAB ─── */}
          {tab === "overview" && (
            <>
              <section>
                <div className="font-syne mb-3" style={{ fontSize: 13, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Company Information</div>
                <div className="grid grid-cols-2 gap-3">
                  <EditField label="Company Name" value={draft.name} onChange={(v) => setDraft((p) => ({ ...p, name: v }))} />
                  <EditField label="Industry" value={draft.industry} onChange={(v) => setDraft((p) => ({ ...p, industry: v }))} />
                  <EditField label="Contact Person" value={draft.contact} onChange={(v) => setDraft((p) => ({ ...p, contact: v }))} />
                  <EditField label="Phone" value={draft.phone} onChange={(v) => setDraft((p) => ({ ...p, phone: v }))} />
                  <EditField label="Email" value={draft.email} onChange={(v) => setDraft((p) => ({ ...p, email: v }))} fullWidth />
                  <EditField label="Address" value={draft.address} onChange={(v) => setDraft((p) => ({ ...p, address: v }))} fullWidth />
                </div>
              </section>

              <section>
                <div className="font-syne mb-3" style={{ fontSize: 13, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Quick Stats</div>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="Total Orders" value={String(client.totalOrders)} />
                  <StatCard label="Last Order" value={client.lastOrder ?? "—"} />
                  <StatCard label="Payment Terms" value={client.paymentTerms ?? "—"} />
                </div>
              </section>

              <section>
                <div className="font-syne mb-2" style={{ fontSize: 13, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Internal Notes</div>
                <textarea
                  value={draft.notes ?? ""}
                  onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Add internal notes about this client..."
                  rows={4}
                  className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 resize-none"
                  style={{ fontSize: 13 }}
                />
              </section>

              <div className="flex items-center gap-3">
                <button
                  onClick={saveOverview}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-md text-white font-dm hover:opacity-90"
                  style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700 }}
                >
                  <Save size={14} /> Save Changes
                </button>
                <button
                  onClick={() => toast.success("Opening new inquiry", { description: `For: ${client.name}` })}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md font-dm hover:opacity-90"
                  style={{ backgroundColor: "#1A2B4A", color: "white", fontSize: 13, fontWeight: 700 }}
                >
                  <Plus size={14} /> New Inquiry for This Client
                </button>
              </div>
            </>
          )}

          {/* ─── TRANSACTIONS TAB — fully completed orders only ─── */}
          {tab === "transactions" && (() => {
            const completed = client.transactions.filter(t => t.status === "Paid");
            return (
              <section className="flex flex-col gap-0">
                <div className="rounded-lg p-3 mb-3 font-dm" style={{ fontSize: 12, color: "#475569", backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                  ℹ️ Transactions = fully completed (delivered + paid) orders. Active orders live in Job Orders. Document attachments are in Documents.
                </div>
                {completed.length === 0 && (
                  <div className="p-8 text-center font-dm rounded-lg border border-slate-200" style={{ fontSize: 13, color: "#64748B" }}>
                    No completed transactions yet.
                  </div>
                )}
                {completed.map((t) => {
                  const isOpen = expandedTx === t.id;
                  return (
                    <div key={t.id} className="border border-slate-200 rounded-lg overflow-hidden mb-3">
                      <button
                        onClick={() => setExpandedTx(isOpen ? null : t.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left"
                      >
                        <div className="flex-1 grid grid-cols-4 gap-2 items-center">
                          <div className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>{t.date}</div>
                          <div className="font-mono-jb" style={{ fontSize: 11, fontWeight: 600, color: "#1A2B4A" }}>{t.po}</div>
                          <div className="font-dm" style={{ fontSize: 12, color: "#0F172A", fontWeight: 500 }}>{t.item}</div>
                          <span className="font-dm px-2 py-0.5 rounded-full justify-self-start" style={{ fontSize: 10, fontWeight: 700, backgroundColor: "#DCFCE7", color: "#15803D" }}>✓ Completed</span>
                        </div>
                        {isOpen ? <ChevronUp size={14} style={{ color: "#64748B" }} /> : <ChevronDown size={14} style={{ color: "#64748B" }} />}
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 border-t border-slate-200" style={{ backgroundColor: "#FAFBFC" }}>
                          <div className="grid grid-cols-3 gap-4 pt-3">
                            {t.specs && (
                              <div>
                                <div className="font-dm mb-1" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Product Specs</div>
                                <div className="font-dm" style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>{t.specs}</div>
                              </div>
                            )}
                            {t.paymentInfo && (
                              <div>
                                <div className="font-dm mb-1" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Payment</div>
                                <div className="font-dm" style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>{t.paymentInfo}</div>
                              </div>
                            )}
                            {t.deliveryInfo && (
                              <div>
                                <div className="font-dm mb-1" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Delivery</div>
                                <div className="font-dm" style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>{t.deliveryInfo}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })()}

          {/* ─── JOB ORDERS TAB ─── */}
          {tab === "jobs" && (
            <section className="flex flex-col gap-3">
              {client.jobs.length === 0 && (
                <div className="rounded-lg border border-slate-200 p-8 text-center font-dm" style={{ fontSize: 13, color: "#64748B" }}>
                  No job orders.
                </div>
              )}
              {client.jobs.map((j) => {
                const isOpen = expandedJo === j.id;
                const progress = j.progress ?? 0;
                return (
                  <div key={j.id} className="rounded-lg border border-slate-200 overflow-hidden">
                    <button
                      onClick={() => setExpandedJo(isOpen ? null : j.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left"
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: j.status === "active" ? "#DBEAFE" : "#DCFCE7", color: j.status === "active" ? "#1D4ED8" : "#15803D" }}
                        aria-hidden
                      >
                        {j.status === "active" ? <Factory size={16} /> : <FileText size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-mono-jb" style={{ fontSize: 13, fontWeight: 600, color: "#1A2B4A" }}>{j.jo}</div>
                          <span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 600, backgroundColor: j.status === "active" ? "#DBEAFE" : "#DCFCE7", color: j.status === "active" ? "#1D4ED8" : "#15803D" }}>
                            {j.status === "active" ? "Active" : "Completed"}
                          </span>
                        </div>
                        <div className="font-dm" style={{ fontSize: 13, color: "#0F172A", fontWeight: 500 }}>{j.product}</div>
                        <div className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>Qty {j.qty} · {j.stage}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); reorder(j.product); }}
                          className="font-dm px-2.5 py-1 rounded-md hover:opacity-90 flex items-center gap-1"
                          style={{ backgroundColor: "#F59E0B", color: "white", fontSize: 11, fontWeight: 700 }}
                        >
                          <RotateCcw size={11} /> Reorder
                        </button>
                        {isOpen ? <ChevronUp size={14} style={{ color: "#64748B" }} /> : <ChevronDown size={14} style={{ color: "#64748B" }} />}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 border-t border-slate-200" style={{ backgroundColor: "#FAFBFC" }}>
                        <div className="pt-3 flex flex-col gap-3">
                          {/* Progress */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>Production Progress</span>
                              <span className="font-syne" style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{progress}%</span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#E2E8F0" }}>
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${progress}%`, backgroundColor: progress >= 100 ? "#16A34A" : "#C8102E", transition: "width 0.3s" }}
                              />
                            </div>
                            <div className="font-dm mt-1" style={{ fontSize: 11, color: "#64748B" }}>Current Stage: {j.stage}</div>
                          </div>

                          {/* Filter Specs */}
                          {j.specs && (
                            <div>
                              <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Filter Specifications</div>
                              <div className="rounded-md p-3 grid grid-cols-2 gap-x-4 gap-y-1.5" style={{ backgroundColor: "#F4F6F9" }}>
                                {j.specs.od1 && <SpecRow k="OD 1" v={`${j.specs.od1}mm`} />}
                                {j.specs.od2 && <SpecRow k="OD 2" v={`${j.specs.od2}mm`} />}
                                {j.specs.id1 && <SpecRow k="ID 1" v={`${j.specs.id1}mm`} />}
                                {j.specs.id2 && <SpecRow k="ID 2" v={`${j.specs.id2}mm`} />}
                                {j.specs.height && <SpecRow k="Height" v={`${j.specs.height}mm`} />}
                                {j.specs.media && <SpecRow k="Filter Media" v={j.specs.media} />}
                                {j.specs.innerCore && <SpecRow k="Inner Core" v={j.specs.innerCore} />}
                                {j.specs.outerCore && <SpecRow k="Outer Core" v={j.specs.outerCore} />}
                                {j.specs.endCap && <SpecRow k="End Cap" v={j.specs.endCap} />}
                                {j.specs.oem && <SpecRow k="OEM PN" v={j.specs.oem} />}
                                {j.specs.brand && <SpecRow k="Brand" v={j.specs.brand} />}
                                <SpecRow k="Qty" v={String(j.qty)} />
                              </div>
                            </div>
                          )}

                          {/* Linked Documents */}
                          {j.docs && j.docs.length > 0 && (
                            <div>
                              <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Linked Documents</div>
                              <div className="flex flex-wrap gap-2">
                                {j.docs.map((d) => (
                                  <button
                                    key={d.ref}
                                    onClick={() => toast(`Viewing ${d.ref}`)}
                                    className="font-dm flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 hover:bg-white"
                                    style={{ fontSize: 11, fontWeight: 600, color: "#1A2B4A" }}
                                  >
                                    <Eye size={11} /> {d.type}: {d.ref}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          {/* ─── DOCUMENTS TAB ─── */}
          {tab === "documents" && (
            <section className="flex flex-col gap-4">
              <div className="font-dm" style={{ fontSize: 13, color: "#64748B" }}>
                All files uploaded during JO generation for this client — sketches, signed quotations, and downpayment receipts.
              </div>

              {clientInquiries.length === 0 ? (
                <div className="rounded-lg p-6 text-center font-dm" style={{ fontSize: 13, color: "#94A3B8", backgroundColor: "#F8FAFC", border: "1px dashed #CBD5E1" }}>
                  No uploaded documents yet.
                </div>
              ) : (
                clientInquiries.map((inq) => {
                  const files = [
                    inq.joSketch && { label: "Final Sketch / Drawing", file: inq.joSketch, color: "#1A2B4A", bg: "#EFF6FF" },
                    inq.signedQuotationFile && { label: "Signed Quotation", file: inq.signedQuotationFile, color: "#16A34A", bg: "#F0FDF4" },
                    inq.dpReceiptFile && { label: "Downpayment Receipt", file: inq.dpReceiptFile, color: "#D97706", bg: "#FFFBEB" },
                  ].filter(Boolean) as { label: string; file: string; color: string; bg: string }[];

                  if (files.length === 0) return null;
                  return (
                    <div key={inq.id} className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: "#F4F6F9" }}>
                        <span className="font-mono-jb" style={{ fontSize: 12, fontWeight: 700, color: "#1A2B4A" }}>{inq.joNumber ?? inq.code}</span>
                        <span className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>{inq.submittedDate} · {inq.products[0]?.type}</span>
                        {inq.urgent && <span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: "#FEE2E2", color: "#C8102E" }}>RUSH</span>}
                      </div>
                      <div className="p-4 flex flex-col gap-2">
                        {files.map(({ label, file, color, bg }) => (
                          <div key={label} className="flex items-center gap-3 rounded-lg px-4 py-3" style={{ backgroundColor: bg, border: `1px solid ${color}20` }}>
                            <Paperclip size={14} style={{ color }} />
                            <div className="flex-1 min-w-0">
                              <div className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</div>
                              <div className="font-mono-jb truncate" style={{ fontSize: 12, fontWeight: 600, color }}>{file}</div>
                            </div>
                            <button
                              onClick={() => toast.info(`Opening: ${file}`, { description: "In production, this downloads or previews the file" })}
                              className="font-dm flex items-center gap-1 px-2.5 py-1.5 rounded-md border hover:opacity-90"
                              style={{ fontSize: 11, fontWeight: 600, color, borderColor: `${color}40`, backgroundColor: "white" }}
                            >
                              <Eye size={11} /> View
                            </button>
                          </div>
                        ))}
                        {/* Client payment receipts */}
                        {(inq.clientPaymentReceipts ?? []).map((cr) => (
                          <div key={cr.id} className="flex items-center gap-3 rounded-lg px-4 py-3" style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                            <Paperclip size={14} style={{ color: "#2563EB" }} />
                            <div className="flex-1 min-w-0">
                              <div className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.3 }}>Client Payment Receipt · {cr.date}</div>
                              <div className="font-mono-jb truncate" style={{ fontSize: 12, fontWeight: 600, color: "#2563EB" }}>{cr.filename}</div>
                              {cr.note && <div className="font-dm" style={{ fontSize: 11, color: "#3B82F6" }}>{cr.note} · ₱{cr.amount.toLocaleString("en-PH")}</div>}
                            </div>
                            <button
                              onClick={() => toast.info(`Viewing: ${cr.filename}`)}
                              className="font-dm flex items-center gap-1 px-2.5 py-1.5 rounded-md border hover:opacity-90"
                              style={{ fontSize: 11, fontWeight: 600, color: "#2563EB", borderColor: "#BFDBFE", backgroundColor: "white" }}
                            >
                              <Eye size={11} /> View
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ─── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>{label}</label>
      {children}
    </div>
  );
}

function EditField({
  label, value, onChange, fullWidth,
}: {
  label: string; value: string; onChange: (v: string) => void; fullWidth?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${fullWidth ? "col-span-2" : ""}`}>
      <label className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400"
        style={{ fontSize: 13 }}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="font-dm" style={{ fontSize: 10, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div className="font-dm mt-1" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{value}</div>
    </div>
  );
}

function SpecRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center gap-1 font-dm" style={{ fontSize: 11 }}>
      <span style={{ color: "#64748B", minWidth: 72 }}>{k}:</span>
      <span style={{ color: "#0F172A", fontWeight: 600 }}>{v}</span>
    </div>
  );
}
