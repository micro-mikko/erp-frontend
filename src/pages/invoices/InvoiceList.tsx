import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, FileText, Search, Loader2, Download,
  ChevronUp, ChevronDown, TrendingUp, Clock, AlertCircle,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '../../api/client';
import type { Invoice } from '../../api/types';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { sv } from 'date-fns/locale';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function fmtK(n: number) {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return String(Math.round(n));
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-200 border border-white/10 rounded-lg px-3 py-2 shadow-xl text-xs">
      {label && <p className="text-white/40 mb-1.5">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-medium" style={{ color: p.color || p.fill }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Chart data builders (client-side, no extra API calls) ───────────────────

function buildMonthlyTrend(invoices: Invoice[]): { month: string; total: number }[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d     = subMonths(now, 11 - i);
    const start = startOfMonth(d);
    const end   = endOfMonth(d);
    const total = invoices
      .filter(inv => {
        if (inv.status === 'draft') return false;
        const dt = new Date(inv.issueDate);
        return dt >= start && dt <= end;
      })
      .reduce((s, inv) => s + inv.total, 0);
    return { month: format(d, 'MMM yy', { locale: sv }), total };
  });
}

function buildStatusData(invoices: Invoice[]): { name: string; value: number; color: string }[] {
  const paid  = invoices.filter(i => i.status === 'paid').reduce((s, i)  => s + i.total, 0);
  const sent  = invoices.filter(i => i.status === 'sent').reduce((s, i)  => s + i.total, 0);
  const draft = invoices.filter(i => i.status === 'draft').reduce((s, i) => s + i.total, 0);
  return [
    { name: 'Betald',  value: paid,  color: '#10b981' },
    { name: 'Skickad', value: sent,  color: '#4f6ef7' },
    { name: 'Utkast',  value: draft, color: 'rgba(255,255,255,0.18)' },
  ].filter(d => d.value > 0);
}

function buildAgingData(invoices: Invoice[]): { bucket: string; amount: number; color: string }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sent = invoices.filter(i => i.status === 'sent');
  if (sent.length === 0) return [];

  const buckets = [
    { label: 'Ej förfallet',  min: -Infinity, max: 0,         color: '#10b981' },
    { label: '1–30 dagar',    min: 1,          max: 30,        color: '#f59e0b' },
    { label: '31–60 dagar',   min: 31,         max: 60,        color: '#f97316' },
    { label: '61+ dagar',     min: 61,         max: Infinity,  color: '#ef4444' },
  ];

  return buckets.map(b => {
    const amount = sent
      .filter(inv => {
        const ref  = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.issueDate);
        const days = Math.floor((today.getTime() - ref.getTime()) / 86_400_000);
        return days >= b.min && days <= b.max;
      })
      .reduce((s, inv) => s + inv.total, 0);
    return { bucket: b.label, amount, color: b.color };
  }).filter(b => b.amount > 0);
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string>    = { draft: 'badge-draft', sent: 'badge-sent', paid: 'badge-paid' };
  const labels: Record<string, string> = { draft: 'Utkast', sent: 'Skickad', paid: 'Betald' };
  return <span className={map[status] || 'badge-draft'}>{labels[status] || status}</span>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InvoiceList() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [sortKey, setSortKey]   = useState<'invoiceNumber' | 'customer' | 'issueDate' | 'dueDate' | 'total' | 'status'>('issueDate');
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('desc');
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };
  const SortIcon = ({ column }: { column: typeof sortKey }) =>
    sortKey !== column ? null : sortDir === 'asc'
      ? <ChevronUp size={12} className="inline ml-0.5 opacity-60" />
      : <ChevronDown size={12} className="inline ml-0.5 opacity-60" />;

  const downloadPdf = async (inv: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    setPdfLoading(inv.id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/invoices/${inv.id}/pdf?lang=sv`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `faktura-${inv.invoiceNumber}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ } finally {
      setPdfLoading(null);
    }
  };

  useEffect(() => {
    api.get<Invoice[]>('/invoices').then(setInvoices).catch(console.error).finally(() => setLoading(false));
  }, []);

  // ─── Derived chart / KPI data ────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const paidInvoices  = invoices.filter(inv => inv.status === 'paid');
  const sentInvoices  = invoices.filter(inv => inv.status === 'sent');
  const overdueInvs   = sentInvoices.filter(inv => inv.dueDate && new Date(inv.dueDate) < today);

  const totalPaid     = paidInvoices.reduce((s, inv) => s + inv.total, 0);
  const totalOutstand = sentInvoices.reduce((s, inv) => s + inv.total, 0);
  const totalOverdue  = overdueInvs.reduce((s, inv) => s + inv.total, 0);

  const monthlyTrend  = loading ? [] : buildMonthlyTrend(invoices);
  const statusData    = loading ? [] : buildStatusData(invoices);
  const agingData     = loading ? [] : buildAgingData(invoices);

  // ─── Table filtering & sorting ───────────────────────────────────────────
  const filtered = invoices.filter(inv =>
    inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
    inv.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
    fmt(inv.total).toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'invoiceNumber': cmp = (a.invoiceNumber || '').localeCompare(b.invoiceNumber || ''); break;
      case 'customer':      cmp = (a.customer?.name || '').localeCompare(b.customer?.name || ''); break;
      case 'issueDate':     cmp = new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime(); break;
      case 'dueDate':       cmp = (a.dueDate ? new Date(a.dueDate).getTime() : 0) - (b.dueDate ? new Date(b.dueDate).getTime() : 0); break;
      case 'total':         cmp = a.total - b.total; break;
      case 'status':        cmp = (a.status || '').localeCompare(b.status || ''); break;
      default: break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return (
    <div className="p-6 space-y-5 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Fakturor</h1>
          <p className="text-white/40 text-sm mt-0.5">{invoices.length} fakturor totalt</p>
        </div>
        <Link to="/invoices/new" className="btn-primary">
          <Plus size={16} /> Ny faktura
        </Link>
      </div>

      {/* ─── KPI cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Betalt */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-white/40 uppercase tracking-wide">Betalt</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp size={14} className="text-emerald-400" />
            </div>
          </div>
          {loading
            ? <div className="h-7 bg-white/5 rounded animate-pulse mb-1" />
            : <p className="text-2xl font-semibold text-white">{fmt(totalPaid)}</p>
          }
          <p className="text-xs text-white/30 mt-1">{paidInvoices.length} betalda fakturor</p>
        </div>

        {/* Utestående */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-white/40 uppercase tracking-wide">Utestående</span>
            <div className="w-7 h-7 rounded-lg bg-brand-500/10 flex items-center justify-center">
              <Clock size={14} className="text-brand-400" />
            </div>
          </div>
          {loading
            ? <div className="h-7 bg-white/5 rounded animate-pulse mb-1" />
            : <p className="text-2xl font-semibold text-white">{fmt(totalOutstand)}</p>
          }
          <p className="text-xs text-white/30 mt-1">{sentInvoices.length} skickade fakturor</p>
        </div>

        {/* Förfallna */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-white/40 uppercase tracking-wide">Förfallna</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${totalOverdue > 0 ? 'bg-red-500/10' : 'bg-white/5'}`}>
              <AlertCircle size={14} className={totalOverdue > 0 ? 'text-red-400' : 'text-white/20'} />
            </div>
          </div>
          {loading
            ? <div className="h-7 bg-white/5 rounded animate-pulse mb-1" />
            : <p className={`text-2xl font-semibold ${totalOverdue > 0 ? 'text-red-400' : 'text-white'}`}>{fmt(totalOverdue)}</p>
          }
          <p className="text-xs text-white/30 mt-1">{overdueInvs.length} förfallna fakturor</p>
        </div>
      </div>

      {/* ─── Charts (only when data available) ─────────────────────────────── */}
      {!loading && invoices.length > 0 && (
        <>
          {/* Monthly trend + donut */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Monthly AreaChart — 2/3 */}
            <div className="card lg:col-span-2">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-white">Fakturerat per månad</h2>
                <p className="text-xs text-white/30 mt-0.5">Senaste 12 månader (exkl. utkast)</p>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={monthlyTrend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="invListGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#4f6ef7" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#4f6ef7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                    axisLine={false} tickLine={false}
                    tickFormatter={fmtK}
                  />
                  <Tooltip content={<DarkTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Fakturerat"
                    stroke="#4f6ef7"
                    strokeWidth={2}
                    fill="url(#invListGrad)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Status donut — 1/3 */}
            <div className="card">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-white">Statusfördelning</h2>
                <p className="text-xs text-white/30 mt-0.5">Fördelning efter belopp</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="relative">
                  <ResponsiveContainer width={150} height={150}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%" cy="50%"
                        innerRadius={45} outerRadius={70}
                        dataKey="value"
                        paddingAngle={2}
                      >
                        {statusData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<DarkTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Centre label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-bold text-white">{invoices.length}</span>
                    <span className="text-[10px] text-white/30">fakturor</span>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5 w-full">
                  {statusData.map(d => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-white/50 flex-1">{d.name}</span>
                      <span className="text-white/70 font-medium">{fmt(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Aging analysis — only when there are outstanding invoices */}
          {agingData.length > 0 && (
            <div className="card">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-white">Utestående per ålder</h2>
                <p className="text-xs text-white/30 mt-0.5">Skickade fakturor grupperade efter förfallodatum</p>
              </div>
              <ResponsiveContainer width="100%" height={agingData.length * 44 + 20}>
                <BarChart data={agingData} layout="vertical" margin={{ left: 0, right: 70, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                    axisLine={false} tickLine={false}
                    tickFormatter={fmtK}
                  />
                  <YAxis
                    type="category"
                    dataKey="bucket"
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                    axisLine={false} tickLine={false}
                    width={95}
                  />
                  <Tooltip content={<DarkTooltip />} />
                  <Bar dataKey="amount" name="Belopp" radius={[0, 4, 4, 0]}>
                    {agingData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          className="input pl-9"
          placeholder="Sök fakturanr, kund..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-brand-500" size={28} />
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <FileText size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Inga fakturor hittades</p>
            <Link to="/invoices/new" className="text-brand-400 hover:text-brand-300 text-xs mt-2 inline-block">
              Skapa din första faktura →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-white/30 border-b border-white/5 bg-surface-100/50">
                <th className="px-5 py-3 font-medium">
                  <button type="button" onClick={() => toggleSort('invoiceNumber')} className="hover:text-white/60 transition-colors">Fakturanr</button>
                  <SortIcon column="invoiceNumber" />
                </th>
                <th className="px-5 py-3 font-medium">
                  <button type="button" onClick={() => toggleSort('customer')} className="hover:text-white/60 transition-colors">Kund</button>
                  <SortIcon column="customer" />
                </th>
                <th className="px-5 py-3 font-medium">
                  <button type="button" onClick={() => toggleSort('issueDate')} className="hover:text-white/60 transition-colors">Datum</button>
                  <SortIcon column="issueDate" />
                </th>
                <th className="px-5 py-3 font-medium">
                  <button type="button" onClick={() => toggleSort('dueDate')} className="hover:text-white/60 transition-colors">Förfallodatum</button>
                  <SortIcon column="dueDate" />
                </th>
                <th className="px-5 py-3 font-medium text-right">
                  <button type="button" onClick={() => toggleSort('total')} className="hover:text-white/60 transition-colors ml-auto block w-full text-right">Totalt</button>
                  <SortIcon column="total" />
                </th>
                <th className="px-5 py-3 font-medium text-right">
                  <button type="button" onClick={() => toggleSort('status')} className="hover:text-white/60 transition-colors ml-auto block w-full text-right">Status</button>
                  <SortIcon column="status" />
                </th>
                <th className="px-3 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {sorted.map(inv => (
                <tr
                  key={inv.id}
                  className="table-row-hover cursor-pointer"
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                >
                  <td className="px-5 py-3.5">
                    <span className="text-brand-400 font-mono text-xs font-medium">
                      {inv.invoiceNumber}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-white/80">{inv.customer?.name ?? '—'}</td>
                  <td className="px-5 py-3.5 text-white/40 text-xs">
                    {format(new Date(inv.issueDate), 'd MMM yyyy', { locale: sv })}
                  </td>
                  <td className="px-5 py-3.5 text-white/40 text-xs">
                    {inv.dueDate ? format(new Date(inv.dueDate), 'd MMM yyyy', { locale: sv }) : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium text-white">{fmt(inv.total)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-3 py-3.5 text-right">
                    <button
                      onClick={e => downloadPdf(inv, e)}
                      disabled={pdfLoading === inv.id}
                      title="Ladda ned PDF"
                      className="p-1 rounded text-white/25 hover:text-white/70 hover:bg-white/5 transition-colors disabled:opacity-40"
                    >
                      {pdfLoading === inv.id
                        ? <Loader2 size={13} className="animate-spin" />
                        : <Download size={13} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
