import { useState } from "react";
import { X, History, Pencil, Search, Boxes, ChevronDown, ChevronUp } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useMaterials, type Material, type MaterialKey } from "../store/materials";
import { useNotifications } from "../store/notifications";
import { NotificationBell } from "./NotificationBell";

interface StockHistoryEntry {
  date: string;
  user: string;
  old: number;
  next: number;
  reason: string;
}

const seedHistory: Record<MaterialKey, StockHistoryEntry[]> = {
  mediaLocal: [
    { date: "Apr 20, 2026 · 10:14 AM", user: "F. Santos · Warehouse", old: 8, next: 12, reason: "New stock received" },
  ],
  mediaImported: [
    { date: "Apr 01, 2026 · 8:42 AM", user: "F. Santos · Warehouse", old: 0, next: 8, reason: "Import batch arrived" },
  ],
  adhesive: [
    { date: "Apr 26, 2026 · 2:15 PM", user: "F. Santos · Warehouse", old: 5, next: 2, reason: "Used in production" },
    { date: "Apr 20, 2026 · 9:22 AM", user: "F. Santos · Warehouse", old: 0, next: 5, reason: "New stock received" },
  ],
  box: [
    { date: "Apr 24, 2026 · 11:50 AM", user: "F. Santos · Warehouse", old: 80, next: 45, reason: "Used in production" },
  ],
};

const reasons = ["Physical count / recount", "New stock received", "Used in production", "Damaged", "Returned", "Correction"];

/* ─── Finished Goods seed ─── */
interface FinishedGood {
  id: string;
  itemCode: string;
  enterFilPN: string;
  itemName: string;
  client: string;
  qtyInStock: number;
  bufferMin: number;
  lastUpdated: string;
  updatedBy: string;
  specs: { od1?: string; od2?: string; id1?: string; height?: string; media?: string; innerCore?: string };
  demand: "HIGH DEMAND" | "MONITOR" | "STABLE";
}

const finishedSeed: FinishedGood[] = [
  { id: "f1", itemCode: "OILSEP-00001", enterFilPN: "KF-OS.107.65.252", itemName: "Air Filter", client: "B.E. Aerospace", qtyInStock: 12, bufferMin: 30, lastUpdated: "Apr 26, 2026", updatedBy: "F. Santos", specs: { od1: "115", od2: "103", id1: "64.6", height: "500", media: "Microglass Fiber", innerCore: "Expanded Metal Perfo 2mm" }, demand: "HIGH DEMAND" },
  { id: "f2", itemCode: "OILSEP-00002", enterFilPN: "KF-OS.200/167.108.160", itemName: "Oil Separator Filter", client: "G.U. Engineering", qtyInStock: 18, bufferMin: 15, lastUpdated: "Apr 24, 2026", updatedBy: "F. Santos", specs: { od1: "200", od2: "167", id1: "108", height: "160", media: "Microglass Fiber" }, demand: "STABLE" },
  { id: "f3", itemCode: "OILFIL-00181", enterFilPN: "KF-OF.175.20.87", itemName: "Pleated Filter ZS20", client: "Maynilad", qtyInStock: 80, bufferMin: 100, lastUpdated: "Apr 25, 2026", updatedBy: "F. Santos", specs: { od1: "175", id1: "20", height: "87", media: "Pleated ZS20 w/ Double Alum Screen" }, demand: "HIGH DEMAND" },
  { id: "f4", itemCode: "OILFIL-00182", enterFilPN: "KF-OF.180.41.115", itemName: "Column Filter", client: "Emerald Vinyl", qtyInStock: 5, bufferMin: 10, lastUpdated: "Apr 22, 2026", updatedBy: "F. Santos", specs: { od1: "180", id1: "41", height: "115", media: "Round Fiberglass H13" }, demand: "MONITOR" },
];

const demandStyle = {
  "HIGH DEMAND": { bg: "#FEE2E2", fg: "#991B1B" },
  "MONITOR":     { bg: "#FEF3C7", fg: "#B45309" },
  "STABLE":      { bg: "#DCFCE7", fg: "#15803D" },
};

interface FGHistoryEntry { date: string; user: string; old: number; next: number; reason: string }

export function Inventory() {
  const { materials } = useMaterials();
  const { push: pushNotif } = useNotifications();
  const [counts, setCounts] = useState<Record<MaterialKey, number>>(() =>
    materials.reduce((acc, m) => ({ ...acc, [m.key]: m.available }), {} as Record<MaterialKey, number>)
  );
  const [importBatch, setImportBatch] = useState("May 15, 2026");
  const [history, setHistory] = useState<Record<MaterialKey, StockHistoryEntry[]>>(seedHistory);
  const [editing, setEditing] = useState<MaterialKey | null>(null);

  /* Finished goods state */
  const [fgList, setFgList] = useState<FinishedGood[]>(finishedSeed);
  const [fgQuery, setFgQuery] = useState("");
  const [fgExpanded, setFgExpanded] = useState<string | null>(null);
  const [fgEditing, setFgEditing] = useState<FinishedGood | null>(null);
  const [fgHistoryFor, setFgHistoryFor] = useState<string | null>(null);
  const [fgHistory, setFgHistory] = useState<Record<string, FGHistoryEntry[]>>({
    f1: [{ date: "Apr 26, 2026 · 2:15 PM", user: "F. Santos · Warehouse", old: 25, next: 12, reason: "Used in production" }],
    f3: [{ date: "Apr 25, 2026 · 9:30 AM", user: "F. Santos · Warehouse", old: 60, next: 80, reason: "Received from production" }],
  });

  const visibleFG = fgList.filter((f) =>
    fgQuery === "" || f.itemName.toLowerCase().includes(fgQuery.toLowerCase()) ||
    f.client.toLowerCase().includes(fgQuery.toLowerCase()) || f.enterFilPN.toLowerCase().includes(fgQuery.toLowerCase())
  );

  const saveCount = (key: MaterialKey, next: number, reason: string) => {
    const old = counts[key];
    const mat = materials.find(m => m.key === key);
    setCounts((p) => ({ ...p, [key]: next }));
    setHistory((p) => ({
      ...p,
      [key]: [{
        date: new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }),
        user: "F. Santos · Warehouse", old, next, reason,
      }, ...p[key]],
    }));
    /* Notify if crossed below threshold */
    if (mat && key !== "mediaImported" && old > mat.threshold && next <= mat.threshold) {
      pushNotif({
        dept: "system",
        title: `🔴 Low stock: ${mat.label}`,
        body: `Only ${next} ${mat.unit} remaining — reorder triggered`,
        link: "inventory",
        recipients: ["owner", "operations", "warehouse"],
      });
    }
    setEditing(null);
    toast.success("Stock updated · logged to audit history");
  };

  const saveFGCount = (id: string, next: number, reason: string) => {
    const fg = fgList.find(f => f.id === id);
    if (!fg) return;
    const old = fg.qtyInStock;
    const stamp = new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
    setFgList(prev => prev.map(f => f.id === id ? { ...f, qtyInStock: next, lastUpdated: stamp, updatedBy: "F. Santos" } : f));
    setFgHistory(prev => ({
      ...prev,
      [id]: [{ date: stamp, user: "F. Santos · Warehouse", old, next, reason }, ...(prev[id] ?? [])],
    }));
    setFgEditing(null);
    toast.success("Finished goods updated · logged to audit history");
  };

  return (
    <div className="flex-1 h-full overflow-auto" style={{ backgroundColor: "#F4F6F9" }}>
      <Toaster position="bottom-right" richColors />

      <header className="bg-white border-b border-slate-200/70 px-8 py-5 sticky top-0 z-10 flex items-start justify-between">
        <div>
          <h1 className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>
            Inventory
          </h1>
          <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>
            Finished goods stock management · Critical raw material alerts · Full audit log
          </p>
        </div>
        <NotificationBell />
      </header>

      <div className="px-8 py-8 flex flex-col gap-8">
        {/* SECTION 1 — Critical Stock Levels */}
        <section className="flex flex-col gap-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-syne" style={{ fontSize: 20, fontWeight: 800, color: "#0F172A" }}>Critical Raw Material Alerts</h2>
              <p className="font-dm mt-0.5" style={{ fontSize: 12, color: "#64748B" }}>Adhesive · Box · Filter Media — manually updated, logged to audit history</p>
            </div>
            <span className="font-dm text-right" style={{ fontSize: 11, color: "#94A3B8" }}>
              No auto-deduction (no standard measurement per filter)
            </span>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {materials.map((m) => (
              <MaterialCard
                key={m.key}
                m={m}
                value={counts[m.key]}
                importBatch={m.key === "mediaImported" ? importBatch : undefined}
                onChangeImportBatch={m.key === "mediaImported" ? setImportBatch : undefined}
                onEdit={() => setEditing(m.key)}
              />
            ))}
          </div>

          {/* Separate audit log table for critical materials */}
          <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden mt-2" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
            <div className="px-5 py-4 border-b border-slate-200/70 flex items-center justify-between">
              <div>
                <h3 className="font-syne" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Critical Materials Audit Log</h3>
                <p className="font-dm mt-0.5" style={{ fontSize: 11, color: "#64748B" }}>Every stock change recorded with date, time, user, old/new qty, and reason</p>
              </div>
              <span className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>{Object.values(history).reduce((s, h) => s + h.length, 0)} entries</span>
            </div>
            <table className="w-full">
              <thead style={{ backgroundColor: "#F4F6F9" }}>
                <tr>
                  {["Date · Time", "Material", "User", "Old → New", "Reason"].map((h) => (
                    <th key={h} className="font-dm text-left px-4 py-3" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  /* Combine all material histories with material label */
                  const all = materials.flatMap((m) =>
                    (history[m.key] ?? []).map((h) => ({ ...h, material: m.label, unit: m.unit, key: m.key }))
                  );
                  /* Sort newest first by date string (lexicographic on parsed date) */
                  all.sort((a, b) => b.date.localeCompare(a.date));
                  if (all.length === 0) {
                    return <tr><td colSpan={5} className="px-4 py-6 text-center font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>No stock changes recorded yet.</td></tr>;
                  }
                  return all.map((h, i) => (
                    <tr key={i} className="border-t border-slate-200/70 hover:bg-slate-50">
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>{h.date}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{h.material}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>{h.user}</td>
                      <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, color: "#0F172A" }}>{h.old} → {h.next} {h.unit}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>{h.reason}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION 2 — Finished Goods */}
        <section className="flex flex-col gap-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-syne" style={{ fontSize: 20, fontWeight: 800, color: "#0F172A" }}>Finished Goods Stock</h2>
              <p className="font-dm mt-0.5" style={{ fontSize: 12, color: "#64748B" }}>{fgList.length} item codes · expand a row to see specs · update count to log changes</p>
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
                  {["", "Item Code", "Enter-Fil PN", "Item Name", "Client", "Qty in Stock", "Buffer Min", "Demand", "Last Updated", ""].map((h, i) => (
                    <th key={i} className="font-dm text-left px-3 py-3" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleFG.map((f) => {
                  const isExpanded = fgExpanded === f.id;
                  const isHistoryOpen = fgHistoryFor === f.id;
                  const ds = demandStyle[f.demand];
                  const low = f.qtyInStock < f.bufferMin;
                  return (
                    <>
                      <tr
                        key={f.id}
                        className="border-t border-slate-200/70 hover:bg-slate-50 cursor-pointer"
                        onClick={() => setFgExpanded(isExpanded ? null : f.id)}
                      >
                        <td className="px-3 py-3">{isExpanded ? <ChevronUp size={14} style={{ color: "#94A3B8" }} /> : <ChevronDown size={14} style={{ color: "#94A3B8" }} />}</td>
                        <td className="px-3 py-3 font-mono-jb" style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}>{f.itemCode}</td>
                        <td className="px-3 py-3 font-mono-jb" style={{ fontSize: 12, color: "#475569" }}>{f.enterFilPN}</td>
                        <td className="px-3 py-3 font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{f.itemName}</td>
                        <td className="px-3 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{f.client}</td>
                        <td className="px-3 py-3 font-syne" style={{ fontSize: 16, fontWeight: 800, color: low ? "#C8102E" : "#0F172A" }}>{f.qtyInStock} <span className="font-dm" style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8" }}>pcs</span></td>
                        <td className="px-3 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{f.bufferMin}</td>
                        <td className="px-3 py-3"><span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: ds.bg, color: ds.fg }}>{f.demand}</span></td>
                        <td className="px-3 py-3 font-dm" style={{ fontSize: 11, color: "#64748B" }}>{f.lastUpdated} · {f.updatedBy}</td>
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setFgEditing(f)}
                              className="font-dm flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-100"
                              style={{ fontSize: 11, fontWeight: 600, color: "#1A2B4A" }}
                            >
                              <Pencil size={11} /> Update
                            </button>
                            <button
                              onClick={() => setFgHistoryFor(isHistoryOpen ? null : f.id)}
                              className="font-dm flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-100"
                              style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}
                            >
                              <History size={11} /> History
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr style={{ backgroundColor: "#F8FAFC" }}>
                          <td colSpan={10} className="px-6 py-4">
                            <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Full Specs</div>
                            <div className="grid grid-cols-6 gap-3">
                              {Object.entries(f.specs).filter(([, v]) => v).map(([k, v]) => (
                                <div key={k}>
                                  <div className="font-dm" style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.3 }}>{k}</div>
                                  <div className="font-mono-jb" style={{ fontSize: 12, color: "#0F172A", fontWeight: 600 }}>{v}</div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                      {isHistoryOpen && (
                        <tr style={{ backgroundColor: "#FFFBEB" }}>
                          <td colSpan={10} className="px-6 py-4">
                            <div className="font-dm mb-2 flex items-center gap-2" style={{ fontSize: 11, fontWeight: 700, color: "#92400E", letterSpacing: 0.4, textTransform: "uppercase" }}>
                              <History size={12} /> Inventory Audit Log — {f.itemName}
                            </div>
                            {(fgHistory[f.id] ?? []).length === 0 ? (
                              <div className="font-dm" style={{ fontSize: 12, color: "#94A3B8", fontStyle: "italic" }}>No changes recorded yet.</div>
                            ) : (
                              <table className="w-full">
                                <thead>
                                  <tr>
                                    {["Date · Time", "User", "Old → New", "Reason"].map((h) => (
                                      <th key={h} className="font-dm text-left px-2 py-1" style={{ fontSize: 10, fontWeight: 700, color: "#92400E", letterSpacing: 0.3, textTransform: "uppercase" }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(fgHistory[f.id] ?? []).map((h, i) => (
                                    <tr key={i} className="border-t border-amber-200">
                                      <td className="px-2 py-1.5 font-dm" style={{ fontSize: 12, color: "#475569" }}>{h.date}</td>
                                      <td className="px-2 py-1.5 font-dm" style={{ fontSize: 12, color: "#475569" }}>{h.user}</td>
                                      <td className="px-2 py-1.5 font-mono-jb" style={{ fontSize: 12, color: "#0F172A", fontWeight: 600 }}>{h.old} → {h.next} pcs</td>
                                      <td className="px-2 py-1.5 font-dm" style={{ fontSize: 12, color: "#475569" }}>{h.reason}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
            {visibleFG.length === 0 && (
              <div className="px-6 py-10 text-center font-dm" style={{ fontSize: 13, color: "#94A3B8" }}>
                <Boxes size={28} style={{ color: "#CBD5E1", margin: "0 auto 8px" }} />
                No finished goods match your search.
              </div>
            )}
          </div>
        </section>
      </div>

      {editing && (
        <UpdateCountModal
          material={materials.find((m) => m.key === editing)!}
          current={counts[editing]}
          onClose={() => setEditing(null)}
          onSave={(next, reason) => saveCount(editing, next, reason)}
        />
      )}

      {fgEditing && (
        <UpdateFGModal
          fg={fgEditing}
          onClose={() => setFgEditing(null)}
          onSave={(next, reason) => saveFGCount(fgEditing.id, next, reason)}
        />
      )}
    </div>
  );
}

/* ───────── Material card (no inline history; audit log is a separate table below) ───────── */
function MaterialCard({ m, value, importBatch, onChangeImportBatch, onEdit }: {
  m: Material; value: number;
  importBatch?: string; onChangeImportBatch?: (v: string) => void;
  onEdit: () => void;
}) {
  const isImported = m.key === "mediaImported";
  const low = !isImported && value <= m.threshold;
  const critical = m.key === "adhesive" && low;
  const amber = m.key === "box" && low;

  const border = critical ? "2px solid #C8102E" : amber ? "2px solid #D97706" : low ? "2px solid #C8102E" : "1px solid #E2E8F0";
  const valueColor = critical ? "#C8102E" : amber ? "#D97706" : "#0F172A";
  const status = isImported
    ? { label: "📅 SCHEDULE-BASED", bg: "#DBEAFE", fg: "#1D4ED8" }
    : critical ? { label: "🔴 LOW STOCK", bg: "#FEE2E2", fg: "#991B1B" }
    : amber ? { label: "⚠️ LOW STOCK", bg: "#FEF3C7", fg: "#B45309" }
    : { label: "✅ OK", bg: "#DCFCE7", fg: "#15803D" };
  const icon = m.key === "mediaLocal" ? "🧻" : m.key === "mediaImported" ? "🌐" : m.key === "adhesive" ? "🔧" : "📦";

  return (
    <div className="bg-white rounded-xl p-5 flex flex-col gap-3" style={{ border, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 22 }} aria-hidden>{icon}</span>
          <span className="font-dm" style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{m.label}</span>
        </div>
        <span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: status.bg, color: status.fg, letterSpacing: 0.4 }}>{status.label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-syne" style={{ fontSize: 36, fontWeight: 800, color: valueColor, lineHeight: 1 }}>{value}</span>
        <span className="font-dm" style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>{m.unit}</span>
      </div>
      <div className="font-dm flex flex-col gap-0.5" style={{ fontSize: 11, color: "#64748B" }}>
        <div>Threshold: <span style={{ color: "#0F172A", fontWeight: 600 }}>{isImported ? "Batch purchase (no threshold)" : `Alert below ${m.threshold} ${m.unit}`}</span></div>
        <div>Lead Time: <span style={{ color: "#0F172A", fontWeight: 600 }}>{m.leadTime}</span></div>
        {isImported && (
          <div className="flex items-center gap-2 mt-1">
            <span>Next import batch:</span>
            <input value={importBatch} onChange={(e) => onChangeImportBatch?.(e.target.value)} className="font-dm flex-1 px-2 py-1 rounded border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 11, color: "#0F172A" }} />
          </div>
        )}
      </div>
      <div className="flex items-center mt-1">
        <button onClick={onEdit} className="font-dm flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50 w-full justify-center" style={{ fontSize: 11, fontWeight: 700, color: "#0F172A", letterSpacing: 0.3 }}>
          <Pencil size={11} /> Update Count
        </button>
      </div>
    </div>
  );
}

/* ───────── Update Count Modal (raw materials) ───────── */
function UpdateCountModal({ material, current, onClose, onSave }: { material: Material; current: number; onClose: () => void; onSave: (n: number, reason: string) => void }) {
  const [next, setNext] = useState(current);
  const [reason, setReason] = useState(reasons[0]);
  const [notes, setNotes] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.5)" }} onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md" style={{ boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-syne" style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Update Stock — {material.label}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="font-dm" style={{ fontSize: 13, color: "#475569" }}>Current: <span style={{ color: "#0F172A", fontWeight: 700 }}>{current} {material.unit}</span></div>
          <div className="flex flex-col gap-1.5">
            <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>New count</label>
            <input type="number" value={next} onChange={(e) => setNext(Number(e.target.value))} className="font-syne px-4 py-3 rounded-md border-2 border-slate-300 outline-none focus:border-slate-500 bg-white" style={{ fontSize: 24, fontWeight: 800, color: "#0F172A" }} autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Reason</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="font-dm px-3 py-2.5 rounded-md border border-slate-200 bg-white outline-none focus:border-slate-400" style={{ fontSize: 13, color: "#0F172A" }}>
              {reasons.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="font-dm px-3 py-2 rounded-md border border-slate-200 bg-white outline-none focus:border-slate-400 resize-none" style={{ fontSize: 13, color: "#0F172A" }} />
          </div>
          <div className="rounded-md p-2 font-dm" style={{ fontSize: 11, color: "#92400E", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
            ℹ️ This change will be logged with your name, date, time, old qty, and new qty in the audit history.
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="font-dm px-4 py-2 rounded-md hover:bg-slate-100" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Cancel</button>
          <button onClick={() => onSave(next, reason)} className="font-dm px-4 py-2 rounded-md text-white hover:opacity-90" style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700 }}>💾 Save</button>
        </div>
      </div>
    </div>
  );
}

/* ───────── Update Finished Goods Modal ───────── */
function UpdateFGModal({ fg, onClose, onSave }: { fg: FinishedGood; onClose: () => void; onSave: (n: number, reason: string) => void }) {
  const [next, setNext] = useState(fg.qtyInStock);
  const [reason, setReason] = useState(reasons[0]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.5)" }} onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md" style={{ boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-syne" style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Update Stock — {fg.itemName}</h3>
            <p className="font-mono-jb" style={{ fontSize: 11, color: "#64748B" }}>{fg.itemCode} · {fg.enterFilPN}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="font-dm" style={{ fontSize: 13, color: "#475569" }}>Current: <span style={{ color: "#0F172A", fontWeight: 700 }}>{fg.qtyInStock} pcs</span></div>
          <div className="flex flex-col gap-1.5">
            <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>New count</label>
            <input type="number" value={next} onChange={(e) => setNext(Number(e.target.value))} className="font-syne px-4 py-3 rounded-md border-2 border-slate-300 outline-none focus:border-slate-500 bg-white" style={{ fontSize: 24, fontWeight: 800, color: "#0F172A" }} autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Reason</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="font-dm px-3 py-2.5 rounded-md border border-slate-200 bg-white outline-none focus:border-slate-400" style={{ fontSize: 13, color: "#0F172A" }}>
              {reasons.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="rounded-md p-2 font-dm" style={{ fontSize: 11, color: "#92400E", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
            ℹ️ Logged to inventory audit history with timestamp and user.
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="font-dm px-4 py-2 rounded-md hover:bg-slate-100" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Cancel</button>
          <button onClick={() => onSave(next, reason)} className="font-dm px-4 py-2 rounded-md text-white hover:opacity-90" style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700 }}>💾 Save</button>
        </div>
      </div>
    </div>
  );
}
