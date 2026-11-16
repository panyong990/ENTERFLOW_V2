# ENTER-FLOW V2 — Proposed Business Module Development Handoff

Status: **Ready for bounded module work, subject to the Task 32 conditions.**
This handoff records existing foundations and proposes a dependency-aware
sequence. It does not authorize database access, migrations, production work,
or a particular business workflow. Confirm each module's requirements and
acceptance criteria with the authoritative handoff and business owner before
implementation.

## 1. Starting point and preservation

Task 32 is **PARTIAL**. Bounded Business Module Development may begin, but live
database, browser-release, and production readiness remain unverified. Read
[PRE_BUSINESS_DEVELOPMENT_HANDOFF.md](PRE_BUSINESS_DEVELOPMENT_HANDOFF.md) and
[PRE_BUSINESS_DEVELOPMENT_TASKS_28-32.md](PRE_BUSINESS_DEVELOPMENT_TASKS_28-32.md)
for the final readiness evidence.

Last recorded branch is `dev-phase`; last recorded HEAD is
`3b2701dcb266dddb11bbe6c9fcfc472545479cd6`. The worktree contains accumulated
uncommitted changes from Tasks 28–32. Its exact current status was not refreshed
for Task 32; inspect it before future changes. Preserve all modified and
untracked files. Do not reset, clean, restore, rebase, merge, commit, or push.
Do not treat this handoff as permission to stage or commit existing work.

## 2. Existing architecture and foundations

- **Frontend:** React, TypeScript/TSX, Vite, Tailwind, components, hooks, and
  API adapters under `src/app`.
- **Backend:** Node.js/Express ES modules, with routes, controllers, services,
  validation, authentication/authorization middleware, and MySQL access under
  `backend/src`.
- **Transport:** same-origin `/api` requests; development Vite proxy and
  production ingress routing are separate.
- **Database:** MySQL-compatible schema and seed files under `database/`;
  reviewed runner at `database/migrate.mjs`. Database BIGINT identifiers
  remain decimal strings; money values must retain decimal-safe semantics.
- **Identity and permissions:** shared runtime configuration, session
  authentication, role/permission middleware, and client ownership guards
  exist. Frontend navigation is not an authorization boundary.
- **Modes:** Demo Mode uses local/demo data. Real Mode uses authenticated
  adapters. Do not allow Demo records, local storage, or fabricated values to
  enter Real Mode.
- **Deployment artifacts:** backend and frontend Dockerfiles, nginx SPA
  configuration, and liveness/readiness routes exist. Their presence is not
  production deployment evidence.

The fresh Task 29 unit-test evidence is 579 backend and 64 frontend tests
passed (643 combined; zero failures or skips). Browser tests were **NOT RUN**
in the latest cycle. The isolated Task 19 container and DPAPI fixtures were
unavailable; Chromium installation previously stalled and must not be retried
as part of this handoff. Backend startup did not complete because it requires
an authorized database connection and confirmation of the intended target.
No database connection or query occurred in that cycle.

## 3. Current module state

The table distinguishes documented existing implementation from incomplete or
unverified workflows. Do not infer a complete write workflow from a page, role,
schema object, read endpoint, or historical test.

| Module | Existing implementation documented | Incomplete or unverified |
| --- | --- | --- |
| Identity, sessions, and client applications | Password/session foundations and authentication tests; Admin client-application listing/detail/review, approval/rejection, identity-conflict handling, and related audit behavior are documented. | Current live authentication and browser flows were not verified in Task 32. Confirm all transitions and side effects before changing them. |
| Admin Portal and administration | Employee and client directory/detail/administration, role assignment, activation/deactivation, and client-application review APIs/UI are documented. Backend authorization is independent of navigation. | Latest Admin browser verification was not run. Do not assume additional administration workflows exist beyond documented endpoints. |
| Sales & Orders | Sales read APIs cover client directory, inquiries/orders, quotation history and PO reads, dashboard metrics, job-order/delivery summaries, and notifications. Real Mode adapters and Sales pages exist. Earlier cancellation-request display/review behavior was implemented. | Sales APIs are primarily reads; broad transactional Sales writes and persistence for UI cancellation decisions are not verified by the latest evidence. Define the exact inquiry/order transitions before implementing writes. |
| Client Portal | Authenticated client-owned profile, order, quotation, PO, job-order, delivery, invoice, payment, notification, and dashboard reads are documented. Real Mode adapters are present. Cancellation status display/filter behavior was implemented earlier. | Payment submission and document operations remain incomplete. Latest browser and live persistence checks did not run. |
| Production | Production roles, permissions, schema foundations, and operational concepts are present in the repository documentation. | A complete production workflow API and its transition rules are not established by the Task 28–32 evidence. Inspect existing routes and obtain approved workflow requirements before coding. |
| Warehouse and inventory | Warehouse role/permission and schema foundations are documented. | Current end-to-end inventory operations, stock movement APIs, and their business rules are not established as complete. Do not invent reservation, adjustment, or fulfillment behavior. |
| Logistics and delivery | Logistics role/permission foundations and Sales delivery summary reads are documented. | Full dispatch, waybill, proof-of-delivery, and cross-role write behavior are not established as complete in the current evidence. Confirm required operations and statuses first. |
| Accounting, invoices, and payments | Client/Sales invoice and payment reads and accounting-related permissions are documented. Revenue reporting counts verified payments and uses the supported payment date. | Full invoice issuance, payment recording/verification, reconciliation, and accounting write operations are not established as complete. Confirm rules and ownership before implementation. |
| Documents and attachments | Document/attachment schema and read surfaces are documented; Sales order documents and client document reads have adapters/routes in the recorded foundation. | Upload, approval, storage lifecycle, and role-specific mutation flows are not established as complete. Use the approved private-storage design; do not expose object paths or contents without authorization. |
| Notifications and reporting | Client notification retrieval/read-state APIs and selected Sales/Admin dashboard reads exist. | Do not assume global event delivery, all-role notification writes, complete report coverage, or audit-grade event delivery. Confirm scope and recipient rules. |

This is a documentation-based inventory, not a new source-code audit. Before
selecting a module, inspect its current routes, services, UI adapters, tests,
and in-progress changes. Update this inventory when stronger evidence becomes
available.

## 4. Established business rules

The following rules are already recorded as established in the current project
handoff. Preserve them; do not silently broaden or reinterpret them:

1. Sales employees have company-wide visibility for Sales read APIs.
2. Client accounts see only records owned by their authenticated `clientId`.
   Never authorize from a client-supplied ID or company name.
3. Client notification retrieval/read state is restricted to the authenticated
   `userId` recipient; dismissed notifications are excluded from active lists.
4. Revenue metrics count verified payments and group by the payment date
   supported by the schema.
5. Quotation, job-order, production, shipment, delivery, invoice, payment, and
   notification states are separate. Do not combine internal states into an
   invented public status.
6. Internal costing, margins, BOM pricing, employee identities, internal
   notes, audit metadata, credentials, storage paths, and unauthorized file
   contents are not client-visible by default.
7. Demo Mode remains separate from Real Mode. Real Mode must not read Demo
   records/local Demo storage or fabricate transaction summaries.
8. Read-only APIs do not mutate notifications, payments, production, delivery,
   or documents.

These are the rules already captured in the project handoff as the Section 6
baseline. If the full authoritative PDF or an approved owner decision contains
additional module-specific rules, record and reconcile them before the
affected implementation; do not fill gaps by assumption.

## 5. Database and migration restrictions

- Migration 007 remains deferred and untouched. Do not open, read, search,
  hash, parse, copy, modify, or execute it or its checksum.
- The runner defers migrations numbered 007 and later from filename metadata
  before reading SQL. The focused Task 28 evidence is fixture-only; it is not
  database execution evidence.
- Task 28's earlier restriction deviation—surfacing a historical checksum in
  a broad search—is preserved in the Task 28 report. Do not conceal or repeat
  it.
- The latest Task 29/32 cycle made no database connection or query. Backend
  startup awaits confirmation of the intended database target and
  authorization.
- Do not run migration commands, alter schema/data/grants, or change migration
  history as part of ordinary module work. Any required schema change needs an
  explicit reviewed plan, isolated test strategy, target confirmation, backup
  and recovery consideration, and separate authorization.
- Never weaken checksums, ordering, advisory locking, baseline checks,
  fail-closed behavior, or failure markers. Do not use the browser-test
  database for development migrations.

## 6. Proposed module sequence

This is a recommendation, not an approved business requirement. Confirm the
owner's priority and dependency graph before choosing work. Each module should
have its own bounded task, rules, acceptance criteria, and rollback/recovery
approach.

0. **First bounded task — Sales workflow discovery and contract:** inspect the
   existing Sales inquiry/order behavior and obtain an owner-approved,
   narrowly scoped workflow contract. Use
   [BUSINESS_MODULE_TASK_01_SALES_WORKFLOW_DISCOVERY.md](BUSINESS_MODULE_TASK_01_SALES_WORKFLOW_DISCOVERY.md).
   This task is discovery/documentation only and makes no application or
   database changes.
1. **First implementation module — Sales & Orders operational lifecycle:**
   consider only the specifically
   approved inquiry/order operations that build on the existing Sales read
   foundation. Do not assume or implement unapproved quotation, PO, or
   cancellation transitions.
2. **Production operations:** proceed only after the Sales/order handoff and
   production actors, allowed transitions, and data requirements are specified.
3. **Warehouse and inventory operations:** sequence against approved
   production and order dependencies; do not infer stock rules from schema.
4. **Logistics and delivery operations:** use approved fulfillment and delivery
   rules and integrate only with confirmed upstream states.
5. **Accounting, invoicing, and payments:** implement only owner-approved
   financial transitions, verification, precision, and audit requirements.
6. **Client Portal operational actions and documents:** expose only supported
   customer actions, retaining ownership checks and safe public projections.
7. **Cross-module reports and notifications:** derive from approved source
   events and verified states; do not create a parallel or fabricated status
   model.

If a business owner prioritizes another order, record the reason and validate
its dependencies before proceeding. No sequence item authorizes a database
migration by itself.

## 7. Required inspection before implementation

For each chosen module, first:

1. Confirm branch, HEAD, and all modified/untracked files; preserve existing
   work and avoid broad staging.
2. Obtain the exact task brief, owner, actors, business rules, allowed status
   transitions, acceptance cases, and explicit out-of-scope workflows.
3. Trace the UI from route/page through Demo/Real adapters and hooks to backend
   route, middleware, controller, service, validation, and tests. Identify
   duplicate/fallback behavior and preserve existing UX.
4. Inspect the role/permission map, account type, ownership derivation, safe
   projections, audit writes, and all affected call sites.
5. Map relevant tables, foreign keys, uniqueness/integrity rules, IDs, money,
   timestamps, and existing status fields using approved documentation/source.
   Do not connect to a database merely to inspect schema.
6. Determine transaction boundaries, concurrent updates, duplicate submissions,
   retry/idempotency behavior, failure handling, and partial-DDL exposure where
   applicable. Ask the owner when multiple reasonable business rules remain.
7. Identify existing tests and the smallest focused additions. Use mocks or
   synthetic fixtures first. A live integration target requires separate
   authorization and a verified isolated identity.
8. State expected files and data effects before editing. Do not expand scope to
   unrelated workflows.

## 8. Testing and acceptance criteria by module

Every module change must satisfy the shared criteria:

- Backend: validated inputs; authenticated account and exact permission;
  server-derived ownership; parameterized SQL; safe response projection;
  explicit errors; correct transaction/consistency behavior; audit behavior
  where required by existing policy.
- Frontend: Demo/Real separation; explicit loading, empty, retry, unavailable,
  and error states; no fabricated success or silent fallback; responsive
  behavior; no exposure of internal-only data.
- Data: preserve string BIGINT IDs and decimal-safe money; honor documented UTC
  and public/internal status separation; schema changes require separate
  authorization.
- Tests: focused unit/API tests for success, validation, permission denial,
  cross-owner access, state transition/retry/failure, and relevant concurrency
  or duplicate cases. Integration tests must use an explicitly authorized
  isolated target. Browser tests require the verified Task 19 environment;
  never use development or production data.
- Completion: run only authorized targeted checks, record exact commands and
  counts, distinguish historical from fresh results, and report files/data
  effects and limitations.

| Module | Minimum module-specific acceptance before calling its task complete |
| --- | --- |
| Identity / Admin | Verify allowed role/account states and denial paths; ensure administrative mutations are permission-checked and use existing audit conventions; test duplicate/conflicting identity behavior only as specified. |
| Sales & Orders | Test each approved transition and its prior-state/invalid-state behavior; enforce role scope; preserve inquiry/order history and related records; test that unrelated quotation/PO/payment flows remain unchanged. |
| Client Portal | Test authenticated client ownership on parent and child resources, safe public projections, and no cross-client leakage; ensure unsupported writes remain unavailable rather than mutating Demo data. |
| Production | Test only owner-approved transitions, authorization, quantities/relationships, failure behavior, and preservation of upstream order identity; do not invent production rules. |
| Warehouse / Inventory | Test owner-approved stock operations, role restrictions, referential integrity, duplicates/concurrency, and consistency with upstream order/production events; do not infer reservation or adjustment semantics. |
| Logistics / Delivery | Test approved delivery states, responsible roles, order linkage, document/evidence access, and duplicate/retry behavior; do not invent proof or dispatch requirements. |
| Accounting / Billing | Test approved invoice/payment/verification transitions, exact decimal handling, audit trail, duplicate/reconciliation rules, and verified-payment reporting semantics. |
| Documents / Attachments | Test ownership and permission checks, metadata/content boundaries, private-storage behavior, invalid/failed upload handling, and retention/deletion rules only when specified. |
| Notifications / Reporting | Test recipient isolation, dismissed/read behavior, source-state correctness, and aggregation without duplicate counting; ensure reports do not reveal internal data to clients. |

## 9. Deployment and operations gates

Production deployment is not part of the conditional module-development
clearance. Before production, select a platform and ingress; configure runtime
secrets and verified TLS/database identity; validate container builds and
health/readiness on the intended runtime; establish rollback; and implement
structured logging, global correlation/redaction, audit coverage, retention,
monitoring, alert ownership, and incident runbooks. The current artifacts and
historical build checks are not a production deployment.

## 10. Decision and handoff

**Task 32: PARTIAL. Business Module Development: conditionally cleared for
bounded work.** This does not clear production deployment, browser acceptance,
live database verification, or migrations. Begin with the module discovery and
inspection checklist above; ask for owner clarification rather than inventing
requirements. Preserve all existing work and report exact verification.
