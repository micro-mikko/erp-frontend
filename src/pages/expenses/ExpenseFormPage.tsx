import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Trash2, Package } from 'lucide-react';
import { api } from '../../api/client';
import type { Expense, Category, AssetType, DepreciationStart } from '../../api/types';
import CategoryPicker from '../../components/CategoryPicker';
import SupplierPicker from '../../components/SupplierPicker';
import DimensionPicker from '../../components/DimensionPicker';

const COST_CATEGORIES = ['cogs', 'software', 'hardware', 'personnel', 'marketing', 'office', 'other'];

function getDebitAccount(categoryId: string, subcategoryId: string, categories: Category[]): string {
  const sub = categories.find(c => c.id === categoryId)?.subcategories.find(s => s.id === subcategoryId);
  return sub?.accounts.debit ?? '';
}

interface LineItem {
  description: string;
  amount: number | '';    // totalt inkl moms
  vatRate: number;        // 0 | 10 | 14 | 25.5
  vatAmount: number;      // auto-beräknat
  categoryId: string;
  subcategoryId: string;
  dimensionId: string;
}

interface ExpenseForm {
  date: string;
  description: string;   // rubrik/titel på utgiften
  supplier: string;
  supplierId: string;
  dueDate: string;
  status: string;
}

const emptyLine = (): LineItem => ({
  description: '',
  amount: '',
  vatRate: 25.5,
  vatAmount: 0,
  categoryId: '',
  subcategoryId: '',
  dimensionId: '',
});

const fmt = (n: number) =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'EUR' }).format(n);

export default function ExpenseFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<ExpenseForm>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    supplier: '',
    supplierId: '',
    dueDate: '',
    status: 'PENDING',
  });
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);

  // Asset activation
  const [activateAsAsset, setActivateAsAsset] = useState(false);
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('COMPUTER_IT');
  const [depreciationYears, setDepreciationYears] = useState(5);
  const [depreciationStart, setDepreciationStart] = useState<DepreciationStart>('ACQUISITION_MONTH');
  const [assetThreshold, setAssetThreshold] = useState(500);
  const [assetCategories, setAssetCategories] = useState<string[]>(['COMPUTER_IT', 'PHONE_TABLET', 'VEHICLE', 'MACHINERY']);

  useEffect(() => {
    api.get<Category[]>('/accounting/categories').then(setCategories).catch(console.error);
    api.get<{ assetActivationThreshold?: number; assetActivationCategories?: string[] }>('/settings')
      .then(s => {
        if (s.assetActivationThreshold != null) setAssetThreshold(s.assetActivationThreshold);
        if (s.assetActivationCategories) setAssetCategories(s.assetActivationCategories);
      })
      .catch(console.error);
    if (!id) {
      setLoading(false);
      return;
    }
    api.get<Expense>(`/expenses/${id}`)
      .then(exp => {
        setExpense(exp);
        setForm({
          date: exp.date.split('T')[0],
          description: exp.description ?? '',
          supplier: exp.supplier ?? '',
          supplierId: exp.supplierId ?? '',
          dueDate: exp.dueDate ? exp.dueDate.split('T')[0] : '',
          status: exp.status ?? 'PENDING',
        });
        // Återskapa lines från befintlig data
        if (exp.lines && exp.lines.length > 0) {
          setLines(exp.lines.map(l => ({
            description: l.description,
            amount: l.amount,
            vatRate: l.vatRate,
            vatAmount: l.vatAmount,
            categoryId: l.categoryId ?? '',
            subcategoryId: l.subcategoryId ?? '',
            dimensionId: l.dimensionId ?? '',
          })));
        } else {
          // Bakåtkompatibilitet: utgifter utan lines
          setLines([{
            description: exp.description ?? '',
            amount: exp.amount ?? '',
            vatRate: 25.5,
            vatAmount: exp.vatAmount ?? 0,
            categoryId: exp.categoryId ?? '',
            subcategoryId: exp.subcategoryId ?? '',
            dimensionId: '',
          }]);
        }
      })
      .catch(() => setExpense(null))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Rad-hantering ──────────────────────────────────────────────────────────

  const addLine = () => setLines(ls => [...ls, emptyLine()]);
  const removeLine = (i: number) => setLines(ls => ls.filter((_, idx) => idx !== i));

  const updateLine = (i: number, key: keyof LineItem, val: string | number) => {
    setLines(ls => ls.map((l, idx) => {
      if (idx !== i) return l;
      const updated = { ...l, [key]: val };
      // Auto-beräkna moms när belopp eller sats ändras
      // amount är TOTALT inkl moms → vatAmount = amount × rate / (100 + rate)
      if (key === 'amount' || key === 'vatRate') {
        const amt  = parseFloat(String(key === 'amount'  ? val : updated.amount))  || 0;
        const rate = parseFloat(String(key === 'vatRate' ? val : updated.vatRate)) || 0;
        updated.vatAmount = Math.round(amt * rate / (100 + rate) * 100) / 100;
      }
      return updated;
    }));
  };

  const updateLineCategory = (i: number, categoryId: string, subcategoryId: string) =>
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, categoryId, subcategoryId } : l));

  // ── Live-totaler ──────────────────────────────────────────────────────────

  const totals = lines.reduce(
    (acc, l) => ({
      total:     acc.total     + (parseFloat(String(l.amount)) || 0),
      vatAmount: acc.vatAmount + (l.vatAmount || 0),
    }),
    { total: 0, vatAmount: 0 }
  );

  // Map category ID to asset type for suggestion
  const CATEGORY_TO_ASSET_TYPE: Record<string, AssetType> = {
    hardware: 'COMPUTER_IT',
  };
  const firstCat = lines[0]?.categoryId || '';
  const suggestAsset = totals.total >= assetThreshold
    && (firstCat === 'hardware' || assetCategories.some(ac => ac === CATEGORY_TO_ASSET_TYPE[firstCat]));

  // ── Spara ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (lines.some(l => !l.description.trim())) {
      setError('Alla rader måste ha en beskrivning');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        date: form.date,
        description: form.description,
        supplier: form.supplier || null,
        supplierId: form.supplierId || null,
        dueDate: form.dueDate || null,
        status: form.status,
        amount: totals.total,
        vatAmount: totals.vatAmount,
        lines: lines.map(l => ({
          description: l.description,
          amount: parseFloat(String(l.amount)) || 0,
          vatRate: l.vatRate,
          vatAmount: l.vatAmount,
          categoryId: l.categoryId || null,
          subcategoryId: l.subcategoryId || null,
          dimensionId: l.dimensionId || null,
        })),
      };
      if (activateAsAsset) {
        payload.activateAsAsset = true;
        payload.assetData = {
          name: assetName || form.description,
          assetType,
          depreciationYears,
          depreciationStart,
        };
      }
      if (isEdit && id) {
        await api.put(`/expenses/${id}`, payload);
        navigate(`/expenses/${id}`);
      } else {
        const created = await api.post<{ id: string }>('/expenses', payload);
        navigate(`/expenses/${created.id}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kunde inte spara');
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-brand-500" size={28} />
      </div>
    );

  if (isEdit && !expense)
    return (
      <div className="p-6 max-w-4xl">
        <Link to="/expenses" className="btn-ghost inline-flex items-center gap-2 mb-4">
          <ArrowLeft size={14} /> Tillbaka
        </Link>
        <div className="card p-6 text-center text-white/50">Utgiften hittades inte</div>
      </div>
    );

  return (
    <div className="p-6 max-w-4xl space-y-5">
      <div className="flex items-center gap-3">
        <Link to={isEdit ? `/expenses/${id}` : '/expenses'} className="btn-ghost">
          <ArrowLeft size={14} /> Tillbaka
        </Link>
        <h1 className="text-xl font-semibold text-white">{isEdit ? 'Redigera utgift' : 'Ny utgift'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Headerfält */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-white">Uppgifter</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Datum</label>
              <input
                className="input"
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Förfallodatum</label>
              <input
                className="input"
                type="date"
                value={form.dueDate}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="label">Leverantör</label>
            <SupplierPicker
              value={form.supplierId ? { id: form.supplierId, name: form.supplier } : null}
              onChange={s => setForm(f => ({ ...f, supplierId: s?.id ?? '', supplier: s?.name ?? '' }))}
            />
          </div>
          <div>
            <label className="label">Beskrivning *</label>
            <input
              className="input"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Kontorsmaterial, resor..."
              required
            />
          </div>
        </div>

        {/* Rader */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Utgiftsrader</h2>
            <button type="button" onClick={addLine} className="btn-ghost text-xs">
              <Plus size={13} /> Lägg till rad
            </button>
          </div>

          <div className="space-y-3">
            {lines.map((line, i) => (
              <div key={i} className="bg-surface-200/50 rounded-lg p-3 space-y-2">
                {/* Rad 1: beskrivning + belopp + momssats + moms + ta bort */}
                <div className="flex gap-2 items-start">
                  <div className="flex-1">
                    <input
                      className="input text-xs py-1.5"
                      value={line.description}
                      onChange={e => updateLine(i, 'description', e.target.value)}
                      placeholder="Beskrivning av utgiften"
                      required
                    />
                  </div>
                  <div className="w-32">
                    <input
                      className="input text-xs py-1.5 text-right"
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.amount}
                      onChange={e => updateLine(i, 'amount', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                      placeholder="Belopp inkl."
                    />
                  </div>
                  <div className="w-24">
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
                  <div className="w-24 text-right text-xs py-1.5 text-white/40 whitespace-nowrap">
                    moms {fmt(line.vatAmount)}
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
                {/* Rad 2: kategori + dimension */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/30 uppercase tracking-wide whitespace-nowrap">Kategori</span>
                  <CategoryPicker
                    categoryId={line.categoryId}
                    subcategoryId={line.subcategoryId}
                    onChange={(cId, sId) => updateLineCategory(i, cId, sId)}
                    filter={COST_CATEGORIES}
                    className="flex-1"
                  />
                  <DimensionPicker
                    dimensionId={line.dimensionId}
                    onChange={dimId => updateLine(i, 'dimensionId', dimId)}
                    accountNumber={getDebitAccount(line.categoryId, line.subcategoryId, categories)}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Totaler */}
          <div className="border-t border-white/5 pt-3 flex justify-end">
            <div className="space-y-1.5 text-sm min-w-52">
              <div className="flex justify-between text-white/50">
                <span>Netto</span>
                <span>{fmt(totals.total - totals.vatAmount)}</span>
              </div>
              <div className="flex justify-between text-white/50">
                <span>Moms</span>
                <span>{fmt(totals.vatAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold text-white border-t border-white/5 pt-1.5">
                <span>Totalt</span>
                <span className="text-brand-300">{fmt(totals.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Asset activation banner */}
        {suggestAsset && (
          <div className="p-4 bg-brand-600/10 border border-brand-500/20 rounded-xl space-y-3">
            <div className="flex items-start gap-3">
              <Package size={18} className="text-brand-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium text-brand-300">Aktivera som anläggningstillgång?</div>
                <div className="text-xs text-white/40 mt-0.5">
                  Beloppet ({fmt(totals.total)}) överstiger tröskelvärdet ({fmt(assetThreshold)}).
                  Kostnaden kan aktiveras och skrivas av över tid istället för att kostnadsföras direkt.
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={activateAsAsset}
                  onChange={e => setActivateAsAsset(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-surface-200 text-brand-500 focus:ring-brand-500"
                />
                <span className="text-sm text-white/60">Aktivera</span>
              </label>
            </div>
            {activateAsAsset && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="label">Tillgångsnamn</label>
                  <input
                    className="input"
                    value={assetName}
                    onChange={e => setAssetName(e.target.value)}
                    placeholder={form.description || 'Namn på tillgången'}
                  />
                </div>
                <div>
                  <label className="label">Tillgångstyp</label>
                  <select className="input" value={assetType} onChange={e => setAssetType(e.target.value as AssetType)}>
                    <option value="COMPUTER_IT">Dator & IT</option>
                    <option value="PHONE_TABLET">Telefon & surfplatta</option>
                    <option value="VEHICLE">Fordon</option>
                    <option value="MACHINERY">Maskiner</option>
                    <option value="FURNITURE">Möbler</option>
                    <option value="BUILDING">Byggnader</option>
                    <option value="OTHER">Övrigt</option>
                  </select>
                </div>
                <div>
                  <label className="label">Avskrivningstid (år)</label>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    max="50"
                    value={depreciationYears}
                    onChange={e => setDepreciationYears(parseInt(e.target.value) || 5)}
                  />
                </div>
                <div>
                  <label className="label">Avskrivning börjar</label>
                  <select className="input" value={depreciationStart} onChange={e => setDepreciationStart(e.target.value as DepreciationStart)}>
                    <option value="ACQUISITION_MONTH">Anskaffningsmånad</option>
                    <option value="NEXT_MONTH">Nästa månad</option>
                    <option value="FISCAL_YEAR_START">Nästa räkenskapsårsstart</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>
        )}

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? <Loader2 size={14} className="animate-spin" /> : isEdit ? 'Spara ändringar' : 'Spara utgift'}
          </button>
          <Link to={isEdit ? `/expenses/${id}` : '/expenses'} className="btn-secondary">
            Avbryt
          </Link>
        </div>
      </form>
    </div>
  );
}
