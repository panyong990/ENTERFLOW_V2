import { validateApplicationId } from '../validation/client-applications.validation.js';

function invalid(errors) { return { success: false, code: 'VALIDATION_ERROR', errors }; }
function validId(value) { return validateApplicationId(String(value ?? '')).success; }
function validQuantity(value) { const n = Number(value); return Number.isFinite(n) && n > 0 && n <= 1000000000; }

export function createStockRequestsService({ db }) {
  async function create(actor, body, context = {}) {
    if (!actor || actor.accountType !== 'employee' || actor.roleCode !== 'sales') return { success: false, code: 'FORBIDDEN' };
    const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
    if (!validId(input.orderId)) return invalid({ orderId: 'A valid order identifier is required.' });
    if (input.quotationId !== undefined && !validId(input.quotationId)) return invalid({ quotationId: 'The quotation identifier is invalid.' });
    if (!Array.isArray(input.lines) || input.lines.length === 0 || input.lines.length > 100) return invalid({ lines: 'At least one material line is required.' });
    const lines = input.lines.map((line, index) => ({ materialId: String(line?.materialId ?? ''), quantity: Number(line?.quantity), index }));
    const errors = {};
    lines.forEach(line => { if (!validId(line.materialId)) errors[`lines[${line.index}].materialId`] = 'A valid material identifier is required.'; if (!validQuantity(line.quantity)) errors[`lines[${line.index}].quantity`] = 'A positive requested quantity is required.'; });
    if (Object.keys(errors).length || new Set(lines.map(line => line.materialId)).size !== lines.length) return invalid({ ...errors, lines: 'Materials must be valid, positive, and unique.' });
    const connection = await db.getConnection(); let transaction = false;
    try {
      await connection.beginTransaction(); transaction = true;
      const [orders] = await connection.execute(`SELECT CAST(id AS CHAR) id, CAST(client_id AS CHAR) clientId FROM orders WHERE id=? FOR UPDATE`, [input.orderId]);
      if (!orders.length) { await connection.rollback(); return { success: false, code: 'NOT_FOUND' }; }
      const placeholders = lines.map(() => '?').join(',');
      const [materials] = await connection.execute(`SELECT CAST(id AS CHAR) id, name, unit_code unitCode, quantity_on_hand quantityOnHand FROM materials WHERE active=TRUE AND id IN (${placeholders}) FOR SHARE`, lines.map(line => line.materialId));
      const materialMap = new Map(materials.map(row => [String(row.id), row]));
      if (materials.length !== lines.length) { await connection.rollback(); return { success: false, code: 'MATERIAL_NOT_FOUND' }; }
      if (input.quotationId !== undefined) {
        const [quotes] = await connection.execute(`SELECT id FROM quotations WHERE id=? AND order_id=? AND status <> 'draft' FOR SHARE`, [input.quotationId, input.orderId]);
        if (!quotes.length) { await connection.rollback(); return { success: false, code: 'QUOTATION_NOT_FOUND' }; }
      }
      const reference = `SR-${new Date().getUTCFullYear()}-${String(input.orderId).padStart(6, '0')}-${Date.now()}`;
      const [request] = await connection.execute(`INSERT INTO stock_requests (reference,order_id,client_reference,status,requested_by) VALUES (?,?,?,'pending',?)`, [reference, input.orderId, input.quotationId ? `Quotation ${input.quotationId}` : null, actor.userId]);
      if (request.affectedRows !== 1 || request.insertId == null) throw new Error('Stock request write failed.');
      const requestId = String(request.insertId);
      for (const line of lines) {
        const material = materialMap.get(line.materialId); const available = Number(material.quantityOnHand);
        await connection.execute(`INSERT INTO stock_request_lines (stock_request_id,material_id,material_name_snapshot,unit_snapshot,required_quantity,stock_at_request,shortage_at_request) VALUES (?,?,?,?,?,?,?)`, [requestId, line.materialId, material.name, material.unitCode, line.quantity, available, Math.max(0, line.quantity - available)]);
      }
      await connection.execute(`INSERT INTO audit_events (actor_id,action,subject_type,subject_identifier,new_value,request_id,occurred_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP(3))`, [actor.userId, 'stock_request.created', 'stock_request', requestId, JSON.stringify({ orderId: String(input.orderId), quotationId: input.quotationId ?? null, reference, lineCount: lines.length }), context.requestId ?? null]);
      await connection.commit(); transaction = false;
      return { success: true, data: { id: requestId, reference, orderId: String(input.orderId), status: 'pending', lines: lines.map(line => ({ materialId: line.materialId, quantity: line.quantity })) } };
    } catch (error) { if (transaction) { try { await connection.rollback(); } catch {} } throw error; } finally { connection.release(); }
  }

  async function list(actor) {
    if (!actor || actor.accountType !== 'employee' || !['sales', 'warehouse'].includes(actor.roleCode)) return { success: false, code: 'FORBIDDEN' };
    const connection = await db.getConnection();
    try {
      const [rows] = await connection.execute(`SELECT CAST(sr.id AS CHAR) id, sr.reference, CAST(sr.order_id AS CHAR) orderId, sr.status, DATE_FORMAT(sr.created_at,'%Y-%m-%dT%H:%i:%s.%fZ') createdAt, CAST(sr.requested_by AS CHAR) requestedBy FROM stock_requests sr ORDER BY sr.created_at DESC,sr.id DESC`);
      const data = [];
      for (const row of rows) {
        const [lines] = await connection.execute(`SELECT CAST(srl.id AS CHAR) id, CAST(srl.material_id AS CHAR) materialId, srl.material_name_snapshot materialName, srl.unit_snapshot unit, srl.required_quantity requiredQuantity, srl.stock_at_request stockAtRequest, srl.shortage_at_request shortageAtRequest FROM stock_request_lines srl WHERE srl.stock_request_id=? ORDER BY srl.id`, [row.id]);
        data.push({ ...row, lines });
      }
      return { success: true, data };
    } finally { connection.release(); }
  }

  async function process(actor, id, body, context = {}) {
    if (!actor || actor.accountType !== 'employee' || actor.roleCode !== 'warehouse') return { success: false, code: 'FORBIDDEN' };
    if (!validId(id)) return invalid({ id: 'A valid stock request identifier is required.' });
    const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
    if (!['responded', 'updated'].includes(input.status)) return invalid({ status: 'Status must be responded or updated.' });
    if (!Array.isArray(input.lines) || !input.lines.length) return invalid({ lines: 'Response lines are required.' });
    const connection = await db.getConnection(); let transaction = false;
    try {
      await connection.beginTransaction(); transaction = true;
      const [requests] = await connection.execute(`SELECT CAST(id AS CHAR) id, CAST(order_id AS CHAR) orderId, status FROM stock_requests WHERE id=? FOR UPDATE`, [id]);
      if (!requests.length) { await connection.rollback(); return { success: false, code: 'NOT_FOUND' }; }
      const [requestLines] = await connection.execute(`SELECT CAST(id AS CHAR) id, CAST(material_id AS CHAR) materialId FROM stock_request_lines WHERE stock_request_id=? FOR UPDATE`, [id]);
      const requestLineIds = new Set(requestLines.map(line => String(line.id)));
      if (input.lines.some(line => !requestLineIds.has(String(line?.lineId)) || !validQuantity(line?.currentQuantity) || Number(line?.shortageQuantity) < 0)) { await connection.rollback(); return invalid({ lines: 'Response lines must match the request and contain valid quantities.' }); }
      const [response] = await connection.execute(`INSERT INTO stock_responses (stock_request_id,order_id,kind,responded_by) VALUES (?,?,?,?)`, [id, requests[0].orderId, input.status === 'updated' ? 'updated' : 'initial', actor.userId]);
      const responseId = String(response.insertId);
      for (const line of input.lines) await connection.execute(`INSERT INTO stock_response_lines (stock_response_id,stock_request_line_id,stock_request_id,current_quantity,shortage_quantity,status) VALUES (?,?,?,?,?,?)`, [responseId, line.lineId, id, line.currentQuantity, line.shortageQuantity, Number(line.shortageQuantity) > 0 ? 'shortage' : 'sufficient']);
      if (input.status === 'updated') {
        if (!Array.isArray(input.inventoryUpdates) || input.inventoryUpdates.some(update => !validId(update?.materialId) || !Number.isFinite(Number(update?.quantityOnHand)) || Number(update.quantityOnHand) < 0)) { await connection.rollback(); return invalid({ inventoryUpdates: 'Manual inventory quantities must be non-negative.' }); }
        for (const update of input.inventoryUpdates) await connection.execute(`UPDATE materials SET quantity_on_hand=?, updated_at=CURRENT_TIMESTAMP(3) WHERE id=? AND active=TRUE`, [update.quantityOnHand, update.materialId]);
      }
      await connection.execute(`UPDATE stock_requests SET status=?, update_requested_at=CASE WHEN ?='updated' THEN CURRENT_TIMESTAMP(3) ELSE update_requested_at END WHERE id=?`, [input.status, input.status, id]);
      await connection.execute(`INSERT INTO audit_events (actor_id,action,subject_type,subject_identifier,new_value,request_id,occurred_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP(3))`, [actor.userId, `stock_request.${input.status}`, 'stock_request', id, JSON.stringify({ status: input.status, lineCount: input.lines.length, inventoryUpdated: input.status === 'updated' }), context.requestId ?? null]);
      await connection.commit(); transaction = false;
      return { success: true, data: { id: String(id), status: input.status, responseId } };
    } catch (error) { if (transaction) { try { await connection.rollback(); } catch {} } throw error; } finally { connection.release(); }
  }
  return { create, list, process };
}
