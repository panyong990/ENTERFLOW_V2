// Offline artifacts only: no driver, environment loader, database or migration imports.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planMaterialImport } from '../database/material-catalog-import.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
export const outputDirectory = 'docs/inventory-preparation';
const units = ['roll','plate','sheet','kg','gal','pcs','set','m'];
const categories = ['filter_media','endcap','inner_core','outer_core','bonding_adhesive','oring','gasket','packaging'];
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const csv = value => '"' + String(value ?? '').replaceAll('"','""') + '"';

export function prepareSection24({ catalog, identities, quantityEvidence }) {
  if (catalog.materials.length !== 71) throw new Error('The reviewed catalog must contain exactly 71 records.');
  if (identities.sourceCommit !== catalog.sourceCommit) throw new Error('Catalog and mapping provenance differ.');
  if (Object.keys(quantityEvidence).length !== 71 || catalog.materials.some(item => !Object.hasOwn(quantityEvidence, item.id))) throw new Error('Quantity evidence must cover exactly the reviewed catalog.');
  const inputs = { catalog, identities: identities.ids, units, categories, verifiedQuantities: quantityEvidence };
  // Empty existing rows are a proposal assumption, never a fresh database finding.
  const currentSchema = planMaterialImport(inputs);
  const nullable = planMaterialImport({ ...inputs, quantityPolicy: 'nullable-unknown' });
  if (!nullable.ready) throw new Error('The nullable proposal failed catalog/reference validation.');
  const proposal = {
    formatVersion: 1,
    sourceCommit: catalog.sourceCommit,
    catalogPath: 'docs/inventory-reconciliation/integrated-main-catalog.json',
    catalogDigest: digest(catalog),
    executionAuthorized: false,
    readiness: 'approval-review-only',
    targetProposal: { database: 'enterflow_db', host: '127.0.0.1', port: 3308, table: 'materials', identityVerified: false },
    assumptions: ['Existing rows are assumed empty for this candidate, not verified.', 'Nullable schema and exact import are separately unapproved.', 'Fresh permitted metadata/lookup/material reads must precede any final execution plan.'],
    quantityPolicy: 'nullable-unknown',
    proposedSchema: 'ALTER TABLE materials MODIFY quantity_on_hand DECIMAL(15,4) NULL DEFAULT NULL;',
    candidatePlan: nullable,
    rows: catalog.materials.map((item, index) => ({
      catalogCode: item.id, source: item, proposedDatabaseId: identities.ids[item.id] ?? null,
      databaseValues: { name:item.name, category_code:item.category, unit_code:item.unit,
        unit_price:String(item.unitPrice), quantity_on_hand:nullable.operations[index].params[4],
        reorder_threshold:String(item.threshold), supplier_name:item.supplier??null },
      quantityState: nullable.operations[index].params[4] === null ? 'unknown' : 'verified',
      mappingStatus: 'pending-approved-target-reconciliation'
    }))
  };
  const referenceValidation = {
    sourceCommit:catalog.sourceCommit, materialCount:71, executionAuthorized:false,
    requiredUnitCodes:[...new Set(catalog.materials.map(row=>row.unit))].sort(),
    requiredCategoryCodes:[...new Set(catalog.materials.map(row=>row.category))].sort(),
    repositoryUnitAllowlist:units, repositoryCategoryAllowlist:categories,
    repositoryReferenceValidation:'passed', databaseReferenceValidation:'not-performed',
    historicalEvidence:'docs/inventory-reconciliation/database-readonly-snapshot.json records counts only; does not prove current lookup codes.',
    mappingRows:catalog.materials.map(item=>({catalogCode:item.id,databaseId:identities.ids[item.id]??null,
      name:item.name,category:item.category,unit:item.unit,unitPrice:String(item.unitPrice),threshold:String(item.threshold),supplier:item.supplier??null})),
    publicationRule:'Keep config/material-catalog-ids.json unchanged until approved target reads and committed/reconciled import results establish actual IDs. BIGINT IDs must be decimal strings; never infer from row order.'
  };
  // Bind the review packet's target/schema/rows as well as the candidate operation digest.
  proposal.reviewDigest = digest(proposal);
  const bom = {
    executionAuthorized:false, templates:[], lines:[], status:'business-data-required',
    affectedTablesAfterSeparateApproval:['bom_templates','bom_template_lines'],
    requiredTemplateFields:['filter_type_code','size_label and supported selection criteria','labor_cost','markup_percent','discount_percent','vat_type','vat_rate','include_labor','apply_markup','apply_vat','notes if approved','authorized created_by user ID'],
    requiredLineFields:['template identity','line_number','mapped numeric material ID','quantity_per_filter > 0','waste_percent 0..100','pricing/consumption unit agreement or explicitly approved conversion'],
    requiredEvidence:['manufacturing owner approval','source document/revision/date','dimensional applicability and overlap rules','unit conversion evidence','expected worked costing and stock-availability examples'],
    prohibition:'No templates, product/material associations, quantities, waste percentages, conversions or business IDs have been guessed.'
  };
  const json = value => JSON.stringify(value,null,2)+'\n';
  const header=['catalogCode','name','category_code','unit_code','unit_price','quantity_on_hand','quantityState','reorder_threshold','supplier_name','databaseId'];
  const lines=proposal.rows.map(row=>[row.catalogCode,row.databaseValues.name,row.databaseValues.category_code,row.databaseValues.unit_code,row.databaseValues.unit_price,row.databaseValues.quantity_on_hand===null?'NULL':row.databaseValues.quantity_on_hand,row.quantityState,row.databaseValues.reorder_threshold,row.databaseValues.supplier_name,row.proposedDatabaseId]);
  return {
    'nullable-import-proposal.json':json(proposal),
    'verified-only-current-schema-plan.json':json({executionAuthorized:false,assumption:'No existing rows assumed; not database verified.',...currentSchema}),
    'reference-and-id-validation.json':json(referenceValidation),
    'bom-business-data-required.json':json(bom),
    'material-import-review.csv':[header,...lines].map(row=>row.map(csv).join(',')).join('\n')+'\n'
  };
}

export function buildArtifacts() {
  return prepareSection24({catalog:readJson('docs/inventory-reconciliation/integrated-main-catalog.json'),
    identities:readJson('config/material-catalog-ids.json'),quantityEvidence:readJson('docs/inventory-reconciliation/quantity-evidence.template.json')});
}

if (process.argv[1] && fileURLToPath(import.meta.url)===fs.realpathSync(process.argv[1])) {
  const args=process.argv.slice(2);
  if (args.length!==1 || !['--write','--check'].includes(args[0])) throw new Error('Only offline --write or --check is supported.');
  const files=buildArtifacts();
  const directory=path.join(root,outputDirectory);
  if (args[0]==='--write') fs.mkdirSync(directory,{recursive:true});
  for (const [name,text] of Object.entries(files)) {
    const target=path.join(directory,name);
    if (args[0]==='--write') fs.writeFileSync(target,text,'utf8');
    else if (!fs.existsSync(target) || fs.readFileSync(target,'utf8')!==text) throw new Error('Prepared artifacts differ; review source changes and regenerate offline.');
  }
  console.log(JSON.stringify({mode:args[0],files:Object.keys(files).length,materials:71,executionAuthorized:false}));
}
