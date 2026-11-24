import test from 'node:test';
import assert from 'node:assert/strict';
import { guardPhase2Pool } from './phase2-pool.js';

const uuid = 'be8fec6b-e6db-11f1-9b34-06d4adf80920';
function fixture({ databaseUser = 'enterflow_dev_amiaz', row = {}, stream = {} } = {}) {
  const calls = [];
  const c = {
    connection: { stream: { encrypted: true, authorized: true, ...stream } },
    async query(sql) {
      calls.push(sql);
      return [[{
        name: 'enterflow_phase2_db', version: '8.4.13', serverUuid: uuid,
        account: `${databaseUser}@${databaseUser === "enterflow_phase2_app" ? "%" : "172.17.0.1"}`, sqlMode: 'STRICT_TRANS_TABLES', ...row
      }]];
    },
    async execute(sql, params) { calls.push([sql, params]); return [['result']]; },
    release() { calls.push('release'); },
    destroy() { calls.push('destroy'); }
  };
  const raw = { getConnection: async () => c, end: async () => calls.push('end') };
  return { calls, c, raw, pool: guardPhase2Pool(raw, { phase2: { serverUuid: uuid, databaseUser, shared: databaseUser !== "enterflow_phase2_app" } }) };
}

for (const databaseUser of ['enterflow_phase2_app', 'enterflow_dev_amiaz']) {
  test(`guards every checkout and preserves delegation for ${databaseUser}`, async () => {
    const { pool, calls } = fixture({ databaseUser });
    assert.deepEqual(await pool.execute('business SQL', ['1']), [['result']]);
    assert.match(calls[0], /^SELECT DATABASE/);
    assert.equal(calls[1], "SET SESSION time_zone='+00:00'");
    assert.deepEqual(calls[2], ['business SQL', ['1']]);
    assert.equal(calls[3], 'release');
    await pool.query('read SQL');
    assert.match(calls[4], /^SELECT DATABASE/);
    assert.equal(calls[6], 'read SQL');
    assert.equal(calls[7], 'release');
    await pool.end();
    assert.equal(calls.at(-1), 'end');
  });
}

for (const [name, options] of [
  ['plaintext transport', { stream: { encrypted: false } }],
  ['untrusted TLS', { stream: { authorized: false } }],
  ['wrong database', { row: { name: 'enterflow_db' } }],
  ['wrong version', { row: { version: '8.4.12' } }],
  ['wrong UUID', { row: { serverUuid: 'wrong' } }],
  ['local account on shared target', { row: { account: 'enterflow_phase2_app@%' } }],
  ['username prefix collision', { row: { account: 'enterflow_dev_amiaz_extra@%' } }],
  ['missing strict mode', { row: { sqlMode: 'NO_ENGINE_SUBSTITUTION' } }]
]) {
  test(`destroys connection before business SQL: ${name}`, async () => {
    const { pool, calls } = fixture(options);
    await assert.rejects(pool.execute('business SQL', []), /Phase 2 database identity verification failed/);
    assert.equal(calls.at(-1), 'destroy');
    assert(!calls.includes('release'));
    assert(!calls.some(call => Array.isArray(call)));
    assert(!calls.some(call => typeof call === 'string' && call.startsWith('SET SESSION')));
  });
}

test('preserves non-Phase-2 pool behavior', () => {
  const { raw } = fixture();
  assert.equal(guardPhase2Pool(raw, { phase2: null }), raw);
});
