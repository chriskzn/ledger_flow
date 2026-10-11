import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatZAR, formatDate } from '@/lib/format';
import { Card, StatCard } from '@/components/ui';
import type { Invoice, Payslip, JournalEntry } from '@/types';
import { TrendingUp, Wallet, Users, FileText, ArrowUpRight, ArrowDownRight, Receipt, Banknote } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    outstandingInvoices: 0,
    monthlyPayroll: 0,
    activeEmployees: 0,
    vatLiability: 0,
    cashBalance: 0,
  });
  const [recentInvoices, setRecentInvoices] = useState<(Invoice & { customer?: { name: string } })[]>([]);
  const [recentJournal, setRecentJournal] = useState<JournalEntry[]>([]);
  const [recentPayslips, setRecentPayslips] = useState<(Payslip & { employee?: { first_name: string; last_name: string } })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);

    // Get all journal lines with accounts for financial summary
    const { data: lines } = await supabase
      .from('journal_lines')
      .select('debit, credit, account:accounts(type)')
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

    let totalIncome = 0;
    let totalExpenses = 0;
    let vatOutput = 0;
    let vatInput = 0;
    let cashBalance = 0;

    (lines || []).forEach((line: any) => {
      const accType = line.account?.type;
      if (accType === 'income') totalIncome += line.debit - line.credit;
      if (accType === 'expense') totalExpenses += line.credit - line.debit;
      if (line.account?.name === 'VAT Output') vatOutput += line.credit - line.debit;
      if (line.account?.name === 'VAT Input') vatInput += line.debit - line.credit;
      if (line.account?.name === 'Bank / Cash') cashBalance += line.debit - line.credit;
    });

    // Invoices
    const { data: invoices } = await supabase
      .from('invoices')
      .select('*, customer:customers(name)')
      .order('invoice_date', { ascending: false })
      .limit(5);

    const outstanding = (invoices || []).reduce((sum: number, inv: Invoice) =>
      sum + (inv.total - inv.amount_paid), 0);

    // Employees & payroll
    const { count: empCount } = await supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    const { data: payslips } = await supabase
      .from('payslips')
      .select('*, employee:employees(first_name, last_name)')
      .order('pay_date', { ascending: false })
      .limit(5);

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const { data: monthPayslips } = await supabase
      .from('payslips')
      .select('net_pay, company_uif, company_sdl, company_coida')
      .eq('pay_period_month', currentMonth)
      .eq('pay_period_year', currentYear);

    const monthlyPayroll = (monthPayslips || []).reduce((sum: number, p: any) =>
      sum + (p.net_pay || 0) + (p.company_uif || 0) + (p.company_sdl || 0) + (p.company_coida || 0), 0);

    // Journal entries
    const { data: journalData } = await supabase
      .from('journal_entries')
      .select('*')
      .order('entry_date', { ascending: false })
      .limit(5);

    setStats({
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
      outstandingInvoices: outstanding,
      monthlyPayroll,
      activeEmployees: empCount || 0,
      vatLiability: vatOutput - vatInput,
      cashBalance,
    });
    setRecentInvoices((invoices || []) as any);
    setRecentPayslips((payslips || []) as any);
    setRecentJournal((journalData || []) as any);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 sm:p-8 shadow-xl shadow-blue-500/10">
        <h2 className="text-2xl font-bold text-white mb-1">Financial Overview</h2>
        <p className="text-blue-100 text-sm">
          {new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Income" value={formatZAR(stats.totalIncome)} icon={TrendingUp} accent="emerald"
          trend="All-time recorded income" />
        <StatCard label="Total Expenses" value={formatZAR(stats.totalExpenses)} icon={ArrowDownRight} accent="amber"
          trend="All-time recorded expenses" />
        <StatCard label="Net Profit" value={formatZAR(stats.netProfit)} icon={ArrowUpRight}
          accent={stats.netProfit >= 0 ? 'blue' : 'red'}
          trend={stats.netProfit >= 0 ? 'Profit' : 'Loss'} />
        <StatCard label="Cash Balance" value={formatZAR(stats.cashBalance)} icon={Banknote} accent="slate"
          trend="Bank account position" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Outstanding Invoices" value={formatZAR(stats.outstandingInvoices)} icon={FileText} accent="red"
          trend="Unpaid customer invoices" />
        <StatCard label="Monthly Payroll" value={formatZAR(stats.monthlyPayroll)} icon={Wallet} accent="blue"
          trend="Current month total cost" />
        <StatCard label="Active Employees" value={String(stats.activeEmployees)} icon={Users} accent="emerald"
          trend="On payroll" />
        <StatCard label="VAT Liability" value={formatZAR(stats.vatLiability)} icon={Receipt} accent="amber"
          trend="Output minus input VAT" />
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent invoices */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" /> Recent Invoices
          </h3>
          {recentInvoices.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No invoices yet</p>
          ) : (
            <div className="space-y-3">
              {recentInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                  <div>
                    <p className="text-sm text-white font-medium">{inv.invoice_number}</p>
                    <p className="text-xs text-slate-500">{inv.customer?.name || '—'} · {formatDate(inv.invoice_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-white font-semibold">{formatZAR(inv.total)}</p>
                    <StatusBadge status={inv.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent payroll */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-blue-400" /> Recent Payslips
          </h3>
          {recentPayslips.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No payslips yet</p>
          ) : (
            <div className="space-y-3">
              {recentPayslips.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                  <div>
                    <p className="text-sm text-white font-medium">
                      {p.employee?.first_name} {p.employee?.last_name}
                    </p>
                    <p className="text-xs text-slate-500">{formatDate(p.pay_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-white font-semibold">{formatZAR(p.net_pay)}</p>
                    <span className={`text-xs ${p.status === 'paid' ? 'text-emerald-400' : p.status === 'approved' ? 'text-blue-400' : 'text-slate-500'}`}>
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent journal entries */}
        <Card className="p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-blue-400" /> Recent Journal Entries
          </h3>
          {recentJournal.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No journal entries yet</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recentJournal.map((j) => (
                <div key={j.id} className="flex items-center justify-between py-2 px-3 bg-slate-800/50 rounded-lg">
                  <div>
                    <p className="text-sm text-white font-medium truncate max-w-[200px]">{j.description}</p>
                    <p className="text-xs text-slate-500">{formatDate(j.entry_date)} · {j.reference || 'No ref'}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    j.status === 'posted' ? 'bg-emerald-500/10 text-emerald-400' :
                    j.status === 'draft' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-red-500/10 text-red-400'
                  }`}>{j.status}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'text-slate-400',
    sent: 'text-blue-400',
    paid: 'text-emerald-400',
    partial: 'text-amber-400',
    overdue: 'text-red-400',
    void: 'text-slate-600',
  };
  return <span className={`text-xs ${colors[status] || 'text-slate-400'}`}>{status}</span>;
}
