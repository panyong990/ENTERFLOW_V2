-- Enter-Flow Phase 2 username support extension
-- Target: enterflow_phase2_db (P2B002) AFTER 002_client_registration.sql
--
-- REVIEW ONLY. This file has NOT been executed.
-- Do not edit the authoritative P2B002 bootstrap.
-- Do not run through database/migrate.mjs or the legacy migration framework.
-- Apply only after review and explicit authorization from the designated
-- database change/recovery operator.
--
-- Behavior:
--   * Existing employee accounts may keep username = NULL.
--   * New client applications must provide a username.
--   * Pending and approved applications reserve their username.
--   * Rejected applications release their username for reuse.
--   * Usernames are unique among non-NULL user_account values.
--
-- Application code must also check email-vs-username cross-field collisions
-- across user_account and client_applications under the same identity lock.
-- These independent unique indexes cannot enforce cross-table/cross-column
-- uniqueness by themselves.

ALTER TABLE user_account
    ADD COLUMN username VARCHAR(100) NULL AFTER email,
    ADD UNIQUE KEY uq_user_account_username (username);

ALTER TABLE client_applications
    ADD COLUMN username VARCHAR(100) NOT NULL AFTER email,
    ADD COLUMN active_username VARCHAR(100)
        GENERATED ALWAYS AS (
            CASE
                WHEN application_status IN ('pending', 'approved')
                THEN username
                ELSE NULL
            END
        ) STORED,
    ADD UNIQUE KEY uq_client_application_active_username (active_username);

-- No existing account username is populated or modified by this extension.
-- Existing employee accounts remain valid with NULL usernames.
-- Registration and approval services must:
--   1. Normalize/validate usernames consistently (trim; preserve intended case).
--   2. Check submitted email and username against BOTH email and username
--      columns in user_account and active applications.
--   3. Use the existing database-specific identity advisory lock for checks
--      and writes; approval must repeat checks inside its transaction.
--   4. Insert username into user_account only when an application is approved.
--   5. Keep registration submission limited to client_applications.
--
-- Login must accept one identifier and match user_account.email OR
-- user_account.username. It must fail closed if an unexpected ambiguous
-- match is ever found.
