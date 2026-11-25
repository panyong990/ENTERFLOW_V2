import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { createStockRequest, listStockRequests } from "../../api/stockRequests.js";
import { getSalesStockAvailability } from "../../api/salesOrders.js";
import { StockRequestsModal, type StockRequestPresentation } from "../StockRequestsModal";
import { useMaterials } from "../../store/materials";
import type { SalesOrderRow, SalesStockAvailability } from "../useSalesOrders";
import { mapStockRequestRecord, type ApiRequest } from "../stockRequestPresentation";

type ShortageLine = {
  materialId: string;
  name: string;
  unit: string;
  required: number;
  available: number;
  shortage: number;
};

function calculateShortages(report: SalesStockAvailability): ShortageLine[] {
  if (!report || !Array.isArray(report.assessments) || !Array.isArray(report.unmappedItems)) {
    throw new Error("Invalid stock availability response.");
  }

  if (report.requirementsAvailable !== true || report.unmappedItems.length || report.overallStatus === "unmapped") {
    throw new Error("This inquiry has unmapped specifications or BOM materials. Resolve them before creating a Stock Request.");
  }

  if (!report.assessments.length) {
    throw new Error("No verified material requirements are available for this inquiry.");
  }

  const grouped = new Map<string, ShortageLine>();

  for (const item of report.assessments) {
    if (item.classification !== "raw_material") {
      throw new Error("This inquiry includes non-raw-material stock requirements that need separate handling.");
    }

    if (
      !item.materialId ||
      item.quantityStatus !== "verified" ||
      item.inventoryState === "inventory_unavailable" ||
      item.status === "inventory_unavailable" ||
      item.requiredQuantity === null ||
      item.availableQuantity === null
    ) {
      throw new Error("Required materials or available inventory are not verified for this inquiry.");
    }

    const required = Number(item.requiredQuantity);
    const available = Number(item.availableQuantity);

    if (
      !Number.isFinite(required) ||
      !Number.isFinite(available) ||
      required <= 0 ||
      available < 0
    ) {
      throw new Error("The stock availability report contains invalid quantities.");
    }

    const key = String(item.materialId);
    const unit = item.unitCode ?? "Not recorded";
    const existing = grouped.get(key);

    if (existing) {
      if (existing.unit !== unit || Math.abs(existing.available - available) > 0.0001) {
        throw new Error("Conflicting inventory observations were found for one material.");
      }
      existing.required += required;
    } else {
      grouped.set(key, {
        materialId: key,
        name: item.materialName,
        unit,
        required,
        available,
        shortage: 0,
      });
    }
  }

  return [...grouped.values()]
    .map((line) => ({
      ...line,
      shortage: Math.max(0, Number((line.required - line.available).toFixed(4))),
    }))
    .filter((line) => line.shortage > 0);
}

const formatQuantity = (value: number) =>
  value.toLocaleString("en-PH", { maximumFractionDigits: 4 });

export function RealSalesStockRequests({
  onClose,
  rows,
}: {
  onClose: () => void;
  rows: SalesOrderRow[];
}) {
  const { rawMaterials } = useMaterials();
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [orderId, setOrderId] = useState("");
  const [shortages, setShortages] = useState<ShortageLine[]>([]);
  const [checking, setChecking] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [assessmentReady, setAssessmentReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const lock = useRef(false);

  const materialUnits = useMemo(
    () => new Map(
      rawMaterials.flatMap((material) =>
        material.databaseId
          ? [[material.databaseId, material.unit] as const]
          : []
      )
    ),
    [rawMaterials]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await listStockRequests();
      setRequests(result as ApiRequest[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load Stock Requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setShortages([]);
    setAvailabilityError("");
    setAssessmentReady(false);

    if (!orderId) return;

    const controller = new AbortController();
    setChecking(true);

    void (async () => {
      try {
        const report = await getSalesStockAvailability(orderId, controller.signal) as SalesStockAvailability;
        const result = calculateShortages(report);

        if (!controller.signal.aborted) {
          setShortages(result);
          setAssessmentReady(true);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setAvailabilityError(
            cause instanceof Error ? cause.message : "Unable to calculate material shortages."
          );
        }
      } finally {
        if (!controller.signal.aborted) setChecking(false);
      }
    })();

    return () => controller.abort();
  }, [orderId]);

  const existingRequest = requests.find((request) => request.orderId === orderId);

  const submit = async () => {
    if (
      !orderId ||
      !assessmentReady ||
      checking ||
      availabilityError ||
      shortages.length === 0 ||
      existingRequest ||
      uncertain ||
      lock.current
    ) return;

    lock.current = true;
    setSubmitting(true);
    setSubmitError("");
    setSuccess("");

    try {
      await createStockRequest({
        orderId,
        lines: shortages.map((line) => ({
          materialId: line.materialId,
          quantity: Number(line.required.toFixed(4)),
        })),
      });

      setSuccess("Stock Request submitted to Warehouse.");
      setShowNewRequest(false);
      setOrderId("");
      await load();
    } catch (cause) {
      const failure = cause as {
  status?: number;
  message?: string;
  code?: string;
};

const unknown =
  !failure.status ||
  failure.status >= 500 ||
  failure.code === "INVALID_RESPONSE";
      setUncertain(unknown);
      setSubmitError(
        unknown
          ? "Submission could not be confirmed. Refresh the request list before attempting another submission."
          : failure.message ?? "Stock Request submission failed."
      );
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
  };

  const presentedRequests = useMemo(
    () => requests.map((request) => mapStockRequestRecord(request, materialUnits)),
    [requests, materialUnits]
  );

  const newRequest = (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowNewRequest((value) => !value)}
          disabled={submitting}
          className="flex items-center gap-2 px-3 py-2 rounded-md text-white font-dm"
          style={{ backgroundColor: "#C8102E", fontSize: 12, fontWeight: 700 }}
        >
          <Plus size={14} /> NEW STOCK REQUEST
        </button>
      </div>

      {success && <p role="status" className="text-sm text-green-800">{success}</p>}

      {showNewRequest && (
        <div className="rounded-lg border border-slate-200 p-4 flex flex-col gap-3">
          <label
            className="font-dm flex flex-col gap-1.5"
            style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}
          >
            SELECT EXISTING INQUIRY / ORDER
            <select
              value={orderId}
              onChange={(event) => {
                setOrderId(event.target.value);
                setSubmitError("");
                setSuccess("");
                setUncertain(false);
              }}
              disabled={submitting}
              className="px-3 py-2 rounded-md border border-slate-200 bg-white font-dm"
              style={{ fontSize: 13 }}
            >
              <option value="">Select an inquiry or order</option>
              {rows.filter((row) => !row.archivedAt).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.reference} · {row.companyName}
                </option>
              ))}
            </select>
          </label>

          {existingRequest && (
            <p className="font-dm text-xs text-amber-700">
              This inquiry already has {existingRequest.reference ?? `SR-${existingRequest.id}`}.
              View the existing request in the list below.
            </p>
          )}

          {orderId && !existingRequest && (
            <div className="rounded-md border border-slate-200 p-3">
              {checking ? (
                <p className="font-dm text-xs text-slate-500">
                  Checking inquiry material requirements and Warehouse inventory...
                </p>
              ) : availabilityError ? (
                <p role="alert" className="font-dm text-xs text-amber-800">
                  {availabilityError}
                </p>
              ) : assessmentReady && shortages.length > 0 ? (
                <>
                  <div
                    className="font-dm mb-2"
                    style={{ fontSize: 11, fontWeight: 800, color: "#92400E" }}
                  >
                    STOCK SHORTAGE REQUEST
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {shortages.map((material) => (
                      <div
                        key={material.materialId}
                        className="flex flex-wrap justify-between gap-x-3 font-dm"
                        style={{ fontSize: 11, color: "#475569" }}
                      >
                        <strong>{material.name}</strong>
                        <span>
                          Required: {formatQuantity(material.required)} {material.unit}
                          {" · "}
                          Current: {formatQuantity(material.available)} {material.unit}
                          {" · "}
                          Shortage: {formatQuantity(material.shortage)} {material.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : assessmentReady ? (
                <p
                  className="font-dm"
                  style={{ fontSize: 11, fontWeight: 800, color: "#15803D" }}
                >
                  ALL REQUIRED MATERIALS ARE CURRENTLY IN STOCK.
                  A Stock Request is only needed when a shortage exists.
                </p>
              ) : null}
            </div>
          )}

          {submitError && (
            <p role="alert" className="text-xs text-red-800">{submitError}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNewRequest(false)}
              disabled={submitting}
              className="px-3 py-2 rounded-md font-dm border border-slate-200"
              style={{ fontSize: 12 }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={
                submitting ||
                loading ||
                checking ||
                !assessmentReady ||
                !orderId ||
                !!existingRequest ||
                shortages.length === 0 ||
                !!availabilityError ||
                uncertain
              }
              className="px-3 py-2 rounded-md text-white font-dm disabled:opacity-50"
              style={{ backgroundColor: "#1A2B4A", fontSize: 12, fontWeight: 700 }}
            >
              {submitting ? "Submitting..." : "CREATE / OPEN REQUEST"}
            </button>
          </div>
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
