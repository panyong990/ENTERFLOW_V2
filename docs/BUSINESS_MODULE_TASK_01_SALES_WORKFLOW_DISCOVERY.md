# Business Module Development — Task 01
## Sales inquiry/order workflow discovery and contract

**Task type:** bounded discovery and requirements-contract task.  
**Status:** ready for source/document inspection; implementation is not yet
authorized.  
**Parent handoff:** [BUSINESS_MODULE_DEVELOPMENT_HANDOFF.md](BUSINESS_MODULE_DEVELOPMENT_HANDOFF.md).

## Objective

Produce an evidence-based inventory of the existing Sales inquiry/order
behavior and obtain business-owner approval for one narrowly scoped
operational workflow to implement next. The first recommended implementation
module is Sales & Orders, but the current evidence does not select a specific
write transition or establish its business rules. Do not invent one.

The deliverable is a short, owner-reviewable contract that maps the selected
workflow from its current UI through its API and persistence boundaries, states
the permitted behavior precisely, and identifies dependencies and tests.

## Scope

1. Inspect the existing worktree first and preserve every modified/untracked
   file.
2. Trace the Sales inquiry/order experience through the existing frontend,
   backend, permissions, service validation, data model documentation, and
   tests.
3. Inventory the operations already supported and classify each as
   implemented, partial, missing, or unverified. Distinguish read APIs from
   writes and UI state from persisted state.
4. Ask the business owner to select and specify one first operational
   transition, including actor, starting state, requested action, resulting
   state, validation, rejection/conflict behavior, history/audit effects,
   notifications, and related-record effects as applicable.
5. Record an implementation-ready contract only after those rules are
   confirmed. If any required behavior remains ambiguous, stop at discovery
   and list the exact questions for the owner; do not begin application-code
   changes.

## Existing implementation to inspect

Use the current repository as authoritative and confirm paths/call sites before
relying on this inventory:

- Backend Sales route entry: `backend/src/routes/sales.routes.js`.
- Sales controllers, `sales-*` services, validation modules, and focused
  service/HTTP tests under `backend/src/controllers`,
  `backend/src/services`, `backend/src/validation`, and `backend/src/routes`.
- Sales frontend pages/components and hooks, including `RealSalesOrders.tsx`,
  `useSalesOrders.ts`, and associated clients, documents, job-order, and
  delivery hooks under `src/app/components`.
- Sales API adapters and tests, including `src/app/api/salesOrders.js`,
  `salesClients.js`, `salesOrderDocuments.js`, `salesJobOrders.js`, and
  `salesDelivery.js`.
- Shared role/permission definitions and authentication/permission
  middleware. Confirm server-side checks rather than relying on navigation.
- Existing inquiry/order, quotation, purchase-order, job-order, delivery,
  audit, and status documentation. Use schema files or documentation only;
  no database inspection is part of this task.
- Existing cancellation-request panel and state handling. Determine whether
  each displayed action is persisted by an API or is only represented in UI
  state; do not infer server-side behavior from the panel.

The project handoff documents Sales directory/order reads, quotation history
and PO reads, dashboard metrics, job-order/delivery summaries, and
notifications. It does not establish that all Sales operational writes are
implemented.

## Expected behavior and contract output

The discovery result must:

- Map each relevant screen action to its adapter, route, permission,
  controller/service, persistence behavior, and existing tests.
- Separate observed behavior from historical reports, assumptions, and
  owner-confirmed rules.
- Name exactly one proposed workflow and specify its accepted inputs, actor
  authorization, prior-state requirements, resulting state, visible outcome,
  error/conflict behavior, history/audit requirements, and related side effects
  where applicable.
- Identify unchanged behavior and explicitly excluded neighboring workflows.
- Define test cases and whether implementation can use mock/unit tests or
  needs an authorized isolated integration environment.
- Leave the workflow unselected and unimplemented if owner clarification is
  required. A missing decision is a stop condition, not permission to guess.

No sample inquiry ID, fixture status, displayed button, or schema column is a
business rule by itself.

## Applicable established rules

Preserve the rules already documented in the project handoff and
[PRE_BUSINESS_DEVELOPMENT_TASKS_28-32.md](PRE_BUSINESS_DEVELOPMENT_TASKS_28-32.md):

- Sales read access is company-wide only as allowed by the existing permission
  map; every write must have its own explicit permission check.
- Client ownership must be derived server-side; never trust a client-supplied
  company name or record owner.
- Quotation, job-order, production, shipment, delivery, invoice, payment, and
  notification statuses are separate. Do not combine them into a new public
  status without an approved rule.
- Internal costing, margins, employee identities, notes, audit data, and
  credentials are not client-visible by default.
- Demo Mode must remain isolated from authenticated Real Mode and persisted
  server data.
- Existing read-only operations must remain read-only.

If a rule needed for the proposed workflow is absent or ambiguous, obtain an
owner decision before implementation.

## Dependencies and restrictions

- Task 32 is PARTIAL and conditionally clears bounded development. This task is
  the first discovery/contract step; it is not authorization for a write API.
- Preserve the current branch, HEAD, and all uncommitted changes. Inspect the
  worktree before editing; do not stage or commit unrelated files.
- No database connection/query, schema change, migration, seed, or data
  modification is authorized.
- Migration 007 remains deferred and strictly off-limits. Do not open, read,
  search, hash, parse, copy, alter, or execute it or its checksum. Preserve the
  Task 28 restriction deviation in the record and do not repeat it.
- Do not install dependencies, run browser tests, or use development,
  production, or browser-test databases for this discovery task.
- Do not expand scope to quotation generation, PO approval, invoice/payment,
  production, warehouse, logistics, or other workflows unless the owner
  explicitly selects that exact workflow in a separate approved task.

## Testing and acceptance criteria

This task is discovery/documentation only; it does not require code tests or a
database. The developer may inspect existing test files and document coverage,
but must not claim tests were run unless they actually were and were authorized.

The task is accepted when:

1. Existing UI-to-API-to-service paths and relevant permissions/tests are
   mapped with file references.
2. Existing persisted writes are distinguished from read-only endpoints and
   local/UI-only state.
3. The selected first workflow has explicit owner-confirmed actors, state
   transitions, validation, authorization, error/conflict behavior, and
   side-effect rules; otherwise the unresolved questions and stop condition
   are recorded.
4. Dependencies, data ownership, audit/history behavior, and excluded
   workflows are stated.
5. No application, schema, database, migration, credential, or unrelated
   worktree changes are made.
6. The next implementation task has focused backend/API and frontend
   acceptance tests defined. Any required isolated database or browser test
   environment is identified as a prerequisite, not silently substituted.

## Explicit exclusions

- Implementing any application behavior or changing API contracts.
- Selecting or inventing a quotation, PO, cancellation, invoice, payment, or
  other business transition without owner confirmation.
- Database access, schema/migration changes, Migration 007 access, or data
  changes.
- Production deployment, monitoring changes, dependency installation, browser
  test execution, or Git history operations.
- Reworking unrelated UI, refactoring other modules, or rebuilding completed
  technical foundations.

## Handoff after discovery

Return the workflow inventory and proposed contract to the business owner.
Proceed to a separate implementation task only after the owner confirms the
workflow and its acceptance criteria. The planned first implementation area
remains **Sales & Orders operational lifecycle**; its exact first operation
must come from that approved contract.
