import { useMemo } from "react";
import { ShoppingCart, Factory, AlertTriangle, DollarSign, Search, Sparkles, Inbox, ArrowRight, CheckCircle2, Truck, Boxes, Clock3, ArrowUpRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { KPICard } from "./KPICard";
import { StatusBadge } from "./StatusBadge";
import { NotificationBell } from "./NotificationBell";
import { PRODUCTION_STAGES, stageLabel, useOrders } from "../store/orders";
import { getRawMaterialStockStatus, useMaterials } from "../store/materials";
import { buildOrderHistory, getFinishedGoodOrderActivity } from "../store/recurringOrders";
import { FinishedGoodsOrderActivity } from "./FinishedGoodsOrderActivity";
import type { Role } from "./Login";

const weekly = [
  { day: "Mon", orders: 14 },
  { day: "Tue", orders: 22 },
  { day: "Wed", orders: 18 },
  { day: "Thu", orders: 28 },
  { day: "Fri", orders: 31 },
  { day: "Sat", orders: 19 },
  { day: "Sun", orders: 9 },
];

const revenueTrend = [
  { m: "Nov", v: 820 },
  { m: "Dec", v: 940 },
  { m: "Jan", v: 880 },
  { m: "Feb", v: 1050 },
  { m: "Mar", v: 1120 },
  { m: "Apr", v: 1200 },
];

const stages = [
  { name: "Molding", value: 5, color: "#C8102E" },
  { name: "Cutting", value: 4, color: "#1A2B4A" },
  { name: "Assembling", value: 6, color: "#C9A84C" },
  { name: "Heating / Gasket", value: 3, color: "#D97706" },
  { name: "Inspection", value: 2, color: "#2563EB" },
  { name: "Completed", value: 4, color: "#16A34A" },
];

const activeJobs = [
  { jo: "JO-2026-001", client: "B.E. Aerospace", item: "Air Filter 115×103×500mm", status: "in-progress" as const, stage: "Quality Inspection", due: "Apr 30" },
  { jo: "JO-2026-002", client: "Maynilad", item: "Filter KF-OF.175.20.87", status: "pending" as const, stage: "Assembling", due: "May 02" },
  { jo: "JO-2026-003", client: "G.U. Engineering", item: "Oil Separator KF-OS.200", status: "in-progress" as const, stage: "Molding", due: "May 05" },
  { jo: "JO-2026-004", client: "Emerald Vinyl", item: "Column Filter", status: "pending" as const, stage: "Holding — Awaiting Material", due: "May 10" },
];

const alerts = [
  { kind: "error", title: "Filter Media below threshold", body: "Only 5 rolls left · reorder triggered" },
  { kind: "warning", title: "JO-2026-001 deadline approaching", body: "3 days remaining · B.E. Aerospace" },
  { kind: "error", title: "Payment overdue: Maynilad", body: "Invoice INV-2026-0042 · 8 days past due" },
];

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

export function Dashboard({ variant = "operations", onNavigate }: { variant?: Role; onNavigate?: (id: string) => void }) {
  return variant === "warehouse"
    ? <WarehouseDashboard onNavigate={onNavigate} />
    : <RoleDashboard variant={variant} onNavigate={onNavigate} />;
}

function displayQuantity(quantity: number): string {
  return quantity.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function WarehouseDashboard({ onNavigate }: { onNavigate?: (id: string) => void }) {
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
  return (
    <div className="flex-1 h-full overflow-auto" style={{ backgroundColor: "#F4F6F9" }}>
      <header className="bg-white border-b border-slate-200/70 px-5 py-5 sm:px-8 sticky top-0 z-10">
        <h1 className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>Warehouse Dashboard</h1>
        <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>Inventory health · Finished goods · Dispatch preparation</p>
      </header>

      <main className="px-4 py-5 sm:px-8 sm:py-7 flex flex-col gap-6">
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Warehouse summary">
          {[
            { label: "Tracked Raw Material Items", value: String(rawMaterials.length), detail: "in inventory", icon: Boxes, color: "#1A2B4A" },
            { label: "Finished Goods", value: displayQuantity(totalFinishedGoods), detail: `${finishedGoods.length} recorded items · pcs`, icon: Factory, color: "#2563EB" },
            { label: "Low-Stock Items", value: String(lowStockItems.length), detail: "at or below threshold, including out of stock", icon: AlertTriangle, color: lowStockItems.length ? "#C2410C" : "#16A34A" },
            { label: "Ready for Dispatch", value: String(readyForDispatch.length), detail: "awaiting Warehouse preparation", icon: Truck, color: "#0F766E" },
          ].map((metric) => {
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
            {lowStockItems.length ? (
              <div className="max-h-[390px] overflow-auto flex flex-col divide-y divide-slate-100">
                {lowStockItems.map((item) => (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-dm font-semibold truncate" style={{ fontSize: 13, color: "#0F172A" }}>{item.name}</div>
                        <div className="font-dm mt-1" style={{ fontSize: 12, color: "#64748B" }}>On hand {displayQuantity(item.current)} {item.unit} · Minimum {displayQuantity(item.minimum)} {item.unit}</div>
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
                <CheckCircle2 size={24} className="mx-auto" style={{ color: "#16A34A" }} />
                <p className="font-dm mt-2" style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>No low-stock items.</p>
              </div>
            )}
          </Card>

          <Card
            title="Top Clients by Orders"
            className="xl:col-span-7"
            action={<button type="button" onClick={() => onNavigate?.("inventory-finished")} className="font-dm inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-50" style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}>View Inventory <ArrowRight size={13} /></button>}
          >
            {topClientsByOrders.length ? (
              <ol className="divide-y divide-slate-100">
                {topClientsByOrders.map((client, index) => (
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
            {readyForDispatch.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead><tr className="text-left border-b border-slate-100">
                    {["JO Number", "Client", "Product", "Qty", "Status"].map((heading) => <th key={heading} className="font-dm py-2 px-2 first:pl-0" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>{heading}</th>)}
                  </tr></thead>
                  <tbody>
                    {readyForDispatch.slice(0, 6).map((job) => (
                      <tr key={job.id} className="border-b last:border-0 border-slate-100">
                        <td className="font-mono-jb py-3 px-2 pl-0 whitespace-nowrap" style={{ fontSize: 11, fontWeight: 600, color: "#1A2B4A" }}>{job.joNumber ?? `JO-${job.code}`}</td>
                        <td className="font-dm py-3 px-2" style={{ fontSize: 12, color: "#0F172A" }}>{job.clientName}</td>
                        <td className="font-dm py-3 px-2" style={{ fontSize: 12, color: "#475569" }}>{job.products[0]?.filterName ?? job.products[0]?.type ?? "—"}</td>
                        <td className="font-dm py-3 px-2 whitespace-nowrap" style={{ fontSize: 12, color: "#475569" }}>{job.products.reduce((total, product) => total + product.qty, 0)}</td>
                        <td className="py-3 px-2"><span className="font-dm inline-flex items-center rounded-full px-2 py-1 whitespace-nowrap" style={{ backgroundColor: "#EFF6FF", color: "#1D4ED8", fontSize: 11, fontWeight: 600 }}>Ready for Dispatch</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {readyForDispatch.length > 6 && <p className="font-dm mt-3" style={{ fontSize: 11, color: "#64748B" }}>Showing 6 of {readyForDispatch.length} ready job orders.</p>}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Truck size={24} className="mx-auto" style={{ color: "#94A3B8" }} />
                <p className="font-dm mt-2" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>No job orders are awaiting dispatch preparation.</p>
              </div>
            )}
          </Card>

          <Card title="Recent Activity" className="xl:col-span-5">
            {activity.length ? (
              <div className="flex flex-col">
                {activity.map((entry) => (
                  <div key={entry.id} className="flex gap-3 py-3 first:pt-0 last:pb-0 border-b last:border-0 border-slate-100">
                    <div className="mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#EFF6FF", color: "#2563EB" }}><Clock3 size={13} /></div>
                    <div className="min-w-0">
                      <div className="font-dm font-semibold" style={{ fontSize: 12, color: "#0F172A" }}>{entry.title}</div>
                      <div className="font-dm mt-0.5 truncate" style={{ fontSize: 11, color: "#475569" }} title={entry.subject}>{entry.subject}</div>
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
  const { inquiries, completedJOs, archivedInquiries } = useOrders();
  const pendingInquiries = inquiries.filter(i => i.stage === "inquiry");
  const meta = dashboardTitle[role] ?? { title: "Dashboard", subtitle: "Real-time overview" };

  /* DERIVED KPIs — single source of truth across the entire system */
  const allActive = [...inquiries, ...completedJOs];
  const activeOrdersCount = allActive.length;
  const jobsInProgress = completedJOs.filter(i => i.stage === "in_production" || i.stage === "quality_inspection").length;
  const activeProductionJobs = completedJOs.filter(
    (job) => job.stage === "jo" || job.stage === "in_production" || job.stage === "quality_inspection"
  );
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
        {isAcc && (
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
        <div className={role === "production" ? "grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6" : "grid grid-cols-4 gap-6 mb-8"}>
          {(role === "owner" || role === "operations") && (
            <>
              <KPICard label="Active Orders"     value={String(activeOrdersCount)} delta="live count"  trend="up"   icon={ShoppingCart}    accent="#C8102E" />
              <KPICard label="Jobs In Progress"  value={String(jobsInProgress)}    delta="on the floor" trend="up"  icon={Factory}         accent="#1A2B4A" />
              <KPICard label="Low Stock Alerts"  value="3"                          delta="see Inventory" trend="down" icon={AlertTriangle} accent="#D97706" />
              <KPICard label="Revenue"           value={formatPeso(revenueTotal)}  delta={`${paidInquiries.length} paid orders`} trend="up" icon={DollarSign}  accent="#16A34A" />
            </>
          )}
          {role === "sales" && (
            <>
              <KPICard label="Pending Inquiries" value={String(pendingInquiries.length)} delta="awaiting review" trend="up" icon={Inbox}  accent="#C8102E" />
              <KPICard label="Quotations Sent"   value={String(quotationsSent)}    delta="awaiting PO"   trend="up"  icon={ShoppingCart}    accent="#1A2B4A" />
              <KPICard label="POs Received"      value={String(posReceived)}       delta="ready for JO"  trend="up"  icon={Factory}         accent="#C9A84C" />
              <KPICard label="Monthly Revenue"   value={formatPeso(revenueTotal)}  delta="paid orders"   trend="up"  icon={DollarSign}      accent="#16A34A" />
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
                {activeProductionJobs.map((job) => {
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
                {activeProductionJobs.length === 0 && (
                  <p className="font-dm py-5 text-center" style={{ fontSize: 13, color: "#64748B" }}>
                    No active job orders.
                  </p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Charts row — Owner / Operations / Sales only */}
        {(role === "owner" || role === "operations" || role === "sales") && (
        <div className="grid grid-cols-12 gap-6 mb-8">
          <Card title="Weekly Orders" className="col-span-5">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={weekly} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748B", fontFamily: "Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B", fontFamily: "Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "#F1F5F9" }} contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontFamily: "Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif", fontSize: 12 }} />
                <Bar dataKey="orders" fill="#C8102E" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Revenue Trend · 6 months" className="col-span-4">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={revenueTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: "#64748B", fontFamily: "Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B", fontFamily: "Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontFamily: "Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif", fontSize: 12 }} formatter={(v: number) => [`₱${v}K`, "Revenue"]} />
                <Line type="monotone" dataKey="v" stroke="#1A2B4A" strokeWidth={2.5} dot={{ r: 4, fill: "#C8102E", strokeWidth: 0 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Production Stages" className="col-span-3">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={stages} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={2}>
                  {stages.map((s) => <Cell key={s.name} fill={s.color} />)}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, fontFamily: "Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }}
                />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontFamily: "Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
        )}

        {/* Pending Inquiries + Frequent Orders (Owner / Operations / Sales) */}
        {(role === "owner" || role === "operations" || role === "sales") && (
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
                  <div className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#991B1B", lineHeight: 1 }}>{pendingInquiries.length}</div>
                  <div className="font-dm" style={{ fontSize: 12, color: "#991B1B", fontWeight: 600 }}>unreviewed inquiries</div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
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
                {pendingInquiries.length === 0 && (
                  <div className="font-dm text-center py-4" style={{ fontSize: 12, color: "#94A3B8" }}>
                    No unreviewed inquiries 🎉
                  </div>
                )}
              </div>
            </Card>

            <FinishedGoodsOrderActivity className="col-span-7" />
          </div>
        )}

        {/* Forward production plan (Owner / Operations) — recurring orders mapped to upcoming weeks */}
        {(role === "owner" || role === "operations") && (
          <div className="grid grid-cols-12 gap-6 mb-8">
            <Card title="Production Schedule · Next 4 Weeks" className="col-span-12"
              action={<span className="font-dm px-2 py-1 rounded-full" style={{ fontSize: 11, fontWeight: 600, backgroundColor: "#DCFCE7", color: "#166534" }}>Plan ahead based on recurring orders</span>}
            >
              <div className="grid grid-cols-4 gap-3">
                {[
                  { week: "Week 1 · Apr 27 – May 3", items: [{ jo: "JO-2026-001", client: "B.E. Aerospace", qty: 50, urgent: true }, { jo: "JO-2026-002", client: "Maynilad", qty: 100, urgent: false }] },
                  { week: "Week 2 · May 4 – 10",   items: [{ jo: "JO-2026-003", client: "G.U. Engineering", qty: 30, urgent: false }, { jo: "JO-2026-004", client: "Emerald Vinyl", qty: 20, urgent: false }] },
                  { week: "Week 3 · May 11 – 17",  items: [{ jo: "PLAN-1", client: "Maynilad (recurring)", qty: 200, urgent: false }] },
                  { week: "Week 4 · May 18 – 24",  items: [{ jo: "PLAN-2", client: "B.E. Aerospace (recurring)", qty: 30, urgent: false }] },
                ].map((w, i) => (
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
                  {[
                    { rank: 1, client: "Maynilad", orders: 22, revenue: 2108400, last: "Mar 31, 2026", status: "Active" },
                    { rank: 2, client: "B.E. Aerospace", orders: 14, revenue: 1248600, last: "Apr 10, 2026", status: "Active" },
                    { rank: 3, client: "G.U. Engineering", orders: 6, revenue: 368100, last: "Apr 12, 2026", status: "Active" },
                    { rank: 4, client: "Emerald Vinyl", orders: 2, revenue: 85200, last: "—", status: "Holding" },
                    { rank: 5, client: "Monaco", orders: 1, revenue: 4680, last: "Apr 22, 2026", status: "New Inquiry" },
                  ].map((r) => (
                    <tr key={r.rank} className="border-t border-slate-200/70 hover:bg-slate-50">
                      <td className="px-4 py-3 font-syne" style={{ fontSize: 14, fontWeight: 800, color: r.rank === 1 ? "#C9A84C" : "#0F172A" }}>#{r.rank}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{r.client}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{r.orders}</td>
                      <td className="px-4 py-3 font-syne" style={{ fontSize: 13, fontWeight: 700, color: "#16A34A" }}>₱{r.revenue.toLocaleString("en-PH")}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{r.last}</td>
                      <td className="px-4 py-3"><span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 11, fontWeight: 600, backgroundColor: r.status === "Active" ? "#DCFCE7" : r.status === "New Inquiry" ? "#FEF3C7" : "#E2E8F0", color: r.status === "Active" ? "#15803D" : r.status === "New Inquiry" ? "#92400E" : "#64748B" }}>{r.status}</span></td>
                    </tr>
                  ))}
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
                {[
                  { inv: "SI-2026-9533", client: "Maynilad", amount: 46800, due: "Apr 29, 2026", days: 1, status: "Due tomorrow" },
                  { inv: "SI-2026-0418", client: "B.E. Aerospace", amount: 46800, due: "May 10, 2026", days: 12, status: "Upcoming" },
                  { inv: "SI-2026-0421", client: "G.U. Engineering", amount: 67500, due: "Apr 30, 2026", days: 2, status: "Due in 2d" },
                ].map((r) => (
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
              </div>
            </Card>
            <Card title="Partial Payments In Progress" className="col-span-5">
              <div className="flex flex-col gap-3">
                {[
                  { inv: "SI-2026-9533", client: "Maynilad", total: 46800, paid: 23400, remaining: 23400 },
                ].map((p) => {
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
              </div>
            </Card>
          </div>
        )}

        {/* Logistics: Active Deliveries + Method Breakdown */}
        {role === "logistics" && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mb-8">
            <Card title="Active Deliveries" className="xl:col-span-7">
              <table className="w-full">
                <thead style={{ backgroundColor: "#F4F6F9" }}>
                  <tr>
                    {["JO", "Client", "Item", "Qty", "Method", "Status"].map((h) => (
                      <th key={h} className="font-dm text-left px-3 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logisticsActiveDeliveries.map((inquiry) => (
                    <tr key={inquiry.id} className="border-t border-slate-200/70">
                      <td className="px-3 py-2 font-mono-jb" style={{ fontSize: 12, color: "#1A2B4A", fontWeight: 600 }}>{inquiry.joNumber ?? `JO-${inquiry.code}`}</td>
                      <td className="px-3 py-2 font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{inquiry.clientName}</td>
                      <td className="px-3 py-2 font-dm" style={{ fontSize: 12, color: "#475569" }}>{inquiry.products[0]?.filterName ?? inquiry.products[0]?.type ?? "—"}</td>
                      <td className="px-3 py-2 font-dm" style={{ fontSize: 12, color: "#475569" }}>{inquiry.products.reduce((total, product) => total + product.qty, 0)}</td>
                      <td className="px-3 py-2 font-dm" style={{ fontSize: 12, color: "#475569" }}>{inquiry.deliveryMethod ?? "—"}</td>
                      <td className="px-3 py-2"><span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 600, backgroundColor: inquiry.stage === "dispatched" ? "#DBEAFE" : "#E2E8F0", color: inquiry.stage === "dispatched" ? "#1D4ED8" : "#475569" }}>{stageLabel[inquiry.stage]}</span></td>
                    </tr>
                  ))}
                  {logisticsActiveDeliveries.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-6 text-center font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>No active deliveries.</td></tr>
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
                  <p className="font-dm py-4 text-center" style={{ fontSize: 12, color: "#94A3B8" }}>No delivery method data yet.</p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Finished Goods Buffer & Demand Forecast — Owner / Operations */}
        {(role === "owner" || role === "operations") && (
        <div className="grid grid-cols-12 gap-6 mb-8">
          <Card title="Finished Goods Buffer — Demand Forecast" className="col-span-12"
            action={<span className="font-dm px-2 py-1 rounded-full" style={{ fontSize: 11, fontWeight: 600, backgroundColor: "#DBEAFE", color: "#1D4ED8" }}>Based on last 6 months order history</span>}
          >
            <div className="grid grid-cols-4 gap-4">
              {[
                { product: "Air Filter (Microglass)", topClient: "B.E. Aerospace", avgMonthly: 40, bufferMin: 20, inStock: 0, trend: "↑ +15%", urgent: true },
                { product: "Oil Separator Filter", topClient: "G.U. Engineering", avgMonthly: 25, bufferMin: 10, inStock: 0, trend: "→ Stable", urgent: false },
                { product: "Pleated Filter ZS20", topClient: "Maynilad", avgMonthly: 80, bufferMin: 50, inStock: 0, trend: "↑ +20%", urgent: true },
                { product: "Column Filter", topClient: "Emerald Vinyl", avgMonthly: 15, bufferMin: 5, inStock: 0, trend: "New Client", urgent: false },
              ].map((item) => (
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
        {role !== "sales" && role !== "accounting" && role !== "production" && (
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
                  })) : activeJobs).map((j) => (
                    <tr key={j.jo} className="border-t border-slate-200/70 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 13, fontWeight: 500, color: "#1A2B4A" }}>{j.jo}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#0F172A", fontWeight: 600 }}>{j.client}</td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{j.item}</td>
                      <td className="px-4 py-3"><StatusBadge variant={j.status}>{j.stage}</StatusBadge></td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{j.due}</td>
                    </tr>
                  ))}
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
                {alerts.length} active
              </span>
            </div>
            <div className="p-4 flex flex-col gap-3">
              {alerts.map((a, i) => {
                const c = alertColors[a.kind];
                return (
                  <div key={i} className="rounded-lg p-3" style={{ backgroundColor: c.bg, borderLeft: `3px solid ${c.bd}` }}>
                    <div className="font-dm" style={{ fontSize: 13, fontWeight: 600, color: c.fg }}>{a.title}</div>
                    <div className="font-dm mt-1" style={{ fontSize: 12, color: "#475569" }}>{a.body}</div>
                  </div>
                );
              })}
            </div>
          </div>}
        </div>
        )}
      </div>
    </div>
  );
}
