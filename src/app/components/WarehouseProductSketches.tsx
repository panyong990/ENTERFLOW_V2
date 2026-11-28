import { useEffect, useState } from "react";
import { Eye, Paperclip } from "lucide-react";
import { api } from "../api/client";

interface ProductSketch {
  itemId: string;
  productName: string;
  status: "none" | "available" | "unavailable";
  fileId: string | null;
  originalFilename: string | null;
  mimeType: string | null;
}

const validId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[1-9]\d{0,19}$/.test(value) &&
  BigInt(value) <= 18446744073709551615n;

export function WarehouseProductSketches({
  deliveryId
}: {
  deliveryId: string;
}) {
  const [rows, setRows] = useState<ProductSketch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(false);
    setRows([]);

    async function load() {
      try {
        if (!validId(deliveryId)) {
          throw new Error("Invalid shipment");
        }

        const result = await api<ProductSketch[]>(
          `/api/warehouse/shipments/${deliveryId}/sketches`,
          {signal:controller.signal}
        );

        if (
          !Array.isArray(result) ||
          !result.every(row =>
            row &&
            validId(row.itemId) &&
            typeof row.productName === "string" &&
            ["available","none","unavailable"].includes(row.status) &&
            (
              row.status === "available"
                ? validId(row.fileId) &&
                  typeof row.originalFilename === "string" &&
                  ["application/pdf","image/jpeg","image/png"]
                    .includes(row.mimeType ?? "")
                : row.fileId === null
            )
          )
        ) {
          throw new Error("Invalid sketch response");
        }

        if (!controller.signal.aborted) setRows(result);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();

    return () => controller.abort();
  }, [deliveryId,reload]);

  if (loading) {
    return <p role="status" className="rounded-lg border border-slate-200 p-5 text-center text-xs text-slate-500">
      Loading product sketches...
    </p>;
  }

  if (error) {
    return <div role="alert" className="rounded-lg border border-slate-200 p-4 text-center text-xs text-slate-600">
      Product sketches could not be loaded.
      <button type="button"
        className="mt-2 block mx-auto rounded border border-slate-300 px-3 py-1.5"
        onClick={() => setReload(value => value + 1)}>
        Retry
      </button>
    </div>;
  }

  if (!rows.length) {
    return <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-xs text-slate-400">
      No delivered product lines recorded.
    </p>;
  }

  return <div className="flex flex-col gap-2">
    {rows.map(row => <div key={row.itemId}
      className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="break-words text-xs font-semibold text-slate-800">
        {row.productName}
      </p>

      {row.status === "available" ? <>
        <p className="mt-2 flex items-center gap-2 break-all text-xs text-slate-500">
          <Paperclip size={14}/>
          {row.originalFilename}
        </p>
        <a
          href={`/api/warehouse/shipments/${deliveryId}/items/${row.itemId}/sketches/${row.fileId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800">
          <Eye size={12}/> View Drawing
        </a>
      </> : <p className="mt-2 text-xs text-slate-500">
        {row.status === "none"
          ? "No sketch on file for this product."
          : "The linked drawing is currently unavailable."}
      </p>}
    </div>)}
  </div>;
}