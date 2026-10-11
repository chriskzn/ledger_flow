import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Button, Input, Modal, EmptyState } from '@/components/ui';
import { formatZAR, formatDate } from '@/lib/format';
import { SA_PROVINCES } from '@/lib/saTax';
import type { Customer, Invoice } from '@/types';
import { Plus, Pencil, Trash2, Inbox, UserCircle, Mail, Phone, FileText } from 'lucide-react';

export default function Customers() {
  const [customers, setCustomers] = useState<(Customer & { invoices?: Invoice[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [viewCustomer, setViewCustomer] = useState<(Customer & { invoices?: Invoice[] }) | null>(null);

  const emptyForm = {
    name: '', email: '', phone: '', vat_number: '', registration_number: '',
    address_line1: '', address_line2: '', city: '', postal_code: '', province: '',
    contact_person: '', credit_limit: '0', opening_balance: '0',
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadCustomers(); }, []);

  const loadCustomers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('customers')
      .select('*, invoices(id, total, amount_paid, status, invoice_date, invoice_number)')
      .order('name');
    setCustomers((data as any[]) || []);
    setLoading(false);
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      name: c.name, email: c.email || '', phone: c.phone || '', vat_number: c.vat_number || '',
      registration_number: c.registration_number || '', address_line1: c.address_line1 || '',
      address_line2: c.address_line2 || '', city: c.city || '', postal_code: c.postal_code || '',
      province: c.province || '', contact_person: c.contact_person || '',
      credit_limit: String(c.credit_limit), opening_balance: String(c.opening_balance),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const payload = {
      name: form.name, email: form.email || null, phone: form.phone || null,
      vat_number: form.vat_number || null, registration_number: form.registration_number || null,
      address_line1: form.address_line1 || null, address_line2: form.address_line2 || null,
      city: form.city || null, postal_code: form.postal_code || null, province: form.province || null,
      contact_person: form.contact_person || null,
      credit_limit: parseFloat(form.credit_limit) || 0, opening_balance: parseFloat(form.opening_balance) || 0,
    };
    if (editing) {
      await supabase.from('customers').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('customers').insert(payload);
    }
    setShowModal(false);
    loadCustomers();
  };

  const handleDelete = async (c: Customer) => {
    if (!confirm(`Delete customer "${c.name}"?`)) return;
    await supabase.from('customers').delete().eq('id', c.id);
    loadCustomers();
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Customers</h2>
          <p className="text-sm text-slate-400 mt-0.5">{customers.length} customers</p>
        </div>
        <Button onClick={openCreate}><span className="flex items-center gap-2"><Plus className="w-4 h-4" /> New Customer</span></Button>
      </div>

      {customers.length === 0 ? (
        <Card><EmptyState icon={Inbox} title="No customers yet" message="Add your first customer to start creating invoices." action={<Button onClick={openCreate}>Add Customer</Button>} /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((c) => {
            const outstanding = (c.invoices || []).reduce((s, inv) => s + (inv.total - inv.amount_paid), 0);
            return (
              <Card key={c.id} className="p-5 hover:border-slate-700 transition cursor-pointer" >
                <div onClick={() => setViewCustomer(c)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <UserCircle className="w-6 h-6 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{c.name}</p>
                        {c.vat_number && <p className="text-xs text-slate-500">VAT: {c.vat_number}</p>}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${c.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-500'}`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    {c.email && <p className="text-slate-400 flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> {c.email}</p>}
                    {c.phone && <p className="text-slate-400 flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {c.phone}</p>}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">Outstanding</p>
                      <p className="text-sm font-semibold text-white">{formatZAR(outstanding)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Invoices</p>
                      <p className="text-sm font-semibold text-white">{c.invoices?.length || 0}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-800">
                  <button onClick={() => openEdit(c)} className="flex-1 text-xs text-slate-400 hover:text-blue-400 flex items-center justify-center gap-1 py-1.5 rounded transition">
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => handleDelete(c)} className="flex-1 text-xs text-slate-400 hover:text-red-400 flex items-center justify-center gap-1 py-1.5 rounded transition">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit modal */}
      {showModal && (
        <Modal title={editing ? 'Edit Customer' : 'New Customer'} onClose={() => setShowModal(false)} wide>
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
            <Input label="Credit Limit (ZAR)" type="number" value={form.credit_limit} onChange={(v) => setForm({ ...form, credit_limit: v })} />
            <Input label="Opening Balance (ZAR)" type="number" value={form.opening_balance} onChange={(v) => setForm({ ...form, opening_balance: v })} />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        </Modal>
      )}

      {/* View modal */}
      {viewCustomer && (
        <Modal title={viewCustomer.name} subtitle="Customer details" onClose={() => setViewCustomer(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {viewCustomer.email && <div><span className="text-slate-500">Email:</span> <span className="text-white">{viewCustomer.email}</span></div>}
              {viewCustomer.phone && <div><span className="text-slate-500">Phone:</span> <span className="text-white">{viewCustomer.phone}</span></div>}
              {viewCustomer.vat_number && <div><span className="text-slate-500">VAT:</span> <span className="text-white">{viewCustomer.vat_number}</span></div>}
              {viewCustomer.contact_person && <div><span className="text-slate-500">Contact:</span> <span className="text-white">{viewCustomer.contact_person}</span></div>}
              {viewCustomer.city && <div className="col-span-2"><span className="text-slate-500">Address:</span> <span className="text-white">{[viewCustomer.address_line1, viewCustomer.city, viewCustomer.postal_code, viewCustomer.province].filter(Boolean).join(', ')}</span></div>}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2"><FileText className="w-4 h-4 text-blue-400" /> Invoices</h4>
              {(viewCustomer.invoices || []).length === 0 ? (
                <p className="text-sm text-slate-500">No invoices yet</p>
              ) : (
                <div className="border border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-800/50 border-b border-slate-800 text-left">
                        <th className="px-3 py-2 text-xs text-slate-500 uppercase">Invoice #</th>
                        <th className="px-3 py-2 text-xs text-slate-500 uppercase">Date</th>
                        <th className="px-3 py-2 text-xs text-slate-500 uppercase text-right">Total</th>
                        <th className="px-3 py-2 text-xs text-slate-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewCustomer.invoices || []).map((inv) => (
                        <tr key={inv.id} className="border-b border-slate-800/50 last:border-0">
                          <td className="px-3 py-2 text-sm text-white">{inv.invoice_number}</td>
                          <td className="px-3 py-2 text-sm text-slate-400">{formatDate(inv.invoice_date)}</td>
                          <td className="px-3 py-2 text-sm text-white text-right font-mono">{formatZAR(inv.total)}</td>
                          <td className="px-3 py-2"><span className="text-xs text-slate-400">{inv.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
