import { useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/hooks/useCompany';
import type { PageId } from '@/App';
import {
  Building2, Calculator, FileText, LayoutDashboard, LogOut, Menu, Receipt, Settings,
  TrendingUp, Users, Wallet, X, BookOpen, BarChart3, KeyRound, Briefcase, UserCircle,
} from 'lucide-react';

const NAV_SECTIONS: { label: string; items: { id: PageId; label: string; icon: typeof LayoutDashboard }[] }[] = [
  {
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Accounting',
    items: [
      { id: 'accounts', label: 'Chart of Accounts', icon: BookOpen },
      { id: 'journal', label: 'Journal Entries', icon: Receipt },
      { id: 'customers', label: 'Customers', icon: UserCircle },
      { id: 'suppliers', label: 'Suppliers', icon: Briefcase },
      { id: 'invoices', label: 'Invoices', icon: FileText },
    ],
  },
  {
    label: 'Payroll',
    items: [
      { id: 'employees', label: 'Employees', icon: Users },
      { id: 'payroll', label: 'Run Payroll', icon: Wallet },
    ],
  },
  {
    label: 'Reports & Compliance',
    items: [
      { id: 'reports', label: 'Financial Reports', icon: BarChart3 },
      { id: 'sars', label: 'SARS Compliance', icon: TrendingUp },
      { id: 'api', label: 'API Access', icon: KeyRound },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function AppLayout({ currentPage, onNavigate, children }: {
  currentPage: PageId;
  onNavigate: (id: PageId) => void;
  children: ReactNode;
}) {
  const { signOut } = useAuth();
  const { company } = useCompany();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (id: PageId) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  const currentLabel = NAV_SECTIONS
    .flatMap((s) => s.items)
    .find((i) => i.id === currentPage)?.label ?? 'Dashboard';

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar - desktop */}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-slate-900 border-r border-slate-800 flex flex-col z-40 transition-transform ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold text-white block leading-tight">LedgerFlow</span>
              <span className="text-[10px] text-slate-500 leading-tight">SA Accounting Suite</span>
            </div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{section.label}</p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const active = currentPage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNav(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                        active
                          ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
                      }`}
                    >
                      <item.icon className="w-[18px] h-[18px] shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Company footer */}
        <div className="px-3 py-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/50 mb-2">
            <div className="w-8 h-8 rounded-md bg-slate-700 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-slate-300" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-white font-medium truncate">{company?.name || 'Loading…'}</p>
              <p className="text-[11px] text-slate-500 truncate">{company?.vat_number ? `VAT: ${company.vat_number}` : 'No VAT number'}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
          >
            <LogOut className="w-[18px] h-[18px]" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden text-slate-400 hover:text-white">
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-semibold text-white">{currentLabel}</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-flex items-center gap-2 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              VAT: 15%
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
