# Phase 3.5: MySQL TLS security hardening

Verified November 15, 2026 (Asia/Manila). Final results: **11 focused TLS tests,
6 read-only backend/MySQL checks, and 127 authentication/registration regression
tests passed**. Zero failures in the final runs. No SQL writes or migrations.

## Root cause verified

The Phase 3 wrong-`ssl.servername` test alone established only that the override
was ignored. Phase 3.5 additionally inspected the installed mysql2 **3.24.6**
source and the actual pre-change backend connection:

- `lib/base/connection.js` derives the TLS server name from `config.host`; the
  unsupported `ssl.servername` property is not used.
- `ssl.verifyIdentity` selects Node's `tls.checkServerIdentity`; otherwise the
  driver installs a no-op name checker. Its type declaration documents this
  option as disabled by default for backwards compatibility.
- The actual pre-change backend connection had `ssl.verifyIdentity !== true`,
  while `stream.authorized === true`. The real certificate matched the intended
  local identity, and Node's checker rejected an intentionally wrong identity.

Thus certificate-chain validation was working, but the existing configuration
did not enable the driver's name verification. The correction addresses that
verified configuration gap; it does not assume all TLS checks were disabled.

## Exact fix

`backend/src/config/database-tls.js` constructs the TLS transport options:

- Always sets `ssl.rejectUnauthorized: true` and `ssl.verifyIdentity: true`.
- Sets mysql2's `host` to the expected named certificate identity, enabling its
  native Node identity check during the TLS handshake, before MySQL credentials.
- Uses mysql2's documented per-connection `stream` factory and Node's
  `net.connect` to connect to the original `DB_HOST`/`DB_PORT`. The transport
  address and certificate identity can therefore differ without DNS changes.
- Preserves TCP no-delay/keepalive behavior. Each pooled connection gets its own
  transport; mysql2 retains its native TLS session-resumption validation/cache.
- Rejects IP expected identities because this installed driver skips its explicit
  name check for IP-valued `config.host`. IP transport endpoints remain supported
  when a matching named certificate identity is supplied.

`backend/src/config/database.js` uses that helper and the optional
`DB_SSL_SERVER_NAME` setting. For non-production loopback connections only, it
preserves the existing explicitly defined local certificate identity:
`MySQL_Server_8.4.13_Auto_Generated_Server_Certificate`. Production (`NODE_ENV`
production or Cloud Run's `K_SERVICE`) never selects that local default. For a
remote DNS endpoint the default expected name is its configured `DB_HOST`; IP
endpoints require an explicit named identity.

The existing `DB_SSL_CA_PATH` behavior, including repository-relative paths, is
preserved. A missing local `.env.dev` file no longer prevents startup when a
container provides all required environment variables; required configuration
still fails closed and other dotenv file errors remain fatal. Existing process
environment settings continue to take precedence.

No certificates, private keys, shared environment files, DNS/hosts files,
dependencies, Docker resources, MySQL server settings, accounts, or grants were
changed. The local CA and certificate were not regenerated. No TLS bypass,
post-query identity check, driver patch, or custom permissive validator was used.

## Exact files changed in Phase 3.5

Modified existing file:

- `backend/src/config/database.js`

Created:

- `backend/src/config/database-tls.js`
- `backend/src/config/database-tls.test.js`
- `backend/test/database-tls.fixture.test.js`
- `backend/test/database-tls.mysql.integration.mjs`
- `backend/test/DATABASE_TLS_RESULTS.json`
- `backend/test/DATABASE_TLS_REPORT.md`

Earlier uncommitted Phase 1-3 work remains present and was not rewritten. No
frontend files, applied migrations, authentication modules, registration modules,
or dependency versions were modified in this phase. No commit or push.

## Tests and actual results

### Focused TLS tests: 11 passed

```powershell
node --test backend/src/config/database-tls.test.js backend/test/database-tls.fixture.test.js
```

Six option/configuration tests verify strict flags, explicit identity overrides,
production default separation, IP endpoint requirements, invalid identity
rejection, and endpoint/trust-material validation.

Five real mysql2 handshake tests use an ephemeral, loopback, database-free MySQL
greeting/TLS fixture. It accepts a trusted matching SAN identity and rejects an
incorrect expected name, untrusted CA, expired trusted certificate, and malformed
trust material. Rejected handshakes deliver zero MySQL authentication packets to
the fixture server. These exercise the actual driver's TLS handshake rather than
mocking `checkServerIdentity`.

The fixture uses the already-installed Git OpenSSL executable to generate
synthetic test-only certificates/private keys under a uniquely named OS temporary
directory. Those files are removed after testing. This adds no runtime/package
dependency and does not regenerate any database certificate.

### Actual backend connectivity: 6 passed

```powershell
node backend/test/database-tls.mysql.integration.mjs --read-only-existing
```

The standalone harness explicitly permits only the existing local development
endpoint `127.0.0.1:3308` and selected `enterflow_db`. It uses the actual backend
configuration and executes only SELECT metadata/constant queries and SHOW session
TLS status. It does not log credentials or raw driver errors.

| Actual backend test | Result |
| --- | --- |
| Existing CA and matching identity | Accepted; MySQL 8.4.13; both strict flags true |
| Explicit wrong `DB_SSL_SERVER_NAME` | Rejected with `HANDSHAKE_SSL_ERROR` and identity-mismatch reason |
| Unrelated CA via `DB_SSL_CA_PATH` | Rejected during TLS handshake |
| Same trusted CA via alternate temporary path | Accepted |
| Explicit matching `DB_SSL_SERVER_NAME` | Accepted |
| Repeated pooled reconnects | Accepted with strict verification retained |

Connection negotiated TLSv1.3 / `TLS_AES_256_GCM_SHA384`. Full safe results are
in `DATABASE_TLS_RESULTS.json`. Temporary public CA copies were removed. The
first read-only run had one test assertion expecting a numeric result where the
existing big-number-string configuration returns a string; the assertion was
corrected, with no further implementation change. Final run: 6/6 passed.

### Authentication and registration regressions: 127 passed

```powershell
node --import ./backend/test/support/mock-database.js --test backend/src/controllers/registration.controller.test.js backend/src/middleware/registration-rate-limit.middleware.test.js backend/src/routes/registration.http.integration.test.js backend/src/controllers/auth.controller.test.js backend/src/routes/auth.http.integration.test.js backend/src/middleware/login-rate-limit.middleware.test.js backend/src/middleware/origin.middleware.test.js backend/src/middleware/auth.middleware.test.js backend/src/services/registration.service.test.js backend/src/validation/registration.validation.test.js
```

The existing guard blocks live database access for these mocked regression tests.
Login/logout/me, session/cookie boundaries, registration/controller HTTP behavior,
validation, service failures, and independent rate-limit behavior passed. No
business data is written. Phase 3's migration-based 51-check harness was not rerun
because Phase 3.5 prohibits executing new migrations. The TLS-specific real MySQL
tests above independently exercise the modified backend configuration.

Syntax checks and `git diff --check` also passed.

## Cloud compatibility and limits

The fix uses existing Node/mysql2 mechanisms and introduces no cloud dependency.
For direct TCP Cloud SQL connections, supply the environment-specific trusted CA
through `DB_SSL_CA_PATH` and the certificate's expected DNS/CN identity through
`DB_SSL_SERVER_NAME` (or use a matching DNS-valued `DB_HOST`). Transport routing
still uses `DB_HOST`/`DB_PORT`; a local Docker CN is never automatically used in
production. Node's checker applies SAN rules and only uses CN fallback where
appropriate; a CN override cannot bypass a mismatching SAN.

Environment variables and mounted CA files can be provisioned through the
deployment's Secret Manager workflow without a local dotenv file. No cloud
instance, certificate mode, client-certificate policy, connector/proxy integration,
Cloud Run deployment, or Secret Manager configuration was changed or claimed as
tested. Instances requiring mutual TLS or a different connector/transport need
their own approved deployment configuration. Do not infer that the local
certificate identity applies to Cloud SQL.

Primary references:

- [mysql2 SSL and TLS session resumption](https://sidorares.github.io/node-mysql2/docs/documentation/ssl)
- [mysql2 documented custom stream factory](https://sidorares.github.io/node-mysql2/docs/documentation/extras)
- [Node TLS identity verification](https://nodejs.org/api/tls.html#tlscheckserveridentityhostname-cert)
- [Cloud SQL certificate configuration](https://docs.cloud.google.com/sql/docs/mysql/configure-ssl-instance)

## Database change report

- Tables affected: None.
- Schema changes: None.
- Data changes: None, including actual development business records.
- Migrations created, edited, or applied: None.
- Pending database changes requiring approval: None.
- Temporary database operations/resources: None; no SQL-writing tests were run.
- Development database operations: Read-only connectivity/TLS metadata checks.
- Database infrastructure/shared configuration/certificate changes: None.

Only ephemeral non-database TLS fixture sockets and test certificate files were
created, then cleaned up. Stopped after Phase 3.5; Phase 4 has not started.
