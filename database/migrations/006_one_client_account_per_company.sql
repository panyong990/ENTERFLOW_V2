-- Enforce one client login account per client company.
-- MySQL UNIQUE indexes allow multiple NULL values,
-- so employee accounts remain unaffected.

ALTER TABLE users
  ADD CONSTRAINT uq_user_client_account
  UNIQUE (client_id);