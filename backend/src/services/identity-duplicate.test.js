import test from 'node:test';
import assert from 'node:assert/strict';
import { isDuplicateKey } from './identity-duplicate.js';

test('duplicate classification requires a known constraint at the actual message suffix', () => {
  const keys = ['uq_user_email'];
  for (const sqlMessage of ["Duplicate entry for key 'uq_user_email'", "Duplicate entry for key 'user_account.uq_user_email'"]) {
    assert.equal(isDuplicateKey({ code: 'ER_DUP_ENTRY', sqlMessage }, keys), true);
  }
  for (const error of [null, { code: 'ER_DUP_ENTRY' }, { code: 'ER_NO_SUCH_TABLE', sqlMessage: "for key 'uq_user_email'" },
    { code: 'ER_DUP_ENTRY', sqlMessage: "Duplicate entry for key 'PRIMARY'" },
    { code: 'ER_DUP_ENTRY', sqlMessage: "Duplicate entry 'for key 'uq_user_email'' for key 'PRIMARY'" }]) {
    assert.equal(isDuplicateKey(error, keys), false);
  }
});
