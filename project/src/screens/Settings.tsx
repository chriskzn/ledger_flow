import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Button, Input } from '@/components/ui';
import { SA_PROVINCES } from '@/lib/saTax';
import type { Company } from '@/types';
import { Settings as SettingsIcon, Building2, Save, Check } from 'lucide-react';

export default function Settings() {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => { loadCompany(); }, []);

  const loadCompany = async () => {
    setLoading(true);
    const { data } = await supabase.from('companies').select('*').maybeSingle();
    const c = data as Company | null;
    setCompany(c);
    if (c) {
      setForm({
        name: c.name, registration_number: c.registration_number || '', vat_number: c.vat_number || '',
        paye_number: c.paye_number || '', uif_reference: c.uif_reference || '', sdl_reference: c.sdl_reference || '',
        coida_number: c.coida_number || '', sic_code: c.sic_code || '',
        address_line1: c.address_line1 || '', address_line2: c.address_line2 || '',
        city: c.city || '', postal_code: c.postal_code || '', province: c.province || '',
        phone: c.phone || '', email: c.email || '',
        bank_name: c.bank_name || '', bank_account_number: c.bank_account_number || '',
        bank_branch_code: c.bank_branch_code || '',
        vat_rate: String(c.vat_rate),
        financial_year_start: c.financial_year_start || '',
      });
    }
    setLoading(false);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setSaving(true);
    setSaved(false);

    const payload = {
      name: form.name, registration_number: form.registration_number || null,
      vat_number: form.vat_number || null, paye_number: form.paye_number || null,
      uif_reference: form.uif_reference || null, sdl_reference: form.sdl_reference || null,
      coida_number: form.coida_number || null, sic_code: form.sic_code || null,
      address_line1: form.address_line1 || null, address_line2: form.address_line2 || null,
      city: form.city || null, postal_code: form.postal_code || null, province: form.province || null,
      phone: form.phone || null, email: form.email || null,
      bank_name: form.bank_name || null, bank_account_number: form.bank_account_number || null,
      bank_branch_code: form.bank_branch_code || null,
      vat_rate: parseFloat(form.vat_rate) || 15,
      financial_year_start: form.financial_year_start || null,
      updated_at: new Date().toISOString(),
    };

    await supabase.from('companies').update(payload).eq('id', company.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Company Settings</h2>
        <p className="text-sm text-slate-400 mt-0.5">Manage your business profile and SARS registration details</p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Company details */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">Company Details</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Company Name" value={form.name || ''} onChange={(v) => setForm({ ...form, name: v })} required full />
            <Input label="Registration Number (CIPC)" value={form.registration_number || ''} onChange={(v) => setForm({ ...form, registration_number: v })} />
            <Input label="VAT Number" value={form.vat_number || ''} onChange={(v) => setForm({ ...form, vat_number: v })} />
            <Input label="VAT Rate (%)" type="number" value={form.vat_rate || '15'} onChange={(v) => setForm({ ...form, vat_rate: v })} />
            <Input label="SIC Code" value={form.sic_code || ''} onChange={(v) => setForm({ ...form, sic_code: v })} />
            <Input label="Financial Year Start" type="date" value={form.financial_year_start || ''} onChange={(v) => setForm({ ...form, financial_year_start: v })} />
          </div>
        </Card>

        {/* SARS compliance */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-amber-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">SARS Compliance Numbers</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="PAYE Number" value={form.paye_number || ''} onChange={(v) => setForm({ ...form, paye_number: v })} />
            <Input label="UIF Reference" value={form.uif_reference || ''} onChange={(v) => setForm({ ...form, uif_reference: v })} />
            <Input label="SDL Reference" value={form.sdl_reference || ''} onChange={(v) => setForm({ ...form, sdl_reference: v })} />
            <Input label="COIDA Number" value={form.coida_number || ''} onChange={(v) => setForm({ ...form, coida_number: v })} />
          </div>
        </Card>

        {/* Address */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-white mb-5">Address & Contact</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Address Line 1" value={form.address_line1 || ''} onChange={(v) => setForm({ ...form, address_line1: v })} full />
            <Input label="Address Line 2" value={form.address_line2 || ''} onChange={(v) => setForm({ ...form, address_line2: v })} full />
            <Input label="City" value={form.city || ''} onChange={(v) => setForm({ ...form, city: v })} />
            <Input label="Postal Code" value={form.postal_code || ''} onChange={(v) => setForm({ ...form, postal_code: v })} />
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Province</label>
              <select value={form.province || ''} onChange={(e) => setForm({ ...form, province: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 outline-none">
                <option value="">Select…</option>
                {SA_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <Input label="Phone" value={form.phone || ''} onChange={(v) => setForm({ ...form, phone: v })} />
            <Input label="Email" type="email" value={form.email || ''} onChange={(v) => setForm({ ...form, email: v })} full />
          </div>
        </Card>

        {/* Banking */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-white mb-5">Banking Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Bank Name" value={form.bank_name || ''} onChange={(v) => setForm({ ...form, bank_name: v })} />
            <Input label="Account Number" value={form.bank_account_number || ''} onChange={(v) => setForm({ ...form, bank_account_number: v })} />
            <Input label="Branch Code" value={form.bank_branch_code || ''} onChange={(v) => setForm({ ...form, bank_branch_code: v })} />
          </div>
        </Card>

        {/* Save button */}
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-emerald-400 flex items-center gap-1"><Check className="w-4 h-4" /> Saved successfully</span>}
          <Button type="submit" disabled={saving || !form.name}>
            <span className="flex items-center gap-2"><Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Changes'}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
