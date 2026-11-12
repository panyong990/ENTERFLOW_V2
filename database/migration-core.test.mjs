import test from 'node:test';
import assert from 'node:assert/strict';
import { checksum, splitSql, filesAt } from './migration-core.mjs';

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
test('all reviewed migrations and seeds pass preflight in filename order', async () => {
  const files = await filesAt();
  assert.ok(files.length >= 5);
  for (const prefix of ['migrations/001_', 'migrations/002_', 'migrations/003_', 'migrations/004_', 'seeds/001_reference_data.sql']) {
    assert.ok(files.some(f => f.file.startsWith(prefix)), `Missing original file: ${prefix}`);
  }
  for (const kind of ['migrations','seeds']) {
    const names = files.filter(f => f.kind === kind).map(f => f.file);
    assert.deepEqual(names, [...names].sort());
  }
});
