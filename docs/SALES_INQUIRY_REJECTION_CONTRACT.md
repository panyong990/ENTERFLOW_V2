# Sales Inquiry Rejection and Archival — Task 05

Status: implemented with synthetic/source/render verification; browser acceptance
and persisted integration remain unverified. No live database compatibility claim.

## Approved business behavior

- Active Sales employees with `inquiries:update` and `orders:update` may reject
  an individual unarchived inquiry-stage order, across companies.
- Pending cancellation does not block rejection. Preserve its original evidence
  and complete only pending cancellation requests of that order, with the response
  `Resolved due to inquiry rejection.` and the decision actor/server timestamp.
- Preserve order identity, original stage, products and related records. Store
  `rejected` in `archive_reason`, narrative in `archive_note`, and server archival
  actor/time. Never delete or create a rejected order stage.
- A mandatory, well-formed reason is trimmed and limited to 1,000 Unicode code
  points, reusing application-rejection validation conventions.
- Repeated rejection cannot replace evidence or create another audit/notification.

## Backend contract

`POST /api/sales/orders/:id/rejection` accepts exactly `{ reason, revision }`.
Authentication, employee Sales role, both existing update permissions, same-origin
checks, and scoped 32kb JSON parsing precede the controller.

Sales detail returns a lowercase 64-character SHA-256 `revision`, following the
existing Admin convention. One canonical allowlisted order projection plus sorted
pending cancellation snapshots is used by the read and locked mutation paths.
This is an application concurrency token, unrelated to migration checksums.

Within one transaction: revalidate actor, lock order, lock pending cancellations,
compare revision, validate state, archive, complete pending cancellations, persist
notification/recipient rows, read authoritative result, and record one
`inquiry.rejected` audit with middleware request ID. Commit only after required
writes succeed. Failed required writes roll back; uncertain commits return
`WRITE_OUTCOME_UNKNOWN` and are never automatically retried.

Responses: 200 success; 400 validation; 401 unauthenticated; 403 forbidden;
404 missing order; 409 `INQUIRY_ALREADY_REJECTED`, `STALE_RECORD`, or
`INVALID_STATE`; safe 503 `SERVICE_UNAVAILABLE` or `WRITE_OUTCOME_UNKNOWN`.
Already-rejected detection precedes revision comparison and preserves the first
decision. A valid but stale request otherwise returns `STALE_RECORD` before
ordinary state eligibility is considered.

## Notifications and visibility

The affected active Client accounts and all active Sales employees, including
the actor, are selected server-side. Recipients are deduplicated. No Owner or
Operations recipients are added. Existing message/recipient tables are used;
there is no outbox, email gateway, or external delivery claim.

No eligible Client recipient does not cancel rejection: the committed response
and audit capture `clientRecipientAvailable:false`; a fixed structured warning
records only event, request ID and order ID. Other required notification write
failures roll back. Success means in-app records committed, not browser receipt
or read acknowledgement.

`GET /api/sales/inquiry-rejections` supplies bounded, read-only rejection history
to employee Sales/Owner/Operations with existing `orders:read`. The exception is
route-specific and does not open other Sales routes or mutations. Owner and
Operations receive a narrow Real navigation destination. Client APIs retain
authenticated ownership and expose only approved archive metadata, not actors,
audit snapshots or unrelated internal notes. Reasons render as ordinary React text.

## Real and Demo frontend

Real Sales requires current detail/revision, shows the action only for eligible
records, validates reason, locks submission, and uses the authenticated API.
Conflicts/uncertain outcomes instruct refresh; no local success substitutes for
persistence. Successful rejection refreshes authoritative rows. Approved archive
information is displayed to Sales, Client, Owner and Operations.

Demo uses a guarded local transition and truthful asynchronous store result.
Pending cancellation is completed without losing history; repeat/wrong-state
rejection is refused. Notifications target only Client/Sales after successful
state mutation. Demo remains isolated from Real requests/data.

## Verification boundaries and handoff

Focused synthetic backend tests cover validation, role/permission/origin denial,
archival and cancellation preservation, read/revision consistency, concurrent
requests using a serialized transaction double, rollback, uncertain commit,
request-ID audit correlation, notification deduplication and missing Client
recipient behavior. Actual MySQL locking behavior is not established by doubles.

Frontend tests execute the Demo transition, Client adapter and escaped archive
rendering, with additional source guards and existing focused regressions.
Mocked-browser cases are authored in
`tests/sales-conversion/inquiry-rejection.spec.mjs` but were not executed: the
configured Chromium executable is absent. Installation/recovery and required
environment approvals are separate. Full UI interaction acceptance, including
Demo and Client browser flows, remains outstanding.

Persisted integration, database connections, migrations, seeds, Docker, production
deployment and permission-map expansion remain separately gated. No such operation
occurred in Task 05. No actual schema/data verification is claimed.
