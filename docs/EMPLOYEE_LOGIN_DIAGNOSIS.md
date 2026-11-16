# Employee login diagnosis — 2026-11-16 (Asia/Manila)

> **Later Employee Management investigation:** [current read-only findings](EMPLOYEE_MANAGEMENT_READONLY_DIAGNOSIS.md)
> verify all eight development employees remain active and the actual directory
> read service works. Restored stopped normal servers; no new account/session
> writes or authenticated browser tests. Earlier zero-account context is history.

Final status: **PARTIALLY FIXED**. The transport failure is diagnosed and its
handling corrected. Real employee login cannot be verified because the configured
database has no employee accounts in the eight reported roles.

## Root cause and evidence

- Initial HTTP probes found no listener at the backend's `127.0.0.1:3000` or
  the usual frontend ports. This does not establish which processes were running
  when the user originally saw the error.
- Starting the original Vite configuration alone reproduced the reported error
  path exactly: `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout` each
  produced `ECONNREFUSED` to port 3000, an HTTP 500 `text/plain` response, and
  an empty body. `src/app/api/client.ts` translates that JSON parse failure into
  the reported “invalid response” message.
- `npm run dev` starts only Vite; the original README omitted the required
  separate backend startup. The existing proxy target matches the backend's
  configured default binding. This is an unavailable-backend failure, not an
  observed HTML fallback or successful-response schema mismatch.
- The authorized, protected runtime configuration targets loopback MySQL port
  3308 and `enterflow_db`, with `APP_ORIGIN=http://localhost:5173`. The CA exists
  and session timeout settings are present. No secret values were displayed.
- Approved read-only inspection confirmed MySQL 8.4.13, database `enterflow_db`,
  an authorized TLS connection, and both strict TLS verification flags enabled.
  The employee aggregate query returned **zero rows** for Admin, Sales,
  Operations, Accounting, Production, Warehouse, Logistics, and Owner. Thus
  none of the reported eight employee roles has an account in this target.
  Other databases were not searched.
- The actual backend subsequently started successfully with its normal read-only
  startup probe. Through the actual Vite configuration, unauthenticated `/me`
  returned 401 JSON, empty-input `/login` returned 401 JSON, and no-cookie
  `/logout` returned 200 JSON with a cookie-clearing header. No authenticated
  requests or credential-bearing login attempts were made.

## Correction and files

- `README.md`: document `npm run server` followed by `npm run dev` in separate
  terminals, prerequisite database/TLS setup, and the exact browser origin.
- `vite.config.ts`: retain the existing proxy destination and original Origin
  header; enforce port 5173 instead of silently selecting an unapproved origin.
- `config/api-proxy.mjs`: return sanitized, non-cacheable 503 JSON with
  `API_UNAVAILABLE` when the backend is unreachable.
- `src/app/api/client.ts`: reject null, array, and malformed JSON envelopes
  with the existing safe invalid-response error.
- `src/app/api/client.test.mjs`: cover login transport, session restoration,
  unavailable-backend handling, and malformed envelopes.
- `tests/auth-login.integration.test.mjs`: exercise Vite against the existing
  auth router using injected, in-memory services, then simulate backend outage.
- This report records evidence, scope, validation, and remaining blockers.

No authentication service, password, RBAC, registration, application approval,
portal, session policy, database/TLS configuration, or dependency was changed.
The proxy correction is local Vite configuration; production ingress still
requires its documented `/api` routing. No cloud deployment was performed.

## Validation

Node.js v24.21.0; all commands exited 0:

1. Focused backend tests with
   `--import ./backend/test/support/mock-database.js`: **96 passed, 0 failed,
   0 skipped**. Covered auth controller/service/router, session/password
   services, auth/origin/rate-limit/RBAC middleware, runtime settings, and TLS
   options. The import hook rejects live SQL.
2. `node --import ./backend/test/support/mock-database.js --test src/app/api/client.test.mjs tests/auth-login.integration.test.mjs`:
   **17 passed, 0 failed, 0 skipped**. Included cookie login/restoration/logout,
   incorrect-password rejection, backend exceptions, wrong-origin rejection,
   and all three auth endpoints during backend outage. Synthetic credentials
   and sessions existed only in test memory.
3. `npm run build`: **passed**; Vite warned about chunks larger than 500 kB.
4. Actual runtime HTTP checks: **3 expected JSON responses passed** as recorded
   above. A dependency-scan cancellation warning appeared when the temporary
   Vite server closed immediately after these checks; it did not fail the
   requests or the production build. Both temporary servers were stopped.

The sandbox blocked protected configuration access and Vite/esbuild loading;
those diagnostics/build/tests were rerun with approved escalation. No browser
automation or real employee login was performed. Tasks 28 and 29 were not started.

## Remaining prerequisites

Run both servers at the documented origin. The team must confirm whether the
claimed employee accounts belong to a different authorized database or arrange
separately approved provisioning of this target. Do not copy frontend Demo
credentials into real authentication or treat seed definitions as live accounts.
Successful real login, persisted session restoration, and real logout remain
unverified. A successful real login would insert a session; authenticated `/me`
and logout also write session state and require authorization for that testing.

## DATABASE CHANGE REPORT

Only the explicitly approved identity and role aggregate SELECT statements ran,
plus the identical read-only database/version SELECT during backend startup:

```sql
SELECT DATABASE() AS databaseName, VERSION() AS serverVersion;

SELECT role_code,
       COUNT(*) AS employee_count,
       SUM(active = 1) AS active_count,
       SUM(active = 1 AND password_hash LIKE '$argon2id$%') AS active_argon2id_count
FROM users
WHERE account_type = 'employee'
  AND role_code IN ('admin', 'sales', 'operations', 'accounting',
                    'production', 'warehouse', 'logistics', 'owner')
GROUP BY role_code;
```

No migrations, schema changes, inserts, updates, deletes, account creation,
password resets, grants, credential changes, or application/session record
writes were performed. No account identifiers, hashes, passwords, personal
information, tokens, or database secrets were displayed. Existing databases,
Docker resources, accounts, and TLS settings were preserved.
