import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createServerLifecycle } from './server-lifecycle.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function sensitiveError() {
  return Object.assign(new Error('SYNTHETIC_PRIVATE_MESSAGE'), {
    stack: 'SYNTHETIC_PRIVATE_STACK', code: 'SYNTHETIC_PRIVATE_CODE',
    sqlState: 'SYNTHETIC_PRIVATE_SQL', details: { password: 'SYNTHETIC_PRIVATE_CREDENTIAL' }
  });
}
function fixture({ probe = async () => {}, end = async () => {}, listenError, closeError, expressCallback = true } = {}) {
  const calls = [], logs = [], exits = [], decisions = [], callbacks = [], registrations = [];
  const listening = deferred(), cleaning = deferred();
  const server = new EventEmitter();
  server.close = callback => {
    calls.push('close');
    if (closeError) throw closeError;
    callbacks.push(callback);
  };
  let exitCode;
  const processAdapter = {
    handlers: new Map(),
    on(signal, handler) { registrations.push(signal); this.handlers.set(signal, handler); },
    exit(code) { exits.push(code); decisions.push(code); },
    get exitCode() { return exitCode; },
    set exitCode(code) { exitCode = code; decisions.push(code); }
  };
  let onListening;
  const lifecycle = createServerLifecycle({
    app: { listen(port, host, callback) {
      calls.push(['listen', port, host]);
      if (listenError) throw listenError;
      if (expressCallback) {
        // Express 5.3.0 registers its once-wrapped callback before returning
        // the server, so it receives an error before the lifecycle listener.
        let called = false;
        onListening = (...args) => {
          if (called) return;
          called = true;
          callback(...args);
        };
        server.once('error', onListening);
      } else {
        onListening = callback;
      }
      listening.resolve();
      return server;
    } },
    testDatabaseConnection: () => { calls.push('probe'); return probe(); },
    pool: { end() { calls.push('end'); cleaning.resolve(); return end(); } },
    host: 'synthetic-host', port: 4321,
    logger: { log: (...args) => logs.push(['log', ...args]), error: (...args) => logs.push(['error', ...args]) },
    processAdapter
  });
  return { lifecycle, calls, logs, exits, decisions, callbacks, registrations, server, processAdapter,
    listening: listening.promise, cleaning: cleaning.promise, ready: error => onListening(error) };
}
function safe(h) { assert.doesNotMatch(JSON.stringify(h.logs), /SYNTHETIC_PRIVATE/); }
async function running(h) {
  const started = h.lifecycle.run();
  await h.listening;
  h.ready();
  await started;
}

test('normal startup preserves probe, binding, signal ordering and logs only after listening', async () => {
  const probe = deferred();
  const h = fixture({ probe: () => probe.promise });
  let settled = false;
  const started = h.lifecycle.run().then(() => { settled = true; });
  assert.deepEqual(h.calls, ['probe']);
  assert.deepEqual(h.registrations, ['SIGINT', 'SIGTERM']);
  probe.resolve();
  await h.listening;
  assert.equal(settled, false);
  assert.deepEqual(h.logs, []);
  h.ready();
  await started;
  assert.deepEqual(h.calls, ['probe', ['listen', 4321, 'synthetic-host']]);
  assert.deepEqual(h.logs, [['log', 'Enter-Flow API running at http://synthetic-host:4321']]);
  assert.equal(h.server.listenerCount('error'), 1); // Express retains its once wrapper.
});

for (const failure of ['database', 'synchronous listen', 'asynchronous listen']) {
  test(`${failure} failure safely logs, waits for cleanup and decides failure once`, async () => {
    const cleanup = deferred();
    const error = sensitiveError();
    const h = fixture({ end: () => cleanup.promise,
      ...(failure === 'database' ? { probe: async () => { throw error; } } : {}),
      ...(failure === 'synchronous listen' ? { listenError: error } : {}),
      ...(failure === 'asynchronous listen' ? { expressCallback: false } : {}) });
    const started = h.lifecycle.run();
    if (failure === 'asynchronous listen') {
      await h.listening;
      assert.equal(h.server.listenerCount('error'), 1);
      h.server.emit('error', error);
      h.ready(); // Late callback must not announce successful startup.
    }
    await h.cleaning;
    assert.deepEqual(h.decisions, []);
    const stopping = h.lifecycle.shutdown();
    cleanup.resolve();
    await Promise.all([started, stopping]);
    assert.deepEqual(h.decisions, [1]);
    assert.deepEqual(h.exits, []);
    assert.equal(h.calls.filter(call => call === 'end').length, 1);
    assert.deepEqual(h.logs, [['error', 'Enter-Flow API startup failed.']]);
    safe(h);
  });
}

for (const delivery of ['callback', 'Express error event']) {
  test(`listen failure through ${delivery} cleans up once without success or sensitive logs`, async () => {
    const cleanup = deferred();
    const h = fixture({ end: () => cleanup.promise });
    const started = h.lifecycle.run();
    await h.listening;
    assert.equal(h.server.listenerCount('error'), 2);
    const error = sensitiveError();
    if (delivery === 'callback') {
      h.ready(error);
      // The separate error listener must not cause a second failure decision.
      h.server.emit('error', error);
    } else {
      h.server.emit('error', error);
    }
    h.ready();
    await h.cleaning;
    assert.deepEqual(h.decisions, []);
    const stopped = h.lifecycle.shutdown();
    cleanup.resolve();
    await Promise.all([started, stopped]);
    assert.deepEqual(h.calls, ['probe', ['listen', 4321, 'synthetic-host'], 'end']);
    assert.deepEqual(h.decisions, [1]);
    assert.deepEqual(h.exits, []);
    assert.deepEqual(h.logs, [['error', 'Enter-Flow API startup failed.']]);
    safe(h);
  });
}

for (const mode of ['throw', 'reject']) {
  test(`startup cleanup ${mode} is contained and logs no diagnostics`, async () => {
    const h = fixture({ probe: async () => { throw sensitiveError(); },
      end: () => { if (mode === 'throw') throw sensitiveError(); return Promise.reject(sensitiveError()); } });
    await h.lifecycle.run();
    assert.deepEqual(h.decisions, [1]);
    assert.deepEqual(h.logs, [['error', 'Enter-Flow API startup failed.'], ['error', 'Enter-Flow API startup cleanup failed.']]);
    safe(h);
  });
}

test('normal shutdown waits for HTTP close then pool closure before one successful exit', async () => {
  const cleanup = deferred();
  const h = fixture({ end: () => cleanup.promise });
  await running(h);
  let complete = false;
  const stopped = h.lifecycle.shutdown();
  stopped.then(() => { complete = true; });
  await Promise.resolve();
  assert.equal(h.calls.at(-1), 'close');
  assert.deepEqual(h.decisions, []);
  h.callbacks[0]();
  await h.cleaning;
  assert.equal(complete, false);
  cleanup.resolve();
  await stopped;
  assert.deepEqual(h.calls, ['probe', ['listen', 4321, 'synthetic-host'], 'close', 'end']);
  assert.deepEqual(h.exits, [0]);
  assert.equal(h.logs.at(-1)[1], 'Server and database connections closed.');
});

for (const failure of ['close callback', 'close throw', 'pool throw', 'pool reject', 'close and pool']) {
  test(`running shutdown handles ${failure}, attempts cleanup and exits unsuccessfully once`, async () => {
    const h = fixture({ closeError: failure === 'close throw' ? sensitiveError() : undefined,
      end: () => {
        if (failure === 'pool throw') throw sensitiveError();
        if (['pool reject', 'close and pool'].includes(failure)) return Promise.reject(sensitiveError());
      } });
    await running(h);
    const stopped = h.lifecycle.shutdown();
    await Promise.resolve();
    if (failure !== 'close throw') h.callbacks[0](['close callback', 'close and pool'].includes(failure) ? sensitiveError() : undefined);
    await stopped;
    assert.equal(h.calls.filter(call => call === 'end').length, 1);
    assert.deepEqual(h.decisions, [1]);
    assert.deepEqual(h.exits, [1]);
    assert.equal(h.logs.at(-1)[1], 'Enter-Flow API shutdown failed.');
    safe(h);
  });
}

for (const mode of ['success', 'throw', 'reject']) {
  test(`shutdown before server exists handles pool ${mode} without explicit process exit`, async () => {
    const cleanup = deferred();
    const h = fixture({ end: () => {
      if (mode === 'throw') throw sensitiveError();
      return cleanup.promise;
    } });
    const stopped = h.lifecycle.shutdown();
    await h.cleaning;
    if (mode !== 'throw') assert.deepEqual(h.decisions, []);
    if (mode === 'reject') cleanup.reject(sensitiveError());
    else cleanup.resolve();
    await stopped;
    assert.deepEqual(h.calls, ['end']);
    assert.deepEqual(h.decisions, mode === 'success' ? [] : [1]);
    assert.deepEqual(h.exits, []);
    if (mode !== 'success') assert.equal(h.logs.at(-1)[1], 'Enter-Flow API shutdown failed.');
    await h.lifecycle.start();
    assert.deepEqual(h.calls, ['end']);
    safe(h);
  });
}

test('repeated signals share completion, close once and decide exit once', async () => {
  const h = fixture();
  await running(h);
  const first = h.processAdapter.handlers.get('SIGINT')();
  const second = h.processAdapter.handlers.get('SIGTERM')();
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(h.callbacks.length, 1);
  h.callbacks[0]();
  h.callbacks[0](sensitiveError()); // Duplicate callbacks cannot duplicate cleanup.
  await Promise.all([first, second]);
  assert.equal(h.calls.filter(call => call === 'end').length, 1);
  assert.deepEqual(h.decisions, [0]);
  safe(h);
});

for (const outcome of ['resolve', 'reject']) {
  test(`shutdown during database probe prevents later startup after probe ${outcome}`, async () => {
    const probe = deferred();
    const h = fixture({ probe: () => probe.promise });
    const started = h.lifecycle.run();
    await h.processAdapter.handlers.get('SIGTERM')();
    if (outcome === 'resolve') probe.resolve(); else probe.reject(sensitiveError());
    await started;
    assert.deepEqual(h.calls, ['probe', 'end']);
    assert.deepEqual(h.decisions, []);
    safe(h);
  });
}

test('shutdown while waiting for listen suppresses late success and safely fails on startup error', async () => {
  const h = fixture();
  const started = h.lifecycle.run();
  await h.listening;
  const stopped = h.lifecycle.shutdown();
  await Promise.resolve();
  h.ready();
  h.server.emit('error', sensitiveError());
  h.callbacks[0]();
  await Promise.all([started, stopped]);
  assert.equal(h.logs.some(entry => entry[1].includes('API running at')), false);
  assert.deepEqual(h.decisions, [1]);
  assert.equal(h.calls.filter(call => call === 'end').length, 1);
  safe(h);
});

test('synchronous database probe throw is safely contained without listening', async () => {
  const h = fixture({ probe: () => { throw sensitiveError(); } });
  await h.lifecycle.run();
  assert.deepEqual(h.calls, ['probe', 'end']);
  assert.deepEqual(h.decisions, [1]);
  safe(h);
});

test('shutdown during pending listen waits for close and pool cleanup without logging success', async () => {
  const h = fixture();
  const started = h.lifecycle.run();
  await h.listening;
  const stopped = h.processAdapter.handlers.get('SIGINT')();
  await Promise.resolve();
  h.ready();
  h.callbacks[0]();
  await Promise.all([started, stopped]);
  assert.equal(h.logs.some(entry => entry[1].includes('API running at')), false);
  assert.deepEqual(h.decisions, [0]);
  assert.deepEqual(h.calls, ['probe', ['listen', 4321, 'synthetic-host'], 'close', 'end']);
});

test('repeated run calls share startup and register signals once', async () => {
  const h = fixture();
  const first = h.lifecycle.run();
  const second = h.lifecycle.run();
  assert.equal(first, second);
  await h.listening;
  h.ready();
  await first;
  assert.deepEqual(h.registrations, ['SIGINT', 'SIGTERM']);
  assert.equal(h.calls.filter(call => call === 'probe').length, 1);
});
