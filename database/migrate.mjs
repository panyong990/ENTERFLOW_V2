import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { run } from './migration-core.mjs';

let db;
try {
  const [command = 'status', ...args] = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--env-file')) throw new Error('Usage: node database/migrate.mjs status|baseline|migrate|seed [--env-file path]');
  try { process.loadEnvFile(args[1] ?? 'database/.env.migrations'); }
  catch (error) { if (args.length || error.code !== 'ENOENT') throw error; }
  const env = process.env;
  for (const key of ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_MIGRATION_USER', 'DB_MIGRATION_PASSWORD']) if (!env[key]) throw new Error(`Missing ${key}`);
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(env.DB_NAME) || ['mysql', 'sys', 'performance_schema', 'information_schema'].includes(env.DB_NAME)) throw new Error('Invalid application database name');
  if (env.DB_HOST !== '127.0.0.1' || !['3308', '3309'].includes(env.DB_PORT)) throw new Error('Local workflow accepts only 127.0.0.1:3308 (development) or :3309 (isolated tests)');
  if ((env.DB_PORT === '3308' && env.DB_NAME !== 'enterflow_db') || (env.DB_PORT === '3309' && !/^enterflow_workflow_/.test(env.DB_NAME))) throw new Error('Database name does not match the approved local development/test target');
  // TLS is always enabled. Local Docker can explicitly accept its self-signed
  // certificate; other environments must supply a trusted CA and a new plan.
  const ssl = env.DB_SSL_CA ? { ca: await readFile(env.DB_SSL_CA, 'utf8') } : { rejectUnauthorized: env.DB_SSL_LOCAL_SELF_SIGNED !== 'true' };
  db = await mysql.createConnection({ host: env.DB_HOST, port: Number(env.DB_PORT), database: env.DB_NAME, user: env.DB_MIGRATION_USER, password: env.DB_MIGRATION_PASSWORD, ssl, multipleStatements: false, supportBigNumbers: true, bigNumberStrings: true, timezone: 'Z', connectTimeout: 10000 });
  await run(db, command);
} catch (error) {
  // Never print driver error objects: they may contain SQL/connection details.
  console.error(`Migration error: ${error.code ?? error.message}`);
  process.exitCode = 1;
} finally { if (db) await db.end(); }
