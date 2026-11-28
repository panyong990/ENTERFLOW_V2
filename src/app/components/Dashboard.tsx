import { WarehouseReference } from "./WarehouseReference";
import { useEffect as useWarehouseEffect } from "react";
import {
  getWarehouseDashboard,
  warehouseQuantity,
  type WarehouseDashboardResponse
} from "../api/warehouseDashboard";
import { useMemo, useState } from "react";
import { useProductionJobOrders } from "./useProductionJobOrders";
import { useSalesOrders } from "./useSalesOrders";
import { useSalesWorkspaceData, type SalesDashboardData } from "./sales/useSalesWorkspaceData";
import { useRealLogisticsShipments, shipmentStatus } from "./RealLogisticsShipments";
import { ShoppingCart, Factory, AlertTriangle, DollarSign, Search, Sparkles, Inbox, ArrowRight, CheckCircle2, Truck, Boxes, Clock3, ArrowUpRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { KPICard } from "./KPICard";
import { StatusBadge } from "./StatusBadge";
import { NotificationBell } from "./NotificationBell";
import { PRODUCTION_STAGES, stageLabel, useOrders, type Inquiry } from "../store/orders";
import { getFinishedGoodStockStatus, getRawMaterialStockStatus, useMaterials, type FinishedGood, type RawMaterial } from "../store/materials";
import { buildOrderHistory, getFinishedGoodOrderActivity } from "../store/recurringOrders";
import { FinishedGoodsOrderActivity } from "./FinishedGoodsOrderActivity";
import type { Role } from "./Login";
import { useSession } from "../store/session";

const weekly = import.meta.env.DEV ? [
  { day: "Mon", orders: 14 },
  { day: "Tue", orders: 22 },
  { day: "Wed", orders: 18 },
  { day: "Thu", orders: 28 },
  { day: "Fri", orders: 31 },
  { day: "Sat", orders: 19 },
  { day: "Sun", orders: 9 },
] : [];

const revenueTrend = import.meta.env.DEV ? [
  { m: "Nov", v: 820 },
  { m: "Dec", v: 940 },
  { m: "Jan", v: 880 },
  { m: "Feb", v: 1050 },
  { m: "Mar", v: 1120 },
  { m: "Apr", v: 1200 },
] : [];

const stages = import.meta.env.DEV ? [
  { name: "Molding", value: 5, color: "#C8102E" },
  { name: "Cutting", value: 4, color: "#1A2B4A" },
  { name: "Assembling", value: 6, color: "#C9A84C" },
  { name: "Heating / Gasket", value: 3, color: "#D97706" },
  { name: "Inspection", value: 2, color: "#2563EB" },
  { name: "Completed", value: 4, color: "#16A34A" },
] : [];

const activeJobs = import.meta.env.DEV ? [
  { jo: "JO-2026-001", client: "B.E. Aerospace", item: "Air Filter 115×103×500mm", status: "in-progress" as const, stage: "Quality Inspection", due: "Apr 30" },
  { jo: "JO-2026-002", client: "Maynilad", item: "Filter KF-OF.175.20.87", status: "pending" as const, stage: "Assembling", due: "May 02" },
  { jo: "JO-2026-003", client: "G.U. Engineering", item: "Oil Separator KF-OS.200", status: "in-progress" as const, stage: "Molding", due: "May 05" },
  { jo: "JO-2026-004", client: "Emerald Vinyl", item: "Column Filter", status: "pending" as const, stage: "Holding — Awaiting Material", due: "May 10" },
] : [];

const alerts = import.meta.env.DEV ? [
  { kind: "error", title: "Filter Media below threshold", body: "Only 5 rolls left · reorder triggered" },
  { kind: "warning", title: "JO-2026-001 deadline approaching", body: "3 days remaining · B.E. Aerospace" },
  { kind: "error", title: "Payment overdue: Maynilad", body: "Invoice INV-2026-0042 · 8 days past due" },
] : [];

const demoProductionSchedule = import.meta.env.DEV ? [
  { week: "Week 1 · Apr 27 – May 3", items: [{ jo: "JO-2026-001", client: "B.E. Aerospace", qty: 50, urgent: true }, { jo: "JO-2026-002", client: "Maynilad", qty: 100, urgent: false }] },
  { week: "Week 2 · May 4 – 10", items: [{ jo: "JO-2026-003", client: "G.U. Engineering", qty: 30, urgent: false }, { jo: "JO-2026-004", client: "Emerald Vinyl", qty: 20, urgent: false }] },
  { week: "Week 3 · May 11 – 17", items: [{ jo: "PLAN-1", client: "Maynilad (recurring)", qty: 200, urgent: false }] },
  { week: "Week 4 · May 18 – 24", items: [{ jo: "PLAN-2", client: "B.E. Aerospace (recurring)", qty: 30, urgent: false }] },
] : [];

const demoTopClients = import.meta.env.DEV ? [
  { rank: 1, client: "Maynilad", orders: 22, revenue: 2108400, last: "Mar 31, 2026", status: "Active" },
  { rank: 2, client: "B.E. Aerospace", orders: 14, revenue: 1248600, last: "Apr 10, 2026", status: "Active" },
  { rank: 3, client: "G.U. Engineering", orders: 6, revenue: 368100, last: "Apr 12, 2026", status: "Active" },
  { rank: 4, client: "Emerald Vinyl", orders: 2, revenue: 85200, last: "—", status: "Holding" },
  { rank: 5, client: "Monaco", orders: 1, revenue: 4680, last: "Apr 22, 2026", status: "New Inquiry" },
] : [];

const demoDueDates = import.meta.env.DEV ? [
  { inv: "SI-2026-9533", client: "Maynilad", amount: 46800, due: "Apr 29, 2026", days: 1, status: "Due tomorrow" },
  { inv: "SI-2026-0418", client: "B.E. Aerospace", amount: 46800, due: "May 10, 2026", days: 12, status: "Upcoming" },
  { inv: "SI-2026-0421", client: "G.U. Engineering", amount: 67500, due: "Apr 30, 2026", days: 2, status: "Due in 2d" },
] : [];

const demoPartialPayments = import.meta.env.DEV ? [
  { inv: "SI-2026-9533", client: "Maynilad", total: 46800, paid: 23400, remaining: 23400 },
] : [];

const demoDemandForecast = import.meta.env.DEV ? [
  { product: "Air Filter (Microglass)", topClient: "B.E. Aerospace", avgMonthly: 40, bufferMin: 20, inStock: 0, trend: "↑ +15%", urgent: true },
  { product: "Oil Separator Filter", topClient: "G.U. Engineering", avgMonthly: 25, bufferMin: 10, inStock: 0, trend: "→ Stable", urgent: false },
  { product: "Pleated Filter ZS20", topClient: "Maynilad", avgMonthly: 80, bufferMin: 50, inStock: 0, trend: "↑ +20%", urgent: true },
  { product: "Column Filter", topClient: "Emerald Vinyl", avgMonthly: 15, bufferMin: 5, inStock: 0, trend: "New Client", urgent: false },
] : [];

const alertColors: Record<string, { bg: string; bd: string; fg: string }> = {
  error: { bg: "#FEF2F2", bd: "#C8102E", fg: "#991B1B" },
  warning: { bg: "#FFFBEB", bd: "#D97706", fg: "#92400E" },
  info: { bg: "#EFF6FF", bd: "#2563EB", fg: "#1E40AF" },
  success: { bg: "#F0FDF4", bd: "#16A34A", fg: "#166534" },
};

function Card({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200/60 p-5 ${className}`} style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-syne" style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

const dashboardTitle: Partial<Record<Role, { title: string; subtitle: string }>> = {
  owner:      { title: "Owner Dashboard",       subtitle: "Full company overview · Real-time metrics" },
  operations: { title: "Operations Dashboard",  subtitle: "Operational overview — Enter-Fil Industrial Products" },
  sales:      { title: "Sales Dashboard",       subtitle: "Pipeline · Quotations · Top clients" },
  accounting: { title: "Finance Dashboard",     subtitle: "Receivables · Collections · Overdue accounts" },
  production: { title: "Production Dashboard",  subtitle: "Active JOs by client · Stage progress · Rush orders" },
  warehouse:  { title: "Warehouse Dashboard",   subtitle: "Inventory overview · Dispatch preparation" },
  logistics:  { title: "Logistics Dashboard",   subtitle: "Active deliveries · Delivery status · History" },
};

interface OperationalIssue {
  id: string;
  description: string;
  record: string;
  department: "Sales" | "Production" | "Inventory" | "Waybill" | "Logistics";
  status?: string;
  route: string;
  occurredAt?: string;
}

const operationalProductionStages = new Set(["jo", "in_production", "quality_inspection"]);
const operationalActiveOrderStages = new Set([
  "inquiry", "quotation", "po", "jo", "in_production", "quality_inspection", "ready_for_dispatch", "dispatched",
]);
const resolvedDeliveryStages = new Set(["delivered", "paid", "overdue"]);
const dayMilliseconds = 24 * 60 * 60 * 1000;

function parseOperationalDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function isRecentResolution(value: string | undefined, now: number): boolean {
  const date = parseOperationalDate(value);
  return Boolean(date && date.getTime() <= now && date.getTime() >= now - 7 * dayMilliseconds);
}

function orderReference(order: Inquiry): string {
  return order.joNumber ?? order.poNumber ?? order.code;
}

function buildOperationsIssues(
  orders: Inquiry[],
  rawMaterials: RawMaterial[],
  finishedGoods: FinishedGood[],
  now = Date.now(),
): { open: OperationalIssue[]; resolved: OperationalIssue[] } {
  const open: OperationalIssue[] = [];
  const resolved: OperationalIssue[] = [];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const lastProductionStage = PRODUCTION_STAGES.length - 1;

  for (const material of rawMaterials) {
    const stockStatus = getRawMaterialStockStatus(material);
    if (stockStatus.key !== "in-stock") {
      open.push({
        id: `raw-${material.id}`,
        description: `${stockStatus.label.replace(/^[^ ]+ /, "")}: ${material.name} has ${displayQuantity(material.qtyInStock)} ${material.unit} in stock (threshold ${displayQuantity(material.threshold)} ${material.unit}).`,
        record: material.id,
        department: "Inventory",
        status: stockStatus.label.replace(/^[^ ]+ /, ""),
        route: "inventory",
      });
    }

    for (const entry of material.history) {
      if (stockStatus.key !== "in-stock") break;
      if (entry.oldQty > material.threshold || entry.newQty <= material.threshold || !isRecentResolution(entry.date, now)) continue;
      resolved.push({
        id: `raw-resolved-${material.id}-${entry.id}`,
        description: `${material.name} stock was replenished above its low-stock threshold.`,
        record: material.id,
        department: "Inventory",
        status: "Resolved",
        route: "inventory",
        occurredAt: entry.date,
      });
    }
  }

  for (const item of finishedGoods) {
    const stockStatus = getFinishedGoodStockStatus(item);
    const status = stockStatus.key === "in-stock" ? undefined : stockStatus.label.replace(/^[^ ]+ /, "");
    if (status) {
      open.push({
        id: `finished-${item.id}`,
        description: `${status}: ${item.itemName} has ${displayQuantity(item.qtyInStock)} pcs in stock (buffer minimum ${displayQuantity(item.bufferMin)} pcs).`,
        record: `${item.itemCode} · ${item.client}`,
        department: "Inventory",
        status,
        route: "inventory-finished",
      });
    }

    for (const entry of item.history) {
      if (status) break;
      if (entry.oldQty > item.bufferMin || entry.newQty <= item.bufferMin || !isRecentResolution(entry.date, now)) continue;
      resolved.push({
        id: `finished-resolved-${item.id}-${entry.id}`,
        description: `${item.itemName} stock was replenished above its buffer minimum.`,
        record: `${item.itemCode} · ${item.client}`,
        department: "Inventory",
        status: "Resolved",
        route: "inventory-finished",
        occurredAt: entry.date,
      });
    }
  }

  for (const order of orders) {
    const reference = `${orderReference(order)} · ${order.clientName}`;
    const isProductionActive = operationalProductionStages.has(order.stage);
    const dueDate = parseOperationalDate(order.dueDate);
    const isOverdue = isProductionActive && Boolean(dueDate && dueDate.getTime() < today.getTime());

    if (isOverdue || (isProductionActive && order.paused)) {
      const stage = stageLabel[order.stage];
      open.push({
        id: `production-${order.id}`,
        description: isOverdue
          ? `Production job is past its required-by date${order.paused ? ` and on hold${order.pauseReason ? `: ${order.pauseReason}` : ""}` : ""}.`
          : `Production job is on hold${order.pauseReason ? `: ${order.pauseReason}` : ""}.`,
        record: reference,
        department: "Production",
        status: order.paused ? `On Hold · ${stage}` : `Overdue · ${stage}`,
        route: "production",
      });
    }

    if (order.stage === "ready_for_dispatch" && !order.waybillPrintedAt) {
      open.push({
        id: `waybill-${order.id}`,
        description: "Job is ready for dispatch but has no recorded waybill print timestamp.",
        record: reference,
        department: "Waybill",
        status: stageLabel[order.stage],
        route: "waybill",
      });
    }

    if (order.pendingCancellation) {
      open.push({
        id: `sales-cancellation-${order.id}`,
        description: `Cancellation request is awaiting review: ${order.pendingCancellation.reason}`,
        record: reference,
        department: "Sales",
        status: "Awaiting review",
        route: "sales",
      });
    }

    const completedProductionStage = (order.stageHistory ?? [])
      .filter((entry) => entry.stage === lastProductionStage && entry.status === "done")
      .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))[0];
    if (
      !isProductionActive
      && dueDate
      && dueDate.getTime() < today.getTime()
      && completedProductionStage
      && isRecentResolution(completedProductionStage.completedAt, now)
    ) {
      resolved.push({
        id: `production-resolved-${order.id}`,
        description: "Overdue production job completed its final recorded production stage.",
        record: reference,
        department: "Production",
        status: "Resolved",
        route: "production",
        occurredAt: completedProductionStage.completedAt,
      });
    }

    if (order.waybillPrintedAt && order.stage !== "ready_for_dispatch" && isRecentResolution(order.waybillPrintedAt, now)) {
      resolved.push({
        id: `waybill-resolved-${order.id}`,
        description: "Waybill was printed for this dispatch.",
        record: reference,
        department: "Waybill",
        status: "Resolved",
        route: "waybill",
        occurredAt: order.waybillPrintedAt,
      });
    }

    if (resolvedDeliveryStages.has(order.stage)) {
      const deliveredLog = [...(order.waybillLog ?? [])]
        .reverse()
        .find((entry) => entry.status.trim().toLocaleLowerCase() === "delivered" && isRecentResolution(entry.ts, now));
      const deliveryResolvedAt = deliveredLog?.ts ?? order.deliveredDate;
      if (deliveryResolvedAt && isRecentResolution(deliveryResolvedAt, now)) {
        resolved.push({
          id: `logistics-resolved-${order.id}`,
          description: "Delivery was recorded as completed.",
          record: reference,
          department: "Logistics",
          status: "Resolved",
          route: "logistics",
          occurredAt: deliveryResolvedAt,
        });
      }
    }
  }

  return {
    open: open.sort((a, b) => a.department.localeCompare(b.department) || a.record.localeCompare(b.record)),
    resolved: resolved.sort((a, b) => Date.parse(b.occurredAt ?? "") - Date.parse(a.occurredAt ?? "")),
  };
}

function OperationsBottlenecks({ openIssues, resolvedIssues, unavailable = false, onNavigate }: {
  openIssues: OperationalIssue[];
  resolvedIssues: OperationalIssue[];
  unavailable?: boolean;
  onNavigate?: (id: string) => void;
}) {
  const [view, setView] = useState<"open" | "resolved">("open");
  const issues = view === "open" ? openIssues : resolvedIssues;

  if (unavailable) {
    return (
      <Card title="Operational Bottlenecks">
        <p role="status" className="font-dm py-8 text-center text-sm text-slate-500">
          Operational issue data is unavailable. Open and recently resolved issues cannot be verified.
        </p>
      </Card>
    );
  }

  return (
    <Card
      title="Operational Bottlenecks"
      action={
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Operational issue views">
          {([
            { id: "open", label: "Open Issues" },
            { id: "resolved", label: "Recently Resolved" },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={view === tab.id}
              onClick={() => setView(tab.id)}
              className="rounded-md px-3 py-2 font-dm transition-colors"
              style={{
                backgroundColor: view === tab.id ? "#FFFFFF" : "transparent",
                color: view === tab.id ? "#1A2B4A" : "#64748B",
                fontSize: 12,
                fontWeight: 600,
                boxShadow: view === tab.id ? "0 1px 2px rgba(15,23,42,0.08)" : undefined,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      }
    >
      {issues.length ? (
        <div className="divide-y divide-slate-100">
          {issues.map((issue) => (
            <article key={issue.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="font-dm rounded-full px-2 py-1"
                    style={{
                      backgroundColor: issue.department === "Inventory" ? "#FFEDD5" : issue.department === "Production" ? "#FEE2E2" : "#DBEAFE",
                      color: issue.department === "Inventory" ? "#C2410C" : issue.department === "Production" ? "#991B1B" : "#1D4ED8",
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {issue.department}
                  </span>
                  {issue.status && (
                    <span className="font-dm rounded-full bg-slate-100 px-2 py-1" style={{ color: "#475569", fontSize: 10, fontWeight: 600 }}>
                      {issue.status}
                    </span>
                  )}
                  {issue.occurredAt && (
                    <time className="font-dm" dateTime={issue.occurredAt} style={{ color: "#94A3B8", fontSize: 11 }}>
                      {new Date(issue.occurredAt).toLocaleString()}
                    </time>
                  )}
                </div>
                <p className="font-dm mt-2" style={{ color: "#0F172A", fontSize: 13, lineHeight: 1.5 }}>{issue.description}</p>
                <p className="font-mono-jb mt-1 truncate" title={issue.record} style={{ color: "#64748B", fontSize: 11 }}>
                  {issue.record}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.(issue.route)}
                className="font-dm inline-flex shrink-0 items-center justify-center gap-1 rounded-md border border-slate-200 px-3 py-2 hover:bg-slate-50"
                style={{ color: "#1A2B4A", fontSize: 12, fontWeight: 600 }}
              >
                View Details <ArrowUpRight size={14} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="font-dm py-8 text-center" style={{ color: "#64748B", fontSize: 13 }}>
          {view === "open" ? "No open operational issues found in current system data." : "No issues have a recorded resolution in the last 7 days."}
        </p>
      )}
    </Card>
  );
}

export function Dashboard({ variant = "operations", onNavigate }: { variant?: Role; onNavigate?: (id: string) => void }) {
  return variant === "warehouse"
    ? <WarehouseDashboard onNavigate={onNavigate} />
    : <RoleDashboard variant={variant} onNavigate={onNavigate} />;
}

function displayQuantity(quantity: number): string {
  return quantity.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function WarehouseDashboard({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const { mode } = useSession();
  const realMode = mode === "real";
  const [liveData, setLiveData] = useState<WarehouseDashboardResponse | null>(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError] = useState(false);
  const [reload, setReload] = useState(0);

  useWarehouseEffect(() => {
    if (!realMode) {
      setLiveData(null);
      return;
    }

    const controller = new AbortController();

    setLiveLoading(true);
    setLiveError(false);
    setLiveData(null);

    getWarehouseDashboard(controller.signal)
      .then(result => {
        if (!controller.signal.aborted) setLiveData(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLiveError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLiveLoading(false);
      });

    return () => controller.abort();
  }, [realMode, reload]);

  useWarehouseEffect(() => {
    if (!realMode) return;

    const refresh = () => setReload(value => value + 1);

    window.addEventListener("focus", refresh);

    return () => window.removeEventListener("focus", refresh);
  }, [realMode]);

  const { rawMaterials, finishedGoods } = useMaterials();
  const { inquiries, completedJOs } = useOrders();
  const readyForDispatch = completedJOs.filter(
    (job) => job.stage === "ready_for_dispatch" && !job.waybillPrintedAt
  );
  const totalFinishedGoods = finishedGoods.reduce((total, item) => total + item.qtyInStock, 0);
  const topClientsByOrders = useMemo(() => {
    const orderHistory = buildOrderHistory(inquiries, completedJOs);
    const clients = new Map<string, { client: string; orderIds: Set<string> }>();

    for (const item of finishedGoods) {
      const clientKey = item.client.trim().toLocaleLowerCase();
      const matchingOrderIds = new Set(
        getFinishedGoodOrderActivity(item, orderHistory).matchingOrders.map((order) => order.id)
      );
      if (matchingOrderIds.size === 0) continue;

      const aggregate = clients.get(clientKey) ?? {
        client: item.client,
        orderIds: new Set<string>(),
      };
      matchingOrderIds.forEach((orderId) => aggregate.orderIds.add(orderId));
      clients.set(clientKey, aggregate);
    }

    return [...clients.values()]
      .map((aggregate) => ({
        client: aggregate.client,
        totalOrders: aggregate.orderIds.size,
      }))
      .sort((a, b) => b.totalOrders - a.totalOrders || a.client.localeCompare(b.client))
      .slice(0, 3);
  }, [inquiries, completedJOs, finishedGoods]);
  const lowStockItems = rawMaterials
    .map((item) => ({ item, status: getRawMaterialStockStatus(item) }))
    .filter(({ status }) => status.key !== "in-stock")
    .map(({ item, status }) => ({
      id: `raw-${item.id}`,
      name: item.name,
      current: item.qtyInStock,
      minimum: item.threshold,
      unit: item.unit,
      status,
    }));
  const activity = [
    ...rawMaterials.flatMap((item) =>
      item.history.map((entry) => ({
        id: `raw-${entry.id}`,
        date: entry.date,
        title: "Raw material stock updated",
        subject: item.name,
        description: `${displayQuantity(entry.oldQty)} → ${displayQuantity(entry.newQty)} ${item.unit} · ${entry.reason}`,
        user: entry.user,
      }))
    ),
    ...finishedGoods.flatMap((item) =>
      item.history.map((entry) => ({
        id: `finished-${entry.id}`,
        date: entry.date,
        title: "Finished goods stock updated",
        subject: item.itemName,
        description: `${displayQuantity(entry.oldQty)} → ${displayQuantity(entry.newQty)} pcs · ${entry.reason}`,
        user: entry.user,
      }))
    ),
    ...completedJOs.flatMap((job) =>
      (job.waybillLog ?? []).map((entry, index) => ({
        id: `waybill-${job.id}-${index}`,
        date: entry.ts,
        title: entry.status,
        subject: `${job.joNumber ?? `JO-${job.code}`} · ${job.clientName}`,
        description: entry.note ?? "Waybill dispatch activity",
        user: undefined,
      }))
    ),
    ...completedJOs
      .filter((job) => Boolean(job.joCompletedAt))
      .map((job) => ({
        id: `completion-${job.id}`,
        date: job.joCompletedAt!,
        title: "Job order handed over to Warehouse",
        subject: `${job.joNumber ?? `JO-${job.code}`} · ${job.clientName}`,
        description: job.products[0]?.filterName ?? job.products[0]?.type ?? "Completed job order",
        user: job.stageHistory?.[job.stageHistory.length - 1]?.completedBy,
      })),
  ]
    .filter((entry) => !Number.isNaN(new Date(entry.date).getTime()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);
  const live = realMode && !liveLoading && !liveError ? liveData : null;
  const unavailable = realMode && !live;

  const unavailableMessage = liveError
    ? "Warehouse data is unavailable."
    : "Loading Warehouse records...";

  const displayedLowStock = realMode
    ? (live?.lowStockAlerts ?? []).map(item => ({
        id: item.id,
        name: item.name,
        current: warehouseQuantity(item.current),
        minimum: warehouseQuantity(item.minimum),
        unit: item.unit,
        status: item.status === "out-of-stock"
          ? { label: "Out of Stock", bg: "#FEE2E2", fg: "#991B1B" }
          : { label: "Low Stock", bg: "#FFEDD5", fg: "#C2410C" }
      }))
    : lowStockItems.map(item => ({
        ...item,
        current: displayQuantity(item.current),
        minimum: displayQuantity(item.minimum)
      }));

  const displayedClients = realMode
    ? live?.topClientsByOrders ?? []
    : topClientsByOrders;

  const dispatchTotal = realMode
    ? live?.readyForDispatch.total ?? null
    : String(readyForDispatch.length);

  const displayedDispatch = realMode
    ? (live?.readyForDispatch.items ?? []).map(job => ({
        id: job.id,
        joNumber: job.joNumber,
        client: job.client ?? "Not recorded",
        product: job.product ?? "Not recorded",
        quantity: warehouseQuantity(job.totalQuantity)
      }))
    : readyForDispatch.slice(0, 6).map(job => ({
        id: job.id,
        joNumber: job.joNumber ?? `JO-${job.code}`,
        client: job.clientName,
        product: job.products[0]?.filterName ?? job.products[0]?.type ?? "\u2014",
        quantity: job.products.reduce((total, product) => total + product.qty, 0)
      }));

  const displayedActivity = realMode
    ? (live?.recentActivity ?? []).map(entry => ({
        id: entry.id,
        date: entry.date,
        title: entry.title,
        subject: entry.subject,
        description: entry.newQty != null
          ? `${warehouseQuantity(entry.oldQty)} \u2192 ${warehouseQuantity(entry.newQty)} ${entry.unit ?? ""} \u00b7 ${entry.reason ?? "Stock observation"}`
          : entry.description ?? "",
        user: entry.actorId ? `Employee ID ${entry.actorId}` : undefined
      }))
    : activity;

  const metrics = [
    {
      label: "Tracked Raw Material Items",
      value: realMode
        ? live ? String(live.trackedRawMaterialItems) : "\u2014"
        : String(rawMaterials.length),
      detail: "in inventory",
      icon: Boxes,
      color: "#1A2B4A"
    },
    {
      label: "Finished Goods",
      value: realMode
        ? live
          ? live.finishedGoods.complete
            ? warehouseQuantity(live.finishedGoods.totalQuantity)
            : `${warehouseQuantity(live.finishedGoods.verifiedQuantity)}*`
          : "\u2014"
        : displayQuantity(totalFinishedGoods),
      detail: realMode
        ? live
          ? `${live.finishedGoods.recordedItems} recorded items \u00b7 pcs${live.finishedGoods.complete ? "" : ` \u00b7 *verified subtotal; ${live.finishedGoods.unverifiedItems} unverified`}`
          : "Authenticated inventory"
        : `${finishedGoods.length} recorded items \u00b7 pcs`,
      icon: Factory,
      color: "#2563EB"
    },
    {
      label: "Low-Stock Items",
      value: realMode
        ? live ? String(live.lowStock.confirmedItems) : "\u2014"
        : String(lowStockItems.length),
      detail: realMode
        ? live
          ? `${live.lowStock.confirmedItems} confirmed${live.lowStock.unverifiedItems ? ` \u00b7 ${live.lowStock.unverifiedItems} unverified` : " \u00b7 all assessed"}`
          : "Authenticated stock status"
        : "at or below threshold, including out of stock",
      icon: AlertTriangle,
      color: realMode
        ? live && live.lowStock.complete && live.lowStock.confirmedItems === 0
          ? "#16A34A"
          : "#C2410C"
        : lowStockItems.length ? "#C2410C" : "#16A34A"
    },
    {
      label: "Ready for Dispatch",
      value: dispatchTotal === null ? "\u2014" : warehouseQuantity(dispatchTotal),
      detail: "awaiting Warehouse preparation",
      icon: Truck,
      color: "#0F766E"
    }
  ];

  return (
    <div className="flex-1 h-full overflow-auto" style={{ backgroundColor: "#F4F6F9" }}>
      <header className="bg-white border-b border-slate-200/70 px-5 py-5 sm:px-8 sticky top-0 z-10">
        <h1 className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>Warehouse Dashboard</h1>
        <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>Inventory health · Finished goods · Dispatch preparation</p>
      </header>

      <main className="px-4 py-5 sm:px-8 sm:py-7 flex flex-col gap-6">
        {realMode && (
          <div className="flex items-center gap-3 font-dm text-xs text-slate-500">
            <span role={liveError ? "alert" : "status"}>
              {unavailable ? unavailableMessage : "Live Warehouse records"}
            </span>
            <button
              type="button"
              disabled={liveLoading}
              onClick={() => setReload(value => value + 1)}
              className="ml-auto rounded-md border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {liveLoading ? "Loading..." : "Refresh Dashboard"}
            </button>
          </div>
        )}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Warehouse summary">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            const card = (
              <>
                <div className="min-w-0">
                  <div className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#64748B" }}>{metric.label}</div>
                  <div className="font-syne mt-3" style={{ fontSize: 30, lineHeight: 1, fontWeight: 800, color: "#0F172A" }}>{metric.value}</div>
                  <div className="font-dm mt-2" style={{ fontSize: 12, color: "#64748B" }}>{metric.detail}</div>
                </div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${metric.color}15`, color: metric.color }}><Icon size={19} /></div>
              </>
            );
            return metric.label === "Tracked Raw Material Items" ? (
              <button
                key={metric.label}
                type="button"
                onClick={() => onNavigate?.("inventory")}
                aria-label="Open raw materials in Inventory"
                className="bg-white rounded-xl border border-slate-200/70 p-5 flex items-start justify-between gap-3 text-left cursor-pointer hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
                style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}
              >
                {card}
              </button>
            ) : (
              <div key={metric.label} className="bg-white rounded-xl border border-slate-200/70 p-5 flex items-start justify-between gap-3" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
                {card}
              </div>
            );
          })}
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <Card title="Low-Stock Alerts" className="xl:col-span-5">
            {unavailable ? <p className="font-dm text-xs text-slate-500">{unavailableMessage}</p> : displayedLowStock.length ? (
              <div className="max-h-[390px] overflow-auto flex flex-col divide-y divide-slate-100">
                {displayedLowStock.map((item) => (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-dm font-semibold truncate" style={{ fontSize: 13, color: "#0F172A" }}>{item.name}</div>
                        <div className="font-dm mt-1" style={{ fontSize: 12, color: "#64748B" }}>On hand {item.current} {item.unit} · Minimum {item.minimum} {item.unit}</div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 whitespace-nowrap" style={{ backgroundColor: item.status.bg, color: item.status.fg, fontSize: 11, fontWeight: 600 }}>
                        {item.status.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <CheckCircle2 size={24} className="mx-auto" style={{ color: realMode && !live?.lowStock.complete ? "#94A3B8" : "#16A34A" }} />
                <p className="font-dm mt-2" style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>{realMode && !live?.lowStock.complete ? "No confirmed low-stock items." : "No low-stock items."}</p>
              </div>
            )}
            {live && live.lowStock.unverifiedItems > 0 && (
              <p className="font-dm mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
                {live.lowStock.unverifiedItems} materials have unverified stock or threshold data.
              </p>
            )}
          </Card>

          <Card
            title="Top Clients by Orders"
            className="xl:col-span-7"
            action={<button type="button" onClick={() => onNavigate?.("inventory-finished")} className="font-dm inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-50" style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}>View Inventory <ArrowRight size={13} /></button>}
          >
            {unavailable ? <p className="font-dm text-xs text-slate-500">{unavailableMessage}</p> : displayedClients.length ? (
              <ol className="divide-y divide-slate-100">
                {displayedClients.map((client, index) => (
                  <li key={client.client} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="font-mono-jb w-5 shrink-0 text-center" style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>{index + 1}</span>
                    <span className="font-dm min-w-0 flex-1 truncate" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{client.client}</span>
                    <span className="font-dm shrink-0 text-right" style={{ fontSize: 13, fontWeight: 700, color: "#1A2B4A" }}>{client.totalOrders}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="py-5 text-center">
                <p className="font-dm" style={{ fontSize: 13, color: "#64748B" }}>No recurring finished-goods orders found.</p>
              </div>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <Card
            title="Ready for Dispatch"
            className="xl:col-span-7"
            action={<button onClick={() => onNavigate?.("waybill")} className="font-dm inline-flex items-center gap-1 px-3 py-2 rounded-md hover:bg-slate-50" style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}>View All <ArrowUpRight size={14} /></button>}
          >
            {unavailable ? <p className="font-dm text-xs text-slate-500">{unavailableMessage}</p> : displayedDispatch.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead><tr className="text-left border-b border-slate-100">
                    {["JO Number", "Client", "Product", "Qty", "Status"].map((heading) => <th key={heading} className="font-dm py-2 px-2 first:pl-0" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>{heading}</th>)}
                  </tr></thead>
                  <tbody>
                    {displayedDispatch.map((job) => (
                      <tr key={job.id} className="border-b last:border-0 border-slate-100">
                        <td className="font-mono-jb py-3 px-2 pl-0 whitespace-nowrap" style={{ fontSize: 11, fontWeight: 600, color: "#1A2B4A" }}><WarehouseReference value={job.joNumber}/></td>
                        <td className="font-dm py-3 px-2" style={{ fontSize: 12, color: "#0F172A" }}>{job.client}</td>
                        <td className="font-dm py-3 px-2" style={{ fontSize: 12, color: "#475569" }}>{job.product}</td>
                        <td className="font-dm py-3 px-2 whitespace-nowrap" style={{ fontSize: 12, color: "#475569" }}>{job.quantity}</td>
                        <td className="py-3 px-2"><span className="font-dm inline-flex items-center rounded-full px-2 py-1 whitespace-nowrap" style={{ backgroundColor: "#EFF6FF", color: "#1D4ED8", fontSize: 11, fontWeight: 600 }}>Ready for Dispatch</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {dispatchTotal !== null && Number(dispatchTotal) > 6 && <p className="font-dm mt-3" style={{ fontSize: 11, color: "#64748B" }}>Showing 6 of {warehouseQuantity(dispatchTotal)} ready job orders.</p>}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Truck size={24} className="mx-auto" style={{ color: "#94A3B8" }} />
                <p className="font-dm mt-2" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>No job orders are awaiting dispatch preparation.</p>
              </div>
            )}
          </Card>

          <Card title="Recent Activity" className="xl:col-span-5">
            {live && live.recentActivityComplete !== true && (
              <p className="font-dm mb-3 text-xs text-slate-500">
                Showing recorded inventory and dispatch activity. Historical coverage may be incomplete.
              </p>
            )}
            {unavailable ? <p className="font-dm text-xs text-slate-500">{unavailableMessage}</p> : displayedActivity.length ? (
              <div className="flex flex-col">
                {displayedActivity.map((entry) => (
                  <div key={entry.id} className="flex gap-3 py-3 first:pt-0 last:pb-0 border-b last:border-0 border-slate-100">
                    <div className="mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#EFF6FF", color: "#2563EB" }}><Clock3 size={13} /></div>
                    <div className="min-w-0">
                      <div className="font-dm font-semibold" style={{ fontSize: 12, color: "#0F172A" }}>{entry.title}</div>
                      <div className="font-dm mt-0.5 truncate" style={{ fontSize: 11, color: "#475569" }} title={entry.subject}><WarehouseReference value={entry.subject}/></div>
                      <div className="font-dm mt-1" style={{ fontSize: 11, color: "#64748B" }}>{entry.description}</div>
                      <div className="font-dm mt-1" style={{ fontSize: 10, color: "#94A3B8" }}>
                        {new Date(entry.date).toLocaleString()} {entry.user ? `· ${entry.user}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Clock3 size={23} className="mx-auto" style={{ color: "#94A3B8" }} />
                <p className="font-dm mt-2" style={{ fontSize: 13, color: "#64748B" }}>No inventory or dispatch activity recorded yet.</p>
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}

function RoleDashboard({ variant = "operations", onNavigate }: { variant?: Role; onNavigate?: (id: string) => void }) {
  const role = variant;
  const isAcc = role === "accounting";
  const { mode } = useSession();
  const realMode = mode === "real";
  const production = useProductionJobOrders({ q: '', status: 'all' }, null, realMode && (role === 'operations' || role === 'production'));
  const summary = useSalesWorkspaceData<SalesDashboardData>(role === 'owner' ? '/api/owner/dashboard' : '/api/sales/dashboard', realMode && (role === 'sales' || role === 'owner'));
  const pending = useSalesOrders(realMode && role === 'sales', { q: '', status: 'open', stage: 'inquiry', sort: 'submitted-desc', page: 1, pageSize: 4 });
  const shipments = useRealLogisticsShipments(realMode && role === 'logistics');
  const { inquiries, completedJOs } = useOrders();
  const { rawMaterials, finishedGoods } = useMaterials();
  const pendingInquiries = realMode ? (pending.data?.items ?? []).map(row => ({ id: row.id, code: row.reference, clientName: row.companyName, urgent: row.urgent, submittedDate: row.submittedAt, products: [] as {type:string}[] })) : inquiries.filter(i => i.stage === "inquiry");
  const meta = dashboardTitle[role] ?? { title: "Dashboard", subtitle: "Real-time overview" };

  /* DERIVED KPIs — single source of truth across the entire system */
  const allActive = [...inquiries, ...completedJOs];
  const activeOrdersCount = allActive.length;
  const operationsOrders = useMemo(
    () => [...new Map([...inquiries, ...completedJOs].map((order) => [order.id, order])).values()],
    [inquiries, completedJOs],
  );
  const operationsActiveOrders = operationsOrders.filter((order) => operationalActiveOrderStages.has(order.stage));
  const operationsProductionJobs = operationsOrders.filter((order) => operationalProductionStages.has(order.stage));
  const operationsDeliveries = operationsOrders.filter(
    (order) => order.stage === "dispatched" || (order.stage === "ready_for_dispatch" && Boolean(order.waybillPrintedAt)),
  );
  const inventoryAlertCount = rawMaterials.filter(
    (material) => getRawMaterialStockStatus(material).key !== "in-stock",
  ).length + finishedGoods.filter(
    (item) => item.qtyInStock <= item.bufferMin,
  ).length;
  const operationsIssues = useMemo(
    () => realMode ? { open: [], resolved: [] } : buildOperationsIssues(operationsOrders, rawMaterials, finishedGoods),
    [realMode, operationsOrders, rawMaterials, finishedGoods],
  );
  const jobsInProgress = completedJOs.filter(i => i.stage === "in_production" || i.stage === "quality_inspection").length;
  const activeProductionJobs = completedJOs.filter(
    (job) => job.stage === "jo" || job.stage === "in_production" || job.stage === "quality_inspection"
  );
  const overviewJobs = realMode ? production.items.filter(job => ['jo', 'in_production', 'quality_inspection'].includes(job.status)).map(job => ({
    id: job.id, joNumber: job.reference, code: job.inquiryReference, clientName: job.clientName,
    stage: job.status, currentStage: job.currentStageCursor, paused: job.paused,
    products: [{ filterName: job.filterName, type: job.filterTypeCode }],
  })) : activeProductionJobs;
  const inProgressProductionJobs = activeProductionJobs.filter(
    (job) => job.stage === "in_production" || job.stage === "quality_inspection"
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueProductionJobs = activeProductionJobs.filter((job) => {
    if (!job.dueDate) return false;
    const dueDate = new Date(job.dueDate);
    return !Number.isNaN(dueDate.getTime()) && dueDate.getTime() < today.getTime();
  });
  const reportingPeriodStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const completedProductionJobs = completedJOs.filter((job) => {
    if (!job.joCompletedAt) return false;
    const completedAt = new Date(job.joCompletedAt);
    return !Number.isNaN(completedAt.getTime())
      && completedAt >= reportingPeriodStart
      && completedAt <= new Date();
  });
  const quotationsSent = inquiries.filter(i => i.stage === "quotation").length;
  const posReceived = inquiries.filter(i => i.stage === "po").length;
  const paidInquiries = completedJOs.filter(i => i.stage === "paid");
  const revenueTotal = paidInquiries.reduce((s, i) => s + (i.amountPaid ?? i.invoiceAmount ?? 0), 0);
  const totalReceivables = completedJOs.filter(i => i.stage === "delivered" || i.stage === "overdue").reduce((s, i) => s + ((i.invoiceAmount ?? 0) - (i.amountPaid ?? 0)), 0);
  const collectedThisMonth = paidInquiries.reduce((s, i) => s + (i.amountPaid ?? i.invoiceAmount ?? 0), 0);
  const overdueInvoices = completedJOs.filter(i => {
    if (!i.paymentCycleStartedAt || !i.invoiceDueDate) return false;
    const due = new Date(i.invoiceDueDate);
    return !isNaN(due.getTime()) && due.getTime() < Date.now() && i.stage !== "paid";
  });
  const overdueAmount = overdueInvoices.reduce((s, i) => s + ((i.invoiceAmount ?? 0) - (i.amountPaid ?? 0)), 0);
  const partialPaymentsCount = completedJOs.filter(i => (i.amountPaid ?? 0) > 0 && i.stage !== "paid").length;
  const logisticsActiveDeliveries = completedJOs.filter(
    (inquiry) => inquiry.stage === "dispatched" || (inquiry.stage === "ready_for_dispatch" && Boolean(inquiry.waybillPrintedAt))
  );
  const logisticsInTransit = completedJOs.filter((inquiry) => inquiry.stage === "dispatched").length;
  const logisticsDelivered = completedJOs.filter(
    (inquiry) => inquiry.stage === "delivered" || inquiry.stage === "paid" || inquiry.stage === "overdue"
  ).length;
  const logisticsActiveJobs = completedJOs.filter(
    (inquiry) => inquiry.stage === "jo" || inquiry.stage === "in_production" || inquiry.stage === "quality_inspection"
  );
  const logisticsDeliveryMethods = completedJOs
    .filter((inquiry) => ["ready_for_dispatch", "dispatched", "delivered", "paid", "overdue"].includes(inquiry.stage) && inquiry.deliveryMethod)
    .reduce<Record<string, number>>((counts, inquiry) => {
      const method = inquiry.deliveryMethod!;
      counts[method] = (counts[method] ?? 0) + 1;
      return counts;
    }, {});
  const deliveryOverviewRows = realMode ? shipments.rows.filter(row => row.status !== 'delivered').map(row => ({
    id: row.id, jo: row.jobOrderReference, client: row.companyName, item: 'Unavailable', quantity: '—',
    method: row.deliveryMethodLabel ?? '—', label: shipmentStatus(row).label,
  })) : logisticsActiveDeliveries.map(inquiry => ({
    id: inquiry.id, jo: inquiry.joNumber ?? `JO-${inquiry.code}`, client: inquiry.clientName,
    item: inquiry.products[0]?.filterName ?? inquiry.products[0]?.type ?? '—',
    quantity: inquiry.products.reduce((total, product) => total + product.qty, 0), method: inquiry.deliveryMethod ?? '—', label: stageLabel[inquiry.stage],
  }));

  const formatPeso = (n: number) => n >= 1000000 ? `₱${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `₱${(n / 1000).toFixed(0)}K` : `₱${n.toFixed(0)}`;

  return (
    <div className={role === "production" ? "flex-1 min-w-0 h-full overflow-auto" : "flex-1 h-full overflow-auto"} style={{ backgroundColor: "#F4F6F9" }}>
      {/* Topbar */}
      <header className={`bg-white border-b border-slate-200/70 ${role === "production" ? "px-4 sm:px-8" : "px-8"} py-5 flex items-center justify-between sticky top-0 z-10`}>
        <div>
          <h1 className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>
            {meta.title}
          </h1>
          <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>
            {meta.subtitle}
          </p>
        </div>
        {role !== "logistics" && role !== "sales" && role !== "production" && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} />
              <input
                placeholder="Search PO, JO, client..."
                className="font-dm pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-slate-400 w-72 max-[1200px]:w-48"
                style={{ fontSize: 13, backgroundColor: "#F4F6F9" }}
              />
            </div>
            <NotificationBell role={role} onNavigate={onNavigate} />
          </div>
        )}
      </header>

      <div className={role === "production" ? "px-4 sm:px-8 py-5 sm:py-8" : "px-8 py-8"} style={role === "production" ? undefined : { paddingLeft: 32, paddingRight: 32 }}>
        {realMode && <div role="status" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Supported records are loaded from the role's authenticated APIs. Dashboard metrics without an approved aggregate remain unavailable.</div>}
        {realMode && (role === 'sales' || role === 'owner') && <div className="mb-4 text-sm text-slate-600">{summary.loading ? <p role="status">Loading dashboard…</p> : summary.error ? <p role="alert">{summary.error}</p> : null}<button onClick={summary.refresh} disabled={summary.loading} className="rounded border bg-white px-3 py-2 text-xs font-semibold">{summary.error ? 'Retry dashboard' : 'Refresh dashboard'}</button></div>}
        {import.meta.env.DEV && isAcc && !realMode && (
          <div
            className="rounded-xl p-4 mb-6 flex items-start gap-3"
            style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#DBEAFE", color: "#1D4ED8" }}>
              <Sparkles size={18} />
            </div>
            <div className="flex-1">
              <div className="font-syne mb-0.5" style={{ fontSize: 13, fontWeight: 700, color: "#1E3A8A", letterSpacing: 0.4 }}>
                AI Production Insight
              </div>
              <div className="font-dm" style={{ fontSize: 13, color: "#1E40AF", lineHeight: 1.5 }}>
                Based on current load, 2 orders risk delay. PO-9901 needs prioritization to meet Apr 30 deadline. Estimated bottleneck: Assembling stage.
              </div>
            </div>
            <button
              className="font-dm px-3 py-1.5 rounded-md text-white shrink-0"
              style={{ backgroundColor: "#2563EB", fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}
            >
              AI PINNED
            </button>
          </div>
        )}
        {/* KPI Row — role-specific */}
        <div className={role === "production" ? "grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6" : role === "operations" ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 mb-8" : "grid grid-cols-4 gap-6 mb-8"}>
          {role === "owner" && (
            <>
              <KPICard label={realMode ? 'Pending Inquiries' : 'Active Orders'} value={String(activeOrdersCount)} liveValue={summary.data ? String(summary.data.pendingInquiries) : undefined} delta="Owner overview" trend="up" icon={ShoppingCart} accent="#C8102E" />
              <KPICard label={realMode ? 'Quotations Sent' : 'Jobs In Progress'} value={String(jobsInProgress)} liveValue={summary.data ? String(summary.data.quotationsSent) : undefined} delta="Owner overview" trend="up" icon={Factory} accent="#1A2B4A" />
              <KPICard label={realMode ? 'POs Received' : 'Low Stock Alerts'} value="3" liveValue={summary.data ? String(summary.data.purchaseOrdersReceived) : undefined} delta="Owner overview" trend="down" icon={AlertTriangle} accent="#D97706" />
              <KPICard label={realMode ? 'Verified Revenue' : 'Revenue'} value={formatPeso(revenueTotal)} liveValue={summary.data ? `₱${summary.data.verifiedRevenue}` : undefined} delta={realMode ? 'all-time verified payments' : `${paidInquiries.length} paid orders`} trend="up" icon={DollarSign} accent="#16A34A" />
            </>
          )}
          {role === "operations" && (
            <>
              <KPICard label="Active Orders" value={String(operationsActiveOrders.length)} delta="open operational pipeline" showTrend={false} icon={ShoppingCart} accent="#C8102E" />
              <KPICard label={realMode ? "Production Job Orders" : "Active Production Jobs"} liveValue={realMode && !production.loading && !production.error ? String(production.total) : undefined} value={String(operationsProductionJobs.length)} delta="Authenticated Production API" showTrend={false} icon={Factory} accent="#1A2B4A" />
              <KPICard label="Inventory Alerts" value={String(inventoryAlertCount)} delta="Low-stock and out-of-stock items" showTrend={false} icon={AlertTriangle} accent="#D97706" />
              <KPICard label="Active Deliveries" value={String(operationsDeliveries.length)} delta="Ready with waybill or dispatched" showTrend={false} icon={Truck} accent="#16A34A" />
            </>
          )}
          {role === "sales" && (
            <>
              <KPICard label="Pending Inquiries" value={String(pendingInquiries.length)} liveValue={summary.data ? String(summary.data.pendingInquiries) : undefined} delta="awaiting review" trend="up" icon={Inbox} accent="#C8102E" />
              <KPICard label="Quotations Sent" value={String(quotationsSent)} liveValue={summary.data ? String(summary.data.quotationsSent) : undefined} delta="awaiting PO" trend="up" icon={ShoppingCart} accent="#1A2B4A" />
              <KPICard label="POs Received" value={String(posReceived)} liveValue={summary.data ? String(summary.data.purchaseOrdersReceived) : undefined} delta={realMode ? 'PO records received; Job Order prerequisites still apply' : 'ready for JO'} trend="up" icon={Factory} accent="#C9A84C" />
              <KPICard label={realMode ? 'Verified Revenue' : 'Monthly Revenue'} value={formatPeso(revenueTotal)} liveValue={summary.data ? `₱${summary.data.verifiedRevenue}` : undefined} delta={realMode ? 'all-time verified payments' : 'paid orders'} trend="up" icon={DollarSign} accent="#16A34A" />
            </>
          )}
          {role === "accounting" && (
            <>
              <KPICard label="Total Receivables"   value={formatPeso(totalReceivables)}   delta="open balance"           trend="down" icon={DollarSign}      accent="#C8102E" />
              <KPICard label="Collected This Month" value={formatPeso(collectedThisMonth)} delta={`${paidInquiries.length} paid`} trend="up"   icon={DollarSign}      accent="#16A34A" />
              <KPICard label="Overdue Amount"      value={formatPeso(overdueAmount)}      delta={`${overdueInvoices.length} invoices`} trend="down" icon={AlertTriangle} accent="#D97706" />
              <KPICard label="Partial Payments"    value={String(partialPaymentsCount)}   delta="active"                 trend="up"   icon={ShoppingCart}    accent="#1A2B4A" />
            </>
          )}
          {role === "production" && (
            <>
              <KPICard label="Active Job Orders" value={String(activeProductionJobs.length)} delta="Currently in the production pipeline" showTrend={false} icon={Factory} accent="#C8102E" />
              <KPICard label="In Progress" value={String(inProgressProductionJobs.length)} delta="In production or quality inspection" showTrend={false} icon={Clock3} accent="#1A2B4A" />
              <KPICard label="Overdue Jobs" value={String(overdueProductionJobs.length)} delta="Active jobs past their required-by date" showTrend={false} icon={AlertTriangle} accent="#D97706" />
              <KPICard label="Completed Jobs" value={String(completedProductionJobs.length)} delta="Completed this month" showTrend={false} icon={CheckCircle2} accent="#16A34A" />
            </>
          )}
          {role === "logistics" && (
            <>
              <KPICard label="Active Deliveries" value={String(logisticsActiveDeliveries.length)} delta="Ready or dispatched" showTrend={false} icon={Truck} accent="#C8102E" />
              <KPICard label="In Transit" value={String(logisticsInTransit)} delta="Dispatched" showTrend={false} icon={Truck} accent="#1A2B4A" />
              <KPICard label="Delivered" value={String(logisticsDelivered)} delta="Delivery history" showTrend={false} icon={CheckCircle2} accent="#16A34A" />
              <KPICard label="Active Jobs" value={String(logisticsActiveJobs.length)} delta="Read-only monitoring" showTrend={false} icon={Factory} accent="#64748B" />
            </>
          )}
        </div>

        {realMode && (role === 'operations' || role === 'production') && <div className="mb-4 text-sm text-slate-600">{production.loading ? <p role="status">Loading Production records…</p> : production.error ? <p role="alert">{production.error}</p> : null}<button onClick={production.refresh} disabled={production.loading} className="rounded border bg-white px-3 py-2 text-xs font-semibold">{production.error ? 'Retry Production records' : 'Refresh Production records'}</button></div>}
        {role === "operations" && (
          <div className="mb-8">
            <OperationsBottlenecks
              openIssues={operationsIssues.open}
              resolvedIssues={operationsIssues.resolved}
              unavailable={realMode}
              onNavigate={onNavigate}
            />
          </div>
        )}

        {role === "production" && (
          <div className="mb-6">
            <Card
              title="Production Overview"
              action={
                <button
                  onClick={() => onNavigate?.("production")}
                  className="font-dm px-3 py-1.5 rounded-md hover:bg-slate-50"
                  style={{ fontSize: 12, fontWeight: 600, color: "#C8102E" }}
                >
                  View all →
                </button>
              }
            >
              <div className="flex flex-col">
                {overviewJobs.map((job) => {
                  const stageIndex = job.currentStage ?? (
                    job.stage === "quality_inspection" ? 8 : job.stage === "in_production" ? 1 : 0
                  );
                  const stage = PRODUCTION_STAGES[Math.min(stageIndex, PRODUCTION_STAGES.length - 1)];
                  const item = job.products[0]?.filterName ?? job.products[0]?.type ?? "—";
                  return (
                    <div key={job.id} className="grid grid-cols-1 md:grid-cols-[112px_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0 border-b last:border-0 border-slate-100">
                      <span className="font-mono-jb shrink-0" style={{ minWidth: 112, fontSize: 12, fontWeight: 700, color: "#1A2B4A" }}>
                        {job.joNumber ?? `JO-${job.code}`}
                      </span>
                      <span className="font-dm min-w-0 truncate" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }} title={job.clientName}>
                        {job.clientName}
                      </span>
                      <span className="font-dm min-w-0 truncate" style={{ fontSize: 12, color: "#475569" }} title={item}>
                        {item}
                      </span>
                      <StatusBadge variant={job.paused ? "delayed" : job.stage === "jo" ? "pending" : "in-progress"}>
                        {job.paused ? `On Hold · ${stage}` : stage}
                      </StatusBadge>
                    </div>
                  );
                })}
                {overviewJobs.length === 0 && (!realMode || (!production.loading && !production.error)) && (
                  <p className="font-dm py-5 text-center" style={{ fontSize: 13, color: "#64748B" }}>
                    No active job orders returned.
                  </p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Charts row — Owner / Sales only */}
        {(role === "owner" || role === "sales") && (
        <div className="grid grid-cols-12 gap-6 mb-8">
          <Card title="Weekly Orders" className="relative col-span-5">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={realMode ? [] : weekly} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748B", fontFamily: "Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B", fontFamily: "Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "#F1F5F9" }} contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontFamily: "Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif", fontSize: 12 }} />
                <Bar dataKey="orders" fill="#C8102E" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
            {realMode && <p className="absolute inset-x-0 top-1/2 text-center text-xs text-slate-500">Real orders API is not connected.</p>}
          </Card>

          <Card title={realMode ? 'Verified Revenue · Server Months' : 'Revenue Trend · 6 months'} className="relative col-span-4">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={realMode ? (summary.data?.monthlyVerifiedRevenue ?? []).filter(record => Number.isFinite(Number(record.amount))).map(record => ({ m: record.month, v: Number(record.amount), exactAmount: record.amount })) : revenueTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: "#64748B", fontFamily: "Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B", fontFamily: "Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontFamily: "Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif", fontSize: 12 }} formatter={(v: number, _name: string, entry: {payload?: {exactAmount?: string}}) => [realMode ? `₱${entry.payload?.exactAmount ?? v}` : `₱${v}K`, "Revenue"]} />
                <Line type="monotone" dataKey="v" stroke="#1A2B4A" strokeWidth={2.5} dot={{ r: 4, fill: "#C8102E", strokeWidth: 0 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
            {realMode && !summary.loading && !summary.error && summary.data?.monthlyVerifiedRevenue.length === 0 && <p className="absolute inset-x-0 top-1/2 text-center text-xs text-slate-500">No verified monthly payments returned.</p>}
          </Card>

          <Card title="Production Stages" className="relative col-span-3">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={realMode ? [] : stages} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={2}>
                  {(realMode ? [] : stages).map((s) => <Cell key={s.name} fill={s.color} />)}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, fontFamily: "Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }}
                />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontFamily: "Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            {realMode && <p className="absolute inset-x-0 top-1/2 text-center text-xs text-slate-500">Real production API is not connected.</p>}
          </Card>
        </div>
        )}

        {/* Pending Inquiries + Frequent Orders (Owner / Sales) */}
        {(role === "owner" || role === "sales") && (
          <div className="grid grid-cols-12 gap-6 mb-8">
            <Card title="Pending Client Inquiries" className="col-span-5"
              action={
                <button onClick={() => onNavigate?.("sales")} className="font-dm flex items-center gap-1 px-3 py-1 rounded-md hover:bg-slate-100" style={{ fontSize: 11, fontWeight: 700, color: "#C8102E" }}>
                  Review in Sales <ArrowRight size={11} />
                </button>
              }
            >
              <div className="flex items-center gap-3 mb-4 p-3 rounded-lg" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#C8102E" }}>
                  <Inbox size={18} color="white" />
                </div>
                <div>
                  <div className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#991B1B", lineHeight: 1 }}>{realMode ? summary.data?.pendingInquiries ?? '—' : pendingInquiries.length}</div>
                  <div className="font-dm" style={{ fontSize: 12, color: "#991B1B", fontWeight: 600 }}>unreviewed inquiries</div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {realMode && role === 'sales' && (pending.loading ? <p role="status">Loading pending inquiries…</p> : pending.error ? <p role="alert">{pending.error}<button onClick={pending.refresh} className="ml-2 rounded border px-2 py-1">Retry inquiries</button></p> : null)}
                {pendingInquiries.slice(0, 4).map(inq => (
                  <button
                    key={inq.id}
                    onClick={() => onNavigate?.("sales")}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-50 text-left border border-slate-200"
                  >
                    <span className="font-mono-jb" style={{ fontSize: 11, fontWeight: 700, color: "#1A2B4A" }}>{inq.code}</span>
                    {inq.urgent && <span className="font-dm px-1.5 py-0.5 rounded-full" style={{ fontSize: 9, fontWeight: 800, backgroundColor: "#FEE2E2", color: "#C8102E" }}>RUSH</span>}
                    <span className="font-dm flex-1 truncate" style={{ fontSize: 12, color: "#0F172A" }}>{inq.clientName} · {inq.products[0]?.type}</span>
                    <span className="font-dm" style={{ fontSize: 11, color: "#94A3B8" }}>{inq.submittedDate}</span>
                  </button>
                ))}
                {pendingInquiries.length === 0 && (!realMode || (!pending.loading && !pending.error)) && (
                  <div className="font-dm text-center py-4" style={{ fontSize: 12, color: "#94A3B8" }}>
                    {realMode ? role === 'owner' ? 'Only aggregate inquiry counts are available for Owner.' : 'No pending inquiries returned.' : "No unreviewed inquiries 🎉"}
                  </div>
                )}
              </div>
            </Card>

            <FinishedGoodsOrderActivity className="col-span-7" />
          </div>
        )}

        {/* Owner production plan — recurring orders mapped to upcoming weeks */}
        {role === "owner" && !realMode && (
          <div className="grid grid-cols-12 gap-6 mb-8">
            <Card title="Production Schedule · Next 4 Weeks" className="col-span-12"
              action={<span className="font-dm px-2 py-1 rounded-full" style={{ fontSize: 11, fontWeight: 600, backgroundColor: "#DCFCE7", color: "#166534" }}>Plan ahead based on recurring orders</span>}
            >
              <div className="grid grid-cols-4 gap-3">
                {demoProductionSchedule.map((w, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 p-3 flex flex-col gap-2" style={{ backgroundColor: i === 0 ? "#FEF2F2" : "#F8FAFC" }}>
                    <div className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? "#C8102E" : "#475569", letterSpacing: 0.4, textTransform: "uppercase" }}>
                      {w.week}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {w.items.map(it => (
                        <div key={it.jo} className="rounded-md px-2 py-1.5 bg-white border border-slate-200 flex items-center gap-2">
                          <span className="font-mono-jb" style={{ fontSize: 10, color: "#1A2B4A", fontWeight: 700 }}>{it.jo}</span>
                          {it.urgent && <span className="font-dm px-1.5 py-0.5 rounded-full" style={{ fontSize: 8, fontWeight: 800, backgroundColor: "#FEE2E2", color: "#C8102E" }}>RUSH</span>}
                          <span className="font-dm flex-1 truncate" style={{ fontSize: 11, color: "#0F172A" }}>{it.client}</span>
                          <span className="font-syne" style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>{it.qty}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ─── Role-specific drill-in cards ─── */}

        {/* Sales: Top Clients */}
        {role === "sales" && (
          <div className="grid grid-cols-12 gap-6 mb-8">
            <Card title="Top Clients by Volume" className="col-span-12"
              action={<span className="font-dm px-2 py-1 rounded-full" style={{ fontSize: 11, fontWeight: 600, backgroundColor: "#FEE2E2", color: "#991B1B" }}>Last 12 months</span>}
            >
              <table className="w-full">
                <thead style={{ backgroundColor: "#F4F6F9" }}>
                  <tr>
                    {["Rank", "Client", "Total Orders", "Revenue", "Last Order", "Status"].map((h) => (
                      <th key={h} className="font-dm text-left px-4 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(realMode ? [] : demoTopClients).map((r) => (
                    <tr key={r.rank} className="border-t border-slate-200/70 hover:bg-slate-50">
                      <td className="px-4 py-3 font-syne" style={{ fontSize: 14, fontWeight: 800, color: r.rank === 1 ? "#C9A84C" : "#0F172A" }}>#{r.rank}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{r.client}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{r.orders}</td>
                      <td className="px-4 py-3 font-syne" style={{ fontSize: 13, fontWeight: 700, color: "#16A34A" }}>₱{r.revenue.toLocaleString("en-PH")}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{r.last}</td>
                      <td className="px-4 py-3"><span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 11, fontWeight: 600, backgroundColor: r.status === "Active" ? "#DCFCE7" : r.status === "New Inquiry" ? "#FEF3C7" : "#E2E8F0", color: r.status === "Active" ? "#15803D" : r.status === "New Inquiry" ? "#92400E" : "#64748B" }}>{r.status}</span></td>
                    </tr>
                  ))}
                  {realMode && <tr><td colSpan={6} className="border-t border-slate-200/70 px-4 py-8 text-center text-sm text-slate-500">Client analytics API is not connected. No live ranking is available.</td></tr>}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {/* Accounting: Upcoming Due Dates + Partial Payments */}
        {role === "accounting" && (
          <div className="grid grid-cols-12 gap-6 mb-8">
            <Card title="Upcoming Due Dates · Next 7 Days" className="col-span-7"
              action={<span className="font-dm px-2 py-1 rounded-full" style={{ fontSize: 11, fontWeight: 600, backgroundColor: "#FEF3C7", color: "#92400E" }}>Auto-flag overdue</span>}
            >
              <div className="flex flex-col gap-2">
                {(realMode ? [] : demoDueDates).map((r) => (
                  <div key={r.inv} className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-slate-200">
                    <div className="flex-1">
                      <div className="font-mono-jb" style={{ fontSize: 12, fontWeight: 700, color: "#1A2B4A" }}>{r.inv}</div>
                      <div className="font-dm" style={{ fontSize: 12, color: "#475569" }}>{r.client} · ₱{r.amount.toLocaleString("en-PH")}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>{r.due}</div>
                      <span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: r.days <= 3 ? "#FEE2E2" : "#FEF3C7", color: r.days <= 3 ? "#C8102E" : "#B45309" }}>{r.status}</span>
                    </div>
                  </div>
                ))}
                {realMode && <p className="py-4 text-center text-sm text-slate-500">Invoice read API is not connected. No live due-date data is available.</p>}
              </div>
            </Card>
            <Card title="Partial Payments In Progress" className="col-span-5">
              <div className="flex flex-col gap-3">
                {(realMode ? [] : demoPartialPayments).map((p) => {
                  const pct = (p.paid / p.total) * 100;
                  return (
                    <div key={p.inv} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono-jb" style={{ fontSize: 12, fontWeight: 700, color: "#1A2B4A" }}>{p.inv}</span>
                        <span className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>{p.client}</span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-syne" style={{ fontSize: 14, fontWeight: 700, color: "#16A34A" }}>₱{p.paid.toLocaleString("en-PH")}</span>
                        <span className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>of ₱{p.total.toLocaleString("en-PH")}</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#E2E8F0" }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: "#16A34A" }} />
                      </div>
                      <div className="font-dm mt-2" style={{ fontSize: 11, color: "#C8102E", fontWeight: 600 }}>Balance: ₱{p.remaining.toLocaleString("en-PH")}</div>
                    </div>
                  );
                })}
                {realMode && <p className="py-4 text-center text-sm text-slate-500">Payment read API is not connected. No live payment data is available.</p>}
              </div>
            </Card>
          </div>
        )}

        {/* Logistics: Active Deliveries + Method Breakdown */}
        {role === "logistics" && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mb-8">
            <Card title="Active Deliveries" className="xl:col-span-7">
              {realMode && <div className="mb-3 font-dm text-xs text-slate-500">{shipments.loading ? <p role="status">Loading shipment handoffs…</p> : shipments.error ? <p role="alert">{shipments.error}</p> : <p>Returned shipment records; item/quantity data are not supplied.</p>}<button onClick={shipments.refresh} disabled={shipments.loading} className="mt-2 rounded border px-2 py-1">{shipments.error ? 'Retry shipments' : 'Refresh shipments'}</button></div>}
              <table className="w-full">
                <thead style={{ backgroundColor: "#F4F6F9" }}>
                  <tr>
                    {["JO", "Client", "Item", "Qty", "Method", "Status"].map((h) => (
                      <th key={h} className="font-dm text-left px-3 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deliveryOverviewRows.map(row => (
                    <tr key={row.id} className="border-t border-slate-200/70">
                      <td className="px-3 py-2 font-mono-jb" style={{ fontSize: 12, color: "#1A2B4A", fontWeight: 600 }}>{row.jo}</td>
                      <td className="px-3 py-2 font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{row.client}</td>
                      <td className="px-3 py-2 font-dm" style={{ fontSize: 12, color: "#475569" }}>{row.item}</td>
                      <td className="px-3 py-2 font-dm" style={{ fontSize: 12, color: "#475569" }}>{row.quantity}</td>
                      <td className="px-3 py-2 font-dm" style={{ fontSize: 12, color: "#475569" }}>{row.method}</td>
                      <td className="px-3 py-2"><span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 600, backgroundColor: "#E2E8F0", color: "#475569" }}>{row.label}</span></td>
                    </tr>
                  ))}
                  {deliveryOverviewRows.length === 0 && (!realMode || (!shipments.loading && !shipments.error)) && (
                    <tr><td colSpan={6} className="px-3 py-6 text-center font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>{realMode ? 'Open Logistics for authenticated shipment handoff records.' : 'No active deliveries.'}</td></tr>
                  )}
                </tbody>
              </table>
            </Card>
            <Card title="Delivery Method Breakdown" className="xl:col-span-5">
              <div className="flex flex-col gap-2">
                {Object.entries(logisticsDeliveryMethods).map(([method, count]) => (
                  <div key={method} className="flex items-center gap-3 px-3 py-2 rounded-md border border-slate-200">
                    <div className="w-2 h-8 rounded-sm" style={{ backgroundColor: "#1A2B4A" }} />
                    <div className="flex-1">
                      <div className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{method}</div>
                    </div>
                    <div className="font-dm" style={{ fontSize: 16, fontWeight: 600, color: "#1A2B4A" }}>{count}</div>
                  </div>
                ))}
                {Object.keys(logisticsDeliveryMethods).length === 0 && (
                  <p className="font-dm py-4 text-center" style={{ fontSize: 12, color: "#94A3B8" }}>{realMode ? 'Delivery-method aggregates are unavailable from the supported APIs.' : 'No delivery method data yet.'}</p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Finished Goods Buffer & Demand Forecast — Owner */}
        {role === "owner" && !realMode && (
        <div className="grid grid-cols-12 gap-6 mb-8">
          <Card title="Finished Goods Buffer — Demand Forecast" className="col-span-12"
            action={<span className="font-dm px-2 py-1 rounded-full" style={{ fontSize: 11, fontWeight: 600, backgroundColor: "#DBEAFE", color: "#1D4ED8" }}>Based on last 6 months order history</span>}
          >
            <div className="grid grid-cols-4 gap-4">
              {demoDemandForecast.map((item) => (
                <div key={item.product} className="rounded-lg p-4 flex flex-col gap-2" style={{ border: item.urgent ? "1.5px solid #FECACA" : "1px solid #E2E8F0", backgroundColor: item.urgent ? "#FEF2F2" : "#F8FAFC" }}>
                  <div className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: item.urgent ? "#991B1B" : "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>
                    {item.urgent ? "⚠️ HIGH DEMAND" : "MONITOR"}
                  </div>
                  <div className="font-syne" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>{item.product}</div>
                  <div className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>Top client: {item.topClient}</div>
                  <div className="flex items-end justify-between mt-1">
                    <div>
                      <div className="font-dm" style={{ fontSize: 10, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Avg. Monthly</div>
                      <div className="font-syne" style={{ fontSize: 20, fontWeight: 800, color: "#0F172A" }}>{item.avgMonthly} pcs</div>
                    </div>
                    <div className="text-right">
                      <div className="font-dm" style={{ fontSize: 10, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Buffer Min</div>
                      <div className="font-syne" style={{ fontSize: 20, fontWeight: 800, color: "#D97706" }}>{item.bufferMin} pcs</div>
                    </div>
                  </div>
                  <div className="font-dm px-2 py-1 rounded-full text-center mt-1" style={{ fontSize: 11, fontWeight: 600, backgroundColor: item.inStock === 0 ? "#E2E8F0" : "#DCFCE7", color: item.inStock === 0 ? "#64748B" : "#16A34A" }}>
                    {item.inStock === 0 ? "No buffer stock (made-to-order)" : `${item.inStock} pcs in stock`}
                  </div>
                  <div className="font-dm text-center" style={{ fontSize: 11, color: item.trend.includes("↑") ? "#C8102E" : "#64748B", fontWeight: 600 }}>{item.trend}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg p-3 flex items-start gap-2" style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
              <span style={{ fontSize: 14 }}>💡</span>
              <p className="font-dm" style={{ fontSize: 12, color: "#1E3A8A" }}>
                <strong>Made-to-order recommendation:</strong> Enter-Fil produces to order — no finished goods buffer maintained. Consider stocking 1–2 weeks of raw materials (filter media, adhesive, boxes) for top products to reduce lead time from 14 days to 5–7 days for repeat clients.
              </p>
            </div>
          </Card>
        </div>
        )}

        {/* Active Jobs remain informational for Logistics. */}
        {role !== "operations" && role !== "sales" && role !== "accounting" && role !== "production" && (
        <div className="grid grid-cols-12 gap-6">
          <Card
            title="Active Jobs"
            className={role === "logistics" ? "col-span-12" : "col-span-8"}
            action={
              <button onClick={() => onNavigate?.(role === "logistics" ? "logistics-active-jobs" : "production")} className="font-dm px-3 py-1.5 rounded-md hover:bg-slate-50" style={{ fontSize: 12, fontWeight: 600, color: "#C8102E" }}>
                View all →
              </button>
            }
          >
            <div className="overflow-hidden rounded-lg border border-slate-200/70">
              <table className="w-full">
                <thead style={{ backgroundColor: "#F4F6F9" }}>
                  <tr>
                    {["JO Code", "Client", "Item", "Stage", "Due"].map((h) => (
                      <th key={h} className="font-dm text-left px-4 py-3" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(role === "logistics" ? logisticsActiveJobs.map((inquiry) => ({
                    jo: inquiry.joNumber ?? `JO-${inquiry.code}`,
                    client: inquiry.clientName,
                    item: inquiry.products[0]?.filterName ?? inquiry.products[0]?.type ?? "—",
                    status: inquiry.stage === "jo" ? "pending" as const : "in-progress" as const,
                    stage: inquiry.currentStage === undefined
                      ? stageLabel[inquiry.stage]
                      : PRODUCTION_STAGES[Math.min(inquiry.currentStage, PRODUCTION_STAGES.length - 1)],
                    due: inquiry.dueDate ?? "—",
                  })) : realMode ? [] : activeJobs).map((j) => (
                    <tr key={j.jo} className="border-t border-slate-200/70 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 13, fontWeight: 500, color: "#1A2B4A" }}>{j.jo}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#0F172A", fontWeight: 600 }}>{j.client}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{j.item}</td>
                      <td className="px-4 py-3"><StatusBadge variant={j.status}>{j.stage}</StatusBadge></td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{j.due}</td>
                    </tr>
                  ))}
                  {realMode && <tr><td colSpan={5} className="px-4 py-6 text-center font-dm text-xs text-slate-500">{role === 'operations' || role === 'production' ? 'Open Production Floor for authenticated Job Order records.' : 'Job Order monitoring is unavailable from this role’s supported APIs.'}</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          {role !== "logistics" && role !== "production" && <div className="col-span-4 bg-white rounded-xl border border-slate-200/60 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ backgroundColor: "#C8102E" }}>
              <div className="flex items-center gap-2 text-white">
                <AlertTriangle size={16} />
                <h3 className="font-syne" style={{ fontSize: 16, fontWeight: 700 }}>Alerts</h3>
              </div>
              <span className="font-dm bg-white/20 text-white px-2 py-0.5 rounded-full" style={{ fontSize: 11, fontWeight: 600 }}>
                {realMode ? "—" : alerts.length} active
              </span>
            </div>
            <div className="p-4 flex flex-col gap-3">
              {(realMode ? [] : alerts).map((a, i) => {
                const c = alertColors[a.kind];
                return (
                  <div key={i} className="rounded-lg p-3" style={{ backgroundColor: c.bg, borderLeft: `3px solid ${c.bd}` }}>
                    <div className="font-dm" style={{ fontSize: 13, fontWeight: 600, color: c.fg }}>{a.title}</div>
                    <div className="font-dm mt-1" style={{ fontSize: 12, color: "#475569" }}>{a.body}</div>
                  </div>
                );
              })}
              {realMode && <p className="font-dm text-xs text-slate-500">Alert summaries are unavailable from the supported APIs.</p>}
            </div>
          </div>}
        </div>
        )}
      </div>
    </div>
  );
}
