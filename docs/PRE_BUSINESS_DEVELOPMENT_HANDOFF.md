# ENTER-FLOW V2 — Pre-Business Development Handoff

## Purpose and continuation point

ENTER-FLOW V2 is an ERP/workspace application with separate employee, client, and administrative experiences. This document records the pre-business foundation completed through Task 27 and is the continuation guide for the next developer.

The repository is currently on the existing `dev-phase` branch. The immediate continuation point is deployment preparation and controlled progression into the remaining business-module work. Preserve the current worktree and do not rebuild completed foundations.

This document describes repository state and verified behavior. Proposed future work is explicitly marked as pending; it is not an assertion that those features already exist.

## Technical architecture

- Frontend: React, TypeScript/TSX, Vite, Tailwind, and the existing component/store architecture under `src/app`.
- Backend: Node.js, Express, ES modules, MySQL via `mysql2`, session-cookie authentication, and layered routes/controllers/services/validation.
- Database: MySQL-compatible schema under `database/migrations`, with migration execution through `database/migrate.mjs`.
- API transport: same-origin `/api` requests in the frontend. Development Vite proxying targets the local backend.
- Runtime: shared environment validation in `backend/src/config/runtime-config.js`; database/TLS setup in `backend/src/config/database.js`; server startup in `backend/src/server.js`.
- Deployment preparation: separate backend and frontend images. The backend runs Express; the frontend image serves the built SPA through nginx. Deployment ingress must route `/api/*` to the backend and other paths to the frontend.
- Identifiers: database BIGINT identifiers are preserved as decimal strings through SQL projections, services, JSON responses, and frontend adapters.
- Monetary values: decimal database values are kept as strings where API precision matters; frontend code must not coerce authoritative monetary values to binary floating point.

## Roles and RBAC

The existing application permission architecture is defined in `backend/src/config/permissions.js` and checked by the existing authentication, role, and permission middleware. Roles include:

- `admin`: administrative account and client-application review, employee management, client administration, and dashboard administration.
- `owner`: permitted business visibility according to the existing permission map, without Admin management authority.
- `sales`: company-wide Sales read access and Sales workflows already represented by the existing permission map.
- `production`: production and operational records.
- `warehouse`: inventory and delivery/waybill operations allowed by the existing map.
- `logistics`: delivery and waybill operations allowed by the existing map.
- `accounting`: invoices, payments, verification, delivery-receipt, and accounting operations allowed by the existing map.
- `operations`: operational visibility and reports allowed by the existing map.
- `client`: client-owned portal visibility and client-specific notification/dashboard permissions added through the application-level permission architecture.

Never infer access from frontend navigation alone. Protected routes must require the authenticated session, active account, correct account type/role, and the exact existing permission. Client ownership must be derived from `request.auth.clientId` or `request.auth.userId` as appropriate, never from client-supplied IDs or company names.

## Established business rules

- Sales employees have company-wide visibility for Sales read APIs.
- Client accounts see only records owned by their authenticated `clientId`.
- Client notification retrieval and read-state updates are restricted to the authenticated `userId` recipient record.
- Dismissed notifications are excluded from active notification lists.
- Revenue metrics count verified payments only and group monthly revenue by the payment date field supported by the schema.
- Quotation, job-order, production, shipment, delivery, invoice, payment, and notification states remain separate. Do not combine internal statuses into an invented public status.
- Internal costing, margins, BOM pricing, employee identities, internal notes, audit metadata, credentials, storage paths, and unauthorized file contents are not client-visible by default.
- Demo Mode remains local/demo-data driven. Real Mode must not read Demo records, local Demo storage, or fabricate transaction summaries.
- Read-only APIs do not mutate notifications, payments, production, delivery, or documents.

## Completed work through Task 27

### Tasks 10–15: Client Portal backend foundation

The client-account guard and client-owned API foundation are implemented in:

- `backend/src/middleware/client-account.middleware.js`
- `backend/src/routes/client.routes.js`
- `backend/src/controllers/client-portal.controller.js`
- `backend/src/controllers/client-notifications.controller.js`
- `backend/src/services/client-portal.service.js`
- `backend/src/services/client-portal.service.test.js`
- `backend/src/routes/client.http.integration.test.js`

Implemented client read routes include:

- `GET /api/client/profile`
- `GET /api/client/orders`
- `GET /api/client/orders/:id`
- `GET /api/client/orders/:id/quotations`
- `GET /api/client/orders/:id/purchase-order`
- `GET /api/client/orders/:id/job-orders`
- `GET /api/client/orders/:id/delivery`
- `GET /api/client/orders/:id/invoices`
- `GET /api/client/orders/:id/payments`
- `GET /api/client/notifications`
- `PATCH /api/client/notifications/:id/read`
- `GET /api/client/dashboard`

These APIs enforce client account type, client role, active authentication, object ownership, safe projections, BIGINT string preservation, and public not-found behavior for nonexistent and cross-client parent records. Invoice reads require `invoices:read`; payment reads use the existing payment permission; notification read and update operations use the existing application-level notification permissions.

### Tasks 16–18: Client Portal Real Mode and browser verification planning

The Real Mode client portal integration and adapters are present in:

- `src/app/components/RealClientPortal.tsx`
- `src/app/components/realClientPortal.test.mjs`
- `src/app/api/clientPortal.ts`
- `src/app/api/clientPortal.test.mjs`
- `src/app/App.tsx`

The earlier audit and browser-verification work established that Demo Mode and Real Mode remain separate. Browser verification must use disposable isolated accounts and an isolated database; never use development or production accounts.

### Sales backend and Real Mode work

Sales read routes, controllers, services, validation, integration tests, and frontend adapters are present in:

- Backend routes/controllers/services: `backend/src/routes/sales.routes.js`, `backend/src/controllers/`, `backend/src/services/sales-*.js`, `backend/src/validation/sales*.js`.
- Backend integration tests: `backend/src/routes/sales.http.integration.test.js` and the Sales service test files.
- Frontend adapters: `src/app/api/salesClients.js`, `salesOrders.js`, `salesOrderDocuments.js`, `salesJobOrders.js`, and `salesDelivery.js` with their focused tests.
- Frontend hooks/components: `src/app/components/useSalesClients.ts`, `useSalesOrders.ts`, `useSalesOrderDocuments.ts`, `useSalesJobOrders.ts`, `useSalesDelivery.ts`, `RealSalesOrders.tsx`, and related tests.

Completed Sales API families include:

- Client directory reads.
- Orders and inquiries reads.
- Quotation history and purchase-order reads.
- Dashboard metrics.
- Job-order and delivery summary reads.
- Notifications reads.

The existing Sales readiness route remains preserved. Sales APIs use parameterized SQL, independent queries/aggregates where needed to avoid one-to-many duplication, safe projections, pagination/filter/sort validation, and exact identifier/decimal handling.

### Admin Portal work

Existing Admin implementation and tests remain in the tracked and accumulated source tree, including:

- Admin routes/controllers/services and application-review workflow.
- Employee directory, details, creation/editing, role assignment, activation, and deactivation.
- Client directory, details, client account administration, and active/inactive handling.
- Client registration application listing, detail, approval, rejection, identity conflict handling, transactions, and audit behavior.
- `src/app/components/admin/render.test.mjs` and related Admin frontend components.

Admin authorization is enforced in backend routes and services independently of frontend navigation. Do not broaden Admin permissions or use Admin-specific services for client-owned APIs without an explicit ownership review.

### Tasks 19–26.2: Isolated browser-test environment and runtime hardening

Browser infrastructure is present in:

- `browser-test/backend.mjs`
- `playwright.config.mjs`
- `playwright.admin.config.mjs`
- `tests/browser/environment.smoke.spec.mjs`
- `tests/browser/client-portal.spec.mjs`
- `tests/browser-admin/admin-auth.smoke.spec.mjs`
- `tests/browser-admin/admin-portal.spec.mjs`
- `tests/browser-admin/admin-remaining.spec.mjs`

The browser harness verifies the dedicated Task 19 database identity before use. It must not fall back to `database/.env.dev`, `enterflow_db`, production, or Cloud SQL. DPAPI-protected test credentials are read by the harness without printing passwords, cookies, or tokens.

The recovered isolated browser-test container/database must not be deleted, recreated, or modified casually. Cleanup, if separately authorized, must be limited to the exact browser-test resources and must verify identity before writes.

### Task 27: Deployment preparation

Deployment artifacts are present in:

- `Dockerfile.backend`
- `Dockerfile.frontend`
- `.dockerignore`
- `deployment/nginx-spa.conf`
- `docs/DEPLOYMENT.md`
- `backend/src/controllers/health.controller.js`
- `backend/src/routes/health.routes.js`
- `backend/src/controllers/health.controller.test.js`

The backend image:

- Uses Node `24.15.0-bookworm-slim`.
- Installs production dependencies with `npm ci --omit=dev`.
- Copies only `backend/src` into the runtime image.
- Excludes environment files and database certificates.
- Runs as non-root user `enterflow`.

The frontend image builds the Vite SPA and serves it with nginx on port 8080. It has no hardcoded backend URL or API secret. The deployment ingress owns `/api` routing.

Health endpoints are:

- `GET /api/health`: backwards-compatible database health check.
- `GET /api/health/live`: process liveness check without a database query.
- `GET /api/health/ready`: database readiness check.

Production TLS CA material must be mounted at runtime through `DB_SSL_CA_PATH`; it must not be copied into the image. Production configuration must include the named TLS identity, database credentials through a secret manager, `APP_ORIGIN`, and valid session timeout settings. Container startup does not run migrations automatically.

## Runtime configuration

`backend/src/config/runtime-config.js` is the shared validation boundary. It loads local development configuration through the existing loader and validates values without logging secrets. The important runtime variables are:

- Database: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_POOL_MAX`, `DB_TIMEZONE`.
- TLS: `DB_SSL_CA_PATH` and production/container `DB_SSL_SERVER_NAME`.
- Application: `NODE_ENV`, `HOST`, `PORT`, `APP_ORIGIN`.
- Sessions: `SESSION_IDLE_TIMEOUT_MINUTES`, `SESSION_ABSOLUTE_TIMEOUT_HOURS`.

Local development and isolated browser tests have distinct runtime paths. Production must fail closed if required database, origin, session, or TLS settings are missing or invalid. Do not print `.env` contents or secret values in diagnostics.

## Database and migration restrictions

- Migration files remain authoritative and must be applied only through the reviewed migration procedure.
- Migration 007, `database/migrations/007_client_application_identity_uniqueness.sql`, remains on hold unless separately approved and safety-checked.
- No production database has been used for browser testing or deployment preparation.
- Do not apply migrations, seeds, grants, or schema changes as part of ordinary feature work.
- Use the application database account only for application operations; use a separate migration identity for DDL when approved.
- Preserve composite ownership and foreign-key relationships. Do not bypass client ownership with frontend-supplied identifiers.

## Test baselines and verification history

The following are recorded baselines from completed work. A future report must distinguish these historical results from newly executed commands:

- Backend suite: 579 passed, 0 failed, 0 skipped, 0 todo.
- Frontend suite: 64 passed, 0 failed, 0 skipped, 0 todo.
- Client browser suite: 2 passed in the verified isolated environment.
- Admin browser smoke suite: 6 passed in the verified isolated environment.
- Environment smoke: 1 passed.
- Backend Docker image build: passed.
- Frontend Docker image build: passed.
- nginx configuration test: passed.
- `git diff --check`: passed, with the known line-ending warning on an existing modified session file.

Before handoff, rerun only the checks needed for the next change and record exact counts. Do not claim browser or production verification without actually running it.

## Demo Mode and Real Mode boundaries

Demo Mode retains the existing local stores, seeded records, and interactions. Real Mode uses authenticated API adapters and should keep empty, loading, retry, unavailable, and error states explicit. Unsupported writes in Real Mode must remain guarded rather than silently changing local Demo state. Mode switching must cancel or ignore stale requests and must not leak localStorage/IndexedDB Demo data into Real Mode.

## Remaining Tasks 28–32

The exact briefs for Tasks 28–32 are not stored in the repository files inspected for this handoff. They remain pending project-owner follow-up items and must be recovered from the project task record before implementation. Do not invent their scope. At minimum, each next task must be reviewed for:

1. Whether it is design, implementation, verification, or deployment work.
2. Whether it requires approval for database, permissions, credentials, or live records.
3. Whether it can use the isolated browser-test environment.
4. Whether it affects the completed Client Portal, Sales, Admin, or runtime foundation.
5. Its exact tests, rollback/safety requirements, and handoff evidence.

The next developer must not begin a new business module until the relevant task brief is confirmed and the current branch/worktree has been audited.

## Known limitations

- No production platform, ingress, secret manager, or production database has been configured in this repository.
- Production deployment and live authentication verification remain outstanding.
- The frontend deployment image is static nginx; `/api` routing must be supplied by the deployment platform.
- The root package contains both frontend and backend dependencies, so the backend image installs the production subset of the shared package manifest.
- The Vite build retains a large-chunk warning; this is not a deployment-blocking failure but may warrant future code splitting.
- Migration 007 remains deferred.
- Exact future Task 28–32 requirements are external to the repository and must not be guessed.
- Browser fixtures and credentials are environment-specific and must never be committed.

## Repository preservation instructions

- Work only on the existing `dev-phase` branch unless the project owner explicitly directs otherwise.
- Before any change, run `git status --short`, `git branch --show-current`, `git log -1 --oneline`, and `git remote -v`.
- Preserve existing modified and untracked implementation files. Do not use `git reset --hard`, `git clean`, branch switching, force-push, or history rewriting.
- Review staged paths individually. Never blindly stage credentials, `.env` files, private certificates, DPAPI files, local databases, Playwright output, caches, or `node_modules`.
- Do not commit live database credentials, session cookies, password hashes, tokens, or certificate private keys.
- Do not modify or apply Migration 007 without its separate approved procedure.
- Keep Demo Mode behavior intact while extending Real Mode.
- Report exact tests, warnings, skipped/todo counts, database changes, and unresolved limitations.

## Final readiness requirements

The project is ready for the next development shift when:

- The handoff document and implementation/test files are committed to the intended development branch.
- The branch is pushed to its configured upstream and the remote confirms the commit.
- The working tree is clean except for explicitly documented local-only files.
- Runtime configuration is supplied through the approved environment/secret mechanism.
- Production deployment has a selected platform, ingress routing, TLS CA mounting, database identity verification, health checks, and rollback procedure.
- The next task brief is confirmed before implementation begins.
