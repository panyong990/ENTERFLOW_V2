import { useState, useMemo, useEffect, useLayoutEffect, useRef } from "react";
import { X, History, Pencil, Search, Boxes, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useMaterials, partCategoryMeta, type PartCategory, type RawMaterial, type Unit } from "../store/materials";
import { useNotifications } from "../store/notifications";
import { NotificationBell } from "./NotificationBell";

const STOCK_REASONS = [
  "Restocked from supplier",
  "Physical count / recount",
  "Used in production",
  "Damaged",
  "Returned to stock",
  "Correction",
];

const UNITS: Unit[] = ["roll", "plate", "sheet", "kg", "gal", "pcs", "set", "m"];
type EditableMaterialFields = Pick<RawMaterial, "name" | "category" | "unit" | "unitPrice" | "qtyInStock" | "threshold" | "supplier">;

function statusFor(m: RawMaterial): { label: string; bg: string; fg: string } {
  if (m.qtyInStock <= 0) return { label: "🔴 OUT OF STOCK", bg: "#FEE2E2", fg: "#991B1B" };
  if (m.qtyInStock < m.threshold) {
    /* CRITICAL for adhesive, box; otherwise LOW */
    const isCritical = m.category === "bonding_adhesive" || m.category === "packaging";
    return isCritical
      ? { label: "🔴 CRITICAL", bg: "#FEE2E2", fg: "#991B1B" }
      : { label: "🟡 LOW", bg: "#FEF3C7", fg: "#B45309" };
  }
  return { label: "🟢 OK", bg: "#DCFCE7", fg: "#15803D" };
}

/* ─────────── Finished Goods (kept simple) ─────────── */
interface FinishedGood {
  id: string; itemCode: string; enterFilPN: string; itemName: string;
  client: string; qtyInStock: number; bufferMin: number; lastUpdated: string;
  updatedBy: string; demand: "HIGH DEMAND" | "MONITOR" | "STABLE";
  specs: { od1?: string; od2?: string; id1?: string; height?: string; media?: string; innerCore?: string };
}
const finishedSeed: FinishedGood[] = [
  { id: "f1", itemCode: "OILSEP-00001", enterFilPN: "KF-OS.107.65.252",      itemName: "Air Filter",            client: "B.E. Aerospace",   qtyInStock: 12, bufferMin: 30, lastUpdated: "Apr 26, 2026", updatedBy: "F. Santos", specs: { od1: "115", od2: "103", id1: "64.6", height: "500", media: "Microglass Fiber" }, demand: "HIGH DEMAND" },
  { id: "f2", itemCode: "OILSEP-00002", enterFilPN: "KF-OS.200/167.108.160", itemName: "Oil Separator Filter",  client: "G.U. Engineering", qtyInStock: 18, bufferMin: 15, lastUpdated: "Apr 24, 2026", updatedBy: "F. Santos", specs: { od1: "200", od2: "167", id1: "108", height: "160", media: "Microglass Fiber" }, demand: "STABLE" },
  { id: "f3", itemCode: "OILFIL-00181", enterFilPN: "KF-OF.175.20.87",       itemName: "Pleated Filter ZS20",   client: "Maynilad",         qtyInStock: 80, bufferMin: 100, lastUpdated: "Apr 25, 2026", updatedBy: "F. Santos", specs: { od1: "175", id1: "20",  height: "87",  media: "Pleated ZS20" }, demand: "HIGH DEMAND" },
  { id: "f4", itemCode: "OILFIL-00182", enterFilPN: "KF-OF.180.41.115",      itemName: "Column Filter",         client: "Emerald Vinyl",    qtyInStock: 5,  bufferMin: 10,  lastUpdated: "Apr 22, 2026", updatedBy: "F. Santos", specs: { od1: "180", id1: "41",  height: "115", media: "Round Fiberglass H13" }, demand: "MONITOR" },
];
const demandStyle = {
  "HIGH DEMAND": { bg: "#FEE2E2", fg: "#991B1B" },
  "MONITOR":     { bg: "#FEF3C7", fg: "#B45309" },
  "STABLE":      { bg: "#DCFCE7", fg: "#15803D" },
};

/* ─────────── Component ─────────── */

export function Inventory() {
  const { rawMaterials, updateMaterial, addMaterial } = useMaterials();
  const { push: pushNotif } = useNotifications();

  const [tab, setTab] = useState<"raw" | "finished">("raw");
  const [editing, setEditing] = useState<RawMaterial | null>(null);
  const [historyFor, setHistoryFor] = useState<RawMaterial | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<PartCategory>>(new Set());
  const [query, setQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<{ material: RawMaterial; x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const [fg, setFg] = useState<FinishedGood[]>(finishedSeed);
  const [fgQuery, setFgQuery] = useState("");
  const [fgEditing, setFgEditing] = useState<FinishedGood | null>(null);

  /* group by category */
  const grouped = useMemo(() => {
    const out: Record<PartCategory, RawMaterial[]> = {} as any;
    (Object.keys(partCategoryMeta) as PartCategory[]).forEach((c) => (out[c] = []));
    rawMaterials.forEach((m) => out[m.category].push(m));
    return out;
  }, [rawMaterials]);

  const filterRow = (m: RawMaterial) =>
    query === "" ||
    m.name.toLowerCase().includes(query.toLowerCase()) ||
    (m.supplier ?? "").toLowerCase().includes(query.toLowerCase());

  const toggleCat = (c: PartCategory) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  };

  useEffect(() => {
    if (!contextMenu) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!contextMenuRef.current?.contains(event.target as Node)) setContextMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(null);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [contextMenu]);

  useLayoutEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return;

    const { width, height } = contextMenuRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(contextMenu.x, window.innerWidth - width));
    const y = Math.max(0, Math.min(contextMenu.y, window.innerHeight - height));
    if (x !== contextMenu.x || y !== contextMenu.y) {
      setContextMenu((current) => current ? { ...current, x, y } : current);
    }
  }, [contextMenu]);

  const saveMaterial = (id: string, updates: Partial<EditableMaterialFields>, reason: string, ref?: string) => {
    const m = rawMaterials.find((x) => x.id === id);
    if (!m) return;
    if (Object.keys(updates).length === 0) {
      setEditing(null);
      return;
    }
    const newQty = updates.qtyInStock ?? m.qtyInStock;
    const newThreshold = updates.threshold ?? m.threshold;
    const newName = updates.name ?? m.name;
    updateMaterial(id, updates, reason, ref);
    /* Low stock notification */
    if (newQty < newThreshold && m.qtyInStock >= newThreshold) {
      pushNotif({
        dept: "system",
        title: `🔴 Low stock: ${newName}`,
        body: `Only ${newQty.toFixed(2)} ${updates.unit ?? m.unit} remaining (threshold ${newThreshold} ${updates.unit ?? m.unit})`,
        link: "inventory",
        recipients: ["owner", "operations", "warehouse"],
      });
    }
    toast.success("Material updated · logged to audit history");
    setEditing(null);
  };

  const visibleFG = fg.filter(
    (f) =>
      fgQuery === "" ||
      f.itemName.toLowerCase().includes(fgQuery.toLowerCase()) ||
      f.client.toLowerCase().includes(fgQuery.toLowerCase()) ||
      f.enterFilPN.toLowerCase().includes(fgQuery.toLowerCase())
  );

  return (
    <div className="flex-1 h-full overflow-auto" style={{ backgroundColor: "#F4F6F9" }}>
      <Toaster position="bottom-right" richColors />

      {contextMenu && (
        <div
          ref={contextMenuRef}
          role="menu"
          className="fixed z-40 min-w-36 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setEditing(contextMenu.material);
              setContextMenu(null);
            }}
            className="font-dm flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
            style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}
          >
            <Pencil size={13} /> Update
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setHistoryFor(contextMenu.material);
              setContextMenu(null);
            }}
            className="font-dm flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
            style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}
          >
            <History size={13} /> History
          </button>
        </div>
      )}

      <header className="bg-white border-b border-slate-200/70 px-8 py-5 sticky top-0 z-10 flex items-start justify-between">
        <div>
          <h1 className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>Inventory</h1>
          <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>
            Component-based raw materials · finished goods · audit log
          </p>
        </div>
        <div className="flex items-center gap-3">
          {tab === "raw" && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white font-dm hover:opacity-90"
              style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.3 }}
            >
              <Plus size={15} strokeWidth={2.5} /> Add Raw Material
            </button>
          )}
          <NotificationBell />
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white border-b border-slate-200/70 px-8 flex gap-1">
        {([
          { id: "raw" as const,      label: "Raw Materials",  count: rawMaterials.length },
          { id: "finished" as const, label: "Finished Goods", count: fg.length },
        ]).map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="font-dm px-5 py-3 transition-colors flex items-center gap-2"
              style={{
                fontSize: 13, fontWeight: 600,
                color: active ? "#C8102E" : "#64748B",
                borderBottom: active ? "3px solid #C8102E" : "3px solid transparent",
                marginBottom: -1,
              }}
            >
              {t.label}
              <span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: active ? "#FEE2E2" : "#F1F5F9", color: active ? "#C8102E" : "#64748B" }}>{t.count}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-8 py-8 flex flex-col gap-6">
        {tab === "raw" && (
          <>
            {/* Search */}
            <div className="relative max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search material or supplier..."
                className="font-dm w-full pl-9 pr-4 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white"
                style={{ fontSize: 13 }}
              />
            </div>

            {/* Category accordions */}
            {(Object.keys(partCategoryMeta) as PartCategory[]).map((cat) => {
              const meta = partCategoryMeta[cat];
              const items = grouped[cat].filter(filterRow);
              const lowCount = items.filter((m) => m.qtyInStock < m.threshold).length;
              const collapsed = collapsedCats.has(cat);
              if (items.length === 0 && query !== "") return null;
              return (
                <section key={cat} className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
                  <button onClick={() => toggleCat(cat)} className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span style={{ fontSize: 22 }}>{meta.icon}</span>
                      <div className="text-left">
                        <h3 className="font-syne" style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>{meta.label}</h3>
                        <p className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>{items.length} material{items.length !== 1 ? "s" : ""}{lowCount > 0 && ` · ⚠️ ${lowCount} below threshold`}</p>
                      </div>
                    </div>
                    {collapsed ? <ChevronDown size={18} style={{ color: "#94A3B8" }} /> : <ChevronUp size={18} style={{ color: "#94A3B8" }} />}
                  </button>
                  {!collapsed && items.length > 0 && (
                    <table className="w-full">
                      <thead style={{ backgroundColor: "#F4F6F9" }}>
                        <tr>
                          {["Material Name", "Unit", "Qty in Stock", "Unit Price", "Threshold", "Status"].map((h) => (
                            <th key={h} className="font-dm text-left px-4 py-2.5" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((m) => {
                          const s = statusFor(m);
                          return (
                            <tr
                              key={m.id}
                              onContextMenu={(event) => {
                                event.preventDefault();
                                setContextMenu({ material: m, x: event.clientX, y: event.clientY });
                              }}
                              className="border-t border-slate-200/70 hover:bg-slate-50"
                            >
                              <td className="px-4 py-3 font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>
                                {m.name}
                                {m.supplier && <div className="font-dm" style={{ fontSize: 10, color: "#94A3B8", marginTop: 1 }}>{m.supplier}</div>}
                              </td>
                              <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>{m.unit}</td>
                              <td className="px-4 py-3 font-syne" style={{ fontSize: 14, fontWeight: 700, color: m.qtyInStock < m.threshold ? "#C8102E" : "#0F172A" }}>{m.qtyInStock.toFixed(2)} <span className="font-dm" style={{ fontSize: 10, fontWeight: 500, color: "#94A3B8" }}>{m.unit}</span></td>
                              <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, color: "#0F172A" }}>₱{m.unitPrice.toLocaleString("en-PH")}</td>
                              <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#64748B" }}>{m.threshold}</td>
                              <td className="px-4 py-3"><span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: s.bg, color: s.fg }}>{s.label}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </section>
              );
            })}
          </>
        )}

        {tab === "finished" && (
          <section className="flex flex-col gap-4">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="font-syne" style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>Finished Goods Stock</h2>
                <p className="font-dm mt-0.5" style={{ fontSize: 12, color: "#64748B" }}>{fg.length} item codes</p>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} />
                <input
                  value={fgQuery}
                  onChange={(e) => setFgQuery(e.target.value)}
                  placeholder="Search item, client, PN..."
                  className="font-dm pl-9 pr-4 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white"
                  style={{ fontSize: 13, width: 280 }}
                />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
              <table className="w-full">
                <thead style={{ backgroundColor: "#F4F6F9" }}>
                  <tr>
                    {["Item Code", "Enter-Fil PN", "Item Name", "Client", "Qty in Stock", "Buffer Min", "Demand", "Last Updated", ""].map((h) => (
                      <th key={h} className="font-dm text-left px-3 py-3" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleFG.map((f) => {
                    const ds = demandStyle[f.demand];
                    const low = f.qtyInStock < f.bufferMin;
                    return (
                      <tr key={f.id} className="border-t border-slate-200/70 hover:bg-slate-50">
                        <td className="px-3 py-3 font-mono-jb" style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}>{f.itemCode}</td>
                        <td className="px-3 py-3 font-mono-jb" style={{ fontSize: 12, color: "#475569" }}>{f.enterFilPN}</td>
                        <td className="px-3 py-3 font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{f.itemName}</td>
                        <td className="px-3 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{f.client}</td>
                        <td className="px-3 py-3 font-syne" style={{ fontSize: 16, fontWeight: 800, color: low ? "#C8102E" : "#0F172A" }}>{f.qtyInStock} <span className="font-dm" style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8" }}>pcs</span></td>
                        <td className="px-3 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{f.bufferMin}</td>
                        <td className="px-3 py-3"><span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: ds.bg, color: ds.fg }}>{f.demand}</span></td>
                        <td className="px-3 py-3 font-dm" style={{ fontSize: 11, color: "#64748B" }}>{f.lastUpdated} · {f.updatedBy}</td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => setFgEditing(f)}
                            className="font-dm flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 hover:bg-white"
                            style={{ fontSize: 11, fontWeight: 600, color: "#1A2B4A" }}
                          >
                            <Pencil size={11} /> Update
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {visibleFG.length === 0 && (
                    <tr><td colSpan={8} className="px-6 py-10 text-center font-dm" style={{ fontSize: 13, color: "#94A3B8" }}>
                      <Boxes size={28} style={{ color: "#CBD5E1", margin: "0 auto 8px" }} />
                      No finished goods match your search.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* Update Material Modal */}
      {editing && (
        <UpdateStockModal m={editing} onClose={() => setEditing(null)} onSave={saveMaterial} />
      )}

      {/* Update Finished Good Modal */}
      {fgEditing && (
        <FinishedGoodUpdateModal
          item={fgEditing}
          onClose={() => setFgEditing(null)}
          onSave={(id, newQty, reason) => {
            setFg((prev) => prev.map((f) => f.id === id ? {
              ...f,
              qtyInStock: newQty,
              lastUpdated: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
              updatedBy: "F. Santos",
            } : f));
            toast.success(`Stock updated: ${fgEditing.itemName} → ${newQty} pcs · Reason: ${reason}`);
            setFgEditing(null);
          }}
        />
      )}

      {/* Add Material Modal */}
      {showAdd && (
        <AddMaterialModal
          onClose={() => setShowAdd(false)}
          onAdd={(m) => {
            addMaterial(m);
            toast.success(`${m.name} added to inventory`);
            setShowAdd(false);
          }}
        />
      )}

      {/* History Drawer */}
      {historyFor && (
        <HistoryDrawer m={historyFor} onClose={() => setHistoryFor(null)} />
      )}
    </div>
  );
}

/* ───────── Update Material Modal ───────── */
function UpdateStockModal({ m, onClose, onSave }: {
  m: RawMaterial;
  onClose: () => void;
  onSave: (id: string, updates: Partial<EditableMaterialFields>, reason: string, ref?: string) => void;
}) {
  const [name, setName] = useState(m.name);
  const [category, setCategory] = useState<PartCategory>(m.category);
  const [unit, setUnit] = useState<Unit>(m.unit);
  const [unitPrice, setUnitPrice] = useState(m.unitPrice);
  const [qtyInStock, setQtyInStock] = useState(m.qtyInStock);
  const [threshold, setThreshold] = useState(m.threshold);
  const [supplier, setSupplier] = useState(m.supplier ?? "");
  const [reason, setReason] = useState(STOCK_REASONS[0]);
  const [ref, setRef] = useState("");

  const submit = () => {
    const values = [unitPrice, qtyInStock, threshold];
    if (!name.trim()) {
      toast.error("Material name is required");
      return;
    }
    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      toast.error("Price, stock quantity, and threshold must be valid non-negative numbers");
      return;
    }

    const normalizedName = name.trim();
    const normalizedSupplier = supplier.trim() || undefined;
    const updates: Partial<EditableMaterialFields> = {};
    if (normalizedName !== m.name) updates.name = normalizedName;
    if (category !== m.category) updates.category = category;
    if (unit !== m.unit) updates.unit = unit;
    if (unitPrice !== m.unitPrice) updates.unitPrice = unitPrice;
    if (qtyInStock !== m.qtyInStock) updates.qtyInStock = qtyInStock;
    if (threshold !== m.threshold) updates.threshold = threshold;
    if (normalizedSupplier !== m.supplier) updates.supplier = normalizedSupplier;

    onSave(m.id, updates, reason, ref.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.5)" }} onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col" style={{ boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-syne" style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Update Material</h3>
            <p className="font-dm mt-0.5" style={{ fontSize: 11, color: "#64748B" }}>{partCategoryMeta[m.category].label} · {m.unit}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Material Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as PartCategory)} className="font-dm px-3 py-2 rounded-md border border-slate-200 bg-white outline-none focus:border-slate-400" style={{ fontSize: 13, color: "#0F172A" }}>
                {(Object.keys(partCategoryMeta) as PartCategory[]).map((c) => <option key={c} value={c}>{partCategoryMeta[c].label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Unit</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)} className="font-dm px-3 py-2 rounded-md border border-slate-200 bg-white outline-none focus:border-slate-400" style={{ fontSize: 13, color: "#0F172A" }}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Unit Price (₱)</label>
              <input type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Stock Quantity</label>
              <input type="number" min="0" step="0.01" value={qtyInStock} onChange={(e) => setQtyInStock(Number(e.target.value))} className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Low Stock Threshold</label>
              <input type="number" min="0" step="0.01" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Supplier <span style={{ fontWeight: 400, color: "#94A3B8" }}>(optional)</span></label>
              <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g. ABC Trading" className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
            </div>
          </div>
          <div className="border-t border-slate-200 pt-4 flex flex-col gap-3">
            <div className="font-dm" style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Stock adjustment audit</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Reason</label>
                <select value={reason} onChange={(e) => setReason(e.target.value)} className="font-dm px-3 py-2 rounded-md border border-slate-200 bg-white outline-none focus:border-slate-400" style={{ fontSize: 13, color: "#0F172A" }}>
                  {STOCK_REASONS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Reference <span style={{ fontWeight: 400, color: "#94A3B8" }}>(PO #)</span></label>
                <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. PO-SUPP-2026-041" className="font-mono-jb px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
              </div>
            </div>
            <div className="rounded-md p-2 font-dm" style={{ fontSize: 11, color: "#92400E", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
              ℹ️ Changes are logged to the material audit history.
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="font-dm px-4 py-2 rounded-md hover:bg-slate-100" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Cancel</button>
          <button onClick={submit} className="font-dm px-4 py-2 rounded-md text-white hover:opacity-90" style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700 }}>💾 Save</button>
        </div>
      </div>
    </div>
  );
}

/* ───────── Add Raw Material Modal ───────── */
function AddMaterialModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (m: { name: string; category: PartCategory; unit: Unit; unitPrice: number; qtyInStock: number; threshold: number; supplier?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<PartCategory>("filter_media");
  const [unit, setUnit] = useState<Unit>("roll");
  const [unitPrice, setUnitPrice] = useState(0);
  const [qtyInStock, setQtyInStock] = useState(0);
  const [threshold, setThreshold] = useState(0);
  const [supplier, setSupplier] = useState("");

  const submit = () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    onAdd({ name: name.trim(), category, unit, unitPrice, qtyInStock, threshold, supplier: supplier.trim() || undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.5)" }} onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg" style={{ boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between" style={{ backgroundColor: "#1A2B4A" }}>
          <h3 className="font-syne text-white" style={{ fontSize: 16, fontWeight: 700 }}>Add Raw Material</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-white/10 flex items-center justify-center"><X size={16} style={{ color: "white" }} /></button>
        </div>
        <div className="p-5 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Material Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. F8 Yellow (Pocket Bag)" className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Category</label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(partCategoryMeta) as PartCategory[]).map((c) => (
                <button key={c} type="button" onClick={() => setCategory(c)} className="font-dm px-2.5 py-1.5 rounded-md border" style={{ fontSize: 11, fontWeight: 700, backgroundColor: category === c ? "#1A2B4A" : "white", color: category === c ? "white" : "#475569", borderColor: category === c ? "#1A2B4A" : "#CBD5E1" }}>
                  {partCategoryMeta[c].icon} {partCategoryMeta[c].label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Unit</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)} className="font-dm px-3 py-2 rounded-md border border-slate-200 bg-white outline-none focus:border-slate-400" style={{ fontSize: 13, color: "#0F172A" }}>
                {UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Unit Price (₱)</label>
              <input type="number" value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Initial Stock Qty</label>
              <input type="number" step="0.01" value={qtyInStock} onChange={(e) => setQtyInStock(Number(e.target.value))} className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Low Stock Threshold</label>
              <input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Supplier <span style={{ fontWeight: 400, color: "#94A3B8" }}>(optional)</span></label>
              <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Optional" className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="font-dm px-4 py-2 rounded-md hover:bg-slate-100" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Cancel</button>
          <button onClick={submit} className="font-dm px-4 py-2 rounded-md text-white hover:opacity-90" style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700 }}>+ Add Material</button>
        </div>
      </div>
    </div>
  );
}

/* ───────── History Drawer ───────── */
function HistoryDrawer({ m, onClose }: { m: RawMaterial; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end" style={{ backgroundColor: "rgba(15,23,42,0.4)" }} onClick={onClose}>
      <div className="bg-white h-full w-full max-w-md flex flex-col" style={{ boxShadow: "-20px 0 40px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between" style={{ backgroundColor: "#1A2B4A" }}>
          <div>
            <h3 className="font-syne text-white" style={{ fontSize: 16, fontWeight: 700 }}>Audit History</h3>
            <p className="font-dm mt-0.5" style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{m.name} · {m.qtyInStock.toFixed(2)} {m.unit} on hand</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-white/10 flex items-center justify-center"><X size={16} style={{ color: "white" }} /></button>
        </div>
        <div className="flex-1 overflow-auto p-5">
          {m.history.length === 0 ? (
            <div className="text-center py-8 font-dm" style={{ fontSize: 13, color: "#94A3B8" }}>
              <History size={28} style={{ color: "#CBD5E1", margin: "0 auto 8px" }} />
              No changes recorded yet.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {m.history.map((h) => {
                const date = new Date(h.date);
                const fmt = `${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
                const change = h.newQty - h.oldQty;
                const isIncrease = change > 0;
                const fieldLabels: Record<string, string> = {
                  name: "Material name",
                  category: "Category",
                  unit: "Unit",
                  unitPrice: "Unit price",
                  threshold: "Low-stock threshold",
                  supplier: "Supplier",
                };
                const formatValue = (field: string, value: string) => {
                  if (field === "category" && value in partCategoryMeta) return partCategoryMeta[value as PartCategory].label;
                  if (field === "unitPrice") return `₱${Number(value).toLocaleString("en-PH")}`;
                  if (field === "supplier") return value || "Not set";
                  return value;
                };
                return (
                  <div key={h.id} className="rounded-lg p-3 border" style={{ borderColor: "#E2E8F0", backgroundColor: "#FAFBFC" }}>
                    <div className="font-dm" style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>{fmt}</div>
                    <div className="font-dm mt-0.5" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{h.user}</div>
                    {change !== 0 && (
                      <div className="font-mono-jb mt-1.5" style={{ fontSize: 12, color: isIncrease ? "#16A34A" : "#C8102E", fontWeight: 600 }}>
                        {isIncrease ? "↑" : "↓"} {h.oldQty.toFixed(2)} → {h.newQty.toFixed(2)} {m.unit}
                        <span className="ml-2 font-dm" style={{ color: "#64748B", fontWeight: 400 }}>
                          ({isIncrease ? "+" : ""}{change.toFixed(2)})
                        </span>
                      </div>
                    )}
                    {h.changes?.map(({ field, oldValue, newValue }) => (
                      <div key={field} className="font-dm mt-1" style={{ fontSize: 12, color: "#475569" }}>
                        {fieldLabels[field] ?? field}: {formatValue(field, oldValue)} → {formatValue(field, newValue)}
                      </div>
                    ))}
                    <div className="font-dm mt-1" style={{ fontSize: 12, color: "#475569" }}>Reason: {h.reason}</div>
                    {h.reference && (
                      <div className="font-mono-jb mt-0.5" style={{ fontSize: 11, color: "#1A2B4A" }}>Ref: {h.reference}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Finished Good Update Modal ─────────── */
function FinishedGoodUpdateModal({ item, onClose, onSave }: {
  item: FinishedGood;
  onClose: () => void;
  onSave: (id: string, newQty: number, reason: string) => void;
}) {
  const [newQty, setNewQty] = useState(item.qtyInStock);
  const [reason, setReason] = useState("");
  const change = newQty - item.qtyInStock;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.55)" }} onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md" style={{ boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-syne" style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Update Finished Good Stock</h3>
            <p className="font-dm mt-0.5" style={{ fontSize: 11, color: "#64748B" }}>{item.itemName} · {item.itemCode}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="rounded-lg p-3 flex items-center justify-between" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
            <span className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>Current stock</span>
            <span className="font-syne" style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>{item.qtyInStock} pcs</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.4, textTransform: "uppercase" }}>New Quantity (pcs)</label>
            <input
              type="number"
              min={0}
              value={newQty}
              onChange={(e) => setNewQty(Number(e.target.value))}
              className="font-syne w-full px-3 py-2.5 rounded-md border-2 border-slate-300 outline-none focus:border-slate-500 bg-white"
              style={{ fontSize: 22, fontWeight: 800, color: "#0F172A" }}
            />
            {change !== 0 && (
              <span className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: change > 0 ? "#16A34A" : "#C8102E" }}>
                {change > 0 ? "↑ Added" : "↓ Removed"} {Math.abs(change)} pcs
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.4, textTransform: "uppercase" }}>Reason *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Received from production · Shipped to client · Damaged/scrapped"
              rows={2}
              className="font-dm w-full px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white resize-none"
              style={{ fontSize: 13 }}
            />
          </div>
        </div>
        <div className="px-5 pb-5 flex justify-end gap-2">
          <button onClick={onClose} className="font-dm px-4 py-2 rounded-md hover:bg-slate-100" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Cancel</button>
          <button
            onClick={() => {
              if (!reason.trim()) { toast.error("Please provide a reason"); return; }
              onSave(item.id, newQty, reason.trim());
            }}
            disabled={newQty < 0}
            className="font-dm px-5 py-2 rounded-md text-white hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: "#1A2B4A", fontSize: 13, fontWeight: 700 }}
          >
            Save Update
          </button>
        </div>
      </div>
    </div>
  );
}
