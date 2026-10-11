import { useState, type FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Calculator, Eye, EyeOff, Lock, Mail, Shield, TrendingUp, Users } from 'lucide-react';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = mode === 'signin' ? await signIn(email, password) : await signUp(email, password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-slate-900 to-slate-950" />
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `radial-gradient(circle at 20% 50%, rgba(59,130,246,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(14,165,233,0.2) 0%, transparent 50%)`
        }} />
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Calculator className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">LedgerFlow</span>
          </div>
          <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-4">
            South African<br />Accounting & Payroll<br /><span className="text-blue-400">Built for compliance.</span>
          </h1>
          <p className="text-slate-300 text-lg mb-12 max-w-md">
            Full double-entry bookkeeping, SARS-compliant payroll with PAYE, UIF, SDL & COIDA, VAT invoicing, and built-in API access.
          </p>
          <div className="space-y-5 max-w-md">
            {[
              { icon: TrendingUp, text: 'Real-time financial dashboard with trial balance, income statement & balance sheet' },
              { icon: Users, text: 'Complete payroll processing with automatic SARS tax calculations' },
              { icon: Shield, text: 'VAT-compliant invoicing and SARS EMP201 / IRP5 reporting' },
            ].map((feat, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                  <feat.icon className="w-5 h-5 text-blue-400" />
                </div>
                <p className="text-slate-300 text-sm leading-relaxed pt-2">{feat.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
              <Calculator className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">LedgerFlow</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-2">
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-slate-400 text-sm mb-8">
              {mode === 'signin' ? 'Sign in to manage your finances' : 'Start your SA-compliant accounting journey'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition outline-none"
                    placeholder="you@company.co.za"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-11 pr-11 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition outline-none"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition shadow-lg shadow-blue-500/20"
              >
                {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
                className="text-sm text-slate-400 hover:text-blue-400 transition"
              >
                {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>
          </div>

          <p className="text-center text-slate-600 text-xs mt-6">
            SARS-compliant · 15% VAT · PAYE · UIF · SDL · COIDA
          </p>
        </div>
      </div>
    </div>
  );
}
