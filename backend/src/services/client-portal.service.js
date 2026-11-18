import { validateApplicationId } from '../validation/client-applications.validation.js';
import { validateCancellationRequest, validateQuotationRevisionRequest, validateSalesOrderId, validateSalesOrderListQuery, validateQuotationDecision, validatePurchaseOrderSubmission } from '../validation/sales.validation.js';
import { auditRequestId } from './audit-request-id.js';

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
 (SELECT r.reason FROM order_requests r WHERE r.order_id=o.id AND r.kind='cancellation' AND r.status='pending' ORDER BY r.requested_at DESC,r.id DESC LIMIT 1) pendingCancellationReason,
 (SELECT DATE_FORMAT(r.requested_at, '%Y-%m-%dT%H:%i:%s.%fZ') FROM order_requests r WHERE r.order_id=o.id AND r.kind='cancellation' AND r.status='pending' ORDER BY r.requested_at DESC,r.id DESC LIMIT 1) pendingCancellationRequestedAt,
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
    itemCount: Number(row.itemCount ?? 0),
    pendingCancellation: row.pendingCancellationReason == null ? null : {
      reason: row.pendingCancellationReason,
      requestedAt: row.pendingCancellationRequestedAt,
      requestedBy: 'client'
    }
  };
}

function publicOrder(row) {
  if (!row) return null;
  return {
    id: row.id, reference: row.reference, stageLabel: row.archiveReason === 'cancelled' ? 'Cancelled' : row.stageLabel,
    archiveReason: row.archiveReason ?? null, archiveNote: row.archiveReason === 'rejected' ? row.archiveNote ?? null : null, archivedAt: row.archivedAt ?? null,
    paymentTermLabel: row.paymentTermLabel, deliveryMethodLabel: row.deliveryMethodLabel,
    submittedAt: row.submittedAt, requestedDeliveryDate: row.requestedDeliveryDate,
    fulfillmentCompletedAt: row.fulfillmentCompletedAt, updatedAt: row.updatedAt,
    itemCount: row.itemCount, pendingCancellation: row.pendingCancellation ?? null
  };
}

async function withConnection(db, work) {
  const connection = await db.getConnection();
  try { return await work(connection); } finally { connection.release(); }
}

function quotationDecisionAction(decision) { return decision === 'accepted' ? 'quotation.accepted' : 'quotation.rejected'; }

async function recordQuotationDecisionNotification(connection, order, quote, actorId, decision, reason) {
  const [recipients] = await connection.execute(`SELECT CAST(id AS CHAR) id
    FROM users WHERE active=TRUE AND ((account_type='client' AND role_code='client' AND client_id=?)
      OR (account_type='employee' AND role_code='sales')) ORDER BY id FOR SHARE`, [order.clientId]);
  const ids = [...new Set(recipients.map(row => row.id))];
  const title = decision === 'accepted' ? `Quotation accepted: ${quote.reference}` : `Quotation rejected: ${quote.reference}`;
  const body = decision === 'accepted' ? 'The client accepted the quotation.' : reason;
  const [event] = await connection.execute(`INSERT INTO notifications
    (department,title,body,order_id,client_id,created_by) VALUES ('sales',?,?,?,?,?)`,
    [title, body, order.id, order.clientId, actorId]);
  if (event.affectedRows !== 1 || event.insertId == null) throw new Error('Notification write failed.');
  const notificationId = String(event.insertId);
  for (const userId of ids) {
    const [row] = await connection.execute('INSERT INTO notification_recipients (notification_id,user_id) VALUES (?,?)', [notificationId, userId]);
    if (row.affectedRows !== 1) throw new Error('Notification recipient write failed.');
  }
  return { notificationId, recipientCount: ids.length };
}

function invalid(code, errors) { return { success: false, code, errors }; }

function validDownpayment(totalAmount, percent, amount) {
  const total = Number(totalAmount), rate = Number(percent), required = Number(amount);
  const expected = Number.isFinite(total) && Number.isFinite(rate) ? Math.round(total * rate) / 100 : NaN;
  return Number.isFinite(total) && total >= 0 && [20, 50].includes(rate) && Number.isFinite(required) && required > 0 && required <= total && Math.abs(required - expected) < 0.001;
}

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
      const [revisionRequests] = await connection.execute(`
        SELECT CAST(id AS CHAR) id, reason, status,
          DATE_FORMAT(requested_at, '%Y-%m-%dT%H:%i:%s.%fZ') requestedAt,
          DATE_FORMAT(decided_at, '%Y-%m-%dT%H:%i:%s.%fZ') decidedAt
        FROM order_requests WHERE order_id=? AND kind='quotation_revision'
        ORDER BY requested_at DESC, id DESC`, [id]);
      const [cancellationRequests] = await connection.execute(`
        SELECT r.reason, r.status resolution,
          DATE_FORMAT(r.requested_at, '%Y-%m-%dT%H:%i:%s.%fZ') requestedAt,
          DATE_FORMAT(r.decided_at, '%Y-%m-%dT%H:%i:%s.%fZ') resolvedAt,
          CASE WHEN u.account_type='client' THEN 'client' ELSE 'management' END requestedBy,
          r.response
        FROM order_requests r LEFT JOIN users u ON u.id=r.requested_by
        WHERE r.order_id=? AND r.kind='cancellation'
        ORDER BY r.requested_at DESC, r.id DESC`, [id]);
      return { success: true, data: {
        ...publicOrder(projectOrder(orders[0])), items, revisionRequests,
        cancellationHistory: cancellationRequests.map(request => ({
          reason: request.reason, resolution: request.resolution, requestedAt: request.requestedAt,
          resolvedAt: request.resolvedAt, requestedBy: request.requestedBy, response: request.response ?? undefined
        }))
      } };
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
          (q.id=(SELECT qlatest.id FROM quotations qlatest WHERE qlatest.order_id=q.order_id ORDER BY qlatest.revision_number DESC,qlatest.id DESC LIMIT 1)) isLatestRevision,
          DATE_FORMAT(q.issued_on, '%Y-%m-%d') issuedOn, DATE_FORMAT(q.valid_until, '%Y-%m-%d') validUntil,
          pt.label paymentTermLabel, q.time_of_delivery timeOfDelivery, q.place_of_delivery placeOfDelivery,
          q.total_amount totalAmount, q.downpayment_percent downpaymentPercent, q.downpayment_amount downpaymentAmount,
          DATE_FORMAT(q.sent_at, '%Y-%m-%dT%H:%i:%s.%fZ') sentAt
        FROM quotations q LEFT JOIN payment_terms pt ON pt.code=q.payment_term_code
        WHERE q.order_id=? AND q.status <> 'draft'
        ORDER BY q.revision_number ASC, q.id ASC`, [id]);
      const decisions = rows.length ? await connection.execute(`
        SELECT subject_identifier quotationId, action, reason, DATE_FORMAT(occurred_at, '%Y-%m-%dT%H:%i:%s.%fZ') decidedAt
        FROM audit_events
        WHERE subject_type='quotation' AND action IN ('quotation.accepted','quotation.rejected')
          AND subject_identifier IN (${rows.map(() => '?').join(',')})
        ORDER BY occurred_at DESC, id DESC`, rows.map(row => row.id)) : [[]];
      const decisionByQuotation = new Map();
      for (const row of decisions[0]) if (!decisionByQuotation.has(row.quotationId)) decisionByQuotation.set(row.quotationId, row);
      const [lines] = await connection.execute(`
        SELECT CAST(ql.id AS CHAR) id, CAST(ql.quotation_id AS CHAR) quotationId,
          ql.line_number lineNumber, ql.description, ql.sub_description subDescription,
          ql.quantity, ql.unit_label unitLabel, ql.unit_price unitPrice
        FROM quotation_lines ql JOIN quotations q ON q.id=ql.quotation_id
        WHERE ql.order_id=? AND q.order_id=? AND q.status <> 'draft'
        ORDER BY ql.quotation_id, ql.line_number`, [id, id]);
      return { success: true, data: rows.map(row => ({
        downpaymentValid: validDownpayment(row.totalAmount, row.downpaymentPercent, row.downpaymentAmount),
        ...(decisionByQuotation.has(row.id) ? { decision: decisionByQuotation.get(row.id).action === 'quotation.accepted' ? 'accepted' : 'rejected', decisionReason: decisionByQuotation.get(row.id).reason, decidedAt: decisionByQuotation.get(row.id).decidedAt } : { decision: null, decisionReason: null, decidedAt: null }),
        id: row.id, reference: row.reference, revisionNumber: Number(row.revisionNumber), status: row.status,
        isLatestRevision: Boolean(Number(row.isLatestRevision)),
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

  async function decideQuotation(clientId, userId, orderId, quotationId, body, context = {}) {
    if (!validateApplicationId(clientId).success || !validateApplicationId(userId).success) return invalid('FORBIDDEN');
    const orderValidation = validateSalesOrderId(orderId);
    if (!orderValidation.success) return orderValidation;
    const quotationValidation = validateApplicationId(quotationId);
    if (!quotationValidation.success) return invalid('VALIDATION_ERROR', { quotationId: 'Invalid quotation identifier.' });
    const validation = validateQuotationDecision(body);
    if (!validation.success) return validation;
    return withConnection(db, async connection => {
      let transaction = false;
      try {
        await connection.beginTransaction(); transaction = true;
        const [orders] = await connection.execute(`SELECT CAST(o.id AS CHAR) id, CAST(o.client_id AS CHAR) clientId, o.reference, o.stage_code stageCode,
          o.archived_at archivedAt, o.archive_reason archiveReason
          FROM orders o WHERE o.id=? AND o.client_id=? FOR UPDATE`, [orderId, clientId]);
        if (!orders.length) { await connection.rollback(); return { success: false, code: 'NOT_FOUND' }; }
        const order = orders[0];
        if (order.archivedAt || order.archiveReason) { await connection.rollback(); return { success: false, code: 'QUOTATION_NOT_ELIGIBLE' }; }
        const [quotes] = await connection.execute(`SELECT CAST(q.id AS CHAR) id, q.reference, q.revision_number revisionNumber, q.status,
            q.total_amount totalAmount, q.downpayment_percent downpaymentPercent, q.downpayment_amount downpaymentAmount
          FROM quotations q WHERE q.id=? AND q.order_id=? FOR UPDATE`, [quotationId, orderId]);
        if (!quotes.length) { await connection.rollback(); return { success: false, code: 'NOT_FOUND' }; }
        const quote = quotes[0];
        const [latestRows] = await connection.execute(`SELECT CAST(id AS CHAR) id, status FROM quotations WHERE order_id=? ORDER BY revision_number DESC, id DESC LIMIT 1 FOR UPDATE`, [orderId]);
        if (!latestRows.length || latestRows[0].id !== quote.id || quote.status !== 'sent' || latestRows[0].status !== 'sent' || !validDownpayment(quote.totalAmount, quote.downpaymentPercent, quote.downpaymentAmount)) {
          await connection.rollback(); return { success: false, code: 'QUOTATION_NOT_ELIGIBLE' };
        }
        const [pendingRevision] = await connection.execute(`SELECT id FROM order_requests WHERE order_id=? AND kind='quotation_revision' AND status='pending' FOR UPDATE`, [orderId]);
        if (pendingRevision.length) { await connection.rollback(); return { success: false, code: 'REVISION_ALREADY_PENDING' }; }
        const [existing] = await connection.execute(`SELECT action, reason, DATE_FORMAT(occurred_at, '%Y-%m-%dT%H:%i:%s.%fZ') decidedAt
          FROM audit_events WHERE subject_type='quotation' AND subject_identifier=?
            AND action IN ('quotation.accepted','quotation.rejected') ORDER BY occurred_at DESC, id DESC LIMIT 1 FOR UPDATE`, [quotationId]);
        if (existing.length) { await connection.rollback(); return { success: false, code: 'QUOTATION_ALREADY_DECIDED' }; }
        if (validation.data.decision === 'accepted' && order.stageCode !== 'quotation') {
          await connection.rollback(); return { success: false, code: 'QUOTATION_CONFLICT' };
        }
        if (validation.data.decision === 'accepted') {
          const [updated] = await connection.execute(`UPDATE orders SET stage_code='po', updated_at=CURRENT_TIMESTAMP(3) WHERE id=? AND client_id=? AND stage_code='quotation'`, [orderId, clientId]);
          if (updated.affectedRows !== 1) { await connection.rollback(); return { success: false, code: 'QUOTATION_CONFLICT' }; }
        }
        const action = quotationDecisionAction(validation.data.decision);
        const newValue = JSON.stringify({ orderId, clientId, quotationId, reference: quote.reference, revisionNumber: Number(quote.revisionNumber), decision: validation.data.decision });
        const [audit] = await connection.execute(`INSERT INTO audit_events (actor_id,action,subject_type,subject_identifier,old_value,new_value,reason,request_id,occurred_at)
          VALUES (?,?,?, ?,?,?,?, ?,CURRENT_TIMESTAMP(3))`, [userId, action, 'quotation', quotationId, JSON.stringify({ status: quote.status }), newValue, validation.data.reason, auditRequestId(context)]);
        if (audit.affectedRows !== 1) throw new Error('Audit write failed.');
        const notification = await recordQuotationDecisionNotification(connection, order, quote, userId, validation.data.decision, validation.data.reason);
        await connection.commit(); transaction = false;
        return { success: true, data: { quotationId, orderId, reference: quote.reference, revisionNumber: Number(quote.revisionNumber), decision: validation.data.decision, reason: validation.data.reason, decidedAt: new Date().toISOString(), orderStage: validation.data.decision === 'accepted' ? 'po' : order.stageCode, notification } };
      } catch (error) {
        if (transaction) { try { await connection.rollback(); } catch {} }
        throw error;
      }
    });
  }

  async function submitPurchaseOrder(clientId, userId, orderId, body, context = {}) {
    if (!validateApplicationId(clientId).success || !validateApplicationId(userId).success) return invalid('FORBIDDEN');
    const orderValidation = validateSalesOrderId(orderId);
    if (!orderValidation.success) return orderValidation;
    const validation = validatePurchaseOrderSubmission(body);
    if (!validation.success) return validation;
    return withConnection(db, async connection => {
      let transaction = false;
      try {
        await connection.beginTransaction(); transaction = true;
        const [orders] = await connection.execute(`SELECT CAST(id AS CHAR) id, CAST(client_id AS CHAR) clientId, reference,
          archived_at archivedAt, archive_reason archiveReason FROM orders WHERE id=? AND client_id=? FOR UPDATE`, [orderId, clientId]);
        if (!orders.length) { await connection.rollback(); return { success: false, code: 'NOT_FOUND' }; }
        if (orders[0].archivedAt || orders[0].archiveReason) { await connection.rollback(); return { success: false, code: 'QUOTATION_NOT_ELIGIBLE' }; }
        const [quotes] = await connection.execute(`SELECT CAST(id AS CHAR) id, reference, revision_number revisionNumber, status, total_amount totalAmount, downpayment_percent downpaymentPercent, downpayment_amount downpaymentAmount
          FROM quotations WHERE order_id=? ORDER BY revision_number DESC, id DESC LIMIT 1 FOR UPDATE`, [orderId]);
        if (!quotes.length || quotes[0].status !== 'sent' || !validDownpayment(quotes[0].totalAmount, quotes[0].downpaymentPercent, quotes[0].downpaymentAmount)) { await connection.rollback(); return { success: false, code: 'QUOTATION_NOT_ELIGIBLE' }; }
        const quote = quotes[0];
        const [decisions] = await connection.execute(`SELECT action FROM audit_events WHERE subject_type='quotation' AND subject_identifier=? AND action IN ('quotation.accepted','quotation.rejected') ORDER BY occurred_at DESC, id DESC LIMIT 1`, [quote.id]);
        if (!decisions.length || decisions[0].action !== 'quotation.accepted') { await connection.rollback(); return { success: false, code: 'QUOTATION_NOT_ACCEPTED' }; }
        const [existing] = await connection.execute('SELECT CAST(id AS CHAR) id FROM purchase_orders WHERE order_id=? FOR UPDATE', [orderId]);
        if (existing.length) { await connection.rollback(); return { success: false, code: 'PURCHASE_ORDER_ALREADY_EXISTS' }; }
        const [inserted] = await connection.execute(`INSERT INTO purchase_orders (order_id, accepted_quotation_id, reference, client_reference, uploaded_by, uploaded_at)
          VALUES (?,?,?,?,?,CURRENT_TIMESTAMP(3))`, [orderId, quote.id, validation.data.reference, validation.data.reference, userId]);
        if (inserted.affectedRows !== 1 || inserted.insertId == null) throw new Error('Purchase-order write failed.');
        const purchaseOrderId = String(inserted.insertId);
        const newValue = JSON.stringify({ orderId, clientId, purchaseOrderId, reference: validation.data.reference, acceptedQuotationId: quote.id, acceptedQuotationReference: quote.reference, downpaymentPercent: Number(quote.downpaymentPercent), downpaymentAmount: quote.downpaymentAmount });
        const [audit] = await connection.execute(`INSERT INTO audit_events (actor_id,action,subject_type,subject_identifier,new_value,request_id,occurred_at)
          VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP(3))`, [userId, 'purchase_order.received', 'purchase_order', purchaseOrderId, newValue, auditRequestId(context)]);
        if (audit.affectedRows !== 1) throw new Error('Purchase-order audit write failed.');
        await connection.commit(); transaction = false;
        return { success: true, data: { id: purchaseOrderId, orderId, reference: validation.data.reference, acceptedQuotationId: quote.id, acceptedQuotationReference: quote.reference, status: 'received', documentUpload: 'unavailable', downpaymentPercent: Number(quote.downpaymentPercent), downpaymentAmount: quote.downpaymentAmount } };
      } catch (error) { if (transaction) { try { await connection.rollback(); } catch {} } throw error; }
    });
  }

  async function requestQuotationRevision(clientId, userId, orderId, body, context = {}) {
    if (!validateApplicationId(clientId).success || !validateApplicationId(userId).success) return invalid('FORBIDDEN');
    const orderValidation = validateSalesOrderId(orderId); if (!orderValidation.success) return orderValidation;
    const validation = validateQuotationRevisionRequest(body); if (!validation.success) return validation;
    return withConnection(db, async connection => {
      let transaction = false;
      try {
        await connection.beginTransaction(); transaction = true;
        const [orders] = await connection.execute(`SELECT CAST(id AS CHAR) id, CAST(client_id AS CHAR) clientId, stage_code stageCode,
          archived_at archivedAt, archive_reason archiveReason FROM orders WHERE id=? AND client_id=? FOR UPDATE`, [orderId, clientId]);
        if (!orders.length) { await connection.rollback(); return { success: false, code: 'NOT_FOUND' }; }
        if (orders[0].archivedAt || orders[0].archiveReason) { await connection.rollback(); return { success: false, code: 'QUOTATION_NOT_ELIGIBLE' }; }
        const [quotes] = await connection.execute(`SELECT CAST(id AS CHAR) id, reference, status, revision_number revisionNumber FROM quotations WHERE order_id=? ORDER BY revision_number DESC,id DESC LIMIT 1 FOR UPDATE`, [orderId]);
        if (orders[0].stageCode !== 'quotation' || !quotes.length || quotes[0].status !== 'sent') { await connection.rollback(); return { success: false, code: 'QUOTATION_NOT_ELIGIBLE' }; }
        const [decisions] = await connection.execute(`SELECT action FROM audit_events WHERE subject_type='quotation' AND subject_identifier=?
          AND action IN ('quotation.accepted','quotation.rejected') ORDER BY occurred_at DESC,id DESC LIMIT 1 FOR UPDATE`, [quotes[0].id]);
        if (decisions.length) { await connection.rollback(); return { success: false, code: 'QUOTATION_ALREADY_DECIDED' }; }
        const [pending] = await connection.execute(`SELECT id FROM order_requests WHERE order_id=? AND kind='quotation_revision' AND status='pending' FOR UPDATE`, [orderId]);
        if (pending.length) { await connection.rollback(); return { success: false, code: 'REVISION_ALREADY_PENDING' }; }
        const [inserted] = await connection.execute(`INSERT INTO order_requests (order_id,kind,reason,requested_by,status) VALUES (?,'quotation_revision',?,?, 'pending')`, [orderId, validation.data.reason, userId]);
        if (inserted.affectedRows !== 1 || inserted.insertId == null) throw new Error('Revision request write failed.');
        const requestId = String(inserted.insertId);
        const [audit] = await connection.execute(`INSERT INTO audit_events (actor_id,action,subject_type,subject_identifier,new_value,reason,request_id,occurred_at) VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP(3))`, [userId, 'quotation.revision_requested', 'order', orderId, JSON.stringify({ orderId, clientId, quotationId: quotes[0].id, quotationReference: quotes[0].reference, revisionNumber: Number(quotes[0].revisionNumber), requestId }), validation.data.reason, auditRequestId(context)]);
        if (audit.affectedRows !== 1) throw new Error('Revision audit write failed.');
        await connection.commit(); transaction = false;
        return { success: true, data: { id: requestId, orderId, quotationId: quotes[0].id, quotationReference: quotes[0].reference, revisionNumber: Number(quotes[0].revisionNumber), status: 'pending', reason: validation.data.reason } };
      } catch (error) { if (transaction) { try { await connection.rollback(); } catch {} } throw error; }
    });
  }

  async function requestCancellation(clientId, userId, orderId, body, context = {}) {
    if (!validateApplicationId(clientId).success || !validateApplicationId(userId).success) return invalid('FORBIDDEN');
    const identity = validateSalesOrderId(orderId);
    if (!identity.success) return identity;
    const validation = validateCancellationRequest(body);
    if (!validation.success) return validation;
    let connection, transaction = false, commitAttempted = false, reusable = true;
    try {
      connection = await db.getConnection();
      await connection.beginTransaction(); transaction = true;
      const [orders] = await connection.execute(`SELECT CAST(id AS CHAR) id, CAST(client_id AS CHAR) clientId,
          stage_code stageCode, archive_reason archiveReason,
          DATE_FORMAT(archived_at,'%Y-%m-%dT%H:%i:%s.%fZ') archivedAt
        FROM orders WHERE id=? AND client_id=? FOR UPDATE`, [orderId, clientId]);
      if (!orders.length) return { success: false, code: 'NOT_FOUND' };
      const order = orders[0];
      if (order.archivedAt || order.archiveReason || !['inquiry', 'quotation', 'po'].includes(order.stageCode)) {
        return { success: false, code: 'CANCELLATION_NOT_ELIGIBLE' };
      }
      const [pending] = await connection.execute(`SELECT CAST(id AS CHAR) id FROM order_requests
        WHERE order_id=? AND kind='cancellation' AND status='pending' ORDER BY id FOR UPDATE`, [orderId]);
      if (pending.length) return { success: false, code: 'CANCELLATION_ALREADY_PENDING' };
      const [payments] = await connection.execute(`SELECT id FROM payments
        WHERE order_id=? AND payment_type='DOWNPAYMENT' AND verification_status='verified' LIMIT 1 FOR UPDATE`, [orderId]);
      if (payments.length) return { success: false, code: 'CANCELLATION_NOT_ELIGIBLE' };
      const [inserted] = await connection.execute(`INSERT INTO order_requests (order_id,kind,reason,requested_by,status)
        VALUES (?,'cancellation',?,?,'pending')`, [orderId, validation.data.reason, userId]);
      if (inserted.affectedRows !== 1 || inserted.insertId == null) throw new Error('Cancellation request write failed.');
      const requestId = String(inserted.insertId);
      const [saved] = await connection.execute(`SELECT reason, status,
          DATE_FORMAT(requested_at,'%Y-%m-%dT%H:%i:%s.%fZ') requestedAt
        FROM order_requests WHERE id=? AND order_id=? AND kind='cancellation'`, [requestId, orderId]);
      if (!saved[0]) throw new Error('Cancellation request result unavailable.');
      const [audit] = await connection.execute(`INSERT INTO audit_events
        (actor_id,action,subject_type,subject_identifier,old_value,new_value,reason,request_id,occurred_at)
        VALUES (?,'cancellation.requested','order',?,?,?,?,?,UTC_TIMESTAMP(3))`,
      [userId, orderId, JSON.stringify({ stageCode: order.stageCode, archiveReason: order.archiveReason }),
        JSON.stringify({ orderId, clientId, cancellationRequestId: requestId, status: 'pending' }),
        validation.data.reason, auditRequestId(context)]);
      if (audit.affectedRows !== 1 || audit.warningStatus) throw new Error('Cancellation request audit write failed.');
      commitAttempted = true;
      await connection.commit(); transaction = false;
      return { success: true, data: {
        id: requestId, orderId, status: 'pending', reason: saved[0].reason,
        requestedAt: saved[0].requestedAt, requestedBy: 'client'
      } };
    } catch {
      reusable = false;
      return { success: false, code: commitAttempted ? 'WRITE_OUTCOME_UNKNOWN' : 'SERVICE_UNAVAILABLE' };
    } finally {
      if (connection) {
        if (transaction) try { await connection.rollback(); } catch { reusable = false; }
        try { reusable ? connection.release() : connection.destroy(); } catch { try { connection.destroy(); } catch {} }
      }
    }
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
          DATE_FORMAT(po.cleared_at, '%Y-%m-%dT%H:%i:%s.%fZ') clearedAt,
          (SELECT CASE WHEN a.action='purchase_order.validated' THEN 'validated' WHEN a.action='purchase_order.rejected' THEN 'rejected' WHEN a.action='purchase_order.received' THEN 'received' END FROM audit_events a WHERE a.subject_type='purchase_order' AND a.subject_identifier=CAST(po.id AS CHAR) AND a.action IN ('purchase_order.received','purchase_order.validated','purchase_order.rejected') ORDER BY a.occurred_at DESC,a.id DESC LIMIT 1) poStatus,
          (SELECT a.reason FROM audit_events a WHERE a.subject_type='purchase_order' AND a.subject_identifier=CAST(po.id AS CHAR) AND a.action IN ('purchase_order.received','purchase_order.validated','purchase_order.rejected') ORDER BY a.occurred_at DESC,a.id DESC LIMIT 1) poDecisionReason
        FROM purchase_orders po LEFT JOIN quotations q ON q.id=po.accepted_quotation_id AND q.order_id=po.order_id
        WHERE po.order_id=?`, [id]);
      if (!rows.length) return { success: true, data: null };
      const [files] = await connection.execute(`SELECT CAST(pof.purchase_order_id AS CHAR) purchaseOrderId, CAST(f.id AS CHAR) id, pof.purpose, f.original_filename originalFilename, f.mime_type mimeType, f.size_bytes sizeBytes, f.state, DATE_FORMAT(f.uploaded_at, '%Y-%m-%dT%H:%i:%s.%fZ') uploadedAt FROM purchase_order_files pof JOIN files f ON f.id=pof.file_id WHERE pof.purchase_order_id=? AND f.state='available' ORDER BY f.id`, [rows[0].id]);
      const row = rows[0];
      return { success: true, data: {
        id: row.id, acceptedQuotationId: row.acceptedQuotationId,
        acceptedQuotationReference: row.acceptedQuotationReference, reference: row.reference,
        clientReference: row.clientReference, uploadedAt: row.uploadedAt, status: row.poStatus ?? 'received', decisionReason: row.poDecisionReason ?? null,
        receivedAt: row.receivedAt, clearedAt: row.clearedAt, files
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
          p.note rejectionReason,
          DATE_FORMAT(p.paid_on, '%Y-%m-%d') paidOn, p.verification_status verificationStatus,
          DATE_FORMAT(p.submitted_at, '%Y-%m-%dT%H:%i:%s.%fZ') submittedAt,
          CAST(pf.file_id AS CHAR) proofFileId, f.original_filename proofFilename
        FROM payments p LEFT JOIN payment_files pf ON pf.payment_id=p.id AND pf.purpose='proof_of_payment' LEFT JOIN files f ON f.id=pf.file_id AND f.state='available'
        WHERE p.order_id=? ORDER BY p.submitted_at DESC, p.id DESC`, [id]);
      return { success: true, data: rows.map(row => ({
        id: row.id, invoiceId: row.invoiceId, paymentType: row.paymentType,
        submittedAmount: row.submittedAmount, verifiedAmount: row.verifiedAmount,
        method: row.method, referenceNumber: row.referenceNumber, paidOn: row.paidOn,
        verificationStatus: row.verificationStatus, rejectionReason: row.rejectionReason, proofFileId: row.proofFileId, proofFilename: row.proofFilename, submittedAt: row.submittedAt
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

  return { profile, listOrders, detailOrder, quotations, decideQuotation, submitPurchaseOrder, requestQuotationRevision, requestCancellation, purchaseOrder, jobOrders, delivery, invoices, payments, dashboard };
}
