-- PREPARED FOR REVIEW ONLY. Execution requires separate explicit approval.
-- MySQL 8.4 / InnoDB: reserve email and username only for pending applications.
-- Preserve utf8mb4_unicode_ci identity comparisons and allow rejected-history reuse.
-- Before application, pause relevant writes and recheck pending duplicates under
-- this collation. Stop on conflicts; do not delete or rewrite existing records.
-- These indexes do not enforce cross-field or cross-table identity uniqueness;
-- the registration/account workflows must serialize and recheck those conflicts.
-- Keep one ALTER statement. Do not force an online DDL algorithm: combining
-- virtual-column additions with index additions can require a table copy/lock.

ALTER TABLE client_applications
  ADD COLUMN pending_email VARCHAR(254)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    GENERATED ALWAYS AS (
      CASE WHEN status = 'pending' THEN email ELSE NULL END
    ) VIRTUAL NULL,
  ADD COLUMN pending_username VARCHAR(100)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    GENERATED ALWAYS AS (
      CASE WHEN status = 'pending' THEN username ELSE NULL END
    ) VIRTUAL NULL,
  ADD UNIQUE KEY uq_application_pending_email (pending_email),
  ADD UNIQUE KEY uq_application_pending_username (pending_username);
