# Part 2 — Phase 2 backend compatibility

Completed 2026-11-23, Asia/Singapore. **Backend implementation and bounded compatibility acceptance completed. Application operational readiness remains blocked by reference data and unperformed activation/end-to-end acceptance.** Part 3 was not started.

Branch: `phase-2/database-erd-corrections`. Inspected status, branch and existing changes before implementation. Preserved uncommitted contributions, including runtime, TLS, proxy, provisioning and migration recovery work. Nothing staged or committed; no branch/history operation. Used the [Part 1 completion report](PHASE_2_PART_1_DATABASE_COMPLETION_REPORT.md), pinned final schema contract and recorded Phase 1 handoff. The original 28-page PDF was not supplied/read in this task; the recorded Warehouse/Inventory report was available. No new business requirements were invented from that gap.

## Implemented modules and database mappings

Existing service factory imports and route mounts remain. Shared implementation is now in `backend/src/phase2`; services delegate there rather than duplicating incompatible SQL.

| Module | Implemented Phase 2 behavior |
| --- | --- |
| Authentication, sessions, administration | `user_account` joined to `role`; Client ownership through `client_user`/`client`; active account/company checks; initial-password gate; secure session lifecycle, password change/revocation, Admin management and restricted Owner directory. |
| Client Portal and Sales | `inquiry`/`inquiry_item`, parent-owned reads, profile/dashboard, specification JSON, current and historical `quotation`/`quotation_item`, immutable costing revisions through `cost_estimate`/`cost_estimate_material`, real PO/invoice/JO/delivery projections. |
| Requests | `cancellation_request` and `quotation_revision_request`, pending uniqueness, explicit reviews, reviewer/time/note, immutable finalized history and audited business transitions. |
| Accounting | `proof_of_payment`/`proof_of_payment_file`, independent `payment_transaction` ledger, partial payments/outstanding amounts, review/idempotency, invoice state, safe proof/document queue. Proof files never count as confirmed money. |
| Inventory/Warehouse | `raw_material`, `finished_good`, `stock_movement`, stock requests/items, actual units/categories, nullable unknown quantities and provenance, reasoned observations, append-only confirmed movement history. No order/quotation allocation or deduction. |
| Production | JO item snapshots, actual stage definitions, sequential `job_order_stage` transitions and `production_stage_event`, plans/capacity/rush priority, shortages and tracking. |
| Delivery | `delivery`/`delivery_item`, configured methods, waybill/print acknowledgement, receipt/handoff gate, authorized transitions, full-delivery term clock, signed receipt and private documents. |
| Cross-cutting | Per-user `notification`, append-only transactional `audit_event`, request-ID correlation, exact decimal/BIGINT handling, scoped real aggregates and safe errors. |

Replaced active legacy users/clients/orders/order_items/quotations/quotation_lines/purchase_orders/invoices/payments/shipments/files/notifications/audit_events and receipt/file joins with the actual singular Phase 2 relationships. No compatibility tables/views or fabricated sequence/BOM/lookup objects were added.

A final backend-wide SQL search also found historical Phase 1 material outside active runtime paths: `backend/inspect-auth-db.mjs`, `backend/diagnostics/employee-directory-readonly.mjs`, local-admin setup, legacy MySQL integration/fixture scripts and `.pre-phase2.bak` files. These were not executed or mounted. They retain legacy assumptions and must not be used as Phase 2 diagnostics. The active-source compatibility tests cover production `.js` modules, exclude test/integration modules, and prohibit migration-execution imports. Thus the claim is **no active legacy SQL dependency**, not that every historical file contains no legacy text. Task 002 integration/teardown was not rerun.

## Contracts and protections

The [API contract](PHASE_2_BACKEND_API_CONTRACT.md) documents payloads, added `/api/phase2` operations, retained route/response containers and limitations. Important changes:

- Explicit material quantities, configured UOM IDs and approved stored prices replace implicit legacy BOM costing. Quotation revisions use the current base quotation ID. Fixed-point totals enforce exactly 20% or 50% downpayment; highlighted notes persist through the actual `highlight_tag` column.
- Payment terms store `NET15`/`NET30` and expose `15-Day Terms`/`30-Day Terms` consistently. No payment-terms table.
- PO files use `document` and `purchase_order.po_document_id`. JSON attachment requires an owned available document; multipart uploads record actual metadata. Rejected-PO resubmission retains historical evidence and stops once invoice/JO work exists.
- JO creation requires explicit verification flags/due date, eligible PO/quote/invoice, confirmed downpayment and ten configured stages. It returns the retained JO container. Decimal quotation quantities such as `10.0000` are compared using fixed-point conversion, verified against live MySQL.
- Request states use actual `pending/approved/rejected` values. Existing decline route names map to rejected records. Reviewing a revision request does not implicitly create/send a replacement quotation.
- No quotation-file relationship exists in this schema; reads do not invent quotation PDF attachments. Adding that persistence relationship requires separate approval. Explicit employee ID/department/job-title metadata uses audit JSON; absent historical values remain null.

Authentication and write transactions derive authority from server-side database records. Body-supplied actor/role/client fields cannot authorize operations. Client reads check the owned parent before fetching children. Write transactions revalidate active role, client/company state and initial-password restrictions. Permission grants were preserved; `permissions.js` was not changed. Existing notification grants allow Client read/update and Sales read only; other employee roles do not acquire notification access through the new generic routes. Any broader employee inbox/read-state access needs RBAC approval.

Cancellation, payment verification, JO creation, production and delivery lock the same inquiry row before subordinate workflow rows, then recheck prerequisites. Final request decisions are guarded against replay and retain review history. Cancellation approval fails after a JO or confirmed downpayment; pending proof alone does not block it. Inquiry rejection includes pending requests in its optimistic revision and finalizes them with explicit rejected review evidence. User/client identity mutation and sketch submission use consistent locking; identity uniqueness uses the existing advisory-lock convention. Tests cover serialization/rollback/idempotency; real multi-connection Client contention remains untested while its role is absent. Deadlocks/ambiguous commits are surfaced safely rather than automatically replaying business actions.

The Phase 2 pool verifies TLS authorization, database, server UUID/version, application account and strict SQL mode on fresh checkout, and uses UTC sessions. Unexpected identities fail before business SQL. Errors do not expose raw SQL, stack traces or credentials. Private document reads verify role/ownership/parent before storage access; response headers prevent MIME sniffing and active inline content.

## Documents and payment acceptance limits

Kept the existing GCS provider/configuration. Upload validation covers size, MIME, extension, signatures, safe keys and SHA-256. Generation/version metadata is retained. Available status follows provider acknowledgement, never a fabricated success. Multiple proof files link through `proof_of_payment_file`; verification creates one approved payment transaction with an operation key, independently of file multiplicity. Partial payments cannot exceed the outstanding invoice. Finalized review history cannot be overwritten.

Known transactional failures compensate confirmed staged objects. Unknown commit outcomes retain them for reconciliation. Sketch submission preserves its durable pre-upload journal, submission-key lookup and generation-aware cleanup. **General PO/proof/delivery uploads still have a process-termination window that can leave an orphan object before compensation; no distributed atomicity or crash-proof cleanup is claimed.** Live GCS upload/download and external courier integration were not tested. Live document workflow acceptance used an explicitly injected memory storage double while SQL executed against MySQL; the operational provider remains unchanged.

## Automated and actual-database evidence

Final command, offline environment (no live credential or shared-runtime fallback):

```powershell
node backend/test/run-phase2-tests.mjs
```

**1,124 tests passed; 0 failed, cancelled, skipped or todo.** The runner bounds workers to four and includes backend source unit/HTTP tests. [Final log](../backend/test/evidence/phase2-part2-regression-final-acceptance.log). It does not execute standalone legacy MySQL/Task 002 integration scripts. Focused evidence includes 37 route security tests, 35 Admin tests, 18 sketch tests and 26 final contract checks. [Every retained test-log total, including superseded failures](../backend/test/evidence/phase2-part2-test-run-summary.json).

Final syntax validation parsed 200 backend JavaScript modules/test helpers. `git diff --check` passed; documentation links and aggregated write totals were also checked. Existing Git line-ending warnings did not indicate whitespace errors.

The first regression run was 724/970 passed, 246 failed. Legacy SQL fixtures/assertions were ported to real Phase 2 contracts and actual defects corrected; tests were not removed/skipped to pass. Superseded candidate failures remain logged. One unconstrained run had a worker exit without a diagnostic; its cause was not established. The affected HTTP file passed in isolation and the bounded final suite passed. Live acceptance exposed a decimal-string quantity conversion defect not caught by mocks; it was fixed and a regression case added. A later check added persisted quotation highlight and production plan/shortage read-back, followed by the final focused/full/live checks.

Final authorized live command (requires local permission to read the existing DPAPI credential and reach the dedicated server; output path must be new):

```powershell
node --import ./backend/test/phase2-offline-env.mjs backend/test/phase2-part2-live.mjs --approved-phase2-backend-checks backend/test/evidence/phase2-part2-live-07.json
```

**85 live checks passed.** [Final SQL/check evidence](../backend/test/evidence/phase2-part2-live-07.json). Target was authenticated directly and through two fresh guarded pool connections:

| Property | Observed |
| --- | --- |
| TCP peer | `127.0.0.1:62286` |
| Database / version | `enterflow_phase2_db` / `8.4.13` |
| UUID | `0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8` |
| Account | `enterflow_phase2_app@%` |
| TLS | TLSv1.3, authorized true, existing dedicated CA; verified DNS identity `localhost` |
| Final connections | Direct 84; guarded pool 85 and 86 |
| Tables | 45, queried through the guarded application pool |

The existing TLS factory connects TCP 127.0.0.1 while mysql2 verifies the certificate's localhost DNS identity. The actual peer was recorded; verification was not disabled and no TLS/configuration change was made.

The final run natively prepared **196 static SQL statements** with the real application account, including Client-dependent branches, without executing those prepared statements. This validates syntax/object/grant compatibility, not trigger/FK behavior for unexecuted branches. Dynamic SQL paths were additionally exercised where safely available; the preparation count is not a claim that every branch ran.

Executed real service SQL for quotations/revisions/cost snapshots, stock availability with no deduction, PO processing/invoice/JO guards and creation, rush scheduling, all ten sequential stages, shortages, stock observations/ledger, request response/update, dispatch/handoff/status/receipts, owned reads and cross-client denial, Accounting/reporting reads, notifications, Admin employee creation/role/status/session changes, and authentication. The HTTP acceptance listener exercised actual Argon2 login, cookie-authenticated inventory read, Sales write denial, logout and revoked-cookie rejection. It used a rollback-only adapter over the actual application-account connection; it was closed after acceptance. Separate guarded connections were real read-only pool checkouts. No persistent application runtime was started or switched.

Public pending-registration submission executed real SQL and missing-Client-role approval returned a clear conflict without creating a role/account. Successful Client login, Client request submissions and real proof review cannot be exercised end to end against this database yet. Their service/HTTP authorization, transactional and payment cases pass automated database-double tests; their static SQL prepares successfully on MySQL. This is explicitly narrower evidence than an activated Client workflow.

## Remaining prerequisites and blockers

No schema change was requested or applied. Operational provisioning requires separate approved values:

1. Missing canonical `role.role_name='Client'`, with approved description/other required attributes and a database-assigned ID. Never substitute an employee role. Successful application approval/Client provisioning remains blocked until this exists. The existing employee provisioning script was inspected; it was not run and does not resolve Client provisioning.
2. Approved UOMs/categories/filter types and template mappings, actual materials/catalog relationships, approved prices with approver/time, active payment/delivery methods, and ten production stage definitions ordered 1–10. Method names/IDs and business values must come from approved data. Rollback fixtures do not provision these prerequisites.
3. The existing eight employees retain their initial-password requirements. They need the supported password-change flow before business use; no permanent user/password/session repair was performed.
4. Live private GCS access, Client workflow/contended transaction acceptance after provisioning, and full separately authorized runtime activation/end-to-end testing. Do not treat configuration, SQL preparation or mocked storage as proof of those outcomes.
5. Preserve existing notification RBAC restrictions or obtain explicit approval for any wider staff inbox. Resolve the general external-upload crash/orphan limitation before claiming crash-proof storage reconciliation.

No frontend change, deployment, production release or Part 3 integration occurred.

## Files changed for Part 2

New implementation modules: `backend/src/phase2/{core,reads,workflows,accounting,inventory,production,logistics,documents,sketches,admin,dashboard,notifications}.js`; new focused tests `{core,compatibility,request-workflows,payment-workflows,read-boundaries}.test.js` in that directory.

New shared/routes/validation: `backend/src/config/{phase2-pool,request-context}.js`, `backend/src/controllers/phase2-response.js`, `backend/src/routes/phase2-operations.routes.js` and its HTTP integration test, `backend/src/validation/phase2-quotation.validation.js`.

Updated services: `accounting`, `admin`, `auth`, `client-applications`, `client-inquiry`, `client-portal`, `document-workflows`, `engineer-sketch`, `inventory`, `owner-employee-directory`, `production-job-orders`, `sales-clients`, `sales-dashboard`, `sales-notifications`, `sales-orders`, `session`, `shipment-read`, `stock-requests` under `backend/src/services/*.service.js`. Updated corresponding service tests, including Sales cancellation/rejection/JO/delivery/document tests, Logistics and Warehouse tests.

Updated wiring/security: `backend/src/app.js`, `config/database.js`, controllers `client-applications`, `client-portal`, `inventory`, `sales-orders`, `stock-requests`; middleware `auth`, `document-upload`, `request-id`; routes `client`, `document`, `sales`; `storage/document-storage.js`; validations `client-inquiry`, `sales`. Updated affected authentication/onboarding/Client/runtime-redaction tests and narrowly redacted startup errors in `server.js`.

New test helpers: `backend/test/{phase2-offline-env,phase2-service-fixture,phase2-live-connection,phase2-part2-live,run-phase2-tests}.mjs`; retained logs, live JSON and summaries under `backend/test/evidence/`. New documentation: this report and `PHASE_2_BACKEND_API_CONTRACT.md`.

Existing migration/recovery/TLS/provisioning/Part 1 files, proxy changes, runtime configuration changes and unrelated contributions visible in Git status predated this task and were preserved. No database SQL/migration/environment/CA/key/Docker file was changed for Part 2. No package dependency installation or frontend edit was required.

## DATABASE CHANGE REPORT

**Scope:** Part 2 only. Zero migrations executed/created/applied, zero DDL, zero DELETE statements, zero physical COMMIT statements. No grants, credentials, TLS files, Docker resources or permanent reference data were changed. No reset, recreation, reseed, repair or sequence reset.

**Connections:** 16 total application-account connections: one initial read-only probe, one direct connection in each of seven acceptance attempts, plus two guarded read-only pool connections in each of attempts 04–07. All targeted only `127.0.0.1:62286 / enterflow_phase2_db`. Early direct connection IDs were not recorded; final IDs and all available IDs are in evidence. Initial probe used identity/version/UUID/account and role/password-flag count SELECTs plus UTC session setup. Early runs 01–04 did not log their direct identity/UTC prelude completely; those were the same read-only identity SELECT and session SET, not writes. No root/migration credential connection was used.

**Read-only verification:** SELECTed all 44 non-ledger tables using static expected column lists and per-row SHA-256 snapshots. Reviewed roles/users/status/password flags, application grants, schema metadata, actual business read queries and only the six explicitly named Phase 2 extension-history rows. History statements use `WHERE file IN (?,?,?,?,?,?)` for 001–006; no whole-ledger read/enumeration. Successful preparation of DML text is recorded as `prepareOnly` and excluded from database write counts. Preparation/unprepare closes statements without executing them. `SET SESSION` affected only time zone; transaction control/savepoints and identity advisory locks affected session/lock state.

| Attempt | Result / passed checks | Physical connections | Logged entries | PREPARE successful/attempted | Successful INSERT / UPDATE statements | Transaction result |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 01 | FAIL after 2; assertion expected string count but MySQL returned number | 1 | 91 | 0/0 | 23 / 3 | Outer rollback; first harness did not capture after hashes |
| 02 | PASS 62 | 1 | 654 | 0/0 | 130 / 86 | Rolled back; all 44 hashes equal |
| 03 | PASS 77 | 1 | 725 | 0/0 | 133 / 89 | Rolled back; all 44 hashes equal |
| 04 | FAIL after 1; harness incorrectly prepared an incomplete concatenated SQL fragment | 3 | 98 | 91/92 | 0 / 0 | No fixture transaction or DML started |
| 05 | FAIL after 10; actual DECIMAL quantity conversion defect | 3 | 405 | 194/194 | 40 / 5 | Rolled back; all 44 hashes equal |
| 06 | PASS 84 | 3 | 993 | 194/194 | 137 / 92 | Rolled back; all 44 hashes equal |
| 07 | PASS 85 | 3 | 1,002 | 196/196 | 137 / 92 | Rolled back; all 44 hashes equal |

All SQL entries, safe error codes, savepoints, rollback controls and statement write counts are retained in `backend/test/evidence/phase2-part2-live-01.json` through `-07.json`. [Aggregated database report](../backend/test/evidence/phase2-part2-database-change-summary.json) includes per-run SELECT/SET/transaction-control classes and affected-row counts. No credential, private key or SQL parameter values are exported.

Across the seven attempts, **600 INSERT statements and 367 UPDATE statements succeeded transiently** on fixture-owned rows. No submitted DML statement failed at MySQL; expected workflow denials occurred before inappropriate writes. Service `commit()` calls released test savepoints; only the outer transaction controlled persistence and always rolled back. No mock/unit-test writes are counted as real database writes.

| Fixture table | INSERT statements | UPDATE statements |
| --- | ---: | ---: |
| user_account | 42 | 8 |
| client | 6 | 0 |
| inquiry | 6 | 105 |
| unit_of_measure | 6 | 0 |
| filter_type | 6 | 0 |
| delivery_method | 6 | 0 |
| raw_material | 6 | 10 |
| inquiry_item | 6 | 0 |
| quotation | 12 | 11 |
| quotation_item | 12 | 0 |
| cost_estimate | 12 | 0 |
| cost_estimate_material | 12 | 0 |
| audit_event | 176 | 0 |
| document | 13 | 8 |
| purchase_order | 5 | 0 |
| sales_invoice | 5 | 4 |
| payment_method | 5 | 0 |
| payment_transaction | 5 | 0 |
| production_stage | 50 | 0 |
| job_order | 4 | 84 |
| job_order_item | 4 | 0 |
| job_order_stage | 40 | 80 |
| notification | 18 | 8 |
| production_plan | 4 | 0 |
| production_stage_event | 80 | 0 |
| material_shortage_report | 4 | 0 |
| stock_movement | 8 | 0 |
| stock_request | 4 | 8 |
| stock_request_item | 4 | 8 |
| delivery | 4 | 8 |
| delivery_item | 4 | 0 |
| waybill | 4 | 4 |
| delivery_receipt | 4 | 0 |
| signed_delivery_receipt | 4 | 0 |
| user_sessions | 15 | 21 |
| client_applications | 4 | 0 |

These are successful statement counts, not persisted rows. Idempotent updates can affect zero rows; the JSON records actual affected rows. No Client role or `client_user` fixture was inserted. Static Client SQL preparation did not execute its writes. No actual GCS writes occurred.

Final baseline and post-rollback snapshots contain 8 roles, 8 employee users, 8 audit events, **5 sessions**, 1 registration application and no other business records. All 44 table hashes and the six scoped applied history records match within the final run. **Baseline drift between runs:** attempts 01–03 had 4 permanent sessions; attempts 05–07 had 5. The extra session's origin was not established or modified. These rollback-only transactions issued no COMMIT; do not interpret within-run preservation as proof the database was globally unchanged by other activity throughout the entire task. Other non-session table snapshots remained stable across the recorded baselines.

Rollback does not rewind MySQL AUTO_INCREMENT counters; fixture attempts leave ID gaps. No counter reset was performed, and byte-identical database files/sequence state are not claimed.

**Protected/excluded:** shared `enterflow_db` on port 3308 and the restore comparison database were never connected to, read or modified. Protected Migration 007, its history and checksum were never accessed. Applied extensions 001–006 were not rerun or changed. No migration recovery command was invoked. No database approval is pending for an applied change; reference-data provisioning, activation and any future schema addition remain separate approvals. Stop at Part 2; do not begin Part 3 automatically.
