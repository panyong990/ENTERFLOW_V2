import { WarehouseReference } from "./WarehouseReference";
import { useEffect, useState } from "react";
import { History, X } from "lucide-react";

import {
  getWarehouseMaterialHistory,
  type MaterialHistoryResponse
} from "../api/warehouseMaterialHistory";

import { warehouseQuantity } from "../api/warehouseDashboard";
import type { RawMaterial } from "../store/materials";

export function RealWarehouseMaterialHistory({
  material,
  onClose
}: {
  material: RawMaterial;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<MaterialHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadedKey, setLoadedKey] = useState("");

  const requestKey = `${material.id}:${page}:${reload}`;

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(false);
    setResult(null);

    getWarehouseMaterialHistory(
      material.id,
      page,
      controller.signal
    )
      .then(data => {
        if (!controller.signal.aborted) {
          setResult(data);
          setLoadedKey(requestKey);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(true);
          setLoadedKey(requestKey);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [material.id, page, requestKey]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", closeOnEscape);

    return () =>
      window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const pending = loading || loadedKey !== requestKey;
  const visible = !pending && !error ? result : null;

  const currentQuantity = Number.isFinite(material.qtyInStock)
    ? `${material.qtyInStock} ${material.unit}${material.quantityStatus === "provisional_sample" ? " (sample)" : ""} on hand`
    : "Current quantity not recorded";

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end"
      style={{ backgroundColor: "rgba(15,23,42,0.4)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="warehouse-history-title"
        className="bg-white h-full w-full max-w-md flex flex-col"
        style={{ boxShadow: "-20px 0 40px rgba(0,0,0,0.2)" }}
        onClick={event => event.stopPropagation()}
      >
        <div
          className="px-5 py-4 border-b border-slate-200 flex items-start justify-between"
          style={{ backgroundColor: "#1A2B4A" }}
        >
          <div>
            <h3
              id="warehouse-history-title"
              className="font-syne text-white"
              style={{ fontSize: 16, fontWeight: 700 }}
            >
              Audit History
            </h3>
            <p className="font-dm mt-1 text-xs text-white/70">
              {material.name} &middot; {currentQuantity}
            </p>
          </div>

          <button
            type="button"
            aria-label="Close material history"
            onClick={onClose}
            className="w-8 h-8 rounded-md hover:bg-white/10 flex items-center justify-center"
          >
            <X size={16} color="white" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <p className="font-dm mb-4 text-xs text-slate-500">
            Recorded stock movements from the database.
            Material detail and price edits are not included in this view.
          </p>

          {pending ? (
            <p role="status" className="font-dm py-8 text-center text-sm text-slate-500">
              Loading material history...
            </p>
          ) : error ? (
            <div role="alert" className="font-dm py-8 text-center text-sm text-slate-600">
              <p>Material history is unavailable.</p>
              <button
                type="button"
                onClick={() => setReload(value => value + 1)}
                className="mt-3 rounded-md border border-slate-300 px-3 py-2"
              >
                Retry history
              </button>
            </div>
          ) : visible?.items.length === 0 ? (
            <div className="text-center py-8 font-dm text-sm text-slate-400">
              <History size={28} className="mx-auto mb-2 text-slate-300" />
              No stock movements recorded.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {visible?.items.map(entry => {
                const change = entry.change === null
                  ? null
                  : Number(entry.change);

                return (
                  <div
                    key={entry.id}
                    className="rounded-lg p-3 border border-slate-200"
                    style={{ backgroundColor: "#FAFBFC" }}
                  >
                    <div className="font-dm text-[11px] font-semibold text-slate-500">
                      {new Date(entry.date).toLocaleString()}
                    </div>

                    <div className="font-dm mt-1 text-[13px] font-bold text-slate-900">
                      {entry.employee}
                    </div>

                    <div
                      className="font-mono-jb mt-2 text-xs font-semibold"
                      style={{
                        color: change === null || change === 0
                          ? "#475569"
                          : change > 0 ? "#16A34A" : "#C8102E"
                      }}
                    >
                      {warehouseQuantity(entry.oldQty)}
                      {" \u2192 "}
                      {warehouseQuantity(entry.newQty)} {entry.unit}

                      {change !== null && (
                        <span className="ml-2 font-dm font-normal text-slate-500">
                          ({change > 0 ? "+" : ""}{change})
                        </span>
                      )}
                    </div>

                    {entry.quantityStatusBefore !== "verified" && (
                      <p className="font-dm mt-1 text-[11px] text-slate-500">
                        Previous stock was not verified.
                      </p>
                    )}

                    <p className="font-dm mt-2 text-xs text-slate-600">
                      Reason: {entry.reason}
                    </p>

                    {entry.reference && (
                      <p className="font-mono-jb mt-1 text-[11px] text-slate-600">
                        Ref: <WarehouseReference value={entry.reference}/>
                      </p>
                    )}

                    {entry.jobOrder && (
                      <p className="font-mono-jb mt-1 text-[11px] text-slate-600">
                        Job Order: <WarehouseReference value={entry.jobOrder}/>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 p-4 flex items-center justify-between gap-2 font-dm text-xs">
          <button
            type="button"
            disabled={pending || page === 1}
            onClick={() => setPage(value => value - 1)}
            className="rounded-md border border-slate-200 px-3 py-2 disabled:opacity-40"
          >
            Previous
          </button>

          <span>Page {page}</span>

          <button
            type="button"
            disabled={pending || !visible?.hasMore || page >= 10000}
            onClick={() => setPage(value => value + 1)}
            className="rounded-md border border-slate-200 px-3 py-2 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}