import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import { run } from './migration-core.mjs';
import { runPhase2, validatePhase2Target } from './migration-phase2.mjs';
import { connectPhase2, phase2CertificateName } from './migration-phase2-tls.mjs';
import { phase2Password } from './migration-phase2-credentials.mjs';
import { preflightPhase2,diagnosePhase2Lock } from './migration-phase2-preflight.mjs';

// Dependencies can be replaced by offline test doubles. No connection on import.
export async function main(argv = process.argv.slice(2), dependencies = {}) {
  let db;
  try {
  const [command = 'status', ...options] = argv;
  const phase2 = options[0] === '--profile' && options[1] === 'phase2';
  if ((command === 'resume-003' || command.endsWith('-part1')) && !phase2) throw new Error('Phase 2 scoped command requires the explicit Phase 2 profile');
  const args = phase2 ? options.slice(2) : options;
  if (phase2 && !['preflight','preflight-part1','diagnose-lock','status', 'migrate','resume-003','status-part1','migrate-part1'].includes(command)) throw new Error('Unknown Phase 2 command');
  // Phase 2 never falls back to the shared environment file.
  if (phase2 && (args.length !== 2 || args[0] !== '--env-file')) throw new Error('Phase 2 requires --profile phase2 --env-file <separately approved file>');
  if (args.length && (args.length !== 2 || args[0] !== '--env-file')) throw new Error('Usage: node database/migrate.mjs status|baseline|migrate|seed [--env-file path]');
  let env;
  if (phase2) {
    const parsed = await (dependencies.loadPhase2Env ?? (async file => parseEnv(await (dependencies.readFile ?? readFile)(file,'utf8'))))(args[1]);
    const ambient = dependencies.env ?? process.env;
    const keys = ['DB_HOST','DB_PORT','DB_NAME','DB_MIGRATION_USER','DB_MIGRATION_PASSWORD','DB_MIGRATION_PASSWORD_DPAPI_FILE','DB_SSL_CA','DB_SSL_LOCAL_SELF_SIGNED','DB_TLS_SERVER_NAME'];
    for (const key of keys) if (ambient[key] !== undefined && ambient[key] !== parsed[key]) throw new Error(`Phase 2 environment conflict: ${key}`);
    env = Object.freeze(Object.fromEntries(keys.map(key => [key,parsed[key]])));
  } else {
    try { (dependencies.loadEnvFile ?? process.loadEnvFile)(args[1] ?? 'database/.env.migrations'); }
    catch (error) { if (args.length || error.code !== 'ENOENT') throw error; }
    env = dependencies.env ?? process.env;
  }
  for (const key of ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_MIGRATION_USER', ...(phase2 ? [] : ['DB_MIGRATION_PASSWORD'])]) if (!env[key]) throw new Error(`Missing ${key}`);
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(env.DB_NAME) || ['mysql', 'sys', 'performance_schema', 'information_schema'].includes(env.DB_NAME)) throw new Error('Invalid application database name');
  if (phase2) {
    validatePhase2Target(env);
    if (!env.DB_SSL_CA || env.DB_SSL_LOCAL_SELF_SIGNED === 'true') throw new Error('Phase 2 requires an approved CA and verified TLS; self-signed bypass is forbidden');
  } else {
    if (env.DB_HOST !== '127.0.0.1' || !['3308', '3309'].includes(env.DB_PORT)) throw new Error('Local workflow accepts only 127.0.0.1:3308 (development) or :3309 (isolated tests)');
    if ((env.DB_PORT === '3308' && env.DB_NAME !== 'enterflow_db') || (env.DB_PORT === '3309' && !/^enterflow_workflow_/.test(env.DB_NAME))) throw new Error('Database name does not match the approved local development/test target');
  }
  // TLS is always enabled. Local Docker can explicitly accept its self-signed
  // certificate; other environments must supply a trusted CA and a new plan.
  const ssl = env.DB_SSL_CA ? { ca: await (dependencies.readFile ?? readFile)(env.DB_SSL_CA, 'utf8'), ...(phase2 ? { rejectUnauthorized: true, verifyIdentity:true } : {}) } : { rejectUnauthorized: env.DB_SSL_LOCAL_SELF_SIGNED !== 'true' };
  const password = phase2 ? await (dependencies.phase2Password ?? phase2Password)(env) : env.DB_MIGRATION_PASSWORD;
  const config = { host: env.DB_HOST, port: Number(env.DB_PORT), database: env.DB_NAME, user: env.DB_MIGRATION_USER, password, ssl, multipleStatements: false, supportBigNumbers: true, bigNumberStrings: true, timezone: 'Z', connectTimeout: 10000 };
  if (phase2) db = await (dependencies.connectPhase2 ?? connectPhase2)(config, phase2CertificateName(env));
  else {
    const mysql = dependencies.mysql ?? (await import('mysql2/promise')).default;
    db = await mysql.createConnection(config);
  }
  if (phase2 && command === 'diagnose-lock') await (dependencies.diagnosePhase2Lock ?? diagnosePhase2Lock)(db,env);
  else if (phase2 && ['preflight','preflight-part1'].includes(command)) {
    const result = await (dependencies.preflightPhase2 ?? preflightPhase2)(db,env,undefined,undefined,{part1:command==='preflight-part1'});
    if (result.result === 'FAIL') process.exitCode = 1;
  }
  else if (phase2) await (dependencies.runPhase2 ?? runPhase2)(db, command, env,undefined,undefined,{
    openLockObserver:() => (dependencies.connectPhase2 ?? connectPhase2)(config,phase2CertificateName(env)),
  });
  else await (dependencies.run ?? run)(db, command);
  } catch (error) {
  if (dependencies.rethrow) throw error;
  // Never print driver error objects: they may contain SQL/connection details.
  if (argv[0] === 'preflight' && argv[1] === '--profile' && argv[2] === 'phase2') console.error(JSON.stringify({
    result:'FAIL',target:'127.0.0.1:62286/enterflow_phase2_db',
    failedGate:error.phase2TlsFailure ? 'TLS identity' : 'Connection/preflight setup',
    reason:error.phase2TlsFailure ?? {code:error.code ?? error.message},
    databaseChecks:'UNVERIFIED if connection setup failed',activationAuthorized:false,
  },null,2));
  else console.error(`Migration error: ${error.code ?? error.message}`);
  process.exitCode = 1;
  } finally {
    if (db) try { await db.end(); }
    catch {
      // Do not let a close failure expose an unhandled driver error object.
      if (dependencies.rethrow) throw new Error('Migration connection close failed');
      console.error('Migration error: connection close failed');
      process.exitCode = 1;
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
