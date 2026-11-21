import { createHash } from 'node:crypto';
import { operationalStockQuantity } from './stock-provenance.js';
import { auditRequestId } from './audit-request-id.js';
import { recordInquiryRejectionNotification } from './sales-notifications.service.js';
import { validateInquiryRejection, validateJobOrderCreation, validateQuotationPreparation, validatePurchaseOrderDecision, validateSalesOrderId, validateSalesOrderListQuery } from '../validation/sales.validation.js';

const orderColumns = `CAST(o.id AS CHAR) id, o.reference, CAST(o.client_id AS CHAR) clientId,
 c.company_name companyName, o.contact_person contactPerson, o.stage_code stageCode,
 os.label stageLabel, os.display_order stageDisplayOrder, o.payment_term_code paymentTermCode,
 pt.label paymentTermLabel, o.delivery_method_code deliveryMethodCode, dm.label deliveryMethodLabel,
 DATE_FORMAT(o.submitted_at, '%Y-%m-%dT%H:%i:%s.%fZ') submittedAt, o.urgent,
 DATE_FORMAT(o.requested_delivery_date, '%Y-%m-%d') requestedDeliveryDate,
 o.general_notes generalNotes, o.archive_reason archiveReason, o.archive_note archiveNote, CAST(o.archived_by AS CHAR) archivedBy,
 DATE_FORMAT(o.archived_at, '%Y-%m-%dT%H:%i:%s.%fZ') archivedAt,
 DATE_FORMAT(o.fulfillment_completed_at, '%Y-%m-%dT%H:%i:%s.%fZ') fulfillmentCompletedAt,
 DATE_FORMAT(o.updated_at, '%Y-%m-%dT%H:%i:%s.%fZ') updatedAt,
 (SELECT COUNT(*) FROM quotations q0 WHERE q0.order_id=o.id) quotationCount,
 (SELECT q0.reference FROM quotations q0 WHERE q0.order_id=o.id ORDER BY q0.revision_number DESC, q0.id DESC LIMIT 1) latestQuotationReference,
 (SELECT q0.status FROM quotations q0 WHERE q0.order_id=o.id ORDER BY q0.revision_number DESC, q0.id DESC LIMIT 1) latestQuotationStatus,
 (SELECT q0.revision_number FROM quotations q0 WHERE q0.order_id=o.id ORDER BY q0.revision_number DESC, q0.id DESC LIMIT 1) latestQuotationRevision,
 (SELECT po.reference FROM purchase_orders po WHERE po.order_id=o.id LIMIT 1) purchaseOrderReference,
 (SELECT DATE_FORMAT(po.received_at, '%Y-%m-%dT%H:%i:%s.%fZ') FROM purchase_orders po WHERE po.order_id=o.id LIMIT 1) purchaseOrderReceivedAt,
 (SELECT COUNT(*) FROM job_orders jo0 WHERE jo0.order_id=o.id) jobOrderCount,
 (SELECT i.reference FROM invoices i WHERE i.order_id=o.id LIMIT 1) invoiceReference,
 (SELECT i.amount FROM invoices i WHERE i.order_id=o.id LIMIT 1) invoiceAmount,
 (SELECT COALESCE(SUM(p.verified_amount), 0) FROM payments p WHERE p.order_id=o.id AND p.verification_status='verified') verifiedPaymentAmount`;

const detailOrderColumns = orderColumns;

// One canonical snapshot for read and locked mutation; child changes participate.
export function inquiryRevision(order, requests = []) {
  const state = Object.fromEntries(['id','clientId','stageCode','archiveReason','archiveNote','archivedAt','archivedBy','updatedAt'].map(key => [key, order[key] ?? null]));
  state.cancellations = requests.filter(row => row.kind === 'cancellation' && row.status === 'pending')
    .map(row => Object.fromEntries(['id','kind','reason','status','requestedBy','requestedAt'].map(key => [key, row[key] ?? null])))
    .sort((a,b) => BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0);
  return createHash('sha256').update(JSON.stringify(state)).digest('hex');
}
const cancellationColumns = `CAST(id AS CHAR) id, kind, reason, status, CAST(requested_by AS CHAR) requestedBy,
 DATE_FORMAT(requested_at, '%Y-%m-%dT%H:%i:%s.%fZ') requestedAt`;
const rejectionColumns = `CAST(o.id AS CHAR) id, o.reference, CAST(o.client_id AS CHAR) clientId,
 o.stage_code stageCode, o.archive_reason archiveReason, o.archive_note archiveNote,
 CAST(o.archived_by AS CHAR) archivedBy, DATE_FORMAT(o.archived_at, '%Y-%m-%dT%H:%i:%s.%fZ') archivedAt,
 DATE_FORMAT(o.updated_at, '%Y-%m-%dT%H:%i:%s.%fZ') updatedAt`;


function baseProject(row) {
  if (!row) return null;
  return {
    ...row,
    urgent: Boolean(Number(row.urgent)),
    archived: row.archivedAt !== null,
    quotationCount: Number(row.quotationCount ?? 0),
    jobOrderCount: Number(row.jobOrderCount ?? 0)
  };
}

async function withConnection(db, work) {
  const connection = await db.getConnection();
  try { return await work(connection); } finally { connection.release(); }
}

function validDownpayment(totalAmount, percent, amount) {
  const total = Number(totalAmount), rate = Number(percent), required = Number(amount);
  const expected = Number.isFinite(total) && Number.isFinite(rate) ? Math.round(total * rate) / 100 : NaN;
  return Number.isFinite(total) && total >= 0 && [20, 50].includes(rate) && Number.isFinite(required) && required > 0 && required <= total && Math.abs(required - expected) < 0.001;
}

export function createSalesOrdersService({ db }) {
  if (!db || typeof db.getConnection !== 'function') throw new TypeError('A database pool is required.');

  async function list(query) {
    const validation = validateSalesOrderListQuery(query);
    if (!validation.success) return validation;
    const input = validation.data;
    return withConnection(db, async connection => {
      const where = ['1=1'];
      const parameters = [];
      if (input.status === 'open') where.push('o.archived_at IS NULL');
      if (input.status === 'archived') where.push('o.archived_at IS NOT NULL');
      if (input.stage !== 'all') { where.push('o.stage_code=?'); parameters.push(input.stage); }
      if (input.cancellationStatus !== undefined) {
        const states = { pending: ['pending'], approved: ['approved', 'cancelled'], declined: ['declined', 'rejected'] }[input.cancellationStatus];
        where.push(`EXISTS (SELECT 1 FROM order_requests cr WHERE cr.order_id=o.id AND cr.kind='cancellation'${states ? ` AND cr.status IN (${states.map(() => '?').join(',')})` : ''})`);
        if (states) parameters.push(...states);
      }
      if (input.q) {
        where.push('(LOCATE(?, o.reference)>0 OR LOCATE(?, CAST(o.id AS CHAR))>0 OR LOCATE(?, c.company_name)>0 OR LOCATE(?, COALESCE(o.contact_person, \'\'))>0)');
        parameters.push(input.q, input.q, input.q, input.q);
      }
      const from = 'orders o JOIN clients c ON c.id=o.client_id JOIN order_stages os ON os.code=o.stage_code JOIN payment_terms pt ON pt.code=o.payment_term_code LEFT JOIN delivery_methods dm ON dm.code=o.delivery_method_code';
      const [[count]] = await connection.execute(`SELECT COUNT(*) total FROM ${from} WHERE ${where.join(' AND ')}`, parameters);
      const total = Number(count.total);
      const page = Math.min(input.page, Math.max(1, Math.ceil(total / input.pageSize)));
      const sortMap = {
        'submitted-asc': 'o.submitted_at ASC, o.id ASC', 'submitted-desc': 'o.submitted_at DESC, o.id DESC',
        'client-asc': 'c.company_name ASC, o.id ASC', 'client-desc': 'c.company_name DESC, o.id DESC',
        'id-asc': 'o.id ASC', 'id-desc': 'o.id DESC'
      };
      const [rows] = await connection.execute(`SELECT ${orderColumns} FROM ${from} WHERE ${where.join(' AND ')} ORDER BY ${sortMap[input.sort]} LIMIT ? OFFSET ?`, [...parameters, String(input.pageSize), String((page - 1) * input.pageSize)]);
      return { success: true, data: { items: rows.map(baseProject), total, page, pageSize: input.pageSize } };
    });
  }

  async function detail(id) {
    const validation = validateSalesOrderId(id);
    if (!validation.success) return validation;
    return withConnection(db, async connection => {
      const [orders] = await connection.execute(`SELECT ${detailOrderColumns} FROM orders o JOIN clients c ON c.id=o.client_id JOIN order_stages os ON os.code=o.stage_code JOIN payment_terms pt ON pt.code=o.payment_term_code LEFT JOIN delivery_methods dm ON dm.code=o.delivery_method_code WHERE o.id=?`, [id]);
      if (!orders.length) return { success: false, code: 'NOT_FOUND' };
      const order = baseProject(orders[0]);
      const [items] = await connection.execute(`SELECT CAST(oi.id AS CHAR) id, oi.line_number lineNumber, oi.quantity,
        CAST(ps.id AS CHAR) specificationId, ps.filter_type_code filterTypeCode, ps.filter_name filterName,
        ps.od1, ps.od2, ps.id1, ps.id2, ps.height, ps.overall_height overallHeight, ps.length,
        ps.width, ps.thickness, ps.depth, ps.pocket_count pocketCount, ps.diameter,
        ps.cloth_cutting_width clothCuttingWidth, ps.cloth_cutting_length clothCuttingLength,
        ps.spring_plate_center_to_center springPlateCenterToCenter, ps.spring_plate_width springPlateWidth,
        ps.spring_plate_length springPlateLength, ps.pad_od padOd, ps.pad_id padId,
        ps.media, ps.inner_core innerCore, ps.outer_core outerCore, ps.oring, ps.gasket,
        ps.end_cap endCap, ps.oem_part_number oemPartNumber, ps.brand, ps.filtration_rating filtrationRating,
        ps.others, ps.notes FROM order_items oi JOIN product_specifications ps ON ps.id=oi.specification_id AND ps.client_id=oi.client_id WHERE oi.order_id=? ORDER BY oi.line_number, oi.id`, [id]);
      const [quotations] = await connection.execute(`SELECT CAST(q.id AS CHAR) id, q.reference, q.revision_number revisionNumber, q.status,
        DATE_FORMAT(q.issued_on, '%Y-%m-%d') issuedOn, DATE_FORMAT(q.valid_until, '%Y-%m-%d') validUntil,
        q.payment_term_code paymentTermCode, q.time_of_delivery timeOfDelivery, q.place_of_delivery placeOfDelivery,
        q.note, q.note_highlighted noteHighlighted, q.total_amount totalAmount,
        q.downpayment_percent downpaymentPercent, q.downpayment_amount downpaymentAmount,
        DATE_FORMAT(q.stock_checked_at, '%Y-%m-%dT%H:%i:%s.%fZ') stockCheckedAt,
        DATE_FORMAT(q.sent_at, '%Y-%m-%dT%H:%i:%s.%fZ') sentAt,
        (SELECT CASE WHEN a.action='quotation.accepted' THEN 'accepted' WHEN a.action='quotation.rejected' THEN 'rejected' END FROM audit_events a WHERE a.subject_type='quotation' AND a.subject_identifier=CAST(q.id AS CHAR) AND a.action IN ('quotation.accepted','quotation.rejected') ORDER BY a.occurred_at DESC,a.id DESC LIMIT 1) decision,
        (SELECT a.reason FROM audit_events a WHERE a.subject_type='quotation' AND a.subject_identifier=CAST(q.id AS CHAR) AND a.action IN ('quotation.accepted','quotation.rejected') ORDER BY a.occurred_at DESC,a.id DESC LIMIT 1) decisionReason,
        (SELECT DATE_FORMAT(a.occurred_at, '%Y-%m-%dT%H:%i:%s.%fZ') FROM audit_events a WHERE a.subject_type='quotation' AND a.subject_identifier=CAST(q.id AS CHAR) AND a.action IN ('quotation.accepted','quotation.rejected') ORDER BY a.occurred_at DESC,a.id DESC LIMIT 1) decidedAt
        FROM quotations q WHERE q.order_id=? ORDER BY q.revision_number DESC, q.id DESC`, [id]);
      const [quotationLines] = await connection.execute(`SELECT CAST(ql.id AS CHAR) id, CAST(ql.quotation_id AS CHAR) quotationId,
        ql.line_number lineNumber, CAST(ql.order_item_id AS CHAR) orderItemId, ql.description,
        ql.sub_description subDescription, ql.quantity, ql.unit_label unitLabel, ql.unit_price unitPrice
        FROM quotation_lines ql WHERE ql.order_id=? ORDER BY ql.quotation_id, ql.line_number`, [id]);
      const [purchaseOrders] = await connection.execute(`SELECT CAST(po.id AS CHAR) id, CAST(po.accepted_quotation_id AS CHAR) acceptedQuotationId,
        po.reference, po.client_reference clientReference, DATE_FORMAT(po.uploaded_at, '%Y-%m-%dT%H:%i:%s.%fZ') uploadedAt,
        DATE_FORMAT(po.received_at, '%Y-%m-%dT%H:%i:%s.%fZ') receivedAt, DATE_FORMAT(po.cleared_at, '%Y-%m-%dT%H:%i:%s.%fZ') clearedAt
        FROM purchase_orders po WHERE po.order_id=?`, [id]);
      const [jobOrders] = await connection.execute(`SELECT CAST(jo.id AS CHAR) id, jo.reference, CAST(jo.order_item_id AS CHAR) orderItemId,
        CAST(jo.specification_id AS CHAR) specificationId, jo.quantity, DATE_FORMAT(jo.production_due_date, '%Y-%m-%d') productionDueDate,
        jo.current_stage_cursor currentStageCursor, jo.status, jo.paused, jo.pause_reason pauseReason,
        DATE_FORMAT(jo.materials_deducted_at, '%Y-%m-%dT%H:%i:%s.%fZ') materialsDeductedAt,
        DATE_FORMAT(jo.completed_at, '%Y-%m-%dT%H:%i:%s.%fZ') completedAt FROM job_orders jo WHERE jo.order_id=? ORDER BY jo.id`, [id]);
      const [invoices] = await connection.execute(`SELECT CAST(i.id AS CHAR) id, i.reference, DATE_FORMAT(i.issued_on, '%Y-%m-%d') issuedOn,
        i.amount, i.payment_term_code paymentTermCode, i.required_downpayment requiredDownpayment,
        DATE_FORMAT(i.payment_cycle_started_at, '%Y-%m-%dT%H:%i:%s.%fZ') paymentCycleStartedAt,
        DATE_FORMAT(i.due_on, '%Y-%m-%d') dueOn, DATE_FORMAT(i.sent_at, '%Y-%m-%dT%H:%i:%s.%fZ') sentAt
        FROM invoices i WHERE i.order_id=?`, [id]);
      const [payments] = await connection.execute(`SELECT CAST(p.id AS CHAR) id, CAST(p.invoice_id AS CHAR) invoiceId,
        p.payment_type paymentType, p.submitted_amount submittedAmount, p.verified_amount verifiedAmount,
        p.method, p.reference_number referenceNumber, DATE_FORMAT(p.paid_on, '%Y-%m-%d') paidOn,
        p.verification_status verificationStatus, DATE_FORMAT(p.submitted_at, '%Y-%m-%dT%H:%i:%s.%fZ') submittedAt,
        DATE_FORMAT(p.reviewed_at, '%Y-%m-%dT%H:%i:%s.%fZ') reviewedAt FROM payments p WHERE p.order_id=? ORDER BY p.id`, [id]);
      const [shipments] = await connection.execute(`SELECT CAST(s.id AS CHAR) id, CAST(s.job_order_id AS CHAR) jobOrderId,
        s.delivery_method_code deliveryMethodCode, dm.label deliveryMethodLabel, s.status,
        s.tracking_reference trackingReference, s.tracking_link trackingLink,
        DATE_FORMAT(s.estimated_delivery_date, '%Y-%m-%d') estimatedDeliveryDate,
        DATE_FORMAT(s.expected_pickup_date, '%Y-%m-%d') expectedPickupDate,
        DATE_FORMAT(s.dispatched_at, '%Y-%m-%dT%H:%i:%s.%fZ') dispatchedAt,
        DATE_FORMAT(s.delivered_at, '%Y-%m-%dT%H:%i:%s.%fZ') deliveredAt FROM shipments s
        JOIN delivery_methods dm ON dm.code=s.delivery_method_code WHERE s.order_id=? ORDER BY s.id`, [id]);
      const [requests] = await connection.execute(`SELECT CAST(r.id AS CHAR) id, r.kind, r.reason, r.response, r.status, CAST(r.requested_by AS CHAR) requestedBy,
        DATE_FORMAT(r.requested_at, '%Y-%m-%dT%H:%i:%s.%fZ') requestedAt,
        DATE_FORMAT(r.decided_at, '%Y-%m-%dT%H:%i:%s.%fZ') decidedAt FROM order_requests r WHERE r.order_id=? ORDER BY r.id DESC`, [id]);
      return {
        success: true,
        data: { ...order, revision: inquiryRevision(order, requests), items, quotations: quotations.map(q => ({ ...q, noteHighlighted: Boolean(Number(q.noteHighlighted)), lines: quotationLines.filter(line => line.quotationId === q.id) })), purchaseOrders, jobOrders: jobOrders.map(jo => ({ ...jo, paused: Boolean(Number(jo.paused)), currentStageCursor: Number(jo.currentStageCursor) })), invoices, payments, shipments, requests }
      };
    });
  }

  async function assertOrder(connection, id) {
    const [rows] = await connection.execute('SELECT id FROM orders WHERE id=?', [id]);
    return rows.length === 1;
  }

  async function quotations(id) {
    const validation = validateSalesOrderId(id);
    if (!validation.success) return validation;
    return withConnection(db, async connection => {
      if (!await assertOrder(connection, id)) return { success: false, code: 'NOT_FOUND' };
      const [rows] = await connection.execute(`SELECT CAST(q.id AS CHAR) id, q.reference, q.revision_number revisionNumber, q.status,
        DATE_FORMAT(q.issued_on, '%Y-%m-%d') issuedOn, DATE_FORMAT(q.valid_until, '%Y-%m-%d') validUntil,
        q.payment_term_code paymentTermCode, pt.label paymentTermLabel, q.time_of_delivery timeOfDelivery,
        q.place_of_delivery placeOfDelivery, q.note, q.note_highlighted noteHighlighted, q.total_amount totalAmount,
        q.downpayment_percent downpaymentPercent, q.downpayment_amount downpaymentAmount,
        DATE_FORMAT(q.stock_checked_at, '%Y-%m-%dT%H:%i:%s.%fZ') stockCheckedAt,
        DATE_FORMAT(q.sent_at, '%Y-%m-%dT%H:%i:%s.%fZ') sentAt,
        (SELECT CASE WHEN a.action='quotation.accepted' THEN 'accepted' WHEN a.action='quotation.rejected' THEN 'rejected' END FROM audit_events a WHERE a.subject_type='quotation' AND a.subject_identifier=CAST(q.id AS CHAR) AND a.action IN ('quotation.accepted','quotation.rejected') ORDER BY a.occurred_at DESC,a.id DESC LIMIT 1) decision,
        (SELECT a.reason FROM audit_events a WHERE a.subject_type='quotation' AND a.subject_identifier=CAST(q.id AS CHAR) AND a.action IN ('quotation.accepted','quotation.rejected') ORDER BY a.occurred_at DESC,a.id DESC LIMIT 1) decisionReason,
        (SELECT DATE_FORMAT(a.occurred_at, '%Y-%m-%dT%H:%i:%s.%fZ') FROM audit_events a WHERE a.subject_type='quotation' AND a.subject_identifier=CAST(q.id AS CHAR) AND a.action IN ('quotation.accepted','quotation.rejected') ORDER BY a.occurred_at DESC,a.id DESC LIMIT 1) decidedAt
        FROM quotations q JOIN payment_terms pt ON pt.code=q.payment_term_code
        WHERE q.order_id=? ORDER BY q.revision_number ASC, q.id ASC`, [id]);
      const [lines] = await connection.execute(`SELECT CAST(ql.id AS CHAR) id, CAST(ql.quotation_id AS CHAR) quotationId,
        ql.line_number lineNumber, CAST(ql.order_item_id AS CHAR) orderItemId, ql.description,
        ql.sub_description subDescription, ql.quantity, ql.unit_label unitLabel, ql.unit_price unitPrice
        FROM quotation_lines ql WHERE ql.order_id=? ORDER BY ql.quotation_id, ql.line_number`, [id]);
      const [costing] = await connection.execute(`SELECT CAST(qc.id AS CHAR) id, CAST(qc.quotation_id AS CHAR) quotationId,
        CAST(qc.order_item_id AS CHAR) orderItemId, qc.labor_cost laborCost, qc.markup_percent markupPercent,
        qc.discount_percent discountPercent, qc.vat_type vatType, qc.vat_rate vatRate,
        qc.include_labor includeLabor, qc.apply_markup applyMarkup, qc.apply_vat applyVat,
        qc.calculated_unit_price calculatedUnitPrice FROM quotation_costing qc WHERE qc.order_id=? ORDER BY qc.quotation_id, qc.order_item_id`, [id]);
      const [bomSnapshots] = await connection.execute(`SELECT CAST(b.costing_id AS CHAR) costingId, b.line_number lineNumber,
        CAST(b.material_id AS CHAR) materialId, b.material_name_snapshot materialName, b.unit_snapshot unit,
        b.unit_price_snapshot unitPrice, b.quantity_per_filter quantityPerFilter, b.waste_percent wastePercent
        FROM quotation_bom_lines b JOIN quotation_costing qc ON qc.id=b.costing_id WHERE qc.order_id=?
        ORDER BY b.costing_id,b.line_number`, [id]);
      const [discounts] = await connection.execute(`SELECT CAST(qd.quotation_id AS CHAR) quotationId, qd.line_number lineNumber,
        qd.label, qd.percent FROM quotation_discounts qd JOIN quotations q ON q.id=qd.quotation_id AND q.order_id=?
        ORDER BY qd.quotation_id, qd.line_number`, [id]);
      const [addons] = await connection.execute(`SELECT CAST(qa.id AS CHAR) id, CAST(qa.quotation_id AS CHAR) quotationId,
        qa.kind, CAST(qa.material_id AS CHAR) materialId, qa.label, qa.quantity, qa.unit_price unitPrice,
        qa.include_in_unit_price includeInUnitPrice FROM quotation_addons qa JOIN quotations q ON q.id=qa.quotation_id AND q.order_id=?
        ORDER BY qa.quotation_id, qa.kind`, [id]);
      const [files] = await connection.execute(`SELECT CAST(qf.quotation_id AS CHAR) quotationId, CAST(f.id AS CHAR) id,
        qf.purpose, f.original_filename originalFilename, f.mime_type mimeType, f.size_bytes sizeBytes,
        f.state, DATE_FORMAT(f.uploaded_at, '%Y-%m-%dT%H:%i:%s.%fZ') uploadedAt
        FROM quotation_files qf JOIN quotations q ON q.id=qf.quotation_id AND q.order_id=?
        JOIN files f ON f.id=qf.file_id ORDER BY qf.quotation_id, f.id`, [id]);
      return {
        success: true,
        data: rows.map(quote => ({
          ...quote,
          downpaymentValid: validDownpayment(quote.totalAmount, quote.downpaymentPercent, quote.downpaymentAmount),
          noteHighlighted: Boolean(Number(quote.noteHighlighted)),
          sent: quote.sentAt !== null,
          lines: lines.filter(line => line.quotationId === quote.id),
          costing: costing.filter(item => item.quotationId === quote.id).map(item => ({
            ...item,
            bomLines: bomSnapshots.filter(line => line.costingId === item.id),
            includeLabor: Boolean(Number(item.includeLabor)),
            applyMarkup: Boolean(Number(item.applyMarkup)),
            applyVat: Boolean(Number(item.applyVat))
          })),
          discounts: discounts.filter(item => item.quotationId === quote.id),
          addons: addons.filter(item => item.quotationId === quote.id).map(item => ({ ...item, includeInUnitPrice: Boolean(Number(item.includeInUnitPrice)) })),
          files: files.filter(file => file.quotationId === quote.id)
        }))
      };
    });
  }

  async function purchaseOrder(id) {
    const validation = validateSalesOrderId(id);
    if (!validation.success) return validation;
    return withConnection(db, async connection => {
      if (!await assertOrder(connection, id)) return { success: false, code: 'NOT_FOUND' };
      const [rows] = await connection.execute(`SELECT CAST(po.id AS CHAR) id, CAST(po.accepted_quotation_id AS CHAR) acceptedQuotationId,
        q.reference acceptedQuotationReference, po.reference, po.client_reference clientReference,
        DATE_FORMAT(po.uploaded_at, '%Y-%m-%dT%H:%i:%s.%fZ') uploadedAt,
        DATE_FORMAT(po.received_at, '%Y-%m-%dT%H:%i:%s.%fZ') receivedAt,
        DATE_FORMAT(po.cleared_at, '%Y-%m-%dT%H:%i:%s.%fZ') clearedAt,
        (SELECT CASE WHEN a.action='purchase_order.validated' THEN 'validated' WHEN a.action='purchase_order.rejected' THEN 'rejected' WHEN a.action='purchase_order.received' THEN 'received' END FROM audit_events a WHERE a.subject_type='purchase_order' AND a.subject_identifier=CAST(po.id AS CHAR) AND a.action IN ('purchase_order.received','purchase_order.validated','purchase_order.rejected') ORDER BY a.occurred_at DESC,a.id DESC LIMIT 1) poStatus,
        (SELECT a.reason FROM audit_events a WHERE a.subject_type='purchase_order' AND a.subject_identifier=CAST(po.id AS CHAR) AND a.action IN ('purchase_order.received','purchase_order.validated','purchase_order.rejected') ORDER BY a.occurred_at DESC,a.id DESC LIMIT 1) poDecisionReason
        FROM purchase_orders po LEFT JOIN quotations q ON q.id=po.accepted_quotation_id AND q.order_id=po.order_id
        WHERE po.order_id=?`, [id]);
      if (!rows.length) return { success: false, code: 'PURCHASE_ORDER_NOT_FOUND' };
      const [files] = await connection.execute(`SELECT CAST(pof.purchase_order_id AS CHAR) purchaseOrderId, CAST(f.id AS CHAR) id,
        pof.purpose, f.original_filename originalFilename, f.mime_type mimeType, f.size_bytes sizeBytes,
        f.state, DATE_FORMAT(f.uploaded_at, '%Y-%m-%dT%H:%i:%s.%fZ') uploadedAt
        FROM purchase_order_files pof JOIN files f ON f.id=pof.file_id
        WHERE pof.purchase_order_id=? ORDER BY f.id`, [rows[0].id]);
      return { success: true, data: { ...rows[0], status: rows[0].poStatus ?? (rows[0].clearedAt ? 'validated' : rows[0].receivedAt ? 'received' : 'pending'), decisionReason: rows[0].poDecisionReason ?? null, received: rows[0].receivedAt !== null, cleared: rows[0].clearedAt !== null, files } };
    });
  }

  async function processPurchaseOrder(id, actor, body, context = {}) {
    if (!actor || actor.accountType !== 'employee' || actor.roleCode !== 'sales' || !validateSalesOrderId(id).success) return { success: false, code: 'FORBIDDEN' };
    const validation = validatePurchaseOrderDecision(body);
    if (!validation.success) return validation;
    return withConnection(db, async connection => {
      let transaction = false;
      try {
        await connection.beginTransaction(); transaction = true;
        const [rows] = await connection.execute(`SELECT CAST(po.id AS CHAR) id, CAST(po.order_id AS CHAR) orderId, CAST(po.accepted_quotation_id AS CHAR) acceptedQuotationId,
          po.reference, po.received_at receivedAt, po.cleared_at clearedAt, CAST(o.client_id AS CHAR) clientId
          FROM purchase_orders po JOIN orders o ON o.id=po.order_id WHERE po.order_id=? FOR UPDATE`, [id]);
        if (!rows.length) { await connection.rollback(); return { success: false, code: 'PURCHASE_ORDER_NOT_FOUND' }; }
        const po = rows[0];
        const [quotes] = await connection.execute(`SELECT CAST(q.id AS CHAR) id, q.reference, q.revision_number revisionNumber, q.status, q.total_amount totalAmount, q.downpayment_percent downpaymentPercent, q.downpayment_amount downpaymentAmount
          FROM quotations q WHERE q.id=? AND q.order_id=? FOR UPDATE`, [po.acceptedQuotationId, id]);
        const quote = quotes[0];
        if (!quote || quote.status !== 'sent' || !validDownpayment(quote.totalAmount, quote.downpaymentPercent, quote.downpaymentAmount)) { await connection.rollback(); return { success: false, code: 'QUOTATION_NOT_ELIGIBLE' }; }
        const [decisions] = await connection.execute(`SELECT action FROM audit_events WHERE subject_type='quotation' AND subject_identifier=? AND action IN ('quotation.accepted','quotation.rejected') ORDER BY occurred_at DESC,id DESC LIMIT 1`, [quote.id]);
        if (!decisions.length || decisions[0].action !== 'quotation.accepted') { await connection.rollback(); return { success: false, code: 'QUOTATION_NOT_ACCEPTED' }; }
        const [prior] = await connection.execute(`SELECT action, reason FROM audit_events WHERE subject_type='purchase_order' AND subject_identifier=? AND action IN ('purchase_order.validated','purchase_order.rejected') ORDER BY occurred_at DESC,id DESC LIMIT 1`, [po.id]);
        if (prior.length) { await connection.rollback(); return { success: false, code: 'PURCHASE_ORDER_ALREADY_DECIDED' }; }
        const action = validation.data.decision === 'validated' ? 'purchase_order.validated' : 'purchase_order.rejected';
        if (validation.data.decision === 'validated') {
          const [updated] = await connection.execute(`UPDATE purchase_orders SET received_at=COALESCE(received_at,CURRENT_TIMESTAMP(3)), received_by=?, cleared_at=CURRENT_TIMESTAMP(3), cleared_by=? WHERE id=? AND order_id=?`, [actor.userId, actor.userId, po.id, id]);
          if (updated.affectedRows !== 1) throw new Error('Purchase-order update failed.');
        }
        const [audit] = await connection.execute(`INSERT INTO audit_events (actor_id,action,subject_type,subject_identifier,old_value,new_value,reason,request_id,occurred_at)
          VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP(3))`, [actor.userId, action, 'purchase_order', po.id, JSON.stringify({ receivedAt: po.receivedAt, clearedAt: po.clearedAt }), JSON.stringify({ orderId: id, acceptedQuotationId: quote.id, decision: validation.data.decision, downpaymentPercent: Number(quote.downpaymentPercent), downpaymentAmount: quote.downpaymentAmount }), validation.data.reason, auditRequestId(context)]);
        if (audit.affectedRows !== 1) throw new Error('Purchase-order audit write failed.');
        await connection.commit(); transaction = false;
        return { success: true, data: { id: po.id, orderId: id, reference: po.reference, acceptedQuotationId: quote.id, acceptedQuotationReference: quote.reference, status: validation.data.decision, discrepancy: null, downpaymentPercent: Number(quote.downpaymentPercent), downpaymentAmount: quote.downpaymentAmount, paymentStatus: 'unverified', jobOrderCreated: false } };
      } catch (error) { if (transaction) { try { await connection.rollback(); } catch {} } throw error; }
    });
  }

  async function generateInvoice(id, actor, context = {}) {
    if (!actor || actor.accountType !== 'employee' || actor.roleCode !== 'sales' || !validateSalesOrderId(id).success) return { success: false, code: 'FORBIDDEN' };
    return withConnection(db, async connection => {
      let transaction = false;
      try {
        await connection.beginTransaction(); transaction = true;
        const [orders] = await connection.execute(`SELECT CAST(o.id AS CHAR) id, CAST(o.client_id AS CHAR) clientId, o.reference
          FROM orders o WHERE o.id=? FOR UPDATE`, [id]);
        if (!orders.length) { await connection.rollback(); return { success: false, code: 'NOT_FOUND' }; }
        const [purchaseOrders] = await connection.execute(`SELECT CAST(po.id AS CHAR) id, CAST(po.accepted_quotation_id AS CHAR) acceptedQuotationId, po.reference
          FROM purchase_orders po WHERE po.order_id=? FOR UPDATE`, [id]);
        if (!purchaseOrders.length) { await connection.rollback(); return { success: false, code: 'PURCHASE_ORDER_NOT_FOUND' }; }
        const purchaseOrder = purchaseOrders[0];
        const [poDecisions] = await connection.execute(`SELECT action FROM audit_events WHERE subject_type='purchase_order' AND subject_identifier=?
          AND action IN ('purchase_order.validated','purchase_order.rejected') ORDER BY occurred_at DESC,id DESC LIMIT 1`, [purchaseOrder.id]);
        if (!poDecisions.length || poDecisions[0].action !== 'purchase_order.validated') { await connection.rollback(); return { success: false, code: 'PURCHASE_ORDER_NOT_VALIDATED' }; }
        const [quotes] = await connection.execute(`SELECT CAST(q.id AS CHAR) id, q.reference, q.revision_number revisionNumber, q.status,
          q.total_amount totalAmount, q.downpayment_percent downpaymentPercent, q.downpayment_amount downpaymentAmount, q.payment_term_code paymentTermCode
          FROM quotations q WHERE q.id=? AND q.order_id=? FOR UPDATE`, [purchaseOrder.acceptedQuotationId, id]);
        const quote = quotes[0];
        if (!quote || quote.status !== 'sent' || !validDownpayment(quote.totalAmount, quote.downpaymentPercent, quote.downpaymentAmount)) { await connection.rollback(); return { success: false, code: 'QUOTATION_NOT_ELIGIBLE' }; }
        const [latest] = await connection.execute(`SELECT CAST(id AS CHAR) id FROM quotations WHERE order_id=? ORDER BY revision_number DESC,id DESC LIMIT 1 FOR UPDATE`, [id]);
        if (!latest.length || latest[0].id !== quote.id) { await connection.rollback(); return { success: false, code: 'QUOTATION_NOT_LATEST' }; }
        const [decisions] = await connection.execute(`SELECT action FROM audit_events WHERE subject_type='quotation' AND subject_identifier=? AND action IN ('quotation.accepted','quotation.rejected') ORDER BY occurred_at DESC,id DESC LIMIT 1`, [quote.id]);
        if (!decisions.length || decisions[0].action !== 'quotation.accepted') { await connection.rollback(); return { success: false, code: 'QUOTATION_NOT_ACCEPTED' }; }
        const [existing] = await connection.execute(`SELECT CAST(id AS CHAR) id, reference, DATE_FORMAT(issued_on,'%Y-%m-%d') issuedOn,
          amount, required_downpayment requiredDownpayment, DATE_FORMAT(sent_at,'%Y-%m-%dT%H:%i:%s.%fZ') sentAt
          FROM invoices WHERE order_id=? FOR UPDATE`, [id]);
        if (existing.length) { await connection.rollback(); return { success: false, code: 'INVOICE_ALREADY_EXISTS', data: existing[0] }; }
        const reference = `SI-${new Date().getUTCFullYear()}-${String(id).padStart(4, '0')}`;
        const [inserted] = await connection.execute(`INSERT INTO invoices
          (order_id, reference, issued_on, amount, payment_term_code, required_downpayment, created_by, sent_at, sent_by)
          VALUES (?, ?, UTC_DATE(), ?, ?, ?, ?, CURRENT_TIMESTAMP(3), ?)`,
          [id, reference, quote.totalAmount, quote.paymentTermCode, quote.downpaymentAmount, actor.userId, actor.userId]);
        if (inserted.affectedRows !== 1 || inserted.insertId == null) throw new Error('Invoice write failed.');
        const invoiceId = String(inserted.insertId);
        const [audit] = await connection.execute(`INSERT INTO audit_events (actor_id,action,subject_type,subject_identifier,new_value,request_id,occurred_at)
          VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP(3))`, [actor.userId, 'invoice.issued', 'invoice', invoiceId, JSON.stringify({ orderId: id, clientId: orders[0].clientId, invoiceId, reference, acceptedQuotationId: quote.id, purchaseOrderId: purchaseOrder.id, amount: quote.totalAmount, requiredDownpayment: quote.downpaymentAmount }), auditRequestId(context)]);
        if (audit.affectedRows !== 1) throw new Error('Invoice audit write failed.');
        await connection.commit(); transaction = false;
        return { success: true, data: { id: invoiceId, orderId: id, reference, issuedOn: new Date().toISOString().slice(0, 10), amount: quote.totalAmount, requiredDownpayment: quote.downpaymentAmount, acceptedQuotationId: quote.id, purchaseOrderId: purchaseOrder.id, status: 'issued' } };
      } catch (error) { if (transaction) { try { await connection.rollback(); } catch {} } throw error; }
    });
  }

  async function createJobOrders(id, actor, body, context = {}) {
    if (!actor || actor.accountType !== 'employee' || actor.roleCode !== 'sales' || !validateSalesOrderId(id).success) return { success: false, code: 'FORBIDDEN' };
    const validation = validateJobOrderCreation(body);
    if (!validation.success) return validation;
    return withConnection(db, async connection => {
      let transaction = false;
      try {
        await connection.beginTransaction(); transaction = true;
        const [orders] = await connection.execute(`SELECT CAST(o.id AS CHAR) id, CAST(o.client_id AS CHAR) clientId, o.stage_code stageCode
          FROM orders o WHERE o.id=? FOR UPDATE`, [id]);
        if (!orders.length) { await connection.rollback(); return { success: false, code: 'NOT_FOUND' }; }
        const order = orders[0];
        const [purchaseOrders] = await connection.execute(`SELECT CAST(po.id AS CHAR) id, CAST(po.accepted_quotation_id AS CHAR) acceptedQuotationId, po.reference
          FROM purchase_orders po WHERE po.order_id=? FOR UPDATE`, [id]);
        if (!purchaseOrders.length) { await connection.rollback(); return { success: false, code: 'PURCHASE_ORDER_NOT_FOUND' }; }
        const purchaseOrder = purchaseOrders[0];
        const [poDecisions] = await connection.execute(`SELECT action FROM audit_events WHERE subject_type='purchase_order' AND subject_identifier=?
          AND action IN ('purchase_order.validated','purchase_order.rejected') ORDER BY occurred_at DESC,id DESC LIMIT 1`, [purchaseOrder.id]);
        if (!poDecisions.length || poDecisions[0].action !== 'purchase_order.validated') { await connection.rollback(); return { success: false, code: 'PURCHASE_ORDER_NOT_VALIDATED' }; }
        const [quotes] = await connection.execute(`SELECT CAST(q.id AS CHAR) id, q.reference, q.revision_number revisionNumber, q.status, q.total_amount totalAmount,
          q.downpayment_percent downpaymentPercent, q.downpayment_amount downpaymentAmount
          FROM quotations q WHERE q.id=? AND q.order_id=? FOR UPDATE`, [purchaseOrder.acceptedQuotationId, id]);
        const quote = quotes[0];
        if (!quote || quote.status !== 'sent' || !validDownpayment(quote.totalAmount, quote.downpaymentPercent, quote.downpaymentAmount)) { await connection.rollback(); return { success: false, code: 'QUOTATION_NOT_ELIGIBLE' }; }
        const [latest] = await connection.execute(`SELECT CAST(id AS CHAR) id FROM quotations WHERE order_id=? ORDER BY revision_number DESC,id DESC LIMIT 1 FOR UPDATE`, [id]);
        if (!latest.length || latest[0].id !== quote.id) { await connection.rollback(); return { success: false, code: 'QUOTATION_NOT_LATEST' }; }
        const [quoteDecisions] = await connection.execute(`SELECT action FROM audit_events WHERE subject_type='quotation' AND subject_identifier=?
          AND action IN ('quotation.accepted','quotation.rejected') ORDER BY occurred_at DESC,id DESC LIMIT 1`, [quote.id]);
        if (!quoteDecisions.length || quoteDecisions[0].action !== 'quotation.accepted') { await connection.rollback(); return { success: false, code: 'QUOTATION_NOT_ACCEPTED' }; }
        const [invoices] = await connection.execute(`SELECT id FROM invoices WHERE order_id=? AND sent_at IS NOT NULL AND amount=? AND required_downpayment=? FOR UPDATE`, [id, quote.totalAmount, quote.downpaymentAmount]);
        if (!invoices.length) { await connection.rollback(); return { success: false, code: 'INVOICE_NOT_ISSUED' }; }
        // Preserve attachment eligibility without multiplying a payment by its links.
        const [verifiedPayments] = await connection.execute(`SELECT COALESCE(SUM(p.verified_amount),0) verifiedAmount
          FROM payments p JOIN users u ON u.id=p.submitted_by AND u.account_type='client' AND u.client_id=?
          WHERE p.order_id=? AND p.invoice_id=? AND p.payment_type='DOWNPAYMENT' AND p.verification_status='verified'
            AND EXISTS (SELECT 1 FROM payment_files pf WHERE pf.payment_id=p.id)`, [order.clientId, id, invoices[0].id]);
        if (Number(verifiedPayments[0]?.verifiedAmount ?? 0) + 0.001 < Number(quote.downpaymentAmount)) { await connection.rollback(); return { success: false, code: 'DOWNPAYMENT_NOT_VERIFIED' }; }
        const [existing] = await connection.execute(`SELECT CAST(id AS CHAR) id, reference FROM job_orders WHERE order_id=? FOR UPDATE`, [id]);
        if (existing.length) { await connection.rollback(); return { success: false, code: 'JOB_ORDER_ALREADY_EXISTS' }; }
        const [items] = await connection.execute(`SELECT CAST(oi.id AS CHAR) orderItemId, CAST(oi.specification_id AS CHAR) specificationId, oi.quantity inquiryQuantity,
            ql.quantity quotationQuantity, CAST(qc.id AS CHAR) costingId
          FROM order_items oi JOIN product_specifications ps ON ps.id=oi.specification_id AND ps.client_id=oi.client_id
          LEFT JOIN quotation_lines ql ON ql.order_item_id=oi.id AND ql.order_id=oi.order_id AND ql.quotation_id=?
          LEFT JOIN quotation_costing qc ON qc.order_item_id=oi.id AND qc.order_id=oi.order_id AND qc.quotation_id=?
          WHERE oi.order_id=? ORDER BY oi.line_number,oi.id`, [quote.id, quote.id, id]);
        if (!items.length || items.some(item => item.quotationQuantity == null || Number(item.inquiryQuantity) !== Number(item.quotationQuantity))) { await connection.rollback(); return { success: false, code: 'ORDER_QUOTATION_CONFLICT' }; }
        const year = new Date().getUTCFullYear();
        const [references] = await connection.execute(`SELECT reference FROM job_orders WHERE reference LIKE ? FOR UPDATE`, [`JO-${year}-%`]);
        const used = new Set(references.map(row => row.reference));
        let sequence = 1;
        while (used.has(`JO-${year}-${String(sequence).padStart(4, '0')}`)) sequence += 1;
        const created = [];
        for (const item of items) {
          const reference = `JO-${year}-${String(sequence++).padStart(4, '0')}`;
          const [inserted] = await connection.execute(`INSERT INTO job_orders
            (reference, order_id, client_id, order_item_id, specification_id, costing_id, quantity, production_due_date, current_stage_cursor, status, created_by)
            VALUES (?,?,?,?,?,?,?,? ,0,'jo',?)`, [reference, id, order.clientId, item.orderItemId, item.specificationId, item.costingId, item.quotationQuantity, validation.data.productionDueDate, actor.userId]);
          if (inserted.affectedRows !== 1 || inserted.insertId == null) throw new Error('Job-order write failed.');
          const jobOrderId = String(inserted.insertId);
          const [audit] = await connection.execute(`INSERT INTO audit_events (actor_id,action,subject_type,subject_identifier,new_value,request_id,occurred_at)
            VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP(3))`, [actor.userId, 'job_order.created', 'job_order', jobOrderId, JSON.stringify({ orderId: id, clientId: order.clientId, acceptedQuotationId: quote.id, purchaseOrderId: purchaseOrder.id, purchaseOrderReference: purchaseOrder.reference, orderItemId: item.orderItemId, specificationId: item.specificationId, quantity: item.quotationQuantity, status: 'jo' }), auditRequestId(context)]);
          if (audit.affectedRows !== 1) throw new Error('Job-order audit write failed.');
          created.push({ id: jobOrderId, reference, orderId: id, orderItemId: item.orderItemId, specificationId: item.specificationId, quantity: Number(item.quotationQuantity), status: 'jo', productionStarted: false, inventoryChanged: false });
        }
        await connection.commit(); transaction = false;
        return { success: true, data: { orderId: id, acceptedQuotationId: quote.id, purchaseOrderId: purchaseOrder.id, jobOrders: created } };
      } catch (error) { if (transaction) { try { await connection.rollback(); } catch {} } throw error; }
    });
  }

  async function jobOrders(id) {
    const validation = validateSalesOrderId(id);
    if (!validation.success) return validation;
    return withConnection(db, async connection => {
      if (!await assertOrder(connection, id)) return { success: false, code: 'NOT_FOUND' };
      const [rows] = await connection.execute(`SELECT CAST(jo.id AS CHAR) id, jo.reference,
        CAST(jo.order_item_id AS CHAR) orderItemId, CAST(jo.specification_id AS CHAR) specificationId,
        CAST(jo.replacement_request_id AS CHAR) replacementRequestId, jo.quantity,
        DATE_FORMAT(jo.production_due_date, '%Y-%m-%d') productionDueDate,
        jo.current_stage_cursor currentStageCursor, ps.label currentStageLabel, jo.status,
        jo.paused, jo.pause_reason pauseReason,
        DATE_FORMAT(jo.materials_deducted_at, '%Y-%m-%dT%H:%i:%s.%fZ') materialsDeductedAt,
        DATE_FORMAT(jo.completed_at, '%Y-%m-%dT%H:%i:%s.%fZ') completedAt,
        DATE_FORMAT(jo.created_at, '%Y-%m-%dT%H:%i:%s.%fZ') createdAt
        FROM job_orders jo LEFT JOIN production_stages ps ON ps.position=jo.current_stage_cursor
        WHERE jo.order_id=? ORDER BY jo.id`, [id]);
      const [events] = await connection.execute(`SELECT CAST(pe.id AS CHAR) id, CAST(pe.job_order_id AS CHAR) jobOrderId,
        pe.stage_position stagePosition, ps.label stageLabel, pe.action, pe.reason,
        DATE_FORMAT(pe.occurred_at, '%Y-%m-%dT%H:%i:%s.%fZ') occurredAt
        FROM production_events pe LEFT JOIN production_stages ps ON ps.position=pe.stage_position
        JOIN job_orders jo ON jo.id=pe.job_order_id AND jo.order_id=?
        ORDER BY pe.job_order_id, pe.occurred_at, pe.id`, [id]);
      const [bomCounts] = await connection.execute(`SELECT CAST(jbl.job_order_id AS CHAR) jobOrderId,
        COUNT(*) bomLineCount FROM job_bom_lines jbl JOIN job_orders jo ON jo.id=jbl.job_order_id
        WHERE jo.order_id=? GROUP BY jbl.job_order_id`, [id]);
      return {
        success: true,
        data: {
          orderId: id,
          jobOrders: rows.map(row => ({
            ...row,
            paused: Boolean(Number(row.paused)),
            currentStageCursor: Number(row.currentStageCursor),
            bomLineCount: Number(bomCounts.find(item => item.jobOrderId === row.id)?.bomLineCount ?? 0),
            productionEvents: events.filter(event => event.jobOrderId === row.id)
          }))
        }
      };
    });
  }

  async function delivery(id) {
    const validation = validateSalesOrderId(id);
    if (!validation.success) return validation;
    return withConnection(db, async connection => {
      if (!await assertOrder(connection, id)) return { success: false, code: 'NOT_FOUND' };
      const [shipments] = await connection.execute(`SELECT CAST(s.id AS CHAR) id, CAST(s.job_order_id AS CHAR) jobOrderId,
        s.delivery_method_code deliveryMethodCode, dm.label deliveryMethodLabel, s.status,
        s.tracking_reference trackingReference, s.tracking_link trackingLink,
        s.recipient_name recipientName, s.recipient_phone recipientPhone, s.recipient_email recipientEmail,
        s.delivery_address deliveryAddress, s.driver_name driverName, s.vehicle_plate vehiclePlate,
        s.pickup_person pickupPerson, s.pickup_phone pickupPhone, s.pickup_email pickupEmail,
        DATE_FORMAT(s.estimated_delivery_date, '%Y-%m-%d') estimatedDeliveryDate,
        DATE_FORMAT(s.expected_pickup_date, '%Y-%m-%d') expectedPickupDate,
        DATE_FORMAT(s.dispatched_at, '%Y-%m-%dT%H:%i:%s.%fZ') dispatchedAt,
        DATE_FORMAT(s.delivered_at, '%Y-%m-%dT%H:%i:%s.%fZ') deliveredAt,
        DATE_FORMAT(s.fulfillment_completed_at, '%Y-%m-%dT%H:%i:%s.%fZ') fulfillmentCompletedAt
        FROM shipments s JOIN delivery_methods dm ON dm.code=s.delivery_method_code
        WHERE s.order_id=? ORDER BY s.id`, [id]);
      const [waybills] = await connection.execute(`SELECT CAST(w.id AS CHAR) id, CAST(w.shipment_id AS CHAR) shipmentId,
        w.reference, DATE_FORMAT(w.printed_at, '%Y-%m-%dT%H:%i:%s.%fZ') printedAt
        FROM waybills w JOIN shipments s ON s.id=w.shipment_id AND s.order_id=? ORDER BY w.id`, [id]);
      const [receipts] = await connection.execute(`SELECT CAST(dr.id AS CHAR) id, CAST(dr.shipment_id AS CHAR) shipmentId,
        dr.reference, DATE_FORMAT(dr.generated_at, '%Y-%m-%dT%H:%i:%s.%fZ') generatedAt,
        DATE_FORMAT(dr.sent_to_logistics_at, '%Y-%m-%dT%H:%i:%s.%fZ') sentToLogisticsAt,
        DATE_FORMAT(dr.sent_to_client_at, '%Y-%m-%dT%H:%i:%s.%fZ') sentToClientAt
        FROM delivery_receipts dr JOIN shipments s ON s.id=dr.shipment_id AND s.order_id=? ORDER BY dr.id`, [id]);
      const [signedReceipts] = await connection.execute(`SELECT CAST(sdr.id AS CHAR) id,
        CAST(sdr.delivery_receipt_id AS CHAR) deliveryReceiptId, CAST(sdr.file_id AS CHAR) fileId,
        DATE_FORMAT(sdr.uploaded_at, '%Y-%m-%dT%H:%i:%s.%fZ') uploadedAt,
        DATE_FORMAT(sdr.received_at, '%Y-%m-%dT%H:%i:%s.%fZ') receivedAt,
        sdr.accepted_slot acceptedSlot, DATE_FORMAT(sdr.discarded_at, '%Y-%m-%dT%H:%i:%s.%fZ') discardedAt,
        f.original_filename originalFilename, f.mime_type mimeType, f.size_bytes sizeBytes, f.state fileState
        FROM signed_delivery_receipts sdr JOIN delivery_receipts dr ON dr.id=sdr.delivery_receipt_id AND dr.order_id=?
        JOIN files f ON f.id=sdr.file_id ORDER BY sdr.id`, [id]);
      return {
        success: true,
        data: {
          orderId: id,
          shipments,
          waybills,
          deliveryReceipts: receipts.map(receipt => ({
            ...receipt,
            signedReceipts: signedReceipts.filter(item => item.deliveryReceiptId === receipt.id)
          }))
        }
      };
    });
  }

  function inquirySize(height) {
    const value = Number.parseFloat(height ?? '');
    if (!Number.isFinite(value)) return null;
    return value >= 400 ? 'Large' : value >= 200 ? 'Medium' : 'Small';
  }

  function inventoryQuantity(value) {
    if (value === null || value === undefined || !['number', 'string'].includes(typeof value)) return null;
    if (typeof value === 'string' && !/^\d+(?:\.\d+)?$/.test(value)) return null;
    const quantity = Number(value);
    return Number.isFinite(quantity) && quantity >= 0 ? quantity : null;
  }

  function validNonNegativeDecimal(value) {
    if (!['number', 'string'].includes(typeof value)) return false;
    if (typeof value === 'string' && !/^\d+(?:\.\d+)?$/.test(value)) return false;
    return Number.isFinite(Number(value)) && Number(value) >= 0;
  }

  function validPositiveDecimal(value) {
    return validNonNegativeDecimal(value) && Number(value) > 0;
  }

  function materialAssessment(row, requiredQuantity, checkedAt) {
    const availableQuantity = row.inventoryId === null ? null : operationalStockQuantity(row.availableQuantity, row.quantityStatus);
    const required = Number(requiredQuantity);
    const validAvailable = availableQuantity !== null;
    const validRequired = Number.isFinite(required) && required > 0;
    const shortageQuantity = validAvailable && validRequired ? Math.max(0, required - availableQuantity) : null;
    return {
      inventoryId: row.inventoryId,
      description: row.inventoryName ?? `Material ${row.materialId}`,
      classification: 'raw_material', categoryCode: row.categoryCode ?? null,
      quantityStatus: ['unknown', 'provisional_sample', 'verified'].includes(row.quantityStatus) ? row.quantityStatus : 'unknown',
      requiredQuantity: validRequired ? required : null, availableQuantity: validAvailable ? availableQuantity : null,
      shortageQuantity, unit: row.unitCode ?? null,
      inventoryState: !validAvailable ? 'inventory_unavailable' : availableQuantity === 0 ? 'zero_stock' : 'recorded',
      status: !validAvailable || !validRequired ? 'inventory_unavailable' : shortageQuantity > 0 ? 'insufficient' : 'available',
      source: 'bom_template', checkedAt
    };
  }

  async function stockAvailability(id) {
    const validation = validateSalesOrderId(id);
    if (!validation.success) return validation;
    return withConnection(db, async connection => {
      const [orders] = await connection.execute('SELECT CAST(o.id AS CHAR) id, CAST(o.client_id AS CHAR) clientId FROM orders o WHERE o.id=?', [id]);
      if (!orders.length) return { success: false, code: 'NOT_FOUND' };
      const checkedAt = new Date().toISOString();
      const [items] = await connection.execute(`SELECT CAST(oi.id AS CHAR) itemId, oi.quantity,
        CAST(ps.id AS CHAR) specificationId, ps.filter_type_code filterTypeCode, ps.filter_name filterName,
        ps.height, ps.oem_part_number oemPartNumber
        FROM order_items oi JOIN product_specifications ps ON ps.id=oi.specification_id AND ps.client_id=oi.client_id
        WHERE oi.order_id=? ORDER BY oi.line_number, oi.id`, [id]);
      const assessments = [];
      const unmappedItems = [];
      for (const item of items) {
        const size = inquirySize(item.height);
        const [bomRows] = await connection.execute(`SELECT CAST(bt.id AS CHAR) templateId, bt.size_label sizeLabel,
          CAST(btl.material_id AS CHAR) materialId, btl.quantity_per_filter quantityPerFilter,
          m.name inventoryName, m.category_code categoryCode, u.code unitCode,
          CAST(m.id AS CHAR) inventoryId, m.quantity_on_hand availableQuantity, m.quantity_status quantityStatus
          FROM bom_templates bt JOIN bom_template_lines btl ON btl.template_id=bt.id
          LEFT JOIN materials m ON m.id=btl.material_id AND m.active=TRUE
          LEFT JOIN units u ON u.code=m.unit_code
          WHERE bt.filter_type_code=? AND (bt.size_label=? OR bt.size_label IS NULL)
          ORDER BY CASE WHEN bt.size_label=? THEN 0 ELSE 1 END, bt.id, btl.line_number`,
        [item.filterTypeCode, size, size]);
        const templateId = bomRows[0]?.templateId;
        const selectedBom = templateId ? bomRows.filter(row => row.templateId === templateId) : [];
        if (!selectedBom.length
          || selectedBom.some(row => row.materialId === null || row.inventoryId === null || !validPositiveDecimal(row.quantityPerFilter))) {
          unmappedItems.push({ itemId: item.itemId, specificationId: item.specificationId, filterTypeCode: item.filterTypeCode, filterName: item.filterName, reason: 'No approved BOM template is available for this product and size.' });
        } else {
          for (const row of selectedBom) assessments.push({ ...materialAssessment(row, Number(row.quantityPerFilter) * Number(item.quantity), checkedAt), itemId: item.itemId, specificationId: item.specificationId, filterTypeCode: item.filterTypeCode, filterName: item.filterName });
        }
        const [finishedGoods] = await connection.execute(`SELECT CAST(fg.id AS CHAR) inventoryId, fg.item_code itemCode,
          fg.enterfil_part_number partNumber, fg.quantity_on_hand availableQuantity, fg.buffer_minimum bufferMinimum,
          'pcs' unitCode, fg.demand FROM finished_goods fg
          WHERE fg.client_id=? AND (fg.specification_id=? OR (? IS NOT NULL AND fg.enterfil_part_number=?))`,
        [orders[0].clientId, item.specificationId, item.oemPartNumber, item.oemPartNumber]);
        for (const finishedGood of finishedGoods) {
          const available = inventoryQuantity(finishedGood.availableQuantity);
          const required = Number(item.quantity);
          const validRequired = Number.isFinite(required) && required > 0;
          const shortage = available !== null && validRequired ? Math.max(0, required - available) : null;
          assessments.push({
            inventoryId: finishedGood.inventoryId, description: finishedGood.itemCode || finishedGood.partNumber,
            classification: 'finished_good', categoryCode: null, requiredQuantity: validRequired ? required : null,
            availableQuantity: available, shortageQuantity: shortage, unit: finishedGood.unitCode,
            inventoryState: available === null ? 'inventory_unavailable' : available === 0 ? 'zero_stock' : 'recorded',
            status: available === null || !validRequired ? 'inventory_unavailable' : shortage > 0 ? 'insufficient' : 'available',
            source: 'finished_goods', itemId: item.itemId, specificationId: item.specificationId,
            filterTypeCode: item.filterTypeCode, filterName: item.filterName, itemCode: finishedGood.itemCode,
            partNumber: finishedGood.partNumber, bufferMinimum: inventoryQuantity(finishedGood.bufferMinimum), demand: finishedGood.demand, checkedAt
          });
        }
      }
      const mapped = assessments.filter(item => item.status !== 'inventory_unavailable');
      const hasUnavailable = assessments.some(item => item.status === 'inventory_unavailable');
      const available = mapped.filter(item => item.status === 'available').length;
      const insufficient = mapped.filter(item => item.status === 'insufficient').length;
      const overallStatus = unmappedItems.length ? 'unmapped' : !assessments.length || hasUnavailable ? 'unavailable' : insufficient && available ? 'partially_available' : insufficient ? 'insufficient' : 'available';
      return { success: true, data: { orderId: id, checkedAt, overallStatus, assessments, unmappedItems, stockChanged: false } };
    });
  }

  function quoteRound(value, places = 4) {
    return Number(Number(value).toFixed(places));
  }

  async function createQuotation(id, body, actor) {
    const identity = validateSalesOrderId(id);
    if (!identity.success) return identity;
    const validation = validateQuotationPreparation(body);
    if (!validation.success) return validation;
    if (actor?.roleCode !== 'sales' || actor?.accountType !== 'employee' || !validateSalesOrderId(actor.userId).success) return { success: false, code: 'FORBIDDEN' };
    const input = validation.data;
    let connection;
    let transaction = false;
    try {
      connection = await db.getConnection();
      await connection.beginTransaction();
      transaction = true;
      const [orders] = await connection.execute(`SELECT CAST(o.id AS CHAR) id, CAST(o.client_id AS CHAR) clientId, o.reference,
        o.stage_code stageCode, o.archived_at archivedAt, o.payment_term_code paymentTermCode,
        o.delivery_method_code deliveryMethodCode FROM orders o WHERE o.id=? FOR UPDATE`, [id]);
      const order = orders[0];
      if (!order) return { success: false, code: 'NOT_FOUND' };
      if (order.archivedAt || !['inquiry', 'quotation'].includes(order.stageCode)) return { success: false, code: 'INVALID_STATE' };
      if (input.paymentTermCode !== order.paymentTermCode && !['NET15', 'NET30'].includes(input.paymentTermCode)) return { success: false, code: 'VALIDATION_ERROR' };
      const [items] = await connection.execute(`SELECT CAST(oi.id AS CHAR) orderItemId, oi.quantity, CAST(ps.id AS CHAR) specificationId,
        ps.filter_type_code filterTypeCode, ps.filter_name filterName, ps.height
        FROM order_items oi JOIN product_specifications ps ON ps.id=oi.specification_id AND ps.client_id=oi.client_id
        WHERE oi.order_id=? ORDER BY oi.line_number, oi.id`, [id]);
      if (!items.length) return { success: false, code: 'MATERIAL_COSTING_INCOMPLETE', errors: { items: 'The inquiry has no product specifications.' } };
      const costingByItem = new Map(input.costing.map(row => [row.orderItemId, row]));
      if (items.some(item => !costingByItem.has(item.orderItemId)) || input.costing.some(row => !items.some(item => item.orderItemId === row.orderItemId))) return { success: false, code: 'VALIDATION_ERROR', errors: { costing: 'Costing must include each inquiry product exactly once.' } };
      const preparedItems = [];
      for (const item of items) {
        const size = inquirySize(item.height);
        const [bomRows] = await connection.execute(`SELECT CAST(bt.id AS CHAR) templateId, CAST(btl.material_id AS CHAR) materialId,
          btl.quantity_per_filter quantityPerFilter, btl.waste_percent wastePercent,
          m.name materialName, COALESCE(m.source_unit,m.unit_code) unitCode, m.approved_costing_price unitPrice
          FROM bom_templates bt JOIN bom_template_lines btl ON btl.template_id=bt.id
          LEFT JOIN materials m ON m.id=btl.material_id AND m.active=TRUE
          WHERE bt.filter_type_code=? AND (bt.size_label=? OR bt.size_label IS NULL)
          ORDER BY CASE WHEN bt.size_label=? THEN 0 ELSE 1 END, bt.id, btl.line_number`, [item.filterTypeCode, size, size]);
        const templateId = bomRows[0]?.templateId;
        const selectedBom = templateId ? bomRows.filter(row => row.templateId === templateId) : [];
        if (!selectedBom.length || selectedBom.some(row => row.materialId === null
          || !validNonNegativeDecimal(row.unitPrice)
          || !validPositiveDecimal(row.quantityPerFilter)
          || (row.wastePercent !== null && row.wastePercent !== undefined && !validNonNegativeDecimal(row.wastePercent)))) {
          return { success: false, code: 'MATERIAL_COSTING_INCOMPLETE', errors: { [item.orderItemId]: 'An approved BOM mapping and material price are required.' } };
        }
        const cost = costingByItem.get(item.orderItemId);
        const rawMaterialUnitCost = quoteRound(selectedBom.reduce((sum, row) => sum + Number(row.unitPrice) * Number(row.quantityPerFilter) * (1 + Number(row.wastePercent ?? 0) / 100), 0));
        const laborUnitCost = input.includeLabor ? cost.laborCost : 0;
        const baseUnitCost = rawMaterialUnitCost + laborUnitCost;
        const markupAmount = input.applyMarkup ? baseUnitCost * cost.markupPercent / 100 : 0;
        const beforeDiscount = baseUnitCost + markupAmount;
        const afterDiscount = beforeDiscount * (1 - input.discountPercent / 100);
        const calculatedUnitPrice = quoteRound(input.applyVat && input.vatType === 'Exclusive' ? afterDiscount * (1 + input.vatRate / 100) : afterDiscount);
        preparedItems.push({ item, cost, selectedBom, rawMaterialUnitCost, calculatedUnitPrice, total: quoteRound(calculatedUnitPrice * Number(item.quantity), 2) });
      }
      const [existing] = await connection.execute(`SELECT CAST(id AS CHAR) id, reference, revision_number revisionNumber, status FROM quotations WHERE order_id=? ORDER BY revision_number DESC, id DESC FOR UPDATE`, [id]);
      if (input.baseQuotationId !== undefined && input.baseQuotationId !== (existing[0]?.id ?? null)) return { success: false, code: 'QUOTATION_STALE' };
      // Keep each save as an immutable revision, including repeat draft saves.
      const revisionNumber = Number(existing[0]?.revisionNumber ?? 0) + 1;
      const reference = input.reference || existing[0]?.reference || `QT-${id}`;
      const [referenceRows] = await connection.execute('SELECT order_id orderId FROM quotation_references WHERE reference=? FOR UPDATE', [reference]);
      if (referenceRows.length && String(referenceRows[0].orderId) !== String(id)) return { success: false, code: 'VALIDATION_ERROR', errors: { reference: 'The quotation reference belongs to another order.' } };
      if (!referenceRows.length) await connection.execute('INSERT INTO quotation_references (reference, order_id) VALUES (?,?)', [reference, id]);
      const totalAmount = quoteRound(preparedItems.reduce((sum, row) => sum + row.total, 0), 2);
      const downpaymentAmount = quoteRound(totalAmount * input.downpaymentPercent / 100, 2);
      const [quoteResult] = await connection.execute(`INSERT INTO quotations
        (order_id, reference, revision_number, status, issued_on, valid_until, payment_term_code, time_of_delivery, place_of_delivery,
         note, note_highlighted, total_amount, downpayment_percent, downpayment_amount, stock_checked_at, prepared_by, sent_by, sent_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(3),?,?,?)`,
      [id, reference, revisionNumber, input.status, input.issuedOn, input.validUntil, input.paymentTermCode, input.timeOfDelivery, input.placeOfDelivery,
        input.note, input.noteHighlighted, totalAmount, input.downpaymentPercent, downpaymentAmount, actor.userId, input.status === 'sent' ? actor.userId : null, input.status === 'sent' ? new Date() : null]);
      const quotationId = String(quoteResult.insertId);
      for (const [index, row] of preparedItems.entries()) {
        await connection.execute(`INSERT INTO quotation_lines (quotation_id, order_id, order_item_id, line_number, description, sub_description, quantity, unit_label, unit_price)
          VALUES (?,?,?,?,?,?,?,?,?)`, [quotationId, id, row.item.orderItemId, index + 1, row.item.filterName || row.item.filterTypeCode, null, row.item.quantity, 'pcs', row.calculatedUnitPrice]);
        const [costingResult] = await connection.execute(`INSERT INTO quotation_costing
          (quotation_id, order_id, order_item_id, labor_cost, markup_percent, discount_percent, vat_type, vat_rate, include_labor, apply_markup, apply_vat, calculated_unit_price)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [quotationId, id, row.item.orderItemId, row.cost.laborCost, row.cost.markupPercent, input.discountPercent, input.vatType, input.vatRate, input.includeLabor, input.applyMarkup, input.applyVat, row.calculatedUnitPrice]);
        const costingId = String(costingResult.insertId);
        for (const [lineNumber, bom] of row.selectedBom.entries()) {
          await connection.execute(`INSERT INTO quotation_bom_lines (costing_id, line_number, material_id, material_name_snapshot, unit_snapshot, unit_price_snapshot, quantity_per_filter, waste_percent)
            VALUES (?,?,?,?,?,?,?,?)`, [costingId, lineNumber + 1, bom.materialId, bom.materialName, bom.unitCode, bom.unitPrice, bom.quantityPerFilter, bom.wastePercent ?? 0]);
        }
      }
      if (input.discountPercent > 0) await connection.execute('INSERT INTO quotation_discounts (quotation_id, line_number, label, percent) VALUES (?,?,?,?)', [quotationId, 1, 'Quotation discount', input.discountPercent]);
      if (input.status === 'sent') {
        await connection.execute(`UPDATE quotations SET status='superseded' WHERE order_id=? AND status='sent' AND id<>?`, [id, quotationId]);
        await connection.execute(`UPDATE order_requests SET status='completed', response=?, decided_by=?, decided_at=CURRENT_TIMESTAMP(3)
          WHERE order_id=? AND kind='quotation_revision' AND status='pending'`, [JSON.stringify({ quotationId, revisionNumber, reference }), actor.userId, id]);
        await connection.execute(`UPDATE orders SET stage_code='quotation', updated_at=GREATEST(UTC_TIMESTAMP(3),updated_at + INTERVAL 1000 MICROSECOND) WHERE id=?`, [id]);
      }
      await connection.commit();
      transaction = false;
      return { success: true, data: { id: quotationId, orderId: String(id), clientId: String(order.clientId), reference, revisionNumber, status: input.status, totalAmount: String(totalAmount.toFixed(2)), downpaymentPercent: input.downpaymentPercent, downpaymentAmount: String(downpaymentAmount.toFixed(2)), rawMaterialCost: String(preparedItems.reduce((sum, row) => sum + row.rawMaterialUnitCost * Number(row.item.quantity), 0).toFixed(2)), laborCost: String(preparedItems.reduce((sum, row) => sum + (input.includeLabor ? row.cost.laborCost * Number(row.item.quantity) : 0), 0).toFixed(2)), markupAmount: String(preparedItems.reduce((sum, row) => { const base = row.rawMaterialUnitCost + (input.includeLabor ? row.cost.laborCost : 0); return sum + base * (input.applyMarkup ? row.cost.markupPercent / 100 : 0) * Number(row.item.quantity); }, 0).toFixed(2)), markupPercent: preparedItems.length === 1 ? preparedItems[0].cost.markupPercent : null } };
    } catch (error) {
      if (transaction) try { await connection.rollback(); } catch {}
      transaction = false;
      if (error?.code === 'ER_DUP_ENTRY') return { success: false, code: 'QUOTATION_CONFLICT' };
      return { success: false, code: 'SERVICE_UNAVAILABLE' };
    } finally {
      if (transaction) try { await connection.rollback(); } catch {}
      if (connection) connection.release();
    }
  }


  async function rejectionHistory(query) {
    const validation = validateSalesOrderListQuery(query);
    if (!validation.success) return validation;
    const { page: requestedPage, pageSize, q } = validation.data;
    return withConnection(db, async connection => {
      const where = "o.archive_reason='rejected' AND o.archived_at IS NOT NULL AND (LOCATE(?,o.reference)>0 OR LOCATE(?,c.company_name)>0)";
      const [[count]] = await connection.execute(`SELECT COUNT(*) total FROM orders o JOIN clients c ON c.id=o.client_id WHERE ${where}`, [q,q]);
      const total = Number(count.total), page = Math.min(requestedPage, Math.max(1, Math.ceil(total/pageSize)));
      const [items] = await connection.execute(`SELECT CAST(o.id AS CHAR) id,o.reference,c.company_name companyName,
        o.archive_note archiveNote,DATE_FORMAT(o.archived_at,'%Y-%m-%dT%H:%i:%s.%fZ') archivedAt
        FROM orders o JOIN clients c ON c.id=o.client_id WHERE ${where} ORDER BY o.archived_at DESC,o.id DESC LIMIT ? OFFSET ?`, [q,q,String(pageSize),String((page-1)*pageSize)]);
      return { success:true, data:{items,total,page,pageSize} };
    });
  }

  async function reviewCancellation(id, requestId, decision, actor, context = {}) {
    const identity = validateSalesOrderId(id);
    if (!identity.success) return identity;
    if (!validateSalesOrderId(requestId).success || !['approved', 'declined'].includes(decision)) return { success: false, code: 'VALIDATION_ERROR' };
    const failure = code => ({ success: false, code });
    if (actor?.roleCode !== 'sales' || actor?.accountType !== 'employee' || !validateSalesOrderId(actor.userId).success) return failure('FORBIDDEN');
    let connection, transaction = false, commitAttempted = false, reusable = true;
    try {
      connection = await db.getConnection();
      await connection.beginTransaction(); transaction = true;
      const [actors] = await connection.execute("SELECT id FROM users WHERE id=? AND active=TRUE AND role_code='sales' AND account_type='employee' FOR SHARE", [actor.userId]);
      if (actors.length !== 1) return failure('FORBIDDEN');
      const [orders] = await connection.execute(`SELECT ${rejectionColumns} FROM orders o WHERE o.id=? FOR UPDATE`, [id]);
      const order = orders[0];
      if (!order) return failure('NOT_FOUND');
      const [requests] = await connection.execute(`SELECT ${cancellationColumns}, response FROM order_requests
        WHERE id=? AND order_id=? AND kind='cancellation' FOR UPDATE`, [requestId, id]);
      const request = requests[0];
      if (!request) return failure('NOT_FOUND');
      if (request.status !== 'pending') return failure('CANCELLATION_ALREADY_DECIDED');
      if (order.archivedAt || order.archiveReason || !['inquiry', 'quotation', 'po'].includes(order.stageCode)) return failure('CANCELLATION_NOT_ELIGIBLE');
      if (decision === 'approved') {
        const [payments] = await connection.execute(`SELECT id FROM payments WHERE order_id=?
          AND payment_type='DOWNPAYMENT' AND verification_status='verified' LIMIT 1 FOR UPDATE`, [id]);
        if (payments.length) return failure('CANCELLATION_NOT_ELIGIBLE');
        const [archived] = await connection.execute(`UPDATE orders SET archive_reason='cancelled',archive_note=NULL,
          archived_by=?,archived_at=UTC_TIMESTAMP(3),updated_at=GREATEST(UTC_TIMESTAMP(3),updated_at + INTERVAL 1000 MICROSECOND)
          WHERE id=? AND archived_at IS NULL AND archive_reason IS NULL`, [actor.userId, id]);
        if (archived.affectedRows !== 1 || archived.warningStatus) throw new Error('Cancellation archive write failed.');
      }
      const response = decision === 'approved' ? 'Cancellation request approved by Sales.' : 'Cancellation request declined by Sales.';
      const [updated] = await connection.execute(`UPDATE order_requests SET status=?,response=?,decided_by=?,decided_at=UTC_TIMESTAMP(3)
        WHERE id=? AND order_id=? AND kind='cancellation' AND status='pending'`,
      [decision, response, actor.userId, requestId, id]);
      if (updated.affectedRows !== 1 || updated.warningStatus) throw new Error('Cancellation decision write failed.');
      const [saved] = await connection.execute(`SELECT CAST(id AS CHAR) id, reason, status,
          DATE_FORMAT(requested_at,'%Y-%m-%dT%H:%i:%s.%fZ') requestedAt,
          DATE_FORMAT(decided_at,'%Y-%m-%dT%H:%i:%s.%fZ') resolvedAt, response
        FROM order_requests WHERE id=? AND order_id=?`, [requestId, id]);
      if (!saved[0]) throw new Error('Cancellation decision result unavailable.');
      const [audit] = await connection.execute(`INSERT INTO audit_events
        (actor_id,action,subject_type,subject_identifier,old_value,new_value,reason,request_id,occurred_at)
        VALUES (?,?,'order',?,?,?,?,?,UTC_TIMESTAMP(3))`,
      [actor.userId, `cancellation.${decision}`, id,
        JSON.stringify({ orderId: id, stageCode: order.stageCode, archiveReason: order.archiveReason,
          requestId, requestStatus: request.status }),
        JSON.stringify({ orderId: id, stageCode: order.stageCode, archiveReason: decision === 'approved' ? 'cancelled' : null,
          requestId, requestStatus: decision, reason: request.reason }),
        request.reason, auditRequestId(context)]);
      if (audit.affectedRows !== 1 || audit.warningStatus) throw new Error('Cancellation decision audit write failed.');
      commitAttempted = true;
      await connection.commit(); transaction = false;
      return { success: true, data: {
        id: order.id, reference: order.reference, stageCode: order.stageCode,
        archiveReason: decision === 'approved' ? 'cancelled' : null,
        archived: decision === 'approved', cancellationRequest: {
          id: saved[0].id, reason: saved[0].reason, status: saved[0].status,
          requestedAt: saved[0].requestedAt, resolvedAt: saved[0].resolvedAt, response: saved[0].response
        }
      } };
    } catch {
      reusable = false;
      return failure(commitAttempted ? 'WRITE_OUTCOME_UNKNOWN' : 'SERVICE_UNAVAILABLE');
    } finally {
      if (connection) {
        if (transaction) try { await connection.rollback(); } catch { reusable = false; }
        try { reusable ? connection.release() : connection.destroy(); } catch { try { connection.destroy(); } catch {} }
      }
    }
  }

  async function rejectInquiry(id, body, actor, context) {
    const validation = validateInquiryRejection(body);
    if (!validation.success) return validation;
    const identity = validateSalesOrderId(id);
    if (!identity.success) return identity;
    const failure = code => ({ success:false, code });
    if (actor?.roleCode !== 'sales' || actor?.accountType !== 'employee' || !validateSalesOrderId(actor.userId).success) return failure('FORBIDDEN');
    let connection, transaction=false, commitAttempted=false, reusable=true;
    try {
      connection = await db.getConnection();
      await connection.beginTransaction(); transaction=true;
      const [actors] = await connection.execute("SELECT id FROM users WHERE id=? AND active=TRUE AND role_code='sales' AND account_type='employee' FOR SHARE", [actor.userId]);
      if (actors.length !== 1) return failure('FORBIDDEN');
      const [orders] = await connection.execute(`SELECT ${rejectionColumns} FROM orders o WHERE o.id=? FOR UPDATE`, [id]);
      const order = orders[0];
      if (!order) return failure('NOT_FOUND');
      if (order.archivedAt && order.archiveReason === 'rejected') return failure('INQUIRY_ALREADY_REJECTED');
      const [requests] = await connection.execute(`SELECT ${cancellationColumns} FROM order_requests WHERE order_id=? AND kind='cancellation' AND status='pending' ORDER BY id FOR UPDATE`, [id]);
      if (inquiryRevision(order,requests) !== validation.data.revision) return failure('STALE_RECORD');
      if (order.archivedAt || order.archiveReason || order.stageCode !== 'inquiry') return failure('INVALID_STATE');
      const [updated] = await connection.execute(`UPDATE orders SET archive_reason='rejected',archive_note=?,archived_by=?,archived_at=UTC_TIMESTAMP(3),
        updated_at=GREATEST(UTC_TIMESTAMP(3),updated_at + INTERVAL 1000 MICROSECOND) WHERE id=? AND stage_code='inquiry' AND archived_at IS NULL AND archive_reason IS NULL`, [validation.data.reason,actor.userId,id]);
      if (updated.affectedRows !== 1 || updated.warningStatus) throw new Error('Archive write failed.');
      const [resolved] = await connection.execute(`UPDATE order_requests SET status='completed',response='Resolved due to inquiry rejection.',decided_by=?,decided_at=UTC_TIMESTAMP(3)
        WHERE order_id=? AND kind='cancellation' AND status='pending'`, [actor.userId,id]);
      if (resolved.affectedRows !== requests.length || resolved.warningStatus) throw new Error('Cancellation resolution failed.');
      const notification = await recordInquiryRejectionNotification(connection,order,actor.userId,validation.data.reason);
      const [saved] = await connection.execute(`SELECT ${rejectionColumns} FROM orders o WHERE o.id=?`, [id]);
      if (!saved[0]) throw new Error('Archive result unavailable.');
      const data = { ...saved[0], revision:inquiryRevision(saved[0],[]), resolvedCancellationIds:requests.map(row=>row.id), notification };
      const [audit] = await connection.execute(`INSERT INTO audit_events (actor_id,action,subject_type,subject_identifier,old_value,new_value,reason,request_id,occurred_at)
        VALUES (?,'inquiry.rejected','order',?,?,?,?,?,UTC_TIMESTAMP(3))`,
      [actor.userId,id,JSON.stringify({id:order.id,clientId:order.clientId,stageCode:order.stageCode,archiveReason:order.archiveReason,archivedAt:order.archivedAt,revision:validation.data.revision,cancellations:requests.map(row=>({id:row.id,status:row.status}))}),
        JSON.stringify({...data,resolvedCancellationStatus:'completed'}),validation.data.reason,auditRequestId(context)]);
      if (audit.affectedRows !== 1 || audit.warningStatus) throw new Error('Audit write failed.');
      commitAttempted=true; await connection.commit(); transaction=false;
      if (!notification.clientRecipientAvailable) {
        // A committed rejection is retained even when no active client can be notified.
        try { console.warn(JSON.stringify({event:'inquiry_rejection_client_recipient_unavailable',requestId:auditRequestId(context),orderId:id})); } catch {}
      }
      return { success:true, data };
    } catch {
      reusable=false;
      return failure(commitAttempted ? 'WRITE_OUTCOME_UNKNOWN' : 'SERVICE_UNAVAILABLE');
    } finally {
      if (connection) {
        if (transaction) try { await connection.rollback(); } catch { reusable=false; }
        try { reusable ? connection.release() : connection.destroy(); } catch { try { connection.destroy(); } catch {} }
      }
    }
  }

  return { list, detail, quotations, purchaseOrder, processPurchaseOrder, generateInvoice, createJobOrders, jobOrders, delivery, stockAvailability, createQuotation, rejectInquiry, reviewCancellation, rejectionHistory };
}
