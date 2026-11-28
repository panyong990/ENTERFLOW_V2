import { api } from "./client";

export type FinishedGoodsSort =
  "orders-desc" | "orders-asc" | "company-asc" | "type-asc";

export type QuantityStatus =
  "unknown" | "provisional_sample" | "verified";

export interface WarehouseFinishedGood {
  id: string;
  itemCode: string;
  enterFilPN: string | null;
  itemName: string;
  client: string;
  clientId: string;
  filterTypeId: string;
  filterTypeLabel: string;
  qtyInStock: number | string | null;
  quantityStatus: QuantityStatus;
  bufferMin: number | string | null;
  thresholdStatus: QuantityStatus;
  demand: string | null;
}

export interface WarehouseFinishedGoodsResponse {
  items: {
    item: WarehouseFinishedGood;
    recurringOrders: number;
    filterTypeLabel: string;
    rank: number;
    highlighted: boolean;
  }[];
  total: number;
  filterOptions: {
    years: string[];
    filterTypes: {
      id: string;
      name: string;
      templateGroup: string;
      isActive: number | boolean;
    }[];
  };
}

export interface FinishedGoodsFilters {
  q: string;
  filterType: string;
  month: string;
  year: string;
  sort: FinishedGoodsSort;
}

function validQuantity(value: unknown) {
  if (value === null) return true;

  return (
    (typeof value === "number" ||
      (typeof value === "string" && /^\d+$/.test(value))) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) >= 0 &&
    Number(value) <= 4294967295
  );
}

export async function listWarehouseFinishedGoods(
  filters: FinishedGoodsFilters,
  signal?: AbortSignal
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value.trim()) params.set(key, value.trim());
  }

  const result = await api<WarehouseFinishedGoodsResponse>(
    `/api/warehouse/finished-goods?${params.toString()}`,
    { signal }
  );

  const statuses = ["unknown", "provisional_sample", "verified"];

  if (
    !result ||
    !Array.isArray(result.items) ||
    result.total !== result.items.length ||
    !Array.isArray(result.filterOptions?.years) ||
    !Array.isArray(result.filterOptions?.filterTypes) ||
    !result.filterOptions.years.every(year =>
      typeof year === "string" && /^[1-9]\d{3}$/.test(year)
    ) ||
    !result.filterOptions.filterTypes.every(type =>
      type &&
      typeof type.id === "string" &&
      /^[1-9]\d*$/.test(type.id) &&
      typeof type.name === "string" &&
      typeof type.templateGroup === "string"
    ) ||
    !result.items.every(row =>
      row?.item &&
      typeof row.item.id === "string" &&
      typeof row.item.itemCode === "string" &&
      typeof row.item.itemName === "string" &&
      typeof row.item.client === "string" &&
      (row.item.enterFilPN === null ||
        typeof row.item.enterFilPN === "string") &&
      validQuantity(row.item.qtyInStock) &&
      validQuantity(row.item.bufferMin) &&
      statuses.includes(row.item.quantityStatus) &&
      statuses.includes(row.item.thresholdStatus) &&
      (row.item.quantityStatus === "unknown"
        ? row.item.qtyInStock === null
        : row.item.qtyInStock !== null) &&
      (row.item.thresholdStatus === "unknown"
        ? row.item.bufferMin === null
        : row.item.bufferMin !== null) &&
      Number.isSafeInteger(row.recurringOrders) &&
      row.recurringOrders >= 0 &&
      Number.isSafeInteger(row.rank) &&
      row.rank > 0 &&
      typeof row.highlighted === "boolean"
    )
  ) {
    throw new Error("Invalid finished goods response.");
  }

  return result;
}

export function warehouseFinishedGoodStatus(
  item: WarehouseFinishedGood
) {
  if (
    item.quantityStatus !== "verified" ||
    item.qtyInStock === null
  ) {
    return {
      label: "Not verified",
      bg: "#F1F5F9",
      fg: "#64748B"
    };
  }

  const quantity = Number(item.qtyInStock);

  if (quantity === 0) {
    return {
      label: "Out of Stock",
      bg: "#FEE2E2",
      fg: "#991B1B"
    };
  }

  if (
    item.thresholdStatus !== "verified" ||
    item.bufferMin === null
  ) {
    return {
      label: "Threshold not verified",
      bg: "#F1F5F9",
      fg: "#64748B"
    };
  }

  return quantity <= Number(item.bufferMin)
    ? { label: "Low Stock", bg: "#FFEDD5", fg: "#C2410C" }
    : { label: "In Stock", bg: "#DCFCE7", fg: "#15803D" };
}