import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Module } from 'node:module';
import { transformSync } from 'esbuild';
const compiled = transformSync(readFileSync(new URL('./inquiryRecovery.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'cjs' });
const module = new Module('inquiryRecovery.fixture.cjs'); module._compile(compiled.code, 'inquiryRecovery.fixture.cjs');
const { recoveryKey, recoveryUrl } = module.exports;
test('opaque recovery key survives reload URLs without persisting form values or document contents', () => {
  const key = '11111111-1111-4111-8111-111111111111';
  const url = recoveryUrl('http://localhost:5173/?other=kept#orders', key);
  assert.equal(recoveryKey(url), key);
  assert.equal(new URL(url).searchParams.get('other'), 'kept');
  assert.equal(new URL(url).hash, '#orders');
  assert.equal(recoveryKey(recoveryUrl(url, null)), null);
  assert.equal(recoveryKey('http://localhost/?inquirySubmission=invalid'), null);
});
