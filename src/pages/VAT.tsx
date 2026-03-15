import { useEffect, useState, useCallback } from 'react';
import { Calculator, Download, ExternalLink, Loader2, Send, CheckCircle, Clock, X } from 'lucide-react';
import { api } from '../api/client';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

interface VatReport {
  period: string;
  salesVat: number;
  purchaseVat: number;
  netVat: number;
  byRate?: Array<{ rate: number; net: number; vat: number }>;
  invoices?: Array<{
    invoiceNumber: string;
    vatAmount: number;
    total: number;
    customer?: { name: string };
  }>;
}

interface VatReportRecord {
  id: string;
  periodFrom: string;
  periodTo: string;
  salesVat: number;
  purchaseVat: number;
  netVat: number;
  status: 'SUBMITTED' | 'PAID';
  closingVoucher?: string;
  paymentVoucher?: string;
  submittedAt: string;
  paidAt?: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'EUR' }).format(n);
}

function fmtRate(r: number) {
  return `${r}%`;
}

function fmtDate(d: string) {
  return format(new Date(d), 'd MMM yyyy', { locale: sv });
}

const MONTHS = [
  'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December',
];

type PeriodMode = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

/** Format a local Date as YYYY-MM-DD without UTC conversion */
function localDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function getPeriodDatesByMode(year: number, month: number, quarter: number, mode: PeriodMode) {
  if (mode === 'QUARTERLY') {
    const startMonth = (quarter - 1) * 3; // Q1→0, Q2→3, Q3→6, Q4→9
    const from = new Date(year, startMonth, 1);
    const to   = new Date(year, startMonth + 3, 0); // last day of quarter
    return { from: localDateStr(from), to: localDateStr(to) };
  }
  if (mode === 'YEARLY') {
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }
  // MONTHLY
  const from = new Date(year, month, 1);
  const to   = new Date(year, month + 1, 0);
  return { from: localDateStr(from), to: localDateStr(to) };
}

function getPeriodTitle(year: number, month: number, quarter: number, mode: PeriodMode): string {
  if (mode === 'QUARTERLY') return `Q${quarter} ${year}`;
  if (mode === 'YEARLY')    return `${year}`;
  return `${MONTHS[month]} ${year}`;
}

/** Returns true if the from–to interval matches the company's vatReportingPeriod */
function isPeriodValid(from: string, to: string, vatPeriod: string): boolean {
  const f = new Date(from);
  const t = new Date(to);
  const lastDayOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const normalised = vatPeriod.toUpperCase();

  if (normalised === 'MONTHLY') {
    return f.getDate() === 1 &&
           f.getMonth() === t.getMonth() &&
           f.getFullYear() === t.getFullYear() &&
           t.getDate() === lastDayOfMonth(t);
  }
  if (normalised === 'QUARTERLY') {
    const quarterStarts = [0, 3, 6, 9];
    return quarterStarts.includes(f.getMonth()) &&
           f.getDate() === 1 &&
           t.getFullYear() === f.getFullYear() &&
           t.getMonth() === f.getMonth() + 2 &&
           t.getDate() === lastDayOfMonth(t);
  }
  if (normalised === 'YEARLY') {
    return f.getMonth() === 0 && f.getDate() === 1 &&
           t.getMonth() === 11 && t.getDate() === 31 &&
           t.getFullYear() === f.getFullYear();
  }
  return true;
}

function periodLabel(vatPeriod: string): string {
  const n = vatPeriod.toUpperCase();
  if (n === 'MONTHLY') return 'månads';
  if (n === 'QUARTERLY') return 'kvartals';
  if (n === 'YEARLY') return 'års';
  return '';
}

export default function VAT() {
  const now = new Date();
  const [periodMode, setPeriodMode] = useState<PeriodMode>('MONTHLY');
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedQuarter, setSelectedQuarter] = useState<number>(Math.floor(now.getMonth() / 3) + 1);
  const [report, setReport] = useState<VatReport | null>(null);
  const [loading, setLoading] = useState(true);

  // History & submission state
  const [history, setHistory] = useState<VatReportRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [vatPeriod, setVatPeriod] = useState<string>('MONTHLY');
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState<string | null>(null); // id being paid
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { from, to } = getPeriodDatesByMode(selectedYear, selectedMonth, selectedQuarter, periodMode);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await api.get<VatReportRecord[]>('/vat/history');
      setHistory(data);
    } catch {
      // non-fatal
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Load company settings for vatReportingPeriod
  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/settings', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        setVatPeriod((data.vatReportingPeriod ?? 'MONTHLY').toUpperCase());
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setReport(null);
    api.get<VatReport>(`/vat/report?from=${from}&to=${to}`)
      .then(setReport)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const exportCSV = () => {
    if (!report?.invoices) return;
    const header = ['Fakturanr', 'Kund', 'Netto (EUR)', 'Moms (EUR)', 'Totalt (EUR)'];
    const rows = report.invoices.map(inv => [
      inv.invoiceNumber,
      inv.customer?.name ?? '',
      (inv.total - inv.vatAmount).toFixed(2).replace('.', ','),
      inv.vatAmount.toFixed(2).replace('.', ','),
      inv.total.toFixed(2).replace('.', ','),
    ]);
    const csv = [header, ...rows].map(r => r.join(';')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `moms-${from}-${to}.csv`,
    });
    a.click();
  };

  const handleSubmit = async () => {
    if (!report) return;
    setSubmitting(true);
    setConfirmOpen(false);
    try {
      const res = await api.post<{ vatReport: VatReportRecord; voucherNumber: string }>('/vat/submit', {
        from, to,
        salesVat: report.salesVat,
        purchaseVat: report.purchaseVat,
        netVat: report.netVat,
      });
      showToast(`Momsanmälan skickad. Stängningsverifikat ${res.voucherNumber} skapades.`);
      await loadHistory();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Kunde inte skicka momsanmälan');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePay = async (reportId: string) => {
    setPaying(reportId);
    try {
      const res = await api.post<{ vatReport: VatReportRecord; voucherNumber: string }>(`/vat/reports/${reportId}/pay`, {});
      showToast(`Betalning registrerad. Verifikat ${res.voucherNumber} skapades.`);
      await loadHistory();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Kunde inte registrera betalning');
    } finally {
      setPaying(null);
    }
  };

  const years = [0, 1, 2, 3].map(i => now.getFullYear() - i);

  const periodAlreadySubmitted = history.some(r =>
    r.periodFrom.startsWith(from) || r.periodTo.startsWith(to) ||
    (new Date(r.periodFrom) <= new Date(from) && new Date(r.periodTo) >= new Date(to))
  );
  const periodValid = isPeriodValid(from, to, vatPeriod);
  const canSubmit = !!report && periodValid && !periodAlreadySubmitted;

  return (
    <div className="p-6 space-y-5 max-w-4xl">

      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-surface-100 px-4 py-3 text-sm text-emerald-300 shadow-lg">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-white/30 hover:text-white/60">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Confirm modal */}
      {confirmOpen && report && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-2xl border border-white/10 bg-surface-100 p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <h2 className="text-base font-semibold text-white">Bekräfta momsanmälan</h2>
            <p className="text-sm text-white/50">
              Du håller på att anmäla moms för perioden{' '}
              <span className="text-white font-medium">
                {getPeriodTitle(selectedYear, selectedMonth, selectedQuarter, periodMode)}
              </span>.
              Ett stängningsverifikat (DR 2939 / CR 2940 / 2930) skapas automatiskt.
            </p>
            <div className="rounded-xl bg-white/5 p-3 space-y-1 text-sm">
              <div className="flex justify-between text-white/60">
                <span>Utgående moms</span><span className="text-emerald-400">{fmt(report.salesVat)}</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>Ingående moms</span><span className="text-orange-400">{fmt(report.purchaseVat)}</span>
              </div>
              <div className="flex justify-between font-semibold text-white border-t border-white/10 pt-1 mt-1">
                <span>{report.netVat > 0 ? 'Att betala' : 'Att återfå'}</span>
                <span className={report.netVat > 0 ? 'text-red-400' : 'text-emerald-400'}>
                  {fmt(Math.abs(report.netVat))}
                </span>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/60 hover:bg-white/5 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-400 disabled:opacity-50 transition-colors"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Bekräfta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header + Period selector */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Momsredovisning</h1>
          <p className="text-white/40 text-sm mt-0.5">
            {getPeriodTitle(selectedYear, selectedMonth, selectedQuarter, periodMode)} ·{' '}
            {format(new Date(from), 'd MMM', { locale: sv })} –{' '}
            {format(new Date(to), 'd MMM yyyy', { locale: sv })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Segmented mode control */}
          <div className="flex rounded-lg border border-white/10 p-0.5 bg-surface-200">
            {(['MONTHLY', 'QUARTERLY', 'YEARLY'] as const).map(m => (
              <button
                key={m}
                onClick={() => setPeriodMode(m)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                  ${periodMode === m ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}
              >
                {m === 'MONTHLY' ? 'Månad' : m === 'QUARTERLY' ? 'Kvartal' : 'År'}
              </button>
            ))}
          </div>

          {/* Year dropdown — always visible */}
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="bg-surface-200 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Month dropdown — MONTHLY mode only */}
          {periodMode === 'MONTHLY' && (
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="bg-surface-200 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          )}

          {/* Quarter dropdown — QUARTERLY mode only */}
          {periodMode === 'QUARTERLY' && (
            <select
              value={selectedQuarter}
              onChange={e => setSelectedQuarter(Number(e.target.value))}
              className="bg-surface-200 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {[1, 2, 3, 4].map(q => <option key={q} value={q}>Q{q}</option>)}
            </select>
          )}

          {/* Submit button */}
          <div className="relative group">
            <button
              onClick={() => canSubmit && setConfirmOpen(true)}
              disabled={!canSubmit || submitting}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors
                ${canSubmit
                  ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                  : 'bg-white/5 text-white/30 cursor-not-allowed'
                }`}
            >
              {submitting
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />
              }
              {periodAlreadySubmitted ? 'Redan anmäld' : 'Anmäl till Vero.fi'}
            </button>
            {!canSubmit && !periodAlreadySubmitted && report && (
              <div className="absolute right-0 top-full mt-1.5 w-64 rounded-lg border border-white/10 bg-surface-100 px-3 py-2 text-xs text-white/50 shadow-xl hidden group-hover:block z-10">
                Välj ett fullständigt {periodLabel(vatPeriod)}intervall för att anmäla.
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-brand-500" size={28} />
        </div>
      ) : !report ? (
        <div className="card text-center py-12 text-white/30">
          <Calculator size={36} className="mx-auto mb-3 opacity-30" />
          <p>Ingen momsdata tillgänglig</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card border border-emerald-500/10">
              <p className="text-xs text-white/40 uppercase tracking-wide">Utgående moms</p>
              <p className="text-2xl font-semibold text-emerald-400 mt-1">{fmt(report.salesVat)}</p>
              <p className="text-xs text-white/30 mt-1">Från försäljning</p>
            </div>
            <div className="card border border-orange-500/10">
              <p className="text-xs text-white/40 uppercase tracking-wide">Ingående moms</p>
              <p className="text-2xl font-semibold text-orange-400 mt-1">{fmt(report.purchaseVat)}</p>
              <p className="text-xs text-white/30 mt-1">Från inköp</p>
            </div>
            <div className={`card ${report.netVat > 0 ? 'border border-red-500/20 bg-red-500/5' : 'border border-emerald-500/20 bg-emerald-500/5'}`}>
              <p className="text-xs text-white/40 uppercase tracking-wide">Att betala / återfå</p>
              <p className={`text-2xl font-semibold mt-1 ${report.netVat > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {fmt(Math.abs(report.netVat))}
              </p>
              <p className="text-xs text-white/30 mt-1">
                {report.netVat > 0 ? 'Att betala till Skatteverket' : 'Återbetalning'}
              </p>
            </div>
          </div>

          {/* Per-rate breakdown */}
          {report.byRate && report.byRate.length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-white mb-4">Uppdelning per momssats</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-white/30 border-b border-white/5">
                    <th className="pb-2 font-medium">Momssats</th>
                    <th className="pb-2 font-medium text-right">Nettoomsättning</th>
                    <th className="pb-2 font-medium text-right">Utgående moms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {report.byRate.map(({ rate, net, vat }) => (
                    <tr key={rate} className="hover:bg-white/[0.02]">
                      <td className="py-2.5">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-brand-500/60" />
                          <span className="text-white font-medium">{fmtRate(rate)}</span>
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-white/60">{fmt(net)}</td>
                      <td className="py-2.5 text-right text-emerald-400 font-medium">{fmt(vat)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-white/10">
                    <td className="pt-2.5 text-xs text-white/40 font-medium uppercase tracking-wide">Totalt</td>
                    <td className="pt-2.5 text-right text-white font-semibold">
                      {fmt(report.byRate.reduce((s, r) => s + r.net, 0))}
                    </td>
                    <td className="pt-2.5 text-right text-emerald-400 font-semibold">{fmt(report.salesVat)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* OmaVero guide */}
          <div className="card border border-violet-500/20 bg-violet-500/5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-violet-400" />
                  Periodskattedeklaration — OmaVero
                </h2>
                <p className="text-xs text-white/40 mt-1 ml-4">
                  Ange dessa värden i OmaVero under "Periodskattedeklaration"
                </p>
              </div>
              <a
                href="https://www.vero.fi/omavero"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                Öppna OmaVero <ExternalLink size={11} />
              </a>
            </div>

            <div className="mt-4 space-y-3 ml-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div>
                  <p className="text-sm text-white">Utgående moms</p>
                  <p className="text-xs text-white/30 mt-0.5">Finska: <span className="font-mono">Vero kotimaan myynneistä</span></p>
                </div>
                <p className="text-lg font-semibold text-emerald-400 font-mono">{fmt(report.salesVat)}</p>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div>
                  <p className="text-sm text-white">Avdragbar ingående moms</p>
                  <p className="text-xs text-white/30 mt-0.5">Finska: <span className="font-mono">Vähennettävä vero</span></p>
                </div>
                <p className="text-lg font-semibold text-orange-400 font-mono">{fmt(report.purchaseVat)}</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {report.netVat > 0 ? 'Moms att betala' : 'Momsåterbetalning'}
                  </p>
                  <p className="text-xs text-white/30 mt-0.5">
                    Finska: <span className="font-mono">
                      {report.netVat > 0 ? 'Maksettava vero' : 'Palautukseen oikeuttava vero'}
                    </span>
                  </p>
                </div>
                <p className={`text-xl font-bold font-mono ${report.netVat > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {fmt(Math.abs(report.netVat))}
                </p>
              </div>
            </div>

            <p className="text-xs text-white/20 mt-4 ml-4">
              * Kontrollera att alla fakturor och utgifter för perioden är registrerade innan du lämnar in deklarationen.
            </p>
          </div>

          {/* Export button */}
          {report.invoices && report.invoices.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={exportCSV}
                className="btn-secondary flex items-center gap-2"
              >
                <Download size={14} />
                Exportera CSV (underlag)
              </button>
            </div>
          )}

          {/* Invoice list */}
          {report.invoices && report.invoices.length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-white mb-4">
                Fakturor i perioden ({report.invoices.length} st)
              </h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-white/30 border-b border-white/5">
                    <th className="pb-2 font-medium">Fakturanr</th>
                    <th className="pb-2 font-medium">Kund</th>
                    <th className="pb-2 font-medium text-right">Momsbelopp</th>
                    <th className="pb-2 font-medium text-right">Totalt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {report.invoices.map((inv, i) => (
                    <tr key={i} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 font-mono text-xs text-brand-400">{inv.invoiceNumber}</td>
                      <td className="py-2.5 text-white/70">{inv.customer?.name ?? '—'}</td>
                      <td className="py-2.5 text-right text-white/60">{fmt(inv.vatAmount)}</td>
                      <td className="py-2.5 text-right font-medium text-white">{fmt(inv.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── VAT History ─────────────────────────────────────────────────────── */}
      <div className="card">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-white/40" />
          Tidigare momsanmälningar
        </h2>

        {historyLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="animate-spin text-white/30" size={20} />
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-white/30 text-center py-6">
            Inga anmälningar ännu.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-white/30 border-b border-white/5">
                <th className="pb-2 font-medium">Period</th>
                <th className="pb-2 font-medium text-right">Utg. moms</th>
                <th className="pb-2 font-medium text-right">Ing. moms</th>
                <th className="pb-2 font-medium text-right">Att betala</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Verifikat</th>
                <th className="pb-2 font-medium">Anmält</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {history.map(r => (
                <tr key={r.id} className="hover:bg-white/[0.02]">
                  <td className="py-2.5 text-white/80">
                    {fmtDate(r.periodFrom)} – {fmtDate(r.periodTo)}
                  </td>
                  <td className="py-2.5 text-right text-emerald-400">{fmt(r.salesVat)}</td>
                  <td className="py-2.5 text-right text-orange-400">{fmt(r.purchaseVat)}</td>
                  <td className={`py-2.5 text-right font-medium ${r.netVat >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {fmt(Math.abs(r.netVat))}
                  </td>
                  <td className="py-2.5">
                    {r.status === 'PAID' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                        <CheckCircle className="w-3 h-3" /> Betald
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
                        <Clock className="w-3 h-3" /> Anmäld
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 font-mono text-xs text-brand-400">
                    {r.closingVoucher ?? '—'}
                    {r.paymentVoucher && (
                      <span className="block text-white/30">{r.paymentVoucher}</span>
                    )}
                  </td>
                  <td className="py-2.5 text-white/40 text-xs">{fmtDate(r.submittedAt)}</td>
                  <td className="py-2.5 text-right">
                    {r.status === 'SUBMITTED' && (
                      <button
                        onClick={() => handlePay(r.id)}
                        disabled={paying === r.id}
                        className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60
                                   hover:bg-white/10 hover:text-white disabled:opacity-40 transition-colors"
                      >
                        {paying === r.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <CheckCircle className="w-3 h-3" />
                        }
                        Markera betald
                      </button>
                    )}
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
