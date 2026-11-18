import { useMemo, useState } from "react";
import { useProductionJobOrders } from "./useProductionJobOrders";
import { formatProductionEventTime, latestProductionStageEvent, productionSpecifications, ProductionDetailStatus, ProductionEventHistory, ProductionJobOrderDocument } from "./productionJobOrderPresentation";
import {
  AlertTriangle, CheckCircle2, ChevronDown, Circle, ClipboardList,
  Clock3, Eye, Factory, FileText, Filter, PackageCheck, Search, X,
} from "lucide-react";
import { useOrders, PRODUCTION_STAGES, poNumberForDisplay, stageColor, stageLabel, type Inquiry } from "../store/orders";
import { useSession } from "../store/session";
import { JOTemplateModal, type JOTemplateData } from "./JOTemplateModal";

const ACTIVE_STAGES = new Set(["jo", "in_production", "quality_inspection"]);
const COMPLETED_STAGES = new Set(["ready_for_dispatch", "dispatched", "delivered", "paid", "overdue"]);
type MonitoringInquiry = Pick<Inquiry, "id" | "code" | "joNumber" | "clientName" | "currentStage" | "paused" | "productionDueDate" | "dueDate" | "deliveryMethod" | "poNumber" | "poFileName" | "products" | "joCompletedAt" | "joSpecs" | "joSketch" | "urgent" | "stageHistory"> & { stage: string };
type JobStatusFilter = "all" | "inProgress" | "completed" | "overdue";
type DueDateFilter = "all" | "overdue" | "today" | "upcoming";

interface Filters {
  stage: string;
  status: JobStatusFilter;
  dueDate: DueDateFilter;
}

const DEFAULT_FILTERS: Filters = {
  stage: "all",
  status: "all",
  dueDate: "all",
};

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function dayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value?: string): string {
  const date = parseDate(value);
  return date
    ? date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : value || "—";
}

function isCompleted(inquiry: MonitoringInquiry): boolean {
  return Boolean(inquiry.joCompletedAt) || COMPLETED_STAGES.has(inquiry.stage);
}

function getStageIndex(inquiry: MonitoringInquiry): number {
  if (inquiry.currentStage !== undefined) {
    return Math.max(0, Math.min(inquiry.currentStage, PRODUCTION_STAGES.length));
  }
  if (COMPLETED_STAGES.has(inquiry.stage)) return PRODUCTION_STAGES.length;
  if (inquiry.stage === "quality_inspection") return 8;
  if (inquiry.stage === "in_production") return 1;
  return 0;
}

function getOverdue(inquiry: MonitoringInquiry, today: Date, productionDue = false): boolean {
  if (!ACTIVE_STAGES.has(inquiry.stage)) return false;
  const dueDate = parseDate(productionDue ? inquiry.productionDueDate : inquiry.dueDate);
  return Boolean(dueDate && dayStart(dueDate).getTime() < today.getTime());
}

function getStatus(inquiry: MonitoringInquiry, overdue: boolean): { label: string; bg: string; fg: string } {
  if (isCompleted(inquiry)) return { label: "Completed", bg: "#DCFCE7", fg: "#15803D" };
  if (overdue) return { label: "Overdue", bg: "#FEE2E2", fg: "#C8102E" };
  if (inquiry.paused) return { label: "On Hold", bg: "#FEF3C7", fg: "#B45309" };
  const colors = stageColor[inquiry.stage as keyof typeof stageColor] ?? { bg: "#F1F5F9", fg: "#64748B" };
  return {
    label: inquiry.stage === "jo" ? "Active" : stageLabel[inquiry.stage as keyof typeof stageLabel] ?? inquiry.stage,
    bg: colors.bg,
    fg: colors.fg,
  };
}

function productName(product: Inquiry["products"][number]): string {
  return product.filterName || product.type || product.oem || "Product";
}

function jobOrderDocument(inquiry: MonitoringInquiry): JOTemplateData {
  const product = inquiry.products[0];
  const specs = inquiry.joSpecs ?? product;
  const dimension = (value?: string) => value?.trim() || "—";
  return {
    jo: inquiry.joNumber ?? inquiry.code,
    client: inquiry.clientName,
    product: product ? productName(product) : "—",
    filterType: product?.type,
    qty: product?.qty ?? 0,
    date: "—",
    itemCode: specs?.oem ?? "—",
    enterFilPN: specs?.oem ?? "",
    poRef: poNumberForDisplay(inquiry),
    sketch: inquiry.joSketch,
    urgent: inquiry.urgent,
    dueDate: inquiry.dueDate,
    specs: {
      od1: dimension(specs?.od1),
      od2: dimension(specs?.od2),
      id1: dimension(specs?.id1),
      id2: dimension(specs?.id2),
      height: dimension(specs?.height),
      overallHeight: dimension(specs?.overallHeight),
      length: dimension(specs?.length),
      width: dimension(specs?.width),
      thickness: dimension(specs?.thickness),
      depth: dimension(specs?.depth),
      pocketCount: dimension(specs?.pocketCount),
      diameter: dimension(specs?.diameter),
      clothCuttingWidth: dimension(specs?.clothCuttingWidth),
      clothCuttingLength: dimension(specs?.clothCuttingLength),
      springPlateCenterToCenter: dimension(specs?.springPlateCenterToCenter),
      springPlateWidth: dimension(specs?.springPlateWidth),
      springPlateLength: dimension(specs?.springPlateLength),
      padOd: dimension(specs?.padOd),
      padId: dimension(specs?.padId),
      endCap: specs?.endCap,
      media: specs?.media,
      innerCore: specs?.innerCore,
      outerCore: specs?.outerCore,
      oring: specs?.oring,
      gasket: specs?.gasket,
      oem: specs?.oem,
      brand: specs?.brand,
      others: specs?.others,
    },
  };
}

export function OperationsProductionFloor() {
  const { mode } = useSession();
  const realMode = mode === "real";
  const { completedJOs } = useOrders();
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const remote = useProductionJobOrders({ q: search, status: "all" }, documentId ?? selectedId, realMode);
  const selectedDetail = remote.detail?.id === selectedId && !remote.detailLoading && !remote.detailError ? remote.detail : null;
  // Only the fields consumed by this read-only monitoring view are projected.
  // Missing delivery dates and financial fields are intentionally absent.
  const records = useMemo<MonitoringInquiry[]>(() => realMode ? remote.items.map(item => {
    const record = selectedDetail?.id === item.id ? selectedDetail : item;
    return ({
    id: record.id, code: record.inquiryReference, joNumber: record.reference, clientName: record.clientName,
    stage: record.status, currentStage: record.currentStageCursor, paused: record.paused,
    productionDueDate: record.productionDueDate ?? undefined, poNumber: record.purchaseOrderReference ?? undefined,
    products: [{ id: record.orderItemId, type: record.filterTypeCode ?? '', filterName: record.filterName ?? '', qty: record.quantity, oem: record.oemPartNumber == null ? undefined : String(record.oemPartNumber) }],
  }); }) : completedJOs, [realMode, remote.items, selectedDetail, completedJOs]);

  const jobs = useMemo(() => {
    const today = dayStart(new Date());
    return records.map((inquiry) => {
      const completed = isCompleted(inquiry);
      const overdue = getOverdue(inquiry, today, realMode);
      return {
        inquiry,
        stageIndex: getStageIndex(inquiry),
        completed,
        overdue,
        status: getStatus(inquiry, overdue),
        quantity: inquiry.products.reduce((sum, product) => sum + product.qty, 0),
      };
    });
  }, [records, realMode]);

  const visibleJobs = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const today = dayStart(new Date());
    const todayKey = localDateKey(today);

    return jobs.filter((job) => {
      const { inquiry } = job;
      if (filters.stage !== "all") {
        const selectedStage = Number(filters.stage);
        const isCompletedAtSelectedFinalStage = job.completed
          && job.stageIndex >= PRODUCTION_STAGES.length
          && selectedStage === PRODUCTION_STAGES.length - 1;
        if (job.stageIndex !== selectedStage && !isCompletedAtSelectedFinalStage) return false;
      }
      if (filters.status === "inProgress" && (job.completed || job.overdue || !ACTIVE_STAGES.has(inquiry.stage))) return false;
      if (filters.status === "completed" && !job.completed) return false;
      if (filters.status === "overdue" && !job.overdue) return false;

      const dueDate = parseDate(realMode ? inquiry.productionDueDate : inquiry.dueDate);
      if (filters.dueDate !== "all") {
        if (filters.dueDate === "overdue" && !job.overdue) return false;
        if (!dueDate && filters.dueDate !== "overdue") return false;
        if (dueDate) {
          const due = dayStart(dueDate);
          if (filters.dueDate === "today" && localDateKey(due) !== todayKey) return false;
          if (filters.dueDate === "upcoming" && due <= today) return false;
        }
      }

      if (!query) return true;
      const searchable = [
        inquiry.joNumber,
        inquiry.code,
        inquiry.clientName,
        ...inquiry.products.flatMap((product) => [product.type, product.filterName, product.oem]),
      ];
      return searchable.some((value) => value?.toLocaleLowerCase().includes(query));
    });
  }, [filters, jobs, search, realMode]);

  const selectedJob = jobs.find((job) => job.inquiry.id === selectedId);
  const documentJob = jobs.find((job) => job.inquiry.id === documentId);
  const activeCount = visibleJobs.filter((job) => ACTIVE_STAGES.has(job.inquiry.stage)).length;
  const inProgressCount = visibleJobs.filter((job) => job.inquiry.stage === "in_production" || job.inquiry.stage === "quality_inspection").length;
  const overdueCount = visibleJobs.filter((job) => job.overdue).length;
  const completedCount = visibleJobs.filter((job) => job.completed).length;
  const hasActiveFilters = filters.stage !== "all" || filters.status !== "all" || filters.dueDate !== "all";

  const applyFilters = () => {
    setFilters(draftFilters);
    setFilterOpen(false);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setDraftFilters(DEFAULT_FILTERS);
  };

  const openFilters = () => {
    setDraftFilters(filters);
    setFilterOpen((open) => !open);
  };

  return (
    <main className="flex-1 h-full min-w-0 overflow-auto" style={{ backgroundColor: "#F4F6F9" }}>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-5 py-5 sm:px-7 lg:px-9">
        <h1 className="font-syne" style={{ fontSize: 26, lineHeight: 1.2, fontWeight: 700, color: "#0F172A" }}>Production Floor</h1>
        <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>
          Monitor job orders, production progress, and delays.
        </p>
      </header>

      {realMode && <div role="status" className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-950 sm:px-7 lg:px-9">
        Job Orders are loaded from the authenticated Production API. Company-wide KPI definitions remain unavailable.
        {!remote.loading && !remote.error && remote.total > remote.items.length && <span> Showing {remote.items.length} of {remote.total} matching Job Orders; filters apply to loaded records.</span>}
        <button onClick={remote.refresh} disabled={remote.loading} className="ml-3 rounded border px-3 py-1">Refresh</button>
      </div>}

      <div className="px-5 py-6 sm:px-7 lg:px-9">
        <section aria-label="Production job order metrics" className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Active Job Orders" value={realMode ? "—" : activeCount} icon={Factory} accent="#1A2B4A" />
          <MetricCard label="In Progress" value={realMode ? "—" : inProgressCount} icon={Clock3} accent="#2563EB" />
          <MetricCard label="Overdue Jobs" value={realMode ? "—" : overdueCount} icon={AlertTriangle} accent="#C8102E" />
          <MetricCard label="Completed Jobs" value={realMode ? "—" : completedCount} icon={PackageCheck} accent="#16A34A" />
        </section>

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-lg">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search JO code, client, or product"
              aria-label="Search by JO code, client, or product"
              className="font-dm h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            />
          </div>
          <div className="relative sm:ml-auto">
            <button
              type="button"
              onClick={openFilters}
              aria-label="Open production filters"
              aria-expanded={filterOpen}
              aria-controls="operations-production-filters"
              aria-pressed={hasActiveFilters}
              className="font-dm flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              <Filter size={17} aria-hidden />
              {hasActiveFilters && <span className="absolute right-1 top-1 h-2 w-2 rounded-full" style={{ backgroundColor: "#C8102E" }} />}
            </button>
            {filterOpen && (
              <>
                <button className="fixed inset-0 z-40 cursor-default" aria-label="Close filters" onClick={() => setFilterOpen(false)} />
                <div
                  id="operations-production-filters"
                  role="dialog"
                  aria-label="Production filters"
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setFilterOpen(false);
                  }}
                  className="absolute right-0 top-full z-50 mt-2 max-h-[calc(100vh-2rem)] w-[min(22rem,calc(100vw-2.5rem))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-syne text-sm font-bold text-slate-900">Filters</h2>
                    <button type="button" aria-label="Close filters" onClick={() => setFilterOpen(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X size={15} /></button>
                  </div>
                  <label className="font-dm mb-3 block text-xs font-semibold text-slate-600">
                    Current Stage
                    <span className="relative mt-1 block">
                      <select
                        value={draftFilters.stage}
                        onChange={(event) => setDraftFilters({ ...draftFilters, stage: event.target.value })}
                        className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm font-medium text-slate-800 outline-none focus:border-slate-400"
                      >
                        <option value="all">All</option>
                        {PRODUCTION_STAGES.map((stage, index) => <option key={stage} value={String(index)}>{stage}</option>)}
                      </select>
                      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    </span>
                  </label>
                  <label className="font-dm mb-3 block text-xs font-semibold text-slate-600">
                    Status
                    <span className="relative mt-1 block">
                      <select
                        value={draftFilters.status}
                        onChange={(event) => setDraftFilters({ ...draftFilters, status: event.target.value as JobStatusFilter })}
                        className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm font-medium text-slate-800 outline-none focus:border-slate-400"
                      >
                        <option value="all">All</option>
                        <option value="inProgress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="overdue">Overdue</option>
                      </select>
                      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    </span>
                  </label>
                  <label className="font-dm mb-3 block text-xs font-semibold text-slate-600">
                    {realMode ? "Production Due Date" : "Due Date"}
                    <span className="relative mt-1 block">
                      <select
                        value={draftFilters.dueDate}
                        onChange={(event) => setDraftFilters({ ...draftFilters, dueDate: event.target.value as DueDateFilter })}
                        className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm font-medium text-slate-800 outline-none focus:border-slate-400"
                      >
                        <option value="all">All</option>
                        <option value="overdue">Overdue</option>
                        <option value="today">Due Today</option>
                        <option value="upcoming">Upcoming</option>
                      </select>
                      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    </span>
                  </label>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <button type="button" onClick={resetFilters} className="font-dm text-sm font-semibold text-slate-600 hover:text-slate-900">Reset</button>
                    <button type="button" onClick={applyFilters} className="font-dm rounded-lg px-4 py-2 text-sm font-semibold text-white hover:opacity-90" style={{ backgroundColor: "#1A2B4A" }}>Apply Filters</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {realMode && remote.loading ? <p role="status" className="p-4 text-sm text-slate-500">Loading Job Orders…</p> : realMode && remote.error ? <div role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">{remote.error}<button onClick={remote.refresh} className="ml-3 rounded border px-3 py-1">Retry</button></div> : visibleJobs.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center">
            <ClipboardList size={28} className="mx-auto mb-3 text-slate-300" />
            <p className="font-dm text-sm font-semibold text-slate-700">No matching job orders</p>
            <p className="font-dm mt-1 text-xs text-slate-500">Try changing your search or filters.</p>
          </div>
        ) : (
          <section aria-label="Job orders" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {visibleJobs.map((job) => {
              const { inquiry } = job;
              const currentStage = job.stageIndex < PRODUCTION_STAGES.length
                ? PRODUCTION_STAGES[job.stageIndex]
                : "Production Complete";
              return (
                <article
                  key={inquiry.id}
                  onClick={() => setSelectedId(inquiry.id)}
                  className="cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                    <div className="min-w-0">
                      <p className="font-mono-jb text-lg font-bold tracking-wide text-slate-900">{inquiry.joNumber ?? inquiry.code}</p>
                      <p className="font-dm mt-1 truncate text-sm font-semibold text-slate-700">{inquiry.clientName}</p>
                    </div>
                    <span className="font-dm rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: job.status.bg, color: job.status.fg }}>{job.status.label}</span>
                  </div>
                  <div className="space-y-3 px-5 py-4">
                    <div>
                      <p className="font-dm text-[11px] font-semibold uppercase tracking-wide text-slate-400">Product</p>
                      <p className="font-dm mt-0.5 text-sm font-medium text-slate-800">
                        {inquiry.products.map(productName).join(", ") || "—"}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <CardFact label="Quantity" value={`${job.quantity.toLocaleString()} pcs`} />
                      <CardFact label="Current Stage" value={currentStage} />
                      <CardFact label="Client Requested Delivery" value={formatDate(inquiry.dueDate)} alert={!realMode && job.overdue} />
                      <CardFact label="Production Due" value={formatDate(inquiry.productionDueDate)} alert={realMode && job.overdue} />
                      <CardFact label="Final Delivery Method" value={inquiry.deliveryMethod ?? "—"} />
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); setDocumentId(inquiry.id); }}
                        className="font-dm inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        <FileText size={14} /> View JO File
                      </button>
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); setSelectedId(inquiry.id); }}
                        className="font-dm inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold hover:bg-red-50"
                        style={{ color: "#C8102E" }}
                      >
                        <Eye size={14} /> View Details
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>

      {selectedJob && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50" onClick={() => setSelectedId(null)}>
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={`Job order details ${selectedJob.inquiry.joNumber ?? selectedJob.inquiry.code}`}
            className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 px-6 py-5 text-white" style={{ backgroundColor: "#1A2B4A" }}>
              <div className="min-w-0">
                <p className="font-mono-jb text-xl font-bold">{selectedJob.inquiry.joNumber ?? selectedJob.inquiry.code}</p>
                <p className="font-dm mt-1 text-sm font-semibold text-white/90">{selectedJob.inquiry.clientName}</p>
                <span className="font-dm mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: selectedJob.status.bg, color: selectedJob.status.fg }}>{selectedJob.status.label}</span>
              </div>
              <button type="button" aria-label="Close job order details" onClick={() => setSelectedId(null)} className="rounded-md p-2 text-white/80 hover:bg-white/10 hover:text-white"><X size={18} /></button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
              {realMode && <ProductionDetailStatus loading={remote.detailLoading || (!remote.detailError && !selectedDetail)} error={remote.detailError} retry={remote.retryDetail} />}
              <section>
                <h2 className="font-syne mb-3 text-sm font-bold text-slate-900">Job Order Details</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DetailFact label="Job Order" value={selectedJob.inquiry.joNumber ?? selectedJob.inquiry.code} />
                  <DetailFact label="Client" value={selectedJob.inquiry.clientName} />
                  <DetailFact label="Client Requested Delivery" value={formatDate(selectedJob.inquiry.dueDate)} alert={!realMode && selectedJob.overdue} />
                  <DetailFact label="Production Due" value={formatDate(selectedJob.inquiry.productionDueDate)} alert={realMode && selectedJob.overdue} />
                  <DetailFact label="Final Delivery Method" value={selectedJob.inquiry.deliveryMethod ?? "—"} />
                  <DetailFact label="Current Status" value={selectedJob.status.label} alert={selectedJob.overdue} />
                  <DetailFact label="Current Production Stage" value={selectedJob.stageIndex < PRODUCTION_STAGES.length ? PRODUCTION_STAGES[selectedJob.stageIndex] : "Production Complete"} />
                  <DetailFact label="Purchase Order" value={poNumberForDisplay(selectedJob.inquiry) ?? "—"} />
                </div>
              </section>

              {realMode && selectedDetail && <section><h2 className="font-syne mb-3 text-sm font-bold text-slate-900">Specifications</h2><div className="space-y-1 rounded-lg bg-slate-50 p-4 font-dm text-sm text-slate-700">{productionSpecifications(selectedDetail).map(line => <p key={line}>{line}</p>)}</div></section>}

              <section>
                <h2 className="font-syne mb-3 text-sm font-bold text-slate-900">Ordered Products</h2>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  {selectedJob.inquiry.products.map((product, index) => (
                    <div key={product.id} className={`flex items-start justify-between gap-4 px-4 py-3 ${index ? "border-t border-slate-100" : ""}`}>
                      <div className="min-w-0">
                        <p className="font-dm text-sm font-semibold text-slate-800">{productName(product)}</p>
                        {product.oem && <p className="font-dm mt-1 text-xs text-slate-500">{product.oem}</p>}
                      </div>
                      <p className="font-dm shrink-0 text-sm font-semibold text-slate-700">{product.qty.toLocaleString()} pcs</p>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
                    <span className="font-dm text-xs font-semibold text-slate-600">Total Quantity</span>
                    <span className="font-dm text-sm font-bold text-slate-900">{selectedJob.quantity.toLocaleString()} pcs</span>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="font-syne mb-1 text-sm font-bold text-slate-900">Production Stage Tracker</h2>
                <p className="font-dm mb-3 text-xs text-slate-500">Nine production stages. Completion dates, operators, and notes are shown only when stored on the job order.</p>
                <ol className="space-y-2">
                  {PRODUCTION_STAGES.map((stage, index) => {
                    const history = selectedJob.inquiry.stageHistory?.filter((entry) => entry.stage === index) ?? [];
                    const latestEntry = history[history.length - 1];
                    const event = realMode ? latestProductionStageEvent(selectedDetail, index) : undefined;
                    const done = realMode ? event?.action === "done" : latestEntry
                      ? latestEntry.status === "done"
                      : index < selectedJob.stageIndex || (selectedJob.completed && selectedJob.stageIndex >= PRODUCTION_STAGES.length);
                    const current = !done && !selectedJob.completed && selectedJob.inquiry.stage !== "cancelled" && index === selectedJob.stageIndex;
                    return (
                      <li key={stage} className="flex gap-3 rounded-lg border border-slate-200 px-3 py-3">
                        <span className="mt-0.5 shrink-0" aria-hidden>
                          {done ? <CheckCircle2 size={17} className="text-green-600" /> : current ? <span className="block h-[17px] w-[17px] rounded-full border-[5px] border-blue-500 bg-white" /> : <Circle size={17} className="text-slate-300" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className={`font-dm text-sm ${current ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>{index + 1}. {stage}</p>
                            <span className="font-dm text-[11px] font-semibold uppercase" style={{ color: done ? "#15803D" : current ? "#1D4ED8" : "#94A3B8" }}>
                              {done ? "Complete" : current ? "Current" : (realMode ? event?.action : latestEntry?.status) === "reverted" ? "Reverted" : realMode ? "Not recorded" : "Pending"}
                            </span>
                          </div>
                          {!realMode && latestEntry?.status === "done" && (
                            <p className="font-dm mt-1 text-xs text-slate-500">
                              Completed {formatDate(latestEntry.completedAt)}{latestEntry.completedBy ? ` · ${latestEntry.completedBy}` : ""}
                            </p>
                          )}
                          {latestEntry?.reason && <p className="font-dm mt-1 text-xs text-slate-600">Note: {latestEntry.reason}</p>}
                          {event && <p className="font-dm mt-1 text-xs text-slate-500">{event.action} · {formatProductionEventTime(event.occurredAt)} · {event.performedBy == null ? "Operator unavailable" : `User ID: ${event.performedBy}`}{event.reason ? ` · ${event.reason}` : ""}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>

              {realMode && selectedDetail && <ProductionEventHistory detail={selectedDetail} />}

              <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-syne text-sm font-bold text-slate-900">Job Order Document</h2>
                    <p className="font-dm mt-1 text-xs text-slate-500">{realMode ? "Preview generated from the saved Job Order. Original document and drawing retrieval are unavailable." : "View the existing Job Order document generated from this record."}</p>
                  </div>
                  <button type="button" onClick={() => setDocumentId(selectedJob.inquiry.id)} className="font-dm inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white hover:opacity-90" style={{ backgroundColor: "#1A2B4A" }}>
                    <FileText size={15} /> View JO File
                  </button>
                </div>
              </section>
            </div>
          </aside>
        </div>
      )}

      {!realMode && documentJob && (
        <JOTemplateModal data={jobOrderDocument(documentJob.inquiry)} onClose={() => setDocumentId(null)} />
      )}
      {realMode && documentId && <ProductionJobOrderDocument selectedId={documentId} detail={remote.detail} loading={remote.detailLoading} error={remote.detailError} retry={remote.retryDetail} onClose={() => setDocumentId(null)} />}
    </main>
  );
}

function MetricCard({ label, value, icon: Icon, accent }: { label: string; value: number | string; icon: typeof Factory; accent: string }) {
  return (
    <article className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" style={{ color: accent, backgroundColor: `${accent}14` }}>
        <Icon size={20} />
      </div>
      <div>
        <p className="font-dm text-xs font-semibold text-slate-500">{label}</p>
        <p className="font-syne mt-0.5 text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </article>
  );
}

function CardFact({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="font-dm text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="font-dm mt-0.5 break-words text-sm font-semibold" style={{ color: alert ? "#C8102E" : "#334155" }}>{value}</p>
    </div>
  );
}

function DetailFact({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2.5">
      <p className="font-dm text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="font-dm mt-1 break-words text-sm font-semibold" style={{ color: alert ? "#C8102E" : "#334155" }}>{value}</p>
    </div>
  );
}
