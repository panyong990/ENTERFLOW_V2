-- Enter-Flow Phase 2
-- Additive authentication session storage extension.
-- Requires the P2B002 user_account table.
-- Review and authorize separately before database execution.

CREATE TABLE user_sessions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    last_activity_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    revoked_at DATETIME(3) NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_user_sessions_token_hash (token_hash),
    KEY ix_user_sessions_user_id (user_id),
    KEY ix_user_sessions_expires_at (expires_at),

    CONSTRAINT fk_user_sessions_user_account
        FOREIGN KEY (user_id)
        REFERENCES user_account(user_id)
        ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
