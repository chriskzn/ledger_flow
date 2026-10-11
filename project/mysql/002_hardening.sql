-- Apply only to a NEW MySQL 8.0+ installation after 001_schema.sql.
-- For existing data, audit duplicates and orphan foreign keys before adding constraints.
USE ledgerflow;
ALTER TABLE accounts ADD UNIQUE KEY uq_accounts_tenant_code (user_id, code(100));
ALTER TABLE invoices ADD UNIQUE KEY uq_invoice_tenant_number (user_id, invoice_number(100));
ALTER TABLE journal_entries ADD UNIQUE KEY uq_journal_source (user_id, source, source_id);
CREATE TABLE IF NOT EXISTS operation_idempotency (
  user_id CHAR(36) NOT NULL, operation_key VARCHAR(128) NOT NULL,
  operation_type VARCHAR(40) NOT NULL, entity_id CHAR(36) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (user_id, operation_key),
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS audit_events (
  id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL,
  action VARCHAR(80) NOT NULL, entity_id CHAR(36),
  metadata JSON, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX idx_audit_tenant_created (user_id,created_at),
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
-- Prevent deletion of any posted journal via API; SQL privileges should also
-- deny DELETE on journal_entries and journal_lines to the API database user.
