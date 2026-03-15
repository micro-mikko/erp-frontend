import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Building2, Loader2 } from 'lucide-react';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', companyName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.name, form.email, form.password, form.companyName);
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registrering misslyckades');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600/20 border border-brand-500/20 mb-4">
            <Building2 size={28} className="text-brand-400" />
          </div>
          <h1 className="text-2xl font-semibold text-white">ERP Studio</h1>
          <p className="text-white/40 text-sm mt-1">Skapa ditt konto</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Namn</label>
                <input className="input" type="text" value={form.name} onChange={set('name')} placeholder="Anna Andersson" required />
              </div>
              <div>
                <label className="label">Företag</label>
                <input className="input" type="text" value={form.companyName} onChange={set('companyName')} placeholder="Mitt AB" required />
              </div>
            </div>
            <div>
              <label className="label">E-post</label>
              <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="anna@mittab.se" required />
            </div>
            <div>
              <label className="label">Lösenord</label>
              <input className="input" type="password" value={form.password} onChange={set('password')} placeholder="••••••••" required minLength={6} />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Skapar konto...</> : 'Skapa konto'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-white/40 mt-4">
          Har du konto redan?{' '}
          <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">
            Logga in
          </Link>
        </p>
      </div>
    </div>
  );
}
