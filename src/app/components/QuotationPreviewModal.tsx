import { X, Printer, Download } from "lucide-react";
import type { Inquiry, QuotationDoc } from "../store/orders";

interface Props {
  inquiry: Inquiry;
  doc: QuotationDoc;
  vatLabel: string;          // "VAT EXCLUSIVE" / "VAT INCLUSIVE" / "ZERO-RATED"
  total: number;
  preparedBy: string;
  onClose: () => void;
}

/**
 * Formatted client-facing quotation document — matches the physical
 * Enter-Fil quotation layout: letterhead, client block, line items table,
 * notes row, two-column terms+totals, and signature footer.
 *
 * Print/Download uses the browser's native print dialog (Save as PDF works
 * on all major browsers).
 */
export function QuotationPreviewModal({ inquiry, doc, vatLabel, total, preparedBy, onClose }: Props) {
  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.7)" }} onClick={onClose}>
      {/* Modal chrome (hidden in print) */}
      <div className="bg-white rounded-xl w-full max-w-4xl flex flex-col" style={{ boxShadow: "0 24px 48px rgba(0,0,0,0.35)", maxHeight: "95vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between shrink-0 print:hidden">
          <div>
            <h3 className="font-syne" style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Quotation Preview</h3>
            <p className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>{doc.quotationNo} · ready to send to client</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-dm hover:bg-slate-100" style={{ fontSize: 12, fontWeight: 700, color: "#1A2B4A", border: "1px solid #CBD5E1" }}>
              <Printer size={13} /> Print
            </button>
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white font-dm hover:opacity-90" style={{ backgroundColor: "#1A2B4A", fontSize: 12, fontWeight: 700 }}>
              <Download size={13} /> Download PDF
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center" aria-label="Close"><X size={16} /></button>
          </div>
        </div>

        {/* Document */}
        <div className="overflow-auto p-8 print:p-0" style={{ backgroundColor: "#F4F6F9" }}>
          <div className="bg-white mx-auto print:shadow-none" style={{ maxWidth: 820, padding: 40, boxShadow: "0 4px 16px rgba(15,23,42,0.08)", border: "1px solid #E2E8F0" }}>
            {/* ── Letterhead ── */}
            <div className="flex items-start justify-between pb-5 border-b-2" style={{ borderColor: "#0F172A" }}>
              <div className="flex items-start gap-4">
                {/* EFIP triangle logo */}
                <div className="flex flex-col items-center">
                  <span style={{ fontSize: 44, color: "#C8102E", fontWeight: 900, lineHeight: 1 }}>▲</span>
                  <span className="font-dm" style={{ fontSize: 9, fontWeight: 800, color: "#C8102E", letterSpacing: 1.2, marginTop: -2 }}>EFIP</span>
                </div>
                <div>
                  <div className="font-syne" style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", letterSpacing: 0.5, textTransform: "uppercase" }}>
                    Enter-Fil Industrial Products
                  </div>
                  <div className="font-dm mt-1" style={{ fontSize: 11, color: "#475569", lineHeight: 1.5 }}>
                    2574 Anacleto St., Brgy. 209 Zone 019<br />
                    Sta. Cruz, Manila, Philippines
                  </div>
                  <div className="font-dm mt-1" style={{ fontSize: 11, color: "#475569" }}>
                    Ms. Dess · 0945-887-3187 · enterfil.filters@yahoo.com
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-syne" style={{ fontSize: 32, fontWeight: 800, color: "#0F172A", letterSpacing: 2, lineHeight: 1 }}>QUOTATION</div>
                <div className="mt-3 font-dm" style={{ fontSize: 11 }}>
                  <div className="flex justify-end gap-2">
                    <span style={{ color: "#64748B" }}>Quotation No.</span>
                    <span className="font-mono-jb" style={{ color: "#0F172A", fontWeight: 700 }}>{doc.quotationNo}</span>
                  </div>
                  <div className="flex justify-end gap-2 mt-0.5">
                    <span style={{ color: "#64748B" }}>Date</span>
                    <span style={{ color: "#0F172A", fontWeight: 600 }}>{doc.date}</span>
                  </div>
                  <div className="flex justify-end gap-2 mt-0.5">
                    <span style={{ color: "#64748B" }}>Valid Until</span>
                    <span style={{ color: "#0F172A", fontWeight: 600 }}>{doc.validUntil}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Client block ── */}
            <div className="grid grid-cols-2 gap-6 py-5 border-b border-slate-200">
              <div>
                <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Attention</div>
                <div className="font-dm mt-0.5" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{inquiry.contactPerson}</div>
              </div>
              <div>
                <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Company</div>
                <div className="font-dm mt-0.5" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{inquiry.clientName}</div>
              </div>
              <div className="col-span-2">
                <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Address</div>
                <div className="font-dm mt-0.5" style={{ fontSize: 12, color: "#475569" }}>{doc.placeOfDelivery || "—"}</div>
              </div>
            </div>

            {/* ── Line items table ── */}
            <table className="w-full mt-5" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#1A2B4A" }}>
                  {[
                    { l: "NO.",         w: 50,   align: "center" },
                    { l: "QTY",         w: 60,   align: "center" },
                    { l: "UNIT",        w: 60,   align: "center" },
                    { l: "DESCRIPTION", w: "auto", align: "left" },
                    { l: "UNIT PRICE",  w: 110,  align: "right" },
                    { l: "TOTAL",       w: 130,  align: "right" },
                  ].map((c) => (
                    <th key={c.l} className="font-dm py-2.5 px-3 text-white" style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", textAlign: c.align as any, width: c.w }}>
                      {c.l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {doc.lineItems.map((li) => (
                  <tr key={li.no} style={{ borderBottom: "1px solid #E2E8F0" }}>
                    <td className="font-mono-jb py-3 px-3" style={{ fontSize: 12, fontWeight: 700, color: "#1A2B4A", textAlign: "center" }}>{li.no}</td>
                    <td className="font-mono-jb py-3 px-3" style={{ fontSize: 12, color: "#0F172A", textAlign: "center" }}>{li.qty}</td>
                    <td className="font-dm py-3 px-3" style={{ fontSize: 12, color: "#475569", textAlign: "center" }}>{li.unit}</td>
                    <td className="font-dm py-3 px-3" style={{ fontSize: 13, color: "#0F172A" }}>
                      <div style={{ fontWeight: 700, textTransform: "uppercase" }}>{li.description}</div>
                      {li.subDescription && (
                        <div className="font-dm" style={{ fontSize: 11, color: "#475569", marginTop: 2, paddingLeft: 16 }}>
                          {li.subDescription}
                        </div>
                      )}
                    </td>
                    <td className="font-mono-jb py-3 px-3" style={{ fontSize: 12, color: "#0F172A", textAlign: "right" }}>₱{li.unitPrice.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="font-mono-jb py-3 px-3" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", textAlign: "right" }}>₱{(li.unitPrice * li.qty).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                {doc.packaging && !doc.packaging.includeInUnit && (
                  <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                    <td colSpan={3} />
                    <td className="font-dm py-3 px-3" style={{ fontSize: 12, color: "#475569" }}>Packaging — {doc.packaging.materialName} × {doc.packaging.qty}</td>
                    <td className="font-mono-jb py-3 px-3" style={{ fontSize: 12, color: "#0F172A", textAlign: "right" }}>₱{doc.packaging.unitPrice.toLocaleString("en-PH")}</td>
                    <td className="font-mono-jb py-3 px-3" style={{ fontSize: 12, color: "#0F172A", textAlign: "right" }}>₱{(doc.packaging.unitPrice * doc.packaging.qty).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                )}
                {doc.shipping && !doc.shipping.includeInUnit && (
                  <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                    <td colSpan={3} />
                    <td className="font-dm py-3 px-3" style={{ fontSize: 12, color: "#475569" }}>{doc.shipping.label}</td>
                    <td />
                    <td className="font-mono-jb py-3 px-3" style={{ fontSize: 12, color: "#0F172A", textAlign: "right" }}>₱{doc.shipping.amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* ── Yellow note row ── */}
            {doc.note.trim() && (
              <div className="mt-4 px-4 py-2.5 font-dm" style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", backgroundColor: doc.noteHighlighted ? "#FEF08A" : "transparent", border: doc.noteHighlighted ? "1px solid #FACC15" : "1px dashed #CBD5E1", borderRadius: 4 }}>
                NOTE : <span style={{ fontWeight: 600 }}>{doc.note}</span>
              </div>
            )}

            {/* ── Two-column footer (Terms left, Totals right) ── */}
            <div className="grid grid-cols-2 items-start gap-6 mt-5">
              {/* Terms & conditions */}
              <div>
                <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 800, color: "#0F172A", letterSpacing: 0.5, textTransform: "uppercase", borderBottom: "1.5px solid #0F172A", paddingBottom: 4 }}>
                  Terms and Conditions
                </div>
                <div className="flex flex-col gap-1 font-dm" style={{ fontSize: 12 }}>
                  <Term label="Terms of payment" value={doc.termsOfPayment} />
                  <Term label="Time of delivery" value={doc.timeOfDelivery} />
                  <Term label="Place of delivery" value={doc.placeOfDelivery || "—"} />
                  <Term label="Validity" value={doc.validUntil} />
                </div>
              </div>
              {/* Totals */}
              <div className="flex flex-col gap-2">
                <div className="rounded w-full" style={{ backgroundColor: "#1A2B4A", color: "white", padding: "12px 16px" }}>
                  <div className="font-dm" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", opacity: 0.7 }}>
                    <span>Total</span>
                  </div>
                  <div className="font-syne mt-1.5" style={{ fontSize: 26, lineHeight: 1.15, fontWeight: 800, textAlign: "right" }}>
                    ₱ {total.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  {doc.discounts?.map((discount) => (
                    <div key={`${discount.label}-${discount.percent}`} className="font-dm mt-2 pt-2" style={{ fontSize: 11, fontWeight: 600, color: "#BBF7D0", textAlign: "right", borderTop: "1px solid rgba(187,247,208,0.25)" }}>
                      {discount.label === "Discount" ? "Discount applied" : `${discount.label} discount`}: {discount.percent}%
                    </div>
                  ))}
                </div>
                <div className="font-syne w-full px-3 py-1.5 rounded text-right" style={{ fontSize: 12, fontWeight: 800, color: "#C8102E", backgroundColor: "#FEF2F2", border: "1.5px solid #FECACA", letterSpacing: 0.6 }}>
                  {vatLabel}
                </div>
                {doc.downpaymentPercent && doc.downpaymentAmount ? (
                  <div className="rounded w-full font-dm" style={{ backgroundColor: "#EFF6FF", border: "1.5px solid #BFDBFE", padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#1E40AF", letterSpacing: 0.5, textTransform: "uppercase" }}>
                      Downpayment Required — {doc.downpaymentPercent}%
                    </div>
                    <div className="font-mono-jb mt-2" style={{ fontSize: 18, fontWeight: 800, color: "#1D4ED8", textAlign: "right" }}>
                      ₱ {doc.downpaymentAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 10, color: "#3B82F6", marginTop: 4 }}>
                      due before production begins
                    </div>
                    <div style={{ fontSize: 10, color: "#60A5FA", marginTop: 6, paddingTop: 6, borderTop: "1px solid #BFDBFE" }}>
                      Balance: ₱{(total - doc.downpaymentAmount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} upon delivery
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* ── Footer signatures ── */}
            <div className="grid grid-cols-2 gap-8 mt-12 pt-5 border-t border-slate-200">
              <div>
                <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Prepared by</div>
                <div className="mt-6 border-b border-slate-400 pb-1 font-dm" style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>
                  {preparedBy}
                </div>
              </div>
              <div>
                <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Approved by</div>
                <div className="mt-6 border-b border-slate-400 pb-1 font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>
                  &nbsp;
                </div>
              </div>
            </div>

            <div className="mt-6 text-center font-dm" style={{ fontSize: 10, color: "#94A3B8" }}>
              Generated by ENTER-FLOW ERP · Enter-Fil Industrial Products
            </div>
          </div>
        </div>
      </div>

      {/* Print-only styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:shadow-none { box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}

function Term({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline gap-2" style={highlight ? { backgroundColor: "#EFF6FF", borderRadius: 4, padding: "2px 4px", marginLeft: -4 } : undefined}>
      <span style={{ minWidth: 130, color: highlight ? "#1E40AF" : "#64748B", fontWeight: 700 }}>{label}:</span>
      <span style={{ color: highlight ? "#1D4ED8" : "#0F172A", fontWeight: highlight ? 800 : 600 }}>{value}</span>
    </div>
  );
}
