-- MySQL 8.0+ INITIAL SCHEMA (new installs, not a data migration).

-- No RLS in MySQL: authorization and tenant scoping must be implemented in backend.

-- Store UUIDs as CHAR(36). User identity and permissions require backend auth.

CREATE DATABASE IF NOT EXISTS ledgerflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE ledgerflow;

CREATE TABLE IF NOT EXISTS app_users (id CHAR(36) PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL);

CREATE TABLE IF NOT EXISTS companies (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  name TEXT NOT NULL,
  registration_number TEXT,
  vat_number TEXT,
  paye_number TEXT,
  uif_reference TEXT,
  sdl_reference TEXT,
  coida_number TEXT,
  sic_code TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  postal_code TEXT,
  province TEXT,
  phone TEXT,
  email TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_branch_code TEXT,
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 15.00,
  financial_year_start date,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS accounts (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  subtype TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_accounts_user (user_id),
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS journal_entries (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  entry_date date NOT NULL,
  reference TEXT,
  description TEXT NOT NULL,
  period_month INT NOT NULL,
  period_year INT NOT NULL,
  status VARCHAR(255) NOT NULL DEFAULT 'posted',
  source VARCHAR(255) DEFAULT 'manual',
  source_id CHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_journal_entries_user (user_id),
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS journal_lines (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  journal_entry_id CHAR(36) NOT NULL,
  account_id CHAR(36) NOT NULL,
  debit DECIMAL(15,2) NOT NULL DEFAULT 0,
  credit DECIMAL(15,2) NOT NULL DEFAULT 0,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  INDEX idx_journal_lines_user (user_id),
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customers (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  vat_number TEXT,
  registration_number TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  postal_code TEXT,
  province TEXT,
  contact_person TEXT,
  credit_limit DECIMAL(15,2) DEFAULT 0,
  opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_customers_user (user_id),
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS suppliers (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  vat_number TEXT,
  registration_number TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  postal_code TEXT,
  province TEXT,
  contact_person TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_branch_code TEXT,
  opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_suppliers_user (user_id),
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS invoices (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  customer_id CHAR(36),
  invoice_number TEXT NOT NULL,
  invoice_date date NOT NULL,
  due_date date NOT NULL,
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  vat_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  total DECIMAL(15,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(255) NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  INDEX idx_invoices_user (user_id),
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS invoice_items (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  invoice_id CHAR(36) NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 15.00,
  line_total DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  INDEX idx_invoice_items_user (user_id),
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS employees (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  id_number TEXT,
  tax_number TEXT,
  email TEXT,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  postal_code TEXT,
  province TEXT,
  position TEXT,
  department TEXT,
  employment_type VARCHAR(255) NOT NULL DEFAULT 'permanent',
  pay_frequency VARCHAR(255) NOT NULL DEFAULT 'monthly',
  basic_salary DECIMAL(15,2) NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_type TEXT,
  bank_branch_code TEXT,
  medical_aid DECIMAL(15,2) NOT NULL DEFAULT 0,
  pension DECIMAL(15,2) NOT NULL DEFAULT 0,
  provident_fund DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_rebate DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_employees_user (user_id),
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payslips (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  employee_id CHAR(36) NOT NULL,
  pay_period_month INT NOT NULL,
  pay_period_year INT NOT NULL,
  pay_date date NOT NULL,
  basic_pay DECIMAL(15,2) NOT NULL DEFAULT 0,
  overtime DECIMAL(15,2) NOT NULL DEFAULT 0,
  bonuses DECIMAL(15,2) NOT NULL DEFAULT 0,
  allowances DECIMAL(15,2) NOT NULL DEFAULT 0,
  gross_pay DECIMAL(15,2) NOT NULL DEFAULT 0,
  paye DECIMAL(15,2) NOT NULL DEFAULT 0,
  uif DECIMAL(15,2) NOT NULL DEFAULT 0,
  sdl DECIMAL(15,2) NOT NULL DEFAULT 0,
  medical_aid DECIMAL(15,2) NOT NULL DEFAULT 0,
  pension DECIMAL(15,2) NOT NULL DEFAULT 0,
  provident_fund DECIMAL(15,2) NOT NULL DEFAULT 0,
  other_deductions DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_deductions DECIMAL(15,2) NOT NULL DEFAULT 0,
  net_pay DECIMAL(15,2) NOT NULL DEFAULT 0,
  company_uif DECIMAL(15,2) NOT NULL DEFAULT 0,
  company_sdl DECIMAL(15,2) NOT NULL DEFAULT 0,
  company_coida DECIMAL(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(255) NOT NULL DEFAULT 'draft',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_payslips_user (user_id),
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payslip_earnings (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  payslip_id CHAR(36) NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_taxable BOOLEAN NOT NULL DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payslip_id) REFERENCES payslips(id) ON DELETE CASCADE,
  INDEX idx_payslip_earnings_user (user_id),
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS api_keys (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  key_name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  permissions JSON NOT NULL,
  last_used_at DATETIME,
  expires_at DATETIME,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_api_keys_user (user_id),
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
