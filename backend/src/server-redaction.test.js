import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const serverUrl = new URL('./server.js', import.meta.url);
const marker = 'SYNTHETIC_PASSWORD_TOKEN_COOKIE_AUTHORIZATION_SQL_PATH_STACK';

for (const failure of ['app-import', 'database-import', 'binding', 'validation', 'run', null]) {
  test(`server initialization ${failure ?? 'success'} uses synthetic modules and safe diagnostics`, async t => {
    const previousExitCode = process.exitCode;
    const entries = [];
    const state = { failure, marker, calls: [] };
    globalThis.__redactionBootstrap = state;
    t.mock.method(console, 'error', (...args) => entries.push(args));
    let hook;
    try {
      hook = registerHooks({
        resolve(specifier, context, nextResolve) {
          if (context.parentURL?.split('?')[0] !== serverUrl.href) return nextResolve(specifier, context);
          const known = ['./app.js', './config/database.js', './config/runtime-config.js', './server-lifecycle.js'];
          assert.ok(known.includes(specifier), `Unexpected bootstrap dependency: ${specifier}`);
          return { url: `redaction-bootstrap:${specifier}?case=${failure}`, shortCircuit: true };
        },
        load(url, context, nextLoad) {
          if (!url.startsWith('redaction-bootstrap:')) return nextLoad(url, context);
          let source = `const s = globalThis.__redactionBootstrap;
            const fail = () => { throw Object.assign(new Error(s.marker), {stack: s.marker, code:s.marker, sql:s.marker}); };`;
          if (url.includes('./app.js')) source += `s.calls.push('app-import'); if(s.failure==='app-import') fail(); export default {};`;
          else if (url.includes('./config/database.js')) source += `s.calls.push('database-import'); if(s.failure==='database-import') fail(); export const pool={}; export function testDatabaseConnection(){throw new Error('Probe must not run in bootstrap test');}`;
          else if (url.includes('./config/runtime-config.js')) source += `
            export function resolveServerBinding(){s.calls.push('binding'); if(s.failure==='binding') fail(); return {host:'127.0.0.1',port:3000};}
            export function validateRuntimeConfig(){s.calls.push('validation'); if(s.failure==='validation') fail();}`;
          else source += `export function createServerLifecycle(dependencies){s.calls.push('lifecycle'); s.dependencies=dependencies; return {async run(){s.calls.push('run'); if(s.failure==='run') fail();}};}`;
          return { format: 'module', shortCircuit: true, source };
        }
      });
      await import(`${serverUrl.href}?redaction=${failure}`);
      const order = ['app-import', 'database-import', 'binding', 'validation', 'lifecycle', 'run'];
      const expected = failure ? order.slice(0, order.indexOf(failure) + 1) : order;
      assert.deepEqual(state.calls, expected);
      if (failure) {
        assert.equal(process.exitCode, 1);
        assert.deepEqual(entries, [[JSON.stringify({
          event: 'server_initialization_failed', category: 'startup_configuration_error'
        })]]);
        assert.equal(JSON.stringify(entries).includes(marker), false);
      } else {
        assert.equal(process.exitCode, previousExitCode);
        assert.deepEqual(entries, []);
        assert.deepEqual(Object.keys(state.dependencies).sort(),
          ['app', 'host', 'logger', 'pool', 'port', 'processAdapter', 'testDatabaseConnection']);
        assert.equal(state.dependencies.host, '127.0.0.1');
        assert.equal(state.dependencies.port, 3000);
        assert.equal(state.dependencies.logger, console);
        assert.equal(state.dependencies.processAdapter, process);
      }
    } finally {
      try { hook?.deregister(); }
      finally {
        process.exitCode = previousExitCode;
        delete globalThis.__redactionBootstrap;
      }
    }
  });
}
