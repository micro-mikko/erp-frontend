import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Trash2, AlertTriangle, XCircle } from 'lucide-react';
import { api } from '../../api/client';
import type { Customer } from '../../api/types';

export default function CustomerForm() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [error, setError] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);

  // ─── Delete-modal state ────────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [form, setForm] = useState({
    name: '', email: '', phone: '', address: '', vatNumber: '',
  });

  useEffect(() => {
    if (!isEdit) return;
    api.get<Customer>(`/customers/${id}`).then(c => {
      setCustomer(c);
      setForm({ name: c.name, email: c.email ?? '', phone: c.phone ?? '', address: c.address ?? '', vatNumber: c.vatNumber ?? '' });
    }).catch(console.error).finally(() => setFetching(false));
  }, [id, isEdit]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Namn krävs'); return; }
    setError('');
    setLoading(true);
    try {
      if (isEdit) {
        await api.put<Customer>(`/customers/${id}`, form);
        navigate(`/customers/${id}`);
      } else {
        const c = await api.post<Customer>('/customers', form);
        navigate(`/customers/${c.id}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fel');
    } finally {
      setLoading(false);
    }
  };

  // ─── Radera: visa modal först ────────────────────────────────────────────
  const openDeleteModal = () => {
    setDeleteError('');
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/customers/${id}`);
      navigate('/customers');
    } catch (err: unknown) {
      // Backend returnerar 409 + förklarande meddelande om kunden har historik
      setDeleteError(err instanceof Error ? err.message : 'Kunde inte radera kund');
      setDeleting(false);
    }
  };

  // ─── Räknare från backend (inkluderade i GET /:id) ───────────────────────
  const invoiceCount = customer?.invoiceCount ?? 0;
  const subscriptionCount = customer?.subscriptionCount ?? 0;
  const hasHistory = invoiceCount > 0 || subscriptionCount > 0;

  if (fetching) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="animate-spin text-brand-500" size={28} />
    </div>
  );

  return (
    <div className="p-6 max-w-xl space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/customers" className="btn-ghost"><ArrowLeft size={14} /> Tillbaka</Link>
        <h1 className="text-xl font-semibold text-white">{isEdit ? 'Redigera kund' : 'Ny kund'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="label">Namn *</label>
          <input className="input" value={form.name} onChange={set('name')} placeholder="Företagsnamn AB" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">E-post</label>
            <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="info@foretag.se" />
          </div>
          <div>
            <label className="label">Telefon</label>
            <input className="input" type="tel" value={form.phone} onChange={set('phone')} placeholder="+358 40 123 4567" />
          </div>
        </div>
        <div>
          <label className="label">Adress</label>
          <textarea className="input resize-none" rows={2} value={form.address} onChange={set('address')} placeholder="Gatuadress, Stad" />
        </div>
        <div>
          <label className="label">Momsnummer (VAT ID)</label>
          <input className="input" value={form.vatNumber} onChange={set('vatNumber')} placeholder="FI12345678" />
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary px-6">
            {loading ? <><Loader2 size={15} className="animate-spin" /> Sparar...</> : (isEdit ? 'Spara ändringar' : 'Skapa kund')}
          </button>
          <Link to="/customers" className="btn-secondary">Avbryt</Link>
          {isEdit && (
            <button type="button" onClick={openDeleteModal} className="btn-danger ml-auto">
              <Trash2 size={14} /> Radera
            </button>
          )}
        </div>
      </form>

      {/* ─── Raderingsbekräftelse — modal ─────────────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-surface-100 border border-white/10 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">

            {/* Ikon + rubrik */}
            <div className="flex items-start gap-3 mb-4">
              {hasHistory ? (
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-amber-400" />
                </div>
              ) : (
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
                  <XCircle size={20} className="text-red-400" />
                </div>
              )}
              <div>
                <h3 className="text-base font-semibold text-white">Radera kund</h3>
                <p className="text-sm text-white/50 mt-0.5">
                  {customer?.name}
                </p>
              </div>
            </div>

            {/* Innehåll beroende på om kunden har historik */}
            {hasHistory ? (
              /* ── Kunden har fakturor/prenumerationer → blockera radering ── */
              <div className="space-y-3">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-sm text-amber-300 font-medium mb-1">Radering blockeras</p>
                  <p className="text-xs text-amber-200/70">
                    Kunden är kopplad till bokföringshistorik som måste bevaras:
                  </p>
                  <ul className="mt-2 space-y-0.5">
                    {invoiceCount > 0 && (
                      <li className="text-xs text-amber-200/80 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                        {invoiceCount} faktura{invoiceCount !== 1 ? 'r' : ''}
                      </li>
                    )}
                    {subscriptionCount > 0 && (
                      <li className="text-xs text-amber-200/80 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                        {subscriptionCount} prenumeration{subscriptionCount !== 1 ? 'er' : ''}
                      </li>
                    )}
                  </ul>
                </div>
                <p className="text-xs text-white/40">
                  För att bevara integriteten i din bokföring kan kunder med historik inte raderas.
                  Du kan istället redigera kunduppgifterna om de behöver uppdateras.
                </p>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="btn-secondary w-full"
                >
                  Stäng
                </button>
              </div>
            ) : (
              /* ── Kunden saknar historik → visa bekräftelse ── */
              <div className="space-y-3">
                <p className="text-sm text-white/60">
                  Är du säker på att du vill radera{' '}
                  <strong className="text-white">{customer?.name}</strong>?
                  Åtgärden kan inte ångras.
                </p>

                {deleteError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                    {deleteError}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deleting}
                    className="btn-secondary flex-1"
                  >
                    Avbryt
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={deleting}
                    className="btn-danger flex-1"
                  >
                    {deleting
                      ? <><Loader2 size={14} className="animate-spin" /> Raderar...</>
                      : <><Trash2 size={14} /> Ja, radera</>
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
