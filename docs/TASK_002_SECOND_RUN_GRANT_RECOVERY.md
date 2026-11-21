# Task 002 second-run grant recovery — approval pending

Run: `2f07518b9819d0c1`; database: `enterflow_it_2f07518b9819d0c1`.
Status: **BLOCKED pending explicit SQL recovery approval**. No grant retry,
attestation retry, scenario, or cleanup was executed during this investigation.

## Verified failure state

Fresh protected-administrator read-only inspection passed the existing container,
TLS/UUID/version, SQL-mode, session-UTC, administrator and connector-host guards.
Evidence: `backend/test/local/task-002/runs/2f07518b9819d0c1/inspect-accounts.observed.local.json`,
observed `2026-11-21T09:54:32.581Z`, host `172.17.0.1`, `partial_revokes=OFF`.
The diagnostic reads only these four users' account metadata and `SHOW GRANTS`;
it does not select an application database or read application records.

| Account suffix (prefix `it_2f07518b9819d0c1_`) | Lock | TLS required | Effective grants |
| --- | --- | --- | --- |
| init | Unlocked | Yes | CREATE, REFERENCES on the exact database |
| fixture | Locked | Yes | None (USAGE only) |
| api | Locked | Yes | None (USAGE only) |
| cleanup | Locked | Yes | None (USAGE only) |

The post-schema grant implementation derived its table scope from
`literalDatabaseGrantScope(...).slice(0, -1)`. With `partial_revokes=OFF` that
produced a database qualifier containing backslashes before underscores. Those
escapes belong only to database-level `database.*` patterns; table-level qualifiers
must use the literal database identifier. See the [MySQL 8.4 GRANT documentation](https://dev.mysql.com/doc/refman/8.4/en/grant.html).
The first table grant therefore targeted the wrong identifier. The observed lack
of runtime privileges is consistent with failure before any successful grant.
The original sanitized failure does not retain the native MySQL error code, so
no historical error number or raw error message is asserted here.
Runtime attestation independently rejects the three locked accounts and their
missing approved grants. It must not be forced successful.

## Offline correction and checks

Table scopes now quote the exact validated database literally; the initializer's
database-level underscore escaping remains unchanged. Every runtime account's
exact grants are checked while all three remain locked, before any unlock, and
checked again afterward. The diagnostic `inspect-accounts` phase is read-only,
second-run-only, and retains exclusive evidence creation and fresh approval/live
identity checks. No credentials or credential-bearing SQL are logged.

`node --test --test-reporter=dot backend/test/support/administrator-runtime-grants.test.mjs backend/test/support/administrator-provisioning.test.mjs`
passed **22/22**. Injected connections cover success, first/partial grant failure,
unexpected initial privileges, failed readback before unlock, locked-account
attestation rejection, and read-only state inspection. These are offline checks,
not live evidence that the corrected grants succeeded.

## Exact proposed SQL changes — NOT EXECUTED

After fresh authorization/identity/freshness checks, apply only the following
14 table grants to the verified dormant accounts. Verify their exact privileges
and TLS/lock states before the three final unlocks; verify again afterward.
Preserve initializer permissions. Do not reset accounts or passwords, broaden
grants, retry failures automatically, or repair partial state automatically.

```sql
GRANT INSERT, SELECT ON `enterflow_it_2f07518b9819d0c1`.`roles` TO 'it_2f07518b9819d0c1_fixture'@'172.17.0.1';
GRANT INSERT, SELECT ON `enterflow_it_2f07518b9819d0c1`.`units` TO 'it_2f07518b9819d0c1_fixture'@'172.17.0.1';
GRANT INSERT, SELECT ON `enterflow_it_2f07518b9819d0c1`.`users` TO 'it_2f07518b9819d0c1_fixture'@'172.17.0.1';
GRANT INSERT, SELECT ON `enterflow_it_2f07518b9819d0c1`.`materials` TO 'it_2f07518b9819d0c1_fixture'@'172.17.0.1';
GRANT SELECT ON `enterflow_it_2f07518b9819d0c1`.`users` TO 'it_2f07518b9819d0c1_api'@'172.17.0.1';
GRANT INSERT, SELECT, UPDATE ON `enterflow_it_2f07518b9819d0c1`.`user_sessions` TO 'it_2f07518b9819d0c1_api'@'172.17.0.1';
GRANT SELECT ON `enterflow_it_2f07518b9819d0c1`.`materials` TO 'it_2f07518b9819d0c1_api'@'172.17.0.1';
GRANT SELECT ON `enterflow_it_2f07518b9819d0c1`.`finished_goods` TO 'it_2f07518b9819d0c1_api'@'172.17.0.1';
GRANT SELECT ON `enterflow_it_2f07518b9819d0c1`.`roles` TO 'it_2f07518b9819d0c1_cleanup'@'172.17.0.1';
GRANT SELECT ON `enterflow_it_2f07518b9819d0c1`.`units` TO 'it_2f07518b9819d0c1_cleanup'@'172.17.0.1';
GRANT DELETE, SELECT ON `enterflow_it_2f07518b9819d0c1`.`users` TO 'it_2f07518b9819d0c1_cleanup'@'172.17.0.1';
GRANT DELETE, SELECT ON `enterflow_it_2f07518b9819d0c1`.`user_sessions` TO 'it_2f07518b9819d0c1_cleanup'@'172.17.0.1';
GRANT DELETE, SELECT ON `enterflow_it_2f07518b9819d0c1`.`materials` TO 'it_2f07518b9819d0c1_cleanup'@'172.17.0.1';
GRANT SELECT ON `enterflow_it_2f07518b9819d0c1`.`finished_goods` TO 'it_2f07518b9819d0c1_cleanup'@'172.17.0.1';
-- Only after all exact grants and locked/TLS states have been verified:
ALTER USER 'it_2f07518b9819d0c1_fixture'@'172.17.0.1' ACCOUNT UNLOCK;
ALTER USER 'it_2f07518b9819d0c1_api'@'172.17.0.1' ACCOUNT UNLOCK;
ALTER USER 'it_2f07518b9819d0c1_cleanup'@'172.17.0.1' ACCOUNT UNLOCK;
```

This document is a review packet, not an execution envelope or authorization.
Existing failed-attempt evidence and approval records remain unchanged. Expired
approvals/evidence cannot be reused; prepare fresh bindings only within subsequent
authorization. No schema verification or initialization was repeated here. The
separate 16-page handoff remains unavailable as previously recorded; available
Task 002 plan/security restrictions and the current owner scope were followed.

## Database Change Report

Reviewed only the four second-run accounts and their grants; no application tables
or records reviewed. Proposed: the 14 grants and 3 unlocks above. Performed: no
schema/data/account/grant changes; session-only UTC configuration and metadata
reads. No migrations created/applied. Protected development data, first-run
resources, Migration 007, approved snapshots/manifests/hashes, and Docker
configuration were untouched. Pending: explicit SQL recovery approval; subsequent
runtime progression and separately approved cleanup remain unexecuted.
