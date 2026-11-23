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
import { RealWarehouseStockRequests } from "./RealWarehouseStockRequests";
import { RealWarehouseShipments } from "./RealWarehouseShipments";
import { createInventoryMaterial as createInventoryMaterialRequest, updateInventoryMaterial as updateInventoryMaterialRequest } from "../api/inventory";
import { materialObservationFields } from "../store/inventoryModel.js";

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
type RealMaterialUpdate = Partial<Pick<RawMaterial, "name" | "category" | "unit">> & { quantityOnHand?: string | null; threshold?: string | null; supplier?: string | null; reason?: string; referenceUnitPrice?: string | null };
type RealMaterialCreate = { name: string; category: PartCategory | null; unit: string; threshold: string | null; supplier: string | null; referenceUnitPrice?: string; quantityOnHand?: string; reason?: string };

/* ─────────── Component ─────────── */

export function Inventory({ initialTab = "raw" }: { initialTab?: "raw" | "finished" }) {
  const { rawMaterials, finishedGoods: fg, updateMaterial, addMaterial, inventoryLoading, inventoryError, refreshInventory } = useMaterials();
  const { role, mode } = useSession();
  const realMode = mode === "real";
  const { inquiries, completedJOs } = useOrders();
  const { requests: stockRequests } = useStockRequests();
  const { push: pushNotif } = useNotifications();

  const isOperationsReadOnly = role === "operations";
  const canMaintainRealMaterials = realMode && (role === "warehouse" || role === "admin");
  const readOnly = isOperationsReadOnly || (realMode && !canMaintainRealMaterials);
  const [tab, setTab] = useState<"raw" | "finished">(initialTab);
  const [editing, setEditing] = useState<RawMaterial | null>(null);
  const [historyFor, setHistoryFor] = useState<RawMaterial | null>(null);
  const [selectedItem, setSelectedItem] = useState<{ kind: "raw"; item: RawMaterial } | { kind: "finished"; item: FinishedGood } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<PartCategory | "uncategorized">>(new Set());
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<PartCategory | "">("");
  const [statusFilter, setStatusFilter] = useState<"in-stock" | "low-stock" | "out-of-stock" | "unavailable" | "">("");
  const [draftCategoryFilter, setDraftCategoryFilter] = useState<PartCategory | "">("");
  const [draftStatusFilter, setDraftStatusFilter] = useState<"in-stock" | "low-stock" | "out-of-stock" | "unavailable" | "">("");
  const [contextMenu, setContextMenu] = useState<{ material: RawMaterial; x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const [showStockRequests, setShowStockRequests] = useState(false);
  const [showShipments, setShowShipments] = useState(false);
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
    const categories = Object.fromEntries(
      (Object.keys(partCategoryMeta) as PartCategory[]).map((category) => [category, [] as RawMaterial[]])
    ) as Record<PartCategory, RawMaterial[]>;
    const unclassified: RawMaterial[] = [];
    rawMaterials.forEach((material) => {
      if (material.category) categories[material.category].push(material);
      else unclassified.push(material);
    });
    return { categories, unclassified };
  }, [rawMaterials]);

  const filterRow = (m: RawMaterial) =>
    query === "" ||
    m.name.toLowerCase().includes(query.toLowerCase()) ||
    (m.itemCode ?? m.catalogCode ?? "").toLowerCase().includes(query.toLowerCase()) ||
    (m.supplier ?? "").toLowerCase().includes(query.toLowerCase());
  const hasVisibleRawMaterials = rawMaterials.some((item) =>
    filterRow(item) &&
    (!readOnly || !categoryFilter || item.category === categoryFilter) &&
    (!readOnly || !statusFilter || getRawMaterialStockStatus(item).key === statusFilter)
  );
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

  const toggleCat = (c: PartCategory | "uncategorized") => {
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

  const saveRealMaterial = async (id: string, updates: RealMaterialUpdate) => {
    await updateInventoryMaterialRequest(id, updates);
    refreshInventory();
    toast.success("Material details updated.");
    setEditing(null);
  };

  const createRealMaterial = async (input: RealMaterialCreate) => {
    await createInventoryMaterialRequest(input);
    refreshInventory();
    toast.success("Material record created.");
    setShowAdd(false);
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
          {(!realMode || contextMenu.material.source === "database") ? (
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
          ) : (
            <span role="menuitem" aria-disabled="true" className="font-dm block px-3 py-2 text-xs text-slate-500">Catalog reference · not editable</span>
          )}
          {!realMode && <button
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
            </button>}
        </div>
      )}

      <header className="bg-white border-b border-slate-200/70 px-8 py-5 sticky top-0 z-10 flex items-start justify-between">
        <div>
          <h1 className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>Inventory</h1>
          <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>
            {readOnly
              ? "Monitor raw materials, finished goods, and stock availability."
              : "Component-based raw materials · finished goods · audit log"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {((realMode && role === "warehouse") || (!realMode && !readOnly)) && (
            <button
              onClick={() => setShowStockRequests(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-dm"
              style={{ fontSize: 12, fontWeight: 700, color: "#1A2B4A" }}
            >
              {realMode && role === "warehouse" ? "INCOMING STOCK REQUESTS" : "STOCK REQUESTS"}
              {!realMode && <span className="px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: "#1A2B4A", fontSize: 10, fontWeight: 800 }}>{warehouseStockRequestCount}</span>}
            </button>
          )}
          {(canMaintainRealMaterials || (!realMode && !readOnly)) && tab === "raw" && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white font-dm hover:opacity-90"
              style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.3 }}
            >
              <Plus size={15} strokeWidth={2.5} /> Add Raw Material
            </button>
          )}
          {realMode && role === "warehouse" && <button type="button" onClick={() => setShowShipments(true)} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 font-dm text-xs font-bold text-[#1A2B4A] hover:bg-slate-50">SHIPMENTS</button>}
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
        {readOnly && role !== "warehouse" && (
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Inventory summary">
            <InventoryMetric label="Total Inventory Items" value={realMode ? "—" : inventorySummary.total} icon={<Boxes size={18} />} accent="#1A2B4A" />
            <InventoryMetric label="In Stock" value={realMode ? "—" : inventorySummary.inStock} icon={<CheckCircle2 size={18} />} accent="#15803D" />
            <InventoryMetric label="Low Stock" value={realMode ? "—" : inventorySummary.lowStock} icon={<AlertTriangle size={18} />} accent="#C2410C" />
            <InventoryMetric label="Out of Stock" value={realMode ? "—" : inventorySummary.outOfStock} icon={<CircleX size={18} />} accent="#991B1B" />
          </section>
        )}

        {tab === "raw" && (
          <>
            {realMode && inventoryError && (
              <p role="alert" className="font-dm text-sm text-red-800">
                Authenticated inventory could not be loaded. {inventoryError}
                <button type="button" onClick={refreshInventory} className="ml-2 underline">Retry</button>
              </p>
            )}
            {realMode && inventoryLoading && <p role="status" className="font-dm text-sm text-slate-500">Loading inventory…</p>}
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
              {readOnly && (
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
                            <option value="unavailable">Not recorded</option>
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
            {[...(Object.keys(partCategoryMeta) as PartCategory[]), "uncategorized" as const].map((cat) => {
              const sectionCategory: PartCategory | null = cat === "uncategorized" ? null : cat;
              const meta = sectionCategory ? partCategoryMeta[sectionCategory] : { label: "Uncategorized", icon: "📦" };
              const items = (sectionCategory ? grouped.categories[sectionCategory] : grouped.unclassified).filter((item) =>
                filterRow(item) &&
                (!readOnly || !statusFilter || getRawMaterialStockStatus(item).key === statusFilter)
              );
              const lowCount = items.filter((m) => ["low-stock", "out-of-stock"].includes(getRawMaterialStockStatus(m).key)).length;
              const collapsed = collapsedCats.has(cat);
              if (cat === "uncategorized" && grouped.unclassified.length === 0) return null;
              if (items.length === 0 && (query !== "" || (readOnly && (categoryFilter || statusFilter)))) return null;
              if (readOnly && categoryFilter && categoryFilter !== sectionCategory) return null;
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
                          {(realMode ? ["Material Name", "Qty in Stock", "Unit", "Unit Price", "Threshold", "Status"] : ["Material Name", "Unit", "Qty in Stock", "Unit Price", "Threshold", "Status"]).map((h) => (
                            <th key={h} className="font-dm text-left px-4 py-2.5" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((m) => {
                          const s = getRawMaterialStockStatus(m);
                          const quantity = Number.isFinite(m.qtyInStock) && (!realMode || m.quantityStatus === "verified" || m.quantityStatus === "provisional_sample")
                            ? `${realMode ? m.qtyInStock.toLocaleString("en-PH", { maximumFractionDigits: 4 }) : `${m.qtyInStock.toFixed(2)} ${m.unit}`}${m.quantityStatus === "provisional_sample" ? " · sample" : ""}`
                            : "Not recorded";
                          const priceValue = realMode ? m.referenceUnitPrice : m.unitPrice;
                          const price = Number.isFinite(priceValue)
                            ? `\u20B1${priceValue!.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                            : "Not recorded";
                          return (
                            <tr
                              key={m.id}
                              onClick={readOnly ? () => setSelectedItem({ kind: "raw", item: m }) : undefined}
                              onKeyDown={readOnly ? (event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setSelectedItem({ kind: "raw", item: m });
                                }
                              } : undefined}
                              onContextMenu={(event) => {
                                if (readOnly) {
                                  event.preventDefault();
                                  return;
                                }
                                event.preventDefault();
                                setContextMenu({ material: m, x: event.clientX, y: event.clientY });
                              }}
                              className={`border-t border-slate-200/70 hover:bg-slate-50${readOnly ? " cursor-pointer" : ""}`}
                              role={readOnly ? "button" : undefined}
                              tabIndex={readOnly ? 0 : undefined}
                              title={readOnly ? "View item details" : undefined}
                            >
                              <td className="px-4 py-3 font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>
                                {m.name}
                                {(m.itemCode || m.catalogCode) && <div className="font-mono-jb mt-0.5" style={{ fontSize: 10, color: "#64748B" }}>{m.itemCode ?? m.catalogCode}</div>}
                                {realMode && <div className="font-dm mt-0.5" style={{ fontSize: 10, color: "#64748B" }}>{m.source === "database" ? "Authenticated material" : "Catalog reference"}</div>}
                                {m.supplier && <div className="font-dm" style={{ fontSize: 10, color: "#94A3B8", marginTop: 1 }}>{m.supplier}</div>}
                              </td>
                              {realMode ? (
                                <>
                                  <td className="px-4 py-3 font-syne" style={{ fontSize: 14, fontWeight: 700, color: s.fg }}>{quantity}</td>
                                  <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>{m.unit}</td>
                                </>
                              ) : (
                                <>
                                  <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>{m.unit}</td>
                                  <td className="px-4 py-3 font-syne" style={{ fontSize: 14, fontWeight: 700, color: s.fg }}>{quantity}</td>
                                </>
                              )}
                              <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, color: "#0F172A" }}>{price}</td>
                              <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#64748B" }}>{Number.isFinite(m.threshold) ? `${m.threshold}${m.thresholdStatus === "provisional_sample" ? " · sample" : ""}` : "Not recorded"}</td>
                              <td className="px-4 py-3"><span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: s.bg, color: s.fg }}>{m.quantityStatus === "provisional_sample" ? `Sample · ${s.label}` : s.label}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </section>
              );
            })}
            {!hasVisibleRawMaterials && (
              <p role={inventoryLoading ? "status" : inventoryError ? "alert" : "status"} className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center font-dm" style={{ fontSize: 13, color: "#64748B" }}>
                {inventoryLoading
                  ? "Loading inventory…"
                  : inventoryError
                    ? "Inventory is unavailable. Retry inventory above."
                    : rawMaterials.length === 0
                      ? "No raw materials are available."
                      : "No materials match the selected search and filters."}
              </p>
            )}
          </>
        )}

        {tab === "finished" && (
          <FinishedGoodsOrderActivity onItemClick={readOnly ? (item) => setSelectedItem({ kind: "finished", item }) : undefined} />
        )}
      </div>

      {/* Update Material Modal */}
      {editing && (
        <UpdateStockModal
          m={editing}
          realMode={realMode}
          onClose={() => setEditing(null)}
          onSave={saveMaterial}
          onRealSave={saveRealMaterial}
        />
      )}

      {/* Add Material Modal */}
      {showAdd && (
        realMode
          ? <AddMaterialModal realMode units={[...new Set(rawMaterials.filter((m) => m.source === "database").map((m) => m.unit))].sort()} onClose={() => setShowAdd(false)} onAdd={createRealMaterial} />
          : <AddMaterialModal
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
      {showStockRequests && (realMode ? <RealWarehouseStockRequests onClose={() => setShowStockRequests(false)} /> : <StockRequestsModal mode="warehouse" onClose={() => setShowStockRequests(false)} />)}
      {showShipments && <RealWarehouseShipments onClose={() => setShowShipments(false)} />}
      {readOnly && selectedItem && (
        <InventoryDetailsDrawer
          realMode={realMode}
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

function InventoryMetric({ label, value, icon, accent }: { label: string; value: number | string; icon: React.ReactNode; accent: string }) {
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

function InventoryDetailsDrawer({ selection, onClose, relatedJobs, realMode }: {
  realMode?: boolean;
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
      ["Item code", selection.item.itemCode ?? selection.item.catalogCode ?? "Not recorded"],
      ["Category", selection.item.category ? partCategoryMeta[selection.item.category].label : "Uncategorized"],
      ["Quantity on hand", Number.isFinite(selection.item.qtyInStock) ? `${selection.item.qtyInStock.toFixed(2)} ${selection.item.unit}${realMode && selection.item.quantityStatus === "provisional_sample" ? " · sample" : ""}` : "Not recorded"],
      ["Unit", selection.item.unit],
      [realMode ? "Approved costing price" : "Unit price", Number.isFinite(realMode ? selection.item.approvedCostingPrice : selection.item.unitPrice)
        ? `₱${(realMode ? selection.item.approvedCostingPrice : selection.item.unitPrice)!.toLocaleString("en-PH")}`
        : "Not recorded"],
      ...(realMode ? [["Source reference price (not approved)", selection.item.referencePriceText
        ?? (Number.isFinite(selection.item.referenceUnitPrice) ? `₱${selection.item.referenceUnitPrice!.toLocaleString("en-PH")}` : "Not listed")]] : []),
      ...(realMode && selection.item.referencePriceSource ? [["Reference price source", selection.item.referencePriceSource]] : []),
      ["Low-stock threshold", Number.isFinite(selection.item.threshold) ? `${selection.item.threshold} ${selection.item.unit}${realMode && selection.item.thresholdStatus === "provisional_sample" ? " · sample" : ""}` : "Not recorded"],
      ...(realMode && selection.item.referencePriceStatus ? [["Reference price review", selection.item.referencePriceStatus]] : []),
      ...(selection.item.supplier ? [["Supplier", selection.item.supplier]] : []),
    ]
    : [
      ["Item code", selection.item.itemCode],
      ["Enter-Fil PN", selection.item.enterFilPN],
      ["Client", selection.item.client],
      ["Quantity on hand", Number.isFinite(selection.item.qtyInStock) ? `${selection.item.qtyInStock} pcs` : "Not recorded"],
      ["Buffer minimum", Number.isFinite(selection.item.bufferMin) ? `${selection.item.bufferMin} pcs` : "Not recorded"],
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
            {(isRaw ? selection.item.itemCode ?? selection.item.catalogCode : selection.item.itemCode) && <p className="font-dm mt-0.5" style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>{isRaw ? selection.item.itemCode ?? selection.item.catalogCode : selection.item.itemCode}</p>}
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
              <p className="rounded-lg bg-slate-50 px-3 py-4 text-center font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>{realMode ? "Stock movement history is not supplied by the inventory API." : "No stock movements recorded."}</p>
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
function UpdateStockModal({ m, onClose, onSave, realMode = false, onRealSave }: {
  m: RawMaterial;
  onClose: () => void;
  onSave: (id: string, updates: Partial<EditableMaterialFields>, reason: string, ref?: string) => void;
  realMode?: boolean;
  onRealSave?: (id: string, updates: RealMaterialUpdate) => Promise<void>;
}) {
  const [name, setName] = useState(m.name);
  const [category, setCategory] = useState<PartCategory | null>(m.category);
  const [unit, setUnit] = useState<string>(m.unit);
  const [unitPrice, setUnitPrice] = useState(m.unitPrice);
  const [realPrice, setRealPrice] = useState(
    Number.isFinite(m.referenceUnitPrice)
      ? String(m.referenceUnitPrice)
      : ""
  );
  const [priceEdited, setPriceEdited] = useState(false);
  const [qtyInStock, setQtyInStock] = useState(m.qtyInStock);
  const [realQtyInStock, setRealQtyInStock] = useState(Number.isFinite(m.qtyInStock) ? String(m.qtyInStock) : "");
  const [quantityObserved, setQuantityObserved] = useState(false);
  const [threshold, setThreshold] = useState(m.threshold);
  const [realThreshold, setRealThreshold] = useState(Number.isFinite(m.threshold) ? String(m.threshold) : "");
  const [thresholdObserved, setThresholdObserved] = useState(false);
  const [supplier, setSupplier] = useState(m.supplier ?? "");
  const [reason, setReason] = useState(STOCK_REASONS[0]);
  const [ref, setRef] = useState("");
  const [editingDetails, setEditingDetails] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (realMode) {
      if (!name.trim()) {
        toast.error("Material name is required");
        return;
      }
      if (realQtyInStock && (!/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(realQtyInStock) || Number(realQtyInStock) > 1000000000)) {
        toast.error("Stock quantity must be a non-negative number with at most four decimals");
        return;
      }
      if (realMode && realQtyInStock !== "" &&
          ["pc","sheet","box","bag","sack","sets","bundle","roll","pc/gal"].includes(unit.trim().toLowerCase()) &&
          !Number.isInteger(Number(realQtyInStock))) {
        toast.error("Stock quantity must be a whole number for this unit");
        return;
      }
      if (realThreshold && (!/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(realThreshold) || Number(realThreshold) > 1000000000)) {
        toast.error("Threshold must be blank or a non-negative number with at most four decimals");
        return;
      }
      const updates: RealMaterialUpdate = materialObservationFields({
        quantity: realQtyInStock, threshold: realThreshold, quantityObserved, thresholdObserved,
      });
      if (priceEdited && realPrice !== "" &&
        (!/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(realPrice) ||
         Number(realPrice) > 1000000000)) {
        toast.error("Unit Price must be a non-negative amount with up to four decimals");
        return;
      }
      if (priceEdited) {
        updates.referenceUnitPrice = realPrice === "" ? null : realPrice;
      }
      if (quantityObserved || priceEdited) updates.reason = reason;
      if (name.trim() !== m.name) updates.name = name.trim();
      if (category !== m.category) updates.category = category;
      if (unit !== m.unit) updates.unit = unit;
      const normalizedSupplier = supplier.trim() || null;
      if (normalizedSupplier !== (m.supplier ?? null)) updates.supplier = normalizedSupplier;
      if (Object.keys(updates).length === 0) {
        onClose();
        return;
      }
      setSaving(true);
      try {
        await onRealSave?.(m.id, updates);
      } catch (cause) {
        toast.error(cause instanceof Error ? cause.message : "Material update failed.");
      } finally {
        setSaving(false);
      }
      return;
    }

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
            <p className="font-dm mt-0.5" style={{ fontSize: 11, color: "#64748B" }}>{category ? partCategoryMeta[category].label : "Uncategorized"} · {unit}</p>
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
                  <select value={category ?? ""} onChange={(e) => setCategory(e.target.value ? e.target.value as PartCategory : null)} className="font-dm px-3 py-2 rounded-md border border-slate-200 bg-white outline-none focus:border-slate-400" style={{ fontSize: 13, color: "#0F172A" }}>
                    <option value="">Uncategorized</option>
                    {(Object.keys(partCategoryMeta) as PartCategory[]).map((c) => <option key={c} value={c}>{partCategoryMeta[c].label}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Unit</label>
                  <select value={unit} onChange={(e) => setUnit(e.target.value)} className="font-dm px-3 py-2 rounded-md border border-slate-200 bg-white outline-none focus:border-slate-400" style={{ fontSize: 13, color: "#0F172A" }}>
                    {m.unit && !UNITS.includes(m.unit as Unit) && <option value={m.unit}>{m.unit}</option>}
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Unit Price (₱)</label>
                  <input type="number" min="0" step="0.01" value={realMode ? realPrice : unitPrice}
                  disabled={saving}
                  onChange={(e) => {
                    if (realMode) {
                      setRealPrice(e.target.value);
                      setPriceEdited(true);
                    } else {
                      setUnitPrice(Number(e.target.value));
                    }
                  }} className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white disabled:bg-slate-100" style={{ fontSize: 13 }} placeholder={realMode ? "Not available" : undefined} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Low Stock Threshold</label>
                  <input type="number" min="0" max="1000000000" step="0.0001" value={realMode ? realThreshold : threshold} onChange={(e) => { if (realMode) { setRealThreshold(e.target.value); setThresholdObserved(true); } else setThreshold(Number(e.target.value)); }} className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
                </div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {!editingDetails && (
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Stock Quantity</label>
                <input type="number" min="0" max="1000000000" step={realMode && ["pc","sheet","box","bag","sack","sets","bundle","roll","pc/gal"].includes(unit.trim().toLowerCase()) ? "1" : "0.0001"} value={realMode ? realQtyInStock : qtyInStock} disabled={saving} onChange={(e) => { if (realMode) { setRealQtyInStock(e.target.value); setQuantityObserved(true); } else setQtyInStock(Number(e.target.value)); }} className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white disabled:bg-slate-100" style={{ fontSize: 15, fontWeight: 700 }} placeholder={realMode ? "Not recorded" : undefined} />
              </div>
            )}
            <div className="col-span-2 flex flex-col gap-1.5">
              <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Supplier <span style={{ fontWeight: 400, color: "#94A3B8" }}>(optional)</span></label>
              <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g. ABC Trading" className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
            </div>
          </div>
          <div className="border-t border-slate-200 pt-4 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Reason</label>
                <select value={reason} onChange={(e) => setReason(e.target.value)} className="font-dm px-3 py-2 rounded-md border border-slate-200 bg-white outline-none focus:border-slate-400 disabled:bg-slate-100" style={{ fontSize: 13, color: "#0F172A" }}>
                  {STOCK_REASONS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Reference <span style={{ fontWeight: 400, color: "#94A3B8" }}>(PO #)</span></label>
                <input value={ref} disabled={realMode} onChange={(e) => setRef(e.target.value)} placeholder="e.g. PO-SUPP-2026-041" className="font-mono-jb px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white disabled:bg-slate-100" style={{ fontSize: 13 }} />
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} disabled={saving} className="font-dm px-4 py-2 rounded-md hover:bg-slate-100 disabled:opacity-50" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Cancel</button>
          <button onClick={() => void submit()} disabled={saving} className="font-dm px-4 py-2 rounded-md text-white hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700 }}>{saving ? "Saving…" : "💾 Save"}</button>
        </div>
      </div>
    </div>
  );
}

type DemoMaterialCreate = { name: string; category: PartCategory; unit: Unit; unitPrice: number; qtyInStock: number; threshold: number; supplier?: string };
type AddMaterialModalProps = {
  onClose: () => void;
} & (
  | { realMode: true; units: string[]; onAdd: (input: RealMaterialCreate) => Promise<void> }
  | { realMode?: false; onAdd: (material: DemoMaterialCreate) => void }
);

function AddMaterialModal(props: AddMaterialModalProps) {
  const { onClose } = props;
  const realMode = props.realMode === true;
  const [name, setName] = useState("");
  const [category, setCategory] = useState<PartCategory>("filter_media");
  const [unit, setUnit] = useState<Unit>("roll");
  const [unitPrice, setUnitPrice] = useState(0);
  const [qtyInStock, setQtyInStock] = useState(0);
  const [realUnitPrice, setRealUnitPrice] = useState("");
  const [realOpeningQty, setRealOpeningQty] = useState("");
  const [threshold, setThreshold] = useState(realMode ? "" : "0");
  const [supplier, setSupplier] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (props.realMode) {
      const validNumber = (value: string) =>
        /^(?:0|[1-9][0-9]*)(?:[.][0-9]{1,4})?$/.test(value) &&
        Number(value) <= 1000000000;

      const wholeUnits = new Set(["pc","pcs","sheet","plate","box","bag","sack","set","sets","bundle","roll","pc/gal"]);

      if (realUnitPrice !== "" && !validNumber(realUnitPrice)) {
        setError("Enter a valid Unit Price (maximum four decimals).");
        return;
      }

      if (realOpeningQty !== "" &&
          (!validNumber(realOpeningQty) ||
           (wholeUnits.has(unit.trim().toLowerCase()) &&
            !Number.isInteger(Number(realOpeningQty))))) {
        setError("Enter a valid Initial Stock Qty for the selected unit.");
        return;
      }

      if (threshold && (!/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(threshold) || Number(threshold) > 1000000000)) {
        setError("Threshold must be blank or a non-negative number with at most four decimals.");
        return;
      }
      setSaving(true);
      setError("");
      try {
        await props.onAdd({
          name: name.trim(),
          category,
          unit,
          threshold: threshold || null,
          supplier: supplier.trim() || null,
          referenceUnitPrice: realUnitPrice || undefined,
          quantityOnHand: realOpeningQty || undefined,
          reason: realOpeningQty !== "" || realUnitPrice !== ""
            ? "Initial raw material registration"
            : undefined,
        });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Material creation failed.");
      } finally {
        setSaving(false);
      }
      return;
    }
    props.onAdd({ name: name.trim(), category, unit, unitPrice, qtyInStock, threshold: Number(threshold), supplier: supplier.trim() || undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.5)" }} onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-xl w-full max-w-lg" style={{ boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between" style={{ backgroundColor: "#1A2B4A" }}>
          <h3 className="font-syne text-white" style={{ fontSize: 16, fontWeight: 700 }}>Add Raw Material</h3>
          <button disabled={saving} onClick={onClose} className="w-8 h-8 rounded-md hover:bg-white/10 flex items-center justify-center"><X size={16} style={{ color: "white" }} /></button>
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
                {(props.realMode ? props.units : UNITS).map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Unit Price (₱)</label>
              <input type="number" min="0" max="1000000000" step={realMode ? "0.0001" : undefined}
                value={realMode ? realUnitPrice : unitPrice}
                disabled={saving}
                placeholder={realMode ? "Not recorded" : undefined}
                onChange={(e) => realMode
                  ? setRealUnitPrice(e.target.value)
                  : setUnitPrice(Number(e.target.value))} className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white disabled:bg-slate-100" style={{ fontSize: 13 }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Initial Stock Qty</label>
              <input type="number" min="0" max="1000000000"
                step={realMode
                  ? (["pc","pcs","sheet","plate","box","bag","sack","set","sets","bundle","roll","pc/gal"].includes(unit.toLowerCase()) ? "1" : "0.0001")
                  : "0.01"}
                value={realMode ? realOpeningQty : qtyInStock}
                disabled={saving}
                placeholder={realMode ? "Not recorded" : undefined}
                onChange={(e) => realMode
                  ? setRealOpeningQty(e.target.value)
                  : setQtyInStock(Number(e.target.value))} className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white disabled:bg-slate-100" style={{ fontSize: 13 }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Low Stock Threshold</label>
              <input type="number" min="0" step="0.0001" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Supplier <span style={{ fontWeight: 400, color: "#94A3B8" }}>(optional)</span></label>
              <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Optional" className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
            </div>
          </div>
          {error && <p role="alert" className="font-dm text-sm text-red-800">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} disabled={saving} className="font-dm px-4 py-2 rounded-md hover:bg-slate-100 disabled:opacity-50" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Cancel</button>
          <button onClick={() => void submit()} disabled={saving} className="font-dm px-4 py-2 rounded-md text-white hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700 }}>{saving ? "Saving…" : "+ Add Material"}</button>
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
