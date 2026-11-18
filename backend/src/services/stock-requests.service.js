import { validateApplicationId } from '../validation/client-applications.validation.js';

function invalid(errors) { return { success: false, code: 'VALIDATION_ERROR', errors }; }
function validId(value) { return validateApplicationId(String(value ?? '')).success; }
function validQuantity(value) { return validObservedQuantity(value) && Number(value) > 0; }
function validObservedQuantity(value) { return ['number','string'].includes(typeof value) && /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(String(value)) && Number(value) <= 1000000000; }

export function createStockRequestsService({ db }) {
  async function create(actor, body, context = {}) {
    if (!actor || actor.accountType !== 'employee' || actor.roleCode !== 'sales') return { success: false, code: 'FORBIDDEN' };
    const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
    if (!validId(input.orderId)) return invalid({ orderId: 'A valid order identifier is required.' });
    if (input.quotationId !== undefined && !validId(input.quotationId)) return invalid({ quotationId: 'The quotation identifier is invalid.' });
    if (!Array.isArray(input.lines) || input.lines.length === 0 || input.lines.length > 100) return invalid({ lines: 'At least one material line is required.' });
    const lines = input.lines.map((line, index) => ({ materialId: String(line?.materialId ?? ''), quantity: line?.quantity, index }));
    const errors = {};
    lines.forEach(line => { if (!validId(line.materialId)) errors[`lines[${line.index}].materialId`] = 'A valid material identifier is required.'; if (!validQuantity(line.quantity)) errors[`lines[${line.index}].quantity`] = 'A positive requested quantity is required.'; });
    if (Object.keys(errors).length || new Set(lines.map(line => line.materialId)).size !== lines.length) return invalid({ ...errors, lines: 'Materials must be valid, positive, and unique.' });
    for (const line of lines) line.quantity=Number(line.quantity);
    const connection = await db.getConnection(); let transaction = false;
    try {
      await connection.beginTransaction(); transaction = true;
      const [orders] = await connection.execute(`SELECT CAST(id AS CHAR) id, CAST(client_id AS CHAR) clientId FROM orders WHERE id=? FOR UPDATE`, [input.orderId]);
      if (!orders.length) { await connection.rollback(); return { success: false, code: 'NOT_FOUND' }; }
      const placeholders = lines.map(() => '?').join(',');
      const [materials] = await connection.execute(`SELECT CAST(id AS CHAR) id, name, COALESCE(source_unit,unit_code) unitCode, quantity_on_hand quantityOnHand FROM materials WHERE active=TRUE AND id IN (${placeholders}) FOR SHARE`, lines.map(line => line.materialId));
      const materialMap = new Map(materials.map(row => [String(row.id), row]));
      if (materials.length !== lines.length) { await connection.rollback(); return { success: false, code: 'MATERIAL_NOT_FOUND' }; }
      if (materials.some(material => material.quantityOnHand !== null && !validObservedQuantity(material.quantityOnHand))) {
        await connection.rollback();
        return { success: false, code: 'INVENTORY_UNAVAILABLE' };
      }
      let quotationReference = null;
      if (input.quotationId !== undefined) {
        const [quotes] = await connection.execute(`SELECT CAST(id AS CHAR) id, reference FROM quotations WHERE id=? AND order_id=? AND status <> 'draft' FOR SHARE`, [input.quotationId, input.orderId]);
        if (!quotes.length) { await connection.rollback(); return { success: false, code: 'QUOTATION_NOT_FOUND' }; }
        quotationReference = quotes[0].reference;
      }
      const reference = `SR-${new Date().getUTCFullYear()}-${String(input.orderId).padStart(6, '0')}-${Date.now()}`;
      const [request] = await connection.execute(`INSERT INTO stock_requests (reference,order_id,client_reference,status,requested_by) VALUES (?,?,?,'pending',?)`, [reference, input.orderId, quotationReference, actor.userId]);
      if (request.affectedRows !== 1 || request.insertId == null) throw new Error('Stock request write failed.');
      const requestId = String(request.insertId);
      for (const line of lines) {
        const material = materialMap.get(line.materialId); const available = material.quantityOnHand === null ? null : Number(material.quantityOnHand);
        await connection.execute(`INSERT INTO stock_request_lines (stock_request_id,material_id,material_name_snapshot,unit_snapshot,required_quantity,stock_at_request,shortage_at_request) VALUES (?,?,?,?,?,?,?)`, [requestId, line.materialId, material.name, material.unitCode, line.quantity, available, available===null?null:Math.max(0, line.quantity - available)]);
      }
      await connection.execute(`INSERT INTO audit_events (actor_id,action,subject_type,subject_identifier,new_value,request_id,occurred_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP(3))`, [actor.userId, 'stock_request.created', 'stock_request', requestId, JSON.stringify({ orderId: String(input.orderId), quotationId: input.quotationId ?? null, reference, lineCount: lines.length }), context.requestId ?? null]);
      await connection.commit(); transaction = false;
      return { success: true, data: { id: requestId, reference, orderId: String(input.orderId), clientReference: quotationReference, status: 'pending', lines: lines.map(line => ({ materialId: line.materialId, quantity: line.quantity })) } };
    } catch (error) { if (transaction) { try { await connection.rollback(); } catch {} } throw error; } finally { connection.release(); }
  }

  async function list(actor) {
    if (!actor || actor.accountType !== 'employee' || !['sales', 'warehouse'].includes(actor.roleCode)) return { success: false, code: 'FORBIDDEN' };
    const connection = await db.getConnection();
    try {
      const [rows] = await connection.execute(`SELECT CAST(sr.id AS CHAR) id, sr.reference, CAST(sr.order_id AS CHAR) orderId,
        o.reference orderReference, sr.client_reference clientReference, sr.status,
        DATE_FORMAT(sr.created_at,'%Y-%m-%dT%H:%i:%s.%fZ') createdAt, CAST(sr.requested_by AS CHAR) requestedBy
        FROM stock_requests sr LEFT JOIN orders o ON o.id=sr.order_id ORDER BY sr.created_at DESC,sr.id DESC`);
      const data = [];
      for (const row of rows) {
        const [lines] = await connection.execute(`SELECT CAST(srl.id AS CHAR) id, CAST(srl.material_id AS CHAR) materialId, srl.material_name_snapshot materialName, srl.unit_snapshot unit, srl.required_quantity requiredQuantity, srl.stock_at_request stockAtRequest, srl.shortage_at_request shortageAtRequest FROM stock_request_lines srl WHERE srl.stock_request_id=? ORDER BY srl.id`, [row.id]);
        const [responses] = await connection.execute(`SELECT CAST(srl.stock_request_line_id AS CHAR) lineId,
          srl.current_quantity currentQuantity,srl.shortage_quantity shortageQuantity,
          DATE_FORMAT(sr.responded_at,'%Y-%m-%dT%H:%i:%s.%fZ') respondedAt
          FROM stock_response_lines srl JOIN stock_responses sr ON sr.id=srl.stock_response_id AND sr.stock_request_id=srl.stock_request_id
          WHERE sr.stock_request_id=? AND sr.id=(SELECT MAX(id) FROM stock_responses WHERE stock_request_id=?)`, [row.id,row.id]);
        data.push({ ...row, lines: lines.map(line=>({...line,latestResponse:responses.find(response=>response.lineId===line.id)??null})) });
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
      const [requestLines] = await connection.execute(`SELECT CAST(id AS CHAR) id, CAST(material_id AS CHAR) materialId,required_quantity requiredQuantity FROM stock_request_lines WHERE stock_request_id=? FOR UPDATE`, [id]);
      const requestLineIds = new Set(requestLines.map(line => String(line.id)));
      if (input.lines.length !== requestLines.length || new Set(input.lines.map(line=>String(line?.lineId))).size !== requestLines.length || input.lines.some(line => !requestLineIds.has(String(line?.lineId)) || !validObservedQuantity(line?.currentQuantity) || !validObservedQuantity(line?.shortageQuantity))) { await connection.rollback(); return invalid({ lines: 'Response lines must match every request line and contain recorded, non-negative quantities.' }); }
      if (input.lines.some(line=>Number(line.shortageQuantity)!==Number(Math.max(0,Number(requestLines.find(row=>String(row.id)===String(line.lineId)).requiredQuantity)-Number(line.currentQuantity)).toFixed(4)))) { await connection.rollback(); return invalid({ lines:'Shortage must match the requested and observed quantities.' }); }
      if (input.status === 'updated') {
        const requestedMaterials = new Set(requestLines.map(line=>String(line.materialId)));
        if (!Array.isArray(input.inventoryUpdates) || input.inventoryUpdates.length !== requestedMaterials.size || new Set(input.inventoryUpdates.map(update=>String(update?.materialId))).size !== requestedMaterials.size || input.inventoryUpdates.some(update=>!requestedMaterials.has(String(update?.materialId)) || !validObservedQuantity(update?.quantityOnHand))) { await connection.rollback(); return invalid({ inventoryUpdates: 'Manual updates must match the requested materials and contain recorded, non-negative quantities.' }); }
        const observed = new Map(input.lines.map(line=>[String(line.lineId),Number(line.currentQuantity)]));
        if (requestLines.some(line=>Number(input.inventoryUpdates.find(update=>String(update.materialId)===String(line.materialId))?.quantityOnHand)!==observed.get(String(line.id)))) { await connection.rollback(); return invalid({ inventoryUpdates: 'Manual inventory values must match the observed response quantities.' }); }
        const materialIds = [...requestedMaterials];
        const materialPlaceholders = materialIds.map(() => '?').join(',');
        const [materials] = await connection.execute(`SELECT CAST(id AS CHAR) id FROM materials WHERE active=TRUE AND id IN (${materialPlaceholders}) FOR UPDATE`, materialIds);
        if (materials.length !== requestedMaterials.size) { await connection.rollback(); return { success: false, code: 'MATERIAL_NOT_FOUND' }; }
      }
      const [response] = await connection.execute(`INSERT INTO stock_responses (stock_request_id,order_id,kind,responded_by) VALUES (?,?,?,?)`, [id, requests[0].orderId, input.status === 'updated' ? 'updated' : 'initial', actor.userId]);
      const responseId = String(response.insertId);
      for (const line of input.lines) await connection.execute(`INSERT INTO stock_response_lines (stock_response_id,stock_request_line_id,stock_request_id,current_quantity,shortage_quantity,status) VALUES (?,?,?,?,?,?)`, [responseId, line.lineId, id, line.currentQuantity, line.shortageQuantity, Number(line.shortageQuantity) > 0 ? 'shortage' : 'sufficient']);
      if (input.status === 'updated') {
        if (!Array.isArray(input.inventoryUpdates) || input.inventoryUpdates.some(update => !validId(update?.materialId) || !Number.isFinite(Number(update?.quantityOnHand)) || Number(update.quantityOnHand) < 0)) { await connection.rollback(); return invalid({ inventoryUpdates: 'Manual inventory quantities must be non-negative.' }); }
        for (const update of input.inventoryUpdates) await connection.execute(`UPDATE materials SET quantity_on_hand=?,quantity_status='verified',updated_at=CURRENT_TIMESTAMP(3) WHERE id=? AND active=TRUE`, [update.quantityOnHand, update.materialId]);
      }
      await connection.execute(`UPDATE stock_requests SET status=?, update_requested_at=CASE WHEN ?='updated' THEN CURRENT_TIMESTAMP(3) ELSE update_requested_at END WHERE id=?`, [input.status, input.status, id]);
      await connection.execute(`INSERT INTO audit_events (actor_id,action,subject_type,subject_identifier,new_value,request_id,occurred_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP(3))`, [actor.userId, `stock_request.${input.status}`, 'stock_request', id, JSON.stringify({ status: input.status, lineCount: input.lines.length, inventoryUpdated: input.status === 'updated', inventoryUpdates: input.status==='updated'?input.inventoryUpdates:[] }), context.requestId ?? null]);
      await connection.commit(); transaction = false;
      return { success: true, data: { id: String(id), status: input.status, responseId } };
    } catch (error) { if (transaction) { try { await connection.rollback(); } catch {} } throw error; } finally { connection.release(); }
  }
  return { create, list, process };
}
