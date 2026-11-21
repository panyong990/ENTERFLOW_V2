# Task 003 final approval review

Date: 2026-11-21 (Asia/Singapore)

Scope: final static review of the retained Task 003 proposal, corrections, manifest, exact SQL snapshot, and only the application source needed to verify the selected workflow. No database or external runtime was used.

## A. Employee fixture contract

| Classification | Finding | Evidence |
| --- | --- | --- |
| **VERIFIED** | Every one of the 17 `users` columns is represented exactly once in the fixture table: generated `id`; required identity/authentication fields; all nullable profile fields; explicit active/email-alert flags; and database-generated timestamps. Offline comparison found no missing or extra documented column. | `docs/integration-test-schema/README.md:39-61`; `docs/integration-test-schema/inventory-auth.schema.proposed.sql:61-88` |
| **VERIFIED** | Nullability, lengths, enum values, defaults, unique indexes, role/client foreign keys, and `ck_user_identity` match the SQL snapshot. The contract correctly uses `account_type='employee'`, `role_code='warehouse'`, `client_id=NULL`, nullable profile fields, and `active=1`. | `docs/integration-test-schema/inventory-auth.schema.proposed.sql:61-88`; `docs/integration-test-schema/inventory-auth.schema.manifest.json:34-46` |
| **VERIFIED** | The 16-lowercase-hex run ID deterministically derives bounded, unique test email, username, and display name. The password rule generates 32 random bytes as base64url, retains plaintext only in runner memory, and hashes it with the existing Argon2id helper; the result must fit `VARCHAR(255)`. | `docs/integration-test-schema/README.md:39-59`; `backend/src/services/password.service.js:1-30` |
| **VERIFIED** | The fixture supports actual login: the email identifier is nonempty and below 254 characters, the generated password is 43 characters and below the 1024-character limit, the stored hash is verified, the account is active, and the generated positive ID is accepted by session creation. | `backend/src/services/auth.service.js:38-108`; `backend/src/services/session.service.js:6-75` |
| **VERIFIED** | Session validation returns role/account/client/display fields and refreshes activity. Warehouse has `inventory:read`, so the constructed actor can pass the Inventory permission middleware. | `backend/src/services/session.service.js:78-129`; `backend/src/middleware/auth.middleware.js:43-95`; `backend/src/config/permissions.js:61-67,104-117` |
| **VERIFIED** | Admin employee creation is explicitly excluded. Direct isolated setup does not require Admin-only employee fields, an Admin actor, or an employee-created audit event. | `docs/integration-test-schema/README.md:39,52-61`; `docs/integration-test-schema/inventory-auth.schema.manifest.json:34-46`; `docs/TASK_003_DOCUMENTATION_CORRECTIONS.md:14-34` |
| **REQUIRES SEPARATE APPROVAL** | The Warehouse role reference row, `pcs` unit reference row, exact material fixture, ephemeral credentials, fixture insertion, and cleanup remain execution inputs. Their approval belongs to Task 002 and is not granted here. | `docs/integration-test-schema/README.md:35-37,63-65` |

## B. Schema integrity and hashing

| Classification | Finding | Evidence |
| --- | --- | --- |
| **VERIFIED** | The approval digest procedure hashes the complete SQL file exactly as stored: UTF-8 without BOM, LF only, all whitespace/comments/semicolons preserved, exactly one final LF included, no pre-hash normalization, SHA-256, lowercase hexadecimal. The PowerShell reproduction command is complete. | `docs/integration-test-schema/README.md:75-85`; `docs/integration-test-schema/inventory-auth.schema.manifest.json:12-23`; `docs/TASK_003_DOCUMENTATION_CORRECTIONS.md:36-57` |
| **VERIFIED** | Independent raw-byte hashing produced `20675e7330b692f4fa20ac6f8a8d476d9e042f8a09c00ae96e2e08cfc9391caf`, matching both manifest fields and the required baseline. The file is 13,328 bytes, has no BOM/CR/CRLF, contains 208 LF bytes, and ends with exactly one LF. The SQL snapshot has therefore not silently changed relative to the approved baseline. | `docs/integration-test-schema/inventory-auth.schema.manifest.json:12-23,47`; `docs/TASK_003_DOCUMENTATION_CORRECTIONS.md:67-84` |
| **VERIFIED** | SQL and manifest contain the same 11 tables in the same dependency-safe order. There are 11 manifest table entries; every recomputed per-table hash matches; every foreign key references an earlier allowlisted table. | `docs/integration-test-schema/inventory-auth.schema.manifest.json:48-412`; `docs/integration-test-schema/inventory-auth.schema.proposed.sql:6-208` |
| **VERIFIED** | The per-table procedure precisely defines input boundaries, MySQL version/environment, zero/one/multiple table-level AUTO_INCREMENT handling, preservation of column AUTO_INCREMENT and every other character, UTF-8/LF encoding, no BOM/trailing newline, SHA-256, and lowercase hexadecimal. It is sufficiently deterministic for Task 002 implementation. | `docs/integration-test-schema/README.md:87`; `docs/integration-test-schema/inventory-auth.schema.manifest.json:24-33`; `docs/TASK_003_DOCUMENTATION_CORRECTIONS.md:59-65` |
| **UNVERIFIABLE** | Byte-identical `SHOW CREATE TABLE` output from a newly initialized MySQL 8.4.13 target cannot be proven without executing the separately approved round trip. Hidden server-side objects also cannot be reverified in this source-only review. These are recorded limits, not Task 003 documentation defects. | `docs/integration-test-schema/README.md:69-73,89-95`; `docs/TASK_003_PRE_APPROVAL_VERIFICATION.md:16,59-60` |

The retained README is the original Task 003 proposal. No separate original-proposal file is present among the retained Task 003 artifacts.

## C. Exact workflow scope

| Classification | Finding | Evidence |
| --- | --- | --- |
| **VERIFIED** | The 11-table closure supports direct setup of the synthetic Warehouse employee and material/reference fixtures, actual login, `user_sessions` persistence, authenticated session validation/activity refresh, and read-only Inventory retrieval from `materials` and `finished_goods`. | `docs/integration-test-schema/README.md:13-33`; `backend/src/services/auth.service.js:55-95`; `backend/src/services/session.service.js:46-129`; `backend/src/routes/inventory.routes.js:13-19`; `backend/src/services/inventory.service.js:105-140` |
| **VERIFIED** | `audit_events` is not read or written by this exact path. Inventory audit insertion starts only in the excluded create/update operations. | `backend/src/services/inventory.service.js:105-140,142-180`; `docs/TASK_003_PRE_APPROVAL_VERIFICATION.md:10-18` |
| **VERIFIED** | This approval does not extend to Admin employee creation, Inventory mutation, password changes, stock requests, Sales, or other audited workflows. Those require a new dependency/grant review and may require `audit_events`. | `docs/integration-test-schema/README.md:9-11,31-33,61-65`; `docs/TASK_003_PRE_APPROVAL_VERIFICATION.md:18,66-71` |

## D. Isolation and safeguards

| Classification | Finding | Evidence |
| --- | --- | --- |
| **VERIFIED** | The proposal requires verification of container ID/label/image, loopback endpoint, UUID, TLS, and ownership; rejects development targets and missing configuration; and permits initialization only in an empty run-owned schema. | `docs/integration-test-schema/README.md:89-93` |
| **VERIFIED** | It requires MySQL 8.4.13, `lower_case_table_names=0`, exact table/hash checks, FK/CHECK enforcement, trigger review, and separately approved raw-file digest comparison before fixtures. It prohibits migrations and migration markers. | `docs/integration-test-schema/README.md:92-93`; `docs/integration-test-schema/inventory-auth.schema.manifest.json:24-33` |
| **VERIFIED** | Setup/cleanup and API credentials are separated. The selected API path requires `SELECT` on `users`, `user_sessions`, `materials`, and `finished_goods`, plus `INSERT`/`UPDATE` on `user_sessions`; it needs no DDL or Inventory-write grants. Cleanup is limited to run-owned sessions, material, and user rows, preserving approved reference rows. | `docs/integration-test-schema/README.md:65,94-95`; `docs/TASK_003_PRE_APPROVAL_VERIFICATION.md:31-48` |
| **REQUIRES SEPARATE APPROVAL** | Before execution, Task 002 must approve and verify the exact target, explicit test-only environment without development fallback, reference/material fixture values, restricted grants using the exact `user_sessions` table name, schema initialization, authenticated writes, cleanup order/ownership, and failure-retention behavior. Task 003 approval does not authorize any of these operations. | `docs/integration-test-schema/README.md:89-95`; `docs/TASK_003_DOCUMENTATION_CORRECTIONS.md:86-90` |
| **UNVERIFIABLE** | Existing isolated-target availability, actual grants, target identity, schema round trip, fixture insertion, login persistence, API read-back, and cleanup cannot be established without the separately approved Task 002 runtime operation. | `docs/integration-test-schema/README.md:73,89-95` |

## Final determination

The two prior documentation blockers are resolved. The synthetic employee contract is complete and compatible with the selected login/session path. The raw snapshot and per-table digest contracts are precise and independently reproducible. The exact 11-table snapshot is sufficiently specified for Task 002 planning, while all runtime actions remain separately gated.

This approval covers Task 003 documentation and schema-snapshot readiness only. It does not authorize database creation, SQL execution, fixture writes, Docker changes, credential creation, Task 002 implementation, or MySQL round-trip validation.

## Database Change Report

- Tables reviewed from existing source/artifacts: the 11-table snapshot, with focused application review of `users`, `user_sessions`, `materials`, and `finished_goods`.
- Schema changes proposed/performed: none.
- Data changes proposed/performed: none.
- Migrations created/applied: none.
- Database and SQL operations: none.
- Tests, Docker, application code, configuration, credentials, schema files, manifest, existing documentation, and Git history: unchanged. Only this requested review report was created.
- Protected Migration 007, its file, history, and checksum were not accessed, inspected, enumerated, hashed, modified, executed, or validated.

**APPROVE TASK 003 — READY FOR TASK 002 PLANNING**
