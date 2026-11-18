import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {planMaterialImport,executeApprovedMaterialImport} from './material-catalog-import.mjs';
const source=JSON.parse(fs.readFileSync(new URL('../docs/inventory-reconciliation/integrated-main-catalog.json',import.meta.url)));
const options={catalog:{...source,materials:source.materials.slice(0,1)},units:['kg'],categories:['filter_media']};
const item=options.catalog.materials[0];
const evidence={quantity:'0',verifiedBy:'Synthetic operator',verifiedAt:'2026-11-18',source:'Synthetic test count'};
test('all 71 MAIN records match repository metadata and exclude stock defaults',()=>{
  const text=fs.readFileSync(new URL('../src/app/store/materials.tsx',import.meta.url),'utf8');
  const rows=vm.runInNewContext(text.match(/const seedMaterials: RawMaterial\[\] = (\[[\s\S]*?\n\]);/)[1],{MAT:(id,name,category,unit,unitPrice,qty,threshold,supplier)=>({id,name,category,unit,unitPrice,threshold,...(supplier?{supplier}:{})})});
  assert.equal(source.materials.length,71);
  assert.equal(JSON.stringify(rows),JSON.stringify(source.materials));
  assert.equal(new Set(rows.map(row=>row.id)).size,71);
  assert.ok(source.materials.every(row=>!('qtyInStock' in row)));
});
test('unknown quantities block imports; explicitly verified zero is accepted',()=>{
  assert.equal(planMaterialImport(options).ready,false);
  const plan=planMaterialImport({...options,verifiedQuantities:{[item.id]:evidence}});
  assert.equal(plan.ready,true);assert.equal(plan.operations[0].params[4],'0');
});
test('reconciliation reuses exact rows without overwriting stock, and refuses conflicts/duplicates',()=>{
  const row={...item,id:'9007199254740993',qtyInStock:'7',active:1};
  const plan=planMaterialImport({...options,existing:[row]});assert.equal(plan.ready,true);assert.equal(plan.operations[0].kind,'reuse');assert.equal(plan.mapping[item.id],row.id);
  assert.equal(planMaterialImport({...options,existing:[{...row,unitPrice:99}]}).ready,false);
  assert.equal(planMaterialImport({...options,existing:[row,row]}).ready,false);
  assert.equal(planMaterialImport({...options,existing:[{...row,name:row.name.toLowerCase()}],verifiedQuantities:{[item.id]:evidence}}).ready,false);
});
test('prepared executor requires approval and rolls back any failed insert, using a double only',async()=>{
  let began=false,rolledBack=false;
  const connection={async beginTransaction(){began=true;},async execute(sql){if(sql.startsWith('SELECT'))return [[]];throw new Error('Synthetic insert failure');},async commit(){assert.fail('must not commit');},async rollback(){rolledBack=true;}};
  await assert.rejects(executeApprovedMaterialImport({...options,connection}),/approval/);assert.equal(began,false);
  const verifiedQuantities={[item.id]:evidence},plan=planMaterialImport({...options,verifiedQuantities});
  await assert.rejects(executeApprovedMaterialImport({...options,connection,verifiedQuantities,approvedDigest:plan.approvalDigest}),/Synthetic/);assert.equal(rolledBack,true);
});
