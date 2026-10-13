import { useEffect, useMemo, useRef, useState } from "react";
import { Boxes, Search, SlidersHorizontal } from "lucide-react";
import { useMaterials } from "../store/materials";
import { useOrders } from "../store/orders";
import { buildOrderHistory, getFinishedGoodOrderActivity } from "../store/recurringOrders";
import { FILTER_TYPES, GROUP_DISPLAY, labelForType } from "../store/filterTemplates";

type FinishedGoodsSort = "orders-desc" | "orders-asc" | "company-asc" | "type-asc";

function normalizedText(value: string | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

function orderCalendarParts(submittedDate: string): { month: string; year: string } | null {
  const isoDate = submittedDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoDate) {
    const year = Number(isoDate[1]);
    const monthNumber = Number(isoDate[2]);
    if (monthNumber >= 1 && monthNumber <= 12) {
      return { month: `${year}-${String(monthNumber).padStart(2, "0")}`, year: String(year) };
    }
  }

  const date = new Date(submittedDate);
  if (Number.isNaN(date.getTime())) return null;
  return {
    month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    year: String(date.getFullYear()),
  };
}

function filterTypeCode(type: string): string {
  const normalizedType = normalizedText(type);
  const byCode = Object.values(FILTER_TYPES).find((filterType) => normalizedText(filterType.code) === normalizedType);
  if (byCode) return byCode.code;
  return Object.values(FILTER_TYPES).find((filterType) => normalizedText(filterType.label) === normalizedType)?.code ?? "";
}

export function FinishedGoodsOrderActivity({ className = "" }: { className?: string }) {
  const { finishedGoods } = useMaterials();
  const { inquiries, completedJOs } = useOrders();
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [sort, setSort] = useState<FinishedGoodsSort>("orders-desc");
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftFilterType, setDraftFilterType] = useState("");
  const [draftMonthFilter, setDraftMonthFilter] = useState("");
  const [draftYearFilter, setDraftYearFilter] = useState("");
  const [draftSort, setDraftSort] = useState<FinishedGoodsSort>("orders-desc");
  const filterContainerRef = useRef<HTMLDivElement>(null);

  const orderHistory = useMemo(() => buildOrderHistory(inquiries, completedJOs), [inquiries, completedJOs]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const finishedGoodsFilterOptions = useMemo(() => GROUP_DISPLAY.map(({ group, label }) => ({
    label,
    types: Object.values(FILTER_TYPES).filter((item) => item.group === group),
  })), []);
  const finishedGoodsFilterValues = useMemo(() => ({
    years: Array.from(new Set(orderHistory.flatMap((order) => {
      const calendar = orderCalendarParts(order.submittedDate);
      return calendar ? [calendar.year] : [];
    }))).sort((a, b) => b.localeCompare(a)),
  }), [orderHistory]);

  const finishedGoodsOrderActivity = useMemo(() => {
    const hasOrderFilters = Boolean(filterType || monthFilter || yearFilter);
    const activity = finishedGoods
      .map((item) => {
        const orderActivity = getFinishedGoodOrderActivity(item, orderHistory, (product) =>
          !filterType || filterTypeCode(product.type) === filterType
        );
        const matchingOrderIndexes = orderActivity.matchingOrders.flatMap((order, index) => {
          const calendar = orderCalendarParts(order.submittedDate);
          return (!monthFilter || calendar?.month.slice(-2) === monthFilter)
            && (!yearFilter || calendar?.year === yearFilter)
            ? [index]
            : [];
        });
        const matchingProducts = matchingOrderIndexes.flatMap((index) => orderActivity.matchingProductsByOrder[index]);
        const orderTypes = Array.from(new Set(matchingProducts
          .map((product) => filterTypeCode(product.type) || product.type)));
        const filterTypeLabel = orderTypes
          .map((type) => labelForType(type))
          .sort((a, b) => a.localeCompare(b))[0] ?? "";
        const matchesSearch = !normalizedQuery ||
          [item.itemCode, item.enterFilPN, item.itemName, item.client].some((value) =>
            normalizedText(value).includes(normalizedQuery)
          ) ||
          orderActivity.matchingOrders.some((order) => normalizedText(order.code).includes(normalizedQuery));
        return { item, recurringOrders: matchingOrderIndexes.length, filterTypeLabel, matchesSearch };
      })
      .filter((row) => row.matchesSearch && (!hasOrderFilters || row.recurringOrders > 0));

    const topDemandIds = new Set(
      [...activity]
        .filter((row) => row.recurringOrders > 0)
        .sort((a, b) => b.recurringOrders - a.recurringOrders || a.item.itemCode.localeCompare(b.item.itemCode))
        .slice(0, 2)
        .map((row) => row.item.id)
    );

    const rows = activity.sort((a, b) => {
      switch (sort) {
        case "orders-asc":
          return a.recurringOrders - b.recurringOrders;
        case "company-asc":
          return a.item.client.localeCompare(b.item.client) || b.recurringOrders - a.recurringOrders;
        case "type-asc":
          return a.filterTypeLabel.localeCompare(b.filterTypeLabel) || b.recurringOrders - a.recurringOrders;
        case "orders-desc":
        default:
          return b.recurringOrders - a.recurringOrders;
      }
    });
    return { rows, topDemandIds };
  }, [finishedGoods, normalizedQuery, orderHistory, filterType, monthFilter, yearFilter, sort]);

  const activeFilterCount = Number(Boolean(filterType)) +
    Number(Boolean(monthFilter)) +
    Number(Boolean(yearFilter)) +
    Number(sort !== "orders-desc");

  const openFilters = () => {
    setDraftFilterType(filterType);
    setDraftMonthFilter(monthFilter);
    setDraftYearFilter(yearFilter);
    setDraftSort(sort);
    setFilterOpen((open) => !open);
  };

  const applyFilters = () => {
    setFilterType(draftFilterType);
    setMonthFilter(draftMonthFilter);
    setYearFilter(draftYearFilter);
    setSort(draftSort);
    setFilterOpen(false);
  };

  const resetFilters = () => {
    setDraftFilterType("");
    setDraftMonthFilter("");
    setDraftYearFilter("");
    setDraftSort("orders-desc");
    setFilterType("");
    setMonthFilter("");
    setYearFilter("");
    setSort("orders-desc");
  };

  useEffect(() => {
    if (!filterOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!filterContainerRef.current?.contains(event.target as Node)) setFilterOpen(false);
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

  return (
    <section className={`flex min-w-0 flex-col gap-4 ${className}`}>
      <div>
        <h2 className="font-syne" style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>Finished Goods Order Activity</h2>
        <p className="font-dm mt-0.5" style={{ fontSize: 12, color: "#64748B" }}>Products ranked by recurring orders</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search item code, PN, name, client, order code..."
            className="font-dm w-full pl-9 pr-4 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white"
            style={{ fontSize: 13 }}
          />
        </div>

        <div ref={filterContainerRef} className="relative flex-none">
          <button
            type="button"
            aria-label="Filter"
            aria-expanded={filterOpen}
            onClick={openFilters}
            className="font-dm inline-flex h-[38px] items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-slate-600 outline-none hover:bg-slate-50 focus:border-slate-400"
            style={{ fontSize: 13, fontWeight: 600 }}
          >
            <SlidersHorizontal size={15} />
            <span>Filter</span>
            {activeFilterCount > 0 && (
              <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full px-1" style={{ fontSize: 10, fontWeight: 700, color: "#FFFFFF", backgroundColor: "#1A2B4A" }}>
                {activeFilterCount}
              </span>
            )}
          </button>

          {filterOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="fg-filter-type" className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>Filter Type</label>
                  <select id="fg-filter-type" aria-label="Filter by filter type" value={draftFilterType} onChange={(event) => setDraftFilterType(event.target.value)} className="font-dm rounded-md border border-slate-200 bg-white px-3 py-2 outline-none focus:border-slate-400" style={{ fontSize: 12 }}>
                    <option value="">All Filter Types</option>
                    {finishedGoodsFilterOptions.map(({ label, types }) => (
                      <optgroup key={label} label={label}>
                        {types.map((filterType) => <option key={filterType.code} value={filterType.code}>{filterType.label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="fg-filter-month" className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>Month</label>
                    <select id="fg-filter-month" aria-label="Filter by month" value={draftMonthFilter} onChange={(event) => setDraftMonthFilter(event.target.value)} className="font-dm rounded-md border border-slate-200 bg-white px-3 py-2 outline-none focus:border-slate-400" style={{ fontSize: 12 }}>
                      <option value="">All Months</option>
                      {Array.from({ length: 12 }, (_, monthIndex) => {
                        const month = String(monthIndex + 1).padStart(2, "0");
                        return <option key={month} value={month}>{new Date(2026, monthIndex, 1).toLocaleDateString(undefined, { month: "long" })}</option>;
                      })}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="fg-filter-year" className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>Year</label>
                    <select id="fg-filter-year" aria-label="Filter by year" value={draftYearFilter} onChange={(event) => setDraftYearFilter(event.target.value)} className="font-dm rounded-md border border-slate-200 bg-white px-3 py-2 outline-none focus:border-slate-400" style={{ fontSize: 12 }}>
                      <option value="">All Years</option>
                      {finishedGoodsFilterValues.years.map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="fg-filter-sort" className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>Sort By</label>
                  <select id="fg-filter-sort" aria-label="Sort finished goods order activity" value={draftSort} onChange={(event) => setDraftSort(event.target.value as FinishedGoodsSort)} className="font-dm rounded-md border border-slate-200 bg-white px-3 py-2 outline-none focus:border-slate-400" style={{ fontSize: 12 }}>
                    <option value="orders-desc">Recurring Orders — Highest to Lowest</option>
                    <option value="orders-asc">Recurring Orders — Lowest to Highest</option>
                    <option value="company-asc">Company Name — A to Z</option>
                    <option value="type-asc">Filter Type — A to Z</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={resetFilters} className="font-dm rounded-md border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Reset</button>
                <button type="button" onClick={applyFilters} className="font-dm rounded-md px-3 py-2 text-white hover:opacity-90" style={{ fontSize: 12, fontWeight: 700, backgroundColor: "#1A2B4A" }}>Apply Filters</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]" style={{ fontFamily: '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
            <thead style={{ backgroundColor: "#F4F6F9" }}>
              <tr>
                {["Rank", "Item Code", "Enter-Fil PN", "Item Name", "Client", "Recurring Orders"].map((heading) => (
                  <th key={heading} className="text-left px-4 py-3" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {finishedGoodsOrderActivity.rows.map(({ item, recurringOrders }, index) => {
                const highlighted = finishedGoodsOrderActivity.topDemandIds.has(item.id);
                return (
                  <tr
                    key={item.id}
                    className="border-t border-slate-200/70 transition-colors hover:bg-slate-50"
                    style={{ backgroundColor: highlighted ? "#FFF1F2" : "#FFFFFF" }}
                  >
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex min-w-7 h-7 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: highlighted ? "#FEE2E2" : "#F1F5F9",
                          color: highlighted ? "#C8102E" : "#64748B",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{item.itemCode}</td>
                    <td className="px-4 py-3" style={{ fontSize: 12, color: "#475569" }}>{item.enterFilPN}</td>
                    <td className="px-4 py-3" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{item.itemName}</td>
                    <td className="px-4 py-3" style={{ fontSize: 12, color: "#475569" }}>{item.client}</td>
                    <td className="px-4 py-3" style={{ fontSize: 13, fontWeight: highlighted ? 700 : 500, color: highlighted ? "#C8102E" : "#334155" }}>{recurringOrders}</td>
                  </tr>
                );
              })}
              {finishedGoodsOrderActivity.rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center font-dm" style={{ fontSize: 13, color: "#94A3B8" }}>
                    <Boxes size={28} style={{ color: "#CBD5E1", margin: "0 auto 8px" }} />
                    No finished goods match the selected search and filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
