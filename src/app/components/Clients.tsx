import { useState } from "react";
import {
  Search, Building2, Phone, Mail, MapPin, X, Pencil,
  ChevronDown, ChevronUp, Eye, Save,
} from "lucide-react";
import { useOrders } from "../store/orders";
import { NotificationBell } from "./NotificationBell";
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
        <NotificationBell />
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
                {["Client", "Industry", "Contact", "Total Orders", "Active Jobs", "Status"].map((h) => (
                  <th key={h} className="font-dm text-left px-4 py-3" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-slate-200/70 transition-colors hover:bg-slate-50 cursor-pointer focus-visible:outline-none focus-visible:bg-slate-50"
                  tabIndex={0}
                  aria-label={`View ${c.name} details`}
                  onClick={() => setSelected(c)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelected(c);
                    }
                  }}
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

    </div>
  );
}

/* ─── Client Detail Drawer (580px) ─── */
function ClientDetailDrawer({
  client, onClose, onUpdate,
}: {
  client: Client; onClose: () => void; onUpdate: (c: Client) => void;
}) {
  const [tab, setTab] = useState<"overview" | "transactionsOrders">("overview");
  const [draft, setDraft] = useState({ ...client });
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [transactionQuery, setTransactionQuery] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [pendingTab, setPendingTab] = useState<"overview" | "transactionsOrders" | null>(null);
  const [formError, setFormError] = useState("");
  const hasUnsavedChanges = clientInfoChanged(client, draft);

  const requestClose = () => {
    if (editing && hasUnsavedChanges) {
      setPendingTab(null);
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  const requestTabChange = (nextTab: "overview" | "transactionsOrders") => {
    if (nextTab === tab) return;
    if (editing && hasUnsavedChanges) {
      setPendingTab(nextTab);
      setConfirmDiscard(true);
      return;
    }
    if (editing) {
      setDraft({ ...client });
      setEditing(false);
      setFormError("");
    }
    setTab(nextTab);
  };

  const startEditing = () => {
    setDraft({ ...client });
    setFormError("");
    setEditing(true);
  };

  const cancelEditing = () => {
    setDraft({ ...client });
    setFormError("");
    setEditing(false);
  };

  const discardAndClose = () => {
    setDraft({ ...client });
    setConfirmDiscard(false);
    if (pendingTab) {
      setTab(pendingTab);
      setEditing(false);
      setFormError("");
      setPendingTab(null);
    } else {
      onClose();
    }
  };

  const cancelDiscard = () => {
    setConfirmDiscard(false);
    setPendingTab(null);
  };

  const saveOverview = () => {
    const name = draft.name.trim();
    const email = draft.email.trim();
    if (!name) {
      setFormError("Company name is required.");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError("Enter a valid email address.");
      return;
    }

    const updated = {
      ...draft,
      name,
      industry: draft.industry.trim(),
      contact: draft.contact.trim(),
      email,
      phone: draft.phone.trim(),
      address: draft.address.trim(),
      notes: draft.notes?.trim() ?? "",
    };
    onUpdate(updated);
    setDraft(updated);
    setEditing(false);
    setFormError("");
    toast.success("Client updated", { description: updated.name });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end"
      style={{ backgroundColor: "rgba(15,23,42,0.5)" }}
      onClick={requestClose}
    >
      <div
        className="bg-white h-full overflow-auto flex flex-col"
        style={{ width: 580, boxShadow: "-20px 0 40px rgba(0,0,0,0.2)" }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            requestClose();
          }
        }}
        role="dialog"
        aria-label={`${client.name} details`}
        aria-modal="true"
      >
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center font-syne text-white"
              style={{ backgroundColor: "#1A2B4A", fontSize: 16, fontWeight: 700 }}
              aria-hidden
            >
              {client.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
            </div>
            <div>
              <h2 className="font-syne" style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>{draft.name}</h2>
              <p className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>{draft.industry || "Industry not specified"} · Client since {client.since}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={saveOverview}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-white font-dm hover:opacity-90"
                  style={{ backgroundColor: "#C8102E", fontSize: 12, fontWeight: 700 }}
                >
                  <Save size={14} /> Save Changes
                </button>
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="rounded-md border border-slate-200 px-3 py-2 font-dm hover:bg-slate-50"
                  style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}
                >
                  Cancel
                </button>
              </>
            ) : tab === "overview" ? (
              <button
                type="button"
                onClick={startEditing}
                aria-label="Edit client"
                title="Edit client"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <Pencil size={14} aria-hidden="true" />
              </button>
            ) : null}
            <button onClick={requestClose} aria-label="Close" className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center">
              <X size={16} aria-hidden />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <nav className="px-6 border-b border-slate-200 flex gap-1 shrink-0">
          {([["overview", "Overview"], ["transactionsOrders", "Transactions & Orders"]] as const).map(([id, label]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => requestTabChange(id)}
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
        {formError && <p role="alert" className="mx-6 mt-4 font-dm text-sm text-red-700">{formError}</p>}

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 flex flex-col gap-5">
          {/* ─── OVERVIEW TAB ─── */}
          {tab === "overview" && (
            <>
              <section>
                <div className="font-syne mb-3" style={{ fontSize: 13, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Company Information</div>
                <div className="grid grid-cols-2 gap-3">
                  {editing ? (
                    <>
                      <EditField label="Company Name" value={draft.name} onChange={(v) => setDraft((p) => ({ ...p, name: v }))} />
                      <EditField label="Industry" value={draft.industry} onChange={(v) => setDraft((p) => ({ ...p, industry: v }))} />
                      <EditField label="Contact Person" value={draft.contact} onChange={(v) => setDraft((p) => ({ ...p, contact: v }))} />
                      <EditField label="Phone" value={draft.phone} onChange={(v) => setDraft((p) => ({ ...p, phone: v }))} />
                      <EditField label="Email" value={draft.email} onChange={(v) => setDraft((p) => ({ ...p, email: v }))} fullWidth type="email" />
                      <EditField label="Address" value={draft.address} onChange={(v) => setDraft((p) => ({ ...p, address: v }))} fullWidth />
                    </>
                  ) : (
                    <>
                      <ReadOnlyField label="Company Name" value={client.name} />
                      <ReadOnlyField label="Industry" value={client.industry} />
                      <ReadOnlyField label="Contact Person" value={client.contact} />
                      <ReadOnlyField label="Phone" value={client.phone} />
                      <ReadOnlyField label="Email" value={client.email} fullWidth />
                      <ReadOnlyField label="Address" value={client.address} fullWidth />
                    </>
                  )}
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
                {editing ? (
                  <textarea
                    aria-label="Internal Notes"
                    value={draft.notes ?? ""}
                    onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Add internal notes about this client..."
                    rows={4}
                    className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 resize-none"
                    style={{ fontSize: 13 }}
                  />
                ) : (
                  <p className="whitespace-pre-wrap font-dm" style={{ fontSize: 13, lineHeight: 1.6, color: client.notes ? "#334155" : "#64748B" }}>
                    {client.notes || "No internal notes."}
                  </p>
                )}
              </section>
            </>
          )}

          {/* ─── TRANSACTIONS & ORDERS TAB ─── */}
          {tab === "transactionsOrders" && (() => {
            const normalizedQuery = transactionQuery.trim().toLocaleLowerCase();
            const transactions = client.transactions.filter((transaction) => {
              if (!normalizedQuery) return true;
              const searchable = [
                transaction.po,
                transaction.item,
                transaction.status,
                transaction.date,
                ...(transaction.docs ?? []).map((doc) => doc.ref),
              ];
              return searchable.some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
            });
            return (
              <section className="flex flex-col gap-0">
                <div className="relative mb-4 max-w-md">
                  <Search size={15} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    aria-label="Search transactions or orders"
                    placeholder="Search transactions or orders..."
                    value={transactionQuery}
                    onChange={(event) => setTransactionQuery(event.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 font-dm outline-none focus:border-slate-400"
                    style={{ fontSize: 12 }}
                  />
                </div>
                {client.transactions.length === 0 && (
                  <div className="p-8 text-center font-dm rounded-lg border border-slate-200" style={{ fontSize: 13, color: "#64748B" }}>
                    No transactions available.
                  </div>
                )}
                {client.transactions.length > 0 && transactions.length === 0 && (
                  <div className="p-8 text-center font-dm rounded-lg border border-slate-200" style={{ fontSize: 13, color: "#64748B" }}>
                    No transactions found.
                  </div>
                )}
                {transactions.map((t) => {
                  const transactionRefs = new Set([
                    t.po,
                    ...(t.docs ?? []).filter((doc) => doc.type === "PO" || doc.type === "JO").map((doc) => doc.ref),
                  ]);
                  const relatedJobs = client.jobs.filter((job) => {
                    const jobRefs = [job.jo, ...(job.docs ?? []).filter((doc) => doc.type === "PO" || doc.type === "JO").map((doc) => doc.ref)];
                    return jobRefs.some((ref) => transactionRefs.has(ref));
                  });
                  const linkedDocs = [...(t.docs ?? []), ...relatedJobs.flatMap((job) => job.docs ?? [])].filter((doc, index, docs) =>
                    docs.findIndex((candidate) => candidate.type === doc.type && candidate.ref === doc.ref) === index
                  );
                  const isOpen = expandedTx === t.id;
                  return (
                    <div key={t.id} className="border border-slate-200 rounded-lg overflow-hidden mb-3">
                      <button
                        onClick={() => setExpandedTx(isOpen ? null : t.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left"
                      >
                        <div className="flex-1 grid grid-cols-5 gap-2 items-center">
                          <div className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>{t.date}</div>
                          <div className="font-mono-jb" style={{ fontSize: 11, fontWeight: 600, color: "#1A2B4A" }}>{t.po}</div>
                          <div className="font-dm" style={{ fontSize: 12, color: "#0F172A", fontWeight: 500 }}>{t.item}</div>
                          <div className="font-dm" style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>₱{t.amount.toLocaleString("en-PH")}</div>
                          <span className="font-dm px-2 py-0.5 rounded-full justify-self-start" style={{ fontSize: 10, fontWeight: 700, backgroundColor: t.status === "Paid" ? "#DCFCE7" : t.status === "Pending" ? "#FEF3C7" : "#DBEAFE", color: t.status === "Paid" ? "#15803D" : t.status === "Pending" ? "#B45309" : "#1D4ED8" }}>{t.status}</span>
                        </div>
                        {isOpen ? <ChevronUp size={14} style={{ color: "#64748B" }} /> : <ChevronDown size={14} style={{ color: "#64748B" }} />}
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 border-t border-slate-200" style={{ backgroundColor: "#FAFBFC" }}>
                          <div className="grid grid-cols-3 gap-4 pt-3">
                            {relatedJobs.map((job) => (
                              <div key={job.id} className="col-span-3">
                                <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Job Order · {job.jo}</div>
                                <div className="font-dm" style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>{job.product} · Qty {job.qty} · {job.status === "active" ? "Active" : "Completed"} · {job.stage}{job.progress !== undefined ? ` · ${job.progress}%` : ""}</div>
                                {job.specs && <div className="rounded-md p-3 mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5" style={{ backgroundColor: "#F4F6F9" }}>
                                  {job.specs.od1 && <SpecRow k="OD 1" v={`${job.specs.od1}mm`} />}
                                  {job.specs.od2 && <SpecRow k="OD 2" v={`${job.specs.od2}mm`} />}
                                  {job.specs.id1 && <SpecRow k="ID 1" v={`${job.specs.id1}mm`} />}
                                  {job.specs.id2 && <SpecRow k="ID 2" v={`${job.specs.id2}mm`} />}
                                  {job.specs.height && <SpecRow k="Height" v={`${job.specs.height}mm`} />}
                                  {job.specs.media && <SpecRow k="Filter Media" v={job.specs.media} />}
                                  {job.specs.innerCore && <SpecRow k="Inner Core" v={job.specs.innerCore} />}
                                  {job.specs.outerCore && <SpecRow k="Outer Core" v={job.specs.outerCore} />}
                                  {job.specs.endCap && <SpecRow k="End Cap" v={job.specs.endCap} />}
                                  {job.specs.oem && <SpecRow k="OEM PN" v={job.specs.oem} />}
                                  {job.specs.brand && <SpecRow k="Brand" v={job.specs.brand} />}
                                </div>}
                              </div>
                            ))}
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
                            {linkedDocs.length > 0 && (
                              <div className="col-span-3">
                                <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Linked Documents</div>
                                <div className="flex flex-wrap gap-2">
                                  {linkedDocs.map((doc) => (
                                    <button key={doc.ref} onClick={() => toast(`Viewing ${doc.ref}`)} className="font-dm flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 hover:bg-white" style={{ fontSize: 11, fontWeight: 600, color: "#1A2B4A" }}>
                                      <Eye size={11} /> {doc.type}: {doc.ref}
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
            );
          })()}

        </div>
      </div>
      {confirmDiscard && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(15,23,42,0.35)" }}
          onClick={cancelDiscard}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="discard-client-changes-title"
            aria-describedby="discard-client-changes-description"
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="discard-client-changes-title" className="font-syne" style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>
              Discard unsaved changes?
            </h3>
            <p id="discard-client-changes-description" className="mt-2 font-dm" style={{ fontSize: 13, color: "#64748B" }}>
              {pendingTab
                ? "Your changes to this client will be lost if you continue to the other tab."
                : "Your changes to this client will be lost."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelDiscard}
                className="rounded-md border border-slate-200 px-3 py-2 font-dm hover:bg-slate-50"
                style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={discardAndClose}
                className="rounded-md px-3 py-2 font-dm text-white hover:opacity-90"
                style={{ backgroundColor: "#C8102E", fontSize: 12, fontWeight: 700 }}
              >
                {pendingTab ? "Discard & Continue" : "Discard Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Helpers ─── */
function clientInfoChanged(client: Client, draft: Client): boolean {
  return client.name !== draft.name
    || client.industry !== draft.industry
    || client.contact !== draft.contact
    || client.phone !== draft.phone
    || client.email !== draft.email
    || client.address !== draft.address
    || (client.notes ?? "") !== (draft.notes ?? "");
}

function ReadOnlyField({
  label, value, fullWidth,
}: {
  label: string; value: string; fullWidth?: boolean;
}) {
  return (
    <div className={`min-w-0 ${fullWidth ? "col-span-2" : ""}`}>
      <div className="font-dm" style={{ fontSize: 10, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div className="mt-1 break-words font-dm" style={{ fontSize: 13, color: value ? "#0F172A" : "#64748B" }}>{value || "—"}</div>
    </div>
  );
}

function EditField({
  label, value, onChange, fullWidth, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; fullWidth?: boolean; type?: "text" | "email";
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${fullWidth ? "col-span-2" : ""}`}>
      <label className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</label>
      <input
        type={type}
        aria-label={label}
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
