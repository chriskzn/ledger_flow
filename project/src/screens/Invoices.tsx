import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Button, Modal, EmptyState } from '@/components/ui';
import { formatZAR, formatDate } from '@/lib/format';
import type { Customer, Invoice, InvoiceItem } from '@/types';
import { Plus, FileText, Inbox, X, Eye, Check } from 'lucide-react';

interface ItemForm {
  description: string;
  quantity: string;
  unit_price: string;
  vat_rate: string;
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<(Invoice & { customer?: Customer; invoice_items?: InvoiceItem[] })[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<(Invoice & { customer?: Customer; invoice_items?: InvoiceItem[] }) | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const [header, setHeader] = useState({
    customer_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: '',
  });
  const [items, setItems] = useState<ItemForm[]>([{ description: '', quantity: '1', unit_price: '0', vat_rate: '15' }]);

  useEffect(() => { loadInvoices(); loadCustomers(); }, []);

  const loadInvoices = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('invoices')
      .select('*, customer:customers(*), invoice_items(*)')
      .order('invoice_date', { ascending: false });
    setInvoices((data as any[]) || []);
    setLoading(false);
  };

  const loadCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').eq('is_active', true).order('name');
    setCustomers((data as Customer[]) || []);
  };

  const updateItem = (idx: number, field: keyof ItemForm, value: string) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
  };
  const addItem = () => setItems([...items, { description: '', quantity: '1', unit_price: '0', vat_rate: '15' }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const subtotal = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0);
  const vatAmount = items.reduce((s, i) => {
    const lineTotal = (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0);
    return s + lineTotal * ((parseFloat(i.vat_rate) || 0) / 100);
  }, 0);
  const total = subtotal + vatAmount;

  const generateInvoiceNumber = () => {
    const year = new Date().getFullYear();
    const count = invoices.length + 1;
    return `INV-${year}-${String(count).padStart(4, '0')}`;
  };

  const handleSave = async () => {
    if (!header.customer_id || items.length === 0) return;
    const invoiceNumber = generateInvoiceNumber();

    const { data: invoice, error } = await supabase.from('invoices').insert({
      customer_id: header.customer_id,
      invoice_number: invoiceNumber,
      invoice_date: header.invoice_date,
      due_date: header.due_date || header.invoice_date,
      subtotal,
      vat_amount: vatAmount,
      total,
      amount_paid: 0,
      status: 'sent',
      notes: header.notes || null,
    }).select().single();

    if (error || !invoice) return;

    const itemRows = items.filter((i) => i.description).map((i) => ({
      invoice_id: invoice.id,
      description: i.description,
      quantity: parseFloat(i.quantity) || 0,
      unit_price: parseFloat(i.unit_price) || 0,
      vat_rate: parseFloat(i.vat_rate) || 0,
      line_total: (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0),
    }));

    if (itemRows.length > 0) {
      await supabase.from('invoice_items').insert(itemRows);
    }

    // Create journal entry for the invoice
    const accounts = await supabase.from('accounts').select('id, name, code').in('code', ['1100', '4000', '2200']);
    const ar = accounts.data?.find((a) => a.code === '1100');
    const sales = accounts.data?.find((a) => a.code === '4000');
    const vatOut = accounts.data?.find((a) => a.code === '2200');

    if (ar && sales) {
      const entryDate = new Date(header.invoice_date);
      const { data: entry } = await supabase.from('journal_entries').insert({
        entry_date: header.invoice_date,
        reference: invoiceNumber,
        description: `Invoice ${invoiceNumber} - ${customers.find((c) => c.id === header.customer_id)?.name || ''}`,
        period_month: entryDate.getMonth() + 1,
        period_year: entryDate.getFullYear(),
        status: 'posted',
        source: 'invoice',
        source_id: invoice.id,
      }).select().single();

      if (entry) {
        const jeLines: any[] = [
          { journal_entry_id: entry.id, account_id: ar.id, debit: total, credit: 0, description: 'Accounts Receivable' },
          { journal_entry_id: entry.id, account_id: sales.id, debit: 0, credit: subtotal, description: 'Sales Revenue' },
        ];
        if (vatOut && vatAmount > 0) {
          jeLines.push({ journal_entry_id: entry.id, account_id: vatOut.id, debit: 0, credit: vatAmount, description: 'VAT Output' });
        }
        await supabase.from('journal_lines').insert(jeLines);
      }
    }

    setShowModal(false);
    setHeader({ customer_id: '', invoice_date: new Date().toISOString().split('T')[0], due_date: '', notes: '' });
    setItems([{ description: '', quantity: '1', unit_price: '0', vat_rate: '15' }]);
    loadInvoices();
  };

  const markAsPaid = async (inv: Invoice) => {
    await supabase.from('invoices').update({ amount_paid: inv.total, status: 'paid' }).eq('id', inv.id);

    // Create receipt journal entry
    const accounts = await supabase.from('accounts').select('id, code').in('code', ['1000', '1100']);
    const bank = accounts.data?.find((a) => a.code === '1000');
    const ar = accounts.data?.find((a) => a.code === '1100');
    if (bank && ar) {
      const entryDate = new Date();
      const { data: entry } = await supabase.from('journal_entries').insert({
        entry_date: entryDate.toISOString().split('T')[0],
        reference: inv.invoice_number,
        description: `Payment received - ${inv.invoice_number}`,
        period_month: entryDate.getMonth() + 1,
        period_year: entryDate.getFullYear(),
        status: 'posted',
        source: 'invoice',
        source_id: inv.id,
      }).select().single();
      if (entry) {
        await supabase.from('journal_lines').insert([
          { journal_entry_id: entry.id, account_id: bank.id, debit: inv.total, credit: 0, description: 'Bank receipt' },
          { journal_entry_id: entry.id, account_id: ar.id, debit: 0, credit: inv.total, description: 'AR settlement' },
        ]);
      }
    }
    loadInvoices();
  };

  const filtered = filter === 'all' ? invoices : invoices.filter((i) => i.status === filter);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Invoices</h2>
          <p className="text-sm text-slate-400 mt-0.5">{invoices.length} invoices · 15% VAT compliant</p>
        </div>
        <Button onClick={() => setShowModal(true)}><span className="flex items-center gap-2"><Plus className="w-4 h-4" /> New Invoice</span></Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'draft', 'sent', 'paid', 'partial', 'overdue'].map((t) => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition capitalize ${
              filter === t ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}>{t}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={Inbox} title="No invoices found" message="Create your first VAT-compliant invoice." action={<Button onClick={() => setShowModal(true)}>Create Invoice</Button>} /></Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">Invoice #</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden sm:table-cell">Date</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden sm:table-cell">Due</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase text-right">Total</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 transition cursor-pointer"
                  onClick={() => setViewInvoice(inv)}>
                  <td className="px-4 py-3 text-sm text-white font-mono">{inv.invoice_number}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{inv.customer?.name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-400 hidden sm:table-cell">{formatDate(inv.invoice_date)}</td>
                  <td className="px-4 py-3 text-sm text-slate-400 hidden sm:table-cell">{formatDate(inv.due_date)}</td>
                  <td className="px-4 py-3 text-sm text-white text-right font-mono font-semibold">{formatZAR(inv.total)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' :
                      inv.status === 'sent' ? 'bg-blue-500/10 text-blue-400' :
                      inv.status === 'overdue' ? 'bg-red-500/10 text-red-400' :
                      inv.status === 'partial' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-slate-500/10 text-slate-400'
                    }`}>{inv.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {inv.status !== 'paid' && inv.status !== 'void' && (
                      <button onClick={(e) => { e.stopPropagation(); markAsPaid(inv); }}
                        className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Mark Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Create modal */}
      {showModal && (
        <Modal title="New Invoice" subtitle="VAT-compliant (15%)" onClose={() => setShowModal(false)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Customer</label>
                <select value={header.customer_id} onChange={(e) => setHeader({ ...header, customer_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 outline-none">
                  <option value="">Select customer…</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Invoice Date</label>
                <input type="date" value={header.invoice_date} onChange={(e) => setHeader({ ...header, invoice_date: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Due Date</label>
                <input type="date" value={header.due_date} onChange={(e) => setHeader({ ...header, due_date: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 outline-none" />
              </div>
            </div>

            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-800/50 border-b border-slate-800 text-left">
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase">Description</th>
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase text-right w-20">Qty</th>
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase text-right w-28">Unit Price</th>
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase text-right w-20">VAT%</th>
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase text-right w-28">Total</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
                    return (
                      <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                        <td className="px-3 py-2">
                          <input type="text" value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)}
                            placeholder="Item description" className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-right text-white font-mono focus:border-blue-500 outline-none" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" value={item.unit_price} onChange={(e) => updateItem(idx, 'unit_price', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-right text-white font-mono focus:border-blue-500 outline-none" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" value={item.vat_rate} onChange={(e) => updateItem(idx, 'vat_rate', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-right text-white font-mono focus:border-blue-500 outline-none" />
                        </td>
                        <td className="px-3 py-2 text-right text-sm text-white font-mono">{formatZAR(lineTotal)}</td>
                        <td className="px-3 py-2">
                          {items.length > 1 && <button onClick={() => removeItem(idx)} className="text-slate-500 hover:text-red-400"><X className="w-4 h-4" /></button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-3 py-2 border-t border-slate-800">
                <button onClick={addItem} className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"><Plus className="w-3 h-3" /> Add Item</button>
              </div>
            </div>

            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-slate-400">Subtotal:</span><span className="text-white font-mono">{formatZAR(subtotal)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-400">VAT (15%):</span><span className="text-white font-mono">{formatZAR(vatAmount)}</span></div>
                <div className="flex justify-between text-base font-bold border-t border-slate-800 pt-2"><span className="text-white">Total:</span><span className="text-blue-400 font-mono">{formatZAR(total)}</span></div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label>
              <textarea value={header.notes} onChange={(e) => setHeader({ ...header, notes: e.target.value })}
                rows={2} placeholder="Payment terms, banking details, etc."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:border-blue-500 outline-none" />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!header.customer_id}>Create & Send</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* View modal */}
      {viewInvoice && (
        <Modal title={viewInvoice.invoice_number} subtitle={viewInvoice.customer?.name} onClose={() => setViewInvoice(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><span className="text-slate-500 block text-xs">Invoice Date</span><span className="text-white">{formatDate(viewInvoice.invoice_date)}</span></div>
              <div><span className="text-slate-500 block text-xs">Due Date</span><span className="text-white">{formatDate(viewInvoice.due_date)}</span></div>
              <div><span className="text-slate-500 block text-xs">Status</span><span className="text-white capitalize">{viewInvoice.status}</span></div>
            </div>
            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-800/50 border-b border-slate-800 text-left">
                    <th className="px-4 py-2 text-xs text-slate-500 uppercase">Description</th>
                    <th className="px-4 py-2 text-xs text-slate-500 uppercase text-right">Qty</th>
                    <th className="px-4 py-2 text-xs text-slate-500 uppercase text-right">Price</th>
                    <th className="px-4 py-2 text-xs text-slate-500 uppercase text-right">VAT</th>
                    <th className="px-4 py-2 text-xs text-slate-500 uppercase text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewInvoice.invoice_items || []).map((item) => (
                    <tr key={item.id} className="border-b border-slate-800/50 last:border-0">
                      <td className="px-4 py-2.5 text-sm text-white">{item.description}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-400 text-right">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-400 text-right font-mono">{formatZAR(item.unit_price)}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-400 text-right">{item.vat_rate}%</td>
                      <td className="px-4 py-2.5 text-sm text-white text-right font-mono">{formatZAR(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-slate-400">Subtotal:</span><span className="text-white font-mono">{formatZAR(viewInvoice.subtotal)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-400">VAT:</span><span className="text-white font-mono">{formatZAR(viewInvoice.vat_amount)}</span></div>
                <div className="flex justify-between text-base font-bold border-t border-slate-800 pt-2"><span className="text-white">Total:</span><span className="text-blue-400 font-mono">{formatZAR(viewInvoice.total)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-400">Paid:</span><span className="text-emerald-400 font-mono">{formatZAR(viewInvoice.amount_paid)}</span></div>
                <div className="flex justify-between text-sm font-semibold"><span className="text-slate-300">Outstanding:</span><span className="text-amber-400 font-mono">{formatZAR(viewInvoice.total - viewInvoice.amount_paid)}</span></div>
              </div>
            </div>
            {viewInvoice.notes && <div className="text-sm text-slate-400 bg-slate-800/50 rounded-lg p-3">{viewInvoice.notes}</div>}
            {viewInvoice.status !== 'paid' && (
              <div className="flex justify-end">
                <Button onClick={() => { markAsPaid(viewInvoice); setViewInvoice(null); }}>
                  <span className="flex items-center gap-2"><Check className="w-4 h-4" /> Mark as Paid</span>
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
