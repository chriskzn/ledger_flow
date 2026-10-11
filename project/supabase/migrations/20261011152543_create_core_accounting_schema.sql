/*
# Core Accounting & Payroll Schema — SA Compliant

## Overview
Creates the foundational database schema for a South African accounting and payroll package.
All data is multi-tenant, scoped to the authenticated user (user_id).

## New Tables

1. **companies** — The user's business profile (name, registration number, VAT number, PAYE number, UIF reference, SDL reference, COIDA number, address, banking details). One company per user.
2. **accounts** — Chart of accounts (code, name, type: asset/liability/equity/income/expense, is_system).
3. **journal_entries** — Journal entry headers (date, reference, description, period).
4. **journal_lines** — Journal entry lines (debit/credit per account, double-entry).
5. **customers** — Customer records with VAT and contact details.
6. **suppliers** — Supplier records with VAT and contact details.
7. **invoices** — Sales invoices with SA 15% VAT, invoice number, status.
8. **invoice_items** — Invoice line items.
9. **employees** — Employee records with SA-specific fields (ID number, tax number, pay frequency, salary, banking).
10. **payslips** — Payslip records with PAYE, UIF, SDL, COIDA, medical aid, pension, net pay.
11. **payslip_earnings** — Individual earnings/deductions line items per payslip.
12. **api_keys** — API key management for external API access.

## Security
- RLS enabled on all tables.
- All tables scoped to authenticated users via user_id.
- Owner columns default to auth.uid().

## Notes
1. VAT rate is 15% (South African standard rate).
2. PAYE, UIF (1%), SDL (1%), and COIDA are calculated per SA legislation.
3. All monetary amounts use numeric(15,2) for precision.
4. Journal entries enforce double-entry (debits = credits) via application logic.
*/

-- ============ COMPANIES ============
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  registration_number text,
  vat_number text,
  paye_number text,
  uif_reference text,
  sdl_reference text,
  coida_number text,
  sic_code text,
  address_line1 text,
  address_line2 text,
  city text,
  postal_code text,
  province text,
  phone text,
  email text,
  bank_name text,
  bank_account_number text,
  bank_branch_code text,
  vat_rate numeric(5,2) NOT NULL DEFAULT 15.00,
  financial_year_start date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_companies" ON companies;
CREATE POLICY "select_own_companies" ON companies FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_companies" ON companies;
CREATE POLICY "insert_own_companies" ON companies FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_companies" ON companies;
CREATE POLICY "update_own_companies" ON companies FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_companies" ON companies;
CREATE POLICY "delete_own_companies" ON companies FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ ACCOUNTS (Chart of Accounts) ============
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  subtype text,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  opening_balance numeric(15,2) NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_accounts" ON accounts;
CREATE POLICY "select_own_accounts" ON accounts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_accounts" ON accounts;
CREATE POLICY "insert_own_accounts" ON accounts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_accounts" ON accounts;
CREATE POLICY "update_own_accounts" ON accounts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_accounts" ON accounts;
CREATE POLICY "delete_own_accounts" ON accounts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ JOURNAL ENTRIES ============
CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  reference text,
  description text NOT NULL,
  period_month integer NOT NULL,
  period_year integer NOT NULL,
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'reversed')),
  source text DEFAULT 'manual' CHECK (source IN ('manual', 'invoice', 'payroll', 'opening_balance')),
  source_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_journal_entries" ON journal_entries;
CREATE POLICY "select_own_journal_entries" ON journal_entries FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_journal_entries" ON journal_entries;
CREATE POLICY "insert_own_journal_entries" ON journal_entries FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_journal_entries" ON journal_entries;
CREATE POLICY "update_own_journal_entries" ON journal_entries FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_journal_entries" ON journal_entries;
CREATE POLICY "delete_own_journal_entries" ON journal_entries FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ JOURNAL LINES ============
CREATE TABLE IF NOT EXISTS journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  debit numeric(15,2) NOT NULL DEFAULT 0,
  credit numeric(15,2) NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_journal_lines" ON journal_lines;
CREATE POLICY "select_own_journal_lines" ON journal_lines FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_journal_lines" ON journal_lines;
CREATE POLICY "insert_own_journal_lines" ON journal_lines FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_journal_lines" ON journal_lines;
CREATE POLICY "update_own_journal_lines" ON journal_lines FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_journal_lines" ON journal_lines;
CREATE POLICY "delete_own_journal_lines" ON journal_lines FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ CUSTOMERS ============
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  vat_number text,
  registration_number text,
  address_line1 text,
  address_line2 text,
  city text,
  postal_code text,
  province text,
  contact_person text,
  credit_limit numeric(15,2) DEFAULT 0,
  opening_balance numeric(15,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_customers" ON customers;
CREATE POLICY "select_own_customers" ON customers FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_customers" ON customers;
CREATE POLICY "insert_own_customers" ON customers FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_customers" ON customers;
CREATE POLICY "update_own_customers" ON customers FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_customers" ON customers;
CREATE POLICY "delete_own_customers" ON customers FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ SUPPLIERS ============
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  vat_number text,
  registration_number text,
  address_line1 text,
  address_line2 text,
  city text,
  postal_code text,
  province text,
  contact_person text,
  bank_name text,
  bank_account_number text,
  bank_branch_code text,
  opening_balance numeric(15,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_suppliers" ON suppliers;
CREATE POLICY "select_own_suppliers" ON suppliers FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_suppliers" ON suppliers;
CREATE POLICY "insert_own_suppliers" ON suppliers FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_suppliers" ON suppliers;
CREATE POLICY "update_own_suppliers" ON suppliers FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_suppliers" ON suppliers;
CREATE POLICY "delete_own_suppliers" ON suppliers FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ INVOICES ============
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  invoice_date date NOT NULL,
  due_date date NOT NULL,
  subtotal numeric(15,2) NOT NULL DEFAULT 0,
  vat_amount numeric(15,2) NOT NULL DEFAULT 0,
  total numeric(15,2) NOT NULL DEFAULT 0,
  amount_paid numeric(15,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partial', 'overdue', 'void')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_invoices" ON invoices;
CREATE POLICY "select_own_invoices" ON invoices FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_invoices" ON invoices;
CREATE POLICY "insert_own_invoices" ON invoices FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_invoices" ON invoices;
CREATE POLICY "update_own_invoices" ON invoices FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_invoices" ON invoices;
CREATE POLICY "delete_own_invoices" ON invoices FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ INVOICE ITEMS ============
CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(15,2) NOT NULL DEFAULT 0,
  vat_rate numeric(5,2) NOT NULL DEFAULT 15.00,
  line_total numeric(15,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_invoice_items" ON invoice_items;
CREATE POLICY "select_own_invoice_items" ON invoice_items FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_invoice_items" ON invoice_items;
CREATE POLICY "insert_own_invoice_items" ON invoice_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_invoice_items" ON invoice_items;
CREATE POLICY "update_own_invoice_items" ON invoice_items FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_invoice_items" ON invoice_items;
CREATE POLICY "delete_own_invoice_items" ON invoice_items FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ EMPLOYEES ============
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  id_number text,
  tax_number text,
  email text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  postal_code text,
  province text,
  position text,
  department text,
  employment_type text NOT NULL DEFAULT 'permanent' CHECK (employment_type IN ('permanent', 'contract', 'casual', 'probation')),
  pay_frequency text NOT NULL DEFAULT 'monthly' CHECK (pay_frequency IN ('weekly', 'fortnightly', 'monthly')),
  basic_salary numeric(15,2) NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  bank_name text,
  bank_account_number text,
  bank_account_type text,
  bank_branch_code text,
  medical_aid numeric(15,2) NOT NULL DEFAULT 0,
  pension numeric(15,2) NOT NULL DEFAULT 0,
  provident_fund numeric(15,2) NOT NULL DEFAULT 0,
  tax_rebate numeric(15,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_employees" ON employees;
CREATE POLICY "select_own_employees" ON employees FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_employees" ON employees;
CREATE POLICY "insert_own_employees" ON employees FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_employees" ON employees;
CREATE POLICY "update_own_employees" ON employees FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_employees" ON employees;
CREATE POLICY "delete_own_employees" ON employees FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ PAYSLIPS ============
CREATE TABLE IF NOT EXISTS payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  pay_period_month integer NOT NULL,
  pay_period_year integer NOT NULL,
  pay_date date NOT NULL,
  basic_pay numeric(15,2) NOT NULL DEFAULT 0,
  overtime numeric(15,2) NOT NULL DEFAULT 0,
  bonuses numeric(15,2) NOT NULL DEFAULT 0,
  allowances numeric(15,2) NOT NULL DEFAULT 0,
  gross_pay numeric(15,2) NOT NULL DEFAULT 0,
  paye numeric(15,2) NOT NULL DEFAULT 0,
  uif numeric(15,2) NOT NULL DEFAULT 0,
  sdl numeric(15,2) NOT NULL DEFAULT 0,
  medical_aid numeric(15,2) NOT NULL DEFAULT 0,
  pension numeric(15,2) NOT NULL DEFAULT 0,
  provident_fund numeric(15,2) NOT NULL DEFAULT 0,
  other_deductions numeric(15,2) NOT NULL DEFAULT 0,
  total_deductions numeric(15,2) NOT NULL DEFAULT 0,
  net_pay numeric(15,2) NOT NULL DEFAULT 0,
  company_uif numeric(15,2) NOT NULL DEFAULT 0,
  company_sdl numeric(15,2) NOT NULL DEFAULT 0,
  company_coida numeric(15,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid', 'reversed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_payslips" ON payslips;
CREATE POLICY "select_own_payslips" ON payslips FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_payslips" ON payslips;
CREATE POLICY "insert_own_payslips" ON payslips FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_payslips" ON payslips;
CREATE POLICY "update_own_payslips" ON payslips FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_payslips" ON payslips;
CREATE POLICY "delete_own_payslips" ON payslips FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ PAYSLIP EARNINGS / DEDUCTIONS ============
CREATE TABLE IF NOT EXISTS payslip_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  payslip_id uuid NOT NULL REFERENCES payslips(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('earning', 'deduction')),
  description text NOT NULL,
  amount numeric(15,2) NOT NULL DEFAULT 0,
  is_taxable boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payslip_earnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_payslip_earnings" ON payslip_earnings;
CREATE POLICY "select_own_payslip_earnings" ON payslip_earnings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_payslip_earnings" ON payslip_earnings;
CREATE POLICY "insert_own_payslip_earnings" ON payslip_earnings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_payslip_earnings" ON payslip_earnings;
CREATE POLICY "update_own_payslip_earnings" ON payslip_earnings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_payslip_earnings" ON payslip_earnings;
CREATE POLICY "delete_own_payslip_earnings" ON payslip_earnings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ API KEYS ============
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  key_name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '["read"]'::jsonb,
  last_used_at timestamptz,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_api_keys" ON api_keys;
CREATE POLICY "select_own_api_keys" ON api_keys FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_api_keys" ON api_keys;
CREATE POLICY "insert_own_api_keys" ON api_keys FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_api_keys" ON api_keys;
CREATE POLICY "update_own_api_keys" ON api_keys FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_api_keys" ON api_keys;
CREATE POLICY "delete_own_api_keys" ON api_keys FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_code ON accounts(user_id, code);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date ON journal_entries(user_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry_id ON journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account_id ON journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_date ON invoices(user_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_payslips_user_period ON payslips(user_id, pay_period_year, pay_period_month);
CREATE INDEX IF NOT EXISTS idx_payslips_employee_id ON payslips(employee_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);