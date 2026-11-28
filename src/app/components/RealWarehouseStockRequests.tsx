import { useCallback, useEffect, useMemo, useState } from "react";
import { listStockRequests, processStockRequest } from "../api/stockRequests.js";
import { StockRequestsModal, type StockRequestPresentation } from "./StockRequestsModal";
import { useMaterials } from "../store/materials";
import { mapStockRequestRecord, type ApiRequest } from "./stockRequestPresentation";

export function RealWarehouseStockRequests({ onClose }: { onClose: () => void }) {
  const { rawMaterials, refreshInventory } = useMaterials();
  const [rows, setRows] = useState<ApiRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await listStockRequests();
      setRows(result as ApiRequest[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load Stock Requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const materialUnits = useMemo(() => new Map(
    rawMaterials.flatMap((material) => material.databaseId ? [[material.databaseId, material.unit] as const] : [])
  ), [rawMaterials]);
  const requests = useMemo(() => rows.map((row) => mapStockRequestRecord(row, materialUnits)), [rows, materialUnits]);

  const respond = useCallback(async (
    request: StockRequestPresentation,
    quantities: Record<string, string>,
    updateInventory: boolean,
    reason?: string,
  ) => {
    const lines = request.requestedMaterials.map((material) => {
      const lineId = request.lineIds?.[material.materialId];
      if (!lineId) throw new Error("A Stock Request line could not be matched. Refresh and retry.");
      const currentQuantity = Number(quantities[material.materialId]);
      return {
        lineId,
        currentQuantity,
        shortageQuantity: Number(Math.max(0, material.requiredQuantity - currentQuantity).toFixed(4)),
      };
    });
    setSaving(true);
    try {
      await processStockRequest(request.requestId, {
        status: updateInventory ? "updated" : "responded",
        lines,
        ...(updateInventory ? {
          reason,
          inventoryUpdates: request.requestedMaterials.map((material) => ({
            materialId: material.materialId,
            quantityOnHand: Number(quantities[material.materialId]),
          })),
        } : {}),
      });
      if (updateInventory) refreshInventory();
      await load();
    } finally { setSaving(false); }
  }, [load, refreshInventory]);

  return (
    <StockRequestsModal
      mode="warehouse"
      onClose={onClose}
      adapter={{ requests, loading, error, saving, retry: load, respond }}
    />
  );
}
