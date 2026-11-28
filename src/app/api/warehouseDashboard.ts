import { api } from "./client";

export interface WarehouseDashboardResponse {
  trackedRawMaterialItems: number;

  finishedGoods: {
    recordedItems: number;
    totalQuantity: string | null;
    verifiedQuantity: string;
    unverifiedItems: number;
    complete: boolean;
  };

  lowStock: {
    confirmedItems: number;
    unverifiedItems: number;
    complete: boolean;
  };

  lowStockAlerts: {
    id: string;
    name: string;
    current: string;
    minimum: string | null;
    unit: string;
    status: "low-stock" | "out-of-stock";
  }[];

  topClientsByOrders: {
    clientId: string;
    client: string;
    totalOrders: number;
  }[];

  readyForDispatch: {
    total: string;
    items: {
      id: string;
      joNumber: string;
      client: string | null;
      product: string | null;
      totalQuantity: string | null;
      completedAt: string | null;
      status: string;
    }[];
  };

  recentActivity: {
    id: string;
    date: string;
    title: string;
    subject: string;
    description?: string | null;
    oldQty?: string | null;
    newQty?: string | null;
    reason?: string | null;
    unit?: string | null;
    actorId: string | null;
  }[];

  recentActivityComplete?: boolean;
}

function isCount(value: unknown): value is number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0;
}

function isQuantity(value: unknown): value is string {
  return typeof value === "string" &&
    /^\d+(?:\.\d+)?$/.test(value);
}

function nullableQuantity(value: unknown) {
  return value === null || isQuantity(value);
}

function nullableText(value: unknown) {
  return value === null || typeof value === "string";
}

export function warehouseQuantity(value: string | null | undefined) {
  if (!isQuantity(value)) return "Not recorded";

  const [whole, fraction = ""] = value.split(".");
  const digits = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimal = fraction.replace(/0+$/, "");

  return digits + (decimal ? `.${decimal}` : "");
}

export async function getWarehouseDashboard(signal?: AbortSignal) {
  const result = await api<WarehouseDashboardResponse>(
    "/api/warehouse/dashboard",
    { signal }
  );

  const f = result?.finishedGoods;
  const l = result?.lowStock;
  const d = result?.readyForDispatch;

  if (
    !result ||
    !isCount(result.trackedRawMaterialItems) ||
    !f ||
    !isCount(f.recordedItems) ||
    !isCount(f.unverifiedItems) ||
    !nullableQuantity(f.totalQuantity) ||
    !isQuantity(f.verifiedQuantity) ||
    typeof f.complete !== "boolean" ||
    f.complete !== (f.unverifiedItems === 0) ||
    (f.complete ? f.totalQuantity === null : f.totalQuantity !== null) ||
    !l ||
    !isCount(l.confirmedItems) ||
    !isCount(l.unverifiedItems) ||
    typeof l.complete !== "boolean" ||
    l.complete !== (l.unverifiedItems === 0) ||
    !Array.isArray(result.lowStockAlerts) ||
    result.lowStockAlerts.length !== l.confirmedItems ||
    !result.lowStockAlerts.every(row =>
      row &&
      typeof row.id === "string" &&
      typeof row.name === "string" &&
      typeof row.unit === "string" &&
      isQuantity(row.current) &&
      nullableQuantity(row.minimum) &&
      ["low-stock", "out-of-stock"].includes(row.status)
    ) ||
    !Array.isArray(result.topClientsByOrders) ||
    result.topClientsByOrders.length > 3 ||
    !result.topClientsByOrders.every(row =>
      row &&
      typeof row.clientId === "string" &&
      typeof row.client === "string" &&
      isCount(row.totalOrders) &&
      row.totalOrders > 0
    ) ||
    !d ||
    typeof d.total !== "string" ||
    !/^\d+$/.test(d.total) ||
    !Array.isArray(d.items) ||
    d.items.length !== Math.min(Number(d.total), 6) ||
    !d.items.every(row =>
      row &&
      typeof row.id === "string" &&
      typeof row.joNumber === "string" &&
      nullableText(row.client) &&
      nullableText(row.product) &&
      nullableQuantity(row.totalQuantity) &&
      row.status === "ready_for_dispatch"
    ) ||
    !Array.isArray(result.recentActivity) ||
    result.recentActivity.length > 6 ||
    !result.recentActivity.every(row =>
      row &&
      typeof row.id === "string" &&
      typeof row.date === "string" &&
      Number.isFinite(Date.parse(row.date)) &&
      typeof row.title === "string" &&
      typeof row.subject === "string"
    )
  ) {
    throw new Error("Invalid Warehouse Dashboard response.");
  }

  return result;
}