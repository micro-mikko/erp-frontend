import { useEffect, useState } from 'react';
import { Tag, TrendingUp, TrendingDown, BarChart3, Loader2 } from 'lucide-react';
import { api } from '../api/client';
import type { Invoice, Expense, Category } from '../api/types';

function fmt(n: number) {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function pct(part: number, total: number) {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

interface DimRow {
  categoryId: string;
  subcategoryId: string;
  categoryName: string;
  subcategoryName: string;
  amount: number;
  count: number;
}

function buildDimRows(
  items: { categoryId?: string; subcategoryId?: string; amount: number }[],
  categories: Category[]
): DimRow[] {
  const map = new Map<string, DimRow>();
  for (const item of items) {
    if (!item.categoryId) continue;
    const key = `${item.categoryId}::${item.subcategoryId ?? ''}`;
    const cat = categories.find(c => c.id === item.categoryId);
    const sub = cat?.subcategories.find(s => s.id === item.subcategoryId);
    const existing = map.get(key);
    if (existing) {
      existing.amount += item.amount;
      existing.count += 1;
    } else {
      map.set(key, {
        categoryId: item.categoryId,
        subcategoryId: item.subcategoryId ?? '',
        categoryName: cat?.name ?? item.categoryId,
        subcategoryName: sub?.name ?? '',
        amount: item.amount,
        count: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
}

function DimBar({ amount, total, color }: { amount: number; total: number; color: string }) {
  const width = pct(amount, total);
  return (
    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mt-1.5">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function DimTable({
  title,
  rows,
  total,
  icon: Icon,
  barColor,
}: {
  title: string;
  rows: DimRow[];
  total: number;
  icon: React.ElementType;
  barColor: string;
}) {
  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-brand-400" />
          <h2 className="text-sm font-semibold text-white">{title}</h2>
        </div>
        <span className="text-sm font-semibold text-white/70">{fmt(total)}</span>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-8 text-white/20 text-sm">
          Inga poster med dimension ännu
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(row => (
            <div key={`${row.categoryId}::${row.subcategoryId}`}>
              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-white/70">{row.subcategoryName || row.categoryName}</span>
                  {row.subcategoryName && (
                    <span className="text-white/30 text-xs ml-1.5">({row.categoryName})</span>
                  )}
                  <span className="ml-2 text-xs text-white/25">{row.count} poster</span>
                </div>
                <div className="text-right">
                  <span className="text-white font-medium">{fmt(row.amount)}</span>
                  <span className="ml-2 text-xs text-white/30">{pct(row.amount, total)}%</span>
                </div>
              </div>
              <DimBar amount={row.amount} total={total} color={barColor} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DimensionsContent() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Invoice[]>('/invoices'),
      api.get<Expense[]>('/expenses'),
      api.get<Category[]>('/accounting/categories'),
    ]).then(([invs, exps, cats]) => {
      setInvoices(invs);
      setExpenses(exps);
      setCategories(cats);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="animate-spin text-brand-500" size={28} />
    </div>
  );

  // Revenue: flatten invoice lines from sent/paid invoices
  const revenueLines = invoices
    .filter(inv => inv.status === 'sent' || inv.status === 'paid')
    .flatMap(inv => (inv.lines ?? []).map(l => ({
      categoryId: l.categoryId,
      subcategoryId: l.subcategoryId,
      amount: l.amount ?? 0,
    })));

  // Revenue: all lines (including uncategorised) for totals
  const totalRevenue = invoices
    .filter(inv => inv.status === 'sent' || inv.status === 'paid')
    .reduce((s, inv) => s + inv.total, 0);
  const categorisedRevenue = revenueLines.filter(l => l.categoryId).reduce((s, l) => s + l.amount, 0);
  const uncategorisedRevenue = totalRevenue - categorisedRevenue;

  // Cost: expenses
  const totalCosts = expenses.reduce((s, e) => s + e.amount, 0);
  const categorisedCosts = expenses.filter(e => e.categoryId).reduce((s, e) => s + e.amount, 0);
  const uncategorisedCosts = totalCosts - categorisedCosts;

  const revenueRows = buildDimRows(revenueLines, categories);
  const costRows = buildDimRows(expenses, categories);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs text-white/40 uppercase tracking-wide">Total intäkt</p>
          <p className="text-2xl font-semibold text-white mt-2">{fmt(totalRevenue)}</p>
          <p className="text-xs text-white/30 mt-1">
            {fmt(categorisedRevenue)} kategoriserat
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-white/40 uppercase tracking-wide">Totala kostnader</p>
          <p className="text-2xl font-semibold text-white mt-2">{fmt(totalCosts)}</p>
          <p className="text-xs text-white/30 mt-1">
            {fmt(categorisedCosts)} kategoriserat
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-white/40 uppercase tracking-wide">Resultat</p>
          <p className={`text-2xl font-semibold mt-2 ${totalRevenue - totalCosts >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmt(totalRevenue - totalCosts)}
          </p>
          <p className="text-xs text-white/30 mt-1">Intäkter minus kostnader</p>
        </div>
        <div className="card">
          <p className="text-xs text-white/40 uppercase tracking-wide">Ej kategoriserat</p>
          <p className="text-2xl font-semibold text-white/50 mt-2">
            {fmt(uncategorisedRevenue + uncategorisedCosts)}
          </p>
          <p className="text-xs text-white/30 mt-1">Saknar dimension</p>
        </div>
      </div>

      {/* Intäkter alltid ovanför Kostnader */}
      <div className="grid grid-cols-1 gap-5">
        <DimTable
          title="Intäkter per intäktsslag"
          rows={revenueRows}
          total={categorisedRevenue}
          icon={TrendingUp}
          barColor="bg-emerald-500"
        />
        <DimTable
          title="Kostnader per kostnadsslag"
          rows={costRows}
          total={categorisedCosts}
          icon={TrendingDown}
          barColor="bg-orange-500"
        />
      </div>

      {/* Category reference */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-brand-400" />
          <h2 className="text-sm font-semibold text-white">Tillgängliga dimensioner</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map(cat => (
            <div key={cat.id} className="bg-surface-200/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Tag size={12} className="text-brand-400" />
                <span className="text-xs font-medium text-white">{cat.name}</span>
              </div>
              <div className="space-y-0.5">
                {cat.subcategories.map(sub => (
                  <div key={sub.id} className="text-xs text-white/40 pl-4">
                    › {sub.name}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
