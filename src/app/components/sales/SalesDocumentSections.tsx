import { useState } from "react";
import { ChevronLeft, ChevronRight, Eye, FileText, Search, X } from "lucide-react";
import { sumVerifiedPaymentAmounts } from "../../api/salesOrders.js";
import { useSalesOrderDetail, useSalesOrders, useSalesStockAvailability, type SalesOrderFilters, type SalesOrderItem, type SalesOrderRow, type SalesPayment, type SalesStockAvailability } from "../useSalesOrders";
import { useSalesOrderDocuments, type SalesPurchaseOrder, type SalesQuotation } from "../useSalesOrderDocuments";
import { useSalesJobOrders, type SalesJobOrder, type SalesProductionEvent } from "../useSalesJobOrders";
import { useSalesDelivery, type SalesDelivery, type SalesDeliveryReceipt, type SalesShipment } from "../useSalesDelivery";
import { QuotationPreviewModal } from "./QuotationPreviewModal";
import { POViewerModal } from "./OriginalSalesForms";
import { readyForJobOrder } from "./pipelineModel.mjs";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function fieldLabel(value: string | null | undefined) {
  return value || "Unavailable";
}

function itemDescription(item: SalesOrderItem) {
  return item.filterName || item.filterTypeCode || "Product specification";
}

export function OrderDetail({ detail, loading, error, retry, onClose, readOnly = true }: { readOnly?: boolean; detail: ReturnType<typeof useSalesOrderDetail>["data"]; loading: boolean; error: string; retry: () => void; onClose: () => void }) {
  const documents = useSalesOrderDocuments(Boolean(detail) && !loading && !error, detail?.id ?? null);
  const production = useSalesJobOrders(Boolean(detail) && !loading && !error, detail?.id ?? null);
  const delivery = useSalesDelivery(Boolean(detail) && !loading && !error, detail?.id ?? null);
  const stock = useSalesStockAvailability(Boolean(detail) && !loading && !error, detail?.id ?? null);
  const acceptedQuotation = documents.quotations.find(quotation => quotation.decision === "accepted");
  const downpaymentVerified = readyForJobOrder(detail);
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50" onClick={onClose}>
    <aside className="h-full w-full max-w-2xl overflow-auto bg-white shadow-2xl" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Order details">
      <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5">
        <div><p className="font-dm text-xs font-bold uppercase tracking-widest text-red-700">Sales order detail</p><h2 className="mt-1 font-syne text-xl font-bold text-slate-900">{detail?.reference || "Order details"}</h2></div>
        <button type="button" onClick={onClose} aria-label="Close order details" className="rounded p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
      </div>
      {loading && <div role="status" className="m-6 rounded-lg bg-slate-100 p-4 text-sm text-slate-600">Loading order details…</div>}
      {error && !loading && <div role="alert" className="m-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button type="button" onClick={retry} className="ml-3 rounded border border-red-300 px-3 py-1.5 font-semibold">Retry</button></div>}
      {detail && !loading && !error && <div className="space-y-6 p-6">
        <section className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4">
          <DetailField label="Client" value={detail.companyName} /><DetailField label="Contact" value={fieldLabel(detail.contactPerson)} />
          {detail.archiveReason==='rejected'&&<section aria-label="Inquiry rejection"><b>Rejected ? {detail.archivedAt}</b><p className="whitespace-pre-wrap">{detail.archiveNote}</p></section>}<DetailField label="Stage" value={detail.stageLabel} /><DetailField label="Record state" value={detail.archivedAt ? "Archived" : "Open"} />
          <DetailField label="Submitted" value={formatDate(detail.submittedAt)} /><DetailField label="Requested delivery" value={formatDate(detail.requestedDeliveryDate)} />
          <DetailField label="Payment terms" value={detail.paymentTermLabel} /><DetailField label="Delivery method" value={fieldLabel(detail.deliveryMethodLabel)} />
        </section>
        {detail.generalNotes && <section><h3 className="mb-2 font-dm text-xs font-bold uppercase tracking-wide text-slate-500">Order notes</h3><p className="whitespace-pre-wrap text-sm text-slate-700">{detail.generalNotes}</p></section>}
        <section><h3 className="mb-3 font-dm text-xs font-bold uppercase tracking-wide text-slate-500">Product specifications</h3>{detail.items.length ? <div className="space-y-3">{detail.items.map(item => <ItemCard key={item.id} item={item} />)}</div> : <p className="text-sm text-slate-500">No product specifications are available for this order.</p>}</section>
        <StockAvailabilitySection availability={stock.data} loading={stock.loading} error={stock.error} retry={stock.refresh} />
        <QuotationHistory quotations={documents.quotations} loading={documents.quotationsLoading} error={documents.quotationsError} retry={documents.refresh} client={{ clientName: detail.companyName, contactPerson: detail.contactPerson || "Unavailable" }} />
        <PurchaseOrderSection purchaseOrder={documents.purchaseOrder} loading={documents.purchaseOrderLoading} error={documents.purchaseOrderError} retry={documents.refresh} client={{ clientName: detail.companyName, contactPerson: detail.contactPerson || "Unavailable" }} readOnly={readOnly} processPurchaseOrder={documents.processPurchaseOrder} actionLoading={documents.purchaseOrderActionLoading} actionError={documents.purchaseOrderActionError} />
        {!readOnly && <InvoiceIssuanceSection purchaseOrder={documents.purchaseOrder} existingInvoices={detail.invoices} issuedInvoice={documents.issuedInvoice} loading={documents.invoiceActionLoading} error={documents.invoiceActionError} issueInvoice={documents.issueInvoice} />}
        <JobOrderSection jobOrders={production.jobOrders} loading={production.loading} error={production.error} retry={production.refresh} purchaseOrder={documents.purchaseOrder} invoiceIssued={detail.invoices.length > 0 || Boolean(documents.issuedInvoice)} paymentVerified={downpaymentVerified} createJobOrders={production.createJobOrders} createLoading={production.createLoading} createError={production.createError} defaultDueDate={detail.requestedDeliveryDate} readOnly={readOnly} />
        <DeliverySection delivery={delivery.data} loading={delivery.loading} error={delivery.error} retry={delivery.refresh} />
        <PaymentSection payments={detail.payments} />
        {detail.purchaseOrders.length > 0 && <section><h3 className="mb-3 text-xs font-bold uppercase text-slate-500">All returned PO records</h3>{detail.purchaseOrders.map((po: any) => <article key={po.id} className="mb-3 rounded border p-4"><div className="grid grid-cols-2 gap-3">{Object.entries(po).map(([key, value]) => <DetailField key={key} label={key} value={value as string} />)}</div></article>)}</section>}
        <section><h3 className="mb-3 text-xs font-bold uppercase text-slate-500">Invoices and order requests</h3>{detail.invoices.length ? detail.invoices.map((invoice: any) => <article key={invoice.id} className="mb-3 rounded border p-4"><h4 className="font-bold">{invoice.reference}</h4><div className="mt-3 grid grid-cols-2 gap-3">{Object.entries(invoice).map(([key, value]) => <DetailField key={key} label={key} value={value as string} />)}</div><p className="mt-3 text-xs text-slate-500">Invoice line allocation and original document preview are unavailable from the Sales API.</p></article>) : <p className="text-sm text-slate-500">No invoices returned.</p>}{detail.requests.length ? detail.requests.map((request: any) => <article key={request.id} className="mb-3 rounded border p-4"><div className="grid grid-cols-2 gap-3">{Object.entries(request).map(([key, value]) => <DetailField key={key} label={key} value={value as string} />)}</div></article>) : <p className="mt-3 text-sm text-slate-500">No order requests returned.</p>}</section>
      </div>}
    </aside>
  </div>;
}

function InvoiceIssuanceSection({ purchaseOrder, existingInvoices, issuedInvoice, loading, error, issueInvoice }: { purchaseOrder: SalesPurchaseOrder | null; existingInvoices: unknown[]; issuedInvoice: { reference: string; amount: string | number; requiredDownpayment: string | number } | null; loading: boolean; error: string; issueInvoice: () => Promise<void> }) {
  const invoice = issuedInvoice ?? (existingInvoices[0] as { reference?: string; amount?: string | number; requiredDownpayment?: string | number } | undefined);
  const canIssue = purchaseOrder?.status === "validated" && !invoice;
  return <section aria-label="Invoice issuance">
    <div className="mb-3 flex items-center justify-between"><h3 className="font-dm text-xs font-bold uppercase tracking-wide text-slate-500">Invoice and payment preparation</h3>{invoice && <span className="text-xs font-semibold text-emerald-700">Invoice issued</span>}</div>
    {invoice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><div className="grid grid-cols-2 gap-3"><DetailField label="Invoice reference" value={invoice.reference} /><DetailField label="Invoice amount" value={invoice.amount} /><DetailField label="Required downpayment" value={invoice.requiredDownpayment} /></div><p className="mt-3 text-xs text-emerald-800">Issuance does not record payment. Client payment proof remains subject to Accounting verification.</p></div> : <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">{purchaseOrder?.status !== "validated" ? "Validate the purchase order before issuing the invoice." : "No invoice has been issued for this order."}{canIssue && <button type="button" disabled={loading} onClick={() => void issueInvoice()} className="ml-3 rounded bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{loading ? "Issuing…" : "Issue invoice"}</button>}{error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}</div>}
  </section>;
}

function stockStatusLabel(status: SalesStockAvailability["overallStatus"] | SalesStockAvailability["assessments"][number]["status"]) {
  return {
    available: "Available",
    insufficient: "Insufficient stock",
    partially_available: "Partially available",
    unavailable: "Inventory unavailable",
    unmapped: "Product mapping unavailable",
    inventory_unavailable: "Inventory unavailable",
  }[status];
}

function stockQuantity(value: number | null | undefined, unit: string | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value}${unit ? ` ${unit}` : ""}`;
}

function StockAvailabilitySection({ availability, loading, error, retry }: { availability: SalesStockAvailability | null; loading: boolean; error: string; retry: () => void }) {
  return <section aria-label="Stock availability">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div><h3 className="font-dm text-xs font-bold uppercase tracking-wide text-slate-500">Stock availability check</h3><p className="mt-1 text-xs text-slate-500">Read-only assessment for the current order; no stock is reserved or changed.</p></div>
      <button type="button" onClick={retry} disabled={loading} className="shrink-0 rounded border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50">Refresh stock</button>
    </div>
    {loading && <div role="status" className="rounded-lg bg-slate-100 p-4 text-sm text-slate-600">Checking recorded inventory…</div>}
    {error && !loading && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><div>{error}</div><button type="button" onClick={retry} className="mt-3 rounded border border-red-300 px-3 py-1.5 font-semibold">Retry stock check</button></div>}
    {!loading && !error && !availability && <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Stock availability is unavailable for this order.</div>}
    {!loading && !error && availability && <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assessment</div><div className="mt-1 text-sm font-semibold text-slate-900">{stockStatusLabel(availability.overallStatus)}</div></div>
        <div className="text-right text-xs text-slate-500">Checked {formatDate(availability.checkedAt)}<div className="mt-1 font-semibold text-slate-700">Transient result · no stock changed</div></div>
      </div>
      {availability.assessments.length > 0 && <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[680px] text-left"><thead className="bg-slate-50"><tr>{["Inventory item", "Required", "Available", "Shortage", "Status"].map(label => <th key={label} className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</th>)}</tr></thead><tbody>{availability.assessments.map((item, index) => <tr key={`${item.inventoryId ?? item.itemId}-${index}`} className="border-t border-slate-100"><td className="px-3 py-3"><div className="text-sm font-semibold text-slate-800">{item.description}</div><div className="mt-1 text-xs text-slate-500">{item.classification === "finished_good" ? "Finished good" : "Raw material"}</div></td><td className="px-3 py-3 text-sm text-slate-700">{stockQuantity(item.requiredQuantity, item.unit)}</td><td className="px-3 py-3 text-sm text-slate-700">{stockQuantity(item.availableQuantity, item.unit)}</td><td className="px-3 py-3 text-sm text-slate-700">{stockQuantity(item.shortageQuantity, item.unit)}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.status === "available" ? "bg-emerald-50 text-emerald-700" : item.status === "insufficient" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{stockStatusLabel(item.status)}</span></td></tr>)}</tbody></table></div>}
      {availability.unmappedItems.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><div className="font-semibold">Some products could not be mapped to an approved BOM.</div><ul className="mt-2 list-disc space-y-1 pl-5">{availability.unmappedItems.map(item => <li key={item.itemId}>{item.filterName || item.filterTypeCode || "Product specification"}: {item.reason}</li>)}</ul></div>}
    </div>}
  </section>;
}

function PaymentSection({ payments }: { payments: SalesPayment[] }) {
  const verifiedTotal = sumVerifiedPaymentAmounts(payments);
  return <section>
    <div className="mb-3 flex items-center justify-between"><h3 className="font-dm text-xs font-bold uppercase tracking-wide text-slate-500">Payment history</h3>{payments.length > 0 && <span className="text-xs text-slate-500">{payments.length} payment{payments.length === 1 ? "" : "s"}</span>}</div>
    {payments.length === 0 ? <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No payment records are available for this order.</p> : <div className="space-y-3"><div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"><div className="font-dm text-[10px] font-semibold uppercase tracking-wide text-emerald-800">Verified payments total</div><div className="mt-1 text-lg font-bold text-emerald-950">{verifiedTotal}</div><div className="mt-1 text-xs text-emerald-800">Only payments with verification status “verified” and a verified amount are included.</div></div>{payments.map(payment => <PaymentCard key={payment.id} payment={payment} />)}</div>}
  </section>;
}

function PaymentCard({ payment }: { payment: SalesPayment }) {
  return <article className="rounded-lg border border-slate-200 p-4">
    <div className="flex items-start justify-between gap-3"><div><h4 className="font-semibold text-slate-900">{payment.paymentType || "Payment"}</h4><p className="mt-1 text-xs text-slate-500">ID {payment.id} · Invoice {payment.invoiceId || "Unavailable"}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{payment.verificationStatus || "Status unavailable"}</span></div>
    <div className="mt-4 grid grid-cols-2 gap-3"><DetailField label="Reference" value={payment.referenceNumber} /><DetailField label="Method" value={payment.method} /><DetailField label="Submitted amount" value={payment.submittedAmount} /><DetailField label="Verified amount" value={payment.verifiedAmount} /><DetailField label="Payment date" value={formatDate(payment.paidOn)} /><DetailField label="Submitted" value={formatDate(payment.submittedAt)} /><DetailField label="Reviewed" value={formatDate(payment.reviewedAt)} /></div>
  </article>;
}

function safeTrackingLink(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : null;
  } catch { return null; }
}

function DeliverySection({ delivery, loading, error, retry }: { delivery: SalesDelivery | null; loading: boolean; error: string; retry: () => void }) {
  return <section>
    <div className="mb-3 flex items-center justify-between"><h3 className="font-dm text-xs font-bold uppercase tracking-wide text-slate-500">Delivery &amp; shipment tracking</h3>{delivery && <span className="text-xs text-slate-500">{delivery.shipments.length} shipment{delivery.shipments.length === 1 ? "" : "s"}</span>}</div>
    {loading && <div role="status" className="rounded-lg bg-slate-100 p-4 text-sm text-slate-600">Loading delivery information…</div>}
    {error && !loading && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button type="button" onClick={retry} className="ml-3 rounded border border-red-300 px-3 py-1.5 font-semibold">Retry</button></div>}
    {!loading && !error && delivery && <div className="space-y-4">
      {delivery.shipments.length === 0 ? <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No shipments are associated with this order.</p> : delivery.shipments.map(shipment => <ShipmentCard key={shipment.id} shipment={shipment} waybills={delivery.waybills.filter(item => item.shipmentId === shipment.id)} receipts={delivery.deliveryReceipts.filter(item => item.shipmentId === shipment.id)} />)}
      {delivery.waybills.length === 0 && <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">No waybill information is available.</p>}
      {delivery.deliveryReceipts.length === 0 && <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">No delivery receipt is available.</p>}
    </div>}
  </section>;
}

function ShipmentCard({ shipment, waybills, receipts }: { shipment: SalesShipment; waybills: SalesDelivery["waybills"]; receipts: SalesDeliveryReceipt[] }) {
  const trackingUrl = safeTrackingLink(shipment.trackingLink);
  return <article className="rounded-lg border border-slate-200 p-4">
    <div className="flex items-start justify-between gap-3"><div><h4 className="font-semibold text-slate-900">Shipment {shipment.id}</h4><p className="mt-1 text-xs text-slate-500">Job Order {shipment.jobOrderId || "Unavailable"}</p></div><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{shipment.status || "Status unavailable"}</span></div>
    <div className="mt-4 grid grid-cols-2 gap-3"><DetailField label="Delivery method" value={shipment.deliveryMethodLabel || shipment.deliveryMethodCode} /><DetailField label="Tracking reference" value={shipment.trackingReference} /><DetailField label="Recipient" value={shipment.recipientName} /><DetailField label="Recipient phone" value={shipment.recipientPhone} /><DetailField label="Recipient email" value={shipment.recipientEmail} /><DetailField label="Delivery address" value={shipment.deliveryAddress} /><DetailField label="Estimated delivery" value={formatDate(shipment.estimatedDeliveryDate)} /><DetailField label="Expected pickup" value={formatDate(shipment.expectedPickupDate)} /><DetailField label="Dispatched" value={formatDate(shipment.dispatchedAt)} /><DetailField label="Delivered" value={formatDate(shipment.deliveredAt)} /><DetailField label="Fulfillment completed" value={formatDate(shipment.fulfillmentCompletedAt)} /><DetailField label="Driver" value={shipment.driverName} /><DetailField label="Vehicle plate" value={shipment.vehiclePlate} /></div>
    <div className="mt-4 flex flex-wrap gap-3 text-xs">{trackingUrl ? <a href={trackingUrl} target="_blank" rel="noreferrer noopener" className="font-semibold text-blue-700 underline">Open tracking link</a> : <span className="text-slate-500">Tracking link unavailable</span>}</div>
    <WaybillAndReceipts waybills={waybills} receipts={receipts} />
  </article>;
}

function WaybillAndReceipts({ waybills, receipts }: { waybills: SalesDelivery["waybills"]; receipts: SalesDeliveryReceipt[] }) {
  return <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
    <div><div className="mb-2 font-dm text-[10px] font-semibold uppercase tracking-wide text-slate-500">Waybill</div>{waybills.length ? waybills.map(waybill => <div key={waybill.id} className="rounded-md bg-slate-50 p-3 text-xs"><DetailField label="Waybill ID" value={waybill.id} /><DetailField label="Reference" value={waybill.reference} /><DetailField label="Shipment" value={waybill.shipmentId} /><DetailField label="Printed" value={formatDate(waybill.printedAt)} /></div>) : <p className="text-xs text-slate-500">No waybill information is available.</p>}</div>
    <div><div className="mb-2 font-dm text-[10px] font-semibold uppercase tracking-wide text-slate-500">Delivery receipts</div>{receipts.length ? receipts.map(receipt => <ReceiptCard key={receipt.id} receipt={receipt} />) : <p className="text-xs text-slate-500">No delivery receipt is available.</p>}</div>
  </div>;
}

function ReceiptCard({ receipt }: { receipt: SalesDeliveryReceipt }) {
  return <div className="rounded-md bg-slate-50 p-3 text-xs"><div className="grid grid-cols-2 gap-3"><DetailField label="Receipt ID" value={receipt.id} /><DetailField label="Shipment" value={receipt.shipmentId} /><DetailField label="Reference" value={receipt.reference} /><DetailField label="Generated" value={formatDate(receipt.generatedAt)} /><DetailField label="Sent to logistics" value={formatDate(receipt.sentToLogisticsAt)} /><DetailField label="Sent to client" value={formatDate(receipt.sentToClientAt)} /></div><div className="mt-3">{receipt.signedReceipts.length === 0 ? <p className="text-slate-500">No signed receipt submission is available.</p> : receipt.signedReceipts.map(signed => <div key={signed.id} className="mt-2 rounded border border-slate-200 bg-white p-2"><div className="font-semibold text-slate-700">Signed receipt metadata</div><div className="mt-1 grid grid-cols-2 gap-2 text-slate-600"><span>Filename: {signed.originalFilename || "Unavailable"}</span><span>Uploaded: {formatDate(signed.uploadedAt)}</span><span>Received: {formatDate(signed.receivedAt)}</span><span>Accepted slot: {signed.acceptedSlot || "Unavailable"}</span><span>Discarded: {formatDate(signed.discardedAt)}</span><span>File state: {signed.fileState || "Unavailable"}</span></div></div>)}</div></div>;
}

function JobOrderSection({ jobOrders, loading, error, retry, purchaseOrder, invoiceIssued, paymentVerified, createJobOrders, createLoading, createError, defaultDueDate, readOnly = true }: { readOnly?: boolean; jobOrders: SalesJobOrder[]; loading: boolean; error: string; retry: () => void; purchaseOrder: SalesPurchaseOrder | null; invoiceIssued: boolean; paymentVerified: boolean; createJobOrders: (productionDueDate: string) => Promise<void>; createLoading: boolean; createError: string; defaultDueDate: string | null }) {
  const [productionDueDate, setProductionDueDate] = useState(defaultDueDate || "");
  const [localError, setLocalError] = useState("");
  const eligible = !readOnly && purchaseOrder?.status === "validated" && invoiceIssued && paymentVerified && jobOrders.length === 0;
  const submit = async () => {
    if (!productionDueDate) { setLocalError("Select a production due date before creating the Job Order."); return; }
    setLocalError("");
    try { await createJobOrders(productionDueDate); } catch { /* hook exposes the API error */ }
  };
  return <section>
    <div className="mb-3 flex items-center justify-between"><h3 className="font-dm text-xs font-bold uppercase tracking-wide text-slate-500">Job Orders &amp; production</h3>{jobOrders.length > 0 && <span className="text-xs text-slate-500">{jobOrders.length} Job Order{jobOrders.length === 1 ? "" : "s"}</span>}</div>
    {loading && <div role="status" className="rounded-lg bg-slate-100 p-4 text-sm text-slate-600">Loading Job Orders…</div>}
    {error && !loading && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button type="button" onClick={retry} className="ml-3 rounded border border-red-300 px-3 py-1.5 font-semibold">Retry</button></div>}
    {!loading && !error && jobOrders.length === 0 && <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No Job Orders are associated with this order.</p>}
    {!loading && !error && purchaseOrder?.status === "validated" && !paymentVerified && jobOrders.length === 0 && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Awaiting Accounting verification of the required downpayment. Job Order creation remains blocked.</p>}
    {!loading && !error && purchaseOrder?.status === "validated" && !invoiceIssued && jobOrders.length === 0 && <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">An issued invoice is required before Job Order creation. Job Order creation remains blocked.</p>}
    {eligible && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm font-semibold text-emerald-900">Purchase order validated. Create the Job Order from the preserved inquiry specifications and accepted quotation quantities.</p><div className="mt-3 flex flex-wrap items-end gap-2"><label className="text-xs font-semibold text-emerald-900">Production due date<input type="date" value={productionDueDate} onChange={event => setProductionDueDate(event.target.value)} className="mt-1 block rounded border border-emerald-300 bg-white px-3 py-2 text-xs" /></label><button type="button" disabled={createLoading} onClick={() => void submit()} className="rounded bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{createLoading ? "Creating…" : "Create Job Order"}</button></div>{(localError || createError) && <p role="alert" className="mt-2 text-xs text-red-700">{localError || createError}</p>}<p className="mt-2 text-xs text-emerald-800">Creation starts the Job Order at its initial status only. Inventory is not deducted and production is not started.</p></div>}
    {!loading && !error && jobOrders.length > 0 && <div className="space-y-3">{jobOrders.map(jobOrder => <JobOrderCard key={jobOrder.id} jobOrder={jobOrder} />)}</div>}
  </section>;
}

function JobOrderCard({ jobOrder }: { jobOrder: SalesJobOrder }) {
  const currentStage = jobOrder.currentStageLabel || `No stage label for cursor ${jobOrder.currentStageCursor ?? "unavailable"}`;
  return <article className="rounded-lg border border-slate-200 p-4">
    <div className="flex items-start justify-between gap-3"><div><h4 className="font-semibold text-slate-900">{jobOrder.reference || "Job Order"}</h4><p className="mt-1 text-xs text-slate-500">ID {jobOrder.id} · Quantity {jobOrder.quantity}</p></div><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{jobOrder.status || "Status unavailable"}</span></div>
    <div className="mt-4 grid grid-cols-2 gap-3"><DetailField label="Related order item" value={jobOrder.orderItemId} /><DetailField label="Specification" value={jobOrder.specificationId} /><DetailField label="Replacement request" value={jobOrder.replacementRequestId} /><DetailField label="Production due" value={formatDate(jobOrder.productionDueDate)} /><DetailField label="Current stage" value={currentStage} /><DetailField label="Stage cursor" value={jobOrder.currentStageCursor == null ? "Unavailable" : String(jobOrder.currentStageCursor)} /><DetailField label="Materials deducted" value={formatDate(jobOrder.materialsDeductedAt)} /><DetailField label="Completed" value={formatDate(jobOrder.completedAt)} /><DetailField label="Created" value={formatDate(jobOrder.createdAt)} /><DetailField label="BOM lines" value={String(jobOrder.bomLineCount)} /></div>
    <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold"><span className={`rounded-full px-2 py-1 ${jobOrder.paused ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{jobOrder.paused ? "Paused" : "Not paused"}</span>{jobOrder.paused && <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800">{jobOrder.pauseReason || "Pause reason unavailable"}</span>}</div>
    <ProductionEvents events={jobOrder.productionEvents} />
  </article>;
}

function ProductionEvents({ events }: { events: SalesProductionEvent[] }) {
  if (events.length === 0) return <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-slate-500">No production events are available.</div>;
  return <div className="mt-4"><div className="mb-2 font-dm text-[10px] font-semibold uppercase tracking-wide text-slate-500">Production events</div><div className="space-y-2">{events.map(event => <div key={event.id} className="rounded-md bg-slate-50 p-3 text-xs"><div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-800">{event.action || "Event"}</span><span className="text-slate-500">{formatDate(event.occurredAt)}</span></div><div className="mt-1 text-slate-600">Stage {event.stagePosition == null ? "unavailable" : event.stagePosition}{event.stageLabel ? ` · ${event.stageLabel}` : " · label unavailable"}</div>{event.reason && <div className="mt-1 text-slate-500">Reason: {event.reason}</div>}</div>)}</div></div>;
}

export function QuotationHistory({ quotations, loading, error, retry, client }: { quotations: SalesQuotation[]; loading: boolean; error: string; retry: () => void; client: { clientName: string; contactPerson: string } }) {
  return <section>
    <div className="mb-3 flex items-center justify-between"><h3 className="font-dm text-xs font-bold uppercase tracking-wide text-slate-500">Quotation history</h3>{quotations.length > 0 && <span className="text-xs text-slate-500">{quotations.length} revision{quotations.length === 1 ? "" : "s"}</span>}</div>
    {loading && <div role="status" className="rounded-lg bg-slate-100 p-4 text-sm text-slate-600">Loading quotation history…</div>}
    {error && !loading && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button type="button" onClick={retry} className="ml-3 rounded border border-red-300 px-3 py-1.5 font-semibold">Retry</button></div>}
    {!loading && !error && quotations.length === 0 && <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No quotations are associated with this order.</p>}
    {!loading && !error && quotations.length > 0 && <div className="space-y-3">{quotations.map(quotation => <QuotationCard key={quotation.id} quotation={quotation} client={client} />)}</div>}
  </section>;
}

export function QuotationCard({ quotation, client }: { quotation: SalesQuotation; client: { clientName: string; contactPerson: string } }) {
  const [preview, setPreview] = useState(false);
  const previewDoc = {
    quotationNo: quotation.reference, date: quotation.issuedOn || "Unavailable", validUntil: quotation.validUntil || "Unavailable",
    lineItems: quotation.lines.map(line => ({ no: line.lineNumber, qty: line.quantity, unit: line.unitLabel, description: line.description, subDescription: line.subDescription || undefined, unitPrice: line.unitPrice ?? "Unavailable" })),
    note: quotation.note || "", noteHighlighted: quotation.noteHighlighted, termsOfPayment: quotation.paymentTermLabel || quotation.paymentTermCode || "Unavailable",
    timeOfDelivery: quotation.timeOfDelivery || "", placeOfDelivery: quotation.placeOfDelivery || "Unavailable", preparedBy: "Unavailable",
    downpaymentPercent: quotation.downpaymentPercent ?? undefined, downpaymentAmount: quotation.downpaymentAmount ?? undefined,
  };
  const previewInquiry = { code: "", ...client, products: [], paymentTerms: previewDoc.termsOfPayment };
  return <article className="rounded-lg border border-slate-200 p-4">
    <button onClick={() => setPreview(true)} className="mb-3 rounded border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">Preview {quotation.reference}</button>
    {preview && <QuotationPreviewModal inquiry={previewInquiry as any} doc={previewDoc as any} total={(quotation.totalAmount ?? "Unavailable") as number} vatLabel="See server costing records for VAT" preparedBy="Unavailable from Sales API" serverRecord onClose={() => setPreview(false)} />}
    <div className="flex items-start justify-between gap-3">
      {quotation.decision && <div className={`mb-2 rounded px-2 py-1 text-xs font-semibold ${quotation.decision === "accepted" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>Client decision: {quotation.decision === "accepted" ? "Accepted" : "Rejected"}{quotation.decisionReason ? ` · ${quotation.decisionReason}` : ""}</div>}
      {quotation.downpaymentValid === false && <div className="mb-2 rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">Mandatory 20% or 50% downpayment is missing or invalid.</div>}
      <div><div className="flex items-center gap-2"><FileText size={15} className="text-slate-500" /><h4 className="font-semibold text-slate-900">{quotation.reference}</h4><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">Revision {quotation.revisionNumber}</span></div><p className="mt-1 text-xs text-slate-500">Status: {quotation.status || "Unavailable"} · {quotation.sent ? "Sent" : "Not sent"}</p></div>
      <div className="text-right text-sm font-semibold text-slate-900">{quotation.totalAmount ?? "Unavailable"}</div>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3"><DetailField label="Issued" value={formatDate(quotation.issuedOn)} /><DetailField label="Valid until" value={formatDate(quotation.validUntil)} /><DetailField label="Payment terms" value={quotation.paymentTermLabel || quotation.paymentTermCode} /><DetailField label="Sent" value={formatDate(quotation.sentAt)} /><DetailField label="Delivery terms" value={quotation.timeOfDelivery} /><DetailField label="Place of delivery" value={quotation.placeOfDelivery} /><DetailField label="Downpayment" value={quotation.downpaymentAmount == null ? "Unavailable" : `${quotation.downpaymentPercent ?? "Unavailable"}% · ${quotation.downpaymentAmount}`} /><DetailField label="Stock checked" value={formatDate(quotation.stockCheckedAt)} /></div>
    {quotation.note && <div className={`mt-4 rounded-md p-3 text-sm ${quotation.noteHighlighted ? "border border-amber-200 bg-amber-50 text-amber-950" : "bg-slate-50 text-slate-700"}`}>{quotation.note}</div>}
    <QuotationLines quotation={quotation} />
    {(quotation.discounts.length > 0 || quotation.addons.length > 0 || quotation.costing.length > 0) && <div className="mt-4 space-y-3 text-xs text-slate-600"><div className="font-semibold uppercase tracking-wide text-slate-500">Costing summary</div>{quotation.costing.length > 0 && <div className="space-y-1"><div className="font-semibold text-slate-700">Costing lines</div>{quotation.costing.map(item => <div key={item.id} className="rounded bg-slate-50 p-2">Unit price: {item.calculatedUnitPrice ?? "Unavailable"} · Labor: {item.laborCost ?? "Unavailable"} · Markup: {item.markupPercent ?? "Unavailable"}% · Discount: {item.discountPercent ?? "Unavailable"}%</div>)}</div>}{quotation.discounts.length > 0 && <div className="space-y-1"><div className="font-semibold text-slate-700">Discounts</div>{quotation.discounts.map((discount, index) => <div key={`${discount.lineNumber}-${index}`} className="rounded bg-slate-50 p-2">{discount.label}: {discount.percent}%</div>)}</div>}{quotation.addons.length > 0 && <div className="space-y-1"><div className="font-semibold text-slate-700">Add-ons</div>{quotation.addons.map(addon => <div key={addon.id} className="rounded bg-slate-50 p-2">{addon.label} · Qty {addon.quantity} · Unit price {addon.unitPrice} · {addon.includeInUnitPrice ? "Included in unit price" : "Separate charge"}</div>)}</div>}</div>}
    <MetadataFiles files={quotation.files} label="Quotation files" />
  </article>;
}

function QuotationLines({ quotation }: { quotation: SalesQuotation }) {
  if (quotation.lines.length === 0) return <p className="mt-4 text-xs text-slate-500">No quotation line items are available.</p>;
  return <div className="mt-4"><div className="mb-2 font-dm text-[10px] font-semibold uppercase tracking-wide text-slate-500">Line items</div><div className="space-y-2">{quotation.lines.map(line => <div key={line.id} className="rounded-md bg-slate-50 p-3 text-xs"><div className="flex justify-between gap-3"><span className="font-semibold text-slate-800">{line.description}</span><span className="text-slate-600">Qty {line.quantity}</span></div>{line.subDescription && <div className="mt-1 text-slate-500">{line.subDescription}</div>}<div className="mt-1 text-slate-500">Unit price: {line.unitPrice ?? "Unavailable"} {line.unitLabel || ""}</div></div>)}</div></div>;
}

export function PurchaseOrderSection({ purchaseOrder, loading, error, retry, client, processPurchaseOrder, actionLoading, actionError, readOnly = false }: { readOnly?: boolean; purchaseOrder: SalesPurchaseOrder | null; loading: boolean; error: string; retry: () => void; client: { clientName: string; contactPerson: string }; processPurchaseOrder: (decision: "validated" | "rejected", reason?: string) => Promise<void>; actionLoading: boolean; actionError: string }) {
  const [preview, setPreview] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [localActionError, setLocalActionError] = useState("");
  const canProcess = !readOnly && (purchaseOrder?.status === "received" || purchaseOrder?.status === "pending");
  const submitDecision = async (decision: "validated" | "rejected") => {
    if (decision === "rejected" && !rejectionReason.trim()) {
      setLocalActionError("Provide a reason before rejecting this purchase order.");
      return;
    }
    setLocalActionError("");
    try {
      await processPurchaseOrder(decision, rejectionReason.trim() || undefined);
      setRejectionReason("");
    } catch {
      // The hook exposes the authenticated API error beside the controls.
    }
  };
  return <section>
    {purchaseOrder && !loading && !error && <button onClick={() => setPreview(true)} className="mb-3 rounded border border-green-200 px-3 py-1.5 text-xs font-semibold text-green-700">View PO</button>}
    {preview && purchaseOrder && <POViewerModal inquiry={{ ...client, code: purchaseOrder.reference, poNumber: purchaseOrder.clientReference || purchaseOrder.reference, poFileName: purchaseOrder.files.map(file => file.originalFilename).filter(Boolean).join(", ") || undefined, poUploadedAt: purchaseOrder.uploadedAt || undefined, products: [] } as any} onClose={() => setPreview(false)} />}
    <h3 className="mb-3 font-dm text-xs font-bold uppercase tracking-wide text-slate-500">Purchase order</h3>
    {loading && <div role="status" className="rounded-lg bg-slate-100 p-4 text-sm text-slate-600">Loading purchase-order information…</div>}
    {error && !loading && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button type="button" onClick={retry} className="ml-3 rounded border border-red-300 px-3 py-1.5 font-semibold">Retry</button></div>}
    {!loading && !error && !purchaseOrder && <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No purchase order is associated with this order.</p>}
    {!loading && !error && purchaseOrder && <div className="rounded-lg border border-slate-200 p-4"><div className="grid grid-cols-2 gap-3"><DetailField label="Reference" value={purchaseOrder.reference} /><DetailField label="Client reference" value={purchaseOrder.clientReference} /><DetailField label="Accepted quotation" value={purchaseOrder.acceptedQuotationReference || purchaseOrder.acceptedQuotationId} /><DetailField label="Uploaded" value={formatDate(purchaseOrder.uploadedAt)} /><DetailField label="Received" value={purchaseOrder.receivedAt ? formatDate(purchaseOrder.receivedAt) : "Not received"} /><DetailField label="Cleared" value={purchaseOrder.clearedAt ? formatDate(purchaseOrder.clearedAt) : "Not cleared"} /><DetailField label="Processing status" value={purchaseOrder.status || "Unavailable"} /></div><div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold"><span className={`rounded-full px-2 py-1 ${purchaseOrder.received ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{purchaseOrder.received ? "Received" : "Not received"}</span><span className={`rounded-full px-2 py-1 ${purchaseOrder.cleared ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{purchaseOrder.cleared ? "Cleared" : "Not cleared"}</span></div>{purchaseOrder.decisionReason && <p className="mt-3 rounded bg-red-50 p-3 text-xs text-red-800">Decision reason: {purchaseOrder.decisionReason}</p>}{canProcess && <div className="mt-4 border-t border-slate-100 pt-4"><p className="text-xs text-slate-500">Review the received purchase-order reference against the accepted quotation. No inventory or Job Order is created by this action.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={actionLoading} onClick={() => void submitDecision("validated")} className="rounded bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{actionLoading ? "Saving…" : "Validate purchase order"}</button><input value={rejectionReason} onChange={event => setRejectionReason(event.target.value)} placeholder="Rejection reason" aria-label="Purchase order rejection reason" className="min-w-[220px] flex-1 rounded border border-slate-200 px-3 py-2 text-xs" /><button type="button" disabled={actionLoading} onClick={() => void submitDecision("rejected")} className="rounded border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">Reject purchase order</button></div>{(localActionError || actionError) && <p role="alert" className="mt-2 text-xs text-red-700">{localActionError || actionError}</p>}</div>}<MetadataFiles files={purchaseOrder.files} label="Purchase-order files" /></div>}
  </section>;
}

function MetadataFiles({ files, label }: { files: { id: string; purchaseOrderId?: string | null; originalFilename?: string | null; mimeType?: string | null; sizeBytes?: string | number | null; state?: string | null; uploadedAt?: string | null }[]; label: string }) {
  return <div className="mt-4"><div className="mb-2 font-dm text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>{files.length === 0 ? <p className="text-xs text-slate-500">No file metadata available.</p> : <div className="space-y-2">{files.map(file => <div key={file.id} className="rounded-md bg-slate-50 p-3 text-xs text-slate-700"><div className="font-semibold">{file.originalFilename || "Unnamed file"}</div><div className="mt-1 text-slate-500">{file.mimeType || "Type unavailable"} · {file.sizeBytes == null ? "Size unavailable" : `${file.sizeBytes} bytes`} · {file.state || "State unavailable"}</div><div className="mt-1 text-slate-500">Uploaded {formatDate(file.uploadedAt)}</div>{file.purchaseOrderId ? <a className="mt-2 inline-block font-semibold text-blue-700 underline" href={`/api/documents/sales/purchase-order-files/${encodeURIComponent(file.id)}?purchaseOrderId=${encodeURIComponent(file.purchaseOrderId)}`} target="_blank" rel="noreferrer">Open securely</a> : <div className="mt-2 italic text-slate-500">Preview is unavailable for this document type.</div>}</div>)}</div>}</div>;
}

function ItemCard({ item }: { item: SalesOrderItem }) {
  const specs = Object.entries(item).filter(([key, value]) => !["id", "quantity", "filterName"].includes(key) && value != null).map(([key, value]) => [key, String(value)]);
  return <div className="rounded-lg border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><h4 className="font-semibold text-slate-900">{itemDescription(item)}</h4><p className="text-xs text-slate-500">Quantity: {item.quantity}</p></div></div>{specs.length > 0 && <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">{specs.map(([label, value]) => <DetailField key={label} label={label} value={value} />)}</div>}</div>;
}

function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div><div className="font-dm text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-sm text-slate-800">{value == null || value === "" ? "Unavailable" : value}</div></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200/70 bg-white p-4"><div className="font-dm text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 font-syne text-2xl font-bold text-slate-900">{value}</div></div>;
}
