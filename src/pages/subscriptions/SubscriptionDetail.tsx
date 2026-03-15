import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Pause, Play, XCircle, Loader2,
  Calendar, User, RefreshCw, FileText, ChevronRight
} from 'lucide-react';
import { api } from '../../api/client';
import type { Subscription } from '../../api/types';
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

export default function SubscriptionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    if (!id) return;
    api.get<Subscription>(`/subscriptions/${id}`)
      .then(setSub)
      .catch(() => setError('Prenumerationen hittades inte'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const changeStatus = async (status: string) => {
    if (!id) return;
    setStatusLoading(true);
    try {
      const updated = await api.patch<Subscription>(`/subscriptions/${id}/status`, { status });
      setSub(updated);
    } catch {
      setError('Kunde inte uppdatera status');
    } finally {
      setStatusLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin text-brand-500" />
    </div>
  );

  if (error || !sub) return (
    <div className="p-6">
      <p className="text-red-400">{error || 'Prenumerationen hittades inte'}</p>
      <button onClick={() => navigate('/invoices/subscriptions')} className="mt-2 text-sm text-brand-400 hover:text-brand-300">
        Tillbaka
      </button>
    </div>
  );

  const lines = sub.lines ?? [];
  const invoices = sub.invoices ?? [];
  const lineTotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const mrr = computeMRR(sub);

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      {/* Back + header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/invoices/subscriptions')} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <ArrowLeft size={18} className="text-white/50" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-white">{sub.name}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[sub.status]}`}>
                {STATUS_LABELS[sub.status]}
              </span>
            </div>
            <p className="text-sm text-white/40">{sub.customer?.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {sub.status !== 'CANCELLED' && (
            <>
              <button
                onClick={() => navigate(`/invoices/subscriptions/${id}/edit`)}
                className="btn-secondary"
              >
                <Pencil size={14} /> Redigera
              </button>
              {sub.status === 'ACTIVE' ? (
                <button
                  onClick={() => changeStatus('PAUSED')}
                  disabled={statusLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-yellow-500/30 rounded-lg text-sm text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-50 transition-colors"
                >
                  <Pause size={14} /> Pausa
                </button>
              ) : (
                <button
                  onClick={() => changeStatus('ACTIVE')}
                  disabled={statusLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-green-500/30 rounded-lg text-sm text-green-400 hover:bg-green-500/10 disabled:opacity-50 transition-colors"
                >
                  <Play size={14} /> Återaktivera
                </button>
              )}
              <button
                onClick={() => { if (confirm('Avsluta prenumerationen?')) changeStatus('CANCELLED'); }}
                disabled={statusLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/30 rounded-lg text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
              >
                <XCircle size={14} /> Avsluta
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column: info + lines + invoices */}
        <div className="lg:col-span-2 space-y-5">
          {/* Subscription info */}
          <div className="card p-5">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-4">Prenumerationsdetaljer</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-white/40">
                <User size={13} />
                <span>Kund</span>
              </div>
              <div className="text-white font-medium">{sub.customer?.name}</div>

              {sub.customer?.email && (
                <>
                  <div className="text-white/40 pl-5">E-post</div>
                  <div className="text-white/60">{sub.customer.email}</div>
                </>
              )}

              <div className="flex items-center gap-2 text-white/40">
                <RefreshCw size={13} />
                <span>Frekvens</span>
              </div>
              <div className="text-white/80">{FREQ_LABELS[sub.billingFrequency]}</div>

              <div className="text-white/40 pl-5">Timing</div>
              <div className="text-white/80">{TIMING_LABELS[sub.billingTiming]}</div>

              <div className="flex items-center gap-2 text-white/40">
                <Calendar size={13} />
                <span>Startdatum</span>
              </div>
              <div className="text-white/80">{format(new Date(sub.startDate), 'd MMM yyyy', { locale: sv })}</div>

              {sub.endDate && (
                <>
                  <div className="text-white/40 pl-5">Slutdatum</div>
                  <div className="text-white/80">{format(new Date(sub.endDate), 'd MMM yyyy', { locale: sv })}</div>
                </>
              )}

              <div className="text-white/40 pl-5">Nästa faktura</div>
              <div className="text-white font-medium">
                {format(new Date(sub.nextInvoicingDate), 'd MMM yyyy', { locale: sv })}
              </div>
            </div>
          </div>

          {/* Services / lines */}
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wide">Tjänster & priser</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-white/30 border-b border-white/5 bg-surface-100/50">
                  <th className="px-5 py-3 font-medium">Beskrivning</th>
                  <th className="px-4 py-3 font-medium text-right">Antal</th>
                  <th className="px-4 py-3 font-medium text-right">À-pris</th>
                  <th className="px-4 py-3 font-medium text-right">Moms</th>
                  <th className="px-5 py-3 font-medium text-right">Belopp/period</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {lines.map(line => {
                  const net = line.quantity * line.unitPrice;
                  const vat = net * (line.vatRate / 100);
                  return (
                    <tr key={line.id}>
                      <td className="px-5 py-3 text-white/80">{line.description}</td>
                      <td className="px-4 py-3 text-right text-white/50">{line.quantity}</td>
                      <td className="px-4 py-3 text-right text-white/50">{fmt(line.unitPrice)}</td>
                      <td className="px-4 py-3 text-right text-white/40">{line.vatRate}%</td>
                      <td className="px-5 py-3 text-right font-medium text-white/80">{fmt(net + vat)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-white/[0.06] bg-white/[0.02]">
                <tr>
                  <td colSpan={4} className="px-5 py-3 text-sm text-white/40">
                    Totalt per {FREQ_LABELS[sub.billingFrequency].toLowerCase().replace('vis', 'period')}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-white">
                    {fmt(lines.reduce((s, l) => s + l.quantity * l.unitPrice * (1 + l.vatRate / 100), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Generated invoices */}
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
              <FileText size={15} className="text-white/30" />
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wide">
                Genererade fakturor ({invoices.length})
              </h2>
            </div>
            {invoices.length === 0 ? (
              <p className="px-5 py-8 text-sm text-white/30 text-center">Inga fakturor genererade ännu</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-white/30 border-b border-white/5 bg-surface-100/50">
                    <th className="px-5 py-3 font-medium">Fakturanr</th>
                    <th className="px-4 py-3 font-medium">Period</th>
                    <th className="px-4 py-3 font-medium">Datum</th>
                    <th className="px-4 py-3 font-medium text-right">Belopp</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="table-row-hover">
                      <td className="px-5 py-3">
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="text-brand-400 hover:text-brand-300 font-mono text-xs font-medium"
                          onClick={e => e.stopPropagation()}
                        >
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-white/40">
                        {inv.periodStart && inv.periodEnd
                          ? `${format(new Date(inv.periodStart), 'd MMM', { locale: sv })} – ${format(new Date(inv.periodEnd), 'd MMM yyyy', { locale: sv })}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-white/50">
                        {format(new Date(inv.issueDate), 'd MMM yyyy', { locale: sv })}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-white/80">{fmt(inv.total)}</td>
                      <td className="px-5 py-3">
                        <span className={`${inv.status === 'draft' ? 'badge-draft' : inv.status === 'sent' ? 'badge-sent' : 'badge-paid'}`}>
                          {inv.status === 'draft' ? 'Utkast' : inv.status === 'sent' ? 'Skickad' : 'Betald'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right column: MRR summary + quick links */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-4">Intäktsöversikt</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-white/30">MRR</p>
                <p className="text-xl font-bold text-white">{fmt(mrr)}</p>
              </div>
              <div>
                <p className="text-xs text-white/30">ARR</p>
                <p className="text-lg font-semibold text-white/70">{fmt(mrr * 12)}</p>
              </div>
              <div className="pt-2 border-t border-white/[0.06]">
                <p className="text-xs text-white/30">Nettovärde/period (ex. moms)</p>
                <p className="text-base font-medium text-white/80">{fmt(lineTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-white/30">Fakturor genererade totalt</p>
                <p className="text-base font-medium text-white/80">{invoices.length} st</p>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-3">Snabblänkar</h2>
            <div className="space-y-1">
              <button
                onClick={() => navigate(`/invoices/subscriptions/${id}/edit`)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
              >
                <span className="flex items-center gap-2"><Pencil size={14} /> Redigera prenumeration</span>
                <ChevronRight size={14} className="text-white/20" />
              </button>
              <Link
                to={`/customers/${sub.customerId}`}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
              >
                <span className="flex items-center gap-2"><User size={14} /> Visa kund</span>
                <ChevronRight size={14} className="text-white/20" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
