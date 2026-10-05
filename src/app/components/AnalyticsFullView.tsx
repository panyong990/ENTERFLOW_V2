import { useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle, Boxes, Calculator, CheckCircle2, ChevronDown,
  Clock3, Download, DollarSign, Factory, FileText, Package, Printer,
  ShoppingCart, TrendingUp, Truck, Users,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie,
  PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Toaster, toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { useMaterials, partCategoryMeta, type RawMaterial } from "../store/materials";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import {
  invoiceTotal, paymentRecords, PRODUCTION_STAGES,
  stageLabel, useOrders, type Inquiry, type Stage,
} from "../store/orders";

type ViewKey = "all" | "revenue" | "sales" | "production" | "inventory" | "logistics" | "payments" | "reports";
type ReportKey = "executive" | "sales" | "production" | "delivery" | "financial";
type ReportMonth = `${number}-${string}`;
type ComparisonMode = "none" | "previous-year";
type StockStatus = "critical" | "low" | "ok";

interface Props {
  onBack: () => void;
  initialView?: ViewKey;
}

interface InventoryRow {
  material: RawMaterial;
  status: StockStatus;
  value: number;
}

interface MonthSummary {
  key: string;
  label: string;
  invoiced: number | null;
  collected: number | null;
  orders: number | null;
  previousYearInvoiced: number | null;
  previousYearCollected: number | null;
}

const palette = {
  navy: "#1A2B4A",
  red: "#C8102E",
  green: "#15803D",
  blue: "#2563EB",
  amber: "#B45309",
  purple: "#7C3AED",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  grid: "#EDF1F5",
};

const chartColors = [palette.red, palette.navy, palette.blue, palette.green, palette.purple, "#D97706", "#0F766E", "#64748B"];
const terminalStages = new Set<Stage>(["delivered", "paid", "overdue"]);
const completedJoStages = new Set<Stage>(["ready_for_dispatch", "dispatched", "delivered", "paid", "overdue"]);
const activeProductionStages = new Set<Stage>(["jo", "in_production", "quality_inspection"]);
const deliveryStages = new Set<Stage>(["ready_for_dispatch", "dispatched", "delivered", "paid", "overdue"]);
const reportOptions: { id: ReportKey; title: string; description: string }[] = [
  { id: "sales", title: "Sales Report", description: "Orders submitted in the selected reporting month." },
  { id: "production", title: "Production Report", description: "Job orders, stage progress, and due dates." },
  { id: "delivery", title: "Delivery Report", description: "Delivery status and method for tracked orders." },
  { id: "financial", title: "Financial Report", description: "Invoiced amounts, verified collections, and balances." },
];

const navItems: { id: ViewKey; label: string; icon: LucideIcon }[] = [
  { id: "all", label: "All Analytics", icon: TrendingUp },
  { id: "revenue", label: "Revenue", icon: DollarSign },
  { id: "sales", label: "Sales", icon: ShoppingCart },
  { id: "production", label: "Production", icon: Factory },
  { id: "inventory", label: "Inventory", icon: Boxes },
  { id: "logistics", label: "Logistics", icon: Truck },
  { id: "payments", label: "Payments", icon: Calculator },
  { id: "reports", label: "Reports", icon: FileText },
];

const monthOptions = Array.from({ length: 12 }, (_, index) =>
  new Date(2000, index, 1).toLocaleDateString("en-US", { month: "long" }),
);

const reportTitles: Record<ReportKey, string> = {
  executive: "Executive Summary",
  sales: "Sales Report",
  production: "Production Report",
  delivery: "Delivery Report",
  financial: "Financial Report",
};

function localMonth(): ReportMonth {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function monthKey(value?: string): string | null {
  const date = parseDate(value);
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function periodDisplay(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function monthKeyFor(year: number, month: number): ReportMonth {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthEnd(key: string, throughDay?: number): Date {
  const [year, month] = key.split("-").map(Number);
  const finalDay = new Date(year, month, 0).getDate();
  const day = throughDay ? Math.min(throughDay, finalDay) : finalDay;
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

function previousYearPeriod(key: string): ReportMonth {
  const [year, month] = key.split("-").map(Number);
  return monthKeyFor(year - 1, month);
}

function historicalPeriods(orders: Inquiry[]): Set<string> {
  const periods = new Set<string>();
  for (const inquiry of orders) {
    for (const date of orderActivityDates(inquiry)) {
      const key = monthKey(date);
      if (key) periods.add(key);
    }
    for (const payment of paymentRecords(inquiry)) {
      const key = monthKey(payment.paymentDate);
      if (key) periods.add(key);
    }
  }
  return periods;
}

function orderActivityDates(inquiry: Inquiry): (string | undefined)[] {
  return [
    inquiry.submittedDate,
    inquiry.invoiceDate,
    inquiry.deliveredDate,
    inquiry.dispatchedAt,
    inquiry.joCompletedAt,
  ];
}

function hasPeriodRecords(orders: Inquiry[], period: string, throughDate: Date): boolean {
  for (const inquiry of orders) {
    if (orderActivityDates(inquiry).some((value) => inMonth(value, period) && (parseDate(value)?.getTime() ?? Infinity) <= throughDate.getTime())) {
      return true;
    }
    if (paymentRecords(inquiry).some((payment) =>
      inMonth(payment.paymentDate, period) && (parseDate(payment.paymentDate)?.getTime() ?? Infinity) <= throughDate.getTime(),
    )) return true;
  }
  return false;
}

function receivablesAt(orders: Inquiry[], periodEnd: Date) {
  return orders
    .filter((inquiry) => Boolean(inquiry.invoiceNo))
    .map((inquiry) => {
      const issuedDate = parseDate(invoiceDate(inquiry));
      const paidByPeriodEnd = paymentRecords(inquiry)
        .filter((payment) => {
          if (payment.verificationStatus !== "verified") return false;
          const paymentDate = parseDate(payment.paymentDate);
          return Boolean(paymentDate && paymentDate <= periodEnd);
        })
        .reduce((sum, payment) => sum + (payment.verifiedAmount ?? payment.submittedAmount), 0);
      const balance = issuedDate && issuedDate <= periodEnd
        ? Math.max(0, orderValue(inquiry) - paidByPeriodEnd)
        : 0;
      return { inquiry, balance, dueDate: parseDate(inquiry.invoiceDueDate) };
    })
    .filter((item) => item.balance > 0);
}

function inMonth(value: string | undefined, month: string): boolean {
  return monthKey(value) === month;
}

function inPeriodThrough(value: string | undefined, month: string, end: Date): boolean {
  const date = parseDate(value);
  return Boolean(date && monthKey(value) === month && date <= end);
}

function isInYear(value: string | undefined, year: number): boolean {
  const date = parseDate(value);
  return !!date && date.getFullYear() === year;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function compactMoney(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `₱${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 10_000) return `₱${(value / 1_000).toFixed(0)}K`;
  if (Math.abs(value) >= 1_000) return `₱${(value / 1_000).toFixed(1)}K`;
  return formatMoney(value);
}

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}%`;
}

function classifyStock(material: RawMaterial): StockStatus {
  if (material.threshold > 0 && material.qtyInStock <= material.threshold * 0.5) return "critical";
  if (material.qtyInStock <= material.threshold) return "low";
  return "ok";
}

function isCompletedJo(inquiry: Inquiry): boolean {
  return Boolean(inquiry.joCompletedAt) || completedJoStages.has(inquiry.stage);
}

function invoiceDate(inquiry: Inquiry): string | undefined {
  return inquiry.invoiceDate ?? inquiry.deliveredDate ?? inquiry.submittedDate;
}

function orderValue(inquiry: Inquiry): number {
  return Math.max(0, invoiceTotal(inquiry));
}

function collectedInMonth(inquiry: Inquiry, month: string, end: Date): number {
  return paymentRecords(inquiry)
    .filter((payment) => payment.verificationStatus === "verified" && inPeriodThrough(payment.paymentDate, month, end))
    .reduce((sum, payment) => sum + (payment.verifiedAmount ?? payment.submittedAmount), 0);
}

function previousMonths(month: string, count: number): { key: string; label: string }[] {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return [];
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(year, monthNumber - count + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return { key, label: monthLabel(key) };
  });
}

type ComparisonValueFormat = "money" | "count" | "percent";

function comparisonDetail(current: number, previous: number, previousPeriod: string, format: ComparisonValueFormat = "money"): string {
  const difference = current - previous;
  const amount = format === "money"
    ? compactMoney(Math.abs(difference))
    : format === "percent"
      ? `${Math.round(Math.abs(difference))} pp`
      : String(Math.abs(difference));
  const change = difference === 0 ? "No change" : `${difference > 0 ? "+" : "−"}${amount}`;
  return `vs ${periodDisplay(previousPeriod)} · ${change}`;
}

function comparisonText(
  enabled: boolean,
  available: boolean,
  periodAvailable: boolean,
  current: number,
  previous: number,
  previousPeriod: string,
  format: ComparisonValueFormat = "money",
): string | undefined {
  if (!enabled || !available || !periodAvailable) return undefined;
  return comparisonDetail(current, previous, previousPeriod, format);
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AnalyticsFullView({ initialView = "all" }: Props) {
  const [view, setView] = useState<ViewKey>(initialView);
  const [reportMonth, setReportMonth] = useState<ReportMonth>(localMonth);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("none");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [draftMonth, setDraftMonth] = useState(Number(localMonth().slice(5)));
  const [draftYear, setDraftYear] = useState(Number(localMonth().slice(0, 4)));
  const [draftComparison, setDraftComparison] = useState<ComparisonMode>("none");
  const { rawMaterials } = useMaterials();
  const { inquiries, completedJOs } = useOrders();

  const allOrders = useMemo(() => {
    const unique = new Map<string, Inquiry>();
    for (const inquiry of [...inquiries, ...completedJOs]) unique.set(inquiry.id, inquiry);
    return Array.from(unique.values());
  }, [inquiries, completedJOs]);
  const jobOrders = useMemo(() => allOrders.filter((inquiry) => Boolean(inquiry.joNumber)), [allOrders]);
  const availablePeriods = useMemo(() => historicalPeriods(allOrders), [allOrders]);
  const availableYears = useMemo(
    () => Array.from(new Set(Array.from(availablePeriods, (period) => Number(period.slice(0, 4))))).sort((a, b) => b - a),
    [availablePeriods],
  );
  const comparisonMonth = previousYearPeriod(reportMonth);
  const reportYear = Number(reportMonth.slice(0, 4));
  const isCurrentMonth = reportMonth === localMonth();
  const periodEnd = useMemo(
    () => monthEnd(reportMonth, isCurrentMonth ? new Date().getDate() : undefined),
    [reportMonth, isCurrentMonth],
  );
  const comparisonEnd = useMemo(
    () => monthEnd(comparisonMonth, isCurrentMonth ? new Date().getDate() : undefined),
    [comparisonMonth, isCurrentMonth],
  );
  const periodAvailable = useMemo(
    () => hasPeriodRecords(allOrders, reportMonth, periodEnd),
    [allOrders, reportMonth, periodEnd],
  );
  const comparisonAvailable = useMemo(
    () => hasPeriodRecords(allOrders, comparisonMonth, comparisonEnd),
    [allOrders, comparisonMonth, comparisonEnd],
  );
  const comparisonEnabled = comparisonMode === "previous-year";

  const updatePeriodPopover = (open: boolean) => {
    if (open) {
      const [year, month] = reportMonth.split("-").map(Number);
      setDraftYear(year);
      setDraftMonth(month);
      setDraftComparison(comparisonMode);
    }
    setPeriodOpen(open);
  };
  const applyPeriodSelection = () => {
    setReportMonth(monthKeyFor(draftYear, draftMonth));
    setComparisonMode(draftComparison);
    setPeriodOpen(false);
  };
  const draftComparisonMonth = previousYearPeriod(monthKeyFor(draftYear, draftMonth));
  const draftComparisonEnd = monthEnd(draftComparisonMonth, monthKeyFor(draftYear, draftMonth) === localMonth() ? new Date().getDate() : undefined);
  const draftComparisonAvailable = hasPeriodRecords(allOrders, draftComparisonMonth, draftComparisonEnd);
  const periodOrders = useMemo(
    () => allOrders.filter((inquiry) => inPeriodThrough(inquiry.submittedDate, reportMonth, periodEnd)),
    [allOrders, reportMonth, periodEnd],
  );

  const inventoryRows = useMemo<InventoryRow[]>(() => rawMaterials.map((material) => ({
    material,
    status: classifyStock(material),
    value: Math.max(0, material.qtyInStock * material.unitPrice),
  })), [rawMaterials]);
  const criticalInventory = inventoryRows.filter((row) => row.status === "critical");
  const lowInventory = inventoryRows.filter((row) => row.status === "low");
  const inventoryCapital = inventoryRows.reduce((sum, row) => sum + row.value, 0);

  const periodInvoices = jobOrders.filter((inquiry) => Boolean(inquiry.invoiceNo) && inPeriodThrough(invoiceDate(inquiry), reportMonth, periodEnd));
  const yearInvoices = jobOrders.filter((inquiry) =>
    Boolean(inquiry.invoiceNo) && isInYear(invoiceDate(inquiry), reportYear)
    && (parseDate(invoiceDate(inquiry))?.getTime() ?? Infinity) <= periodEnd.getTime(),
  );
  const comparisonInvoices = jobOrders.filter((inquiry) => Boolean(inquiry.invoiceNo) && inPeriodThrough(invoiceDate(inquiry), comparisonMonth, comparisonEnd));
  const periodRevenue = periodInvoices.reduce((sum, inquiry) => sum + orderValue(inquiry), 0);
  const yearRevenue = yearInvoices.reduce((sum, inquiry) => sum + orderValue(inquiry), 0);
  const comparisonRevenue = comparisonInvoices.reduce((sum, inquiry) => sum + orderValue(inquiry), 0);
  const periodPayments = jobOrders.flatMap((inquiry) =>
    paymentRecords(inquiry)
      .filter((payment) => payment.verificationStatus === "verified" && inPeriodThrough(payment.paymentDate, reportMonth, periodEnd))
      .map((payment) => ({
        ...payment,
        clientName: inquiry.clientName,
        amount: payment.verifiedAmount ?? payment.submittedAmount,
      })),
  );
  const periodCollections = periodPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const comparisonCollections = jobOrders.reduce((total, inquiry) => total + paymentRecords(inquiry)
    .filter((payment) => payment.verificationStatus === "verified" && inPeriodThrough(payment.paymentDate, comparisonMonth, comparisonEnd))
    .reduce((sum, payment) => sum + (payment.verifiedAmount ?? payment.submittedAmount), 0), 0);
  const comparisonOrders = allOrders.filter((inquiry) => inPeriodThrough(inquiry.submittedDate, comparisonMonth, comparisonEnd));
  const periodOpenOrders = periodOrders.filter((inquiry) => inquiry.stage !== "paid").length;
  const comparisonOpenOrders = comparisonOrders.filter((inquiry) => inquiry.stage !== "paid").length;
  const collectionRate = periodRevenue > 0 ? Math.min(100, (periodCollections / periodRevenue) * 100) : null;
  const comparisonCollectionRate = comparisonRevenue > 0
    ? Math.min(100, (comparisonCollections / comparisonRevenue) * 100)
    : null;
  const yearAvailable = Array.from(availablePeriods).some((period) => period.startsWith(`${reportYear}-`));

  const receivables = useMemo(() => receivablesAt(jobOrders, periodEnd), [jobOrders, periodEnd]);
  const comparisonReceivables = useMemo(
    () => comparisonAvailable ? receivablesAt(jobOrders, comparisonEnd) : [],
    [jobOrders, comparisonAvailable, comparisonEnd],
  );
  const outstandingReceivables = receivables.reduce((sum, item) => sum + item.balance, 0);
  const overdueReceivables = receivables
    .filter(({ dueDate }) => dueDate !== null && dueDate <= periodEnd)
    .reduce((sum, item) => sum + item.balance, 0);
  const comparisonOutstandingReceivables = comparisonReceivables.reduce((sum, item) => sum + item.balance, 0);
  const comparisonOverdueReceivables = comparisonReceivables
    .filter(({ dueDate }) => dueDate !== null && dueDate <= comparisonEnd)
    .reduce((sum, item) => sum + item.balance, 0);

  const activeOrders = periodOpenOrders;
  const activeProduction = jobOrders.filter((inquiry) => activeProductionStages.has(inquiry.stage));
  const productionComplete = jobOrders.filter(isCompletedJo).length;
  const completedJOPercent = jobOrders.length ? (productionComplete / jobOrders.length) * 100 : null;
  const periodCompletedJOs = jobOrders.filter((inquiry) => inPeriodThrough(inquiry.joCompletedAt, reportMonth, periodEnd)).length;
  const comparisonCompletedJOs = jobOrders.filter((inquiry) => inPeriodThrough(inquiry.joCompletedAt, comparisonMonth, comparisonEnd)).length;
  const delayedOrders = jobOrders.filter((inquiry) => {
    if (!inquiry.dueDate || terminalStages.has(inquiry.stage)) return false;
    const dueDate = parseDate(inquiry.dueDate);
    return Boolean(dueDate && dueDate.getTime() < new Date().setHours(0, 0, 0, 0));
  });
  const readyForDispatch = jobOrders.filter((inquiry) => inquiry.stage === "ready_for_dispatch").length;
  const inTransit = jobOrders.filter((inquiry) => inquiry.stage === "dispatched").length;
  const allDeliveredOrders = jobOrders.filter((inquiry) =>
    ["delivered", "paid", "overdue"].includes(inquiry.stage),
  );
  const deliveredOrders = allDeliveredOrders.filter((inquiry) =>
    ["delivered", "paid", "overdue"].includes(inquiry.stage) && inPeriodThrough(inquiry.deliveredDate, reportMonth, periodEnd),
  );
  const comparisonDeliveredOrders = jobOrders.filter((inquiry) =>
    ["delivered", "paid", "overdue"].includes(inquiry.stage) && inPeriodThrough(inquiry.deliveredDate, comparisonMonth, comparisonEnd),
  );
  const onTimeDeliveries = deliveredOrders.filter((inquiry) => {
    const due = parseDate(inquiry.dueDate);
    const delivered = parseDate(inquiry.deliveredDate);
    return Boolean(due && delivered && delivered.getTime() <= due.getTime());
  }).length;
  const deliveriesWithDates = deliveredOrders.filter((inquiry) => parseDate(inquiry.dueDate) && parseDate(inquiry.deliveredDate)).length;
  const onTimeRate = deliveriesWithDates ? (onTimeDeliveries / deliveriesWithDates) * 100 : null;
  const comparisonOnTimeDeliveries = comparisonDeliveredOrders.filter((inquiry) => {
    const due = parseDate(inquiry.dueDate);
    const delivered = parseDate(inquiry.deliveredDate);
    return Boolean(due && delivered && delivered.getTime() <= due.getTime());
  }).length;
  const comparisonDeliveriesWithDates = comparisonDeliveredOrders.filter((inquiry) => parseDate(inquiry.dueDate) && parseDate(inquiry.deliveredDate)).length;
  const comparisonOnTimeRate = comparisonDeliveriesWithDates
    ? (comparisonOnTimeDeliveries / comparisonDeliveriesWithDates) * 100
    : null;

  const monthlySummary = useMemo<MonthSummary[]>(() => previousMonths(reportMonth, 6).map(({ key, label }) => {
    const comparisonKey = previousYearPeriod(key);
    const throughDay = key === localMonth() ? new Date().getDate() : undefined;
    const monthEndDate = monthEnd(key, throughDay);
    const previousYearEndDate = monthEnd(comparisonKey, throughDay);
    const hasData = hasPeriodRecords(allOrders, key, monthEndDate);
    const hasComparisonData = hasPeriodRecords(allOrders, comparisonKey, previousYearEndDate);
    const invoices = jobOrders.filter((inquiry) => Boolean(inquiry.invoiceNo) && inPeriodThrough(invoiceDate(inquiry), key, monthEndDate));
    return {
      key,
      label,
      invoiced: hasData ? invoices.reduce((sum, inquiry) => sum + orderValue(inquiry), 0) : null,
      collected: hasData ? jobOrders.reduce((total, inquiry) => total + paymentRecords(inquiry)
        .filter((payment) => payment.verificationStatus === "verified" && inPeriodThrough(payment.paymentDate, key, monthEndDate))
        .reduce((sum, payment) => sum + (payment.verifiedAmount ?? payment.submittedAmount), 0), 0) : null,
      orders: hasData ? allOrders.filter((inquiry) => inPeriodThrough(inquiry.submittedDate, key, monthEndDate)).length : null,
      previousYearInvoiced: hasComparisonData
        ? jobOrders.filter((inquiry) => Boolean(inquiry.invoiceNo) && inPeriodThrough(invoiceDate(inquiry), comparisonKey, previousYearEndDate))
          .reduce((sum, inquiry) => sum + orderValue(inquiry), 0)
        : null,
      previousYearCollected: hasComparisonData
        ? jobOrders.reduce((total, inquiry) => total + paymentRecords(inquiry)
          .filter((payment) => payment.verificationStatus === "verified" && inPeriodThrough(payment.paymentDate, comparisonKey, previousYearEndDate))
          .reduce((sum, payment) => sum + (payment.verifiedAmount ?? payment.submittedAmount), 0), 0)
        : null,
    };
  }), [reportMonth, jobOrders, allOrders]);

  const stagePipeline = useMemo(() => {
    const order = ["inquiry", "quotation", "po", "jo", "in_production", "quality_inspection", "ready_for_dispatch", "dispatched", "delivered", "overdue", "paid"] as Stage[];
    return order
      .map((stage) => ({ stage, name: stageLabel[stage], orders: allOrders.filter((inquiry) => inquiry.stage === stage).length }))
      .filter((row) => row.orders > 0);
  }, [allOrders]);

  const currentStageCounts = useMemo(() => {
    return PRODUCTION_STAGES.map((name, index) => ({
      name,
      jobs: activeProduction.filter((inquiry) => (inquiry.currentStage ?? 0) === index).length,
    }));
  }, [activeProduction]);

  const clientRevenue = useMemo(() => {
    const totals = new Map<string, { client: string; revenue: number; invoices: number }>();
    for (const inquiry of periodInvoices) {
      const client = totals.get(inquiry.clientName) ?? { client: inquiry.clientName, revenue: 0, invoices: 0 };
      client.revenue += orderValue(inquiry);
      client.invoices += 1;
      totals.set(inquiry.clientName, client);
    }
    return Array.from(totals.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  }, [periodInvoices]);
  const topClient = clientRevenue[0];

  const deliveryMix = useMemo(() => {
    const totals = new Map<string, number>();
    for (const inquiry of jobOrders.filter((order) =>
      deliveryStages.has(order.stage)
      && inPeriodThrough(order.deliveredDate ?? order.dispatchedAt, reportMonth, periodEnd),
    )) {
      const method = inquiry.deliveryMethod ?? "Not specified";
      totals.set(method, (totals.get(method) ?? 0) + 1);
    }
    return Array.from(totals, ([method, count]) => ({ method, count }))
      .sort((a, b) => b.count - a.count);
  }, [jobOrders, reportMonth, periodEnd]);

  const paymentMix = useMemo(() => {
    const totals = new Map<string, number>();
    for (const payment of periodPayments) {
      const method = payment.method?.trim() || "Not specified";
      totals.set(method, (totals.get(method) ?? 0) + payment.amount);
    }
    return Array.from(totals, ([method, amount]) => ({ method, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [periodPayments]);

  const receivablesAging = useMemo(() => {
    const buckets = [
      { name: "Not yet due", amount: 0 },
      { name: "1–15 days", amount: 0 },
      { name: "16–30 days", amount: 0 },
      { name: "31–60 days", amount: 0 },
      { name: "Over 60 days", amount: 0 },
    ];
    for (const item of receivables) {
      if (!item.dueDate || item.dueDate > periodEnd) {
        buckets[0].amount += item.balance;
        continue;
      }
      const ageDays = Math.floor((periodEnd.getTime() - item.dueDate.getTime()) / (24 * 60 * 60 * 1000));
      const index = ageDays <= 15 ? 1 : ageDays <= 30 ? 2 : ageDays <= 60 ? 3 : 4;
      buckets[index].amount += item.balance;
    }
    return buckets;
  }, [receivables, periodEnd]);

  const categoryHealth = useMemo(() => {
    return (Object.keys(partCategoryMeta) as (keyof typeof partCategoryMeta)[])
      .map((category) => {
        const items = inventoryRows.filter((row) => row.material.category === category);
        return {
          name: partCategoryMeta[category].label,
          items: items.length,
          low: items.filter((item) => item.status === "low").length,
          critical: items.filter((item) => item.status === "critical").length,
        };
      })
      .filter((category) => category.items > 0);
  }, [inventoryRows]);

  const executiveAlerts = useMemo(() => {
    const alerts: { severity: "critical" | "warning" | "info"; title: string; detail: string }[] = [];
    const overdueReceivableCount = receivables.filter(({ dueDate }) => dueDate !== null && dueDate <= periodEnd).length;
    if (overdueReceivables > 0) alerts.push({
      severity: "critical",
      title: `${formatMoney(overdueReceivables)} in overdue receivables`,
      detail: `${overdueReceivableCount} outstanding invoice${overdueReceivableCount === 1 ? "" : "s"} past due as of ${periodDisplay(reportMonth)}.`,
    });
    if (delayedOrders.length > 0) alerts.push({
      severity: "critical",
      title: `${delayedOrders.length} job order${delayedOrders.length === 1 ? "" : "s"} past due`,
      detail: delayedOrders.slice(0, 3).map((inquiry) => inquiry.joNumber).filter(Boolean).join(", "),
    });
    if (criticalInventory.length > 0) alerts.push({
      severity: "critical",
      title: `${criticalInventory.length} critical stock item${criticalInventory.length === 1 ? "" : "s"}`,
      detail: criticalInventory.slice(0, 3).map(({ material }) => material.name).join(", "),
    });
    if (lowInventory.length > 0) alerts.push({
      severity: "warning",
      title: `${lowInventory.length} inventory item${lowInventory.length === 1 ? "" : "s"} at low stock`,
      detail: "Stock is at or below its reorder threshold.",
    });
    if (readyForDispatch > 0) alerts.push({
      severity: "info",
      title: `${readyForDispatch} job order${readyForDispatch === 1 ? "" : "s"} ready for dispatch`,
      detail: "Warehouse handoff is available for these completed JOs.",
    });
    return alerts.sort((a, b) => {
      const rank = { critical: 0, warning: 1, info: 2 };
      return rank[a.severity] - rank[b.severity];
    });
  }, [overdueReceivables, receivables, periodEnd, reportMonth, delayedOrders, criticalInventory, lowInventory, readyForDispatch]);

  const companyHealth = criticalInventory.length || overdueReceivables > 0 || delayedOrders.length
    ? { label: "Needs attention", color: "#B91C1C", background: "#FEF2F2" }
    : lowInventory.length || readyForDispatch
      ? { label: "Monitor closely", color: "#B45309", background: "#FFFBEB" }
      : { label: "On track", color: "#15803D", background: "#F0FDF4" };

  const exportReport = (report: ReportKey) => {
    const ordersSubmitted = allOrders.filter((inquiry) => inPeriodThrough(inquiry.submittedDate, reportMonth, periodEnd));
    const invoicesInPeriod = jobOrders.filter((inquiry) => Boolean(inquiry.invoiceNo) && inPeriodThrough(invoiceDate(inquiry), reportMonth, periodEnd));
    const deliveredInPeriod = jobOrders.filter((inquiry) =>
      deliveryStages.has(inquiry.stage) && inPeriodThrough(inquiry.deliveredDate ?? inquiry.dispatchedAt, reportMonth, periodEnd),
    );
    const rows: (string | number)[][] = [];
    const receivableBalanceById = new Map(receivables.map((item) => [item.inquiry.id, item.balance]));

    if (report === "executive") {
      rows.push(["Metric", "Value", "Reporting period"]);
      rows.push(["Invoiced revenue", periodAvailable ? periodRevenue : "Unavailable", periodDisplay(reportMonth)]);
      rows.push(["Verified collections", periodAvailable ? periodCollections : "Unavailable", periodDisplay(reportMonth)]);
      rows.push(["Open orders", periodAvailable ? activeOrders : "Unavailable", periodDisplay(reportMonth)]);
      rows.push(["Jobs in production (current status)", activeProduction.length, periodDisplay(reportMonth)]);
      rows.push(["Completed JOs (current status)", productionComplete, periodDisplay(reportMonth)]);
      rows.push(["Outstanding receivables", outstandingReceivables, periodDisplay(reportMonth)]);
      rows.push(["Overdue receivables", overdueReceivables, periodDisplay(reportMonth)]);
      rows.push(["Critical stock items (current stock)", criticalInventory.length, periodDisplay(reportMonth)]);
    } else if (report === "sales") {
      rows.push(["Submitted", "Order", "Client", "Current status", "Products", "Quantity", "Order value"]);
      for (const inquiry of ordersSubmitted) rows.push([
        inquiry.submittedDate, inquiry.joNumber ?? inquiry.code, inquiry.clientName, stageLabel[inquiry.stage],
        inquiry.products.map((product) => product.filterName ?? product.type).join("; "),
        inquiry.products.reduce((sum, product) => sum + product.qty, 0), orderValue(inquiry),
      ]);
    } else if (report === "production") {
      rows.push(["Submitted", "JO", "Client", "Current status", "Current stage", "Stage progress", "Due date"]);
      for (const inquiry of ordersSubmitted.filter((item) => item.joNumber)) {
        const progress = Math.min(PRODUCTION_STAGES.length, inquiry.currentStage ?? 0);
        rows.push([
          inquiry.submittedDate, inquiry.joNumber ?? "", inquiry.clientName, stageLabel[inquiry.stage],
          isCompletedJo(inquiry) ? "Production complete" : (PRODUCTION_STAGES[progress] ?? "—"),
          `${Math.round((progress / PRODUCTION_STAGES.length) * 100)}%`, inquiry.dueDate ?? "",
        ]);
      }
    } else if (report === "delivery") {
      rows.push(["Date", "JO", "Client", "Delivery method", "Status", "Tracking / Waybill"]);
      for (const inquiry of deliveredInPeriod) rows.push([
        inquiry.deliveredDate ?? inquiry.dispatchedAt ?? "",
        inquiry.joNumber ?? "", inquiry.clientName, inquiry.deliveryMethod ?? "Not specified",
        stageLabel[inquiry.stage], inquiry.trackingRef ?? inquiry.waybillNumber ?? "",
      ]);
    } else {
      rows.push(["Invoice date", "JO", "Client", "Invoice", "Invoice amount", "Collected in period", "Outstanding at period end", "Due date"]);
      for (const inquiry of invoicesInPeriod) rows.push([
        invoiceDate(inquiry) ?? "", inquiry.joNumber ?? "", inquiry.clientName, inquiry.invoiceNo ?? "",
        orderValue(inquiry), collectedInMonth(inquiry, reportMonth, periodEnd), receivableBalanceById.get(inquiry.id) ?? 0,
        inquiry.invoiceDueDate ?? "",
      ]);
      if (!periodAvailable) rows.push([`No transaction records are available for ${periodDisplay(reportMonth)}.`]);
    }
    if (!periodAvailable && report !== "executive" && report !== "financial") {
      rows.push([`No transaction records are available for ${periodDisplay(reportMonth)}.`]);
    }

    try {
      downloadCsv(`enter-flow-${report}-${reportMonth}.csv`, rows);
      toast.success(`${reportTitles[report]} downloaded`, { description: `CSV for ${periodDisplay(reportMonth)} is ready.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The CSV could not be created.";
      toast.error("Unable to generate report", { description: message });
    }
  };

  const hasFinancialData = periodAvailable && (periodInvoices.length > 0 || periodPayments.length > 0);
  const periodAverageOrderValue = periodOrders.length
    ? periodOrders.reduce((sum, order) => sum + orderValue(order), 0) / periodOrders.length
    : 0;
  const comparisonAverageOrderValue = comparisonOrders.length
    ? comparisonOrders.reduce((sum, order) => sum + orderValue(order), 0) / comparisonOrders.length
    : 0;
  const comparisonTextFor = (current: number, previous: number, format: ComparisonValueFormat = "money") =>
    comparisonText(comparisonEnabled, comparisonAvailable, periodAvailable, current, previous, comparisonMonth, format);

  return (
    <div className="ceo-analytics flex-1 h-full min-w-0 overflow-auto" style={{ backgroundColor: "#F4F6F9" }}>
      <Toaster position="bottom-right" richColors />

      <header className="border-b border-slate-200/70 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold text-white" style={{ backgroundColor: palette.red }}>
              EF
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-syne truncate" style={{ fontSize: 24, fontWeight: 700, color: palette.text, lineHeight: 1.2 }}>
                  CEO Analytics
                </h1>
                <span className="rounded-full px-2.5 py-1 font-dm" style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.3, backgroundColor: "#EFF6FF", color: palette.navy }}>
                  EXECUTIVE VIEW
                </span>
              </div>
              <p className="font-dm mt-1 truncate" style={{ fontSize: 12, color: palette.muted }}>
                Company performance and operational health at a glance
              </p>
            </div>
          </div>

          <Popover open={periodOpen} onOpenChange={updatePeriodPopover}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Reporting Period: ${periodDisplay(reportMonth)}. Change reporting period`}
                aria-haspopup="dialog"
                aria-expanded={periodOpen}
                className="flex min-w-[210px] flex-col rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:min-w-[230px]"
              >
                <span className="font-dm" style={{ fontSize: 10, fontWeight: 600, color: palette.muted }}>Reporting Period</span>
                <span className="mt-0.5 flex w-full items-center justify-between gap-4 font-dm" style={{ fontSize: 13, fontWeight: 700, color: palette.text }}>
                  {periodDisplay(reportMonth)}
                  <ChevronDown size={15} aria-hidden="true" />
                </span>
                {comparisonEnabled && (
                  <span className="mt-1 font-dm" style={{ fontSize: 10, color: comparisonAvailable ? palette.muted : "#B45309" }}>
                    {comparisonAvailable
                      ? `${periodDisplay(reportMonth)} vs ${periodDisplay(comparisonMonth)}`
                      : `Comparison data unavailable · ${periodDisplay(comparisonMonth)}`}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent aria-labelledby="reporting-period-title" align="end" sideOffset={6} className="w-[min(22rem,calc(100vw-2rem))] p-4">
              <div className="mb-3">
                <h2 id="reporting-period-title" className="font-dm" style={{ fontSize: 14, fontWeight: 700, color: palette.text }}>Reporting Period</h2>
                <p className="mt-1 font-dm" style={{ fontSize: 11, color: palette.muted }}>Choose the month and year to review.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="min-w-0">
                  <span className="mb-1 block font-dm" style={{ fontSize: 11, fontWeight: 600, color: palette.muted }}>Month</span>
                  <Select value={String(draftMonth)} onValueChange={(value) => setDraftMonth(Number(value))}>
                    <SelectTrigger aria-label="Reporting month" className="h-9 bg-white font-dm text-xs focus-visible:ring-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((month, index) => (
                        <SelectItem key={month} value={String(index + 1)}>{month}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="min-w-0">
                  <span className="mb-1 block font-dm" style={{ fontSize: 11, fontWeight: 600, color: palette.muted }}>Year</span>
                  <Select
                    value={availableYears.includes(draftYear) ? String(draftYear) : ""}
                    onValueChange={(value) => setDraftYear(Number(value))}
                    disabled={!availableYears.length}
                  >
                    <SelectTrigger aria-label="Reporting year" className="h-9 bg-white font-dm text-xs focus-visible:ring-2">
                      <SelectValue placeholder="No dated records" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableYears.map((year) => (
                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <label className="mt-3 block">
                <span className="mb-1 block font-dm" style={{ fontSize: 11, fontWeight: 600, color: palette.muted }}>Compare</span>
                <Select value={draftComparison} onValueChange={(value: ComparisonMode) => setDraftComparison(value)}>
                  <SelectTrigger aria-label="Comparison period" className="h-9 bg-white font-dm text-xs focus-visible:ring-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No comparison</SelectItem>
                    <SelectItem value="previous-year">Previous Year</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              {draftComparison === "previous-year" && !draftComparisonAvailable && (
                <p role="status" className="mt-2 font-dm" style={{ fontSize: 11, color: "#B45309" }}>
                  No records are available for {periodDisplay(draftComparisonMonth)}.
                </p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPeriodOpen(false)}
                  className="rounded-md border border-slate-200 px-3 py-1.5 font-dm text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyPeriodSelection}
                  disabled={!availableYears.length}
                  className="rounded-md px-3 py-1.5 font-dm text-xs font-semibold text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: palette.navy }}
                >
                  Apply
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      <nav aria-label="Analytics sections" className="sticky top-0 z-10 overflow-x-auto border-b border-slate-200/70 bg-white">
        <div className="flex min-w-max px-2 sm:px-4 lg:px-6" role="tablist" aria-label="CEO analytics views">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const selected = view === item.id;
            return (
              <button
                key={item.id}
                id={`analytics-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="analytics-panel"
                onClick={() => setView(item.id)}
                className={`relative flex h-12 items-center gap-2 whitespace-nowrap px-3 font-dm transition-colors hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-600 sm:px-4 ${index ? "before:absolute before:left-0 before:top-3 before:h-6 before:w-px before:bg-slate-200" : ""}`}
                style={{
                  fontSize: 12,
                  fontWeight: selected ? 700 : 600,
                  color: selected ? palette.red : palette.muted,
                  borderBottom: selected ? `3px solid ${palette.red}` : "3px solid transparent",
                  marginBottom: -1,
                }}
              >
                <Icon size={14} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main
        id="analytics-panel"
        role="tabpanel"
        aria-labelledby={`analytics-tab-${view}`}
        className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 p-4 sm:p-5 xl:p-6"
      >
        {(!periodAvailable || (comparisonEnabled && !comparisonAvailable)) && (
          <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 font-dm" style={{ fontSize: 12, color: "#92400E" }}>
            {!periodAvailable && `No transaction records are available for ${periodDisplay(reportMonth)}. `}
            {comparisonEnabled && !comparisonAvailable && `Comparison data is unavailable for ${periodDisplay(comparisonMonth)}. `}
            Current workflow and inventory indicators reflect the latest available system status.
          </div>
        )}
        {view === "all" && (
          <>
            <section aria-labelledby="company-health-heading">
              <SectionHeading
                eyebrow={`REPORTING PERIOD · ${periodDisplay(reportMonth).toUpperCase()}${comparisonEnabled && comparisonAvailable ? ` VS ${periodDisplay(comparisonMonth).toUpperCase()}` : ""}`}
                title="Company Health"
                description="A concise view of revenue, orders, production, and cash collection."
                action={<HealthBadge label={companyHealth.label} color={companyHealth.color} background={companyHealth.background} />}
                id="company-health-heading"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Invoiced Revenue"
                  value={periodAvailable ? compactMoney(periodRevenue) : "—"}
                  detail={periodDisplay(reportMonth)}
                  comparison={comparisonTextFor(periodRevenue, comparisonRevenue)}
                  icon={DollarSign}
                  color={palette.green}
                />
                <MetricCard
                  label="Open Orders"
                  value={periodAvailable ? activeOrders : "—"}
                  detail={periodAvailable ? `${periodOrders.length} submitted in period` : "No transaction records"}
                  comparison={comparisonTextFor(activeOrders, comparisonOpenOrders, "count")}
                  icon={ShoppingCart}
                  color={palette.red}
                />
                <MetricCard label="Jobs in Production" value={activeProduction.length} detail={`Live status · ${productionComplete} completed JOs`} icon={Factory} color={palette.navy} />
                <MetricCard
                  label="Outstanding Receivables"
                  value={compactMoney(outstandingReceivables)}
                  detail={`At ${periodDisplay(reportMonth)} month-end · ${compactMoney(overdueReceivables)} overdue`}
                  comparison={comparisonTextFor(outstandingReceivables, comparisonOutstandingReceivables)}
                  icon={Calculator}
                  color={overdueReceivables ? palette.amber : palette.blue}
                />
              </div>
            </section>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
              <Panel className="xl:col-span-3" title="Revenue & Collections" description="Invoiced value and verified payments by month.">
                <RevenueChart data={monthlySummary} comparePreviousYear={comparisonEnabled} />
              </Panel>
              <Panel className="xl:col-span-2" title="Executive Snapshot" description={`Key indicators · ${periodDisplay(reportMonth)}`}>
                <div className="divide-y divide-slate-100">
                  <SnapshotRow label="Orders submitted" value={periodAvailable ? periodOrders.length.toString() : "—"} icon={ShoppingCart} />
                  <SnapshotRow label="Current JO completion" value={formatPercent(completedJOPercent)} icon={CheckCircle2} />
                  <SnapshotRow label="On-time delivery" value={formatPercent(onTimeRate)} icon={Truck} />
                  <SnapshotRow label="Collection rate" value={formatPercent(collectionRate)} icon={Calculator} />
                  <SnapshotRow label="Delayed JOs · current" value={delayedOrders.length.toString()} icon={Clock3} alert={delayedOrders.length > 0} />
                </div>
              </Panel>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
              <div className="xl:col-span-3">
                <PipelinePanel data={stagePipeline} />
              </div>
              <Panel className="xl:col-span-2 xl:self-start" title="Revenue by Client" description={`Invoiced revenue · ${periodDisplay(reportMonth)}`}>
                <ClientRevenueList rows={clientRevenue} emptyMessage={periodAvailable ? undefined : `No records are available for ${periodDisplay(reportMonth)}.`} />
              </Panel>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              <Panel title="Production Monitoring" description="Live current stage load and job status. Historical stage snapshots are not stored.">
                <ProductionSummary
                  activeCount={activeProduction.length}
                  completedCount={productionComplete}
                  delayedCount={delayedOrders.length}
                  averageProgress={activeProduction.length
                    ? activeProduction.reduce((sum, order) => sum + Math.min(PRODUCTION_STAGES.length, order.currentStage ?? 0), 0) / activeProduction.length / PRODUCTION_STAGES.length * 100
                    : null}
                />
              </Panel>
              <Panel title="Inventory Health" description="Live stock levels from the Materials store.">
                <InventorySummary
                  total={inventoryRows.length}
                  low={lowInventory.length}
                  critical={criticalInventory.length}
                  capital={inventoryCapital}
                />
              </Panel>
              <Panel title="Logistics Performance" description={`Live shipment status · on-time delivery for ${periodDisplay(reportMonth)}.`}>
                <LogisticsSummary
                  ready={readyForDispatch}
                  transit={inTransit}
                  delivered={allDeliveredOrders.length}
                  onTime={onTimeRate}
                />
              </Panel>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <Panel title="Payments & Collections" description={`Verified receipts and receivables as of ${periodDisplay(reportMonth)} month-end.`}>
                <PaymentsSummary
                  collected={periodCollections}
                  outstanding={outstandingReceivables}
                  overdue={overdueReceivables}
                  rate={collectionRate}
                />
              </Panel>
              <AlertsPanel alerts={executiveAlerts} />
            </div>

            <ReportsPanel onExport={exportReport} />
          </>
        )}

        {view === "revenue" && (
          <>
            <SectionHeading title="Revenue" description={`Invoice-backed revenue, verified collections, and client contribution · ${periodDisplay(reportMonth)}${comparisonEnabled && comparisonAvailable ? ` vs ${periodDisplay(comparisonMonth)}` : ""}.`} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Revenue this period" value={periodAvailable ? compactMoney(periodRevenue) : "—"} detail={`${periodInvoices.length} invoices · ${periodDisplay(reportMonth)}`} comparison={comparisonTextFor(periodRevenue, comparisonRevenue)} icon={DollarSign} color={palette.green} />
              <MetricCard label="Revenue year to date" value={yearAvailable ? compactMoney(yearRevenue) : "—"} detail={`${reportYear} invoiced revenue`} icon={TrendingUp} color={palette.navy} />
              <MetricCard
                label="Average invoice"
                value={periodInvoices.length ? compactMoney(periodRevenue / periodInvoices.length) : "—"}
                detail="Selected reporting period"
                comparison={periodInvoices.length && comparisonInvoices.length
                  ? comparisonTextFor(periodRevenue / periodInvoices.length, comparisonRevenue / comparisonInvoices.length)
                  : undefined}
                icon={Calculator}
                color={palette.blue}
              />
              <MetricCard label="Top client" value={topClient?.client ?? "—"} detail={topClient ? formatMoney(topClient.revenue) : periodAvailable ? "No invoices in period" : "No records for this period"} icon={Users} color={palette.purple} />
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
              <Panel className="xl:col-span-3" title="Revenue Trend" description="Actual invoice totals and verified collections.">
                <RevenueChart data={monthlySummary} comparePreviousYear={comparisonEnabled} />
              </Panel>
              <Panel className="xl:col-span-2 xl:self-start" title="Revenue by Client" description={`Selected reporting period · ${periodDisplay(reportMonth)}`}>
                <ClientRevenueList rows={clientRevenue} emptyMessage={periodAvailable ? undefined : `No records are available for ${periodDisplay(reportMonth)}.`} />
              </Panel>
            </div>
          </>
        )}

        {view === "sales" && (
          <>
            <SectionHeading title="Sales Monitoring" description="Order pipeline and client activity · no operational controls." />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricCard label="Orders submitted" value={periodAvailable ? periodOrders.length : "—"} detail={periodDisplay(reportMonth)} comparison={comparisonTextFor(periodOrders.length, comparisonOrders.length, "count")} icon={ShoppingCart} color={palette.red} />
              <MetricCard label="Open orders" value={periodAvailable ? activeOrders : "—"} detail="Submitted in period · excluding paid" comparison={comparisonTextFor(activeOrders, comparisonOpenOrders, "count")} icon={TrendingUp} color={palette.blue} />
              <MetricCard label="Average order value" value={periodOrders.length ? compactMoney(periodAverageOrderValue) : "—"} detail="Based on current order values" comparison={periodOrders.length && comparisonOrders.length ? comparisonTextFor(periodAverageOrderValue, comparisonAverageOrderValue) : undefined} icon={Calculator} color={palette.navy} />
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <PipelinePanel data={stagePipeline} />
              <Panel title="New Orders Trend" description="Orders submitted in the six-month window ending this period.">
                <OrdersTrendChart data={monthlySummary} />
              </Panel>
            </div>
            <OrdersTable
              title="Orders in Reporting Period"
              rows={periodOrders}
              empty={periodAvailable ? `No orders were submitted in ${periodDisplay(reportMonth)}.` : `No historical data is available for ${periodDisplay(reportMonth)}.`}
            />
          </>
        )}

        {view === "production" && (
          <>
            <SectionHeading title="Production Monitoring" description="Stage progress, completed JOs, and schedule risks." />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Jobs in progress" value={activeProduction.length} detail="Current status · live" icon={Factory} color={palette.navy} />
              <MetricCard label="Completed JOs" value={productionComplete} detail={`Current status · ${jobOrders.length} total job orders`} icon={CheckCircle2} color={palette.green} />
              <MetricCard label="Delayed JOs" value={delayedOrders.length} detail="Current status · past due and not delivered" icon={Clock3} color={delayedOrders.length ? palette.red : palette.green} />
              <MetricCard label="Average stage progress" value={formatPercent(activeProduction.length ? activeProduction.reduce((sum, order) => sum + Math.min(PRODUCTION_STAGES.length, order.currentStage ?? 0), 0) / activeProduction.length / PRODUCTION_STAGES.length * 100 : null)} detail="Current active jobs only" icon={TrendingUp} color={palette.blue} />
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <Panel title="Active Jobs by Stage" description="Current production stage from the existing JO records.">
                <StageChart data={currentStageCounts} />
              </Panel>
              <OrdersTable
                title="Production Schedule Risks"
                rows={delayedOrders}
                empty="No job orders are currently past their due date."
              />
            </div>
          </>
        )}

        {view === "inventory" && (
          <>
            <SectionHeading title="Inventory Health" description="Stock condition and inventory value · monitoring only." />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Tracked items" value={inventoryRows.length} detail="Across all material categories" icon={Boxes} color={palette.navy} />
              <MetricCard label="Low stock" value={lowInventory.length} detail="At or below threshold" icon={AlertTriangle} color={palette.amber} />
              <MetricCard label="Critical stock" value={criticalInventory.length} detail="At or below half threshold" icon={AlertTriangle} color={criticalInventory.length ? palette.red : palette.green} />
              <MetricCard label="Inventory capital" value={compactMoney(inventoryCapital)} detail="Stock quantity × unit cost" icon={DollarSign} color={palette.blue} />
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <Panel title="Stock Condition by Category" description="Counts reflect current material thresholds.">
                <InventoryCategoryChart data={categoryHealth} />
              </Panel>
              <Panel title="Stock Requiring Attention" description="Critical and low-stock materials.">
                <InventoryTable rows={[...criticalInventory, ...lowInventory].slice(0, 12)} />
              </Panel>
            </div>
          </>
        )}

        {view === "logistics" && (
          <>
            <SectionHeading title="Logistics Performance" description={`Dispatch readiness, delivery progress, and on-time performance · ${periodDisplay(reportMonth)}.`} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Ready for dispatch" value={readyForDispatch} detail="Current status · live" icon={Package} color={palette.amber} />
              <MetricCard label="In transit" value={inTransit} detail="Current status · live" icon={Truck} color={palette.blue} />
              <MetricCard label="Delivered this period" value={periodAvailable ? deliveredOrders.length : "—"} detail={`${deliveriesWithDates} deliveries with due and delivery dates`} comparison={comparisonTextFor(deliveredOrders.length, comparisonDeliveredOrders.length, "count")} icon={CheckCircle2} color={palette.green} />
              <MetricCard label="On-time delivery" value={formatPercent(onTimeRate)} detail={`${deliveriesWithDates} deliveries · ${periodDisplay(reportMonth)}`} comparison={onTimeRate !== null && comparisonOnTimeRate !== null ? comparisonTextFor(onTimeRate, comparisonOnTimeRate, "percent") : undefined} icon={Clock3} color={palette.navy} />
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <Panel title="Delivery Status" description="Current distribution across Job Order delivery stages.">
                <DeliveryStatusSummary ready={readyForDispatch} transit={inTransit} delivered={allDeliveredOrders.length} />
              </Panel>
              <Panel title="Delivery Method Mix" description={`Recorded delivery methods · ${periodDisplay(reportMonth)}.`}>
                <DeliveryMethodChart rows={deliveryMix} />
              </Panel>
            </div>
            <OrdersTable
              title="Delivery Records"
              rows={jobOrders.filter((order) => deliveryStages.has(order.stage) && inPeriodThrough(order.deliveredDate ?? order.dispatchedAt, reportMonth, periodEnd))}
              empty={periodAvailable ? `No delivery records are available for ${periodDisplay(reportMonth)}.` : `No historical data is available for ${periodDisplay(reportMonth)}.`}
              delivery
            />
          </>
        )}

        {view === "payments" && (
          <>
            <SectionHeading title="Payments & Collections" description={`Verified collections, open balances, and receivables at ${periodDisplay(reportMonth)} month-end.`} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Collected this period" value={periodAvailable ? compactMoney(periodCollections) : "—"} detail={`Verified receipts · ${periodDisplay(reportMonth)}`} comparison={comparisonTextFor(periodCollections, comparisonCollections)} icon={Calculator} color={palette.green} />
              <MetricCard label="Outstanding" value={compactMoney(outstandingReceivables)} detail={`Balance at ${periodDisplay(reportMonth)} month-end`} comparison={comparisonTextFor(outstandingReceivables, comparisonOutstandingReceivables)} icon={DollarSign} color={palette.amber} />
              <MetricCard label="Overdue" value={compactMoney(overdueReceivables)} detail={`Past due at ${periodDisplay(reportMonth)} month-end`} comparison={comparisonTextFor(overdueReceivables, comparisonOverdueReceivables)} icon={Clock3} color={overdueReceivables ? palette.red : palette.green} />
              <MetricCard label="Collection rate" value={formatPercent(collectionRate)} detail={hasFinancialData ? "Period collections ÷ period invoiced revenue" : "No invoice or payment records for this period"} comparison={collectionRate !== null && comparisonCollectionRate !== null ? comparisonTextFor(collectionRate, comparisonCollectionRate, "percent") : undefined} icon={TrendingUp} color={palette.blue} />
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <Panel title="Revenue vs Collections" description="Monthly invoices and verified payment receipts.">
                <RevenueChart data={monthlySummary} comparePreviousYear={comparisonEnabled} />
              </Panel>
              <Panel title="Receivables Aging" description={`Outstanding balances grouped by days past due as of ${periodDisplay(reportMonth)} month-end.`}>
                <ReceivablesAgingChart data={receivablesAging} />
              </Panel>
              <Panel title="Payment Composition" description={`Verified payment methods · ${periodDisplay(reportMonth)}`}>
                <PaymentMixChart rows={paymentMix} />
              </Panel>
              <ReceivablesTable rows={receivables} asOf={periodEnd} />
            </div>
          </>
        )}

        {view === "reports" && (
          <>
            <SectionHeading
              title="Executive Reports"
              description={`Download store-backed CSV reports for ${periodDisplay(reportMonth)}.`}
              action={(
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 font-dm text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <Printer size={14} /> Print / Save PDF
                </button>
              )}
            />
            <ReportsPanel onExport={exportReport} />
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 font-dm" style={{ fontSize: 12, color: "#1E40AF" }}>
              Reports use dated Enter-Flow order, production, logistics, inventory, and payment records. Operational and inventory indicators reflect current system status where historical snapshots are not available.
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function SectionHeading({
  eyebrow, title, description, action, id,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <div className="mb-1 font-dm" style={{ fontSize: 10, fontWeight: 800, color: palette.red, letterSpacing: 0.65 }}>{eyebrow}</div>}
        <h2 id={id} className="font-syne" style={{ fontSize: 18, fontWeight: 700, color: palette.text }}>{title}</h2>
        <p className="font-dm mt-1" style={{ fontSize: 12, color: palette.muted }}>{description}</p>
      </div>
      {action}
    </div>
  );
}

function HealthBadge({ label, color, background }: { label: string; color: string; background: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-dm" style={{ backgroundColor: background, color, fontSize: 11, fontWeight: 700 }}>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function MetricCard({
  label, value, detail, comparison, icon: Icon, color,
}: {
  label: string;
  value: string | number;
  detail: string;
  comparison?: string;
  icon: LucideIcon;
  color: string;
}) {
  return (
    <article className="min-w-0 rounded-xl border border-slate-200/80 bg-white p-3.5 sm:p-4" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.035)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="font-dm" style={{ fontSize: 10, fontWeight: 800, color: palette.muted, letterSpacing: 0.55, textTransform: "uppercase" }}>{label}</div>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ color, backgroundColor: `${color}12` }}>
          <Icon size={15} aria-hidden="true" />
        </span>
      </div>
      <div className="font-syne mt-2 truncate" title={String(value)} style={{ fontSize: typeof value === "string" && value.length > 16 ? 20 : 28, fontWeight: 700, color: palette.text, lineHeight: 1.15 }}>
        {value}
      </div>
      <div className="font-dm mt-1 truncate" style={{ fontSize: 11, color: palette.muted }}>{detail}</div>
      {comparison && <div className="font-dm mt-1 truncate" style={{ fontSize: 10, fontWeight: 600, color: palette.navy }}>{comparison}</div>}
    </article>
  );
}

function Panel({
  title, description, children, className = "",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-xl border border-slate-200/80 bg-white p-4 ${className}`} style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.035)" }}>
      <div className="mb-3">
        <h3 className="font-syne" style={{ fontSize: 16, fontWeight: 700, color: palette.text }}>{title}</h3>
        {description && <p className="font-dm mt-1" style={{ fontSize: 12, color: palette.muted }}>{description}</p>}
      </div>
      {children}
    </section>
  );
}

function SnapshotRow({ label, value, icon: Icon, alert = false }: { label: string; value: string; icon: LucideIcon; alert?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon size={14} className="shrink-0" style={{ color: alert ? palette.red : palette.muted }} aria-hidden="true" />
        <span className="truncate font-dm" style={{ fontSize: 12, color: palette.muted }}>{label}</span>
      </div>
      <span className="font-syne shrink-0" style={{ fontSize: 14, fontWeight: 800, color: alert ? palette.red : palette.text }}>{value}</span>
    </div>
  );
}

function EmptyState({ children }: { children: string }) {
  return <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>{children}</div>;
}

function RevenueChart({ data, comparePreviousYear = false }: { data: MonthSummary[]; comparePreviousYear?: boolean }) {
  const showPreviousYearSeries = comparePreviousYear && data.some(
    (month) => month.previousYearInvoiced !== null || month.previousYearCollected !== null,
  );
  if (!data.length || data.every((month) => (
    !month.invoiced && !month.collected
    && (!showPreviousYearSeries || (!month.previousYearInvoiced && !month.previousYearCollected))
  ))) return <EmptyState>No invoice or verified collection data for this period.</EmptyState>;
  return (
    <div className="h-[250px] w-full" role="img" aria-label="Monthly invoiced revenue and verified collections">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="executiveRevenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={palette.red} stopOpacity={0.18} />
              <stop offset="100%" stopColor={palette.red} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: palette.muted }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: palette.muted }} axisLine={false} tickLine={false} tickFormatter={(value: number) => compactMoney(value)} width={56} />
          <Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={{ borderRadius: 8, borderColor: palette.border, fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
          <Area type="monotone" dataKey="invoiced" name="Invoiced" stroke={palette.red} fill="url(#executiveRevenueFill)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          <Area type="monotone" dataKey="collected" name="Collected" stroke={palette.navy} fill="transparent" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          {showPreviousYearSeries && (
            <>
              <Area type="monotone" dataKey="previousYearInvoiced" name="Invoiced · Previous Year" stroke="#FCA5A5" fill="transparent" strokeWidth={1.5} strokeDasharray="5 4" connectNulls={false} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Area type="monotone" dataKey="previousYearCollected" name="Collected · Previous Year" stroke="#94A3B8" fill="transparent" strokeWidth={1.5} strokeDasharray="5 4" connectNulls={false} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </>
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function OrdersTrendChart({ data }: { data: MonthSummary[] }) {
  if (!data.length || data.every((month) => month.orders === 0)) return <EmptyState>No order submissions in this reporting window.</EmptyState>;
  return (
    <div className="h-[250px] w-full" role="img" aria-label="Orders submitted by month">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: palette.muted }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: palette.muted }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ borderRadius: 8, borderColor: palette.border, fontSize: 11 }} />
          <Bar dataKey="orders" name="Orders" fill={palette.red} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PipelinePanel({ data }: { data: { stage: Stage; name: string; orders: number }[] }) {
  const max = Math.max(1, ...data.map((row) => row.orders));
  return (
    <Panel title="Sales & Order Pipeline" description="Live order count by current workflow status.">
      {!data.length ? <EmptyState>No active order pipeline data.</EmptyState> : (
        <div className="space-y-3">
          {data.map((row) => (
            <div key={row.stage} className="grid grid-cols-[minmax(96px,1.2fr)_minmax(80px,3fr)_28px] items-center gap-3">
              <span className="truncate font-dm" style={{ fontSize: 11, color: palette.muted }}>{row.name}</span>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full" style={{ width: `${(row.orders / max) * 100}%`, minWidth: 5, backgroundColor: chartColors[["inquiry", "quotation", "po", "jo", "in_production", "quality_inspection", "ready_for_dispatch", "dispatched", "delivered", "overdue", "paid"].indexOf(row.stage) % chartColors.length] }} />
              </div>
              <span className="text-right font-syne" style={{ fontSize: 12, fontWeight: 800, color: palette.text }}>{row.orders}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function ClientRevenueList({ rows, emptyMessage = "No invoiced revenue in this reporting period." }: {
  rows: { client: string; revenue: number; invoices: number }[];
  emptyMessage?: string;
}) {
  if (!rows.length) return <EmptyState>{emptyMessage}</EmptyState>;
  const max = Math.max(...rows.map((row) => row.revenue), 1);
  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={row.client}>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-syne text-white" style={{ backgroundColor: index < 3 ? palette.navy : "#94A3B8", fontSize: 10, fontWeight: 800 }}>{index + 1}</span>
              <div className="min-w-0">
                <div className="truncate font-dm" style={{ fontSize: 12, fontWeight: 700, color: palette.text }}>{row.client}</div>
                <div className="font-dm" style={{ fontSize: 10, color: palette.muted }}>{row.invoices} invoice{row.invoices === 1 ? "" : "s"}</div>
              </div>
            </div>
            <span className="shrink-0 font-syne" style={{ fontSize: 12, fontWeight: 800, color: palette.text }}>{compactMoney(row.revenue)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${(row.revenue / max) * 100}%`, backgroundColor: chartColors[index % chartColors.length] }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductionSummary({
  activeCount, completedCount, delayedCount, averageProgress,
}: {
  activeCount: number;
  completedCount: number;
  delayedCount: number;
  averageProgress: number | null;
}) {
  return (
    <div>
      <SnapshotRow label="Jobs in progress" value={String(activeCount)} icon={Factory} />
      <SnapshotRow label="Completed JOs" value={String(completedCount)} icon={CheckCircle2} />
      <SnapshotRow label="Delayed JOs" value={String(delayedCount)} icon={Clock3} alert={delayedCount > 0} />
      <SnapshotRow label="Average stage progress" value={formatPercent(averageProgress)} icon={TrendingUp} />
      <p className="mt-2 border-t border-slate-100 pt-3 font-dm" style={{ fontSize: 10, color: palette.muted }}>Capacity utilization is not tracked in the current production data.</p>
    </div>
  );
}

function InventorySummary({ total, low, critical, capital }: { total: number; low: number; critical: number; capital: number }) {
  return (
    <div>
      <SnapshotRow label="Tracked materials" value={String(total)} icon={Boxes} />
      <SnapshotRow label="Low stock" value={String(low)} icon={AlertTriangle} alert={low > 0} />
      <SnapshotRow label="Critical stock" value={String(critical)} icon={AlertTriangle} alert={critical > 0} />
      <SnapshotRow label="Stock value" value={compactMoney(capital)} icon={DollarSign} />
      <p className="mt-2 border-t border-slate-100 pt-3 font-dm" style={{ fontSize: 10, color: palette.muted }}>Finished goods are not tracked in the current Materials store.</p>
    </div>
  );
}

function LogisticsSummary({ ready, transit, delivered, onTime }: { ready: number; transit: number; delivered: number; onTime: number | null }) {
  return (
    <div>
      <SnapshotRow label="Ready for dispatch" value={String(ready)} icon={Package} />
      <SnapshotRow label="In transit" value={String(transit)} icon={Truck} />
      <SnapshotRow label="Delivered" value={String(delivered)} icon={CheckCircle2} />
      <SnapshotRow label="On-time delivery" value={formatPercent(onTime)} icon={Clock3} />
    </div>
  );
}

function PaymentsSummary({ collected, outstanding, overdue, rate }: { collected: number; outstanding: number; overdue: number; rate: number | null }) {
  return (
    <div>
      <SnapshotRow label="Verified collections · period" value={compactMoney(collected)} icon={Calculator} />
      <SnapshotRow label="Outstanding receivables" value={compactMoney(outstanding)} icon={DollarSign} />
      <SnapshotRow label="Overdue receivables" value={compactMoney(overdue)} icon={Clock3} alert={overdue > 0} />
      <SnapshotRow label="Collection rate" value={formatPercent(rate)} icon={TrendingUp} />
    </div>
  );
}

function AlertsPanel({ alerts }: { alerts: { severity: "critical" | "warning" | "info"; title: string; detail: string }[] }) {
  const styles = {
    critical: { foreground: "#B91C1C", background: "#FEF2F2", label: "Critical" },
    warning: { foreground: "#B45309", background: "#FFFBEB", label: "Watch" },
    info: { foreground: "#1D4ED8", background: "#EFF6FF", label: "Info" },
  };
  return (
    <Panel title="Business Risks & Alerts" description="Priority items derived from current operating data.">
      {!alerts.length ? <EmptyState>No priority alerts from current data.</EmptyState> : (
        <div className="space-y-2.5">
          {alerts.slice(0, 5).map((alert, index) => {
            const style = styles[alert.severity];
            return (
              <div key={`${alert.severity}-${index}`} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 p-3" style={{ backgroundColor: "#FAFBFC" }}>
                <div className="flex min-w-0 items-start gap-2.5">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" style={{ color: style.foreground }} />
                  <div className="min-w-0">
                    <div className="font-dm" style={{ fontSize: 12, fontWeight: 700, color: palette.text }}>{alert.title}</div>
                    <div className="mt-1 font-dm" style={{ fontSize: 10, color: palette.muted }}>{alert.detail}</div>
                  </div>
                </div>
                <span className="shrink-0 rounded-full px-2 py-1 font-dm" style={{ fontSize: 9, fontWeight: 800, color: style.foreground, backgroundColor: style.background }}>{style.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function StageChart({ data }: { data: { name: string; jobs: number }[] }) {
  if (!data.some((stage) => stage.jobs > 0)) return <EmptyState>No active jobs are assigned to production stages.</EmptyState>;
  return (
    <div className="h-[300px] w-full" role="img" aria-label="Active job count by production stage">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 9, fill: palette.muted }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={158} tick={{ fontSize: 9, fill: palette.muted }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ borderRadius: 8, borderColor: palette.border, fontSize: 11 }} />
          <Bar dataKey="jobs" name="Active JOs" fill={palette.navy} radius={[0, 4, 4, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function InventoryCategoryChart({ data }: { data: { name: string; items: number; low: number; critical: number }[] }) {
  if (!data.length) return <EmptyState>No materials are currently tracked.</EmptyState>;
  return (
    <div className="h-[300px] w-full" role="img" aria-label="Inventory stock condition by material category">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 12, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 9, fill: palette.muted }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={112} tick={{ fontSize: 9, fill: palette.muted }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ borderRadius: 8, borderColor: palette.border, fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Bar dataKey="items" name="Tracked" fill="#CBD5E1" radius={[0, 3, 3, 0]} maxBarSize={15} />
          <Bar dataKey="low" name="Low" fill="#D97706" radius={[0, 3, 3, 0]} maxBarSize={15} />
          <Bar dataKey="critical" name="Critical" fill={palette.red} radius={[0, 3, 3, 0]} maxBarSize={15} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  if (!rows.length) return <EmptyState>No low or critical inventory items.</EmptyState>;
  return (
    <div className="max-h-[300px] overflow-auto">
      <table className="w-full min-w-[440px] border-collapse text-left">
        <thead className="sticky top-0 bg-slate-50">
          <tr>
            {["Material", "Category", "Stock", "Threshold", "Status"].map((heading) => (
              <th key={heading} className="px-2 py-2 font-dm" style={{ fontSize: 9, fontWeight: 800, color: palette.muted, letterSpacing: 0.4, textTransform: "uppercase" }}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ material, status }) => {
            const color = status === "critical" ? "#B91C1C" : "#B45309";
            return (
              <tr key={material.id} className="border-t border-slate-100">
                <td className="max-w-[140px] truncate px-2 py-2.5 font-dm" style={{ fontSize: 10, fontWeight: 600, color: palette.text }}>{material.name}</td>
                <td className="px-2 py-2.5 font-dm" style={{ fontSize: 10, color: palette.muted }}>{partCategoryMeta[material.category].label}</td>
                <td className="px-2 py-2.5 font-syne" style={{ fontSize: 11, fontWeight: 700, color }}>{material.qtyInStock} {material.unit}</td>
                <td className="px-2 py-2.5 font-dm" style={{ fontSize: 10, color: palette.muted }}>{material.threshold}</td>
                <td className="px-2 py-2.5"><span className="rounded-full px-2 py-1 font-dm" style={{ fontSize: 9, fontWeight: 800, color, backgroundColor: status === "critical" ? "#FEF2F2" : "#FFFBEB" }}>{status}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DeliveryStatusSummary({ ready, transit, delivered }: { ready: number; transit: number; delivered: number }) {
  const rows = [
    { name: "Ready for dispatch", count: ready, color: "#D97706" },
    { name: "In transit", count: transit, color: palette.blue },
    { name: "Delivered", count: delivered, color: palette.green },
  ];
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className="space-y-4 py-1">
      {rows.map((row) => (
        <div key={row.name}>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="font-dm" style={{ fontSize: 11, color: palette.muted }}>{row.name}</span>
            <span className="font-syne" style={{ fontSize: 12, fontWeight: 800, color: palette.text }}>{row.count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${(row.count / max) * 100}%`, minWidth: row.count ? 5 : 0, backgroundColor: row.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DeliveryMethodChart({ rows }: { rows: { method: string; count: number }[] }) {
  if (!rows.length) return <EmptyState>No delivery method data available.</EmptyState>;
  const chartData = rows.map((row, index) => ({ ...row, fill: chartColors[index % chartColors.length] }));
  return (
    <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-2">
      <div className="h-[220px] min-w-0" role="img" aria-label="Delivery count by delivery method">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey="count" nameKey="method" innerRadius={48} outerRadius={78} paddingAngle={2}>
              {chartData.map((row) => <Cell key={row.method} fill={row.fill} />)}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 8, borderColor: palette.border, fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2">
        {chartData.map((row) => (
          <div key={row.method} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2 font-dm" style={{ fontSize: 10, color: palette.muted }}>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.fill }} />
              <span className="truncate">{row.method}</span>
            </span>
            <span className="font-syne" style={{ fontSize: 11, fontWeight: 800, color: palette.text }}>{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReceivablesAgingChart({ data }: { data: { name: string; amount: number }[] }) {
  if (!data.some((bucket) => bucket.amount > 0)) return <EmptyState>No outstanding invoice balances to age.</EmptyState>;
  return (
    <div className="h-[250px] w-full" role="img" aria-label="Outstanding receivables by age">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: palette.muted }} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={{ fontSize: 9, fill: palette.muted }} axisLine={false} tickLine={false} tickFormatter={(value: number) => compactMoney(value)} width={52} />
          <Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={{ borderRadius: 8, borderColor: palette.border, fontSize: 11 }} />
          <Bar dataKey="amount" name="Balance" fill={palette.amber} radius={[4, 4, 0, 0]} maxBarSize={34}>
            {data.map((row) => <Cell key={row.name} fill={row.name === "Not yet due" ? palette.blue : palette.amber} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PaymentMixChart({ rows }: { rows: { method: string; amount: number }[] }) {
  if (!rows.length) return <EmptyState>No verified payment records in this reporting period.</EmptyState>;
  const chartData = rows.map((row, index) => ({ ...row, fill: chartColors[index % chartColors.length] }));
  return (
    <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-2">
      <div className="h-[230px] min-w-0" role="img" aria-label="Verified collections by payment method">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey="amount" nameKey="method" innerRadius={48} outerRadius={78} paddingAngle={2}>
              {chartData.map((row) => <Cell key={row.method} fill={row.fill} />)}
            </Pie>
            <Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={{ borderRadius: 8, borderColor: palette.border, fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2">
        {chartData.map((row) => (
          <div key={row.method} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2 font-dm" style={{ fontSize: 10, color: palette.muted }}>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.fill }} />
              <span className="truncate">{row.method}</span>
            </span>
            <span className="shrink-0 font-syne" style={{ fontSize: 10, fontWeight: 800, color: palette.text }}>{compactMoney(row.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrdersTable({
  title, rows, empty, delivery = false,
}: {
  title: string;
  rows: Inquiry[];
  empty: string;
  delivery?: boolean;
}) {
  return (
    <Panel title={title} description={delivery ? "Read-only logistics monitoring." : "Read-only executive view of Job Orders."}>
      {!rows.length ? <EmptyState>{empty}</EmptyState> : (
        <div className="max-h-[360px] overflow-auto">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                {(delivery ? ["JO", "Client", "Method", "Status", "Delivery date"] : ["JO", "Client", "Product", "Status", "Due date"]).map((heading) => (
                  <th key={heading} className="px-2.5 py-2 font-dm" style={{ fontSize: 9, fontWeight: 800, color: palette.muted, letterSpacing: 0.4, textTransform: "uppercase" }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((inquiry) => (
                <tr key={inquiry.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-2.5 py-2.5 font-mono" style={{ fontSize: 10, fontWeight: 700, color: palette.navy }}>{inquiry.joNumber ?? "—"}</td>
                  <td className="max-w-[140px] truncate px-2.5 py-2.5 font-dm" style={{ fontSize: 10, color: palette.text }}>{inquiry.clientName}</td>
                  {delivery ? (
                    <>
                      <td className="px-2.5 py-2.5 font-dm" style={{ fontSize: 10, color: palette.muted }}>{inquiry.deliveryMethod ?? "Not specified"}</td>
                      <td className="px-2.5 py-2.5 font-dm" style={{ fontSize: 10, color: palette.text }}>{stageLabel[inquiry.stage]}</td>
                      <td className="whitespace-nowrap px-2.5 py-2.5 font-dm" style={{ fontSize: 10, color: palette.muted }}>{inquiry.deliveredDate ?? inquiry.dispatchedAt ?? "—"}</td>
                    </>
                  ) : (
                    <>
                      <td className="max-w-[170px] truncate px-2.5 py-2.5 font-dm" style={{ fontSize: 10, color: palette.text }}>{inquiry.products.map((product) => product.filterName ?? product.type).join(", ") || "—"}</td>
                      <td className="px-2.5 py-2.5 font-dm" style={{ fontSize: 10, color: palette.text }}>{stageLabel[inquiry.stage]}</td>
                      <td className="whitespace-nowrap px-2.5 py-2.5 font-dm" style={{ fontSize: 10, color: palette.muted }}>{inquiry.dueDate ?? "—"}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function ReceivablesTable({ rows, asOf }: {
  rows: { inquiry: Inquiry; balance: number; dueDate: Date | null }[];
  asOf: Date;
}) {
  return (
    <Panel title="Outstanding Invoices" description={`Remaining balances as of ${asOf.toLocaleDateString("en-US", { month: "long", year: "numeric" })} month-end.`}>
      {!rows.length ? <EmptyState>No outstanding invoice balances as of this period.</EmptyState> : (
        <div className="max-h-[280px] overflow-auto">
          <table className="w-full min-w-[470px] border-collapse text-left">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                {["Client", "Invoice", "Due date", "Balance"].map((heading) => (
                  <th key={heading} className="px-2 py-2 font-dm" style={{ fontSize: 9, fontWeight: 800, color: palette.muted, letterSpacing: 0.4, textTransform: "uppercase" }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...rows].sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0)).map(({ inquiry, balance, dueDate }) => {
                const isOverdue = Boolean(dueDate && dueDate <= asOf);
                return (
                  <tr key={inquiry.id} className="border-t border-slate-100">
                    <td className="max-w-[130px] truncate px-2 py-2.5 font-dm" style={{ fontSize: 10, color: palette.text }}>{inquiry.clientName}</td>
                    <td className="whitespace-nowrap px-2 py-2.5 font-mono" style={{ fontSize: 10, color: palette.muted }}>{inquiry.invoiceNo}</td>
                    <td className="whitespace-nowrap px-2 py-2.5 font-dm" style={{ fontSize: 10, color: isOverdue ? palette.red : palette.muted }}>{inquiry.invoiceDueDate ?? "—"}</td>
                    <td className="whitespace-nowrap px-2 py-2.5 font-syne" style={{ fontSize: 10, fontWeight: 800, color: isOverdue ? palette.red : palette.text }}>{formatMoney(balance)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function ReportsPanel({ onExport }: { onExport: (report: ReportKey) => void }) {
  return (
    <Panel title="Executive Reports" description="Export selected-period reports using dated application records.">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {reportOptions.map((report) => (
          <article key={report.id} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-3.5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-700">
                <FileText size={15} />
              </span>
              <div className="min-w-0">
                <h4 className="font-dm" style={{ fontSize: 12, fontWeight: 700, color: palette.text }}>{report.title}</h4>
                <p className="mt-1 font-dm" style={{ fontSize: 10, color: palette.muted }}>{report.description}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onExport(report.id)}
              aria-label={`Download ${report.title} CSV`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Download size={14} />
            </button>
          </article>
        ))}
      </div>
    </Panel>
  );
}
