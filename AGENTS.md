# ENTER-FLOW V2 development instructions

## Architecture and references
- Frontend: React + TypeScript + Vite. Backend: Node.js + Express, JavaScript ES modules. Database: MySQL 8.4.13 via `mysql2/promise`; local development uses Docker.
- Future deployment: Firebase Hosting, Cloud Run, Cloud SQL for MySQL, private GCS. Do not provision or deploy without approval.
- Original authority: the 28-page Phase 1 handoff, recorded in `docs/WAREHOUSE_INVENTORY_PHASE_1_REPORT.md`. If unavailable, report the gap; do not invent requirements.
- Reuse `docs/BUSINESS_MODULE_DEVELOPMENT_HANDOFF.md`, `docs/PHASE_1_RESUMPTION_HANDOFF_2026-11-18.md`, Warehouse/Sales reports, and `docs/TESTING.md`. Historical reports are dated evidence, not proof of current state. Task 001 readiness: `docs/TASK_001_INTEGRATION_TEST_READINESS_2026-11-19.md`.

## Interfaces, business rules, and security
- Integrated MAIN is the authoritative visual reference. Preserve existing interfaces, component hierarchies, layouts, and all nine roles; do not redesign working interfaces.
- Preserve authentication, authorization, RBAC, validation, ownership, auditability, and secure file handling. Frontend visibility is not authorization. No RBAC or business-restriction changes without approval.
- Preserve Sales quotation, payment, PO, JO, Warehouse, and cross-role rules, including mandatory downpayment of exactly 20% or 50%.
- Read-only quotation/stock checks must never reserve or deduct inventory. No unapproved Procurement module.
- Keep Demo data/local storage out of Real Mode. Preserve decimal-safe money and decimal-string BIGINT IDs; never fabricate stock, prices, BOMs, or successful persistence.

## Database safeguards
- Inspect current schema and records before proposing changes/imports. Never assume historical counts are current. The 71 verified MAIN catalog records are a separate scope from the reported 158 imported materials; do not blindly reimport them.
- No unapproved schema changes, writes, imports, migrations, data repair, or destructive operations. Do not change credentials or Docker resources without authorization.
- Never access, inspect, alter, execute, or modify protected Migration 007 or its history/checksum. Avoid commands that enumerate/hash migrations or read the entire migration ledger; inspect their implementation before use.
- Verify test isolation before running state-changing tests. Never use shared `enterflow_db` for destructive tests; do not assume `NODE_ENV=test` provides isolation.
- Every backend task requires a Database Change Report: tables reviewed, schema/data changes proposed and performed, migrations created/applied, pending approvals, and confirmation that Migration 007 was untouched, even when no database changes occur.

## Git and task workflow
- Inspect Git status first. Preserve uncommitted changes and groupmate contributions.
- No unauthorized commit, push, reset, clean, stash, merge, rebase, restore, or branch switch. Never reset to historical commit `1f4493c3`.
- One task = one measurable outcome; completion requires demonstrated acceptance evidence. Investigate only relevant dependencies, reuse existing code, and implement the smallest safe correction.
- Run focused tests during development and broader regressions at suitable milestones. Prefer genuine authenticated API-to-MySQL persistence/read-back evidence; mocks and source checks do not prove live behavior.
- Stop dependent work when authoritative business data or explicit approval is missing. Continue only independently authorized work.
- Keep completion records concise: changed files, completed work, evidence, limitations/blockers, pending approvals, and the Database Change Report when applicable. Do not start the next task automatically.


<!-- TASK_002_RUNTIME_CLOSED_2026_11_21 -->
## Task 002 — Completed (2026-11-21)

- Status: COMPLETE for approved isolated runtime testing and guarded cleanup.
- First and second isolated integration runs recorded as PASS.
- Second run ID: 2f07518b9819d0c1.
- Login and Inventory APIs: HTTP 200.
- Runtime grants, attestation, and schema verification: PASS.
- Guarded cleanup: 1 session, 1 material, and 1 user deleted.
- Final ownership journal: cleaned; cleanupStatus=complete.
- Report: docs/TASK_002_FINAL_RUNTIME_COMPLETION_REPORT_2026-11-21.md.
- Full handoff: maintained separately in Google Docs.
- Preserve all existing security, RBAC, business rules, database approval/reporting, and Git safeguards.
- No Task 002 reruns, migrations, or test infrastructure teardown without separate approval.
- Task 003 is not automatically authorized.
