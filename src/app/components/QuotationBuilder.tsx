import { useState, useMemo } from "react";
import { ArrowLeft, Eye, Send, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useMaterials, type RawMaterial } from "../store/materials";
import { useOrders, type Inquiry, type QuotationDoc, type QuotationLineItem } from "../store/orders";
import { QuotationPreviewModal } from "./QuotationPreviewModal";
import { useSession } from "../store/session";

interface Props {
  inquiry: Inquiry;
  /* Manufacturing unit cost (locked from Tab 2) — used as fallback for single-product */
  manufacturingUnitCost: number;
  /* Per-product unit costs from Tab 2 — overrides manufacturingUnitCost per index */
  productsManufacturingUnitCosts?: (number | null)[];
  vatType: "Exclusive" | "Inclusive" | "Zero-Rated";
  /* Navigates back to Tab 2 to revise */
  onBackToTab2: () => void;
  /* Sends the quotation: persists doc + advances stage + notifies client */
  onSendToClient: (doc: QuotationDoc, total: number, leadTimeDays: number) => void;
}

const NOTE_PRESETS = ["REPEAT ORDER", "NEW ORDER", "RUSH ORDER", "PARTIAL DELIVERY"];

export function QuotationBuilder({ inquiry, manufacturingUnitCost, productsManufacturingUnitCosts, vatType, onBackToTab2, onSendToClient }: Props) {
  const { rawMaterials } = useMaterials();
  const { generateQuotationNumber } = useOrders();
  const session = useSession();
  const product = inquiry.products[0];

  /* Suggested time of delivery from existing quotation lead time, or sensible default */
  const defaultLeadDays = inquiry.quotation?.leadTimeDays ?? 21;
  const defaultDelivery = `${Math.max(2, Math.floor(defaultLeadDays / 7))}–${Math.ceil(defaultLeadDays / 7) + 1} working weeks upon receipt of P.O.`;
  const defaultValidUntil = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  })();

  /* Initial line items: from saved doc, else build from inquiry + per-product unit cost from Tab 2 */
  const initialLineItems: QuotationLineItem[] = inquiry.quotationDoc?.lineItems ?? inquiry.products.map((p, i) => ({
    no: i + 1,
    qty: p.qty,
    unit: "pcs",
    description: p.type.toUpperCase(),
    subDescription: [p.od1 && `OD ${p.od1}mm`, p.id1 && `ID ${p.id1}mm`, p.height && `H ${p.height}mm`].filter(Boolean).join(" × "),
    unitPrice: productsManufacturingUnitCosts?.[i] ?? inquiry.productsUnitPrice?.[i] ?? manufacturingUnitCost,
  }));

  const [lineItems, setLineItems] = useState<QuotationLineItem[]>(initialLineItems);
  const [note, setNote] = useState(inquiry.quotationDoc?.note ?? "");
  const [noteHighlighted, setNoteHighlighted] = useState(inquiry.quotationDoc?.noteHighlighted ?? false);

  /* Packaging */
  const packagingOptions = rawMaterials.filter((m) => m.category === "packaging");
  const [packagingOpen, setPackagingOpen] = useState(!!inquiry.quotationDoc?.packaging);
  const [packagingId, setPackagingId] = useState<string>(inquiry.quotationDoc?.packaging?.materialId ?? packagingOptions[0]?.id ?? "");
  const [packagingQty, setPackagingQty] = useState(inquiry.quotationDoc?.packaging?.qty ?? 1);
  const [packagingInUnit, setPackagingInUnit] = useState(inquiry.quotationDoc?.packaging?.includeInUnit ?? true);

  /* Shipping */
  const [shippingOpen, setShippingOpen] = useState(!!inquiry.quotationDoc?.shipping);
  const [shippingLabel, setShippingLabel] = useState(inquiry.quotationDoc?.shipping?.label ?? "");
  const [shippingAmount, setShippingAmount] = useState(inquiry.quotationDoc?.shipping?.amount ?? 0);
  const [shippingInUnit, setShippingInUnit] = useState(inquiry.quotationDoc?.shipping?.includeInUnit ?? false);

  /* Terms */
  const [termsOfPayment, setTermsOfPayment] = useState<"15-Day Terms" | "30-Day Terms">(
    (inquiry.quotationDoc?.termsOfPayment as any) ?? inquiry.paymentTerms
  );
  const [timeOfDelivery, setTimeOfDelivery] = useState(inquiry.quotationDoc?.timeOfDelivery ?? defaultDelivery);
  const [placeOfDelivery, setPlaceOfDelivery] = useState(inquiry.quotationDoc?.placeOfDelivery ?? clientAddress(inquiry.clientName));
  const [validUntil, setValidUntil] = useState(inquiry.quotationDoc?.validUntil ?? defaultValidUntil);
  const [downpaymentPercent, setDownpaymentPercent] = useState(inquiry.quotationDoc?.downpaymentPercent ?? inquiry.downpaymentPercent ?? 30);

  const [showPreview, setShowPreview] = useState(false);

  /* Selected packaging material */
  const selectedPackaging: RawMaterial | undefined = packagingOptions.find((m) => m.id === packagingId);

  /* ─── Computed values ─── */

  const packagingCostPerOrder = packagingOpen && selectedPackaging ? selectedPackaging.unitPrice * packagingQty : 0;
  const shippingCost = shippingOpen ? shippingAmount : 0;
  const totalQty = lineItems.reduce((s, li) => s + li.qty, 0);

  /* When add-ons are flagged "include in unit price", spread their cost across all units in the quotation. */
  const inclusivePerUnit =
    (packagingOpen && packagingInUnit && totalQty > 0 ? packagingCostPerOrder / totalQty : 0) +
    (shippingOpen && shippingInUnit && totalQty > 0 ? shippingCost / totalQty : 0);

  /* Final unit price the client sees = base unit price + inclusive add-ons */
  const adjustedItems = useMemo(() => lineItems.map((li) => ({
    ...li,
    unitPrice: Number((li.unitPrice + inclusivePerUnit).toFixed(2)),
  })), [lineItems, inclusivePerUnit]);

  const lineSubtotal = adjustedItems.reduce((s, li) => s + li.unitPrice * li.qty, 0);
  const separateAddons =
    (packagingOpen && !packagingInUnit ? packagingCostPerOrder : 0) +
    (shippingOpen && !shippingInUnit ? shippingCost : 0);
  const grandTotal = lineSubtotal + separateAddons;

  const vatLabel =
    vatType === "Exclusive" ? "VAT EXCLUSIVE" :
    vatType === "Inclusive" ? "VAT INCLUSIVE" :
    "ZERO-RATED";

  /* ─── Handlers ─── */

  const updateLineItem = (idx: number, patch: Partial<QuotationLineItem>) => {
    setLineItems((prev) => prev.map((li, i) => (i === idx ? { ...li, ...patch } : li)));
  };
  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { no: prev.length + 1, qty: 1, unit: "pcs", description: "", unitPrice: 0 },
    ]);
  };
  const removeLineItem = (idx: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== idx).map((li, i) => ({ ...li, no: i + 1 })));
  };

  const buildDoc = (): QuotationDoc => ({
    quotationNo: inquiry.quotationDoc?.quotationNo ?? generateQuotationNumber(),
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    validUntil,
    lineItems: adjustedItems,
    note,
    noteHighlighted,
    packaging: packagingOpen && selectedPackaging
      ? { materialId: selectedPackaging.id, materialName: selectedPackaging.name, qty: packagingQty, unitPrice: selectedPackaging.unitPrice, includeInUnit: packagingInUnit }
      : undefined,
    shipping: shippingOpen
      ? { label: shippingLabel || "Shipping", amount: shippingAmount, includeInUnit: shippingInUnit }
      : undefined,
    termsOfPayment,
    timeOfDelivery,
    placeOfDelivery,
    preparedBy: session.name,
    sentAt: inquiry.quotationDoc?.sentAt,
    sentBy: inquiry.quotationDoc?.sentBy,
    downpaymentPercent,
    downpaymentAmount: grandTotal * (downpaymentPercent / 100),
  });

  const handlePreview = () => {
    if (!validateBeforeSend()) return;
    setShowPreview(true);
  };

  const handleSend = () => {
    if (!validateBeforeSend()) return;
    const doc = { ...buildDoc(), sentAt: new Date().toISOString(), sentBy: session.name };
    onSendToClient(doc, grandTotal, defaultLeadDays);
  };

  const validateBeforeSend = () => {
    if (lineItems.length === 0) { toast.error("At least one line item is required"); return false; }
    if (lineItems.some((li) => !li.description.trim() || li.qty <= 0 || li.unitPrice < 0)) {
      toast.error("Each line item needs a description, qty > 0, and a non-negative unit price");
      return false;
    }
    if (!placeOfDelivery.trim()) { toast.error("Place of delivery is required"); return false; }
    return true;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── SECTION A — Internal cost summary (locked) ── */}
      <div className="rounded-lg p-3" style={{ backgroundColor: "#F1F5F9", border: "1px solid #CBD5E1" }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="font-dm mb-2" style={{ fontSize: 10, fontWeight: 800, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" }}>
              Cost Summary from Estimation <span style={{ color: "#94A3B8", fontWeight: 600 }}>(staff-only · not visible to client)</span>
            </div>
            {inquiry.products.length === 1 ? (
              <div className="flex items-center gap-2">
                <span className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>Manufacturing unit cost</span>
                <span className="font-syne" style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>₱{(productsManufacturingUnitCosts?.[0] ?? inquiry.productsUnitPrice?.[0] ?? manufacturingUnitCost).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / unit</span>
                <span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 9, fontWeight: 700, backgroundColor: "#E2E8F0", color: "#475569", letterSpacing: 0.4, textTransform: "uppercase" }}>locked</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {inquiry.products.map((p, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ backgroundColor: "white", border: "1px solid #CBD5E1" }}>
                    <span className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>{p.type}</span>
                    <span className="font-dm" style={{ fontSize: 10, color: "#94A3B8" }}>—</span>
                    <span className="font-mono-jb" style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>₱{(productsManufacturingUnitCosts?.[i] ?? inquiry.productsUnitPrice?.[i] ?? manufacturingUnitCost).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="font-dm" style={{ fontSize: 10, color: "#94A3B8" }}>/unit</span>
                    <span className="font-dm px-1.5 py-0.5 rounded-full" style={{ fontSize: 8, fontWeight: 700, backgroundColor: "#E2E8F0", color: "#475569", letterSpacing: 0.4, textTransform: "uppercase" }}>locked</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={onBackToTab2} className="font-dm flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-white shrink-0" style={{ fontSize: 11, fontWeight: 600, color: "#1A2B4A", border: "1px solid #CBD5E1" }}>
            <ArrowLeft size={12} /> Edit in Tab 2
          </button>
        </div>
      </div>

      {/* ── SECTION B — Quotation builder ── */}
      <div className="rounded-xl border border-slate-200 overflow-hidden" style={{ backgroundColor: "white" }}>
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between" style={{ backgroundColor: "#F8FAFC" }}>
          <h4 className="font-syne" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Client-Facing Quotation</h4>
          <span className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>This is what the client will see in the formal quotation document.</span>
        </div>

        {/* Line items table */}
        <div className="px-5 py-4">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "#1A2B4A" }}>
                {[
                  { l: "NO.",         w: 50,   align: "center" },
                  { l: "QTY",         w: 70,   align: "center" },
                  { l: "UNIT",        w: 70,   align: "center" },
                  { l: "DESCRIPTION", w: "auto", align: "left"   },
                  { l: "UNIT PRICE",  w: 120,  align: "right"  },
                  { l: "TOTAL",       w: 130,  align: "right"  },
                  { l: "",            w: 36,   align: "center" },
                ].map((c) => (
                  <th key={c.l} className="font-dm py-2 px-2 text-white" style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", textAlign: c.align as any, width: c.w }}>{c.l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineItems.map((li, idx) => {
                const total = li.unitPrice * li.qty;
                const finalUnit = li.unitPrice + inclusivePerUnit;
                const finalTotal = finalUnit * li.qty;
                return (
                  <tr key={idx} style={{ borderBottom: "1px solid #E2E8F0" }}>
                    <td className="px-2 py-2 font-mono-jb" style={{ fontSize: 12, fontWeight: 700, color: "#1A2B4A", textAlign: "center" }}>{li.no}</td>
                    <td className="px-2 py-2"><input type="number" min={1} value={li.qty} onChange={(e) => updateLineItem(idx, { qty: Number(e.target.value) })} className="font-mono-jb w-full px-2 py-1 rounded border border-slate-200 bg-white outline-none focus:border-slate-400 text-center" style={{ fontSize: 12 }} /></td>
                    <td className="px-2 py-2"><input value={li.unit} onChange={(e) => updateLineItem(idx, { unit: e.target.value })} className="font-dm w-full px-2 py-1 rounded border border-slate-200 bg-white outline-none focus:border-slate-400 text-center" style={{ fontSize: 12 }} /></td>
                    <td className="px-2 py-2">
                      <input value={li.description} onChange={(e) => updateLineItem(idx, { description: e.target.value })} placeholder="e.g. FILTER BAG" className="font-dm w-full px-2 py-1 rounded border border-slate-200 bg-white outline-none focus:border-slate-400" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", textTransform: "uppercase" }} />
                      <input value={li.subDescription ?? ""} onChange={(e) => updateLineItem(idx, { subDescription: e.target.value })} placeholder="Sub-line · e.g. SIZE : 135mm × 99 INCHES" className="font-dm w-full px-2 py-1 mt-1 rounded border border-slate-200 bg-white outline-none focus:border-slate-400" style={{ fontSize: 11, color: "#475569", marginLeft: 8, width: "calc(100% - 8px)" }} />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-col items-end">
                        <input type="number" step="0.01" value={li.unitPrice} onChange={(e) => updateLineItem(idx, { unitPrice: Number(e.target.value) })} className="font-mono-jb w-full px-2 py-1 rounded border border-slate-200 bg-white outline-none focus:border-slate-400 text-right" style={{ fontSize: 12 }} />
                        {inclusivePerUnit > 0 && (
                          <span className="font-mono-jb mt-0.5" style={{ fontSize: 10, color: "#16A34A" }}>+ ₱{inclusivePerUnit.toFixed(2)} add-ons</span>
                        )}
                        <span className="font-mono-jb mt-0.5" style={{ fontSize: 11, color: "#475569" }}>= ₱{finalUnit.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 font-mono-jb" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", textAlign: "right" }}>
                      ₱{finalTotal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {inclusivePerUnit > 0 && (
                        <div className="font-mono-jb" style={{ fontSize: 10, color: "#94A3B8" }}>(base ₱{total.toFixed(2)})</div>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {lineItems.length > 1 && (
                        <button onClick={() => removeLineItem(idx)} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button onClick={addLineItem} className="mt-3 font-dm flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-slate-50" style={{ fontSize: 11, fontWeight: 700, color: "#475569", border: "1px dashed #CBD5E1" }}>
            <Plus size={11} /> Add line item
          </button>
        </div>

        {/* NOTE field */}
        <div className="px-5 pb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="font-dm" style={{ fontSize: 11, fontWeight: 800, color: "#475569", letterSpacing: 0.4, textTransform: "uppercase" }}>Note <span style={{ color: "#94A3B8", fontWeight: 600 }}>(optional)</span></label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={noteHighlighted} onChange={(e) => setNoteHighlighted(e.target.checked)} style={{ accentColor: "#FACC15" }} />
              <span className="font-dm" style={{ fontSize: 11, color: "#92400E", fontWeight: 600 }}>Highlight (yellow)</span>
            </label>
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. REPEAT ORDER · NEW ORDER · RUSH ORDER · PARTIAL DELIVERY"
            className="font-dm w-full px-3 py-2 rounded-md outline-none focus:border-slate-400"
            style={{
              fontSize: 13,
              fontWeight: noteHighlighted ? 700 : 500,
              color: "#0F172A",
              backgroundColor: noteHighlighted ? "#FEF08A" : "white",
              border: noteHighlighted ? "1px solid #FACC15" : "1px solid #E2E8F0",
            }}
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {NOTE_PRESETS.map((p) => (
              <button key={p} onClick={() => { setNote(p); setNoteHighlighted(true); }} className="font-dm flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-slate-100" style={{ fontSize: 10, fontWeight: 700, color: "#92400E", border: "1px solid #FDE68A", backgroundColor: "#FFFBEB" }}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Add-ons (Packaging + Shipping) */}
        <div className="px-5 pb-4 flex flex-col gap-3">
          {/* Packaging */}
          <AddonRow
            open={packagingOpen}
            onToggle={() => setPackagingOpen((v) => !v)}
            label="📦 Add packaging cost"
            color="#1A2B4A"
          >
            <div className="grid grid-cols-3 gap-3 items-end">
              <Field label="Box Type">
                <select value={packagingId} onChange={(e) => setPackagingId(e.target.value)} className="font-dm w-full px-2 py-1.5 rounded border border-slate-200 bg-white outline-none focus:border-slate-400" style={{ fontSize: 12 }}>
                  {packagingOptions.map((m) => <option key={m.id} value={m.id}>{m.name} (₱{m.unitPrice}/{m.unit})</option>)}
                </select>
              </Field>
              <Field label="Qty (boxes)">
                <input type="number" min={1} value={packagingQty} onChange={(e) => setPackagingQty(Number(e.target.value))} className="font-mono-jb w-full px-2 py-1.5 rounded border border-slate-200 bg-white outline-none focus:border-slate-400" style={{ fontSize: 12 }} />
              </Field>
              <div className="flex flex-col items-end">
                <span className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Cost</span>
                <span className="font-syne" style={{ fontSize: 16, fontWeight: 800, color: "#1A2B4A" }}>₱{packagingCostPerOrder.toLocaleString("en-PH")}</span>
              </div>
            </div>
            <IncludeToggle on={packagingInUnit} onChange={setPackagingInUnit} />
          </AddonRow>

          {/* Shipping */}
          <AddonRow
            open={shippingOpen}
            onToggle={() => setShippingOpen((v) => !v)}
            label="🚚 Add shipping / freight cost"
            color="#7C3AED"
          >
            <div className="grid grid-cols-3 gap-3 items-end">
              <Field label="Label" full>
                <input value={shippingLabel} onChange={(e) => setShippingLabel(e.target.value)} placeholder="e.g. Lalamove — Batangas" className="font-dm w-full px-2 py-1.5 rounded border border-slate-200 bg-white outline-none focus:border-slate-400" style={{ fontSize: 12 }} />
              </Field>
              <Field label="Amount (₱)">
                <input type="number" step="0.01" value={shippingAmount} onChange={(e) => setShippingAmount(Number(e.target.value))} className="font-mono-jb w-full px-2 py-1.5 rounded border border-slate-200 bg-white outline-none focus:border-slate-400" style={{ fontSize: 12 }} />
              </Field>
            </div>
            <IncludeToggle on={shippingInUnit} onChange={setShippingInUnit} />
          </AddonRow>
        </div>

        {/* Totals + Terms */}
        <div className="grid grid-cols-2 gap-6 px-5 pb-5">
          {/* Terms */}
          <div className="rounded-lg p-4" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
            <div className="font-dm mb-3" style={{ fontSize: 11, fontWeight: 800, color: "#0F172A", letterSpacing: 0.5, textTransform: "uppercase", borderBottom: "1.5px solid #0F172A", paddingBottom: 4 }}>Terms and Conditions</div>
            <div className="flex flex-col gap-2.5">
              <Field label="Terms of Payment">
                <select value={termsOfPayment} onChange={(e) => setTermsOfPayment(e.target.value as any)} className="font-dm w-full px-2 py-1.5 rounded border border-slate-200 bg-white outline-none focus:border-slate-400" style={{ fontSize: 12 }}>
                  <option value="15-Day Terms">15 Days</option>
                  <option value="30-Day Terms">30 Days</option>
                </select>
              </Field>
              <Field label="Time of Delivery">
                <input value={timeOfDelivery} onChange={(e) => setTimeOfDelivery(e.target.value)} className="font-dm w-full px-2 py-1.5 rounded border border-slate-200 bg-white outline-none focus:border-slate-400" style={{ fontSize: 12 }} />
              </Field>
              <Field label="Place of Delivery *">
                <input value={placeOfDelivery} onChange={(e) => setPlaceOfDelivery(e.target.value)} className="font-dm w-full px-2 py-1.5 rounded border border-slate-200 bg-white outline-none focus:border-slate-400" style={{ fontSize: 12 }} />
              </Field>
              <Field label="Validity">
                <input value={validUntil} onChange={(e) => setValidUntil(e.target.value)} placeholder="e.g. 30 days · May 26, 2026" className="font-dm w-full px-2 py-1.5 rounded border border-slate-200 bg-white outline-none focus:border-slate-400" style={{ fontSize: 12 }} />
              </Field>

              {/* ── Downpayment ── */}
              <div className="pt-2 mt-1 border-t border-slate-200 flex flex-col gap-2">
                <div className="rounded-lg p-3 flex flex-col gap-2" style={{ backgroundColor: "#EFF6FF", border: "1.5px solid #BFDBFE" }}>
                    <div className="flex items-center gap-2">
                      <span className="font-dm" style={{ fontSize: 11, color: "#1E40AF", fontWeight: 600 }}>Downpayment:</span>
                      <button
                        onClick={() => setDownpaymentPercent(20)}
                        className="font-dm px-2.5 py-1 rounded-md"
                        style={{ fontSize: 12, fontWeight: 700, backgroundColor: downpaymentPercent === 20 ? "#1D4ED8" : "white", color: downpaymentPercent === 20 ? "white" : "#1D4ED8", border: "1.5px solid #93C5FD" }}
                      >
                        20%
                      </button>
                      <button
                        onClick={() => setDownpaymentPercent(50)}
                        className="font-dm px-2.5 py-1 rounded-md"
                        style={{ fontSize: 12, fontWeight: 700, backgroundColor: downpaymentPercent === 50 ? "#1D4ED8" : "white", color: downpaymentPercent === 50 ? "white" : "#1D4ED8", border: "1.5px solid #93C5FD" }}
                      >
                        50%
                      </button>
                    </div>
                    <div className="font-dm" style={{ fontSize: 12, color: "#1E3A8A" }}>
                      <span style={{ fontWeight: 600 }}>Amount due before production: </span>
                      <span className="font-mono-jb" style={{ fontWeight: 800, fontSize: 14, color: "#1D4ED8" }}>
                        ₱{(grandTotal * (downpaymentPercent / 100)).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span style={{ color: "#60A5FA", fontSize: 11, marginLeft: 4 }}>({downpaymentPercent}% of ₱{grandTotal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
                    </div>
                    <div className="font-dm" style={{ fontSize: 10, color: "#3B82F6", lineHeight: 1.5 }}>
                      This downpayment requirement will be visible to the client on their quotation document and in the Client Portal.
                    </div>
                </div>
              </div>
            </div>
          </div>
          {/* Totals */}
          <div className="rounded-lg overflow-hidden" style={{ border: "1.5px solid #1A2B4A" }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: "#1A2B4A", color: "white" }}>
              <span className="font-dm" style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", opacity: 0.7 }}>Total</span>
              <span className="font-syne" style={{ fontSize: 24, fontWeight: 800 }}>₱ {grandTotal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="px-4 py-2 flex items-center justify-end" style={{ backgroundColor: "#FEF2F2" }}>
              <span className="font-syne" style={{ fontSize: 12, fontWeight: 800, color: "#C8102E", letterSpacing: 0.6 }}>{vatLabel}</span>
            </div>
            <div className="px-4 py-3 flex flex-col gap-1 text-right" style={{ backgroundColor: "white", borderTop: "1px solid #E2E8F0" }}>
              <div className="font-dm flex items-center justify-between" style={{ fontSize: 11, color: "#64748B" }}>
                <span>Line items subtotal</span>
                <span className="font-mono-jb">₱{lineSubtotal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {separateAddons > 0 && (
                <div className="font-dm flex items-center justify-between" style={{ fontSize: 11, color: "#64748B" }}>
                  <span>Add-ons (separate)</span>
                  <span className="font-mono-jb">₱{separateAddons.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>
            <div className="px-4 py-3 flex flex-col gap-1" style={{ backgroundColor: "#EFF6FF", borderTop: "1.5px solid #BFDBFE" }}>
                <div className="font-dm flex items-center justify-between" style={{ fontSize: 11, color: "#1E40AF", fontWeight: 700 }}>
                  <span>⬇ Downpayment required ({downpaymentPercent}%)</span>
                  <span className="font-mono-jb" style={{ fontSize: 13, fontWeight: 800 }}>₱{(grandTotal * (downpaymentPercent / 100)).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="font-dm" style={{ fontSize: 10, color: "#3B82F6" }}>Balance upon delivery: <span className="font-mono-jb">₱{(grandTotal * (1 - downpaymentPercent / 100)).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION C — Terms & Conditions Notice ── */}
      <div className="rounded-xl p-4" style={{ backgroundColor: "#FFFBEB", border: "1.5px solid #FDE68A" }}>
        <div className="font-dm mb-2 flex items-center gap-2" style={{ fontSize: 11, fontWeight: 800, color: "#92400E", letterSpacing: 0.5, textTransform: "uppercase" }}>
          📋 Terms &amp; Conditions — Included with Quotation
        </div>
        <div className="flex flex-col gap-1.5 font-dm" style={{ fontSize: 12, color: "#78350F", lineHeight: 1.6 }}>
          <div>
            <span style={{ fontWeight: 700 }}>Payment:</span>{" "}Payment terms are indicated in the quotation. Required downpayments must be verified before the order proceeds.
          </div>
          <div>
            <span style={{ fontWeight: 700 }}>No Refunds:</span>{" "}All sales are final. No refunds will be issued once the order has been confirmed and processed.
          </div>
          <div>
            <span style={{ fontWeight: 700 }}>No Replacements:</span>{" "}Products are not eligible for replacement after delivery.
          </div>
          <div>
            <span style={{ fontWeight: 700 }}>Delivery:</span>{" "}Delivery arrangements and schedules are based on the confirmed order. Actual delivery may vary depending on production completion and logistics.
          </div>
          <div style={{ color: "#92400E", fontSize: 11, lineHeight: 1.7 }}>
            <div>Tel: +63 (2) 8861-5737 / +63 (2) 8653-3750 · Mobile: +63 (956) 657-3837 · Email: enterfil.filtration@yahoo.com / zuluetaellen@gmail.com</div>
            <div>Office Hours: Monday – Friday, 8:00 AM – 6:00 PM · Sitio Hulo, Brgy. Balasing – San Jose Rd, Santa Maria, 3022 Bulacan</div>
          </div>
        </div>
      </div>

      {/* ── SECTION D — Actions ── */}
      <div className="flex items-center justify-end gap-3">
        <button onClick={handlePreview} className="flex items-center gap-2 px-5 py-2.5 rounded-md font-dm hover:bg-slate-50" style={{ fontSize: 13, fontWeight: 700, color: "#1A2B4A", border: "2px solid #1A2B4A", letterSpacing: 0.4 }}>
          <Eye size={14} /> Preview Quotation
        </button>
        <button onClick={handleSend} className="flex items-center gap-2 px-5 py-2.5 rounded-md text-white font-dm hover:opacity-90" style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.4 }}>
          <Send size={14} /> Send to Client →
        </button>
      </div>

      {/* Preview modal */}
      {showPreview && (
        <QuotationPreviewModal
          inquiry={inquiry}
          doc={buildDoc()}
          vatLabel={vatLabel}
          total={grandTotal}
          preparedBy={session.name}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}

/* ─────────── helpers ─────────── */

function clientAddress(name: string): string {
  /* Best-effort default — the real backend would pull this from the client record */
  const map: Record<string, string> = {
    "B.E. Aerospace":  "Makati City",
    "Maynilad":        "Quezon City",
    "G.U. Engineering": "Cabuyao, Laguna",
    "Emerald Vinyl":   "Marikina City",
    "Monaco":          "Cebu City",
  };
  return map[name] ?? "";
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-1 ${full ? "col-span-2" : ""}`}>
      <label className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</label>
      {children}
    </div>
  );
}

function AddonRow({ open, onToggle, label, color, children }: { open: boolean; onToggle: () => void; label: string; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: open ? `1.5px solid ${color}` : "1px solid #E2E8F0" }}>
      <button onClick={onToggle} className="w-full px-4 py-2 flex items-center justify-between hover:bg-slate-50" style={{ backgroundColor: open ? `${color}10` : "white" }}>
        <span className="font-dm" style={{ fontSize: 12, fontWeight: 700, color: open ? color : "#475569" }}>{label}</span>
        {open ? <ChevronUp size={14} style={{ color }} /> : <ChevronDown size={14} style={{ color: "#94A3B8" }} />}
      </button>
      {open && <div className="p-4 flex flex-col gap-2">{children}</div>}
    </div>
  );
}

function IncludeToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(true)}
        className="font-dm px-2.5 py-1 rounded-md"
        style={{ fontSize: 11, fontWeight: 700, backgroundColor: on ? "#DCFCE7" : "white", color: on ? "#15803D" : "#475569", border: on ? "1.5px solid #86EFAC" : "1px solid #E2E8F0" }}
      >
        Include in unit price
      </button>
      <button
        onClick={() => onChange(false)}
        className="font-dm px-2.5 py-1 rounded-md"
        style={{ fontSize: 11, fontWeight: 700, backgroundColor: !on ? "#FEF3C7" : "white", color: !on ? "#92400E" : "#475569", border: !on ? "1.5px solid #FDE68A" : "1px solid #E2E8F0" }}
      >
        Show as separate line
      </button>
    </div>
  );
}
