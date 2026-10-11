export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'void';

export type PayslipStatus = 'draft' | 'approved' | 'paid' | 'reversed';

export type PayFrequency = 'weekly' | 'fortnightly' | 'monthly';

export type EmploymentType = 'permanent' | 'contract' | 'casual' | 'probation';

export interface Company {
  id: string;
  user_id: string;
  name: string;
  registration_number: string | null;
  vat_number: string | null;
  paye_number: string | null;
  uif_reference: string | null;
  sdl_reference: string | null;
  coida_number: string | null;
  sic_code: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  province: string | null;
  phone: string | null;
  email: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_branch_code: string | null;
  vat_rate: number;
  financial_year_start: string | null;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  code: string;
  name: string;
  type: AccountType;
  subtype: string | null;
  is_system: boolean;
  is_active: boolean;
  opening_balance: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  entry_date: string;
  reference: string | null;
  description: string;
  period_month: number;
  period_year: number;
  status: 'draft' | 'posted' | 'reversed';
  source: string;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalLine {
  id: string;
  user_id: string;
  journal_entry_id: string;
  account_id: string;
  debit: number;
  credit: number;
  description: string | null;
  created_at: string;
}

export interface JournalEntryWithLines extends JournalEntry {
  journal_lines?: (JournalLine & { account?: Account })[];
}

export interface Customer {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  vat_number: string | null;
  registration_number: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  province: string | null;
  contact_person: string | null;
  credit_limit: number;
  opening_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  vat_number: string | null;
  registration_number: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  province: string | null;
  contact_person: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_branch_code: string | null;
  opening_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  customer_id: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  vat_amount: number;
  total: number;
  amount_paid: number;
  status: InvoiceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  user_id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  line_total: number;
  created_at: string;
}

export interface InvoiceWithItems extends Invoice {
  customer?: Customer;
  invoice_items?: InvoiceItem[];
}

export interface Employee {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  id_number: string | null;
  tax_number: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  province: string | null;
  position: string | null;
  department: string | null;
  employment_type: EmploymentType;
  pay_frequency: PayFrequency;
  basic_salary: number;
  start_date: string | null;
  end_date: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_type: string | null;
  bank_branch_code: string | null;
  medical_aid: number;
  pension: number;
  provident_fund: number;
  tax_rebate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Payslip {
  id: string;
  user_id: string;
  employee_id: string;
  pay_period_month: number;
  pay_period_year: number;
  pay_date: string;
  basic_pay: number;
  overtime: number;
  bonuses: number;
  allowances: number;
  gross_pay: number;
  paye: number;
  uif: number;
  sdl: number;
  medical_aid: number;
  pension: number;
  provident_fund: number;
  other_deductions: number;
  total_deductions: number;
  net_pay: number;
  company_uif: number;
  company_sdl: number;
  company_coida: number;
  status: PayslipStatus;
  created_at: string;
  updated_at: string;
}

export interface PayslipWithEmployee extends Payslip {
  employee?: Pick<Employee, 'first_name' | 'last_name' | 'id_number' | 'tax_number' | 'position' | 'department'>;
}

export interface ApiKey {
  id: string;
  user_id: string;
  key_name: string;
  key_prefix: string;
  key_hash: string;
  permissions: string[];
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}
