# Task 003 documentation corrections

Date: 2026-11-21 (Asia/Singapore)

Scope: resolve the synthetic employee fixture and hashing-contract documentation blockers only. This work does not approve or begin Task 002.

## Files changed

1. `docs/integration-test-schema/README.md` — complete direct-fixture `users` contract and exact whole-file/per-table hashing procedures.
2. `docs/integration-test-schema/inventory-auth.schema.manifest.json` — machine-readable snapshot digest contract, per-table digest contract, and fixture identity rules.
3. `docs/TASK_003_DOCUMENTATION_CORRECTIONS.md` — this completion record.

`docs/integration-test-schema/inventory-auth.schema.proposed.sql` was not changed. Its 11-table scope remains intact and `audit_events` was not added.

## Completed synthetic employee fixture contract

The selected setup is a direct insert by the future separately privileged isolated-fixture account. It must not call the Admin employee-creation API. The complete field contract is in the Task 003 README; the executable fixture is still prohibited until separately approved.

Generate a 16-character lowercase hexadecimal `runId` from 8 cryptographically random bytes once per run. Derive:

- `role_code='warehouse'`, with an approved Warehouse role reference row;
- `client_id=NULL`, `account_type='employee'`;
- `display_name='Task 002 Warehouse <runId>'`;
- `email='warehouse.<runId>@example.invalid'`, used as the login identifier;
- `username='ef_it_warehouse_<runId>'`;
- `phone`, `employee_number`, `department`, `job_title`, and `joined_on` as NULL;
- `active=1` and `email_alerts=1` explicitly;
- a 32-byte cryptographically random base64url plaintext password held only in runner memory, with `password_hash` generated through the existing application `hashPassword` Argon2id helper and checked as a nonempty string no longer than 255 characters;
- database-generated `id`, `created_at`, and `updated_at`.

The contract distinguishes schema requirements from the selected login/session requirements. Admin-only `employeeId`, department, job title, Admin authorization, and audit-event behavior do not apply because Admin creation is excluded. The positive generated ID links the session; login/session logic requires the active flag, valid password hash, identity fields, Warehouse employee actor fields, and NULL client. Source evidence: `backend/src/services/auth.service.js:38-108`, `backend/src/services/password.service.js:1-30`, `backend/src/services/session.service.js:46-107`, and the `users` definition at `docs/integration-test-schema/inventory-auth.schema.proposed.sql:61-88`.

## Exact normalization and hashing procedure

### Approval snapshot digest

- Input: every byte of `docs/integration-test-schema/inventory-auth.schema.proposed.sql` exactly as stored.
- Encoding: UTF-8 without BOM. A BOM is invalid and is not removed.
- Line endings: LF only. No line-ending conversion.
- Whitespace/comments/semicolons: preserved byte-for-byte.
- Final newline: exactly one LF, included in the digest.
- Pre-hash normalization: none.
- Algorithm: SHA-256 over the raw bytes; render lowercase hexadecimal.

Reproduction command:

```powershell
(Get-FileHash -LiteralPath 'docs/integration-test-schema/inventory-auth.schema.proposed.sql' -Algorithm SHA256).Hash.ToLowerInvariant()
```

The manifest digest covers only these raw SQL-file bytes. It does not cover the manifest, parsed SQL, concatenated definitions, or normalized `SHOW CREATE TABLE` output.

### Future per-table round-trip digest

This is a separate contract. Input is one MySQL 8.4.13 `SHOW CREATE TABLE` **Create Table** string, from `CREATE TABLE` through its final table option, without a semicolon. Require `lower_case_table_names=0` and the manifest environment. Count matches of `) ENGINE=InnoDB AUTO_INCREMENT=<positive decimal> DEFAULT CHARSET=`. Leave input unchanged when there are zero matches; delete only ` AUTO_INCREMENT=<positive decimal>` when there is exactly one; reject more than one match or any unmatched table-option `AUTO_INCREMENT=`. Preserve column `AUTO_INCREMENT`, all whitespace, LF characters, case, quotes, and all other characters. Encode UTF-8 without BOM or trailing newline, hash with SHA-256, and render lowercase hexadecimal.

The future runner must first reproduce all 11 stored table hashes with this canonical function. Actual MySQL execution and round-trip comparison remain outside Task 003 and require Task 002 approval.

## Offline digest result

The documented raw-byte procedure produced:

`20675e7330b692f4fa20ac6f8a8d476d9e042f8a09c00ae96e2e08cfc9391caf`

This exactly matches the existing baseline. The digest did not change because the SQL snapshot did not change and the baseline already represented its raw bytes.

Offline inspection also confirmed:

- 13,328 bytes;
- valid UTF-8 round-trip;
- no BOM, CRLF, or bare carriage-return bytes;
- 208 LF bytes and exactly one final LF;
- 11 table definitions;
- all 11 existing per-table hashes still match;
- updated manifest JSON parses successfully.

No SQL or tests were executed to obtain this result; only local artifact bytes were read and hashed.

## Remaining limits and approvals

No documentation blocker remains from the pre-approval report. The actual reference-row labels, material fixture values, isolated target, accounts/grants, initialization, fixture writes, session writes, cleanup, and MySQL round-trip execution remain separate approval items. The round trip is intentionally unverified in this documentation-only task.

## Database Change Report

- Tables reviewed in source/artifacts: `users`, `roles`, and `user_sessions`; the existing 11-table snapshot was preserved.
- Schema changes proposed/performed: none.
- Data changes proposed/performed: none; fixture rules are documentation only.
- Migrations created/applied: none.
- Database operations: none; no connection and no SQL execution.
- Application code, tests, configuration, credentials, Docker resources, schema SQL, database contents, and Git history: unchanged.
- Protected Migration 007, its file, history, and checksum were not accessed, inspected, enumerated, hashed, modified, executed, or validated.

**READY FOR FINAL REVIEW**
