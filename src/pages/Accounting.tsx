import { useEffect, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Loader2, Search, ChevronUp, Paperclip, Plus, X, Package } from 'lucide-react';
import { api } from '../api/client';
import type { Account, Transaction } from '../api/types';
import { fileUrl } from './Inbox';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

function fmt(n: number) {
  return n === 0 ? '—' : new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'EUR' }).format(n);
}

function fmtNum(n: number) {
  return new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

// ── Transaction row ──────────────────────────────────────────────────────────

function TransactionRow({ tx }: { tx: Transaction }) {
  const [open, setOpen] = useState(false);
  const totalDebit = tx.lines?.reduce((s, l) => s + l.debit, 0) ?? 0;

  return (
    <>
      <tr
        className="hover:bg-white/[0.02] transition-colors cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <td className="px-5 py-3.5 text-white/40 text-xs">
          {format(new Date(tx.date), 'd MMM yyyy', { locale: sv })}
        </td>
        <td className="px-5 py-3.5 font-mono text-xs text-brand-400">{tx.voucherNumber}</td>
        <td className="px-5 py-3.5 text-white/80">
          <span className="inline-flex items-center gap-1.5">
            {tx.description}
            {tx.documents && tx.documents.length > 0 && (
              <a
                href={fileUrl(tx.documents[0].id)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-white/30 hover:text-brand-400 transition-colors"
                title={`Visa originalfil: ${tx.documents[0].filename}`}
              >
                <Paperclip size={13} />
              </a>
            )}
          </span>
        </td>
        <td className="px-5 py-3.5 text-right font-medium text-white">{fmt(totalDebit)}</td>
        <td className="px-5 py-3.5 text-right text-white/40">
          {open ? <ChevronDown size={14} className="ml-auto" /> : <ChevronRight size={14} className="ml-auto" />}
        </td>
      </tr>
      {open && tx.lines?.map((line, i) => (
        <tr key={i} className="bg-surface-50/30">
          <td colSpan={2} />
          <td className="px-5 py-2 text-xs text-white/50 pl-10">
            {line.account?.accountNumber} · {line.account?.nameSv}
          </td>
          <td className="px-5 py-2 text-right text-xs text-emerald-400">{line.debit > 0 ? fmt(line.debit) : '—'}</td>
          <td className="px-5 py-2 text-right text-xs text-red-400">{line.credit > 0 ? fmt(line.credit) : '—'}</td>
        </tr>
      ))}
    </>
  );
}

// ── Voucher modal ────────────────────────────────────────────────────────────

interface VoucherLine {
  accountId: string;
  description: string;
  debit: string;
  credit: string;
}

function VoucherModal({ accounts, onClose, onCreated }: {
  accounts: Account[];
  onClose: () => void;
  onCreated: (tx: Transaction) => void;
}) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [mode, setMode] = useState<'voucher' | 'asset'>('voucher');
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<VoucherLine[]>([
    { accountId: '', description: '', debit: '', credit: '' },
    { accountId: '', description: '', debit: '', credit: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Asset activation fields
  const [assetName, setAssetName] = useState('');
  const [assetAmount, setAssetAmount] = useState('');
  const [assetType, setAssetType] = useState('COMPUTER_IT');
  const [depYears, setDepYears] = useState('5');

  const totalDebit  = lines.reduce((s, l) => s + (parseFloat(l.debit)  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.005;
  const canSave     = !!(date && description.trim() && lines.every(l => l.accountId) && balanced && totalDebit > 0);

  const updateLine = (i: number, field: keyof VoucherLine, value: string) => {
    setLines(ls => ls.map((l, j) => j === i ? { ...l, [field]: value } : l));
  };
  const addLine    = () => setLines(ls => [...ls, { accountId: '', description: '', debit: '', credit: '' }]);
  const removeLine = (i: number) => { if (lines.length > 2) setLines(ls => ls.filter((_, j) => j !== i)); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (mode === 'asset') {
        // Create asset via API, which also creates the voucher
        const amt = parseFloat(assetAmount) || 0;
        if (!assetName.trim() || amt <= 0) {
          setError('Namn och belopp krävs');
          setSaving(false);
          return;
        }
        await api.post('/assets', {
          name: assetName.trim(),
          assetType,
          acquisitionDate: date,
          acquisitionValue: amt,
          depreciationYears: parseInt(depYears) || 5,
          depreciationStart: 'ACQUISITION_MONTH',
          description: description.trim() || undefined,
        });
        // Reload transactions to show the new voucher
        const txs = await api.get<Transaction[]>('/accounting/transactions');
        if (txs.length > 0) onCreated(txs[0]);
        else onClose();
      } else {
        if (!canSave) return;
        const tx = await api.post<Transaction>('/accounting/transactions', {
          date,
          description: description.trim(),
          lines: lines.map(l => ({
            accountId:   l.accountId,
            description: l.description.trim() || undefined,
            debit:       parseFloat(l.debit)  || 0,
            credit:      parseFloat(l.credit) || 0,
          })),
        });
        onCreated(tx);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kunde inte spara verifikat');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-base font-semibold text-white">Nytt verifikat</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('voucher')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                mode === 'voucher'
                  ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                  : 'bg-surface-100 text-white/50 border border-white/5 hover:text-white/70'
              }`}
            >
              Manuellt verifikat
            </button>
            <button
              type="button"
              onClick={() => setMode('asset')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                mode === 'asset'
                  ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                  : 'bg-surface-100 text-white/50 border border-white/5 hover:text-white/70'
              }`}
            >
              <Package size={12} /> Aktivering av tillgång
            </button>
          </div>

          {/* Date + Description */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-white/40">Datum</label>
              <input
                type="date"
                className="input w-full"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/40">Beskrivning</label>
              <input
                type="text"
                className="input w-full"
                placeholder={mode === 'asset' ? 'T.ex. Ny laptop' : 'T.ex. Manuell rättelse'}
                value={description}
                onChange={e => setDescription(e.target.value)}
                required={mode === 'voucher'}
              />
            </div>
          </div>

          {/* Asset activation form */}
          {mode === 'asset' && (
            <div className="space-y-3 p-4 bg-brand-600/5 border border-brand-500/10 rounded-xl">
              <div className="space-y-1">
                <label className="text-xs text-white/40">Tillgångsnamn *</label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="MacBook Pro 16&quot;"
                  value={assetName}
                  onChange={e => setAssetName(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-white/40">Belopp (EUR) *</label>
                  <input
                    type="number"
                    className="input w-full"
                    placeholder="1500"
                    min="0"
                    step="0.01"
                    value={assetAmount}
                    onChange={e => setAssetAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-white/40">Typ</label>
                  <select className="input w-full" value={assetType} onChange={e => setAssetType(e.target.value)}>
                    <option value="COMPUTER_IT">Dator & IT</option>
                    <option value="PHONE_TABLET">Telefon</option>
                    <option value="VEHICLE">Fordon</option>
                    <option value="MACHINERY">Maskiner</option>
                    <option value="FURNITURE">Möbler</option>
                    <option value="BUILDING">Byggnader</option>
                    <option value="OTHER">Övrigt</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-white/40">Avskr. år</label>
                  <input
                    type="number"
                    className="input w-full"
                    min="1"
                    max="50"
                    value={depYears}
                    onChange={e => setDepYears(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-white/30">
                Verifikat skapas automatiskt: DR 1200 (Maskiner & inventarier) / CR 2600 (Leverantörsskulder)
              </p>
            </div>
          )}

          {/* Lines (only for manual voucher mode) */}
          {mode === 'voucher' && (
          <div className="space-y-2">
            <div className="grid grid-cols-[1.2fr_1fr_0.65fr_0.65fr_28px] gap-2 text-xs text-white/30 px-1">
              <span>Konto</span>
              <span>Beskrivning (valbart)</span>
              <span className="text-right">Debet</span>
              <span className="text-right">Kredit</span>
              <span />
            </div>

            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-[1.2fr_1fr_0.65fr_0.65fr_28px] gap-2 items-center">
                <select
                  className="input text-sm"
                  value={line.accountId}
                  onChange={e => updateLine(i, 'accountId', e.target.value)}
                  required
                >
                  <option value="">— Välj konto —</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.accountNumber} {a.nameSv}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  className="input text-sm"
                  placeholder="—"
                  value={line.description}
                  onChange={e => updateLine(i, 'description', e.target.value)}
                />

                <input
                  type="number"
                  className="input text-sm text-right font-mono"
                  placeholder="0,00"
                  min="0"
                  step="0.01"
                  value={line.debit}
                  onChange={e => updateLine(i, 'debit', e.target.value)}
                />

                <input
                  type="number"
                  className="input text-sm text-right font-mono"
                  placeholder="0,00"
                  min="0"
                  step="0.01"
                  value={line.credit}
                  onChange={e => updateLine(i, 'credit', e.target.value)}
                />

                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  disabled={lines.length <= 2}
                  className="text-white/20 hover:text-red-400 transition-colors disabled:pointer-events-none disabled:opacity-0 flex items-center justify-center"
                >
                  <X size={13} />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addLine}
              className="text-xs text-white/30 hover:text-brand-400 transition-colors flex items-center gap-1.5 mt-1 ml-1"
            >
              <Plus size={12} /> Lägg till rad
            </button>
          </div>
          )}

          {/* Balance + actions */}
          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            {mode === 'voucher' ? (
              <div className="flex items-center gap-4 text-xs">
                <span className="text-white/40">
                  Debet: <span className="text-white/70 font-mono">{fmtNum(totalDebit)}</span>
                </span>
                <span className="text-white/40">
                  Kredit: <span className="text-white/70 font-mono">{fmtNum(totalCredit)}</span>
                </span>
                {totalDebit > 0 && !balanced && (
                  <span className="text-amber-400">
                    Differens: {fmtNum(Math.abs(totalDebit - totalCredit))}
                  </span>
                )}
                {balanced && totalDebit > 0 && (
                  <span className="text-emerald-400">✓ Balanserat</span>
                )}
              </div>
            ) : (
              <div className="text-xs text-white/40">
                {assetAmount && <span>Belopp: <span className="text-white/70 font-mono">{fmtNum(parseFloat(assetAmount) || 0)}</span> EUR</span>}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
              >
                Avbryt
              </button>
              <button
                type="submit"
                disabled={mode === 'voucher' ? (!canSave || saving) : saving}
                className="btn-primary text-sm flex items-center gap-1.5"
              >
                {saving
                  ? <><Loader2 size={13} className="animate-spin" /> Sparar…</>
                  : mode === 'asset' ? <><Package size={13} /> Skapa tillgång</> : 'Spara verifikat'
                }
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-400 mt-1">{error}</p>}
        </form>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function Accounting() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts]         = useState<Account[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [sortKey, setSortKey]           = useState<'date' | 'voucherNumber' | 'description' | 'debit'>('date');
  const [sortDir, setSortDir]           = useState<'asc' | 'desc'>('desc');
  const [showModal, setShowModal]       = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Transaction[]>('/accounting/transactions'),
      api.get<Account[]>('/accounting/accounts'),
    ])
      .then(([txs, accts]) => { setTransactions(txs); setAccounts(accts); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ column }: { column: typeof sortKey }) =>
    sortKey !== column ? null
      : sortDir === 'asc'
        ? <ChevronUp size={12} className="inline ml-0.5 opacity-60" />
        : <ChevronDown size={12} className="inline ml-0.5 opacity-60" />;

  const searchLower = search.trim().toLowerCase();
  const filtered = transactions.filter(tx => {
    if (!searchLower) return true;
    const dateStr  = format(new Date(tx.date), 'd MMM yyyy', { locale: sv }).toLowerCase();
    const desc     = (tx.description   || '').toLowerCase();
    const vnr      = (tx.voucherNumber || '').toLowerCase();
    const debitStr = fmt(tx.lines?.reduce((s, l) => s + l.debit, 0) ?? 0).toLowerCase();
    return dateStr.includes(searchLower) || desc.includes(searchLower)
        || vnr.includes(searchLower)     || debitStr.includes(searchLower);
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    const debitA = a.lines?.reduce((s, l) => s + l.debit, 0) ?? 0;
    const debitB = b.lines?.reduce((s, l) => s + l.debit, 0) ?? 0;
    switch (sortKey) {
      case 'date':          cmp = new Date(a.date).getTime() - new Date(b.date).getTime(); break;
      case 'voucherNumber': cmp = (a.voucherNumber || '').localeCompare(b.voucherNumber || ''); break;
      case 'description':   cmp = (a.description   || '').localeCompare(b.description   || ''); break;
      case 'debit':         cmp = debitA - debitB; break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Bokföring</h1>
          <p className="text-white/40 text-sm mt-0.5">{filtered.length} verifikationer</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-1.5"
        >
          <Plus size={15} />
          Nytt verifikat
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          className="input pl-9"
          placeholder="Sök verifikat, beskrivning, datum..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-brand-500" size={28} />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <BookOpen size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Inga bokföringsposter ännu</p>
            <p className="text-xs mt-1">Poster skapas automatiskt när fakturor markeras som skickade</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <p className="text-sm">Inga träffar för sökningen</p>
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
                  <button type="button" onClick={() => toggleSort('voucherNumber')} className="hover:text-white/60 transition-colors">Verif. nr</button>
                  <SortIcon column="voucherNumber" />
                </th>
                <th className="px-5 py-3 font-medium">
                  <button type="button" onClick={() => toggleSort('description')} className="hover:text-white/60 transition-colors">Beskrivning</button>
                  <SortIcon column="description" />
                </th>
                <th className="px-5 py-3 font-medium text-right">
                  <button type="button" onClick={() => toggleSort('debit')} className="hover:text-white/60 transition-colors ml-auto block w-full text-right">Debet</button>
                  <SortIcon column="debit" />
                </th>
                <th className="px-5 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {sorted.map(tx => (
                <TransactionRow key={tx.id} tx={tx} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <VoucherModal
          accounts={accounts}
          onClose={() => setShowModal(false)}
          onCreated={tx => {
            setTransactions(prev => [tx, ...prev]);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}
