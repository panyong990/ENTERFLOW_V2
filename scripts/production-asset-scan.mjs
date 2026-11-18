import { parse } from '@babel/parser';
import { prohibitedLiterals, documentedCompatibilityLiterals, knownOutOfScopeLiterals } from './production-asset-policy.mjs';

const compatibility = {mediaLocal:'RM-PFM-111',mediaImported:'F-LNCON.FG-042',adhesive:'RM-PSBSI-144',box:'RM-GSPACK.CBP-148'};
const fields=['id','name','category','unit','unitPrice','qtyInStock','threshold','supplier'];
function walk(root) {
  const nodes=[],pending=[root];
  while(pending.length){const node=pending.pop();if(!node||typeof node!=='object')continue;
    if(typeof node.type==='string')nodes.push(node);
    for(const [key,value] of Object.entries(node)) if(!['loc','extra','comments','tokens'].includes(key)) {
      if(Array.isArray(value))pending.push(...value);else if(value&&typeof value==='object')pending.push(value);
    }
  }
  return nodes;
}
const value=node=>node?.type==='StringLiteral'||node?.type==='NumericLiteral'?node.value:undefined;
const key=node=>node?.type==='Identifier'?node.name:node?.type==='StringLiteral'?node.value:undefined;
function factory(node) {
  if(!['ArrowFunctionExpression','FunctionExpression','FunctionDeclaration'].includes(node?.type))return false;
  const body=node.body.type==='ObjectExpression'?node.body:node.body.type==='BlockStatement'&&node.body.body.length===1&&node.body.body[0].type==='ReturnStatement'?node.body.body[0].argument:null;
  if(body?.type!=='ObjectExpression'||body.properties.length!==9||node.params.length!==8)return false;
  return fields.every((field,index)=>body.properties.some(p=>p.type==='ObjectProperty'&&!p.computed&&key(p.key)===field&&p.value.type==='Identifier'&&p.value.name===node.params[index].name))&&
    body.properties.some(p=>key(p.key)==='history'&&p.value.type==='ArrayExpression'&&p.value.elements.length===0);
}
const parseCode=(source,typescript=false)=>parse(source,{sourceType:'unambiguous',plugins:typescript?['typescript','jsx']:[]});

export function catalogEvidence(materialSource,catalog) {
  if(!Array.isArray(catalog?.materials)||!catalog.materials.length)throw new Error('Catalog provenance is missing.');
  const nodes=walk(parseCode(materialSource,true));
  const declaration=nodes.find(n=>n.type==='VariableDeclarator'&&n.id.name==='seedMaterials');
  const constructor=nodes.find(n=>n.type==='VariableDeclarator'&&n.id.name==='MAT');
  if(!factory(constructor?.init)||declaration?.init?.type!=='ArrayExpression'||declaration.init.elements.length!==catalog.materials.length)throw new Error('Catalog source structure changed; review required.');
  const seen=new Set();
  return declaration.init.elements.map((call,index)=>{
    const row=catalog.materials[index];
    if(call?.type!=='CallExpression'||call.callee.name!=='MAT'||![7,8].includes(call.arguments.length))throw new Error('Catalog source record structure changed.');
    const args=call.arguments.map(value);
    const actual={id:args[0],name:args[1],category:args[2],unit:args[3],unitPrice:args[4],threshold:args[6],supplier:args[7]??null};
    const expected={id:row.id,name:row.name,category:row.category,unit:row.unit,unitPrice:row.unitPrice,threshold:row.threshold,supplier:row.supplier??null};
    if(seen.has(row.id)||JSON.stringify(actual)!==JSON.stringify(expected)||typeof args[5]!=='number'||!Number.isFinite(args[5])||args[5]<0)throw new Error('Catalog source conflicts with reconciled reference data.');
    seen.add(row.id);
    return {code:row.id,args,sourceFile:'src/app/store/materials.tsx',sourceLine:call.loc.start.line,referenceFile:'docs/inventory-reconciliation/integrated-main-catalog.json',sourceCommit:catalog.sourceCommit};
  });
}

export function scanAssets(assets,{catalog,materialSource}) {
  const evidence=catalogEvidence(materialSource,catalog);
  const knownCodes=new Set(evidence.map(row=>row.code));
  const markers=[...new Set([...prohibitedLiterals,...knownCodes,...documentedCompatibilityLiterals,...knownOutOfScopeLiterals.map(row=>row.literal)])];
  const result={assets:assets.length,catalogSourceCount:evidence.length,classifiedCatalog:[],classifiedCompatibility:[],violations:[]};
  if(!assets.length){result.violations.push({rule:'missing_javascript_assets'});return result;}
  for(const {filename,contents} of assets) {
    let nodes;
    try{nodes=walk(parseCode(contents));}catch{result.violations.push({filename,rule:'asset_parse_error'});continue;}
    const constructors=new Set(nodes.filter(n=>n.type==='VariableDeclarator'&&factory(n.init)).map(n=>n.id.name));
    for(const n of nodes)if(n.type==='FunctionDeclaration'&&factory(n))constructors.add(n.id.name);
    const approved=new Map(),compat=new Map();
    for(const node of nodes) {
      if(node.type==='ArrayExpression'&&node.elements.length===evidence.length&&node.elements.every((call,index)=>
        call?.type==='CallExpression'&&constructors.has(call.callee?.name)&&JSON.stringify(call.arguments.map(value))===JSON.stringify(evidence[index].args))) {
        node.elements.forEach((call,index)=>approved.set(call.arguments[0].start,evidence[index]));
      }
      if(node.type==='ObjectExpression'&&node.properties.length===4&&Object.entries(compatibility).every(([name,code])=>
        node.properties.some(p=>p.type==='ObjectProperty'&&!p.computed&&key(p.key)===name&&value(p.value)===code))) {
        node.properties.forEach(p=>compat.set(p.value.start,value(p.value)));
      }
    }
    const strings=nodes.filter(n=>n.type==='StringLiteral'||n.type==='TemplateElement');
    const added=new Set();
    const fail=(literal,offset,rule)=>{const identity=JSON.stringify([literal,offset,rule]);if(!added.has(identity)){added.add(identity);result.violations.push({filename,literal,offset,rule});}};
    for(const node of strings) {
      const text=node.type==='StringLiteral'?node.value:node.value.cooked??node.value.raw;
      for(const literal of markers)if(text.includes(literal)) {
        if(text===literal&&approved.has(node.start))result.classifiedCatalog.push({filename,offset:node.start,...approved.get(node.start),args:undefined,classification:'verified_catalog_record'});
        else if(text===literal&&compat.get(node.start)===literal)result.classifiedCompatibility.push({filename,offset:node.start,literal,classification:'exact_legacy_key_mapping'});
        else fail(literal,node.start,'unexplained_prohibited_literal');
      }
      if(/^(?:RM-|F-|OR-|GS-|OFF-)[A-Z0-9][A-Z0-9._-]*$/.test(text)&&!knownCodes.has(text))fail(text,node.start,'unknown_catalog_identifier');
    }
    // Preserve literal scanning in comments or other unparsed text as well.
    for(const literal of markers) {
      let offset=contents.indexOf(literal);
      while(offset!==-1){if(!strings.some(node=>node.start<=offset&&node.end>=offset+literal.length))fail(literal,offset,'prohibited_literal_outside_string');offset=contents.indexOf(literal,offset+literal.length);}
    }
  }
  return result;
}
