export function createServerLifecycle({ app, testDatabaseConnection, pool, host, port, logger, processAdapter }) {
  let server;
  let startup;
  let completion;
  let stopping = false;
  let cancelListening;
  let registered = false;
  let listenFailed = false;

  function finish(kind) {
    if (completion) return completion;
    stopping = true;
    cancelListening?.();
    const hadServer = Boolean(server);
    // Defer work until the shared promise is assigned, including with synchronous fakes.
    completion = Promise.resolve().then(async () => {
      let failed = kind === 'startup';
      if (failed) logger.error('Enter-Flow API startup failed.');
      else logger.log('\nShutting down Enter-Flow API...');

      if (kind === 'shutdown' && server) {
        try {
          await new Promise((resolve, reject) => {
            server.close(error => error ? reject() : resolve());
          });
        } catch {
          failed = true;
        }
      }
      try {
        await pool.end();
      } catch {
        failed = true;
        if (kind === 'startup') logger.error('Enter-Flow API startup cleanup failed.');
      }

      failed ||= listenFailed;
      if (kind === 'startup') {
        processAdapter.exitCode = 1;
      } else {
        if (failed) logger.error('Enter-Flow API shutdown failed.');
        else if (hadServer) logger.log('Server and database connections closed.');
        if (hadServer) processAdapter.exit(failed ? 1 : 0);
        else if (failed) processAdapter.exitCode = 1;
      }
    });
    return completion;
  }

  function start() {
    if (startup) return startup;
    if (stopping) return completion;
    startup = (async () => {
      try {
        await testDatabaseConnection();
        if (stopping) return;
        await new Promise((resolve, reject) => {
          let settled = false;
          const onError = () => {
            listenFailed = true;
            if (settled) return;
            settled = true;
            reject();
          };
          cancelListening = () => {
            if (settled) return;
            settled = true;
            resolve();
          };
          server = app.listen(port, host, error => {
            if (error) {
              onError();
              return;
            }
            if (settled || stopping) return;
            settled = true;
            server.removeListener('error', onError);
            logger.log(`Enter-Flow API running at http://${host}:${port}`);
            resolve();
          });
          server.once('error', onError);
        });
      } catch {
        await finish('startup');
      }
    })();
    return startup;
  }

  function shutdown() {
    return finish('shutdown');
  }

  function run() {
    if (!registered) {
      processAdapter.on('SIGINT', shutdown);
      processAdapter.on('SIGTERM', shutdown);
      registered = true;
    }
    return start();
  }

  return { start, shutdown, run };
}
