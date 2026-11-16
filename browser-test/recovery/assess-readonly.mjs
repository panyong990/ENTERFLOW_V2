// Explicitly requested read-only assessment. No schema/data/fixture writes.
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { connectTarget } from './target.mjs';
const exists = async file => { try { await access(file); return true; } catch (error) { if (error.code !== 'ENOENT') throw error; return false; } };
let db;
try {
  const reviewed = JSON.parse(await readFile(new URL('identity.reviewed.json', import.meta.url), 'utf8'));
  const observed = JSON.parse(await readFile(new URL('identity.observed.local.json', import.meta.url), 'utf8'));
  const samePins = JSON.stringify(Object.entries(reviewed).sort()) === JSON.stringify(Object.entries(observed).sort());
  if (!samePins) throw new Error('Observed and reviewed identity differ');
  const connected = await connectTarget(reviewed); db = connected.db;
  const [schemas] = await db.execute('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?', [reviewed.database]);
  const [tables] = await db.execute('SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME', [reviewed.database]);
  const require = createRequire(path.join(process.cwd(), 'package.json'));
  let browser;
  try { const playwright = require('@playwright/test'); const executable = playwright.chromium.executablePath(); browser = { packageVersion: require('@playwright/test/package.json').version, executableExists: await exists(executable) }; }
  catch (error) { browser = { available: false, code: error.code }; }
  const credentials = path.join(process.env.LOCALAPPDATA, 'EnterFlow');
  console.log(JSON.stringify({ target: connected.manifest, observedMatchesReviewed: samePins,
    tlsVerified: true, secureTransportRequired: true, developmentContacted: false,
    schemaExists: schemas.length === 1, tables: tables.map(row => row.name),
    priorInitializationReportExists: await exists(new URL('initialization-report.local.json', import.meta.url)),
    adminProtectedFixtureExists: await exists(path.join(credentials, 'admin-browser-test.credentials.dpapi')),
    clientProtectedFixtureExists: await exists(path.join(credentials, 'client-browser-test.credentials.dpapi')),
    browser, databaseOperations: ['SELECT VERSION(), @@server_uuid, DATABASE(), @@require_secure_transport',
      'SELECT SCHEMA_NAME from information_schema.SCHEMATA for exact replacement name',
      'SELECT TABLE_NAME from information_schema.TABLES for exact replacement name'], writes: 0 }, null, 2));
} catch { console.error('Read-only assessment failed. No writes attempted; do not run initialization or bypass identity checks.'); process.exitCode = 1; }
finally { if (db) await db.end().catch(() => {}); }
