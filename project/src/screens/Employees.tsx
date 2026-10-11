import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Button, Input, Modal, EmptyState } from '@/components/ui';
import { formatZAR } from '@/lib/format';
import { SA_PROVINCES, getAgeFromIdNumber, getGenderFromIdNumber } from '@/lib/saTax';
import type { Employee, EmploymentType, PayFrequency } from '@/types';
import { Plus, Pencil, Trash2, Inbox, Users, Mail, Phone, IdCard } from 'lucide-react';

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  const emptyForm = {
    first_name: '', last_name: '', id_number: '', tax_number: '',
    email: '', phone: '', address_line1: '', address_line2: '',
    city: '', postal_code: '', province: '', position: '', department: '',
    employment_type: 'permanent' as EmploymentType, pay_frequency: 'monthly' as PayFrequency,
    basic_salary: '0', start_date: '', end_date: '',
    bank_name: '', bank_account_number: '', bank_account_type: '', bank_branch_code: '',
    medical_aid: '0', pension: '0', provident_fund: '0', tax_rebate: '0',
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadEmployees(); }, []);

  const loadEmployees = async () => {
    setLoading(true);
    const { data } = await supabase.from('employees').select('*').order('first_name');
    setEmployees((data as Employee[]) || []);
    setLoading(false);
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (e: Employee) => {
    setEditing(e);
    setForm({
      first_name: e.first_name, last_name: e.last_name, id_number: e.id_number || '',
      tax_number: e.tax_number || '', email: e.email || '', phone: e.phone || '',
      address_line1: e.address_line1 || '', address_line2: e.address_line2 || '',
      city: e.city || '', postal_code: e.postal_code || '', province: e.province || '',
      position: e.position || '', department: e.department || '',
      employment_type: e.employment_type, pay_frequency: e.pay_frequency,
      basic_salary: String(e.basic_salary), start_date: e.start_date || '', end_date: e.end_date || '',
      bank_name: e.bank_name || '', bank_account_number: e.bank_account_number || '',
      bank_account_type: e.bank_account_type || '', bank_branch_code: e.bank_branch_code || '',
      medical_aid: String(e.medical_aid), pension: String(e.pension),
      provident_fund: String(e.provident_fund), tax_rebate: String(e.tax_rebate),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const payload = {
      first_name: form.first_name, last_name: form.last_name,
      id_number: form.id_number || null, tax_number: form.tax_number || null,
      email: form.email || null, phone: form.phone || null,
      address_line1: form.address_line1 || null, address_line2: form.address_line2 || null,
      city: form.city || null, postal_code: form.postal_code || null, province: form.province || null,
      position: form.position || null, department: form.department || null,
      employment_type: form.employment_type, pay_frequency: form.pay_frequency,
      basic_salary: parseFloat(form.basic_salary) || 0,
      start_date: form.start_date || null, end_date: form.end_date || null,
      bank_name: form.bank_name || null, bank_account_number: form.bank_account_number || null,
      bank_account_type: form.bank_account_type || null, bank_branch_code: form.bank_branch_code || null,
      medical_aid: parseFloat(form.medical_aid) || 0, pension: parseFloat(form.pension) || 0,
      provident_fund: parseFloat(form.provident_fund) || 0, tax_rebate: parseFloat(form.tax_rebate) || 0,
    };
    if (editing) {
      await supabase.from('employees').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('employees').insert(payload);
    }
    setShowModal(false);
    loadEmployees();
  };

  const handleDelete = async (e: Employee) => {
    if (!confirm(`Delete employee "${e.first_name} ${e.last_name}"?`)) return;
    await supabase.from('employees').delete().eq('id', e.id);
    loadEmployees();
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Employees</h2>
          <p className="text-sm text-slate-400 mt-0.5">{employees.length} employees · {employees.filter((e) => e.is_active).length} active</p>
        </div>
        <Button onClick={openCreate}><span className="flex items-center gap-2"><Plus className="w-4 h-4" /> New Employee</span></Button>
      </div>

      {employees.length === 0 ? (
        <Card><EmptyState icon={Inbox} title="No employees yet" message="Add your first employee to start running payroll." action={<Button onClick={openCreate}>Add Employee</Button>} /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((e) => {
            const age = e.id_number ? getAgeFromIdNumber(e.id_number) : null;
            const gender = e.id_number ? getGenderFromIdNumber(e.id_number) : null;
            return (
              <Card key={e.id} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 font-semibold text-sm">
                      {e.first_name.charAt(0)}{e.last_name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-white font-medium">{e.first_name} {e.last_name}</p>
                      <p className="text-xs text-slate-500">{e.position || '—'}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${e.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-500'}`}>
                    {e.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="space-y-1.5 text-sm">
                  {e.id_number && <p className="text-slate-400 flex items-center gap-2"><IdCard className="w-3.5 h-3.5" /> {e.id_number} {age && `(${age}y)`} {gender && `· ${gender}`}</p>}
                  {e.email && <p className="text-slate-400 flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> {e.email}</p>}
                  {e.phone && <p className="text-slate-400 flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {e.phone}</p>}
                  {e.department && <p className="text-slate-400 text-xs">Dept: {e.department}</p>}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500">Basic Salary</p>
                    <p className="text-sm font-semibold text-white">{formatZAR(e.basic_salary)}/{e.pay_frequency === 'monthly' ? 'mo' : e.pay_frequency === 'fortnightly' ? '2wk' : 'wk'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(e)} className="p-2 text-slate-400 hover:text-blue-400 transition"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(e)} className="p-2 text-slate-400 hover:text-red-400 transition"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? 'Edit Employee' : 'New Employee'} onClose={() => setShowModal(false)} wide>
          <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Personal Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="First Name" value={form.first_name} onChange={(v) => setForm({ ...form, first_name: v })} required />
                <Input label="Last Name" value={form.last_name} onChange={(v) => setForm({ ...form, last_name: v })} required />
                <Input label="SA ID Number" value={form.id_number} onChange={(v) => setForm({ ...form, id_number: v })} placeholder="9001015000080" />
                <Input label="Tax Number" value={form.tax_number} onChange={(v) => setForm({ ...form, tax_number: v })} />
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Contact</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
                <Input label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                <Input label="Address" value={form.address_line1} onChange={(v) => setForm({ ...form, address_line1: v })} full />
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
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Employment</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Position" value={form.position} onChange={(v) => setForm({ ...form, position: v })} />
                <Input label="Department" value={form.department} onChange={(v) => setForm({ ...form, department: v })} />
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Employment Type</label>
                  <select value={form.employment_type} onChange={(e) => setForm({ ...form, employment_type: e.target.value as EmploymentType })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 outline-none">
                    <option value="permanent">Permanent</option>
                    <option value="contract">Contract</option>
                    <option value="casual">Casual</option>
                    <option value="probation">Probation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Pay Frequency</label>
                  <select value={form.pay_frequency} onChange={(e) => setForm({ ...form, pay_frequency: e.target.value as PayFrequency })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 outline-none">
                    <option value="monthly">Monthly</option>
                    <option value="fortnightly">Fortnightly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
                <Input label="Basic Salary (ZAR)" type="number" value={form.basic_salary} onChange={(v) => setForm({ ...form, basic_salary: v })} required />
                <Input label="Start Date" type="date" value={form.start_date} onChange={(v) => setForm({ ...form, start_date: v })} />
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Deductions</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Medical Aid (ZAR/mo)" type="number" value={form.medical_aid} onChange={(v) => setForm({ ...form, medical_aid: v })} />
                <Input label="Pension (ZAR/mo)" type="number" value={form.pension} onChange={(v) => setForm({ ...form, pension: v })} />
                <Input label="Provident Fund (ZAR/mo)" type="number" value={form.provident_fund} onChange={(v) => setForm({ ...form, provident_fund: v })} />
                <Input label="Tax Rebate (ZAR/mo)" type="number" value={form.tax_rebate} onChange={(v) => setForm({ ...form, tax_rebate: v })} />
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Banking</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Bank Name" value={form.bank_name} onChange={(v) => setForm({ ...form, bank_name: v })} />
                <Input label="Account Number" value={form.bank_account_number} onChange={(v) => setForm({ ...form, bank_account_number: v })} />
                <Input label="Account Type" value={form.bank_account_type} onChange={(v) => setForm({ ...form, bank_account_type: v })} />
                <Input label="Branch Code" value={form.bank_branch_code} onChange={(v) => setForm({ ...form, bank_branch_code: v })} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.first_name || !form.last_name}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
