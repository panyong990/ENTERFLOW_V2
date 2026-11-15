// Test-only import hook: existing auth modules eagerly import the database
// singleton. Replace it before evaluation so focused tests need no credentials,
// CA files, sockets, or live database, and accidental real queries fail closed.
import { registerHooks } from 'node:module';

process.env.SESSION_IDLE_TIMEOUT_MINUTES = '30';
process.env.SESSION_ABSOLUTE_TIMEOUT_HOURS = '8';

const databaseUrl = new URL('../../src/config/database.js', import.meta.url).href;
registerHooks({
  load(url, context, nextLoad) {
    if (url !== databaseUrl) return nextLoad(url, context);
    return {
      format: 'module',
      shortCircuit: true,
      source: `
        const blocked = () => { throw new Error('Live database access is disabled in focused tests.'); };
        export const pool = { execute: blocked, query: blocked, getConnection: blocked };
        export const testDatabaseConnection = blocked;
      `
    };
  }
});
