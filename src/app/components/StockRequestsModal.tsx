import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { autofillBOMForType, useMaterials, type BOMLine, type PartCategory } from "../store/materials";
import { resolveProductBOM, type ProductLine, useOrders } from "../store/orders";
import { GROUP_TEMPLATES, groupForType, PART_TO_CATEGORY } from "../store/filterTemplates";
import { useNotifications } from "../store/notifications";
import { useSession } from "../store/session";
import { useStockRequests, type StockRequest, type StockRequestMaterial, type StockRequestStatus } from "../store/stockRequests";

type Mode = "sales" | "warehouse";

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
const quantity = (value: number) => value.toLocaleString("en-PH", { maximumFractionDigits: 3 });

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
    for (const line of bom) {
      if (!line.materialId || !Number.isFinite(line.qtyConsumed) || line.qtyConsumed < 0) return undefined;
      if (line.qtyConsumed === 0) continue;
      const material = rawMaterials.find((item) => item.id === line.materialId);
      const requiredQuantity = (requirements.get(line.materialId)?.requiredQuantity ?? 0) + line.qtyConsumed * product.qty;
      if (!Number.isFinite(requiredQuantity) || requiredQuantity <= 0) return undefined;
      requirements.set(line.materialId, {
        materialId: line.materialId,
        materialName: material?.name ?? line.materialId,
        unit: material?.unit ?? "",
        requiredQuantity,
      });
    }
  }
  return requirements.size > 0 ? [...requirements.values()] : undefined;
}

export function StockRequestsModal({ mode, onClose, initialRequestId }: { mode: Mode; onClose: () => void; initialRequestId?: string }) {
  const { inquiries } = useOrders();
  const { rawMaterials, findBOMTemplate } = useMaterials();
  const { requests, createRequest, respondToRequest, requestStockUpdate } = useStockRequests();
  const { push } = useNotifications();
  const session = useSession();
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [inquiryId, setInquiryId] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(initialRequestId ?? null);
  const [statusFilter, setStatusFilter] = useState<StockRequestStatus | "all">("all");
  const [updateReason, setUpdateReason] = useState("");
  const [showUpdateReason, setShowUpdateReason] = useState(false);

  const selectedRequest = requests.find((request) => request.requestId === selectedRequestId);
  const selectedInquiry = inquiries.find((inquiry) => inquiry.id === selectedRequest?.inquiryId);
  const existingInquiryRequest = requests.find((request) => request.inquiryId === inquiryId);
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

    const requestedMaterials = buildStockRequestMaterials(inquiry, rawMaterials, findBOMTemplate);
    if (!requestedMaterials) {
      toast.error("Cannot create a stock request without valid BOM material requirements");
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
        title: `Stock request received: ${result.request.requestId}`,
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
    const updated = request.status === "update_requested";
    push({
      dept: "sales",
      title: `${updated ? "Updated stock levels" : "Stock report"} received: ${request.requestId}`,
      body: `${request.inquiryReference} · ${request.clientName}`,
      link: "sales",
      recipients: ["owner", "operations", "sales"],
    });
    toast.success(updated ? "Updated stock levels sent to Sales" : "Stock report sent to Sales");
  };

  const submitStockUpdateRequest = (request: StockRequest) => {
    if (!requestStockUpdate(request.requestId, updateReason)) {
      toast.error("A stock update cannot be requested for this stock report");
      return;
    }
    push({
      dept: "sales",
      title: `Stock update requested: ${request.requestId}`,
      body: `${request.inquiryReference} · ${request.clientName}${updateReason.trim() ? ` · ${updateReason.trim()}` : ""}`,
      link: "inventory",
      recipients: ["owner", "operations", "warehouse"],
    });
    setShowUpdateReason(false);
    setUpdateReason("");
    toast.success("Stock update requested for the existing request");
  };

  const latestResponse = selectedRequest?.latestResponse;
  const canRequestUpdate = !!latestResponse?.materials.some((material) => material.status === "shortage")
    && (selectedRequest?.status === "responded" || selectedRequest?.status === "updated");

  const close = () => {
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
            <p className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>{mode === "sales" ? "Sales ↔ Warehouse · tied to existing inquiries" : "Warehouse responses use current Inventory stock"}</p>
          </div>
          <button onClick={close} aria-label="Close stock requests" className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center"><X size={17} /></button>
        </header>

        <div className="p-5 flex flex-col gap-4 min-h-0 flex-1 overflow-hidden">
          {!selectedRequest ? (
            <>
              {mode === "sales" && (
                <div className="flex justify-end">
                  <button onClick={() => setShowNewRequest((value) => !value)} className="flex items-center gap-2 px-3 py-2 rounded-md text-white font-dm" style={{ backgroundColor: "#C8102E", fontSize: 12, fontWeight: 700 }}>
                    <Plus size={14} /> NEW STOCK REQUEST
                  </button>
                </div>
              )}

              {mode === "sales" && showNewRequest && (
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
                {visibleRequests.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center font-dm" style={{ fontSize: 13, color: "#64748B" }}>No stock requests in this view.</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {visibleRequests.map((request) => {
                      const action = mode === "sales"
                        ? request.status === "pending" ? "VIEW REQUEST"
                          : request.status === "responded" ? "VIEW STOCK REPORT"
                          : request.status === "updated" ? "VIEW UPDATED STOCK REPORT"
                          : "VIEW REQUEST"
                        : request.status === "pending" ? "RESPOND"
                          : request.status === "update_requested" ? "VIEW REQUEST / SEND UPDATED STOCK LEVELS"
                          : request.status === "updated" ? "VIEW UPDATED RESPONSE"
                          : "VIEW RESPONSE";
                      return (
                        <div key={request.requestId} className="rounded-lg border border-slate-200 p-3 flex items-center gap-3 flex-wrap">
                          <div className="flex-1 min-w-56">
                            <div className="font-dm" style={{ fontSize: 12, fontWeight: 800, color: "#1A2B4A" }}>{request.requestId}</div>
                            <div className="font-dm mt-0.5" style={{ fontSize: 11, color: "#64748B" }}>{request.inquiryReference} · {request.clientName}</div>
                            <div className="font-dm mt-1" style={{ fontSize: 10, fontWeight: 800, color: request.status === "update_requested" ? "#B45309" : request.status === "pending" ? "#1D4ED8" : "#15803D" }}>{statusLabel[request.status]}</div>
                          </div>
                          <div className="font-dm" style={{ fontSize: 10, color: "#64748B" }}>
                            Created: {dateTime(request.createdAt)}
                            <br />Latest response: {dateTime(request.latestResponse?.responseAt)}
                          </div>
                          <button onClick={() => { setSelectedRequestId(request.requestId); setShowNewRequest(false); setShowUpdateReason(false); }} className="px-3 py-2 rounded-md border border-slate-300 font-dm hover:bg-slate-50" style={{ fontSize: 10, fontWeight: 800, color: "#1A2B4A" }}>{action}</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <button onClick={() => { setSelectedRequestId(null); setShowUpdateReason(false); }} className="mb-3 inline-flex items-center gap-1 font-dm" style={{ fontSize: 11, fontWeight: 800, color: "#1A2B4A" }}>
                <ArrowLeft size={14} /> BACK TO REQUESTS
              </button>
              <section className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-3" style={{ backgroundColor: "#F8FAFC" }}>
                  <div className="font-syne" style={{ fontSize: 15, fontWeight: 800, color: "#1A2B4A" }}>{selectedRequest.requestId}</div>
                  <div className="font-dm mt-1" style={{ fontSize: 11, color: "#64748B" }}>
                    {selectedRequest.inquiryReference} · {selectedInquiry?.clientName ?? selectedRequest.clientName} · Requested by {selectedRequest.requestedBy} · {dateTime(selectedRequest.createdAt)}
                  </div>
                  <div className="font-dm mt-1" style={{ fontSize: 10, fontWeight: 800, color: selectedRequest.status === "update_requested" ? "#B45309" : selectedRequest.status === "pending" ? "#1D4ED8" : "#15803D" }}>{statusLabel[selectedRequest.status]}</div>
                </div>

                <div className="p-4 overflow-x-auto">
                  <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 800, color: "#1A2B4A" }}>
                    {mode === "warehouse" && !selectedRequest.latestResponse ? "MATERIALS REQUESTED" : selectedRequest.status === "updated" ? "LATEST UPDATED STOCK REPORT" : selectedRequest.latestResponse ? "LATEST STOCK REPORT" : "REQUESTED MATERIALS"}
                  </div>
                  <table className="w-full text-left">
                    <thead>
                      <tr>{["Material", "Required", ...(selectedRequest.latestResponse ? ["Current Stock", "Status", "Shortage"] : [])].map((heading) => (
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
                            {selectedRequest.latestResponse && (
                              <>
                                <td className="px-3 py-2 font-mono-jb" style={{ fontSize: 11 }}>{response ? `${quantity(response.currentQuantity)} ${response.unit}` : "—"}</td>
                                <td className="px-3 py-2 font-dm" style={{ fontSize: 11, fontWeight: 800, color: response?.status === "sufficient" ? "#15803D" : "#B45309" }}>{response?.status === "sufficient" ? "SUFFICIENT" : "SHORTAGE"}</td>
                                <td className="px-3 py-2 font-mono-jb" style={{ fontSize: 11 }}>{response?.status === "shortage" ? `${quantity(response.shortageQuantity ?? 0)} ${response.unit}` : "—"}</td>
                              </>
                            )}
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
                  {selectedRequest.updateReason && (
                    <div className="font-dm mt-2" style={{ fontSize: 11, color: "#92400E" }}>Stock update reason: {selectedRequest.updateReason}</div>
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
                </div>

                {(mode === "warehouse" || (mode === "sales" && canRequestUpdate)) && (
                  <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-2 flex-wrap">
                    {mode === "warehouse" && (selectedRequest.status === "pending" || selectedRequest.status === "update_requested") && (
                      <button onClick={() => sendStockResponse(selectedRequest)} className="px-4 py-2 rounded-md text-white font-dm" style={{ backgroundColor: "#1A2B4A", fontSize: 11, fontWeight: 800 }}>
                        {selectedRequest.status === "pending" ? "RESPOND WITH CURRENT STOCK" : "SEND UPDATED STOCK LEVELS"}
                      </button>
                    )}
                    {mode === "sales" && canRequestUpdate && !showUpdateReason && (
                      <button onClick={() => setShowUpdateReason(true)} className="px-4 py-2 rounded-md text-white font-dm" style={{ backgroundColor: "#C8102E", fontSize: 11, fontWeight: 800 }}>REQUEST STOCK UPDATE</button>
                    )}
                    {mode === "sales" && showUpdateReason && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <input value={updateReason} onChange={(event) => setUpdateReason(event.target.value)} placeholder="Optional reason" className="px-3 py-2 rounded-md border border-slate-200 font-dm" style={{ fontSize: 11 }} />
                        <button onClick={() => submitStockUpdateRequest(selectedRequest)} className="px-3 py-2 rounded-md text-white font-dm" style={{ backgroundColor: "#C8102E", fontSize: 11, fontWeight: 800 }}>SUBMIT UPDATE REQUEST</button>
                        <button onClick={() => { setShowUpdateReason(false); setUpdateReason(""); }} className="px-3 py-2 rounded-md font-dm border border-slate-200" style={{ fontSize: 11 }}>Cancel</button>
                      </div>
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
