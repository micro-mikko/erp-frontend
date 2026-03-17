import { Fragment, useEffect, useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Inbox as InboxIcon, Upload, FileText, Image, Trash2, Loader2,
  Search, ExternalLink, CloudUpload, Wand2, CheckCircle, ChevronDown, Plus, Package,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Document, ExtractedDocumentData, Expense, AssetType, DepreciationStart } from '../api/types';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import SupplierPicker from '../components/SupplierPicker';
import CategoryPicker from '../components/CategoryPicker';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Fil-URL med token query param (för <img src> och <a href> som inte kan skicka Authorization-header) */
export function fileUrl(docId: string): string {
  const token = localStorage.getItem('token');
  return `/api/documents/${docId}/file${token ? `?token=${token}` : ''}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Väntar',
  PROCESSING: 'Analyserar...',
  PROCESSED: 'Förslag klart',
  MATCHED: 'Matchad',
};
const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-400',
  PROCESSING: 'bg-blue-500/15 text-blue-400',
  PROCESSED: 'bg-purple-500/15 text-purple-400',
  MATCHED: 'bg-emerald-500/15 text-emerald-400',
};

function isImageType(mimeType: string) {
  return mimeType.startsWith('image/');
}

function fmtAmount(n?: number, currency?: string) {
  if (n == null) return '—';
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 2,
  }).format(n);
}

const COST_CATEGORIES = ['cogs', 'software', 'hardware', 'personnel', 'marketing', 'office', 'other'];

interface ApprovePayload {
  supplierId?: string;
  createSupplier?: boolean;
  supplierName?: string;
  categoryId?: string;
  subcategoryId?: string;
  description?: string;
  activateAsAsset?: boolean;
  assetData?: {
    name: string;
    assetType: AssetType;
    depreciationYears: number;
    depreciationStart: DepreciationStart;
  };
}

// ─── ExtractedDataPanel ──────────────────────────────────────────────────────

function ExtractedDataPanel({
  doc,
  onApprove,
  approving,
}: {
  doc: Document;
  onApprove: (doc: Document, payload: ApprovePayload) => void;
  approving: boolean;
}) {
  const data = doc.extractedData as ExtractedDocumentData;
  if (!data) return null;

  const isReadOnly = doc.status === 'MATCHED';

  // ── Editable state (only used for PROCESSED) ──
  const [supplier, setSupplier] = useState<{ id: string; name: string } | null>(
    data.matchedSuppliers?.[0] || null
  );
  const [createNewSupplier, setCreateNewSupplier] = useState(
    !data.matchedSuppliers?.length && !!data.vendor
  );
  const [newSupplierName, setNewSupplierName] = useState(data.vendor || '');
  const [categoryId, setCategoryId] = useState(data.suggestedCategory || '');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [description, setDescription] = useState(data.description || '');

  // Asset activation
  const [activateAsAsset, setActivateAsAsset] = useState(false);
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('COMPUTER_IT');
  const [depYears, setDepYears] = useState(5);
  const [depStart, setDepStart] = useState<DepreciationStart>('ACQUISITION_MONTH');

  const suggestAsset = (data.totalAmount ?? 0) >= 500;

  const handleCategoryChange = (catId: string, subId: string) => {
    setCategoryId(catId);
    setSubcategoryId(subId);
  };

  const handleApproveClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Validera att description är ifylld
    if (!description.trim()) {
      alert('Beskrivningen är obligatorisk');
      return;
    }

    const payload: ApprovePayload = {
      supplierId: createNewSupplier ? undefined : supplier?.id,
      createSupplier: createNewSupplier,
      supplierName: createNewSupplier ? newSupplierName : undefined,
      categoryId: categoryId || undefined,
      subcategoryId: subcategoryId || undefined,
      description: description.trim(),
    };
    if (activateAsAsset) {
      payload.activateAsAsset = true;
      payload.assetData = {
        name: assetName || description.trim() || data.description || '',
        assetType,
        depreciationYears: depYears,
        depreciationStart: depStart,
      };
    }
    onApprove(doc, payload);
  };

  return (
    <div className="px-4 py-3 bg-purple-500/5 border-t border-purple-500/10">
      {/* ── Read-only data fields ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-xs">
        {data.vendor && (
          <div>
            <span className="text-white/40">Leverantör</span>
            <p className="text-white">{data.vendor}</p>
          </div>
        )}
        {data.date && (
          <div>
            <span className="text-white/40">Datum</span>
            <p className="text-white">{data.date}</p>
          </div>
        )}
        {data.totalAmount != null && (
          <div>
            <span className="text-white/40">Belopp</span>
            <p className="text-white font-medium">{fmtAmount(data.totalAmount, data.currency)}</p>
          </div>
        )}
        {data.invoiceNumber && (
          <div>
            <span className="text-white/40">Fakturanr</span>
            <p className="text-white">{data.invoiceNumber}</p>
          </div>
        )}
        {data.description && (
          <div className="col-span-2">
            <span className="text-white/40">Beskrivning</span>
            <p className="text-white">{data.description}</p>
          </div>
        )}
      </div>

      {/* ── VAT details ── */}
      {(data.vatDetails && data.vatDetails.length > 0) ? (
        <div className="mt-3 pt-3 border-t border-white/5">
          <span className="text-[11px] text-white/40 mb-1.5 block">Moms</span>
          <div className="flex flex-wrap gap-3 text-xs">
            {data.vatDetails.map((vd, i) => (
              <div key={i} className="bg-white/5 rounded-lg px-2.5 py-1.5">
                <span className="text-white/50">{vd.rate}%:</span>{' '}
                <span className="text-white font-medium">{fmtAmount(vd.amount, data.currency)}</span>
              </div>
            ))}
            <div className="bg-white/5 rounded-lg px-2.5 py-1.5">
              <span className="text-white/50">Totalt:</span>{' '}
              <span className="text-white font-medium">{fmtAmount(data.vatAmount, data.currency)}</span>
            </div>
          </div>
        </div>
      ) : data.vatAmount != null ? (
        <div className="mt-3 pt-3 border-t border-white/5">
          <span className="text-[11px] text-white/40 mb-1.5 block">Moms</span>
          <div className="text-xs text-white">{fmtAmount(data.vatAmount, data.currency)}</div>
        </div>
      ) : null}

      {/* ── Line items ── */}
      {data.lineItems && data.lineItems.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <span className="text-[11px] text-white/40 mb-1 block">Rader</span>
          <div className="space-y-1">
            {data.lineItems.map((line, i) => (
              <div key={i} className="flex justify-between text-xs text-white/70">
                <span>{line.description}</span>
                <span className="text-white/50">
                  {fmtAmount(line.amount, data.currency)}
                  {line.vatRate != null && ` (${line.vatRate}%)`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MATCHED: read-only links ── */}
      {isReadOnly && (
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
          <a
            href={fileUrl(doc.id)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ExternalLink size={12} />
            Visa originalfil
          </a>
          {doc.expenseId && (
            <Link
              to={`/expenses`}
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-600/10 text-brand-400 hover:bg-brand-600/20 transition-colors"
            >
              → Visa utgift
            </Link>
          )}
        </div>
      )}

      {/* ── PROCESSED: editable form + approve button ── */}
      {!isReadOnly && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-3">
          {/* Supplier picker */}
          <div>
            <span className="text-[11px] text-white/40 mb-1.5 block">Leverantör</span>
            {createNewSupplier ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2">
                  <Plus size={14} className="text-brand-400 flex-shrink-0" />
                  <input
                    value={newSupplierName}
                    onChange={e => setNewSupplierName(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    className="input text-sm flex-1"
                    placeholder="Leverantörsnamn..."
                  />
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setCreateNewSupplier(false); }}
                  className="text-xs text-white/40 hover:text-white/70"
                >
                  Välj befintlig
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1" onClick={e => e.stopPropagation()}>
                  <SupplierPicker
                    value={supplier}
                    onChange={s => { setSupplier(s); setCreateNewSupplier(false); }}
                    placeholder={data.vendor ? `Sök "${data.vendor}"...` : 'Sök leverantör...'}
                  />
                </div>
                {data.vendor && !supplier && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setCreateNewSupplier(true); }}
                    className="text-xs text-brand-400 hover:text-brand-300 whitespace-nowrap"
                  >
                    + Skapa ny
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Category picker */}
          <div>
            <span className="text-[11px] text-white/40 mb-1.5 block">Kategori</span>
            <div onClick={e => e.stopPropagation()}>
              <CategoryPicker
                categoryId={categoryId}
                subcategoryId={subcategoryId}
                onChange={handleCategoryChange}
                filter={COST_CATEGORIES}
              />
            </div>
          </div>

          {/* Description input */}
          <div>
            <span className="text-[11px] text-white/40 mb-1.5 block">Beskrivning</span>
            <div onClick={e => e.stopPropagation()}>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Redigera eller förkortad beskrivning för utgiften..."
                className="input min-h-[60px] max-h-[160px] resize-none"
              />
            </div>
          </div>

          {/* Asset activation suggestion */}
          {suggestAsset && (
            <div className="p-3 bg-brand-600/10 border border-brand-500/20 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Package size={14} className="text-brand-400" />
                <span className="text-xs font-medium text-brand-300">Aktivera som anläggningstillgång?</span>
                <label className="ml-auto flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activateAsAsset}
                    onChange={e => { e.stopPropagation(); setActivateAsAsset(e.target.checked); }}
                    onClick={e => e.stopPropagation()}
                    className="w-3.5 h-3.5 rounded border-white/20 bg-surface-200 text-brand-500"
                  />
                  <span className="text-xs text-white/50">Aktivera</span>
                </label>
              </div>
              {activateAsAsset && (
                <div className="grid grid-cols-2 gap-2" onClick={e => e.stopPropagation()}>
                  <input className="input text-xs" value={assetName} onChange={e => setAssetName(e.target.value)} placeholder="Tillgångsnamn" />
                  <select className="input text-xs" value={assetType} onChange={e => setAssetType(e.target.value as AssetType)}>
                    <option value="COMPUTER_IT">Dator & IT</option>
                    <option value="PHONE_TABLET">Telefon</option>
                    <option value="VEHICLE">Fordon</option>
                    <option value="MACHINERY">Maskiner</option>
                    <option value="FURNITURE">Möbler</option>
                    <option value="OTHER">Övrigt</option>
                  </select>
                  <input className="input text-xs" type="number" min="1" max="50" value={depYears} onChange={e => setDepYears(parseInt(e.target.value) || 5)} placeholder="År" />
                  <select className="input text-xs" value={depStart} onChange={e => setDepStart(e.target.value as DepreciationStart)}>
                    <option value="ACQUISITION_MONTH">Anskaffningsmånad</option>
                    <option value="NEXT_MONTH">Nästa månad</option>
                    <option value="FISCAL_YEAR_START">Räkenskapsårsstart</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Approve button */}
          <div className="flex justify-end pt-1">
            <button
              onClick={handleApproveClick}
              disabled={approving}
              className="btn-primary text-xs whitespace-nowrap flex items-center gap-1.5 disabled:opacity-50"
            >
              {approving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CheckCircle size={14} />
              )}
              {activateAsAsset ? 'Skapa utgift + tillgång' : 'Skapa utgift'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Inbox() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [error, setError] = useState('');
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  // ─── Load documents ──────────────────────────────────────────────────────

  const loadDocuments = useCallback(() => {
    api.get<Document[]>('/documents')
      .then(setDocuments)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // ─── Poll for status updates when PROCESSING docs exist ────────────────

  useEffect(() => {
    const hasProcessing = documents.some(d => d.status === 'PROCESSING');
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      api.get<Document[]>('/documents').then(setDocuments).catch(console.error);
    }, 3000);

    return () => clearInterval(interval);
  }, [documents]);

  // ─── Upload via drag-and-drop ────────────────────────────────────────────

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setUploading(true);
    setError('');

    try {
      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];
        setUploadProgress(`Laddar upp ${i + 1}/${acceptedFiles.length}: ${file.name}`);

        const formData = new FormData();
        formData.append('file', file);

        const doc = await api.upload<Document>('/documents/upload', formData);
        setDocuments(prev => [doc, ...prev]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Uppladdning misslyckades';
      setError(msg);
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (rejections) => {
      const reasons = rejections.map(r => `${r.file.name}: ${r.errors.map(e => e.message).join(', ')}`);
      setError(reasons.join('; '));
    },
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/heic': ['.heic'],
    },
    maxSize: 10 * 1024 * 1024,
    disabled: uploading,
  });

  // ─── Delete ──────────────────────────────────────────────────────────────

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Radera "${doc.filename}"?`)) return;
    try {
      await api.delete(`/documents/${doc.id}`);
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Radering misslyckades';
      setError(msg);
    }
  };

  // ─── Analyze (manual trigger) ────────────────────────────────────────

  const handleAnalyze = async (doc: Document) => {
    setAnalyzingId(doc.id);
    setError('');
    try {
      // Sätt PROCESSING lokalt direkt för snabb feedback
      setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'PROCESSING' as const } : d));
      const updated = await api.post<Document>(`/documents/${doc.id}/analyze`, {});
      setDocuments(prev => prev.map(d => d.id === doc.id ? updated : d));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analys misslyckades';
      setError(msg);
      // Ladda om listan för att få korrekt status
      loadDocuments();
    } finally {
      setAnalyzingId(null);
    }
  };

  // ─── Approve extracted data → create expense ───────────────────────────

  const handleApprove = async (doc: Document, payload: ApprovePayload = {}) => {
    setApproving(true);
    setError('');
    try {
      const result = await api.post<{ expense: Expense; document: Document }>(`/documents/${doc.id}/approve`, payload);
      setDocuments(prev =>
        prev.map(d => d.id === doc.id ? { ...d, status: 'MATCHED' as const, expenseId: result.expense.id } : d)
      );
      setExpandedDocId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Kunde inte skapa utgift';
      setError(msg);
    } finally {
      setApproving(false);
    }
  };

  // ─── Filter + search ──────────────────────────────────────────────────

  const filtered = documents.filter(doc => {
    if (filterStatus === 'PENDING' && doc.status !== 'PENDING' && doc.status !== 'PROCESSING') return false;
    if (filterStatus === 'PROCESSED' && doc.status !== 'PROCESSED') return false;
    if (filterStatus === 'MATCHED' && doc.status !== 'MATCHED') return false;
    if (filterStatus !== 'ALL' && filterStatus !== 'PENDING' && filterStatus !== 'PROCESSED' && filterStatus !== 'MATCHED' && doc.status !== filterStatus) return false;
    if (search && !doc.filename.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const statusCounts = {
    ALL: documents.length,
    PENDING: documents.filter(d => d.status === 'PENDING' || d.status === 'PROCESSING').length,
    PROCESSED: documents.filter(d => d.status === 'PROCESSED').length,
    MATCHED: documents.filter(d => d.status === 'MATCHED').length,
  };

  const FILTER_PILLS = [
    { key: 'ALL', label: 'Alla' },
    { key: 'PENDING', label: 'Väntar' },
    { key: 'PROCESSED', label: 'Förslag klart' },
    { key: 'MATCHED', label: 'Matchad' },
  ] as const;

  const isExpandable = (status: string) => status === 'PROCESSED' || status === 'MATCHED';

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-brand-500" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600/20 border border-brand-500/20 flex items-center justify-center">
            <InboxIcon size={20} className="text-brand-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Inkorg</h1>
            <p className="text-xs text-white/40">{documents.length} dokument</p>
          </div>
        </div>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragActive
            ? 'border-brand-500 bg-brand-600/10'
            : uploading
            ? 'border-white/10 bg-surface-100/50 cursor-wait'
            : 'border-white/10 bg-surface-50 hover:border-brand-500/40 hover:bg-surface-100'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          {uploading ? (
            <>
              <Loader2 size={28} className="text-brand-400 animate-spin" />
              <p className="text-sm text-white/60">{uploadProgress}</p>
            </>
          ) : isDragActive ? (
            <>
              <CloudUpload size={28} className="text-brand-400" />
              <p className="text-sm text-brand-300">Släpp filer här...</p>
            </>
          ) : (
            <>
              <Upload size={28} className="text-white/30" />
              <p className="text-sm text-white/50">
                Dra och släpp filer här, eller <span className="text-brand-400 underline">klicka för att välja</span>
              </p>
              <p className="text-xs text-white/25">PDF, JPEG, PNG, WebP — max 10 MB</p>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Search + filter pills */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Sök filnamn..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9 w-full"
          />
        </div>
        <div className="flex gap-1.5">
          {FILTER_PILLS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterStatus === key
                  ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                  : 'bg-surface-100 text-white/50 border border-white/5 hover:text-white/70'
              }`}
            >
              {label} ({statusCounts[key as keyof typeof statusCounts]})
            </button>
          ))}
        </div>
      </div>

      {/* Document list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-white/30">
          <InboxIcon size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {documents.length === 0
              ? 'Inkorgen är tom. Dra och släpp filer ovan för att börja.'
              : 'Inga dokument matchar filtret.'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-white/40 text-xs">
                <th className="text-left px-4 py-3 font-medium">Dokument</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Storlek</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Datum</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(doc => (
                <Fragment key={doc.id}>
                  <tr
                    onClick={() =>
                      isExpandable(doc.status)
                        ? setExpandedDocId(prev => (prev === doc.id ? null : doc.id))
                        : undefined
                    }
                    className={`table-row-hover border-b border-white/5 last:border-0 ${
                      isExpandable(doc.status) ? 'cursor-pointer' : ''
                    } ${expandedDocId === doc.id ? 'bg-purple-500/5' : ''}`}
                  >
                    {/* Filename + thumbnail */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {isImageType(doc.mimeType) ? (
                          <img
                            src={fileUrl(doc.id)}
                            alt={doc.filename}
                            className="w-9 h-9 rounded-lg object-cover border border-white/10 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                            <FileText size={16} className="text-red-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <a
                            href={fileUrl(doc.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-white hover:text-brand-300 transition-colors truncate block max-w-[300px]"
                            title={doc.filename}
                          >
                            {doc.filename}
                          </a>
                          <span className="text-[11px] text-white/30 sm:hidden">
                            {formatFileSize(doc.fileSize)}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Size */}
                    <td className="px-4 py-3 text-white/50 hidden sm:table-cell">
                      {formatFileSize(doc.fileSize)}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-white/50 hidden md:table-cell">
                      {format(new Date(doc.createdAt), 'd MMM yyyy', { locale: sv })}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          STATUS_STYLES[doc.status] || ''
                        }`}
                      >
                        {doc.status === 'PROCESSING' && <Loader2 size={10} className="animate-spin" />}
                        {doc.status === 'PROCESSED' && <Wand2 size={10} />}
                        {STATUS_LABELS[doc.status] || doc.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {doc.status === 'PENDING' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAnalyze(doc); }}
                            disabled={analyzingId === doc.id}
                            className="p-1.5 rounded-lg text-purple-400 hover:bg-purple-400/10 transition-colors disabled:opacity-50"
                            title="Analysera dokument"
                          >
                            {analyzingId === doc.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Wand2 size={14} />
                            )}
                          </button>
                        )}
                        {isExpandable(doc.status) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedDocId(prev => (prev === doc.id ? null : doc.id));
                            }}
                            className="p-1.5 rounded-lg text-purple-400 hover:bg-purple-400/10 transition-colors"
                            title={doc.status === 'MATCHED' ? 'Visa detaljer' : 'Visa förslag'}
                          >
                            <ChevronDown
                              size={14}
                              className={`transition-transform ${expandedDocId === doc.id ? 'rotate-180' : ''}`}
                            />
                          </button>
                        )}
                        <a
                          href={fileUrl(doc.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="p-1.5 rounded-lg text-white/30 hover:text-brand-400 hover:bg-brand-400/10 transition-colors"
                          title="Öppna"
                        >
                          <ExternalLink size={14} />
                        </a>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(doc); }}
                          className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          title="Radera"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded extraction panel */}
                  {expandedDocId === doc.id && doc.extractedData && (
                    <tr key={`${doc.id}-panel`}>
                      <td colSpan={5} className="p-0">
                        <ExtractedDataPanel doc={doc} onApprove={handleApprove} approving={approving} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
