import { X, Printer, Download } from "lucide-react";
import type { Inquiry } from "../../store/orders";
import { poNumberForDisplay } from "../../store/orders";

export function InvoicePreviewModal({ inquiry, onClose, onSend, canSend = false }: { inquiry: Inquiry; onClose: () => void; onSend?: () => void; canSend?: boolean }) {

  const total = inquiry.invoiceAmount ?? 0;
  const items = inquiry.quotationDoc?.lineItems?.map((line) => ({ description: line.description, spec: line.subDescription, qty: line.qty, unitPrice: line.unitPrice }))
    ?? inquiry.products.map((p, i) => ({ description: p.filterName || p.type, spec: [p.oem, p.media, p.od1 && `OD ${p.od1}`, p.id1 && `ID ${p.id1}`, p.height && `H ${p.height}`].filter(Boolean).join(" · "), qty: p.qty, unitPrice: inquiry.quotation?.lines[i] ? (inquiry.quotation.lines[i].materialCost + inquiry.quotation.lines[i].labor) * (1 + inquiry.quotation.lines[i].markupPct / 100) : 0 }));
  const money = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,.7)" }} onClick={onClose}>
    <div className="bg-white rounded-xl w-full max-w-4xl flex flex-col" style={{ maxHeight: "95vh", boxShadow: "0 24px 48px rgba(15,23,42,.35)" }} onClick={(e) => e.stopPropagation()}>
      <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between print:hidden">
        <div><h3 className="font-syne" style={{ fontSize: 15, fontWeight: 700 }}>Invoice {inquiry.invoiceNo}</h3><p className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>{canSend ? "Review before sending to client" : "Shared invoice document"}</p></div>
        <div className="flex items-center gap-2"><button onClick={() => window.print()} className="px-3 py-1.5 rounded-md border border-slate-300 font-dm" style={{ fontSize: 12, fontWeight: 700 }}><Printer size={13} className="inline mr-1" />Print</button><button onClick={() => window.print()} className="px-3 py-1.5 rounded-md text-white font-dm" style={{ backgroundColor: "#1A2B4A", fontSize: 12, fontWeight: 700 }}><Download size={13} className="inline mr-1" />Download PDF</button><button onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      </div>
      <div className="overflow-auto p-8" style={{ backgroundColor: "#F4F6F9" }}>
        <div className="bg-white mx-auto p-8" style={{ maxWidth: 820, border: "1px solid #E2E8F0" }}>
          <p className="mb-4 text-sm font-bold text-amber-900">UNSAVED DRAFT · BACKEND INTEGRATION PENDING</p><div className="flex justify-between pb-5 border-b-2 border-slate-900"><div><div className="font-syne" style={{ fontSize: 18, fontWeight: 800 }}>ENTER-FIL INDUSTRIAL PRODUCTS</div><div className="font-dm mt-1" style={{ fontSize: 11, color: "#64748B" }}>2574 Anacleto St., Sta. Cruz, Manila, Philippines</div></div><div className="text-right"><div className="font-syne" style={{ fontSize: 30, fontWeight: 800 }}>INVOICE</div><div className="font-dm mt-2" style={{ fontSize: 11 }}><b>{inquiry.invoiceNo}</b><br />Date: {inquiry.invoiceDate ?? "—"}</div></div></div>
          <div className="grid grid-cols-2 gap-4 py-5 border-b border-slate-200 font-dm" style={{ fontSize: 12 }}><div><b>Client</b><br />{inquiry.clientName}<br />Attn: {inquiry.contactPerson}</div><div><b>PO No.</b><br />{poNumberForDisplay(inquiry) ?? inquiry.code}<br /><b>Payment Terms:</b> {inquiry.quotationDoc?.termsOfPayment ?? inquiry.paymentTerms}<br /><b>Place of Delivery:</b> {inquiry.quotationDoc?.placeOfDelivery ?? "—"}</div></div>
          <table className="w-full mt-5" style={{ borderCollapse: "collapse" }}><thead><tr style={{ backgroundColor: "#1A2B4A" }}>{["ITEM / PRODUCT", "DESCRIPTION / SPECIFICATION", "QTY", "UNIT PRICE", "AMOUNT"].map((h) => <th key={h} className="text-white font-dm px-3 py-2 text-left" style={{ fontSize: 10 }}>{h}</th>)}</tr></thead><tbody>{items.map((item, i) => <tr key={i} className="border-b border-slate-200"><td className="px-3 py-3 font-dm" style={{ fontSize: 12, fontWeight: 700 }}>{item.description}</td><td className="px-3 py-3 font-dm" style={{ fontSize: 11, color: "#475569" }}>{item.spec || "—"}</td><td className="px-3 py-3 font-mono-jb" style={{ fontSize: 12 }}>{item.qty}</td><td className="px-3 py-3 font-mono-jb" style={{ fontSize: 12 }}>{money(item.unitPrice)}</td><td className="px-3 py-3 font-mono-jb" style={{ fontSize: 12, fontWeight: 700 }}>{money(item.unitPrice * item.qty)}</td></tr>)}</tbody></table>
          <div className="flex justify-end mt-5"><div className="w-64 font-dm" style={{ fontSize: 12 }}><div className="flex justify-between py-1"><span>SUBTOTAL</span><b>{money(total)}</b></div><div className="flex justify-between py-2 mt-1 text-white px-3 rounded" style={{ backgroundColor: "#1A2B4A", fontSize: 15 }}><span>TOTAL</span><b>{money(total)}</b></div></div></div>
          <p className="mt-6 rounded border border-amber-200 bg-amber-50 p-4 text-sm">UNSAVED DRAFT · Not issued or sent. Payment requirements, bank information and balances require server confirmation.</p>
          <div className="grid grid-cols-2 gap-4 mt-5 font-dm" style={{ fontSize: 12 }}><span>Due date</span><b>{inquiry.paymentCycleStartedAt ? inquiry.invoiceDueDate ?? "—" : "—"}</b><span>Invoice status</span><b>{inquiry.invoiceSentAt ? "Sent to client" : "Draft — Sales review"}</b></div>
        </div>
      </div>
      {canSend && !!inquiry.invoiceNo && !inquiry.invoiceSentAt && onSend && <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 print:hidden"><button onClick={onClose} className="px-4 py-2 rounded-md font-dm" style={{ fontSize: 13, color: "#475569" }}>Cancel</button><button onClick={onSend} className="px-4 py-2 rounded-md text-white font-dm" style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700 }}>SEND INVOICE TO CLIENT</button></div>}
    </div>
  </div>;
}
