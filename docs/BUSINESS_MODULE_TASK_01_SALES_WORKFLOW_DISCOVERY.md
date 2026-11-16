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

## Confirmed frontend inquiry workflow

The following workflow is confirmed from the current frontend implementation,
primarily `src/app/components/ClientPortal.tsx`,
`src/app/components/SalesOrders.tsx`, and `src/app/store/orders.tsx`. It
describes the existing Demo Mode behavior and preserves the implementation's
status terminology. It is not evidence that the workflow is persisted or
available in Real Mode.

### Client actions

1. A client submits an inquiry through the New Order wizard. The inquiry may
   contain one or more filter products, each product's specifications and
   quantity, plus supporting product-sketch attachments.
2. A newly submitted inquiry is created in the `inquiry` stage.
3. While the inquiry is in `inquiry` or `quotation`, the client may request
   cancellation. A non-empty cancellation reason is required. The request is
   represented by `pendingCancellation` and does not immediately archive the
   inquiry.
4. Cancellation is unavailable from the `po` stage onward. The current UI
   condition is `inquiry.stage !== "po"`; the normal active-order list exposes
   the action for `inquiry` and `quotation` records.
5. While the inquiry is in `quotation`, the client may request a quotation
   revision. A revision note of at least five characters is required. The
   inquiry remains in `quotation` and stores the note in `revisionNote`.
6. While the inquiry is in `quotation`, the client may approve and upload a
   Purchase Order. The upload moves the inquiry to `po`, stores the file/name
   and PO number locally, and starts with `poReceived: false`.

The client sees a pending cancellation message while the request awaits Sales
action. Active client lists exclude archived inquiries. The client
Transaction History view currently contains only non-archived `delivered` and
`paid` records; rejected and cancelled inquiries are not surfaced there.

### Sales actions

1. Sales may reject an inquiry only while it is in the `inquiry` stage. The
   rejection reason is mandatory in the UI. Rejection immediately sets
   `archived: true`, `archiveReason: "rejected"`, `archiveDate`, and
   `archiveNote`.
2. Sales may prepare and send a quotation. The inquiry moves to
   `quotation`. The Demo quotation builder supports product costing, quotation
   document data, delivery terms, discounts, VAT display, lead time, and
   downpayment display.
3. Sales may respond to a client revision request while the inquiry remains in
   `quotation`. The previous quotation document is appended to
   `quotationHistory`, `revisionNote` is cleared, and the new quotation stays
   in `quotation`.
4. Sales may review an uploaded PO and mark it received. This keeps the
   inquiry in `po` and sets `poReceived: true`.
5. Sales may approve or decline a pending cancellation request. Approval
   archives the inquiry with `archiveReason: "cancelled"`; declining removes
   `pendingCancellation` and leaves the inquiry active.
6. Archived rejected and cancelled inquiries remain in the Demo store and are
   retained in the Sales `Archived / Rejected Inquiries` panel. The frontend
   does not provide a hard-delete operation for these records.

### Status transition summary

```text
new inquiry       -> inquiry
Sales quotation   -> quotation
client PO upload  -> po
Sales PO receipt  -> po with poReceived=true
Sales rejection   -> archived, archiveReason="rejected"
cancel request    -> same stage with pendingCancellation
cancel approval   -> archived, archiveReason="cancelled"
cancel decline    -> same active stage with pendingCancellation removed
```

The later Demo transitions to `jo`, `in_production`,
`quality_inspection`, `ready_for_dispatch`, `dispatched`, `delivered`,
`paid`, and `overdue` are outside this confirmed inquiry/quotation/PO
workflow contract.

### Demo Mode, Real Mode, and evidence boundaries

- The inquiry submission, cancellation request/approval/decline, rejection,
  quotation creation/revision, PO upload/receipt, and related notifications
  currently operate through local React state, localStorage, IndexedDB
  attachments, and the Demo notification store.
- Demo notifications are local UI notifications only. They must not be
  treated as persisted backend notifications or audit records.
- No Demo operation above creates a backend audit record, and no corresponding
  persisted server write path was found for these workflows.
- Real Mode currently provides read-only Client and Sales views. It exposes
  order, quotation, PO, JO, delivery, invoice, payment, dashboard, and
  notification reads, plus client notification read-state. It does not expose
  inquiry creation, cancellation, rejection, quotation creation/revision,
  PO upload/receipt, or related Sales workflow mutations.
- Existing focused tests cover Real/Demo separation, read adapters, mapping,
  filters, loading, retry behavior, and read-only write rejection. No focused
  frontend workflow test currently executes the complete Demo cancellation,
  rejection, quotation-revision, or PO-review flows.

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
