# ENTER-FLOW V2 — Layer 4 Authentication and Authorization Review

Date: 2026-11-19  
Scope: authentication, sessions, credentials, role enforcement, permissions, ownership, and cross-role access only

## Scope restrictions

This review covered the existing authentication services/controllers/routes, session lifecycle, password hashing/change behavior, authentication and permission middleware, role metadata, Admin account lifecycle boundaries, client ownership checks, and cross-role HTTP tests. No business logic, routes, frontend, schema, migration, repository, account data, or production data was changed. Migration 007 was not inspected, modified, or executed.

## 1. Authentication architecture verified

### Login and credential handling

- Login accepts a bounded identifier/password pair and queries email or username with bound parameters.
- Active and inactive/nonexistent accounts produce the same generic invalid-credentials response.
- A dummy Argon2id hash is verified for missing/inactive accounts to reduce account-enumeration timing differences.
- Passwords are verified with Argon2id; plaintext passwords are not stored or returned.
- Successful login creates a server-side session and returns identity data without exposing the session token in JSON.
- The authentication controller sets the session token only in an HttpOnly cookie with path `/`, SameSite `lax`, production `secure`, and configured absolute max age.
- Login is protected by same-origin validation and login rate limiting.

### Sessions

- Session tokens are 32 random bytes represented as 64 lowercase hexadecimal characters.
- Only SHA-256 token hashes are stored in `user_sessions`; raw tokens are not persisted.
- Session validation requires an unrevoked session, absolute expiry, idle timeout, active user account, and a matching user record.
- Protected requests update session activity and fail closed if activity cannot be persisted.
- Duplicate or malformed authentication cookies are rejected rather than selected ambiguously.
- Logout revokes the authenticated token when valid and clears the cookie. Malformed tokens do not trigger unsafe database operations.
- Deactivated accounts and role/identity lifecycle changes revoke or invalidate affected sessions through the established Admin/service transactions.

### Password changes

- Authenticated password change requires the current password, a distinct new password, bounded input, Argon2id hashing, active account state, session revocation, and an audit event in one transaction.
- Failed verification does not update credentials. Transaction or audit failure rolls back and returns a generic unavailable response.
- No Admin credential-reset endpoint or unapproved credential-recovery workflow is exposed.

## 2. Authorization and role boundaries

| Role | Verified authorization boundary | Status |
|---|---|---|
| Client | Client-account middleware requires `accountType=client`, `roleCode=client`, and a valid authenticated `clientId`; portal services derive ownership from server identity and return not-found/denial for other clients' records | **PASS** |
| Sales | Sales routes require employee account, exact Sales role where applicable, and resource/action permissions; narrow inquiry-rejection history exception is explicit for Sales, Owner, and Operations | **PASS** |
| Admin | Admin routes require exact Admin role and employee account; Admin account management is permissioned; client creation, role-definition editing, unauthorized payment approval, and non-Admin management are denied | **PASS** |
| Accounting | Accounting routes/document actions require employee Accounting role plus invoice/payment/delivery-receipt permissions; payment verification is not exposed to Sales or other roles | **PASS** |
| Production | Production reads require employee account, explicit Production/Admin/Owner/Operations role gate, and `production:read`; no unsupported production mutation route is exposed | **PASS** |
| Warehouse | Stock-request mutations require Warehouse role and `stockRequests:update`; shipment reads require exact Warehouse role; inventory permissions remain separate | **PASS** |
| Logistics | Shipment reads require exact Logistics role plus both `deliveries:read` and `waybills:read`; Warehouse/other roles cannot use Logistics routes | **PASS** |
| Owner | Owner routes require exact Owner role and employee account; directory is read-only; Owner cannot use Admin management routes or Sales mutation paths | **PASS** |
| Operations | Supported Production reads and rejection-history reads use explicit Operations role exceptions; Operations does not receive Owner/Admin actions or unsupported workflow mutations | **PASS** |

The `reports:read` permission appears in the existing metadata for Admin, Owner, Accounting, and Operations, but no Reporting route exists. This is not an authorization bypass: there is no report resource to retrieve. A future Reporting API requires an approved scope and dataset contract before routing.

## 3. Access-boundary verification

Verified behavior includes:

- unauthenticated requests receive 401 and do not invoke protected services;
- malformed, duplicate, expired, revoked, idle-expired, or inactive-account sessions are rejected;
- inactive accounts cannot log in or continue authenticated requests;
- clients cannot substitute client IDs or retrieve other clients' orders/documents/payments;
- non-Admin roles cannot call Admin APIs, even when the injected permission checker is permissive;
- Sales cannot verify payments or use Warehouse/Accounting-only operations;
- Owner and Operations cannot use Admin account-management routes;
- Warehouse and Logistics shipment boundaries remain distinct;
- service projections exclude passwords, password hashes, session identifiers, storage paths, and other sensitive internals;
- role/permission middleware denies unknown roles, resources, actions, missing authentication, and unlisted roles;
- unsupported Reporting functionality has no public or protected endpoint.

## 4. Security defects and changes

No confirmed authentication or authorization defect was found. No security code or tests were changed. Existing controls were retained rather than weakened to accommodate unsupported workflows.

The following are requirements/security follow-ups, not confirmed defects:

- Admin `resetPassword` exists as permission metadata but has no endpoint or service workflow; credential-reset requirements remain unapproved.
- Reporting permissions are metadata-only until a report dataset, role scope, and endpoint contract are approved.
- Comprehensive production browser, live MySQL, secret-rotation, deployment-cookie, and infrastructure security validation require an approved environment and remain outside automated service-double verification.

## 5. Verification evidence

- Focused authentication, authorization, permissions, session, password, Admin boundary, client ownership, and cross-role tests: **237 passed, 0 failed, 0 skipped**.
- Full backend suite: **865 passed, 0 failed, 0 skipped**.
- Tests cover login/logout, password verification, dummy-hash behavior, token hashing, session expiry/activity/revocation, inactive accounts, duplicate cookies, role/permission middleware, origin/rate limits, Admin account boundaries, client ownership, and cross-role endpoint denial.
- No live MySQL persistence or browser verification was performed.
- `git diff --check`: **PASS**; existing line-ending warnings only.

## 6. Files changed and stop condition

Only this Layer 4 review document was added. Existing uncommitted work was preserved. No authentication, authorization, business logic, route, frontend, database, migration, or repository file was changed.

**Stop condition satisfied: Layer 5, Layer 6, and later work were not started.**
