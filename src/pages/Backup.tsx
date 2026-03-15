import { useState, useRef } from 'react';
import { Download, Upload, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

type ImportMode = 'replace' | 'merge';

interface ImportResult {
  mode: ImportMode;
  imported: Record<string, number>;
}

const LABEL: Record<string, string> = {
  accounts: 'Konton',
  customers: 'Kunder',
  users: 'Användare',
  dimensions: 'Dimensioner',
  dimensionAccountRules: 'Dimensionskopplingar',
  transactions: 'Verifikationer',
  transactionLines: 'Verifikatrader',
  invoices: 'Fakturor',
  invoiceLines: 'Fakturarader',
  subscriptions: 'Prenumerationer',
  subscriptionLines: 'Prenumerationsrader',
  expenses: 'Utgifter',
};

export default function Backup() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        (import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api') + '/settings/export',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Export misslyckades');
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? 'erp-backup.json';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  }

  async function handleImport() {
    if (!selectedFile) return;
    setImporting(true);
    setResult(null);
    setError(null);
    try {
      const text = await selectedFile.text();
      const data = JSON.parse(text);
      const token = localStorage.getItem('token');
      const res = await fetch(
        (import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api') + '/settings/import',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ data, mode }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Import misslyckades');
      setResult(json);
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Export */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-white mb-1">Exportera säkerhetskopia</h2>
        <p className="text-xs text-white/40 mb-4">
          Laddar ner en komplett JSON-kopia av all bolagsdata — konton, kunder, fakturor,
          bokföring, prenumerationer, utgifter och dimensioner.
        </p>
        <button onClick={handleExport} disabled={exporting} className="btn-primary flex items-center gap-2">
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          {exporting ? 'Exporterar…' : 'Ladda ner backup'}
        </button>
      </div>

      {/* Import */}
      <div className="card p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-white mb-1">Importera säkerhetskopia</h2>
          <p className="text-xs text-white/40">
            Välj en tidigare exporterad JSON-fil och välj importläge.
          </p>
        </div>

        {/* File picker */}
        <div>
          <label className="block text-xs font-medium text-white/40 mb-1">Backup-fil (JSON)</label>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={e => { setSelectedFile(e.target.files?.[0] ?? null); setResult(null); setError(null); }}
            className="input w-full text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-white/10 file:text-white/70 cursor-pointer"
          />
        </div>

        {/* Mode selector */}
        <div>
          <label className="block text-xs font-medium text-white/40 mb-2">Importläge</label>
          <div className="space-y-2">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="radio" name="mode" value="merge"
                checked={mode === 'merge'}
                onChange={() => setMode('merge')}
                className="mt-0.5 accent-brand-500"
              />
              <div>
                <div className="text-sm text-white group-hover:text-white/90">Addera saknad data</div>
                <div className="text-xs text-white/40">Hoppar över poster som redan finns. Säkert och icke-destruktivt.</div>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="radio" name="mode" value="replace"
                checked={mode === 'replace'}
                onChange={() => setMode('replace')}
                className="mt-0.5 accent-brand-500"
              />
              <div>
                <div className="text-sm text-white group-hover:text-white/90">Ersätt all data</div>
                <div className="text-xs text-white/40">Raderar ALL befintlig data och ersätter med backupens innehåll. Perfekt för katastrofåterställning.</div>
              </div>
            </label>
          </div>
        </div>

        {/* Replace warning */}
        {mode === 'replace' && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertTriangle size={15} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs text-red-300">
              <strong>Varning:</strong> All befintlig data i bolaget raderas permanent och ersätts med backupens innehåll. Denna åtgärd kan inte ångras.
            </p>
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={!selectedFile || importing}
          className="btn-primary flex items-center gap-2 disabled:opacity-40"
        >
          {importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {importing ? 'Importerar…' : 'Importera'}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={16} className="text-green-400" />
            <span className="text-sm font-medium text-white">
              Import klar ({result.mode === 'replace' ? 'Ersätt all data' : 'Addera saknad data'})
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {Object.entries(result.imported).map(([key, count]) => (
              <div key={key} className="flex justify-between text-xs py-0.5 border-b border-white/5">
                <span className="text-white/50">{LABEL[key] ?? key}</span>
                <span className="text-white font-medium">{count}</span>
              </div>
            ))}
          </div>
          {result.mode === 'replace' && (
            <p className="text-xs text-white/40 mt-3">
              Importerade användare har fått ett temporärt lösenord: <code className="text-brand-300">TempPass123!</code> — be dem byta lösenord vid inloggning.
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertTriangle size={15} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}
    </div>
  );
}
