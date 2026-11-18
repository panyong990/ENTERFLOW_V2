import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checksum, splitSql, discoverFilesAt, filesAt, run } from './migration-core.mjs';

test('checksums tolerate Windows CRLF and UTF-8 BOM only', () => {
  assert.equal(checksum('\uFEFFSELECT 1;\r\n'), checksum('SELECT 1;\n'));
  assert.notEqual(checksum('SELECT 2;\n'), checksum('SELECT 1;\n'));
});
test('splitter preserves quoted semicolons and skips ordinary comments', () => {
  assert.deepEqual(splitSql("-- hi\nINSERT INTO x VALUES ('a;b', 'it''s', 'back\\\'quote'); /* ; */ COMMIT;"), ["INSERT INTO x VALUES ('a;b', 'it''s', 'back\\\'quote')", 'COMMIT']);
});
test('unsafe directives and unsupported constructs fail before execution', () => {
  for (const sql of ['USE other;', 'DROP DATABASE x;', 'CREATE DATABASE x;', 'CREATE TABLESPACE x ADD DATAFILE \'x.ibd\';', 'INSERT INTO other.x VALUES (1);', '/*! SET foreign_key_checks=0 */;', 'SET GLOBAL sql_mode="";', 'DELIMITER $$', "INSERT INTO x VALUES ('unterminated);", 'CREATE TABLE x (id INT) /* unterminated']) {
    assert.throws(() => splitSql(sql), undefined, sql);
  }
});
test('discovery permits only the approved inventory migration and defers other version 7+ files', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'enterflow-migration-discovery-'));
  try {
    await mkdir(path.join(base, 'migrations'));
    await mkdir(path.join(base, 'seeds'));
    await writeFile(path.join(base, 'migrations', '001_initial.sql'), 'CREATE TABLE materials (id INT); CREATE TABLE users (id INT);');
    await writeFile(path.join(base, 'migrations', '006_latest_active.sql'), 'CREATE TABLE units (id INT);');
    await mkdir(path.join(base, 'migrations', '007_deferred_fixture.sql'));
    await mkdir(path.join(base, 'migrations', '009_future_fixture.sql'));
    await writeFile(path.join(base, 'migrations', '008_inventory_material_master.sql'), [
      'ALTER TABLE materials ADD COLUMN item_code VARCHAR(80) NULL;',
      'CREATE TABLE material_import_review (id INT, material_id INT, FOREIGN KEY (material_id) REFERENCES materials(id));',
    ].join('\n'));
    await writeFile(path.join(base, 'seeds', '001_reference_data.sql'), 'INSERT INTO reference_data VALUES (1);');

    const { files: activeFiles, deferredFiles } = await discoverFilesAt(base);
    assert.deepEqual(activeFiles.map(file => file.file), [
      'migrations/001_initial.sql',
      'migrations/006_latest_active.sql',
      'migrations/008_inventory_material_master.sql',
      'seeds/001_reference_data.sql',
    ]);
    const activeFilesFromWrapper = await filesAt(base);
    assert.deepEqual(activeFilesFromWrapper.map(file => file.file), activeFiles.map(file => file.file));
    assert.deepEqual(deferredFiles, [
      'migrations/007_deferred_fixture.sql',
      'migrations/009_future_fixture.sql',
    ]);
    const calls = [];
    const db = {
      query: async (sql) => {
        calls.push(sql);
        if (sql.startsWith('SELECT DATABASE() AS name, VERSION() AS version')) {
          return [[{ name: 'fixture_db', version: '8.4.1' }], []];
        }
        if (sql.startsWith('SELECT TABLE_NAME AS name FROM information_schema.TABLES')) return [[], []];
        return [{}, []];
      },
      execute: async (sql) => {
        calls.push(sql);
        if (sql.startsWith('SELECT GET_LOCK')) return [[{ acquired: 1 }], []];
        return [{}, []];
      },
      commit: async () => {},
      rollback: async () => {},
    };
    const messages = [];
    await run(db, 'migrate', base, message => messages.push(message));
    assert.ok(calls.includes('SELECT GET_LOCK(?,0) AS acquired'));
    assert.ok(calls.includes('SELECT RELEASE_LOCK(?)'));
    assert.ok(calls.includes('CREATE TABLE materials (id INT)'));
    assert.ok(calls.includes('CREATE TABLE units (id INT)'));
    assert.ok(calls.includes('ALTER TABLE materials ADD COLUMN item_code VARCHAR(80) NULL'));
    assert.ok(!calls.some(sql => sql.includes('deferred fixture') || sql.includes('future fixture')));
    assert.ok(messages.includes('DEFERRED migrations/007_deferred_fixture.sql'));
    assert.ok(messages.includes('DEFERRED migrations/009_future_fixture.sql'));

    calls.length = 0;
    for (const command of ['baseline', 'seed']) {
      await assert.rejects(run(db, command, base, () => {}), /deferred migrations exist/);
    }
    assert.equal(calls.length, 0);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('approved inventory migration rejects dependencies not established through migration 006', async () => {
  const base = await createFixture({
    'migrations/001_core.sql': 'CREATE TABLE materials (id INT);',
    'migrations/008_inventory_material_master.sql': [
      'ALTER TABLE materials ADD COLUMN item_code VARCHAR(80) NULL;',
      'CREATE TABLE material_import_review (id INT, FOREIGN KEY (material_id) REFERENCES migration_007_only(id));',
    ].join('\n'),
  });
  try {
    await assert.rejects(discoverFilesAt(base), /depends on a table outside migrations 001-006: migration_007_only/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

async function createFixture(files) {
  const base = await mkdtemp(path.join(tmpdir(), 'enterflow-migration-history-'));
  await mkdir(path.join(base, 'migrations'), { recursive: true });
  await mkdir(path.join(base, 'seeds'), { recursive: true });
  for (const [file, contents] of Object.entries(files)) {
    const target = path.join(base, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents);
  }
  return base;
}

function existingHistoryDb(rows) {
  const calls = [];
  const db = {
    query: async sql => {
      calls.push(sql);
      if (sql.startsWith('SELECT DATABASE() AS name, VERSION() AS version')) {
        return [[{ name: 'fixture_db', version: '8.4.1' }], []];
      }
      if (sql.startsWith('SELECT TABLE_NAME AS name FROM information_schema.TABLES')) {
        return [[{ name: '_enterflow_migration_history' }], []];
      }
      if (sql.startsWith('SELECT * FROM `_enterflow_migration_history`')) return [rows, []];
      return [[], []];
    },
    execute: async sql => {
      calls.push(sql);
      if (sql.startsWith('SELECT GET_LOCK')) return [[{ acquired: 1 }], []];
      return [{}, []];
    },
    commit: async () => {},
    rollback: async () => {},
  };
  return { db, calls };
}

test('status distinguishes unverified deferred history without accepting it or reading its checksum', async () => {
  const contents = 'CREATE TABLE active_fixture (id INT);';
  const base = await createFixture({
    'migrations/001_active_fixture.sql': contents,
    'seeds/001_reference_fixture.sql': 'INSERT INTO reference_fixture VALUES (1);',
  });
  // A directory deliberately makes SQL reads impossible. This is synthetic
  // temporary metadata, never the held project file or its stored checksum.
  await mkdir(path.join(base, 'migrations', '007_deferred_fixture.sql'));
  const { db, calls } = existingHistoryDb([
    { file: 'migrations/001_active_fixture.sql', checksum: checksum(contents), state: 'applied' },
    { file: 'migrations/007_deferred_fixture.sql', get checksum() { throw new Error('Deferred checksum must not be accessed'); }, state: 'applied' },
  ]);
  const messages = [];
  try {
    await assert.rejects(run(db, 'status', base, message => messages.push(message)), /Applied history references deferred migration: migrations\/007_deferred_fixture\.sql\. Integrity is UNVERIFIED/);
    assert.ok(messages.includes('DEFERRED migrations/007_deferred_fixture.sql'));
    assert.ok(!messages.some(message => message.startsWith('APPLIED ') || message.startsWith('PENDING ')));
    assert.ok(!calls.some(sql => /^(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP)\b/i.test(sql)));
    assert.ok(calls.includes('SELECT RELEASE_LOCK(?)'));
  } finally {
    assert.ok(path.resolve(base).startsWith(path.resolve(tmpdir()) + path.sep));
    await rm(base, { recursive: true, force: true });
  }
});

test('migrate also stays blocked by deferred history before any fixture writes', async () => {
  const base = await createFixture({ 'migrations/001_active_fixture.sql': 'CREATE TABLE active_fixture (id INT);' });
  await mkdir(path.join(base, 'migrations', '007_deferred_fixture.sql'));
  const { db, calls } = existingHistoryDb([
    { file: 'migrations/007_deferred_fixture.sql', get checksum() { throw new Error('Deferred checksum accessed'); }, state: 'applied' },
  ]);
  try {
    await assert.rejects(run(db, 'migrate', base, () => {}), /Integrity is UNVERIFIED/);
    assert.ok(!calls.some(sql => /^(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP)\b/i.test(sql)));
    assert.ok(calls.includes('SELECT RELEASE_LOCK(?)'));
  } finally {
    assert.ok(path.resolve(base).startsWith(path.resolve(tmpdir()) + path.sep));
    await rm(base, { recursive: true, force: true });
  }
});

for (const state of ['applying', 'failed']) test(`deferred ${state} history retains the manual-recovery block`, async () => {
  const base = await createFixture({});
  await mkdir(path.join(base, 'migrations', '007_deferred_fixture.sql'));
  const { db, calls } = existingHistoryDb([
    { file: 'migrations/007_deferred_fixture.sql', get checksum() { throw new Error('Deferred checksum accessed'); }, state },
  ]);
  try {
    await assert.rejects(run(db, 'status', base, () => {}), new RegExp(`Blocked by ${state} migration:.*manual recovery required`));
    assert.ok(!calls.some(sql => /^(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP)\b/i.test(sql)));
  } finally {
    assert.ok(path.resolve(base).startsWith(path.resolve(tmpdir()) + path.sep));
    await rm(base, { recursive: true, force: true });
  }
});

test('status can report active migration and seed markers when no history entry references a deferred file', async () => {
  const migration = 'CREATE TABLE active_fixture (id INT);';
  const seed = 'INSERT INTO reference_fixture VALUES (1);';
  const base = await createFixture({ 'migrations/001_active_fixture.sql': migration, 'seeds/001_reference_fixture.sql': seed });
  await mkdir(path.join(base, 'migrations', '007_deferred_fixture.sql'));
  const { db, calls } = existingHistoryDb([
    { file: 'migrations/001_active_fixture.sql', checksum: checksum(migration), state: 'applied' },
    { file: 'seeds/001_reference_fixture.sql', checksum: checksum(seed), state: 'applied' },
  ]);
  const messages = [];
  try {
    await run(db, 'status', base, message => messages.push(message));
    assert.ok(messages.includes('DEFERRED migrations/007_deferred_fixture.sql'));
    assert.ok(messages.includes('APPLIED migrations/001_active_fixture.sql'));
    assert.ok(messages.includes('APPLIED seeds/001_reference_fixture.sql'));
    assert.ok(!calls.some(sql => /^(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP)\b/i.test(sql)));
  } finally {
    assert.ok(path.resolve(base).startsWith(path.resolve(tmpdir()) + path.sep));
    await rm(base, { recursive: true, force: true });
  }
});

test('rejects applied history whose checksum differs from the active fixture', async () => {
  const contents = 'CREATE TABLE active_fixture (id INT);';
  const base = await createFixture({ 'migrations/001_active_fixture.sql': contents });
  const { db, calls } = existingHistoryDb([{
    file: 'migrations/001_active_fixture.sql',
    checksum: checksum('CREATE TABLE old_fixture (id INT);'),
    state: 'applied',
  }]);
  try {
    for (const command of ['status', 'migrate']) {
      await assert.rejects(run(db, command, base, () => {}), /Applied file missing\/modified: migrations\/001_active_fixture\.sql/);
    }
    assert.ok(calls.includes('SELECT RELEASE_LOCK(?)'));
    assert.ok(!calls.includes('CREATE TABLE active_fixture (id INT)'));
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('rejects applied history with no corresponding active fixture file', async () => {
  const base = await createFixture({ 'migrations/001_active_fixture.sql': 'CREATE TABLE active_fixture (id INT);' });
  const { db, calls } = existingHistoryDb([{
    file: 'migrations/002_missing_fixture.sql',
    checksum: checksum('CREATE TABLE missing_fixture (id INT);'),
    state: 'applied',
  }]);
  try {
    for (const command of ['status', 'migrate']) {
      await assert.rejects(run(db, command, base, () => {}), /Applied file missing\/modified: migrations\/002_missing_fixture\.sql/);
    }
    assert.ok(calls.includes('SELECT RELEASE_LOCK(?)'));
    assert.ok(!calls.includes('CREATE TABLE active_fixture (id INT)'));
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('records a failed migration and blocks an automatic retry', async () => {
  const statement = 'CREATE TABLE failing_fixture (id INT);';
  const base = await createFixture({ 'migrations/001_failing_fixture.sql': statement });
  const calls = [];
  const rows = [];
  let historyExists = false;
  let statementAttempts = 0;
  let rollbacks = 0;
  let lockReleases = 0;
  const db = {
    query: async sql => {
      calls.push(sql);
      if (sql.startsWith('SELECT DATABASE() AS name, VERSION() AS version')) {
        return [[{ name: 'fixture_db', version: '8.4.1' }], []];
      }
      if (sql.startsWith('SELECT TABLE_NAME AS name FROM information_schema.TABLES')) {
        return [historyExists ? [{ name: '_enterflow_migration_history' }] : [], []];
      }
      if (sql.startsWith('SELECT * FROM `_enterflow_migration_history`')) return [rows, []];
      if (sql.startsWith('CREATE TABLE `_enterflow_migration_history`')) {
        historyExists = true;
        return [[], []];
      }
      if (sql === 'CREATE TABLE failing_fixture (id INT)') {
        statementAttempts++;
        throw Object.assign(new Error('synthetic SQL failure'), { code: 'SYNTHETIC_FAILURE' });
      }
      return [[], []];
    },
    execute: async (sql, params = []) => {
      calls.push(sql);
      if (sql.startsWith('SELECT GET_LOCK')) return [[{ acquired: 1 }], []];
      if (sql.startsWith('SELECT RELEASE_LOCK')) {
        lockReleases++;
        return [[{ released: 1 }], []];
      }
      if (sql.startsWith('INSERT INTO `_enterflow_migration_history`')) {
        rows.push({ file: params[0], checksum: params[1], state: 'applying' });
      } else if (sql.startsWith("UPDATE `_enterflow_migration_history` SET state='failed'")) {
        const row = rows.find(entry => entry.file === params[1]);
        row.state = 'failed';
        row.error_code = params[0];
      }
      return [{}, []];
    },
    commit: async () => {},
    rollback: async () => { rollbacks++; },
  };
  try {
    await assert.rejects(run(db, 'migrate', base, () => {}), /No automatic retry/);
    assert.equal(statementAttempts, 1);
    assert.equal(rollbacks, 1);
    assert.deepEqual(rows.map(({ state, error_code }) => ({ state, error_code })), [
      { state: 'failed', error_code: 'SYNTHETIC_FAILURE' },
    ]);

    await assert.rejects(run(db, 'migrate', base, () => {}), /Blocked by failed migration/);
    assert.equal(statementAttempts, 1);
    assert.equal(lockReleases, 2);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('blocks retry when the failed-state history update itself fails', async () => {
  const base = await createFixture({ 'migrations/001_failing_fixture.sql': 'CREATE TABLE failing_fixture (id INT);' });
  const rows = [];
  let statementAttempts = 0;
  let lockReleases = 0;
  const db = {
    query: async sql => {
      if (sql.startsWith('SELECT DATABASE() AS name, VERSION() AS version')) {
        return [[{ name: 'fixture_db', version: '8.4.1' }], []];
      }
      if (sql.startsWith('SELECT TABLE_NAME AS name FROM information_schema.TABLES')) {
        return [[{ name: '_enterflow_migration_history' }], []];
      }
      if (sql.startsWith('SELECT * FROM `_enterflow_migration_history`')) return [rows, []];
      if (sql === 'CREATE TABLE failing_fixture (id INT)') {
        statementAttempts++;
        throw Object.assign(new Error('synthetic SQL failure'), { code: 'SYNTHETIC_FAILURE' });
      }
      return [[], []];
    },
    execute: async (sql, params = []) => {
      if (sql.startsWith('SELECT GET_LOCK')) return [[{ acquired: 1 }], []];
      if (sql.startsWith('SELECT RELEASE_LOCK')) {
        lockReleases++;
        return [[{ released: 1 }], []];
      }
      if (sql.startsWith('INSERT INTO `_enterflow_migration_history`')) {
        rows.push({ file: params[0], checksum: params[1], state: 'applying' });
      } else if (sql.startsWith("UPDATE `_enterflow_migration_history` SET state='failed'")) {
        throw new Error('synthetic history write failure');
      }
      return [{}, []];
    },
    commit: async () => {},
    rollback: async () => {},
  };
  try {
    await assert.rejects(run(db, 'migrate', base, () => {}), /No automatic retry/);
    assert.equal(rows[0].state, 'applying');
    await assert.rejects(run(db, 'migrate', base, () => {}), /Blocked by applying migration/);
    assert.equal(statementAttempts, 1);
    assert.equal(lockReleases, 2);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('fails closed when the advisory lock cannot be acquired', async () => {
  const base = await createFixture({ 'migrations/001_active_fixture.sql': 'CREATE TABLE active_fixture (id INT);' });
  const calls = [];
  const db = {
    query: async sql => {
      calls.push(sql);
      if (sql.startsWith('SELECT DATABASE() AS name, VERSION() AS version')) {
        return [[{ name: 'fixture_db', version: '8.4.1' }], []];
      }
      return [[], []];
    },
    execute: async sql => {
      calls.push(sql);
      if (sql.startsWith('SELECT GET_LOCK')) return [[{ acquired: 0 }], []];
      return [{}, []];
    },
  };
  try {
    await assert.rejects(run(db, 'migrate', base, () => {}), /Another migration process holds the database lock/);
    assert.ok(!calls.includes('SELECT RELEASE_LOCK(?)'));
    assert.ok(!calls.includes('CREATE TABLE active_fixture (id INT)'));
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

for (const kind of ['migrations', 'seeds']) test(`rejects out-of-order ${kind} history before any writes`, async () => {
  const first = kind === 'migrations' ? 'CREATE TABLE first_fixture (id INT);' : 'INSERT INTO reference_fixture VALUES (1);';
  const second = kind === 'migrations' ? 'CREATE TABLE second_fixture (id INT);' : 'INSERT INTO reference_fixture VALUES (2);';
  const base = await createFixture({ [`${kind}/001_first_fixture.sql`]: first, [`${kind}/002_second_fixture.sql`]: second });
  const { db, calls } = existingHistoryDb([{ file: `${kind}/002_second_fixture.sql`, checksum: checksum(second), state: 'applied' }]);
  try {
    for (const command of ['status', 'migrate', 'seed']) {
      await assert.rejects(run(db, command, base, () => {}), /Out-of-order history/);
    }
    assert.ok(!calls.some(sql => /^(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP)\b/i.test(sql)));
    assert.equal(calls.filter(sql => sql === 'SELECT RELEASE_LOCK(?)').length, 3);
  } finally {
    assert.ok(path.resolve(base).startsWith(path.resolve(tmpdir()) + path.sep));
    await rm(base, { recursive: true, force: true });
  }
});

test('unsupported server identity is rejected before lock, session changes or writes', async () => {
  const base = await createFixture({ 'migrations/001_active_fixture.sql': 'CREATE TABLE active_fixture (id INT);' });
  const calls = [];
  const db = {
    query: async sql => { calls.push(sql); return [[{ name: 'fixture_db', version: '8.0.99' }], []]; },
    execute: async () => { assert.fail('Rejected server must not acquire a lock or execute SQL'); },
  };
  try {
    await assert.rejects(run(db, 'migrate', base, () => {}), /selected MySQL 8\.4 database/);
    assert.deepEqual(calls, ['SELECT DATABASE() AS name, VERSION() AS version']);
  } finally {
    assert.ok(path.resolve(base).startsWith(path.resolve(tmpdir()) + path.sep));
    await rm(base, { recursive: true, force: true });
  }
});
