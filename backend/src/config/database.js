import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabaseTlsOptions } from './database-tls.js';

const envPath = fileURLToPath(
  new URL('../../../database/.env.dev', import.meta.url)
);

const defaultCaPath = fileURLToPath(
  new URL('../../certs/ca.pem', import.meta.url)
);

// Load existing database configuration.
const envResult = dotenv.config({ path: envPath });

// A container can supply the complete environment without a local dotenv file.
// Required variables below still fail closed; other file errors remain fatal.
if (envResult.error && envResult.error.code !== 'ENOENT') {
  throw new Error('Unable to load database/.env.dev');
}

// Validate required environment variables.
const requiredVariables = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'DB_POOL_MAX',
  'DB_TIMEZONE'
];

for (const variable of requiredVariables) {
  if (!process.env[variable]) {
    throw new Error(`Missing required environment variable: ${variable}`);
  }
}

// Resolve optional relative CA paths from the repository root, not the process cwd.
// dotenv has loaded above; existing process environment settings take precedence.
const caPath = process.env.DB_SSL_CA_PATH
  ? resolve(
    fileURLToPath(new URL('../../../', import.meta.url)),
    process.env.DB_SSL_CA_PATH
  )
  : defaultCaPath;

// Load the verified public MySQL CA certificate.
const ca = fs.readFileSync(caPath, 'utf8');

const tlsOptions = createDatabaseTlsOptions({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  ca,
  expectedIdentity: process.env.DB_SSL_SERVER_NAME,
  production: process.env.NODE_ENV === 'production' || Boolean(process.env.K_SERVICE)
});

export const pool = mysql.createPool({
  ...tlsOptions,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_MAX),
  queueLimit: 0,

  timezone: process.env.DB_TIMEZONE,

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
