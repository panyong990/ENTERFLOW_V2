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
