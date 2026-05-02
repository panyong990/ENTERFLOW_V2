import { useState, Fragment } from "react";
import { Printer, FileDown, CheckCircle2, X, ScanLine, Info, Eye, Paperclip, Search, ChevronDown, ChevronUp } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useSettings } from "../store/settings";
import { useOrders } from "../store/orders";
import { NotificationBell } from "./NotificationBell";

interface CompletedJO {
  id: string;
  jo: string;
  po: string;
  si: string;
  client: string;
  contact: string;
  clientAddress: string;
  clientPhone: string;
  item: string;
  itemCode?: string;
  enterFilPN?: string;
  qty: number;
  method: string;
  barcode: string;
  status?: "Ready for Dispatch" | "Delivered";
  sketch?: string;
  specs?: { od1?: string; od2?: string; id1?: string; id2?: string; height?: string; overallHeight?: string; media?: string; innerCore?: string; outerCore?: string; oring?: string; gasket?: string; oem?: string; brand?: string };
}

const completedSeed: CompletedJO[] = [
  {
    id: "c1", jo: "JO-2026-001", po: "PO-2026-9901", si: "SI-2026-9901",
    client: "B.E. AEROSPACE", contact: "M. Rivera",
    clientAddress: "FAB Bldg., Clark Freeport Zone, Pampanga",
    clientPhone: "+63 917 555 1212",
    item: "Air Filter — KF-OS.107.65.252",
    itemCode: "OILSEP-00001", enterFilPN: "KF-OS.107.65.252",
    qty: 50, method: "Company Vehicle", barcode: "EF-2026-09901",
    status: "Ready for Dispatch",
    sketch: "KF-OS.107.65.252_drawing.pdf",
    specs: { od1: "115", od2: "103", id1: "64.6", height: "500", overallHeight: "512", media: "Microglass Fiber / Inside", innerCore: "Expanded Metal Perfo 2mm", brand: "Hitachi Comp.", oem: "KF-OS.107.65.252" },
  },
  {
    id: "c2", jo: "JO-2026-002", po: "PO-2026-9531", si: "SI-2026-9531",
    client: "MAYNILAD WATER SERVICES", contact: "J. Domingo",
    clientAddress: "MWSS Compound, Katipunan Ave., Quezon City",
    clientPhone: "+63 2 8888 5555",
    item: "Pleated Filter ZS20 — KF-OF.175.20.87",
    itemCode: "OILFIL-00181", enterFilPN: "KF-OF.175.20.87",
    qty: 100, method: "Lalamove", barcode: "EF-2026-09531",
    status: "Ready for Dispatch",
    sketch: "KF-OF.175.20.87_drawing.pdf",
    specs: { od1: "175", od2: "175", id1: "20", id2: "20", height: "87", overallHeight: "93", media: "Pleated ZS20 w/ Double Alum Screen", innerCore: "Perforated 3mm Ø, 0.6mm T", oring: "Top & Bottom", oem: "KF-OF.175.20.87" },
  },
];

interface WaybillLog {
  id: string;
  date: string;
  waybillNo: string;
  jo: string;
  client: string;
  item: string;
  qty: number;
  method: string;
  status: string;
  processedBy: string;
}

const seedLog: WaybillLog[] = [
  { id: "wl1", date: "Apr 25, 2026", waybillNo: "EF-2026-09533", jo: "JO-2026-002", client: "Maynilad", item: "Pleated Filter 5-Micron", qty: 100, method: "Lalamove", status: "Delivered", processedBy: "P. Tan" },
  { id: "wl2", date: "Apr 22, 2026", waybillNo: "EF-2026-09805", jo: "JO-2025-082", client: "B.E. Aerospace", item: "Oil Separator Filter", qty: 20, method: "Company Vehicle", status: "Delivered", processedBy: "P. Tan" },
];

export function WaybillScanner() {
  const { settings } = useSettings();
  const { completedJOs } = useOrders();
  const [completed] = useState<CompletedJO[]>(completedSeed);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scanInput, setScanInput] = useState("");
  const [scanPopup, setScanPopup] = useState<CompletedJO | null>(null);
  const [waybillNo, setWaybillNo] = useState("");
  const [log, setLog] = useState<WaybillLog[]>(seedLog);
  const [confirmDispatch, setConfirmDispatch] = useState(false);
  const [logQuery, setLogQuery] = useState("");
  const [logFrom, setLogFrom] = useState("");
  const [logTo, setLogTo] = useState("");
  const [logStatusFilter, setLogStatusFilter] = useState<"all" | "Delivered" | "Dispatched">("all");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const selected = completed.find((c) => c.id === selectedId);

  const onScanKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const q = scanInput.trim().toUpperCase();
    const hit = completed.find((c) => c.barcode === q || c.jo === q || c.po === q);
    if (hit) {
      setSelectedId(hit.id);
      setScanPopup(hit);
    } else {
      /* check completed JOs from orders store */
      const inq = completedJOs.find(i => i.joNumber === q || i.poFileName?.includes(q));
      if (inq) {
        toast.success(`Matched ${inq.joNumber}`, { description: `${inq.clientName} · ${inq.products[0]?.type}` });
      } else {
        toast.error("No matching JO/PO/barcode — check the waybill number and try again");
      }
    }
    setScanInput("");
  };

  const markDispatched = () => {
    if (!selected) return;
    const wl: WaybillLog = {
      id: `wl-${Date.now()}`, date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      waybillNo: waybillNo || selected.barcode, jo: selected.jo, client: selected.client, item: selected.item,
      qty: selected.qty, method: selected.method, status: "Dispatched", processedBy: "P. Tan",
    };
    setLog((prev) => [wl, ...prev]);
    setSelectedId(null); setWaybillNo(""); setConfirmDispatch(false);
    toast.success(`${selected.jo} dispatched`, { description: `Logistics → In Transit · Waybill ${wl.waybillNo}` });
  };

  return (
    <div className="flex-1 h-full overflow-auto" style={{ backgroundColor: "#F4F6F9" }}>
      <Toaster position="bottom-right" richColors />

      <header className="bg-white border-b border-slate-200/70 px-8 py-5 sticky top-0 z-10 flex items-start justify-between">
        <div>
          <h1 className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>
            Waybill Scanner
          </h1>
          <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>
            Dispatch lookup tool — scan waybill / JO number to verify items before they leave the building
          </p>
        </div>
        <NotificationBell />
      </header>

      <div className="px-8 py-8 flex flex-col gap-8">
        {/* Dispatch Labels — for finished production items ready to pack & ship */}
        <section>
          <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
            <div>
              <h2 className="font-syne" style={{ fontSize: 18, fontWeight: 700, color: "#0F172A" }}>📦 Dispatch Labels — Ready for Packing</h2>
              <p className="font-dm mt-0.5" style={{ fontSize: 12, color: "#64748B" }}>Print or reprint dispatch labels for finished production items before they ship.</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
            <table className="w-full">
              <thead style={{ backgroundColor: "#F4F6F9" }}>
                <tr>
                  {["JO No.", "Client", "Item", "Qty", "Method", "Status", "Action"].map((h) => (
                    <th key={h} className="font-dm text-left px-4 py-3" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {completed.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>No items ready for dispatch.</td></tr>
                ) : completed.map((c) => (
                  <tr key={c.id} className="border-t border-slate-200/70 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, fontWeight: 700, color: "#1A2B4A" }}>{c.jo}</td>
                    <td className="px-4 py-3 font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{c.client}</td>
                    <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{c.item}</td>
                    <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{c.qty} pcs</td>
                    <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{c.method}</td>
                    <td className="px-4 py-3"><span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: "#FEE2E2", color: "#C8102E" }}>Ready for Dispatch</span></td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { window.print(); toast.success(`Reprinting dispatch label for ${c.jo}`); }}
                        className="font-dm flex items-center gap-1 px-3 py-1.5 rounded-md border-2 hover:bg-slate-50"
                        style={{ borderColor: "#1A2B4A", color: "#1A2B4A", fontSize: 11, fontWeight: 700 }}
                      >
                        <Printer size={11} /> Print Dispatch Label
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2.5 font-dm border-t border-slate-200" style={{ fontSize: 11, color: "#94A3B8", fontStyle: "italic", backgroundColor: "#F8FAFC" }}>
              💡 Forgot to print on the production floor? You can re-print the dispatch label here.
            </div>
          </div>
        </section>

        {/* Scanner */}
        <section className="flex flex-col gap-4">
          <div className="bg-white rounded-xl overflow-hidden" style={{ border: "2px solid #1A2B4A" }}>
            <div className="px-5 py-3 flex items-center gap-3" style={{ backgroundColor: "#1A2B4A" }}>
              <ScanLine size={20} style={{ color: "white" }} />
              <div>
                <div className="font-syne text-white" style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.4 }}>Barcode / Waybill Scanner</div>
                <div className="font-dm text-white/60" style={{ fontSize: 11 }}>Connect physical barcode scanner — input appears here automatically</div>
              </div>
              <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: "#16A34A" }}>
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span className="font-dm text-white" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4 }}>READY</span>
              </div>
            </div>
            <div className="flex items-center gap-4 px-5 py-3">
              <input
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={onScanKey}
                placeholder="Scan or type EF-XXXX / JO-XXXX / PO-XXXX then press Enter..."
                className="font-mono-jb flex-1 outline-none bg-transparent"
                style={{ fontSize: 14, color: "#0F172A" }}
                autoFocus
              />
            </div>
            <div className="px-5 pb-3 flex items-center gap-2">
              <Info size={12} style={{ color: "#94A3B8" }} />
              <span className="font-dm" style={{ fontSize: 11, color: "#94A3B8" }}>
                USB HID barcode scanner — scanner types the waybill number and auto-presses Enter. Camera scanning not used.
              </span>
            </div>
          </div>

          {/* Or pick from dropdown */}
          <div className="flex items-center gap-3">
            <label className="font-dm" style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>Or select Ready-for-Dispatch JO:</label>
            <select
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(e.target.value || null)}
              className="font-dm px-3 py-2.5 rounded-md border border-slate-200 bg-white outline-none focus:border-slate-400"
              style={{ fontSize: 13, color: "#0F172A", minWidth: 360 }}
            >
              <option value="">— Choose JO —</option>
              {completed.map((c) => (
                <option key={c.id} value={c.id}>{c.jo} · {c.client} · {c.item} · {c.qty} pcs</option>
              ))}
            </select>
          </div>
        </section>

        {/* Lookup details panel */}
        {selected ? (
          <section className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: "#1A2B4A" }}>
              <div>
                <div className="font-mono-jb text-white" style={{ fontSize: 18, fontWeight: 700 }}>{selected.jo}</div>
                <div className="font-dm text-white/70" style={{ fontSize: 12 }}>{selected.client} · {selected.contact}</div>
              </div>
              <span className="font-dm px-3 py-1 rounded-full" style={{ fontSize: 11, fontWeight: 700, backgroundColor: "#FEE2E2", color: "#C8102E" }}>
                {selected.status ?? "Ready for Dispatch"}
              </span>
            </div>

            <div className="grid gap-6 p-6" style={{ gridTemplateColumns: "3fr 2fr" }}>
              {/* Specs + sketch */}
              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Item Code", selected.itemCode],
                    ["Enter-Fil PN", selected.enterFilPN],
                    ["PO Number", selected.po],
                    ["SI Number", selected.si],
                    ["Quantity", `${selected.qty} pcs`],
                    ["Delivery Method", selected.method],
                  ].map(([lbl, val]) => (
                    <div key={lbl} className="flex flex-col gap-0.5">
                      <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{lbl}</div>
                      <div className="font-mono-jb" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{val ?? "—"}</div>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="font-syne mb-2" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Technical Specifications</div>
                  <div className="rounded-lg p-3 grid grid-cols-3 gap-2" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                    {selected.specs && Object.entries(selected.specs).filter(([, v]) => v).map(([k, v]) => (
                      <div key={k} className="font-mono-jb" style={{ fontSize: 11, color: "#475569" }}>
                        <span style={{ color: "#94A3B8", textTransform: "uppercase" }}>{k}: </span>
                        <span style={{ color: "#0F172A", fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="font-syne mb-2" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Client Address</div>
                  <div className="rounded-lg p-3 font-dm" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", fontSize: 13, color: "#0F172A" }}>
                    {selected.clientAddress}
                    <div style={{ color: "#64748B", fontSize: 12, marginTop: 4 }}>📞 {selected.clientPhone}</div>
                  </div>
                </div>

                {/* Waybill input */}
                <div>
                  <label className="font-dm block mb-1" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Waybill Number (editable)</label>
                  <input
                    value={waybillNo}
                    onChange={(e) => setWaybillNo(e.target.value)}
                    placeholder={`Default: ${selected.barcode} — paste Lalamove / AP Cargo waybill if available`}
                    className="font-mono-jb w-full px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white"
                    style={{ fontSize: 13, color: "#0F172A" }}
                  />
                </div>
              </div>

              {/* Sketch + actions */}
              <div className="flex flex-col gap-3">
                {selected.sketch && (
                  <div className="rounded-lg p-4" style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                    <div className="font-dm mb-2" style={{ fontSize: 10, fontWeight: 700, color: "#1E40AF", letterSpacing: 0.4, textTransform: "uppercase" }}>Product Sketch — visual verification</div>
                    <div className="rounded-lg flex flex-col items-center justify-center py-8 gap-2 bg-white" style={{ border: "1.5px dashed #93C5FD" }}>
                      <Paperclip size={28} style={{ color: "#1A2B4A" }} />
                      <div className="font-mono-jb" style={{ fontSize: 12, fontWeight: 700, color: "#2563EB", textAlign: "center" }}>{selected.sketch}</div>
                      <button onClick={() => toast.info(`Opening: ${selected.sketch}`)} className="font-dm flex items-center gap-1 px-3 py-1.5 mt-2 rounded-md hover:bg-blue-100" style={{ fontSize: 11, fontWeight: 600, color: "#1A2B4A", border: "1px solid #BFDBFE" }}>
                        <Eye size={11} /> View Drawing
                      </button>
                    </div>
                    <div className="font-dm mt-2" style={{ fontSize: 11, color: "#1E40AF", textAlign: "center" }}>
                      Verify the physical item matches this drawing before dispatch
                    </div>
                  </div>
                )}

                <button
                  onClick={() => { window.print(); toast("Reprinting label..."); }}
                  className="flex items-center justify-center gap-2 py-3 rounded-md text-white font-dm hover:opacity-90"
                  style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 800, letterSpacing: 0.5 }}
                >
                  <Printer size={14} strokeWidth={2.5} /> 🖨 PRINT WAYBILL LABEL
                </button>
                <button
                  onClick={() => toast("PDF download started")}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-md font-dm border-2 hover:bg-slate-50"
                  style={{ borderColor: "#1A2B4A", color: "#1A2B4A", fontSize: 13, fontWeight: 700, letterSpacing: 0.4 }}
                >
                  <FileDown size={14} strokeWidth={2.5} /> Download PDF
                </button>
                <button
                  onClick={() => setConfirmDispatch(true)}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-md text-white font-dm hover:opacity-90"
                  style={{ backgroundColor: "#16A34A", fontSize: 13, fontWeight: 700, letterSpacing: 0.4 }}
                >
                  <CheckCircle2 size={14} strokeWidth={2.5} /> Mark as Dispatched
                </button>
                <span className="font-dm text-center" style={{ fontSize: 11, color: "#94A3B8" }}>
                  Logs to history · Updates Logistics → In Transit
                </span>
              </div>
            </div>
          </section>
        ) : (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center font-dm" style={{ fontSize: 13, color: "#64748B" }}>
            Scan a barcode or pick a Job Order above to view dispatch details, sketch, and waybill controls.
          </div>
        )}

        {/* History log */}
        <section>
          <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
            <div className="px-5 py-4 border-b border-slate-200/70 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="font-syne" style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Waybill History Log</h3>
                <span className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>All scanned/processed waybills · click a row to view full details + sketch</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} />
                  <input
                    value={logQuery}
                    onChange={(e) => setLogQuery(e.target.value)}
                    placeholder="Search waybill / JO / client..."
                    className="font-dm pl-8 pr-3 py-1.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white"
                    style={{ fontSize: 12, width: 220 }}
                  />
                </div>
                <input type="date" value={logFrom} onChange={(e) => setLogFrom(e.target.value)} title="From" className="font-dm px-2 py-1.5 rounded-md border border-slate-200 bg-white outline-none" style={{ fontSize: 11 }} />
                <span className="font-dm" style={{ fontSize: 11, color: "#94A3B8" }}>→</span>
                <input type="date" value={logTo} onChange={(e) => setLogTo(e.target.value)} title="To" className="font-dm px-2 py-1.5 rounded-md border border-slate-200 bg-white outline-none" style={{ fontSize: 11 }} />
                <select
                  value={logStatusFilter}
                  onChange={(e) => setLogStatusFilter(e.target.value as any)}
                  className="font-dm px-2 py-1.5 rounded-md border border-slate-200 bg-white outline-none"
                  style={{ fontSize: 11, color: "#0F172A" }}
                >
                  <option value="all">All</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Dispatched">Dispatched</option>
                </select>
              </div>
            </div>
            <table className="w-full">
              <thead style={{ backgroundColor: "#F4F6F9" }}>
                <tr>
                  {["", "Date", "Waybill No.", "JO", "Client", "Item", "Qty", "Method", "Status", "Processed By"].map((h, i) => (
                    <th key={i} className="font-dm text-left px-4 py-3" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filtered = log.filter(r => {
                    const q = logQuery.toLowerCase();
                    const searchOk = !q || r.waybillNo.toLowerCase().includes(q) || r.jo.toLowerCase().includes(q) || r.client.toLowerCase().includes(q);
                    const statusOk = logStatusFilter === "all" || r.status === logStatusFilter;
                    /* No strict date parsing — match by raw string includes */
                    return searchOk && statusOk;
                  });
                  if (filtered.length === 0) {
                    return <tr><td colSpan={10} className="px-4 py-6 text-center font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>No waybills match your filters.</td></tr>;
                  }
                  return filtered.map((r) => {
                    const isExpanded = expandedLogId === r.id;
                    const matchedJob = completed.find(c => c.jo === r.jo);
                    return (
                      <Fragment key={r.id}>
                        <tr className="border-t border-slate-200/70 hover:bg-slate-50 cursor-pointer" onClick={() => setExpandedLogId(isExpanded ? null : r.id)}>
                          <td className="px-4 py-3">{isExpanded ? <ChevronUp size={14} style={{ color: "#94A3B8" }} /> : <ChevronDown size={14} style={{ color: "#94A3B8" }} />}</td>
                          <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>{r.date}</td>
                          <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}>{r.waybillNo}</td>
                          <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, color: "#475569" }}>{r.jo}</td>
                          <td className="px-4 py-3 font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{r.client}</td>
                          <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{r.item}</td>
                          <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{r.qty}</td>
                          <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>{r.method}</td>
                          <td className="px-4 py-3"><span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 11, fontWeight: 600, backgroundColor: r.status === "Delivered" ? "#DCFCE7" : "#DBEAFE", color: r.status === "Delivered" ? "#15803D" : "#1D4ED8" }}>{r.status}</span></td>
                          <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>{r.processedBy}</td>
                        </tr>
                        {isExpanded && (
                          <tr style={{ backgroundColor: "#F8FAFC" }}>
                            <td colSpan={10} className="px-6 py-5">
                              <div className="grid gap-5" style={{ gridTemplateColumns: "1.3fr 1fr" }}>
                                <div>
                                  <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" }}>Order details</div>
                                  <div className="rounded-lg p-3 grid grid-cols-2 gap-2" style={{ backgroundColor: "white", border: "1px solid #E2E8F0" }}>
                                    {matchedJob ? (
                                      [
                                        ["Item Code", matchedJob.itemCode],
                                        ["Enter-Fil PN", matchedJob.enterFilPN],
                                        ["PO", matchedJob.po],
                                        ["SI", matchedJob.si],
                                        ["Contact", matchedJob.contact],
                                        ["Phone", matchedJob.clientPhone],
                                        ["Address", matchedJob.clientAddress],
                                      ].map(([k, v]) => (
                                        <div key={k}>
                                          <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: 0.4, textTransform: "uppercase" }}>{k}</div>
                                          <div className="font-mono-jb" style={{ fontSize: 12, color: "#0F172A" }}>{v ?? "—"}</div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="col-span-2 font-dm" style={{ fontSize: 12, color: "#94A3B8", fontStyle: "italic" }}>Original order data archived — basic log only.</div>
                                    )}
                                  </div>
                                  {matchedJob?.specs && (
                                    <div className="mt-3">
                                      <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" }}>Technical specs</div>
                                      <div className="rounded-lg p-3 grid grid-cols-3 gap-1.5" style={{ backgroundColor: "white", border: "1px solid #E2E8F0" }}>
                                        {Object.entries(matchedJob.specs).filter(([, v]) => v).map(([k, v]) => (
                                          <div key={k} className="font-mono-jb" style={{ fontSize: 11, color: "#475569" }}>
                                            <span style={{ color: "#94A3B8", textTransform: "uppercase" }}>{k}: </span>
                                            <span style={{ color: "#0F172A", fontWeight: 600 }}>{v}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" }}>Product Sketch</div>
                                  {matchedJob?.sketch ? (
                                    <div className="rounded-lg flex flex-col items-center justify-center py-6 gap-2 bg-white" style={{ border: "1.5px dashed #93C5FD" }}>
                                      <Paperclip size={28} style={{ color: "#1A2B4A" }} />
                                      <div className="font-mono-jb" style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", textAlign: "center" }}>{matchedJob.sketch}</div>
                                      <button onClick={(e) => { e.stopPropagation(); toast.info(`Opening: ${matchedJob.sketch}`); }} className="font-dm flex items-center gap-1 px-3 py-1.5 mt-1 rounded-md hover:bg-blue-50" style={{ fontSize: 11, fontWeight: 600, color: "#1A2B4A", border: "1px solid #BFDBFE" }}>
                                        <Eye size={11} /> View Drawing
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="rounded-lg p-6 text-center font-dm" style={{ fontSize: 12, color: "#94A3B8", backgroundColor: "white", border: "1px dashed #CBD5E1" }}>
                                      No sketch on file
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Scan popup */}
      {scanPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.6)" }} onClick={() => setScanPopup(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg overflow-hidden" style={{ boxShadow: "0 24px 48px rgba(0,0,0,0.3)" }} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: "#1A2B4A" }}>
              <div className="flex items-center gap-3">
                <ScanLine size={18} style={{ color: "white" }} />
                <span className="font-syne text-white" style={{ fontSize: 15, fontWeight: 700 }}>Waybill Found</span>
              </div>
              <button onClick={() => setScanPopup(null)} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-white/10"><X size={16} style={{ color: "white" }} /></button>
            </div>
            <div className="p-6 flex flex-col gap-3">
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: "#F0FDF4", border: "1px solid #86EFAC" }}>
                <CheckCircle2 size={18} style={{ color: "#16A34A" }} />
                <div>
                  <div className="font-mono-jb" style={{ fontSize: 13, fontWeight: 700, color: "#166534" }}>{scanPopup.barcode}</div>
                  <div className="font-dm" style={{ fontSize: 11, color: "#16A34A" }}>Waybill matched successfully</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Job Order", scanPopup.jo], ["PO", scanPopup.po], ["Client", scanPopup.client],
                  ["Contact", scanPopup.contact], ["Item", scanPopup.item], ["Qty", `${scanPopup.qty} pcs`],
                  ["Method", scanPopup.method], ["Address", scanPopup.clientAddress],
                ].map(([lbl, val]) => (
                  <div key={lbl}>
                    <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>{lbl}</div>
                    <div className="font-dm" style={{ fontSize: 12, color: "#0F172A", fontWeight: 600 }}>{val}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => setScanPopup(null)} className="flex-1 py-2.5 rounded-md font-dm border border-slate-200 hover:bg-slate-50" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Close</button>
                <button onClick={() => { setSelectedId(scanPopup.id); setScanPopup(null); toast.success("Order loaded"); }} className="flex-1 py-2.5 rounded-md text-white font-dm hover:opacity-90" style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700 }}>Load & View Details</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm dispatch */}
      {confirmDispatch && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.5)" }} onClick={() => setConfirmDispatch(false)}>
          <div className="bg-white rounded-xl w-full max-w-md" style={{ boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
              <CheckCircle2 size={18} style={{ color: "#16A34A" }} />
              <h3 className="font-syne" style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Confirm Dispatch</h3>
            </div>
            <div className="p-5 font-dm flex flex-col gap-2" style={{ fontSize: 13, color: "#0F172A" }}>
              <div><span style={{ fontWeight: 700 }}>{selected.jo}</span> · {selected.client} · {selected.qty} pcs</div>
              <div>Waybill: <span className="font-mono-jb" style={{ fontWeight: 700 }}>{waybillNo || selected.barcode}</span></div>
              <div>Method: <span style={{ fontWeight: 700 }}>{selected.method}</span></div>
              <div style={{ color: "#475569", fontSize: 12 }}>Logistics → In Transit · Client portal updated · Logged to waybill history.</div>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => setConfirmDispatch(false)} className="font-dm px-4 py-2 rounded-md hover:bg-slate-100" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Cancel</button>
              <button onClick={markDispatched} className="font-dm px-4 py-2 rounded-md text-white hover:opacity-90" style={{ backgroundColor: "#16A34A", fontSize: 13, fontWeight: 700 }}>Confirm Dispatch</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
