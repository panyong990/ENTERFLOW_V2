import { validateSalesOrderId } from '../validation/sales.validation.js';

const allowedStatuses = new Set(['jo', 'in_production', 'quality_inspection', 'ready_for_dispatch', 'dispatched', 'delivered', 'paid', 'overdue', 'cancelled']);

function queryInput(query = {}) {
  const input = query && typeof query === 'object' ? query : {};
  const errors = {};
  const q = typeof input.q === 'string' ? input.q.trim() : '';
  const status = input.status == null || input.status === '' || input.status === 'all' ? 'all' : String(input.status);
  const page = Number(input.page ?? 1);
  const pageSize = Number(input.pageSize ?? 25);
  if (q.length > 120) errors.q = 'Search text is too long.';
  if (status !== 'all' && !allowedStatuses.has(status)) errors.status = 'Unsupported Job Order status.';
  if (!Number.isInteger(page) || page < 1 || page > 100000) errors.page = 'Invalid page.';
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) errors.pageSize = 'Invalid page size.';
  return Object.keys(errors).length ? { success: false, code: 'VALIDATION_ERROR', errors } : { success: true, data: { q, status, page, pageSize } };
}

const columns = `CAST(jo.id AS CHAR) id, jo.reference, CAST(jo.order_id AS CHAR) orderId, CAST(jo.client_id AS CHAR) clientId,
  c.company_name clientName, o.reference inquiryReference, CAST(jo.order_item_id AS CHAR) orderItemId,
  CAST(jo.specification_id AS CHAR) specificationId, ps.filter_type_code filterTypeCode, ps.filter_name filterName,
  ps.od1, ps.od2, ps.id1, ps.id2, ps.height, ps.overall_height overallHeight, ps.length, ps.width, ps.thickness,
  ps.depth, ps.pocket_count pocketCount, ps.diameter, ps.cloth_cutting_width clothCuttingWidth,
  ps.cloth_cutting_length clothCuttingLength, ps.spring_plate_center_to_center springPlateCenterToCenter,
  ps.spring_plate_width springPlateWidth, ps.spring_plate_length springPlateLength, ps.pad_od padOd, ps.pad_id padId,
  ps.media, ps.inner_core innerCore, ps.outer_core outerCore, ps.oring, ps.gasket, ps.end_cap endCap,
  ps.oem_part_number oemPartNumber, ps.brand, ps.filtration_rating filtrationRating, ps.others, ps.notes,
  jo.quantity, DATE_FORMAT(jo.production_due_date, '%Y-%m-%d') productionDueDate,
  DATE_FORMAT(jo.created_at, '%Y-%m-%dT%H:%i:%s.%fZ') createdAt, CAST(jo.created_by AS CHAR) createdBy,
  jo.current_stage_cursor currentStageCursor, pst.label currentStageLabel, jo.status, jo.paused, jo.pause_reason pauseReason,
  DATE_FORMAT(jo.materials_deducted_at, '%Y-%m-%dT%H:%i:%s.%fZ') materialsDeductedAt,
  DATE_FORMAT(jo.completed_at, '%Y-%m-%dT%H:%i:%s.%fZ') completedAt,
  (SELECT JSON_UNQUOTE(JSON_EXTRACT(a.new_value, '$.acceptedQuotationId')) FROM audit_events a WHERE a.subject_type='job_order' AND a.subject_identifier=CAST(jo.id AS CHAR) AND a.action='job_order.created' ORDER BY a.occurred_at DESC,a.id DESC LIMIT 1) acceptedQuotationId,
  (SELECT JSON_UNQUOTE(JSON_EXTRACT(a.new_value, '$.purchaseOrderId')) FROM audit_events a WHERE a.subject_type='job_order' AND a.subject_identifier=CAST(jo.id AS CHAR) AND a.action='job_order.created' ORDER BY a.occurred_at DESC,a.id DESC LIMIT 1) purchaseOrderId,
  (SELECT JSON_UNQUOTE(JSON_EXTRACT(a.new_value, '$.purchaseOrderReference')) FROM audit_events a WHERE a.subject_type='job_order' AND a.subject_identifier=CAST(jo.id AS CHAR) AND a.action='job_order.created' ORDER BY a.occurred_at DESC,a.id DESC LIMIT 1) purchaseOrderReference`;

async function withConnection(db, work) {
  const connection = await db.getConnection();
  try { return await work(connection); } finally { connection.release(); }
}

function project(row, trace = null) {
  return {
    ...row,
    id: String(row.id), orderId: String(row.orderId), clientId: String(row.clientId), orderItemId: String(row.orderItemId), specificationId: String(row.specificationId),
    quantity: Number(row.quantity), currentStageCursor: Number(row.currentStageCursor), paused: Boolean(Number(row.paused)),
    acceptedQuotationId: row.acceptedQuotationId == null ? null : String(row.acceptedQuotationId), purchaseOrderId: row.purchaseOrderId == null ? null : String(row.purchaseOrderId),
    trace: trace ?? { acceptedQuotationReference: null, purchaseOrderReference: row.purchaseOrderReference ?? null, poDocumentAvailable: false }
  };
}

function parseTrace(row) {
  if (!row?.newValue) return { acceptedQuotationReference: null, purchaseOrderReference: null, poDocumentAvailable: false };
  try {
    const value = JSON.parse(row.newValue);
    return { acceptedQuotationReference: value.acceptedQuotationReference ?? null, purchaseOrderReference: value.purchaseOrderReference ?? null, poDocumentAvailable: false, createdBy: row.actorId == null ? null : String(row.actorId), createdAt: row.occurredAt ?? null };
  } catch { return { acceptedQuotationReference: null, purchaseOrderReference: null, poDocumentAvailable: false }; }
}

export function createProductionJobOrdersService({ db }) {
  if (!db || typeof db.getConnection !== 'function') throw new TypeError('A database pool is required.');
  const from = 'job_orders jo JOIN orders o ON o.id=jo.order_id JOIN clients c ON c.id=jo.client_id JOIN product_specifications ps ON ps.id=jo.specification_id AND ps.client_id=jo.client_id LEFT JOIN production_stages pst ON pst.position=jo.current_stage_cursor';

  async function list(query) {
    const validation = queryInput(query);
    if (!validation.success) return validation;
    const input = validation.data;
    return withConnection(db, async connection => {
      const where = ['1=1']; const params = [];
      if (input.status !== 'all') { where.push('jo.status=?'); params.push(input.status); }
      if (input.q) { where.push('(LOCATE(?,jo.reference)>0 OR LOCATE(?,o.reference)>0 OR LOCATE(?,c.company_name)>0 OR LOCATE(?,COALESCE(ps.filter_name,\'\'))>0)'); params.push(input.q, input.q, input.q, input.q); }
      const [[count]] = await connection.execute(`SELECT COUNT(*) total FROM ${from} WHERE ${where.join(' AND ')}`, params);
      const total = Number(count.total ?? 0); const page = Math.min(input.page, Math.max(1, Math.ceil(total / input.pageSize)));
      const [rows] = await connection.execute(`SELECT ${columns} FROM ${from} WHERE ${where.join(' AND ')} ORDER BY jo.created_at DESC,jo.id DESC LIMIT ? OFFSET ?`, [...params, String(input.pageSize), String((page - 1) * input.pageSize)]);
      return { success: true, data: { items: rows.map(row => project(row)), total, page, pageSize: input.pageSize } };
    });
  }

  async function detail(id) {
    const validation = validateSalesOrderId(id);
    if (!validation.success) return validation;
    return withConnection(db, async connection => {
      const [rows] = await connection.execute(`SELECT ${columns} FROM ${from} WHERE jo.id=?`, [id]);
      if (!rows.length) return { success: false, code: 'NOT_FOUND' };
      const row = rows[0];
      const [audits] = await connection.execute(`SELECT CAST(actor_id AS CHAR) actorId, new_value newValue, DATE_FORMAT(occurred_at, '%Y-%m-%dT%H:%i:%s.%fZ') occurredAt FROM audit_events WHERE subject_type='job_order' AND subject_identifier=? AND action='job_order.created' ORDER BY occurred_at DESC,id DESC LIMIT 1`, [id]);
      const trace = parseTrace(audits[0]);
      let quotation = null; let purchaseOrder = null;
      if (row.acceptedQuotationId) {
        const [quotes] = await connection.execute(`SELECT CAST(id AS CHAR) id, reference, revision_number revisionNumber, status, total_amount totalAmount, downpayment_percent downpaymentPercent, downpayment_amount downpaymentAmount FROM quotations WHERE id=? AND order_id=?`, [row.acceptedQuotationId, row.orderId]);
        quotation = quotes[0] ?? null;
      }
      if (row.purchaseOrderId) {
        const [pos] = await connection.execute(`SELECT CAST(id AS CHAR) id, reference, client_reference clientReference, DATE_FORMAT(uploaded_at, '%Y-%m-%dT%H:%i:%s.%fZ') uploadedAt, DATE_FORMAT(received_at, '%Y-%m-%dT%H:%i:%s.%fZ') receivedAt, DATE_FORMAT(cleared_at, '%Y-%m-%dT%H:%i:%s.%fZ') clearedAt FROM purchase_orders WHERE id=? AND order_id=?`, [row.purchaseOrderId, row.orderId]);
        purchaseOrder = pos[0] ?? null;
      }
      return { success: true, data: { ...project(row, trace), quotation, purchaseOrder, poDocumentAvailable: false, productionStarted: row.status !== 'jo' } };
    });
  }

  return { list, detail };
}
