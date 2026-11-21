-- Enter-Flow Phase 2 registration workflow extension
-- Target: enterflow_phase2_db (P2B002)
-- IMPORTANT:
--   1. This is a separate extension; do NOT edit the authoritative P2B002 bootstrap.
--   2. Review this script before execution.
--   3. Do NOT run through database/migrate.mjs or the legacy migration framework.
--   4. This script creates one new table only. It does not modify existing rows.
--   5. Apply only through the designated database recovery/change operator.

CREATE TABLE client_applications (
    application_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(160) NOT NULL,
    email VARCHAR(254) NOT NULL,
    phone VARCHAR(40) NULL,
    password_hash VARCHAR(255) NOT NULL,

    application_status ENUM('pending', 'approved', 'rejected')
        NOT NULL DEFAULT 'pending',

    reviewed_by_user_id BIGINT UNSIGNED NULL,
    reviewed_at DATETIME(3) NULL,
    review_note TEXT NULL,

    created_client_id BIGINT UNSIGNED NULL,
    created_user_id BIGINT UNSIGNED NULL,

    -- Only pending/approved applications reserve an email address.
    -- Rejected applications do not permanently block a new application.
    active_email VARCHAR(254)
        GENERATED ALWAYS AS (
            CASE
                WHEN application_status IN ('pending', 'approved')
                THEN LOWER(email)
                ELSE NULL
            END
        ) STORED,

    submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (application_id),
    UNIQUE KEY uq_client_application_active_email (active_email),
    UNIQUE KEY uq_client_application_created_client (created_client_id),
    UNIQUE KEY uq_client_application_created_user (created_user_id),
    KEY ix_client_application_review_queue
        (application_status, submitted_at, application_id),
    KEY ix_client_application_reviewer
        (reviewed_by_user_id, reviewed_at),

    CONSTRAINT fk_client_application_reviewer
        FOREIGN KEY (reviewed_by_user_id)
        REFERENCES user_account(user_id),

    CONSTRAINT fk_client_application_created_client
        FOREIGN KEY (created_client_id)
        REFERENCES client(client_id),

    CONSTRAINT fk_client_application_created_user
        FOREIGN KEY (created_user_id)
        REFERENCES user_account(user_id),

    CONSTRAINT ck_client_application_review_state CHECK (
        (
            application_status = 'pending'
            AND reviewed_by_user_id IS NULL
            AND reviewed_at IS NULL
            AND created_client_id IS NULL
            AND created_user_id IS NULL
        )
        OR
        (
            application_status = 'rejected'
            AND reviewed_by_user_id IS NOT NULL
            AND reviewed_at IS NOT NULL
            AND created_client_id IS NULL
            AND created_user_id IS NULL
        )
        OR
        (
            application_status = 'approved'
            AND reviewed_by_user_id IS NOT NULL
            AND reviewed_at IS NOT NULL
            AND created_client_id IS NOT NULL
            AND created_user_id IS NOT NULL
        )
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Approval service transaction (implemented in application code, not this DDL):
-- 1. Lock the pending application row.
-- 2. Resolve role.role_id where role_name = 'Client'.
-- 3. Insert client using company_name, contact_person, email, phone;
--    set client.status = 'active' (confirm allowed project convention).
-- 4. Insert user_account using the submitted password_hash and resolved
--    Client role; set user_account.status = 'active'.
-- 5. Insert client_user(client_user_id, client_id).
-- 6. Update application to approved, recording reviewer, timestamp,
--    created_client_id, and created_user_id.
-- 7. Insert an audit_event for the approval.
-- All seven steps must run in one transaction and roll back together.
--
-- Rejection service transaction:
-- Update only a pending application to rejected and record reviewer,
-- reviewed_at, and review_note. Do not create client/user_account/client_user.
--
-- No statements in this file execute either workflow.
