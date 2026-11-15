import { validateSalesOrderId, validateSalesOrderListQuery } from '../validation/sales.validation.js';

const orderColumns = `CAST(o.id AS CHAR) id, o.reference, CAST(o.client_id AS CHAR) clientId,
 c.company_name companyName, o.contact_person contactPerson, o.stage_code stageCode,
 os.label stageLabel, os.display_order stageDisplayOrder, o.payment_term_code paymentTermCode,
 pt.label paymentTermLabel, o.delivery_method_code deliveryMethodCode, dm.label deliveryMethodLabel,
 DATE_FORMAT(o.submitted_at, '%Y-%m-%dT%H:%i:%s.%fZ') submittedAt, o.urgent,
 DATE_FORMAT(o.requested_delivery_date, '%Y-%m-%d') requestedDeliveryDate,
 o.general_notes generalNotes, o.archive_reason archiveReason,
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
        DATE_FORMAT(q.sent_at, '%Y-%m-%dT%H:%i:%s.%fZ') sentAt FROM quotations q WHERE q.order_id=? ORDER BY q.revision_number DESC, q.id DESC`, [id]);
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
      const [requests] = await connection.execute(`SELECT CAST(r.id AS CHAR) id, r.kind, r.reason, r.response, r.status,
        DATE_FORMAT(r.requested_at, '%Y-%m-%dT%H:%i:%s.%fZ') requestedAt,
        DATE_FORMAT(r.decided_at, '%Y-%m-%dT%H:%i:%s.%fZ') decidedAt FROM order_requests r WHERE r.order_id=? ORDER BY r.id DESC`, [id]);
      return {
        success: true,
        data: { ...order, items, quotations: quotations.map(q => ({ ...q, noteHighlighted: Boolean(Number(q.noteHighlighted)), lines: quotationLines.filter(line => line.quotationId === q.id) })), purchaseOrders, jobOrders: jobOrders.map(jo => ({ ...jo, paused: Boolean(Number(jo.paused)), currentStageCursor: Number(jo.currentStageCursor) })), invoices, payments, shipments, requests }
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
        DATE_FORMAT(q.sent_at, '%Y-%m-%dT%H:%i:%s.%fZ') sentAt
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
          noteHighlighted: Boolean(Number(quote.noteHighlighted)),
          sent: quote.sentAt !== null,
          lines: lines.filter(line => line.quotationId === quote.id),
          costing: costing.filter(item => item.quotationId === quote.id).map(item => ({
            ...item,
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
        DATE_FORMAT(po.cleared_at, '%Y-%m-%dT%H:%i:%s.%fZ') clearedAt
        FROM purchase_orders po LEFT JOIN quotations q ON q.id=po.accepted_quotation_id AND q.order_id=po.order_id
        WHERE po.order_id=?`, [id]);
      if (!rows.length) return { success: false, code: 'PURCHASE_ORDER_NOT_FOUND' };
      const [files] = await connection.execute(`SELECT CAST(pof.purchase_order_id AS CHAR) purchaseOrderId, CAST(f.id AS CHAR) id,
        pof.purpose, f.original_filename originalFilename, f.mime_type mimeType, f.size_bytes sizeBytes,
        f.state, DATE_FORMAT(f.uploaded_at, '%Y-%m-%dT%H:%i:%s.%fZ') uploadedAt
        FROM purchase_order_files pof JOIN files f ON f.id=pof.file_id
        WHERE pof.purchase_order_id=? ORDER BY f.id`, [rows[0].id]);
      return { success: true, data: { ...rows[0], received: rows[0].receivedAt !== null, cleared: rows[0].clearedAt !== null, files } };
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

  return { list, detail, quotations, purchaseOrder, jobOrders, delivery };
}
