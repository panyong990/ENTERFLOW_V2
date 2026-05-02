import { useState } from "react";
import { ArrowLeft, Download, Printer, TrendingUp, ShoppingCart, Factory, AlertTriangle, DollarSign, Inbox, Repeat2, Truck, Calculator } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import { Toaster, toast } from "sonner";

type ViewKey = "revenue" | "sales" | "production" | "inventory" | "logistics" | "payments" | "demand" | "all";

interface Props {
  onBack: () => void;
  initialView?: ViewKey;
}

const monthlyRevenue = [
  { m: "Nov 2025", revenue: 820000, orders: 18, avgOrder: 45556 },
  { m: "Dec 2025", revenue: 940000, orders: 22, avgOrder: 42727 },
  { m: "Jan 2026", revenue: 880000, orders: 19, avgOrder: 46316 },
  { m: "Feb 2026", revenue: 1050000, orders: 24, avgOrder: 43750 },
  { m: "Mar 2026", revenue: 1120000, orders: 26, avgOrder: 43077 },
  { m: "Apr 2026", revenue: 1248600, orders: 30, avgOrder: 41620 },
];

const yearlyRevenue = [
  { y: "2022", revenue: 6400000 },
  { y: "2023", revenue: 8200000 },
  { y: "2024", revenue: 9800000 },
  { y: "2025", revenue: 11200000 },
  { y: "2026 (YTD)", revenue: 5300000 },
];

const weeklySales = [
  { day: "Mon", orders: 14, revenue: 145000 },
  { day: "Tue", orders: 22, revenue: 210000 },
  { day: "Wed", orders: 18, revenue: 178000 },
  { day: "Thu", orders: 28, revenue: 268000 },
  { day: "Fri", orders: 31, revenue: 295000 },
  { day: "Sat", orders: 19, revenue: 165000 },
  { day: "Sun", orders: 9, revenue: 78000 },
];

const productionStages = [
  { name: "Molding", value: 5, color: "#C8102E" },
  { name: "Cutting", value: 4, color: "#1A2B4A" },
  { name: "Spotting", value: 3, color: "#9F1239" },
  { name: "Assembling", value: 6, color: "#C9A84C" },
  { name: "Inserting Media", value: 4, color: "#D97706" },
  { name: "Trimming", value: 3, color: "#92400E" },
  { name: "Cap Sealing", value: 2, color: "#16A34A" },
  { name: "Gasket Fitting", value: 2, color: "#6D28D9" },
  { name: "QC", value: 3, color: "#2563EB" },
  { name: "Completed", value: 8, color: "#15803D" },
];

const topClients = [
  { client: "Maynilad", orders: 22, revenue: 2108400, lastOrder: "Mar 31, 2026" },
  { client: "B.E. Aerospace", orders: 14, revenue: 1248600, lastOrder: "Apr 10, 2026" },
  { client: "G.U. Engineering", orders: 6, revenue: 368100, lastOrder: "Apr 12, 2026" },
  { client: "Emerald Vinyl", orders: 2, revenue: 85200, lastOrder: "Mar 18, 2026" },
  { client: "Monaco", orders: 1, revenue: 4680, lastOrder: "Apr 22, 2026" },
];

const demandForecast = [
  { product: "Air Filter (Microglass)", topClient: "B.E. Aerospace", avgMonthly: 40, recommendedBuffer: 30, trend: "+15%", urgency: "HIGH" },
  { product: "Pleated Filter ZS20", topClient: "Maynilad", avgMonthly: 80, recommendedBuffer: 100, trend: "+20%", urgency: "HIGH" },
  { product: "Oil Separator", topClient: "G.U. Engineering", avgMonthly: 25, recommendedBuffer: 15, trend: "Stable", urgency: "MONITOR" },
  { product: "Column Filter", topClient: "Emerald Vinyl", avgMonthly: 15, recommendedBuffer: 10, trend: "Stable", urgency: "MONITOR" },
];

const deliveryMix = [
  { method: "Lalamove", count: 18, color: "#7C3AED" },
  { method: "Company Vehicle", count: 12, color: "#1A2B4A" },
  { method: "AP Cargo", count: 6, color: "#D97706" },
  { method: "Fast Cargo", count: 4, color: "#C9A84C" },
  { method: "Pick-up", count: 3, color: "#16A34A" },
];

const paymentMix = [
  { method: "Bank Transfer · BDO", value: 480000, color: "#1A2B4A" },
  { method: "Bank Transfer · MetroBank", value: 280000, color: "#C9A84C" },
  { method: "Cash", value: 130000, color: "#16A34A" },
  { method: "Check", value: 95000, color: "#475569" },
  { method: "GCash", value: 45000, color: "#2563EB" },
];

const inventoryStock = [
  { item: "Adhesive (sets)", stock: 2, threshold: 3, status: "critical" },
  { item: "Boxes (pcs)", stock: 45, threshold: 50, status: "low" },
  { item: "Filter Media · Local (rolls)", stock: 12, threshold: 5, status: "ok" },
  { item: "Filter Media · Imported (rolls)", stock: 8, threshold: 0, status: "ok" },
];

export function AnalyticsFullView({ onBack, initialView = "all" }: Props) {
  const [view, setView] = useState<ViewKey>(initialView);
  const [reportMonth, setReportMonth] = useState("2026-04");

  const generateReport = () => {
    toast.success("Report generated", {
      description: `Full ${view} report for ${reportMonth} · CSV + PDF download started`,
    });
  };

  const tabs: { id: ViewKey; label: string; icon: any }[] = [
    { id: "all",        label: "All Analytics",   icon: TrendingUp },
    { id: "revenue",    label: "Revenue",         icon: DollarSign },
    { id: "sales",      label: "Sales",           icon: ShoppingCart },
    { id: "production", label: "Production",      icon: Factory },
    { id: "inventory",  label: "Inventory",       icon: AlertTriangle },
    { id: "logistics",  label: "Logistics",       icon: Truck },
    { id: "payments",   label: "Payments",        icon: Calculator },
    { id: "demand",     label: "Demand Forecast", icon: Repeat2 },
  ];

  return (
    <div className="flex-1 h-full overflow-auto" style={{ backgroundColor: "#F4F6F9" }}>
      <Toaster position="bottom-right" richColors />

      <header className="bg-white border-b border-slate-200/70 px-8 py-5 sticky top-0 z-10 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="font-dm flex items-center gap-1 hover:underline" style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
          <div className="border-l border-slate-200 pl-3">
            <h1 className="font-syne" style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>
              Analytics — Full View
            </h1>
            <p className="font-dm mt-0.5" style={{ fontSize: 12, color: "#64748B" }}>
              Owner-level deep-dive into every department's metrics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="month"
            value={reportMonth}
            onChange={(e) => setReportMonth(e.target.value)}
            className="font-dm px-3 py-2 rounded-md border border-slate-200 bg-white outline-none"
            style={{ fontSize: 13 }}
          />
          <button
            onClick={generateReport}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-white font-dm hover:opacity-90"
            style={{ backgroundColor: "#16A34A", fontSize: 12, fontWeight: 700 }}
          >
            <Download size={13} /> Generate Report
          </button>
          <button
            onClick={() => { window.print(); toast("Print dialog opened"); }}
            className="flex items-center gap-2 px-4 py-2 rounded-md font-dm border border-slate-200 hover:bg-slate-50"
            style={{ fontSize: 12, fontWeight: 700, color: "#1A2B4A" }}
          >
            <Printer size={13} /> Print
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white border-b border-slate-200/70 px-8 flex gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = view === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className="flex items-center gap-2 px-4 py-3 font-dm transition-colors whitespace-nowrap"
              style={{
                fontSize: 13, fontWeight: 600,
                color: active ? "#C8102E" : "#64748B",
                borderBottom: active ? "3px solid #C8102E" : "3px solid transparent",
                marginBottom: -1,
              }}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </nav>

      <div className="p-8 flex flex-col gap-6">
        {/* SUMMARY KPIs (always visible) */}
        {view === "all" && (
          <>
            <section>
              <h2 className="font-syne mb-3" style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Company-wide KPIs</h2>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "Total Revenue (YTD)", value: "₱5.3M", delta: "+18% vs LY", color: "#16A34A" },
                  { label: "Active Orders", value: "12", delta: "+3 this week", color: "#C8102E" },
                  { label: "Jobs in Progress", value: "8", delta: "2 rush", color: "#1A2B4A" },
                  { label: "Receivables", value: "₱285K", delta: "1 overdue", color: "#D97706" },
                  { label: "Total Clients", value: "5", delta: "1 new this month", color: "#2563EB" },
                  { label: "Top Client", value: "Maynilad", delta: "₱2.1M revenue", color: "#7C3AED" },
                  { label: "Production Capacity", value: "78%", delta: "+12 buffer", color: "#16A34A" },
                  { label: "Avg Order Value", value: "₱41.6K", delta: "+₱2.3K vs LM", color: "#1D4ED8" },
                ].map((k) => (
                  <div key={k.label} className="bg-white rounded-xl border border-slate-200/70 p-4" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
                    <div className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{k.label}</div>
                    <div className="font-syne mt-1" style={{ fontSize: 22, fontWeight: 800, color: k.color, lineHeight: 1.1 }}>{k.value}</div>
                    <div className="font-dm mt-0.5" style={{ fontSize: 11, color: "#94A3B8" }}>{k.delta}</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {(view === "all" || view === "revenue") && (
          <Card title="Revenue — Monthly · 6 months">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyRevenue} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C8102E" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#C8102E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: "#64748B", fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B", fontFamily: "DM Sans" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => `₱${v.toLocaleString("en-PH")}`} contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontFamily: "DM Sans", fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="#C8102E" fill="url(#revArea)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="rounded-md p-3" style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#15803D", letterSpacing: 0.4, textTransform: "uppercase" }}>This month</div>
                <div className="font-syne" style={{ fontSize: 20, fontWeight: 800, color: "#15803D" }}>₱1.25M</div>
              </div>
              <div className="rounded-md p-3" style={{ backgroundColor: "#FEF3C7", border: "1px solid #FDE68A" }}>
                <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#92400E", letterSpacing: 0.4, textTransform: "uppercase" }}>vs last month</div>
                <div className="font-syne" style={{ fontSize: 20, fontWeight: 800, color: "#92400E" }}>+11.5%</div>
              </div>
              <div className="rounded-md p-3" style={{ backgroundColor: "#DBEAFE", border: "1px solid #BFDBFE" }}>
                <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#1E40AF", letterSpacing: 0.4, textTransform: "uppercase" }}>YTD total</div>
                <div className="font-syne" style={{ fontSize: 20, fontWeight: 800, color: "#1E40AF" }}>₱5.3M</div>
              </div>
            </div>
          </Card>
        )}

        {(view === "all" || view === "revenue") && (
          <Card title="Revenue — Yearly · 5 years">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={yearlyRevenue} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="y" tick={{ fontSize: 12, fill: "#64748B", fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B", fontFamily: "DM Sans" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${(v / 1000000).toFixed(0)}M`} />
                <Tooltip formatter={(v: number) => `₱${v.toLocaleString("en-PH")}`} contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontFamily: "DM Sans", fontSize: 12 }} />
                <Bar dataKey="revenue" fill="#1A2B4A" radius={[6, 6, 0, 0]} barSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {(view === "all" || view === "sales") && (
          <div className="grid grid-cols-12 gap-6">
            <Card title="Weekly Sales — Last 7 days" className="col-span-7">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={weeklySales} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#64748B", fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#64748B", fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#64748B", fontFamily: "DM Sans" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}K`} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontFamily: "DM Sans", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: "DM Sans" }} />
                  <Bar yAxisId="left" dataKey="orders" fill="#C8102E" radius={[4, 4, 0, 0]} barSize={20} name="Orders" />
                  <Bar yAxisId="right" dataKey="revenue" fill="#1A2B4A" radius={[4, 4, 0, 0]} barSize={20} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Top Clients by Revenue" className="col-span-5">
              <div className="flex flex-col gap-2">
                {topClients.map((c, i) => (
                  <div key={c.client} className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-slate-200">
                    <span className="font-syne w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: i < 3 ? "#C8102E" : "#94A3B8", color: "white", fontSize: 11, fontWeight: 800 }}>{i + 1}</span>
                    <div className="flex-1">
                      <div className="font-dm" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{c.client}</div>
                      <div className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>{c.orders} orders · last: {c.lastOrder}</div>
                    </div>
                    <div className="font-syne" style={{ fontSize: 14, fontWeight: 700, color: "#16A34A" }}>₱{(c.revenue / 1000).toFixed(0)}K</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {(view === "all" || view === "production") && (
          <div className="grid grid-cols-12 gap-6">
            <Card title="Production Stages — Active JOs" className="col-span-7">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={productionStages} layout="vertical" margin={{ top: 8, right: 16, left: 30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B", fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: "#475569", fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontFamily: "DM Sans", fontSize: 12 }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
                    {productionStages.map((s) => <Cell key={s.name} fill={s.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Stage Distribution" className="col-span-5">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={productionStages} dataKey="value" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {productionStages.map((s) => <Cell key={s.name} fill={s.color} />)}
                  </Pie>
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 10, fontFamily: "DM Sans" }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontFamily: "DM Sans", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {(view === "all" || view === "inventory") && (
          <Card title="Inventory & Critical Materials">
            <table className="w-full">
              <thead style={{ backgroundColor: "#F4F6F9" }}>
                <tr>
                  {["Item", "Stock", "Threshold", "Status", "Action"].map((h) => (
                    <th key={h} className="font-dm text-left px-3 py-2.5" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inventoryStock.map((s) => (
                  <tr key={s.item} className="border-t border-slate-200/70">
                    <td className="px-3 py-3 font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{s.item}</td>
                    <td className="px-3 py-3 font-syne" style={{ fontSize: 16, fontWeight: 800, color: s.status === "critical" ? "#C8102E" : s.status === "low" ? "#D97706" : "#16A34A" }}>{s.stock}</td>
                    <td className="px-3 py-3 font-dm" style={{ fontSize: 13, color: "#64748B" }}>{s.threshold}</td>
                    <td className="px-3 py-3">
                      <span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: s.status === "critical" ? "#FEE2E2" : s.status === "low" ? "#FEF3C7" : "#DCFCE7", color: s.status === "critical" ? "#991B1B" : s.status === "low" ? "#B45309" : "#15803D" }}>
                        {s.status === "critical" ? "🔴 CRITICAL" : s.status === "low" ? "⚠️ LOW" : "✅ OK"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {s.status !== "ok" && (
                        <button className="font-dm px-3 py-1 rounded-md border border-red-200 hover:bg-red-50" style={{ fontSize: 11, fontWeight: 700, color: "#C8102E" }}>Reorder Now</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {(view === "all" || view === "logistics") && (
          <Card title="Delivery Method Mix · This Month">
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-7">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={deliveryMix} dataKey="count" innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {deliveryMix.map((d) => <Cell key={d.method} fill={d.color} />)}
                    </Pie>
                    <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11, fontFamily: "DM Sans" }} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontFamily: "DM Sans", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="col-span-5 flex flex-col gap-2 justify-center">
                {deliveryMix.map((d) => (
                  <div key={d.method} className="flex items-center justify-between px-3 py-2 rounded-md" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{d.method}</span>
                    </div>
                    <span className="font-syne" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {(view === "all" || view === "payments") && (
          <Card title="Payment Method Distribution · This Month">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={paymentMix} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="method" tick={{ fontSize: 10, fill: "#64748B", fontFamily: "DM Sans" }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B", fontFamily: "DM Sans" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => `₱${v.toLocaleString("en-PH")}`} contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontFamily: "DM Sans", fontSize: 12 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={50}>
                  {paymentMix.map((p) => <Cell key={p.method} fill={p.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {(view === "all" || view === "demand") && (
          <Card title="Demand Forecast — Top Recurring Items">
            <table className="w-full">
              <thead style={{ backgroundColor: "#F4F6F9" }}>
                <tr>
                  {["Product", "Top Client", "Avg Monthly", "Recommended Buffer", "Trend", "Urgency"].map((h) => (
                    <th key={h} className="font-dm text-left px-3 py-2.5" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {demandForecast.map((d) => (
                  <tr key={d.product} className="border-t border-slate-200/70 hover:bg-slate-50">
                    <td className="px-3 py-3 font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{d.product}</td>
                    <td className="px-3 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{d.topClient}</td>
                    <td className="px-3 py-3 font-syne" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{d.avgMonthly} pcs</td>
                    <td className="px-3 py-3 font-syne" style={{ fontSize: 14, fontWeight: 700, color: "#16A34A" }}>{d.recommendedBuffer} pcs</td>
                    <td className="px-3 py-3 font-dm" style={{ fontSize: 12, fontWeight: 700, color: d.trend.includes("+") ? "#C8102E" : "#64748B" }}>{d.trend}</td>
                    <td className="px-3 py-3">
                      <span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: d.urgency === "HIGH" ? "#FEE2E2" : "#FEF3C7", color: d.urgency === "HIGH" ? "#991B1B" : "#B45309" }}>{d.urgency}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        <div className="rounded-lg p-4 font-dm" style={{ fontSize: 12, color: "#1E40AF", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
          📊 Owner-only Full View · All charts are role-restricted to Owner/CEO. Reports can be exported as CSV or printed as PDF for board meetings.
        </div>
      </div>
    </div>
  );
}

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200/60 p-5 ${className}`} style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <h3 className="font-syne mb-4" style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>{title}</h3>
      {children}
    </div>
  );
}
