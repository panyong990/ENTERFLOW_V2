// Prepared import only. This CLI has no execution mode and never opens MySQL.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const fields = ['name','category','unit','unitPrice','threshold'];
const comparableName = value => String(value).normalize('NFKD').replace(/\p{M}/gu,'').trim().toLocaleLowerCase('en-US');
function decimal(value) {
  if (!['number','string'].includes(typeof value) || !/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(String(value))) throw new Error('Invalid catalog decimal.');
  const [whole,fraction=''] = String(value).split('.');
  return BigInt(whole + fraction.padEnd(4,'0')).toString();
}
export function planMaterialImport({ catalog, existing = [], units, categories, verifiedQuantities = {}, identities = {} }) {
  const errors=[], operations=[], mapping={};
  const codes=new Set(), names=new Set();
  for (const item of catalog.materials) {
    if (!item.id || codes.has(item.id) || !item.name || names.has(item.name)) { errors.push(`${item.id}: duplicate or missing code/name`); continue; }
    codes.add(item.id);names.add(item.name);
    if (!units.includes(item.unit) || !categories.includes(item.category)) { errors.push(`${item.id}: missing unit/category lookup`); continue; }
    decimal(item.unitPrice);decimal(item.threshold);
    const matches = identities[item.id] ? existing.filter(row=>row.id===identities[item.id]) : existing.filter(row=>comparableName(row.name)===comparableName(item.name));
    if (identities[item.id] && matches.length===0) { errors.push(`${item.id}: mapped database ID is absent`); continue; }
    if (matches.length>1) { errors.push(`${item.id}: ambiguous existing records`);continue; }
    const row=matches[0];
    if (row) {
      if (typeof row.id!=='string' || !/^[1-9]\d{0,19}$/.test(row.id)) { errors.push(`${item.id}: invalid database identity`); continue; }
      if (fields.some(field=>['unitPrice','threshold'].includes(field) ? decimal(row[field])!==decimal(item[field]) : row[field]!==item[field]) || row.active===false || row.active===0) { errors.push(`${item.id}: conflicting existing values; do not overwrite`);continue; }
      mapping[item.id]=row.id;
      operations.push({kind:'reuse',catalogCode:item.id,databaseId:row.id,preserveExistingQuantity:true});
      continue;
    }
    const evidence=verifiedQuantities[item.id];
    if (!evidence || !evidence.verifiedBy?.trim() || !evidence.source?.trim() || !/^\d{4}-\d{2}-\d{2}/.test(evidence.verifiedAt ?? '')) { errors.push(`${item.id}: a verified physical quantity and its evidence are required; unknown is not zero`);continue; }
    decimal(evidence.quantity);
    operations.push({kind:'insert',catalogCode:item.id,
      sql:'INSERT INTO materials (name,category_code,unit_code,unit_price,quantity_on_hand,reorder_threshold,supplier_name) VALUES (?,?,?,?,?,?,?)',
      params:[item.name,item.category,item.unit,String(item.unitPrice),String(evidence.quantity),String(item.threshold),item.supplier??null],
      quantityEvidence:evidence, mappingRule:'Capture insertId as a decimal string for this catalog code.'});
  }
  const body={sourceCommit:catalog.sourceCommit,errors,operations,mapping};
  return {...body,ready:errors.length===0,approvalDigest:crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex')};
}

// For future use only after approval of the reviewed plan/digest and write target.
// The CLI below cannot call this function. All tests inject an in-memory connection.
export async function executeApprovedMaterialImport({ connection, catalog, units, categories, verifiedQuantities, identities = {}, approvedDigest }) {
  if (!approvedDigest) throw new Error('Explicit approval of a reviewed plan is required.');
  await connection.beginTransaction();
  try {
    const [existing]=await connection.execute('SELECT CAST(id AS CHAR) id,name,category_code category,unit_code unit,unit_price unitPrice,reorder_threshold threshold,active FROM materials FOR UPDATE');
    const plan=planMaterialImport({catalog,existing,units,categories,verifiedQuantities,identities});
    if (!plan.ready || plan.approvalDigest!==approvedDigest) throw new Error('Import is blocked or the reviewed plan changed.');
    const mapping={...plan.mapping};
    for (const op of plan.operations) if (op.kind==='insert') {
      const [result]=await connection.execute(op.sql,op.params);
      if (result.affectedRows!==1 || result.insertId==null) throw new Error('Material insert was not confirmed.');
      mapping[op.catalogCode]=String(result.insertId);
    }
    await connection.commit();
    return {sourceCommit:catalog.sourceCommit,ids:mapping};
  } catch(error) { await connection.rollback();throw error; }
}

if (process.argv[1] && fileURLToPath(import.meta.url)===fs.realpathSync(process.argv[1])) {
  if (process.argv.slice(2).some(arg=>arg!=='--plan')) throw new Error('Only --plan is supported. Import execution is not authorized.');
  const catalog=JSON.parse(fs.readFileSync(new URL('../docs/inventory-reconciliation/integrated-main-catalog.json',import.meta.url),'utf8'));
  const plan=planMaterialImport({catalog,units:['roll','plate','sheet','kg','gal','pcs','set','m'],categories:['filter_media','endcap','inner_core','outer_core','bonding_adhesive','oring','gasket','packaging']});
  console.log(JSON.stringify({mode:'offline-plan-only',ready:plan.ready,materialCount:catalog.materials.length,blockedCount:plan.errors.length,errors:plan.errors,approvalDigest:plan.approvalDigest},null,2));
}
