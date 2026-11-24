import { randomUUID } from 'node:crypto';
import { ok, read, rows, one, id, text, object, requireThat, decimal, format, transaction, insert, changed, lockInquiry, audit } from './core.js';
export function createInventoryService({
  db
}) {
  const list = actor => read(db, async c => {
    requireThat(actor?.accountType === 'employee' && ['sales', 'production', 'warehouse', 'admin', 'owner', 'operations'].includes(actor.roleCode), 'FORBIDDEN');
    const materials = await rows(c, `SELECT CAST(m.material_id AS CHAR) id,m.item_code itemCode,m.material_name name,mc.category_name category,CAST(m.material_category_id AS CHAR) categoryId,CAST(m.uom_id AS CHAR) uomId,u.abbreviation unit,m.qty_in_stock qtyInStock,m.quantity_status quantityStatus,m.reorder_threshold threshold,m.threshold_status thresholdStatus,m.supplier_name supplier,m.unit_price approvedCostingPrice,m.reference_unit_price referenceUnitPrice,m.created_at createdAt,m.updated_at updatedAt FROM raw_material m JOIN unit_of_measure u ON u.uom_id=m.uom_id LEFT JOIN material_category mc ON mc.material_category_id=m.material_category_id WHERE m.is_active=1 ORDER BY m.material_name,m.material_id`);
    if (!['warehouse', 'admin'].includes(actor.roleCode)) for (const m of materials) for (const key of ['referencePriceText', 'referencePriceSource', 'referencePriceStatus']) m[key] = null;
    if (!['sales', 'warehouse', 'admin'].includes(actor.roleCode)) for (const m of materials) m.referenceUnitPrice = null;
    const finishedGoods = await rows(c, `SELECT CAST(finished_good_id AS CHAR) id,item_code itemCode,enterfil_pn enterFilPN,item_name name,CAST(client_id AS CHAR) clientId,qty_in_stock qtyInStock,quantity_status quantityStatus,buffer_min bufferMin,threshold_status thresholdStatus,demand_level demand FROM finished_good WHERE is_active=1 ORDER BY item_code`);
    return ok({
      materials,
      finishedGoods
    });
  });
  const publicMaterial = m => ({
    id: String(m.material_id),
    name: m.material_name,
    materialCategoryId: m.material_category_id == null ? null : String(m.material_category_id),
    uomId: String(m.uom_id),
    qtyInStock: m.qty_in_stock,
    quantityOnHand: m.qty_in_stock,
    quantityStatus: m.quantity_status,
    threshold: m.reorder_threshold,
    thresholdStatus: m.threshold_status,
    supplier: m.supplier_name,
    approvedCostingPrice: m.unit_price ?? null,
    referenceUnitPrice: m.reference_unit_price ?? null
  });
  const maintain = (actor, target, body) => {
    if (actor?.accountType !== 'employee' || !['warehouse', 'admin'].includes(actor.roleCode) || !id(actor.userId)) return Promise.resolve({
      success: false,
      code: 'FORBIDDEN'
    });
    try {
      object(body, ['name', 'materialCategoryId', 'uomId', 'threshold', 'supplier', 'quantityOnHand', 'reason', 'referenceUnitPrice', 'category', 'unit']);
      if (target) requireThat(id(target));
      requireThat(
        !(body.category !== undefined && body.materialCategoryId !== undefined)
      );
      requireThat(
        !(body.unit !== undefined && body.uomId !== undefined)
      );
      if (body.referenceUnitPrice !== undefined &&
          body.referenceUnitPrice !== null) {
        const price = decimal(body.referenceUnitPrice);
        requireThat(price >= 0n && price <= 10000000000000n);
      }
      if (body.quantityOnHand !== undefined && body.quantityOnHand !== null) decimal(body.quantityOnHand);
      if (body.threshold !== undefined && body.threshold !== null) decimal(body.threshold);
    } catch {
      return Promise.resolve({
        success: false,
        code: 'VALIDATION_ERROR'
      });
    }
    return transaction(db, actor, ['warehouse', 'admin'], async (c, a) => {
      const old = target ? await one(c, 'SELECT * FROM raw_material WHERE material_id=? FOR UPDATE', [target]) : null;
      if (target) requireThat(old, 'NOT_FOUND');
      const name = body.name !== undefined ? text(body.name, 200) : old?.material_name;
      requireThat(name);
      const matchedUom = body.unit === undefined ? null : await one(
        c,
        'SELECT CAST(uom_id AS CHAR) uom_id FROM unit_of_measure WHERE abbreviation=?',
        [text(body.unit, 32)]
      );

      requireThat(
        body.unit === undefined || matchedUom,
        'REFERENCE_DATA_MISSING'
      );

      const uomId = body.uomId ??
        matchedUom?.uom_id ??
        (old && String(old.uom_id));
      requireThat(id(uomId));

      const selectedUom = await one(
        c,
        'SELECT uom_id,abbreviation FROM unit_of_measure WHERE uom_id=?',
        [uomId]
      );
      requireThat(selectedUom, 'REFERENCE_DATA_MISSING');

      const wholeQuantityUnits = new Set(["pc","pcs","sheet","plate","box","bag","sack","set","sets","bundle","roll","pc/gal"]);
      if (
        body.quantityOnHand !== undefined &&
        body.quantityOnHand !== null &&
        wholeQuantityUnits.has(String(selectedUom.abbreviation).trim().toLowerCase())
      ) {
        requireThat(decimal(body.quantityOnHand) % 10000n === 0n);
      }
      const matchedCategory = body.category == null ? null : await one(
        c,
        'SELECT CAST(material_category_id AS CHAR) material_category_id FROM material_category WHERE category_name=?',
        [text(body.category, 80)]
      );

      requireThat(
        body.category == null || matchedCategory,
        'REFERENCE_DATA_MISSING'
      );

      const categoryId = body.materialCategoryId !== undefined
        ? body.materialCategoryId
        : body.category === null
          ? null
          : matchedCategory
            ? String(matchedCategory.material_category_id)
            : old?.material_category_id == null
              ? null
              : String(old.material_category_id);
      if (categoryId !== null) requireThat(id(categoryId) && (await one(c, 'SELECT material_category_id FROM material_category WHERE material_category_id=?', [categoryId])), 'REFERENCE_DATA_MISSING');
      const threshold = body.threshold === undefined ? old?.reorder_threshold ?? null : body.threshold === null ? null : format(decimal(body.threshold)),
        thresholdStatus = body.threshold === undefined ? old?.threshold_status ?? 'unknown' : threshold === null ? 'unknown' : 'verified';
      const supplier = body.supplier === undefined ? old?.supplier_name ?? null : body.supplier === null ? null : text(body.supplier, 200, false) || null;
      const referencePrice = body.referenceUnitPrice === undefined
        ? old?.reference_unit_price ?? null
        : body.referenceUnitPrice === null
          ? null
          : format(decimal(body.referenceUnitPrice));
      const desired = {
        material_name: name,
        material_category_id: categoryId,
        uom_id: uomId,
        reorder_threshold: threshold,
        threshold_status: thresholdStatus,
        supplier_name: supplier,
        reference_unit_price: referencePrice
      };
      let next = {
          ...old,
          ...desired
        },
        materialId = target;
      if (!target) {
        const openingQty = body.quantityOnHand == null
          ? null
          : format(decimal(body.quantityOnHand));

        const openingReason = openingQty === null
          ? null
          : text(body.reason, 200);

        materialId = await insert(
          c,
          'INSERT INTO raw_material(material_name,material_category_id,uom_id,reorder_threshold,threshold_status,supplier_name,reference_unit_price) VALUES (?,?,?,?,?,?,?)',
          [name, categoryId, uomId, threshold, thresholdStatus, supplier, referencePrice]
        );

        if (openingQty !== null) {
          await recordObservation(
            c, a, materialId,
            { quantity_status: 'unknown', qty_in_stock: null },
            openingQty, openingReason, uomId
          );
        }
        next = {
          ...desired,
          material_id: materialId,
          qty_in_stock: openingQty,
          quantity_status: openingQty === null ? 'unknown' : 'verified',
          unit_price: null
        };
      } else {
        const detailsChanged = Object.entries(desired).some(([key, value]) => String(old[key] ?? '') !== String(value ?? ''));
        const qty = body.quantityOnHand === undefined ? old.qty_in_stock : body.quantityOnHand === null ? null : format(decimal(body.quantityOnHand)),
          quantityStatus = body.quantityOnHand === undefined ? old.quantity_status : qty === null ? 'unknown' : 'verified';
        const quantityChanged = String(qty ?? '') !== String(old.qty_in_stock ?? '') || quantityStatus !== old.quantity_status;
        if (!detailsChanged && !quantityChanged) return ok(publicMaterial(old));
        if (String(old.uom_id) !== uomId) {
          requireThat(old.quantity_status === 'unknown' && old.qty_in_stock === null, 'UNIT_RECONCILIATION_REQUIRED');
          requireThat(!(await one(c, 'SELECT movement_id FROM stock_movement WHERE raw_material_id=? LIMIT 1', [target])), 'UNIT_RECONCILIATION_REQUIRED');
        }
        const priceChanged =
          String(referencePrice ?? '') !== String(old.reference_unit_price ?? '');
        if (quantityChanged || priceChanged) text(body.reason);
        if (detailsChanged) await changed(c, 'UPDATE raw_material SET material_name=?,material_category_id=?,uom_id=?,reorder_threshold=?,threshold_status=?,supplier_name=?,reference_unit_price=? WHERE material_id=?', [name, categoryId, uomId, threshold, thresholdStatus, supplier, referencePrice, target]);
        if (quantityChanged) {
          if (qty === null) await changed(c, "UPDATE raw_material SET qty_in_stock=NULL,quantity_status='unknown' WHERE material_id=?", [target]);else await recordObservation(c, a, target, old, qty, text(body.reason), uomId);
          next.qty_in_stock = qty;
          next.quantity_status = quantityStatus;
        }
      }
      const data = publicMaterial(next);
      await audit(c, a, target ? 'inventory.material.updated' : 'inventory.material.created', 'raw_material', materialId, old ? publicMaterial(old) : null, data, body.reason ?? null);
      return ok(data);
    });
  };
  return {
    list,
    create: (a, b) => maintain(a, null, b),
    update: (a, target, b) => maintain(a, target, b)
  };
}
export async function recordObservation(c, actor, materialId, old, qty, reason, uomId, operationKey) {
  requireThat(old.quantity_status === 'unknown' || old.qty_in_stock !== null, 'INVENTORY_UNAVAILABLE');
  const verified = old.quantity_status === 'verified',
    before = verified ? decimal(old.qty_in_stock) : null,
    after = decimal(qty);
  await insert(c, `INSERT INTO stock_movement(item_type,raw_material_id,movement_reason,quantity_status_before,qty_before,qty_after,qty_change,uom_id,performed_by_user_id,operation_key) VALUES ('raw_material',?,?,?,?,?,?,?,?,?)`, [materialId, reason, old.quantity_status, verified ? format(before) : null, format(after), verified ? format(after - before) : null, uomId, actor.userId, operationKey ?? `observation:${randomUUID()}`]);
  await changed(c, "UPDATE raw_material SET qty_in_stock=?,quantity_status='verified' WHERE material_id=?", [format(after), materialId]);
}
export function createStockRequestsService({
  db
}) {
  return {
    create: (actor, body) => transaction(db, actor, ['sales'], async (c, a) => {
      object(body, ['orderId', 'quotationId', 'lines']);
      requireThat(id(body.orderId));
      requireThat(Array.isArray(body.lines) && body.lines.length > 0 && body.lines.length <= 100);
      requireThat(new Set(body.lines.map(l => l.materialId)).size === body.lines.length);
      for (const line of body.lines) {
        object(line, ['materialId', 'quantity']);
        requireThat(id(line.materialId) && decimal(line.quantity) > 0n);
      }
      const i = await lockInquiry(c, body.orderId);
      requireThat(!['cancelled', 'rejected', 'archived'].includes(i.status), 'INVALID_STATE');
      let quote = null;
      if (body.quotationId) {
        requireThat(id(body.quotationId));
        quote = await one(c, 'SELECT CAST(quotation_id AS CHAR) id,quotation_no reference FROM quotation WHERE quotation_id=? AND inquiry_id=?', [body.quotationId, i.id]);
        requireThat(quote, 'NOT_FOUND');
      }
      // Derive requirements from the current persisted quotation, not the client.
      const currentQuote = await one(c,
        'SELECT CAST(quotation_id AS CHAR) id FROM quotation WHERE inquiry_id=? AND is_current=1 FOR UPDATE',
        [i.id]);
      requireThat(currentQuote, 'MATERIAL_COSTING_INCOMPLETE');
      requireThat(!body.quotationId || body.quotationId === currentQuote.id, 'QUOTATION_STALE');

      const inquiryItems = await rows(c,
        'SELECT CAST(inquiry_item_id AS CHAR) id FROM inquiry_item WHERE inquiry_id=?',
        [i.id]);

      const coverage = await rows(c, `
        SELECT CAST(qi.inquiry_item_id AS CHAR) itemId,
          COUNT(cm.estimate_material_id) materialCount,
          SUM(CASE WHEN cm.estimate_material_id IS NULL
            OR m.material_id IS NULL OR m.is_active <> 1
            OR cm.qty_per_filter <= 0
            OR cm.uom_id <> m.uom_id
            THEN 1 ELSE 0 END) invalidCount
        FROM quotation_item qi
        LEFT JOIN cost_estimate ce
          ON ce.quotation_item_id=qi.quotation_item_id
          AND ce.estimate_id=(
            SELECT MAX(cx.estimate_id) FROM cost_estimate cx
            WHERE cx.quotation_item_id=qi.quotation_item_id
          )
        LEFT JOIN cost_estimate_material cm ON cm.estimate_id=ce.estimate_id
        LEFT JOIN raw_material m ON m.material_id=cm.raw_material_id
        WHERE qi.quotation_id=?
        GROUP BY qi.quotation_item_id,qi.inquiry_item_id
      `, [currentQuote.id]);

      const expectedItems = new Set(inquiryItems.map(x => x.id));
      requireThat(expectedItems.size > 0 &&
        coverage.length === expectedItems.size &&
        coverage.every(x =>
          expectedItems.has(x.itemId) &&
          Number(x.materialCount) > 0 &&
          Number(x.invalidCount) === 0
        ) &&
        new Set(coverage.map(x => x.itemId)).size === coverage.length,
        'MATERIAL_COSTING_INCOMPLETE');

      const requirements = await rows(c, `
        SELECT CAST(cm.raw_material_id AS CHAR) materialId,
          SUM(cm.qty_per_filter * qi.quantity) requiredQuantity,
          m.qty_in_stock quantityOnHand,
          m.quantity_status quantityStatus
        FROM quotation_item qi
        JOIN cost_estimate ce
          ON ce.quotation_item_id=qi.quotation_item_id
          AND ce.estimate_id=(
            SELECT MAX(cx.estimate_id) FROM cost_estimate cx
            WHERE cx.quotation_item_id=qi.quotation_item_id
          )
        JOIN cost_estimate_material cm ON cm.estimate_id=ce.estimate_id
        JOIN raw_material m ON m.material_id=cm.raw_material_id
        WHERE qi.quotation_id=?
        GROUP BY cm.raw_material_id,m.qty_in_stock,m.quantity_status
      `, [currentQuote.id]);

      const expectedRequests = new Map();
      for (const requirement of requirements) {
        requireThat(requirement.quantityStatus === 'verified' &&
          requirement.quantityOnHand !== null,
          'INVENTORY_UNAVAILABLE');

        const required = (decimal(String(requirement.requiredQuantity), 8) + 9999n) / 10000n;
        const available = decimal(requirement.quantityOnHand);
        requireThat(required > 0n && available >= 0n, 'INVENTORY_UNAVAILABLE');

        // The request records total requirements; shortage is recorded separately.
        if (required > available) {
          expectedRequests.set(requirement.materialId, required);
        }
      }

      requireThat(expectedRequests.size > 0 &&
        body.lines.length === expectedRequests.size &&
        body.lines.every(line =>
          expectedRequests.has(line.materialId) &&
          decimal(line.quantity) === expectedRequests.get(line.materialId)
        ), 'STOCK_REQUIREMENTS_MISMATCH');
      const prepared = [];
      for (const line of [...body.lines].sort((a, b) => BigInt(a.materialId) > BigInt(b.materialId) ? 1 : -1)) {
        const qty = decimal(line.quantity),
          m = await one(c, 'SELECT * FROM raw_material WHERE material_id=? AND is_active=1 FOR SHARE', [line.materialId]);
        requireThat(m, 'MATERIAL_NOT_FOUND');
        requireThat(m.quantity_status === 'verified' && m.qty_in_stock !== null, 'INVENTORY_UNAVAILABLE');
        let stock = null;
        if (m.quantity_status === 'verified' && m.qty_in_stock !== null) {
          try {
            stock = decimal(m.qty_in_stock);
          } catch {
            requireThat(false, 'INVENTORY_UNAVAILABLE');
          }
        }
        prepared.push({
          line,
          qty,
          m,
          stock
        });
      }
      const request = await insert(c, "INSERT INTO stock_request(inquiry_id,requested_by_user_id,status) VALUES (?,?,'pending')", [i.id, a.userId]);
      for (const {
        line,
        qty,
        m,
        stock
      } of prepared) await insert(c, 'INSERT INTO stock_request_item(stock_request_id,raw_material_id,qty_requested,stock_at_request,shortage_at_request,quantity_status_at_request,uom_id) VALUES (?,?,?,?,?,?,?)', [request, line.materialId, format(qty), stock === null ? null : format(stock), stock === null ? null : format(qty > stock ? qty - stock : 0n), m.quantity_status, String(m.uom_id)]);
      await audit(c, a, 'stock_request.created', 'stock_request', request, null, {
        inquiryId: i.id,
        lineCount: body.lines.length,
        quotationId: quote?.id ?? null,
        clientReference: quote?.reference ?? null
      });
      return ok({
        id: request,
        reference: `SR-${request}`,
        status: 'pending',
        clientReference: quote?.reference ?? null
      });
    }),
    list: actor => read(db, async c => {
      requireThat(actor?.accountType === 'employee' && ['sales', 'warehouse'].includes(actor.roleCode), 'FORBIDDEN');
      const requests = await rows(c, 'SELECT CAST(sr.stock_request_id AS CHAR) id,CAST(sr.inquiry_id AS CHAR) orderId,i.inquiry_no orderReference,sr.status,sr.request_date createdAt,(SELECT JSON_UNQUOTE(JSON_EXTRACT(e.after_value,"$.clientReference")) FROM audit_event e WHERE e.subject_type="stock_request" AND e.subject_id=sr.stock_request_id AND e.action="stock_request.created" ORDER BY e.audit_event_id LIMIT 1) clientReference FROM stock_request sr JOIN inquiry i ON i.inquiry_id=sr.inquiry_id ORDER BY sr.request_date DESC');
      for (const r of requests) r.lines = await rows(c, `SELECT CAST(s.stock_request_item_id AS CHAR) id,CAST(s.raw_material_id AS CHAR) materialId,m.material_name materialName,s.qty_requested requiredQuantity,s.stock_at_request stockAtRequest,s.shortage_at_request shortageAtRequest,s.quantity_status_at_request quantityStatus,s.qty_available currentQuantity,s.available_quantity_status availableQuantityStatus,s.observed_at respondedAt FROM stock_request_item s JOIN raw_material m ON m.material_id=s.raw_material_id WHERE s.stock_request_id=? ORDER BY s.stock_request_item_id`, [r.id]);
      for (const r of requests) for (const line of r.lines) line.latestResponse = line.respondedAt ? {
        currentQuantity: line.currentQuantity,
        shortageQuantity: line.currentQuantity === null ? null : format(decimal(line.requiredQuantity) > decimal(line.currentQuantity) ? decimal(line.requiredQuantity) - decimal(line.currentQuantity) : 0n),
        respondedAt: line.respondedAt
      } : null;
      return ok(requests);
    }),
    process: (actor, requestId, body) => transaction(db, actor, ['warehouse'], async (c, a) => {
      requireThat(id(requestId));
      object(body, ['status', 'lines', 'inventoryUpdates', 'reason']);
      requireThat(['responded', 'updated'].includes(body.status));
      const parent = await one(c, 'SELECT CAST(inquiry_id AS CHAR) id FROM stock_request WHERE stock_request_id=?', [requestId]);
      requireThat(parent, 'NOT_FOUND');
      await lockInquiry(c, parent.id);
      const request = await one(c, 'SELECT * FROM stock_request WHERE stock_request_id=? FOR UPDATE', [requestId]);
      requireThat(request.status === 'pending' || body.status === 'updated' && request.status === 'responded', 'INVALID_STATE');
      const lines = await rows(c, 'SELECT * FROM stock_request_item WHERE stock_request_id=? ORDER BY raw_material_id FOR UPDATE', [requestId]);
      requireThat(Array.isArray(body.lines) && body.lines.length === lines.length && new Set(body.lines.map(l => l.lineId)).size === lines.length);
      if (body.status === 'updated') requireThat(Array.isArray(body.inventoryUpdates) && body.inventoryUpdates.length === lines.length && new Set(body.inventoryUpdates.map(l => l.materialId)).size === lines.length);
      const prepared = [];
      for (const line of lines) {
        const response = body.lines.find(r => r.lineId === String(line.stock_request_item_id));
        requireThat(response);
        object(response, ['lineId', 'currentQuantity', 'shortageQuantity']);
        const available = decimal(response.currentQuantity),
          required = decimal(line.qty_requested);
        requireThat(decimal(response.shortageQuantity) === (required > available ? required - available : 0n));
        let old = null;
        if (body.status === 'updated') {
          const observation = body.inventoryUpdates.find(m => m.materialId === String(line.raw_material_id));
          requireThat(observation && decimal(observation.quantityOnHand) === available);
          text(body.reason);
          old = await one(c, 'SELECT * FROM raw_material WHERE material_id=? AND is_active=1 FOR UPDATE', [String(line.raw_material_id)]);
          requireThat(old, 'MATERIAL_NOT_FOUND');
        }
        prepared.push({
          line,
          available,
          old
        });
      }
      for (const {
        line,
        available,
        old
      } of prepared) {
        await changed(c, "UPDATE stock_request_item SET qty_available=?,available_quantity_status='verified',observed_at=UTC_TIMESTAMP(3),observed_by_user_id=? WHERE stock_request_item_id=?", [format(available), a.userId, String(line.stock_request_item_id)]);
        if (old) await recordObservation(c, a, String(line.raw_material_id), old, format(available), text(body.reason), String(old.uom_id), `stock-request:${requestId}:${line.stock_request_item_id}`);
      }
      await changed(c, 'UPDATE stock_request SET status=?,handled_by_user_id=? WHERE stock_request_id=?', [body.status, a.userId, requestId]);
      await audit(c, a, 'stock_request.processed', 'stock_request', requestId, {
        status: request.status,
        observations: lines.map(l => ({
          id: String(l.stock_request_item_id),
          quantity: l.qty_available
        }))
      }, {
        status: body.status,
        observations: body.lines,
        ...(body.inventoryUpdates ? {
          inventoryUpdates: body.inventoryUpdates
        } : {})
      });
      return ok({
        id: requestId,
        status: body.status
      });
    })
  };
}
