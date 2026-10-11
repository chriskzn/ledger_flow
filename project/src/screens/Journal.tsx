import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Button, Input, Modal, EmptyState } from '@/components/ui';
import { formatZAR, formatDate } from '@/lib/format';
import type { Account, JournalEntry, JournalLine } from '@/types';
import { Plus, Receipt, Trash2, Inbox, X, Pencil } from 'lucide-react';

interface LineForm {
  account_id: string;
  debit: string;
  credit: string;
  description: string;
}

export default function Journal() {
  const [entries, setEntries] = useState<(JournalEntry & { journal_lines?: (JournalLine & { account?: Account })[] })[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [viewEntry, setViewEntry] = useState<(JournalEntry & { journal_lines?: (JournalLine & { account?: Account })[] }) | null>(null);

  const [header, setHeader] = useState({ date: new Date().toISOString().split('T')[0], reference: '', description: '' });
  const [lines, setLines] = useState<LineForm[]>([
    { account_id: '', debit: '', credit: '', description: '' },
    { account_id: '', debit: '', credit: '', description: '' },
  ]);

  useEffect(() => { loadEntries(); loadAccounts(); }, []);

  const loadEntries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('journal_entries')
      .select('*, journal_lines(*, account:accounts(*))')
      .order('entry_date', { ascending: false })
      .limit(50);
    setEntries((data as any[]) || []);
    setLoading(false);
  };

  const loadAccounts = async () => {
    const { data } = await supabase.from('accounts').select('*').eq('is_active', true).order('code');
    setAccounts((data as Account[]) || []);
  };

  const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const updateLine = (idx: number, field: keyof LineForm, value: string) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === 'debit' && value) updated[idx].credit = '';
    if (field === 'credit' && value) updated[idx].debit = '';
    setLines(updated);
  };

  const addLine = () => setLines([...lines, { account_id: '', debit: '', credit: '', description: '' }]);
  const removeLine = (idx: number) => setLines(lines.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!isBalanced || !header.description) return;
    const entryDate = new Date(header.date);
    const payload = {
      entry_date: header.date,
      reference: header.reference || null,
      description: header.description,
      period_month: entryDate.getMonth() + 1,
      period_year: entryDate.getFullYear(),
      status: 'posted',
      source: 'manual',
    };

    const lineRows = lines
      .filter((l) => l.account_id && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
      .map((l) => ({
        account_id: l.account_id,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        description: l.description || null,
      }));
    const { error } = await supabase.rpc('post_journal_atomic', {
      p_entry: payload,
      p_lines: lineRows,
    });
    if (error) {
      alert(`Journal not saved: ${error.message}`);
      return;
    }

    setShowModal(false);
    setHeader({ date: new Date().toISOString().split('T')[0], reference: '', description: '' });
    setLines([{ account_id: '', debit: '', credit: '', description: '' }, { account_id: '', debit: '', credit: '', description: '' }]);
    loadEntries();
  };

  const handleDelete = async (entry: JournalEntry) => {
    if (!confirm(`Delete journal entry "${entry.description}"?`)) return;
    await supabase.from('journal_entries').delete().eq('id', entry.id);
    loadEntries();
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Journal Entries</h2>
          <p className="text-sm text-slate-400 mt-0.5">{entries.length} entries · Double-entry bookkeeping</p>
        </div>
        <Button onClick={() => setShowModal(true)}><span className="flex items-center gap-2"><Plus className="w-4 h-4" /> New Entry</span></Button>
      </div>

      {entries.length === 0 ? (
        <Card><EmptyState icon={Inbox} title="No journal entries" message="Create your first double-entry journal transaction to start recording financial activity." action={<Button onClick={() => setShowModal(true)}>Create Entry</Button>} /></Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">Date</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">Description</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden sm:table-cell">Reference</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase text-right">Amount</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const total = (entry.journal_lines || []).reduce((s, l) => s + l.debit, 0);
                return (
                  <tr key={entry.id} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 transition cursor-pointer"
                    onClick={() => setViewEntry(entry)}>
                    <td className="px-4 py-3 text-sm text-slate-300">{formatDate(entry.entry_date)}</td>
                    <td className="px-4 py-3 text-sm text-white font-medium">{entry.description}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 hidden sm:table-cell">{entry.reference || '—'}</td>
                    <td className="px-4 py-3 text-sm text-white text-right font-mono">{formatZAR(total)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        entry.status === 'posted' ? 'bg-emerald-500/10 text-emerald-400' :
                        entry.status === 'draft' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-red-500/10 text-red-400'
                      }`}>{entry.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(entry); }}
                        className="p-1.5 text-slate-400 hover:text-red-400 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Create modal */}
      {showModal && (
        <Modal title="New Journal Entry" subtitle="Double-entry — debits must equal credits" onClose={() => setShowModal(false)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Date" type="date" value={header.date} onChange={(v) => setHeader({ ...header, date: v })} required />
              <Input label="Reference" value={header.reference} onChange={(v) => setHeader({ ...header, reference: v })} placeholder="INV-001" />
              <Input label="Description" value={header.description} onChange={(v) => setHeader({ ...header, description: v })} placeholder="Monthly rent payment" required full />
            </div>

            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-800/50 border-b border-slate-800 text-left">
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase">Account</th>
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase text-right w-28">Debit</th>
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase text-right w-28">Credit</th>
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase w-40 hidden sm:table-cell">Description</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                      <td className="px-3 py-2">
                        <select value={line.account_id} onChange={(e) => updateLine(idx, 'account_id', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none">
                          <option value="">Select account…</option>
                          {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={line.debit} onChange={(e) => updateLine(idx, 'debit', e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-right text-white font-mono focus:border-blue-500 outline-none" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={line.credit} onChange={(e) => updateLine(idx, 'credit', e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-right text-white font-mono focus:border-blue-500 outline-none" />
                      </td>
                      <td className="px-3 py-2 hidden sm:table-cell">
                        <input type="text" value={line.description} onChange={(e) => updateLine(idx, 'description', e.target.value)}
                          placeholder="Optional"
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none" />
                      </td>
                      <td className="px-3 py-2">
                        {lines.length > 2 && (
                          <button onClick={() => removeLine(idx)} className="text-slate-500 hover:text-red-400"><X className="w-4 h-4" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-800/50 border-t border-slate-800">
                    <td className="px-3 py-2"><button onClick={addLine} className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"><Plus className="w-3 h-3" /> Add Line</button></td>
                    <td className="px-3 py-2 text-right text-sm text-white font-mono font-bold">{formatZAR(totalDebit)}</td>
                    <td className="px-3 py-2 text-right text-sm text-white font-mono font-bold">{formatZAR(totalCredit)}</td>
                    <td className="hidden sm:table-cell"></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Balance indicator */}
            <div className={`flex items-center justify-between px-4 py-3 rounded-lg ${
              isBalanced ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
            }`}>
              <span className="text-sm font-medium">
                {isBalanced ? 'Entry is balanced' : `Out of balance by ${formatZAR(Math.abs(totalDebit - totalCredit))}`}
              </span>
              <span className="text-sm font-mono">
                Diff: {formatZAR(totalDebit - totalCredit)}
              </span>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!isBalanced || !header.description}>Post Entry</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* View modal */}
      {viewEntry && (
        <Modal title="Journal Entry Detail" subtitle={formatDate(viewEntry.entry_date)} onClose={() => setViewEntry(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-slate-500">Reference:</span> <span className="text-white">{viewEntry.reference || '—'}</span></div>
              <div><span className="text-slate-500">Status:</span> <span className="text-white">{viewEntry.status}</span></div>
              <div className="col-span-2"><span className="text-slate-500">Description:</span> <span className="text-white">{viewEntry.description}</span></div>
            </div>
            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-800/50 border-b border-slate-800 text-left">
                    <th className="px-4 py-2 text-xs font-medium text-slate-500 uppercase">Account</th>
                    <th className="px-4 py-2 text-xs font-medium text-slate-500 uppercase text-right">Debit</th>
                    <th className="px-4 py-2 text-xs font-medium text-slate-500 uppercase text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewEntry.journal_lines || []).map((line) => (
                    <tr key={line.id} className="border-b border-slate-800/50 last:border-0">
                      <td className="px-4 py-2.5 text-sm text-white">
                        <span className="font-mono text-slate-500 mr-2">{line.account?.code}</span>
                        {line.account?.name}
                        {line.description && <p className="text-xs text-slate-500 mt-0.5">{line.description}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-white text-right font-mono">{line.debit > 0 ? formatZAR(line.debit) : '—'}</td>
                      <td className="px-4 py-2.5 text-sm text-white text-right font-mono">{line.credit > 0 ? formatZAR(line.credit) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-800/50 border-t border-slate-800">
                    <td className="px-4 py-2.5 text-sm text-slate-400 font-semibold">Total</td>
                    <td className="px-4 py-2.5 text-sm text-white text-right font-mono font-bold">
                      {formatZAR((viewEntry.journal_lines || []).reduce((s, l) => s + l.debit, 0))}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-white text-right font-mono font-bold">
                      {formatZAR((viewEntry.journal_lines || []).reduce((s, l) => s + l.credit, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
