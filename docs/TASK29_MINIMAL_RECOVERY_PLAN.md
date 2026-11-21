# Task 29 minimal isolated environment recovery - review package

> **Current state:** [approved Gate D results](TASK29_GATE_D_RESULTS.md).
> Initialization completed and read-only verification passed on the reviewed
> replacement target. Stop before Gate E, which requires separate approval.
> Earlier preparation/absence statements below are historical.

> **Later progress:** Gates A-C have now been applied by the user and verified
> live at port 53045. [Current Gate D review](TASK29_GATE_D_APPROVAL_REVIEW.md)
> confirms strict identity/TLS, absent schema/fixtures and exact pending writes.
> Gate D and browser acceptance have not executed. The original preparation-only
> statements below describe that earlier pass; approval boundaries remain intact.

2026-11-16 (Asia/Manila), `dev-phase`. **PREPARED ONLY / NOT EXECUTED.**
Task 29 remains PARTIAL. The user now confirms Docker and Playwright/Chromium
are available; this supersedes earlier missing-package observations. They were
not reinstalled or independently reprobed during this preparation. The original
browser container and protected fixtures remain reported absent. No connection
to development or any other database was made.

The current request authorizes preparation, not container creation, database or
protected-fixture writes, pin activation or authenticated acceptance. The later
"continue" did not lift those restrictions. All commands below are a reviewable
future procedure, **not commands already run or permission to run them**.

## Proposed replacement and review boundaries

| Item | Proposed value / guard |
| --- | --- |
| Container | `enterflow-browser-recovery-29caa4ce81d64f02` |
| Database | `enterflow_browser_recovery_29caa4ce81d64f02` |
| Docker context | `desktop-linux`; expected local Docker Desktop Linux named pipe |
| Ownership label | `enterflow.task29.recovery=29caa4ce81d64f02` |
| MySQL | Existing pinned MySQL **8.4.13** image `mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902` |
| Access | One dynamically allocated `127.0.0.1:<port> -> 3306` binding; reject ports 3306/3307/3308/3309; no wildcard/public binding |
| Storage | tmpfs `/var/lib/mysql`, 1 GiB; no bind mounts or persistent volumes; container limit 2 CPUs/2 GiB; standard bridge matches the existing harness |
| TLS | `require_secure_transport=ON`; existing strict CA + named certificate identity checks; verify signed public certificate and TLS socket; capture peer SHA-256 fingerprint |
| Pins not yet knowable | New **container ID, allocated port, server UUID and certificate fingerprint** must be observed after approved creation and explicitly reviewed before activation |

This is one new disposable container only: no dev/validation container, volume,
network or database is repurposed, reset, stopped or copied. Standard bridge is
not a claim of network isolation from every other Docker container. Isolation
is a separate MySQL instance/data directory, unique credentials, loopback host
binding, TLS and pinned identity. It remains a local synthetic test environment.

The existing harness currently uses root inside its disposable instance; this
minimal proposal retains that behavior. It is not a production privilege model.
The Docker engine can expose its root environment to Docker administrators;
the procedure keeps the value off terminal arguments/output and stores its local
copy with Windows DPAPI and a private directory ACL. No real database credential,
hash, session or business row is read or copied.

## Minimal schema and fixtures

Prepared [schema.review.sql](../browser-test/recovery/schema.review.sql) and
[schema-inventory.json](../browser-test/recovery/schema-inventory.json) by offline
selection from an **explicit** source allowlist: table definitions from 001–005,
and the reviewed one-client-account constraint from 006. This is a standalone
test-fixture schema, not execution of those migrations or a baseline. No
directory discovery, Migration 007 access, migration ledger or version-marker
statement is included. Both history tables are excluded.

The dependency-closed subset is **28 tables**, keeping original columns,
foreign keys and CHECK constraints instead of inventing weaker mock tables:

| Group | Tables |
| --- | --- |
| Identity/Admin/session | `roles`, `modules`, `role_modules`, `payment_terms`, `clients`, `users`, `client_applications`, `audit_events`, `user_sessions` |
| Client orders/quotes | `filter_types`, `product_specifications`, `order_stages`, `delivery_methods`, `orders`, `order_items`, `quotation_references`, `quotations`, `quotation_lines`, `quotation_costing`, `purchase_orders` |
| Production/delivery/billing | `production_stages`, `replacement_requests`, `job_orders`, `shipments`, `invoices`, `payments` |
| Notifications | `notifications`, `notification_recipients` |

24 tables are directly queried/needed by these cases; four are FK dependencies:
`filter_types`, `quotation_references`, `quotation_costing`, `replacement_requests`.
There are 28 CREATEs and one users UNIQUE alteration, all confined to the newly
created isolated database. `quotation_costing`, `replacement_requests` and
`user_sessions` start empty. No inventory/BOM child tables, file storage, broad
operational fixture set or full 70-table schema is needed by the current specs.

This does **not** validate production schema parity or the held migration's
constraints. Its absence remains a Task 28 blocker; there is no claim to have
reconstructed, tested or inferred the held contents. Future cases touching more
tables require review rather than fallback to real data or automatic migrations.

[fixtures.proposed.mjs](../browser-test/recovery/fixtures.proposed.mjs) prepares
**69 synthetic rows across 25 tables**:

- Nine role definitions (all configured codes, avoiding role mismatch), six
  modules and five role/module mappings. Server permission code remains the
  authority; DB module rows do not broaden RBAC.
- Four companies and seven user accounts: one active browser Admin, one active
  Sales employee, one inactive employee, two active portal clients, one active
  Admin-directory client and one inactive Admin-directory client. Exactly three
  initial employees keep the pagination test's eventual 15 employees on two pages.
- One pending synthetic application and one clearly marked synthetic audit event
  so the Admin pending/activity assertions have a baseline.
- Three active orders: A has production + inquiry; B has one production order.
  Three specifications/items, two sent revision-2 quotations/references/lines,
  one A PO/job/shipment/invoice, three A payments (verified **360.00**, pending,
  rejected). B intentionally has no PO/job/delivery/invoice/payment.
- Four notifications/recipient rows: A unread + read + dismissed, B read. Future
  delivery dates preserve the dashboard's upcoming-delivery assertion.

All identities use `example.invalid`; no real organization/person data is used.
The old string `2f90dcd2bbc8a779` is retained **only as a synthetic fixture label**
in names/usernames/references that the existing specs assert. It is not the new
container label, database or UUID. Passwords/hashes in the plan are placeholders,
not copied credentials. During approved initialization, cryptographically random
32-byte passwords and fresh production-helper Argon2id hashes are generated in
memory. Admin/Client passwords are unique; unused fixture accounts get an
unexported random credential. No initial sessions are seeded.

## Precise files and pending active changes

Prepared under `browser-test/recovery/`:

| File | Purpose |
| --- | --- |
| `replacement.proposed.json` | Reviewed proposal name/label/image/version; deliberately no invented UUID |
| `build-review.mjs` | Offline allowlisted DDL extraction and FK closure; only generated the two review artifacts |
| `schema.review.sql`, `schema-inventory.json` | Exact proposed schema and provenance/table inventory |
| `fixtures.proposed.mjs` | Exact synthetic row and credential-metadata plan; no I/O on import |
| `create-proposed.ps1` | Gated creation/start of the one new container, private root DPAPI file and nonsecret created-state file; no app schema/data |
| `target.mjs` | Exact ownership/port/storage/TLS checks and optional reviewed-pin comparison; only connects when explicitly called |
| `observe-proposed.mjs` | Gated read-only TLS identity observation; writes nonsecret candidate, never activates pins |
| `prepare-activation.mjs` | Offline generator of a seven-file patch from the actual observed identity; does not edit active source |
| `initialize-proposed.mjs` | Gated new-schema-only DDL and transactional synthetic inserts, then exclusive DPAPI exports; refuses existing schema/files/attempt |
| `recovery.test.mjs` | Seven offline validation tests, no container/SQL/DPAPI actions |
| `.gitignore` | Ignores local created/observed/initialization state, not the eventual reviewable pin file |

**Still unchanged, and requiring explicit pin-review approval:**

1. `browser-test/backend.mjs`: consume the reviewed identity; replace ownership
   label lookup; additionally pin container ID, exact dynamic port and TLS peer
   fingerprint and explicit loopback backend binding. Preserve strict TLS, UUID/version/database checks, tmpfs/mount
   guards and `BROWSER_TEST_RUNTIME=1`.
2. `tests/browser/environment.smoke.spec.mjs` and `client-portal.spec.mjs`:
   replace only the expected database name.
3. `tests/browser-admin/admin-auth.smoke.spec.mjs`, `admin-portal.spec.mjs`,
   `admin-remaining.spec.mjs`: replace expected database/container identifiers.
   Business assertions, fixture labels and authentication behavior stay intact.
4. Add `browser-test/recovery/identity.reviewed.json` containing the real observed
   nonsecret identity. The patch contains these seven files in total.

No UUID was fabricated, no observed/reviewed pin file exists yet, and no active
harness/spec was changed. The generated patch is also deferred until a real
identity exists. Preparation tests use an explicitly synthetic in-memory identity
only to validate patch generation and `git apply --check`; they do not activate it.

Proposed protected writes, only with approval:

- `%LOCALAPPDATA%\EnterFlow\Task29Recovery\29caa4ce81d64f02\root.credentials.dpapi`
  in a current-user/SYSTEM-only directory.
- `%LOCALAPPDATA%\EnterFlow\admin-browser-test.credentials.dpapi` and
  `client-browser-test.credentials.dpapi`, encrypted to the executing Stephanie
  Windows account with private per-file ACLs. Exports include only synthetic
  credentials and target metadata/fixture IDs. Existing files cause a stop;
  none will be overwritten. Run neither export under the sandbox service user.

The active application, APIs, Real/Demo, authentication/RBAC/TLS, account transfer,
Docker dev setup, package/lockfiles and migrations require **no change**.

## Exact PowerShell/Docker sequence and approval gates

Run from a Stephanie PowerShell session. Switches below are execution guards,
**not substitutes for explicit user approval**. Check every exit code; no retry,
fallback, reset, broad process termination or unreviewed pin update.

### Gate A - approve new disposable container and root-secret storage

Approval scope: create/start the exact one tmpfs container and its normal MySQL
system initialization, private root DPAPI file/directory and local metadata.
No development DB, app schema, protected Admin/Client export or browser run.

```powershell
Set-Location -LiteralPath 'C:\Users\Stephanie\Desktop\Main\ENTER-FLOW'
git -c safe.directory=C:/Users/Stephanie/Desktop/Main/ENTER-FLOW branch --show-current
git -c safe.directory=C:/Users/Stephanie/Desktop/Main/ENTER-FLOW status --short
$proposal = Get-Content -Raw -LiteralPath browser-test/recovery/replacement.proposed.json | ConvertFrom-Json
docker context inspect desktop-linux
if ($LASTEXITCODE -ne 0) { throw 'Context unavailable' }
docker --context desktop-linux image inspect $proposal.image --format '{{.Id}}'
if ($LASTEXITCODE -ne 0) { throw 'Image missing: stop; pulling requires separate approval' }
# Read/review this script; it contains the exact docker create/start argv.
Get-Content -LiteralPath browser-test/recovery/create-proposed.ps1
# ONLY after Gate A approval:
& ./browser-test/recovery/create-proposed.ps1 -ApprovedCreate
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw 'Recovery failed; inspect retained state' }
```

The script's exact Docker creation operation (root value inherited in-memory,
never substituted into the command line) is:

```powershell
# Inside the approved script only, after its safety checks and secret generation:
docker --context desktop-linux create --name $proposal.container --pull=never --label "$($proposal.labelKey)=$($proposal.label)" --network bridge --cpus 2 --memory 2g --tmpfs '/var/lib/mysql:rw,nosuid,size=1073741824' -p '127.0.0.1::3306' -e MYSQL_ROOT_PASSWORD -e 'MYSQL_ROOT_HOST=%' $proposal.image '--require_secure_transport=ON'
```

Do not run that line standalone or put a plaintext root password in history. The
script obtains the returned container ID, persists nonsecret owned state and
starts **only that ID**. It never pulls the image. If the digest is not cached,
stop and separately approve `docker --context desktop-linux pull $proposal.image`.

### Gate B - approve read-only identity observation; review pins before activation

Allow MySQL to finish startup; do not dump raw Docker logs or container Env. The
next command reads public certificates only from the newly owned container,
decrypts its new DPAPI root secret in memory, establishes verified TLS, performs
`SELECT VERSION(), @@server_uuid, DATABASE(), @@require_secure_transport`, and
saves the nonsecret observed identity. No CREATE/INSERT/UPDATE occurs.

```powershell
# ONLY after Gate B read scope approval; Gate A must have succeeded:
node browser-test/recovery/observe-proposed.mjs --approved-read
if ($LASTEXITCODE -ne 0) { throw 'Identity unverified: stop, do not accept pins' }
Get-Content -LiteralPath browser-test/recovery/identity.observed.local.json
# Offline patch preparation only; no active file edited:
node browser-test/recovery/prepare-activation.mjs
if ($LASTEXITCODE -ne 0) { throw 'Patch preparation failed' }
Get-Content -LiteralPath browser-test/recovery/activation.review.patch
git -c safe.directory=C:/Users/Stephanie/Desktop/Main/ENTER-FLOW apply --check browser-test/recovery/activation.review.patch
if ($LASTEXITCODE -ne 0) { throw 'Source drift: re-review; do not force apply' }
```

Review the **actual** name, label/image, container ID, endpoint, version, UUID,
certificate fingerprint and seven-file diff. Only after explicit approval of
those values may the following active configuration change occur:

```powershell
# Gate C: separate approval of the observed identity and exact source patch:
git -c safe.directory=C:/Users/Stephanie/Desktop/Main/ENTER-FLOW apply browser-test/recovery/activation.review.patch
if ($LASTEXITCODE -ne 0) { throw 'Activation failed: stop' }
```

This writes the reviewed JSON and six identity-only harness/spec changes. It
does not stage, commit or alter Git history. If a prior patch/state/file exists,
the helpers stop; do not delete or replace it to force a fresh attempt.

### Gate D - approve isolated schema, 69 fixture rows and two protected exports

Approve the **28-table/one-constraint DDL**, 69 rows in the linked plan, in-memory
credential generation and the two named DPAPI exports to Stephanie's profile.
The script requires the reviewed identity and refuses an existing application
schema, either existing protected file, or a prior initialization-report file.

```powershell
# ONLY after Gate D approval and reviewed pin activation:
node browser-test/recovery/initialize-proposed.mjs --approved-initialize
if ($LASTEXITCODE -ne 0) { throw 'Initialization incomplete; retain state and inspect the nonsecret report' }
Get-Content -LiteralPath browser-test/recovery/initialization-report.local.json
```

It performs CREATE DATABASE on the exact replacement instance, selects and
rechecks the exact name/UUID, executes only `schema.review.sql`, then parameterized
INSERTs inside one fixture transaction. No migrations, seed files, production
grants, ledger markers or business APIs execute. The schema must start absent;
there is no "merge fixtures", recreate/drop or automatic retry mode.

### Gate E - validate environment, then separately approve acceptance writes

Before running any test, confirm the checklist below and free ports 3000/5173
without stopping unknown services. The local Playwright CLI must already exist;
these commands never auto-download through `npx`.

```powershell
# After Gates A-D and read-only smoke approval only:
node node_modules/@playwright/test/cli.js test --config=playwright.config.mjs tests/browser/environment.smoke.spec.mjs --workers=1 --retries=0 --max-failures=1
if ($LASTEXITCODE -ne 0) { throw 'Smoke failed: stop' }
# Separate explicit authenticated-write approval is required for EACH scope below:
node node_modules/@playwright/test/cli.js test --config=playwright.config.mjs tests/browser/client-portal.spec.mjs --workers=1 --retries=0 --max-failures=1
if ($LASTEXITCODE -ne 0) { throw 'Client acceptance failed: stop' }
node node_modules/@playwright/test/cli.js test --config=playwright.admin.config.mjs tests/browser-admin/admin-auth.smoke.spec.mjs --workers=1 --retries=0 --max-failures=1
if ($LASTEXITCODE -ne 0) { throw 'Admin authentication failed: stop' }
node node_modules/@playwright/test/cli.js test --config=playwright.admin.config.mjs tests/browser-admin/admin-portal.spec.mjs --workers=1 --retries=0 --max-failures=1
if ($LASTEXITCODE -ne 0) { throw 'Admin workflows failed: stop' }
node node_modules/@playwright/test/cli.js test --config=playwright.admin.config.mjs tests/browser-admin/admin-remaining.spec.mjs --workers=1 --retries=0 --max-failures=1
if ($LASTEXITCODE -ne 0) { throw 'Remaining Admin checks failed: stop' }
```

Use the same single-worker, no-retry sequence to preserve fixture assumptions.
Do not run all suites a second time against changed state without review.

## Validation checklist

- [ ] User has approved the exact applicable gate; no approval inferred from
  older infrastructure work or this preparation request.
- [ ] `dev-phase`, current dirty worktree preserved; no 007 content/history action.
- [ ] Name not in use; exact pinned image is local; Docker context is local Linux.
- [ ] Created container ID/name/label/image match; running; tmpfs and no bind/volume
  mount; one loopback binding on a nonreserved port. No development endpoint used.
- [ ] New certificate signed by the captured CA; named identity and socket
  authorization verified; secure transport ON; actual version/UUID/fingerprint
  reviewed and pinned. No placeholder UUID accepted.
- [ ] Active patch changes only target identity/extra verification; neither
  `database/.env.dev` nor inherited DB variables provide a fallback.
- [ ] Schema initially absent; 28 expected tables and FK/CHECKs created; history
  tables absent; nonsecret initialization report confirms all 69 rows committed.
- [ ] DPAPI files created exclusively as Stephanie with private ACLs; metadata
  matches new database/container/UUID; passwords, hashes, cookies and tokens not
  printed. Do not display/decrypt credential files in terminal.
- [ ] Live bounded baseline API/fixture checks during approved smoke/acceptance
  agree with expected counts, unread state, pending application, roles and activity.
- [ ] Read-only smoke passes before authenticated suites; record actual results,
  failures and skipped/unrun cases; no full-coverage or COMPLETE claim beforehand.

## Proposed acceptance writes and retained-state behavior

The detailed eight-case inventory remains in
[the acceptance report](TASK29_BROWSER_ACCEPTANCE_2026-11-16.md). Only the verified
replacement target may receive the following approved phase-E writes:

| Scope | Tables / behavior |
| --- | --- |
| Login, all authenticated GETs, logout | `user_sessions` INSERT; activity UPDATE; logout/revocation UPDATE. No initial session copied/seeded. |
| Client A mark-read | `notification_recipients.read_at` UPDATE on its one unread row; cross-client write must return 404 without changing target row. |
| Admin employee/client edits | `users` INSERT/UPDATE, `clients` UPDATE, `audit_events` INSERT; role/deactivation revokes isolated fixture sessions. |
| Pagination | Up to 11 prefixed synthetic employees in `users`, matching audit inserts; portal spec can create one additional employee if absent. |
| New applications/review | Two `client_applications` INSERTs and decision UPDATEs; rejection audit; approval creates one `clients` and one client `users` row plus audit. |

Orders, specifications, quotes, POs, jobs, shipments, invoices and payments are
fixture inserts in Gate D and **read-only during the current acceptance cases**.
No DDL, grant, migration, ledger change or transfer is part of phase E.

DDL commits independently; a failed initialization can leave partial schema.
Fixture inserts roll back together on pre-commit failure, but acknowledged commits
remain if credential export later fails. A lost commit acknowledgement is an
unknown outcome, not permission to retry. The local report tracks completed DDL,
acknowledged fixture commit and exported filenames without secrets. Initializer
refuses any prior attempt; manual review is required instead of deleting evidence.

Each successful acceptance API transaction commits independently. No suite-wide
rollback exists. New employees/clients/applications/audits remain, notification
read state stays changed, revisions/timestamps advance, and some sessions remain
until expiry. Tests attempt to restore role/active flags, but a failure can leave
intermediate state; even success does not restore audits, job title or sessions.
Closing browser contexts is not server-side logout. Client reruns can fail after
mark-read; employee counts and latest-10 application lookups are state dependent.

**Default approval proposal is retention**, not deletion: keep the single owned
container running, its synthetic rows, audit history and protected fixtures for
review. No automatic SQL cleanup, notification reset, audit deletion, container
removal or credential deletion is provided. Any cleanup needs separate exact-ID
approval and ownership verification. Stopping/removing this tmpfs container can
destroy all fixture data; restarting can generate a new UUID/certificate, which
must fail existing pins and requires a new review. Never compensate by weakening
pins or resetting any existing Docker resources.

## Owner preservation decision — 2026-11-21 (Asia/Manila)

The owner accepts the recovered Task 29 execution reports, four Playwright logs,
postflight evidence, and existing fixture definitions as sufficient historical
testing evidence for conditional release of
`enterflow-browser-recovery-29caa4ce81d64f02`
(`enterflow.task29.recovery=29caa4ce81d64f02`) for Task 002 reuse. Recovered execution
evidence remains at
`%LOCALAPPDATA%\EnterFlow\PreFrontendBackup\final-20261116-200609\docs\evidence\task29-authenticated-execution\`.
The summary and four logs record seven passing authenticated cases; postflight
evidence records the historical observation, not a restorable database backup.

The owner acknowledges that the original 116 synthetic rows across 28 tables,
including 23 audit events, have not been verified as recoverable. This decision
resolves the Task 29 historical-evidence retention condition; it does not
authorize deletion or destruction of any existing data. Preserve recovered
evidence, fixture definitions, and protected credential files unchanged.

Task 29 is complete for its documented scope, and no remaining Task 29 execution
dependency or separate release prohibition was found in the reviewed records.
The container has not been reassigned. The next gate is explicit approval for
actual reassignment of this exact container to Task 002. Restart/bootstrap,
database/account/schema operations, cleanup, and test execution remain separately
unauthorized. Any proposed restart must address the documented tmpfs data-loss
and changed-identity risks without treating this decision as destruction approval.
Task 002 still requires fresh target identity/isolation evidence and its own
phase-specific approvals before runtime execution.

Documentation-only assessment: no container or database access, schema/data
changes, migrations, tests, backups, or Git changes were performed. Migration 007
and the approved Task 002 schema snapshot and hashes were untouched.

### Task 002 ownership reassignment - 2026-11-21

Following the preservation decision above, the owner explicitly authorized
reassignment of `enterflow-browser-recovery-29caa4ce81d64f02` to Task 002.
Project ownership is now **ASSIGNED TO TASK 002**, recorded in the existing
`browser-test/recovery/replacement.proposed.json` ownership metadata. This
supersedes the earlier pending-reassignment status above.

The exact container ID remains
`7e72accecadb1fd8eef9f778a784079c12c191458ed6400ff4dd44d586bcd6ca`
as previously inspected; no fresh Docker inspection or operation was performed.
Its existing name and `enterflow.task29.recovery=29caa4ce81d64f02` label remain
creation provenance. Docker container labels require recreation to change
([Docker label documentation](https://docs.docker.com/engine/manage-resources/labels/));
no label change or recreation is required for this project ownership assignment.
Task 002's identity contract can pin the existing label key/value and exact ID.
The legacy Task 29 database/fixture fields remain historical recovery metadata,
not authorization to use that database or its credentials for Task 002.

Recovered reports/logs/postflight evidence, fixture definitions, and protected
credentials remain unchanged. No existing data deletion or destruction is
authorized. No container/runtime configuration or database state was changed.

Minimum next step: obtain a separately scoped restart/bootstrap authorization
addressing tmpfs data-loss and changed-identity risks before any runtime action.
Fresh isolation/identity verification and separate database/account/schema and
scenario approvals are still required; this reassignment grants none of them.

Database Change Report: no tables accessed; no schema/data changes proposed or
performed, migrations created/applied, tests, backups, services, or container
operations. Migration 007 and approved schema snapshots/hashes were untouched.

## Fresh offline validation and limitations

Executed **7 new offline recovery tests: 7 passed, 0 failed/skipped**
([execution log](evidence/task29-recovery-2026-11-16/offline-tests.txt)). They cover
schema FK closure/order/history exclusion; fixture required fields/columns and
explicit FK references; baseline counts/credential placeholders; exact patch
scope/source preservation; rejection of development target/reserved port/missing
pins; and synthetic patch applicability with `git apply --check` only.
Seven new JavaScript files passed syntax checks; the PowerShell script passed
AST parsing without execution. No previously successful full suite was repeated.

These checks **do not validate MySQL execution, Docker creation, PowerShell
runtime behavior, DPAPI export, certificate provisioning, generated real-identity
patch or browser acceptance**. Those steps are deliberately unexecuted until
their gates are approved. Exact new identity cannot be verified before creation.

## DATABASE CHANGE REPORT

| Action this pass | Target | Tables affected | Queries / operations | Schema/data changes | Migrations created/applied | Approval |
| --- | --- | --- | --- | --- | --- | --- |
| Source review/offline DDL selection | No DB | No live tables | Read explicit allowed 001–006 definitions and application/test source; wrote review-only 28-table schema and inventory | None / none | None / none | Current preparation scope |
| Fixture/script/patch preparation | No DB | No live tables | Wrote synthetic plans/placeholders and inactive recovery helpers; no protected files or real pins generated/modified | None / none | None / none | Current preparation scope |
| Offline validation | No DB | In-memory planned rows only | 7 tests, JS syntax and PowerShell AST parsing; synthetic `git apply --check`, no apply | None / none | None / none | Current safe validation scope |
| Proposed Gates A-E | New isolated instance only, not yet created | The 28 reviewed tables; system initialization at container creation; acceptance subset above | NOT EXECUTED | None / none this pass | None / none | Exact gate approvals required |
| Development database | `127.0.0.1:3308/enterflow_db` not contacted | None | No connections, SQL, backup, reset, account or transfer action | None / none | None / none | No writes authorized/performed |

**Actual database connections, queries and writes: zero. Containers created:
zero. Protected files created/modified: zero. Active browser pins changed: zero.**
Eight real employees, all audits/business data, Migration 007, migration history
and all teammate/account-transfer work are preserved. No commit/push/merge/deploy.

Current changes are the new recovery review package, offline evidence and this runbook, plus brief
current pointers in testing/handoff/tracker documentation. No existing closure
evidence was erased. Task 29 stays **PARTIAL**, Task 28 **PARTIAL/BLOCKED**, and
Task 32 **PENDING verification**. The next approval can be bounded to **Gate A**;
it does not authorize any later gate.
