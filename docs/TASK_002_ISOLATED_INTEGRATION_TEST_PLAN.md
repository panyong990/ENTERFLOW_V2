# Task 002: isolated integration-test infrastructure plan

Date: 2026-11-21 (Asia/Singapore)

Status: planning only. This document does not authorize implementation, database access, SQL execution, Docker activity, account/grant creation, fixture writes, API execution, cleanup, or migration work.

## Authority and source availability

This plan follows root `AGENTS.md`, `docs/TASK_001_INTEGRATION_TEST_READINESS_2026-11-19.md`, the retained Task 003 proposal in `docs/integration-test-schema/README.md`, `docs/TASK_003_PRE_APPROVAL_VERIFICATION.md`, `docs/TASK_003_DOCUMENTATION_CORRECTIONS.md`, `docs/TASK_003_FINAL_APPROVAL_REVIEW.md`, the manifest, and the exact SQL snapshot.

The requested `docs/TASK_001_PRE_IMPLEMENTATION_READINESS_REPORT.md` is not present. The dated Task 001 readiness report above is the actual repository file and is used without reconstructing a missing report. The original 28-page Phase 1 handoff also remains unavailable as recorded by Task 001; this plan does not infer requirements from it. No separate original Task 003 proposal exists; the integration-test-schema README is the retained proposal.

Task 003 approved only the schema/documentation for Task 002 planning. It did not approve target provisioning, grants, schema creation, fixtures, authenticated writes, cleanup, Docker operations, or implementation.

## 1. Existing infrastructure and selected architecture

### Current evidence

- `database/compose.dev.yaml:2-17,29-36` defines the persistent development container, loopback port `3308`, database `enterflow_db`, and named volume. It is categorically forbidden as an integration target.
- `backend/src/config/runtime-config.js:4,95-103` loads `database/.env.dev` unless `BROWSER_TEST_RUNTIME=1`; `NODE_ENV=test` alone does not isolate configuration.
- `backend/test/support/isolated-mysql.js:27-85,98-145` already demonstrates useful random naming, a pinned MySQL image, tmpfs storage, loopback random port, UUID/version verification, strict TLS, and guarded pools.
- That harness is unusable unchanged: `backend/test/support/isolated-mysql.js:9,102-106,139-142,156-159` discovers/hashes migration material, asserts an obsolete sequence, runs migrate/seed, reads the ledger, and repeats migration checks during cleanup. None of those paths may be imported or called by Task 002.
- `browser-test/backend.mjs:9-49` demonstrates reviewed identity metadata, Docker ownership checks, loopback endpoint pinning, certificate pinning, UUID/version checks, and environment injection. It uses root as the application account and is therefore a pattern source, not the Task 002 runner.
- `package.json:6-19` has no guarded Inventory API/MySQL integration command.
- Docker availability and any reusable isolated resource are unverified. No target may be assumed to exist.

### Proposed isolation model

Use a **reuse-first target decision with a disposable per-run database**:

1. After separate approval, perform a read-only inventory of existing Docker test resources. A target is reusable only if its reviewed identity record proves it is dedicated to ENTER-FLOW integration testing, uses MySQL 8.4.13, is loopback-only, uses tmpfs with no bind/volume mount, has the pinned image, and is not shared with development or another active run.
2. If no target qualifies, stop and request separate approval to create one ephemeral Docker container by adapting only the safe ownership/TLS portions of the existing harness. Creation is not an automatic fallback.
3. For either target mode, use a unique database name `enterflow_it_<runId>`, where `runId` is 16 lowercase hexadecimal characters from 8 cryptographically random bytes. The database is empty before schema initialization and owned by exactly one run.
4. A reused target persists, but its per-run database and accounts are disposable. A run-created target is itself disposable and uses tmpfs; only the exact container created and identity-pinned by that run may later be removed.
5. Failure defaults to evidence retention. Automatic container/database removal is allowed only after the test and owned-row cleanup succeed, identity is reverified, and the run-created ownership record matches. Otherwise close connections, redact secrets, preserve the isolated target, and require explicit cleanup review.

The target provider must expose the same identity contract in both modes. It may not reuse `database/compose.dev.yaml`, its database, port, account, password, volume, network identity, or environment file.

### Target identity record and rejection rules

The reviewed non-secret identity record must contain: run/owner ID; target mode; exact container ID/name; required label key/value; pinned image digest; storage model; host and port; database name; MySQL version; server UUID; TLS server name; CA digest and server-certificate SHA-256; `lower_case_table_names`; approved SQL mode; creation timestamp; and whether the run may remove the container. Actual credentials and private keys are excluded.

Before selecting a database or making any write, the future runner must:

1. Match Docker context/engine, exact container ID/name/label/image, running state, tmpfs `/var/lib/mysql`, absence of bind/volume mounts, one `127.0.0.1` port binding, and a port not in `3306-3309`.
2. Establish a strict TLS connection without a default database. Require CA validation, hostname/expected-identity validation, an authorized socket, and the pinned peer-certificate digest.
3. Read only identity/session metadata and require MySQL `8.4.13`, the pinned server UUID, `lower_case_table_names=0`, approved strict SQL modes, UTC session time zone, and the expected TLS status.
4. Reject `enterflow_db`, all MySQL system schemas, any unexpected database, any development endpoint including `127.0.0.1:3308`, a missing identity field, a mutable name-only match, an unexpected certificate/UUID/image/storage model, or evidence of another active owner.
5. Only after these checks may the provisioner create/select the exact run database and accounts. Every later connection—including schema, fixture, API, verifier, and cleanup connections—must repeat the host/port, selected database, UUID, version, TLS, and certificate checks before its first permitted statement.

### Preventing development fallback

Add a dedicated future sentinel, `INTEGRATION_TEST_RUNTIME=1`; do not repurpose `BROWSER_TEST_RUNTIME`. `loadRuntimeEnvironment` must skip `.env.dev` only for this explicit mode and validate the full integration identity configuration. A launcher must create an allowlisted child-process environment from scratch, not spread inherited `DB_*` variables. It must explicitly supply the restricted API account, TLS CA path, server name, loopback API binding, exact origin, random approved API port, UTC, and session timeouts.

The launcher must finish target identity, schema, grant, and fixture verification before dynamically importing or spawning `backend/src/server.js`. Importing the database pool or API earlier is a hard failure. The API process receives only the API runtime credential; it never receives provisioner, schema, fixture, cleanup, Docker, or target-removal credentials.

## 2. Database accounts and exact permissions

All account names are run-scoped, use generated high-entropy passwords held in memory or an ignored local secret source, require TLS, and are restricted to the exact run database. No run account has privileges on `enterflow_db`, another application schema, or `mysql.*`. Account host restrictions must be derived from and locked to the verified connector origin; `%` requires separate justification and approval even on a loopback-bound ephemeral target.

### Actual API SQL and runtime grants

The selected workflow reaches no repository layer beyond the listed services; SQL is issued directly through the `mysql2/promise` pool. Password hashing/verification, origin/rate limiting, the JavaScript permission map, controllers, and response construction perform no SQL.

| Phase | Source and function | SQL operation and tables | Exact API privilege |
| --- | --- | --- | --- |
| Server startup | `backend/src/server.js:5-16`; `backend/src/config/database.js:38-49` `testDatabaseConnection` | Table-free `SELECT DATABASE(), VERSION()` | No table privilege; authenticated connection to the selected database is sufficient |
| Login account lookup | `backend/src/services/auth.service.js:38-108` `login` | `SELECT` from `users` by email/username | `SELECT` on `users` |
| Password verification | `backend/src/services/password.service.js:18-30` `verifyPassword` | Argon2id verification in process; no SQL | None |
| Login session creation | `backend/src/services/session.service.js:46-75` `createSession` | `INSERT INTO user_sessions ... SELECT ... FROM users` | `INSERT` on `user_sessions`; `SELECT` on `users` |
| Inventory authentication | `backend/src/middleware/auth.middleware.js:63-105`; `backend/src/services/session.service.js:78-108` `validateSession` | `SELECT` from `user_sessions INNER JOIN users` | `SELECT` on `user_sessions` and `users` |
| Session activity refresh | `backend/src/middleware/auth.middleware.js:77-80`; `backend/src/services/session.service.js:110-130` `updateSessionActivity` | `UPDATE user_sessions INNER JOIN users`, modifying only `user_sessions.last_activity_at` while reading both tables | `UPDATE` on `user_sessions`; `SELECT` on `user_sessions` and `users` |
| Permission check | `backend/src/routes/inventory.routes.js:13-19`; `backend/src/middleware/permission.middleware.js:16-32`; `backend/src/config/permissions.js:61-67,104-117` | JavaScript map lookup; no SQL or role-table lookup | None |
| Inventory retrieval | `backend/src/controllers/inventory.controller.js:21-37`; `backend/src/services/inventory.service.js:105-140` `list` | One `SELECT` from `materials`; one `SELECT` from `finished_goods` | `SELECT` on `materials` and `finished_goods` |

Therefore the API runtime grant is exactly: `SELECT` on `users`, `user_sessions`, `materials`, and `finished_goods`; `INSERT` on `user_sessions`; and `UPDATE` on `user_sessions`. It requires no privilege on `roles`, `units`, `material_categories`, or any other table. It receives no `DELETE`, DDL, `GRANT OPTION`, account-management, audit, reference-data, or Inventory-write privilege.

### Run accounts

| Authority | Grant level | Exact required privileges | Explicitly forbidden |
| --- | --- | --- | --- |
| Schema initializer | Database: ``enterflow_it_<runId>.*`` | `CREATE`, `REFERENCES` | `SELECT`, `ALTER`, `DROP`, `INDEX`, `CREATE VIEW`, `CREATE ROUTINE`, `EVENT`, `TRIGGER`, DML, grants, account management |
| Fixture writer | Table | `SELECT, INSERT` on `roles`, `units`, `users`, `materials` only | DDL; `UPDATE`/`DELETE`; sessions; audit; other tables/schemas |
| API runtime | Table | Grants exactly as established above | Any other table or privilege |
| Cleanup/verifier | Table | `SELECT` on `roles`, `units`, `users`, `user_sessions`, `materials`, `finished_goods`; `DELETE` on `user_sessions`, `materials`, `users` | DDL; `INSERT`/`UPDATE`; reference-row deletion; grants; other tables/schemas |

`CREATE` is sufficient for indexes declared inside `CREATE TABLE`; `INDEX` is needed only to change indexes on existing tables and is not granted. `REFERENCES` is required on the parent tables for foreign-key creation. Because `CREATE` and `REFERENCES` are already privileges on each created table, they also satisfy the “some privilege for the table” requirement for `SHOW CREATE TABLE` and expose the applicable table/index/constraint metadata. The initializer does not need `SELECT` to compare definitions.

Each of the four run accounts must connect separately and execute `SHOW GRANTS` for its **current user**; the runner canonicalizes and compares the result to the allowlist above. `SHOW GRANTS FOR` another account would require `SELECT` on `mysql.*`, so the plan explicitly rejects that broader privilege. Missing or extra grants, roles, or inherited privileges are fatal.

### Provisioning and teardown authority

The provisioner is a fifth, run-scoped administrative account outside the four run accounts. MySQL requires a delegated grantor to possess both each privilege it grants/revokes and `GRANT OPTION` at the applicable level. Direct use of those privileges therefore cannot be cryptographically prevented while delegation is active. The safe correction is exact table scope, short phase-bound activation, immediate revocation before runtime, and no provisioner credential in the API/fixture processes.

| Phase | Account | Grant level | Privilege | `GRANT OPTION` | Purpose |
| --- | --- | --- | --- | --- | --- |
| Provisioning | Provisioner | Global | `CREATE USER` | No | Create the four run accounts; this privilege also permits their later removal, so it is revoked immediately after provisioning |
| Provisioning only | Provisioner | Exact ``enterflow_it_<runId>.*`` | `CREATE` | Yes | Create the one run database and delegate `CREATE` to the schema initializer; revoke before initialization starts |
| Provisioning only | Provisioner | Exact ``enterflow_it_<runId>.*`` | `REFERENCES` | Yes | Delegate FK-creation authority to the initializer; revoke before initialization starts |
| Initialization | Schema initializer | Exact ``enterflow_it_<runId>.*`` | `CREATE`, `REFERENCES` | No | Create only the approved 11-table snapshot and its FKs |
| Post-schema grant phase | Provisioner | `roles` | `SELECT`, `INSERT` | Yes | Delegate the union required by fixture and cleanup accounts |
| Post-schema grant phase | Provisioner | `units` | `SELECT`, `INSERT` | Yes | Delegate the union required by fixture and cleanup accounts |
| Post-schema grant phase | Provisioner | `users` | `SELECT`, `INSERT`, `DELETE` | Yes | Delegate the union required by fixture, API, and cleanup accounts |
| Post-schema grant phase | Provisioner | `user_sessions` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Yes | Delegate the union required by API and cleanup accounts |
| Post-schema grant phase | Provisioner | `materials` | `SELECT`, `INSERT`, `DELETE` | Yes | Delegate the union required by fixture, API, and cleanup accounts |
| Post-schema grant phase | Provisioner | `finished_goods` | `SELECT` | Yes | Delegate read access to API and cleanup accounts |
| Runtime | Provisioner | All levels | `USAGE` only; account locked or credential unavailable | No | No runtime role; it cannot read or modify fixture/API data |
| Teardown only | Provisioner | Global | `CREATE USER` | No | Execute account-level `REVOKE ALL PRIVILEGES, GRANT OPTION` for the four allowlisted run accounts, then drop them; no database/table DML is reacquired |
| Teardown only | Provisioner | Exact ``enterflow_it_<runId>.*`` | `DROP` | No | Drop only the owned run database; never grant global `DROP` |

The target administrator performs two narrowly bounded bootstrap actions that the provisioner cannot safely perform for itself: create/activate the provisioner with the phase-specific grants, and revoke/lock it after the phase. The table-level privileges with `GRANT OPTION` are added only after the initializer has created and round-trip-verified the 11 tables. MySQL permits grants on nonexistent tables only when the granted set includes `CREATE`; pre-granting the DML union would therefore add unwanted table-creation authority and is prohibited.

Provisioning order is: activate provisioner with global `CREATE USER` and database-level `CREATE, REFERENCES WITH GRANT OPTION`; create the database and four accounts; grant the initializer; then have the target administrator apply account-level `REVOKE ALL PRIVILEGES, GRANT OPTION` to the provisioner before initialization begins. Run and verify schema initialization; have the target administrator add only the exact six-table union with `GRANT OPTION`; grant the approved table permissions to the fixture/API/cleanup accounts; self-verify all five accounts; then the target administrator again applies account-level `REVOKE ALL PRIVILEGES, GRANT OPTION` to the provisioner and locks or makes its credential unavailable before any fixture or API process starts.

Teardown is a separate approval and phase. After the API is stopped, pools are closed, owned-row cleanup succeeds, and identity is reverified, the target administrator reactivates the same provisioner with only global `CREATE USER` and database-level `DROP` for the exact run database. MySQL's special account-level `REVOKE ALL PRIVILEGES, GRANT OPTION FROM <account>` is authorized by `CREATE USER`; unlike ordinary privilege-specific `REVOKE`, it does not require reacquiring every revoked privilege and `GRANT OPTION`. The four accounts are already required to have no roles or unapproved grants. The provisioner applies this statement only to their four exact account names, each account self-verifies `USAGE`, then the provisioner drops them and the owned database. Do not confuse this with `REVOKE ALL ON *.*`, which is global-scope privilege revocation and remains prohibited. The target administrator then removes the provisioner. A separate teardown account would not reduce peak privileges and would add another privileged credential; use one only if an operator requires separation of duties. The stronger optional model is for the pre-existing target administrator to perform account/grant/database teardown directly, in which case the provisioner receives no teardown privileges.

At no phase does the provisioner receive DML or `GRANT OPTION` on `payment_terms`, `material_categories`, `filter_types`, `clients`, or `product_specifications`, nor database-wide DML, global data privileges, `SELECT` on `mysql.*`, direct grant-table DML, global `DROP`, or wildcard-schema authority. If the server is `read_only`, MySQL additionally requires `CONNECTION_ADMIN` for account/grant changes; this plan rejects such a target rather than adding that global privilege.

## 3. Approved schema initialization

The only schema source is `docs/integration-test-schema/inventory-auth.schema.proposed.sql`. Its approved raw-byte SHA-256 is:

`20675e7330b692f4fa20ac6f8a8d476d9e042f8a09c00ae96e2e08cfc9391caf`

The future initializer must perform this order:

1. Before target access, hash the file exactly as raw bytes under the Task 003 contract: UTF-8 without BOM, LF only, all whitespace/comments/semicolons and the single final LF included, no normalization. Require the approved digest and require the manifest to parse with the same file reference and 11-table order.
2. Using the target administrator/provisioner—not a run account—prove the exact selected run database is empty: no base tables, views, triggers, routines, events, or migration ledger. Any object is a rejection, not a reset request.
3. Parse the approved artifact with a narrow parser that accepts exactly the 11 allowlisted `CREATE TABLE` statements and comments. Execute one table statement at a time with `multipleStatements=false`, in manifest order: `roles`, `payment_terms`, `material_categories`, `units`, `filter_types`, `clients`, `users`, `user_sessions`, `product_specifications`, `materials`, `finished_goods`.
4. Do not run migrations, seeds, a migration runner, a ledger initializer, or any code path from `database/migration-core.mjs`. Do not inspect or hash any migration.
5. With the initializer, require the exact 11 visible base tables, obtain each `SHOW CREATE TABLE` value under MySQL 8.4.13, and apply the exact Task 003 table-level AUTO_INCREMENT normalization. Require every manifest per-table SHA-256 to match. The hash match is the authoritative verification of columns, primary/unique/ordinary indexes, 12 foreign keys, and 3 CHECK constraints.
6. With the target administrator/provisioner, independently query the data dictionary for the exact schema and require no extra base tables, views, triggers, routines, or events before and after initialization. Also verify FK/CHECK enforcement. MySQL requires `TRIGGER` to see all trigger metadata, `EVENT` to display events, and routine privileges or global `SHOW_ROUTINE` to see all routines; those privileges can also create/display/execute stored objects and are deliberately not granted to a run verifier. Complete absence is therefore an administrator attestation captured in the run evidence, not an assertion made by a visibility-limited account. Do not weaken comparison to accommodate rendering drift.

MySQL DDL is not transactional. If any statement or round-trip check fails, stop immediately; do not retry, alter, drop, repair, migrate, or load fixtures. Preserve the isolated run database and sanitized diagnostics for review.

## 4. Fixture lifecycle

### Exact reference fixtures

The proposed reference rows for separate execution approval are:

- `roles`: `code='warehouse'`, `label='Warehouse'`.
- `units`: `code='pcs'`, `label='Pieces'`.

These labels are synthetic isolated reference values, not copied from development. Their exact approval is still required before implementation. All other reference tables remain empty.

### Synthetic Warehouse employee

Generate `runId` and the password exactly as specified by Task 003. Insert directly with the fixture account; do not call the Admin employee-creation API.

- Omit generated `id`, `created_at`, and `updated_at`; capture the positive decimal-string ID returned by MySQL.
- Set `role_code='warehouse'`, `client_id=NULL`, `account_type='employee'`, `display_name='Task 002 Warehouse <runId>'`, `email='warehouse.<runId>@example.invalid'`, and `username='ef_it_warehouse_<runId>'`.
- Set `phone`, `employee_number`, `department`, `job_title`, and `joined_on` to `NULL`; set `active=1` and `email_alerts=1`.
- Generate 32 cryptographically random bytes, encode base64url as the 43-character login password, keep it only in process memory, and hash it with `backend/src/services/password.service.js` `hashPassword`. Never persist or log the plaintext. Require the resulting nonempty Argon2id hash to fit `VARCHAR(255)`.

### Synthetic material

Use one row owned by the run:

- `item_code='EF-IT-MAT-<runId>'`, `name='Task 002 Material <runId>'`, `unit_code='pcs'`, `unit_price=0.0000`, `active=1`.
- Set `category_code`, `source_unit`, all reference-price source/value/page/row fields, all approved-costing fields, `quantity_on_hand`, `reorder_threshold`, and `supplier_name` to `NULL`.
- Set `reference_price_status='unreviewed'`, `quantity_status='unknown'`, and `threshold_status='unknown'` explicitly; omit generated timestamps.

This deliberately represents unknown stock/provenance. It must not be interpreted as real inventory, reserved stock, or authoritative pricing. `clients`, `payment_terms`, `material_categories`, `filter_types`, `product_specifications`, and `finished_goods` remain empty. `user_sessions` is empty until the actual login endpoint creates a row.

### Ownership record and cleanup predicates

Before fixture SQL, create a durable local run journal with state `prepared`, the target identity digest, database name, run ID, fixture-definition digest, and a fixture transaction nonce. Insert the reference rows, user, and material in one InnoDB transaction. Capture the user/material IDs and exact ownership markers, durably replace the journal before commit, commit once, then mark it `committed`. This ordering covers a crash immediately before or after commit: a `prepared` journal triggers read-only reconciliation, never blind cleanup. It must contain no password, password hash, cookie, raw token, account password, or CA private material. The journal, actual identity record, and secrets must be gitignored before implementation.

The ownership record must include the exact user ID, role/account type, display name, email, username, active flags and creation-time window; the exact material ID, item code, name, unit, NULL/unknown fields and creation-time window; and pre-login proof that this user had zero sessions. After login, capture every session ID for the owned user plus `SHA-256(token_hash)` (a second digest, not the raw token or stored token hash), expiry, creation, activity and revocation timestamps. A partial fixture is owned only when its stored values and target identity match the prepared journal; a run ID or prefix alone is never ownership proof.

Cleanup first revalidates the container, TLS certificate, server UUID, database name and run journal. It reads each candidate by captured ID and all immutable run markers, requires one user and one material at most, and stops on duplicates, missing committed rows, out-of-window timestamps, or any mismatch. For a `prepared` journal, reconcile whether the transaction committed: zero matching fixture rows means no row cleanup; the complete matching set may be cleaned; any partial/mismatched set is retained for review.

After the API is stopped and all pools are closed, cleanup proceeds in FK-safe order:

1. Select sessions only for the fully matched owned user. For each captured session require matching `id`, `user_id`, timestamps, revocation state, and second digest of `token_hash`. A session created during an interruption before evidence capture may be included only if its `user_id` matches the owned synthetic user and its `created_at` is within the journaled API-run window. Delete by both session ID and user ID; never by prefix or time alone.
2. Delete `materials` only where ID, item code, name, unit code, NULL approver/provenance/stock fields, statuses, and creation-time window all match the journaled row.
3. Before user deletion, independently require zero `user_sessions` for the user, zero `materials.costing_price_approved_by` references, and zero `finished_goods.updated_by` references. Any unexpected inbound reference stops cleanup. Delete `users` only where ID, email, username, display name, role/account type, and creation-time window all match.
4. Independently read back by both captured IDs and unique markers and require zero sessions, zero material rows, and zero user rows. Recheck that the approved `warehouse` and `pcs` reference rows remain exactly unchanged.

Require exact expected affected-row counts at every step. Never delete the `warehouse` role or `pcs` unit in row cleanup. Never truncate tables, delete by run ID/prefix alone, disable FK checks, reset AUTO_INCREMENT, infer ownership from target location alone, or clean another run. Database/account/container teardown is a later provisioner phase and requires its own ownership recheck and approval.

## 5. Exact API test sequence

The future test is one serial scenario. Every failure stops forward progress and enters the failure policy in section 6.

1. Validate local artifacts, raw snapshot digest, manifest consistency, target identity record, and clean allowlisted child environment without opening the API.
2. Verify target/container/TLS/server identity without a selected database; provision or select only the approved run database and run-scoped accounts.
3. Verify exact grants; initialize and round-trip-verify the 11-table snapshot.
4. Insert and independently read back the two approved reference rows, employee, and material. Require the expected values and empty `user_sessions`/`finished_goods`.
5. Select an available loopback API port, set an exact loopback `APP_ORIGIN`, start the actual server in the clean child process, and wait for its normal readiness signal. No mock database hook may be loaded.
6. Send `POST /api/auth/login` with JSON `{ "identifier": "warehouse.<runId>@example.invalid", "password": <in-memory password> }`, the exact allowed Origin, and no preexisting cookie. Require the documented success status/body, Warehouse actor fields, and one HttpOnly session cookie. Never print the password or full cookie.
7. Independently query `user_sessions` with the cleanup/verifier account. Require exactly one unrevoked row for the captured user, future expiry, and a 64-character token hash equal to SHA-256 of the received cookie token. Journal the session ID and only a second SHA-256 digest of the stored token hash, plus its timestamps; do not persist the cookie or stored token hash.
8. Send authenticated `GET /api/inventory` with that cookie and exact Origin. Require success, one material matching the owned ID/code and all explicit NULL/unknown values, and an empty finished-goods collection. Reject extra material/business rows because the database began empty.
9. Independently read `materials`, `finished_goods`, and `user_sessions`. Require material equality, zero finished goods, and `last_activity_at` not earlier than the post-login request baseline. This proves API response and MySQL state agree.
10. Stop accepting requests, terminate the API cleanly, close its pool, remove temporary CA files, then perform the guarded owned-row cleanup and zero-row verification.
11. Recheck target identity and reference rows. For a reusable target, hand the empty-of-run-data database to the separately approved database/account teardown procedure. For a run-created target, remove it only if all success and ownership conditions are satisfied; otherwise retain it.

No Admin employee API, Inventory mutation, audit event, stock reservation/deduction, Sales flow, cloud storage, or migration operation is part of this scenario. `audit_events` is not required and no audit privilege is granted.

## 6. Failure handling and cleanup

| Failure point | Required response |
| --- | --- |
| Artifact/manifest mismatch | Stop before target access. Do not rewrite artifacts or baseline. |
| Docker/identity/TLS/environment mismatch | Close the attempted connection; stop before database selection or writes. Do not inspect or repair the candidate target. |
| Unexpected schema/object/grant | Stop before initialization/fixtures. Preserve sanitized evidence; do not drop, revoke, or broaden grants automatically. |
| Partial DDL or round-trip mismatch | Stop; no fixtures/API. Retain the isolated database for manual review because DDL is nontransactional. |
| Fixture transaction interruption | Stop; no API. Reconcile the durable `prepared` journal read-only: zero rows needs no cleanup; a complete matching transaction may use explicitly enabled cleanup-only mode; any partial or mismatched state is retained. |
| Login/session/inventory/readback failure | Stop new requests, preserve sanitized HTTP/SQL evidence, close API/pools, then attempt only guarded owned-row cleanup. Never weaken assertions or grants. |
| Cleanup predicate/count mismatch | Stop cleanup immediately and retain the isolated target. Never escalate to broad delete/drop/container removal. |
| Process interruption | Signal handlers close API/pools and write an incomplete-run marker. A later cleanup-only invocation must revalidate all identity and ownership evidence before any delete. |

Secret values are redacted at their source. Reports may include account names, privilege names, IDs, timestamps, hashes, statuses, row counts, and sanitized error classes, but not passwords, hashes usable for login, cookie/token values, connection strings containing credentials, or container environment secrets.

## 7. Migration-readiness strategy

Task 002 is snapshot-only. It must not import the migration core, enumerate a migrations directory, inspect filenames, calculate migration checksums, create a migration ledger, run migrate/seed/status/baseline commands, or compare migration history. Protected Migration 007 and its file, history, and checksum remain outside every setup, test, report, and cleanup code path.

Future migration testing requires a separate task and approval. Before that task, define a migration-specific disposable target, an authorized migration source set that explicitly excludes protected access unless authority changes, ledger handling, upgrade/baseline cases, destructive-failure recovery, and independent evidence. None of those concerns may be silently folded into this Inventory API test.

## 8. Tests, evidence, and completion criteria

### Focused guard tests required during implementation

- Runtime config skips `.env.dev` only for the explicit integration sentinel and rejects `enterflow_db`, system schemas, development port 3308, missing identity fields, inherited/unallowlisted DB variables, and non-loopback API/database bindings.
- Identity verifier rejects wrong container ID/name/label/image, mounts, UUID, version, certificate/CA, server name, port, selected database, SQL mode, time zone, and ownership.
- Grant comparator rejects every extra or missing privilege.
- Snapshot parser accepts the approved artifact only, rejects any extra executable statement, preserves manifest order, and reproduces the raw and all 11 per-table hashes.
- Cleanup refuses wrong IDs/markers, duplicate rows, changed target identity, missing ownership evidence, and any non-owned container.
- No guard test imports migration code or accesses migration artifacts.

### Required successful-run evidence

- Approved plan/target/grant/fixture authorization identifiers.
- Sanitized target identity and ownership evidence, pinned image, UUID/version, TLS authorization and certificate digests, storage and loopback endpoint.
- Snapshot path, raw digest, exact table list/order, 11 successful table hashes, FK/CHECK/trigger results, and canonical grant comparison.
- Sanitized fixture rules and captured decimal-string IDs; no business/development data.
- Actual login and Inventory HTTP statuses, bounded redacted response assertions, cookie security-attribute assertions, session-token hash comparison, DB readback values, and timestamps.
- Cleanup predicates and exact affected/readback counts, resource disposition, and any retained-target reason.
- A Database Change Report distinguishing isolated schema/data/account changes from development; development must report none.

Task 002 is complete only when an approved implementation produces this evidence on a verified isolated target, proves owned cleanup/repeatability with a second fresh run, and leaves development unaddressed and unreachable. Source checks, mocks, or an HTTP response without independent MySQL readback are insufficient.

## 9. Expected future implementation files

Minimum proposed changes, subject to separate implementation approval:

- `backend/test/support/integration-target.mjs`: target identity contract, provider interface, TLS/UUID checks, grant comparison, guarded connections, ownership record, and cleanup-only entry point. It must not import the old migration harness.
- `backend/test/support/inventory-schema-snapshot.mjs`: raw digest check, narrow 11-statement parser, initializer, exact set/object verification, and Task 003 per-table canonical hashing.
- `backend/test/fixtures/inventory-auth.fixture.mjs`: approved reference/employee/material value generation, Argon2 helper use, captured ownership metadata, and parameterized fixture/cleanup statements.
- `backend/test/inventory-auth.mysql.integration.mjs`: serial orchestration, actual HTTP requests, independent SQL readback, evidence generation, and failure handling.
- `backend/src/config/runtime-config.js`: explicit integration runtime branch that prevents `.env.dev` fallback and validates isolated target configuration.
- `backend/src/config/runtime-config.test.js`: fail-closed unit coverage for the new branch.
- `backend/test/integration-target.example.json`: non-secret identity-record schema/example only; actual reviewed identity and run evidence remain ignored local files.
- `.gitignore`: narrowly ignore actual integration identity, secrets, temporary CA, run evidence, and incomplete-run markers.
- `package.json`: one guarded command such as `test:mysql:inventory-auth`; it must do nothing without the explicit approval/identity inputs.
- `docs/TESTING.md`: operator prerequisites, review gates, safe command, evidence locations, cleanup-only procedure, and warnings against legacy MySQL runners.

The approved SQL snapshot, manifest, and Task 003 documentation remain unchanged. No new packages, development Compose changes, cloud resources, or general-purpose migration hooks are needed. A Docker provider file is added only if target creation is separately approved; otherwise the runner consumes a pre-reviewed existing target.

## 10. Risks, unresolved prerequisites, and approvals

Before implementation or execution:

1. Approve read-only Docker inventory and determine whether a reusable isolated target exists. Docker availability is currently unverified.
2. Approve either the exact existing target identity or creation/removal of a new owned tmpfs container. This plan does not choose or create one without that evidence.
3. Identify the pre-existing target administrator that will bootstrap/revoke the phase-bound provisioner, perform the complete object-absence audit, and review its sanitized attestation. Approve the provisioner's temporary global `CREATE USER`, database-level `CREATE, REFERENCES WITH GRANT OPTION`, exact six-table delegation union, runtime revocation/lock, teardown-only reactivation and database-level `DROP`, account host restrictions, and all four run-account grant sets.
4. Approve schema/database/account creation and teardown, exact snapshot execution, MySQL 8.4.13 round-trip checks, and failure-retention behavior.
5. Approve reference labels `Warehouse` and `Pieces`, the exact synthetic material contract, ephemeral employee/password generation, direct fixture inserts, session writes/activity update, independent readback, and owned deletes.
6. Approve the explicit runtime-config change, new guarded command/files, and ignored local evidence/secret paths.
7. Confirm the unavailable Phase 1 handoff is not required to authorize this narrow infrastructure workflow, or supply it for review. No missing business rule has been invented here.

Any expansion to Admin creation, Inventory mutation, audit events, stock operations, other roles, other APIs, broader tables/grants, development access, or migration testing requires a new dependency/security review and separate approval.

## 11. Step-by-step implementation order after approval

1. Record the approvals and freeze exact target, grants, fixtures, snapshot digest, and expected evidence.
2. Add fail-closed runtime configuration and focused rejection tests; confirm the API cannot load development configuration in integration mode.
3. Implement artifact digest/parser/hash verification entirely offline and verify it against the approved manifest.
4. Implement target identity/TLS/ownership checks and the grant comparator without any provisioning or mutation capability.
5. With separate read-only Docker approval, inventory the candidate target and produce a sanitized target review record. Stop if none qualifies.
6. If necessary and separately approved, implement the minimal owned tmpfs Docker provider; do not copy migration-related code from the old harness.
7. Implement provisioner handoff and the four restricted connection factories; prove API credential separation.
8. Implement schema initialization and post-create round-trip verification with fail-retain behavior.
9. Implement deterministic fixture generation, captured ownership evidence, independent readback, and guarded cleanup.
10. Implement the serial actual HTTP login/session/Inventory scenario and sanitized evidence report.
11. Add interruption/cleanup-only handling, then documentation and the single guarded package command.
12. Run focused guard tests first. Only after a final execution approval, run the isolated scenario, review evidence, cleanup, and repeat once with a fresh run ID.
13. Stop and deliver the Task 002 completion record; do not begin migration or broader API work.

## 12. Safeguard confirmation and Database Change Report

This planning task read only the named documentation, schema artifacts, and relevant source/configuration files. It did not connect to a database; execute SQL or tests; run Docker; start the API; create users, grants, schemas, fixtures, or sessions; or change application code, configuration, credentials, migrations, schema SQL, manifests, database contents, or Git history. No Git command was performed because the task explicitly prohibited Git operations. Existing uncommitted work was preserved.

Tables reviewed as offline definitions/workflow dependencies: `roles`, `units`, `users`, `user_sessions`, `materials`, `finished_goods`, plus the remaining five allowlisted definitions required by the approved FK closure. Schema changes proposed for development: none. Isolated schema/data/account operations proposed: only those listed above, all pending separate approval. Schema/data changes performed: none. Migrations created/applied: none. Database operations performed: none. Protected Migration 007, its source, history, and checksum were not accessed, inspected, enumerated, hashed, executed, modified, or validated.

READY FOR IMPLEMENTATION REVIEW
