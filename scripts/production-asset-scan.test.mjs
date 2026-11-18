import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { scanAssets, catalogEvidence } from './production-asset-scan.mjs';
import { prohibitedLiterals, knownOutOfScopeLiterals } from './production-asset-policy.mjs';

const catalog=JSON.parse(fs.readFileSync(new URL('../docs/inventory-reconciliation/integrated-main-catalog.json',import.meta.url),'utf8'));
const materialSource=fs.readFileSync(new URL('../src/app/store/materials.tsx',import.meta.url),'utf8');
const options={catalog,materialSource};
const evidence=catalogEvidence(materialSource,catalog);
const factory='const make=(id,name,category,unit,unitPrice,qtyInStock,threshold,supplier)=>({id,name,category,unit,unitPrice,qtyInStock,threshold,supplier,history:[]});';
const source=(rows=evidence.map(row=>row.args))=>factory+'const catalog=['+rows.map(args=>'make('+args.map(value=>JSON.stringify(value)).join(',')+')').join(',')+'];';
const scan=contents=>scanAssets([{filename:'synthetic.js',contents}],options);

test('all 71 exact catalog records are classified by structure and reference values, including all 67 former findings',()=>{
  const result=scan(source());
  assert.equal(result.violations.length,0);
  assert.equal(result.classifiedCatalog.length,71);
  const codes=new Set(catalog.materials.map(row=>row.id));
  assert.equal(prohibitedLiterals.filter(value=>codes.has(value)).length,67);
  assert.deepEqual(new Set(result.classifiedCatalog.map(row=>row.code)),codes);
});

test('valid catalog records do not exempt a second standalone occurrence of the same code',()=>{
  const result=scan(source()+`const transaction={materialId:${JSON.stringify(catalog.materials[0].id)}};`);
  assert.equal(result.classifiedCatalog.length,71);
  assert.ok(result.violations.some(row=>row.literal===catalog.materials[0].id));
});

test('changed names, units, prices, thresholds, quantities or supplier fields do not receive catalog classification',()=>{
  for(const [index,value] of [[1,'Synthetic tampered name'],[3,'synthetic-unit'],[4,1],[5,999],[6,999],[7,'Synthetic unapproved supplier']]){
    const rows=evidence.map(row=>[...row.args]);rows[0][index]=value;
    const result=scan(source(rows));
    assert.equal(result.classifiedCatalog.length,0);
    assert.ok(result.violations.some(row=>row.literal===catalog.materials[0].id));
  }
});

test('a matching argument list in an unrelated function is not a catalog record',()=>{
  const contents=source().replace('({id,name,category,unit,unitPrice,qtyInStock,threshold,supplier,history:[]})','({password:id})');
  assert.equal(scan(contents).classifiedCatalog.length,0);
  assert.ok(scan(contents).violations.length>=67);
});

test('duplicate or missing catalog rows and spoofed partial catalog arrays fail closed',()=>{
  for(const rows of [evidence.slice(1).map(row=>row.args),[evidence[0].args],evidence.map((row,index)=>index===1?evidence[0].args:row.args)]){
    const result=scan(source(rows));assert.equal(result.classifiedCatalog.length,0);assert.ok(result.violations.length>0);
  }
});

test('all original non-catalog prohibited literals remain detectable alongside legitimate catalog data',()=>{
  const codes=new Set(catalog.materials.map(row=>row.id));
  const prohibited=prohibitedLiterals.filter(value=>!codes.has(value));
  const result=scan(source()+'const demo='+JSON.stringify(prohibited)+';');
  for(const literal of prohibited)assert.ok(result.violations.some(row=>row.literal===literal));
});

test('Unicode-escaped suspicious literals and catalog codes are checked after parsing',()=>{
  const result=scan('const leaked="owner\\u0040enter-fil.com";const code="\\u0046-FMI.FM-043";');
  assert.ok(result.violations.some(row=>row.literal==='owner@enter-fil.com'));
  assert.ok(result.violations.some(row=>row.literal==='F-FMI.FM-043'));
});

test('legacy IDs require the complete exact four-key compatibility object',()=>{
  const mapping={mediaLocal:'RM-PFM-111',mediaImported:'F-LNCON.FG-042',adhesive:'RM-PSBSI-144',box:'RM-GSPACK.CBP-148'};
  const accepted=scan('const compatibility='+JSON.stringify(mapping)+';');
  assert.equal(accepted.violations.length,0);assert.equal(accepted.classifiedCompatibility.length,4);
  for(const contents of ['const standalone="RM-PFM-111";', 'const compatibility='+JSON.stringify({...mapping,extra:'unexpected'})+';'])assert.ok(scan(contents).violations.length>0);
});

test('formerly out-of-scope customer address defaults are production violations',()=>{
  const result=scan('const defaults='+JSON.stringify(knownOutOfScopeLiterals.map(row=>row.literal))+';');
  for(const {literal} of knownOutOfScopeLiterals)assert.ok(result.violations.some(row=>row.literal===literal));
});

test('unknown material IDs and literal leakage in comments remain findings',()=>{
  const result=scan(source()+'/* F-FMI.FM-043 */const forged="RM-SYNTHETIC-999";');
  assert.ok(result.violations.some(row=>row.rule==='unknown_catalog_identifier'));
  assert.ok(result.violations.some(row=>row.rule==='prohibited_literal_outside_string'));
});

test('invalid JavaScript, empty assets and reference drift cannot silently pass',()=>{
  assert.ok(scan('const broken = ;').violations.some(row=>row.rule==='asset_parse_error'));
  assert.ok(scanAssets([],options).violations.some(row=>row.rule==='missing_javascript_assets'));
  assert.throws(()=>catalogEvidence(materialSource,{...catalog,materials:catalog.materials.slice(1)}),/structure/);
});

test('scanner parses code without executing it',()=>{
  const result=scan(source()+'throw new Error("must never execute");');assert.equal(result.violations.length,0);
});
