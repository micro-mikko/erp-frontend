import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Loader2, ArrowLeft, Save } from 'lucide-react';
import { api } from '../../api/client';
import type { Customer, Subscription } from '../../api/types';
import CategoryPicker from '../../components/CategoryPicker';

interface LineForm {
  description: string;
  quantity: number | '';
  unitPrice: number | '';
  vatRate: number | '';
  categoryId: string;
  subcategoryId: string;
}

const emptyLine = (): LineForm => ({
  description: '',
  quantity: 1,
  unitPrice: '',
  vatRate: 24,
  categoryId: '',
  subcategoryId: '',
});

interface SubForm {
  name: string;
  customerId: string;
  billingFrequency: string;
  billingTiming: string;
  nextInvoicingDate: string;
  startDate: string;
  endDate: string;
}

const today = () => new Date().toISOString().split('T')[0];
const firstOfNextMonth = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(1);
  return d.toISOString().split('T')[0];
};

const emptyForm = (): SubForm => ({
  name: '',
  customerId: '',
  billingFrequency: 'MONTHLY',
  billingTiming: 'IN_ADVANCE',
  nextInvoicingDate: firstOfNextMonth(),
  startDate: today(),
  endDate: '',
});

function fmt(n: number) {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'EUR' }).format(n);
}

export default function SubscriptionForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<SubForm>(emptyForm());
  const [lines, setLines] = useState<LineForm[]>([emptyLine()]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Customer[]>('/customers').then(setCustomers).catch(console.error);

    if (isEdit && id) {
      api.get<Subscription>(`/subscriptions/${id}`)
        .then(sub => {
          setForm({
            name: sub.name,
            customerId: sub.customerId,
            billingFrequency: sub.billingFrequency,
            billingTiming: sub.billingTiming,
            nextInvoicingDate: sub.nextInvoicingDate.split('T')[0],
            startDate: sub.startDate.split('T')[0],
            endDate: sub.endDate ? sub.endDate.split('T')[0] : '',
          });
          setLines((sub.lines ?? []).map(l => ({
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            vatRate: l.vatRate,
            categoryId: l.categoryId ?? 'income',
            subcategoryId: l.subcategoryId ?? 'recurring',
          })));
        })
        .catch(() => setError('Prenumerationen hittades inte'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit]);

  const updateLine = (idx: number, field: keyof LineForm, value: string | number) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const updateLineCategory = (idx: number, categoryId: string, subcategoryId: string) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, categoryId, subcategoryId } : l));
  };

  const removeLine = (idx: number) => {
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  const lineTotal = lines.reduce((s, l) => {
    const q = Number(l.quantity) || 0;
    const p = Number(l.unitPrice) || 0;
    const v = Number(l.vatRate) || 0;
    return s + q * p * (1 + v / 100);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId) { setError('Välj en kund'); return; }
    if (lines.length === 0) { setError('Lägg till minst en tjänstrad'); return; }
    for (const l of lines) {
      if (!l.description || l.quantity === '' || l.unitPrice === '') {
        setError('Fyll i alla obligatoriska fält på tjänstraderna');
        return;
      }
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        endDate: form.endDate || null,
        lines: lines.map(l => ({
          description: l.description,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          vatRate: Number(l.vatRate),
          categoryId: l.categoryId,
          subcategoryId: l.subcategoryId,
        })),
      };

      if (isEdit && id) {
        await api.put(`/subscriptions/${id}`, payload);
        navigate(`/invoices/subscriptions/${id}`);
      } else {
        const created = await api.post<Subscription>('/subscriptions', payload);
        navigate(`/invoices/subscriptions/${created.id}`);
      }
    } catch {
      setError('Kunde inte spara prenumerationen');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin text-brand-500" />
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
          <ArrowLeft size={18} className="text-white/50" />
        </button>
        <h1 className="text-xl font-semibold text-white">
          {isEdit ? 'Redigera prenumeration' : 'Ny prenumeration'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Basic info */}
        <div className="card p-5 space-y-4">
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wide">Grundinformation</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-white/40 mb-1">Namn på prenumerationen *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="t.ex. Hosting & Support — Acme"
                required
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/40 mb-1">Kund *</label>
              <select
                value={form.customerId}
                onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
                required
                className="input w-full"
              >
                <option value="">Välj kund...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-white/40 mb-1">Startdatum</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="input w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/40 mb-1">Faktureringsfrekvens *</label>
              <select
                value={form.billingFrequency}
                onChange={e => setForm(f => ({ ...f, billingFrequency: e.target.value }))}
                className="input w-full"
              >
                <option value="MONTHLY">Månadsvis</option>
                <option value="QUARTERLY">Kvartalsvis</option>
                <option value="ANNUALLY">Årsvis</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-white/40 mb-1">Faktureringstiming *</label>
              <select
                value={form.billingTiming}
                onChange={e => setForm(f => ({ ...f, billingTiming: e.target.value }))}
                className="input w-full"
              >
                <option value="IN_ADVANCE">I förskott</option>
                <option value="IN_ARREARS">I efterskott</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-white/40 mb-1">Nästa fakturadatum *</label>
              <input
                type="date"
                value={form.nextInvoicingDate}
                onChange={e => setForm(f => ({ ...f, nextInvoicingDate: e.target.value }))}
                required
                className="input w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/40 mb-1">Slutdatum (lämna tomt om löpande)</label>
            <input
              type="date"
              value={form.endDate}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              className="input sm:w-1/3"
            />
          </div>

          <div className="text-xs text-white/40 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
            {form.billingTiming === 'IN_ADVANCE'
              ? 'I förskott: fakturan täcker perioden från fakturadatumet och en period framåt.'
              : 'I efterskott: fakturan täcker perioden bakåt i tiden från fakturadatumet.'}
          </div>
        </div>

        {/* Lines */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wide">Tjänster & priser</h2>
            <button
              type="button"
              onClick={() => setLines(l => [...l, emptyLine()])}
              className="flex items-center gap-1.5 text-sm text-brand-400 hover:text-brand-300 transition-colors"
            >
              <Plus size={14} /> Lägg till rad
            </button>
          </div>

          <div className="p-5 space-y-3">
            {lines.map((line, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-5">
                    {idx === 0 && <label className="block text-xs font-medium text-white/40 mb-1">Beskrivning *</label>}
                    <input
                      type="text"
                      value={line.description}
                      onChange={e => updateLine(idx, 'description', e.target.value)}
                      placeholder="t.ex. Hosting, Support..."
                      required
                      className="input w-full"
                    />
                  </div>
                  <div className="col-span-2">
                    {idx === 0 && <label className="block text-xs font-medium text-white/40 mb-1">Antal</label>}
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={line.quantity}
                      onChange={e => updateLine(idx, 'quantity', e.target.value)}
                      required
                      className="input w-full"
                    />
                  </div>
                  <div className="col-span-2">
                    {idx === 0 && <label className="block text-xs font-medium text-white/40 mb-1">À-pris (€)</label>}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={e => updateLine(idx, 'unitPrice', e.target.value)}
                      placeholder="0.00"
                      required
                      className="input w-full"
                    />
                  </div>
                  <div className="col-span-2">
                    {idx === 0 && <label className="block text-xs font-medium text-white/40 mb-1">Moms %</label>}
                    <select
                      value={line.vatRate}
                      onChange={e => updateLine(idx, 'vatRate', Number(e.target.value))}
                      className="input w-full"
                    >
                      <option value={0}>0%</option>
                      <option value={10}>10%</option>
                      <option value={14}>14%</option>
                      <option value={24}>24%</option>
                      <option value={25.5}>25.5%</option>
                    </select>
                  </div>
                  <div className="col-span-1 flex items-end pb-0.5">
                    {idx === 0 && <div className="h-5 mb-1" />}
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      disabled={lines.length === 1}
                      className="p-2 text-white/20 hover:text-red-400 disabled:opacity-30 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-11">
                    {idx === 0 && <label className="block text-xs font-medium text-white/40 mb-1">Dimension</label>}
                    <CategoryPicker
                      categoryId={line.categoryId}
                      subcategoryId={line.subcategoryId}
                      onChange={(cId, sId) => updateLineCategory(idx, cId, sId)}
                      filter={['income']}
                      className="w-full"
                    />
                  </div>
                  <div className="col-span-1" />
                </div>
              </div>
            ))}

            {lines.length > 0 && (
              <div className="flex justify-end pt-2 border-t border-white/[0.06]">
                <div className="text-sm">
                  <span className="text-white/40 mr-3">Totalt per period (inkl. moms):</span>
                  <span className="font-bold text-white">{fmt(lineTotal)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-secondary"
          >
            Avbryt
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {isEdit ? 'Spara ändringar' : 'Skapa prenumeration'}
          </button>
        </div>
      </form>
    </div>
  );
}
