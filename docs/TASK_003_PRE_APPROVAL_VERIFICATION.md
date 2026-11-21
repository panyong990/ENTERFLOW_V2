# Task 003 pre-approval verification

Date: 2026-11-21 (Asia/Singapore)
Scope: static source and offline artifact verification only. No SQL or database connection was made.

## 1. Authentication, session, Inventory, and audit path

| Classification | Finding | Evidence |
| --- | --- | --- |
| **VERIFIED** | API startup performs one table-free identity query before listening: `SELECT DATABASE(), VERSION()`. This requires a usable connection but no application table beyond the snapshot. | `backend/src/server.js:5-16`; `backend/src/server-lifecycle.js:50-85`; `backend/src/config/database.js:38-49` |
| **VERIFIED** | `POST /api/auth/login` runs same-origin and in-memory rate-limit middleware, then `loginUser`. Request IDs and request-completion logs are generated in memory/console; none writes a database audit row. | `backend/src/app.js:36-55`; `backend/src/routes/auth.routes.js:24-66`; `backend/src/middleware/origin.middleware.js:1-40`; `backend/src/middleware/login-rate-limit.middleware.js:1-52`; `backend/src/middleware/request-id.middleware.js:1-10`; `backend/src/middleware/request-log.middleware.js:1-17`; `backend/src/controllers/auth.controller.js:55-78` |
| **VERIFIED** | Login executes one `SELECT` from `users`, verifies the Argon2 hash, then calls session creation. No role/reference/audit table is queried by login. | `backend/src/services/auth.service.js:38-108`; `backend/src/services/password.service.js:18-30` |
| **VERIFIED** | Session creation executes `INSERT INTO user_sessions ... SELECT ... FROM users`. The authenticated request then executes a `SELECT` joining `user_sessions` to `users` and an `UPDATE user_sessions ... JOIN users` to refresh activity. | `backend/src/services/session.service.js:46-129` |
| **VERIFIED** | Authenticated `GET /api/inventory` applies the JavaScript permission map, then performs one `SELECT` from `materials` and one from `finished_goods`. The controller only maps the service result or logs failures to the process logger. | `backend/src/routes/inventory.routes.js:13-19`; `backend/src/middleware/auth.middleware.js:43-105`; `backend/src/middleware/permission.middleware.js:3-33`; `backend/src/config/permissions.js:61-67,104-117`; `backend/src/controllers/inventory.controller.js:21-37`; `backend/src/services/inventory.service.js:105-140` |
| **VERIFIED** | The selected workflow does not read or write `audit_events`. Inventory audit writes occur only in `create`/`update`, and Admin employee creation writes an audit event. Merely importing those services does not execute their SQL. | `backend/src/services/inventory.service.js:142-189,191-273`; `backend/src/services/admin.service.js:140-166`; `backend/src/services/password-change.service.js:5-50` |
| **UNVERIFIABLE** | This source-only pass cannot independently exclude database triggers or other server-side objects hidden from the earlier capture account. The proposal records that no triggers were visible, with the same privilege limitation. | `docs/integration-test-schema/inventory-auth.schema.manifest.json:389`; `docs/integration-test-schema/README.md:45-49` |

Conclusion for this path: the application statements touch only `users`, `user_sessions`, `materials`, and `finished_goods`. Their foreign-key closure is the proposed 11-table set. `audit_events` is not required for direct setup of synthetic fixtures followed by login and `GET /api/inventory`. It must be added, with its own FK closure and privileges, if Task 002 instead creates the employee through Admin APIs, calls `POST/PATCH /api/inventory/materials`, changes a password, or expands to another audited operation.

## 2. Fixture compatibility

| Classification | Finding | Evidence |
| --- | --- | --- |
| **VERIFIED** | `role_code='warehouse'` is an allowed employee role and has `inventory: read`. The `users` CHECK accepts an employee whose role is not `client` and whose `client_id` is NULL, provided the Warehouse reference row exists. | `backend/src/validation/admin.validation.js:3,49-54`; `backend/src/config/permissions.js:61-67`; `docs/integration-test-schema/inventory-auth.schema.proposed.sql:61-87` |
| **VERIFIED** | `unit_code='pcs'` is compatible with Inventory logic and the schema if an approved `units(code='pcs')` reference fixture exists. | `backend/src/services/inventory.service.js:3-5,20-25`; `docs/integration-test-schema/inventory-auth.schema.proposed.sql:25-29,149-185` |
| **ISSUE FOUND** | The proposed employee description is not a complete executable fixture definition. Authentication requires concrete `display_name`, `email`, `username`, valid Argon2 `password_hash`, `active=1`, `account_type='employee'`, `role_code='warehouse'`, and `client_id=NULL`. The README names most concepts but omits `display_name` and an explicit active value. If fixture creation is intended to pass the Admin create-employee API, it additionally needs `employeeId`, `department`, `jobTitle`, a valid email, and an 8-1024 character initial password; that API also requires an Admin actor and `audit_events`. Direct isolated setup need not use that Admin workflow. | `docs/integration-test-schema/README.md:35-41`; `backend/src/services/auth.service.js:38-108`; `backend/src/validation/admin.validation.js:13-14,25-63`; `backend/src/services/admin.service.js:140-166`; `docs/integration-test-schema/inventory-auth.schema.proposed.sql:61-88` |
| **VERIFIED** | An active material with NULL category, quantity, threshold, approved price/approver, and the corresponding `unknown` quantity/threshold statuses satisfies the current CHECKs. `unit_code`, name, and unit price remain required; the proposal supplies an approved unit and relies on the zero unit-price default. The Inventory read does not filter on stock/provenance and returns the NULL values. | `docs/integration-test-schema/README.md:37-41`; `docs/integration-test-schema/inventory-auth.schema.proposed.sql:149-186`; `backend/src/services/inventory.service.js:109-119` |
| **VERIFIED** | An empty `finished_goods` table is compatible. The query returns an empty row array, which is returned unchanged as `data.finishedGoods`. The table definition and FK parents are still required because the query executes. | `backend/src/services/inventory.service.js:120-136`; `docs/integration-test-schema/inventory-auth.schema.proposed.sql:188-208` |
| **NEEDS APPROVAL** | Exact synthetic labels, identifiers, password handling, material code/name, the `warehouse` role row, and the `pcs` unit row remain intentionally unprepared and require fixture-plan approval. | `docs/integration-test-schema/README.md:35-41` |

## 3. API runtime permissions

The proposed runtime grant set is sufficient for the selected workflow when “sessions” is implemented as the actual table name `user_sessions`:

| Operation | Required privilege |
| --- | --- |
| Startup identity check | No application-table privilege (`SELECT DATABASE(), VERSION()`) |
| Login lookup and session `INSERT ... SELECT` | `SELECT` on `users`; `INSERT` on `user_sessions` |
| Session validation and activity refresh | `SELECT` on `users` and `user_sessions`; `UPDATE` on `user_sessions` |
| Inventory response | `SELECT` on `materials` and `finished_goods` |

| Classification | Finding |
| --- | --- |
| **VERIFIED** | The README's proposed API privileges—`SELECT` on users/sessions/materials/finished goods and `INSERT/UPDATE` on sessions—match every application-table operation in this workflow. None is unnecessary for login followed by an authenticated request. |
| **VERIFIED** | The API account needs no `INSERT`, `UPDATE`, or `DELETE` on materials, finished goods, users, roles, units, or audit events; no DDL or migration privileges are needed. Fixture setup and cleanup must use a separate restricted account. |
| **ISSUE FOUND** | Task 002 must spell the table as `user_sessions` in grants and keep fixture cleanup privileges out of the API account. If Admin user creation or Inventory mutation replaces direct setup, the current runtime grants and 11-table snapshot are insufficient because those paths insert `audit_events` and perform additional writes. |

Evidence: `docs/integration-test-schema/README.md:53-57`; the source paths in sections 1-2 above.

## 4. SQL and manifest consistency

Offline verification read the two proposed artifacts only. It did not import the migration runner, inspect migration files, or execute SQL.

| Classification | Finding |
| --- | --- |
| **VERIFIED** | The SQL contains exactly 11 actual `CREATE TABLE` definitions in manifest order: `roles`, `payment_terms`, `material_categories`, `units`, `filter_types`, `clients`, `users`, `user_sessions`, `product_specifications`, `materials`, `finished_goods`. Every FK references an earlier allowlisted table. |
| **VERIFIED** | The SQL contains 11 primary keys, 11 unique indexes, 12 ordinary indexes, 12 foreign-key constraints, and 3 CHECK constraints. The CHECKs are `ck_user_identity`, `ck_material_stock_provenance`, and `ck_material_values`; the manifest records all three as enforced. Ordinary indexes are not itemized structurally in the manifest, but they are present in—and cryptographically covered by—the per-table DDL. |
| **VERIFIED** | All 11 recomputed per-table SHA-256 values match the manifest. The whole SQL file SHA-256 matches `20675e7330b692f4fa20ac6f8a8d476d9e042f8a09c00ae96e2e08cfc9391caf`. The file is UTF-8 text with LF endings. |
| **ISSUE FOUND** | The documented normalization is not precise enough to implement the same hashes. It says only to remove the InnoDB table AUTO_INCREMENT counter, but the stored per-table hash also depends on exact `SHOW CREATE TABLE` rendering, UTF-8/LF bytes, removal of the terminating semicolon, and no other whitespace normalization. Before Task 002, define one canonical function and test it against all 11 current artifact hashes. It should also require MySQL 8.4.13, `lower_case_table_names=0`, the expected charset/collation, and the approved SQL mode before accepting a round trip. |
| **UNVERIFIABLE** | Whether the proposed DDL recreates byte-identical `SHOW CREATE TABLE` output on a fresh MySQL 8.4.13 target cannot be proven without executing it. That execution is outside this task and remains an approval gate. |

Artifact evidence: `docs/integration-test-schema/inventory-auth.schema.proposed.sql:6-208`; `docs/integration-test-schema/inventory-auth.schema.manifest.json:1-390`; `docs/integration-test-schema/README.md:45-57`.

## 5. Pre-approval conclusion

1. **11-table sufficiency — VERIFIED:** sufficient for direct synthetic fixture setup, actual login/session persistence, and authenticated read-only `GET /api/inventory`.
2. **Audit dependency — VERIFIED:** `audit_events` is not needed for that stated workflow. It is required if employee creation or Inventory creation/update is performed through current application APIs.
3. **Fixture compatibility — ISSUE FOUND / NEEDS APPROVAL:** Warehouse, `pcs`, NULL stock/threshold/category, unknown statuses, and empty finished goods are compatible. The employee fixture plan must explicitly add all DB/auth-required fields and decide whether it is direct setup or an Admin API operation.
4. **Runtime permissions — VERIFIED:** the proposed table privileges are sufficient for the selected workflow. Use the exact `user_sessions` name and keep setup/cleanup grants separate.
5. **Corrections before Task 002:** complete the synthetic employee fixture contract; specify and test the exact schema-normalization/hash algorithm; approve fixture values, grants, target, initialization, and cleanup. Add `audit_events` only if the workflow scope changes to an audited endpoint.
6. **Approval readiness — ISSUE FOUND:** the schema content and dependency closure are reviewable and sufficient, but Task 003 is not ready for final approval until the employee fixture contract and canonical hash-normalization contract are corrected. The isolated MySQL round trip remains a separately approved Task 002 gate.

## Database Change Report

- Tables reviewed in source/artifacts: `roles`, `payment_terms`, `material_categories`, `units`, `filter_types`, `clients`, `users`, `user_sessions`, `product_specifications`, `materials`, `finished_goods`; `audit_events` references were traced in source only.
- Schema changes proposed/performed: no new schema change proposed by this verification; **none performed**.
- Data changes proposed/performed: no new data change proposed; **none performed**.
- Migrations created/applied: **none**.
- Database operations: **none**—no connection and no SQL execution.
- Docker, credentials, configuration, tests, application source, schema artifacts, manifest, and Git history: untouched.
- Pending approvals: corrected fixture contract, canonical normalization contract, isolated target, grants, initialization, fixture writes, authenticated session writes, and owned cleanup.
- Protected Migration 007, its file, history, and checksum were not accessed, inspected, enumerated, hashed, modified, or executed.
