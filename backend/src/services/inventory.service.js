import { validateApplicationId } from '../validation/client-applications.validation.js';

const categories = new Set(['filter_media', 'endcap', 'inner_core', 'outer_core', 'bonding_adhesive', 'oring', 'gasket', 'packaging']);
const legacyUnits = new Set(['roll', 'plate', 'sheet', 'kg', 'gal', 'pcs', 'set', 'm']);
const materialCodePattern = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,79}$/;
const decimalPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/;
const createFields = new Set(['itemCode', 'name', 'category', 'unit', 'threshold', 'supplier']);
const updateFields = new Set(['name', 'category', 'unit', 'threshold', 'supplier', 'quantityOnHand']);

function invalid(errors) {
  return { success: false, code: 'VALIDATION_ERROR', errors };
}

function canMaintain(actor) {
  return actor?.accountType === 'employee'
    && ['warehouse', 'admin'].includes(actor.roleCode)
    && validateApplicationId(String(actor.userId ?? '')).success;
}

function internalUnitCode(sourceUnit) {
  const normalized = sourceUnit.toLowerCase();
  if (legacyUnits.has(normalized)) return normalized;
  if (normalized === 'sets') return 'set';
  return 'pcs';
}

function validDecimal(value) {
  return ['number', 'string'].includes(typeof value)
    && decimalPattern.test(String(value))
    && Number(value) <= 1000000000;
}

function validateInput(body, { create }) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const allowedFields = create ? createFields : updateFields;
  const errors = {};
  for (const key of Object.keys(input)) {
    if (!allowedFields.has(key)) errors[key] = 'This field cannot be changed through material maintenance.';
  }
  if (create && input.itemCode != null && input.itemCode !== ''
    && (typeof input.itemCode !== 'string' || !materialCodePattern.test(input.itemCode))) {
    errors.itemCode = 'Enter a valid material code or leave it blank.';
  }
  if (create || Object.hasOwn(input, 'name')) {
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 200) {
      errors.name = 'Material description must contain 1 to 200 characters.';
    }
  }
  if (create || Object.hasOwn(input, 'category')) {
    if (input.category !== null && input.category !== undefined && !categories.has(input.category)) {
      errors.category = 'Choose a supported material category or leave it unclassified.';
    }
  }
  if (create || Object.hasOwn(input, 'unit')) {
    if (typeof input.unit !== 'string' || !input.unit.trim() || input.unit.trim().length > 32
      || /[\u0000-\u001f\u007f]/.test(input.unit)) {
      errors.unit = 'Unit must contain 1 to 32 printable characters.';
    }
  }
  if (Object.hasOwn(input, 'threshold') && input.threshold !== null && input.threshold !== '') {
    if (!validDecimal(input.threshold)) errors.threshold = 'Threshold must be a non-negative number with at most four decimals.';
  }
  if (Object.hasOwn(input, 'quantityOnHand') && input.quantityOnHand !== null && input.quantityOnHand !== '') {
    if (!validDecimal(input.quantityOnHand)) errors.quantityOnHand = 'Stock quantity must be a non-negative number with at most four decimals.';
  }
  if (Object.hasOwn(input, 'supplier') && input.supplier !== null
    && (typeof input.supplier !== 'string' || input.supplier.trim().length > 200)) {
    errors.supplier = 'Supplier must be 200 characters or fewer.';
  }
  if (!create && Object.keys(input).length === 0) errors.body = 'Provide at least one material field to update.';
  if (Object.keys(errors).length) return { success: false, result: invalid(errors) };

  const data = {};
  if (create || Object.hasOwn(input, 'itemCode')) data.itemCode = input.itemCode?.trim() || null;
  if (create || Object.hasOwn(input, 'name')) data.name = input.name.trim();
  if (create || Object.hasOwn(input, 'category')) data.category = input.category ?? null;
  if (create || Object.hasOwn(input, 'unit')) {
    data.unit = input.unit.trim();
    data.unitCode = internalUnitCode(data.unit);
  }
  if (create || Object.hasOwn(input, 'threshold')) {
    data.threshold = input.threshold === '' || input.threshold === undefined ? null : input.threshold;
  }
  if (Object.hasOwn(input, 'quantityOnHand')) {
    data.quantityOnHand = input.quantityOnHand === '' || input.quantityOnHand === undefined ? null : input.quantityOnHand;
  }
  if (create || Object.hasOwn(input, 'supplier')) data.supplier = input.supplier?.trim() || null;
  return { success: true, data };
}

function auditValue(material) {
  return {
    itemCode: material.itemCode ?? null,
    name: material.name,
    category: material.category ?? null,
    unit: material.sourceUnit ?? material.unitCode,
    threshold: material.threshold ?? null,
    quantityOnHand: material.quantityOnHand ?? null,
    quantityStatus: material.quantityStatus ?? 'unknown',
    thresholdStatus: material.thresholdStatus ?? 'unknown',
    supplier: material.supplier ?? null,
  };
}

export function createInventoryService({ db }) {
  async function list(actor) {
    const connection = await db.getConnection();
    try {
      const [materials] = await connection.execute(`SELECT CAST(m.id AS CHAR) id, m.item_code itemCode, m.name,
        m.category_code category, COALESCE(m.source_unit,m.unit_code) unit,
        m.reference_unit_price referenceUnitPrice, m.reference_price_text referencePriceText,
        m.reference_price_source referencePriceSource, m.reference_price_status referencePriceStatus,
        m.approved_costing_price approvedCostingPrice, m.quantity_on_hand qtyInStock,
        m.reorder_threshold threshold, m.quantity_status quantityStatus,
        m.threshold_status thresholdStatus, m.reference_price_page referencePricePage,
        m.reference_price_row referencePriceRow, m.supplier_name supplier,
        DATE_FORMAT(m.created_at,'%Y-%m-%dT%H:%i:%s.%fZ') createdAt,
        DATE_FORMAT(m.updated_at,'%Y-%m-%dT%H:%i:%s.%fZ') updatedAt
        FROM materials m WHERE m.active=TRUE ORDER BY m.name,m.id`);
      const [finishedGoods] = await connection.execute(`SELECT CAST(fg.id AS CHAR) id, fg.item_code itemCode,
        fg.enterfil_part_number enterFilPN, fg.quantity_on_hand qtyInStock, fg.buffer_minimum bufferMin,
        fg.demand, DATE_FORMAT(fg.updated_at,'%Y-%m-%dT%H:%i:%s.%fZ') lastUpdated
        FROM finished_goods fg ORDER BY fg.item_code,fg.id`);
      const canViewReferencePrices = ['warehouse', 'admin'].includes(actor?.roleCode);
      return {
        success: true,
        data: {
          materials: canViewReferencePrices ? materials : materials.map(material => ({
            ...material,
            referenceUnitPrice: null,
            referencePriceText: null,
            referencePriceSource: null,
          })),
          finishedGoods,
        },
      };
    } finally {
      connection.release();
    }
  }

  async function create(actor, body, context = {}) {
    if (!canMaintain(actor)) return { success: false, code: 'FORBIDDEN' };
    const validation = validateInput(body, { create: true });
    if (!validation.success) return validation.result;
    const input = validation.data;
    const connection = await db.getConnection();
    let transaction = false;
    try {
      await connection.beginTransaction();
      transaction = true;
      if (input.itemCode) {
        const [duplicates] = await connection.execute(
          'SELECT CAST(id AS CHAR) id FROM materials WHERE item_code=? FOR UPDATE',
          [input.itemCode],
        );
        if (duplicates.length) {
          await connection.rollback();
          transaction = false;
          return { success: false, code: 'ITEM_CODE_CONFLICT' };
        }
      }
      const [inserted] = await connection.execute(`INSERT INTO materials
        (item_code,name,category_code,unit_code,source_unit,unit_price,reference_unit_price,
         approved_costing_price,quantity_on_hand,reorder_threshold,supplier_name,active,
         quantity_status,threshold_status)
        VALUES (?,?,?,?,?,0,NULL,NULL,NULL,?,?,TRUE,'unknown',?)`,
      [input.itemCode, input.name, input.category, input.unitCode, input.unit, input.threshold, input.supplier,
        input.threshold == null ? 'unknown' : 'verified']);
      if (inserted.affectedRows !== 1 || inserted.insertId == null) throw new Error('Material insert was not confirmed.');
      const id = String(inserted.insertId);
      const value = auditValue({ ...input, sourceUnit: input.unit, unitCode: input.unitCode,
        thresholdStatus: input.threshold == null ? 'unknown' : 'verified' });
      const [audit] = await connection.execute(`INSERT INTO audit_events
        (actor_id,action,subject_type,subject_identifier,new_value,request_id,occurred_at)
        VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP(3))`,
      [actor.userId, 'inventory.material.created', 'material', id, JSON.stringify(value), context.requestId ?? null]);
      if (audit.affectedRows !== 1) throw new Error('Material creation audit write failed.');
      await connection.commit();
      transaction = false;
      return { success: true, data: { id, ...value, referenceUnitPrice: null, approvedCostingPrice: null, qtyInStock: null } };
    } catch (error) {
      if (transaction) {
        try { await connection.rollback(); } catch {}
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  async function update(actor, id, body, context = {}) {
    if (!canMaintain(actor) || !validateApplicationId(String(id ?? '')).success) return { success: false, code: 'FORBIDDEN' };
    const validation = validateInput(body, { create: false });
    if (!validation.success) return validation.result;
    const input = validation.data;
    const connection = await db.getConnection();
    let transaction = false;
    try {
      await connection.beginTransaction();
      transaction = true;
      const [rows] = await connection.execute(`SELECT CAST(id AS CHAR) id, item_code itemCode, name,
        category_code category, unit_code unitCode, source_unit sourceUnit,
        quantity_on_hand quantityOnHand, quantity_status quantityStatus,
        reorder_threshold threshold, threshold_status thresholdStatus, supplier_name supplier
        FROM materials WHERE id=? AND active=TRUE FOR UPDATE`, [id]);
      const current = rows[0];
      if (!current) {
        await connection.rollback();
        transaction = false;
        return { success: false, code: 'NOT_FOUND' };
      }

      const sets = [];
      const values = [];
      const oldValue = auditValue(current);
      const nextValue = { ...oldValue };
      if (Object.hasOwn(input, 'name') && input.name !== current.name) {
        sets.push('name=?'); values.push(input.name); nextValue.name = input.name;
      }
      if (Object.hasOwn(input, 'category') && input.category !== current.category) {
        sets.push('category_code=?'); values.push(input.category); nextValue.category = input.category;
      }
      if (Object.hasOwn(input, 'unit') && input.unit !== (current.sourceUnit ?? current.unitCode)) {
        sets.push('unit_code=?', 'source_unit=?'); values.push(input.unitCode, input.unit); nextValue.unit = input.unit;
      }
      if (Object.hasOwn(input, 'threshold')
        && ((input.threshold == null
          ? current.threshold != null
          : current.threshold == null || Number(input.threshold) !== Number(current.threshold))
          || current.thresholdStatus !== (input.threshold == null ? 'unknown' : 'verified'))) {
        sets.push('reorder_threshold=?'); values.push(input.threshold); nextValue.threshold = input.threshold;
        sets.push('threshold_status=?'); values.push(input.threshold == null ? 'unknown' : 'verified');
        nextValue.thresholdStatus = input.threshold == null ? 'unknown' : 'verified';
      }
      if (Object.hasOwn(input, 'quantityOnHand')
        && ((input.quantityOnHand == null
          ? current.quantityOnHand != null
          : current.quantityOnHand == null || Number(input.quantityOnHand) !== Number(current.quantityOnHand))
          || current.quantityStatus !== (input.quantityOnHand == null ? 'unknown' : 'verified'))) {
        sets.push('quantity_on_hand=?'); values.push(input.quantityOnHand);
        sets.push('quantity_status=?'); values.push(input.quantityOnHand == null ? 'unknown' : 'verified');
        nextValue.quantityOnHand = input.quantityOnHand;
        nextValue.quantityStatus = input.quantityOnHand == null ? 'unknown' : 'verified';
      }
      if (Object.hasOwn(input, 'supplier') && input.supplier !== (current.supplier ?? null)) {
        sets.push('supplier_name=?'); values.push(input.supplier); nextValue.supplier = input.supplier;
      }
      if (sets.length === 0) {
        await connection.commit();
        transaction = false;
        return { success: true, data: { id: String(current.id), ...oldValue } };
      }
      values.push(id);
      const [updated] = await connection.execute(
        `UPDATE materials SET ${sets.join(',')},updated_at=CURRENT_TIMESTAMP(3) WHERE id=? AND active=TRUE`,
        values,
      );
      if (updated.affectedRows !== 1) throw new Error('Material update was not confirmed.');
      const [audit] = await connection.execute(`INSERT INTO audit_events
        (actor_id,action,subject_type,subject_identifier,old_value,new_value,request_id,occurred_at)
        VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP(3))`,
      [actor.userId, 'inventory.material.updated', 'material', String(id), JSON.stringify(oldValue), JSON.stringify(nextValue), context.requestId ?? null]);
      if (audit.affectedRows !== 1) throw new Error('Material update audit write failed.');
      await connection.commit();
      transaction = false;
      return { success: true, data: { id: String(id), ...nextValue } };
    } catch (error) {
      if (transaction) {
        try { await connection.rollback(); } catch {}
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  return { list, create, update };
}
