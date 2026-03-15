import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, Search, Mail, Phone, Loader2 } from 'lucide-react';
import { api } from '../../api/client';
import type { Customer } from '../../api/types';

export default function CustomerList() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get<Customer[]>('/customers').then(setCustomers).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Kunder</h1>
          <p className="text-white/40 text-sm mt-0.5">{customers.length} kunder registrerade</p>
        </div>
        <Link to="/customers/new" className="btn-primary">
          <Plus size={16} /> Ny kund
        </Link>
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input className="input pl-9" placeholder="Sök kunder..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-brand-500" size={28} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12 text-white/30">
          <Users size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Inga kunder hittades</p>
          <Link to="/customers/new" className="text-brand-400 hover:text-brand-300 text-xs mt-2 inline-block">
            Lägg till din första kund →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(c => (
            <Link
              key={c.id}
              to={`/customers/${c.id}`}
              className="card hover:border-brand-500/20 hover:bg-surface-200 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-300 font-semibold text-sm flex-shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm group-hover:text-brand-300 transition-colors truncate">{c.name}</p>
                  {c.vatNumber && <p className="text-xs text-white/30 truncate">{c.vatNumber}</p>}
                  <div className="mt-2 space-y-1">
                    {c.email && (
                      <div className="flex items-center gap-1.5 text-xs text-white/40">
                        <Mail size={11} /><span className="truncate">{c.email}</span>
                      </div>
                    )}
                    {c.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-white/40">
                        <Phone size={11} /><span>{c.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
