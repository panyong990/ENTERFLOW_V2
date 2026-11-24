const categories = new Set(['filter_media','endcap','inner_core','outer_core','bonding_adhesive','oring','gasket','packaging']);
const idPattern = /^[1-9]\d{0,19}$/;
export function inventoryNumber(value) {
  if (value === null || value === undefined || value === '') return Number.NaN;
  if (!['number','string'].includes(typeof value) || !/^\d+(?:\.\d+)?$/.test(String(value))) throw new Error('Inventory returned an invalid numeric value.');
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('Inventory returned an invalid numeric value.');
  return number;
}
export function assessMaterialStock(required, available) {
  if (!Number.isFinite(required) || required <= 0 || !Number.isFinite(available) || available < 0) return { status:'unavailable', shortage:null };
  const shortage = Math.max(0, required - available);
  return { status: shortage > 0 ? 'insufficient' : 'available', shortage };
}
export function operationalInventoryNumber(value, status) {
  if (status !== 'verified' || !['number', 'string'].includes(typeof value)
    || !/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(String(value))) return Number.NaN;
  return inventoryNumber(value);
}
export function materialObservationFields({ quantity, threshold, quantityObserved, thresholdObserved }) {
  return {
    ...(quantityObserved ? { quantityOnHand: quantity === '' ? null : quantity } : {}),
    ...(thresholdObserved ? { threshold: threshold === '' ? null : threshold } : {}),
  };
}
export function normalizeOperationalAvailability(response) {
  if (!response || !Array.isArray(response.assessments)) {
    throw new Error('Stock availability is unavailable.');
  }

  // Current authenticated Sales backend returns materials and assessments,
  // but does not yet supply the legacy unmappedItems collection.
  const backendShape =
    Array.isArray(response.materials) &&
    typeof response.overallStatus === 'string';

  // The Phase 2 backend must explicitly report BOM completeness.
  // Missing coverage metadata is never equivalent to an empty BOM gap list.
  if (backendShape &&
      (typeof response.requirementsAvailable !== 'boolean' ||
       !Array.isArray(response.unmappedItems))) {
    throw new Error('Stock availability completeness could not be verified.');
  }

  if (!Array.isArray(response.unmappedItems) && !backendShape) {
    throw new Error('Stock availability is unavailable.');
  }

  const unmappedItems = Array.isArray(response.unmappedItems)
    ? response.unmappedItems
    : [];

  const assessments = response.assessments.map(item => {
    const mapped = {
      ...item,
      inventoryId: item.inventoryId ?? item.materialId ?? null,
      description: item.description ?? item.materialName ?? 'Raw material',
      unit: item.unit ?? item.unitCode ?? null
    };

    if (mapped.classification !== 'raw_material') return mapped;

    const available = operationalInventoryNumber(
      mapped.availableQuantity,
      mapped.quantityStatus
    );
    const required = inventoryNumber(mapped.requiredQuantity);

    if (!Number.isFinite(available) ||
        !Number.isFinite(required) ||
        required <= 0) {
      return {
        ...mapped,
        availableQuantity: null,
        shortageQuantity: null,
        inventoryState: 'inventory_unavailable',
        status: 'inventory_unavailable'
      };
    }

    const shortage = Math.max(0, required - available);

    return {
      ...mapped,
      availableQuantity: available,
      shortageQuantity: shortage,
      inventoryState: available === 0 ? 'zero_stock' : 'recorded',
      status: shortage > 0 ? 'insufficient' : 'available'
    };
  });

  const hasAvailable = assessments.some(item => item.status === 'available');
  const hasInsufficient = assessments.some(item => item.status === 'insufficient');

  const overallStatus = unmappedItems.length ||
      response.overallStatus === 'unmapped'
    ? 'unmapped'
    : !assessments.length
      ? backendShape ? 'unmapped' : 'unavailable'
      : assessments.some(item => item.status === 'inventory_unavailable')
        ? 'unavailable'
        : hasInsufficient
          ? hasAvailable ? 'partially_available' : 'insufficient'
          : 'available';

  return {
    ...response,
    assessments,
    unmappedItems,
    overallStatus,
    checkedAt: response.checkedAt ?? new Date().toISOString()
  };
}
export function stockAvailabilityQuantityLabel(assessment) {
  if (assessment.quantityStatus === 'provisional_sample') return 'Sample · Quantity unavailable';
  if (assessment.classification === 'raw_material'
    && !Number.isFinite(operationalInventoryNumber(assessment.availableQuantity, assessment.quantityStatus))) return 'Quantity unavailable';
  return ['recorded', 'zero_stock'].includes(assessment.inventoryState) && assessment.availableQuantity != null
    ? `Recorded ${assessment.availableQuantity}` : 'Quantity unavailable';
}
export function mergeInventoryCatalog(catalog, response, identities = {}) {
  if (!response || !Array.isArray(response.materials) || !Array.isArray(response.finishedGoods)) throw new Error('Inventory returned an invalid response. Refresh before retrying.');
  const seen = new Set(); const seenCodes = new Set();
  const persisted = response.materials.map(row => {
    if (!row || typeof row.id !== 'string' || !idPattern.test(row.id) || seen.has(row.id) || typeof row.name !== 'string' || !row.name.trim()
      || (row.category !== null && !categories.has(row.category))
      || typeof row.unit !== 'string' || !row.unit.trim() || row.unit.length > 32
      || (row.itemCode != null && typeof row.itemCode !== 'string')) throw new Error('Inventory returned an invalid material record.');
    if (row.itemCode && seenCodes.has(row.itemCode)) throw new Error('Inventory returned duplicate material codes.');
    seen.add(row.id);
    if (row.itemCode) seenCodes.add(row.itemCode);
    return {
      ...row,
      databaseId: row.id,
      source: 'database',
      unitPrice: Number.NaN,
      referenceUnitPrice: inventoryNumber(row.referenceUnitPrice),
      approvedCostingPrice: inventoryNumber(row.approvedCostingPrice),
      qtyInStock: inventoryNumber(row.qtyInStock),
      threshold: inventoryNumber(row.threshold),
      history: [],
    };
  });
  const byId = new Map(persisted.map(row=>[row.id,row]));
  const byCode = new Map(persisted.filter(row=>row.itemCode).map(row=>[row.itemCode,row]));
  const used = new Set();
  const materials = catalog.map(reference => {
    const databaseId = identities[reference.id];
    const mappedRow = databaseId === undefined ? undefined : byId.get(databaseId);
    const codeRow = byCode.get(reference.id);
    if (databaseId !== undefined && (typeof databaseId !== 'string' || !idPattern.test(databaseId) || used.has(databaseId))) throw new Error('Inventory catalog mapping is invalid.');
    if (databaseId !== undefined && !mappedRow) throw new Error('A mapped inventory material was not returned by the authenticated service. Refresh and review the mapping.');
    if (mappedRow && codeRow && mappedRow.id !== codeRow.id) throw new Error('Explicit material mapping conflicts with the authenticated item code.');
    const row = codeRow ?? mappedRow;
    if (row) {
      if (!codeRow && (row.name !== reference.name || row.category !== reference.category || row.unit !== reference.unit
        || row.referenceUnitPrice !== reference.unitPrice || row.threshold !== reference.threshold)) {
        throw new Error('Inventory catalog mapping conflicts with verified reference values. Review before using it.');
      }
      used.add(row.id);
      return {...row, catalogCode:reference.id};
    }
    return {...reference, catalogCode:reference.id, databaseId:undefined, source:'catalog_reference', qtyInStock:Number.NaN, history:[]};
  });
  const finishedGoods = response.finishedGoods.map(row=>{
    if (!row || typeof row.id !== 'string' || !idPattern.test(row.id) || typeof row.itemCode !== 'string') throw new Error('Inventory returned an invalid finished-good record.');
    return {...row, enterFilPN:row.enterFilPN ?? '', itemName:typeof row.itemName === 'string' ? row.itemName : '', client:'—', qtyInStock:inventoryNumber(row.qtyInStock), bufferMin:inventoryNumber(row.bufferMin), updatedBy:'Backend', specs:{}, history:[]};
  });
  return {materials:[...materials,...persisted.filter(row=>!used.has(row.id))],finishedGoods};
}
