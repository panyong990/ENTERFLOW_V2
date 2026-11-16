import { useEffect, useRef, useState } from "react";
import { Download, Printer, X } from "lucide-react";
import type { OfficialReceipt } from "../store/orders";

export function OfficialReceiptPreviewModal({ receipt, onClose }: { receipt: OfficialReceipt; onClose: () => void }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const filename = `${receipt.orNumber}.html`;
  const [isLoading, setIsLoading] = useState(Boolean(receipt.documentDataUrl));
  const [hasError, setHasError] = useState(!receipt.documentDataUrl);

  useEffect(() => {
    setIsLoading(Boolean(receipt.documentDataUrl));
    setHasError(!receipt.documentDataUrl);
  }, [receipt.documentDataUrl]);

  const printReceipt = () => {
    frameRef.current?.contentWindow?.focus();
    frameRef.current?.contentWindow?.print();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,.7)" }} onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-5xl flex flex-col overflow-hidden" style={{ height: "90vh" }} onClick={(event) => event.stopPropagation()}>
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <div className="font-syne" style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Official Receipt</div>
            <div className="font-dm mt-0.5" style={{ fontSize: 12, color: "#64748B" }}>
              {receipt.orNumber} · {receipt.invoiceNo} · {receipt.clientName}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href={receipt.documentDataUrl} download={filename} className="font-dm inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-200 hover:bg-slate-50" style={{ fontSize: 12, fontWeight: 700, color: "#1A2B4A" }}>
              <Download size={13} /> Download
            </a>
            <button onClick={printReceipt} className="font-dm inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-white hover:opacity-90" style={{ fontSize: 12, fontWeight: 700, backgroundColor: "#1A2B4A" }}>
              <Printer size={13} /> Print
            </button>
            <button onClick={onClose} aria-label="Close Official Receipt" className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center"><X size={16} /></button>
          </div>
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-100 p-3 sm:p-5">
          {isLoading && !hasError && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100 font-dm text-sm text-slate-500">
              Loading Official Receipt…
            </div>
          )}
          {hasError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center font-dm text-sm text-red-800">
              This Official Receipt could not be displayed. Please try downloading it or contact Accounting.
            </div>
          ) : (
            <iframe
              ref={frameRef}
              src={receipt.documentDataUrl}
              title={`${receipt.orNumber} Official Receipt`}
              onLoad={() => { setIsLoading(false); setHasError(false); }}
              onError={() => { setIsLoading(false); setHasError(true); }}
              className="h-full min-h-[420px] w-full max-w-4xl shrink-0 bg-white shadow-sm"
            />
          )}
        </div>
      </div>
    </div>
  );
}
