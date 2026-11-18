import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, existsSync } from 'node:fs';
import { promisify } from 'node:util';
import { createRequire, Module } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../', import.meta.url));
const files = [
  'src/app/store/materials.tsx', 'src/app/store/notifications.tsx',
  'src/app/store/orders.tsx', 'src/app/store/stockRequests.tsx',
  'src/app/components/Accounting.tsx', 'src/app/components/ClientPortal.tsx',
  'src/app/components/client/ClientPortal.tsx', 'src/app/components/SalesOrders.tsx'
];

// A focused source guard supplements the executed storage failure tests below:
// asynchronous component handlers must also log only fixed diagnostic text.
for (const file of files) {
  test(`${file} runtime console diagnostics contain fixed text only`, async () => {
    const source = await promisify(readFile)(join(root, file), 'utf8');
    const calls = [...source.matchAll(/console\.(?:error|warn|log|info|debug)\s*\(([^\n]*)\);/g)];
    const allCalls = [...source.matchAll(/console\.(?:error|warn|log|info|debug)\s*\(/g)];
    assert.equal(calls.length, allCalls.length, 'Every console call must be checked.');
    if (calls.length === 0) assert.doesNotMatch(source, /console\.(?:error|warn|log|info|debug)\s*\(/);
    for (const [, args] of calls) {
      assert.match(args, /^"[^"\r\n]+"$/, 'No error objects, interpolation or extra arguments.');
      assert.match(args, /Could not|invalid|Cannot generate|read-only/);
    }
  });
}

const require = createRequire(import.meta.url);
const repositoryRoot = root;
const bundle = await build({
  stdin: {
    contents: `export {loadPersistedRawMaterials,persistRawMaterials} from './src/app/store/materials.tsx';
      export {persistNotifications} from './src/app/store/notifications.tsx';
      export {persistOrders} from './src/app/store/orders.tsx';
      export {persistReminderHistory} from './src/app/components/Accounting.tsx';`,
    resolveDir: repositoryRoot, sourcefile: join(repositoryRoot, 'redaction-fixture.tsx'), loader: 'tsx'
  },
  plugins: [{ name: 'existing-ts-imports', setup(builder) {
    builder.onResolve({ filter: /^\.\.?\// }, args => {
      const candidate = resolve(args.resolveDir || repositoryRoot, args.path);
      for (const base of [candidate, ...(candidate.endsWith('.js') ? [candidate.slice(0, -3)] : [])]) {
        for (const suffix of ['', '.tsx', '.ts', '.jsx', '.js']) {
          if (existsSync(base + suffix)) return { path: base + suffix };
        }
      }
      throw new Error('Unresolved synthetic frontend import.');
    });
  } }],
  absWorkingDir: repositoryRoot, bundle: true, write: false, platform: 'node', format: 'cjs',
  packages: 'external', external: ['react', 'react/*', 'sonner', 'lucide-react', '@radix-ui/*', 'clsx', 'tailwind-merge'], jsx: 'automatic', define: { 'import.meta.env.DEV': 'true' }
});
const compiled = new Module(join(repositoryRoot, 'redaction-fixture.cjs'));
compiled.paths = [join(repositoryRoot, 'node_modules')];
compiled._compile(bundle.outputFiles[0].text, join(repositoryRoot, 'redaction-fixture.cjs'));
const runtime = compiled.exports;

const markers = ['SYNTHETIC_PASSWORD', 'SYNTHETIC_PASSWORD_HASH', 'SYNTHETIC_BEARER_TOKEN',
  'SYNTHETIC_SESSION_ID', 'SYNTHETIC_COOKIE', 'SYNTHETIC_AUTHORIZATION', 'SYNTHETIC_SQL'];

for (const [name, invoke, expected] of [
  ['material read', storage => runtime.loadPersistedRawMaterials(storage), 'Could not load raw material inventory'],
  ['material write', storage => runtime.persistRawMaterials('demo', [], storage), 'Could not persist raw material inventory'],
  ['notification write', storage => runtime.persistNotifications('demo', [], storage), 'Could not persist notifications'],
  ['order write', storage => runtime.persistOrders('demo', [], [], storage), 'Could not persist order state'],
  ['reminder write', storage => runtime.persistReminderHistory('demo', {}, storage), 'Could not persist payment reminder history']
]) {
  test(`${name} failure retains fallback and fixed diagnostic without serializing private errors`, t => {
    const error = Object.assign(new Error(markers.join(':')), {
      stack: markers.join(':'), code: markers[6],
      nested: { passwordHash: markers[1], authorization: markers[5] },
      toString() { assert.fail('Sensitive errors must not be coerced.'); },
      toJSON() { assert.fail('Sensitive errors must not be serialized.'); }
    });
    const entries = [];
    t.mock.method(console, 'error', (...args) => entries.push(args));
    let calls = 0;
    const storage = {
      getItem() { calls++; throw error; },
      setItem() { calls++; throw error; }
    };
    const result = invoke(storage);
    assert.equal(calls, 1);
    if (name === 'material read') assert.ok(Array.isArray(result));
    else assert.equal(result, undefined);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].length, 1);
    assert.ok(entries[0][0].includes(expected));
    for (const marker of markers) assert.equal(JSON.stringify(entries).includes(marker), false);
  });
}

test('malformed stored material JSON retains defaults without logging the parser input', t => {
  const entries = [];
  t.mock.method(console, 'error', (...args) => entries.push(args));
  const fallback = runtime.loadPersistedRawMaterials({ getItem: () => null });
  const result = runtime.loadPersistedRawMaterials({ getItem: () => `{"password":"${markers[0]}",` });
  assert.equal(result, fallback);
  assert.deepEqual(entries, [['[EnterFlow] Could not load raw material inventory from localStorage.']]);
});
