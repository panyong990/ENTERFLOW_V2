
// Catch module initialization failures too (for example CA file errors), whose
// native exceptions can contain configured paths or other infrastructure data.
try {
  const { default: app } = await import('./app.js');
  const { pool, testDatabaseConnection } = await import('./config/database.js');
  const { resolveServerBinding, validateRuntimeConfig } = await import('./config/runtime-config.js');
  const { createServerLifecycle } = await import('./server-lifecycle.js');

  const { host, port } = resolveServerBinding();
  validateRuntimeConfig();

  const lifecycle = createServerLifecycle({
    app, testDatabaseConnection, pool, host, port, logger: console, processAdapter: process
  });
  await lifecycle.run();
} catch (error) {
  console.error(JSON.stringify({
    event: 'server_initialization_failed',
    category: 'startup_configuration_error'
  }));
  process.exitCode = 1;
}
