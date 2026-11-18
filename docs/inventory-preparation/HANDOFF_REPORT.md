# Section 24 inventory decision and import preparation — handoff

November 18, 2026 (Asia/Manila). Branch integration/dev-phase-merge.

## 1. Task Overview

Produced approval-ready repository artifacts for comprehensive handoff Section 24, retaining original requirements and terminology. Reused the completed 71-material MAIN source reconciliation, existing planner, evidence template, saved snapshot and empty registry; did not redo MAIN extraction/comparison. [Primary approval packet](APPROVAL_PACKET.md) and [updated master tracker](../../PHASE_1_MASTER_PROGRESS_TRACKER.md).

Approval-ready means exact design/candidate rows can be reviewed. It does not mean the target, schema, quantities, current records or execution are approved/verified.

## 2. Implementation Summary

Delivered:

- [APPROVAL_PACKET.md](APPROVAL_PACKET.md): nullable proposal, exact affected tables, independent approval decisions, transactional/idempotency/validation/recovery strategy and Warehouse/Sales/Stock Request/Cloud SQL impact.
- [nullable-import-proposal.json](nullable-import-proposal.json): all 71 original catalog records and exact parameter arrays, NULL unknown stock, no invented numeric IDs, explicit documented target proposal and two digests.
- [material-import-review.csv](material-import-review.csv): matching 71 review rows. CSV is not an executable import command; JSON null is the binding authority.
- [verified-only-current-schema-plan.json](verified-only-current-schema-plan.json): default policy blocks all 71 unknown quantities.
- [reference-and-id-validation.json](reference-and-id-validation.json): exact required codes and all 71 pending mappings, repository checks versus unperformed database validation.
- [BOM_REQUIREMENTS.md](BOM_REQUIREMENTS.md) and [bom-business-data-required.json](bom-business-data-required.json): separate complete input checklist with empty templates/lines, not guessed BOM records.
- scripts/prepare-section24-inventory.mjs and its tests: deterministic offline generation and freshness verification.

## 3. Functional Changes

Pure planner adds explicit nullable-unknown policy; default verified-only behavior remains. Unknowns bind NULL only under that review policy; partial count evidence cannot silently become unknown. Added bounded DECIMAL(15,4) validation, conservative normalized-name duplicate detection, unique/known catalog mapping checks and unsigned BIGINT string bounds. Existing-row reuse checks suppliers and preserves actual stored stock. Dormant existing executor SELECT projection now includes supplier for exact reference comparison; no execution/connection occurred. It still reconstructs a verified-only plan and rejects a nullable-policy candidate digest.

No runtime controller, service workflow, API, UI, database config or application registry changed by this task. Existing authoritative catalog/reconciliation/evidence files and config/material-catalog-ids.json remain unchanged. Existing proposal digests are not reusable after these preparation safeguards; no earlier execution approval is inferred.

The JSON full reviewDigest binds target/schema/rows; candidatePlan.approvalDigest binds candidate operations/policy. Neither is a permission token. All 71 stock values remain unknown/NULL and all 71 actual numeric IDs remain unassigned. Six required unit codes and eight category codes pass repository allowlist checks; historical lookup counts alone do not prove current database references.

## 4. Verification and Testing

Exact commands:

```powershell
node scripts/prepare-section24-inventory.mjs --write
node scripts/prepare-section24-inventory.mjs --check
node --test --test-isolation=none scripts/prepare-section24-inventory.test.mjs
node --test --test-isolation=none --test-name-pattern="unknown quantities|reconciliation reuses|prepared executor" database/material-catalog-import.test.mjs
node --import ./backend/test/support/mock-database.js --test --test-isolation=none backend/src/services/inventory.service.test.js backend/src/services/stock-requests.service.test.js backend/src/services/sales-orders.service.test.js src/app/store/inventoryModel.test.mjs
git diff --check
git diff --quiet -- docs/inventory-reconciliation/integrated-main-catalog.json docs/inventory-reconciliation/catalog-reconciliation.csv docs/inventory-reconciliation/quantity-evidence.template.json config/material-catalog-ids.json
```

| Verification | Result | Exit |
|---|---|---|
| Artifact generation/freshness | Five files; 71 rows; executionAuthorized=false | 0 |
| New preparation tests | 13 passed; 0 failed/skipped | 0 |
| Selected legacy planner tests | 3 passed; 0 failed/skipped | 0 |
| Inventory/Stock Request/Sales consumers | 50 passed; 0 failed/skipped | 0 |
| Diff whitespace | Passed | 0 |
| Authoritative source/registry tracked diffs | None | 0 |

Completed MAIN source-reconciliation test deliberately excluded via name filter; no re-extraction or redundant source reconciliation. Tests compare generated artifacts to the already approved source manifest only. Executor calls in tests use injected in-memory doubles; no MySQL exists in test dependencies. No browser, actual physical count, fresh database/lookup state, live locking, persistence, cloud instance or import was verified. No production build was needed for this planner/artifact-only task. Counts are not added to earlier handoff/task results.

## 5. Git Change Summary

Extensive existing tracked/untracked work was present and preserved. Exact files written in this task:

1. database/material-catalog-import.mjs
2. scripts/prepare-section24-inventory.mjs
3. scripts/prepare-section24-inventory.test.mjs
4. docs/inventory-preparation/APPROVAL_PACKET.md
5. docs/inventory-preparation/BOM_REQUIREMENTS.md
6. docs/inventory-preparation/nullable-import-proposal.json
7. docs/inventory-preparation/material-import-review.csv
8. docs/inventory-preparation/verified-only-current-schema-plan.json
9. docs/inventory-preparation/reference-and-id-validation.json
10. docs/inventory-preparation/bom-business-data-required.json
11. docs/inventory-preparation/HANDOFF_REPORT.md
12. PHASE_1_MASTER_PROGRESS_TRACKER.md

No commit, push, merge, reset, restore, clean, stash or branch switch. No migration was created. Existing source reconciliation and runtime mapping registry were not replaced.

## 6. Database Change Report

**Performed:** database connections 0; SQL executed 0; live records inspected 0; schema/data/RBAC/credential changes 0; migrations/seeds/baselines/imports/Docker operations 0. No fabricated quantities, BOMs, mappings or business values. Migration 007 and its checksum/history remain uninspected and untouched.

**Proposed separately:** materials.quantity_on_hand DECIMAL(15,4) NULL DEFAULT NULL, retaining checks/keys; exact 71-row conditional materials INSERT candidate with unknown quantity bound NULL. Existing stock values/prices are not updated. units and material_categories: reference validation only. bom_templates and bom_template_lines: requirements only; no data row values or DML proposed. Stock Request, quotation/snapshot, finished-goods, account/session/audit and protected history tables unchanged.

The packet contains exact forward/reverse DDL text, INSERT shape and all parameters. Reverse DDL is forbidden while any NULL remains; never coerce unknown stock to zero. DDL implicit commits are separate from DML rollback. No statement in an artifact was executed.

## 7. Remaining Issues and Blockers

- Design A, import B, current target/TLS/reference/schema reads, operator/window, tested backup/restore and final post-reconciliation digest remain unapproved.
- Candidate assumes an empty material target for presentation; current data may differ. Must re-read/reconcile under explicit authorization before execution.
- External code-to-ID mapping is not a unique database catalog key. Maintenance exclusion and authoritative MySQL collation checks are needed; JavaScript normalization is conservative, not a collation emulator.
- The dormant executor is not a production importer: target/TLS, fresh reference validation, warning/read-back checks, maintenance exclusion and ambiguous-commit recovery remain execution-plan gates. This task intentionally does not make it execute the nullable proposal.
- Actual numeric mappings cannot be supplied before committed/reconciled IDs exist. Registry publication and database commit are not atomic; retain a protected operator manifest.
- BOM inputs, conversions, size applicability and waste-demand policy require business approval. Current selection is height-derived exact-size then NULL fallback; current stock demand excludes costing's waste multiplier. No behavior change was assumed.
- Registration/Sales/Inventory 503 diagnosis, live costing/stock workflows, scanner disposition and full nine-role acceptance remain open. Material import alone does not fix missing BOM costing or the unrelated 503.
- Cloud SQL compatibility is a design assessment supported by official docs, not proof of deployment/version parity. No cloud resources were touched.

## 8. Exact Next Steps

1. Review decision A's exact nullable/default DDL and consumer matrix; approve or reject explicitly.
2. Review all 71 values, NULL policy and source provenance in the CSV/JSON; do not approve speculative IDs or source default stock.
3. Separately approve exact target/operator/metadata-and-reference reads, backup/recovery and maintenance plan. No current task authorization extends to those operations.
4. Reconcile target materials/lookups, revise insert/reuse set and exact digest, then obtain separate execution approval. Design approval alone is insufficient; no nullable executor is enabled.
5. After an approved committed/reconciled import, review actual string-ID mapping publication and authorized API/browser checks.
6. Collect BOM requirements independently and present a separate exact BOM population plan. Continue remaining Phase 1 gates in the preserved tracker.

## 9. Handoff Status

Section 24 design and exact preparation artifacts: **Automated tests verified**. Nullable schema execution, catalog import, actual ID publication, BOM population and live integration: **Blocked** by approvals/data/prerequisites. Phase 1 remains incomplete; no workflow declared Fully accepted. Ready for design/dataset review, not execution.

