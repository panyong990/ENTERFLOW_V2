import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonicalizeShowCreate, parseApprovedCreateStatements, sha256, showCreateSha256 } from './inventory-schema-snapshot.mjs';

// Independently recorded column identities and hashes from the approved live
// diagnostic. No ignored local evidence, credentials or MySQL access is needed.
const observed = [
  { table: 'filter_types', hash: 'e6f2d61c12e8098366d61ee820f0d22ff37af6fad2b0ff7463787052d78d85f1',
    columns: ['code', 'label', 'template_group'] },
  { table: 'clients', hash: 'ae533a1420079d09138a5dbd2f910f32c69be4128d02756d5fd45215474a7f13',
    columns: ['company_name', 'industry', 'contact_person', 'email', 'phone', 'address_line1', 'address_line2',
      'city_province', 'postal_code', 'payment_term_code', 'internal_notes'] },
  { table: 'users', hash: 'f06f742f52c0f1440f5c10d415eef30810c7e0f287497fb656e363122cda29c1',
    columns: ['role_code', 'account_type', 'display_name', 'email', 'username', 'phone', 'password_hash',
      'employee_number', 'department', 'job_title'] },
  { table: 'product_specifications', hash: 'dbe2836deee831bf209bdb9e1fa53f3ac5d5b9696e36b4a9abca654abffa7537',
    columns: ['filter_type_code', 'filter_name', 'od1', 'od2', 'id1', 'id2', 'height', 'overall_height', 'length',
      'width', 'thickness', 'depth', 'pocket_count', 'diameter', 'cloth_cutting_width', 'cloth_cutting_length',
      'spring_plate_center_to_center', 'spring_plate_width', 'spring_plate_length', 'pad_od', 'pad_id', 'media',
      'inner_core', 'outer_core', 'oring', 'gasket', 'end_cap', 'oem_part_number', 'brand', 'filtration_rating', 'others', 'notes'] },
  { table: 'materials', hash: '952b10755aae5421e585064dd720785389345c5369e6e242d8e0ef30e7981d2c',
    columns: ['name', 'category_code', 'unit_code', 'reference_price_text', 'reference_price_source',
      'reference_price_status', 'quantity_status', 'threshold_status', 'supplier_name'] },
  { table: 'finished_goods', hash: '514115581e60c3c6cd49e877abddad0331faa12e0105043daad184e26bc85c85',
    columns: ['item_code', 'enterfil_part_number', 'demand'] }
];
assert.equal(observed.reduce((sum, item) => sum + item.columns.length, 0), 68);
const [sqlBytes, manifestBytes] = await Promise.all([
  readFile(new URL('../../../docs/integration-test-schema/inventory-auth.schema.proposed.sql', import.meta.url)),
  readFile(new URL('../../../docs/integration-test-schema/inventory-auth.schema.manifest.json', import.meta.url))
]);
const statements = parseApprovedCreateStatements(sqlBytes, manifestBytes);

function expandColumns(definition, columns) {
  const seen = [];
  const output = definition.split('\n').map(line => {
    const column = line.match(/^  `([^`]+)` /u)?.[1];
    if (!columns.includes(column)) return line;
    assert.ok(line.includes(' COLLATE utf8mb4_unicode_ci'));
    seen.push(column);
    return line.replace(' COLLATE utf8mb4_unicode_ci', ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  }).join('\n');
  assert.deepEqual(seen, columns);
  return output;
}

for (const item of observed) {
  const statement = statements.find(entry => entry.table === item.table);
  const approved = statement.sql.slice(0, -1);
  const actual = expandColumns(approved, item.columns);

  test(`${item.table}: all recorded expansions and each individual column match the approved full-table hash`, () => {
    // This binds the reconstructed input to the actual diagnostic representation,
    // independently of the canonicalizer under test.
    assert.equal(sha256(Buffer.from(actual)), item.hash);
    for (const value of [approved, actual, ...item.columns.map(column => expandColumns(approved, [column]))]) {
      assert.equal(canonicalizeShowCreate(value), approved);
      assert.equal(showCreateSha256(value), statement.expectedShowCreateSha256);
      assert.equal(canonicalizeShowCreate(canonicalizeShowCreate(value)), approved);
    }
  });

  test(`${item.table}: charset, collation, types, defaults, nullability and constraints remain strict`, () => {
    const changed = [
      actual.replace('CHARACTER SET utf8mb4', 'CHARACTER SET latin1'),
      actual.replace('COLLATE utf8mb4_unicode_ci', 'COLLATE utf8mb4_bin'),
      actual.replace(/varchar\(\d+\)/u, 'varchar(999)'),
      actual.replace('NOT NULL', 'DEFAULT NULL'),
      actual.replace(' DEFAULT NULL', " DEFAULT 'unexpected'"),
      actual.replace(/enum\('[^']+'/u, "enum('unexpected'"),
      actual.replace(/DEFAULT '[^']*'/u, "DEFAULT 'unexpected'"),
      actual.replace(/PRIMARY KEY \(`[^`]+`\)/u, 'PRIMARY KEY (`unexpected`)'),
      actual.replace(/CONSTRAINT `[^`]+`/u, 'CONSTRAINT `unexpected`'),
      actual.replace('ENGINE=InnoDB', 'ENGINE=MyISAM'),
      actual.replace('DEFAULT CHARSET=utf8mb4', 'DEFAULT CHARSET=latin1'),
      actual.replace(/COLLATE=utf8mb4_unicode_ci$/u, 'COLLATE=utf8mb4_bin'),
      actual.replace(`\`${item.columns[0]}\``, '`unexpected_column`'),
      actual.replace('  PRIMARY KEY', '  `unexpected` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,\n  PRIMARY KEY'),
      actual.replace(`CREATE TABLE \`${item.table}\``, 'CREATE TABLE `unapproved_table`'),
      actual.replace(' CHARACTER SET utf8mb4', ' CHARACTER SET utf8mb4 BINARY')
    ].filter(value => value !== actual);
    for (const value of changed) {
      assert.equal(canonicalizeShowCreate(value), value);
      assert.notEqual(showCreateSha256(value), statement.expectedShowCreateSha256);
    }
  });
}
