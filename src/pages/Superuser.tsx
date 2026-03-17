import { useState, useEffect } from 'react';
import { Building2, Users, Plus, X, Loader2, ShieldAlert, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import type { SuperuserCompany, SuperuserUser } from '../api/types';
import { useAuth } from '../context/AuthContext';

type Tab = 'companies' | 'users';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administratör',
  accountant: 'Ekonom',
  user: 'Användare',
};

export default function Superuser() {
  const { switchCompany } = useAuth();
  const [tab, setTab] = useState<Tab>('companies');
  const [companies, setCompanies] = useState<SuperuserCompany[]>([]);
  const [users, setUsers] = useState<SuperuserUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<{ success: boolean; message: string } | null>(null);

  // Assignment modal
  const [assignModal, setAssignModal] = useState<{ userId: string; userName: string } | null>(null);
  const [assignCompanyId, setAssignCompanyId] = useState('');
  const [assignRole, setAssignRole] = useState('user');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    const [c, u] = await Promise.all([
      api.get<SuperuserCompany[]>('/superuser/companies'),
      api.get<SuperuserUser[]>('/superuser/users'),
    ]);
    setCompanies(c);
    setUsers(u);
  };

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, []);

  const handleSwitchCompany = async (companyId: string) => {
    setSwitching(companyId);
    try {
      await switchCompany(companyId);
    } finally {
      setSwitching(null);
    }
  };

  const handleAssign = async () => {
    if (!assignModal || !assignCompanyId) return;
    setSaving(true);
    try {
      await api.post(`/superuser/users/${assignModal.userId}/companies`, {
        companyId: assignCompanyId,
        role: assignRole,
      });
      await loadData();
      setAssignModal(null);
      setAssignCompanyId('');
      setAssignRole('user');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (userId: string, companyId: string) => {
    await api.delete(`/superuser/users/${userId}/companies/${companyId}`);
    await loadData();
  };

  const handleResetDemo = async () => {
    if (!window.confirm('Radera all existerande demodata för Demo Tech AB och skapa ny?\n\nDetta kan inte ångras.')) return;
    setResetting(true);
    setResetResult(null);
    try {
      const res = await api.post<{ success: boolean; stats: { customers: number; suppliers: number; subscriptions: number; invoices: number; expenses: number; transactions: number; vatReports: number; bankTransactions: number } }>('/superuser/reset-demo', {});
      const s = res.stats;
      setResetResult({ success: true, message: `${s.customers} kunder · ${s.invoices} fakturor · ${s.expenses} utgifter · ${s.transactions} verifikat · ${s.vatReports} momsrapporter` });
      await loadData();
    } catch (e: unknown) {
      setResetResult({ success: false, message: e instanceof Error ? e.message : 'Okänt fel' });
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-white/30" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-red-600/20 flex items-center justify-center">
          <ShieldAlert size={20} className="text-red-400" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-white">Superuser</h1>
          <p className="text-sm text-white/40">Plattformshantering av företag och användare</p>
        </div>
        <button
          onClick={() => loadData()}
          className="ml-auto p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
          title="Uppdatera"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-surface-50 rounded-xl w-fit">
        <button
          onClick={() => setTab('companies')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'companies' ? 'bg-surface-100 text-white' : 'text-white/40 hover:text-white/70'
          }`}
        >
          <Building2 size={15} />
          Företag
          <span className="text-[11px] bg-white/10 px-1.5 py-0.5 rounded-full">{companies.length}</span>
        </button>
        <button
          onClick={() => setTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'users' ? 'bg-surface-100 text-white' : 'text-white/40 hover:text-white/70'
          }`}
        >
          <Users size={15} />
          Användare
          <span className="text-[11px] bg-white/10 px-1.5 py-0.5 rounded-full">{users.length}</span>
        </button>
      </div>

      {/* Companies tab */}
      {tab === 'companies' && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs text-white/40 font-medium px-4 py-3">Företag</th>
                <th className="text-left text-xs text-white/40 font-medium px-4 py-3">Org.nr</th>
                <th className="text-left text-xs text-white/40 font-medium px-4 py-3">Användare</th>
                <th className="text-left text-xs text-white/40 font-medium px-4 py-3">Skapad</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-b border-white/5 last:border-0 hover:bg-white/2">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-brand-600/20 flex items-center justify-center text-brand-300 text-[11px] font-semibold">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-white font-medium">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/40 font-mono">{c.businessId}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-white/60">{c.userCount} st</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/40">
                    {new Date(c.createdAt).toLocaleDateString('sv-SE')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleSwitchCompany(c.id)}
                      disabled={switching === c.id}
                      className="text-xs px-3 py-1.5 rounded-lg bg-brand-600/20 text-brand-300 hover:bg-brand-600/30 transition-colors disabled:opacity-50 flex items-center gap-1.5 ml-auto"
                    >
                      {switching === c.id ? <Loader2 size={11} className="animate-spin" /> : null}
                      Byt till
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Users tab */}
      {tab === 'users' && (
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className="card p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-600/30 flex items-center justify-center text-brand-300 text-xs font-semibold flex-shrink-0">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-white">{u.name}</span>
                    {u.isSuperuser && (
                      <span className="text-[10px] bg-red-600/20 text-red-300 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <ShieldAlert size={9} /> SU
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/40 mb-3">{u.email}</p>

                  {/* Company badges */}
                  <div className="flex flex-wrap gap-2">
                    {u.companies.map((c) => (
                      <div key={c.id} className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-lg px-2.5 py-1">
                        <span className="text-xs text-white/70">{c.name}</span>
                        <span className="text-[10px] text-white/30">·</span>
                        <span className="text-[10px] text-white/40">{ROLE_LABELS[c.role] ?? c.role}</span>
                        <button
                          onClick={() => handleRemove(u.id, c.id)}
                          className="ml-1 text-white/20 hover:text-red-400 transition-colors"
                          title="Ta bort"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => { setAssignModal({ userId: u.id, userName: u.name }); setAssignCompanyId(''); setAssignRole('user'); }}
                      className="flex items-center gap-1 text-xs text-white/30 hover:text-brand-300 border border-dashed border-white/10 hover:border-brand-500/50 rounded-lg px-2.5 py-1 transition-colors"
                    >
                      <Plus size={11} />
                      Tilldela företag
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Demo data reset */}
      {tab === 'companies' && (
        <div className="mt-6 card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Demodata</h2>
              <p className="text-xs text-white/40 mt-0.5">Nollställ och återskapa Demo Tech AB med heltäckande testdata</p>
            </div>
            <button
              onClick={handleResetDemo}
              disabled={resetting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-orange-500/30 text-orange-300 text-sm hover:bg-orange-500/10 transition-colors disabled:opacity-50"
            >
              {resetting
                ? <><Loader2 size={14} className="animate-spin" /> Återställer...</>
                : <><RefreshCw size={14} /> Återställ Demo Tech AB</>
              }
            </button>
          </div>
          {resetResult && (
            <div className={`rounded-lg px-4 py-3 text-sm ${resetResult.success ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
              {resetResult.success ? `✓ Demodata återställd — ${resetResult.message}` : `✗ ${resetResult.message}`}
            </div>
          )}
        </div>
      )}

      {/* Assignment modal */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-50 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-sm font-semibold text-white mb-1">Tilldela företag</h2>
            <p className="text-xs text-white/40 mb-5">{assignModal.userName}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Företag</label>
                <select
                  value={assignCompanyId}
                  onChange={(e) => setAssignCompanyId(e.target.value)}
                  className="input w-full"
                >
                  <option value="">Välj företag...</option>
                  {companies
                    .filter((c) => !users.find((u) => u.id === assignModal.userId)?.companies.some((uc) => uc.id === c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Roll</label>
                <select
                  value={assignRole}
                  onChange={(e) => setAssignRole(e.target.value)}
                  className="input w-full"
                >
                  <option value="user">Användare</option>
                  <option value="accountant">Ekonom</option>
                  <option value="admin">Administratör</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setAssignModal(null)}
                className="flex-1 btn-secondary text-sm py-2"
              >
                Avbryt
              </button>
              <button
                onClick={handleAssign}
                disabled={!assignCompanyId || saving}
                className="flex-1 btn-primary text-sm py-2 disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Tilldela'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
