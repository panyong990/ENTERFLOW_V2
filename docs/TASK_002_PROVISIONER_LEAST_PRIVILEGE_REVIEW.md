# Task 002 provisioner least-privilege review

Date: 2026-11-21 (Asia/Singapore)

Scope: static correction of the Task 002 provisioner/grant model. This review does not approve or perform database, account, grant, schema, fixture, API, Docker, migration, or teardown operations.

## Finding

The prior design was broader than necessary. Giving the provisioner database-level `SELECT`, `INSERT`, `UPDATE`, and `DELETE` with `GRANT OPTION` allowed it to access or modify every current or future table in the run database. Only six tables need DML delegation, and each has a smaller privilege union.

MySQL does not allow a delegated grant administrator to grant a privilege it does not itself possess: `GRANT` and ordinary privilege-specific `REVOKE` require both the privilege being delegated and `GRANT OPTION`. Consequently, a delegated provisioner retains direct capability to exercise its exact delegated DML privileges while they are active. That capability cannot be removed through account naming, roles, or process policy. It can be minimized by:

1. granting DML authority only at exact table level;
2. granting it only after the tables exist and have been verified;
3. revoking it before fixture loading and API runtime;
4. reactivating it only for separately approved teardown; and
5. never passing its credential to the initializer, fixture, API, cleanup, or evidence processes.

The applicable MySQL 8.4 rules are documented in [GRANT](https://dev.mysql.com/doc/refman/8.4/en/grant.html), [REVOKE](https://dev.mysql.com/doc/refman/8.4/en/revoke.html), [Privileges Provided by MySQL](https://dev.mysql.com/doc/refman/8.4/en/privileges-provided.html), and [CREATE USER](https://dev.mysql.com/doc/refman/8.4/en/create-user.html).

## Corrected authority model

Use five run-scoped accounts: the existing four run accounts plus a phase-bound provisioner. A pre-existing target administrator bootstraps, revokes/locks, reactivates, and finally removes the provisioner. That administrator is already required for complete metadata visibility, so this does not add a new trust boundary.

The provisioner is not a runtime account. At runtime it must have only `USAGE` and be locked or have no available credential.

### Exact privilege matrix

| Phase | Recipient | Grant level | Privilege | `GRANT OPTION` | Purpose |
| --- | --- | --- | --- | --- | --- |
| Provisioning | Provisioner | Global | `CREATE USER` | No | Create the initializer, fixture, API, and cleanup accounts |
| Provisioning only | Provisioner | Database ``enterflow_it_<runId>.*`` | `CREATE` | Yes | Create the one run database and grant `CREATE` to the initializer; revoke before initialization |
| Provisioning only | Provisioner | Database ``enterflow_it_<runId>.*`` | `REFERENCES` | Yes | Grant parent-reference authority needed for the snapshot FKs; revoke before initialization |
| Initialization | Schema initializer | Database ``enterflow_it_<runId>.*`` | `CREATE`, `REFERENCES` | No | Create the approved 11 tables, indexes, constraints, and FKs |
| Post-schema grant phase | Provisioner | Table `roles` | `SELECT`, `INSERT` | Yes | Grant fixture insert/read and cleanup verification |
| Post-schema grant phase | Provisioner | Table `units` | `SELECT`, `INSERT` | Yes | Grant fixture insert/read and cleanup verification |
| Post-schema grant phase | Provisioner | Table `users` | `SELECT`, `INSERT`, `DELETE` | Yes | Grant fixture setup, API login/session reads, and cleanup |
| Post-schema grant phase | Provisioner | Table `user_sessions` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Yes | Grant API session lifecycle and cleanup |
| Post-schema grant phase | Provisioner | Table `materials` | `SELECT`, `INSERT`, `DELETE` | Yes | Grant fixture setup, API read, and cleanup |
| Post-schema grant phase | Provisioner | Table `finished_goods` | `SELECT` | Yes | Grant API read and cleanup verification |
| Fixture setup | Fixture writer | Tables `roles`, `units`, `users`, `materials` | `SELECT`, `INSERT` | No | Direct approved reference/employee/material fixture transaction |
| API runtime | API runtime | Tables `users`, `user_sessions`, `materials`, `finished_goods` | Exact plan matrix: `SELECT` on all four, `INSERT`/`UPDATE` only on `user_sessions` | No | Login, session persistence/validation/activity, Inventory read |
| Cleanup | Cleanup/verifier | Six exact tables | Plan matrix: `SELECT` on all six; `DELETE` only on `users`, `user_sessions`, `materials` | No | Independent readback and owned-row cleanup |
| Runtime | Provisioner | Global/database/table | `USAGE` only | No | No operational access |
| Teardown | Provisioner | Global | `CREATE USER` | No | Use account-level `REVOKE ALL PRIVILEGES, GRANT OPTION` on the four allowlisted accounts and then drop them; no DML delegation is reacquired |
| Teardown | Provisioner | Database ``enterflow_it_<runId>.*`` | `DROP` | No | Drop only the owned database after cleanup and account removal |

No account receives DML `GRANT OPTION` on `payment_terms`, `material_categories`, `filter_types`, `clients`, or `product_specifications`. The provisioner never receives database-wide DML, global data privileges, global `DROP`, `SELECT` on `mysql.*`, or direct grant-table DML.

## Required sequencing

1. The target administrator creates the run-scoped provisioner and gives it only global `CREATE USER` and database-level `CREATE, REFERENCES WITH GRANT OPTION` for the exact not-yet-created database.
2. The provisioner creates the run database and four accounts and grants the initializer. The target administrator then applies account-level `REVOKE ALL PRIVILEGES, GRANT OPTION` to the provisioner before initialization starts, ensuring no residual `GRANT OPTION` remains.
3. The initializer creates and verifies the 11-table snapshot.
4. The target administrator completes the privileged metadata absence check, then grants the provisioner the exact six-table DML union with `GRANT OPTION`.
5. The provisioner grants the approved fixture/API/cleanup permissions. Each account self-checks `SHOW GRANTS`; the provisioner also self-checks its grants.
6. The target administrator again applies account-level `REVOKE ALL PRIVILEGES, GRANT OPTION` to the provisioner, verifies `USAGE`, and locks it or removes access to its credential before any fixture write or API startup.
7. Teardown requires a new approval. Only after the API stops, pools close, owned cleanup succeeds, and target identity is reverified does the administrator reactivate the provisioner with global `CREATE USER` and exact-database `DROP` only.
8. The provisioner uses the special account-level `REVOKE ALL PRIVILEGES, GRANT OPTION FROM <account>` for the four exact role-free run accounts. `CREATE USER` authorizes this form, so the provisioner does not reacquire database/table DML. Each account self-verifies `USAGE`; the provisioner drops those accounts and the exact run database; the target administrator then removes the provisioner. `REVOKE ALL ON *.*` remains prohibited because it is a different, global-scope form.

MySQL permits a grant on a nonexistent table only when the granted privilege set includes `CREATE`. Therefore the six table-level DML delegations must not be pre-created: doing so would require unwanted table-creation authority. They are added only after schema creation. This sequencing requirement is explicit in the MySQL 8.4 [GRANT documentation](https://dev.mysql.com/doc/refman/8.4/en/grant.html).

## Separation-of-duties assessment

Creating separate provisioner, grant-administrator, and teardown accounts does not reduce the peak privilege required for the delegated grant and revoke operations:

- the grant administrator must possess every table privilege it delegates plus `GRANT OPTION`;
- ordinary privilege-specific revocation would need the same privileges, but the special account-level `REVOKE ALL PRIVILEGES, GRANT OPTION` can instead use global `CREATE USER` without reacquiring DML;
- the same global `CREATE USER` permits dropping the four users;
- an account that drops the database needs database-level `DROP`.

Three delegated administrators would increase credential count, recovery paths, and ownership checks while retaining the same combined authority across them. The corrected default therefore uses one provisioner account whose privileges are completely removed between phases. This reduces privilege duration without multiplying credentials.

The stronger optional model is to keep account creation, all `GRANT`/`REVOKE`, and database teardown with the pre-existing target administrator. In that model no delegated provisioner receives DML or teardown privileges, but the workflow requires administrator participation at every boundary. Either model is acceptable only after explicit approval; the plan chooses the phase-bound provisioner as the minimum practical automated arrangement.

## Corrections to existing documentation

Updated only `docs/TASK_002_ISOLATED_INTEGRATION_TEST_PLAN.md` section 2 and its corresponding approval prerequisite in section 10:

- replaced database-wide DML delegation with the exact six-table privilege union;
- documented that table-level delegation occurs only after verified table creation;
- added immediate post-grant revocation and runtime `USAGE`/lock state;
- made global `CREATE USER` phase-bound;
- retained database-level `CREATE, REFERENCES WITH GRANT OPTION` only for schema delegation;
- retained database-level `DROP` only for approved teardown; and
- documented why extra delegated admin accounts do not reduce peak privilege.

The provisioner section in `docs/TASK_002_PRE_IMPLEMENTATION_TECHNICAL_REVIEW.md` is superseded by this correction. It is retained as historical review evidence and was not rewritten.

## Remaining limitations and approvals

- A delegated grantor can directly exercise the exact privileges it is allowed to grant while those privileges are active; MySQL provides no grant-only variant that removes this capability.
- The target administrator must participate before initialization, after schema verification, before runtime, and at teardown. The exact operator/credential and evidence format remain approval items.
- Global `CREATE USER` is inherently broader than four named accounts. Its exposure is limited by short phase duration and revocation, but the optional administrator-managed model is stronger.
- Exact account host restrictions, target identity, fixture values, schema execution, account/grant statements, writes, cleanup, and teardown remain unapproved.
- A `read_only` server would add global `CONNECTION_ADMIN` requirements for account/grant operations. The plan continues to reject such a target.

## Artifact integrity and Database Change Report

The approved 11-table SQL snapshot and manifest were not modified. This correction changes only permission documentation; it does not change the schema, fixture contract, API workflow, or exclusion of `audit_events`.

Files changed:

- `docs/TASK_002_ISOLATED_INTEGRATION_TEST_PLAN.md`
- `docs/TASK_002_PROVISIONER_LEAST_PRIVILEGE_REVIEW.md`

Tables reviewed for delegation scope: `roles`, `units`, `users`, `user_sessions`, `materials`, and `finished_goods`. The other five approved snapshot tables receive no provisioner DML delegation.

No database connection, SQL, test, Docker, account/grant, fixture, API, application/configuration, credential, migration, schema, manifest, or Git operation occurred. Schema changes performed: none. Data changes performed: none. Migrations created/applied: none. Existing uncommitted work was preserved. Protected Migration 007, its source, history, and checksum were not accessed, inspected, enumerated, hashed, executed, modified, or validated.

READY FOR IMPLEMENTATION APPROVAL
