import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Button, Modal, EmptyState } from '@/components/ui';
import { formatDate } from '@/lib/format';
import type { ApiKey } from '@/types';
import { KeyRound, Plus, Inbox, Copy, Check, Trash2, Code, Lock } from 'lucide-react';

const PERMISSION_OPTIONS = [
  { value: 'read', label: 'Read — View all data' },
  { value: 'write', label: 'Write — Create and update records' },
  { value: 'payroll', label: 'Payroll — Run and manage payroll' },
  { value: 'reports', label: 'Reports — Access financial reports' },
  { value: 'invoices', label: 'Invoices — Create and manage invoices' },
];

export default function ApiAccess() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ key_name: '', permissions: ['read'] });

  useEffect(() => { loadKeys(); }, []);

  const loadKeys = async () => {
    setLoading(true);
    const { data } = await supabase.from('api_keys').select('*').order('created_at', { ascending: false });
    setKeys((data as ApiKey[]) || []);
    setLoading(false);
  };

  const generateKey = () => {
    const prefix = 'lf_';
    const random = Array.from({ length: 32 }, () => 'abcdef0123456789'[Math.floor(Math.random() * 16)]).join('');
    return prefix + random;
  };

  const handleCreate = async () => {
    const rawKey = generateKey();
    const keyHash = await hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 10) + '…';

    await supabase.from('api_keys').insert({
      key_name: form.key_name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      permissions: form.permissions,
    });

    setNewKey(rawKey);
    setShowModal(false);
    setForm({ key_name: '', permissions: ['read'] });
    loadKeys();
  };

  const hashKey = async (key: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const handleDelete = async (key: ApiKey) => {
    if (!confirm(`Revoke API key "${key.key_name}"?`)) return;
    await supabase.from('api_keys').delete().eq('id', key.id);
    loadKeys();
  };

  const copyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">API Access</h2>
          <p className="text-sm text-slate-400 mt-0.5">Manage API keys for external integrations</p>
        </div>
        <Button onClick={() => setShowModal(true)}><span className="flex items-center gap-2"><Plus className="w-4 h-4" /> Generate API Key</span></Button>
      </div>

      {/* API keys list */}
      {keys.length === 0 ? (
        <Card><EmptyState icon={Inbox} title="No API keys yet" message="Generate an API key to enable programmatic access to your accounting data." action={<Button onClick={() => setShowModal(true)}>Generate Key</Button>} /></Card>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <Card key={key.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                    <KeyRound className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{key.key_name}</p>
                    <p className="text-sm text-slate-500 font-mono">{key.key_prefix}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {key.permissions.map((perm) => (
                        <span key={perm} className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">{perm}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Created {formatDate(key.created_at)}</p>
                    {key.last_used_at && <p className="text-xs text-slate-500">Last used {formatDate(key.last_used_at)}</p>}
                    <span className={`text-xs ${key.is_active ? 'text-emerald-400' : 'text-slate-500'}`}>{key.is_active ? 'Active' : 'Revoked'}</span>
                  </div>
                  <button onClick={() => handleDelete(key)} className="p-2 text-slate-400 hover:text-red-400 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* New key display */}
      {newKey && (
        <Card className="p-5 border-blue-500/30">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Check className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold">API Key Generated</h3>
              <p className="text-sm text-slate-400">Copy this key now — you won't be able to see it again.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg p-3">
            <Lock className="w-4 h-4 text-slate-500 shrink-0" />
            <code className="text-sm text-blue-400 font-mono flex-1 break-all">{newKey}</code>
            <button onClick={copyKey} className="text-slate-400 hover:text-white p-1 shrink-0">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="secondary" onClick={() => setNewKey(null)}>Done</Button>
          </div>
        </Card>
      )}

      {/* API documentation */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Code className="w-4 h-4 text-blue-400" /> API Documentation
        </h3>
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-slate-400 mb-1">Base URL</p>
            <code className="text-blue-400 font-mono text-xs bg-slate-950 rounded px-3 py-2 block">
              {import.meta.env.VITE_SUPABASE_URL}/functions/v1/ledgerflow-api
            </code>
          </div>
          <div>
            <p className="text-slate-400 mb-1">Authentication</p>
            <code className="text-blue-400 font-mono text-xs bg-slate-950 rounded px-3 py-2 block">
              Authorization: Bearer YOUR_API_KEY
            </code>
          </div>
          <div>
            <p className="text-slate-400 mb-2">Available Endpoints</p>
            <div className="space-y-2">
              {[
                { method: 'GET', path: '/accounts', desc: 'List all chart of accounts' },
                { method: 'GET', path: '/journal', desc: 'List journal entries' },
                { method: 'POST', path: '/journal', desc: 'Create a journal entry' },
                { method: 'GET', path: '/invoices', desc: 'List all invoices' },
                { method: 'POST', path: '/invoices', desc: 'Create a new invoice' },
                { method: 'GET', path: '/employees', desc: 'List all employees' },
                { method: 'GET', path: '/payroll/run', desc: 'Run payroll for a period' },
                { method: 'GET', path: '/reports/trial-balance', desc: 'Get trial balance' },
                { method: 'GET', path: '/reports/income-statement', desc: 'Get income statement' },
                { method: 'GET', path: '/reports/balance-sheet', desc: 'Get balance sheet' },
                { method: 'GET', path: '/sars/emp201', desc: 'Get EMP201 data for a period' },
                { method: 'GET', path: '/sars/vat201', desc: 'Get VAT201 data for a period' },
              ].map((ep) => (
                <div key={ep.path + ep.method} className="flex items-center gap-3 bg-slate-800/50 rounded-lg px-3 py-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    ep.method === 'GET' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>{ep.method}</span>
                  <code className="text-slate-300 font-mono text-xs flex-1">{ep.path}</code>
                  <span className="text-slate-500 text-xs hidden sm:block">{ep.desc}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-slate-400 mb-1">Example Request</p>
            <pre className="text-xs text-slate-300 bg-slate-950 rounded-lg p-4 overflow-x-auto">
{`curl -X GET ${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ledgerflow-api/invoices \\
  -H "Authorization: Bearer lf_your_api_key" \\
  -H "Content-Type: application/json"`}
            </pre>
          </div>
        </div>
      </Card>

      {/* Create modal */}
      {showModal && (
        <Modal title="Generate API Key" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Key Name</label>
              <input type="text" value={form.key_name} onChange={(e) => setForm({ ...form, key_name: e.target.value })}
                placeholder="e.g. Integration with CRM"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Permissions</label>
              <div className="space-y-2">
                {PERMISSION_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={form.permissions.includes(opt.value)}
                      onChange={(e) => {
                        if (e.target.checked) setForm({ ...form, permissions: [...form.permissions, opt.value] });
                        else setForm({ ...form, permissions: form.permissions.filter((p) => p !== opt.value) });
                      }}
                      className="rounded bg-slate-800 border-slate-600" />
                    <span className="text-sm text-slate-300">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!form.key_name}>Generate Key</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
