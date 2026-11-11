import { useRef } from "react";
import { Download, Printer, X } from "lucide-react";
import type { OfficialReceipt } from "../store/orders";

export function OfficialReceiptPreviewModal({ receipt, onClose }: { receipt: OfficialReceipt; onClose: () => void }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const filename = `${receipt.orNumber}.html`;

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
        <iframe ref={frameRef} src={receipt.documentDataUrl} title={`${receipt.orNumber} Official Receipt`} className="flex-1 min-h-0 w-full bg-white" />
      </div>
    </div>
  );
}
