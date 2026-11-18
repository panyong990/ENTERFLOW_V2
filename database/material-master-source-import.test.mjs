import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildMaterialSourceImportPlan,
  executeMaterialSourceImport,
} from './material-master-source-import.mjs';

const source = JSON.parse(await readFile(new URL('./data/raw-material-master-source.json', import.meta.url), 'utf8'));

function importConnection() {
  const state = { materials: [], reviews: [], insertedMaterialSql: [], insertedReviewSql: [], rollbacks: 0 };
  const connection = {
    async beginTransaction() {},
    async execute(sql, params = []) {
      if (sql.includes('FROM materials WHERE item_code IN')) return [state.materials, []];
      if (sql.includes('FROM material_import_review WHERE source_sha256')) return [state.reviews, []];
      if (sql.startsWith('INSERT INTO materials')) {
        state.insertedMaterialSql.push({ sql, params });
        const [itemCode, name, unitCode, sourceUnit, referenceUnitPrice, referencePriceText,
          referencePriceSource, referencePriceSourceSha256, referencePricePage, referencePriceRow,
          referencePriceStatus] = params;
        state.materials.push({
          itemCode, name, unitCode, sourceUnit, referenceUnitPrice, referencePriceText,
          referencePriceSource, referencePriceSourceSha256, referencePricePage,
          referencePriceRow, referencePriceStatus, quantityOnHand: 10, reorderThreshold: 2,
          quantityStatus: 'provisional_sample', thresholdStatus: 'provisional_sample',
        });
        return [{ affectedRows: 1, insertId: state.materials.length }, []];
      }
      if (sql.startsWith('INSERT INTO material_import_review')) {
        state.insertedReviewSql.push({ sql, params });
        const [sourceDocument, sourceSha256, sourcePage, sourceRow, sourceItemCode,
          sourceDescription, sourceUnit, sourceReferencePrice, sourceReferencePriceText,
          reviewReasons] = params;
        state.reviews.push({
          sourceDocument, sourceSha256, sourcePage, sourceRow, sourceItemCode,
          sourceDescription, sourceUnit, sourceReferencePrice, sourceReferencePriceText,
          reviewReasons,
        });
        return [{ affectedRows: 1, insertId: state.reviews.length }, []];
      }
      throw new Error(`Unexpected SQL in synthetic test: ${sql}`);
    },
    async commit() {},
    async rollback() { state.rollbacks += 1; },
  };
  return { connection, state };
}

test('source snapshot preserves coded items, incomplete rows, office exclusions, and exact reference-price semantics', () => {
  assert.equal(source.rawMaterials.length, 118);
  assert.equal(source.rawMaterials.filter(item => item.referencePrice !== null).length, 117);
  assert.equal(source.excludedOfficeSupplies.length, 3);
  assert.equal(source.uncodedReview.length, 40);
  assert.equal(source.rawMaterials.length + source.uncodedReview.length, 158);
  assert.equal(new Set([...source.rawMaterials, ...source.uncodedReview].map(item => `${item.sourcePage}:${item.sourceRow}`)).size, 158);
  assert.equal(source.uncodedReview.filter(item => item.referencePrice === null).length, 13);
  assert.equal(source.rawMaterials.find(item => item.itemCode === 'RM-FP-147-2').referencePrice, null);
  assert.ok(source.uncodedReview.some(item => item.description.includes('ø HOLES')
    && item.reviewReasons.some(reason => reason.includes('RM-PERPO.GI-117'))));
  assert.equal(source.source.referencePriceSemantics, 'Source-listed reference prices only; not approved costing prices.');
});

test('repeatable source import includes coded and uncoded materials with provisional stock and separate costing', async () => {
  const { connection, state } = importConnection();
  const first = await executeMaterialSourceImport({ connection, source });
  assert.equal(first.materialsInserted, 158);
  assert.equal(first.materialsUnchanged, 0);
  assert.equal(first.reviewRowsInserted, 41);
  assert.equal(state.materials.length, 158);
  assert.equal(state.reviews.length, 41);
  assert.ok(state.insertedMaterialSql.every(({ sql }) => /approved_costing_price,quantity_on_hand,reorder_threshold/.test(sql)
    && /NULL,10,2,NULL,TRUE,'provisional_sample','provisional_sample'/.test(sql)));
  assert.equal(state.materials.filter(item => item.itemCode == null).length, 40);
  assert.equal(state.materials.every(item => item.quantityOnHand === 10 && item.reorderThreshold === 2
    && item.quantityStatus === 'provisional_sample' && item.thresholdStatus === 'provisional_sample'), true);
  assert.equal(state.materials.find(item => item.itemCode === 'RM-FP-147-2').referenceUnitPrice, null);
  assert.equal(state.materials.find(item => item.itemCode === 'RM-PERPO.GI-118').name, 'PERFORATED G.I 1mm X 4 X 8 X 3mm ø HOLES');
  assert.equal(state.materials.find(item => item.itemCode === null).referencePriceStatus, 'needs_review');

  const second = await executeMaterialSourceImport({ connection, source });
  assert.equal(second.materialsInserted, 0);
  assert.equal(second.materialsUnchanged, 158);
  assert.equal(second.reviewRowsInserted, 0);
  assert.equal(second.reviewRowsUnchanged, 41);
  assert.equal(state.insertedMaterialSql.length, 158);
  assert.equal(state.insertedReviewSql.length, 41);
  assert.equal(state.rollbacks, 0);
});

test('duplicate source codes and conflicting existing records block import without overwriting', () => {
  const duplicateSource = structuredClone(source);
  duplicateSource.rawMaterials[1].itemCode = duplicateSource.rawMaterials[0].itemCode;
  assert.throws(() => buildMaterialSourceImportPlan({ source: duplicateSource }), /duplicate identity fields/);

  const item = source.rawMaterials[0];
  const plan = buildMaterialSourceImportPlan({
    source,
    existingMaterials: [{
      itemCode: item.itemCode,
      name: `${item.description} altered`,
      sourceUnit: item.unit,
      unitCode: 'pcs',
      referenceUnitPrice: item.referencePrice,
      referencePriceText: item.referencePriceText,
      referencePriceSource: source.source.document,
      referencePriceSourceSha256: source.source.sha256,
      referencePricePage: item.sourcePage,
      referencePriceRow: item.sourceRow,
      referencePriceStatus: 'unreviewed',
    }],
  });
  assert.equal(plan.ready, false);
  assert.match(plan.errors[0], /conflicts; no values will be overwritten/);
});

test('repeat import preserves warehouse edits to stock and threshold', async () => {
  const { connection, state } = importConnection();
  await executeMaterialSourceImport({ connection, source });
  const coded = state.materials.find(item => item.itemCode === 'RM-FP-147-2');
  coded.quantityOnHand = 37.25;
  coded.reorderThreshold = 4.5;
  coded.quantityStatus = 'verified';
  coded.thresholdStatus = 'verified';
  const second = await executeMaterialSourceImport({ connection, source });
  assert.equal(second.materialsInserted, 0);
  assert.equal(second.materialsUnchanged, 158);
  assert.equal(coded.quantityOnHand, 37.25);
  assert.equal(coded.reorderThreshold, 4.5);
  assert.equal(coded.quantityStatus, 'verified');
  assert.equal(coded.thresholdStatus, 'verified');
});
