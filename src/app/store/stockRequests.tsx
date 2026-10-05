import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type StockRequestStatus = "pending" | "responded" | "update_requested" | "updated";
export type StockResponseStatus = "sufficient" | "shortage";

export interface StockRequestMaterial {
  materialId: string;
  materialName: string;
  unit: string;
  requiredQuantity: number;
  stockAtRequest?: number;
  shortageAtRequest?: number;
}

export interface StockResponseMaterial extends StockRequestMaterial {
  currentQuantity: number;
  status: StockResponseStatus;
  shortageQuantity?: number;
}

export interface StockRequestResponse {
  responseAt: string;
  respondedBy: string;
  type: "initial" | "updated";
  materials: StockResponseMaterial[];
}

export interface StockRequest {
  requestId: string;
  inquiryId: string;
  inquiryReference: string;
  clientReference: string;
  clientName: string;
  requestedBy: string;
  createdAt: string;
  status: StockRequestStatus;
  requestedMaterials: StockRequestMaterial[];
  latestResponse?: StockRequestResponse;
  responseAt?: string;
  updateRequestedAt?: string;
  updateReason?: string;
  updatedResponseAt?: string;
  responseHistory: StockRequestResponse[];
}

interface CreateStockRequest {
  inquiryId: string;
  inquiryReference: string;
  clientReference: string;
  clientName: string;
  requestedBy: string;
  requestedMaterials: StockRequestMaterial[];
}

interface StockRequestsContextValue {
  requests: StockRequest[];
  createRequest: (input: CreateStockRequest) => { request: StockRequest; created: boolean };
  respondToRequest: (requestId: string, materials: StockResponseMaterial[], respondedBy: string) => boolean;
  requestStockUpdate: (requestId: string, reason: string, requestedMaterials?: StockRequestMaterial[]) => boolean;
}

const STORAGE_KEY = "enterflow.stockRequests.v1";
const StockRequestsContext = createContext<StockRequestsContextValue | null>(null);

function isStockRequest(value: unknown): value is StockRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as StockRequest;
  return typeof request.requestId === "string"
    && typeof request.inquiryId === "string"
    && typeof request.inquiryReference === "string"
    && typeof request.clientReference === "string"
    && typeof request.clientName === "string"
    && typeof request.requestedBy === "string"
    && typeof request.createdAt === "string"
    && ["pending", "responded", "update_requested", "updated"].includes(request.status)
    && Array.isArray(request.requestedMaterials)
    && Array.isArray(request.responseHistory);
}

function loadRequests(): StockRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || !value.every(isStockRequest)) {
      console.error("[EnterFlow] Stored stock requests have an invalid format.");
      return [];
    }
    return value;
  } catch (error) {
    console.error("[EnterFlow] Could not load stock requests from localStorage.", error);
    return [];
  }
}

export function StockRequestsProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<StockRequest[]>(loadRequests);
  const requestsRef = useRef(requests);

  useEffect(() => {
    requestsRef.current = requests;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
    } catch (error) {
      console.error("[EnterFlow] Could not persist stock requests to localStorage.", error);
    }
  }, [requests]);

  const createRequest: StockRequestsContextValue["createRequest"] = (input) => {
    const existing = requestsRef.current.find((request) => request.inquiryId === input.inquiryId);
    if (existing) return { request: existing, created: false };

    const request: StockRequest = {
      ...input,
      requestId: `SR-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      status: "pending",
      responseHistory: [],
    };
    const next = [request, ...requestsRef.current];
    requestsRef.current = next;
    setRequests(next);
    return { request, created: true };
  };

  const respondToRequest: StockRequestsContextValue["respondToRequest"] = (requestId, materials, respondedBy) => {
    const request = requestsRef.current.find((item) => item.requestId === requestId);
    if (!request || (request.status !== "pending" && request.status !== "responded" && request.status !== "update_requested")) return false;
    const response: StockRequestResponse = {
      responseAt: new Date().toISOString(),
      respondedBy,
      type: request.status === "pending" ? "initial" : "updated",
      materials,
    };
    const allSufficient = materials.length > 0 && materials.every((material) => material.status === "sufficient");
    const next = requestsRef.current.map((item) => item.requestId !== requestId ? item : {
      ...item,
      status: allSufficient ? "updated" : "update_requested",
      latestResponse: response,
      responseAt: response.responseAt,
      updateRequestedAt: allSufficient ? item.updateRequestedAt : response.responseAt,
      updatedResponseAt: allSufficient ? response.responseAt : item.updatedResponseAt,
      responseHistory: [...item.responseHistory, response],
    });
    requestsRef.current = next;
    setRequests(next);
    return true;
  };

  const requestStockUpdate: StockRequestsContextValue["requestStockUpdate"] = (requestId, reason, requestedMaterials) => {
    const request = requestsRef.current.find((item) => item.requestId === requestId);
    if (!request || !request.latestResponse
      || (request.status !== "responded" && request.status !== "updated")
      || (!requestedMaterials && !request.latestResponse.materials.some((material) => material.status === "shortage"))) return false;
    const next = requestsRef.current.map((item) => item.requestId === requestId ? {
      ...item,
      status: "update_requested",
      updateRequestedAt: new Date().toISOString(),
      updateReason: reason.trim() || undefined,
      requestedMaterials: requestedMaterials ?? item.requestedMaterials,
    } : item);
    requestsRef.current = next;
    setRequests(next);
    return true;
  };

  return (
    <StockRequestsContext.Provider value={{ requests, createRequest, respondToRequest, requestStockUpdate }}>
      {children}
    </StockRequestsContext.Provider>
  );
}

export function useStockRequests() {
  const context = useContext(StockRequestsContext);
  if (!context) throw new Error("useStockRequests must be used inside StockRequestsProvider");
  return context;
}
