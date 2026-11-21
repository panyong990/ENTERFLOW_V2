import { createHash, timingSafeEqual } from 'node:crypto';

export function verifyIntegrationDatabaseIdentity({ runtime, row, authorized, certificateRaw }) {
  if (!runtime?.integration) return true;
  const actual = Buffer.isBuffer(certificateRaw) ? createHash('sha256').update(certificateRaw).digest() : Buffer.alloc(32);
  const expected = Buffer.from(runtime.integration.certificateSha256, 'hex');
  if (!authorized || !timingSafeEqual(actual, expected) || row?.databaseName !== runtime.database.name ||
      row?.serverVersion !== '8.4.13' || String(row?.serverUuid).toLowerCase() !== runtime.integration.serverUuid ||
      Number(row?.lowerCaseTableNames) !== 0 || !['+00:00', 'UTC'].includes(String(row?.timeZone)) ||
      String(row?.sqlMode).split(',').filter(Boolean).sort().join('|') !== [...runtime.integration.sqlMode].sort().join('|')) {
    throw new Error('Integration database identity verification failed.');
  }
  return true;
}

export function guardIntegrationPool(raw, runtime, verify = async connection => {
  await connection.query("SET SESSION time_zone = '+00:00'");
  const [[row]] = await connection.query(`SELECT DATABASE() databaseName, VERSION() serverVersion,
    @@server_uuid serverUuid, @@lower_case_table_names lowerCaseTableNames,
    @@SESSION.sql_mode sqlMode, @@SESSION.time_zone timeZone`);
  const stream = connection.connection.stream;
  verifyIntegrationDatabaseIdentity({ runtime, row, authorized: stream.authorized,
    certificateRaw: stream.getPeerCertificate(true)?.raw });
}) {
  if (!runtime.integration) return raw;
  const getConnection = async () => {
    const connection = await raw.getConnection();
    try { await verify(connection); return connection; }
    catch (error) { connection.destroy(); throw error; }
  };
  const execute = method => async (...args) => {
    const connection = await getConnection();
    try { return await connection[method](...args); } finally { connection.release(); }
  };
  return Object.freeze({ getConnection, execute: execute('execute'), query: execute('query'), end: () => raw.end() });
}

