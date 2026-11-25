import type { ClientProfile, ClientOrderDetail, ClientQuotation, ClientPurchaseOrder, ClientJobOrder, ClientShipment, ClientInvoice, ClientPayment } from '../../api/clientPortal';
import type { Inquiry, ProductLine, QuotationDoc, Stage } from './model';

// Keep API entities intact. The original UI's per-tab projections are views, never records to save.
export interface OrderBundle {
  order: ClientOrderDetail;
  quotations: ClientQuotation[];
  purchaseOrder: ClientPurchaseOrder | null;
  jobOrders: ClientJobOrder[];
  shipments: ClientShipment[];
  invoices: ClientInvoice[];
  payments: ClientPayment[];
  errors: string[];
}
export type Surface = 'orders' | 'jobs' | 'status' | 'shipments' | 'invoices';
export type ClientView = Inquiry & { source: OrderBundle; orderId: string; publicStage: string; sourceInvoice?: ClientInvoice; sourceJob?: ClientJobOrder; sourceShipment?: ClientShipment };

export function draftMoney(value: unknown): number {
  // API decimals remain strings in OrderBundle; numeric draft calculations require exact cents.
  if (value == null || !/^\d+(?:\.\d{1,2})?$/.test(String(value))) return NaN;
  const [whole, fraction = ''] = String(value).split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) return NaN;
  const number = Number(cents) / 100;
  return Math.round(number * 100) === Number(cents) ? number : NaN;
}
export function displayNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return Number.isFinite(value) ? value.toLocaleString('en-PH', options) : 'Unavailable';
}
export function product(item: ClientOrderDetail['items'][number]): ProductLine {
  const result: Record<string, unknown> = { ...item, id: item.id, type: item.filterTypeCode ?? '', oem: item.oemPartNumber ?? '', qty: Number(item.quantity) };
  return result as unknown as ProductLine;
}
function quote(q: ClientQuotation): QuotationDoc {
  const packagingAddon = q.addons?.find(addon => addon.kind === "packaging");
  const shippingAddon = q.addons?.find(addon => addon.kind === "shipping");
  return { quotationNo: q.reference, date: q.issuedOn ?? '—', validUntil: q.validUntil ?? '—',
    termsOfPayment: q.paymentTermLabel ?? '—', timeOfDelivery: q.timeOfDelivery ?? '—', placeOfDelivery: q.placeOfDelivery ?? '—',
    total: draftMoney(q.totalAmount), downpaymentPercent: Number(q.downpaymentPercent), downpaymentAmount: draftMoney(q.downpaymentAmount),
    packaging: packagingAddon ? {
      materialId: packagingAddon.materialId ?? "",
      materialName: packagingAddon.label,
      qty: Number(packagingAddon.quantity),
      unitPrice: Number(packagingAddon.unitPrice),
      includeInUnit: Boolean(packagingAddon.includeInUnitPrice),
    } : undefined,
    shipping: shippingAddon ? {
      label: shippingAddon.label,
      amount: Number(shippingAddon.quantity) * Number(shippingAddon.unitPrice),
      includeInUnit: Boolean(shippingAddon.includeInUnitPrice),
    } : undefined,
    lineItems: q.lines.map(line => ({ no: line.lineNumber, qty: Number(line.quantity), unit: line.unitLabel ?? '—', description: line.description, subDescription: line.subDescription ?? undefined, unitPrice: draftMoney(line.unitPrice) })),
  } as QuotationDoc;
}
// Public Client contracts expose labels rather than internal stage codes. Unknown labels stay unknown.
const stages: Record<string, Stage> = { Inquiry: 'inquiry', 'New Inquiry': 'inquiry', Quotation: 'quotation', 'Quotation Sent': 'quotation', 'Purchase Order': 'po', 'PO Received': 'po', 'Job Order': 'jo', 'In Production': 'in_production', 'Quality Inspection': 'quality_inspection', 'Ready for Dispatch': 'ready_for_dispatch', Dispatched: 'dispatched', Delivered: 'delivered', Paid: 'paid', Overdue: 'overdue' };
export function project(bundle: OrderBundle, profile: ClientProfile, surface: Surface): ClientView[] {
  const { order, quotations, purchaseOrder } = bundle;
  const latest = quotations.at(-1);
  const base = { archived:!!order.archivedAt,archiveReason:order.archiveReason??undefined,archiveNote:order.archiveNote??undefined,archiveDate:order.archivedAt??undefined, id: order.id, orderId: order.id, source: bundle, publicStage: order.stageLabel ?? 'Stage unavailable',
    code: order.reference, clientName: profile.companyName, contactPerson: profile.contactPerson ?? '—',
    paymentTerms: order.paymentTermLabel ?? '—', submittedDate: order.submittedAt ? new Date(order.submittedAt).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) : 'Unavailable',
    stage: stages[order.stageLabel ?? ''] ?? 'unavailable', products: order.items.map(product),
    dueDate: order.requestedDeliveryDate ?? undefined, quotationDoc: latest ? quote(latest) : undefined,
    quotationId: latest?.id, quotationStatus: latest?.status, quotationIsLatestRevision: latest?.isLatestRevision, quotationDecision: latest?.decision ?? null, quotationDecisionReason: latest?.decisionReason ?? null, quotationDecidedAt: latest?.decidedAt ?? null,
    quotationDownpaymentValid: latest?.downpaymentValid,
    quotationHistory: quotations.slice(0, -1).map(quote), quotedTotal: latest ? draftMoney(latest.totalAmount) : NaN,
    revisionRequests: order.revisionRequests?.map(request => ({
      id: request.id, note: request.reason, requestedAt: request.requestedAt,
      status: request.status === 'pending' ? 'pending' : 'processed',
      processedAt: request.decidedAt ?? undefined,
    })),
    pendingCancellation: order.pendingCancellation ?? undefined,
    cancellationHistory: order.cancellationHistory ?? [],
    poNumber: purchaseOrder?.clientReference ?? purchaseOrder?.reference, poUploadedAt: purchaseOrder?.uploadedAt, poFileName: purchaseOrder?.files?.[0]?.originalFilename ?? undefined, poFileId: purchaseOrder?.files?.[0]?.id ?? undefined,
    // Review state comes from the explicit API status, never from timestamps.
    poUploaded: Boolean(purchaseOrder?.files?.length),
    poStatus: purchaseOrder?.status === 'validated' ? 'Approved' : purchaseOrder?.status === 'rejected' ? 'Rejected' : purchaseOrder?.status === 'received' || purchaseOrder?.status === 'pending' ? 'Pending Sales Review' : undefined,
    poRejectionReason: purchaseOrder?.decisionReason ?? undefined,
    payments: [],
  } as unknown as ClientView;
  const invoices = bundle.invoices.map(invoice => ({ ...base, id: invoice.id, sourceInvoice: invoice,
    invoiceNo: invoice.reference, invoiceAmount: draftMoney(invoice.amount), invoiceDate: invoice.issuedOn,
    invoiceSentAt: invoice.sentAt, invoiceDueDate: invoice.dueOn ?? undefined, paymentCycleStartedAt: invoice.paymentCycleStartedAt ?? undefined,
    // Required DP is authoritative; do not recompute it from a different quotation revision.
    downpaymentAmount: draftMoney(invoice.requiredDownpayment), quotationDoc: undefined,
    paymentTerms: invoice.paymentTermLabel,
    payments: bundle.payments.filter(p => p.invoiceId === invoice.id).map(p => ({ id: p.id, inquiryId: order.id, invoiceNo: invoice.reference, paymentType: p.paymentType, submittedAmount: draftMoney(p.submittedAmount), verifiedAmount: p.verifiedAmount == null ? undefined : draftMoney(p.verifiedAmount), method: p.method ?? undefined, referenceNumber: p.referenceNumber ?? undefined, rejectionReason: p.rejectionReason ?? undefined, proofFileId: p.proofFileId ?? undefined, proofFilename: p.proofFilename ?? undefined, paymentDate: p.paidOn, verificationStatus: p.verificationStatus, submittedAt: p.submittedAt })),
  } as ClientView));
  if (surface === 'invoices') return invoices;
  if (surface === 'shipments') return bundle.shipments.map(shipment => ({ ...base, id: shipment.id, sourceShipment: shipment,
    joNumber: bundle.jobOrders.find(j => j.id === shipment.jobOrderId)?.reference,
    stage: shipment.status === 'Delivered' || shipment.status === 'Picked up' ? 'delivered' : shipment.status === 'In transit' ? 'dispatched' : 'ready_for_dispatch',
    deliveryMethod: shipment.deliveryMethodLabel, trackingRef: shipment.trackingReference ?? undefined, dispatchedAt: shipment.dispatchedAt ?? undefined,
    deliveredDate: shipment.deliveredAt ?? undefined,
  } as ClientView));
  if (surface === 'jobs' || surface === 'status') {
    const jobs = bundle.jobOrders.map(job => ({ ...base, id: job.id, sourceJob: job, joNumber: job.reference, productionDueDate: job.productionDueDate,
      stage: job.completed ? 'ready_for_dispatch' : ({ Scheduled: 'jo', 'In production': 'in_production', 'Quality inspection': 'quality_inspection', 'Ready for dispatch': 'ready_for_dispatch' }[job.status ?? ''] ?? 'unavailable'),
      // The Client API does not expose a job-to-item association or internal stage events.
      products: [], joCompletedAt: job.completedAt ?? undefined,
    } as unknown as ClientView));
    return surface === 'jobs' || jobs.length ? jobs : [base];
  }
  return [base];
}
