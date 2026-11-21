import { once } from 'node:events';

export function validateScenarioInputs({ apiPort, apiEnvironment, journalPath, caPath, apiEntry }) {
  if (!Number.isSafeInteger(apiPort) || apiPort < 1024 || apiPort > 65535 || [3306, 3307, 3308, 3309].includes(apiPort)) throw new Error('Invalid API port.');
  for (const [name, value] of Object.entries({ journalPath, caPath, apiEntry })) {
    if (typeof value !== 'string' || value.trim() === '') throw new Error(`Missing ${name}.`);
  }
  if (!apiEnvironment || apiEnvironment.PORT !== String(apiPort) || apiEnvironment.HOST !== '127.0.0.1' ||
      apiEnvironment.INTEGRATION_TEST_RUNTIME !== '1') throw new Error('Invalid isolated API child configuration.');
  return true;
}

export function waitForChildReady(child, { timeoutMs = 15000, readyText = 'Enter-Flow API running at http://' } = {}) {
  return new Promise((resolve, reject) => {
    let output = '';
    let settled = false;
    const clean = () => {
      clearTimeout(timer);
      child.removeListener('error', onError);
      child.removeListener('exit', onExit);
      child.stdout?.removeListener('data', onData);
    };
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clean();
      error ? reject(error) : resolve();
    };
    const onError = () => finish(new Error('API child process failed to spawn.'));
    const onExit = (code, signal) => finish(new Error(`API child exited before readiness (${code ?? signal ?? 'unknown'}).`));
    const onData = chunk => {
      output = `${output}${chunk}`.slice(-4096);
      if (output.includes(readyText)) finish();
    };
    const timer = setTimeout(() => finish(new Error('API readiness timed out.')), timeoutMs);
    child.once('error', onError);
    child.once('exit', onExit);
    child.stdout?.on('data', onData);
    if (child.exitCode !== null && child.exitCode !== undefined) onExit(child.exitCode, child.signalCode);
  });
}

async function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null && child.exitCode !== undefined || child.signalCode) return true;
  let timer;
  try {
    await Promise.race([
      once(child, 'exit'),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Child shutdown timed out.')), timeoutMs); })
    ]);
    return true;
  } catch { return false; }
  finally { clearTimeout(timer); }
}

export async function stopChildBounded(child, { timeoutMs = 5000, killTimeoutMs = 2000 } = {}) {
  if (child.exitCode !== null && child.exitCode !== undefined || child.signalCode) return true;
  try { child.kill('SIGTERM'); } catch { /* escalate below */ }
  if (await waitForExit(child, timeoutMs)) return true;
  try { child.kill('SIGKILL'); } catch { /* report if it remains alive */ }
  if (await waitForExit(child, killTimeoutMs)) return true;
  throw new Error('API child could not be stopped within the bounded shutdown window.');
}

export function installInterruptionHandlers({ processLike = process, onInterrupt = () => {} } = {}) {
  let signal = null;
  const receive = value => {
    if (signal !== null) return;
    signal = value;
    onInterrupt(value);
  };
  const onSigint = () => receive('SIGINT');
  const onSigterm = () => receive('SIGTERM');
  processLike.on('SIGINT', onSigint);
  processLike.on('SIGTERM', onSigterm);
  return Object.freeze({
    get signal() { return signal; },
    throwIfInterrupted() { if (signal) throw new Error(`Scenario interrupted by ${signal}.`); },
    remove() { processLike.removeListener('SIGINT', onSigint); processLike.removeListener('SIGTERM', onSigterm); }
  });
}

export async function fetchWithTimeout(fetchImpl, url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('HTTP request timed out.')), timeoutMs);
  const externalSignal = options.signal;
  const onAbort = () => controller.abort(externalSignal.reason);
  if (externalSignal?.aborted) onAbort();
  else externalSignal?.addEventListener('abort', onAbort, { once: true });
  try { return await fetchImpl(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); externalSignal?.removeEventListener('abort', onAbort); }
}

