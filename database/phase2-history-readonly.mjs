import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { phase2Password } from './migration-phase2-credentials.mjs';
import { connectPhase2, phase2CertificateName } from './migration-phase2-tls.mjs';
import { phase2History, validatePhase2Target } from './migration-phase2.mjs';

const env = Object.freeze(parseEnv(await readFile('database/.env.phase2.migrations.local', 'utf8')));
validatePhase2Target(env);

const config = {
  host: env.DB_HOST,
  port: Number(env.DB_PORT),
  database: env.DB_NAME,
  user: env.DB_MIGRATION_USER,
  password: await phase2Password(env),
  ssl: {
    ca: await readFile(env.DB_SSL_CA, 'utf8'),
    rejectUnauthorized: true,
    verifyIdentity: true
  },
  supportBigNumbers: true,
  bigNumberStrings: true,
  timezone: 'Z',
  connectTimeout: 10000
};

const db = await connectPhase2(config, phase2CertificateName(env));
try {
  const [[identity]] = await db.query(
    'SELECT DATABASE() AS db, @@server_uuid AS uuid'
  );
  if (identity.db !== 'enterflow_phase2_db' ||
      identity.uuid !== '0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8') {
    throw new Error('Wrong database identity; stopped.');
  }

  const [rows] = await db.query(`
    SELECT file, checksum, state, error_code,
           DATE_FORMAT(started_at, '%Y-%m-%d %H:%i:%s.%f') AS started_at,
           DATE_FORMAT(applied_at, '%Y-%m-%d %H:%i:%s.%f') AS applied_at
    FROM \`${phase2History}\`
    ORDER BY file
  `);
  console.log(JSON.stringify({ identity, history: rows }, null, 2));
} finally {
  await db.end();
}
