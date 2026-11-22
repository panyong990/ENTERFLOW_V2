import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { phase2Password } from './migration-phase2-credentials.mjs';
import { connectPhase2, phase2CertificateName } from './migration-phase2-tls.mjs';
import { phase2History, validatePhase2Target } from './migration-phase2.mjs';

const env = Object.freeze(parseEnv(
  await readFile('database/.env.phase2.migrations.local', 'utf8')
));

validatePhase2Target(env);

const ssl = {
  ca: await readFile(env.DB_SSL_CA, 'utf8'),
  rejectUnauthorized: true,
  verifyIdentity: true
};

const config = {
  host: env.DB_HOST,
  port: Number(env.DB_PORT),
  database: env.DB_NAME,
  user: env.DB_MIGRATION_USER,
  password: await phase2Password(env),
  ssl,
  multipleStatements: false,
  supportBigNumbers: true,
  bigNumberStrings: true,
  timezone: 'Z',
  connectTimeout: 10000
};

let owner;
let observer;
let locked = false;

const expectedUuid = '0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8';
const tables = ['client_applications', 'user_account', phase2History];

try {
  owner = await connectPhase2(config, phase2CertificateName(env));
  observer = await connectPhase2(config, phase2CertificateName(env));

  const [[ownerIdentity]] = await owner.query(`
    SELECT DATABASE() AS db, VERSION() AS version,
           @@server_uuid AS uuid,
           CONNECTION_ID() AS connectionId
  `);

  const [[observerIdentity]] = await observer.query(`
    SELECT DATABASE() AS db, VERSION() AS version,
           @@server_uuid AS uuid,
           CONNECTION_ID() AS connectionId
  `);

  if (
    ownerIdentity.db !== 'enterflow_phase2_db' ||
    observerIdentity.db !== 'enterflow_phase2_db' ||
    ownerIdentity.version !== '8.4.13' ||
    observerIdentity.version !== '8.4.13' ||
    ownerIdentity.uuid !== expectedUuid ||
    observerIdentity.uuid !== expectedUuid ||
    String(ownerIdentity.connectionId) === String(observerIdentity.connectionId)
  ) {
    throw new Error('Owner/observer database identity verification failed');
  }

  const [[thread]] = await owner.query(`
    SELECT THREAD_ID AS threadId
    FROM performance_schema.threads
    WHERE PROCESSLIST_ID = ?
  `, [ownerIdentity.connectionId]);

  if (!thread) throw new Error('Owner Performance Schema thread not found');

  console.log('IDENTITIES', JSON.stringify({
    owner: ownerIdentity,
    observer: observerIdentity,
    ownerThreadId: thread.threadId
  }));

  await owner.query('SET autocommit=0');

  const lockSql = `LOCK TABLES
    client_applications WRITE,
    user_account WRITE,
    \`${phase2History}\` WRITE`;

  const [lockResult] = await owner.query(lockSql);
  locked = true;

  if (lockResult?.warningStatus) {
    throw new Error('LOCK TABLES returned a warning; diagnostic stopped');
  }

  // Capture every metadata-lock row owned by the activation connection.
  const [ownerRows] = await observer.execute(`
    SELECT
      l.OBJECT_TYPE,
      l.OBJECT_SCHEMA,
      l.OBJECT_NAME,
      l.LOCK_TYPE,
      l.LOCK_DURATION,
      l.LOCK_STATUS,
      l.OWNER_THREAD_ID,
      t.PROCESSLIST_ID,
      t.NAME AS THREAD_NAME
    FROM performance_schema.metadata_locks l
    LEFT JOIN performance_schema.threads t
      ON t.THREAD_ID = l.OWNER_THREAD_ID
    WHERE l.OWNER_THREAD_ID = ?
    ORDER BY l.OBJECT_SCHEMA, l.OBJECT_NAME, l.LOCK_TYPE
  `, [thread.threadId]);

  // Capture all sessions' lock rows for the three target tables.
  const [tableRows] = await observer.query(`
    SELECT
      l.OBJECT_TYPE,
      l.OBJECT_SCHEMA,
      l.OBJECT_NAME,
      l.LOCK_TYPE,
      l.LOCK_DURATION,
      l.LOCK_STATUS,
      l.OWNER_THREAD_ID,
      t.PROCESSLIST_ID,
      t.NAME AS THREAD_NAME
    FROM performance_schema.metadata_locks l
    LEFT JOIN performance_schema.threads t
      ON t.THREAD_ID = l.OWNER_THREAD_ID
    WHERE l.OBJECT_SCHEMA = ?
      AND l.OBJECT_TYPE = 'TABLE'
      AND l.OBJECT_NAME IN (?, ?, ?)
    ORDER BY l.OBJECT_NAME, l.OWNER_THREAD_ID, l.LOCK_TYPE
  `, ['enterflow_phase2_db', ...tables]);

  // Reproduce the production predicate exactly.
  const [[productionCount]] = await observer.execute(`
    SELECT COUNT(*) AS n
    FROM performance_schema.metadata_locks l
    JOIN performance_schema.threads t
      ON t.THREAD_ID = l.OWNER_THREAD_ID
    WHERE t.PROCESSLIST_ID = ?
      AND l.OBJECT_SCHEMA = DATABASE()
      AND l.OBJECT_TYPE = 'TABLE'
      AND l.OBJECT_NAME = 'client_applications'
      AND l.LOCK_STATUS = 'GRANTED'
      AND l.LOCK_TYPE = 'SHARED_NO_READ_WRITE'
      AND l.LOCK_DURATION = 'EXPLICIT'
  `, [ownerIdentity.connectionId]);

  // Repeat with an explicit schema to isolate DATABASE()/SCHEMA() behavior.
  const [[explicitSchemaCount]] = await observer.execute(`
    SELECT COUNT(*) AS n
    FROM performance_schema.metadata_locks l
    JOIN performance_schema.threads t
      ON t.THREAD_ID = l.OWNER_THREAD_ID
    WHERE t.PROCESSLIST_ID = ?
      AND l.OBJECT_SCHEMA = 'enterflow_phase2_db'
      AND l.OBJECT_TYPE = 'TABLE'
      AND l.OBJECT_NAME = 'client_applications'
      AND l.LOCK_STATUS = 'GRANTED'
      AND l.LOCK_TYPE = 'SHARED_NO_READ_WRITE'
      AND l.LOCK_DURATION = 'EXPLICIT'
  `, [ownerIdentity.connectionId]);

  console.log('LOCK_DIAGNOSTIC', JSON.stringify({
    database: 'enterflow_phase2_db',
    ownerConnectionId: ownerIdentity.connectionId,
    ownerThreadId: thread.threadId,
    productionCount: productionCount.n,
    explicitSchemaCount: explicitSchemaCount.n,
    ownerMetadataLocks: ownerRows,
    targetTableMetadataLocks: tableRows
  }, null, 2));

} catch (error) {
  console.error('DIAGNOSTIC_FAILED', JSON.stringify({
    code: error.code ?? null,
    message: error.message
  }));
  process.exitCode = 1;
} finally {
  if (locked && owner) {
    try {
      await owner.query('UNLOCK TABLES');
      await owner.query('SET autocommit=1');
    } catch {
      console.error('WARNING: Explicit unlock failed; closing owner connection');
    }
  }

  if (observer) await observer.end().catch(() => {});
  if (owner) await owner.end().catch(() => {});
}
