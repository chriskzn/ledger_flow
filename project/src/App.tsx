import { useState } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/hooks/useCompany';
import AuthScreen from '@/screens/AuthScreen';
import CompanySetup from '@/screens/CompanySetup';
import { AppLayout } from '@/components/AppLayout';
import Dashboard from '@/screens/Dashboard';
import Accounts from '@/screens/Accounts';
import Journal from '@/screens/Journal';
import Customers from '@/screens/Customers';
import Suppliers from '@/screens/Suppliers';
import Invoices from '@/screens/Invoices';
import Employees from '@/screens/Employees';
import Payroll from '@/screens/Payroll';
import Reports from '@/screens/Reports';
import SARS from '@/screens/SARS';
import ApiAccess from '@/screens/ApiAccess';
import Settings from '@/screens/Settings';

export type PageId =
  | 'dashboard' | 'accounts' | 'journal' | 'customers' | 'suppliers'
  | 'invoices' | 'employees' | 'payroll' | 'reports' | 'sars' | 'api' | 'settings';

function MainApp() {
  const { user, loading } = useAuth();
  const { company, loading: companyLoading } = useCompany();
  const [page, setPage] = useState<PageId>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  if (companyLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!company) return <CompanySetup onDone={() => window.location.reload()} />;

  return (
    <AppLayout currentPage={page} onNavigate={setPage}>
      {page === 'dashboard' && <Dashboard />}
      {page === 'accounts' && <Accounts />}
      {page === 'journal' && <Journal />}
      {page === 'customers' && <Customers />}
      {page === 'suppliers' && <Suppliers />}
      {page === 'invoices' && <Invoices />}
      {page === 'employees' && <Employees />}
      {page === 'payroll' && <Payroll />}
      {page === 'reports' && <Reports />}
      {page === 'sars' && <SARS />}
      {page === 'api' && <ApiAccess />}
      {page === 'settings' && <Settings />}
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
