# Task 002 pre-implementation technical review

Date: 2026-11-21 (Asia/Singapore)

Scope: targeted static review of `docs/TASK_002_ISOLATED_INTEGRATION_TEST_PLAN.md`, the selected application paths, the approved 11-table artifacts, and MySQL 8.4 privilege documentation. This is not implementation or execution approval.

## Review result

The selected login/session/Inventory workflow requires API access to exactly four tables: `users`, `user_sessions`, `materials`, and `finished_goods`. The original API grant set was correct, but the plan lacked the source-to-operation proof requested for implementation review.

Two technical corrections were necessary and are now incorporated into the plan:

1. The schema initializer does not need `SELECT` or a separate `INDEX` privilege. It needs database-level `CREATE` plus `REFERENCES` for the approved statements. Complete detection of triggers/routines/events cannot safely be attributed to that limited account.
2. Cleanup evidence was too weak for interrupted runs. The plan now requires a durable pre-commit journal, transaction reconciliation, complete immutable markers, session IDs plus double-hashed token-hash evidence, timestamp windows, inbound-FK checks, and exact post-delete readback.

No change to the 11-table snapshot, manifest, workflow scope, or exclusion of `audit_events` was required.

## 1. API runtime permission verification

### Complete selected execution path

- `backend/src/app.js:34-55` mounts `/api/auth` and `/api/inventory`.
- `backend/src/routes/auth.routes.js:37-66` routes login through same-origin and in-memory rate-limit middleware to `createAuthController.loginUser`.
- `backend/src/controllers/auth.controller.js:55-78` reads credentials, calls the login service, and sets the cookie; it performs no SQL.
- `backend/src/services/auth.service.js:38-108` validates the input, selects the account, calls the Argon2 verifier, and creates a session.
- `backend/src/services/password.service.js:18-30` performs Argon2 verification without database access.
- `backend/src/services/session.service.js:46-75` persists login sessions; lines 78-108 validate them; lines 110-130 refresh activity.
- `backend/src/routes/inventory.routes.js:13-19` applies authentication and the JavaScript permission check before `GET /`.
- `backend/src/middleware/auth.middleware.js:63-105` validates the cookie/session and requires the activity update to succeed.
- `backend/src/middleware/permission.middleware.js:16-32` and `backend/src/config/permissions.js:61-67,104-117` authorize `warehouse` in process; neither queries `roles` or any mapping table.
- `backend/src/controllers/inventory.controller.js:21-37` calls `service.list` without SQL of its own.
- `backend/src/services/inventory.service.js:105-140` selects raw materials and finished goods.
- `backend/src/server.js:5-16` invokes `backend/src/config/database.js:38-49` during startup; its table-free identity query needs no table grant.

No repository abstraction or additional SQL helper is invoked by this path. Origin checking and rate limiting are memory/request operations. Importing the other routers constructs services but does not execute their unrelated SQL for these requests.

### Exact API privilege matrix

| Workflow stage | SQL evidence | Tables/operation | Required privilege |
| --- | --- | --- | --- |
| Startup | `backend/src/config/database.js:38-49` | `SELECT DATABASE(), VERSION()`; no table | Connection only |
| Login lookup | `backend/src/services/auth.service.js:55-70` | `SELECT users` | `SELECT` on `users` |
| Password verification | `backend/src/services/password.service.js:18-30` | No SQL | None |
| Session creation | `backend/src/services/session.service.js:52-69` | `INSERT user_sessions ... SELECT users` | `INSERT` on `user_sessions`; `SELECT` on `users` |
| Session validation | `backend/src/services/session.service.js:81-105` | `SELECT user_sessions JOIN users` | `SELECT` on `user_sessions` and `users` |
| Activity update | `backend/src/services/session.service.js:113-127` | `UPDATE user_sessions JOIN users`; only `user_sessions` is changed | `UPDATE` on `user_sessions`; `SELECT` on `user_sessions` and `users` |
| Permission check | `backend/src/config/permissions.js:61-67,104-117` | No SQL | None |
| Inventory materials | `backend/src/services/inventory.service.js:109-119` | `SELECT materials` | `SELECT` on `materials` |
| Inventory finished goods | `backend/src/services/inventory.service.js:120-123` | `SELECT finished_goods` | `SELECT` on `finished_goods` |

Final API runtime grants:

- `SELECT`: `users`, `user_sessions`, `materials`, `finished_goods`.
- `INSERT`: `user_sessions` only.
- `UPDATE`: `user_sessions` only.

`roles`, `units`, `material_categories`, `clients`, `payment_terms`, `filter_types`, and `product_specifications` do not need API-readable grants. Their foreign-key participation does not require the runtime account to read the parent tables. `audit_events` is not touched by this exact workflow. Logout, password change, registration, Admin creation, and Inventory mutation remain excluded.

## 2. Schema initializer privileges and metadata boundary

MySQL 8.4 classifies `CREATE`, `DROP`, `EVENT`, `GRANT OPTION`, and `REFERENCES` as database-level-capable privileges, while `CREATE USER` is global. `CREATE TABLE` requires `CREATE`; indexes declared inside the create statement need no separate `INDEX`; and foreign-key creation requires `REFERENCES` on each parent table. Sources: [Privileges Provided by MySQL](https://dev.mysql.com/doc/refman/8.4/en/privileges-provided.html), [CREATE TABLE](https://dev.mysql.com/doc/refman/8.4/en/create-table.html), and [Foreign Key Constraints](https://dev.mysql.com/doc/refman/8.4/en/create-table-foreign-keys.html).

The corrected initializer grant is exactly:

| Level | Privileges | Purpose |
| --- | --- | --- |
| Database ``enterflow_it_<runId>.*`` | `CREATE` | Create the 11 tables with inline PKs, unique/ordinary indexes, and CHECK constraints |
| Database ``enterflow_it_<runId>.*`` | `REFERENCES` | Create foreign keys to the earlier parent tables |

No `SELECT`, `INDEX`, `ALTER`, `DROP`, `CREATE VIEW`, `CREATE ROUTINE`, `EVENT`, `TRIGGER`, or DML privilege is needed. `SHOW CREATE TABLE` requires any privilege on the table; the initializer already has applicable `CREATE`/`REFERENCES` privileges. Information Schema generally exposes metadata only for objects on which the caller has a proper privilege. Sources: [SHOW CREATE TABLE](https://dev.mysql.com/doc/refman/8.4/en/show-create-table.html) and [Information Schema privilege behavior](https://dev.mysql.com/doc/refman/8.4/en/information-schema-introduction.html).

This account can verify the 11 tables it created, `SHOW CREATE TABLE` output, indexes, constraints, and FK/CHECK definitions. It cannot conclusively prove that no hidden stored objects exist:

- trigger metadata requires `TRIGGER`, which also permits trigger operations ([Information Schema TRIGGERS](https://dev.mysql.com/doc/refman/8.4/en/information-schema-triggers-table.html));
- displaying/managing events uses `EVENT` ([MySQL privilege descriptions](https://dev.mysql.com/doc/refman/8.4/en/privileges-provided.html)); and
- complete routine visibility requires definer status, `SHOW_ROUTINE`, global `SELECT`, or scoped routine privileges such as `CREATE ROUTINE`, `ALTER ROUTINE`, or `EXECUTE` ([Information Schema ROUTINES](https://dev.mysql.com/doc/refman/8.4/en/information-schema-routines-table.html)).

Granting these to a run verifier would add object-creation/execution capability. The corrected plan therefore assigns the complete pre/post object-absence audit to the already-authorized target administrator/provisioner and captures its sanitized attestation. The initializer independently verifies the exact visible 11-table set and hashes. This separation is fail-closed and avoids unnecessary privileges.

## 3. Provisioner privileges

The provisioner is outside the four run accounts. `CREATE USER` is a global administrative privilege and also authorizes `DROP USER`. `GRANT` and ordinary `REVOKE` require both `GRANT OPTION` and the privileges being granted/revoked. `DROP DATABASE` requires `DROP`. Sources: [CREATE USER](https://dev.mysql.com/doc/refman/8.4/en/create-user.html), [GRANT](https://dev.mysql.com/doc/refman/8.4/en/grant.html), [REVOKE](https://dev.mysql.com/doc/refman/8.4/en/revoke.html), and [Privileges Provided by MySQL](https://dev.mysql.com/doc/refman/8.4/en/privileges-provided.html).

| Phase | Level | Minimum privilege set | Reason |
| --- | --- | --- | --- |
| Initial provisioning | Global | `CREATE USER` | Create the four TLS-required run accounts |
| Initial provisioning | Exact ``enterflow_it_<runId>.*`` | `CREATE`, `REFERENCES`, `SELECT`, `INSERT`, `UPDATE`, `DELETE` with `GRANT OPTION` | `CREATE` creates the database; the full scoped union is necessary to grant only the approved initializer/fixture/API/cleanup permissions |
| Teardown | Global | `CREATE USER` | Drop the four accounts after grants are revoked |
| Teardown | Exact ``enterflow_it_<runId>.*`` | Same scoped union with `GRANT OPTION` | Revoke the exact grants previously issued |
| Teardown only | Exact ``enterflow_it_<runId>.*`` | `DROP` | Drop only the owned database after accounts are removed |

No global data privilege, global `DROP`, `SHOW DATABASES`, `PROCESS`, `SUPER`, `SYSTEM_USER`, direct `mysql.*` DML, or `SELECT mysql.*` is required. Rather than giving one account `SELECT mysql.*` to inspect others, each run account connects and runs `SHOW GRANTS` for itself; MySQL requires `SELECT mysql.*` only for `SHOW GRANTS FOR` another account ([SHOW GRANTS](https://dev.mysql.com/doc/refman/8.4/en/show-grants.html)).

If `read_only` is enabled, account/grant statements additionally need `CONNECTION_ADMIN`. The plan correctly rejects that target instead of expanding global authority. The target administrator that bootstraps this scoped provisioner and performs the complete metadata audit remains an execution prerequisite; its existing authority is not copied into the test runner.

## 4. Metadata visibility and cleanup review

### Metadata

The revised division is sufficient:

- schema initializer: verifies approved table creation and exact `SHOW CREATE TABLE` hashes;
- each run account: self-verifies its own grants;
- target administrator/provisioner: proves absence of extra base tables, views, triggers, routines, and events before and after initialization.

An empty result from a visibility-limited Information Schema query is not accepted as proof that no hidden object exists.

### Foreign-key cleanup closure

The relevant inbound relationships in the approved SQL are:

- `user_sessions.user_id -> users.id` (`inventory-auth.schema.proposed.sql:90-103`);
- `materials.costing_price_approved_by -> users.id` (`inventory-auth.schema.proposed.sql:149-186`); and
- `finished_goods.updated_by -> users.id` (`inventory-auth.schema.proposed.sql:188-208`).

The selected material has a NULL approver and `finished_goods` must be empty, but cleanup now verifies those facts rather than assuming them. Sessions are deleted before the user. The material is independently deleted by its captured ID plus complete immutable markers.

### Strengthened ownership evidence

The revised plan now requires:

- a durable `prepared` journal before fixture SQL;
- reference/user/material inserts in one InnoDB transaction;
- captured IDs and markers durably recorded before commit, followed by a `committed` state;
- target UUID/certificate/database identity, a transaction nonce, exact markers, and creation-time windows;
- pre-login zero-session evidence;
- captured session IDs and a second SHA-256 digest of each stored token hash, never the raw token/hash;
- read-only reconciliation after interruption;
- stop-on-missing, duplicate, partial, out-of-window, or mismatched state;
- exact ID-and-marker delete predicates, proactive inbound-FK checks, affected-row assertions, and independent zero-row readback; and
- preservation of `warehouse` and `pcs` reference rows.

A session created just before interruption may be cleaned only when it belongs to the fully matched synthetic user and falls within the journaled API-run window. Because the synthetic user itself is proven by exact ID and unique markers, this does not authorize deletion of another run's sessions. Any ambiguity retains the isolated target for review; it never widens cleanup.

## 5. Plan corrections made

Only relevant portions of `docs/TASK_002_ISOLATED_INTEGRATION_TEST_PLAN.md` changed:

- section 2 now contains the source-backed API matrix, corrected run-account grants, self-`SHOW GRANTS` method, and exact provisioning/teardown privileges;
- section 3 now separates table-definition verification from administrator-only complete object visibility;
- section 4 now defines the durable transaction journal and stronger session/material/user ownership predicates;
- sections 5 and 6 now retain only double-hashed session evidence and define interrupted-transaction reconciliation; and
- section 10 now explicitly requires identification/approval of the bootstrapping target administrator and its metadata attestation.

Application code, runtime configuration, SQL, manifest, credentials, and test infrastructure were not changed.

## 6. Remaining risks and decisions

These are implementation/execution gates, not unresolved defects in the corrected plan:

1. Docker availability and a reusable target remain unverified.
2. The exact target, target administrator, connector host restriction, certificate/UUID identity, and whether staged teardown-only `DROP` can be used require approval.
3. The target administrator must attest complete object absence; a run account cannot safely replace this check.
4. The exact reference labels, fixtures, accounts/grants, schema execution, authenticated writes, cleanup, and target teardown remain unapproved operations.
5. The explicit runtime-config isolation change and guarded runner still require implementation review and focused fail-closed tests.
6. The unavailable Phase 1 handoff remains a documented source gap; no requirement was reconstructed from it.

No approval here extends to Admin employee creation, Inventory mutation, audit events, migrations, broader APIs, development access, or database execution.

## 7. Artifact integrity and Database Change Report

Offline raw-byte SHA-256 of `docs/integration-test-schema/inventory-auth.schema.proposed.sql` remains `20675e7330b692f4fa20ac6f8a8d476d9e042f8a09c00ae96e2e08cfc9391caf`, matching the manifest. The manifest still records 11 tables. Neither artifact was modified. The current manifest-file SHA-256 observed for evidence is `3f2cac68e757eb8db321ed7062af7ef913b3673178e73fdef8dd26b9339efce4`.

Files changed by this review:

- `docs/TASK_002_ISOLATED_INTEGRATION_TEST_PLAN.md`
- `docs/TASK_002_PRE_IMPLEMENTATION_TECHNICAL_REVIEW.md`

Tables reviewed from source/artifacts: the approved 11-table closure, with runtime operations limited to `users`, `user_sessions`, `materials`, and `finished_goods`. Schema/data/account changes proposed for development: none. Isolated operations remain proposals pending approval. Schema changes performed: none. Data changes performed: none. Migrations created/applied: none. Database operations performed: none.

No database connection, SQL, test, Docker, account/grant, fixture, API, application/configuration, credential, migration, schema, manifest, or Git operation occurred. Existing uncommitted work was preserved. Protected Migration 007, its source, history, and checksum were not accessed, inspected, enumerated, hashed, executed, modified, or validated.

READY FOR IMPLEMENTATION APPROVAL
