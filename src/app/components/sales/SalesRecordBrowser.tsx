import { useState } from "react";
import { ChevronLeft, ChevronRight, Eye, FileText, Search, X } from "lucide-react";
import { sumVerifiedPaymentAmounts } from "../../api/salesOrders.js";
import { useSalesOrderDetail, useSalesOrders, type SalesOrderFilters, type SalesOrderItem, type SalesOrderRow, type SalesPayment } from "../useSalesOrders";
import { useSalesOrderDocuments, type SalesPurchaseOrder, type SalesQuotation } from "../useSalesOrderDocuments";
import { useSalesJobOrders, type SalesJobOrder, type SalesProductionEvent } from "../useSalesJobOrders";
import { useSalesDelivery, type SalesDelivery, type SalesDeliveryReceipt, type SalesShipment } from "../useSalesDelivery";
import { QuotationPreviewModal } from "./QuotationPreviewModal";
import { POViewerModal } from "./OriginalSalesForms";

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

const stages: { value: SalesOrderFilters["stage"]; label: string }[] = [
  { value: "all", label: "All stages" },
  { value: "in_production", label: "In production" },
  { value: "quality_inspection", label: "Quality inspection" },
  { value: "ready_for_dispatch", label: "Ready for dispatch" },
  { value: "dispatched", label: "Dispatched" },
  { value: "delivered", label: "Delivered" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

function recordStatusLabel(row: SalesOrderRow) {
  if (row.archiveReason === "rejected") return "Rejected inquiry";
  if (row.archiveReason === "cancelled") return "Cancelled";
  if (row.fulfillmentCompletedAt || row.stageCode === "paid") return "Completed";
  return row.archivedAt ? "Archived" : "Active";
}

type BookkeepingDocumentType = "all" | "quotation" | "purchase-order" | "job-order" | "invoice";
const bookkeepingDocumentTypes: { value: BookkeepingDocumentType; label: string }[] = [
  { value: "all", label: "All Documents" },
  { value: "quotation", label: "Quotation" },
  { value: "purchase-order", label: "Purchase Order" },
  { value: "job-order", label: "Job Order" },
  { value: "invoice", label: "Invoice" },
];
function documentTypesFor(row: SalesOrderRow): BookkeepingDocumentType[] {
  const types: BookkeepingDocumentType[] = [];
  if (row.latestQuotationReference) types.push("quotation");
  if (row.purchaseOrderReference) types.push("purchase-order");
  if (row.jobOrderCount > 0) types.push("job-order");
  if (row.invoiceReference) types.push("invoice");
  return types;
}

export function SalesRecordBrowser() {
  const [filters, setFilters] = useState<SalesOrderFilters>({ q: "", status: "all", stage: "all", sort: "submitted-desc", page: 1, pageSize: 25 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recordStatus, setRecordStatus] = useState("all");
  const [documentType, setDocumentType] = useState<BookkeepingDocumentType>("all");
  const remote = useSalesOrders(true, filters);
  const detail = useSalesOrderDetail(true, selectedId);
  const allRows = remote.data?.items ?? [];
  const rows = allRows.filter(row => {
    const lifecycleMatches = recordStatus === "all" || (recordStatus === "active" && !row.archivedAt && !row.fulfillmentCompletedAt) || (recordStatus === "completed" && (Boolean(row.fulfillmentCompletedAt) || row.stageCode === "paid")) || (recordStatus === "cancelled" && row.archiveReason === "cancelled");
    return lifecycleMatches && (documentType === "all" || documentTypesFor(row).includes(documentType));
  });
  const total = recordStatus === "all" && documentType === "all" ? (remote.data?.total ?? 0) : rows.length;
  const currentPage = remote.data?.page ?? filters.page;
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));

  const updateFilter = <K extends keyof SalesOrderFilters>(key: K, value: SalesOrderFilters[K]) => {
    setFilters(current => ({ ...current, [key]: value, page: key === "page" ? value as number : 1 }));
  };

  return (
    <main className="flex-1 h-full overflow-auto" style={{ backgroundColor: "#F4F6F9" }}>
      <header className="bg-white border-b border-slate-200/70 px-8 py-5 sticky top-0 z-10 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>Sales &amp; Orders</h1>
          <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>Authenticated quotation, purchase order, Job Order, and invoice register.</p>
        </div>
      </header>

      <div className="hidden">
        <div className="grid grid-cols-3 gap-4">
          <Metric label="Records on current result" value={remote.loading || remote.error || !remote.data ? "—" : String(remote.data.items.length)} />
          <Metric label="Total matching records" value={remote.loading || remote.error || !remote.data ? "—" : String(total)} />
          <Metric label="Current page" value={remote.loading || remote.error || !remote.data ? "—" : `${currentPage} / ${pageCount}`} />
        </div>
      </div>

      <div className="px-8 py-6">
        <section className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative min-w-[240px] flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
              <input value={filters.q} onChange={event => updateFilter("q", event.target.value)} placeholder="Search reference, client, contact, or ID" className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 font-dm text-sm outline-none" />
            </label>
            <select aria-label="Order status" value={filters.status} onChange={event => updateFilter("status", event.target.value as SalesOrderFilters["status"])} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-dm text-sm">
              <option value="all">All Statuses</option><option value="open">Open Records</option><option value="archived">Archived Records</option>
            </select>
            <select aria-label="Document type" value={documentType} onChange={event => { setDocumentType(event.target.value as BookkeepingDocumentType); updateFilter("page", 1); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-dm text-sm">
              {bookkeepingDocumentTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
            <select aria-label="Order stage" value={filters.stage} onChange={event => updateFilter("stage", event.target.value as SalesOrderFilters["stage"])} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-dm text-sm">
              {stages.map(stage => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
            </select>
            <select aria-label="Record lifecycle" value={recordStatus} onChange={event => setRecordStatus(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-dm text-sm">
              <option value="all">All records</option><option value="active">Active and progressing</option><option value="completed">Completed orders</option><option value="cancelled">Cancelled records</option>
            </select>
            <select aria-label="Order sort" value={filters.sort} onChange={event => updateFilter("sort", event.target.value as SalesOrderFilters["sort"])} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-dm text-sm">
              <option value="submitted-desc">Newest submitted</option><option value="submitted-asc">Oldest submitted</option>
              <option value="client-asc">Client A–Z</option><option value="client-desc">Client Z–A</option>
              <option value="id-asc">ID ascending</option><option value="id-desc">ID descending</option>
            </select>
          </div>

          {remote.loading && <div role="status" className="mt-4 rounded-lg bg-slate-100 p-4 text-sm text-slate-600">Loading Sales orders…</div>}
          {remote.error && !remote.loading && <div role="alert" className="mt-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span>{remote.error}</span><button type="button" onClick={remote.refresh} className="rounded border border-red-300 px-3 py-1.5 font-semibold">Retry</button></div>}

          {!remote.loading && !remote.error && (
            rows.length ? <OrderTable rows={rows} onSelect={setSelectedId} /> : <div className="py-16 text-center text-sm text-slate-500">No inquiries or orders match the current filters.</div>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 font-dm text-xs text-slate-500">
            <span>{total === 0 ? "Showing 0 results" : `Showing ${(currentPage - 1) * filters.pageSize + 1}–${Math.min(currentPage * filters.pageSize, total)} of ${total}`}</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={currentPage <= 1 || remote.loading} onClick={() => updateFilter("page", currentPage - 1)} className="inline-flex items-center gap-1 rounded border border-slate-200 px-3 py-1.5 disabled:opacity-50"><ChevronLeft size={14} /> Previous</button>
              <button type="button" disabled={currentPage >= pageCount || remote.loading} onClick={() => updateFilter("page", currentPage + 1)} className="inline-flex items-center gap-1 rounded border border-slate-200 px-3 py-1.5 disabled:opacity-50">Next <ChevronRight size={14} /></button>
            </div>
          </div>
        </section>
      </div>

      {selectedId && <OrderDetail detail={detail.data} loading={detail.loading} error={detail.error} retry={detail.retry} onClose={() => setSelectedId(null)} />}
    </main>
  );
}

function OrderTable({ rows, onSelect }: { rows: SalesOrderRow[]; onSelect: (id: string) => void }) {
  return <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
    <table className="w-full min-w-[900px]">
      <thead className="bg-slate-50"><tr>{["Order reference", "Client", "Documents", "Stage", "Submitted", "Status", ""].map(label => <th key={label} className="px-3 py-3 text-left font-dm text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</th>)}</tr></thead>
      <tbody>
        {rows.map(row => <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
          <td className="px-3 py-3 font-mono text-xs font-semibold text-slate-800">{row.reference}</td>
          <td className="px-3 py-3 text-sm text-slate-700">{row.companyName}<div className="text-xs text-slate-400">{row.contactPerson || "—"}</div></td>
          <td className="px-3 py-3"><div className="flex max-w-xs flex-wrap gap-1.5">{documentTypesFor(row).length ? documentTypesFor(row).map(type => <span key={type} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">{bookkeepingDocumentTypes.find(item => item.value === type)?.label}</span>) : <span className="text-xs text-slate-500">No document metadata</span>}</div></td>
          <td className="px-3 py-3"><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{row.stageLabel}</span></td>
          <td className="px-3 py-3 text-xs text-slate-600">{formatDate(row.submittedAt)}</td>
          <td className="px-3 py-3 text-xs font-semibold">{recordStatusLabel(row)}</td>
          <td className="px-3 py-3"><button type="button" aria-label={`View ${row.reference}`} onClick={() => onSelect(row.id)} className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"><Eye size={13} /> View</button></td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}

export function OrderDetail({ detail, loading, error, retry, onClose }: { detail: ReturnType<typeof useSalesOrderDetail>["data"]; loading: boolean; error: string; retry: () => void; onClose: () => void }) {
  const documents = useSalesOrderDocuments(Boolean(detail) && !loading && !error, detail?.id ?? null);
  const production = useSalesJobOrders(Boolean(detail) && !loading && !error, detail?.id ?? null);
  const delivery = useSalesDelivery(Boolean(detail) && !loading && !error, detail?.id ?? null);
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
        <QuotationHistory quotations={documents.quotations} loading={documents.quotationsLoading} error={documents.quotationsError} retry={documents.refresh} client={{ clientName: detail.companyName, contactPerson: detail.contactPerson || "Unavailable" }} />
        <PurchaseOrderSection purchaseOrder={documents.purchaseOrder} loading={documents.purchaseOrderLoading} error={documents.purchaseOrderError} retry={documents.refresh} client={{ clientName: detail.companyName, contactPerson: detail.contactPerson || "Unavailable" }} />
        <JobOrderSection jobOrders={production.jobOrders} loading={production.loading} error={production.error} retry={production.refresh} />
        <DeliverySection delivery={delivery.data} loading={delivery.loading} error={delivery.error} retry={delivery.refresh} />
        <PaymentSection payments={detail.payments} />
        {detail.purchaseOrders.length > 0 && <section><h3 className="mb-3 text-xs font-bold uppercase text-slate-500">All returned PO records</h3>{detail.purchaseOrders.map((po: any) => <article key={po.id} className="mb-3 rounded border p-4"><div className="grid grid-cols-2 gap-3">{Object.entries(po).map(([key, value]) => <DetailField key={key} label={key} value={value as string} />)}</div></article>)}</section>}
        <section><h3 className="mb-3 text-xs font-bold uppercase text-slate-500">Invoices and order requests</h3>{detail.invoices.length ? detail.invoices.map((invoice: any) => <article key={invoice.id} className="mb-3 rounded border p-4"><h4 className="font-bold">{invoice.reference}</h4><div className="mt-3 grid grid-cols-2 gap-3">{Object.entries(invoice).map(([key, value]) => <DetailField key={key} label={key} value={value as string} />)}</div><p className="mt-3 text-xs text-slate-500">Invoice line allocation and original document preview are unavailable from the Sales API.</p></article>) : <p className="text-sm text-slate-500">No invoices returned.</p>}{detail.requests.length ? detail.requests.map((request: any) => <article key={request.id} className="mb-3 rounded border p-4"><div className="grid grid-cols-2 gap-3">{Object.entries(request).map(([key, value]) => <DetailField key={key} label={key} value={value as string} />)}</div></article>) : <p className="mt-3 text-sm text-slate-500">No order requests returned.</p>}</section>
      </div>}
    </aside>
  </div>;
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

function JobOrderSection({ jobOrders, loading, error, retry }: { jobOrders: SalesJobOrder[]; loading: boolean; error: string; retry: () => void }) {
  return <section>
    <div className="mb-3 flex items-center justify-between"><h3 className="font-dm text-xs font-bold uppercase tracking-wide text-slate-500">Job Orders &amp; production</h3>{jobOrders.length > 0 && <span className="text-xs text-slate-500">{jobOrders.length} Job Order{jobOrders.length === 1 ? "" : "s"}</span>}</div>
    {loading && <div role="status" className="rounded-lg bg-slate-100 p-4 text-sm text-slate-600">Loading Job Orders…</div>}
    {error && !loading && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button type="button" onClick={retry} className="ml-3 rounded border border-red-300 px-3 py-1.5 font-semibold">Retry</button></div>}
    {!loading && !error && jobOrders.length === 0 && <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No Job Orders are associated with this order.</p>}
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

function QuotationHistory({ quotations, loading, error, retry, client }: { quotations: SalesQuotation[]; loading: boolean; error: string; retry: () => void; client: { clientName: string; contactPerson: string } }) {
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

export function PurchaseOrderSection({ purchaseOrder, loading, error, retry, client }: { purchaseOrder: SalesPurchaseOrder | null; loading: boolean; error: string; retry: () => void; client: { clientName: string; contactPerson: string } }) {
  const [preview, setPreview] = useState(false);
  return <section>
    {purchaseOrder && !loading && !error && <button onClick={() => setPreview(true)} className="mb-3 rounded border border-green-200 px-3 py-1.5 text-xs font-semibold text-green-700">View PO</button>}
    {preview && purchaseOrder && <POViewerModal inquiry={{ ...client, code: purchaseOrder.reference, poNumber: purchaseOrder.clientReference || purchaseOrder.reference, poFileName: purchaseOrder.files.map(file => file.originalFilename).filter(Boolean).join(", ") || undefined, poUploadedAt: purchaseOrder.uploadedAt || undefined, products: [] } as any} onClose={() => setPreview(false)} />}
    <h3 className="mb-3 font-dm text-xs font-bold uppercase tracking-wide text-slate-500">Purchase order</h3>
    {loading && <div role="status" className="rounded-lg bg-slate-100 p-4 text-sm text-slate-600">Loading purchase-order information…</div>}
    {error && !loading && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button type="button" onClick={retry} className="ml-3 rounded border border-red-300 px-3 py-1.5 font-semibold">Retry</button></div>}
    {!loading && !error && !purchaseOrder && <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No purchase order is associated with this order.</p>}
    {!loading && !error && purchaseOrder && <div className="rounded-lg border border-slate-200 p-4"><div className="grid grid-cols-2 gap-3"><DetailField label="Reference" value={purchaseOrder.reference} /><DetailField label="Client reference" value={purchaseOrder.clientReference} /><DetailField label="Accepted quotation" value={purchaseOrder.acceptedQuotationReference || purchaseOrder.acceptedQuotationId} /><DetailField label="Uploaded" value={formatDate(purchaseOrder.uploadedAt)} /><DetailField label="Received" value={purchaseOrder.receivedAt ? formatDate(purchaseOrder.receivedAt) : "Not received"} /><DetailField label="Cleared" value={purchaseOrder.clearedAt ? formatDate(purchaseOrder.clearedAt) : "Not cleared"} /></div><div className="mt-4 flex gap-2 text-xs font-semibold"><span className={`rounded-full px-2 py-1 ${purchaseOrder.received ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{purchaseOrder.received ? "Received" : "Not received"}</span><span className={`rounded-full px-2 py-1 ${purchaseOrder.cleared ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{purchaseOrder.cleared ? "Cleared" : "Not cleared"}</span></div><MetadataFiles files={purchaseOrder.files} label="Purchase-order files" /></div>}
  </section>;
}

function MetadataFiles({ files, label }: { files: { id: string; originalFilename?: string | null; mimeType?: string | null; sizeBytes?: string | number | null; state?: string | null; uploadedAt?: string | null }[]; label: string }) {
  return <div className="mt-4"><div className="mb-2 font-dm text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>{files.length === 0 ? <p className="text-xs text-slate-500">No file metadata available.</p> : <div className="space-y-2">{files.map(file => <div key={file.id} className="rounded-md bg-slate-50 p-3 text-xs text-slate-700"><div className="font-semibold">{file.originalFilename || "Unnamed file"}</div><div className="mt-1 text-slate-500">{file.mimeType || "Type unavailable"} · {file.sizeBytes == null ? "Size unavailable" : `${file.sizeBytes} bytes`} · {file.state || "State unavailable"}</div><div className="mt-1 text-slate-500">Uploaded {formatDate(file.uploadedAt)}</div><div className="mt-2 italic text-slate-500">Preview and download are unavailable in Real Mode.</div></div>)}</div>}</div>;
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
