
import app from './app.js';
import { pool, testDatabaseConnection } from './config/database.js';
import { resolveServerBinding, validateRuntimeConfig } from './config/runtime-config.js';

const { host, port } = resolveServerBinding();
validateRuntimeConfig();

let server;

async function start() {
  await testDatabaseConnection();
  server = app.listen(port, host, () => {
    console.log(`Enter-Flow API running at http://${host}:${port}`);
  });
}

async function shutdown() {
  console.log('\nShutting down Enter-Flow API...');

  if (!server) {
    await pool.end();
    return;
  }
  server.close(async () => {
    try {
      await pool.end();
      console.log('Server and database connections closed.');
      process.exit(0);
    } catch (error) {
      console.error('Enter-Flow API shutdown failed.');
      process.exit(1);
    }
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch(async error => {
  console.error('Enter-Flow API startup failed.');
  await pool.end().catch(() => {});
  process.exitCode = 1;
});
