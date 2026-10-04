import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Eye, Filter, Paperclip, Search } from "lucide-react";
import { useOrders } from "../store/orders";
import { toast } from "sonner";
import { NotificationBell } from "./NotificationBell";
import { buildWaybillHistory } from "./waybillData";

export function WaybillHistory() {
  const { inquiriesByStage } = useOrders();
  const [logQuery, setLogQuery] = useState("");
  const [logDateFilter, setLogDateFilter] = useState<"today" | "7days" | "30days" | "all">("all");
  const [isLogFilterOpen, setIsLogFilterOpen] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const historyInquiries = useMemo(
    () => inquiriesByStage(["ready_for_dispatch", "dispatched", "delivered", "paid", "overdue"]),
    [inquiriesByStage]
  );
  const log = useMemo(() => buildWaybillHistory(historyInquiries), [historyInquiries]);
  const filtered = useMemo(() => log.filter((row) => {
    const query = logQuery.trim().toLocaleLowerCase();
    const searchMatches = !query ||
      row.waybillNo.toLocaleLowerCase().includes(query) ||
      row.jo.toLocaleLowerCase().includes(query) ||
      row.client.toLocaleLowerCase().includes(query) ||
      row.item.toLocaleLowerCase().includes(query);
    const rowDate = new Date(row.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const cutoff = new Date(today);
    if (logDateFilter === "7days") cutoff.setDate(cutoff.getDate() - 6);
    if (logDateFilter === "30days") cutoff.setDate(cutoff.getDate() - 29);
    const dateMatches = logDateFilter === "all" ||
      (!Number.isNaN(rowDate.getTime()) && rowDate >= cutoff && rowDate < tomorrow);
    return searchMatches && dateMatches;
  }), [log, logDateFilter, logQuery]);

  return (
    <div className="flex-1 h-full overflow-auto" style={{ backgroundColor: "#F4F6F9" }}>
      <header className="bg-white border-b border-slate-200/70 px-8 py-5 sticky top-0 z-10 flex items-start justify-between">
        <div>
          <h1 className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>
            Waybill History
          </h1>
          <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>
            Search and review scanned and processed waybills
          </p>
        </div>
        <NotificationBell />
      </header>

      <div className="px-8 py-8">
        <section aria-label="Waybill History Log">
          <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
            <div className="px-5 py-4 border-b border-slate-200/70 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="font-syne" style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Waybill History Log</h3>
                <span className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>All scanned/processed waybills</span>
              </div>
              <div className="flex items-center gap-2 flex-nowrap">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} />
                  <input
                    value={logQuery}
                    onChange={(event) => setLogQuery(event.target.value)}
                    placeholder="Search waybill / JO / client..."
                    aria-label="Search by Waybill number, JO number, client, or item"
                    className="font-dm w-52 max-w-[calc(100vw-10rem)] pl-8 pr-3 py-1.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white"
                    style={{ fontSize: 12 }}
                  />
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsLogFilterOpen((open) => !open)}
                    aria-label="Filter waybill history by date"
                    aria-expanded={isLogFilterOpen}
                    className="font-dm flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-white hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    style={{ color: logDateFilter !== "all" ? "#1A2B4A" : "#64748B" }}
                  >
                    <Filter size={14} />
                  </button>
                  {isLogFilterOpen && (
                    <div role="group" aria-label="Date filter" className="absolute right-0 top-10 z-20 w-40 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
                      {([
                        ["today", "Today"],
                        ["7days", "Last 7 days"],
                        ["30days", "Last 30 days"],
                        ["all", "All"],
                      ] as const).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setLogDateFilter(value);
                            setIsLogFilterOpen(false);
                          }}
                          aria-pressed={logDateFilter === value}
                          className="font-dm block w-full rounded-md px-3 py-2 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          style={{ fontSize: 12, fontWeight: logDateFilter === value ? 700 : 500, color: "#0F172A" }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <table className="w-full">
              <thead style={{ backgroundColor: "#F4F6F9" }}>
                <tr>
                  {["Date", "Waybill No.", "JO", "Client", "Item", "Qty", "Method"].map((heading) => (
                    <th key={heading} className="font-dm text-left px-4 py-3" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>No waybills match your filters.</td></tr>
                ) : filtered.map((row) => {
                  const isExpanded = expandedLogId === row.id;
                  const matchedJob = row.matchedJob;

                  return (
                    <Fragment key={row.id}>
                      <tr
                        className="border-t border-slate-200/70 hover:bg-slate-50 cursor-pointer"
                        onClick={() => setExpandedLogId(isExpanded ? null : row.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setExpandedLogId(isExpanded ? null : row.id);
                          }
                        }}
                        tabIndex={0}
                        aria-expanded={isExpanded}
                      >
                        <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>{row.date}</td>
                        <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}>
                          <span className="inline-flex items-center gap-2">{isExpanded ? <ChevronUp size={14} style={{ color: "#94A3B8" }} /> : <ChevronDown size={14} style={{ color: "#94A3B8" }} />}{row.waybillNo}</span>
                        </td>
                        <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, color: "#475569" }}>{row.jo}</td>
                        <td className="px-4 py-3 font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{row.client}</td>
                        <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{row.item}</td>
                        <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{row.qty}</td>
                        <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>{row.method}</td>
                      </tr>
                      {isExpanded && (
                        <tr style={{ backgroundColor: "#F8FAFC" }}>
                          <td colSpan={7} className="px-6 py-5">
                            <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
                              <div>
                                <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" }}>Order details</div>
                                <div className="rounded-lg p-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2" style={{ backgroundColor: "white", border: "1px solid #E2E8F0" }}>
                                  {matchedJob ? [
                                    ["PO", matchedJob.po],
                                    ["SI", matchedJob.si],
                                    ["Contact", matchedJob.contact],
                                  ].map(([label, value]) => (
                                    <Fragment key={label}>
                                      <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</div>
                                      <div className="font-mono-jb" style={{ fontSize: 12, color: "#0F172A" }}>{value ?? "—"}</div>
                                    </Fragment>
                                  )) : (
                                    <div className="col-span-2 font-dm" style={{ fontSize: 12, color: "#94A3B8", fontStyle: "italic" }}>Original order data archived — basic log only.</div>
                                  )}
                                </div>
                              </div>
                              <div>
                                <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" }}>Product Sketch</div>
                                {matchedJob?.sketch ? (
                                  <div className="rounded-lg flex flex-col items-center justify-center py-6 gap-2 bg-white" style={{ border: "1.5px dashed #93C5FD" }}>
                                    <Paperclip size={28} style={{ color: "#1A2B4A" }} />
                                    <div className="font-mono-jb" style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", textAlign: "center" }}>{matchedJob.sketch}</div>
                                    <button onClick={(event) => { event.stopPropagation(); toast.info(`Opening: ${matchedJob.sketch}`); }} className="font-dm flex items-center gap-1 px-3 py-1.5 mt-1 rounded-md hover:bg-blue-50" style={{ fontSize: 11, fontWeight: 600, color: "#1A2B4A", border: "1px solid #BFDBFE" }}>
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
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
