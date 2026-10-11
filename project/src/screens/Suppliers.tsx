import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Button, Input, Modal, EmptyState } from '@/components/ui';
import { formatZAR } from '@/lib/format';
import { SA_PROVINCES } from '@/lib/saTax';
import type { Supplier } from '@/types';
import { Plus, Pencil, Trash2, Inbox, Briefcase, Mail, Phone } from 'lucide-react';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  const emptyForm = {
    name: '', email: '', phone: '', vat_number: '', registration_number: '',
    address_line1: '', address_line2: '', city: '', postal_code: '', province: '',
    contact_person: '', bank_name: '', bank_account_number: '', bank_branch_code: '', opening_balance: '0',
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadSuppliers(); }, []);

  const loadSuppliers = async () => {
    setLoading(true);
    const { data } = await supabase.from('suppliers').select('*').order('name');
    setSuppliers((data as Supplier[]) || []);
    setLoading(false);
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({
      name: s.name, email: s.email || '', phone: s.phone || '', vat_number: s.vat_number || '',
      registration_number: s.registration_number || '', address_line1: s.address_line1 || '',
      address_line2: s.address_line2 || '', city: s.city || '', postal_code: s.postal_code || '',
      province: s.province || '', contact_person: s.contact_person || '',
      bank_name: s.bank_name || '', bank_account_number: s.bank_account_number || '',
      bank_branch_code: s.bank_branch_code || '', opening_balance: String(s.opening_balance),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const payload = {
      name: form.name, email: form.email || null, phone: form.phone || null,
      vat_number: form.vat_number || null, registration_number: form.registration_number || null,
      address_line1: form.address_line1 || null, address_line2: form.address_line2 || null,
      city: form.city || null, postal_code: form.postal_code || null, province: form.province || null,
      contact_person: form.contact_person || null, bank_name: form.bank_name || null,
      bank_account_number: form.bank_account_number || null, bank_branch_code: form.bank_branch_code || null,
      opening_balance: parseFloat(form.opening_balance) || 0,
    };
    if (editing) {
      await supabase.from('suppliers').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('suppliers').insert(payload);
    }
    setShowModal(false);
    loadSuppliers();
  };

  const handleDelete = async (s: Supplier) => {
    if (!confirm(`Delete supplier "${s.name}"?`)) return;
    await supabase.from('suppliers').delete().eq('id', s.id);
    loadSuppliers();
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Suppliers</h2>
          <p className="text-sm text-slate-400 mt-0.5">{suppliers.length} suppliers</p>
        </div>
        <Button onClick={openCreate}><span className="flex items-center gap-2"><Plus className="w-4 h-4" /> New Supplier</span></Button>
      </div>

      {suppliers.length === 0 ? (
        <Card><EmptyState icon={Inbox} title="No suppliers yet" message="Add your first supplier to track accounts payable." action={<Button onClick={openCreate}>Add Supplier</Button>} /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((s) => (
            <Card key={s.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Briefcase className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{s.name}</p>
                    {s.vat_number && <p className="text-xs text-slate-500">VAT: {s.vat_number}</p>}
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${s.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-500'}`}>
                  {s.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="space-y-1.5 text-sm">
                {s.email && <p className="text-slate-400 flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> {s.email}</p>}
                {s.phone && <p className="text-slate-400 flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {s.phone}</p>}
                {s.bank_name && <p className="text-slate-400 text-xs">Bank: {s.bank_name}</p>}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">Opening Balance</p>
                  <p className="text-sm font-semibold text-white">{formatZAR(s.opening_balance)}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(s)} className="p-2 text-slate-400 hover:text-blue-400 transition">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(s)} className="p-2 text-slate-400 hover:text-red-400 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? 'Edit Supplier' : 'New Supplier'} onClose={() => setShowModal(false)} wide>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required full />
            <Input label="Contact Person" value={form.contact_person} onChange={(v) => setForm({ ...form, contact_person: v })} />
            <Input label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <Input label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <Input label="VAT Number" value={form.vat_number} onChange={(v) => setForm({ ...form, vat_number: v })} />
            <Input label="Registration Number" value={form.registration_number} onChange={(v) => setForm({ ...form, registration_number: v })} />
            <Input label="Address Line 1" value={form.address_line1} onChange={(v) => setForm({ ...form, address_line1: v })} full />
            <Input label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
            <Input label="Postal Code" value={form.postal_code} onChange={(v) => setForm({ ...form, postal_code: v })} />
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Province</label>
              <select value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 outline-none">
                <option value="">Select…</option>
                {SA_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <Input label="Bank Name" value={form.bank_name} onChange={(v) => setForm({ ...form, bank_name: v })} />
            <Input label="Bank Account Number" value={form.bank_account_number} onChange={(v) => setForm({ ...form, bank_account_number: v })} />
            <Input label="Branch Code" value={form.bank_branch_code} onChange={(v) => setForm({ ...form, bank_branch_code: v })} />
            <Input label="Opening Balance (ZAR)" type="number" value={form.opening_balance} onChange={(v) => setForm({ ...form, opening_balance: v })} />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
