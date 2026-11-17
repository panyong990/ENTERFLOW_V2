import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// No repository manifest, migration SQL, seed directory, or CLI is loaded.
// Only the production core source is imported; its filesystem dependency is
// replaced before evaluation with a narrowly scoped synthetic module.
let importSequence = 0;
async function isolatedVerifier(manifest, { register = registerHooks, importCore = url => import(url), syntheticFs } = {}) {
  const coreUrl = new URL('./migration-core.mjs', import.meta.url);
  coreUrl.searchParams.set('syntheticBaselineTest', String(++importSequence));
  const expectedPath = path.join(path.dirname(fileURLToPath(coreUrl)), 'baseline.v1.json');
  const reads = [];
  const key = `enterflow.syntheticBaseline.${importSequence}`;
  const dependency = {
    async readFile(filename, encoding) {
      assert.equal(encoding, 'utf8');
      if (syntheticFs?.files.has(filename)) {
        reads.push({ filename, encoding });
        return syntheticFs.files.get(filename);
      }
      assert.equal(filename, expectedPath, 'unexpected filesystem read');
      reads.push({ filename, encoding });
      return JSON.stringify(manifest);
    },
    async readdir(dirname) {
      assert.ok(syntheticFs?.directories.has(dirname), 'real or unexpected directory discovery is forbidden');
      return [...syntheticFs.directories.get(dirname)];
    }
  };
  globalThis[Symbol.for(key)] = dependency;
  const mockUrl = `synthetic-baseline-fs:${importSequence}`;
  let hooks;
  try {
    hooks = register({
    resolve(specifier, context, nextResolve) {
      if (context.parentURL === coreUrl.href && specifier === 'node:fs/promises') {
        return { url: mockUrl, shortCircuit: true };
      }
      if (context.parentURL === coreUrl.href && /^(?:node:)?fs(?:\/|$)/u.test(specifier)) {
        assert.fail('unexpected filesystem dependency');
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url === mockUrl) {
        return {
          format: 'module', shortCircuit: true,
          source: `const dependency = globalThis[Symbol.for(${JSON.stringify(key)})];
            export const readFile = dependency.readFile;
            export const readdir = dependency.readdir;`
        };
      }
      return nextLoad(url, context);
    }
    });
    const { verifyBaseline, run, checksum } = await importCore(coreUrl.href);
    return { verifyBaseline, run, checksum, reads };
  } finally {
    try {
      hooks?.deregister();
    } finally {
      delete globalThis[Symbol.for(key)];
    }
  }
}

const metadataQueries = {
  tables: "SELECT TABLE_NAME AS `table`,TABLE_TYPE AS type,ENGINE AS engine,TABLE_COLLATION AS collation FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME",
  columns: "SELECT TABLE_NAME AS `table`,COLUMN_NAME AS `column`,ORDINAL_POSITION AS position,COLUMN_TYPE AS type,IS_NULLABLE AS nullable,COLUMN_DEFAULT AS `default`,EXTRA AS extra,CHARACTER_SET_NAME AS charset,COLLATION_NAME AS collation FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,ORDINAL_POSITION",
  indexes: "SELECT TABLE_NAME AS `table`,INDEX_NAME AS `index`,1-NON_UNIQUE AS `unique`,SEQ_IN_INDEX AS position,COLUMN_NAME AS `column`,SUB_PART AS prefix,INDEX_TYPE AS type,COLLATION AS direction FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX",
  foreign_keys: "SELECT k.TABLE_NAME AS `table`,k.CONSTRAINT_NAME AS name,k.COLUMN_NAME AS `column`,k.ORDINAL_POSITION AS position,k.REFERENCED_TABLE_SCHEMA AS parent_schema,k.REFERENCED_TABLE_NAME AS parent,k.REFERENCED_COLUMN_NAME AS parent_column,r.UPDATE_RULE AS update_rule,r.DELETE_RULE AS delete_rule FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON k.CONSTRAINT_SCHEMA=r.CONSTRAINT_SCHEMA AND k.TABLE_NAME=r.TABLE_NAME AND k.CONSTRAINT_NAME=r.CONSTRAINT_NAME WHERE k.TABLE_SCHEMA=DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL ORDER BY k.TABLE_NAME,k.CONSTRAINT_NAME,k.ORDINAL_POSITION",
  checks: "SELECT t.TABLE_NAME AS `table`,c.CONSTRAINT_NAME AS name,c.CHECK_CLAUSE AS expression,t.ENFORCED AS enforced FROM information_schema.CHECK_CONSTRAINTS c JOIN information_schema.TABLE_CONSTRAINTS t ON c.CONSTRAINT_SCHEMA=t.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME=t.CONSTRAINT_NAME WHERE c.CONSTRAINT_SCHEMA=DATABASE() AND t.CONSTRAINT_TYPE='CHECK' ORDER BY t.TABLE_NAME,c.CONSTRAINT_NAME"
};

function fixture() {
  // Deliberately invented identifiers and checksum labels, never project hashes.
  const files = [
    { file: 'migrations/001_synthetic_schema.sql', kind: 'migrations', checksum: 'invented-migration-digest' },
    { file: 'seeds/001_synthetic_reference.sql', kind: 'seeds', checksum: 'invented-seed-digest' }
  ];
  const metadata = {
    tables: ['synthetic_reference', 'synthetic_second_reference'].map(table => ({ table, type: 'BASE TABLE', engine: 'InnoDB', collation: 'utf8mb4_bin' })),
    columns: [
      { table: 'synthetic_reference', column: 'id', position: 1, type: 'int', nullable: 'NO' },
      { table: 'synthetic_reference', column: 'label', position: 2, type: 'varchar(100)', nullable: 'NO' },
      { table: 'synthetic_reference', column: 'optional', position: 3, type: 'int', nullable: 'YES' },
      { table: 'synthetic_second_reference', column: 'id', position: 1, type: 'int', nullable: 'NO' }
    ],
    indexes: ['synthetic_reference', 'synthetic_second_reference'].map(table => ({ table, index: 'PRIMARY', unique: 1, position: 1, column: 'id' })),
    foreign_keys: [{ table: 'synthetic_reference', name: 'synthetic_fk', column: 'optional', position: 1, parent_schema: 'synthetic_baseline_db', parent: 'synthetic_second_reference', parent_column: 'id' }],
    checks: [{ table: 'synthetic_reference', name: 'synthetic_positive_id', expression: 'id > 0', enforced: 'YES' }]
  };
  const manifest = {
    files: files.map(({ file, checksum }) => ({ file, checksum })),
    metadata: structuredClone(metadata),
    seeds: {
      schema_migrations: [{ version: 'seed_001_reference_data' }],
      synthetic_reference: [{ id: 1, label: 'SYNTHETIC_REFERENCE', optional: null }],
      synthetic_second_reference: [{ id: 0 }]
    }
  };
  const calls = [];
  const executions = [];
  const executionContracts = [];
  const responses = new Map([
    ['SELECT DATABASE() AS name', [{ name: 'synthetic_baseline_db' }]],
    ['SELECT version FROM schema_migrations ORDER BY version', [{ version: '001_synthetic_schema' }]],
    ['SELECT COUNT(*) AS n FROM `synthetic_reference`', [{ n: 0 }]],
    ['SELECT COUNT(*) AS n FROM `synthetic_second_reference`', [{ n: 0 }]],
    ...['TRIGGERS', 'ROUTINES', 'EVENTS'].map(catalog => [
      `SELECT COUNT(*) AS n FROM information_schema.${catalog} WHERE ${catalog === 'TRIGGERS' ? 'TRIGGER_SCHEMA' : catalog === 'ROUTINES' ? 'ROUTINE_SCHEMA' : 'EVENT_SCHEMA'}=DATABASE()`, [{ n: 0 }]
    ])
  ]);
  const db = new Proxy({
    async query(sql, ...args) {
      calls.push(sql);
      assert.deepEqual(args, [], 'unexpected query arguments');
      assert.match(sql, /^SELECT\b/u, 'verifier must perform read-only interactions');
      if (responses.has(sql)) return [structuredClone(responses.get(sql)), []];
      const category = Object.keys(metadataQueries).find(name => metadataQueries[name] === sql);
      assert.ok(category, `unexpected synthetic query: ${sql}`);
      return [structuredClone(metadata[category]), []];
    },
    async execute(sql, params, ...args) {
      const contract = executionContracts[executions.length];
      assert.ok(contract, 'unexpected execute call');
      executions.push({ sql, params: structuredClone(params) });
      calls.push(sql);
      assert.deepEqual(args, [], 'unexpected execute arguments');
      assert.equal(sql, contract.sql, 'unexpected parameterized SQL');
      assert.deepEqual(params, contract.params, 'unexpected bound values');
      return [[{ n: contract.matches }], []];
    },
    async beginTransaction() { assert.fail('verifier must not start transactions'); },
    async commit() { assert.fail('verifier must not commit'); },
    async rollback() { assert.fail('verifier must not roll back'); }
  }, {
    get(target, property, receiver) {
      assert.ok(Object.hasOwn(target, property), `unexpected database method: ${String(property)}`);
      return Reflect.get(target, property, receiver);
    }
  });
  return { files, manifest, metadata, calls, db, responses, executions, executionContracts };
}

test('matching synthetic unseeded baseline returns migrations only with read-only database interactions', async () => {
  const h = fixture();
  const { verifyBaseline, reads } = await isolatedVerifier(h.manifest);
  const result = await verifyBaseline(h.db, h.files);
  assert.deepEqual(result, [h.files[0]]);
  assert.equal(result[0], h.files[0]);
  assert.equal(result.some(entry => entry.kind === 'seeds'), false);
  assert.equal(reads.length, 1);
  assert.equal(h.calls.length, 12);
  for (const table of ['TABLES', 'COLUMNS', 'STATISTICS', 'KEY_COLUMN_USAGE', 'CHECK_CONSTRAINTS']) {
    assert.equal(h.calls.filter(sql => sql.includes(`FROM information_schema.${table} `)).length, 1);
  }
  assert.ok(h.calls.includes('SELECT COUNT(*) AS n FROM `synthetic_reference`'));
  assert.ok(h.calls.every(sql => /^SELECT\b/u.test(sql)));
});

test('missing synthetic manifest file entry rejects before any database-double calls', async () => {
  const h = fixture();
  h.manifest.files.unshift({ file: 'migrations/002_synthetic_missing.sql', checksum: 'invented-missing-digest' });
  const { verifyBaseline, reads } = await isolatedVerifier(h.manifest);
  await assert.rejects(verifyBaseline(h.db, h.files), /Reviewed baseline file changed: migrations\/002_synthetic_missing\.sql/u);
  assert.deepEqual(h.calls, []);
  assert.equal(reads.length, 1);
});

test('changed synthetic checksum rejects before any database-double calls', async () => {
  const h = fixture();
  h.manifest.files[0].checksum = 'invented-deliberately-different-digest';
  const { verifyBaseline, reads } = await isolatedVerifier(h.manifest);
  await assert.rejects(verifyBaseline(h.db, h.files), /Reviewed baseline file changed: migrations\/001_synthetic_schema\.sql/u);
  assert.deepEqual(h.calls, []);
  assert.equal(reads.length, 1);
});

const metadataFailures = [
  ['missing expected synthetic table is rejected', 'tables', metadata => { metadata.tables = []; }],
  ['unexpected synthetic table is rejected', 'tables', metadata => { metadata.tables.push({ ...metadata.tables[0], table: 'synthetic_unexpected' }); }],
  ['missing synthetic column is rejected', 'columns', metadata => { metadata.columns = []; }],
  ['mismatched synthetic column type is rejected', 'columns', metadata => { metadata.columns[0].type = 'bigint'; }],
  ['missing synthetic index is rejected', 'indexes', metadata => { metadata.indexes = []; }],
  ['mismatched synthetic index uniqueness is rejected', 'indexes', metadata => { metadata.indexes[0].unique = 0; }],
  ['missing synthetic foreign key is rejected', 'foreign_keys', metadata => { metadata.foreign_keys = []; }],
  ['mismatched synthetic foreign-key parent is rejected', 'foreign_keys', metadata => { metadata.foreign_keys[0].parent = 'synthetic_wrong_parent'; }],
  ['cross-database synthetic foreign key is rejected', 'foreign_keys', metadata => { metadata.foreign_keys[0].parent_schema = 'synthetic_other_database'; }, true]
];

for (const [name, category, mutate, crossDatabase] of metadataFailures) {
  test(name, async () => {
    const h = fixture();
    mutate(h.metadata); // Manifest remains the independent expected metadata.
    const { verifyBaseline, reads } = await isolatedVerifier(h.manifest);
    const message = crossDatabase ? 'Cross-database foreign key; baseline refused'
      : `Baseline schema mismatch: ${category}. No baseline recorded.`;
    await assert.rejects(verifyBaseline(h.db, h.files), { message });
    const expectedQueries = [];
    for (const key of Object.keys(metadataQueries)) {
      expectedQueries.push(metadataQueries[key]);
      if (key === 'foreign_keys') expectedQueries.push('SELECT DATABASE() AS name');
      if (key === category) break;
    }
    assert.deepEqual(h.calls, expectedQueries, 'stop at the failing metadata gate');
    assert.equal(reads.length, 1);
  });
}

function syntheticGlobals() {
  return Object.getOwnPropertySymbols(globalThis)
    .filter(symbol => Symbol.keyFor(symbol)?.startsWith('enterflow.syntheticBaseline.'));
}

test('manifest mock temporary state is removed when hook registration fails', async () => {
  const before = syntheticGlobals();
  const failure = new Error('synthetic registration failure');
  await assert.rejects(isolatedVerifier({}, {
    register() { throw failure; },
    importCore() { assert.fail('import must not occur after registration failure'); }
  }), error => error === failure);
  assert.deepEqual(syntheticGlobals(), before);
});

test('manifest mock hook is deregistered and temporary state removed when import fails', async () => {
  const before = syntheticGlobals();
  const failure = new Error('synthetic import failure');
  let deregistrations = 0;
  await assert.rejects(isolatedVerifier({}, {
    register(options) {
      const actual = registerHooks(options);
      return { deregister() { deregistrations++; actual.deregister(); } };
    },
    importCore() { throw failure; }
  }), error => error === failure);
  assert.equal(deregistrations, 1);
  assert.deepEqual(syntheticGlobals(), before);
});

test('manifest mock temporary state is removed even when deregistration throws', async () => {
  const before = syntheticGlobals();
  const failure = new Error('synthetic deregistration failure');
  await assert.rejects(isolatedVerifier({}, {
    register() { return { deregister() { throw failure; } }; },
    importCore() { return { verifyBaseline() {} }; }
  }), error => error === failure);
  assert.deepEqual(syntheticGlobals(), before);
});

const legacyMarkersQuery = 'SELECT version FROM schema_migrations ORDER BY version';
const referenceCountQuery = 'SELECT COUNT(*) AS n FROM `synthetic_reference`';
const secondReferenceCountQuery = 'SELECT COUNT(*) AS n FROM `synthetic_second_reference`';
const secondReferenceRowQuery = 'SELECT COUNT(*) AS n FROM `synthetic_second_reference` WHERE `id` <=> ?';
const referenceRowQuery = 'SELECT COUNT(*) AS n FROM `synthetic_reference` WHERE `id` <=> ? AND CAST(`label` AS BINARY) <=> CAST(? AS BINARY) AND `optional` <=> ?';

function queriesThroughLegacyMarkers() {
  return [
    metadataQueries.tables, metadataQueries.columns, metadataQueries.indexes,
    metadataQueries.foreign_keys, 'SELECT DATABASE() AS name', metadataQueries.checks,
    'SELECT COUNT(*) AS n FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE()',
    'SELECT COUNT(*) AS n FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE()',
    'SELECT COUNT(*) AS n FROM information_schema.EVENTS WHERE EVENT_SCHEMA=DATABASE()',
    legacyMarkersQuery
  ];
}

test('expected synthetic legacy markers and empty unseeded reference table return migrations only', async () => {
  const h = fixture();
  const { verifyBaseline, reads } = await isolatedVerifier(h.manifest);
  const result = await verifyBaseline(h.db, h.files);
  assert.deepEqual(h.calls, [...queriesThroughLegacyMarkers(), referenceCountQuery, secondReferenceCountQuery]);
  assert.deepEqual(h.executions, []);
  assert.deepEqual(result, [h.files[0]]);
  assert.equal(result[0], h.files[0]);
  assert.equal(reads.length, 1);
});

for (const [name, markers] of [
  ['missing expected synthetic legacy marker is rejected before reference-data checks', []],
  ['unexpected synthetic legacy marker is rejected before reference-data checks', [
    { version: '001_synthetic_schema' }, { version: '002_synthetic_unexpected' }
  ]]
]) {
  test(name, async () => {
    const h = fixture();
    h.responses.set(legacyMarkersQuery, markers);
    const { verifyBaseline, reads } = await isolatedVerifier(h.manifest);
    await assert.rejects(verifyBaseline(h.db, h.files), { message: 'Legacy migration markers missing/unexpected' });
    assert.deepEqual(h.calls, queriesThroughLegacyMarkers());
    assert.deepEqual(h.executions, []);
    assert.equal(reads.length, 1);
  });
}

for (const [name, count] of [
  ['unmarked synthetic reference data is rejected', 1],
  ['partial unseeded synthetic reference data is rejected', 3]
]) {
  test(name, async () => {
    const h = fixture();
    h.responses.set(referenceCountQuery, [{ n: count }]);
    const { verifyBaseline, reads } = await isolatedVerifier(h.manifest);
    await assert.rejects(verifyBaseline(h.db, h.files), {
      message: 'Unmarked/partial seed data in synthetic_reference; manual review required'
    });
    assert.deepEqual(h.calls, [...queriesThroughLegacyMarkers(), referenceCountQuery]);
    assert.deepEqual(h.executions, []);
    assert.equal(reads.length, 1);
  });
}

function seededFixture(matches = 1) {
  const h = fixture();
  h.responses.set(legacyMarkersQuery, [
    { version: '001_synthetic_schema' }, { version: 'seed_001_reference_data' }
  ]);
  h.manifest.seeds.synthetic_reference = [
    { id: 11, label: "SYNTHETIC_BOUND_' OR 1=1 --", optional: null },
    { id: 12, label: 'SYNTHETIC_BOUND_SECOND', optional: 0 }
  ];
  h.executionContracts.push(
    { sql: referenceRowQuery, params: [11, "SYNTHETIC_BOUND_' OR 1=1 --", null], matches },
    { sql: referenceRowQuery, params: [12, 'SYNTHETIC_BOUND_SECOND', 0], matches: 1 },
    { sql: secondReferenceRowQuery, params: [0], matches: 1 }
  );
  return h;
}

test('exactly one match per seeded synthetic row uses bound values and returns migration and seed entries', async () => {
  const h = seededFixture();
  const { verifyBaseline, reads } = await isolatedVerifier(h.manifest);
  const result = await verifyBaseline(h.db, h.files);
  assert.deepEqual(h.calls, [...queriesThroughLegacyMarkers(), referenceRowQuery, referenceRowQuery, secondReferenceRowQuery]);
  assert.deepEqual(h.executions, [
    { sql: referenceRowQuery, params: [11, "SYNTHETIC_BOUND_' OR 1=1 --", null] },
    { sql: referenceRowQuery, params: [12, 'SYNTHETIC_BOUND_SECOND', 0] },
    { sql: secondReferenceRowQuery, params: [0] }
  ]);
  for (const execution of h.executions) assert.doesNotMatch(execution.sql, /SYNTHETIC_BOUND/u);
  assert.deepEqual(result, h.files);
  assert.equal(result[0], h.files[0]);
  assert.equal(result[1], h.files[1]);
  assert.equal(reads.length, 1);
});

for (const [name, matches] of [
  ['missing expected seeded synthetic row is rejected before checking the next row', 0],
  ['duplicate matching seeded synthetic rows are rejected before checking the next row', 2]
]) {
  test(name, async () => {
    const h = seededFixture(matches);
    const { verifyBaseline, reads } = await isolatedVerifier(h.manifest);
    await assert.rejects(verifyBaseline(h.db, h.files), {
      message: 'Required seed differs: synthetic_reference; no baseline recorded'
    });
    assert.deepEqual(h.calls, [...queriesThroughLegacyMarkers(), referenceRowQuery]);
    assert.deepEqual(h.executions, [
      { sql: referenceRowQuery, params: [11, "SYNTHETIC_BOUND_' OR 1=1 --", null] }
    ]);
    assert.equal(reads.length, 1);
  });
}

test('nonempty first unseeded reference table prevents checking the second table', async () => {
  const h = fixture();
  assert.deepEqual(Object.keys(h.manifest.seeds), [
    'schema_migrations', 'synthetic_reference', 'synthetic_second_reference'
  ]);
  h.responses.set(referenceCountQuery, [{ n: 1 }]);
  const { verifyBaseline, reads } = await isolatedVerifier(h.manifest);
  await assert.rejects(verifyBaseline(h.db, h.files), {
    message: 'Unmarked/partial seed data in synthetic_reference; manual review required'
  });
  // query() also rejects any supplied parameters; no execute is permitted here.
  assert.deepEqual(h.calls, [...queriesThroughLegacyMarkers(), referenceCountQuery]);
  assert.equal(h.calls.includes(secondReferenceCountQuery), false);
  assert.deepEqual(h.executions, []);
  assert.equal(reads.length, 1);
});

for (const seeded of [false, true]) {
  test(`${seeded ? 'seeded' : 'unseeded'} return selection excludes unlisted synthetic migration and seed inputs`, async () => {
    const h = seeded ? seededFixture() : fixture();
    const eligible = seeded ? [...h.files] : [h.files[0]];
    const unlisted = [
      { file: 'migrations/003_synthetic_unlisted.sql', kind: 'migrations', checksum: 'invented-unlisted-migration' },
      { file: 'seeds/003_synthetic_unlisted.sql', kind: 'seeds', checksum: 'invented-unlisted-seed' }
    ];
    h.files.push(...unlisted);
    for (const entry of unlisted) assert.equal(h.manifest.files.some(item => item.file === entry.file), false);
    const { verifyBaseline, reads } = await isolatedVerifier(h.manifest);
    const result = await verifyBaseline(h.db, h.files);
    assert.deepEqual(result, eligible);
    eligible.forEach((entry, index) => assert.equal(result[index], entry));
    for (const entry of unlisted) assert.equal(result.includes(entry), false);
    assert.deepEqual(h.calls, [...queriesThroughLegacyMarkers(), ...(seeded
      ? [referenceRowQuery, referenceRowQuery, secondReferenceRowQuery]
      : [referenceCountQuery, secondReferenceCountQuery])]);
    assert.equal(h.executions.length, seeded ? 3 : 0);
    assert.equal(reads.length, 1);
  });
}

const historyCreationSql = "CREATE TABLE `_enterflow_migration_history` (file VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY, checksum CHAR(64) CHARACTER SET ascii NOT NULL, state ENUM('applying','applied','failed') NOT NULL, method ENUM('execute','baseline') NOT NULL, started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), applied_at DATETIME(3) NULL, error_code VARCHAR(80) NULL) ENGINE=InnoDB";
const baselineInsertSql = "INSERT INTO `_enterflow_migration_history` (file,checksum,state,method,applied_at) VALUES (?,?,'applied','baseline',UTC_TIMESTAMP(3))";

async function adoptionFixture({ populated = false, recordingFailure } = {}) {
  const h = fixture();
  const base = path.join(path.dirname(fileURLToPath(import.meta.url)), '__synthetic_adoption_only__');
  // These paths exist only as map keys. No filesystem operation is delegated.
  const contents = new Map([
    ['migrations/001_synthetic_schema.sql', 'CREATE TABLE synthetic_reference (id INT);'],
    ['migrations/002_synthetic_extra.sql', 'CREATE TABLE synthetic_second_reference (id INT);'],
    ['seeds/001_synthetic_reference.sql', 'INSERT INTO synthetic_reference VALUES (1);']
  ]);
  const syntheticFs = {
    files: new Map([...contents].map(([file, text]) => [path.join(base, file), text])),
    directories: new Map([
      [path.join(base, 'migrations'), ['002_synthetic_extra.sql', '001_synthetic_schema.sql']],
      [path.join(base, 'seeds'), ['001_synthetic_reference.sql']]
    ])
  };
  const isolated = await isolatedVerifier(h.manifest, { syntheticFs });
  // Digest only invented inline strings; never read a real file or digest.
  const migrationFiles = [...contents].filter(([file]) => file.startsWith('migrations/'));
  h.manifest.files = [...contents].map(([file, text]) => ({ file, checksum: isolated.checksum(text) }));
  h.responses.set(legacyMarkersQuery, migrationFiles.map(([file]) => ({ version: path.basename(file, '.sql') })));
  const records = h.manifest.files.filter(entry => entry.file.startsWith('migrations/'));
  const lockName = 'enterflow:' + isolated.checksum('synthetic_baseline_db').slice(0, 50);
  const events = [], messages = [], steps = [];
  const add = (method, args, result, failure) => steps.push({ method, args, result, failure });
  add('query', ['SELECT DATABASE() AS name, VERSION() AS version'], [[{ name: 'synthetic_baseline_db', version: '8.4.1' }], []]);
  add('execute', ['SELECT GET_LOCK(?,0) AS acquired', [lockName]], [[{ acquired: 1 }], []]);
  add('query', ["SET time_zone='+00:00'"], [[], []]);
  add('query', ["SET SESSION sql_mode='STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'"], [[], []]);
  add('query', ['SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()'],
    [[{ name: 'synthetic_reference' }, ...(populated ? [{ name: '_enterflow_migration_history' }] : [])], []]);
  if (populated) {
    add('query', ['SELECT * FROM `_enterflow_migration_history` ORDER BY file'], [[{ ...records[0], state: 'applied' }], []]);
  } else {
    for (const sql of [...queriesThroughLegacyMarkers(), referenceCountQuery, secondReferenceCountQuery]) {
      // Build exact read contracts using only the existing synthetic double.
      add('query', [sql], await h.db.query(sql));
    }
    add('query', [historyCreationSql], [[], []]);
    add('beginTransaction', [], undefined);
    records.forEach((entry, index) => add('execute', [baselineInsertSql, [entry.file, entry.checksum]],
      [{ affectedRows: 1 }, []], index === 1 ? recordingFailure : undefined));
    add(recordingFailure ? 'rollback' : 'commit', [], undefined);
  }
  add('execute', ['SELECT RELEASE_LOCK(?)', [lockName]], [[{ released: 1 }], []]);
  // Setup queries above never touch the adoption event ledger.
  const expected = steps.map(({ method, args }) => ({ method, args: structuredClone(args) }));
  const db = new Proxy({}, {
    get(_target, method) {
      assert.ok(['query', 'execute', 'beginTransaction', 'commit', 'rollback'].includes(method), 'unexpected database method');
      return async (...args) => {
        const step = steps.shift();
        events.push({ method, args: structuredClone(args) });
        assert.ok(step, 'unexpected database operation');
        assert.equal(method, step.method);
        assert.deepEqual(args, step.args, 'exact adoption operation contract');
        if (step.failure) throw step.failure;
        return structuredClone(step.result);
      };
    }
  });
  return { ...isolated, db, base, events, expected, records, messages, steps,
    adopt: () => isolated.run(db, 'baseline', base, message => messages.push(message)) };
}

test('populated synthetic history rejects baseline adoption before verification or history writes', async () => {
  const h = await adoptionFixture({ populated: true });
  await assert.rejects(h.adopt(), { message: 'History already populated; use status/migrate, not baseline' });
  assert.deepEqual(h.events, h.expected);
  assert.equal(h.steps.length, 0);
  assert.equal(h.reads.some(read => path.basename(read.filename) === 'baseline.v1.json'), false);
  assert.equal(h.events.some(event => /^(CREATE|INSERT|UPDATE|DELETE)/u.test(event.args[0] ?? '')), false);
  assert.deepEqual(h.messages, ['Target synthetic_baseline_db / MySQL 8.4.1']);
});

test('synthetic baseline verification completes before history creation and transactional recording', async () => {
  const h = await adoptionFixture();
  await h.adopt();
  assert.deepEqual(h.events, h.expected);
  assert.equal(h.steps.length, 0);
  const creation = h.events.findIndex(event => event.args[0] === historyCreationSql);
  assert.equal(h.events[creation - 1].args[0], secondReferenceCountQuery);
  assert.equal(h.events[creation + 1].method, 'beginTransaction');
  assert.equal(h.reads.filter(read => path.basename(read.filename) === 'baseline.v1.json').length, 1);
});

test('synthetic baseline records both migrations in order inside one committed transaction without rollback', async () => {
  const h = await adoptionFixture();
  await h.adopt();
  assert.deepEqual(h.events, h.expected);
  assert.equal(h.steps.length, 0);
  const begin = h.events.findIndex(event => event.method === 'beginTransaction');
  assert.deepEqual(h.events.slice(begin + 1, begin + 3), h.records.map(entry => ({
    method: 'execute', args: [baselineInsertSql, [entry.file, entry.checksum]]
  })));
  assert.equal(h.events[begin + 3].method, 'commit');
  assert.equal(h.events.filter(event => event.method === 'beginTransaction').length, 1);
  assert.equal(h.events.filter(event => event.method === 'commit').length, 1);
  assert.equal(h.events.some(event => event.method === 'rollback'), false);
  assert.deepEqual(h.messages, [
    'Target synthetic_baseline_db / MySQL 8.4.1',
    'Verified 70-table baseline; recorded 2 files without replaying SQL.'
  ]);
});

test('synthetic baseline recording failure rolls back and preserves the original failure without success', async () => {
  const failure = new Error('SYNTHETIC_RECORDING_FAILURE');
  const h = await adoptionFixture({ recordingFailure: failure });
  await assert.rejects(h.adopt(), error => error === failure);
  assert.deepEqual(h.events, h.expected);
  assert.equal(h.steps.length, 0);
  assert.equal(h.events.filter(event => event.method === 'rollback').length, 1);
  assert.equal(h.events.some(event => event.method === 'commit'), false);
  assert.equal(h.events.filter(event => event.args[0] === baselineInsertSql).length, 2);
  assert.deepEqual(h.messages, ['Target synthetic_baseline_db / MySQL 8.4.1']);
});
