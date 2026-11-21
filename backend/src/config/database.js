import mysql from 'mysql2/promise';
import { createDatabaseTlsOptions } from './database-tls.js';
import { guardIntegrationPool, verifyIntegrationDatabaseIdentity } from './integration-database-identity.js';
import { loadDatabaseCa } from './database-ca.js';
import { loadRuntimeEnvironment, validateRuntimeConfig } from './runtime-config.js';

loadRuntimeEnvironment();
const runtime = validateRuntimeConfig(process.env);

// Load the verified public MySQL CA certificate. Relative paths are resolved
// from the repository root, not the process working directory.
const { ca } = loadDatabaseCa({ configuredPath: process.env.DB_SSL_CA_PATH });

const tlsOptions = createDatabaseTlsOptions({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  ca,
  expectedIdentity: process.env.DB_SSL_SERVER_NAME,
  production: process.env.NODE_ENV === 'production' || Boolean(process.env.K_SERVICE)
});

const rawPool = mysql.createPool({
  ...tlsOptions,
  database: runtime.database.name,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  waitForConnections: true,
  connectionLimit: runtime.database.poolMax,
  queueLimit: 0,

  timezone: runtime.database.timezone,

  supportBigNumbers: true,
  bigNumberStrings: true,
  decimalNumbers: false
});
export const pool = guardIntegrationPool(rawPool, runtime);

export async function testDatabaseConnection() {
  const connection = await pool.getConnection();

  try {
    if (runtime.integration) await connection.query("SET SESSION time_zone = '+00:00'");
    const [rows] = await connection.query(runtime.integration
      ? `SELECT DATABASE() AS databaseName, VERSION() AS serverVersion, @@server_uuid AS serverUuid,
          @@lower_case_table_names AS lowerCaseTableNames, @@SESSION.sql_mode AS sqlMode, @@SESSION.time_zone AS timeZone`
      : 'SELECT DATABASE() AS databaseName, VERSION() AS serverVersion');

    if (runtime.integration) {
      const row = rows[0];
      const stream = connection.connection.stream;
      const peer = stream.getPeerCertificate(true);
      verifyIntegrationDatabaseIdentity({ runtime, row, authorized: stream.authorized, certificateRaw: peer?.raw });
    }

    return rows[0];
  } finally {
    connection.release();
  }
}
