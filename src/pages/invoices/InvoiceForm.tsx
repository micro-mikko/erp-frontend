import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';
import { api } from '../../api/client';
import type { Customer, Invoice, Category } from '../../api/types';
import CategoryPicker from '../../components/CategoryPicker';
import DimensionPicker from '../../components/DimensionPicker';

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  categoryId: string;
  subcategoryId: string;
  dimensionId: string;
}

const INCOME_CATEGORIES = ['income'];

function getDebitAccount(categoryId: string, subcategoryId: string, categories: Category[]): string {
  const sub = categories.find(c => c.id === categoryId)?.subcategories.find(s => s.id === subcategoryId);
  return sub?.accounts.debit ?? '';
}

export default function InvoiceForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    customerId: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    notes: '',
  });
  const [lines, setLines] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0, vatRate: 25.5, categoryId: '', subcategoryId: '', dimensionId: '' },
  ]);

  useEffect(() => {
    const fetches: Promise<unknown>[] = [
      api.get<Customer[]>('/customers').then(setCustomers),
      api.get<Category[]>('/accounting/categories').then(setCategories),
    ];
    if (id) {
      fetches.push(
        api.get<Invoice>(`/invoices/${id}`).then(inv => {
          setForm({
            customerId: inv.customerId,
            issueDate: new Date(inv.issueDate).toISOString().split('T')[0],
            dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().split('T')[0] : '',
            notes: inv.notes || '',
          });
          setLines((inv.lines ?? []).map(l => ({
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            vatRate: l.vatRate,
            categoryId: l.categoryId || '',
            subcategoryId: l.subcategoryId || '',
            dimensionId: l.dimensionId || '',
          })));
        })
      );
    }
    Promise.all(fetches).catch(console.error).finally(() => setInitialLoading(false));
  }, [id]);

  const addLine = () =>
    setLines(ls => [...ls, { description: '', quantity: 1, unitPrice: 0, vatRate: 25.5, categoryId: '', subcategoryId: '', dimensionId: '' }]);
  const removeLine = (i: number) => setLines(ls => ls.filter((_, idx) => idx !== i));
  const updateLine = (i: number, key: keyof LineItem, val: string | number) =>
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, [key]: val } : l));
  const updateLineCategory = (i: number, categoryId: string, subcategoryId: string) =>
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, categoryId, subcategoryId } : l));

  // Live calc
  const totals = lines.reduce((acc, l) => {
    const net = l.quantity * l.unitPrice;
    const vat = net * (l.vatRate / 100);
    return { subtotal: acc.subtotal + net, vatAmount: acc.vatAmount + vat };
  }, { subtotal: 0, vatAmount: 0 });
  const total = totals.subtotal + totals.vatAmount;

  const fmt = (n: number) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'EUR' }).format(n);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.customerId) { setError('Välj en kund'); return; }
    if (lines.some(l => !l.description)) { setError('Alla rader måste ha en beskrivning'); return; }
    setError('');
    setLoading(true);
    try {
      const payload = {
        ...form,
        lines: lines.map(l => ({ ...l, dimensionId: l.dimensionId || null })),
      };
      if (isEdit && id) {
        await api.put(`/invoices/${id}`, payload);
        navigate(`/invoices/${id}`);
      } else {
        const inv = await api.post<{ id: string }>('/invoices', payload);
        navigate(`/invoices/${inv.id}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fel');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-brand-500" size={28} />
    </div>
  );

  return (
    <div className="p-6 max-w-5xl space-y-5">
      <div className="flex items-center gap-3">
        <Link to={isEdit && id ? `/invoices/${id}` : '/invoices'} className="btn-ghost">
          <ArrowLeft size={14} /> Tillbaka
        </Link>
        <h1 className="text-xl font-semibold text-white">{isEdit ? 'Redigera faktura' : 'Ny faktura'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic info */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-white">Faktureringsuppgifter</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="label">Kund *</label>
              <select
                className="input"
                value={form.customerId}
                onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
                required
              >
                <option value="">Välj kund...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Fakturadatum</label>
              <input className="input" type="date" value={form.issueDate}
                onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))} />
            </div>
            <div>
              <label className="label">Förfallodatum</label>
              <input className="input" type="date" value={form.dueDate}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Lines */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Fakturarader</h2>
            <button type="button" onClick={addLine} className="btn-ghost text-xs">
              <Plus size={13} /> Lägg till rad
            </button>
          </div>

          <div className="space-y-3">
            {lines.map((line, i) => {
              const net = line.quantity * line.unitPrice;
              const amount = net * (1 + line.vatRate / 100);
              return (
                <div key={i} className="bg-surface-200/50 rounded-lg p-3 space-y-2">
                  {/* Row 1: description + amount + delete */}
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      <input
                        className="input text-xs py-1.5"
                        value={line.description}
                        onChange={e => updateLine(i, 'description', e.target.value)}
                        placeholder="Beskrivning av tjänst/vara"
                        required
                      />
                    </div>
                    <div className="w-20">
                      <input
                        className="input text-xs py-1.5 text-right"
                        type="number" min="0" step="0.01"
                        value={line.quantity}
                        onChange={e => updateLine(i, 'quantity', parseFloat(e.target.value) || 0)}
                        placeholder="Antal"
                      />
                    </div>
                    <div className="w-28">
                      <input
                        className="input text-xs py-1.5 text-right"
                        type="number" min="0" step="0.01"
                        value={line.unitPrice}
                        onChange={e => updateLine(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                        placeholder="Á-pris"
                      />
                    </div>
                    <div className="w-20">
                      <select
                        className="input text-xs py-1.5"
                        value={line.vatRate}
                        onChange={e => updateLine(i, 'vatRate', parseFloat(e.target.value))}
                      >
                        <option value={0}>0%</option>
                        <option value={10}>10%</option>
                        <option value={14}>14%</option>
                        <option value={25.5}>25.5%</option>
                      </select>
                    </div>
                    <div className="w-28 text-right font-medium text-white/80 text-xs py-1.5 whitespace-nowrap">
                      {fmt(amount)}
                    </div>
                    <div className="w-6">
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(i)}
                          className="p-1 text-white/20 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Row 2: category + dimension pickers */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/30 uppercase tracking-wide whitespace-nowrap">Kategori</span>
                    <CategoryPicker
                      categoryId={line.categoryId}
                      subcategoryId={line.subcategoryId}
                      onChange={(cId, sId) => updateLineCategory(i, cId, sId)}
                      filter={INCOME_CATEGORIES}
                      className="flex-1"
                    />
                    <DimensionPicker
                      dimensionId={line.dimensionId}
                      onChange={id => updateLine(i, 'dimensionId', id)}
                      accountNumber={getDebitAccount(line.categoryId, line.subcategoryId, categories)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="border-t border-white/5 pt-3 flex justify-end">
            <div className="space-y-1.5 text-sm min-w-52">
              <div className="flex justify-between text-white/50">
                <span>Netto</span><span>{fmt(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-white/50">
                <span>Moms</span><span>{fmt(totals.vatAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold text-white border-t border-white/5 pt-1.5">
                <span>Totalt</span><span className="text-brand-300">{fmt(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <label className="label">Anteckningar</label>
          <textarea className="input resize-none" rows={3} value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Frivilliga anteckningar på fakturan..." />
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={loading} className="btn-primary px-6">
            {loading ? <><Loader2 size={15} className="animate-spin" /> Sparar...</> : isEdit ? 'Spara ändringar' : 'Skapa faktura'}
          </button>
          <Link to={isEdit && id ? `/invoices/${id}` : '/invoices'} className="btn-secondary">Avbryt</Link>
        </div>
      </form>
    </div>
  );
}
