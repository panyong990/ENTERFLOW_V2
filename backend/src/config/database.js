import mysql from 'mysql2/promise';
import { createDatabaseTlsOptions } from './database-tls.js';
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

export const pool = mysql.createPool({
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

export async function testDatabaseConnection() {
  const connection = await pool.getConnection();

  try {
    const [rows] = await connection.query(
      'SELECT DATABASE() AS databaseName, VERSION() AS serverVersion'
    );

    return rows[0];
  } finally {
    connection.release();
  }
}
