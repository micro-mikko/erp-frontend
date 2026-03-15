import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Send, CheckCircle, Trash2, Loader2, FileText, Tag, X, Download, Pencil } from 'lucide-react';
import { api } from '../../api/client';
import type { Invoice, Category } from '../../api/types';
import { getCategoryLabel } from '../../components/CategoryPicker';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

function fmt(n: number) {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'EUR' }).format(n);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { draft: 'badge-draft', sent: 'badge-sent', paid: 'badge-paid' };
  const labels: Record<string, string> = { draft: 'Utkast', sent: 'Skickad', paid: 'Betald' };
  return <span className={map[status] || 'badge-draft'}>{labels[status] || status}</span>;
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentReference, setPaymentReference] = useState('');
  const [pdfLang, setPdfLang] = useState<'sv' | 'fi' | 'en'>('sv');
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Invoice>(`/invoices/${id}`),
      api.get<Category[]>('/accounting/categories'),
    ]).then(([inv, cats]) => {
      setInvoice(inv);
      setCategories(cats);
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (status: string) => {
    if (!invoice) return;
    setActionLoading(true);
    setError('');
    try {
      const updated = await api.patch<Invoice>(`/invoices/${invoice.id}/status`, { status });
      setInvoice(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fel');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!invoice) return;
    setActionLoading(true);
    setError('');
    try {
      const updated = await api.patch<Invoice>(`/invoices/${invoice.id}/status`, {
        status: 'paid',
        paymentDate,
        paymentReference: paymentReference || undefined,
      });
      setInvoice(updated);
      setShowPaymentModal(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fel');
    } finally {
      setActionLoading(false);
    }
  };

  const downloadPdf = async () => {
    if (!invoice) return;
    setPdfLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/invoices/${invoice.id}/pdf?lang=${pdfLang}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('PDF-generering misslyckades');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `faktura-${invoice.invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda ned PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!invoice || !confirm('Radera fakturan?')) return;
    setActionLoading(true);
    try {
      await api.delete(`/invoices/${invoice.id}`);
      navigate('/invoices');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fel');
      setActionLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="animate-spin text-brand-500" size={28} />
    </div>
  );

  if (!invoice) return (
    <div className="p-6 text-white/50 text-center">Faktura hittades inte</div>
  );

  return (
    <div className="p-6 max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/invoices" className="btn-ghost">
          <ArrowLeft size={14} /> Tillbaka
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-white font-mono">{invoice.invoiceNumber}</h1>
            <StatusBadge status={invoice.status} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* PDF download */}
          <div className="flex items-center rounded-lg border border-white/10 overflow-hidden">
            <select
              value={pdfLang}
              onChange={e => setPdfLang(e.target.value as 'sv' | 'fi' | 'en')}
              className="bg-white/5 text-white/70 text-xs px-2 py-2 border-r border-white/10 outline-none cursor-pointer hover:bg-white/10 transition-colors"
            >
              <option value="sv">SV</option>
              <option value="fi">FI</option>
              <option value="en">EN</option>
            </select>
            <button
              onClick={downloadPdf}
              disabled={pdfLoading}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-white/70 bg-white/5 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
            >
              {pdfLoading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              PDF
            </button>
          </div>

          {invoice.status === 'draft' && (
            <>
              <Link to={`/invoices/${invoice.id}/edit`} className="btn-secondary">
                <Pencil size={14} /> Redigera
              </Link>
              <button onClick={() => updateStatus('sent')} disabled={actionLoading} className="btn-primary">
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Markera skickad
              </button>
              <button onClick={handleDelete} disabled={actionLoading} className="btn-danger">
                <Trash2 size={14} /> Radera
              </button>
            </>
          )}
          {invoice.status === 'sent' && (
            <button onClick={() => setShowPaymentModal(true)} disabled={actionLoading} className="btn-primary">
              <CheckCircle size={14} />
              Registrera betalning
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Invoice info */}
        <div className="md:col-span-2 card space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={16} className="text-brand-400" />
            <h2 className="text-sm font-semibold text-white">Fakturauppgifter</h2>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-white/40 text-xs mb-1">Kund</p>
              <p className="text-white font-medium">{invoice.customer?.name ?? '—'}</p>
              {invoice.customer?.email && <p className="text-white/50 text-xs">{invoice.customer.email}</p>}
            </div>
            <div>
              <p className="text-white/40 text-xs mb-1">Fakturadatum</p>
              <p className="text-white">{format(new Date(invoice.issueDate), 'd MMMM yyyy', { locale: sv })}</p>
            </div>
            {invoice.dueDate && (
              <div>
                <p className="text-white/40 text-xs mb-1">Förfallodatum</p>
                <p className="text-white">{format(new Date(invoice.dueDate), 'd MMMM yyyy', { locale: sv })}</p>
              </div>
            )}
          </div>

          {/* Lines */}
          {invoice.lines && invoice.lines.length > 0 && (
            <div>
              <p className="text-white/40 text-xs mb-2 mt-4">Fakturarader</p>
              <div className="space-y-2">
                {invoice.lines.map((line, i) => {
                  const catLabel = getCategoryLabel(categories, line.categoryId, line.subcategoryId);
                  return (
                    <div key={i} className="bg-surface-200/50 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-white/80">{line.description}</p>
                          {catLabel && (
                            <div className="flex items-center gap-1 mt-1">
                              <Tag size={10} className="text-brand-400" />
                              <span className="text-[11px] text-brand-400">{catLabel}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-white/50 ml-4">
                          <span>{line.quantity} st</span>
                          <span>{fmt(line.unitPrice)}</span>
                          <span>{line.vatRate}% moms</span>
                          <span className="font-medium text-white">{fmt(line.amount ?? 0)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="border-t border-white/5 pt-4 space-y-1.5">
            <div className="flex justify-between text-sm text-white/50">
              <span>Netto</span><span>{fmt(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-white/50">
              <span>Moms</span><span>{fmt(invoice.vatAmount)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-white">
              <span>Totalt</span><span>{fmt(invoice.total)}</span>
            </div>
          </div>

          {invoice.notes && (
            <div className="bg-surface-200 rounded-lg p-3">
              <p className="text-xs text-white/40 mb-1">Anteckningar</p>
              <p className="text-sm text-white/70">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Side info */}
        <div className="space-y-4">
          <div className="card">
            <p className="text-xs text-white/40 mb-3 uppercase tracking-wide">Sammanfattning</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/50">Status</span>
                <StatusBadge status={invoice.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Faktura nr</span>
                <span className="text-white font-mono text-xs">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Totalt</span>
                <span className="text-brand-300 font-semibold">{fmt(invoice.total)}</span>
              </div>
              {invoice.paymentDate && (
                <div className="flex justify-between pt-2 border-t border-white/5 mt-2">
                  <span className="text-white/50">Betald</span>
                  <span className="text-emerald-400 text-xs">
                    {format(new Date(invoice.paymentDate), 'd MMM yyyy', { locale: sv })}
                  </span>
                </div>
              )}
              {invoice.paymentReference && (
                <div className="flex justify-between">
                  <span className="text-white/50">Referens</span>
                  <span className="text-white/70 text-xs font-mono">{invoice.paymentReference}</span>
                </div>
              )}
            </div>
          </div>

          {/* Dimension summary */}
          {invoice.lines && invoice.lines.some(l => l.categoryId) && (
            <div className="card">
              <p className="text-xs text-white/40 mb-3 uppercase tracking-wide">Dimensioner</p>
              <div className="space-y-1.5">
                {invoice.lines.filter(l => l.categoryId).map((line, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-brand-400">
                      {getCategoryLabel(categories, line.categoryId, line.subcategoryId) || '—'}
                    </span>
                    <span className="text-white/60">{fmt(line.amount ?? 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-100 border border-white/10 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-400" />
                Registrera betalning
              </h2>
              <button onClick={() => setShowPaymentModal(false)} className="text-white/40 hover:text-white/70 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="text-sm text-white/50">
              Faktura <span className="font-mono text-white/80">{invoice.invoiceNumber}</span> — {fmt(invoice.total)}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Betalningsdatum</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">
                  Referens / OCR <span className="text-white/25">(valfritt)</span>
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={e => setPaymentReference(e.target.value)}
                  placeholder="Bankreferens, OCR-nummer..."
                  className="input w-full"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowPaymentModal(false)} className="btn-ghost flex-1">
                Avbryt
              </button>
              <button onClick={handlePayment} disabled={actionLoading} className="btn-primary flex-1">
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Bekräfta betalning
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
