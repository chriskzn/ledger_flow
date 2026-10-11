import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Button, Modal, EmptyState } from '@/components/ui';
import { formatZAR, formatDate } from '@/lib/format';
import { calculatePayroll, getAgeFromIdNumber, MONTHS } from '@/lib/saTax';
import type { Employee, Payslip, PayslipWithEmployee } from '@/types';
import { Wallet, Inbox, Play, Eye, Check, RotateCcw, Calculator } from 'lucide-react';

export default function Payroll() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payslips, setPayslips] = useState<PayslipWithEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRunModal, setShowRunModal] = useState(false);
  const [viewPayslip, setViewPayslip] = useState<PayslipWithEmployee | null>(null);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const [runForm, setRunForm] = useState({
    month: currentMonth,
    year: currentYear,
    payDate: new Date().toISOString().split('T')[0],
  });
  const [runPreview, setRunPreview] = useState<{ employee: Employee; result: ReturnType<typeof calculatePayroll> }[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: emps } = await supabase.from('employees').select('*').eq('is_active', true).order('first_name');
    setEmployees((emps as Employee[]) || []);
    await loadPayslips();
    setLoading(false);
  };

  const loadPayslips = async () => {
    const { data } = await supabase
      .from('payslips')
      .select('*, employee:employees(first_name, last_name, id_number, tax_number, position, department)')
      .order('pay_date', { ascending: false });
    setPayslips((data as PayslipWithEmployee[]) || []);
  };

  const openRunModal = () => {
    setRunForm({ month: currentMonth, year: currentYear, payDate: new Date().toISOString().split('T')[0] });
    generatePreview(currentMonth, currentYear);
    setShowRunModal(true);
  };

  const generatePreview = (month: number, year: number) => {
    const preview = employees.map((e) => {
      const age = e.id_number ? getAgeFromIdNumber(e.id_number) : 30;
      const result = calculatePayroll({
        grossIncome: e.basic_salary,
        age,
        medicalAaidDeduction: e.medical_aid,
        pensionDeduction: e.pension,
        providentFundDeduction: e.provident_fund,
        taxRebate: e.tax_rebate,
      });
      return { employee: e, result };
    });
    setRunPreview(preview);
    setSelectedEmployees(new Set(employees.map((e) => e.id)));
  };

  const toggleEmployee = (id: string) => {
    const next = new Set(selectedEmployees);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedEmployees(next);
  };

  const runPayroll = async () => {
    setRunning(true);
    const selected = runPreview.filter((p) => selectedEmployees.has(p.employee.id));

    for (const { employee, result } of selected) {
      // Check if payslip already exists for this period
      const { data: existing } = await supabase
        .from('payslips')
        .select('id')
        .eq('employee_id', employee.id)
        .eq('pay_period_month', runForm.month)
        .eq('pay_period_year', runForm.year)
        .maybeSingle();
      if (existing) continue;

      const { data: payslip, error } = await supabase.from('payslips').insert({
        employee_id: employee.id,
        pay_period_month: runForm.month,
        pay_period_year: runForm.year,
        pay_date: runForm.payDate,
        basic_pay: employee.basic_salary,
        overtime: 0,
        bonuses: 0,
        allowances: 0,
        gross_pay: employee.basic_salary,
        paye: result.paye,
        uif: result.uifEmployee,
        sdl: 0, // SDL is employer cost, not employee deduction
        medical_aid: employee.medical_aid,
        pension: employee.pension,
        provident_fund: employee.provident_fund,
        other_deductions: 0,
        total_deductions: result.totalDeductions,
        net_pay: result.netPay,
        company_uif: result.uifEmployer,
        company_sdl: result.sdlEmployer,
        company_coida: result.coidaEmployer,
        status: 'draft',
      }).select().single();

      if (error || !payslip) continue;
    }

    setRunning(false);
    setShowRunModal(false);
    loadPayslips();
  };

  const approvePayslip = async (p: Payslip) => {
    await supabase.from('payslips').update({ status: 'approved' }).eq('id', p.id);
    loadPayslips();
  };

  const payPayslip = async (p: Payslip) => {
    await supabase.from('payslips').update({ status: 'paid' }).eq('id', p.id);

    // Create payroll journal entry
    const accounts = await supabase.from('accounts').select('id, code').in('code', ['5100', '2300', '2310', '2400', '5120', '5130', '5140', '1000', '5200']);
    const map: Record<string, string> = {};
    accounts.data?.forEach((a) => { map[a.code] = a.id; });

    const entryDate = new Date(p.pay_date);
    const { data: entry } = await supabase.from('journal_entries').insert({
      entry_date: p.pay_date,
      reference: `PAY-${p.pay_period_year}-${String(p.pay_period_month).padStart(2, '0')}`,
      description: `Payroll - ${MONTHS[p.pay_period_month - 1]} ${p.pay_period_year}`,
      period_month: p.pay_period_month,
      period_year: p.pay_period_year,
      status: 'posted',
      source: 'payroll',
      source_id: p.id,
    }).select().single();

    if (entry) {
      const lines: any[] = [];
      // Debit salaries expense
      if (map['5100']) lines.push({ journal_entry_id: entry.id, account_id: map['5100'], debit: p.gross_pay, credit: 0, description: 'Gross salaries' });
      // Debit employer UIF
      if (map['5120'] && p.company_uif > 0) lines.push({ journal_entry_id: entry.id, account_id: map['5120'], debit: p.company_uif, credit: 0, description: 'Employer UIF' });
      // Debit employer SDL
      if (map['5130'] && p.company_sdl > 0) lines.push({ journal_entry_id: entry.id, account_id: map['5130'], debit: p.company_sdl, credit: 0, description: 'Employer SDL' });
      // Debit COIDA
      if (map['5140'] && p.company_coida > 0) lines.push({ journal_entry_id: entry.id, account_id: map['5140'], debit: p.company_coida, credit: 0, description: 'COIDA' });
      // Credit PAYE payable
      if (map['2300'] && p.paye > 0) lines.push({ journal_entry_id: entry.id, account_id: map['2300'], debit: 0, credit: p.paye, description: 'PAYE deduction' });
      // Credit UIF payable (employee + employer)
      if (map['2310'] && (p.uif + p.company_uif) > 0) lines.push({ journal_entry_id: entry.id, account_id: map['2310'], debit: 0, credit: p.uif + p.company_uif, description: 'UIF total' });
      // Credit bank (net pay)
      if (map['1000']) lines.push({ journal_entry_id: entry.id, account_id: map['1000'], debit: 0, credit: p.net_pay, description: 'Net pay to bank' });

      if (lines.length > 0) await supabase.from('journal_lines').insert(lines);
    }

    loadPayslips();
  };

  const reversePayslip = async (p: Payslip) => {
    if (!confirm('Reverse this payslip?')) return;
    await supabase.from('payslips').update({ status: 'reversed' }).eq('id', p.id);
    loadPayslips();
  };

  const filteredPayslips = payslips.filter((p) =>
    p.pay_period_month === selectedMonth && p.pay_period_year === selectedYear
  );

  const totalNet = filteredPayslips.filter((p) => p.status !== 'reversed').reduce((s, p) => s + p.net_pay, 0);
  const totalPAYE = filteredPayslips.filter((p) => p.status !== 'reversed').reduce((s, p) => s + p.paye, 0);
  const totalUIF = filteredPayslips.filter((p) => p.status !== 'reversed').reduce((s, p) => s + p.uif + p.company_uif, 0);
  const totalEmployerCost = filteredPayslips.filter((p) => p.status !== 'reversed').reduce((s, p) =>
    s + p.gross_pay + p.company_uif + p.company_sdl + p.company_coida, 0);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Run Payroll</h2>
          <p className="text-sm text-slate-400 mt-0.5">SA-compliant: PAYE, UIF (1%), SDL (1%), COIDA</p>
        </div>
        <Button onClick={openRunModal} disabled={employees.length === 0}>
          <span className="flex items-center gap-2"><Play className="w-4 h-4" /> Run Payroll</span>
        </Button>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none">
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      {filteredPayslips.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4"><p className="text-xs text-slate-500 mb-1">Net Pay Total</p><p className="text-lg font-bold text-white">{formatZAR(totalNet)}</p></Card>
          <Card className="p-4"><p className="text-xs text-slate-500 mb-1">PAYE Total</p><p className="text-lg font-bold text-white">{formatZAR(totalPAYE)}</p></Card>
          <Card className="p-4"><p className="text-xs text-slate-500 mb-1">UIF Total (Empl+Er)</p><p className="text-lg font-bold text-white">{formatZAR(totalUIF)}</p></Card>
          <Card className="p-4"><p className="text-xs text-slate-500 mb-1">Total Employer Cost</p><p className="text-lg font-bold text-white">{formatZAR(totalEmployerCost)}</p></Card>
        </div>
      )}

      {filteredPayslips.length === 0 ? (
        <Card><EmptyState icon={Inbox} title={`No payslips for ${MONTHS[selectedMonth - 1]} ${selectedYear}`}
          message="Run payroll to generate payslips with automatic PAYE, UIF, SDL, and COIDA calculations." 
          action={employees.length > 0 ? <Button onClick={openRunModal}>Run Payroll</Button> : undefined} /></Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">Employee</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase text-right hidden sm:table-cell">Gross</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase text-right hidden md:table-cell">PAYE</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase text-right hidden md:table-cell">UIF</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase text-right">Net Pay</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredPayslips.map((p) => (
                <tr key={p.id} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 transition cursor-pointer"
                  onClick={() => setViewPayslip(p)}>
                  <td className="px-4 py-3 text-sm text-white">{p.employee?.first_name} {p.employee?.last_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-300 text-right font-mono hidden sm:table-cell">{formatZAR(p.gross_pay)}</td>
                  <td className="px-4 py-3 text-sm text-slate-300 text-right font-mono hidden md:table-cell">{formatZAR(p.paye)}</td>
                  <td className="px-4 py-3 text-sm text-slate-300 text-right font-mono hidden md:table-cell">{formatZAR(p.uif)}</td>
                  <td className="px-4 py-3 text-sm text-white text-right font-mono font-semibold">{formatZAR(p.net_pay)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      p.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' :
                      p.status === 'approved' ? 'bg-blue-500/10 text-blue-400' :
                      p.status === 'reversed' ? 'bg-red-500/10 text-red-400' :
                      'bg-slate-500/10 text-slate-400'
                    }`}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {p.status === 'draft' && <button onClick={() => approvePayslip(p)} className="text-xs text-blue-400 hover:text-blue-300 p-1">Approve</button>}
                      {p.status === 'approved' && <button onClick={() => payPayslip(p)} className="text-xs text-emerald-400 hover:text-emerald-300 p-1">Pay</button>}
                      {p.status !== 'reversed' && <button onClick={() => reversePayslip(p)} className="text-xs text-red-400 hover:text-red-300 p-1"><RotateCcw className="w-3 h-3" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Run payroll modal */}
      {showRunModal && (
        <Modal title="Run Payroll" subtitle={`${MONTHS[runForm.month - 1]} ${runForm.year}`} onClose={() => setShowRunModal(false)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Month</label>
                <select value={runForm.month} onChange={(e) => setRunForm({ ...runForm, month: parseInt(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-blue-500 outline-none">
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Year</label>
                <select value={runForm.year} onChange={(e) => setRunForm({ ...runForm, year: parseInt(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-blue-500 outline-none">
                  {[currentYear - 1, currentYear, currentYear + 1].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Pay Date</label>
                <input type="date" value={runForm.payDate} onChange={(e) => setRunForm({ ...runForm, payDate: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-blue-500 outline-none" />
              </div>
            </div>

            <div className="border border-slate-800 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0">
                  <tr className="bg-slate-800 border-b border-slate-800 text-left">
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase">
                      <input type="checkbox" checked={selectedEmployees.size === runPreview.length} onChange={(e) => {
                        if (e.target.checked) setSelectedEmployees(new Set(runPreview.map((p) => p.employee.id)));
                        else setSelectedEmployees(new Set());
                      }} className="rounded bg-slate-700 border-slate-600" />
                    </th>
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase">Employee</th>
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase text-right">Gross</th>
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase text-right">PAYE</th>
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase text-right">UIF</th>
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {runPreview.map(({ employee, result }) => (
                    <tr key={employee.id} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30">
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={selectedEmployees.has(employee.id)}
                          onChange={() => toggleEmployee(employee.id)} className="rounded bg-slate-700 border-slate-600" />
                      </td>
                      <td className="px-3 py-2 text-sm text-white">{employee.first_name} {employee.last_name}</td>
                      <td className="px-3 py-2 text-sm text-slate-300 text-right font-mono">{formatZAR(employee.basic_salary)}</td>
                      <td className="px-3 py-2 text-sm text-slate-300 text-right font-mono">{formatZAR(result.paye)}</td>
                      <td className="px-3 py-2 text-sm text-slate-300 text-right font-mono">{formatZAR(result.uifEmployee)}</td>
                      <td className="px-3 py-2 text-sm text-white text-right font-mono font-semibold">{formatZAR(result.netPay)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0">
                  <tr className="bg-slate-800 border-t border-slate-800">
                    <td colSpan={2} className="px-3 py-2 text-sm text-slate-400 font-semibold">Total ({selectedEmployees.size} selected)</td>
                    <td className="px-3 py-2 text-sm text-white text-right font-mono font-bold">
                      {formatZAR(runPreview.filter((p) => selectedEmployees.has(p.employee.id)).reduce((s, p) => s + p.employee.basic_salary, 0))}
                    </td>
                    <td className="px-3 py-2 text-sm text-white text-right font-mono font-bold">
                      {formatZAR(runPreview.filter((p) => selectedEmployees.has(p.employee.id)).reduce((s, p) => s + p.result.paye, 0))}
                    </td>
                    <td className="px-3 py-2 text-sm text-white text-right font-mono font-bold">
                      {formatZAR(runPreview.filter((p) => selectedEmployees.has(p.employee.id)).reduce((s, p) => s + p.result.uifEmployee, 0))}
                    </td>
                    <td className="px-3 py-2 text-sm text-blue-400 text-right font-mono font-bold">
                      {formatZAR(runPreview.filter((p) => selectedEmployees.has(p.employee.id)).reduce((s, p) => s + p.result.netPay, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowRunModal(false)}>Cancel</Button>
              <Button onClick={runPayroll} disabled={running || selectedEmployees.size === 0}>
                {running ? 'Processing…' : `Generate ${selectedEmployees.size} Payslips`}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* View payslip modal */}
      {viewPayslip && (
        <Modal title="Payslip Detail" subtitle={`${viewPayslip.employee?.first_name} ${viewPayslip.employee?.last_name} — ${MONTHS[viewPayslip.pay_period_month - 1]} ${viewPayslip.pay_period_year}`} onClose={() => setViewPayslip(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/50 rounded-lg p-4">
                <p className="text-xs text-slate-500 mb-2">Earnings</p>
                <div className="space-y-1.5 text-sm">
                  <Row label="Basic Pay" value={formatZAR(viewPayslip.basic_pay)} />
                  {viewPayslip.overtime > 0 && <Row label="Overtime" value={formatZAR(viewPayslip.overtime)} />}
                  {viewPayslip.bonuses > 0 && <Row label="Bonuses" value={formatZAR(viewPayslip.bonuses)} />}
                  {viewPayslip.allowances > 0 && <Row label="Allowances" value={formatZAR(viewPayslip.allowances)} />}
                  <div className="border-t border-slate-700 pt-1.5 mt-1.5">
                    <Row label="Gross Pay" value={formatZAR(viewPayslip.gross_pay)} bold />
                  </div>
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4">
                <p className="text-xs text-slate-500 mb-2">Deductions</p>
                <div className="space-y-1.5 text-sm">
                  <Row label="PAYE" value={formatZAR(viewPayslip.paye)} />
                  <Row label="UIF (1%)" value={formatZAR(viewPayslip.uif)} />
                  {viewPayslip.medical_aid > 0 && <Row label="Medical Aid" value={formatZAR(viewPayslip.medical_aid)} />}
                  {viewPayslip.pension > 0 && <Row label="Pension" value={formatZAR(viewPayslip.pension)} />}
                  {viewPayslip.provident_fund > 0 && <Row label="Provident Fund" value={formatZAR(viewPayslip.provident_fund)} />}
                  <div className="border-t border-slate-700 pt-1.5 mt-1.5">
                    <Row label="Total Deductions" value={formatZAR(viewPayslip.total_deductions)} bold />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-center justify-between">
              <span className="text-white font-semibold">Net Pay</span>
              <span className="text-2xl font-bold text-blue-400 font-mono">{formatZAR(viewPayslip.net_pay)}</span>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Employer Contributions</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">UIF (1%)</p>
                  <p className="text-sm font-semibold text-white">{formatZAR(viewPayslip.company_uif)}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">SDL (1%)</p>
                  <p className="text-sm font-semibold text-white">{formatZAR(viewPayslip.company_sdl)}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">COIDA</p>
                  <p className="text-sm font-semibold text-white">{formatZAR(viewPayslip.company_coida)}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-800">
              <span className="text-slate-500">Pay Date: {formatDate(viewPayslip.pay_date)}</span>
              <span className="text-slate-500">Status: <span className="text-white capitalize">{viewPayslip.status}</span></span>
            </div>

            {viewPayslip.status !== 'paid' && viewPayslip.status !== 'reversed' && (
              <div className="flex justify-end gap-3">
                {viewPayslip.status === 'draft' && <Button onClick={() => { approvePayslip(viewPayslip); setViewPayslip(null); }}>Approve</Button>}
                {viewPayslip.status === 'approved' && <Button onClick={() => { payPayslip(viewPayslip); setViewPayslip(null); }}>Mark as Paid</Button>}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={bold ? 'text-white font-semibold' : 'text-slate-400'}>{label}</span>
      <span className={`font-mono ${bold ? 'text-white font-bold' : 'text-slate-300'}`}>{value}</span>
    </div>
  );
}
