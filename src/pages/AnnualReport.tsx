import { useEffect, useState } from 'react';
import { FileDown, Loader2, BookMarked, ChevronDown, ChevronRight, AlertCircle, Wand2 } from 'lucide-react';
import { api } from '../api/client';
import type {
  AnnualReportData,
  AnnualReportSection,
  AnnualReportAccountLine,
} from '../api/types';

type Tab = 'income' | 'balance' | 'notes';

function fmt(n: number): string {
  if (n === 0) return '—';
  return new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(Math.round(n));
}

function fmtSigned(n: number): string {
  if (n === 0) return '—';
  return new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0, signDisplay: 'exceptZero' }).format(Math.round(n));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ColHeader({ year, prevYear }: { year: number; prevYear: number }) {
  return (
    <tr className="text-right text-xs text-white/30 border-b border-white/10">
      <td className="py-2 text-left text-white/40 font-medium pl-0">Post</td>
      <td className="py-2 w-32 pr-2 font-medium text-white/50">{year}</td>
      <td className="py-2 w-32 pr-0 text-white/30">{prevYear}</td>
    </tr>
  );
}

interface RowProps {
  label: string;
  subLabel?: string;
  cur: number;
  prev: number;
  bold?: boolean;
  indent?: number;
  negate?: boolean;
  highlight?: 'positive' | 'neutral';
  separator?: boolean;
}

function Row({ label, subLabel, cur, prev, bold = false, indent = 0, negate = false, highlight, separator }: RowProps) {
  const displayCur = negate ? -cur : cur;
  const displayPrev = negate ? -prev : prev;

  const baseRow = `${separator ? 'border-t border-white/10 pt-2' : ''}`;
  const textCls = bold
    ? 'font-semibold text-white text-sm'
    : 'text-white/70 text-sm';
  const valCls = bold ? 'font-semibold text-white' : 'text-white/60';
  const prevValCls = 'text-white/35';
  const highlightCls = highlight === 'positive'
    ? (displayCur >= 0 ? 'text-emerald-400' : 'text-red-400')
    : '';

  return (
    <tr className={`${baseRow} group`}>
      <td className={`py-1.5 ${textCls}`} style={{ paddingLeft: indent ? `${indent}px` : '0' }}>
        <span>{label}</span>
        {subLabel && (
          <span className="text-white/25 text-xs ml-1.5">({subLabel})</span>
        )}
      </td>
      <td className={`py-1.5 text-right w-32 pr-2 tabular-nums ${valCls} ${highlightCls}`}>
        {bold ? fmt(displayCur) : fmt(displayCur)}
      </td>
      <td className={`py-1.5 text-right w-32 pr-0 tabular-nums ${prevValCls}`}>
        {fmt(displayPrev)}
      </td>
    </tr>
  );
}

function SectionRows({ section, prevSection, indent = 16 }: {
  section: AnnualReportSection;
  prevSection: AnnualReportSection;
  indent?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (section.accounts.length === 0 && section.total === 0) return null;

  const getPrevNet = (acc: AnnualReportAccountLine) =>
    prevSection.accounts.find(b => b.accountNumber === acc.accountNumber)?.net ?? 0;

  return (
    <>
      {section.accounts.length > 1 && (
        <tr
          className="cursor-pointer hover:bg-white/[0.02] transition-colors"
          onClick={() => setExpanded(e => !e)}
        >
          <td colSpan={3} className="py-0.5">
            <span className="text-white/25 text-xs flex items-center gap-1 select-none" style={{ paddingLeft: `${indent}px` }}>
              {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              {expanded ? 'Dölj konton' : `Visa ${section.accounts.length} konton`}
            </span>
          </td>
        </tr>
      )}
      {(expanded || section.accounts.length === 1) && section.accounts.map(acc => (
        <tr key={acc.accountNumber} className="text-xs">
          <td className="py-0.5 text-white/35" style={{ paddingLeft: `${indent + 8}px` }}>
            <span className="font-mono text-white/25 mr-1.5">{acc.accountNumber}</span>
            {acc.nameSv}
            {acc.nameFi && <span className="text-white/20 ml-1">({acc.nameFi})</span>}
          </td>
          <td className="py-0.5 text-right pr-2 text-white/35 tabular-nums">{fmt(acc.net)}</td>
          <td className="py-0.5 text-right pr-0 text-white/20 tabular-nums">{fmt(getPrevNet(acc))}</td>
        </tr>
      ))}
    </>
  );
}

function Divider() {
  return (
    <tr>
      <td colSpan={3} className="py-0">
        <div className="border-t border-white/20 mt-1 mb-1" />
      </td>
    </tr>
  );
}

function ThickDivider() {
  return (
    <tr>
      <td colSpan={3} className="py-0">
        <div className="border-t-2 border-white/40 mt-0.5 mb-0.5" />
      </td>
    </tr>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function IncomeTab({ data }: { data: AnnualReportData }) {
  const is = data.current.incomeStatement;
  const ps = data.prev.incomeStatement;

  return (
    <table className="w-full text-sm border-separate border-spacing-0">
      <thead>
        <ColHeader year={data.year} prevYear={data.prevYear} />
      </thead>
      <tbody>
        {/* Revenue */}
        <Row label="Omsättning" subLabel="Liikevaihto" cur={is.revenue.total} prev={ps.revenue.total} />
        <SectionRows section={is.revenue} prevSection={ps.revenue} />

        {/* Costs */}
        <Row label="Material och tjänster" subLabel="Materiaalit ja palvelut" cur={is.cogs.total} prev={ps.cogs.total} negate indent={16} separator />
        <SectionRows section={is.cogs} prevSection={ps.cogs} />
        <Row label="Personalkostnader" subLabel="Henkilöstökulut" cur={is.personnel.total} prev={ps.personnel.total} negate indent={16} />
        <SectionRows section={is.personnel} prevSection={ps.personnel} />
        <Row label="Avskrivningar" subLabel="Poistot" cur={is.depreciation.total} prev={ps.depreciation.total} negate indent={16} />
        <SectionRows section={is.depreciation} prevSection={ps.depreciation} />
        <Row label="Övriga rörelsekostnader" subLabel="Liiketoiminnan muut kulut" cur={is.otherOperating.total} prev={ps.otherOperating.total} negate indent={16} />
        <SectionRows section={is.otherOperating} prevSection={ps.otherOperating} />

        <Divider />
        <Row label="RÖRELSERESULTAT" subLabel="Liikevoitto/-tappio" cur={is.operatingProfit} prev={ps.operatingProfit} bold highlight="positive" />

        {/* Financial */}
        {(is.financial.total !== 0 || ps.financial.total !== 0) && (
          <>
            <Row label="Finansiella poster" subLabel="Rahoitustuotot ja -kulut" cur={is.financial.total} prev={ps.financial.total} indent={16} separator />
            <SectionRows section={is.financial} prevSection={ps.financial} />
            <Divider />
          </>
        )}

        <Row label="RESULTAT FÖRE SKATT" subLabel="Voitto ennen veroja" cur={is.profitBeforeTax} prev={ps.profitBeforeTax} bold highlight="positive" />
        <Row label="Inkomstskatter" subLabel="Tuloverot" cur={is.taxes.total} prev={ps.taxes.total} negate indent={16} />
        <SectionRows section={is.taxes} prevSection={ps.taxes} />

        <ThickDivider />
        <Row label="ÅRETS RESULTAT" subLabel="Tilikauden voitto/tappio" cur={is.netProfit} prev={ps.netProfit} bold highlight="positive" />
        <ThickDivider />
      </tbody>
    </table>
  );
}

function BalanceTab({ data }: { data: AnnualReportData }) {
  const bs = data.current.balanceSheet;
  const pb = data.prev.balanceSheet;
  const eq = bs.liabilitiesAndEquity.equity;
  const peq = pb.liabilitiesAndEquity.equity;

  return (
    <div className="space-y-8">
      {/* AKTIVA */}
      <div>
        <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">
          Aktiva <span className="font-normal normal-case tracking-normal text-white/20">(Vastaavaa)</span>
        </p>
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <ColHeader year={data.year} prevYear={data.prevYear} />
          </thead>
          <tbody>
            <Row label="Anläggningstillgångar" subLabel="Pysyvät vastaavat" cur={bs.assets.nonCurrent.total} prev={pb.assets.nonCurrent.total} />
            <SectionRows section={bs.assets.nonCurrent} prevSection={pb.assets.nonCurrent} />

            <Row label="Omsättningstillgångar" subLabel="Vaihtuvat vastaavat" cur={bs.assets.current.total} prev={pb.assets.current.total} separator />
            <SectionRows section={bs.assets.current} prevSection={pb.assets.current} />

            <ThickDivider />
            <Row label="AKTIVA TOTALT" subLabel="Vastaavaa yhteensä" cur={bs.assets.total} prev={pb.assets.total} bold />
            <ThickDivider />
          </tbody>
        </table>
      </div>

      {/* PASSIVA */}
      <div>
        <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">
          Passiva <span className="font-normal normal-case tracking-normal text-white/20">(Vastattavaa)</span>
        </p>
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <ColHeader year={data.year} prevYear={data.prevYear} />
          </thead>
          <tbody>
            {/* Equity */}
            <Row label="Eget kapital" subLabel="Oma pääoma" cur={eq.total} prev={peq.total} />
            {eq.retainedEarnings !== 0 && (
              <Row label="Ingående eget kapital" subLabel="Edellisten tilikausien voitto/tappio" cur={eq.retainedEarnings} prev={peq.retainedEarnings} indent={16} />
            )}
            <Row label="Årets resultat" subLabel="Tilikauden voitto/tappio" cur={eq.netProfit} prev={peq.netProfit} indent={16} />

            {/* Long-term liabilities */}
            {(bs.liabilitiesAndEquity.longTermLiabilities.total !== 0 || pb.liabilitiesAndEquity.longTermLiabilities.total !== 0) && (
              <>
                <Row label="Långfristiga skulder" subLabel="Pitkäaikaiset velat" cur={bs.liabilitiesAndEquity.longTermLiabilities.total} prev={pb.liabilitiesAndEquity.longTermLiabilities.total} separator />
                <SectionRows section={bs.liabilitiesAndEquity.longTermLiabilities} prevSection={pb.liabilitiesAndEquity.longTermLiabilities} />
              </>
            )}

            {/* Short-term liabilities */}
            <Row label="Kortfristiga skulder" subLabel="Lyhytaikaiset velat" cur={bs.liabilitiesAndEquity.shortTermLiabilities.total} prev={pb.liabilitiesAndEquity.shortTermLiabilities.total} separator />
            <SectionRows section={bs.liabilitiesAndEquity.shortTermLiabilities} prevSection={pb.liabilitiesAndEquity.shortTermLiabilities} />

            <ThickDivider />
            <Row label="PASSIVA TOTALT" subLabel="Vastattavaa yhteensä" cur={bs.liabilitiesAndEquity.total} prev={pb.liabilitiesAndEquity.total} bold />
            <ThickDivider />
          </tbody>
        </table>

        {/* Balance check */}
        {Math.abs(bs.assets.total - bs.liabilitiesAndEquity.total) > 1 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg p-3">
            <AlertCircle size={14} className="flex-shrink-0" />
            <span>
              OBS: Aktiva ({fmt(bs.assets.total)}) och Passiva ({fmt(bs.liabilitiesAndEquity.total)}) balanserar inte.
              Kontrollera att alla bokföringsposter är korrekta.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function NotesTab({ data }: { data: AnnualReportData }) {
  const is = data.current.incomeStatement;
  const bs = data.current.balanceSheet;

  return (
    <div className="space-y-6 text-sm">
      <section>
        <h3 className="text-white font-semibold mb-2">
          1. Tillämpade redovisningsprinciper
          <span className="text-white/25 font-normal text-xs ml-2">(Noudatetut tilinpäätösperiaatteet)</span>
        </h3>
        <p className="text-white/60 leading-relaxed">
          Bokslutet har upprättats i enlighet med finsk bokföringslag (KPL 1336/1997) och
          bokföringsförordningen (BokFO 1339/1997) samt Bokföringsnämndens anvisningar.
          Tillgångarna är värderade till anskaffningsvärde. Bokslutet omfattar räkenskapsperioden
          1.1.{data.year}–31.12.{data.year}.
        </p>
      </section>

      <section>
        <h3 className="text-white font-semibold mb-2">
          2. Räkenskapsperiod
          <span className="text-white/25 font-normal text-xs ml-2">(Tilikausi)</span>
        </h3>
        <p className="text-white/60">1.1.{data.year}–31.12.{data.year}</p>
      </section>

      <section>
        <h3 className="text-white font-semibold mb-2">
          3. Omsättning per kategori
          <span className="text-white/25 font-normal text-xs ml-2">(Liikevaihto lajeittain)</span>
        </h3>
        {is.revenue.accounts.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-white/30 border-b border-white/10">
                <th className="py-1.5 text-left font-medium">Konto</th>
                <th className="py-1.5 text-right font-medium">{data.year}</th>
                <th className="py-1.5 text-right font-medium text-white/20">{data.prevYear}</th>
              </tr>
            </thead>
            <tbody>
              {is.revenue.accounts.map(acc => {
                const prev = data.prev.incomeStatement.revenue.accounts.find(b => b.accountNumber === acc.accountNumber);
                return (
                  <tr key={acc.accountNumber} className="border-b border-white/[0.04]">
                    <td className="py-1.5 text-white/60">
                      <span className="font-mono text-white/30 mr-2">{acc.accountNumber}</span>
                      {acc.nameSv}
                    </td>
                    <td className="py-1.5 text-right text-white/70 tabular-nums">{fmt(acc.net)}</td>
                    <td className="py-1.5 text-right text-white/30 tabular-nums">{fmt(prev?.net ?? 0)}</td>
                  </tr>
                );
              })}
              <tr className="font-semibold">
                <td className="py-1.5 text-white">Totalt</td>
                <td className="py-1.5 text-right text-white tabular-nums">{fmt(is.revenue.total)}</td>
                <td className="py-1.5 text-right text-white/50 tabular-nums">{fmt(data.prev.incomeStatement.revenue.total)}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="text-white/30">Inga intäktskonton har bokförts under perioden.</p>
        )}
      </section>

      {bs.assets.nonCurrent.accounts.length > 0 && (
        <section>
          <h3 className="text-white font-semibold mb-2">
            4. Anläggningstillgångar
            <span className="text-white/25 font-normal text-xs ml-2">(Pysyvät vastaavat)</span>
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-white/30 border-b border-white/10">
                <th className="py-1.5 text-left font-medium">Tillgång</th>
                <th className="py-1.5 text-right font-medium">Bokfört värde</th>
              </tr>
            </thead>
            <tbody>
              {bs.assets.nonCurrent.accounts.map(acc => (
                <tr key={acc.accountNumber} className="border-b border-white/[0.04]">
                  <td className="py-1.5 text-white/60">
                    <span className="font-mono text-white/30 mr-2">{acc.accountNumber}</span>
                    {acc.nameSv}
                  </td>
                  <td className="py-1.5 text-right text-white/70 tabular-nums">{fmt(acc.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section>
        <h3 className="text-white font-semibold mb-2">
          5. Revisorer
          <span className="text-white/25 font-normal text-xs ml-2">(Tilintarkastajat)</span>
        </h3>
        <p className="text-white/30 italic text-xs">
          Uppgifter om revisorer och revisionsberättelse bifogas bokslutet separat.
        </p>
      </section>

      <section>
        <h3 className="text-white font-semibold mb-2">
          6. Nyckeltal
          <span className="text-white/25 font-normal text-xs ml-2">(Tunnusluvut)</span>
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-white/30 border-b border-white/10">
              <th className="py-1.5 text-left font-medium">Nyckeltal</th>
              <th className="py-1.5 text-right font-medium">{data.year}</th>
              <th className="py-1.5 text-right font-medium text-white/20">{data.prevYear}</th>
            </tr>
          </thead>
          <tbody>
            {[
              {
                label: 'Omsättning',
                cur: is.revenue.total,
                prev: data.prev.incomeStatement.revenue.total
              },
              {
                label: 'Rörelsemarginal',
                cur: is.revenue.total !== 0 ? (is.operatingProfit / is.revenue.total * 100) : 0,
                prev: data.prev.incomeStatement.revenue.total !== 0
                  ? (data.prev.incomeStatement.operatingProfit / data.prev.incomeStatement.revenue.total * 100)
                  : 0,
                pct: true
              },
              {
                label: 'Nettomarginal',
                cur: is.revenue.total !== 0 ? (is.netProfit / is.revenue.total * 100) : 0,
                prev: data.prev.incomeStatement.revenue.total !== 0
                  ? (data.prev.incomeStatement.netProfit / data.prev.incomeStatement.revenue.total * 100)
                  : 0,
                pct: true
              },
              {
                label: 'Årets resultat',
                cur: is.netProfit,
                prev: data.prev.incomeStatement.netProfit
              },
              {
                label: 'Soliditet (eget kapital / totalt passiva)',
                cur: bs.liabilitiesAndEquity.total !== 0
                  ? (bs.liabilitiesAndEquity.equity.total / bs.liabilitiesAndEquity.total * 100)
                  : 0,
                prev: pb => pb.liabilitiesAndEquity.total !== 0
                  ? (pb.liabilitiesAndEquity.equity.total / pb.liabilitiesAndEquity.total * 100)
                  : 0,
                pct: true,
                prevBs: data.prev.balanceSheet
              }
            ].map((kpi, i) => {
              const curVal = typeof kpi.cur === 'function' ? kpi.cur(bs) : kpi.cur;
              const prevVal = typeof kpi.prev === 'function' ? kpi.prev(kpi.prevBs ?? data.prev.balanceSheet) : kpi.prev as number;
              return (
                <tr key={i} className="border-b border-white/[0.04]">
                  <td className="py-1.5 text-white/60">{kpi.label}</td>
                  <td className="py-1.5 text-right text-white/80 tabular-nums">
                    {kpi.pct ? `${fmtSigned(curVal)} %` : fmt(curVal)}
                  </td>
                  <td className="py-1.5 text-right text-white/30 tabular-nums">
                    {kpi.pct ? `${fmtSigned(prevVal)} %` : fmt(prevVal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AnnualReport() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<AnnualReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('income');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api.get<AnnualReportData>(`/annual-report?year=${year}`)
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Kunde inte hämta bokslut'))
      .finally(() => setLoading(false));
  }, [year]);

  const downloadPdf = async () => {
    setPdfLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/annual-report/pdf?year=${year}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('PDF-generering misslyckades');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bokslut-${year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fel');
    } finally {
      setPdfLoading(false);
    }
  };

  const backfillExpenses = async () => {
    setBackfillLoading(true);
    setBackfillMsg('');
    try {
      const [expRes, invRes] = await Promise.all([
        api.post<{ created: number; message: string }>('/annual-report/backfill-expenses', {}),
        api.post<{ created: number; message: string }>('/annual-report/backfill-invoices', {}),
      ]);
      const total = expRes.created + invRes.created;
      setBackfillMsg(
        total === 0
          ? 'Allt är redan bokfört – inga saknade verifikat hittades.'
          : `${invRes.created} fakturaverifikat + ${expRes.created} utgiftsverifikat skapades.`
      );
      const fresh = await api.get<AnnualReportData>(`/annual-report?year=${year}`);
      setData(fresh);
    } catch (err) {
      setBackfillMsg(err instanceof Error ? err.message : 'Backfill misslyckades');
    } finally {
      setBackfillLoading(false);
    }
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const tabs: { id: Tab; label: string; sub: string }[] = [
    { id: 'income', label: 'Resultaträkning', sub: 'Tuloslaskelma' },
    { id: 'balance', label: 'Balansräkning', sub: 'Tase' },
    { id: 'notes', label: 'Noter', sub: 'Liitetiedot' },
  ];

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-white">Bokslut</h1>
          <p className="text-white/40 text-sm mt-0.5">
            Årsredovisning enligt finsk bokföringslag (KPL)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={e => setYear(parseInt(e.target.value))}
            className="input py-1.5 text-sm w-28"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={downloadPdf}
            disabled={!data || pdfLoading}
            className="btn-primary"
          >
            {pdfLoading
              ? <Loader2 size={14} className="animate-spin" />
              : <FileDown size={14} />}
            Ladda ned PDF
          </button>
        </div>
      </div>

      {/* Backfill banner */}
      <div className="card py-3 px-4 flex items-center justify-between gap-4 flex-wrap border-amber-500/20 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <Wand2 size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-white/80 font-medium">Fyll i saknad bokföring</p>
            <p className="text-xs text-white/40 mt-0.5">
              Skapar verifikat för alla utgifter som ännu saknar bokföringspost, så att bokslutet matchar dashboarden.
            </p>
            {backfillMsg && (
              <p className="text-xs text-emerald-400 mt-1">{backfillMsg}</p>
            )}
          </div>
        </div>
        <button
          onClick={backfillExpenses}
          disabled={backfillLoading}
          className="btn-primary shrink-0"
        >
          {backfillLoading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          Kör bokföringsrättning
        </button>
      </div>

      {/* Company info card */}
      {data && (
        <div className="card py-3 px-4 flex items-center gap-6 flex-wrap">
          <div>
            <p className="text-xs text-white/30 mb-0.5">Företag (Yritys)</p>
            <p className="text-sm font-medium text-white">{data.company.name}</p>
          </div>
          <div>
            <p className="text-xs text-white/30 mb-0.5">FO-nummer (Y-tunnus)</p>
            <p className="text-sm text-white/80 font-mono">{data.company.businessId}</p>
          </div>
          <div>
            <p className="text-xs text-white/30 mb-0.5">Momsnr (ALV-tunnus)</p>
            <p className="text-sm text-white/80 font-mono">{data.company.vatNumber}</p>
          </div>
          <div>
            <p className="text-xs text-white/30 mb-0.5">Räkenskapsperiod</p>
            <p className="text-sm text-white/80">1.1.{year} – 31.12.{year}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-brand-600/20 border border-brand-500/40 text-brand-300'
                : 'text-white/40 hover:text-white/70 border border-transparent'
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-xs ${tab === t.id ? 'text-brand-400/70' : 'text-white/20'}`}>
              ({t.sub})
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="card p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-brand-500" size={28} />
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 text-red-400 py-8 justify-center">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        ) : !data ? null : (
          <>
            {/* Section title */}
            <div className="mb-6">
              <h2 className="text-base font-semibold text-white">
                {tabs.find(t => t.id === tab)?.label}
                <span className="text-white/25 font-normal text-sm ml-2">
                  ({tabs.find(t => t.id === tab)?.sub})
                </span>
              </h2>
              {tab !== 'notes' && (
                <p className="text-xs text-white/30 mt-0.5">
                  Räkenskapsperiod {year} med jämförelse mot {year - 1} · Belopp i EUR
                </p>
              )}
            </div>

            {/* No data state */}
            {tab === 'income' && data.current.incomeStatement.revenue.total === 0 && data.current.incomeStatement.netProfit === 0 && (
              <div className="text-center py-10 text-white/30">
                <BookMarked size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Inga bokföringsposter finns för {year}.</p>
                <p className="text-xs mt-1">Bokslut skapas automatiskt utifrån transaktioner i bokföringen.</p>
              </div>
            )}

            {tab === 'income' && <IncomeTab data={data} />}
            {tab === 'balance' && <BalanceTab data={data} />}
            {tab === 'notes' && <NotesTab data={data} />}
          </>
        )}
      </div>
    </div>
  );
}
