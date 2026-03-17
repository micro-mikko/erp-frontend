import { useState, useEffect } from 'react';
import { Save, CheckCircle } from 'lucide-react';

interface CompanySettings {
  id: string;
  name: string;
  businessId: string;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string;
  iban: string | null;
  bankName: string | null;
  phone: string | null;
  email: string | null;
  languagePreference: string;
  vatReportingPeriod: string;
  assetActivationThreshold: number;
  assetActivationCategories: string[];
}

export default function Settings() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [form, setForm] = useState<Partial<CompanySettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetch('/api/settings', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (data.error) throw new Error(data.error);
        setSettings(data);
        setForm(data);
        setLoading(false);
      })
      .catch((err) => { setError(`Kunde inte hämta inställningar: ${err.message}`); setLoading(false); });
  }, []);

  const handleChange = (field: keyof CompanySettings, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          address:            form.address || null,
          city:               form.city || null,
          postalCode:         form.postalCode || null,
          iban:               form.iban || null,
          bankName:           form.bankName || null,
          phone:              form.phone || null,
          email:              form.email || null,
          languagePreference:  form.languagePreference || 'sv',
          vatReportingPeriod: form.vatReportingPeriod || 'MONTHLY',
          assetActivationThreshold: form.assetActivationThreshold ?? 500,
          assetActivationCategories: form.assetActivationCategories ?? [],
        }),
      });
      if (!res.ok) throw new Error('Sparning misslyckades');
      const updated = await res.json();
      setSettings(updated);
      setForm(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Kunde inte spara inställningar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-white/40 text-sm">Laddar...</div>
  );

  const field = (
    label: string,
    key: keyof CompanySettings,
    placeholder = '',
    readOnly = false
  ) => (
    <div>
      <label className="label">{label}</label>
      <input
        type="text"
        value={(form[key] as string) || ''}
        onChange={e => !readOnly && handleChange(key, e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`input ${readOnly ? 'opacity-50 cursor-default' : ''}`}
      />
    </div>
  );

  return (
    <div className="space-y-5 max-w-4xl">
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Company identity (read-only) */}
      <div className="rounded-2xl border border-white/8 bg-white/5 p-5 space-y-4">
        <h2 className="text-sm font-medium text-white/70">Företagsuppgifter</h2>
        <div className="grid grid-cols-2 gap-4">
          {field('Företagsnamn', 'name', '', true)}
          {field('FO-nummer', 'businessId', '', true)}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {field('Gatuadress', 'address', 'Storgatan 1')}
          {field('Postnummer', 'postalCode', '00100')}
          {field('Stad', 'city', 'Helsingfors')}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {field('Telefon', 'phone', '+358 40 123 4567')}
          {field('E-post', 'email', 'info@foretag.fi')}
        </div>
      </div>

      {/* Payment info */}
      <div className="rounded-2xl border border-white/8 bg-white/5 p-5 space-y-4">
        <h2 className="text-sm font-medium text-white/70">Betalningsinformation</h2>
        <p className="text-xs text-white/40">
          IBAN och bankuppgifter visas på faktura-PDF tillsammans med betalningsbarcode.
        </p>
        <div className="grid grid-cols-2 gap-4">
          {field('IBAN', 'iban', 'FI37 1590 3000 0007 76')}
          {field('Bank', 'bankName', 'Nordea')}
        </div>
      </div>

      {/* Language */}
      <div className="rounded-2xl border border-white/8 bg-white/5 p-5 space-y-4">
        <h2 className="text-sm font-medium text-white/70">Standardspråk för fakturor</h2>
        <div>
          <label className="label">Standardspråk</label>
          <select
            value={form.languagePreference || 'sv'}
            onChange={e => handleChange('languagePreference', e.target.value)}
            className="input w-auto"
          >
            <option value="sv">Svenska</option>
            <option value="fi">Suomi</option>
            <option value="en">English</option>
          </select>
          <p className="text-xs text-white/30 mt-1">Du kan alltid välja annat språk vid nedladdning.</p>
        </div>
      </div>

      {/* VAT reporting period */}
      <div className="rounded-2xl border border-white/8 bg-white/5 p-5 space-y-4">
        <h2 className="text-sm font-medium text-white/70">Momsredovisning</h2>
        <div>
          <label className="label">Momsrapporteringsperiod</label>
          <select
            value={(form.vatReportingPeriod ?? 'MONTHLY').toUpperCase()}
            onChange={e => handleChange('vatReportingPeriod', e.target.value)}
            className="input w-auto"
          >
            <option value="MONTHLY">Månadsvis</option>
            <option value="QUARTERLY">Kvartalsvis</option>
            <option value="YEARLY">Årsvis</option>
          </select>
          <p className="text-xs text-white/30 mt-1">
            Styr vilket datumintervall som krävs vid momsanmälan till Vero.fi.
          </p>
        </div>
      </div>

      {/* Asset activation settings */}
      <div className="rounded-2xl border border-white/8 bg-white/5 p-5 space-y-4">
        <h2 className="text-sm font-medium text-white/70">Anläggningstillgångar</h2>
        <p className="text-xs text-white/40">
          Utgifter som överstiger tröskelvärdet och tillhör valda kategorier
          kan aktiveras som anläggningstillgångar med linjär avskrivning.
        </p>
        <div>
          <label className="label">Aktiveringströskel (EUR)</label>
          <input
            type="number"
            min="0"
            step="50"
            value={form.assetActivationThreshold ?? 500}
            onChange={e => {
              const val = parseFloat(e.target.value) || 0;
              setForm(prev => ({ ...prev, assetActivationThreshold: val }));
              setSaved(false);
            }}
            className="input w-auto"
          />
          <p className="text-xs text-white/30 mt-1">
            Utgifter under detta belopp kostnadsförs direkt. Standard: 500 EUR.
          </p>
        </div>
        <div>
          <label className="label">Kategorier som föreslår aktivering</label>
          <div className="space-y-1.5 mt-1">
            {[
              { value: 'COMPUTER_IT', label: 'Dator & IT' },
              { value: 'PHONE_TABLET', label: 'Telefon & surfplatta' },
              { value: 'VEHICLE', label: 'Fordon' },
              { value: 'MACHINERY', label: 'Maskiner' },
              { value: 'FURNITURE', label: 'Möbler' },
              { value: 'BUILDING', label: 'Byggnader' },
            ].map(cat => {
              const cats = form.assetActivationCategories ?? [];
              const checked = cats.includes(cat.value);
              return (
                <label key={cat.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const updated = checked
                        ? cats.filter((c: string) => c !== cat.value)
                        : [...cats, cat.value];
                      setForm(prev => ({ ...prev, assetActivationCategories: updated }));
                      setSaved(false);
                    }}
                    className="w-3.5 h-3.5 rounded border-white/20 bg-surface-200 text-brand-500"
                  />
                  <span className="text-sm text-white/60">{cat.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-medium
                     hover:bg-white/90 disabled:opacity-50 transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Sparar...' : 'Spara inställningar'}
        </button>
        {saved && (
          <div className="flex items-center gap-1.5 text-green-400 text-sm">
            <CheckCircle className="w-4 h-4" />
            Sparat!
          </div>
        )}
      </div>
    </div>
  );
}
