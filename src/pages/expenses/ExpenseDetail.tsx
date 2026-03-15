import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Receipt, Tag, Loader2, FileText, Building2, BookOpen, CheckCircle, Clock } from 'lucide-react';
import { api } from '../../api/client';
import type { Expense, Category, Transaction } from '../../api/types';
import { getCategoryLabel } from '../../components/CategoryPicker';
import { format, startOfYear, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { sv } from 'date-fns/locale';

type PeriodFilter = 'all' | 'ytd' | 'this_month' | 'last_month';

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  all: 'Alla',
  ytd: 'YTD',
  this_month: 'Denna månaden',
  last_month: 'Förra månaden',
};

function inPeriod(dateStr: string, period: PeriodFilter): boolean {
  if (period === 'all') return true;
  const date = new Date(dateStr);
  const now = new Date();
  if (period === 'ytd') return date >= startOfYear(now);
  if (period === 'this_month') return date >= startOfMonth(now) && date <= endOfMonth(now);
  if (period === 'last_month') {
    const prev = subMonths(now, 1);
    return date >= startOfMonth(prev) && date <= endOfMonth(prev);
  }
  return true;
}

function fmt(n: number) {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'EUR' }).format(n);
}

function PeriodPills({ value, onChange }: { value: PeriodFilter; onChange: (p: PeriodFilter) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            value === p
              ? 'bg-brand-600/30 text-brand-300'
              : 'text-white/30 hover:text-white/60 hover:bg-white/5'
          }`}
        >
          {PERIOD_LABELS[p]}
        </button>
      ))}
    </div>
  );
}

export default function ExpenseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supplierPeriod, setSupplierPeriod] = useState<PeriodFilter>('all');
  const [txnPeriod, setTxnPeriod] = useState<PeriodFilter>('all');
  const [markingPaid, setMarkingPaid] = useState(false);

  const handleMarkPaid = async () => {
    if (!id || !expense) return;
    setMarkingPaid(true);
    try {
      await api.patch(`/expenses/${id}/status`, { status: 'PAID' });
      setExpense(prev => prev ? { ...prev, status: 'PAID', paymentDate: new Date().toISOString() } : prev);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Kunde inte uppdatera status');
    } finally {
      setMarkingPaid(false);
    }
  };

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('Inget utgifts-ID');
      return;
    }
    Promise.all([
      api.get<Expense>(`/expenses/${id}`),
      api.get<Category[]>('/accounting/categories'),
      api.get<Expense[]>('/expenses'),
      api.get<Transaction[]>('/accounting/transactions'),
    ])
      .then(([exp, cats, exps, txns]) => {
        setExpense(exp);
        setCategories(cats);
        setAllExpenses(exps);
        setAllTransactions(txns);
      })
      .catch((err) => {
        setExpense(null);
        setError(err?.message ?? 'Kunde inte hämta utgift');
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-brand-500" size={28} />
      </div>
    );

  if (error || !expense)
    return (
      <div className="p-6 max-w-4xl">
        <Link to="/expenses" className="btn-ghost inline-flex items-center gap-2 mb-4">
          <ArrowLeft size={14} /> Tillbaka
        </Link>
        <div className="card p-6 text-center text-white/50">
          {error ?? 'Utgiften hittades inte'}
        </div>
      </div>
    );

  const dimensionLabel = getCategoryLabel(categories, expense.categoryId, expense.subcategoryId);

  const supplierExpenses = (expense.supplier
    ? allExpenses.filter(
        e => e.id !== expense.id &&
             e.supplier?.toLowerCase() === expense.supplier!.toLowerCase()
      )
    : []
  ).filter(e => inPeriod(e.date, supplierPeriod));

  const dimensionTransactions = (expense.categoryId
    ? allTransactions.filter(
        t => t.categoryId === expense.categoryId &&
             (expense.subcategoryId ? t.subcategoryId === expense.subcategoryId : true)
      )
    : []
  ).filter(t => inPeriod(t.date, txnPeriod));

  return (
    <div className="p-6 max-w-4xl space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/expenses" className="btn-ghost">
            <ArrowLeft size={14} /> Tillbaka
          </Link>
          <div className="w-10 h-10 rounded-full bg-orange-600/20 flex items-center justify-center text-orange-300 font-semibold">
            <Receipt size={18} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">{expense.description}</h1>
            <p className="text-white/40 text-sm mt-0.5">
              {format(new Date(expense.date), 'd MMMM yyyy', { locale: sv })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {expense.status !== 'PAID' ? (
            <button onClick={handleMarkPaid} disabled={markingPaid} className="btn-primary">
              {markingPaid ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Markera betald
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-sm font-medium">
              <CheckCircle size={14} /> Betald
            </span>
          )}
          <Link to={`/expenses/${id}/edit`} className="btn-secondary">
            <Edit size={14} /> Redigera
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card space-y-3">
          <h2 className="text-xs font-medium text-white/40 uppercase tracking-wide">Utgift</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Leverantör</span>
              <span className="text-white">{expense.supplier || '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Belopp</span>
              <span className="text-white font-semibold">{fmt(expense.amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Moms</span>
              <span className="text-white/80">
                {expense.vatAmount != null ? fmt(expense.vatAmount) : '—'}
              </span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-white/50">Status</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                expense.status === 'PAID'
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-amber-500/15 text-amber-400'
              }`}>
                {expense.status === 'PAID' ? <CheckCircle size={10} /> : <Clock size={10} />}
                {expense.status === 'PAID' ? 'Betald' : 'Utestående'}
              </span>
            </div>
            {expense.dueDate && (
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Förfallodatum</span>
                <span className={`${
                  expense.status !== 'PAID' && new Date(expense.dueDate) < new Date()
                    ? 'text-red-400 font-medium'
                    : 'text-white/80'
                }`}>
                  {format(new Date(expense.dueDate), 'd MMM yyyy', { locale: sv })}
                  {expense.status !== 'PAID' && new Date(expense.dueDate) < new Date() && ' · Förfallen'}
                </span>
              </div>
            )}
            {expense.paymentDate && (
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Betalningsdatum</span>
                <span className="text-white/80">
                  {format(new Date(expense.paymentDate), 'd MMM yyyy', { locale: sv })}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="card space-y-3">
          <h2 className="text-xs font-medium text-white/40 uppercase tracking-wide flex items-center gap-2">
            <Tag size={12} className="text-brand-400" />
            Bokföring
          </h2>
          {dimensionLabel ? (
            <p className="text-sm text-white/80">
              Bokförd under dimension: <span className="text-brand-300 font-medium">{dimensionLabel}</span>
            </p>
          ) : (
            <p className="text-sm text-white/40">Ingen dimension vald</p>
          )}
        </div>
      </div>

      {expense.receiptUrl && (
        <div className="card">
          <h2 className="text-xs font-medium text-white/40 uppercase tracking-wide mb-2 flex items-center gap-2">
            <FileText size={12} />
            Kvitto
          </h2>
          <a
            href={expense.receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-400 hover:text-brand-300 text-sm"
          >
            Öppna kvitto →
          </a>
        </div>
      )}

      {/* Sektion 1: Alla utgifter från samma leverantör */}
      {expense.supplier && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xs font-medium text-white/40 uppercase tracking-wide flex items-center gap-2">
              <Building2 size={12} className="text-brand-400" />
              Alla utgifter — {expense.supplier}
            </h2>
            <PeriodPills value={supplierPeriod} onChange={setSupplierPeriod} />
          </div>

          {supplierExpenses.length === 0 ? (
            <p className="text-sm text-white/30">Inga utgifter för vald period</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/30 text-xs border-b border-white/[0.06]">
                  <th className="text-left pb-2 font-medium">Datum</th>
                  <th className="text-left pb-2 font-medium">Beskrivning</th>
                  <th className="text-left pb-2 font-medium">Dimension</th>
                  <th className="text-right pb-2 font-medium">Belopp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {supplierExpenses.map(e => (
                  <tr
                    key={e.id}
                    className="table-row-hover cursor-pointer"
                    onClick={() => navigate(`/expenses/${e.id}`)}
                  >
                    <td className="py-2 text-white/50">
                      {format(new Date(e.date), 'd MMM yyyy', { locale: sv })}
                    </td>
                    <td className="py-2 text-white/80">{e.description}</td>
                    <td className="py-2 text-white/40 text-xs">
                      {getCategoryLabel(categories, e.categoryId, e.subcategoryId) || '—'}
                    </td>
                    <td className="py-2 text-right text-white font-medium">{fmt(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10">
                  <td colSpan={3} className="pt-2 text-xs text-white/30">
                    Totalt {supplierExpenses.length} utgifter
                  </td>
                  <td className="pt-2 text-right text-white font-semibold">
                    {fmt(supplierExpenses.reduce((s, e) => s + e.amount, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {/* Sektion 2: Bokföring under samma dimension */}
      {expense.categoryId && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xs font-medium text-white/40 uppercase tracking-wide flex items-center gap-2">
              <BookOpen size={12} className="text-brand-400" />
              Bokföring — {dimensionLabel || expense.categoryId}
            </h2>
            <PeriodPills value={txnPeriod} onChange={setTxnPeriod} />
          </div>

          {dimensionTransactions.length === 0 ? (
            <p className="text-sm text-white/30">Inga verifikationer för vald period</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/30 text-xs border-b border-white/[0.06]">
                  <th className="text-left pb-2 font-medium">Datum</th>
                  <th className="text-left pb-2 font-medium">Vernr</th>
                  <th className="text-left pb-2 font-medium">Beskrivning</th>
                  <th className="text-right pb-2 font-medium">Debet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {dimensionTransactions.map(t => {
                  const debitTotal = t.lines.reduce((s, l) => s + l.debit, 0);
                  return (
                    <tr key={t.id} className="hover:bg-white/[0.02]">
                      <td className="py-2 text-white/50">
                        {format(new Date(t.date), 'd MMM yyyy', { locale: sv })}
                      </td>
                      <td className="py-2 text-white/40 font-mono text-xs">{t.voucherNumber}</td>
                      <td className="py-2 text-white/80">{t.description}</td>
                      <td className="py-2 text-right text-white font-medium">{fmt(debitTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10">
                  <td colSpan={3} className="pt-2 text-xs text-white/30">
                    Totalt {dimensionTransactions.length} verifikationer
                    {allTransactions.length >= 100 && ' (max 100 visas)'}
                  </td>
                  <td className="pt-2 text-right text-white font-semibold">
                    {fmt(dimensionTransactions.reduce(
                      (s, t) => s + t.lines.reduce((ls, l) => ls + l.debit, 0), 0
                    ))}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
