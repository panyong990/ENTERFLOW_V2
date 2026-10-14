import { useState, useMemo, useEffect, useLayoutEffect, useRef } from "react";
import { X, History, Pencil, Search, Boxes, ChevronDown, ChevronUp, Plus, SlidersHorizontal, CheckCircle2, AlertTriangle, CircleX } from "lucide-react";
import { Toaster, toast } from "sonner";
import { getFinishedGoodStockStatus, getRawMaterialStockStatus, useMaterials, partCategoryMeta, type FinishedGood, type PartCategory, type RawMaterial, type Unit } from "../store/materials";
import { FinishedGoodsOrderActivity } from "./FinishedGoodsOrderActivity";
import { useNotifications } from "../store/notifications";
import { NotificationBell } from "./NotificationBell";
import { useStockRequests } from "../store/stockRequests";
import { StockRequestsModal } from "./StockRequestsModal";
import { useSession } from "../store/session";
import { useOrders } from "../store/orders";

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

/* ─────────── Component ─────────── */

export function Inventory({ initialTab = "raw" }: { initialTab?: "raw" | "finished" }) {
  const { rawMaterials, finishedGoods: fg, updateMaterial, addMaterial } = useMaterials();
  const { role } = useSession();
  const { inquiries, completedJOs } = useOrders();
  const { requests: stockRequests } = useStockRequests();
  const { push: pushNotif } = useNotifications();

  const isOperationsReadOnly = role === "operations";
  const [tab, setTab] = useState<"raw" | "finished">(initialTab);
  const [editing, setEditing] = useState<RawMaterial | null>(null);
  const [historyFor, setHistoryFor] = useState<RawMaterial | null>(null);
  const [selectedItem, setSelectedItem] = useState<{ kind: "raw"; item: RawMaterial } | { kind: "finished"; item: FinishedGood } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<PartCategory>>(new Set());
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<PartCategory | "">("");
  const [statusFilter, setStatusFilter] = useState<"in-stock" | "low-stock" | "out-of-stock" | "">("");
  const [draftCategoryFilter, setDraftCategoryFilter] = useState<PartCategory | "">("");
  const [draftStatusFilter, setDraftStatusFilter] = useState<"in-stock" | "low-stock" | "out-of-stock" | "">("");
  const [contextMenu, setContextMenu] = useState<{ material: RawMaterial; x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const [showStockRequests, setShowStockRequests] = useState(false);
  const warehouseStockRequestCount = stockRequests.filter((request) => request.status === "pending" || request.status === "update_requested").length;
  const inventorySummary = useMemo(() => {
    const statuses = [
      ...rawMaterials.map((item) => getRawMaterialStockStatus(item).key),
      ...fg.map((item) => getFinishedGoodStockStatus(item).key),
    ];
    return {
      total: statuses.length,
      inStock: statuses.filter((status) => status === "in-stock").length,
      lowStock: statuses.filter((status) => status === "low-stock").length,
      outOfStock: statuses.filter((status) => status === "out-of-stock").length,
    };
  }, [rawMaterials, fg]);

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

  const toggleFilters = () => {
    setDraftCategoryFilter(categoryFilter);
    setDraftStatusFilter(statusFilter);
    setFilterOpen((open) => !open);
  };

  const applyFilters = () => {
    setCategoryFilter(draftCategoryFilter);
    setStatusFilter(draftStatusFilter);
    setFilterOpen(false);
  };

  const resetFilters = () => {
    setDraftCategoryFilter("");
    setDraftStatusFilter("");
    setCategoryFilter("");
    setStatusFilter("");
  };

  const activeFilterCount = Number(Boolean(categoryFilter)) + Number(Boolean(statusFilter));

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

  useEffect(() => {
    if (!filterOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) setFilterOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFilterOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [filterOpen]);

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
    const previousStatus = getRawMaterialStockStatus(m);
    const nextStatus = getRawMaterialStockStatus({ ...m, qtyInStock: newQty, threshold: newThreshold });
    updateMaterial(id, updates, reason, ref);
    /* Low stock notification */
    if (previousStatus.key === "in-stock" && nextStatus.key !== "in-stock") {
      pushNotif({
        dept: "system",
        title: `${nextStatus.label}: ${newName}`,
        body: `Only ${newQty.toFixed(2)} ${updates.unit ?? m.unit} remaining (threshold ${newThreshold} ${updates.unit ?? m.unit})`,
        link: "inventory",
        recipients: ["owner", "operations", "warehouse"],
      });
    }
    toast.success("Material updated · logged to audit history");
    setEditing(null);
  };

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
            {isOperationsReadOnly
              ? "Monitor raw materials, finished goods, and stock availability."
              : "Component-based raw materials · finished goods · audit log"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isOperationsReadOnly && (
            <button
              onClick={() => setShowStockRequests(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-dm"
              style={{ fontSize: 12, fontWeight: 700, color: "#1A2B4A" }}
            >
              STOCK REQUESTS
              <span className="px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: "#1A2B4A", fontSize: 10, fontWeight: 800 }}>{warehouseStockRequestCount}</span>
            </button>
          )}
          {!isOperationsReadOnly && tab === "raw" && (
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
        {isOperationsReadOnly && (
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Inventory summary">
            <InventoryMetric label="Total Inventory Items" value={inventorySummary.total} icon={<Boxes size={18} />} accent="#1A2B4A" />
            <InventoryMetric label="In Stock" value={inventorySummary.inStock} icon={<CheckCircle2 size={18} />} accent="#15803D" />
            <InventoryMetric label="Low Stock" value={inventorySummary.lowStock} icon={<AlertTriangle size={18} />} accent="#C2410C" />
            <InventoryMetric label="Out of Stock" value={inventorySummary.outOfStock} icon={<CircleX size={18} />} accent="#991B1B" />
          </section>
        )}

        {tab === "raw" && (
          <>
            <div className="flex items-center gap-2">
              <div className="relative max-w-md flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search material or supplier..."
                  className="font-dm w-full pl-9 pr-4 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white"
                  style={{ fontSize: 13 }}
                />
              </div>
              {isOperationsReadOnly && (
                <div ref={filterRef} className="relative">
                  <button
                    type="button"
                    onClick={toggleFilters}
                    aria-label="Filter inventory"
                    aria-expanded={filterOpen}
                    className="relative flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  >
                    <SlidersHorizontal size={16} />
                    {activeFilterCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-white" style={{ backgroundColor: "#C8102E", fontSize: 9, fontWeight: 700 }}>{activeFilterCount}</span>}
                  </button>
                  {filterOpen && (
                    <div className="absolute right-0 top-12 z-30 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                      <h3 className="font-syne mb-3" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Filter Inventory</h3>
                      <div className="flex flex-col gap-3">
                        <label className="flex flex-col gap-1.5 font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>
                          Category
                          <select value={draftCategoryFilter} onChange={(event) => setDraftCategoryFilter(event.target.value as PartCategory | "")} className="rounded-md border border-slate-200 bg-white px-3 py-2 outline-none focus:border-slate-400" style={{ fontSize: 12 }}>
                            <option value="">All categories</option>
                            {(Object.keys(partCategoryMeta) as PartCategory[]).map((category) => <option key={category} value={category}>{partCategoryMeta[category].label}</option>)}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1.5 font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>
                          Stock Status
                          <select value={draftStatusFilter} onChange={(event) => setDraftStatusFilter(event.target.value as typeof statusFilter)} className="rounded-md border border-slate-200 bg-white px-3 py-2 outline-none focus:border-slate-400" style={{ fontSize: 12 }}>
                            <option value="">All statuses</option>
                            <option value="in-stock">In Stock</option>
                            <option value="low-stock">Low Stock</option>
                            <option value="out-of-stock">Out of Stock</option>
                          </select>
                        </label>
                      </div>
                      <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
                        <button type="button" onClick={resetFilters} className="font-dm rounded-md border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Reset</button>
                        <button type="button" onClick={applyFilters} className="font-dm rounded-md px-3 py-2 text-white hover:opacity-90" style={{ fontSize: 12, fontWeight: 700, backgroundColor: "#1A2B4A" }}>Apply Filters</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Category accordions */}
            {(Object.keys(partCategoryMeta) as PartCategory[]).map((cat) => {
              const meta = partCategoryMeta[cat];
              const items = grouped[cat].filter((item) =>
                filterRow(item) &&
                (!isOperationsReadOnly || !statusFilter || getRawMaterialStockStatus(item).key === statusFilter)
              );
              const lowCount = items.filter((m) => getRawMaterialStockStatus(m).key !== "in-stock").length;
              const collapsed = collapsedCats.has(cat);
              if (items.length === 0 && (query !== "" || (isOperationsReadOnly && (categoryFilter || statusFilter)))) return null;
              if (isOperationsReadOnly && categoryFilter && categoryFilter !== cat) return null;
              return (
                <section key={cat} className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
                  <button onClick={() => toggleCat(cat)} className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span style={{ fontSize: 22 }}>{meta.icon}</span>
                      <div className="text-left">
                        <h3 className="font-syne" style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>{meta.label}</h3>
                        <p className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>{items.length} material{items.length !== 1 ? "s" : ""}{lowCount > 0 && ` · ⚠️ ${lowCount} low or out of stock`}</p>
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
                          const s = getRawMaterialStockStatus(m);
                          return (
                            <tr
                              key={m.id}
                              onClick={isOperationsReadOnly ? () => setSelectedItem({ kind: "raw", item: m }) : undefined}
                              onKeyDown={isOperationsReadOnly ? (event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setSelectedItem({ kind: "raw", item: m });
                                }
                              } : undefined}
                              onContextMenu={(event) => {
                                if (isOperationsReadOnly) {
                                  event.preventDefault();
                                  return;
                                }
                                event.preventDefault();
                                setContextMenu({ material: m, x: event.clientX, y: event.clientY });
                              }}
                              className={`border-t border-slate-200/70 hover:bg-slate-50${isOperationsReadOnly ? " cursor-pointer" : ""}`}
                              role={isOperationsReadOnly ? "button" : undefined}
                              tabIndex={isOperationsReadOnly ? 0 : undefined}
                              title={isOperationsReadOnly ? "View item details" : undefined}
                            >
                              <td className="px-4 py-3 font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>
                                {m.name}
                                {m.supplier && <div className="font-dm" style={{ fontSize: 10, color: "#94A3B8", marginTop: 1 }}>{m.supplier}</div>}
                              </td>
                              <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>{m.unit}</td>
                              <td className="px-4 py-3 font-syne" style={{ fontSize: 14, fontWeight: 700, color: s.fg }}>{m.qtyInStock.toFixed(2)} <span className="font-dm" style={{ fontSize: 10, fontWeight: 500, color: "#94A3B8" }}>{m.unit}</span></td>
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
          <FinishedGoodsOrderActivity onItemClick={isOperationsReadOnly ? (item) => setSelectedItem({ kind: "finished", item }) : undefined} />
        )}
      </div>

      {/* Update Material Modal */}
      {editing && (
        <UpdateStockModal m={editing} onClose={() => setEditing(null)} onSave={saveMaterial} />
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
      {showStockRequests && <StockRequestsModal mode="warehouse" onClose={() => setShowStockRequests(false)} />}
      {isOperationsReadOnly && selectedItem && (
        <InventoryDetailsDrawer
          selection={selectedItem}
          onClose={() => setSelectedItem(null)}
          relatedJobs={selectedItem.kind === "raw"
            ? Array.from(new Set(selectedItem.item.history.flatMap((entry) => {
              if (!entry.reference) return [];
              const exists = [...inquiries, ...completedJOs].some((job) => job.joNumber === entry.reference);
              return exists ? [entry.reference] : [];
            })))
            : []}
        />
      )}
    </div>
  );
}

function InventoryMetric({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent: string }) {
  return (
    <article className="bg-white rounded-xl border border-slate-200/70 p-4 flex items-center justify-between" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <div>
        <p className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>{label}</p>
        <p className="font-syne mt-1" style={{ fontSize: 24, fontWeight: 800, color: "#0F172A" }}>{value}</p>
      </div>
      <span className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${accent}14`, color: accent }}>{icon}</span>
    </article>
  );
}

type InventorySelection =
  | { kind: "raw"; item: RawMaterial }
  | { kind: "finished"; item: FinishedGood };

function InventoryDetailsDrawer({ selection, onClose, relatedJobs }: {
  selection: InventorySelection;
  onClose: () => void;
  relatedJobs: string[];
}) {
  const isRaw = selection.kind === "raw";
  const itemName = isRaw ? selection.item.name : selection.item.itemName;
  const status = isRaw
    ? getRawMaterialStockStatus(selection.item)
    : getFinishedGoodStockStatus(selection.item);
  const movements = isRaw
    ? selection.item.history.map((entry) => ({ ...entry, reference: entry.reference }))
    : selection.item.history.map((entry) => ({ ...entry, reference: undefined }));
  const details = isRaw
    ? [
      ["Category", partCategoryMeta[selection.item.category].label],
      ["Quantity on hand", `${selection.item.qtyInStock.toFixed(2)} ${selection.item.unit}`],
      ["Unit", selection.item.unit],
      ["Unit price", `₱${selection.item.unitPrice.toLocaleString("en-PH")}`],
      ["Low-stock threshold", `${selection.item.threshold} ${selection.item.unit}`],
      ...(selection.item.supplier ? [["Supplier", selection.item.supplier]] : []),
    ]
    : [
      ["Item code", selection.item.itemCode],
      ["Enter-Fil PN", selection.item.enterFilPN],
      ["Client", selection.item.client],
      ["Quantity on hand", `${selection.item.qtyInStock} pcs`],
      ["Buffer minimum", `${selection.item.bufferMin} pcs`],
      ["Demand", selection.item.demand],
      ["Last updated", selection.item.lastUpdated],
      ["Updated by", selection.item.updatedBy],
    ];
  const specs = isRaw ? [] : Object.entries(selection.item.specs).filter(([, value]) => Boolean(value));
  const specLabels: Record<string, string> = {
    od1: "OD 1",
    od2: "OD 2",
    id1: "ID 1",
    height: "Height",
    media: "Media",
    innerCore: "Inner core",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end" style={{ backgroundColor: "rgba(15,23,42,0.4)" }} onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label={`${itemName} inventory details`} className="bg-white h-full w-full max-w-md flex flex-col" style={{ boxShadow: "-20px 0 40px rgba(0,0,0,0.2)" }} onClick={(event) => event.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between" style={{ backgroundColor: "#1A2B4A" }}>
          <div className="min-w-0 pr-3">
            <p className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.65)", letterSpacing: 0.6, textTransform: "uppercase" }}>{isRaw ? "Raw Material" : "Finished Good"}</p>
            <h2 className="font-syne mt-1 text-white" style={{ fontSize: 17, fontWeight: 700 }}>{itemName}</h2>
            {!isRaw && <p className="font-dm mt-0.5" style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>{selection.item.itemCode}</p>}
          </div>
          <button type="button" aria-label="Close item details" onClick={onClose} className="w-8 h-8 shrink-0 rounded-md hover:bg-white/10 flex items-center justify-center"><X size={16} style={{ color: "white" }} /></button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
            <div>
              <p className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.4 }}>Stock status</p>
              <p className="font-syne mt-1" style={{ fontSize: 16, fontWeight: 700, color: status.fg }}>{status.label}</p>
            </div>
            <Boxes size={20} style={{ color: status.fg }} />
          </div>

          <section className="mt-5">
            <h3 className="font-syne mb-2" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Item information</h3>
            <dl className="grid grid-cols-2 gap-2">
              {details.map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 p-3">
                  <dt className="font-dm" style={{ fontSize: 10, fontWeight: 600, color: "#64748B" }}>{label}</dt>
                  <dd className="font-dm mt-1 break-words" style={{ fontSize: 12, fontWeight: 700, color: "#1E293B" }}>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {specs.length > 0 && (
            <section className="mt-5">
              <h3 className="font-syne mb-2" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Specifications</h3>
              <dl className="grid grid-cols-2 gap-2">
                {specs.map(([key, value]) => (
                  <div key={key} className="rounded-lg bg-slate-50 p-3">
                    <dt className="font-dm" style={{ fontSize: 10, fontWeight: 600, color: "#64748B" }}>{specLabels[key] ?? key}</dt>
                    <dd className="font-dm mt-1" style={{ fontSize: 12, fontWeight: 700, color: "#1E293B" }}>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section className="mt-5">
            <h3 className="font-syne mb-2" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Recent stock movements</h3>
            {movements.length === 0 ? (
              <p className="rounded-lg bg-slate-50 px-3 py-4 text-center font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>No stock movements recorded.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {movements.slice(0, 5).map((movement) => {
                  const date = new Date(movement.date);
                  const formattedDate = Number.isNaN(date.getTime())
                    ? movement.date
                    : `${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
                  const unit = isRaw ? selection.item.unit : "pcs";
                  const change = movement.newQty - movement.oldQty;
                  return (
                    <article key={movement.id} className="rounded-lg border border-slate-200 p-3">
                      <p className="font-dm" style={{ fontSize: 10, color: "#64748B" }}>{formattedDate}</p>
                      <p className="font-dm mt-1" style={{ fontSize: 12, fontWeight: 700, color: "#1E293B" }}>{movement.user}</p>
                      <p className="font-mono-jb mt-1" style={{ fontSize: 11, fontWeight: 600, color: change >= 0 ? "#15803D" : "#C8102E" }}>
                        {movement.oldQty.toFixed(2)} → {movement.newQty.toFixed(2)} {unit}
                      </p>
                      <p className="font-dm mt-1" style={{ fontSize: 11, color: "#475569" }}>{movement.reason}</p>
                      {movement.reference && <p className="font-mono-jb mt-1" style={{ fontSize: 10, color: "#1A2B4A" }}>Ref: {movement.reference}</p>}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {relatedJobs.length > 0 && (
            <section className="mt-5">
              <h3 className="font-syne mb-2" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Related production jobs</h3>
              <div className="flex flex-wrap gap-2">
                {relatedJobs.map((job) => <span key={job} className="rounded-md bg-slate-100 px-2.5 py-1 font-mono-jb" style={{ fontSize: 11, color: "#334155" }}>{job}</span>)}
              </div>
            </section>
          )}
        </div>
      </aside>
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
  const [editingDetails, setEditingDetails] = useState(false);

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
          <div className="min-w-0 pr-3">
            <h3 className="font-syne" style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Update Material</h3>
            <div className="flex items-center gap-1.5 mt-1">
              <p className="font-dm truncate" style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>{name || "Material name"}</p>
              <button
                type="button"
                aria-label={editingDetails ? "Hide material details" : "Edit material details"}
                aria-expanded={editingDetails}
                title={editingDetails ? "Hide material details" : "Edit material details"}
                onClick={() => setEditingDetails((open) => !open)}
                className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center hover:bg-slate-100"
                style={{ color: editingDetails ? "#1A2B4A" : "#64748B" }}
              >
                <Pencil size={12} />
              </button>
            </div>
            <p className="font-dm mt-0.5" style={{ fontSize: 11, color: "#64748B" }}>{partCategoryMeta[category].label} · {unit}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          {editingDetails && (
            <div className="rounded-lg border border-slate-200 p-3 flex flex-col gap-3">
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
                  <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Low Stock Threshold</label>
                  <input type="number" min="0" step="0.01" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
                </div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {!editingDetails && (
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Stock Quantity</label>
                <input type="number" min="0" step="0.01" value={qtyInStock} onChange={(e) => setQtyInStock(Number(e.target.value))} className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 15, fontWeight: 700 }} />
              </div>
            )}
            <div className="col-span-2 flex flex-col gap-1.5">
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
