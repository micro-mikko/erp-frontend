import { useEffect, useState } from 'react';
import { Plus, Loader2, Package, TrendingDown, AlertTriangle, ChevronUp, ChevronDown, X, Calendar } from 'lucide-react';
import { api } from '../../api/client';
import type { Asset, AssetSummary, DepreciationPreview, AssetType, DepreciationStart } from '../../api/types';
import AssetForm from '../../components/AssetForm';
import type { AssetFormData } from '../../components/AssetForm';

const fmt = (n: number) =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'EUR' }).format(n);

const ASSET_TYPE_LABELS: Record<string, string> = {
  COMPUTER_IT: 'Dator & IT',
  PHONE_TABLET: 'Telefon & surfplatta',
  VEHICLE: 'Fordon',
  MACHINERY: 'Maskiner',
  FURNITURE: 'Möbler',
  BUILDING: 'Byggnader',
  OTHER: 'Övrigt',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Aktiv',
  FULLY_DEPRECIATED: 'Fullt avskriven',
  DISPOSED: 'Avyttrad',
};
const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/15 text-emerald-400',
  FULLY_DEPRECIATED: 'bg-amber-500/15 text-amber-400',
  DISPOSED: 'bg-white/10 text-white/40',
};

type SortKey = 'name' | 'assetType' | 'acquisitionDate' | 'acquisitionValue' | 'currentBookValue' | 'status';

export default function AssetList() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [summary, setSummary] = useState<AssetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('acquisitionDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showDepreciation, setShowDepreciation] = useState(false);
  const [depYear, setDepYear] = useState(new Date().getFullYear());
  const [depPreview, setDepPreview] = useState<DepreciationPreview | null>(null);
  const [depLoading, setDepLoading] = useState(false);
  const [depRunning, setDepRunning] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    Promise.all([
      api.get<Asset[]>('/assets'),
      api.get<AssetSummary>('/assets/summary'),
    ])
      .then(([a, s]) => { setAssets(a); setSummary(s); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };
  const SortIcon = ({ column }: { column: SortKey }) =>
    sortKey !== column ? null : sortDir === 'asc' ? <ChevronUp size={12} className="inline ml-0.5 opacity-60" /> : <ChevronDown size={12} className="inline ml-0.5 opacity-60" />;

  const sorted = [...assets].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'name': cmp = a.name.localeCompare(b.name); break;
      case 'assetType': cmp = a.assetType.localeCompare(b.assetType); break;
      case 'acquisitionDate': cmp = new Date(a.acquisitionDate).getTime() - new Date(b.acquisitionDate).getTime(); break;
      case 'acquisitionValue': cmp = a.acquisitionValue - b.acquisitionValue; break;
      case 'currentBookValue': cmp = (a.currentBookValue ?? 0) - (b.currentBookValue ?? 0); break;
      case 'status': cmp = a.status.localeCompare(b.status); break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  // Create asset
  const handleCreate = async (data: AssetFormData) => {
    setSaving(true);
    try {
      await api.post('/assets', {
        ...data,
        acquisitionValue: parseFloat(String(data.acquisitionValue)),
        depreciationYears: parseInt(String(data.depreciationYears)),
      });
      setShowCreate(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  // Dispose asset
  const handleDispose = async (id: string) => {
    if (!confirm('Avyttra tillgången? Den kommer att markeras som avyttrad.')) return;
    try {
      await api.delete(`/assets/${id}`);
      setSelectedAsset(null);
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Fel');
    }
  };

  // Depreciation preview
  const loadDepPreview = async (year: number) => {
    setDepLoading(true);
    try {
      const preview = await api.post<DepreciationPreview>('/assets/depreciation/preview', { year });
      setDepPreview(preview);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda förhandsgranskning');
    } finally {
      setDepLoading(false);
    }
  };

  const openDepreciation = () => {
    const year = new Date().getFullYear();
    setDepYear(year);
    setShowDepreciation(true);
    setDepPreview(null);
    setError('');
    loadDepPreview(year);
  };

  const runDepreciation = async () => {
    if (!confirm(`Bokför avskrivningar för ${depYear}? Detta kan inte ångras.`)) return;
    setDepRunning(true);
    setError('');
    try {
      const result = await api.post<{ count: number; totalAmount: number; message: string }>('/assets/depreciation/run', { year: depYear });
      alert(result.message);
      setShowDepreciation(false);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Avskrivning misslyckades');
    } finally {
      setDepRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-brand-500" size={28} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Anläggningstillgångar</h1>
        <div className="flex gap-2">
          <button onClick={openDepreciation} className="btn-secondary">
            <Calendar size={14} /> Avskrivningar
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus size={14} /> Ny tillgång
          </button>
        </div>
      </div>

      {/* KPI cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-3">
          <div className="card">
            <div className="text-xs text-white/40 uppercase tracking-wide">Antal aktiva</div>
            <div className="text-2xl font-bold text-white mt-1">{summary.activeCount}</div>
          </div>
          <div className="card">
            <div className="text-xs text-white/40 uppercase tracking-wide">Anskaffningsvärde</div>
            <div className="text-lg font-semibold text-white mt-1">{fmt(summary.totalAcquisitionValue)}</div>
          </div>
          <div className="card">
            <div className="text-xs text-white/40 uppercase tracking-wide">Bokfört värde</div>
            <div className="text-lg font-semibold text-brand-300 mt-1">{fmt(summary.totalBookValue)}</div>
          </div>
          <div className="card">
            <div className="text-xs text-white/40 uppercase tracking-wide">Ackumulerad avskrivning</div>
            <div className="text-lg font-semibold text-amber-400 mt-1">{fmt(summary.totalDepreciated)}</div>
          </div>
        </div>
      )}

      {/* Asset table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-white/40 text-xs uppercase tracking-wide">
              <th className="text-left p-3 font-medium cursor-pointer" onClick={() => toggleSort('name')}>
                Namn <SortIcon column="name" />
              </th>
              <th className="text-left p-3 font-medium cursor-pointer" onClick={() => toggleSort('assetType')}>
                Typ <SortIcon column="assetType" />
              </th>
              <th className="text-left p-3 font-medium cursor-pointer" onClick={() => toggleSort('acquisitionDate')}>
                Inköp <SortIcon column="acquisitionDate" />
              </th>
              <th className="text-right p-3 font-medium cursor-pointer" onClick={() => toggleSort('acquisitionValue')}>
                Anskaffn. <SortIcon column="acquisitionValue" />
              </th>
              <th className="text-right p-3 font-medium cursor-pointer" onClick={() => toggleSort('currentBookValue')}>
                Bokfört <SortIcon column="currentBookValue" />
              </th>
              <th className="text-center p-3 font-medium cursor-pointer" onClick={() => toggleSort('status')}>
                Status <SortIcon column="status" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-white/30">
                  <Package size={28} className="mx-auto mb-2 opacity-30" />
                  Inga tillgångar registrerade
                </td>
              </tr>
            ) : sorted.map(asset => {
              const depPercent = asset.acquisitionValue > 0
                ? ((asset.acquisitionValue - (asset.currentBookValue ?? 0)) / asset.acquisitionValue * 100)
                : 0;
              return (
                <tr
                  key={asset.id}
                  className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors"
                  onClick={() => setSelectedAsset(asset)}
                >
                  <td className="p-3">
                    <div className="font-medium text-white">{asset.name}</div>
                    {asset.description && <div className="text-xs text-white/30 mt-0.5">{asset.description}</div>}
                  </td>
                  <td className="p-3 text-white/60">{ASSET_TYPE_LABELS[asset.assetType] || asset.assetType}</td>
                  <td className="p-3 text-white/60">{new Date(asset.acquisitionDate).toLocaleDateString('sv-SE')}</td>
                  <td className="p-3 text-right text-white/60">{fmt(asset.acquisitionValue)}</td>
                  <td className="p-3 text-right">
                    <div className="text-white">{fmt(asset.currentBookValue ?? 0)}</div>
                    <div className="w-full bg-surface-300 rounded-full h-1 mt-1">
                      <div className="bg-brand-500 h-1 rounded-full" style={{ width: `${100 - Math.min(depPercent, 100)}%` }} />
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[asset.status] || ''}`}>
                      {STATUS_LABELS[asset.status] || asset.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface-100 border border-white/10 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Ny anläggningstillgång</h2>
              <button onClick={() => setShowCreate(false)} className="text-white/30 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <AssetForm
              onSubmit={handleCreate}
              onCancel={() => setShowCreate(false)}
              submitLabel="Skapa tillgång"
              loading={saving}
            />
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface-100 border border-white/10 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">{selectedAsset.name}</h2>
              <button onClick={() => setSelectedAsset(null)} className="text-white/30 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-white/40">Typ:</span> <span className="text-white ml-1">{ASSET_TYPE_LABELS[selectedAsset.assetType]}</span></div>
                <div><span className="text-white/40">Status:</span> <span className={`ml-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[selectedAsset.status]}`}>{STATUS_LABELS[selectedAsset.status]}</span></div>
                <div><span className="text-white/40">Inköpsdatum:</span> <span className="text-white ml-1">{new Date(selectedAsset.acquisitionDate).toLocaleDateString('sv-SE')}</span></div>
                <div><span className="text-white/40">Avskrivningstid:</span> <span className="text-white ml-1">{selectedAsset.depreciationYears} år</span></div>
              </div>

              {selectedAsset.description && (
                <div className="text-sm text-white/50">{selectedAsset.description}</div>
              )}

              <div className="bg-surface-200/50 rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/50">Anskaffningsvärde</span>
                  <span className="text-white">{fmt(selectedAsset.acquisitionValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Ackumulerad avskrivning</span>
                  <span className="text-amber-400">{fmt(selectedAsset.acquisitionValue - (selectedAsset.currentBookValue ?? 0))}</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-white/5 pt-1.5">
                  <span className="text-white/50">Bokfört restvärde</span>
                  <span className="text-brand-300">{fmt(selectedAsset.currentBookValue ?? 0)}</span>
                </div>
                <div className="flex justify-between text-white/40 text-xs pt-1">
                  <span>Avskrivning/år</span>
                  <span>{fmt(selectedAsset.yearlyDepreciation ?? 0)}</span>
                </div>
                {selectedAsset.fullyDepreciatedDate && (
                  <div className="flex justify-between text-white/40 text-xs">
                    <span>Fullt avskriven</span>
                    <span>{new Date(selectedAsset.fullyDepreciatedDate).toLocaleDateString('sv-SE')}</span>
                  </div>
                )}
              </div>

              {/* Depreciation progress bar */}
              <div>
                <div className="flex justify-between text-xs text-white/40 mb-1">
                  <span>Avskrivningsgrad</span>
                  <span>{selectedAsset.acquisitionValue > 0
                    ? Math.round((selectedAsset.acquisitionValue - (selectedAsset.currentBookValue ?? 0)) / selectedAsset.acquisitionValue * 100)
                    : 0}%</span>
                </div>
                <div className="w-full bg-surface-300 rounded-full h-2">
                  <div
                    className="bg-brand-500 h-2 rounded-full transition-all"
                    style={{ width: `${selectedAsset.acquisitionValue > 0 ? Math.min((selectedAsset.acquisitionValue - (selectedAsset.currentBookValue ?? 0)) / selectedAsset.acquisitionValue * 100, 100) : 0}%` }}
                  />
                </div>
              </div>

              {/* Depreciation runs */}
              {selectedAsset.depreciationRuns && selectedAsset.depreciationRuns.length > 0 && (
                <div>
                  <h3 className="text-xs text-white/40 uppercase tracking-wide mb-2">Bokförda avskrivningar</h3>
                  <div className="space-y-1">
                    {selectedAsset.depreciationRuns.map(run => (
                      <div key={run.id} className="flex justify-between text-sm bg-surface-200/30 rounded px-2 py-1">
                        <span className="text-white/60">{run.year}</span>
                        <span className="text-white">{fmt(run.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedAsset.status === 'ACTIVE' && (
                <button onClick={() => handleDispose(selectedAsset.id)} className="btn-danger w-full justify-center mt-3">
                  <AlertTriangle size={14} /> Avyttra tillgång
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Depreciation run modal */}
      {showDepreciation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface-100 border border-white/10 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Kör avskrivningar</h2>
              <button onClick={() => setShowDepreciation(false)} className="text-white/30 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Räkenskapsår</label>
                <input
                  className="input"
                  type="number"
                  value={depYear}
                  onChange={e => {
                    const y = parseInt(e.target.value);
                    setDepYear(y);
                    if (y >= 2000 && y <= 2100) loadDepPreview(y);
                  }}
                />
              </div>

              {depLoading && (
                <div className="flex justify-center py-4">
                  <Loader2 className="animate-spin text-brand-500" size={20} />
                </div>
              )}

              {depPreview && !depLoading && (
                <>
                  {depPreview.items.length === 0 ? (
                    <div className="text-center text-white/40 py-4">
                      Inga avskrivningar att bokföra för {depYear}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-xs text-white/40 uppercase tracking-wide">
                        Förhandsgranskning — {depPreview.items.length} tillgångar
                      </div>
                      <div className="space-y-1 max-h-60 overflow-y-auto">
                        {depPreview.items.map(item => (
                          <div key={item.assetId} className="flex justify-between text-sm bg-surface-200/30 rounded px-3 py-2">
                            <div>
                              <div className="text-white">{item.assetName}</div>
                              <div className="text-xs text-white/30">Bokfört efter: {fmt(item.bookValueAfter)}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-amber-400 font-medium">{fmt(item.amount)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-white/5 pt-2 flex justify-between font-semibold text-sm">
                        <span className="text-white">Totalt</span>
                        <span className="text-amber-400">{fmt(depPreview.totalAmount)}</span>
                      </div>
                      <div className="text-xs text-white/30">
                        Verifikat skapas med DR 6800 (Avskrivningar) / CR 1219 (Ack. avskrivningar)
                      </div>
                    </div>
                  )}
                </>
              )}

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>
              )}

              <div className="flex gap-3">
                {depPreview && depPreview.items.length > 0 && (
                  <button
                    onClick={runDepreciation}
                    disabled={depRunning}
                    className="btn-primary flex-1 justify-center"
                  >
                    {depRunning ? <Loader2 size={14} className="animate-spin" /> : <><TrendingDown size={14} /> Bokför avskrivningar</>}
                  </button>
                )}
                <button onClick={() => setShowDepreciation(false)} className="btn-secondary flex-1 justify-center">
                  Stäng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
