import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const sourceFile = new URL('./data/raw-material-master-source.json', import.meta.url);
const unitCodes = new Set(['roll', 'plate', 'sheet', 'kg', 'gal', 'pcs', 'set', 'm']);

function decimal(value) {
  if (!['number', 'string'].includes(typeof value) || !/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(String(value))) {
    throw new Error('Invalid source reference price.');
  }
  const [whole, fraction = ''] = String(value).split('.');
  if (whole.length > 11) throw new Error('Source reference price exceeds DECIMAL(15,4).');
  return BigInt(whole + fraction.padEnd(4, '0')).toString();
}

function canonicalDecimal(value) {
  decimal(value);
  return String(value);
}

function legacyUnitCode(sourceUnit) {
  const normalized = sourceUnit.toLowerCase();
  if (unitCodes.has(normalized)) return normalized;
  if (normalized === 'sets') return 'set';
  return 'pcs';
}

function parseReviewReasons(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return null; }
  }
  return null;
}

function reviewEntries(source) {
  return [
    ...source.rawMaterials
      .filter(item => item.referencePrice === null)
      .map(item => ({ ...item, reviewReasons: ['missing_reference_price'] })),
    ...source.uncodedReview,
  ];
}

function validateSource(source) {
  if (!source || typeof source !== 'object' || !source.source
    || typeof source.source.document !== 'string'
    || !/^[a-f0-9]{64}$/.test(source.source.sha256)
    || !Array.isArray(source.rawMaterials)
    || !Array.isArray(source.uncodedReview)
    || !Array.isArray(source.excludedOfficeSupplies)) {
    throw new Error('Material source snapshot is malformed.');
  }
  const codes = new Set();
  const sourceRows = new Set();
  for (const item of [...source.rawMaterials, ...source.uncodedReview]) {
    const key = `${item.sourcePage}:${item.sourceRow}`;
    if (!Number.isInteger(item.sourcePage) || item.sourcePage < 1
      || !Number.isInteger(item.sourceRow) || item.sourceRow < 1 || sourceRows.has(key)) {
      throw new Error(`Duplicate or invalid source page/row ${key}.`);
    }
    sourceRows.add(key);
    if (!item || typeof item.description !== 'string' || !item.description.trim() || item.description.length > 200
      || typeof item.unit !== 'string' || !item.unit.trim() || item.unit.length > 32) {
      throw new Error(`Incomplete material description or unit at ${key}.`);
    }
    if (item.referencePrice === null) {
      if (item.referencePriceText !== null) throw new Error(`Missing reference price text does not match ${key}.`);
    } else if (decimal(item.referencePrice) !== decimal(item.referencePriceText.replace(/,/g, ''))) {
      throw new Error(`Reference price text does not match ${key}.`);
    }
  }
  for (const item of source.rawMaterials) {
    if (!item || typeof item.itemCode !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,79}$/.test(item.itemCode)
      || codes.has(item.itemCode) || typeof item.description !== 'string' || !item.description.trim()
      || item.description.length > 200 || typeof item.unit !== 'string' || !item.unit.trim()
      || item.unit.length > 32) {
      throw new Error('Coded source materials contain missing or duplicate identity fields.');
    }
    codes.add(item.itemCode);
  }
  for (const item of reviewEntries(source)) {
    const key = `${item.sourcePage}:${item.sourceRow}`;
    if (!Array.isArray(item.reviewReasons) || item.reviewReasons.length === 0) {
      throw new Error(`A source review reason is required for ${key}.`);
    }
  }
  return source;
}

export function buildMaterialSourceImportPlan({ source, existingMaterials = [], existingReviews = [] }) {
  validateSource(source);
  const errors = [];
  const materialByCode = new Map();
  const materialBySourceRow = new Map();
  for (const row of existingMaterials) {
    if (typeof row.itemCode === 'string') {
      if (materialByCode.has(row.itemCode)) errors.push(`Duplicate authenticated item code ${row.itemCode}.`);
      materialByCode.set(row.itemCode, row);
    }
    if (row.referencePriceSourceSha256 && row.referencePricePage != null && row.referencePriceRow != null) {
      const key = `${row.referencePriceSourceSha256}:${row.referencePricePage}:${row.referencePriceRow}`;
      if (materialBySourceRow.has(key)) errors.push(`Duplicate authenticated source row ${key}.`);
      materialBySourceRow.set(key, row);
    }
  }
  const reviewByRow = new Map();
  for (const row of existingReviews) {
    const key = `${row.sourcePage}:${row.sourceRow}`;
    if (reviewByRow.has(key)) errors.push(`Duplicate stored source review row ${key}.`);
    reviewByRow.set(key, row);
  }

  const materialInserts = [];
  const materialUnchanged = [];
  const sourceMaterials = [
    ...source.rawMaterials.map(item => ({ ...item, reviewRequired: false })),
    ...source.uncodedReview.map(item => ({ ...item, reviewRequired: true })),
  ];
  for (const item of sourceMaterials) {
    const sourceKey = `${source.source.sha256}:${item.sourcePage}:${item.sourceRow}`;
    const existing = item.itemCode
      ? materialByCode.get(item.itemCode) ?? materialBySourceRow.get(sourceKey)
      : materialBySourceRow.get(sourceKey);
    const expectedPrice = item.referencePrice === null ? null : canonicalDecimal(item.referencePrice);
    const expectedStatus = item.reviewRequired || expectedPrice === null ? 'needs_review' : 'unreviewed';
    if (!existing) {
      materialInserts.push({ ...item, unitCode: legacyUnitCode(item.unit), referencePrice: expectedPrice, referencePriceStatus: expectedStatus });
      continue;
    }
    const same = existing.name === item.description
      && existing.sourceUnit === item.unit
      && existing.unitCode === legacyUnitCode(item.unit)
      && (existing.referenceUnitPrice == null ? null : decimal(existing.referenceUnitPrice)) === (expectedPrice === null ? null : decimal(expectedPrice))
      && (existing.referencePriceText ?? null) === item.referencePriceText
      && existing.referencePriceSource === source.source.document
      && existing.referencePriceSourceSha256 === source.source.sha256
      && Number(existing.referencePricePage) === item.sourcePage
      && Number(existing.referencePriceRow) === item.sourceRow
      && existing.referencePriceStatus === expectedStatus;
    if (!same) errors.push(`${item.itemCode ?? sourceKey}: existing source-backed material conflicts; no values will be overwritten.`);
    else materialUnchanged.push(item.itemCode ?? `${item.sourcePage}:${item.sourceRow}`);
  }

  const reviewInserts = [];
  const reviewUnchanged = [];
  for (const item of reviewEntries(source)) {
    const key = `${item.sourcePage}:${item.sourceRow}`;
    const existing = reviewByRow.get(key);
    if (!existing) {
      reviewInserts.push(item);
      continue;
    }
    const existingReasons = parseReviewReasons(existing.reviewReasons);
    const same = existing.sourceDocument === source.source.document
      && existing.sourceSha256 === source.source.sha256
      && (existing.sourceItemCode ?? null) === (item.itemCode ?? null)
      && existing.sourceDescription === item.description
      && existing.sourceUnit === item.unit
      && (existing.sourceReferencePrice == null ? null : decimal(existing.sourceReferencePrice)) === (item.referencePrice === null ? null : decimal(item.referencePrice))
      && (existing.sourceReferencePriceText ?? null) === item.referencePriceText
      && JSON.stringify(existingReasons) === JSON.stringify(item.reviewReasons);
    if (!same) errors.push(`Source review row ${key} conflicts; no review record will be overwritten.`);
    else reviewUnchanged.push(key);
  }

  return { ready: errors.length === 0, errors, materialInserts, materialUnchanged, reviewInserts, reviewUnchanged };
}

export async function executeMaterialSourceImport({ connection, source }) {
  await connection.beginTransaction();
  try {
    validateSource(source);
    const codes = source.rawMaterials.map(item => item.itemCode);
    const [existingMaterials] = await connection.execute(
      `SELECT item_code itemCode, name, source_unit sourceUnit, unit_code unitCode,
        reference_unit_price referenceUnitPrice, reference_price_text referencePriceText,
        reference_price_source referencePriceSource, reference_price_source_sha256 referencePriceSourceSha256,
        reference_price_page referencePricePage, reference_price_row referencePriceRow,
        reference_price_status referencePriceStatus, quantity_on_hand quantityOnHand,
        reorder_threshold reorderThreshold, quantity_status quantityStatus, threshold_status thresholdStatus
       FROM materials WHERE item_code IN (${codes.map(() => '?').join(',')})
         OR reference_price_source_sha256=? FOR UPDATE`,
      [...codes, source.source.sha256],
    );
    const [existingReviews] = await connection.execute(
      `SELECT source_document sourceDocument, source_sha256 sourceSha256, source_page sourcePage,
        source_row sourceRow, source_item_code sourceItemCode, source_description sourceDescription,
        source_unit sourceUnit, source_reference_price sourceReferencePrice,
        source_reference_price_text sourceReferencePriceText, review_reasons reviewReasons
       FROM material_import_review WHERE source_sha256=? FOR UPDATE`,
      [source.source.sha256],
    );
    const plan = buildMaterialSourceImportPlan({ source, existingMaterials, existingReviews });
    if (!plan.ready) throw new Error(plan.errors.join(' '));

    for (const item of plan.materialInserts) {
      const [result] = await connection.execute(
        `INSERT INTO materials
          (item_code,name,category_code,unit_code,source_unit,unit_price,reference_unit_price,
           reference_price_text,reference_price_source,reference_price_source_sha256,
           reference_price_page,reference_price_row,reference_price_status,
           approved_costing_price,quantity_on_hand,reorder_threshold,supplier_name,active,
           quantity_status,threshold_status)
         VALUES (?,?,NULL,?,?,0,?,?,?,?,?,?,?,NULL,10,2,NULL,TRUE,'provisional_sample','provisional_sample')`,
        [
          item.itemCode, item.description, item.unitCode, item.unit, item.referencePrice,
          item.referencePriceText, source.source.document, source.source.sha256,
          item.sourcePage, item.sourceRow, item.referencePriceStatus,
        ],
      );
      if (result.affectedRows !== 1 || result.insertId == null) throw new Error(`Material insert was not confirmed for ${item.itemCode}.`);
    }
    for (const item of plan.reviewInserts) {
      const [result] = await connection.execute(
        `INSERT INTO material_import_review
          (source_document,source_sha256,source_page,source_row,source_item_code,source_description,
           source_unit,source_reference_price,source_reference_price_text,review_reasons)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          source.source.document, source.source.sha256, item.sourcePage, item.sourceRow,
          item.itemCode, item.description, item.unit,
          item.referencePrice === null ? null : canonicalDecimal(item.referencePrice),
          item.referencePriceText, JSON.stringify(item.reviewReasons),
        ],
      );
      if (result.affectedRows !== 1 || result.insertId == null) throw new Error(`Source review insert was not confirmed for page ${item.sourcePage}, row ${item.sourceRow}.`);
    }
    await connection.commit();
    return {
      success: true,
      materialsInserted: plan.materialInserts.length,
      materialsUnchanged: plan.materialUnchanged.length,
      reviewRowsInserted: plan.reviewInserts.length,
      reviewRowsUnchanged: plan.reviewUnchanged.length,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function loadLocalMigrationConfig() {
  try { process.loadEnvFile('database/.env.migrations'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const env = process.env;
  for (const key of ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_MIGRATION_USER', 'DB_MIGRATION_PASSWORD']) {
    if (!env[key]) throw new Error(`Missing ${key}`);
  }
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(env.DB_NAME)
    || ['mysql', 'sys', 'performance_schema', 'information_schema'].includes(env.DB_NAME)
    || env.DB_HOST !== '127.0.0.1' || !['3308', '3309'].includes(env.DB_PORT)
    || (env.DB_PORT === '3308' && env.DB_NAME !== 'enterflow_db')
    || (env.DB_PORT === '3309' && !/^enterflow_workflow_/.test(env.DB_NAME))) {
    throw new Error('Import target is outside the approved local MySQL workflow.');
  }
  const mysql = await import('mysql2/promise');
  const ssl = env.DB_SSL_CA
    ? { ca: await readFile(env.DB_SSL_CA, 'utf8') }
    : { rejectUnauthorized: env.DB_SSL_LOCAL_SELF_SIGNED !== 'true' };
  return mysql.default.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    database: env.DB_NAME,
    user: env.DB_MIGRATION_USER,
    password: env.DB_MIGRATION_PASSWORD,
    ssl,
    multipleStatements: false,
    supportBigNumbers: true,
    bigNumberStrings: true,
    timezone: 'Z',
    connectTimeout: 10000,
  });
}

async function runCli() {
  const [mode] = process.argv.slice(2);
  if (mode === '--plan') {
    const source = JSON.parse(await readFile(sourceFile, 'utf8'));
    validateSource(source);
    console.log(JSON.stringify({
      mode: 'offline-plan-only',
      codedMaterials: source.rawMaterials.length,
      codedMaterialsWithReferencePrice: source.rawMaterials.filter(item => item.referencePrice !== null).length,
      reviewRows: reviewEntries(source).length,
      uncodedRows: source.uncodedReview.length,
      excludedOfficeSupplies: source.excludedOfficeSupplies.length,
      referencePricesApprovedForCosting: 0,
    }, null, 2));
    return;
  }
  if (mode !== '--apply' || process.argv.length !== 3) throw new Error('Usage: node database/material-master-source-import.mjs --plan|--apply');

  const source = JSON.parse(await readFile(sourceFile, 'utf8'));
  const connection = await loadLocalMigrationConfig();
  try {
    const [history] = await connection.execute(
      `SELECT state FROM _enterflow_migration_history WHERE file=?`,
      ['migrations/008_inventory_material_master.sql'],
    );
    if (history.length !== 1 || history[0].state !== 'applied') {
      throw new Error('Migration 008 must be recorded as applied before importing materials.');
    }
    const result = await executeMaterialSourceImport({ connection, source });
    console.log(JSON.stringify({ mode: 'apply', ...result }, null, 2));
  } finally {
    await connection.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runCli().catch(error => {
    console.error(`Material import error: ${error.message}`);
    process.exitCode = 1;
  });
}
