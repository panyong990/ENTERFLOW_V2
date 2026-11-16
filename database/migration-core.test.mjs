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
test('discovery defers version 7 onward before reading their SQL and preserves active ordering', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'enterflow-migration-discovery-'));
  try {
    await mkdir(path.join(base, 'migrations'));
    await mkdir(path.join(base, 'seeds'));
    await writeFile(path.join(base, 'migrations', '001_initial.sql'), 'CREATE TABLE first_table (id INT);');
    await writeFile(path.join(base, 'migrations', '006_latest_active.sql'), 'CREATE TABLE active_table (id INT);');
    await mkdir(path.join(base, 'migrations', '007_deferred_fixture.sql'));
    await mkdir(path.join(base, 'migrations', '008_future_fixture.sql'));
    await writeFile(path.join(base, 'seeds', '001_reference_data.sql'), 'INSERT INTO reference_data VALUES (1);');

    const { files: activeFiles, deferredFiles } = await discoverFilesAt(base);
    assert.deepEqual(activeFiles.map(file => file.file), [
      'migrations/001_initial.sql',
      'migrations/006_latest_active.sql',
      'seeds/001_reference_data.sql',
    ]);
    const activeFilesFromWrapper = await filesAt(base);
    assert.deepEqual(activeFilesFromWrapper.map(file => file.file), activeFiles.map(file => file.file));
    assert.deepEqual(deferredFiles, [
      'migrations/007_deferred_fixture.sql',
      'migrations/008_future_fixture.sql',
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
    assert.ok(calls.includes('CREATE TABLE first_table (id INT)'));
    assert.ok(calls.includes('CREATE TABLE active_table (id INT)'));
    assert.ok(!calls.some(sql => sql.includes('deferred fixture') || sql.includes('future fixture')));
    assert.ok(messages.includes('DEFERRED migrations/007_deferred_fixture.sql'));
    assert.ok(messages.includes('DEFERRED migrations/008_future_fixture.sql'));

    calls.length = 0;
    for (const command of ['baseline', 'seed']) {
      await assert.rejects(run(db, command, base, () => {}), /deferred migrations exist/);
    }
    assert.equal(calls.length, 0);
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

test('rejects applied history whose checksum differs from the active fixture', async () => {
  const contents = 'CREATE TABLE active_fixture (id INT);';
  const base = await createFixture({ 'migrations/001_active_fixture.sql': contents });
  const { db, calls } = existingHistoryDb([{
    file: 'migrations/001_active_fixture.sql',
    checksum: checksum('CREATE TABLE old_fixture (id INT);'),
    state: 'applied',
  }]);
  try {
    await assert.rejects(run(db, 'migrate', base, () => {}), /Applied file missing\/modified: migrations\/001_active_fixture\.sql/);
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
    await assert.rejects(run(db, 'migrate', base, () => {}), /Applied file missing\/modified: migrations\/002_missing_fixture\.sql/);
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
