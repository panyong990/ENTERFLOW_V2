# Engineer sketch integration

Status: implemented with isolated verification; live MySQL schema/persistence,
private GCS configuration, cloud IAM and authenticated live browser acceptance
remain unverified. No cloud resources are enabled by this change.

## Contracts and ownership

- `POST /api/documents/client/inquiries`: authenticated multipart submission.
  Header `Idempotency-Key` is a UUID v4. Text field `inquiry` contains
  `{ payload: <existing inquiry JSON>, sketchLines: [1, 3] }`. File fields are
  `sketch:1`, `sketch:3`, etc. Lines are one-based product positions in the
  immutable request, never specification IDs supplied by the browser.
- Existing `POST /api/client/orders` JSON bodies and success responses are
  unchanged. An optional `Idempotency-Key` header selects the same durable
  submission protocol without requiring storage for inquiries without sketches.
  Legacy callers without a key retain legacy behavior: their retries cannot be
  deduplicated. The Real Client wizard always supplies a key.
- `GET /api/documents/client/inquiry-submissions/:key` returns the committed
  inquiry result or null. Null is not proof that an upload is no longer running;
  retries must continue to use the same key.
- Client and Sales list/content endpoints:
  `/api/documents/{client|sales}/orders/:orderId/items/:itemId/sketches[/:fileId]`.
  Client ownership comes from authenticated `clientId`. Sales requires employee
  account, Sales role and existing `orders:read`. The complete order/item/spec/file
  chain, sketch purpose and available state are checked before storage access.
  Responses omit bucket/path/generation/hash/uploader metadata.
- Both inquiry POST routes explicitly enforce same-origin protection. There is
  no global origin middleware. Body parsing and upload occur after authentication
  and permission checks.

## Durable idempotency without schema changes

The unique order reference retains `INQ-YYYY-NNNNNN` sequence meaning. It is not
repurposed as an idempotency token. Neither a frontend lock nor nonunique
`audit_events.request_id` is used as a uniqueness guarantee.

Every tokenized submission transaction first locks the existing active client
row by primary key with `SELECT ... FOR UPDATE`, then checks the active client
user, then performs a current/locking receipt read with `FOR UPDATE`. Receipts
use a SHA-256 of client ID and normalized UUID as subject identifier. Their value
contains the normalized payload/file digest and the exact successful response.

This database row mutex serializes all tokenized writers for one client across
processes/connections. While holding it, a writer either replays the receipt,
rejects a changed payload with `SUBMISSION_CONFLICT`, or creates the inquiry and
its receipt in the same transaction. A waiting writer cannot observe an absent
receipt until its predecessor has committed or rolled back. No transaction may
create a tokenized inquiry using an unlocked receipt check. Retain these receipts
for the life of the inquiry. Audit deletion/retention changes require review.

The guarantee depends on this shared write protocol and a single authoritative
MySQL writer; the audit index alone is not unique. Existing unkeyed legacy callers
do not participate. The protocol is tested with a transaction/mutex model; live
MySQL locking/failover verification is still required on an authorized target.

## Storage, atomic visibility and failure recovery

PDF, JPG/JPEG and PNG are accepted with extension/MIME/signature checks, a 10 MiB
per-file limit, one optional sketch per product, at most 50 products, and a 25 MiB
aggregate file limit. Multipart JSON is limited to 256 KiB. All validation occurs
before cloud upload. The sketch service directly selects the GCS adapter; it does
not switch to mock storage when NODE_ENV is test. Tests explicitly inject doubles.

Before uploading, a short internal audit write records a random attempt UUID,
configured private bucket and the exact planned immutable object keys and hashes.
These internal fields never enter public API responses. Each attempt has distinct
keys, so concurrent retries cannot delete one another's objects. Cloud uploads
run outside the business transaction and use create-only object preconditions.
Storage must confirm object generation before metadata can become available.

The final short transaction rechecks ownership and the receipt under the client
row lock, creates order/specifications/items, creates available file metadata and
`specification_files(purpose='sketch')` links, and writes the receipt. None of these
business records commit if any required file, link or audit write fails. GCS and
MySQL are not a distributed atomic transaction; orphaned cloud objects are possible.

- Confirmed rollback or losing concurrent attempt: delete only that attempt's
  confirmed generations. Record cleanup completion/failure in internal audit.
- Upload result without confirmed generation: retain its pre-upload inventory for
  reconciliation instead of issuing an unconditioned delete.
- Failed COMMIT response: destroy the uncertain DB connection, return
  `SUBMISSION_UNCONFIRMED`, and do not delete objects. Status/retry on a new
  connection takes the same client lock and resolves the committed receipt.
- If no commit occurred, retrying the same key can create one inquiry. Old orphan
  attempts remain in the audit inventory for separate bounded reconciliation.
- Missing/disabled storage returns `STORAGE_NOT_CONFIGURED` without inquiry rows.
  Initial authorization checks may occur, but no cloud or business write occurs.

A later authorized reconciler must inspect only inventoried attempt keys after an
approved grace period, resolve receipts under the client row lock, check every
candidate against `files(bucket, object_path)` and typed links, and never remove
an available/referenced object. For unconfirmed puts, verify hash/generation and
attempt ownership first. Do not add broad bucket lifecycle deletion rules. No
background cleanup worker, bucket/IAM change, retention policy, or cloud operation
was enabled by this implementation.

## Frontend recovery and preserved behavior

The existing Real Client wizard keeps files in transient memory and sends the
manifest/files through FormData. It retains the exact attempted snapshot after an
uncertain response, checks status before retry, and only closes on confirmed
success. An opaque retry UUID is retained in the current URL query parameter
`inquirySubmission` for reopening/reload recovery. It is client-scoped and conveys
no authority; no form values, file contents, credentials, localStorage, sessionStorage,
IndexedDB or data-URL fallback are used. If no receipt exists after reopening,
original sketches must be reselected; the server digest prevents a changed
submission from silently reusing a committed key. The URL key is cleared only
after confirmed success. Mode/session changes do not grant access to the receipt.

Client sketches load on expansion. Sales uses its existing expandable per-product
inquiry review area and authenticated streaming links. Demo storage is unchanged.
This client inquiry sketch is not an approved production/JO drawing, and does not
change quotation, payment, inventory or production eligibility rules.

## Acceptance still requiring separate authorization

- Read-only verification of actual relevant deployed tables/columns/constraints,
  without migration-history access or protected Migration 007 inspection.
- Disposable MySQL tests for concurrent writers, transaction failure and actual
  committed Client-to-Sales retrieval. No development/production writes permitted
  under this task.
- Private GCS setup/credentials, public-access prevention, minimum IAM, content
  screening/retention decisions, upload/download verification and bounded orphan
  recovery. Live GCS remains deferred under the Phase 1 handoff.
- Authenticated browser and integrated MAIN visual acceptance on an approved
  environment. Mock browser tests do not establish live persistence or Phase 1
  completion.

## Database Change Report

No live database connection/query/write, schema change, migration creation or
execution, RBAC change, or cloud activation was performed. Implementation would
write `orders`, `product_specifications`, `order_items`, `document_sequences`,
`files`, `specification_files` and `audit_events` on an authorized configured
runtime. `clients`/`users` are read/locked for authorization, not updated.
`order_files` is not needed for individual filter sketches. Migration 007 and its
checksum/history were not accessed or changed. Existing groupmate work and the
already-present document validation fix were preserved. No commit/push/branch
switch/history operation was performed.

## Files changed in this task

New files:

- `backend/src/middleware/inquiry-upload.middleware.js`
- `backend/src/services/engineer-sketch.service.js`
- `backend/src/services/engineer-sketch.service.test.js`
- `backend/src/routes/engineer-sketch.http.integration.test.js`
- `src/app/api/inquiryRecovery.ts`
- `src/app/api/inquiryRecovery.test.mjs`
- `src/app/components/EngineerSketches.tsx`
- `docs/ENGINEER_SKETCH_INTEGRATION.md`

Targeted edits to existing files:

- `backend/src/controllers/client-portal.controller.js`
- `backend/src/routes/client.routes.js`
- `backend/src/routes/document.routes.js`
- `backend/src/routes/client.http.integration.test.js`
- `backend/src/services/client-inquiry.service.js`
- `backend/src/storage/document-storage.js`
- `backend/src/storage/document-storage.test.js`
- `src/app/api/client.ts`
- `src/app/api/client.test.mjs`
- `src/app/api/clientPortal.ts`
- `src/app/api/clientPortal.test.mjs`
- `src/app/components/client/ClientPortal.tsx` (pre-existing edits preserved)
- `src/app/components/client/data.tsx`
- `src/app/components/sales/OriginalSalesForms.tsx`
- `tests/client-conversion/portal.spec.mjs` (pre-existing edits preserved)
- `tests/sales-conversion/sales.spec.mjs`

The build regenerated `dist/index.html` and ignored build assets. Existing changes
to `document-workflows.service.js`, its untracked test, Admin/Employee/Client
Management, role-access files, Company Settings and admin-refresh tests were not
authored or overwritten by this task.

## Verification performed on 2026-11-18

Final focused backend/frontend Node tests: **80 passed, zero failed/skipped**.
These use injected DB/storage doubles and local HTTP servers; they do not connect
to a live database. Route imports load the existing runtime configuration but no
live pool connection is requested.

```powershell
node --test backend/src/services/engineer-sketch.service.test.js backend/src/routes/engineer-sketch.http.integration.test.js backend/src/routes/client.http.integration.test.js backend/src/services/client-inquiry.service.test.js backend/src/storage/document-storage.test.js backend/src/services/document-workflows.service.test.js src/app/api/clientPortal.test.mjs src/app/api/client.test.mjs src/app/api/inquiryRecovery.test.mjs src/app/components/realClientPortal.test.mjs src/app/components/sales/salesInquiryReview.test.mjs
```

Final focused Chromium tests: **7 Client cases passed; 1 Sales case passed**.
Every API is intercepted; no backend is started. Cases cover confirmed multipart
submission, duplicate clicks, uncertain outcome/status recovery, reload recovery,
multiple filter associations, JSON/no-sketch submission, Client/Sales scoped
retrieval links and unavailable storage. Initial failures in the new reload/Sales
tests were fixture timing/adjacent-panel interception errors and were corrected;
the final scoped runs below pass.

```powershell
npx.cmd playwright test --config=playwright.client-conversion.config.mjs --grep 'sketch submission|uncertain commit|no-sketch wizard|multiple filter sketches|reopening after reload|owning Client|five Wizard steps'
npx.cmd playwright test --config=playwright.sales-conversion.config.mjs --grep 'Sales inquiry review retrieves the sketch'
```

Broader Client run: `npx.cmd playwright test
--config=playwright.client-conversion.config.mjs` ran **21 cases at that point:
17 passed and 4 failed**, before the final three focused cases were added. The
failures stop at existing assertions for disabled Settings Save, old empty-state
copy, absent PO upload controls and absent signed-DR submit controls. Those
unrelated application sections were not changed to make these tests pass. This
is not a claim that the full Client regression suite passes.

`npm.cmd run build`: **passed**, with the existing large-chunk warning. Vite's
initial sandboxed configuration read failed; the approved outside-sandbox build
passed. The final build includes all frontend implementation changes.

`git diff --check`: **passed**.

`npm.cmd run check:production-demo-assets`: **failed**, reporting **67 prohibited
catalog literals**, plus 4 allowed compatibility literals and 3 documented
out-of-scope quotation location strings. The material catalog/scanner were not
modified or disabled. This remains a release/Phase 1 acceptance limitation, not
a successful production-readiness check.
