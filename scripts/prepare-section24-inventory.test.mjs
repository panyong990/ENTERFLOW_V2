import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { buildArtifacts, prepareSection24, outputDirectory } from './prepare-section24-inventory.mjs';
import { planMaterialImport, executeApprovedMaterialImport } from '../database/material-catalog-import.mjs';

const read = relative => JSON.parse(fs.readFileSync(new URL('../'+relative,import.meta.url),'utf8'));
const catalog=read('docs/inventory-reconciliation/integrated-main-catalog.json');
const identities=read('config/material-catalog-ids.json');
const quantityEvidence=read('docs/inventory-reconciliation/quantity-evidence.template.json');
const item=catalog.materials[0];
const options={catalog:{...catalog,materials:[item]},units:[item.unit],categories:[item.category]};
const evidence={quantity:'0',verifiedBy:'Synthetic count operator',source:'Synthetic test fixture only',verifiedAt:'2026-11-18'};

test('71-row proposal preserves the previously reconciled manifest without copying stock defaults or inventing IDs',()=>{
  const files=buildArtifacts();
  const proposal=JSON.parse(files['nullable-import-proposal.json']);
  assert.equal(proposal.executionAuthorized,false);
  const { reviewDigest, ...reviewedBody } = proposal;
  assert.equal(reviewDigest,crypto.createHash('sha256').update(JSON.stringify(reviewedBody)).digest('hex'));
  assert.equal(proposal.rows.length,71);
  assert.deepEqual(proposal.rows.map(row=>row.source),catalog.materials);
  assert.equal(proposal.candidatePlan.operations.length,71);
  proposal.rows.forEach((row,index)=>{
    assert.equal(row.catalogCode,catalog.materials[index].id);
    assert.equal(row.databaseValues.quantity_on_hand,null);
    assert.equal(row.proposedDatabaseId,null);
    assert.equal(row.quantityState,'unknown');
    assert.deepEqual(proposal.candidatePlan.operations[index].params,[row.source.name,row.source.category,row.source.unit,String(row.source.unitPrice),null,String(row.source.threshold),row.source.supplier??null]);
  });
  assert.equal(files['material-import-review.csv'].trimEnd().split('\n').length,72);
});

test('generated artifacts are deterministic and checked-in review copies match',()=>{
  const files=buildArtifacts();assert.deepEqual(files,buildArtifacts());
  for(const [name,contents] of Object.entries(files)) assert.equal(fs.readFileSync(new URL('../'+outputDirectory+'/'+name,import.meta.url),'utf8'),contents);
});

test('default current-schema plan still blocks all unknown quantities',()=>{
  const plan=JSON.parse(buildArtifacts()['verified-only-current-schema-plan.json']);
  assert.equal(plan.ready,false);assert.equal(plan.errors.length,71);assert.equal(plan.operations.length,0);
  assert.equal(plan.executionAuthorized,false);
});

test('reference report distinguishes repository validation from unperformed database checks',()=>{
  const refs=JSON.parse(buildArtifacts()['reference-and-id-validation.json']);
  assert.equal(refs.repositoryReferenceValidation,'passed');assert.equal(refs.databaseReferenceValidation,'not-performed');
  assert.equal(refs.mappingRows.length,71);assert.ok(refs.mappingRows.every(row=>row.databaseId===null));
  assert.deepEqual(refs.requiredUnitCodes,[...new Set(catalog.materials.map(row=>row.unit))].sort());
  assert.deepEqual(refs.requiredCategoryCodes,[...new Set(catalog.materials.map(row=>row.category))].sort());
});

test('BOM preparation contains requirements, not guessed records',()=>{
  const bom=JSON.parse(buildArtifacts()['bom-business-data-required.json']);
  assert.deepEqual(bom.templates,[]);assert.deepEqual(bom.lines,[]);assert.equal(bom.executionAuthorized,false);
  assert.ok(bom.requiredLineFields.some(field=>field.includes('quantity_per_filter')));
});

test('nullable policy is explicit and never silently replaces partially supplied count evidence',()=>{
  assert.equal(planMaterialImport(options).ready,false);
  assert.equal(planMaterialImport({...options,quantityPolicy:'nullable-unknown'}).operations[0].params[4],null);
  const partial=planMaterialImport({...options,quantityPolicy:'nullable-unknown',verifiedQuantities:{[item.id]:{quantity:'5'}}});
  assert.equal(partial.ready,false);
  const verified=planMaterialImport({...options,quantityPolicy:'nullable-unknown',verifiedQuantities:{[item.id]:evidence}});
  assert.equal(verified.operations[0].params[4],'0');
  assert.throws(()=>planMaterialImport({...options,quantityPolicy:'guess'}),/policy/);
});

test('reuse preserves existing stock and detects metadata and supplier conflicts',()=>{
  for(const quantity of [null,'0','7.1250']) {
    const row={...item,id:'9007199254740993',qtyInStock:quantity,active:1};
    const plan=planMaterialImport({...options,existing:[row],quantityPolicy:'nullable-unknown'});
    assert.equal(plan.ready,true);assert.equal(plan.operations[0].kind,'reuse');
    assert.equal(plan.operations[0].preserveExistingQuantity,true);assert.equal(row.qtyInStock,quantity);
    assert.equal(plan.mapping[item.id],row.id);
  }
  assert.equal(planMaterialImport({...options,existing:[{...item,id:'9',supplier:'Synthetic conflicting supplier'}]}).ready,false);
});

test('duplicate codes, normalized names and ambiguous existing records stop the plan',()=>{
  const duplicate={...catalog,materials:[item,{...item,id:'SYNTHETIC-DUPLICATE',name:item.name.toLowerCase()}]};
  assert.equal(planMaterialImport({...options,catalog:duplicate,quantityPolicy:'nullable-unknown'}).ready,false);
  const row={...item,id:'9'};
  assert.equal(planMaterialImport({...options,existing:[row,row]}).ready,false);
  assert.equal(planMaterialImport({...options,catalog:{...catalog,materials:[item,item]}}).ready,false);
});

test('mapping IDs are bounded unsigned BIGINT strings, unique and catalog-scoped',()=>{
  for(const ids of [{[item.id]:9},{[item.id]:'18446744073709551616'},{[item.id]:'0'},{unknown:'9'}, {[item.id]:'9',unknown:'9'}]) {
    assert.equal(planMaterialImport({...options,identities:ids,quantityPolicy:'nullable-unknown'}).ready,false);
  }
  const id='18446744073709551615';
  assert.equal(planMaterialImport({...options,existing:[{...item,id}],identities:{[item.id]:id}}).mapping[item.id],id);
});

test('lookup omissions and precision overflow are rejected offline',()=>{
  assert.equal(planMaterialImport({...options,units:[],quantityPolicy:'nullable-unknown'}).ready,false);
  assert.equal(planMaterialImport({...options,categories:[],quantityPolicy:'nullable-unknown'}).ready,false);
  for(const value of ['100000000000','1.00001','-1']) {
    assert.throws(()=>planMaterialImport({...options,catalog:{...catalog,materials:[{...item,unitPrice:value}]}}),/decimal/i);
  }
});

test('approval digest binds quantity policy and exact reviewed values',()=>{
  const nullable=planMaterialImport({...options,quantityPolicy:'nullable-unknown'});
  const known=planMaterialImport({...options,verifiedQuantities:{[item.id]:evidence}});
  assert.notEqual(nullable.approvalDigest,known.approvalDigest);
  assert.notEqual(nullable.approvalDigest,planMaterialImport({...options,quantityPolicy:'nullable-unknown',catalog:{...catalog,materials:[{...item,threshold:item.threshold+1}]}}).approvalDigest);
});

test('existing prepared executor cannot execute a nullable proposal digest',async()=>{
  const proposal=planMaterialImport({...options,quantityPolicy:'nullable-unknown'});
  let rollback=0;
  const connection={async beginTransaction(){},async execute(sql){assert.match(sql,/^SELECT/);return [[]];},async commit(){assert.fail('Nullable execution is not authorized or implemented');},async rollback(){rollback++;}};
  await assert.rejects(executeApprovedMaterialImport({...options,connection,approvedDigest:proposal.approvalDigest}),/blocked|changed/);
  assert.equal(rollback,1);
});

test('preparation rejects incomplete evidence coverage or mismatched provenance',()=>{
  assert.throws(()=>prepareSection24({catalog,identities,quantityEvidence:{}}),/exactly/);
  assert.throws(()=>prepareSection24({catalog,identities:{...identities,sourceCommit:'different'},quantityEvidence}),/provenance/);
});
