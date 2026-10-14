import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Search, SlidersHorizontal } from "lucide-react";
import { useOrders } from "../store/orders";
import { NotificationBell } from "./NotificationBell";
import { buildWaybillHistory, inquiryToDispatchRow } from "./waybillData";

type Tab = "ready" | "history";
type DateFilter = "today" | "7days" | "30days" | "custom" | "all";

function isWithinDateFilter(value: string, filter: DateFilter, dateFrom: string, dateTo: string): boolean {
  if (filter === "all") return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  date.setHours(0, 0, 0, 0);

  if (filter === "custom") {
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T00:00:00`) : null;
    if (from && Number.isNaN(from.getTime()) || to && Number.isNaN(to.getTime())) return false;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const cutoff = new Date(today);
  if (filter === "7days") cutoff.setDate(cutoff.getDate() - 6);
  if (filter === "30days") cutoff.setDate(cutoff.getDate() - 29);
  return date >= cutoff && date < tomorrow;
}

export function WaybillMonitoring() {
  const { inquiriesByStage } = useOrders();
  const [tab, setTab] = useState<Tab>("ready");
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [draftDateFilter, setDraftDateFilter] = useState<DateFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [draftDateFrom, setDraftDateFrom] = useState("");
  const [draftDateTo, setDraftDateTo] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const readyInquiries = useMemo(
    () => inquiriesByStage(["ready_for_dispatch"]),
    [inquiriesByStage]
  );
  const readyRows = useMemo(
    () => readyInquiries.map((inquiry) => ({
      inquiry,
      dispatch: inquiryToDispatchRow(inquiry),
    })),
    [readyInquiries]
  );
  const historyRows = useMemo(() => {
    const historyInquiries = inquiriesByStage(["ready_for_dispatch", "dispatched"]);
    return buildWaybillHistory(historyInquiries).filter(
      (row) => row.status.trim().toLocaleLowerCase() !== "delivered"
    );
  }, [inquiriesByStage]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredReady = useMemo(() => readyRows.filter(({ inquiry, dispatch }) => {
    const searchMatches = !normalizedQuery || [
      inquiry.waybillNumber,
      inquiry.waybillIdentifier,
      dispatch.waybillIdentifier,
      dispatch.jo,
      dispatch.client,
      dispatch.item,
      dispatch.itemCode,
      dispatch.enterFilPN,
      ...inquiry.products.flatMap((product) => [product.filterName, product.type, product.oem]),
    ].some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
    return searchMatches && isWithinDateFilter(inquiry.submittedDate, dateFilter, dateFrom, dateTo);
  }), [dateFilter, dateFrom, dateTo, normalizedQuery, readyRows]);
  const filteredHistory = useMemo(() => historyRows.filter((row) => {
    const searchMatches = !normalizedQuery || [
      row.waybillNo,
      row.jo,
      row.client,
      row.item,
    ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
    return searchMatches && isWithinDateFilter(row.date, dateFilter, dateFrom, dateTo);
  }), [dateFilter, dateFrom, dateTo, historyRows, normalizedQuery]);

  const openDateFilters = () => {
    setDraftDateFilter(dateFilter);
    setDraftDateFrom(dateFrom);
    setDraftDateTo(dateTo);
    setFilterOpen((open) => !open);
  };

  const applyDateFilters = () => {
    setDateFilter(draftDateFilter);
    setDateFrom(draftDateFrom);
    setDateTo(draftDateTo);
    setFilterOpen(false);
  };

  const resetDateFilters = () => {
    setDateFilter("all");
    setDraftDateFilter("all");
    setDateFrom("");
    setDateTo("");
    setDraftDateFrom("");
    setDraftDateTo("");
    setFilterOpen(false);
  };

  const changeTab = (nextTab: Tab) => {
    setTab(nextTab);
    setQuery("");
    resetDateFilters();
    setExpandedId(null);
  };

  return (
    <div className="flex-1 h-full overflow-auto" style={{ backgroundColor: "#F4F6F9" }}>
      <header className="bg-white border-b border-slate-200/70 px-8 py-5 sticky top-0 z-10 flex items-start justify-between">
        <div>
          <h1 className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>
            Waybill Monitoring
          </h1>
          <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>
            Read-only view of dispatch-ready orders and processed waybills
          </p>
        </div>
        <NotificationBell />
      </header>

      <main className="px-6 md:px-8 py-6 md:py-8">
        <section className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
          <div className="border-b border-slate-200/70 px-5 pt-4">
            <div className="flex gap-2" role="tablist" aria-label="Waybill monitoring records">
              {([
                ["ready", "Ready for Packing", readyRows.length],
                ["history", "Waybill History", historyRows.length],
              ] as const).map(([id, label, count]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => changeTab(id)}
                  className="font-dm inline-flex items-center gap-2 border-b-2 px-3 py-3 transition-colors"
                  style={{
                    borderColor: tab === id ? "#C8102E" : "transparent",
                    color: tab === id ? "#1A2B4A" : "#64748B",
                    fontSize: 13,
                    fontWeight: tab === id ? 700 : 500,
                  }}
                >
                  {label}
                  <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: tab === id ? "#FEE2E2" : "#F1F5F9", color: tab === id ? "#C8102E" : "#64748B", fontSize: 10, fontWeight: 700 }}>
                    {count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div role="tabpanel" className="p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
              <div>
                <h2 className="font-syne" style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>
                  {tab === "ready" ? "Ready for Packing" : "Waybill History"}
                </h2>
                <p className="font-dm mt-0.5" style={{ fontSize: 11, color: "#64748B" }}>
                  {tab === "ready"
                    ? `${readyRows.length} order${readyRows.length === 1 ? "" : "s"} awaiting dispatch processing`
                    : `${historyRows.length} recorded waybill entr${historyRows.length === 1 ? "y" : "ies"}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-56 flex-1 md:flex-none">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={tab === "ready" ? "Search waybill, JO, client, item..." : "Search waybill, JO, client, item..."}
                    aria-label="Search by Waybill number, JO number, client, or item"
                    className="font-dm w-full md:w-72 pl-9 pr-3 py-2 rounded-md border border-slate-200 bg-white outline-none focus:border-slate-400"
                    style={{ fontSize: 12, color: "#0F172A" }}
                  />
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={openDateFilters}
                    aria-label="Filter dates"
                    aria-expanded={filterOpen}
                    aria-pressed={dateFilter !== "all"}
                    className="relative flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <SlidersHorizontal size={16} aria-hidden />
                    {dateFilter !== "all" && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#C8102E" }} />}
                  </button>
                  {filterOpen && (
                    <>
                      <button
                        type="button"
                        className="fixed inset-0 z-20 cursor-default"
                        aria-label="Close date filters"
                        onClick={() => setFilterOpen(false)}
                      />
                      <div role="group" aria-label={`${tab === "ready" ? "Ready for Packing" : "Waybill History"} date filters`} className="absolute right-0 top-11 z-30 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                        <h3 className="font-syne mb-3" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Date Filters</h3>
                        <label className="font-dm flex flex-col gap-1.5" style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>
                          Date Range
                          <span className="relative">
                            <select
                              value={draftDateFilter}
                              onChange={(event) => setDraftDateFilter(event.target.value as DateFilter)}
                              className="w-full appearance-none rounded-md border border-slate-200 bg-white px-3 py-2 pr-9 outline-none focus:border-slate-400"
                              style={{ fontSize: 12, color: "#0F172A" }}
                            >
                              <option value="all">All Dates</option>
                              <option value="today">Today</option>
                              <option value="7days">Last 7 Days</option>
                              <option value="30days">Last 30 Days</option>
                              <option value="custom">Custom Date Range</option>
                            </select>
                            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} />
                          </span>
                        </label>
                        {draftDateFilter === "custom" && (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <label className="font-dm flex flex-col gap-1" style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>
                              From
                              <input type="date" value={draftDateFrom} onChange={(event) => setDraftDateFrom(event.target.value)} className="min-w-0 rounded-md border border-slate-200 px-2 py-2 font-normal text-slate-800" style={{ fontSize: 11 }} />
                            </label>
                            <label className="font-dm flex flex-col gap-1" style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>
                              To
                              <input type="date" value={draftDateTo} onChange={(event) => setDraftDateTo(event.target.value)} className="min-w-0 rounded-md border border-slate-200 px-2 py-2 font-normal text-slate-800" style={{ fontSize: 11 }} />
                            </label>
                          </div>
                        )}
                        {draftDateFilter === "custom" && draftDateFrom && draftDateTo && draftDateFrom > draftDateTo && (
                          <p className="font-dm mt-2" role="alert" style={{ fontSize: 11, color: "#B91C1C" }}>The start date must be on or before the end date.</p>
                        )}
                        <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
                          <button type="button" onClick={resetDateFilters} className="font-dm rounded-md border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Reset</button>
                          <button
                            type="button"
                            onClick={applyDateFilters}
                            disabled={draftDateFilter === "custom" && Boolean(draftDateFrom && draftDateTo && draftDateFrom > draftDateTo)}
                            className="font-dm rounded-md px-3 py-2 text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            style={{ fontSize: 12, fontWeight: 700, backgroundColor: "#1A2B4A" }}
                          >
                            Apply Filters
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200/70">
              {tab === "ready" ? (
                <table className="w-full min-w-[800px]">
                  <thead style={{ backgroundColor: "#F4F6F9" }}>
                    <tr>
                      {["JO No.", "Waybill No.", "Client", "Item", "Qty", "Delivery Method", "Stage"].map((heading) => (
                        <th key={heading} className="font-dm text-left px-4 py-3" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReady.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-7 text-center font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>No dispatch-ready records match your filters.</td></tr>
                    ) : filteredReady.map(({ inquiry, dispatch }) => {
                      const isExpanded = expandedId === inquiry.id;
                      return (
                        <Fragment key={inquiry.id}>
                          <tr
                            onClick={() => setExpandedId(isExpanded ? null : inquiry.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setExpandedId(isExpanded ? null : inquiry.id);
                              }
                            }}
                            tabIndex={0}
                            aria-expanded={isExpanded}
                            className="border-t border-slate-200/70 hover:bg-slate-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                          >
                            <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, fontWeight: 700, color: "#1A2B4A" }}>{dispatch.jo}</td>
                            <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, color: "#475569" }}>{inquiry.waybillNumber?.trim() || dispatch.waybillIdentifier}</td>
                            <td className="px-4 py-3 font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{dispatch.client}</td>
                            <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>{dispatch.item}</td>
                            <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>{dispatch.qty} pcs</td>
                            <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>{dispatch.method}</td>
                            <td className="px-4 py-3"><span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: "#FEE2E2", color: "#C8102E" }}>Ready for Dispatch</span></td>
                          </tr>
                          {isExpanded && (
                            <tr style={{ backgroundColor: "#F8FAFC" }}>
                              <td colSpan={7} className="px-5 py-4">
                                <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                                  {[
                                    ["Purchase Order", dispatch.po],
                                    ["Sales Invoice", dispatch.si],
                                    ["Contact", dispatch.contact],
                                    ["Submitted", inquiry.submittedDate],
                                    ["Waybill No.", inquiry.waybillNumber?.trim() || dispatch.waybillIdentifier],
                                    ["Delivery Method", dispatch.method],
                                  ].map(([label, value]) => (
                                    <div key={label}>
                                      <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</div>
                                      <div className="font-dm mt-1" style={{ fontSize: 12, color: "#0F172A" }}>{value || "—"}</div>
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
              ) : (
                <table className="w-full min-w-[820px]">
                  <thead style={{ backgroundColor: "#F4F6F9" }}>
                    <tr>
                      {["Date", "Waybill No.", "JO No.", "Client", "Item", "Qty", "Delivery Method"].map((heading) => (
                        <th key={heading} className="font-dm text-left px-4 py-3" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-7 text-center font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>No waybills match your filters.</td></tr>
                    ) : filteredHistory.map((row) => {
                      const isExpanded = expandedId === row.id;
                      return (
                        <Fragment key={row.id}>
                          <tr
                            onClick={() => setExpandedId(isExpanded ? null : row.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setExpandedId(isExpanded ? null : row.id);
                              }
                            }}
                            tabIndex={0}
                            aria-expanded={isExpanded}
                            className="border-t border-slate-200/70 hover:bg-slate-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                          >
                            <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>{row.date}</td>
                            <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}>
                              <span className="inline-flex items-center gap-2">{isExpanded ? <ChevronUp size={14} style={{ color: "#94A3B8" }} /> : <ChevronDown size={14} style={{ color: "#94A3B8" }} />}{row.waybillNo}</span>
                            </td>
                            <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, color: "#475569" }}>{row.jo}</td>
                            <td className="px-4 py-3 font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{row.client}</td>
                            <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>{row.item}</td>
                            <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>{row.qty}</td>
                            <td className="px-4 py-3 font-dm" style={{ fontSize: 12, color: "#475569" }}>{row.method}</td>
                          </tr>
                          {isExpanded && (
                            <tr style={{ backgroundColor: "#F8FAFC" }}>
                              <td colSpan={7} className="px-5 py-4">
                                <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                                  {[
                                    ["Status", row.status],
                                    ["Processed By", row.processedBy],
                                    ["Processing Note", row.note || "—"],
                                    ["Purchase Order", row.matchedJob?.po || "—"],
                                    ["Sales Invoice", row.matchedJob?.si || "—"],
                                    ["Contact", row.matchedJob?.contact || "—"],
                                  ].map(([label, value]) => (
                                    <div key={label}>
                                      <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</div>
                                      <div className="font-dm mt-1" style={{ fontSize: 12, color: "#0F172A" }}>{value}</div>
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
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
