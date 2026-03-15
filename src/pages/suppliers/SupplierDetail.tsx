import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Loader2, Mail, Phone, MapPin, Building2, CheckCircle, Clock } from 'lucide-react';
import { api } from '../../api/client';
import type { Supplier, Expense } from '../../api/types';
import { format, differenceInDays, startOfYear, startOfMonth, subMonths } from 'date-fns';
import { sv } from 'date-fns/locale';

type Period = 'all' | 'ytd' | 'this_month' | 'last_month';

const STATUS_LABELS: Record<string, string> = { PENDING: 'Utestående', PAID: 'Betald' };
const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-400',
  PAID:    'bg-emerald-500/15 text-emerald-400',
};

export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('all');
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  const loadData = () => {
    Promise.all([
      api.get<Supplier>(`/suppliers/${id}`),
      api.get<Expense[]>('/expenses'),
    ]).then(([sup, allExpenses]) => {
      setSupplier(sup);
      // Link by supplierId first, fallback to name match
      const linked = allExpenses.filter(e =>
        e.supplierId === id ||
        (!e.supplierId && e.supplier?.toLowerCase() === sup.name.toLowerCase())
      );
      setExpenses(linked);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [id]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'EUR' }).format(n);

  const inPeriod = (dateStr: string): boolean => {
    const d = new Date(dateStr);
    const now = new Date();
    if (period === 'ytd') return d >= startOfYear(now);
    if (period === 'this_month') return d >= startOfMonth(now);
    if (period === 'last_month') {
      const start = startOfMonth(subMonths(now, 1));
      const end = startOfMonth(now);
      return d >= start && d < end;
    }
    return true;
  };

  const filtered = expenses.filter(e => inPeriod(e.date));

  // KPIs
  const totalSpend = expenses.reduce((s, e) => s + e.amount, 0);
  const pendingAmount = expenses.filter(e => e.status !== 'PAID').reduce((s, e) => s + e.amount, 0);

  // Aging (based on dueDate for PENDING expenses)
  const aging = { week: 0, twoWeeks: 0, month: 0, older: 0 };
  expenses.filter(e => e.status !== 'PAID' && e.dueDate).forEach(e => {
    const days = differenceInDays(new Date(), new Date(e.dueDate!));
    if (days <= 7)       aging.week     += e.amount;
    else if (days <= 14) aging.twoWeeks += e.amount;
    else if (days <= 30) aging.month    += e.amount;
    else                 aging.older    += e.amount;
  });
  const hasAging = Object.values(aging).some(v => v > 0);

  const handleMarkPaid = async (expenseId: string) => {
    setMarkingPaid(expenseId);
    try {
      await api.patch(`/expenses/${expenseId}/status`, { status: 'PAID' });
      setExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, status: 'PAID' as const, paymentDate: new Date().toISOString() } : e));
    } catch {
      alert('Kunde inte uppdatera status');
    } finally {
      setMarkingPaid(null);
    }
  };

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-brand-500" size={28} />
    </div>
  );

  if (!supplier) return (
    <div className="p-6 text-white/40 text-sm">Leverantören hittades inte.</div>
  );

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'all',        label: 'Alla' },
    { key: 'ytd',        label: 'YTD' },
    { key: 'this_month', label: 'Denna månad' },
    { key: 'last_month', label: 'Förra månaden' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link to="/suppliers" className="btn-ghost p-2"><ArrowLeft size={18} /></Link>
          <div className="w-11 h-11 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-300 font-semibold text-lg flex-shrink-0">
            {supplier.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">{supplier.name}</h1>
            {supplier.businessId && <p className="text-sm text-white/40">{supplier.businessId}</p>}
          </div>
        </div>
        <Link to={`/suppliers/${id}/edit`} className="btn-secondary">
          <Pencil size={14} /> Redigera
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: info + aging */}
        <div className="space-y-4">
          {/* Contact card */}
          <div className="card space-y-3">
            <h2 className="text-xs font-medium text-white/40 uppercase tracking-wide">Kontaktuppgifter</h2>
            {supplier.email && (
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Mail size={14} className="text-white/30" /> {supplier.email}
              </div>
            )}
            {supplier.phone && (
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Phone size={14} className="text-white/30" /> {supplier.phone}
              </div>
            )}
            {(supplier.address || supplier.city) && (
              <div className="flex items-start gap-2 text-sm text-white/70">
                <MapPin size={14} className="text-white/30 mt-0.5 flex-shrink-0" />
                <span>{[supplier.address, supplier.postalCode, supplier.city].filter(Boolean).join(', ')}</span>
              </div>
            )}
            {!supplier.email && !supplier.phone && !supplier.address && (
              <p className="text-xs text-white/25">Inga kontaktuppgifter</p>
            )}
          </div>

          {/* KPIs */}
          <div className="card space-y-3">
            <h2 className="text-xs font-medium text-white/40 uppercase tracking-wide">Ekonomi</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Totalt köpt</span>
                <span className="text-white font-medium">{fmt(totalSpend)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Utestående</span>
                <span className={`font-medium ${pendingAmount > 0 ? 'text-amber-400' : 'text-white/30'}`}>
                  {pendingAmount > 0 ? fmt(pendingAmount) : '—'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Antal utgifter</span>
                <span className="text-white/60">{expenses.length} st</span>
              </div>
            </div>
          </div>

          {/* Aging analysis */}
          {hasAging && (
            <div className="card space-y-3">
              <h2 className="text-xs font-medium text-white/40 uppercase tracking-wide">Åldersanalys (utestående)</h2>
              <div className="space-y-2">
                {[
                  { label: '≤ 7 dagar', value: aging.week,     color: 'text-emerald-400' },
                  { label: '8–14 dagar', value: aging.twoWeeks, color: 'text-yellow-400' },
                  { label: '15–30 dagar', value: aging.month,   color: 'text-amber-400' },
                  { label: '> 30 dagar', value: aging.older,    color: 'text-red-400' },
                ].filter(r => r.value > 0).map(r => (
                  <div key={r.label} className="flex justify-between text-sm">
                    <span className="text-white/50">{r.label}</span>
                    <span className={`font-medium ${r.color}`}>{fmt(r.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: expense table */}
        <div className="lg:col-span-2 space-y-3">
          {/* Period filter */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white/70">Utgifter</h2>
            <div className="flex gap-1">
              {PERIODS.map(p => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    period === p.key
                      ? 'bg-brand-600/20 text-brand-300'
                      : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-white/30 text-sm">
                Inga utgifter för vald period
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-4 py-3 text-left text-xs text-white/40 uppercase tracking-wide">Datum</th>
                    <th className="px-4 py-3 text-left text-xs text-white/40 uppercase tracking-wide">Beskrivning</th>
                    <th className="px-4 py-3 text-left text-xs text-white/40 uppercase tracking-wide hidden sm:table-cell">Förfaller</th>
                    <th className="px-4 py-3 text-right text-xs text-white/40 uppercase tracking-wide">Belopp</th>
                    <th className="px-4 py-3 text-center text-xs text-white/40 uppercase tracking-wide">Status</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filtered.map(e => (
                    <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-xs text-white/40 whitespace-nowrap">
                        {format(new Date(e.date), 'd MMM yyyy', { locale: sv })}
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/expenses/${e.id}`} className="text-sm text-white hover:text-brand-300 transition-colors">
                          {e.description}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs hidden sm:table-cell">
                        {e.dueDate ? (
                          <span className={differenceInDays(new Date(), new Date(e.dueDate)) > 0 && e.status !== 'PAID' ? 'text-red-400' : 'text-white/40'}>
                            {format(new Date(e.dueDate), 'd MMM', { locale: sv })}
                          </span>
                        ) : <span className="text-white/20">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-white">
                        {fmt(e.amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[e.status] || STATUS_STYLES.PENDING}`}>
                          {e.status === 'PAID' ? <CheckCircle size={10} /> : <Clock size={10} />}
                          {STATUS_LABELS[e.status] || e.status}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        {e.status !== 'PAID' && (
                          <button
                            onClick={() => handleMarkPaid(e.id)}
                            disabled={markingPaid === e.id}
                            title="Markera som betald"
                            className="p-1.5 rounded-lg text-white/20 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                          >
                            {markingPaid === e.id
                              ? <Loader2 size={13} className="animate-spin" />
                              : <CheckCircle size={13} />
                            }
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/5 bg-white/[0.02]">
                    <td colSpan={3} className="px-4 py-3 text-xs text-white/40">
                      {filtered.length} utgifter
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-white">
                      {fmt(filtered.reduce((s, e) => s + e.amount, 0))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
