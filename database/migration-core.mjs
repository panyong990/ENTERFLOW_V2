import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = fileURLToPath(new URL('.', import.meta.url));
export const history = '_enterflow_migration_history';
export const normalize = text => text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
export const checksum = text => createHash('sha256').update(normalize(text)).digest('hex');
const quote = name => '`' + name.replaceAll('`', '``') + '`';
const assert = (condition, message) => { if (!condition) throw new Error(message); };

// Deliberately limited to ordinary SQL; routines/DELIMITER and executable comments
// need a separately reviewed implementation. Strings, comments and quoted names
// can contain semicolons without splitting a statement.
export function splitSql(text) {
  const sql = normalize(text), result = [];
  let current = '', mode = '', delimiter = '';
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i], next = sql[i + 1];
    if (mode === 'line') { if (c === '\n') { mode = ''; current += ' '; } continue; }
    if (mode === 'block') { if (c === '*' && next === '/') { mode = ''; i++; current += ' '; } continue; }
    if (mode === 'quote') {
      current += c;
      if (c === '\\') { current += sql[++i] ?? ''; continue; }
      if (c === delimiter) {
        if (next === delimiter) current += sql[++i]; else mode = '';
      }
      continue;
    }
    if (c === '#' || (c === '-' && next === '-' && /\s/.test(sql[i + 2] ?? ' '))) { mode = 'line'; continue; }
    if (c === '/' && next === '*') {
      assert(!['!', '+'].includes(sql[i + 2]), 'Executable comments/hints are unsupported');
      mode = 'block'; i++; continue;
    }
    if (['\'', '"', '`'].includes(c)) { mode = 'quote'; delimiter = c; current += c; continue; }
    if (c === ';') { if (current.trim()) result.push(current.trim()); current = ''; }
    else current += c;
  }
  assert(!['quote', 'block'].includes(mode), 'Unterminated SQL string/comment');
  if (current.trim()) result.push(current.trim());
  for (const statement of result) {
    // Local schema DDL/DML only. No database switches, server/account commands,
    // dynamic SQL, routines, qualified targets or disabling integrity controls.
    const masked = statement.replace(/'(?:\\.|''|[^'\\])*'|"(?:\\.|""|[^"\\])*"/g, "''");
    assert(/^(?:(?:CREATE TABLE|ALTER TABLE|CREATE (?:UNIQUE )?INDEX|DROP INDEX|INSERT INTO|UPDATE|DELETE FROM|SET NAMES|SET time_zone)\b|START TRANSACTION$|COMMIT$|ROLLBACK$)/i.test(statement), 'Unsupported SQL statement; review before execution');
    assert(!/[A-Za-z_`][\w`]*\s*\.\s*[A-Za-z_`]/.test(masked), 'Qualified SQL identifiers are unsupported (target database only)');
    assert(!/\b(?:OUTFILE|DUMPFILE|LOAD_FILE|FOREIGN_KEY_CHECKS|UNIQUE_CHECKS|SQL_MODE|AUTOCOMMIT|PREPARE|EXECUTE|DELIMITER)\b/i.test(masked), 'Unsafe/unsupported SQL directive');
    assert(!new RegExp('`?' + history + '`?', 'i').test(masked), 'Migration cannot modify runner history');
  }
  return result;
}

export async function filesAt(base = root) {
  const files = [];
  for (const kind of ['migrations', 'seeds']) {
    const names = (await readdir(path.join(base, kind))).filter(x => x.endsWith('.sql')).sort();
    const numbers = new Set();
    for (const name of names) {
      assert(/^\d{3}_[a-z0-9_]+\.sql$/.test(name), `Invalid filename: ${name}`);
      assert(!numbers.has(name.slice(0, 3)), `Duplicate migration number: ${name}`);
      numbers.add(name.slice(0, 3));
      const text = await readFile(path.join(base, kind, name), 'utf8');
      files.push({ file: `${kind}/${name}`, kind, checksum: checksum(text), statements: splitSql(text) });
    }
  }
  return files;
}

const queries = {
  tables: "SELECT TABLE_NAME AS `table`,TABLE_TYPE AS type,ENGINE AS engine,TABLE_COLLATION AS collation FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME",
  columns: "SELECT TABLE_NAME AS `table`,COLUMN_NAME AS `column`,ORDINAL_POSITION AS position,COLUMN_TYPE AS type,IS_NULLABLE AS nullable,COLUMN_DEFAULT AS `default`,EXTRA AS extra,CHARACTER_SET_NAME AS charset,COLLATION_NAME AS collation FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,ORDINAL_POSITION",
  indexes: "SELECT TABLE_NAME AS `table`,INDEX_NAME AS `index`,1-NON_UNIQUE AS `unique`,SEQ_IN_INDEX AS position,COLUMN_NAME AS `column`,SUB_PART AS prefix,INDEX_TYPE AS type,COLLATION AS direction FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX",
  foreign_keys: "SELECT k.TABLE_NAME AS `table`,k.CONSTRAINT_NAME AS name,k.COLUMN_NAME AS `column`,k.ORDINAL_POSITION AS position,k.REFERENCED_TABLE_SCHEMA AS parent_schema,k.REFERENCED_TABLE_NAME AS parent,k.REFERENCED_COLUMN_NAME AS parent_column,r.UPDATE_RULE AS update_rule,r.DELETE_RULE AS delete_rule FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON k.CONSTRAINT_SCHEMA=r.CONSTRAINT_SCHEMA AND k.TABLE_NAME=r.TABLE_NAME AND k.CONSTRAINT_NAME=r.CONSTRAINT_NAME WHERE k.TABLE_SCHEMA=DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL ORDER BY k.TABLE_NAME,k.CONSTRAINT_NAME,k.ORDINAL_POSITION",
  checks: "SELECT t.TABLE_NAME AS `table`,c.CONSTRAINT_NAME AS name,c.CHECK_CLAUSE AS expression,t.ENFORCED AS enforced FROM information_schema.CHECK_CONSTRAINTS c JOIN information_schema.TABLE_CONSTRAINTS t ON c.CONSTRAINT_SCHEMA=t.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME=t.CONSTRAINT_NAME WHERE c.CONSTRAINT_SCHEMA=DATABASE() AND t.CONSTRAINT_TYPE='CHECK' ORDER BY t.TABLE_NAME,c.CONSTRAINT_NAME"
};
function canonical(rows) {
  return rows.filter(row => row.table !== history).map(row => {
    const out = {};
    for (const key of Object.keys(row).sort()) {
      if (key.startsWith('raw_')) continue;
      let value = row[key];
      if (key === 'parent_schema') value = '<current>';
      if (['update_rule', 'delete_rule'].includes(key) && value === 'NO ACTION') value = 'RESTRICT';
      if (key === 'expression') value = value.replaceAll("\\'", "'");
      out[key] = value;
    }
    return JSON.stringify(out);
  }).sort();
}

export async function verifyBaseline(db, files) {
  const manifest = JSON.parse(await readFile(path.join(root, 'baseline.v1.json'), 'utf8'));
  for (const entry of manifest.files) assert(files.find(f => f.file === entry.file)?.checksum === entry.checksum, `Reviewed baseline file changed: ${entry.file}`);
  for (const [name, sql] of Object.entries(queries)) {
    const [actual] = await db.query(sql);
    if (name === 'foreign_keys') {
      const [[identity]] = await db.query('SELECT DATABASE() AS name');
      assert(actual.every(r => r.parent_schema === identity.name), 'Cross-database foreign key; baseline refused');
    }
    assert(JSON.stringify(canonical(actual)) === JSON.stringify(canonical(manifest.metadata[name])), `Baseline schema mismatch: ${name}. No baseline recorded.`);
  }
  for (const catalog of ['TRIGGERS', 'ROUTINES', 'EVENTS']) {
    const scope = catalog === 'TRIGGERS' ? 'TRIGGER_SCHEMA' : catalog === 'ROUTINES' ? 'ROUTINE_SCHEMA' : 'EVENT_SCHEMA';
    const [[row]] = await db.query(`SELECT COUNT(*) AS n FROM information_schema.${catalog} WHERE ${scope}=DATABASE()`);
    assert(Number(row.n) === 0, `Unexpected ${catalog}; baseline refused`);
  }
  const [ledger] = await db.query('SELECT version FROM schema_migrations ORDER BY version');
  const versions = ledger.map(r => r.version);
  const expected = manifest.files.filter(f => f.file.startsWith('migrations/')).map(f => path.basename(f.file, '.sql'));
  const seeded = versions.includes('seed_001_reference_data');
  assert(JSON.stringify(versions) === JSON.stringify([...expected, ...(seeded ? ['seed_001_reference_data'] : [])].sort()), 'Legacy migration markers missing/unexpected');
  for (const [table, rows] of Object.entries(manifest.seeds)) {
    if (table === 'schema_migrations') continue;
    if (!seeded) {
      const [[row]] = await db.query(`SELECT COUNT(*) AS n FROM ${quote(table)}`);
      assert(Number(row.n) === 0, `Unmarked/partial seed data in ${table}; manual review required`);
    } else {
      for (const row of rows) {
        const columns = Object.keys(row);
        const [[found]] = await db.execute(`SELECT COUNT(*) AS n FROM ${quote(table)} WHERE ${columns.map(k => typeof row[k] === 'string' ? `CAST(${quote(k)} AS BINARY) <=> CAST(? AS BINARY)` : `${quote(k)} <=> ?`).join(' AND ')}`, Object.values(row));
        assert(Number(found.n) === 1, `Required seed differs: ${table}; no baseline recorded`);
      }
    }
  }
  return manifest.files.filter(f => seeded || f.file.startsWith('migrations/')).map(e => files.find(f => f.file === e.file));
}

async function ensureHistory(db) {
  await db.query(`CREATE TABLE ${quote(history)} (file VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY, checksum CHAR(64) CHARACTER SET ascii NOT NULL, state ENUM('applying','applied','failed') NOT NULL, method ENUM('execute','baseline') NOT NULL, started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), applied_at DATETIME(3) NULL, error_code VARCHAR(80) NULL) ENGINE=InnoDB`);
}

export async function run(db, command, base = root, log = console.log) {
  assert(['status', 'migrate', 'seed', 'baseline'].includes(command), 'Command must be status, migrate, seed or baseline');
  const files = await filesAt(base);
  const [[identity]] = await db.query('SELECT DATABASE() AS name, VERSION() AS version');
  assert(identity.name && /^8\.4\./.test(identity.version), 'Runner requires a selected MySQL 8.4 database');
  const lockName = 'enterflow:' + createHash('sha256').update(identity.name).digest('hex').slice(0, 50);
  const [[lock]] = await db.execute('SELECT GET_LOCK(?,0) AS acquired', [lockName]);
  assert(Number(lock.acquired) === 1, 'Another migration process holds the database lock');
  try {
    await db.query("SET time_zone='+00:00'");
    await db.query("SET SESSION sql_mode='STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");
    const [tables] = await db.query('SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
    let exists = tables.some(t => t.name === history);
    const [applied] = exists ? await db.query(`SELECT * FROM ${quote(history)} ORDER BY file`) : [[]];
    const byName = new Map(files.map(f => [f.file, f]));
    for (const row of applied) {
      assert(byName.get(row.file)?.checksum === row.checksum, `Applied file missing/modified: ${row.file}`);
      assert(row.state === 'applied', `Blocked by ${row.state} migration: ${row.file}. Partial DDL may exist; manual recovery required.`);
    }
    const done = new Set(applied.map(r => r.file));
    if (exists && applied.length === 0 && tables.some(t => t.name !== history) && command !== 'baseline' && command !== 'status') {
      throw new Error('Untracked existing schema requires db:baseline; migrations will not be replayed');
    }
    for (const kind of ['migrations', 'seeds']) {
      let gap = false;
      for (const file of files.filter(f => f.kind === kind)) {
        if (!done.has(file.file)) gap = true;
        else assert(!gap, `Out-of-order history: ${file.file}`);
      }
    }
    log(`Target ${identity.name} / MySQL ${identity.version}`);
    if (command === 'status') {
      if (!exists && tables.length) log('BASELINE REQUIRED: existing schema has no checksum history');
      for (const f of files) log(`${done.has(f.file) ? 'APPLIED' : 'PENDING'} ${f.file}`);
      return;
    }
    if (command === 'baseline') {
      assert(applied.length === 0, 'History already populated; use status/migrate, not baseline');
      const baselineFiles = await verifyBaseline(db, files); // all reads before creating history
      if (!exists) await ensureHistory(db);
      await db.beginTransaction();
      try {
        for (const f of baselineFiles) await db.execute(`INSERT INTO ${quote(history)} (file,checksum,state,method,applied_at) VALUES (?,?,'applied','baseline',UTC_TIMESTAMP(3))`, [f.file, f.checksum]);
        await db.commit();
      } catch (e) { await db.rollback(); throw e; }
      log(`Verified 70-table baseline; recorded ${baselineFiles.length} files without replaying SQL.`);
      return;
    }
    assert(exists || tables.length === 0, 'Existing schema requires db:baseline; original migrations will not be replayed');
    if (!exists) { await ensureHistory(db); exists = true; }
    if (command === 'seed') assert(files.filter(f => f.kind === 'migrations').every(f => done.has(f.file)), 'Run all migrations before seeds');
    for (const file of files.filter(f => f.kind === (command === 'seed' ? 'seeds' : 'migrations') && !done.has(f.file))) {
      await db.execute(`INSERT INTO ${quote(history)} (file,checksum,state,method) VALUES (?,?,'applying','execute')`, [file.file, file.checksum]);
      let statement = 0;
      try {
        for (const sql of file.statements) {
          statement++;
          const [result] = await db.query(sql);
          if (result?.warningStatus) throw Object.assign(new Error('SQL warning'), { code: 'SQL_WARNING' });
        }
        // Commit before marking completion, even for files with explicit transactions.
        await db.commit();
        await db.execute(`UPDATE ${quote(history)} SET state='applied',applied_at=UTC_TIMESTAMP(3) WHERE file=?`, [file.file]);
        log(`APPLIED ${file.file}`);
      } catch (error) {
        await db.rollback().catch(() => {});
        await db.execute(`UPDATE ${quote(history)} SET state='failed',error_code=? WHERE file=?`, [String(error.code ?? 'RUNNER_ERROR').slice(0, 80), file.file]).catch(() => {});
        throw new Error(`Stopped at ${file.file}, statement ${statement}: ${error.code ?? 'SQL_WARNING/runner error'}. No automatic retry; inspect partial state.`);
      }
    }
    log('Up to date.');
  } finally { await db.execute('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => {}); }
}
