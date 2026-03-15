import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Clock, AlertCircle,
  FileText, ArrowRight, Loader2, Percent, Users,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '../api/client';
import DimensionsContent from './Dimensions';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { buildPeriods, getPeriod } from '../utils/periods';
import type {
  DashboardKPIs, TrendPoint, AgingBucket,
  CategoryExpense, TopCustomer, PeriodKey,
} from '../api/types';
import type { Invoice } from '../api/types';

// ─── Konstanter ───────────────────────────────────────────────────────────────

const CHART_COLORS = ['#4f6ef7', '#f97316', '#10b981', '#a855f7', '#06b6d4', '#f59e0b', '#ec4899', '#64748b'];

function fmt(n: number) {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

// ─── Hjälpkomponenter ─────────────────────────────────────────────────────────

function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-200 border border-white/10 rounded-lg px-3 py-2 shadow-xl text-xs">
      {label && <p className="text-white/40 mb-1.5">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-medium" style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: number;
  changePercent?: number;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  positiveDirection?: 'up' | 'down';
  loading?: boolean;
}

function KpiCard({ label, value, changePercent, subtitle, icon, iconBg, positiveDirection = 'up', loading }: KpiCardProps) {
  if (loading) {
    return (
      <div className="stat-card animate-pulse">
        <div className="h-3 bg-white/5 rounded w-20 mb-3" />
        <div className="h-8 bg-white/5 rounded w-32 mb-2" />
        <div className="h-3 bg-white/5 rounded w-24" />
      </div>
    );
  }
  const hasDelta = changePercent !== undefined;
  const isGood   = positiveDirection === 'up' ? (changePercent ?? 0) >= 0 : (changePercent ?? 0) <= 0;

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white/40 uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>{icon}</div>
      </div>
      <div>
        <p className="text-2xl font-semibold text-white mt-1">{fmt(value)}</p>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-white/30">{subtitle}</p>
          {hasDelta && changePercent !== 0 && (
            <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${isGood ? 'text-emerald-400' : 'text-red-400'}`}>
              {isGood ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {Math.abs(changePercent!).toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function PeriodSelector({
  selected, onChange, customFrom, customTo, onCustomChange,
}: {
  selected: PeriodKey;
  onChange: (k: PeriodKey) => void;
  customFrom: string; customTo: string;
  onCustomChange: (f: string, t: string) => void;
}) {
  const periods = buildPeriods();
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {periods.map(p => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            selected === p.key
              ? 'bg-brand-600/20 border-brand-500/40 text-brand-300'
              : 'border-white/10 text-white/40 hover:text-white/80 hover:border-white/20'
          }`}
        >
          {p.label}
        </button>
      ))}
      <button
        onClick={() => onChange('custom')}
        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
          selected === 'custom'
            ? 'bg-brand-600/20 border-brand-500/40 text-brand-300'
            : 'border-white/10 text-white/40 hover:text-white/80 hover:border-white/20'
        }`}
      >
        Anpassad
      </button>
      {selected === 'custom' && (
        <div className="flex items-center gap-2 ml-1">
          <input
            type="date" value={customFrom}
            onChange={e => onCustomChange(e.target.value, customTo)}
            className="bg-surface-200 border border-white/10 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <span className="text-white/20 text-xs">–</span>
          <input
            type="date" value={customTo}
            onChange={e => onCustomChange(customFrom, e.target.value)}
            className="bg-surface-200 border border-white/10 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string>    = { draft: 'badge-draft', sent: 'badge-sent', paid: 'badge-paid' };
  const labels: Record<string, string> = { draft: 'Utkast', sent: 'Skickad', paid: 'Betald' };
  return <span className={map[status] || 'badge-draft'}>{labels[status] || status}</span>;
}

// ─── Huvud-komponent ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const [periodKey,   setPeriodKey]   = useState<PeriodKey>('ytd');
  const [customFrom,  setCustomFrom]  = useState('');
  const [customTo,    setCustomTo]    = useState('');

  const [kpis,           setKpis]           = useState<DashboardKPIs | null>(null);
  const [trend,          setTrend]          = useState<TrendPoint[]>([]);
  const [aging,          setAging]          = useState<AgingBucket[]>([]);
  const [categories,     setCategories]     = useState<CategoryExpense[]>([]);
  const [topCustomers,   setTopCustomers]   = useState<TopCustomer[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);

  const [loadingKpis,   setLoadingKpis]   = useState(true);
  const [loadingStatic, setLoadingStatic] = useState(true);

  const [view, setView] = useState<'dashboard' | 'dimensioner'>('dashboard');

  const { from, to } = getPeriod(periodKey, customFrom, customTo);
  const qs = `?from=${from}&to=${to}`;

  // Period-beroende data
  const fetchPeriodData = useCallback(() => {
    if (periodKey === 'custom' && (!customFrom || !customTo)) return;
    setLoadingKpis(true);
    Promise.all([
      api.get<DashboardKPIs>(`/dashboard/kpis${qs}`),
      api.get<CategoryExpense[]>(`/dashboard/expenses-by-category${qs}`),
      api.get<TopCustomer[]>(`/dashboard/top-customers${qs}`),
    ])
      .then(([k, c, t]) => { setKpis(k); setCategories(c); setTopCustomers(t); })
      .catch(console.error)
      .finally(() => setLoadingKpis(false));
  }, [qs, periodKey, customFrom, customTo]);

  // Period-oberoende data (hämtas en gång vid montering)
  useEffect(() => {
    setLoadingStatic(true);
    Promise.all([
      api.get<TrendPoint[]>('/dashboard/trend'),
      api.get<AgingBucket[]>('/dashboard/aging'),
      api.get<{ recentInvoices: Invoice[] }>('/dashboard'),
    ])
      .then(([t, a, d]) => { setTrend(t); setAging(a); setRecentInvoices(d.recentInvoices ?? []); })
      .catch(console.error)
      .finally(() => setLoadingStatic(false));
  }, []);

  useEffect(() => { fetchPeriodData(); }, [fetchPeriodData]);

  const urgentAging = aging.filter(b => b.isUrgent && b.amount > 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl">

      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white">Dashboard</h1>
            <p className="text-white/40 text-sm mt-0.5">
              {format(new Date(), "EEEE d MMMM yyyy", { locale: sv })}
            </p>
          </div>
          {/* Pill-toggle – direkt bredvid rubriken */}
          <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
            {(['dashboard', 'dimensioner'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  view === v ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
                }`}
              >
                {v === 'dashboard' ? 'Dashboard' : 'Dimensioner'}
              </button>
            ))}
          </div>
        </div>
        {/* PeriodSelector – visas bara i Dashboard-vyn */}
        {view === 'dashboard' && (
          <PeriodSelector
            selected={periodKey}
            onChange={setPeriodKey}
            customFrom={customFrom}
            customTo={customTo}
            onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }}
          />
        )}
      </div>

      {view === 'dimensioner' ? (
        <DimensionsContent />
      ) : (<>

      {/* ─── KPI-kort (4 kolumner) ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          loading={loadingKpis}
          label="Fakturerat"
          value={kpis?.revenue.current ?? 0}
          changePercent={kpis?.revenue.changePercent}
          subtitle={`${kpis?.revenue.invoiceCount ?? 0} betalda fakturor`}
          icon={<TrendingUp size={15} className="text-emerald-400" />}
          iconBg="bg-emerald-500/10"
          positiveDirection="up"
        />
        <KpiCard
          loading={loadingKpis}
          label="Utestående"
          value={kpis?.outstanding.current ?? 0}
          subtitle={`${kpis?.outstanding.count ?? 0} fakturor väntar`}
          icon={<Clock size={15} className="text-brand-400" />}
          iconBg="bg-brand-500/10"
        />
        <KpiCard
          loading={loadingKpis}
          label="Utgifter"
          value={kpis?.expenses.current ?? 0}
          changePercent={kpis?.expenses.changePercent}
          subtitle={`${kpis?.expenses.count ?? 0} registrerade`}
          icon={<AlertCircle size={15} className="text-orange-400" />}
          iconBg="bg-orange-500/10"
          positiveDirection="down"
        />
        <KpiCard
          loading={loadingKpis}
          label="Resultat"
          value={kpis?.profit.current ?? 0}
          changePercent={kpis?.profit.changePercent}
          subtitle={`${(kpis?.profit?.marginPercent ?? 0).toFixed(1)}% marginal`}
          icon={<Percent size={15} className="text-violet-400" />}
          iconBg="bg-violet-500/10"
          positiveDirection="up"
        />
      </div>

      {/* ─── Omsättningstrend (full bredd) ──────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Omsättningstrend</h2>
            <p className="text-xs text-white/30 mt-0.5">12 månader rullande — fakturerat vs utgifter</p>
          </div>
          {loadingStatic && <Loader2 size={14} className="animate-spin text-white/20" />}
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={trend} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#4f6ef7" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#4f6ef7" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradExp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f97316" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={n => `${(n / 1000).toFixed(0)}k`} />
            <Tooltip content={<DarkTooltip />} />
            <Area type="monotone" dataKey="revenue"  name="Fakturerat" stroke="#4f6ef7" strokeWidth={2} fill="url(#gradRev)" dot={false} />
            <Area type="monotone" dataKey="expenses" name="Utgifter"   stroke="#f97316" strokeWidth={2} fill="url(#gradExp)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ─── Aging + Kategorifördelning (2 kolumner) ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Förfalloanalys */}
        <div className="card">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h2 className="text-sm font-semibold text-white">Förfalloanalys (Aging)</h2>
              <p className="text-xs text-white/30 mt-0.5">Utestående fakturor per åldersgrupp</p>
            </div>
            {loadingStatic && <Loader2 size={14} className="animate-spin text-white/20" />}
          </div>
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={aging} layout="vertical" margin={{ left: 0, right: 40, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={n => `${(n / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="label" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                  axisLine={false} tickLine={false} width={82} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="amount" name="Belopp" radius={[0, 4, 4, 0]}>
                  {aging.map((entry, i) => (
                    <Cell key={i} fill={entry.isUrgent ? '#ef4444' : '#4f6ef7'} fillOpacity={entry.isUrgent ? 0.85 : 0.65} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {urgentAging.length > 0 && (
            <div className="mt-3 space-y-1 border-t border-white/5 pt-3">
              {urgentAging.map(b => (
                <div key={b.days} className="flex items-center gap-2 text-xs text-red-400">
                  <AlertCircle size={11} />
                  <span>{b.label}: <span className="font-semibold">{fmt(b.amount)}</span> ({b.count} fakturor)</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Utgifter per kategori */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Utgifter per kategori</h2>
              <p className="text-xs text-white/30 mt-0.5">Vald period</p>
            </div>
            {loadingKpis && <Loader2 size={14} className="animate-spin text-white/20" />}
          </div>
          {categories.length === 0 && !loadingKpis ? (
            <p className="text-xs text-white/20 text-center py-8">Inga utgifter i perioden</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={150} height={150}>
                <PieChart>
                  <Pie data={categories} cx="50%" cy="50%" innerRadius={42} outerRadius={72}
                    dataKey="amount" nameKey="categoryName" paddingAngle={2}>
                    {categories.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<DarkTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2 min-w-0">
                {categories.slice(0, 7).map((c, i) => (
                  <div key={c.categoryId} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-white/60 flex-1 truncate">{c.categoryName}</span>
                    <span className="text-white/40 flex-shrink-0">{(c.percentage ?? 0).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Topp 5 kunder (full bredd) ─────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Users size={14} className="text-brand-400" />
            Topp 5 kunder
          </h2>
          {loadingKpis && <Loader2 size={14} className="animate-spin text-white/20" />}
        </div>
        {topCustomers.length === 0 && !loadingKpis ? (
          <p className="text-xs text-white/20 text-center py-6">Inga betalda fakturor i perioden</p>
        ) : (
          <ResponsiveContainer width="100%" height={topCustomers.length * 44 + 20}>
            <BarChart data={topCustomers} layout="vertical" margin={{ left: 0, right: 60, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={n => `${(n / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="customerName" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                axisLine={false} tickLine={false} width={140} />
              <Tooltip content={<DarkTooltip />} />
              <Bar dataKey="revenue" name="Omsättning" fill="#4f6ef7" fillOpacity={0.75} radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ─── Senaste fakturor ────────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <FileText size={15} className="text-brand-400" />
            Senaste fakturor
          </h2>
          <Link to="/invoices" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
            Visa alla <ArrowRight size={12} />
          </Link>
        </div>

        {loadingStatic ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 bg-white/[0.03] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : recentInvoices.length === 0 ? (
          <div className="text-center py-10 text-white/30">
            <FileText size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Inga fakturor ännu</p>
            <Link to="/invoices/new" className="text-brand-400 hover:text-brand-300 text-xs mt-2 inline-block">
              Skapa din första faktura →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-white/30 border-b border-white/5">
                  <th className="pb-2 font-medium">Nr</th>
                  <th className="pb-2 font-medium">Kund</th>
                  <th className="pb-2 font-medium">Datum</th>
                  <th className="pb-2 font-medium text-right">Belopp</th>
                  <th className="pb-2 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {recentInvoices.map(inv => (
                  <tr key={inv.id} className="table-row-hover">
                    <td className="py-2.5">
                      <Link to={`/invoices/${inv.id}`} className="text-brand-400 hover:text-brand-300 font-mono text-xs">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="py-2.5 text-white/70">{inv.customer?.name ?? '—'}</td>
                    <td className="py-2.5 text-white/40 text-xs">
                      {format(new Date(inv.issueDate), 'd MMM yyyy', { locale: sv })}
                    </td>
                    <td className="py-2.5 text-right font-medium">{fmt(inv.total)}</td>
                    <td className="py-2.5 text-right">
                      <StatusBadge status={inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      </>)}
    </div>
  );
}
