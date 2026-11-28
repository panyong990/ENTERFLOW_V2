import type { StockRequestMaterial, StockRequestStatus, StockResponseMaterial } from "../store/stockRequests";
import type { StockRequestPresentation } from "./StockRequestsModal";

export type ApiRequestLine = {
  id: string;
  materialId: string;
  materialName: string;
  unit?: string | null;
  requiredQuantity: string | number;
  stockAtRequest: string | number | null;
  shortageAtRequest: string | number | null;
  latestResponse?: {
    currentQuantity: string | number;
    shortageQuantity: string | number;
    respondedAt: string;
  } | null;
};

export type ApiRequest = {
  id: string;
  reference: string;
  orderId: string;
  orderReference?: string | null;
  clientReference?: string | null;
  clientName?: string | null;
  requestedBy?: string;
  createdAt?: string;
  status: string;
  lines: ApiRequestLine[];
};

const requestStatuses = new Set<StockRequestStatus>(["pending", "responded", "update_requested", "updated"]);

function optionalQuantity(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function mapStockRequestRecord(row: ApiRequest, materialUnits: Map<string, string>): StockRequestPresentation {
  if (!requestStatuses.has(row.status as StockRequestStatus)) {
    throw new Error("Stock Requests returned an unsupported status.");
  }

  const requestedMaterials: StockRequestMaterial[] = row.lines.map((line) => ({
    materialId: line.materialId,
    materialName: line.materialName,
    unit: line.unit ?? materialUnits.get(line.materialId) ?? "Not recorded",
    requiredQuantity: Number(line.requiredQuantity),
    ...(optionalQuantity(line.stockAtRequest) !== undefined ? { stockAtRequest: optionalQuantity(line.stockAtRequest) } : {}),
    ...(optionalQuantity(line.shortageAtRequest) !== undefined ? { shortageAtRequest: optionalQuantity(line.shortageAtRequest) } : {}),
  }));
  const completeResponse = row.lines.length > 0 && row.lines.every((line) =>
    line.latestResponse
    && optionalQuantity(line.latestResponse.currentQuantity) !== undefined
    && optionalQuantity(line.latestResponse.shortageQuantity) !== undefined
  );
  const responseDates = row.lines.map((line) => line.latestResponse?.respondedAt).filter((value): value is string => !!value).sort();
  const latestResponse = completeResponse ? {
    responseAt: responseDates[responseDates.length - 1] ?? "",
    respondedBy: "Not recorded",
    type: row.status === "updated" ? "updated" as const : "initial" as const,
    materials: row.lines.map((line): StockResponseMaterial => {
      const required = requestedMaterials.find((material) => material.materialId === line.materialId)!;
      const currentQuantity = optionalQuantity(line.latestResponse!.currentQuantity)!;
      const shortageQuantity = optionalQuantity(line.latestResponse!.shortageQuantity)!;
      return {
        ...required,
        currentQuantity,
        shortageQuantity,
        status: shortageQuantity > 0 ? "shortage" : "sufficient",
      };
    }),
  } : undefined;

  return {
    requestId: row.id,
    inquiryId: row.orderId,
    inquiryReference: row.orderReference ?? row.orderId,
    clientReference: row.clientReference ?? "Not recorded",
    clientName: row.clientName ?? "Not recorded",
    requestedBy: row.requestedBy ?? "Not recorded",
    createdAt: row.createdAt ?? "",
    status: row.status as StockRequestStatus,
    requestedMaterials,
    responseHistory: [],
    ...(latestResponse ? { latestResponse } : {}),
    reference: row.reference,
    quotationReference: row.clientReference ?? undefined,
    historyUnavailable: true,
    lineIds: Object.fromEntries(row.lines.map((line) => [line.materialId, line.id])),
  };
}
