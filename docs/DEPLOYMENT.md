# ENTER-FLOW V2 deployment preparation

This document describes the repository's deployment-ready, platform-neutral arrangement. It does not deploy the application or select a production platform.

## Architecture

- `Dockerfile.backend` builds the Express API from `backend/src`.
- `Dockerfile.frontend` builds the Vite application and serves `dist` through nginx.
- The frontend uses same-origin `/api` requests. A production ingress or reverse proxy must route `/api/*` to the backend service and all other paths to the frontend service.
- The backend does not serve frontend assets.

The frontend image intentionally does not contain a backend URL or API secret. Do not point it at `localhost` in production.

## Build commands

From the repository root:

```powershell
docker build -f Dockerfile.backend -t enterflow-backend:local .
docker build -f Dockerfile.frontend -t enterflow-frontend:local .
```

These commands build images only. They do not connect to MySQL or apply migrations.

## Backend runtime configuration

The backend receives configuration at runtime through the deployment platform. Do not copy `.env` files into an image.

| Variable | Required | Secret | Format / purpose |
|---|---:|---:|---|
| `DB_HOST` | yes | no | MySQL hostname or IP; no whitespace |
| `DB_PORT` | yes | no | TCP port `1`–`65535` |
| `DB_NAME` | yes | no | Lowercase application database identifier |
| `DB_USER` | yes | no | Runtime database user |
| `DB_PASSWORD` | yes | yes | Runtime database password from secret management |
| `DB_POOL_MAX` | yes | no | Positive integer, maximum 100 |
| `DB_TIMEZONE` | yes | no | `Z`, `local`, or a UTC offset |
| `DB_SSL_CA_PATH` | production-dependent | no | Path to a mounted trusted CA file; do not bake the CA into the image |
| `DB_SSL_SERVER_NAME` | production/container | no | Expected named TLS certificate identity |
| `HOST` | no | no | Defaults to `0.0.0.0` in production/container mode |
| `PORT` | no | no | Deployment-supplied port; defaults to `3000` |
| `NODE_ENV` | yes for deployment | no | Set to `production` |
| `APP_ORIGIN` | yes | no | Absolute frontend HTTP(S) origin without a path |
| `SESSION_IDLE_TIMEOUT_MINUTES` | yes | no | Positive integer |
| `SESSION_ABSOLUTE_TIMEOUT_HOURS` | yes | no | Positive integer |

`DB_PASSWORD` must be supplied through the platform secret manager or equivalent runtime secret injection. It must not appear in Docker build arguments, image layers, logs, frontend variables, or source control.

## Database and TLS

Production MySQL connections use the existing `mysql2` pool and TLS implementation:

- `rejectUnauthorized` remains enabled.
- Certificate identity verification remains enabled.
- `DB_SSL_SERVER_NAME` is required in production/container mode.
- `DB_SSL_CA_PATH` should point to a platform-mounted CA file such as `/run/secrets/enterflow-db-ca.pem`.
- The runtime database user requires only the DML privileges needed by the application; migrations use a separate migration identity.
- The backend does not silently fall back to a different database.

The production database must be reachable through the platform's approved private network, connector, or TLS endpoint. This repository does not create that infrastructure.

## Startup, health, and shutdown

The server validates configuration and verifies database connectivity before listening.

- `GET /api/health` — backwards-compatible database health check; `200` when connected, `503` when unavailable.
- `GET /api/health/live` — liveness check; does not query MySQL.
- `GET /api/health/ready` — readiness check; queries MySQL and returns `503` when unavailable.

The server handles `SIGINT` and `SIGTERM`, closes the HTTP server, and ends the MySQL pool.

## Pre-deployment verification

1. Supply all required runtime variables through the deployment platform.
2. Mount the trusted database CA without copying it into the image.
3. Confirm `APP_ORIGIN` exactly matches the frontend origin.
4. Confirm the runtime database is not the development or browser-test database.
5. Confirm the deployment can reach the database over the approved TLS route.
6. Start the backend and verify `/api/health/live` and `/api/health/ready`.
7. Verify login, logout, and `/api/auth/me` with approved test accounts.
8. Run a same-origin frontend smoke test through the production ingress.

Do not run migrations automatically during container startup. Apply migrations through the separately reviewed migration procedure.

## Logging, monitoring, and rollback

The application now generates server-side request IDs and returns them in the
X-Request-ID response header. Completed HTTP requests produce structured JSON
logs with request ID, method, status code, and duration. These logs intentionally
exclude request URLs, query parameters, headers, cookies, and request bodies.
Authentication and server startup/shutdown errors use generic log messages.
Centralized log collection and comprehensive sensitive-data redaction are not
yet implemented. Health-check errors retain their existing narrow redaction
behavior. This is not a complete personal-data or secret-redaction policy.
Avoid logging request bodies, cookies, tokens,
passwords, database configuration, or raw driver errors.

Audit events are written for selected Admin/client-application decisions and
password changes, but coverage is incomplete and no global request ID is
currently attached. Audit-event records do not replace operational logs.
Retention, access review, centralized redaction, alert delivery, and a
production on-call process require deployment infrastructure and ownership;
none is configured in this repository.

Before production, define structured event fields (timestamp, severity,
service/version, environment, generated request ID, stable error category),
retain server-generated request IDs in HTTP responses, propagate them to supported
audit writes, and redact at the logging boundary. Define retention/access
periods for application and audit data separately. Monitor liveness, database
readiness, request error rates/latency, database connection failures, and
authentication/authorization failure rates. Alerts need thresholds, routing,
an owner, and runbooks. These are requirements, not implemented platform
configuration.

Rollback requires switching the deployment to the prior reviewed image and
preserving the database state. No automatic schema rollback is provided.

## Known limitations

- No production platform has been selected or configured in this repository.
- No production database or secret manager has been accessed.
- The nginx image serves static assets only; the deployment ingress must route `/api` to the backend.
- The current root package contains both frontend and backend dependencies, so the backend image installs the production subset of the shared package manifest.
- Migration 007 remains on hold and is not part of this preparation.
