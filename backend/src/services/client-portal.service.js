import { validateApplicationId } from '../validation/client-applications.validation.js';
import { validateSalesOrderId, validateSalesOrderListQuery } from '../validation/sales.validation.js';

const profileColumns = `CAST(c.id AS CHAR) id, c.company_name companyName, c.industry,
 c.contact_person contactPerson, c.email, c.phone, c.address_line1 addressLine1,
 c.address_line2 addressLine2, c.city_province cityProvince, c.postal_code postalCode,
 c.payment_term_code paymentTermCode, pt.label paymentTermLabel, c.active,
 DATE_FORMAT(c.joined_on, '%Y-%m-%d') joinedOn`;

const orderColumns = `CAST(o.id AS CHAR) id, o.reference,
 o.stage_code stageCode, os.label stageLabel, os.display_order stageDisplayOrder,
 o.archive_reason archiveReason,o.archive_note archiveNote,DATE_FORMAT(o.archived_at,'%Y-%m-%dT%H:%i:%s.%fZ') archivedAt,
 pt.label paymentTermLabel, dm.label deliveryMethodLabel,
 DATE_FORMAT(o.submitted_at, '%Y-%m-%dT%H:%i:%s.%fZ') submittedAt,
 DATE_FORMAT(o.requested_delivery_date, '%Y-%m-%d') requestedDeliveryDate,
 DATE_FORMAT(o.fulfillment_completed_at, '%Y-%m-%dT%H:%i:%s.%fZ') fulfillmentCompletedAt,
 DATE_FORMAT(o.updated_at, '%Y-%m-%dT%H:%i:%s.%fZ') updatedAt,
 (SELECT COUNT(*) FROM order_items oi0 WHERE oi0.order_id=o.id AND oi0.client_id=o.client_id) itemCount`;

function projectProfile(row) {
  if (!row) return null;
  return {
    id: row.id, companyName: row.companyName, industry: row.industry,
    contactPerson: row.contactPerson, email: row.email, phone: row.phone,
    addressLine1: row.addressLine1, addressLine2: row.addressLine2,
    cityProvince: row.cityProvince, postalCode: row.postalCode,
    paymentTermCode: row.paymentTermCode, paymentTermLabel: row.paymentTermLabel,
    active: Boolean(Number(row.active)), joinedOn: row.joinedOn
  };
}

function projectOrder(row) {
  if (!row) return null;
  return {
    ...row,
    itemCount: Number(row.itemCount ?? 0)
  };
}

function publicOrder(row) {
  if (!row) return null;
  return {
    id: row.id, reference: row.reference, stageLabel: row.stageLabel,
    archiveReason: row.archiveReason ?? null, archiveNote: row.archiveReason === 'rejected' ? row.archiveNote ?? null : null, archivedAt: row.archivedAt ?? null,
    paymentTermLabel: row.paymentTermLabel, deliveryMethodLabel: row.deliveryMethodLabel,
    submittedAt: row.submittedAt, requestedDeliveryDate: row.requestedDeliveryDate,
    fulfillmentCompletedAt: row.fulfillmentCompletedAt, updatedAt: row.updatedAt,
    itemCount: row.itemCount
  };
}

async function withConnection(db, work) {
  const connection = await db.getConnection();
  try { return await work(connection); } finally { connection.release(); }
}

function invalid(code, errors) { return { success: false, code, errors }; }

const jobStatusLabels = Object.freeze({
  jo: 'Scheduled',
  in_production: 'In production',
  quality_inspection: 'Quality inspection',
  ready_for_dispatch: 'Ready for dispatch',
  cancelled: 'Cancelled'
});

const shipmentStatusLabels = Object.freeze({
  pending: 'Preparing delivery',
  in_transit: 'In transit',
  delivered: 'Delivered',
  picked_up: 'Picked up'
});

export function createClientPortalService({ db }) {
  if (!db || typeof db.getConnection !== 'function') throw new TypeError('A database pool is required.');

  async function profile(clientId) {
    if (!validateApplicationId(clientId).success) return invalid('FORBIDDEN');
    return withConnection(db, async connection => {
      const [rows] = await connection.execute(
        `SELECT ${profileColumns} FROM clients c LEFT JOIN payment_terms pt ON pt.code=c.payment_term_code WHERE c.id=?`,
        [clientId]
      );
      return rows.length ? { success: true, data: projectProfile(rows[0]) } : { success: false, code: 'NOT_FOUND' };
    });
  }

  async function listOrders(clientId, query) {
    if (!validateApplicationId(clientId).success) return invalid('FORBIDDEN');
    const validation = validateSalesOrderListQuery(query);
    if (!validation.success) return validation;
    const input = validation.data;
    return withConnection(db, async connection => {
      const where = ['o.client_id=?'];
      const parameters = [clientId];
      if (input.status === 'open') where.push('o.archived_at IS NULL');
      if (input.status === 'archived') where.push('o.archived_at IS NOT NULL');
      if (input.stage !== 'all') { where.push('o.stage_code=?'); parameters.push(input.stage); }
      if (input.q) {
        where.push('(LOCATE(?, o.reference)>0 OR LOCATE(?, CAST(o.id AS CHAR))>0)');
        parameters.push(input.q, input.q);
      }
      const from = 'orders o JOIN order_stages os ON os.code=o.stage_code JOIN payment_terms pt ON pt.code=o.payment_term_code LEFT JOIN delivery_methods dm ON dm.code=o.delivery_method_code';
      const [[count]] = await connection.execute(`SELECT COUNT(*) total FROM ${from} WHERE ${where.join(' AND ')}`, parameters);
      const total = Number(count.total);
      const page = Math.min(input.page, Math.max(1, Math.ceil(total / input.pageSize)));
      const sortMap = {
        'submitted-asc': 'o.submitted_at ASC, o.id ASC', 'submitted-desc': 'o.submitted_at DESC, o.id DESC',
        'client-asc': 'o.id ASC', 'client-desc': 'o.id DESC', 'id-asc': 'o.id ASC', 'id-desc': 'o.id DESC'
      };
      const [rows] = await connection.execute(
        `SELECT ${orderColumns} FROM ${from} WHERE ${where.join(' AND ')} ORDER BY ${sortMap[input.sort]} LIMIT ? OFFSET ?`,
        [...parameters, String(input.pageSize), String((page - 1) * input.pageSize)]
      );
      return { success: true, data: { items: rows.map(row => publicOrder(projectOrder(row))), total, page, pageSize: input.pageSize } };
    });
  }

  async function detailOrder(clientId, id) {
    if (!validateApplicationId(clientId).success) return invalid('FORBIDDEN');
    const validation = validateSalesOrderId(id);
    if (!validation.success) return validation;
    return withConnection(db, async connection => {
      const [orders] = await connection.execute(
        `SELECT ${orderColumns} FROM orders o JOIN order_stages os ON os.code=o.stage_code
         JOIN payment_terms pt ON pt.code=o.payment_term_code LEFT JOIN delivery_methods dm ON dm.code=o.delivery_method_code
         WHERE o.id=? AND o.client_id=?`, [id, clientId]
      );
      if (!orders.length) return { success: false, code: 'NOT_FOUND' };
      const [items] = await connection.execute(`
        SELECT CAST(oi.id AS CHAR) id, oi.line_number lineNumber, oi.quantity,
          CAST(ps.id AS CHAR) specificationId, ps.filter_type_code filterTypeCode, ps.filter_name filterName,
          ps.od1, ps.od2, ps.id1, ps.id2, ps.height, ps.overall_height overallHeight, ps.length,
          ps.width, ps.thickness, ps.depth, ps.pocket_count pocketCount, ps.diameter,
          ps.cloth_cutting_width clothCuttingWidth, ps.cloth_cutting_length clothCuttingLength,
          ps.spring_plate_center_to_center springPlateCenterToCenter, ps.spring_plate_width springPlateWidth,
          ps.spring_plate_length springPlateLength, ps.pad_od padOd, ps.pad_id padId,
          ps.media, ps.inner_core innerCore, ps.outer_core outerCore, ps.oring, ps.gasket,
          ps.end_cap endCap, ps.oem_part_number oemPartNumber, ps.brand, ps.filtration_rating filtrationRating,
          ps.others
        FROM order_items oi JOIN product_specifications ps ON ps.id=oi.specification_id AND ps.client_id=oi.client_id
        WHERE oi.order_id=? AND oi.client_id=? ORDER BY oi.line_number, oi.id`, [id, clientId]);
      return { success: true, data: { ...publicOrder(projectOrder(orders[0])), items } };
    });
  }

  async function assertOwnedOrder(connection, clientId, id) {
    const [rows] = await connection.execute('SELECT id FROM orders WHERE id=? AND client_id=?', [id, clientId]);
    return rows.length === 1;
  }

  async function quotations(clientId, id) {
    if (!validateApplicationId(clientId).success) return invalid('FORBIDDEN');
    const validation = validateSalesOrderId(id);
    if (!validation.success) return validation;
    return withConnection(db, async connection => {
      if (!await assertOwnedOrder(connection, clientId, id)) return { success: false, code: 'NOT_FOUND' };
      const [rows] = await connection.execute(`
        SELECT CAST(q.id AS CHAR) id, q.reference, q.revision_number revisionNumber, q.status,
          DATE_FORMAT(q.issued_on, '%Y-%m-%d') issuedOn, DATE_FORMAT(q.valid_until, '%Y-%m-%d') validUntil,
          pt.label paymentTermLabel, q.time_of_delivery timeOfDelivery, q.place_of_delivery placeOfDelivery,
          q.total_amount totalAmount, q.downpayment_percent downpaymentPercent, q.downpayment_amount downpaymentAmount,
          DATE_FORMAT(q.sent_at, '%Y-%m-%dT%H:%i:%s.%fZ') sentAt
        FROM quotations q LEFT JOIN payment_terms pt ON pt.code=q.payment_term_code
        WHERE q.order_id=? AND q.status <> 'draft'
        ORDER BY q.revision_number ASC, q.id ASC`, [id]);
      const [lines] = await connection.execute(`
        SELECT CAST(ql.id AS CHAR) id, CAST(ql.quotation_id AS CHAR) quotationId,
          ql.line_number lineNumber, ql.description, ql.sub_description subDescription,
          ql.quantity, ql.unit_label unitLabel, ql.unit_price unitPrice
        FROM quotation_lines ql JOIN quotations q ON q.id=ql.quotation_id
        WHERE ql.order_id=? AND q.order_id=? AND q.status <> 'draft'
        ORDER BY ql.quotation_id, ql.line_number`, [id, id]);
      return { success: true, data: rows.map(row => ({
        id: row.id, reference: row.reference, revisionNumber: Number(row.revisionNumber), status: row.status,
        issuedOn: row.issuedOn, validUntil: row.validUntil, paymentTermLabel: row.paymentTermLabel,
        timeOfDelivery: row.timeOfDelivery, placeOfDelivery: row.placeOfDelivery,
        totalAmount: row.totalAmount, downpaymentPercent: row.downpaymentPercent,
        downpaymentAmount: row.downpaymentAmount, sentAt: row.sentAt,
        lines: lines.filter(line => line.quotationId === row.id).map(line => ({
          id: line.id, quotationId: line.quotationId, lineNumber: line.lineNumber,
          description: line.description, subDescription: line.subDescription,
          quantity: line.quantity, unitLabel: line.unitLabel, unitPrice: line.unitPrice
        }))
      })) };
    });
  }

  async function purchaseOrder(clientId, id) {
    if (!validateApplicationId(clientId).success) return invalid('FORBIDDEN');
    const validation = validateSalesOrderId(id);
    if (!validation.success) return validation;
    return withConnection(db, async connection => {
      if (!await assertOwnedOrder(connection, clientId, id)) return { success: false, code: 'NOT_FOUND' };
      const [rows] = await connection.execute(`
        SELECT CAST(po.id AS CHAR) id, CAST(po.accepted_quotation_id AS CHAR) acceptedQuotationId,
          q.reference acceptedQuotationReference, po.reference, po.client_reference clientReference,
          DATE_FORMAT(po.uploaded_at, '%Y-%m-%dT%H:%i:%s.%fZ') uploadedAt,
          DATE_FORMAT(po.received_at, '%Y-%m-%dT%H:%i:%s.%fZ') receivedAt,
          DATE_FORMAT(po.cleared_at, '%Y-%m-%dT%H:%i:%s.%fZ') clearedAt
        FROM purchase_orders po LEFT JOIN quotations q ON q.id=po.accepted_quotation_id AND q.order_id=po.order_id
        WHERE po.order_id=?`, [id]);
      if (!rows.length) return { success: true, data: null };
      const row = rows[0];
      return { success: true, data: {
        id: row.id, acceptedQuotationId: row.acceptedQuotationId,
        acceptedQuotationReference: row.acceptedQuotationReference, reference: row.reference,
        clientReference: row.clientReference, uploadedAt: row.uploadedAt,
        receivedAt: row.receivedAt, clearedAt: row.clearedAt
      } };
    });
  }

  async function jobOrders(clientId, id) {
    if (!validateApplicationId(clientId).success) return invalid('FORBIDDEN');
    const validation = validateSalesOrderId(id);
    if (!validation.success) return validation;
    return withConnection(db, async connection => {
      if (!await assertOwnedOrder(connection, clientId, id)) return { success: false, code: 'NOT_FOUND' };
      const [rows] = await connection.execute(`
        SELECT CAST(jo.id AS CHAR) id, jo.reference, jo.quantity,
          DATE_FORMAT(jo.production_due_date, '%Y-%m-%d') productionDueDate,
          jo.status, ps.label productionStageLabel,
          DATE_FORMAT(jo.completed_at, '%Y-%m-%dT%H:%i:%s.%fZ') completedAt
        FROM job_orders jo LEFT JOIN production_stages ps ON ps.position=jo.current_stage_cursor
        WHERE jo.order_id=? AND jo.client_id=? ORDER BY jo.id`, [id, clientId]);
      return { success: true, data: { orderId: id, jobOrders: rows.map(row => ({
        id: row.id, reference: row.reference, quantity: row.quantity,
        productionDueDate: row.productionDueDate,
        status: jobStatusLabels[row.status] ?? undefined,
        productionStageLabel: row.productionStageLabel,
        completedAt: row.completedAt,
        completed: row.completedAt !== null
      })) } };
    });
  }

  async function delivery(clientId, id) {
    if (!validateApplicationId(clientId).success) return invalid('FORBIDDEN');
    const validation = validateSalesOrderId(id);
    if (!validation.success) return validation;
    return withConnection(db, async connection => {
      if (!await assertOwnedOrder(connection, clientId, id)) return { success: false, code: 'NOT_FOUND' };
      const [rows] = await connection.execute(`
        SELECT CAST(s.id AS CHAR) id, CAST(s.job_order_id AS CHAR) jobOrderId,
          dm.label deliveryMethodLabel, s.status, s.tracking_reference trackingReference,
          DATE_FORMAT(s.estimated_delivery_date, '%Y-%m-%d') estimatedDeliveryDate,
          DATE_FORMAT(s.expected_pickup_date, '%Y-%m-%d') expectedPickupDate,
          DATE_FORMAT(s.dispatched_at, '%Y-%m-%dT%H:%i:%s.%fZ') dispatchedAt,
          DATE_FORMAT(s.delivered_at, '%Y-%m-%dT%H:%i:%s.%fZ') deliveredAt
        FROM shipments s JOIN delivery_methods dm ON dm.code=s.delivery_method_code
        WHERE s.order_id=? ORDER BY s.id`, [id]);
      return { success: true, data: { orderId: id, shipments: rows.map(row => ({
        id: row.id, jobOrderId: row.jobOrderId, deliveryMethodLabel: row.deliveryMethodLabel,
        status: shipmentStatusLabels[row.status] ?? undefined, trackingReference: row.trackingReference,
        estimatedDeliveryDate: row.estimatedDeliveryDate, expectedPickupDate: row.expectedPickupDate,
        dispatchedAt: row.dispatchedAt, deliveredAt: row.deliveredAt
      })) } };
    });
  }

  async function invoices(clientId, id) {
    if (!validateApplicationId(clientId).success) return invalid('FORBIDDEN');
    const validation = validateSalesOrderId(id);
    if (!validation.success) return validation;
    return withConnection(db, async connection => {
      if (!await assertOwnedOrder(connection, clientId, id)) return { success: false, code: 'NOT_FOUND' };
      const [rows] = await connection.execute(`
        SELECT CAST(i.id AS CHAR) id, i.reference,
          DATE_FORMAT(i.issued_on, '%Y-%m-%d') issuedOn,
          DATE_FORMAT(i.due_on, '%Y-%m-%d') dueOn,
          pt.label paymentTermLabel, i.amount, i.required_downpayment requiredDownpayment,
          DATE_FORMAT(i.payment_cycle_started_at, '%Y-%m-%dT%H:%i:%s.%fZ') paymentCycleStartedAt,
          DATE_FORMAT(i.sent_at, '%Y-%m-%dT%H:%i:%s.%fZ') sentAt
        FROM invoices i JOIN payment_terms pt ON pt.code=i.payment_term_code
        WHERE i.order_id=? AND i.sent_at IS NOT NULL
        ORDER BY i.issued_on DESC, i.id DESC`, [id]);
      return { success: true, data: rows.map(row => ({
        id: row.id, reference: row.reference, issuedOn: row.issuedOn, dueOn: row.dueOn,
        paymentTermLabel: row.paymentTermLabel, amount: row.amount,
        requiredDownpayment: row.requiredDownpayment, paymentCycleStartedAt: row.paymentCycleStartedAt,
        sentAt: row.sentAt
      })) };
    });
  }

  async function payments(clientId, id) {
    if (!validateApplicationId(clientId).success) return invalid('FORBIDDEN');
    const validation = validateSalesOrderId(id);
    if (!validation.success) return validation;
    return withConnection(db, async connection => {
      if (!await assertOwnedOrder(connection, clientId, id)) return { success: false, code: 'NOT_FOUND' };
      const [rows] = await connection.execute(`
        SELECT CAST(p.id AS CHAR) id, CAST(p.invoice_id AS CHAR) invoiceId,
          p.payment_type paymentType, p.submitted_amount submittedAmount,
          CASE WHEN p.verification_status='verified' THEN p.verified_amount ELSE NULL END verifiedAmount,
          p.method, p.reference_number referenceNumber,
          DATE_FORMAT(p.paid_on, '%Y-%m-%d') paidOn, p.verification_status verificationStatus,
          DATE_FORMAT(p.submitted_at, '%Y-%m-%dT%H:%i:%s.%fZ') submittedAt
        FROM payments p
        WHERE p.order_id=? ORDER BY p.submitted_at DESC, p.id DESC`, [id]);
      return { success: true, data: rows.map(row => ({
        id: row.id, invoiceId: row.invoiceId, paymentType: row.paymentType,
        submittedAmount: row.submittedAmount, verifiedAmount: row.verifiedAmount,
        method: row.method, referenceNumber: row.referenceNumber, paidOn: row.paidOn,
        verificationStatus: row.verificationStatus, submittedAt: row.submittedAt
      })) };
    });
  }

  async function dashboard(clientId) {
    if (!validateApplicationId(clientId).success) return invalid('FORBIDDEN');
    return withConnection(db, async connection => {
      const [[counts]] = await connection.execute(`
        SELECT
          (SELECT COUNT(*) FROM orders o WHERE o.client_id=? AND o.archived_at IS NULL) activeOrders,
          (SELECT COUNT(*) FROM orders o WHERE o.client_id=? AND o.stage_code='inquiry' AND o.archived_at IS NULL) pendingInquiries,
          (SELECT COUNT(*) FROM quotations q JOIN orders o ON o.id=q.order_id AND o.client_id=?
            WHERE q.status='sent' AND o.archived_at IS NULL) sentQuotations,
          (SELECT COUNT(*) FROM invoices i JOIN orders o ON o.id=i.order_id AND o.client_id=?
            WHERE i.sent_at IS NOT NULL AND o.archived_at IS NULL) openInvoices`,
        [clientId, clientId, clientId, clientId]
      );
      const [activity] = await connection.execute(`
        SELECT CAST(o.id AS CHAR) id, o.reference, os.label stageLabel,
          DATE_FORMAT(o.updated_at, '%Y-%m-%dT%H:%i:%s.%fZ') updatedAt,
          DATE_FORMAT(o.submitted_at, '%Y-%m-%dT%H:%i:%s.%fZ') submittedAt
        FROM orders o JOIN order_stages os ON os.code=o.stage_code
        WHERE o.client_id=? ORDER BY o.updated_at DESC, o.id DESC LIMIT 5`, [clientId]);
      const [deliveries] = await connection.execute(`
        SELECT CAST(s.id AS CHAR) id, CAST(s.order_id AS CHAR) orderId,
          CAST(s.job_order_id AS CHAR) jobOrderId, dm.label deliveryMethodLabel, s.status,
          s.tracking_reference trackingReference,
          DATE_FORMAT(s.estimated_delivery_date, '%Y-%m-%d') estimatedDeliveryDate,
          DATE_FORMAT(s.expected_pickup_date, '%Y-%m-%d') expectedPickupDate
        FROM shipments s JOIN orders o ON o.id=s.order_id AND o.client_id=?
          JOIN delivery_methods dm ON dm.code=s.delivery_method_code
        WHERE o.archived_at IS NULL AND s.status IN ('pending','in_transit')
          AND (s.estimated_delivery_date >= UTC_DATE() OR s.expected_pickup_date >= UTC_DATE())
        ORDER BY COALESCE(s.estimated_delivery_date, s.expected_pickup_date), s.id LIMIT 5`, [clientId]);
      const deliveryLabels = { pending: 'Preparing delivery', in_transit: 'In transit' };
      return {
        success: true,
        data: {
          activeOrders: Number(counts.activeOrders ?? 0),
          pendingInquiries: Number(counts.pendingInquiries ?? 0),
          sentQuotations: Number(counts.sentQuotations ?? 0),
          openInvoices: Number(counts.openInvoices ?? 0),
          recentOrderActivity: activity.map(row => ({
            id: row.id, reference: row.reference, stageLabel: row.stageLabel,
            updatedAt: row.updatedAt, submittedAt: row.submittedAt
          })),
          upcomingDeliveries: deliveries.map(row => ({
            id: row.id, orderId: row.orderId, jobOrderId: row.jobOrderId,
            deliveryMethodLabel: row.deliveryMethodLabel,
            status: deliveryLabels[row.status], trackingReference: row.trackingReference,
            estimatedDeliveryDate: row.estimatedDeliveryDate,
            expectedPickupDate: row.expectedPickupDate
          }))
        }
      };
    });
  }

  return { profile, listOrders, detailOrder, quotations, purchaseOrder, jobOrders, delivery, invoices, payments, dashboard };
}
