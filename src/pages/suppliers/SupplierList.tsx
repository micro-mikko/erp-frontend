import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Loader2, Truck, Mail, Phone, ChevronRight } from 'lucide-react';
import { api } from '../../api/client';
import type { Supplier, Expense } from '../../api/types';

interface SupplierWithStats extends Supplier {
  totalSpend: number;
  pendingAmount: number;
  expenseCount: number;
}

export default function SupplierList() {
  const [suppliers, setSuppliers] = useState<SupplierWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<Supplier[]>('/suppliers'),
      api.get<Expense[]>('/expenses'),
    ]).then(([sups, expenses]) => {
      const withStats = sups.map(s => {
        const linked = expenses.filter(e => e.supplierId === s.id);
        const nameLinked = expenses.filter(e => !e.supplierId && e.supplier?.toLowerCase() === s.name.toLowerCase());
        const all = [...linked, ...nameLinked];
        return {
          ...s,
          totalSpend:    all.reduce((sum, e) => sum + e.amount, 0),
          pendingAmount: all.filter(e => e.status !== 'PAID').reduce((sum, e) => sum + e.amount, 0),
          expenseCount:  all.length,
        };
      });
      // Sort by pending amount desc
      withStats.sort((a, b) => b.pendingAmount - a.pendingAmount);
      setSuppliers(withStats);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.businessId || '').includes(search) ||
    (s.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const fmt = (n: number) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-brand-500" size={28} />
    </div>
  );

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Leverantörer</h1>
          <p className="text-white/40 text-sm mt-0.5">{suppliers.length} leverantörer</p>
        </div>
        <Link to="/suppliers/new" className="btn-primary">
          <Plus size={16} /> Ny leverantör
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          className="input pl-9"
          placeholder="Sök namn, FO-nummer, e-post..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card text-center py-16">
          <Truck size={40} className="mx-auto mb-3 text-white/20" />
          <p className="text-white/40 text-sm">
            {search ? 'Inga leverantörer matchar sökningen' : 'Inga leverantörer ännu'}
          </p>
          {!search && (
            <Link to="/suppliers/new" className="btn-primary mt-4 inline-flex">
              <Plus size={15} /> Lägg till leverantör
            </Link>
          )}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-5 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wide">Leverantör</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wide hidden md:table-cell">Kontakt</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-white/40 uppercase tracking-wide">Obetalt saldo</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-white/40 uppercase tracking-wide hidden lg:table-cell">Totalt köpt</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-white/40 uppercase tracking-wide hidden lg:table-cell">Antal</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map(s => (
                <tr
                  key={s.id}
                  className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                  onClick={() => window.location.href = `/suppliers/${s.id}`}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-300 font-semibold text-sm flex-shrink-0">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{s.name}</p>
                        {s.businessId && <p className="text-xs text-white/30">{s.businessId}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell">
                    <div className="space-y-0.5">
                      {s.email && (
                        <div className="flex items-center gap-1.5 text-xs text-white/40">
                          <Mail size={11} /> {s.email}
                        </div>
                      )}
                      {s.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-white/40">
                          <Phone size={11} /> {s.phone}
                        </div>
                      )}
                      {!s.email && !s.phone && <span className="text-xs text-white/20">—</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className={`text-sm font-medium ${s.pendingAmount > 0 ? 'text-amber-400' : 'text-white/30'}`}>
                      {s.pendingAmount > 0 ? fmt(s.pendingAmount) : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right hidden lg:table-cell">
                    <span className="text-sm text-white/60">{s.totalSpend > 0 ? fmt(s.totalSpend) : '—'}</span>
                  </td>
                  <td className="px-5 py-4 text-right hidden lg:table-cell">
                    <span className="text-sm text-white/40">{s.expenseCount} st</span>
                  </td>
                  <td className="px-3 py-4">
                    <ChevronRight size={14} className="text-white/20 group-hover:text-white/50 transition-colors" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
