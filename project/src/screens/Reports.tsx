import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui';
import { formatZAR } from '@/lib/format';
import type { Account, JournalLine } from '@/types';
import { BarChart3, FileSpreadsheet } from 'lucide-react';

type ReportType = 'trial_balance' | 'income_statement' | 'balance_sheet';

interface AccountBalance {
  account: Account;
  debit: number;
  credit: number;
  balance: number;
}

export default function Reports() {
  const [reportType, setReportType] = useState<ReportType>('trial_balance');
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadReport(); }, []);

  const loadReport = async () => {
    setLoading(true);
    const { data: lines } = await supabase
      .from('journal_lines')
      .select('debit, credit, account:accounts(id, code, name, type, subtype, opening_balance)')
      .order('account(code)');

    const accountMap: Record<string, AccountBalance> = {};
    (lines || []).forEach((line: any) => {
      const acc = line.account as Account;
      if (!acc) return;
      if (!accountMap[acc.id]) {
        accountMap[acc.id] = { account: acc, debit: 0, credit: 0, balance: 0 };
      }
      accountMap[acc.id].debit += line.debit;
      accountMap[acc.id].credit += line.credit;
    });

    // Calculate balances with opening balances
    Object.values(accountMap).forEach((ab) => {
      const { account, debit, credit } = ab;
      if (account.type === 'asset' || account.type === 'expense') {
        ab.balance = account.opening_balance + debit - credit;
      } else {
        ab.balance = account.opening_balance + credit - debit;
      }
    });

    setBalances(Object.values(accountMap).sort((a, b) => a.account.code.localeCompare(b.account.code)));
    setLoading(false);
  };

  const trialBalance = balances;
  const incomeAccounts = balances.filter((b) => b.account.type === 'income' || b.account.type === 'expense');
  const balanceSheetAccounts = balances.filter((b) =>
    b.account.type === 'asset' || b.account.type === 'liability' || b.account.type === 'equity');

  const totalIncome = balances.filter((b) => b.account.type === 'income').reduce((s, b) => s + b.balance, 0);
  const totalExpenses = balances.filter((b) => b.account.type === 'expense').reduce((s, b) => s + b.balance, 0);
  const netProfit = totalIncome - totalExpenses;

  const totalAssets = balances.filter((b) => b.account.type === 'asset').reduce((s, b) => s + b.balance, 0);
  const totalLiabilities = balances.filter((b) => b.account.type === 'liability').reduce((s, b) => s + b.balance, 0);
  const totalEquity = balances.filter((b) => b.account.type === 'equity').reduce((s, b) => s + b.balance, 0);

  const tbTotalDebit = trialBalance.reduce((s, b) => s + (b.balance > 0 ? b.balance : 0), 0);
  const tbTotalCredit = trialBalance.reduce((s, b) => s + (b.balance < 0 ? Math.abs(b.balance) : 0), 0);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Financial Reports</h2>
        <p className="text-sm text-slate-400 mt-0.5">Generated from journal entries</p>
      </div>

      {/* Report tabs */}
      <div className="flex gap-2">
        {[
          { id: 'trial_balance' as ReportType, label: 'Trial Balance', icon: BarChart3 },
          { id: 'income_statement' as ReportType, label: 'Income Statement', icon: FileSpreadsheet },
          { id: 'balance_sheet' as ReportType, label: 'Balance Sheet', icon: FileSpreadsheet },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setReportType(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              reportType === tab.id ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Trial Balance */}
      {reportType === 'trial_balance' && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h3 className="text-lg font-semibold text-white">Trial Balance</h3>
            <p className="text-xs text-slate-500">As at {new Date().toLocaleDateString('en-ZA')}</p>
          </div>
          {trialBalance.length === 0 ? (
            <p className="text-sm text-slate-500 py-12 text-center">No journal entries recorded yet</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 text-left">
                  <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase">Code</th>
                  <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase">Account</th>
                  <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase text-right">Debit</th>
                  <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {trialBalance.map((b) => (
                  <tr key={b.account.id} className="border-b border-slate-800/50 last:border-0">
                    <td className="px-5 py-2.5 text-sm text-slate-400 font-mono">{b.account.code}</td>
                    <td className="px-5 py-2.5 text-sm text-white">{b.account.name}</td>
                    <td className="px-5 py-2.5 text-sm text-white text-right font-mono">{b.balance > 0 ? formatZAR(b.balance) : '—'}</td>
                    <td className="px-5 py-2.5 text-sm text-white text-right font-mono">{b.balance < 0 ? formatZAR(Math.abs(b.balance)) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-800/50 border-t-2 border-slate-700">
                  <td colSpan={2} className="px-5 py-3 text-sm text-slate-300 font-bold">Total</td>
                  <td className="px-5 py-3 text-sm text-white text-right font-mono font-bold">{formatZAR(tbTotalDebit)}</td>
                  <td className="px-5 py-3 text-sm text-white text-right font-mono font-bold">{formatZAR(tbTotalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </Card>
      )}

      {/* Income Statement */}
      {reportType === 'income_statement' && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h3 className="text-lg font-semibold text-white">Income Statement</h3>
            <p className="text-xs text-slate-500">For the period ending {new Date().toLocaleDateString('en-ZA')}</p>
          </div>
          <div className="p-5 space-y-6">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-3">Revenue</h4>
              <div className="space-y-2">
                {incomeAccounts.filter((b) => b.account.type === 'income').map((b) => (
                  <div key={b.account.id} className="flex justify-between text-sm py-1">
                    <span className="text-slate-300">{b.account.name}</span>
                    <span className="text-white font-mono">{formatZAR(b.balance)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm py-2 border-t border-slate-800">
                  <span className="text-white font-semibold">Total Revenue</span>
                  <span className="text-emerald-400 font-mono font-bold">{formatZAR(totalIncome)}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-3">Expenses</h4>
              <div className="space-y-2">
                {incomeAccounts.filter((b) => b.account.type === 'expense').map((b) => (
                  <div key={b.account.id} className="flex justify-between text-sm py-1">
                    <span className="text-slate-300">{b.account.name}</span>
                    <span className="text-white font-mono">{formatZAR(b.balance)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm py-2 border-t border-slate-800">
                  <span className="text-white font-semibold">Total Expenses</span>
                  <span className="text-red-400 font-mono font-bold">{formatZAR(totalExpenses)}</span>
                </div>
              </div>
            </div>

            <div className={`flex justify-between items-center px-4 py-4 rounded-lg ${
              netProfit >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'
            }`}>
              <span className="text-white font-bold text-lg">{netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</span>
              <span className={`font-mono font-bold text-2xl ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatZAR(Math.abs(netProfit))}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Balance Sheet */}
      {reportType === 'balance_sheet' && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h3 className="text-lg font-semibold text-white">Balance Sheet</h3>
            <p className="text-xs text-slate-500">As at {new Date().toLocaleDateString('en-ZA')}</p>
          </div>
          <div className="p-5 space-y-6">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-3">Assets</h4>
              <div className="space-y-2">
                {balanceSheetAccounts.filter((b) => b.account.type === 'asset').map((b) => (
                  <div key={b.account.id} className="flex justify-between text-sm py-1">
                    <span className="text-slate-300">{b.account.name}</span>
                    <span className="text-white font-mono">{formatZAR(b.balance)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm py-2 border-t border-slate-800">
                  <span className="text-white font-semibold">Total Assets</span>
                  <span className="text-blue-400 font-mono font-bold">{formatZAR(totalAssets)}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-3">Liabilities</h4>
              <div className="space-y-2">
                {balanceSheetAccounts.filter((b) => b.account.type === 'liability').map((b) => (
                  <div key={b.account.id} className="flex justify-between text-sm py-1">
                    <span className="text-slate-300">{b.account.name}</span>
                    <span className="text-white font-mono">{formatZAR(b.balance)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm py-2 border-t border-slate-800">
                  <span className="text-white font-semibold">Total Liabilities</span>
                  <span className="text-amber-400 font-mono font-bold">{formatZAR(totalLiabilities)}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-purple-400 mb-3">Equity</h4>
              <div className="space-y-2">
                {balanceSheetAccounts.filter((b) => b.account.type === 'equity').map((b) => (
                  <div key={b.account.id} className="flex justify-between text-sm py-1">
                    <span className="text-slate-300">{b.account.name}</span>
                    <span className="text-white font-mono">{formatZAR(b.balance)}</span>
                  </div>
                ))}
                {netProfit !== 0 && (
                  <div className="flex justify-between text-sm py-1">
                    <span className="text-slate-300">Retained Earnings (Current Period)</span>
                    <span className="text-white font-mono">{formatZAR(netProfit)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm py-2 border-t border-slate-800">
                  <span className="text-white font-semibold">Total Equity</span>
                  <span className="text-purple-400 font-mono font-bold">{formatZAR(totalEquity + netProfit)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center px-4 py-4 rounded-lg bg-slate-800/50">
              <span className="text-white font-bold text-lg">Total Liabilities & Equity</span>
              <span className="font-mono font-bold text-2xl text-white">{formatZAR(totalLiabilities + totalEquity + netProfit)}</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
