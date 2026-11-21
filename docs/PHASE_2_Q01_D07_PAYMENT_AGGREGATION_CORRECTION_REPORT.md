# Phase 2 Q01 D07 payment aggregation correction report

Date: 2026-11-21, Asia/Singapore. **Application correction and focused regression tests authored. Tests and runtime acceptance remain pending operator execution.** No database was accessed or changed.

## A Implementation summary

D07 was a mismatch between the payment entity and its one-to-many attachment relationship. The Sales JO prerequisite summed `payments.verified_amount` after joining every matching `payment_files` row. A verified payment with three attachments appeared three times in that sum. Accounting payment list/detail, the Accounting proof queue and the Client payment list also joined several proofs into a response whose consumers expect one row per payment.

The implementation now:

- Uses correlated `EXISTS` for the JO attachment prerequisite while summing directly over payment rows and the existing submitter identity join.
- Uses a scalar `MIN(file_id)` proof projection in Accounting list/detail, preventing attachment count from consuming payment pagination slots or duplicating ledger rows.
- Restricts the existing proof joins in the proof queue and Client payment list to the same lowest numeric proof-file ID per payment. The queue retains a stable payment-ID tie-breaker for equal submission times.

`MIN` is applied to the numeric file ID before any CHAR cast. It is a deterministic representative for the existing singular file fields, not a claim that the lowest ID is the latest, approved or only proof. All attachment rows, purposes and retrieval relationships remain intact. No new array response or one-file restriction is introduced.

The JO sum does **not** use `SUM(DISTINCT amount)`. Two different payments of the same amount remain two contributions. `EXISTS` returns a yes/no attachment predicate, so zero/one/many file rows cannot change a qualifying payment's multiplicity. The proof selectors use the existing `(payment_id,file_id)` PK contract to bind at most one link to the chosen numeric file ID.

### Deliberately preserved eligibility semantics

The prior JO query required **some attachment**, without a purpose or file-availability predicate. This correction preserves that requirement exactly. Receipt-only attachment eligibility is explicitly covered by a regression; tightening it to “available proof only” would be a separate business restriction and has not been silently applied.

Proof fields and the proof-review queue remain restricted to `purpose='proof_of_payment'`; receipts do not become representative proofs. The queue retains pending, verified and rejected downpayments and excludes payments without a proof, as before. Accounting payment list/detail and Client payment reads retain payments without a proof with NULL proof fields. Client proof filename projection retains its existing `files.state='available'` condition. No new availability filter is added to payment amounts or the JO gate.

All existing Sales employee checks, parameterized client/order/invoice scope, accepted/latest quotation, validated PO, issued invoice, exactly 20%/50% downpayment validation, verification-state checks and transaction boundaries are preserved. Review/rejection writes, upload writes, balances, paid-state transitions and inventory behavior were not modified.

## B Changed files

| File | Change |
| --- | --- |
| `backend/src/services/sales-orders.service.js` | Replaces the JO aggregate's repeating attachment join with `EXISTS`, retaining its parameters and eligibility predicates. |
| `backend/src/services/accounting.service.js` | Scalar representative-proof lookup in payment list/detail; removes repeating attachment joins before LIMIT. |
| `backend/src/services/document-workflows.service.js` | One representative proof per payment in the existing review queue; stable ordering; review/upload/retrieval methods unchanged. |
| `backend/src/services/client-portal.service.js` | Binds Client payment proof/filename join to one deterministic proof, preserving the owned-order guard and amount masking. This directly related D07 projection was encountered while tracing consumers. |
| `backend/src/services/sales-orders.service.test.js` | Updates the existing JO SQL double for the semijoin and adds attachment/amount/status/ownership/invoice cases plus protection of the already-correct Sales summary. |
| `backend/src/services/accounting.service.test.js` | List/detail cardinality, numeric proof selection, equal payments, nullable proof, amount masking, LIMIT and independent invoice-sum coverage. |
| `backend/src/services/document-workflows.service.test.js` | Queue cardinality/purpose/state/ID coverage; preserves existing verification/rejection and required-amount behavior. |
| `backend/src/services/client-portal.service.test.js` | Deterministic proof SQL, exact projection, amount masking and owned-parent denial coverage. |
| `src/app/components/sales/pipelineModel.test.mjs` | Exercises the existing pure readiness/payment helpers with two equal payments: downpayment satisfied, invoice not fully paid. No production frontend code changed. |
| `docs/PHASE_2_Q01_D07_PAYMENT_AGGREGATION_CORRECTION_REPORT.md` | This implementation, findings, approval and operator-verification record. |

Pre-existing untracked Task 001 documents and `docs/phase-2-task-002/` were preserved. No architecture review, SQL evidence package, protected artifact, migration definition, schema dictionary, frontend layout or permission map was edited.

## C Payment calculation impact

| Path | Before | After and compatibility |
| --- | --- | --- |
| Sales JO verified downpayment sum | One verified payment counted once per attachment. | Each eligible payment counted once if any attachment exists. Same client/order/invoice, client submitter, DOWNPAYMENT and verified filters unchanged. |
| Accounting payment list | Multiple proofs duplicate the payment and consume LIMIT slots. | One row per payment; lowest numeric proof ID or NULL. Existing fields, filtering, exact monetary strings and payment-based LIMIT retained. |
| Accounting payment detail | Several proof rows, then an arbitrary first result. | One payment row with a stable proof representative. NOT_FOUND and permission/input validation unchanged. |
| Accounting proof queue | Several proofs produce several review cards for the same payment ID. | One card per proof-bearing downpayment, preserving recorded decision status and existing `fileId` shape. |
| Client payment collection | Several proofs duplicate the submitted/verified amounts and payment records. | One owned payment projection with stable proof ID/filename and existing verified-amount masking. |
| Sales list/detail summary | Already sums verified payments in an independent correlated subquery; detail loads payment rows separately. | Unchanged. Adds a regression against future attachment joins. |
| Accounting invoice totals | Already aggregates verified payments independently for the invoice. | Unchanged. Adds protection for the existing amount/query contract. |
| Sales dashboard revenue | Already sums verified payments directly and groups monthly totals by paid date, without attachment joins. | Unchanged. Existing dashboard regressions are reused. |
| Outstanding/full-paid interpretation | Downpayment and invoice settlement have separate amounts and prerequisites. | Unchanged. A 20 payment against a 100 invoice can satisfy JO readiness without making that invoice fully paid. No status promotion or financial write was added. |

Examples are explanatory, not executed results: 7 with three attachments remains 7, rather than 21. Separate 10 and 10 payments sum to 20, rather than collapsing to 10. Separate 7 and 13 sum to 20. Pending/rejected records do not contribute to the verified JO sum. A payment assigned to a different client, invoice or order does not satisfy the scoped JO gate.

### API and frontend consumers reviewed

- Sales `POST /api/sales/orders/:id/job-orders` and `GET /api/sales/orders[/:id]`; `sales-orders.service.js`, existing Sales adapters and `pipelineModel.mjs` use payment rows/invoice amounts independently. No Sales UI or API field was changed.
- Accounting `GET /api/accounting/payments[/:id]` and `GET /api/accounting/invoices[/:id]`; `src/app/api/accounting.ts`, `RealAccounting.tsx` and the existing Accounting integration retain their types. `accountingInvoiceRow` no longer receives duplicate payment rows from these proof joins.
- `GET /api/documents/accounting/payment-proof-queue`; `documentWorkflows.ts`, `RealPaymentProofQueue.tsx` and `loadAccountingRecords` assume one review row per payment ID. The backend correction addresses repeated cards/duplicate missing-payment fetches at their source.
- The owned Client payments reader and Client `adapters.ts` retain the existing `proofFileId`/`proofFilename` and amount/status shape. No Client layout or navigation was changed.

Existing secure file retrieval can still retrieve any authorized linked file using its payment/file identity. The singular representative fields do not provide a new attachment browser or claim to list every proof. Any broader multiple-proof UI/API contract needs separate review.

## D Regression coverage

**No tests were executed. No pass, fail or runtime persistence result is claimed.** Tests reuse Node's existing test runner, service factories, injected connection doubles and the existing database-blocking import hook. No new test database, SQL engine, migration harness or fixture layer was introduced.

| Test area | Authored/reused scenarios |
| --- | --- |
| Sales JO aggregation | Zero attachments; one proof; several proofs plus receipt cannot turn a short payment into an eligible one; separate different/equal amounts; receipt-only gate compatibility; pending/rejected; different client; employee submitter; different invoice/order; balance payment excluded. Existing tests cover validated PO, duplicate JO, missing invoice and required downpayment. |
| Sales summaries | Exact returned invoice/verified strings, independent payment-only aggregate, stage remains PO rather than becoming fully paid. |
| Accounting | Zero/one/multiple attachments; receipt-only NULL proof; numeric rather than lexicographic representative ID; same representative in list/detail; separate equal-valued payments; pending/rejected verified amount masked; payment-level limit and NOT_FOUND. Existing tests preserve bounded parameters, actor checks and filter validation. |
| Invoice totals | Payment-only verified sum remains independent of files; list/detail preserve exact stored amount/required-downpayment/verified strings. |
| Proof queue | No attachment/no proof excluded; multiple proofs collapsed to one representative; receipts never selected as proofs; pending/verified/rejected decisions retained; non-downpayment excluded; BIGINT strings retained. |
| Review rules | Pending verify/reject, required rejection reason, already-decided rejection, required amount mismatch, existing conditional update and commit behavior. |
| Client projection | Same numeric MIN restriction; proof purpose; existing available-filename condition; exact amounts and masking; wrong-client owned parent stops before payment lookup. |
| Pure Sales readiness | Two equal verified amounts satisfy the required 20 but not the full 100; changing one to pending removes readiness. |

The doubles assert required SQL structure and filter/parameter scope before returning synthetic relational fixtures. They do **not** parse or execute SQL, certify MySQL syntax/optimizer behavior, or establish real locking/constraint/read-back behavior. The different-invoice/order negative fixtures deliberately test scope rejection even where such combinations would conflict with the intended deployed composite FK; they are never persisted. Existing synthetic upload tests remain tests only, not authorization for a live upload.

## E Database architecture findings and correction proposals

The source dictionary, current SQL and prior evidence package establish the **intended** structures: `payments.id` is an unsigned BIGINT PK; monetary values are DECIMAL(15,2); `payments(invoice_id,order_id)` references the same-order invoice and invoice is nullable for pre-invoice payments; submitter/reviewer reference users; payment review CHECKs bind verification state/amount/actor/time. `payment_files` has `(payment_id,file_id)` as its PK, proof/receipt purpose, and separate FKs to payments/files. This valid one-to-many relationship supports several attachments and does not require replacing or removing a table.

**No deployed metadata or records were inspected.** Actual keys/indexes/constraints, affected counts, corrupted histories and runtime costs remain unverified. Existing M/P12/P13 operator evidence is still useful; the prepared Phase 2 investigation files remain unchanged. The P12 “current join” expression in that dated package models the pre-Q01 defect, so after this patch it is a counterfactual impact comparison rather than a verbatim description of corrected application SQL.

### F01 Payment entity versus attachment cardinality

1. **Classification/affected structure:** confirmed application defect, not confirmed schema redundancy; `payments.id` → `payment_files.payment_id` one-to-many and singular proof projections.
2. **Evidence:** original JO sum joined every attachment; the three payment projection families lacked a single-proof bound. Source PK allows multiple different file IDs.
3. **Problem:** amounts or payment rows multiplied by attachment multiplicity; detail/preview identity was nondeterministic.
4. **Target:** retain both tables, keys and multiple attachments; aggregate at payment grain and select an explicit representative only for legacy singular fields.
5. **Object operations:** none; application SQL corrected in Q01. No add/merge/archive/remove/migrate of database objects.
6. **Modules/endpoints:** Sales JO eligibility, Accounting payment list/detail/queue and owned Client payment list, listed in section C.
7. **Existing records/history:** none rewritten, discarded or renumbered. Actual exposed population pending P12/P13/operator evidence.
8. **Risks/dependencies:** intended PK/FK shape must be confirmed in deployment; old duplicate projections can have affected consumers without corrupting stored records.
9. **Order:** Q01 source fix first, operator regressions next; data impact assessment separate.
10. **Approval/task:** application correction authorized and implemented; no structural correction proposed by this finding.

### F02 Multiple proofs versus a singular public proof field

1. **Classification/affected structure:** recommendation or improvement; several `payment_files` proof links versus `proofFileId`, `proofFilename` and queue `fileId`.
2. **Evidence:** the source association permits multiple proofs; Accounting and Client types expose one file, and the queue reviews by payment ID.
3. **Problem:** one field cannot communicate all proof history or an owner-defined “active proof.” Q01 supplies stable representation, not an active-proof policy.
4. **Target:** retain the association; if broader functionality is approved, add a deliberate attachment collection while retaining the singular compatibility field, or specify an approved active-proof workflow. Do not infer “latest wins.”
5. **Object operations:** no DDL needed for a read-only attachment collection. An active-proof relation/version field would be a separate reviewed structural design, not approved here.
6. **Modules/endpoints:** Accounting/Client payment reads, proof queue and secure attachment previews.
7. **Existing records/history:** preserve every link/purpose and rejected proof. Actual multi-proof count pending.
8. **Risks/dependencies:** review amount/payment identity versus file selection, unavailable files, historical receipts and compatible UI behavior. No one-file uniqueness constraint.
9. **Order:** review the representative policy after Q01; implement expanded attachment behavior separately if requested.
10. **Approval/task:** separate task and explicit owner approval; not implemented as a database change.

### F03 Possible proof lookup index

1. **Classification/affected structure:** recommendation requiring additional database evidence; `payment_files(payment_id,purpose,file_id)` lookup order.
2. **Evidence:** original source PK is `(payment_id,file_id)`; corrected projections filter payment and proof purpose, then select numeric minimum. Actual indexes/row counts are unknown.
3. **Problem:** the PK already supports payment scoping; a large per-payment attachment set might require extra purpose filtering. This is a possible cost, not a measured missing-index incident.
4. **Target:** consider a nonunique `(payment_id,purpose,file_id)` index only if actual M05 metadata and an approved query plan/volume justify it.
5. **Object operations:** potentially add an index; no PK removal, unique constraint, table merge or row migration.
6. **Modules/endpoints:** Accounting list/detail, Client payment list and proof queue. The JO `EXISTS` can already use the payment-ID PK prefix.
7. **Existing records/history:** index maintenance affects writes/locking/size but must not change any link or history.
8. **Risks/dependencies:** duplicate existing index, online DDL support, table size, lock budget and compliant migration path. No `EXPLAIN ANALYZE` or live plan was run.
9. **Order:** collect metadata/ordinary EXPLAIN under separate operator review after Q01; add only if justified.
10. **Approval/task:** separate index proposal requiring explicit approval; not created or applied.

### F04 Deployed ownership and composite key evidence remains missing

1. **Classification/affected structure:** requires additional database evidence; `payments(invoice_id,order_id)` → `invoices(id,order_id)`, payment/file PK/FKs and user actor identities.
2. **Evidence:** the permitted source dictionary declares these keys. Some readers rely on invoice identity alone because the intended composite FK enforces matching order. JO also explicitly filters client submitter/order/invoice.
3. **Problem:** source declarations do not prove actual deployed enforcement. A plain user FK proves actor existence, not that a client actor belongs to the order. No bad FK or cross-owner record is claimed.
4. **Target:** confirm/retain intended same-order invoice and attachment integrity; keep server-derived client/actor checks. If actual relationships are missing, propose the exact original invariant after record profiling. Do not force invoice NOT NULL or prohibit legitimate employee-originated records without a workflow decision.
5. **Object operations:** none now; restoring a demonstrably missing FK/key would require a separately approved addition/change and incompatible-record reconciliation.
6. **Modules/endpoints:** Sales JO prerequisite, Accounting invoice/payment reads, Client uploads and secure document retrieval.
7. **Existing records/history:** affected population unknown; preserve valid pre-invoice payments and actor history. Never fabricate invoice ownership or delete dangling evidence automatically.
8. **Risks/dependencies:** nullable relationships, legitimate historical actors, actual PK uniqueness, live metadata visibility and authoritative correction data.
9. **Order:** M04–M08 and scoped profiles before any constraint proposal; Q01's explicit existing JO scope is retained now.
10. **Approval/task:** separate deployed-schema reconciliation task if evidence shows a defect; no structural change approved or implemented.

### F05 Existing D08 payment replay risk encountered in the same service

1. **Classification/affected structure:** confirmed source defect with unknown affected records; `payments.idempotency_key` and proof submission identity.
2. **Evidence:** `document-workflows.service.js` still creates a timestamp-based downpayment operation key; the original D08 matrix documents absent stable matching-retry identity.
3. **Problem:** separate retry rows are distinct payments; D07 correctly counts each stored payment once and cannot decide that two rows are the same real-world transfer.
4. **Target:** stable actor/order/invoice submission identity and canonical payload binding, with approved rejection/resubmission behavior.
5. **Object operations:** source/Client contract change; optional additive receipt metadata only after reviewing existing capacity. No deletion/deduplication or historical migration now.
6. **Modules/endpoints:** Client proof upload, Accounting verification/revenue and Sales JO eligibility.
7. **Existing records/history:** similar amounts/references are not proof of duplicate transfers. Actual retry population is unknown.
8. **Risks/dependencies:** legitimate equal payments, lost responses, ambiguous commits and canonical exact amount encoding.
9. **Order:** separate D08 scope after Q01 and agreed exact arithmetic/replay contract.
10. **Approval/task:** separate correction; not implemented here.

### F06 Existing D09 binary arithmetic remains outside Q01

1. **Classification/affected structure:** confirmed source risk/defect; quote/downpayment calculations and payment amount comparisons over DECIMAL-backed values.
2. **Evidence:** current service code retains Number/rounding/epsilon logic described in D09; Q01 only changes SQL cardinality.
3. **Problem:** exact storage alone does not establish decimal-safe application arithmetic. D07 must not conceal this by changing formulas or repricing documents.
4. **Target:** exact arithmetic with explicitly approved scales and existing rounding/formula behavior.
5. **Object operations:** no money-type change automatically required; source correction first, historical repair only with authoritative evidence/approval.
6. **Modules/endpoints:** quotation creation, invoice/PO eligibility, proof upload/review and JO downpayment gate.
7. **Existing records/history:** no causal rounding population measured; issued amounts remain unchanged.
8. **Risks/dependencies:** VAT/discount/markup order, two-decimal payable totals, legacy drafts and exactly 20%/50% downpayment.
9. **Order:** separate D09 work package before any attempt to reconcile historical rounding/replay digests.
10. **Approval/task:** separate approval; no arithmetic rewrite included.

### F07 Existing D11 and D12 document identity/recovery issues

1. **Classification/affected structure:** confirmed source defects; `files` state/bucket/generation metadata, payment/PO links and external object lifecycle.
2. **Evidence:** unchanged upload helper stores external content before final SQL commit; unchanged retrieval selects object path without persisted bucket/generation. Prior D11/D12 matrix records these paths.
3. **Problem:** SQL rollback cannot itself reconcile an external upload; wrong/default object identity can undermine historical retrieval. Selecting one proof does not solve either issue.
4. **Target:** durable generation-bound upload/recovery evidence and retrieval using the persisted authorized identity, adapting existing Engineer Sketch concepts where appropriate.
5. **Object operations:** source corrections; additive lifecycle metadata only if necessary and approved. No bucket setup, cleanup, object deletion or metadata migration now.
6. **Modules/endpoints:** Client proof/PO uploads and Accounting/Sales/Client secure file retrieval.
7. **Existing records/history:** object existence, missing uploads and actual orphan-object count are unknown; preserve all accepted links and generations.
8. **Risks/dependencies:** ambiguous commit, NULL legacy generations, accepted evidence retention, private storage access and cross-owner authorization.
9. **Order:** separately review D12 retrieval compatibility and D11 lifecycle/replay design; storage evidence requires authorization.
10. **Approval/task:** separate tasks; unchanged in Q01.

### F08 Nullable invoice relationship conflicts with the Accounting consumer contract

1. **Classification/affected structure:** confirmed source/API compatibility defect; legitimate nullable `payments.invoice_id` versus `AccountingPayment.invoiceId: string` and the missing-invoice loader.
2. **Evidence:** the source dictionary explicitly permits pre-invoice payments. `accounting.service.js` returns the nullable cast; `src/app/api/accounting.ts` types it as non-null. `RealAccounting.tsx` collects every payment's invoice ID into `missingInvoiceIds` and calls `getAccountingInvoice` without excluding NULL.
3. **Problem:** a legitimate unassigned payment can cause a request for an invalid invoice identifier and fail the combined Accounting load. No live unassigned payment or observed UI failure is claimed.
4. **Target:** represent invoice ID as nullable in the API type and handle unassigned payments explicitly in the existing Accounting data adapter, preserving the ledger record without inventing an invoice or changing the established UI layout.
5. **Object operations:** no DDL is indicated. Do not make invoice ID NOT NULL, fabricate an invoice association, remove the payment or migrate valid pre-invoice history to satisfy the frontend assumption.
6. **Modules/endpoints:** Accounting payment list/detail, invoice detail lookup, `loadAccountingRecords` and its invoice/payment adapter.
7. **Existing records/history:** potentially any payment with NULL invoice ID; actual count remains pending operator evidence. Current proof upload requires an invoice, which does not eliminate the schema's legitimate historical/pre-invoice states.
8. **Risks/dependencies:** approved presentation/handling of unassigned records, bounded list loading and exact parent ownership. A missing invoice and an intentionally unassigned payment must not be conflated.
9. **Order:** separate bounded API/adapter correction after Q01; use synthetic NULL-invoice cases before any approved live read-back.
10. **Approval/task:** separate source correction requiring review; not implemented in Q01 and not a database structural change.

No confirmed redundant, unnecessary or duplicate database table/column was established in this bounded review. In particular, `payment_files` is a legitimate typed association and `files` is a separate metadata entity. No removal/merge is proposed merely to make a query return fewer rows.

## F Database Change Report

**Tables reviewed through source/documentation:** `payments`, `payment_files`, `files`, `users`, `orders`, `invoices`, and the related accepted PO/quotation prerequisites used by JO creation. Their intended PK/FK/CHECK/DECIMAL contracts were reviewed using the preserved source dictionary and current service SQL; no actual table or record was queried.

**Schema modifications performed:** NO. **Records modified:** NO. **Migrations created/applied:** NO. **Database infrastructure, grants, credentials, certificates, Docker or cloud resources changed:** NO. **Database connections or SQL execution:** NONE. **Tests/build/lint/runtime/browser/database verification executed:** NONE.

**Proposed database changes:** F03 conditional nonunique index and F04 conditional restoration of an actually missing intended relationship, only if future evidence justifies them. F02/F05/F07 may need separately reviewed additive metadata depending on the approved design; none is execution-ready or automatically required. No repair/import/cleanup, fabricated stock/BOM/price, table/column removal, ledger alteration or historical migration was performed.

**Protected resources:** Migration 007 and its checksum/history were untouched and uninspected. Protected Task 003 snapshot artifacts and preserved Phase 1 Task 002 runtime/database were not accessed or changed. No migration directory enumeration, test rerun, resource teardown, commit or push occurred. Existing uncommitted work was preserved.

## G User review and approval items

Review the application patch and its explicit lowest-numeric-proof representative behavior. Existing purpose/availability/receipt semantics remain as described in A; changing those rules is a separate decision.

The following database proposals are **not approved or implemented**:

1. F03 optional proof lookup index, after actual metadata/plan evidence.
2. F04 any ownership/key/FK restoration or relationship redesign, only after deployed evidence and record reconciliation.
3. F02 active-proof/version metadata or expanded attachment contract if desired; no one-file restriction.
4. F05 replay receipt/identity metadata, if the separate D08 design requires it.
5. F07 any lifecycle metadata, historical repair, cleanup or object-storage action for D11/D12.

F06's arithmetic correction and F08's nullable-invoice API/adapter correction also need their own bounded approval, even though they may require no database change. No additional implementation task starts automatically.

## H VS Code terminal commands

Run from the repository root **after reviewing the patch**. These commands were not executed by Codex. They use existing explicit test files and the existing fail-closed database import hook. Use the project's supported Node runtime with `node:module.registerHooks` support; do not remove the hook or substitute a live database if the environment fails.

```powershell
node --import ./backend/test/support/mock-database.js --test backend/src/services/sales-orders.service.test.js backend/src/services/accounting.service.test.js backend/src/services/document-workflows.service.test.js backend/src/services/client-portal.service.test.js backend/src/services/sales-dashboard.service.test.js
```

```powershell
node --test src/app/components/sales/pipelineModel.test.mjs src/app/components/realAccounting.test.mjs
```

The backend command covers all modified backend tests plus the existing directly related Sales dashboard aggregation coverage. The frontend command covers the changed pure readiness test and existing Accounting adapter/source/render integration tests. No route/controller/API type or production frontend code changed, so a broad build/browser/full-suite command is not required for this bounded first check. If either command fails, retain the full output and stop; no passing count is predeclared. Do not invoke database/migration tests, importers, Task 002 runtime phases or protected snapshot tools.

## I Remaining limitations and completion state

The D07 source correction and focused regressions are implemented and ready for review. Operator test results remain pending; compilation, SQL execution, MySQL plans, actual constraint integrity, authenticated persistence/read-back and browser acceptance have not been established. Injected doubles and SQL contract assertions cannot certify those properties.

No live count of previously inflated records, incorrect JO decisions or duplicate real transfers is claimed. Existing database evidence remains needed for F03/F04 and any repair proposal. The new stable representative can point to an unavailable older proof because Q01 does not invent an availability/latest-proof policy; secure retrieval retains its existing behavior. Distinct stored payments remain distinct even if later D08 investigation finds a replay.

Review this patch, execute only the focused operator commands, and return their results. Stop here; no database structural correction or next work package has begun.
