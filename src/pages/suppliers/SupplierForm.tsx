import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Trash2, Wand2 } from 'lucide-react';
import { api } from '../../api/client';
import type { Supplier } from '../../api/types';

export default function SupplierForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    name: '', businessId: '', email: '', phone: '',
    address: '', postalCode: '', city: '', country: 'FI',
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [enrichment, setEnrichment] = useState<{
    available: boolean;
    data?: { businessId?: string; email?: string; phone?: string; address?: string };
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    api.get<Supplier>(`/suppliers/${id}`)
      .then(s => setForm({
        name:       s.name       || '',
        businessId: s.businessId || '',
        email:      s.email      || '',
        phone:      s.phone      || '',
        address:    s.address    || '',
        postalCode: s.postalCode || '',
        city:       s.city       || '',
        country:    s.country    || 'FI',
      }))
      .catch(() => setError('Kunde inte hämta leverantör'))
      .finally(() => setLoading(false));

    // Hämta berikningsdata från skannade fakturor
    api.get<{ available: boolean; data?: any }>(`/suppliers/${id}/enrichment-data`)
      .then(setEnrichment)
      .catch(() => {});
  }, [id]);

  const applyEnrichment = () => {
    if (!enrichment?.data) return;
    const d = enrichment.data;
    setForm(prev => ({
      ...prev,
      businessId: prev.businessId || d.businessId || '',
      email:      prev.email      || d.email      || '',
      phone:      prev.phone      || d.phone      || '',
      address:    prev.address    || d.address    || '',
    }));
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/suppliers/${id}`, form);
      } else {
        await api.post('/suppliers', form);
      }
      navigate('/suppliers');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kunde inte spara leverantör');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Radera leverantören? Kopplade utgifter påverkas inte.')) return;
    setDeleting(true);
    try {
      await api.delete(`/suppliers/${id}`);
      navigate('/suppliers');
    } catch {
      setError('Kunde inte radera leverantören');
      setDeleting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-brand-500" size={28} />
    </div>
  );

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/suppliers" className="btn-ghost p-2">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-white">
            {isEdit ? 'Redigera leverantör' : 'Ny leverantör'}
          </h1>
          <p className="text-sm text-white/40 mt-0.5">
            {isEdit ? 'Uppdatera leverantörsinformation' : 'Lägg till en ny leverantör i systemet'}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Berikningsknapp — visa om det finns skannade fakturor */}
      {isEdit && enrichment?.available && (
        <div className="mb-5 p-3 rounded-xl border border-purple-500/20 bg-purple-500/5 flex items-center justify-between">
          <p className="text-sm text-white/60">Kontaktuppgifter hittades i en skannad faktura</p>
          <button
            type="button"
            onClick={applyEnrichment}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 transition-colors"
          >
            <Wand2 size={14} />
            Uppdatera uppgifter från faktura
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Företagsuppgifter */}
        <div className="card space-y-4">
          <h2 className="text-sm font-medium text-white/70">Företagsuppgifter</h2>
          <div>
            <label className="label">Företagsnamn *</label>
            <input className="input" value={form.name} onChange={set('name')} required placeholder="Leverantör Ab" />
          </div>
          <div>
            <label className="label">FO-nummer</label>
            <input className="input" value={form.businessId} onChange={set('businessId')} placeholder="1234567-8" />
          </div>
        </div>

        {/* Kontaktuppgifter */}
        <div className="card space-y-4">
          <h2 className="text-sm font-medium text-white/70">Kontaktuppgifter</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">E-post</label>
              <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="info@leverantor.fi" />
            </div>
            <div>
              <label className="label">Telefon</label>
              <input className="input" type="tel" value={form.phone} onChange={set('phone')} placeholder="+358 40 123 4567" />
            </div>
          </div>
          <div>
            <label className="label">Gatuadress</label>
            <input className="input" value={form.address} onChange={set('address')} placeholder="Storgatan 1" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Postnummer</label>
              <input className="input" value={form.postalCode} onChange={set('postalCode')} placeholder="00100" />
            </div>
            <div>
              <label className="label">Stad</label>
              <input className="input" value={form.city} onChange={set('city')} placeholder="Helsingfors" />
            </div>
            <div>
              <label className="label">Land</label>
              <input className="input" value={form.country} onChange={set('country')} placeholder="FI" />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {isEdit ? 'Spara ändringar' : 'Skapa leverantör'}
            </button>
            <Link to="/suppliers" className="btn-secondary">Avbryt</Link>
          </div>
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Radera
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
