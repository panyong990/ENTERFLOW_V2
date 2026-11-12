import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const envPath = fileURLToPath(
  new URL('../../../database/.env.dev', import.meta.url)
);

const caPath = fileURLToPath(
  new URL('../../certs/ca.pem', import.meta.url)
);

// Load existing database configuration.
const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
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

// Load the verified public MySQL CA certificate.
const ca = fs.readFileSync(caPath, 'utf8');

// MySQL's generated server certificate has no SAN.
// Its Common Name is used as the TLS server identity.
const tlsServerName =
  'MySQL_Server_8.4.13_Auto_Generated_Server_Certificate';

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_MAX),
  queueLimit: 0,

  timezone: process.env.DB_TIMEZONE,

  supportBigNumbers: true,
  bigNumberStrings: true,
  decimalNumbers: false,

  ssl: {
    ca,
    rejectUnauthorized: true,
    servername: tlsServerName
  }
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
