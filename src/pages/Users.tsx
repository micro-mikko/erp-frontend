import { useEffect, useState, FormEvent } from 'react';
import { UserCog, Plus, Loader2, X, Shield } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

const ROLES: Record<string, string> = {
  ADMIN: 'Administratör',
  USER: 'Användare',
  ACCOUNTANT: 'Ekonom',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'text-brand-300 bg-brand-600/20',
  USER: 'text-white/60 bg-white/10',
  ACCOUNTANT: 'text-emerald-400 bg-emerald-500/10',
};

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'USER' });

  const load = () => {
    api.get<AppUser[]>('/users').then(setUsers).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/users', form);
      setShowForm(false);
      setForm({ name: '', email: '', password: '', role: 'USER' });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fel');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Användare</h1>
          <p className="text-white/40 text-sm mt-0.5">{users.length} användare i systemet</p>
        </div>
        {currentUser?.role === 'ADMIN' && (
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={16} /> Ny användare
          </button>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-100 border border-white/10 rounded-2xl p-6 w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-white">Ny användare</h2>
              <button onClick={() => setShowForm(false)} className="btn-ghost p-1.5"><X size={14} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Namn</label>
                <input className="input" value={form.name} onChange={set('name')} required />
              </div>
              <div>
                <label className="label">E-post</label>
                <input className="input" type="email" value={form.email} onChange={set('email')} required />
              </div>
              <div>
                <label className="label">Lösenord</label>
                <input className="input" type="password" value={form.password} onChange={set('password')} required minLength={6} />
              </div>
              <div>
                <label className="label">Roll</label>
                <select className="input" value={form.role} onChange={set('role')}>
                  <option value="USER">Användare</option>
                  <option value="ACCOUNTANT">Ekonom</option>
                  <option value="ADMIN">Administratör</option>
                </select>
              </div>
              {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : 'Skapa användare'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Avbryt</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-brand-500" size={28} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {users.map(u => (
            <div key={u.id} className="card flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-300 font-semibold flex-shrink-0">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white truncate">{u.name}</p>
                  {u.id === currentUser?.id && (
                    <span className="text-[10px] bg-brand-600/20 text-brand-300 px-1.5 py-0.5 rounded-full">Du</span>
                  )}
                </div>
                <p className="text-xs text-white/40 truncate">{u.email}</p>
              </div>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] || 'text-white/50 bg-white/5'}`}>
                {u.role === 'ADMIN' && <Shield size={11} />}
                {ROLES[u.role] || u.role}
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <div className="col-span-2 text-center py-12 text-white/30">
              <UserCog size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Inga användare hittades</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
