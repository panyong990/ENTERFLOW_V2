import test from 'node:test';
import assert from 'node:assert/strict';
import {connectPhase2} from './migration-phase2-tls.mjs';

function cachedDriver(san = 'IP Address:127.0.0.1',authorized = true) {
  const sessions = new WeakSet(), calls = [];
  return {calls,createConnection(config) {
    const reused = sessions.has(config.ssl); sessions.add(config.ssl);
    const state = {authenticated:false,destroyed:false,config,reused}; calls.push(state);
    return {stream:{encrypted:true,authorized,
      getPeerCertificate:() => reused ? {} : {subjectaltname:san}},
    startTLS(done) { done(); },
    connect(done) { this.startTLS(error => { if (!error) state.authenticated = true; done(error); }); },
    promise:() => state,destroy:() => { state.destroyed = true; }};
  }};
}
const config = () => ({host:'127.0.0.1',port:62286,database:'enterflow_phase2_db',
  ssl:{ca:'synthetic CA',rejectUnauthorized:true,verifyIdentity:true}});

test('owner and observer independently present certificates despite shared caller config', async () => {
  const original = config(), ssl = original.ssl, driver = cachedDriver();
  const owner = await connectPhase2(original,'127.0.0.1',driver);
  const observer = await connectPhase2(original,'127.0.0.1',driver);
  assert(owner.authenticated && observer.authenticated);
  assert(!owner.reused && !observer.reused);
  assert.notEqual(owner.config.ssl,observer.config.ssl);
  assert.notEqual(owner.config.ssl,ssl);
  assert.equal(original.ssl,ssl);
  for (const call of driver.calls) assert.deepEqual(call.config,original);
});

for (const [name,san,authorized] of [
  ['wrong IP','IP Address:127.0.0.2',true],
  ['missing IP SAN','DNS:localhost',true],
  ['untrusted CA','IP Address:127.0.0.1',false],
]) test(`independent observer still rejects ${name} before authentication`, async () => {
  const driver = cachedDriver(san,authorized);
  await assert.rejects(connectPhase2(config(),'127.0.0.1',driver));
  assert.equal(driver.calls[0].authenticated,false);
  assert.equal(driver.calls[0].destroyed,true);
});
