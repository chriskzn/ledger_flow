import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Button, Input, Modal, EmptyState } from '@/components/ui';
import { formatZAR } from '@/lib/format';
import type { Account, AccountType } from '@/types';
import { BookOpen, Plus, Pencil, Trash2, Inbox } from 'lucide-react';

const TYPE_LABELS: Record<AccountType, string> = {
  asset: 'Asset', liability: 'Liability', equity: 'Equity', income: 'Income', expense: 'Expense',
};
const TYPE_COLORS: Record<AccountType, string> = {
  asset: 'text-blue-400 bg-blue-500/10', liability: 'text-amber-400 bg-amber-500/10',
  equity: 'text-purple-400 bg-purple-500/10', income: 'text-emerald-400 bg-emerald-500/10',
  expense: 'text-red-400 bg-red-500/10',
};

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const [form, setForm] = useState({
    code: '', name: '', type: 'asset' as AccountType, subtype: '', opening_balance: '0', description: '',
  });

  useEffect(() => { loadAccounts(); }, []);

  const loadAccounts = async () => {
    setLoading(true);
    const { data } = await supabase.from('accounts').select('*').order('code');
    setAccounts((data as Account[]) || []);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ code: '', name: '', type: 'asset', subtype: '', opening_balance: '0', description: '' });
    setShowModal(true);
  };

  const openEdit = (acc: Account) => {
    setEditing(acc);
    setForm({
      code: acc.code, name: acc.name, type: acc.type, subtype: acc.subtype || '',
      opening_balance: String(acc.opening_balance), description: acc.description || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const payload = {
      code: form.code,
      name: form.name,
      type: form.type,
      subtype: form.subtype || null,
      opening_balance: parseFloat(form.opening_balance) || 0,
      description: form.description || null,
    };

    if (editing) {
      await supabase.from('accounts').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('accounts').insert(payload);
    }
    setShowModal(false);
    loadAccounts();
  };

  const handleDelete = async (acc: Account) => {
    if (acc.is_system) return;
    if (!confirm(`Delete account "${acc.name}"? This cannot be undone.`)) return;
    await supabase.from('accounts').delete().eq('id', acc.id);
    loadAccounts();
  };

  const filtered = filter === 'all' ? accounts : accounts.filter((a) => a.type === filter);

  const grouped: Record<string, Account[]> = {};
  filtered.forEach((a) => {
    if (!grouped[a.type]) grouped[a.type] = [];
    grouped[a.type].push(a);
  });

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Chart of Accounts</h2>
          <p className="text-sm text-slate-400 mt-0.5">{accounts.length} accounts · Double-entry bookkeeping</p>
        </div>
        <Button onClick={openCreate}><span className="flex items-center gap-2"><Plus className="w-4 h-4" /> New Account</span></Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'asset', 'liability', 'equity', 'income', 'expense'].map((t) => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === t ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}>
            {t === 'all' ? 'All' : TYPE_LABELS[t as AccountType]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={Inbox} title="No accounts found" message="Create your first account to start recording transactions." action={<Button onClick={openCreate}>Create Account</Button>} /></Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([type, accs]) => (
            <div key={type}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">{TYPE_LABELS[type as AccountType]}</h3>
                <span className="text-xs text-slate-600">({accs.length})</span>
              </div>
              <Card className="overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800 text-left">
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">Code</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden sm:table-cell">Subtype</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase text-right">Opening Bal.</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {accs.map((acc) => (
                      <tr key={acc.id} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 transition">
                        <td className="px-4 py-3 text-sm text-slate-300 font-mono">{acc.code}</td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-white font-medium">{acc.name}</span>
                          {acc.is_system && <span className="ml-2 text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">System</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-400 hidden sm:table-cell">{acc.subtype || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-300 text-right font-mono">{formatZAR(acc.opening_balance)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => openEdit(acc)} className="p-1.5 text-slate-400 hover:text-blue-400 transition">
                              <Pencil className="w-4 h-4" />
                            </button>
                            {!acc.is_system && (
                              <button onClick={() => handleDelete(acc)} className="p-1.5 text-slate-400 hover:text-red-400 transition">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? 'Edit Account' : 'New Account'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Account Code" value={form.code} onChange={(v) => setForm({ ...form, code: v })} placeholder="1000" required />
              <Input label="Account Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Bank Account" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Account Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AccountType })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition">
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <Input label="Subtype" value={form.subtype} onChange={(v) => setForm({ ...form, subtype: v })} placeholder="current / non-current" />
            </div>
            <Input label="Opening Balance (ZAR)" type="number" value={form.opening_balance} onChange={(v) => setForm({ ...form, opening_balance: v })} />
            <Input label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} full />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!form.code || !form.name}>{editing ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
