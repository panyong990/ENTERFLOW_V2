import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { fetchWithTimeout, installInterruptionHandlers, stopChildBounded, validateScenarioInputs, waitForChildReady } from './integration-run-lifecycle.mjs';
import { createOwnershipJournal, readOwnershipJournal } from '../fixtures/inventory-auth.fixture.mjs';

function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.exitCode = null;
  child.signalCode = null;
  child.kills = [];
  child.kill = signal => { child.kills.push(signal); return true; };
  return child;
}

test('scenario preflight rejects invalid ports, paths, and child environment', () => {
  const valid = { apiPort: 43123, journalPath: 'journal.json', caPath: 'ca.pem', apiEntry: 'server.js',
    apiEnvironment: { PORT: '43123', HOST: '127.0.0.1', INTEGRATION_TEST_RUNTIME: '1' } };
  assert.equal(validateScenarioInputs(valid), true);
  assert.throws(() => validateScenarioInputs({ ...valid, apiPort: 3306 }), /port/);
  assert.throws(() => validateScenarioInputs({ ...valid, apiEntry: '' }), /apiEntry/);
  assert.throws(() => validateScenarioInputs({ ...valid, apiEnvironment: { ...valid.apiEnvironment, HOST: '0.0.0.0' } }), /child configuration/);
});

test('readiness fails explicitly on child spawn errors, early exit, and timeout', async () => {
  const spawnError = fakeChild();
  const spawnRejected = waitForChildReady(spawnError, { timeoutMs: 40 });
  spawnError.emit('error', new Error('spawn failed'));
  await assert.rejects(spawnRejected, /failed to spawn/);

  const earlyExit = fakeChild();
  const exitRejected = waitForChildReady(earlyExit, { timeoutMs: 40 });
  earlyExit.emit('exit', 1, null);
  await assert.rejects(exitRejected, /exited before readiness/);

  await assert.rejects(waitForChildReady(fakeChild(), { timeoutMs: 5 }), /timed out/);
});

test('readiness succeeds on marker and bounded shutdown escalates on timeout', async () => {
  const child = fakeChild();
  const ready = waitForChildReady(child, { timeoutMs: 100, readyText: 'ready' });
  child.stdout.write('ready');
  await ready;
  const stopping = stopChildBounded(child, { timeoutMs: 2, killTimeoutMs: 2 });
  await assert.rejects(stopping, /bounded shutdown/);
  assert.deepEqual(child.kills, ['SIGTERM', 'SIGKILL']);
});

test('interruption handlers stay installed until explicitly finalized', () => {
  const processLike = new EventEmitter();
  const signals = [];
  const handlers = installInterruptionHandlers({ processLike, onInterrupt: signal => signals.push(signal) });
  processLike.emit('SIGINT');
  assert.equal(handlers.signal, 'SIGINT');
  assert.throws(() => handlers.throwIfInterrupted(), /interrupted/);
  assert.deepEqual(signals, ['SIGINT']);
  handlers.remove();
  processLike.emit('SIGTERM');
  assert.deepEqual(signals, ['SIGINT']);
});

test('HTTP timeout aborts the request signal', async () => {
  let aborted = false;
  await assert.rejects(fetchWithTimeout((_url, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(signal.reason); }, { once: true });
  }), 'http://127.0.0.1', {}, 5));
  assert.equal(aborted, true);
});

test('interruption during setup leaves a durable prepared journal that recovery can inspect', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'ef-it-interrupt-setup-'));
  try {
    const pathname = path.join(folder, 'journal.json');
    const journal = createOwnershipJournal({ pathname, database: 'enterflow_it_0123456789abcdef', identityDigest: 'a'.repeat(64),
      fixture: { runId: '0123456789abcdef', safeDigest: 'b'.repeat(64), user: {}, material: {} }, transactionNonce: 'c'.repeat(32) });
    const processLike = new EventEmitter();
    const handlers = installInterruptionHandlers({ processLike });
    await journal.create();
    await journal.setStage('preflight-complete');
    processLike.emit('SIGINT');
    assert.throws(() => handlers.throwIfInterrupted(), /interrupted/);
    handlers.remove();
    const recovered = await readOwnershipJournal(pathname);
    assert.equal(recovered.state, 'prepared');
    assert.equal(recovered.execution.incomplete, false);
    assert.equal(recovered.execution.lastCompletedStage, 'preflight-complete');
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('interruption after fixture commit persists an incomplete cleanup-required stage', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'ef-it-interrupt-commit-'));
  try {
    const pathname = path.join(folder, 'journal.json');
    const journal = createOwnershipJournal({ pathname, database: 'enterflow_it_0123456789abcdef', identityDigest: 'a'.repeat(64),
      fixture: { runId: '0123456789abcdef', safeDigest: 'b'.repeat(64), user: {}, material: {} }, transactionNonce: 'd'.repeat(32) });
    const processLike = new EventEmitter();
    const handlers = installInterruptionHandlers({ processLike });
    await journal.create();
    await journal.markCommitted();
    await journal.setCleanupStatus('required');
    await journal.setStage('fixture-committed');
    processLike.emit('SIGTERM');
    await journal.markIncomplete('post-fixture-setup', 'required');
    handlers.remove();
    const recovered = await readOwnershipJournal(pathname);
    assert.equal(recovered.state, 'committed');
    assert.equal(recovered.execution.incomplete, true);
    assert.equal(recovered.execution.failureStage, 'post-fixture-setup');
    assert.equal(recovered.execution.cleanupStatus, 'required');
    assert.equal(/password|cookie|tokenHash|credential/iu.test(await readFile(pathname, 'utf8')), false);
  } finally { await rm(folder, { recursive: true, force: true }); }
});
