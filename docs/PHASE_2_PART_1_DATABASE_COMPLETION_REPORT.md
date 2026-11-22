# Part 1 — Phase 2 database architecture and migrations

2026-11-22, Asia/Singapore. **COMPLETE for database architecture and migration acceptance.** Implemented and applied extensions 004–006, verified the actual database and preserved existing records. Part 2 backend rewriting and Part 3 frontend integration were not started.

## Actual starting and final state

Branch: `phase-2/database-erd-corrections`. Inspected Git status, branch and relevant existing diffs first. Preserved the existing backend, proxy, TLS, migration recovery, provisioning and diagnostic work. No branch operation, staging or commit occurred.

The starting database differed from earlier failed-recovery reports: 001, 002 **and 003 were already applied**. This was established by fresh authenticated SELECTs, not assumed. Its full metadata matched the pinned P2B002 contract plus 001–003, with 43 tables/39 triggers. It contained 8 roles, 8 employee users, 8 audit events, 3 sessions and 1 registration application. All other business tables were empty. No completed extension was rerun or edited.

Actual target throughout: **127.0.0.1:62286 / enterflow_phase2_db**, MySQL **8.4.13**, UUID **0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8**, hostname **2acac2d1b606**. Migration connections used the existing descriptor-bound credential and verified TLSv1.3. The migration environment's explicit identity remains 127.0.0.1; the certificate includes both IP Address:127.0.0.1 and DNS:localhost. No environment or TLS identity was changed to perform this work. The application account remains enterflow_phase2_app with its existing application configuration; its schema-wide SELECT/INSERT/UPDATE/DELETE grants were inspected, not modified. No application authentication or runtime acceptance is claimed.

Final schema: **45 tables, 47 triggers**, no views/routines/events. Fresh final preflight returned **PASS**, all checks PASS. All six extension history rows are applied, error_code NULL, and checksums match reviewed source. 001–003 history rows are exactly unchanged from this task's initial read.

## Applied changes

| Extension | Changes | Actual result |
| --- | --- | --- |
| `004_client_requests.sql` | Two request tables, seven ownership/lifecycle triggers | Applied once; complete metadata verified |
| `005_proof_of_payment.sql` | Atomic rename of both proof tables; replacement of two referencing ownership triggers | Applied once; complete metadata, FKs and data verified |
| `006_request_target_history.sql` | Prevent reassignment of a PO quotation after a cancellation request references it | Applied once; live rejection test passed |

Normalized SHA-256:

| File | Checksum |
| --- | --- |
| 004_client_requests.sql | a30c9acb9901d581b2f408718c5312e2384ad2887c84c00da8486d3bad739276 |
| 005_proof_of_payment.sql | 0a2848b9c99857bf9a27e5caa4ff8a67eab603de9a56bca24c2acdd763242c92 |
| 006_request_target_history.sql | 5aadb174b3b460474b565f4ae9d07b5de1e6e3aa643dcd37e9c8451e6bf1207c |

### Cancellation and quotation revision requests

`cancellation_request` stores request_id, inquiry_id, optional quotation_id or po_id, requested_by_client_user_id, reason, status, submitted_at, reviewed_by_user_id, reviewed_at, review_note and generated pending_target_id. Requests cancel the inquiry-level transaction lifecycle; optional references identify the quotation/PO context. A unique pending inquiry key preserves the established one-pending-cancellation-per-order/inquiry rule. No new JO cancellation eligibility was introduced.

`quotation_revision_request` stores the same review/request fields with quotation_id as its target. The quotation FK identifies the exact historical quotation revision; inquiry_id, revision_no and client are obtained through quotation -> inquiry. A generated unique pending quotation key prevents duplicate pending requests. Quotation inquiry/revision identity is protected once referenced.

Neither table duplicates client_id: ownership is established through inquiry.client_id and client_user.client_id, checked by INSERT/UPDATE triggers. Added parent-history triggers prevent later ownership/quotation reassignment from invalidating that proof. Each request has actual FKs to its targets, requesting client_user and reviewing user_account. Foreign keys retain restrictive actions. Status encodes the review decision: pending/approved/rejected; review actor/time consistency, nonblank reason, chronological review and nonblank rejection notes are CHECK-enforced. Reviewers must be active Sales users, matching the established Sales review boundary. Request identity and finalized review fields cannot be overwritten by UPDATE.

Indexes cover target history, pending queue, requester/status/history and reviewer/time. Client history resolves the existing unique company portal user and uses the requester index; no redundant ownership column/index is required. The existing audit_event subject_type/subject_id model supports request events without another audit table. Actual event generation belongs to Part 2.

Revision requests require a current sent quotation before PO creation. Cancellation submission/approval is blocked after a JO or confirmed DOWNPAYMENT in payment_transaction. Pending/rejected/verified proof records remain distinct from actual confirmed payments. Rejection remains possible when a transaction becomes ineligible for approval. Neither submission nor a request decision automatically alters the inquiry, quotation or PO. Actual lifecycle transitions, endpoint authorization, audit insertion and serialization with concurrent accounting/production operations must be implemented together in Part 2; trigger checks alone are not a concurrency protocol.

006 addresses a demonstrated relational gap: the pre-existing PO historical guard covered invoice/JO references but not the newly added cancellation reference. A PO could otherwise change quotation before those downstream records existed. The additional trigger rejects that reassignment without editing applied extensions or existing records. Its live test uses a second valid quotation, not merely an invalid foreign key.

### Proof-of-payment names and dependent objects

Actual new tables are **proof_of_payment** and **proof_of_payment_file**. **client_receipt and client_receipt_file are absent**, with no compatibility objects. All original columns, keys, checks, indexes and document/payment associations are preserved. Existing receipt_id and payment_transaction.client_receipt_id column names were retained because this approval renamed the tables while requiring column preservation; they now reference the renamed model.

MySQL updates inbound FK references and internally named `_ibfk_` constraints during rename; see the [MySQL 8.4 RENAME TABLE specification](https://dev.mysql.com/doc/refman/8.4/en/rename-table.html). Verified the actual resulting metadata, including:

- payment_transaction(client_receipt_id, invoice_id) -> proof_of_payment(receipt_id, invoice_id).
- proof_of_payment_file.receipt_id -> proof_of_payment.receipt_id.
- proof_of_payment_file.document_id -> document.document_id.
- Original proof -> invoice, client_user, payment_method and reviewer FKs.

Two pre-existing trigger bodies referenced the old table name: sales_invoice_po_id_history and client_user_client_id_history. 005 first creates equivalent `_p2` triggers referring to proof_of_payment, then atomically renames both tables, then removes the two old triggers. At intermediate points an invalid table reference can reject a concurrent write; the ordering never leaves an ownership mutation unguarded. The old triggers attached directly to the renamed proof table move with that table and remain intact. Final full metadata exactly matches the contract declared before execution.

Both proof tables had 0 original rows. Their zero-row counts/hashes were preserved; no claim of a populated historical-data rename trial is made. Live rollback-only tests subsequently exercised actual proof/file/document writes, proof ownership checks and the composite payment FK on the renamed tables.

## Full architecture review

Every current table's columns, types, nullability/defaults, PK/FK/unique/CHECK constraints, indexes, generated expressions and triggers were collected from the actual server and compared against the original bootstrap plus extension contract. Full SHOW CREATE TABLE output and metadata are retained in `part1-before.json` and `part1-final.json`. Lifecycle review covered:

| Area / reviewed tables | Decision |
| --- | --- |
| role, delivery_method, payment_method, material_category, unit_of_measure, filter_type, production_stage | Existing reference architecture, uniqueness, nine-role enum and ten stage positions retained; no invented lookup records |
| user_account, client, client_user, user_sessions, client_applications | Existing identity/one-company-login/role/session/registration relationships retained; username support already applied |
| document | Existing object-version uniqueness, storage status, metadata and uploader FK retained; available documents still require real storage references |
| inquiry, inquiry_item, quotation, quotation_item, cost_estimate, cost_estimate_material | Existing ownership, filter/sketch references, immutable revision references, single current quotation, calculations and decimal-safe money retained; required 20%/50% downpayment constraint unchanged |
| cancellation_request, quotation_revision_request | Genuine missing persistence added; unique pending requests, ownership, review and historical target safeguards implemented |
| purchase_order, job_order, job_order_item, job_order_stage, production_plan, production_stage_event | Existing accepted quotation/document references, item/spec snapshots, stage times and append-only stage events retained; only request-dependent PO history guard added |
| raw_material, finished_good, stock_movement, stock_request, stock_request_item, material_shortage_report | Unknown/provisional/verified provenance, nullable unknown quantity/price, units, observation arithmetic, source ownership and append-only ledger retained; no stock reservation, deduction or BOM fabrication |
| sales_invoice, proof_of_payment, proof_of_payment_file, payment_transaction | Existing invoice ownership, partial submissions, review states, positive amounts, composite proof/invoice reference, approved actual payments and operation-key uniqueness retained |
| delivery, delivery_item, waybill, delivery_receipt, signed_delivery_receipt | Existing JO ownership, shipment quantities, unique document references and delivery identities retained |
| notification | Existing user FK and (user_id,is_read,created_at) index support owned/read/unread queries; read_at consistency retained; no recipient/broadcast tables added |
| audit_event | Existing generic subjects, JSON before/after values, actor FK and append-only triggers support all required events; no legacy audit_events recreated |
| _enterflow_phase2_extension_history | Same isolated ledger, reviewed file order/checksums, durable applying/applied/failed markers; no protected/shared ledger access |

The six payment term fields remain VARCHAR(80): client.default_payment_terms, inquiry.payment_terms, quotation.terms_of_payment, purchase_order.payment_terms, job_order.payment_terms and sales_invoice.payment_terms. They support NET15/NET30 unchanged; no lookup/type change is warranted. Display mapping belongs to Parts 2/3.

Purchase orders continue to use **purchase_order.po_document_id -> document.document_id**. No file metadata duplicate or purchase_order_files table was created. File storage handling and accounting permissions remain service responsibilities in Part 2. Other proposed capabilities can be correctly supported by the current schema and service transactions; no speculative schema changes were justified.

## Framework and recovery safety

Reused the existing Phase 2 execution core and dedicated history. Added explicit `migrate-part1`, `status-part1` and `preflight-part1` scopes so ordinary earlier-scope commands cannot accidentally activate new work. Part 1 requires applied 001–003 and exact complete starting metadata. The fixed manifest adds 004–006, with regular-file/symlink checks and reviewed hashes. The existing legacy SQL parser was not broadened. Only the pinned new files use explicit statement boundaries for compound CREATE TRIGGER commands.

Each invocation verifies endpoint/version/UUID and sources, acquires a fresh activation lock, validates history/order/checksums and full starting schema, snapshots all **42** pre-existing data tables including usernames/sessions/applications, and writes the applying marker durably before DDL. Every new statement logs its ordinal and checksum before execution and acknowledgement afterward. Each extension verifies full resulting metadata and record hashes before its applied marker. The rename-aware snapshot maps old baseline names to actual new tables without changing columns or historical comparison labels.

Recovery protocol for a future interrupted 004–006: stop, retain applying/failed history and statement evidence, perform read-only actual metadata/data verification, and identify the exact persisted statement prefix. Do not rerun the migration, reverse the rename or manually alter history. 005's checkpoints are two added replacement triggers, one atomic two-table rename, then removal of each old trigger. A separately reviewed forward-completion procedure must validate each existing object's exact definition and complete only missing steps through the framework. No automatic adoption, table-existence skip or generic recovery command was introduced. Failure-injection tests confirm durable markers block blind retries at creation, trigger, rename and cleanup boundaries. No recovery was required in this task.

Current read-only status command:

```powershell
node database/migrate.mjs preflight-part1 --profile phase2 --env-file database/.env.phase2.migrations.local
```

Do not run the old scope expecting it to understand 004–006; it deliberately refuses unknown history. No execution command is needed now—all six entries are applied.

## Tests, live evidence and preservation

- Final relevant migration/core/preflight regression run: **146 passed, 0 failed**, including 15 Part 1 cases. Log: `part1-offline-tests.log`. An earlier run had four error-message regex mismatches after command wording changed; corrected the wording without weakening behavior/tests, reran those four successfully, then ran the final relevant regression milestone. No unrelated application suites ran.
- Initial post-005 live schema suite: **33 checks PASS**, all fixtures rolled back. Final post-006 suite: **34 checks PASS**, all fixtures rolled back. The final repeat was justified by the additional PO historical guard and final full schema contract. The live runner is now `database/phase2-part1-live.mjs`, deliberately outside automatic `*.test.mjs` discovery; it requires `--approved-phase2-transaction-tests`. It was originally executed under its initial `.test.mjs` filename before that safety rename. No further live test is needed.
- Real MySQL tests cover valid relationships, cross-client rejections, duplicate pending uniqueness, review status/reason/actor rules, immutable requested/review history, current quotation/PO eligibility, PO document FK, renamed proof/file/document and composite payment FKs, confirmed-downpayment/JO cancellation blocking, no automatic business status changes, notification checks and append-only audit events. They are database-schema tests, not API/session authorization acceptance.
- Final preflight: **PASS**, not merely configuration or mocked evidence. Final metadata exactly matches `part1-expected-stage6.json`, which was saved before 006 execution. Old proof table names are absent. Existing schema-wide application grants cover the renamed/new tables without grant changes.
- `part1-verification.json` verifies unchanged hashes/counts for all 42 existing data tables and unchanged 001–003 history. Retained permanent records remain exactly 8 roles, 8 employee users, 8 audit events, 3 sessions and 1 application. Both request tables are empty after test rollback. Final orphan-payment and orphan-PO-document counts are 0.

Evidence is under `database/phase2-execution/activation-2026-11-22/`: `part1-before.json`, `part1-preflight.json`, predeclared stage-5/stage-6 metadata, `part1-migration.log`, `part1-after-005.json`, `part1-006-migration.log`, both live-test JSON files, `part1-final.json`, `part1-final-preflight.json`, `part1-verification.json` and the offline-test log. JSON inventories contain exact SQL and public schema definitions; record contents and secrets were not exported.

## Files changed and Part 2 handoff limits

New source: three SQL extensions; `database/phase2-part1-contract.mjs`; `database/migration-phase2-part1.test.mjs`; `database/phase2-part1-live.mjs`; `database/phase2-part1-audit.mjs`. Updated: `database/migrate.mjs`, `database/migration-phase2.mjs`, `database/migration-phase2-preflight.mjs`. Added this completion report and evidence files. Existing TLS/recovery/backend/proxy/provisioning work was preserved. Original bootstrap and applied SQL 001–003 were not changed; applied 004/005 were not edited when 006 was added.

No remaining schema/migration blocker was observed for the Part 2 compatibility rewrite. This is not a populated application-readiness certificate: the Client role row and operational reference/catalog/stage data are currently absent, although supported by the schema. No persistent seeds, stock, BOMs, prices or account fixtures were invented. Provisioning approved business/reference data is separate work. Existing backend services may still use legacy table names and require the explicitly deferred Part 2 rewrite. That rewrite must serialize request reviews with concurrent payment/production writes, enforce endpoint RBAC and ownership, prohibit request-history deletion, insert audit events, apply canonical payment terms and implement actual storage workflows. No backend startup or frontend integration was performed.

## Database Change Report

**Connections:** nine authenticated TLS connections, all to enterflow_phase2_db only: initial architecture audit; preflight; 004/005 execution; rollback-only live test; post-005 audit; 006 execution; final rollback-only live test; final audit; final preflight. Existing migration root credentials were decrypted in memory. No application-password/key disclosure or account alteration. Offline tests use doubles and open no live database sockets.

**Read-only SQL:** current-schema Information Schema tables/columns/PK/FK/unique/CHECK/index/generated-expression/trigger/routine/event queries; SHOW CREATE TABLE for every allowlisted Phase 2 table; identity/TLS-related reads; ordered dedicated history filenames/states/timestamps and individually scoped known-file checksums; ordered SHA2 row reads; current role names; grants; MDL/settings preflight queries; orphan-payment and PO-document checks. The last two audits additionally read only the named application account's host from mysql.user and SHOW GRANTS for that account. Complete query lists are in their JSON files: initial audit **103**, post-005 audit **112**, final audit **113**. Preflight SQL lists are saved separately. No protected/shared ledger or unrecognized history checksum was retrieved.

**Persistent migration DDL actually executed:** **15 statements**: 2 CREATE TABLE, 10 CREATE TRIGGER, 1 RENAME TABLE renaming two tables atomically, and 2 DROP TRIGGER removing only the replaced historical ownership triggers. Net result: +2 tables, +8 triggers; all original business relationships/constraints preserved or correctly redirected. No DROP TABLE, data rewrite, backfill, old-table compatibility copy, CREATE DATABASE, reset, reseed, restore, grant or Docker/resource/configuration operation.

**Persistent migration DML:** exactly 3 INSERT applying markers and 3 UPDATE applied markers in `_enterflow_phase2_extension_history`, only rows 004, 005 and 006. Each was committed through the framework; no failure-marker write occurred. 001–003 received no writes. Two activation advisory locks were acquired/released, with existing session UTC/strict SQL-mode/autocommit/lock-wait settings and durable COMMITs. No migration was executed twice.

**Temporary test DML:** across the two transactions, **50 successful INSERT statements and 11 successful UPDATE statements**, plus **43 expected rejected INSERT/UPDATE attempts**. Every fixture change was rolled back, including savepoint-scoped payment/JO rows; no fixture COMMIT, deletion or cleanup was used. Successful fixture writes by table:

| Table | INSERT | UPDATE |
| --- | ---: | ---: |
| role | 2 | 0 |
| user_account | 4 | 0 |
| client | 4 | 0 |
| client_user | 4 | 0 |
| inquiry | 4 | 0 |
| quotation | 3 | 0 |
| quotation_revision_request | 4 | 4 |
| cancellation_request | 3 | 3 |
| payment_method | 2 | 0 |
| delivery_method | 2 | 0 |
| document | 2 | 0 |
| purchase_order | 2 | 0 |
| sales_invoice | 2 | 0 |
| proof_of_payment | 2 | 2 |
| proof_of_payment_file | 2 | 0 |
| payment_transaction | 2 | 0 |
| job_order | 2 | 0 |
| notification | 2 | 2 |
| audit_event | 2 | 0 |

Each statement and rejection code is retained in the two live-test JSON logs. Transaction rollback does not rewind MySQL AUTO_INCREMENT counters; fixture attempts can leave ID gaps. No counter reset/repair was performed. Existing row values/counts/hashes are verified unchanged, rather than claiming byte-identical database files or sequence values.

**Protected/excluded:** shared enterflow_db/3308 and enterflow_phase2_restore_p2b002 were never connected to, read or modified. Protected Migration 007, its history/checksum and other legacy migration SQL were not accessed. Only Phase 2 extensions 001–006 were read. No credential/private key export, runtime change, broad backend rewrite, deployment, staging or commit. Stop here at the verified Part 1 database milestone.
