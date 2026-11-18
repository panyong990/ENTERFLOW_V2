import { X } from "lucide-react";
import type { ProductionJobOrder } from "./useProductionJobOrders";
import { JOTemplateModal, type JOTemplateData } from "./JOTemplateModal";

function formatDate(value: string | null | undefined) {
  if (!value) return "Unavailable";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatProductionEventTime(value: string | null | undefined) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

const detailLabels: Record<string, string> = {
  od1: "Outer diameter 1", od2: "Outer diameter 2", id1: "Inner diameter 1", id2: "Inner diameter 2",
  height: "Height", overallHeight: "Overall height", length: "Length", width: "Width", thickness: "Thickness",
  depth: "Depth", pocketCount: "Pocket count", diameter: "Diameter",
  clothCuttingWidth: "Cloth cutting width", clothCuttingLength: "Cloth cutting length",
  springPlateCenterToCenter: "Spring plate center to center", springPlateWidth: "Spring plate width", springPlateLength: "Spring plate length",
  padOd: "Pad outer diameter", padId: "Pad inner diameter", media: "Filter media", innerCore: "Inner core", outerCore: "Outer core",
  oring: "O-ring", gasket: "Gasket", endCap: "End cap", oemPartNumber: "OEM part number", brand: "Brand",
  filtrationRating: "Filtration rating", others: "Other specifications", notes: "Notes",
};

export function productionSpecifications(record: ProductionJobOrder): string[] {
  return Object.entries(detailLabels).flatMap(([key, label]) => record[key] == null || record[key] === "" ? [] : [`${label}: ${record[key]}`]);
}

// The detail API returns events newest first. Pause/resume events do not replace
// a stage's last recorded done/reverted event; the cursor is not completion proof.
export function latestProductionStageEvent(record: ProductionJobOrder | null, position: number) {
  return record?.productionEvents?.find(event => event.stagePosition === position && (event.action === "done" || event.action === "reverted"));
}

export function ProductionEventHistory({ detail }: { detail: ProductionJobOrder }) {
  return (
    <section>
      <h3 className="font-syne mb-3 text-sm font-bold text-slate-900">Production event history</h3>
      {detail.productionEvents == null ? (
        <p className="font-dm text-sm text-slate-500">Production event history unavailable.</p>
      ) : detail.productionEvents.length ? (
        <ol className="space-y-2">
          {detail.productionEvents.map(event => (
            <li key={event.id} className="rounded-lg border border-slate-200 p-3 font-dm text-sm">
              <p>{event.stageLabel ?? (event.stagePosition == null ? "Job Order" : `Stage position ${event.stagePosition}`)} · {event.action}</p>
              <p className="text-xs text-slate-500">{formatProductionEventTime(event.occurredAt)} · {event.performedBy == null ? "Operator unavailable" : `User ID: ${event.performedBy}`}</p>
              {event.reason && <p className="mt-1 text-xs text-slate-600">Reason: {event.reason}</p>}
            </li>
          ))}
        </ol>
      ) : (
        <p className="font-dm text-sm text-slate-500">No production events recorded.</p>
      )}
    </section>
  );
}

export function ProductionDetailStatus({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  if (loading) return <p role="status" className="font-dm text-sm text-slate-500">Loading Job Order details…</p>;
  if (error) return <div role="alert" className="font-dm text-sm text-red-800">{error}<button type="button" onClick={retry} className="ml-3 rounded border px-3 py-1">Retry details</button></div>;
  return null;
}

export function productionDocumentData(record: ProductionJobOrder): JOTemplateData {
  const specs: JOTemplateData["specs"] = {};
  for (const key of Object.keys(detailLabels)) {
    if (record[key] != null && record[key] !== "") specs[(key === "oemPartNumber" ? "oem" : key) as keyof JOTemplateData["specs"]] = String(record[key]);
  }
  return {
    jo: record.reference, client: record.clientName, product: record.filterName ?? record.filterTypeCode ?? "Unavailable",
    filterType: record.filterTypeCode ?? undefined, qty: record.quantity, date: formatDate(record.createdAt),
    itemCode: "Unavailable", enterFilPN: "Unavailable", preparedBy: "Unavailable",
    poRef: record.trace?.purchaseOrderReference ?? record.purchaseOrderReference ?? "Unavailable",
    dueDate: "Unavailable", deliveryMethod: "Unavailable", productionDueDate: formatDate(record.productionDueDate), specs,
  };
}

export function ProductionJobOrderDocument({ selectedId, detail, loading, error, retry, onClose }: { selectedId: string; detail: ProductionJobOrder | null; loading: boolean; error: string; retry: () => void; onClose: () => void }) {
  if (!loading && !error && detail?.id === selectedId) return <JOTemplateModal data={productionDocumentData(detail)} onClose={onClose} />;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Job Order Document" className="w-full max-w-lg rounded-xl bg-white p-6" onClick={event => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-syne font-bold">Job Order Document</h2>
          <button aria-label="Close document" onClick={onClose}><X size={18} /></button>
        </div>
        <ProductionDetailStatus loading={loading || (!error && detail?.id !== selectedId)} error={error} retry={retry} />
      </div>
    </div>
  );
}
