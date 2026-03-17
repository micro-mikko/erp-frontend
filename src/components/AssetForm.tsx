import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import type { AssetType, DepreciationStart } from '../api/types';

const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: 'COMPUTER_IT', label: 'Dator & IT' },
  { value: 'PHONE_TABLET', label: 'Telefon & surfplatta' },
  { value: 'VEHICLE', label: 'Fordon' },
  { value: 'MACHINERY', label: 'Maskiner' },
  { value: 'FURNITURE', label: 'Möbler' },
  { value: 'BUILDING', label: 'Byggnader' },
  { value: 'OTHER', label: 'Övrigt' },
];

const DEPRECIATION_STARTS: { value: DepreciationStart; label: string }[] = [
  { value: 'ACQUISITION_MONTH', label: 'Anskaffningsmånad' },
  { value: 'NEXT_MONTH', label: 'Nästa månad' },
  { value: 'FISCAL_YEAR_START', label: 'Nästa räkenskapsårsstart' },
];

export interface AssetFormData {
  name: string;
  assetType: AssetType;
  description: string;
  acquisitionDate: string;
  acquisitionValue: number | '';
  depreciationYears: number | '';
  depreciationStart: DepreciationStart;
}

interface AssetFormProps {
  initial?: Partial<AssetFormData>;
  onSubmit: (data: AssetFormData) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  loading?: boolean;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'EUR' }).format(n);

export default function AssetForm({ initial, onSubmit, onCancel, submitLabel = 'Spara', loading = false }: AssetFormProps) {
  const [form, setForm] = useState<AssetFormData>({
    name: initial?.name ?? '',
    assetType: initial?.assetType ?? 'COMPUTER_IT',
    description: initial?.description ?? '',
    acquisitionDate: initial?.acquisitionDate ?? new Date().toISOString().split('T')[0],
    acquisitionValue: initial?.acquisitionValue ?? '',
    depreciationYears: initial?.depreciationYears ?? 5,
    depreciationStart: initial?.depreciationStart ?? 'ACQUISITION_MONTH',
  });
  const [error, setError] = useState('');

  // Live calculations
  const acqVal = parseFloat(String(form.acquisitionValue)) || 0;
  const depYears = parseFloat(String(form.depreciationYears)) || 1;
  const yearlyDep = depYears > 0 ? acqVal / depYears : 0;
  const monthlyDep = yearlyDep / 12;

  // Calculate fully depreciated date
  let fullyDepDate = '';
  if (form.acquisitionDate && depYears > 0) {
    const acqDate = new Date(form.acquisitionDate);
    let startMonth = acqDate.getUTCMonth();
    let startYear = acqDate.getUTCFullYear();
    if (form.depreciationStart === 'NEXT_MONTH') {
      startMonth += 1;
      if (startMonth > 11) { startMonth = 0; startYear++; }
    } else if (form.depreciationStart === 'FISCAL_YEAR_START') {
      if (!(startMonth === 0 && acqDate.getUTCDate() === 1)) startYear++;
      startMonth = 0;
    }
    const totalMonths = depYears * 12;
    const endDate = new Date(Date.UTC(startYear, startMonth + totalMonths - 1, 28));
    fullyDepDate = endDate.toISOString().split('T')[0];
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Namn krävs'); return; }
    if (acqVal <= 0) { setError('Anskaffningsvärde måste vara > 0'); return; }
    if (depYears <= 0) { setError('Avskrivningstid måste vara > 0'); return; }
    setError('');
    try {
      await onSubmit(form);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kunde inte spara');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-white">Tillgångsuppgifter</h2>

        <div>
          <label className="label">Namn *</label>
          <input
            className="input"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="MacBook Pro 16&quot;"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Typ *</label>
            <select
              className="input"
              value={form.assetType}
              onChange={e => setForm(f => ({ ...f, assetType: e.target.value as AssetType }))}
            >
              {ASSET_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Inköpsdatum *</label>
            <input
              className="input"
              type="date"
              value={form.acquisitionDate}
              onChange={e => setForm(f => ({ ...f, acquisitionDate: e.target.value }))}
              required
            />
          </div>
        </div>

        <div>
          <label className="label">Beskrivning</label>
          <input
            className="input"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Modell, serienummer etc."
          />
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-white">Avskrivning</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Anskaffningsvärde (EUR) *</label>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={form.acquisitionValue}
              onChange={e => setForm(f => ({ ...f, acquisitionValue: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 }))}
              placeholder="1 500"
              required
            />
          </div>
          <div>
            <label className="label">Avskrivningstid (år) *</label>
            <input
              className="input"
              type="number"
              min="1"
              max="50"
              step="1"
              value={form.depreciationYears}
              onChange={e => setForm(f => ({ ...f, depreciationYears: e.target.value === '' ? '' : parseInt(e.target.value) || 1 }))}
              required
            />
          </div>
        </div>

        <div>
          <label className="label">Avskrivning börjar</label>
          <select
            className="input"
            value={form.depreciationStart}
            onChange={e => setForm(f => ({ ...f, depreciationStart: e.target.value as DepreciationStart }))}
          >
            {DEPRECIATION_STARTS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Live calculation preview */}
        {acqVal > 0 && (
          <div className="bg-surface-200/50 rounded-lg p-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-white/50">
              <span>Anskaffningsvärde</span>
              <span>{fmt(acqVal)}</span>
            </div>
            <div className="flex justify-between text-white/50">
              <span>Avskrivning/år</span>
              <span>{fmt(yearlyDep)}</span>
            </div>
            <div className="flex justify-between text-white/50">
              <span>Avskrivning/mån</span>
              <span>{fmt(monthlyDep)}</span>
            </div>
            {fullyDepDate && (
              <div className="flex justify-between text-white/50 border-t border-white/5 pt-1.5">
                <span>Fullt avskriven</span>
                <span>{fullyDepDate}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>
      )}

      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
          {loading ? <Loader2 size={14} className="animate-spin" /> : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Avbryt
        </button>
      </div>
    </form>
  );
}
