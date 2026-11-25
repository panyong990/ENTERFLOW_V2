import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { autofillBOMForType, useMaterials, type BOMLine, type PartCategory } from "../store/materials";
import { resolveProductBOM, type ProductLine, useOrders } from "../store/orders";
import { GROUP_TEMPLATES, groupForType, PART_TO_CATEGORY } from "../store/filterTemplates";
import { useNotifications } from "../store/notifications";
import { useSession } from "../store/session";
import { useStockRequests, type StockRequest, type StockRequestMaterial, type StockRequestStatus } from "../store/stockRequests";

type Mode = "sales" | "warehouse";

export type StockRequestPresentation = StockRequest & {
  reference?: string;
  quotationReference?: string;
  historyUnavailable?: boolean;
  lineIds?: Record<string, string>;
};

// Data and commands can come from an authenticated adapter while this modal
// remains the single presentation for request lists, reports, and actions.
export interface StockRequestsAdapter {
  requests: StockRequestPresentation[];
  loading?: boolean;
  error?: string;
  saving?: boolean;
  writesUnavailable?: boolean;
  retry?: () => void;
  newRequest?: ReactNode;
  respond?: (request: StockRequestPresentation, quantities: Record<string, string>, updateInventory: boolean) => Promise<void>;
}

const statusLabel: Record<StockRequestStatus, string> = {
  pending: "PENDING WAREHOUSE RESPONSE",
  responded: "RESPONDED",
  update_requested: "STOCK UPDATE REQUESTED",
  updated: "UPDATED",
};

const statusFilters: { id: StockRequestStatus | "all"; label: string }[] = [
  { id: "all", label: "ALL" },
  { id: "pending", label: "PENDING" },
  { id: "responded", label: "RESPONDED" },
  { id: "update_requested", label: "UPDATE REQUESTED" },
  { id: "updated", label: "UPDATED" },
];

const dateTime = (value?: string) => value ? new Date(value).toLocaleString() : "—";
const quantity = (value: number) => Number.isFinite(value) ? value.toLocaleString("en-PH", { maximumFractionDigits: 4 }) : "Not recorded";

function inferSize(product?: ProductLine): "Large" | "Medium" | "Small" | undefined {
  if (!product?.height) return undefined;
  const height = parseFloat(product.height);
  if (!Number.isFinite(height)) return undefined;
  if (height >= 400) return "Large";
  if (height >= 200) return "Medium";
  return "Small";
}

function productBOM(
  inquiry: ReturnType<typeof useOrders>["inquiries"][number],
  productIndex: number,
  rawMaterials: ReturnType<typeof useMaterials>["rawMaterials"],
  findBOMTemplate: ReturnType<typeof useMaterials>["findBOMTemplate"]
): BOMLine[] | undefined {
  const savedBOM = resolveProductBOM(inquiry, productIndex);
  if (savedBOM?.length) return savedBOM;

  const product = inquiry.products[productIndex];
  if (!product) return undefined;
  const size = inferSize(product);
  const template = findBOMTemplate(product.type, size);
  if (template) return template.bom;

  const autoFilled = autofillBOMForType(product.type, size, {
    depthMm: Number.parseFloat(product.depth ?? "") || undefined,
    pockets: Number.parseFloat(product.pocketCount ?? "") || undefined,
    heightMm: Number.parseFloat(product.height ?? "") || undefined,
  }, rawMaterials).map((entry) => entry.line);
  if (autoFilled.length > 0) return autoFilled;

  const group = groupForType(product.type);
  const seeded: BOMLine[] = [];
  GROUP_TEMPLATES[group].parts.always.forEach((partKey) => {
    const category = PART_TO_CATEGORY[partKey] as PartCategory | undefined;
    if (!category) return;
    const material = rawMaterials.find((item) => item.category === category);
    if (material) seeded.push({ materialId: material.id, partCategory: category, qtyConsumed: 0 });
  });
  return seeded.length > 0 ? seeded : undefined;
}

export function buildStockRequestMaterials(
  inquiry: ReturnType<typeof useOrders>["inquiries"][number],
  rawMaterials: ReturnType<typeof useMaterials>["rawMaterials"],
  findBOMTemplate: ReturnType<typeof useMaterials>["findBOMTemplate"],
  productBomOverrides: (BOMLine[] | null)[] = []
): StockRequestMaterial[] | undefined {
  const requirements = new Map<string, StockRequestMaterial>();
  for (let index = 0; index < inquiry.products.length; index += 1) {
    const product = inquiry.products[index];
    const bom = productBomOverrides[index] ?? productBOM(inquiry, index, rawMaterials, findBOMTemplate);
    if (!bom?.length) return undefined;
    if (!bom.some((line) => Number.isFinite(line.qtyConsumed) && line.qtyConsumed > 0)) return undefined;
    for (const line of bom) {
      if (!line.materialId || !Number.isFinite(line.qtyConsumed) || line.qtyConsumed < 0) return undefined;
      if (line.qtyConsumed === 0) continue;
      const material = rawMaterials.find((item) => item.id === line.materialId);
      if (!material) return undefined;
      const requiredQuantity = (requirements.get(line.materialId)?.requiredQuantity ?? 0) + line.qtyConsumed * product.qty;
      if (!Number.isFinite(requiredQuantity) || requiredQuantity <= 0) return undefined;
      requirements.set(line.materialId, {
        materialId: line.materialId,
        materialName: material.name,
        unit: material.unit,
        requiredQuantity,
      });
    }
  }
  return requirements.size > 0 ? [...requirements.values()] : undefined;
}

export function StockRequestsModal({ mode, onClose, initialRequestId, adapter }: { mode: Mode; onClose: () => void; initialRequestId?: string; adapter?: StockRequestsAdapter }) {
  const { inquiries } = useOrders();
  const { rawMaterials, findBOMTemplate } = useMaterials();
  const { requests: demoRequests, createRequest, respondToRequest } = useStockRequests();
  const { push } = useNotifications();
  const session = useSession();
  const apiMode = !!adapter || session.mode === "real";
  const requests: StockRequestPresentation[] = adapter?.requests ?? (apiMode ? [] : demoRequests);
  const busy = !!adapter?.saving;
  const writesUnavailable = busy || !!adapter?.loading || !!adapter?.writesUnavailable;
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [inquiryId, setInquiryId] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(initialRequestId ?? null);
  const [statusFilter, setStatusFilter] = useState<StockRequestStatus | "all">("all");
  const [observedQuantities, setObservedQuantities] = useState<Record<string, string>>({});
  const [confirmingInventory, setConfirmingInventory] = useState(false);
  const [commandError, setCommandError] = useState("");
  const commandLock = useRef(false);

  useEffect(() => {
    setObservedQuantities({});
    setConfirmingInventory(false);
    setCommandError("");
  }, [selectedRequestId, requests]);

  const selectedRequest = requests.find((request) => request.requestId === selectedRequestId);
  const selectedInquiry = inquiries.find((inquiry) => inquiry.id === selectedRequest?.inquiryId);
  const existingInquiryRequest = requests.find((request) => request.inquiryId === inquiryId);
  const selectedInquiryForRequest = inquiries.find((inquiry) => inquiry.id === inquiryId);
  const inquiryRequirements = selectedInquiryForRequest
    ? buildStockRequestMaterials(selectedInquiryForRequest, rawMaterials, findBOMTemplate)
    : undefined;
  const shortageMaterials = inquiryRequirements?.flatMap((required) => {
    const material = rawMaterials.find((item) => item.id === required.materialId);
    if (!material) return [];
    const shortage = Math.max(0, required.requiredQuantity - material.qtyInStock);
    return shortage > 0 ? [{
      ...required,
      stockAtRequest: material.qtyInStock,
      shortageAtRequest: shortage,
    }] : [];
  });
  const sortedRequests = useMemo(() => [...requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [requests]);
  const visibleRequests = sortedRequests.filter((request) => statusFilter === "all" || request.status === statusFilter);
  const externalRequestSelected = useRef(false);

  useEffect(() => {
    if (initialRequestId && !externalRequestSelected.current) {
      setSelectedRequestId(initialRequestId);
      externalRequestSelected.current = true;
    }
  }, [initialRequestId]);

  const createForInquiry = () => {
    if (apiMode) return;
    const inquiry = inquiries.find((item) => item.id === inquiryId);
    if (!inquiry) {
      toast.error("Select an existing inquiry or order");
      return;
    }
    if (existingInquiryRequest) {
      setSelectedRequestId(existingInquiryRequest.requestId);
      setShowNewRequest(false);
      toast.info("A stock request already exists for this inquiry");
      return;
    }

    const requirements = buildStockRequestMaterials(inquiry, rawMaterials, findBOMTemplate);
    if (!requirements) {
      toast.error("Cannot create a stock request without valid BOM material requirements");
      return;
    }
    const requestedMaterials = requirements.flatMap((required) => {
      const material = rawMaterials.find((item) => item.id === required.materialId);
      if (!material) return [];
      const shortage = Math.max(0, required.requiredQuantity - material.qtyInStock);
      return shortage > 0 ? [{
        ...required,
        stockAtRequest: material.qtyInStock,
        shortageAtRequest: shortage,
      }] : [];
    });
    if (requestedMaterials.length === 0) {
      toast.info("NO STOCK SHORTAGE FOUND", {
        description: "All required materials are currently in stock. Stock Requests are only needed for shortages.",
      });
      return;
    }

    const result = createRequest({
      inquiryId: inquiry.id,
      inquiryReference: inquiry.code,
      clientReference: inquiry.clientName,
      clientName: inquiry.clientName,
      requestedBy: session.name,
      requestedMaterials,
    });
    setSelectedRequestId(result.request.requestId);
    setShowNewRequest(false);
    if (result.created) {
      push({
        dept: "sales",
        title: `Stock shortage request received: ${result.request.requestId}`,
        body: `${result.request.inquiryReference} · ${result.request.clientName} · ${result.request.requestedMaterials.length} raw materials`,
        link: "inventory",
        recipients: ["owner", "operations", "warehouse"],
      });
      toast.success("Stock request sent to Warehouse", { description: result.request.requestId });
    } else {
      toast.info("A stock request already exists for this inquiry");
    }
  };

  const sendStockResponse = (request: StockRequest) => {
    if (apiMode) return;
    const responseMaterials = request.requestedMaterials.map((required) => {
      const material = rawMaterials.find((item) => item.id === required.materialId);
      const currentQuantity = material?.qtyInStock ?? 0;
      const status = material && currentQuantity >= required.requiredQuantity ? "sufficient" as const : "shortage" as const;
      return {
        ...required,
        materialName: material?.name ?? required.materialName,
        unit: material?.unit ?? required.unit,
        currentQuantity,
        status,
        shortageQuantity: status === "shortage" ? Math.max(0, required.requiredQuantity - currentQuantity) : undefined,
      };
    });
    if (!respondToRequest(request.requestId, responseMaterials, session.name)) {
      toast.error("This stock request is no longer awaiting a Warehouse response");
      return;
    }
    push({
      dept: "sales",
      title: `Stock levels received: ${request.requestId}`,
      body: `${request.inquiryReference} · ${request.clientName}`,
      link: "sales",
      recipients: ["owner", "operations", "sales"],
    });
    const allSufficient = responseMaterials.length > 0 && responseMaterials.every((material) => material.status === "sufficient");
    toast.success(allSufficient ? "Shortage resolved; updated stock levels sent to Sales" : "Stock levels sent; remaining shortage is still active");
  };

  const latestResponse = selectedRequest?.latestResponse;
  const hasRemainingShortage = !!latestResponse?.materials.some((material) => material.status === "shortage");

  const validObservations = () => !!selectedRequest?.requestedMaterials.length && selectedRequest.requestedMaterials.every((material) =>
    /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(observedQuantities[material.materialId] ?? "") && Number(observedQuantities[material.materialId]) <= 1000000000);
  const observationError = "Enter an observed non-negative quantity for every material line. Blank means not recorded.";
  const submitObservedResponse = async (updateInventory: boolean) => {
    if (!selectedRequest || !adapter?.respond || writesUnavailable || commandLock.current || (updateInventory && !confirmingInventory)) return;
    if (!validObservations()) { setCommandError(observationError); return; }
    commandLock.current = true;
    setCommandError("");
    try {
      await adapter.respond(selectedRequest, observedQuantities, updateInventory);
      setConfirmingInventory(false);
      toast.success(updateInventory ? "Recorded inventory quantities saved" : "Stock levels sent to Sales");
    } catch (cause) {
      setCommandError(cause instanceof Error ? cause.message : "Stock Request update failed.");
    } finally { commandLock.current = false; }
  };

  const close = () => {
    if (busy || commandLock.current) return;
    setSelectedRequestId(null);
    setShowNewRequest(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,.65)" }} onClick={close}>
      <section className="bg-white rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden" style={{ boxShadow: "0 24px 48px rgba(15,23,42,.3)" }} onClick={(event) => event.stopPropagation()}>
        <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-syne" style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>STOCK REQUESTS</h2>
            <p className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>{mode === "sales" ? "Sales ↔ Warehouse · shortage and replenishment requests" : "Shortage requests · update Inventory before sending new stock levels"}</p>
          </div>
          <button onClick={close} disabled={busy} aria-label="Close stock requests" className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center"><X size={17} /></button>
        </header>

        <div className="p-5 flex flex-col gap-4 min-h-0 flex-1 overflow-hidden">
          {adapter?.loading && <p role="status" className="font-dm text-sm text-slate-500">Loading Stock Requests…</p>}
          {(adapter?.error || commandError) && <div><p role="alert" className="font-dm text-sm text-red-800">{adapter?.error || commandError}</p>{adapter?.retry && <button type="button" disabled={busy || adapter.loading} onClick={adapter.retry} className="mt-2 rounded border border-slate-300 px-3 py-1 font-dm text-xs">Retry Stock Requests</button>}</div>}
          {!selectedRequest ? (
            <>
              {mode === "sales" && !apiMode && (
                <div className="flex justify-end">
                  <button onClick={() => setShowNewRequest((value) => !value)} className="flex items-center gap-2 px-3 py-2 rounded-md text-white font-dm" style={{ backgroundColor: "#C8102E", fontSize: 12, fontWeight: 700 }}>
                    <Plus size={14} /> NEW STOCK REQUEST
                  </button>
                </div>
              )}

              {mode === "sales" && apiMode && adapter?.newRequest}
              {mode === "sales" && !apiMode && showNewRequest && (
                <div className="rounded-lg border border-slate-200 p-4 flex flex-col gap-3">
                  <label className="font-dm flex flex-col gap-1.5" style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>
                    SELECT EXISTING INQUIRY / ORDER
                    <select value={inquiryId} onChange={(event) => setInquiryId(event.target.value)} className="px-3 py-2 rounded-md border border-slate-200 bg-white font-dm" style={{ fontSize: 13 }}>
                      <option value="">Select an inquiry or order</option>
                      {inquiries.filter((item) => !item.archived).map((item) => (
                        <option key={item.id} value={item.id}>{item.code} · {item.clientName}</option>
                      ))}
                    </select>
                  </label>
                  {existingInquiryRequest && <p className="font-dm" style={{ fontSize: 11, color: "#B45309" }}>This inquiry already has {existingInquiryRequest.requestId}; submitting opens that request instead.</p>}
                  {inquiryId && !existingInquiryRequest && (
                    <div className="rounded-md border border-slate-200 p-3">
                      {!inquiryRequirements ? (
                        <p className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>No valid BOM requirements are available for this inquiry. Resolve the BOM before creating a request.</p>
                      ) : shortageMaterials?.length ? (
                        <>
                          <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 800, color: "#92400E" }}>STOCK SHORTAGE REQUEST</div>
                          <div className="flex flex-col gap-1.5">
                            {shortageMaterials.map((material) => (
                              <div key={material.materialId} className="flex flex-wrap justify-between gap-x-3 font-dm" style={{ fontSize: 11, color: "#475569" }}>
                                <strong>{material.materialName}</strong>
                                <span>Required: {quantity(material.requiredQuantity)} {material.unit} · Current: {quantity(material.stockAtRequest ?? 0)} {material.unit} · Shortage: {quantity(material.shortageAtRequest ?? 0)} {material.unit}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="font-dm" style={{ fontSize: 11, fontWeight: 800, color: "#15803D" }}>ALL REQUIRED MATERIALS ARE CURRENTLY IN STOCK. A Stock Request is only needed when a shortage exists.</p>
                      )}
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowNewRequest(false)} className="px-3 py-2 rounded-md font-dm border border-slate-200" style={{ fontSize: 12 }}>Cancel</button>
                    <button onClick={createForInquiry} disabled={!inquiryId} className="px-3 py-2 rounded-md text-white font-dm disabled:opacity-50" style={{ backgroundColor: "#1A2B4A", fontSize: 12, fontWeight: 700 }}>CREATE / OPEN REQUEST</button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {statusFilters.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setStatusFilter(filter.id)}
                    className="rounded-full px-3 py-1.5 font-dm border"
                    style={{
                      backgroundColor: statusFilter === filter.id ? "#1A2B4A" : "white",
                      borderColor: statusFilter === filter.id ? "#1A2B4A" : "#CBD5E1",
                      color: statusFilter === filter.id ? "white" : "#475569",
                      fontSize: 10,
                      fontWeight: 800,
                    }}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                {adapter?.loading || adapter?.error ? null : visibleRequests.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center font-dm" style={{ fontSize: 13, color: "#64748B" }}>No stock requests in this view.</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {visibleRequests.map((request) => {
                      const action = mode === "sales"
                        ? request.status === "pending" ? "VIEW REQUEST"
                          : request.status === "responded" ? "VIEW STOCK REPORT"
                          : request.status === "updated" ? "VIEW UPDATED STOCK REPORT"
                          : "VIEW REQUEST"
                        : request.status === "pending" ? "SEND UPDATED STOCK LEVELS"
                          : request.status === "update_requested" || (request.status === "responded" && request.latestResponse?.materials.some((material) => material.status === "shortage")) ? "VIEW REQUEST / SEND UPDATED STOCK LEVELS"
                          : request.status === "updated" ? "VIEW UPDATED RESPONSE"
                          : "VIEW RESPONSE";
                      return (
                        <div key={request.requestId} className="rounded-lg border border-slate-200 p-3 flex items-center gap-3 flex-wrap">
                          <div className="flex-1 min-w-56">
                            <div className="font-dm" style={{ fontSize: 12, fontWeight: 800, color: "#1A2B4A" }}>{request.reference ?? request.requestId}</div>
                            <div className="font-dm mt-0.5" style={{ fontSize: 11, color: "#64748B" }}>{request.inquiryReference} · {request.clientName}</div>
                            {apiMode && <div className="font-dm mt-0.5 text-xs text-slate-500">Order {request.inquiryReference} · Quotation {request.quotationReference ?? "Not recorded"} · Requested by {request.requestedBy}</div>}
                            <div className="font-dm mt-1" style={{ fontSize: 10, fontWeight: 800, color: request.status === "update_requested" ? "#B45309" : request.status === "pending" ? "#1D4ED8" : "#15803D" }}>{statusLabel[request.status]}</div>
                          </div>
                          <div className="font-dm" style={{ fontSize: 10, color: "#64748B" }}>
                            Created: {dateTime(request.createdAt)}
                            <br />Latest response: {dateTime(request.latestResponse?.responseAt)}
                          </div>
                          <button onClick={() => { setSelectedRequestId(request.requestId); setShowNewRequest(false); }} className="px-3 py-2 rounded-md border border-slate-300 font-dm hover:bg-slate-50" style={{ fontSize: 10, fontWeight: 800, color: "#1A2B4A" }}>{action}</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <button disabled={busy} onClick={() => setSelectedRequestId(null)} className="mb-3 inline-flex items-center gap-1 font-dm" style={{ fontSize: 11, fontWeight: 800, color: "#1A2B4A" }}>
                <ArrowLeft size={14} /> BACK TO REQUESTS
              </button>
              <section className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-3" style={{ backgroundColor: "#F8FAFC" }}>
                  <div className="font-syne" style={{ fontSize: 15, fontWeight: 800, color: "#1A2B4A" }}>{selectedRequest.reference ?? selectedRequest.requestId}</div>
                  <div className="font-dm mt-1" style={{ fontSize: 11, color: "#64748B" }}>
                    {selectedRequest.inquiryReference} · {(!apiMode && selectedInquiry?.clientName) || selectedRequest.clientName} · Requested by {selectedRequest.requestedBy} · {dateTime(selectedRequest.createdAt)}
                  </div>
                  {apiMode && <div className="font-dm mt-1 text-xs text-slate-500">Order {selectedRequest.inquiryReference} · Quotation {selectedRequest.quotationReference ?? "Not recorded"}</div>}
                  <div className="font-dm mt-1" style={{ fontSize: 10, fontWeight: 800, color: selectedRequest.status === "update_requested" ? "#B45309" : selectedRequest.status === "pending" ? "#1D4ED8" : "#15803D" }}>{statusLabel[selectedRequest.status]}</div>
                </div>

                {apiMode && <p className="px-4 pt-3 font-dm text-xs text-slate-500">Verification provenance for request-time snapshots is not recorded. Current stock status uses Warehouse observations.</p>}
                <div className="p-4 overflow-x-auto">
                  <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 800, color: "#1A2B4A" }}>
                    {selectedRequest.status === "updated" ? "LATEST UPDATED STOCK REPORT" : selectedRequest.latestResponse ? "LATEST STOCK REPORT" : "STOCK SHORTAGE REQUEST"}
                  </div>
                  <table className="w-full text-left">
                    <thead>
                      <tr>{["Material", "Required", ...(apiMode ? ["Stock at Request", "Shortage at Request"] : []), "Current Stock", ...(mode === "warehouse" && adapter?.respond ? ["Observed Quantity"] : []), "Status", "Shortage"].map((heading) => (
                        <th key={heading} className="px-3 py-2 font-dm" style={{ backgroundColor: "#F1F5F9", fontSize: 10, fontWeight: 800, color: "#64748B" }}>{heading}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {(selectedRequest.latestResponse?.materials ?? selectedRequest.requestedMaterials).map((material) => {
                        const response = "currentQuantity" in material ? material : undefined;
                        return (
                          <tr key={material.materialId} style={{ borderTop: "1px solid #E2E8F0" }}>
                            <td className="px-3 py-2 font-dm" style={{ fontSize: 11, color: "#0F172A" }}>{material.materialName}</td>
                            <td className="px-3 py-2 font-mono-jb" style={{ fontSize: 11 }}>{quantity(material.requiredQuantity)} {material.unit}</td>
                            {apiMode && <>
                              <td className="px-3 py-2 font-mono-jb text-xs">{material.stockAtRequest == null ? "Not recorded" : `${quantity(material.stockAtRequest)} ${material.unit}`}</td>
                              <td className="px-3 py-2 font-mono-jb text-xs">{material.shortageAtRequest == null ? "Not recorded" : `${quantity(material.shortageAtRequest)} ${material.unit}`}</td>
                            </>}
                            <td className="px-3 py-2 font-mono-jb" style={{ fontSize: 11 }}>
                              {response ? `${quantity(response.currentQuantity)} ${response.unit}` : !apiMode && "stockAtRequest" in material && material.stockAtRequest !== undefined ? `${quantity(material.stockAtRequest)} ${material.unit}` : "Not recorded"}
                            </td>
                            {mode === "warehouse" && adapter?.respond && <td className="px-3 py-2"><input aria-label={`Current quantity for ${material.materialName}`} type="number" min="0" max="1000000000" step="0.0001" disabled={writesUnavailable || confirmingInventory} value={observedQuantities[material.materialId] ?? ""} onChange={(event) => { setCommandError(""); setObservedQuantities((current) => ({ ...current, [material.materialId]: event.target.value })); }} className="w-32 rounded border border-slate-300 px-2 py-1 font-dm text-xs" /></td>}
                            <td className="px-3 py-2 font-dm" style={{ fontSize: 11, fontWeight: 800, color: response ? response.status === "sufficient" ? "#15803D" : "#B45309" : !apiMode && "shortageAtRequest" in material && material.shortageAtRequest !== undefined ? "#B45309" : "#64748B" }}>
                              {response ? response.status === "sufficient" ? "SUFFICIENT" : "SHORTAGE" : !apiMode && "shortageAtRequest" in material && material.shortageAtRequest !== undefined ? "SHORTAGE" : "—"}
                            </td>
                            <td className="px-3 py-2 font-mono-jb" style={{ fontSize: 11 }}>
                              {response?.status === "shortage" ? `${quantity(response.shortageQuantity ?? 0)} ${response.unit}` : !apiMode && !response && "shortageAtRequest" in material && material.shortageAtRequest !== undefined ? `${quantity(material.shortageAtRequest)} ${material.unit}` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {selectedRequest.latestResponse && (
                    <div className="font-dm mt-3" style={{ fontSize: 11, color: "#475569" }}>
                      Warehouse response: {dateTime(selectedRequest.latestResponse.responseAt)} · {selectedRequest.latestResponse.respondedBy}
                    </div>
                  )}
                  {selectedRequest.responseHistory.length > 1 && (
                    <details className="mt-3">
                      <summary className="font-dm cursor-pointer" style={{ fontSize: 11, color: "#475569" }}>Previous response history ({selectedRequest.responseHistory.length - 1})</summary>
                      <div className="mt-2 flex flex-col gap-1">
                        {selectedRequest.responseHistory.slice(0, -1).map((response) => (
                          <div key={response.responseAt} className="font-dm" style={{ fontSize: 10, color: "#64748B" }}>{response.type === "initial" ? "Initial response" : "Updated response"} · {dateTime(response.responseAt)} · {response.respondedBy}</div>
                        ))}
                      </div>
                    </details>
                  )}
                  {selectedRequest.historyUnavailable && <p className="font-dm mt-3 text-xs text-slate-500">Previous response history and responder names are not supplied by the Stock Requests service. Only the latest recorded response is shown.</p>}
                </div>

                {mode === "warehouse" && (
                  <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-2 flex-wrap">
                    {adapter?.respond && <>
                      <p className="w-full font-dm text-xs text-slate-500">Enter actual observed quantities. Sending stock levels records a response. Recording received stock replaces quantities on hand after confirmation.</p>
                      <button type="button" disabled={writesUnavailable || confirmingInventory} onClick={() => void submitObservedResponse(false)} className="px-4 py-2 rounded-md text-white font-dm disabled:opacity-50" style={{ backgroundColor: "#1A2B4A", fontSize: 11, fontWeight: 800 }}>SEND UPDATED STOCK LEVELS</button>
                      <button type="button" disabled={writesUnavailable || confirmingInventory} onClick={() => { if (!validObservations()) { setCommandError(observationError); return; } setCommandError(""); setConfirmingInventory(true); }} className="rounded-md border border-slate-300 px-4 py-2 font-dm text-xs font-bold disabled:opacity-50">Record received stock</button>
                      {confirmingInventory && <div role="alertdialog" aria-label="Confirm manual inventory quantities" className="w-full rounded-lg border border-blue-200 bg-blue-50 p-3 font-dm text-xs">
                        <p>Confirm these observed quantities. This replaces the quantity on hand; it does not add requested quantities or reserve stock.</p>
                        {selectedRequest.requestedMaterials.map((material) => <p key={material.materialId} className="mt-1">{material.materialName}: {observedQuantities[material.materialId]} {material.unit}</p>)}
                        <div className="mt-3 flex justify-end gap-3"><button type="button" disabled={busy} onClick={() => setConfirmingInventory(false)}>Cancel inventory update</button><button type="button" disabled={writesUnavailable} onClick={() => void submitObservedResponse(true)} className="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50">Confirm recorded quantities</button></div>
                      </div>}
                    </>}
                    {!apiMode && (selectedRequest.status === "pending" || selectedRequest.status === "update_requested" || (selectedRequest.status === "responded" && hasRemainingShortage)) && (
                      <button onClick={() => sendStockResponse(selectedRequest)} className="px-4 py-2 rounded-md text-white font-dm" style={{ backgroundColor: "#1A2B4A", fontSize: 11, fontWeight: 800 }}>
                        SEND UPDATED STOCK LEVELS
                      </button>
                    )}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
