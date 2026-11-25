import { ok, read, rows, one, id, requireThat, paging, paymentTermLabel, decimal, revision, inquiryRevision, validDownpayment } from './core.js';
import { validateSalesOrderListQuery } from '../validation/sales.validation.js';
export function termDisplay(row) {
  return {
    ...row,
    paymentTermLabel: paymentTermLabel(row.paymentTermCode)
  };
}
export function invoiceDisplay(row) {
  const outstanding = decimal(row.outstandingAmount, 2);
  return {
    ...termDisplay(row),
    isOverdue: row.status !== 'cancelled' && outstanding > 0n && Boolean(row.dueOn) && String(row.dueOn instanceof Date ? row.dueOn.toISOString().slice(0, 10) : row.dueOn).slice(0, 10) < new Date().toISOString().slice(0, 10)
  };
}
export const inquiryColumns = `CAST(i.inquiry_id AS CHAR) id,i.inquiry_no reference,CAST(i.client_id AS CHAR) clientId,c.company_name companyName,i.status stageCode,i.status,i.contact_person contactPerson,i.payment_terms paymentTermCode,i.required_by_date requestedDeliveryDate,i.general_notes generalNotes,i.rejection_reason rejectionReason,i.created_at createdAt,i.updated_at updatedAt,(SELECT COALESCE(SUM(t.amount),0) FROM payment_transaction t JOIN sales_invoice sv ON sv.invoice_id=t.invoice_id JOIN purchase_order sp ON sp.po_id=sv.po_id JOIN quotation sq ON sq.quotation_id=sp.quotation_id WHERE sq.inquiry_id=i.inquiry_id AND t.approval_status='approved') verifiedPaymentAmount,(SELECT v.total_amount FROM sales_invoice v JOIN purchase_order p ON p.po_id=v.po_id JOIN quotation q ON q.quotation_id=p.quotation_id WHERE q.inquiry_id=i.inquiry_id ORDER BY v.invoice_id DESC LIMIT 1) invoiceAmount,(SELECT COUNT(*) FROM inquiry_item ci WHERE ci.inquiry_id=i.inquiry_id) itemCount,(SELECT q.status
  FROM quotation q
  WHERE q.inquiry_id=i.inquiry_id
    AND q.is_current=1
  LIMIT 1) latestQuotationStatus`;
export const invoiceFrom = 'sales_invoice v JOIN purchase_order p ON p.po_id=v.po_id JOIN quotation q ON q.quotation_id=p.quotation_id JOIN inquiry i ON i.inquiry_id=q.inquiry_id';
export const invoiceColumns = `CAST(v.invoice_id AS CHAR) id,CAST(i.inquiry_id AS CHAR) orderId,v.invoice_no reference,v.invoice_date issuedOn,v.due_date dueOn,v.total_amount amount,v.payment_terms paymentTermCode,v.status,q.downpayment_amount requiredDownpayment,
  COALESCE((SELECT SUM(t.amount) FROM payment_transaction t WHERE t.invoice_id=v.invoice_id AND t.approval_status='approved'),0) verifiedAmount,
  v.total_amount-COALESCE((SELECT SUM(t.amount) FROM payment_transaction t WHERE t.invoice_id=v.invoice_id AND t.approval_status='approved'),0) outstandingAmount`;
export const deliveryFrom = 'delivery d JOIN job_order j ON j.jo_id=d.jo_id JOIN purchase_order p ON p.po_id=j.po_id JOIN quotation q ON q.quotation_id=p.quotation_id JOIN inquiry i ON i.inquiry_id=q.inquiry_id JOIN client c ON c.client_id=i.client_id JOIN delivery_method dm ON dm.delivery_method_id=d.delivery_method_id';
export const deliveryColumns = `CAST(d.delivery_id AS CHAR) id,CAST(d.jo_id AS CHAR) jobOrderId,CAST(i.inquiry_id AS CHAR) orderId,i.inquiry_no orderReference,c.company_name companyName,j.jo_no jobOrderReference,dm.method_name deliveryMethodLabel,CAST(dm.delivery_method_id AS CHAR) deliveryMethodId,d.status,d.tracking_link trackingLink,d.dispatch_date dispatchedAt,d.delivered_date deliveredAt,d.estimated_delivery_date estimatedDeliveryDate,d.driver_name driverName,d.driver_contact driverPhone,d.vehicle_plate vehiclePlate,d.received_by receivedBy`;
const pick = (row, keys) => Object.fromEntries(keys.filter(k => Object.hasOwn(row, k)).map(k => [k, row[k]]));
const publicInquiry = (row, client) => {
const value = pick(row, [
  'id', 'reference', 'clientId', 'companyName', 'contactPerson',
  'paymentTermCode', 'requestedDeliveryDate', 'rejectionReason',
  'createdAt', 'updatedAt', 'status', 'stageLabel',
  'archiveReason', 'archiveNote', 'archivedAt', 'itemCount',
  ...(client
    ? ['latestQuotationStatus']
    : ['stageCode', 'generalNotes', 'verifiedPaymentAmount', 'invoiceAmount'])
]);
  if (value.itemCount !== undefined) value.itemCount = Number(value.itemCount);
  value.stageLabel ??= {
    inquiry: 'Inquiry',
    quotation: 'Quotation',
    po: 'Purchase Order',
    jo: 'Job Order',
    in_production: 'In Production',
    ready_for_dispatch: 'Ready for Dispatch',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    rejected: 'Rejected'
  }[row.status ?? row.stageCode] ?? row.status;
  return termDisplay(value);
};
const clientShipment = row => ({
  ...pick(row, ['id', 'jobOrderId', 'orderId', 'jobOrderReference', 'orderReference', 'deliveryMethodLabel', 'dispatchedAt', 'deliveredAt', 'estimatedDeliveryDate']),
  statusCode: row.status,
  status: {
    pending: 'Pending',
    in_transit: 'In transit',
    delivered: 'Delivered',
    picked_up: 'Picked up',
    cancelled: 'Cancelled'
  }[row.status] ?? row.status
});
export function createPhase2Reads({
  db,
  clientId = null
}) {
  const scope = (alias = 'i') => clientId ? ` AND ${alias}.client_id=?` : '';
  const params = extra => [...extra, ...(clientId ? [clientId] : [])];
  async function owned(c, inquiryId) {
    requireThat(id(inquiryId));
    const i = await one(c, `SELECT ${inquiryColumns} FROM inquiry i JOIN client c ON c.client_id=i.client_id WHERE i.inquiry_id=?${scope()}`, params([inquiryId]));
    requireThat(i, 'NOT_FOUND');
    return i;
  }
  return {
    list: query => {
      const v = validateSalesOrderListQuery(query);
      if (!v.success) return Promise.resolve(v);
      return read(db, async c => {
        const q = v.data,
          {
            pageSize
          } = q,
          values = [],
          where = ['1=1'];
        if (clientId) {
          where.push('i.client_id=?');
          values.push(clientId);
        }
        if (q.q) {
          where.push('(i.inquiry_no LIKE ? OR c.company_name LIKE ? OR i.contact_person LIKE ?)');
          values.push(...Array(3).fill('%' + q.q + '%'));
        }
        if (q.status !== 'all') where.push(`i.status ${q.status === 'open' ? 'NOT IN' : 'IN'} ('cancelled','rejected','archived')`);
        if (q.stage !== 'all') {
          where.push('i.status=?');
          values.push(q.stage);
        }
        if (q.cancellationStatus !== undefined) {
          where.push(`EXISTS(SELECT 1 FROM cancellation_request cr WHERE cr.inquiry_id=i.inquiry_id${q.cancellationStatus === 'all' ? '' : ' AND cr.status=?'})`);
          if (q.cancellationStatus !== 'all') values.push(q.cancellationStatus === 'declined' ? 'rejected' : q.cancellationStatus);
        }
        const filter = where.join(' AND '),
          from = 'inquiry i JOIN client c ON c.client_id=i.client_id';
        const count = await one(c, `SELECT COUNT(*) total FROM ${from} WHERE ${filter}`, values);
        const total = Number(count.total),
          page = Math.min(q.page, Math.max(1, Math.ceil(total / pageSize))),
          sort = {
            'submitted-asc': 'i.created_at ASC,i.inquiry_id ASC',
            'submitted-desc': 'i.created_at DESC,i.inquiry_id DESC',
            'client-asc': 'c.company_name ASC,i.inquiry_id ASC',
            'client-desc': 'c.company_name DESC,i.inquiry_id DESC',
            'id-asc': 'i.inquiry_id ASC',
            'id-desc': 'i.inquiry_id DESC'
          }[q.sort];
        const data = await rows(c, `SELECT ${inquiryColumns} FROM ${from} WHERE ${filter} ORDER BY ${sort} LIMIT ? OFFSET ?`, [...values, String(pageSize), String((page - 1) * pageSize)]);
        return ok({
          items: data.map(r => ({
            ...publicInquiry(r, clientId),
            archived: ['cancelled', 'rejected', 'archived'].includes(r.status)
          })),
          total,
          page,
          pageSize
        });
      });
    },
    detail: inquiryId => read(db, async c => {
      const inquiry = await owned(c, inquiryId);
      const items = await rows(c, `SELECT CAST(ii.inquiry_item_id AS CHAR) id,CAST(ii.inquiry_item_id AS CHAR) specificationId,CAST(ii.inquiry_id AS CHAR) orderId,ii.line_no lineNumber,CAST(ii.filter_type_id AS CHAR) filterTypeId,ft.filter_type_name filterTypeCode,ii.filter_name filterName,ii.quantity,ii.od1_mm od1,ii.od2_mm od2,ii.id1_mm id1,ii.id2_mm id2,ii.height_mm height,ii.overall_height_mm overallHeight,ii.filter_media media,ii.inner_core innerCore,ii.outer_core outerCore,ii.o_ring oring,ii.gasket,ii.filtration_rating filtrationRating,ii.template_specifications templateSpecifications,CAST(ii.sketch_document_id AS CHAR) sketchDocumentId FROM inquiry_item ii JOIN filter_type ft ON ft.filter_type_id=ii.filter_type_id WHERE ii.inquiry_id=? ORDER BY ii.line_no`, [inquiryId]);
      const revisionRequests = await rows(c, 'SELECT CAST(rr.request_id AS CHAR) id,CAST(rr.quotation_id AS CHAR) quotationId,q.revision_no revisionNumber,rr.reason,rr.status,rr.submitted_at requestedAt,rr.reviewed_at decidedAt,rr.review_note reviewNote FROM quotation_revision_request rr JOIN quotation q ON q.quotation_id=rr.quotation_id WHERE q.inquiry_id=? ORDER BY rr.request_id', [inquiryId]);
      const cancellationHistory = await rows(c, `SELECT CAST(request_id AS CHAR) id,CAST(quotation_id AS CHAR) quotationId,CAST(po_id AS CHAR) purchaseOrderId,reason,'client' requestedBy,status resolution,submitted_at requestedAt,reviewed_at resolvedAt,review_note response FROM cancellation_request WHERE inquiry_id=? ORDER BY request_id`, [inquiryId]);
      const result = {
        ...publicInquiry(inquiry, clientId),
        items,
        revisionRequests,
        cancellationHistory,
        archived: ['cancelled', 'rejected', 'archived'].includes(inquiry.status)
      };
      result.revision = inquiryRevision(inquiry, cancellationHistory);
      const related = createPhase2Reads({
        db: {
          getConnection: async () => ({
            execute: c.execute.bind(c),
            release() {}
          })
        },
        clientId
      });
      for (const [key, method] of [['quotations', 'quotations'], ['purchaseOrder', 'purchaseOrder'], ['jobOrders', 'jobOrders'], ['deliveries', 'delivery'], ['invoices', 'invoices'], ['payments', 'payments']]) {
        const value = await related[method](inquiryId);
        requireThat(value.success || key === 'purchaseOrder' && value.code === 'PURCHASE_ORDER_NOT_FOUND', value.code);
        result[key] = value.success ? key === 'jobOrders' ? value.data.jobOrders : key === 'deliveries' ? value.data.shipments : value.data : null;
      }
      return ok(result);
    }),
    quotations: inquiryId => read(db, async c => {
      await owned(c, inquiryId);
      const quotes = await rows(c, `SELECT CAST(quotation_id AS CHAR) id,quotation_no reference,revision_no revisionNumber,is_current isCurrent,status,quotation_date issuedOn,valid_until validUntil,terms_of_payment paymentTermCode,total_amount totalAmount,subtotal,addons_total addonsTotal,downpayment_percent downpaymentPercent,downpayment_amount downpaymentAmount,sent_at sentAt,time_of_delivery timeOfDelivery,place_of_delivery placeOfDelivery,highlight_note note,highlight_tag highlightTag,requires_downpayment requiresDownpayment FROM quotation WHERE inquiry_id=?${clientId ? " AND status NOT IN ('draft','approved')" : ''} ORDER BY revision_no,quotation_id`, [inquiryId]);
      for (const q of quotes) {
        if (clientId) {
          for (const key of Object.keys(q)) if (!['id', 'reference', 'revisionNumber', 'isCurrent', 'isLatestRevision', 'status', 'issuedOn', 'validUntil', 'paymentTermCode', 'totalAmount', 'subtotal', 'addonsTotal', 'downpaymentPercent', 'downpaymentAmount', 'sentAt', 'timeOfDelivery', 'placeOfDelivery', 'note', 'highlightTag', 'requiresDownpayment'].includes(key)) delete q[key];
        }
        q.noteHighlighted=q.highlightTag==='NOTE';
        q.isLatestRevision = Boolean(Number(q.isCurrent ?? q.isLatestRevision));
        q.downpaymentValid = validDownpayment(q.downpaymentPercent, q.downpaymentAmount, q.totalAmount);
        q.paymentTermLabel = paymentTermLabel(q.paymentTermCode);
        q.lines = await rows(c, `SELECT CAST(quotation_item_id AS CHAR) id,CAST(quotation_id AS CHAR) quotationId,CAST(inquiry_item_id AS CHAR) orderItemId,line_no lineNumber,description,quantity,unit_price unitPrice,line_total lineTotal,CAST(uom_id AS CHAR) uomId FROM quotation_item WHERE quotation_id=? ORDER BY line_no`, [q.id]);
        for (const line of q.lines) for (const key of Object.keys(line)) if (!['id', 'quotationId', 'orderItemId', 'lineNumber', 'description', 'quantity', 'unitPrice', 'lineTotal', 'uomId'].includes(key)) delete line[key];
        if (!clientId) {
          q.costing = await rows(c, 'SELECT CAST(ce.estimate_id AS CHAR) id,CAST(ce.quotation_item_id AS CHAR) quotationItemId,CAST(qi.inquiry_item_id AS CHAR) orderItemId,ce.labor_cost_per_unit laborCost,ce.include_labor includeLabor,ce.markup_percent markupPercent,ce.apply_markup applyMarkup,ce.vat_type vatType,ce.vat_rate vatRate,ce.apply_vat applyVat,ce.material_cost_per_unit materialCostPerUnit,ce.unit_cost_with_vat unitPrice,ce.is_locked isLocked FROM cost_estimate ce JOIN quotation_item qi ON qi.quotation_item_id=ce.quotation_item_id WHERE qi.quotation_id=? ORDER BY qi.line_no,ce.estimate_id', [q.id]);
          for (const estimate of q.costing) estimate.materials = await rows(c, 'SELECT CAST(raw_material_id AS CHAR) rawMaterialId,qty_per_filter qtyPerFilter,CAST(uom_id AS CHAR) uomId,unit_price_snapshot unitPriceSnapshot FROM cost_estimate_material WHERE estimate_id=? ORDER BY estimate_material_id', [estimate.id]);
        }
      }
      return ok(quotes);
    }),
    purchaseOrder: inquiryId => read(db, async c => {
      await owned(c, inquiryId);
      const row = await one(c, `SELECT CAST(p.po_id AS CHAR) id,p.po_no reference,CAST(p.quotation_id AS CHAR) acceptedQuotationId,p.received_date receivedAt,p.payment_terms paymentTermCode,CAST(p.delivery_method_id AS CHAR) deliveryMethodId,CAST(p.po_document_id AS CHAR) fileId,d.storage_status documentStatus,d.file_name originalFilename,d.mime_type mimeType,d.size_bytes sizeBytes,q.quotation_no acceptedQuotationReference,(SELECT e.action FROM audit_event e WHERE e.subject_type='purchase_order' AND e.subject_id=p.po_id AND e.action IN ('purchase_order.validated','purchase_order.rejected') ORDER BY e.audit_event_id DESC LIMIT 1) decisionAction FROM purchase_order p JOIN quotation q ON q.quotation_id=p.quotation_id JOIN document d ON d.document_id=p.po_document_id WHERE q.inquiry_id=? ORDER BY p.po_id DESC LIMIT 1`, [inquiryId]);
      if (!row) return clientId ? ok(null) : {
        success: false,
        code: 'PURCHASE_ORDER_NOT_FOUND'
      };
      const {
        decisionAction
      } = row;
      const safe = pick(row, ['id', 'reference', 'acceptedQuotationId', 'acceptedQuotationReference', 'receivedAt', 'paymentTermCode', 'deliveryMethodId', 'fileId', 'documentStatus', 'originalFilename', 'mimeType', 'sizeBytes']);
      return ok({
        ...termDisplay(safe),
        status: decisionAction?.split('.').at(-1) ?? 'received',
        received: Boolean(row.receivedAt),
        files: row.documentStatus === 'available' ? [{
          id: row.fileId,
          originalFilename: row.originalFilename,
          mimeType: row.mimeType,
          sizeBytes: row.sizeBytes
        }] : []
      });
    }),
    jobOrders: inquiryId => read(db, async c => {
      await owned(c, inquiryId);
      const jobs = await rows(c, `SELECT CAST(j.jo_id AS CHAR) id,j.jo_no reference,CAST(j.po_id AS CHAR) purchaseOrderId,j.status,j.payment_terms paymentTermCode,CASE j.payment_terms WHEN 'NET15' THEN '15-Day Terms' WHEN 'NET30' THEN '30-Day Terms' END paymentTermLabel,j.jo_date joDate,j.due_date productionDueDate,j.completed_at completedAt,(SELECT SUM(ji.quantity) FROM job_order_item ji WHERE ji.jo_id=j.jo_id) quantity,(SELECT ps.stage_order-1 FROM job_order_stage js JOIN production_stage ps ON ps.stage_id=js.stage_id WHERE js.jo_id=j.jo_id AND js.status<>'completed' ORDER BY ps.stage_order LIMIT 1) currentStageCursor,(SELECT ps.stage_name FROM job_order_stage js JOIN production_stage ps ON ps.stage_id=js.stage_id WHERE js.jo_id=j.jo_id AND js.status<>'completed' ORDER BY ps.stage_order LIMIT 1) currentStageLabel,(SELECT COUNT(*) FROM cost_estimate_material cm JOIN cost_estimate ce ON ce.estimate_id=cm.estimate_id JOIN job_order_item ji ON ji.quotation_item_id=ce.quotation_item_id WHERE ji.jo_id=j.jo_id) bomLineCount FROM job_order j JOIN purchase_order p ON p.po_id=j.po_id JOIN quotation q ON q.quotation_id=p.quotation_id WHERE q.inquiry_id=? ORDER BY j.jo_id`, [inquiryId]);
      if (!clientId) for (const job of jobs) job.productionEvents = await rows(c, 'SELECT CAST(e.stage_event_id AS CHAR) id,s.stage_name stageLabel,s.stage_order-1 stagePosition,e.action,e.reason,e.occurred_at occurredAt FROM production_stage_event e JOIN job_order_stage js ON js.jo_stage_id=e.jo_stage_id JOIN production_stage s ON s.stage_id=js.stage_id WHERE js.jo_id=? ORDER BY e.stage_event_id', [job.id]);
      return ok({
        orderId: inquiryId,
        jobOrders: clientId ? jobs.map(j => ({
          ...pick(j, ['id', 'reference', 'quantity', 'productionDueDate', 'completedAt', 'paymentTermCode', 'paymentTermLabel']),
          statusCode: j.status,
          status: {
            prepared: 'Prepared',
            in_production: 'In production',
            ready_for_dispatch: 'Ready for dispatch',
            delivered: 'Delivered',
            cancelled: 'Cancelled'
          }[j.status] ?? j.status,
          productionStageLabel: j.currentStageLabel ?? j.productionStageLabel ?? null,
          completed: Boolean(j.completedAt)
        })) : jobs
      });
    }),
    delivery: inquiryId => read(db, async c => {
      await owned(c, inquiryId);
      let shipments = await rows(c, `SELECT ${deliveryColumns} FROM ${deliveryFrom} WHERE i.inquiry_id=? ORDER BY d.delivery_id`, [inquiryId]);
      if (clientId) shipments = shipments.map(clientShipment);
      const waybills = [],
        deliveryReceipts = [];
      for (const shipment of shipments) {
        waybills.push(...(await rows(c, 'SELECT CAST(waybill_id AS CHAR) id,CAST(delivery_id AS CHAR) shipmentId,waybill_no reference,printed_at printedAt FROM waybill WHERE delivery_id=?', [shipment.id])));
        const receipts = await rows(c, 'SELECT CAST(delivery_receipt_id AS CHAR) id,CAST(delivery_id AS CHAR) shipmentId,dr_no reference,generated_at generatedAt,CAST(document_id AS CHAR) documentId FROM delivery_receipt WHERE delivery_id=?', [shipment.id]);
        for (const receipt of receipts) receipt.signedReceipts = await rows(c, "SELECT CAST(sr.signed_dr_id AS CHAR) id,CAST(sr.document_id AS CHAR) fileId,sr.submitted_at uploadedAt,sr.received_at receivedAt,d.file_name originalFilename,d.mime_type mimeType,d.size_bytes sizeBytes FROM signed_delivery_receipt sr JOIN document d ON d.document_id=sr.document_id AND d.storage_status='available' WHERE sr.delivery_receipt_id=? ORDER BY sr.signed_dr_id", [receipt.id]);
        deliveryReceipts.push(...receipts);
      }
      return ok({
        orderId: inquiryId,
        shipments,
        waybills,
        deliveryReceipts
      });
    }),
    invoices: inquiryId => read(db, async c => {
      await owned(c, inquiryId);
      return ok(await rows(c, `SELECT ${invoiceColumns} FROM ${invoiceFrom} WHERE i.inquiry_id=?${clientId ? " AND v.status IN ('issued','partially_paid','paid')" : ''} ORDER BY v.invoice_id`, [inquiryId]).then(data => data.map(r => invoiceDisplay(clientId ? pick(r, ['id', 'orderId', 'reference', 'issuedOn', 'dueOn', 'amount', 'paymentTermCode', 'status', 'requiredDownpayment', 'verifiedAmount', 'outstandingAmount']) : r))));
    }),
    payments: inquiryId => read(db, async c => {
      await owned(c, inquiryId);
      const proofs = await rows(c, `SELECT CAST(r.receipt_id AS CHAR) id,CAST(r.invoice_id AS CHAR) invoiceId,r.amount_declared submittedAmount,r.review_status verificationStatus,r.review_note rejectionReason,r.sent_at submittedAt,r.reviewed_at reviewedAt,CASE WHEN r.review_status='verified' THEN (SELECT SUM(t.amount) FROM payment_transaction t WHERE t.client_receipt_id=r.receipt_id AND t.approval_status='approved') ELSE NULL END verifiedAmount,(SELECT CAST(MIN(f.document_id) AS CHAR) FROM proof_of_payment_file f JOIN document d ON d.document_id=f.document_id AND d.storage_status='available' WHERE f.receipt_id=r.receipt_id) proofFileId FROM proof_of_payment r JOIN sales_invoice v ON v.invoice_id=r.invoice_id JOIN purchase_order p ON p.po_id=v.po_id JOIN quotation q ON q.quotation_id=p.quotation_id WHERE q.inquiry_id=? ORDER BY r.receipt_id DESC`, [inquiryId]);
      for (const r of proofs) r.files = await rows(c, 'SELECT CAST(document_id AS CHAR) fileId FROM proof_of_payment_file WHERE receipt_id=?', [r.id]);
      return ok(clientId ? proofs.map(r => pick(r, ['id', 'invoiceId', 'submittedAmount', 'verificationStatus', 'rejectionReason', 'submittedAt', 'reviewedAt', 'verifiedAmount', 'proofFileId', 'files'])) : proofs);
    }),
    dashboard: () => read(db, async c => {
      requireThat(clientId, 'FORBIDDEN');
      const counts = await one(c, `SELECT
      (SELECT COUNT(*) FROM inquiry WHERE client_id=? AND status NOT IN ('cancelled','rejected','archived')) activeOrders,
      (SELECT COUNT(*) FROM inquiry WHERE client_id=? AND status='inquiry') pendingInquiries,
      (SELECT COUNT(*) FROM quotation q JOIN inquiry i ON i.inquiry_id=q.inquiry_id WHERE i.client_id=? AND q.is_current=1 AND q.status='sent') sentQuotations,
      (SELECT COUNT(*) FROM ${invoiceFrom} WHERE i.client_id=? AND v.status IN ('issued','partially_paid') AND v.total_amount>COALESCE((SELECT SUM(t.amount) FROM payment_transaction t WHERE t.invoice_id=v.invoice_id AND t.approval_status='approved'),0)) openInvoices`, [clientId, clientId, clientId, clientId]);
      const activity = await rows(c, `SELECT ${inquiryColumns} FROM inquiry i JOIN client c ON c.client_id=i.client_id WHERE i.client_id=? ORDER BY i.updated_at DESC,i.inquiry_id DESC LIMIT 5`, [clientId]);
      const upcoming = await rows(c, `SELECT ${deliveryColumns} FROM ${deliveryFrom} WHERE i.client_id=? AND d.status IN ('pending','in_transit') ORDER BY d.estimated_delivery_date,d.delivery_id LIMIT 5`, [clientId]);
      return ok({
        activeOrders: Number(counts.activeOrders ?? 0),
        pendingInquiries: Number(counts.pendingInquiries ?? 0),
        sentQuotations: Number(counts.sentQuotations ?? 0),
        openInvoices: Number(counts.openInvoices ?? 0),
        recentOrderActivity: activity.map(r => publicInquiry(r, true)),
        upcomingDeliveries: upcoming.map(clientShipment)
      });
    })
  };
}
