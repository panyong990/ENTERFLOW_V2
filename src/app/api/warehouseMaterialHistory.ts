import { api } from "./client";

export interface MaterialMovement {
  id: string;
  date: string;
  actorId: string;
  employee: string;
  quantityStatusBefore: "unknown" | "provisional_sample" | "verified";
  oldQty: string | null;
  newQty: string;
  change: string | null;
  unit: string;
  reason: string;
  reference: string | null;
  jobOrder: string | null;
}

export interface MaterialHistoryResponse {
  material: {
    id: string;
    name: string;
  };
  items: MaterialMovement[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

const quantity = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d+(?:\.\d{1,4})?$/.test(value);

const nullableText = (value: unknown) =>
  value === null || typeof value === "string";

export async function getWarehouseMaterialHistory(
  materialId: string,
  page: number,
  signal?: AbortSignal
) {
  if (
    !/^[1-9]\d{0,19}$/.test(materialId) ||
    BigInt(materialId) > 18446744073709551615n ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 10000
  ) {
    throw new Error("Invalid material history request.");
  }

  const result = await api<MaterialHistoryResponse>(
    `/api/warehouse/materials/${encodeURIComponent(materialId)}/history?page=${page}`,
    { signal }
  );

  if (
    !result ||
    result.material?.id !== materialId ||
    typeof result.material.name !== "string" ||
    result.page !== page ||
    result.pageSize !== 50 ||
    typeof result.hasMore !== "boolean" ||
    !Array.isArray(result.items) ||
    result.items.length > 50 ||
    !result.items.every(row =>
      row &&
      typeof row.id === "string" &&
      typeof row.actorId === "string" &&
      typeof row.employee === "string" &&
      typeof row.date === "string" &&
      Number.isFinite(Date.parse(row.date)) &&
      typeof row.unit === "string" &&
      typeof row.reason === "string" &&
      nullableText(row.reference) &&
      nullableText(row.jobOrder) &&
      quantity(row.newQty) &&
      ["unknown", "provisional_sample", "verified"]
        .includes(row.quantityStatusBefore) &&
      (
        row.quantityStatusBefore === "verified"
          ? quantity(row.oldQty) &&
            typeof row.change === "string" &&
            /^-?\d+(?:\.\d{1,4})?$/.test(row.change)
          : row.oldQty === null && row.change === null
      )
    )
  ) {
    throw new Error("Invalid material history response.");
  }

  return result;
}