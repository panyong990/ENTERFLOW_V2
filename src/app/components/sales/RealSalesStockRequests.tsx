import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { createStockRequest, listStockRequests } from "../../api/stockRequests.js";
import { StockRequestsModal, type StockRequestPresentation } from "../StockRequestsModal";
import { useMaterials } from "../../store/materials";
import { stockRequestReady } from "./stockRequestInput.mjs";
import type { SalesOrderRow } from "../useSalesOrders";
import { mapStockRequestRecord, type ApiRequest } from "../stockRequestPresentation";

export function RealSalesStockRequests({ onClose, rows }: { onClose: () => void; rows: SalesOrderRow[] }) {
  const { rawMaterials, inventoryLoading, inventoryError, refreshInventory } = useMaterials();
  const recordedMaterials = rawMaterials.filter((material) => material.source === "database" && material.databaseId);
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [orderId, setOrderId] = useState(rows[0]?.id ?? "");
  const [materialId, setMaterialId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const lock = useRef(false);

  const materialUnits = useMemo(() => new Map(
    rawMaterials.flatMap((material) => material.databaseId ? [[material.databaseId, material.unit] as const] : [])
  ), [rawMaterials]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await listStockRequests();
      const next = result as ApiRequest[];
      next.forEach((request) => mapStockRequestRecord(request, materialUnits));
      setRequests(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load Stock Requests.");
    } finally {
      setLoading(false);
    }
  }, [materialUnits]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!orderId && rows[0]) setOrderId(rows[0].id);
  }, [orderId, rows]);

  const ready = stockRequestReady({
    orders: rows,
    materials: recordedMaterials,
    orderId,
    materialId,
    quantity,
    loading: inventoryLoading,
    error: inventoryError,
    submitting,
  });

  const submit = async () => {
    if (!ready || lock.current || uncertain) return;
    lock.current = true;
    setSubmitting(true);
    setSubmitError("");
    setSuccess("");
    try {
      await createStockRequest({ orderId, lines: [{ materialId, quantity: Number(quantity) }] });
      setSuccess("Stock Request submitted to Warehouse. Inventory was not reserved or deducted.");
      setMaterialId("");
      setQuantity("");
      await load();
    } catch (cause) {
      const failure = cause as { status?: number; message?: string };
      const unknown = !failure.status || failure.status >= 500;
      setUncertain(unknown);
      setSubmitError(unknown
        ? "Submission could not be confirmed. Refresh the list and check with Warehouse before submitting again."
        : failure.message ?? "Stock Request submission failed.");
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
  };

  const presentedRequests = useMemo(
    () => requests.map((request) => mapStockRequestRecord(request, materialUnits)),
    [requests, materialUnits],
  );
  const newRequest = (
    <div className="space-y-4">
      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => void load()} disabled={loading || submitting} className="rounded border px-3 py-2 text-xs font-semibold disabled:opacity-50">Refresh</button>
        <button type="button" onClick={() => setShowNewRequest((value) => !value)} disabled={submitting} className="flex items-center gap-2 rounded-md bg-[#C8102E] px-3 py-2 font-dm text-xs font-bold text-white disabled:opacity-50">
          <Plus size={14} /> NEW STOCK REQUEST
        </button>
      </div>
      {success && <p role="status" className="text-sm text-green-800">{success}</p>}
      {showNewRequest && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">New Stock Request</h3>
          {inventoryLoading && <p role="status" className="mt-2 text-xs text-slate-600">Loading materials…</p>}
          {inventoryError && <div role="alert" className="mt-2 text-xs text-red-800"><p>Material data is unavailable. {inventoryError}</p><button type="button" onClick={refreshInventory} className="mt-2 rounded border px-3 py-1.5">Retry materials</button></div>}
          {!inventoryLoading && !inventoryError && recordedMaterials.length === 0 && <p className="mt-2 text-xs text-slate-500">No authenticated materials are available. Catalog references cannot be requested until registered and mapped.</p>}
          {!inventoryLoading && !inventoryError && recordedMaterials.length > 0 && rows.length > 0 && (
            <>
              <fieldset disabled={submitting || uncertain} className="mt-3 grid gap-3 md:grid-cols-4">
                <select aria-label="Order" value={orderId} onChange={(event) => setOrderId(event.target.value)} className="rounded border border-slate-300 px-3 py-2 text-sm md:col-span-2">
                  <option value="">Select order</option>
                  {rows.map((row) => <option key={row.id} value={row.id}>{row.reference} · {row.companyName}</option>)}
                </select>
                <select aria-label="Material ID" value={materialId} onChange={(event) => setMaterialId(event.target.value)} className="rounded border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Select recorded material</option>
                  {recordedMaterials.map((material) => <option key={material.databaseId} value={material.databaseId}>{material.itemCode ? `${material.itemCode} · ` : ""}{material.name} ({material.unit})</option>)}
                </select>
                <input aria-label="Quantity" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Quantity" type="number" min="0.0001" max="1000000000" step="0.0001" className="rounded border border-slate-300 px-3 py-2 text-sm" />
              </fieldset>
              <button type="button" onClick={() => void submit()} disabled={!ready || uncertain} className="mt-3 rounded bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{submitting ? "Submitting…" : "Submit to Warehouse"}</button>
            </>
          )}
          {!inventoryLoading && !inventoryError && recordedMaterials.length > 0 && rows.length === 0 && <p className="mt-2 text-sm text-slate-500">Load an order before creating a Stock Request.</p>}
          {submitError && <p role="alert" className="mt-3 text-sm text-red-800">{submitError}</p>}
        </div>
      )}
    </div>
  );

  return (
    <StockRequestsModal
      mode="sales"
      onClose={onClose}
      adapter={{
        requests: presentedRequests as StockRequestPresentation[],
        loading,
        error,
        saving: submitting,
        retry: load,
        newRequest,
      }}
    />
  );
}
