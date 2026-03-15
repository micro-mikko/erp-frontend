import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Loader2, TrendingUp, Users, Calendar, Repeat } from 'lucide-react';
import { api } from '../api/client';
import type { Subscription } from '../api/types';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

function fmt(n: number) {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'EUR' }).format(n);
}

function computeMRR(sub: Subscription): number {
  const lineTotal = (sub.lines ?? []).reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  if (sub.billingFrequency === 'MONTHLY') return lineTotal;
  if (sub.billingFrequency === 'QUARTERLY') return lineTotal / 3;
  return lineTotal / 12;
}

const FREQ_LABELS: Record<string, string> = {
  MONTHLY: 'Månadsvis',
  QUARTERLY: 'Kvartalsvis',
  ANNUALLY: 'Årsvis',
};

const TIMING_LABELS: Record<string, string> = {
  IN_ADVANCE: 'I förskott',
  IN_ARREARS: 'I efterskott',
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-500/20 text-green-400',
  PAUSED: 'bg-yellow-500/20 text-yellow-400',
  CANCELLED: 'bg-red-500/20 text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Aktiv',
  PAUSED: 'Pausad',
  CANCELLED: 'Avslutad',
};

export default function Subscriptions() {
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ACTIVE');

  const load = () => {
    api.get<Subscription[]>('/subscriptions')
      .then(setSubscriptions)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateMsg('');
    try {
      const data = await api.post<{ message: string; created: number }>('/subscriptions/generate', {});
      setGenerateMsg(data.message);
      load();
    } catch {
      setGenerateMsg('Fel vid generering av fakturor.');
    } finally {
      setGenerating(false);
    }
  };

  const activeSubs = subscriptions.filter(s => s.status === 'ACTIVE');
  const totalMRR = activeSubs.reduce((s, sub) => s + computeMRR(sub), 0);
  const totalARR = totalMRR * 12;

  const filtered = filterStatus === 'ALL'
    ? subscriptions
    : subscriptions.filter(s => s.status === filterStatus);

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Prenumerationer</h1>
          <p className="text-white/40 text-sm mt-0.5">Recurring Revenue — automatisk fakturering</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-secondary disabled:opacity-50"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Generera fakturor nu
          </button>
          <button
            onClick={() => navigate('/invoices/subscriptions/new')}
            className="btn-primary"
          >
            <Plus size={16} />
            Ny prenumeration
          </button>
        </div>
      </div>

      {generateMsg && (
        <div className="px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-300">
          {generateMsg}
        </div>
      )}

      {/* MRR cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-500/10 rounded-lg"><TrendingUp size={18} className="text-green-400" /></div>
            <span className="text-sm font-medium text-white/40">MRR (Monthly Recurring Revenue)</span>
          </div>
          <p className="text-2xl font-bold text-white">{fmt(totalMRR)}</p>
          <p className="text-xs text-white/30 mt-1">Normaliserat till månadsbas</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/10 rounded-lg"><Calendar size={18} className="text-blue-400" /></div>
            <span className="text-sm font-medium text-white/40">ARR (Annual Recurring Revenue)</span>
          </div>
          <p className="text-2xl font-bold text-white">{fmt(totalARR)}</p>
          <p className="text-xs text-white/30 mt-1">MRR × 12</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-500/10 rounded-lg"><Users size={18} className="text-purple-400" /></div>
            <span className="text-sm font-medium text-white/40">Aktiva prenumerationer</span>
          </div>
          <p className="text-2xl font-bold text-white">{activeSubs.length}</p>
          <p className="text-xs text-white/30 mt-1">av totalt {subscriptions.length}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[['ALL', 'Alla'], ['ACTIVE', 'Aktiva'], ['PAUSED', 'Pausade'], ['CANCELLED', 'Avslutade']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilterStatus(val)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === val
                ? 'bg-brand-600 text-white'
                : 'text-white/40 hover:text-white/70 hover:bg-white/5'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-brand-500" size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <Repeat size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Inga prenumerationer hittades</p>
            <button
              onClick={() => navigate('/invoices/subscriptions/new')}
              className="text-brand-400 hover:text-brand-300 text-xs mt-2 inline-block"
            >
              Skapa din första prenumeration →
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-white/30 border-b border-white/5 bg-surface-100/50">
                <th className="px-5 py-3 font-medium">Kund</th>
                <th className="px-5 py-3 font-medium">Prenumeration</th>
                <th className="px-5 py-3 font-medium">Tjänster</th>
                <th className="px-4 py-3 font-medium">Frekvens</th>
                <th className="px-4 py-3 font-medium">Timing</th>
                <th className="px-4 py-3 font-medium">Nästa faktura</th>
                <th className="px-4 py-3 font-medium text-right">MRR</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map(sub => {
                const lines = sub.lines ?? [];
                const firstLine = lines[0]?.description ?? '—';
                const moreCount = lines.length - 1;
                const serviceLabel = lines.length === 0 ? '—' : moreCount > 0 ? `${firstLine} +${moreCount} till` : firstLine;
                const nextDate = format(new Date(sub.nextInvoicingDate), 'd MMM yyyy', { locale: sv });
                const mrr = computeMRR(sub);
                return (
                  <tr
                    key={sub.id}
                    onClick={() => navigate(`/invoices/subscriptions/${sub.id}`)}
                    className="table-row-hover cursor-pointer"
                  >
                    <td className="px-5 py-3.5 text-white/80 font-medium">{sub.customer?.name ?? '—'}</td>
                    <td className="px-5 py-3.5 text-white/70">{sub.name}</td>
                    <td className="px-5 py-3.5 text-white/40 max-w-[200px] truncate">{serviceLabel}</td>
                    <td className="px-4 py-3.5 text-white/50">{FREQ_LABELS[sub.billingFrequency]}</td>
                    <td className="px-4 py-3.5 text-white/50">{TIMING_LABELS[sub.billingTiming]}</td>
                    <td className="px-4 py-3.5 text-white/50">{nextDate}</td>
                    <td className="px-4 py-3.5 text-right font-medium text-white/80">{fmt(mrr)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[sub.status] ?? ''}`}>
                        {STATUS_LABELS[sub.status] ?? sub.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
