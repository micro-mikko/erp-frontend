import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Receipt, Loader2, Pencil, Trash2, Tag, Search, ChevronUp, ChevronDown, CheckCircle, Clock, Paperclip } from 'lucide-react';
import { api } from '../api/client';
import type { Expense, Category } from '../api/types';
import { getCategoryLabel } from '../components/CategoryPicker';
import { fileUrl } from './Inbox';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

function fmt(n: number) {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'EUR' }).format(n);
}

const COST_CATEGORIES = ['cogs', 'software', 'hardware', 'personnel', 'marketing', 'office', 'other'];

const STATUS_LABELS: Record<string, string> = { PENDING: 'Utestående', PAID: 'Betald' };
const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-400',
  PAID:    'bg-emerald-500/15 text-emerald-400',
};

export default function Expenses() {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'date' | 'description' | 'dimension' | 'supplier' | 'vatAmount' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };
  const SortIcon = ({ column }: { column: typeof sortKey }) =>
    sortKey !== column ? null : sortDir === 'asc' ? <ChevronUp size={12} className="inline ml-0.5 opacity-60" /> : <ChevronDown size={12} className="inline ml-0.5 opacity-60" />;

  const load = () => {
    api.get<Expense[]>('/expenses').then(setExpenses).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get<Category[]>('/accounting/categories').then(setCategories).catch(console.error);
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Radera utgiften?')) return;
    try {
      await api.delete(`/expenses/${id}`);
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Fel');
    }
  };

  const costCats = categories.filter(c => COST_CATEGORIES.includes(c.id));
  const searchLower = search.trim().toLowerCase();
  const filtered = expenses
    .filter(e => !filterCat || e.categoryId === filterCat)
    .filter(e => !searchLower || (e.description || '').toLowerCase().includes(searchLower) || (e.supplier || '').toLowerCase().includes(searchLower) || fmt(e.amount).toLowerCase().includes(searchLower));
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'date': cmp = new Date(a.date).getTime() - new Date(b.date).getTime(); break;
      case 'description': cmp = (a.description || '').localeCompare(b.description || ''); break;
      case 'dimension': cmp = getCategoryLabel(categories, a.categoryId, a.subcategoryId).localeCompare(getCategoryLabel(categories, b.categoryId, b.subcategoryId)); break;
      case 'supplier': cmp = (a.supplier || '').localeCompare(b.supplier || ''); break;
      case 'vatAmount': cmp = (a.vatAmount ?? 0) - (b.vatAmount ?? 0); break;
      case 'amount': cmp = a.amount - b.amount; break;
      default: break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });
  const total = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Utgifter</h1>
          <p className="text-white/40 text-sm mt-0.5">{filtered.length} utgifter · Totalt {fmt(total)}</p>
        </div>
        <button onClick={() => navigate('/expenses/new')} className="btn-primary">
          <Plus size={16} /> Ny utgift
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          className="input pl-9"
          placeholder="Sök beskrivning, leverantör, belopp..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterCat('')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            filterCat === ''
              ? 'bg-brand-600/20 border-brand-500/40 text-brand-300'
              : 'border-white/10 text-white/40 hover:text-white hover:border-white/20'
          }`}
        >
          Alla
        </button>
        {costCats.map(cat => (
          <button
            key={cat.id}
            onClick={() => setFilterCat(cat.id)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filterCat === cat.id
                ? 'bg-brand-600/20 border-brand-500/40 text-brand-300'
                : 'border-white/10 text-white/40 hover:text-white hover:border-white/20'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-brand-500" size={28} />
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <Receipt size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Inga utgifter registrerade</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-white/30 border-b border-white/5 bg-surface-100/50">
                <th className="px-5 py-3 font-medium">
                  <button type="button" onClick={() => toggleSort('date')} className="hover:text-white/60 transition-colors">Datum</button>
                  <SortIcon column="date" />
                </th>
                <th className="px-5 py-3 font-medium">
                  <button type="button" onClick={() => toggleSort('description')} className="hover:text-white/60 transition-colors">Beskrivning</button>
                  <SortIcon column="description" />
                </th>
                <th className="px-5 py-3 font-medium">
                  <button type="button" onClick={() => toggleSort('dimension')} className="hover:text-white/60 transition-colors">Dimension</button>
                  <SortIcon column="dimension" />
                </th>
                <th className="px-5 py-3 font-medium">
                  <button type="button" onClick={() => toggleSort('supplier')} className="hover:text-white/60 transition-colors">Leverantör</button>
                  <SortIcon column="supplier" />
                </th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">
                  <button type="button" onClick={() => toggleSort('vatAmount')} className="hover:text-white/60 transition-colors ml-auto block w-full text-right">Moms</button>
                  <SortIcon column="vatAmount" />
                </th>
                <th className="px-5 py-3 font-medium text-right">
                  <button type="button" onClick={() => toggleSort('amount')} className="hover:text-white/60 transition-colors ml-auto block w-full text-right">Totalt</button>
                  <SortIcon column="amount" />
                </th>
                <th className="px-5 py-3 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {sorted.map(exp => {
                const catLabel = getCategoryLabel(categories, exp.categoryId, exp.subcategoryId);
                return (
                  <tr
                    key={exp.id}
                    onClick={() => navigate(`/expenses/${exp.id}`)}
                    className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                  >
                    <td className="px-5 py-3.5 text-white/40 text-xs whitespace-nowrap">
                      {format(new Date(exp.date), 'd MMM yyyy', { locale: sv })}
                    </td>
                    <td className="px-5 py-3.5 text-white/80">{exp.description}</td>
                    <td className="px-5 py-3.5">
                      {catLabel ? (
                        <span className="inline-flex items-center gap-1 text-xs text-brand-400">
                          <Tag size={10} />
                          {catLabel}
                        </span>
                      ) : (
                        <span className="text-xs text-white/20">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-white/40 text-xs">{exp.supplier || '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[exp.status] || STATUS_STYLES.PENDING}`}>
                        {exp.status === 'PAID' ? <CheckCircle size={10} /> : <Clock size={10} />}
                        {STATUS_LABELS[exp.status] || exp.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-white/40 text-xs">
                      {exp.vatAmount != null ? fmt(exp.vatAmount) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium text-white">{fmt(exp.amount)}</td>
                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {exp.documents && exp.documents.length > 0 && (
                          <a
                            href={fileUrl(exp.documents[0].id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-white/30 hover:text-brand-400 hover:bg-brand-400/10 transition-colors"
                            title={`Visa originalfil: ${exp.documents[0].filename}`}
                          >
                            <Paperclip size={13} />
                          </a>
                        )}
                        <Link
                          to={`/expenses/${exp.id}/edit`}
                          className="p-1.5 rounded-lg text-white/30 hover:text-brand-400 hover:bg-brand-400/10 transition-colors"
                          title="Redigera"
                        >
                          <Pencil size={13} />
                        </Link>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(exp.id); }}
                          className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          title="Radera"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/5 bg-surface-100/30">
                <td colSpan={6} className="px-5 py-3 text-xs text-white/30 font-medium">Totalt ({filtered.length} poster)</td>
                <td className="px-5 py-3 text-right font-semibold text-white">{fmt(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
