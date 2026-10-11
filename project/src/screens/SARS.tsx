import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui';
import { formatZAR } from '@/lib/format';
import { MONTHS } from '@/lib/saTax';
import type { Payslip, Invoice } from '@/types';
import { TrendingUp, FileText, AlertCircle, CheckCircle2, Building2 } from 'lucide-react';

export default function SARS() {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: ps } = await supabase.from('payslips').select('*').neq('status', 'reversed');
    setPayslips((ps as Payslip[]) || []);
    const { data: invs } = await supabase.from('invoices').select('*');
    setInvoices((invs as Invoice[]) || []);
    setLoading(false);
  };

  const periodPayslips = payslips.filter((p) => p.pay_period_month === reportMonth && p.pay_period_year === reportYear);
  const periodInvoices = invoices.filter((i) => {
    const d = new Date(i.invoice_date);
    return d.getMonth() + 1 === reportMonth && d.getFullYear() === reportYear;
  });

  // EMP201 calculations
  const totalPAYE = periodPayslips.reduce((s, p) => s + p.paye, 0);
  const totalUIF = periodPayslips.reduce((s, p) => s + p.uif + p.company_uif, 0);
  const totalSDL = periodPayslips.reduce((s, p) => s + p.company_sdl, 0);
  const emp201Total = totalPAYE + totalUIF + totalSDL;

  // VAT calculations
  const vatOutput = periodInvoices.reduce((s, i) => s + i.vat_amount, 0);
  const vatInput = 0; // Would come from supplier invoices
  const vatPayable = vatOutput - vatInput;

  // IRP5 summary
  const employeesWithPay = periodPayslips.reduce((acc, p) => {
    const key = p.employee_id;
    if (!acc[key]) acc[key] = { grossPay: 0, paye: 0, uif: 0, netPay: 0, count: 0 };
    acc[key].grossPay += p.gross_pay;
    acc[key].paye += p.paye;
    acc[key].uif += p.uif;
    acc[key].netPay += p.net_pay;
    acc[key].count += 1;
    return acc;
  }, {} as Record<string, { grossPay: number; paye: number; uif: number; netPay: number; count: number }>);

  const irp5Summary = Object.entries(employeesWithPay).map(([empId, data]) => ({
    employeeId: empId,
    ...data,
  }));

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">SARS Compliance</h2>
          <p className="text-sm text-slate-400 mt-0.5">EMP201, VAT201, and IRP5 reporting</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={reportMonth} onChange={(e) => setReportMonth(parseInt(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={reportYear} onChange={(e) => setReportYear(parseInt(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none">
            {[reportYear - 1, reportYear, reportYear + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* EMP201 */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">EMP201 — Payroll Tax Declaration</h3>
            <p className="text-xs text-slate-500">Monthly PAYE, UIF & SDL return to SARS</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-1">PAYE (Employees' Tax)</p>
              <p className="text-xl font-bold text-white">{formatZAR(totalPAYE)}</p>
              <p className="text-xs text-slate-600 mt-1">Deducted from employees</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-1">UIF (Total)</p>
              <p className="text-xl font-bold text-white">{formatZAR(totalUIF)}</p>
              <p className="text-xs text-slate-600 mt-1">Employee + Employer 1% each</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-1">SDL (Employer)</p>
              <p className="text-xl font-bold text-white">{formatZAR(totalSDL)}</p>
              <p className="text-xs text-slate-600 mt-1">1% of remuneration</p>
            </div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-center justify-between">
            <div>
              <span className="text-white font-semibold text-lg">Total PAYE + UIF + SDL Due to SARS</span>
              <p className="text-xs text-blue-300 mt-0.5">Payment due by the 7th of the following month</p>
            </div>
            <span className="text-2xl font-bold text-blue-400 font-mono">{formatZAR(emp201Total)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <AlertCircle className="w-4 h-4" /> This is a generated summary. Submit your official EMP201 via SARS eFiling.
          </div>
        </div>
      </Card>

      {/* VAT201 */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">VAT201 — VAT Return</h3>
            <p className="text-xs text-slate-500">VAT output vs input for the period (15% rate)</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-1">Output VAT (Sales)</p>
              <p className="text-xl font-bold text-white">{formatZAR(vatOutput)}</p>
              <p className="text-xs text-slate-600 mt-1">VAT collected on invoices</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-1">Input VAT (Purchases)</p>
              <p className="text-xl font-bold text-white">{formatZAR(vatInput)}</p>
              <p className="text-xs text-slate-600 mt-1">VAT paid on purchases</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-1">VAT Payable / Refundable</p>
              <p className={`text-xl font-bold ${vatPayable >= 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{formatZAR(vatPayable)}</p>
              <p className="text-xs text-slate-600 mt-1">{vatPayable >= 0 ? 'Owed to SARS' : 'Refund from SARS'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <AlertCircle className="w-4 h-4" /> Submit your official VAT201 via SARS eFiling by the 25th of the following month.
          </div>
        </div>
      </Card>

      {/* IRP5 Summary */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">IRP5 Summary — Annual Employee Tax Certificates</h3>
            <p className="text-xs text-slate-500">Tax certificates for all employees in the selected period</p>
          </div>
        </div>
        <div className="p-5">
          {irp5Summary.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No payroll data for {MONTHS[reportMonth - 1]} {reportYear}</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 text-left">
                  <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase">Employee ID</th>
                  <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase text-right">Gross Earnings</th>
                  <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase text-right">PAYE Deducted</th>
                  <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase text-right">UIF Deducted</th>
                  <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase text-right">Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {irp5Summary.map((row) => (
                  <tr key={row.employeeId} className="border-b border-slate-800/50 last:border-0">
                    <td className="px-3 py-2.5 text-sm text-slate-400 font-mono">{row.employeeId.substring(0, 8)}…</td>
                    <td className="px-3 py-2.5 text-sm text-white text-right font-mono">{formatZAR(row.grossPay)}</td>
                    <td className="px-3 py-2.5 text-sm text-white text-right font-mono">{formatZAR(row.paye)}</td>
                    <td className="px-3 py-2.5 text-sm text-white text-right font-mono">{formatZAR(row.uif)}</td>
                    <td className="px-3 py-2.5 text-sm text-white text-right font-mono font-semibold">{formatZAR(row.netPay)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-800/50 border-t-2 border-slate-700">
                  <td className="px-3 py-3 text-sm text-slate-300 font-bold">Total ({irp5Summary.length} employees)</td>
                  <td className="px-3 py-3 text-sm text-white text-right font-mono font-bold">{formatZAR(irp5Summary.reduce((s, r) => s + r.grossPay, 0))}</td>
                  <td className="px-3 py-3 text-sm text-white text-right font-mono font-bold">{formatZAR(irp5Summary.reduce((s, r) => s + r.paye, 0))}</td>
                  <td className="px-3 py-3 text-sm text-white text-right font-mono font-bold">{formatZAR(irp5Summary.reduce((s, r) => s + r.uif, 0))}</td>
                  <td className="px-3 py-3 text-sm text-white text-right font-mono font-bold">{formatZAR(irp5Summary.reduce((s, r) => s + r.netPay, 0))}</td>
                </tr>
              </tfoot>
            </table>
          )}
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-4">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> IRP5 certificates must be submitted to SARS annually by 31 May.
          </div>
        </div>
      </Card>
    </div>
  );
}
