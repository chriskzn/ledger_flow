import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { SA_PROVINCES } from '@/lib/saTax';
import { Building2, ChevronRight, FileText, Landmark, Receipt } from 'lucide-react';

export default function CompanySetup({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    registration_number: '',
    vat_number: '',
    paye_number: '',
    uif_reference: '',
    sdl_reference: '',
    coida_number: '',
    sic_code: '',
    address_line1: '',
    address_line2: '',
    city: '',
    postal_code: '',
    province: '',
    phone: '',
    email: '',
    bank_name: '',
    bank_account_number: '',
    bank_branch_code: '',
    financial_year_start: '',
  });

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const steps = [
    { title: 'Company Details', icon: Building2, fields: ['name', 'registration_number', 'vat_number'] },
    { title: 'SARS Compliance', icon: FileText, fields: ['paye_number', 'uif_reference', 'sdl_reference', 'coida_number', 'sic_code'] },
    { title: 'Address & Contact', icon: Landmark, fields: ['address_line1', 'address_line2', 'city', 'postal_code', 'province', 'phone', 'email'] },
    { title: 'Banking & Financial', icon: Receipt, fields: ['bank_name', 'bank_account_number', 'bank_branch_code', 'financial_year_start'] },
  ];

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { data: existing } = await supabase.from('companies').select('id').maybeSingle();

    const payload = {
      ...form,
      vat_rate: 15.0,
      financial_year_start: form.financial_year_start || null,
    };

    if (existing) {
      const { error: err } = await supabase.from('companies').update(payload).eq('id', existing.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('companies').insert(payload);
      if (err) { setError(err.message); setSaving(false); return; }
    }

    // Seed default chart of accounts if not present
    const { data: accounts } = await supabase.from('accounts').select('id').limit(1);
    if (!accounts || accounts.length === 0) {
      await seedDefaultAccounts();
    }

    setSaving(false);
    onDone();
  };

  const seedDefaultAccounts = async () => {
    const defaultAccounts = [
      // Assets
      { code: '1000', name: 'Bank / Cash', type: 'asset', subtype: 'current' },
      { code: '1100', name: 'Accounts Receivable', type: 'asset', subtype: 'current' },
      { code: '1200', name: 'Inventory', type: 'asset', subtype: 'current' },
      { code: '1300', name: 'VAT Input', type: 'asset', subtype: 'current' },
      { code: '1500', name: 'Property, Plant & Equipment', type: 'asset', subtype: 'non-current' },
      { code: '1600', name: 'Accumulated Depreciation', type: 'asset', subtype: 'non-current' },
      // Liabilities
      { code: '2100', name: 'Accounts Payable', type: 'liability', subtype: 'current' },
      { code: '2200', name: 'VAT Output', type: 'liability', subtype: 'current' },
      { code: '2300', name: 'PAYE Payable', type: 'liability', subtype: 'current' },
      { code: '2310', name: 'UIF Payable', type: 'liability', subtype: 'current' },
      { code: '2320', name: 'SDL Payable', type: 'liability', subtype: 'current' },
      { code: '2400', name: 'Wages Payable', type: 'liability', subtype: 'current' },
      { code: '2500', name: 'COIDA Payable', type: 'liability', subtype: 'current' },
      { code: '2600', name: 'Long-term Loans', type: 'liability', subtype: 'non-current' },
      // Equity
      { code: '3000', name: 'Owners Equity', type: 'equity', subtype: null },
      { code: '3100', name: 'Retained Earnings', type: 'equity', subtype: null },
      { code: '3200', name: 'Drawings', type: 'equity', subtype: null },
      // Income
      { code: '4000', name: 'Sales Revenue', type: 'income', subtype: null },
      { code: '4100', name: 'Service Revenue', type: 'income', subtype: null },
      { code: '4200', name: 'Interest Income', type: 'income', subtype: null },
      // Expenses
      { code: '5000', name: 'Cost of Sales', type: 'expense', subtype: null },
      { code: '5100', name: 'Salaries & Wages', type: 'expense', subtype: null },
      { code: '5110', name: 'PAYE Expense', type: 'expense', subtype: null },
      { code: '5120', name: 'UIF Expense', type: 'expense', subtype: null },
      { code: '5130', name: 'SDL Expense', type: 'expense', subtype: null },
      { code: '5140', name: 'COIDA Expense', type: 'expense', subtype: null },
      { code: '5200', name: 'Rent Expense', type: 'expense', subtype: null },
      { code: '5300', name: 'Electricity & Water', type: 'expense', subtype: null },
      { code: '5400', name: 'Telephone & Internet', type: 'expense', subtype: null },
      { code: '5500', name: 'Office Supplies', type: 'expense', subtype: null },
      { code: '5600', name: 'Depreciation', type: 'expense', subtype: null },
      { code: '5700', name: 'Bank Charges', type: 'expense', subtype: null },
      { code: '5800', name: 'Professional Fees', type: 'expense', subtype: null },
      { code: '5900', name: 'Repairs & Maintenance', type: 'expense', subtype: null },
    ];

    const rows = defaultAccounts.map((a) => ({
      ...a,
      is_system: true,
      is_active: true,
      opening_balance: 0,
    }));

    await supabase.from('accounts').insert(rows);
  };

  const isLastStep = step === steps.length - 1;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500 shadow-lg shadow-blue-500/30 mb-4">
            <Building2 className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Set Up Your Company</h1>
          <p className="text-slate-400">Configure your business profile for SARS compliance</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-between mb-8 px-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
                i <= step ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-500'
              }`}>
                <s.icon className="w-5 h-5" />
              </div>
              {i < steps.length - 1 && (
                <div className={`h-0.5 flex-1 mx-2 transition ${i < step ? 'bg-blue-500' : 'bg-slate-800'}`} />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
          <h2 className="text-xl font-semibold text-white mb-1">{steps[step].title}</h2>
          <p className="text-sm text-slate-500 mb-6">Step {step + 1} of {steps.length}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {step === 0 && (
              <>
                <Field label="Company Name" required value={form.name} onChange={(v) => update('name', v)} placeholder="Acme Pty Ltd" full />
                <Field label="Registration Number (CIPC)" value={form.registration_number} onChange={(v) => update('registration_number', v)} placeholder="2018/123456/07" />
                <Field label="VAT Number" value={form.vat_number} onChange={(v) => update('vat_number', v)} placeholder="4123456789" />
              </>
            )}
            {step === 1 && (
              <>
                <Field label="PAYE Number" value={form.paye_number} onChange={(v) => update('paye_number', v)} placeholder="712345678" />
                <Field label="UIF Reference" value={form.uif_reference} onChange={(v) => update('uif_reference', v)} placeholder="123456789" />
                <Field label="SDL Reference" value={form.sdl_reference} onChange={(v) => update('sdl_reference', v)} placeholder="123456789" />
                <Field label="COIDA Number" value={form.coida_number} onChange={(v) => update('coida_number', v)} placeholder="990123456" />
                <Field label="SIC Code" value={form.sic_code} onChange={(v) => update('sic_code', v)} placeholder="62010" />
              </>
            )}
            {step === 2 && (
              <>
                <Field label="Address Line 1" value={form.address_line1} onChange={(v) => update('address_line1', v)} placeholder="123 Main Street" full />
                <Field label="Address Line 2" value={form.address_line2} onChange={(v) => update('address_line2', v)} placeholder="Suite 100" full />
                <Field label="City" value={form.city} onChange={(v) => update('city', v)} placeholder="Johannesburg" />
                <Field label="Postal Code" value={form.postal_code} onChange={(v) => update('postal_code', v)} placeholder="2000" />
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Province</label>
                  <select
                    value={form.province}
                    onChange={(e) => update('province', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                  >
                    <option value="">Select province…</option>
                    {SA_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <Field label="Phone" value={form.phone} onChange={(v) => update('phone', v)} placeholder="011 123 4567" />
                <Field label="Email" value={form.email} onChange={(v) => update('email', v)} placeholder="info@acme.co.za" full />
              </>
            )}
            {step === 3 && (
              <>
                <Field label="Bank Name" value={form.bank_name} onChange={(v) => update('bank_name', v)} placeholder="FNB" />
                <Field label="Account Number" value={form.bank_account_number} onChange={(v) => update('bank_account_number', v)} placeholder="6789012345" />
                <Field label="Branch Code" value={form.bank_branch_code} onChange={(v) => update('bank_branch_code', v)} placeholder="250655" />
                <Field label="Financial Year Start" type="date" value={form.financial_year_start} onChange={(v) => update('financial_year_start', v)} />
              </>
            )}
          </div>

          {error && <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{error}</div>}

          <div className="flex items-center justify-between mt-8">
            {step > 0 ? (
              <button type="button" onClick={() => setStep(step - 1)} className="text-slate-400 hover:text-white transition text-sm font-medium">
                Back
              </button>
            ) : <span />}

            {!isLastStep ? (
              <button type="button" onClick={() => setStep(step + 1)} disabled={!form.name}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white font-semibold px-6 py-2.5 rounded-lg transition">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button type="submit" disabled={saving || !form.name}
                className="bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white font-semibold px-6 py-2.5 rounded-lg transition">
                {saving ? 'Saving…' : 'Complete Setup'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', required, full }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; required?: boolean; full?: boolean;
}) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="block text-sm font-medium text-slate-300 mb-2">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
      />
    </div>
  );
}
