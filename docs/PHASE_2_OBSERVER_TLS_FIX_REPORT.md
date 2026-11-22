# Phase 2 observer TLS diagnosis and correction

2026-11-22, Asia/Singapore. **TLS connectivity: PASS. Recovery not attempted.** Existing uncommitted recovery work was inspected before modification and preserved.

## Exact root cause

The active certificate has the correct IP SAN. The failure was caused by the interaction between mysql2's TLS session cache and the Phase 2 client's mandatory explicit certificate identity check.

1. `database/migrate.mjs` supplies the same config/ssl object to owner and observer connection creation.
2. Installed mysql2 `lib/tls_session_cache.js` stores TLS session tickets in a WeakMap keyed by that ssl object, with a host/port/verification-flags key. `lib/base/connection.js` passes the cached ticket as `session` to Node TLS.
3. The before-fix live trace shows owner `sessionReused=false`, authorized TLSv1.3, complete certificate with the required SAN and no identity error.
4. The observer reused that session: `sessionReused=true`, `authorized=true`, `authorizationError=null`, but `getPeerCertificate(true)` returned **an empty object**. mysql2's TLS callback reported no driver TLS error.
5. The Phase 2 pre-authentication hook then passed that empty object to `checkServerIdentity('127.0.0.1', cert)`. Node correctly returned `ERR_TLS_CERT_ALTNAME_INVALID`, reason `IP: 127.0.0.1 is not in the cert's list: `. mysql2 subsequently classified the hook failure as `HANDSHAKE_SSL_ERROR`.

This was not a missing SAN, wrong CA file or changed server certificate. The misleading identity failure arose because the resumed observer socket supplied no certificate to the explicit check. Node documents [session resumption and getPeerCertificate](https://nodejs.org/api/tls.html); the actual empty-certificate/resumed-session combination was demonstrated by this project's live trace, not assumed from documentation.

Actual TLS options before and after: TCP host 127.0.0.1, port 62286, `rejectUnauthorized=true`, `verifyIdentity=true`, configured dedicated CA. For an IP connection, installed mysql2 leaves TLS SNI servername undefined; the observed socket reports `servername=false`. The independent explicit identity remains **127.0.0.1**. No DNS substitution or servername override was needed.

## Certificate and CA verification

| Property | Before correction | After correction |
| --- | --- | --- |
| Leaf SAN | IP Address:127.0.0.1, DNS:localhost | Identical |
| Subject | CN=localhost | Identical |
| Issuer | CN=EnterFlow Phase2 Local Development CA | Identical |
| Leaf validity | Nov 21 20:56:44 2026 GMT to Feb 23 20:56:44 2029 GMT | Identical |
| Leaf SHA-256 | DD:4C:C3:18:88:44:CB:2A:71:04:76:E2:D8:CF:BD:7D:F4:63:E9:E0:91:2A:04:43:95:7B:AD:1B:DA:60:DB:2A | Identical on both connections |
| Configured CA SHA-256 | 34:2B:44:FD:ED:74:5E:7D:04:5C:03:E9:32:E2:B7:32:92:F1:48:6C:46:19:D4:C7:53:7C:D7:3F:07:E5:A8:54 | Identical |
| Leaf signature verified by configured CA public key | true on full owner handshake | true on owner and observer |

Existing environment selects `DB_SSL_CA=backend/certs/local/phase2/ca.pem` and `DB_TLS_SERVER_NAME=127.0.0.1`. The diagnostic resolves that exact CA path and the hook receives its PEM contents. CA subject/issuer is CN=EnterFlow Phase2 Local Development CA; CA validity is Nov 21 20:56:44 2026 GMT to Nov 18 20:56:44 2036 GMT.

Live read-only MySQL variables identify `ssl_ca=/var/lib/mysql/enterflow-phase2-tls-v1/ca.pem` and `ssl_cert=/var/lib/mysql/enterflow-phase2-tls-v1/server-cert.pem`. Read-only OpenSSL inspection of precisely those public files inside enterflow-phase2-mysql confirmed matching leaf/CA fingerprints, SANs and validity. OpenSSL `verify -purpose sslserver` returned OK for both `-verify_ip 127.0.0.1` and `-verify_hostname localhost`. The active wire certificate matches the configured disk certificate and the fingerprint previously recorded in the recovery configuration evidence. No certificate regeneration or server reload was necessary.

## Smallest correction and live acceptance evidence

Changed only production helper `database/migration-phase2-tls.mjs`: construct each connection with a new options object and a new shallow copy of ssl options. Installed mysql2 therefore cannot reuse an owner session ticket through the caller's shared ssl object. Each connection performs a full certificate-presenting handshake and independently passes the existing explicit identity hook **before credentials are sent**.

The correction preserves CA material, endpoint, expected IP, `rejectUnauthorized=true`, `verifyIdentity=true`, and all fail-closed identity checks. It does not accept an absent certificate, skip checks for resumed sessions, cache an accepted identity, modify dependencies, or introduce an insecure fallback. The cost is a full handshake/secure-context setup per Phase 2 connection; no session-resumption optimization is retained across those separate connections.

Live probe after correction:

| Check | Owner | Observer |
| --- | --- | --- |
| TLS handshake | PASS, TLSv1.3 | PASS, TLSv1.3 |
| CA authorized / authorization error | true / NULL | true / NULL |
| Session resumed | false | false |
| Leaf certificate present | yes | yes |
| Explicit 127.0.0.1 identity check | PASS | PASS |
| Leaf signature verified by intended CA | true | true |
| DATABASE() / version | enterflow_phase2_db / 8.4.13 | enterflow_phase2_db / 8.4.13 |
| Server UUID | 0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8 | Same |
| Hostname / internal port | 2acac2d1b606 / 3306 | Same |
| Distinct connection IDs | 17 | 18 |

These were real authenticated, simultaneously open owner/observer connections to TCP 127.0.0.1:62286 using the existing credential. Both closed normally. No migration runner was called.

Evidence files: `database/phase2-execution/activation-2026-11-22/observer-tls-before.json` (reproduced failure) and `observer-tls-after.json` (PASS). They contain sanitized TLS options, public certificate metadata, handshake observations, exact read-only SQL and database identities; no credentials, session tickets or private keys.

Offline tests: four new cases in `database/migration-phase2-tls-observer.test.mjs` passed. A synthetic SSL-object-keyed cache reproduces the original reuse behavior and verifies separate owner/observer handshakes with unchanged settings. Negative cases reject wrong IP SAN, missing IP SAN and untrusted CA before authentication. Nine existing focused certificate/hook tests were rerun because this task changed their shared production TLS helper; all passed. No unrelated suite was repeated. `git diff --check` passed.

Commands used for live before/after verification (each invoked once):

```powershell
node database/phase2-tls/verify-observer-readonly.mjs database/phase2-execution/activation-2026-11-22/observer-tls-before.json
node database/phase2-tls/verify-observer-readonly.mjs database/phase2-execution/activation-2026-11-22/observer-tls-after.json
```

## Files/configuration changed and recovery readiness

This task modified `database/migration-phase2-tls.mjs` and added:

- `database/migration-phase2-tls-observer.test.mjs` — focused offline regression cases.
- `database/phase2-tls/verify-observer-readonly.mjs` — read-only sanitized TLS diagnostic and identity verification helper.
- The two before/after JSON evidence files listed above.
- This report.

No certificate, CA, private key, environment, MySQL/Docker configuration, dependency or recovery guard was changed. Earlier uncommitted files and evidence remain preserved; nothing was staged or committed.

**Do not retry the existing resume-003 command unchanged.** Its exact-failure guard requires ER_TABLE_NOT_LOCKED, while the last verified failed 003 row records HANDSHAKE_SSL_ERROR. This task resolved observer TLS connectivity only; it did not reconcile history. A separate reviewed recovery update must explicitly account for the current failed state, freshly verify no ALTER effects and all other prerequisites, and receive execution authorization. No generic retry or manual history rewrite is appropriate. Full live locking/ALTER execution remains unverified. Application runtime activation was not attempted.

## Database Change Report

**Connections:** before fix, one successful owner connection plus one observer attempt rejected at TLS identity verification before credential dispatch; after fix, two successful authenticated TLS connections (owner and observer). Every network attempt targeted 127.0.0.1:62286 / enterflow_phase2_db only. All successful connections closed; the rejected connection was destroyed. No shared or restore connection occurred.

**Queries:** exactly six read-only SQL statements across three successful connections: each issued the following two statements, saved in its evidence file:

```sql
SELECT DATABASE() AS name,VERSION() AS version,@@server_uuid AS serverUuid,
       @@hostname AS hostname,@@port AS internalPort,
       CAST(CONNECTION_ID() AS CHAR) AS connectionId;
SHOW VARIABLES WHERE Variable_name IN ('ssl_ca','ssl_cert');
```

**Tables reviewed:** none in this TLS-only task; only connection identity and public TLS configuration variables were read. No migration ledger/history, protected Migration 007/checksum, business records, shared schema or restore schema was queried. The failed history state cited above is the preceding execution report's verified observation, not a new history query in this task.

**Database changes proposed/performed:** none. Zero DDL/DML, ALTER, schema/data writes, transaction commands, session SET, locks, grants, imports, migrations, recovery commands or seeds. No new SQL migration was created/applied. Ordinary server connection/statement instrumentation may update automatically; no administrative settings were changed. Only public certificate files were inspected through read-only Docker exec/OpenSSL commands; no private key file was read, copied or printed. Existing volume and all database contents were preserved.

**Pending:** separately scoped review of the new failure state and any subsequent recovery execution. Stop point: verified owner/observer TLS connectivity, before migration recovery.
