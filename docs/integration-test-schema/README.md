# Task 003: proposed current-schema Inventory fixture source

Status: prepared for review, **not approved or executed**. Date: 2026-11-19 (Asia/Singapore).

Sources: root AGENTS.md, Task 001 readiness note, Task 002's completed conversation report, and the current Inventory/authentication/session/permission code. Task 002 has no separate repository report. This task does not change their isolation requirements.

## Artifacts and scope

- `inventory-auth.schema.proposed.sql`: schema-only proposal captured from allowlisted current `SHOW CREATE TABLE` results; no SQL in this file was executed.
- `inventory-auth.schema.manifest.json`: capture time, server settings, exact table creation order, constraint/FK inventory, normalized per-table SHA-256 values and whole-file SHA-256. These hashes cover only these new schema artifacts, never migrations.
- Scenario: future synthetic-material insertion, actual `POST /api/auth/login`, and authenticated `GET /api/inventory` using real MySQL. No inventory mutation, costing, stock-request, Sales or full-application coverage is claimed.

## Exact minimum table closure

The snapshot preserves full table definitions, rather than removing columns or constraints to fit fixtures. SQL and manifest contain exact columns, defaults, indexes, CHECK expressions, FK columns and reference targets.

| Table | Reason / outgoing foreign-key dependencies |
| --- | --- |
| `roles` | Parent for `users.role_code` |
| `payment_terms` | Parent for nullable `clients.payment_term_code` |
| `material_categories` | Parent for nullable `materials.category_code` |
| `units` | Parent for required `materials.unit_code` |
| `filter_types` | Parent for `product_specifications.filter_type_code` |
| `clients` | Parent for users, specifications and finished goods; references payment terms |
| `users` | Login/session lookup and material/finished-goods approver identity; references roles and clients |
| `user_sessions` | Real login creates a session; authenticated requests update activity; references users |
| `product_specifications` | References clients/filter types; provides composite `(id,client_id)` parent |
| `materials` | Inventory SELECT; references categories, units, users |
| `finished_goods` | Inventory SELECT runs even for an empty table; references clients, users and composite specification/client pair |

All PKs, unique and ordinary indexes are retained, including material code/source-row uniqueness, user email/username/employee/client uniqueness, session token uniqueness and expiry/user indexes, category/name lookup, and finished-goods composite relationships. All three current enforced CHECK constraints are retained: `ck_user_identity`, `ck_material_values`, `ck_material_stock_provenance`. The manifest lists every constraint by table.

`modules`/`role_modules` are unnecessary for this route: permission checks use the existing JavaScript permission map. `audit_events` is not queried by the selected login/read path. `material_import_review`, BOM and unrelated workflow tables are outside scope. They must be added/reviewed before testing mutations or broader workflows.

## Approved-shape future fixtures (definitions only; no rows prepared)

Minimum reference records: approved `roles.code=warehouse` and one valid `units` code (proposed `pcs`, consistent with the application allowlist). A category record is optional if the material category is NULL; use an approved category such as `filter_media` only if that field is exercised. Labels must be explicit test/reference values approved with the fixture plan. Do not copy development records or infer reference seeds from migration files.

The employee is inserted directly by the separately privileged fixture setup. It must not use the Admin employee-creation API and therefore does not create an audit event. Generate one `runId` per approved run from 8 cryptographically random bytes encoded as exactly 16 lowercase hexadecimal characters. Given that `runId`, use this complete `users` contract:

| Database column | Database requirement | Fixture value/rule | Application rule and workflow reason |
| --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED`, primary key, `AUTO_INCREMENT` | Omit; MySQL generates it. Capture the positive decimal-string result for session linkage and owned cleanup. | Session creation requires a positive user ID. |
| `role_code` | Required `VARCHAR(24)`; FK to `roles.code` | Literal `warehouse`; prerequisite approved role row required. | Warehouse is an allowed employee role and has `inventory:read`. |
| `client_id` | Nullable `BIGINT UNSIGNED`; FK to `clients.id` | Explicit `NULL` | Required by `ck_user_identity` for an employee; authentication exposes it as NULL. |
| `account_type` | Required `ENUM('employee','client')` | Literal `employee` | Required by `ck_user_identity` and authentication middleware actor construction. |
| `display_name` | Required `VARCHAR(160)` | `Task 002 Warehouse <runId>` | Login/session responses read this field. The generated value is nonempty and at most 35 characters. |
| `email` | Required `VARCHAR(254)`; unique under `utf8mb4_unicode_ci` | `warehouse.<runId>@example.invalid` | Use this as the login identifier. It is nonempty, under 254 characters, and also satisfies the Admin email syntax although that API is out of scope. |
| `username` | Required `VARCHAR(100)`; unique under `utf8mb4_unicode_ci` | `ef_it_warehouse_<runId>` | Authentication selects by email or username. The generated value is nonempty and under 100 characters. |
| `phone` | Nullable `VARCHAR(40)` | `NULL` | Not read by the selected workflow; no application requirement. |
| `password_hash` | Required `VARCHAR(255)` | Generate a 32-byte cryptographically random password encoded as base64url; call the existing `hashPassword` helper and require a nonempty hash no longer than 255 characters. Keep the plaintext only in runner memory for the login request; never log or persist it outside the owned fixture process. | Login accepts a nonempty password up to 1024 characters and verifies the stored Argon2 hash. The generated base64url password is 43 characters. |
| `employee_number` | Nullable `VARCHAR(80)`; unique | `NULL` | Not required by the database employee CHECK or selected workflow. Admin creation would require it, but that API is explicitly excluded. |
| `department` | Nullable `VARCHAR(120)` | `NULL` | Not read by the selected workflow. Admin creation requirements do not apply to direct setup. |
| `job_title` | Nullable `VARCHAR(120)` | `NULL` | Not read by the selected workflow. Admin creation requirements do not apply to direct setup. |
| `active` | Required `TINYINT(1)`, default 1 | Explicit numeric `1` | Login, session creation, validation, and activity refresh all require an active user. |
| `email_alerts` | Required `TINYINT(1)`, default 1 | Explicit numeric `1` | Not read by the selected workflow; explicit value avoids reliance on an implicit fixture default. |
| `joined_on` | Nullable `DATE` | `NULL` | Not read by the selected workflow. |
| `created_at` | Required `DATETIME(3)`, default current timestamp | Omit; database default generates it. | Not read by the selected workflow. |
| `updated_at` | Required `DATETIME(3)`, default current timestamp with automatic update | Omit; database default generates it. | Not read by the selected workflow. |

Database-required fields are established by the snapshot's nullability, types, unique/FK constraints, and `ck_user_identity`. Application-required fields for this scope are the identifier/password pair, a valid stored Argon2 hash, `active=1`, the generated positive user ID, `role_code=warehouse`, `account_type=employee`, NULL client, and display name. Admin-only requirements (`employeeId`, department, job title, Admin actor and audit event) are intentionally inapplicable because this fixture does not use that API.

Future synthetic active material: unique run-owned code/name, approved unit, NULL category/quantity/threshold/approved-price/approver fields and `unknown` stock/threshold statuses. This satisfies current provenance constraints without fabricating stock. Separate execution approval is required before preparing or inserting rows.

Keep clients, specifications, finished goods, payment terms and filter types empty for this first raw-material scenario. Their definitions remain required by foreign keys. The session starts empty and is created only by the future login request. Fixture cleanup must remove only run-owned sessions, user and material rows; leave reused reference rows intact.

## Capture evidence and exclusions

Connected directly with existing configuration and strict CA/name-verified TLS; selected identity was `enterflow_db`, MySQL 8.4.13. Queries were limited to server/session settings, allowlisted `SHOW CREATE TABLE`, and filtered `information_schema` FK/constraint/trigger metadata. No application-table records or migration sources were read. The initial FK closure was checked and every snapshot FK points to an earlier allowlisted table; no external-schema dependencies were accepted.

Excluded: all business/reference records, user records, password hashes, session/token records, credentials, grants, migration ledgers/checksums/history, Migration 007, source PDFs/catalog data, routines/events and unrelated tables. User/session table **definitions** are necessary; no user/session **data** is present. Only live table AUTO_INCREMENT counters were removed; column AUTO_INCREMENT behavior and schema defaults were preserved. No triggers were visible for these tables; source-account privilege limits mean this does not prove that no hidden triggers exist.

Limitations: a schema subset, not a full database backup or migration-integrity claim. Read-only capture does not lock out concurrent DDL; no atomic schema snapshot is claimed. Hidden objects/grants, other modules and later drift are not covered. Captured source time zone was SYSTEM; the future runner must explicitly use UTC and approved strict SQL modes. Artifact hashes bind the captured text; they do not establish approval or successful initialization. MySQL 8.4.13 execution/round-trip validation remains pending.

## Exact digest and normalization contract

The approval digest is the SHA-256 of the complete raw bytes of `inventory-auth.schema.proposed.sql`. The file is UTF-8 without a byte-order mark, contains LF (`0A`) line endings only, and ends with exactly one LF byte. Hash every byte, including comments, blank lines, spaces, semicolons, and the final LF. Do not decode/re-encode, trim, convert line endings, remove a BOM, or perform any normalization before hashing. A BOM is invalid input rather than something to strip. Lowercase hexadecimal is the recorded representation.

Reproduce it in PowerShell without changing the file:

```powershell
(Get-FileHash -LiteralPath 'docs/integration-test-schema/inventory-auth.schema.proposed.sql' -Algorithm SHA256).Hash.ToLowerInvariant()
```

The expected result is `20675e7330b692f4fa20ac6f8a8d476d9e042f8a09c00ae96e2e08cfc9391caf`. The manifest's `snapshotSha256` and `snapshotDigestContract.expectedSha256` cover those raw SQL-file bytes, not JSON, parsed SQL, concatenated table definitions, or normalized `SHOW CREATE TABLE` output.

Per-table hashes serve a separate future round-trip check. Their canonical input is one MySQL 8.4.13 `SHOW CREATE TABLE` **Create Table** string, beginning with `CREATE TABLE` and ending with its final table option, with no semicolon. Require `lower_case_table_names=0`, the manifest SQL mode, and the captured charset/collation. Count matches of the table-options form `) ENGINE=InnoDB AUTO_INCREMENT=<positive decimal> DEFAULT CHARSET=`. With zero matches, leave the input unchanged. With one match, delete exactly ` AUTO_INCREMENT=<positive decimal>`. With more than one match, or if any other table-option `AUTO_INCREMENT=` remains, reject the input. Preserve column `AUTO_INCREMENT`, UTF-8/LF encoding, whitespace, case, quoting, and every other character. Add no BOM or trailing newline. Hash the resulting UTF-8 bytes with SHA-256 and encode lowercase hexadecimal. The future runner must test this canonical function against all 11 manifest table hashes before it may compare an isolated target; execution remains outside Task 003.

## Future initialization and verification (approval required)

1. Verify an existing isolated target first using the established container ID/label/image, loopback endpoint, UUID, TLS and ownership checks. Reject development databases/endpoints and missing configuration before writes or API imports. Do not assume another container is needed.
2. Obtain approval of these exact artifacts/digests, target, fixture plan, grants and cleanup. Initialize only an empty run-owned schema, in manifest order, keeping FK/CHECK enforcement enabled. Do not run migrations, create migration markers or bypass constraints. Never execute this proposal against development.
3. Before fixture loading, require MySQL 8.4.13, approved session modes/UTC, `lower_case_table_names=0`, the exact 11-table set, and per-table hashes produced by the exact canonical procedure above. Reject unexpected/missing definitions, indexes, CHECKs or FKs; investigate any rendering mismatch rather than weakening comparison. Verify trigger absence with sufficient privileges on the isolated target. Compare the raw SQL-file digest to the separately approved digest, not merely a mutable adjacent manifest.
4. Use separate setup/cleanup and restricted API credentials. API needs SELECT on users/sessions/materials/finished_goods and INSERT/UPDATE on sessions for this scenario; it needs no DDL, development access or inventory writes. Setup/cleanup grants are limited to approved test fixtures/owned schema. Validate identity again for actual pool connections and cleanup.
5. Reuse existing TLS and guarded-connection/ownership patterns in a small test-target helper and Inventory runner. Replace the old harness's migration initialization **and cleanup checksum path** with this approved snapshot path. Prevent development environment fallback before dynamically importing the API. Add one guarded package command and focused guard tests; no new packages, development Compose changes, legacy browser-fixture overwrite or cloud configuration are needed.

## Validation and Database Change Report

- Offline validation passed: exactly 11 allowlisted CREATE TABLE definitions, 11 primary keys, 11 unique constraints, 12 foreign keys and 3 enforced CHECKs; file/table hashes and dependency order match the manifest. No other executable statements or migration-ledger definitions. New-file whitespace checks and `git diff --check` passed. No SQL execution or integration tests were needed for this preparation task.
- Reviewed metadata for exactly the 11 tables listed above plus filtered `information_schema` metadata; no live row contents read. Git status checked before work; pre-existing files preserved.
- Proposed schema changes: future isolated creation from this schema subset only; no development modifications. Performed schema changes: **none**.
- Proposed data changes: future approved synthetic reference/account/material fixtures and session lifecycle only. Performed data changes: **none**.
- Migrations created/applied: **none**. Migration 007, its checksum and history were not accessed or modified; no migration source files were inspected.
- Pending approvals: schema artifacts and scope, test target, fixture values, restricted accounts/grants, initialization, authenticated session writes and owned cleanup. No initialization or fixture writes started.
