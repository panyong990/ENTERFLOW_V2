import { ShoppingCart, Factory, AlertTriangle, DollarSign, Search, Sparkles, Inbox, Repeat2, ArrowRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { KPICard } from "./KPICard";
import { StatusBadge } from "./StatusBadge";
import { NotificationBell } from "./NotificationBell";
import { useOrders } from "../store/orders";
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
  warehouse:  { title: "Warehouse Dashboard",   subtitle: "Stock alerts · Materials to reorder" },
  logistics:  { title: "Logistics Dashboard",   subtitle: "Today's deliveries · Dispatch queue" },
};

export function Dashboard({ variant = "operations", onNavigate }: { variant?: Role; onNavigate?: (id: string) => void }) {
  const role = variant;
  const isAcc = role === "accounting";
  const { inquiries, completedJOs, archivedInquiries } = useOrders();
  const pendingInquiries = inquiries.filter(i => i.stage === "inquiry");
  const meta = dashboardTitle[role] ?? { title: "Dashboard", subtitle: "Real-time overview" };

  /* DERIVED KPIs — single source of truth across the entire system */
  const allActive = [...inquiries, ...completedJOs];
  const activeOrdersCount = allActive.length;
  const jobsInProgress = completedJOs.filter(i => i.stage === "in_production" || i.stage === "quality_inspection").length;
  const rushOrdersCount = allActive.filter(i => i.urgent).length;
  const onHoldCount = completedJOs.filter(i => i.paused).length;
  const todayTargets = completedJOs.filter(i => (i.currentStage ?? 0) >= 8).length; /* QC + Completed */
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
  const todayDeliveries = completedJOs.filter(i => i.stage === "delivered").length;
  const dispatchQueue = completedJOs.filter(i => i.stage === "ready_for_dispatch").length;

  const formatPeso = (n: number) => n >= 1000000 ? `₱${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `₱${(n / 1000).toFixed(0)}K` : `₱${n.toFixed(0)}`;

  return (
    <div className="flex-1 h-full overflow-auto" style={{ backgroundColor: "#F4F6F9" }}>
      {/* Topbar */}
      <header className="bg-white border-b border-slate-200/70 px-8 py-5 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>
            {meta.title}
          </h1>
          <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>
            {meta.subtitle}
          </p>
        </div>
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
      </header>

      <div className="px-8 py-8" style={{ paddingLeft: 32, paddingRight: 32 }}>
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
        <div className="grid grid-cols-4 gap-6 mb-8">
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
              <KPICard label="Active JOs"      value={String(jobsInProgress)} delta="on the floor"  trend="up"   icon={Factory}         accent="#C8102E" />
              <KPICard label="Rush Orders"     value={String(rushOrdersCount)} delta="priority"     trend="up"   icon={AlertTriangle}   accent="#D97706" />
              <KPICard label="On Hold"         value={String(onHoldCount)}    delta="paused"        trend="down" icon={AlertTriangle}   accent="#92400E" />
              <KPICard label="Today's Targets" value={String(todayTargets)}   delta="QC + ready"    trend="up"   icon={ShoppingCart}    accent="#16A34A" />
            </>
          )}
          {role === "warehouse" && (
            <>
              <KPICard label="🔴 Critical Materials" value="2" delta="reorder now" trend="down" icon={AlertTriangle} accent="#C8102E" />
              <KPICard label="Finished Goods" value="115" delta="pcs in stock" trend="up" icon={Factory} accent="#1A2B4A" />
              <KPICard label="Buffer Below Min" value="3" delta="items" trend="down" icon={AlertTriangle} accent="#D97706" />
              <KPICard label="Last Updated" value="Today" delta="Apr 26" trend="up" icon={ShoppingCart} accent="#16A34A" />
            </>
          )}
          {role === "logistics" && (
            <>
              <KPICard label="Pending Delivery"  value={String(dispatchQueue)}   delta="ready to dispatch" trend="up" icon={ShoppingCart} accent="#C8102E" />
              <KPICard label="Delivered"         value={String(todayDeliveries)} delta="awaiting payment"  trend="up" icon={Factory}      accent="#16A34A" />
              <KPICard label="Rush in Queue"     value={String(rushOrdersCount)} delta="priority"           trend="up" icon={AlertTriangle} accent="#D97706" />
              <KPICard label="Total Active"      value={String(activeOrdersCount)} delta="across pipeline" trend="up" icon={ShoppingCart} accent="#1A2B4A" />
            </>
          )}
        </div>

        {/* Charts row — Owner / Operations / Sales only */}
        {(role === "owner" || role === "operations" || role === "sales") && (
        <div className="grid grid-cols-12 gap-6 mb-8">
          <Card title="Weekly Orders" className="col-span-5">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={weekly} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748B", fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B", fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "#F1F5F9" }} contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontFamily: "DM Sans", fontSize: 12 }} />
                <Bar dataKey="orders" fill="#C8102E" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Revenue Trend · 6 months" className="col-span-4">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={revenueTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: "#64748B", fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B", fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontFamily: "DM Sans", fontSize: 12 }} formatter={(v: number) => [`₱${v}K`, "Revenue"]} />
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
                  wrapperStyle={{ fontSize: 11, fontFamily: "DM Sans" }}
                />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontFamily: "DM Sans", fontSize: 12 }} />
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

            <Card title="Frequent / Recurring Orders" className="col-span-7"
              action={<span className="font-dm px-2 py-1 rounded-full" style={{ fontSize: 11, fontWeight: 600, backgroundColor: "#FEF3C7", color: "#92400E" }}>Plan production in advance</span>}
            >
              <div className="grid grid-cols-1 gap-2">
                {[
                  { item: "Air Filter KF-OS.107.65.252", client: "B.E. Aerospace", freq: "Monthly", lastOrdered: "Apr 10, 2026", avgQty: 30, recommendedBuffer: 30 },
                  { item: "Pleated Filter ZS20", client: "Maynilad", freq: "Bi-monthly", lastOrdered: "Mar 31, 2026", avgQty: 200, recommendedBuffer: 100 },
                  { item: "Oil Separator KF-OS.200/167", client: "G.U. Engineering", freq: "Quarterly", lastOrdered: "Apr 12, 2026", avgQty: 30, recommendedBuffer: 15 },
                  { item: "Column Filter KF-OF.180", client: "Emerald Vinyl", freq: "Quarterly", lastOrdered: "Feb 14, 2026", avgQty: 20, recommendedBuffer: 10 },
                  { item: "Air Oil Separator MNC-AOS-3.0", client: "Monaco", freq: "Annually", lastOrdered: "Apr 22, 2026", avgQty: 50, recommendedBuffer: 0 },
                ].map((r, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-slate-200">
                    <Repeat2 size={14} style={{ color: "#1A2B4A" }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-dm truncate" style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{r.item}</div>
                      <div className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>{r.client} · {r.freq} · last: {r.lastOrdered}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Avg / order</div>
                      <div className="font-syne" style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{r.avgQty} pcs</div>
                    </div>
                    <div className="text-right">
                      <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Buffer</div>
                      <div className="font-syne" style={{ fontSize: 14, fontWeight: 800, color: r.recommendedBuffer > 0 ? "#16A34A" : "#94A3B8" }}>{r.recommendedBuffer > 0 ? `${r.recommendedBuffer} pcs` : "—"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
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

        {/* Logistics: Today's Deliveries + Method Breakdown */}
        {role === "logistics" && (
          <div className="grid grid-cols-12 gap-6 mb-8">
            <Card title="Today's Delivery Queue" className="col-span-7">
              <table className="w-full">
                <thead style={{ backgroundColor: "#F4F6F9" }}>
                  <tr>
                    {["JO", "Client", "Item", "Qty", "Method", "Status"].map((h) => (
                      <th key={h} className="font-dm text-left px-3 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { jo: "JO-2026-001", client: "B.E. Aerospace", item: "Air Filter", qty: 50, method: "Company Vehicle", status: "Loading" },
                    { jo: "JO-2026-002", client: "Maynilad", item: "Pleated Filter ZS20", qty: 100, method: "Lalamove", status: "In Transit" },
                  ].map((r) => (
                    <tr key={r.jo} className="border-t border-slate-200/70">
                      <td className="px-3 py-2 font-mono-jb" style={{ fontSize: 12, color: "#1A2B4A", fontWeight: 600 }}>{r.jo}</td>
                      <td className="px-3 py-2 font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{r.client}</td>
                      <td className="px-3 py-2 font-dm" style={{ fontSize: 12, color: "#475569" }}>{r.item}</td>
                      <td className="px-3 py-2 font-dm" style={{ fontSize: 12, color: "#475569" }}>{r.qty}</td>
                      <td className="px-3 py-2 font-dm" style={{ fontSize: 12, color: "#475569" }}>{r.method}</td>
                      <td className="px-3 py-2"><span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: r.status === "In Transit" ? "#DBEAFE" : "#FEF3C7", color: r.status === "In Transit" ? "#1D4ED8" : "#B45309" }}>{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card title="Method Breakdown · This Month" className="col-span-5">
              <div className="flex flex-col gap-2">
                {[
                  { method: "Lalamove", count: 8, color: "#7C3AED", help: "Local · urgent" },
                  { method: "Company Vehicle", count: 5, color: "#1A2B4A", help: "Batangas / Laguna" },
                  { method: "AP Cargo", count: 3, color: "#D97706", help: "Northern provinces" },
                  { method: "Fast Cargo", count: 2, color: "#16A34A", help: "Mindanao" },
                  { method: "Client Pick-up", count: 1, color: "#475569", help: "Customer collects" },
                ].map((m) => (
                  <div key={m.method} className="flex items-center gap-3 px-3 py-2 rounded-md border border-slate-200">
                    <div className="w-2 h-8 rounded-sm" style={{ backgroundColor: m.color }} />
                    <div className="flex-1">
                      <div className="font-dm" style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{m.method}</div>
                      <div className="font-dm" style={{ fontSize: 11, color: "#94A3B8" }}>{m.help}</div>
                    </div>
                    <div className="font-syne" style={{ fontSize: 18, fontWeight: 800, color: m.color }}>{m.count}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Warehouse: Simplified large-text low stock */}
        {role === "warehouse" && (
          <div className="grid grid-cols-12 gap-6 mb-8">
            <Card title="Materials to Reorder" className="col-span-12">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { name: "🔧 Adhesive", qty: 2, threshold: 3, unit: "sets", critical: true, lead: "Next-day local" },
                  { name: "📦 Box / Packaging", qty: 45, threshold: 50, unit: "pcs", critical: false, lead: "Same-day" },
                  { name: "🧻 Filter Media (Local)", qty: 12, threshold: 5, unit: "rolls", critical: false, lead: "Next-day" },
                ].map((m) => (
                  <div key={m.name} className="rounded-xl p-5" style={{ backgroundColor: m.critical ? "#FEE2E2" : "#FEF3C7", border: `2px solid ${m.critical ? "#C8102E" : "#D97706"}` }}>
                    <div className="font-syne mb-2" style={{ fontSize: 18, fontWeight: 800, color: m.critical ? "#991B1B" : "#92400E" }}>{m.name}</div>
                    <div className="font-syne" style={{ fontSize: 56, fontWeight: 800, color: m.critical ? "#C8102E" : "#D97706", lineHeight: 1 }}>
                      {m.qty}
                      <span className="font-dm ml-2" style={{ fontSize: 16, fontWeight: 600 }}>{m.unit}</span>
                    </div>
                    <div className="font-dm mt-2" style={{ fontSize: 14, color: m.critical ? "#991B1B" : "#92400E" }}>
                      Threshold: {m.threshold} {m.unit}
                    </div>
                    <div className="font-dm mt-1" style={{ fontSize: 13, color: m.critical ? "#991B1B" : "#92400E" }}>
                      Lead time: {m.lead}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Finished Goods Buffer & Demand Forecast — Owner / Operations / Production / Warehouse */}
        {(role === "owner" || role === "operations" || role === "production" || role === "warehouse") && (
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

        {/* Bottom row: jobs + alerts — hidden for sales/accounting */}
        {role !== "sales" && role !== "accounting" && (
        <div className="grid grid-cols-12 gap-6">
          <Card
            title="Active Jobs"
            className="col-span-8"
            action={
              <button className="font-dm px-3 py-1.5 rounded-md hover:bg-slate-50" style={{ fontSize: 12, fontWeight: 600, color: "#C8102E" }}>
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
                  {activeJobs.map((j) => (
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

          <div className="col-span-4 bg-white rounded-xl border border-slate-200/60 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
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
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
