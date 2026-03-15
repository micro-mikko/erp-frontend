import { useEffect, useState } from 'react';
import { Loader2, Plus, Pencil, Trash2, ChevronDown, ChevronUp, Layers, X, Check } from 'lucide-react';
import { api } from '../api/client';
import type { Dimension, DimensionType } from '../api/types';
import { clearDimensionCache } from '../components/DimensionPicker';

// ─── Types ─────────────────────────────────────────────────────────────────

interface AccountRule {
  id: string;
  accountId: string;
  account: { accountNumber: string; nameSv: string };
  required: boolean;
}

interface AccountOption {
  id: string;
  accountNumber: string;
  nameSv: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<DimensionType, string> = {
  PROJECT:    'Projekt',
  DEPARTMENT: 'Avdelning',
  REGION:     'Region',
  OTHER:      'Övrigt',
};

const TYPE_COLOR: Record<DimensionType, string> = {
  PROJECT:    'bg-blue-500/20 text-blue-300',
  DEPARTMENT: 'bg-violet-500/20 text-violet-300',
  REGION:     'bg-emerald-500/20 text-emerald-300',
  OTHER:      'bg-white/10 text-white/50',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

// ─── DimensionForm ───────────────────────────────────────────────────────────

interface FormState {
  name: string;
  type: DimensionType;
  budget: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

const emptyForm = (): FormState => ({
  name: '',
  type: 'OTHER',
  budget: '',
  startDate: '',
  endDate: '',
  isActive: true,
});

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DimensionAdmin() {
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Account-rules state
  const [rules, setRules] = useState<AccountRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [newAccountId, setNewAccountId] = useState('');
  const [newRequired, setNewRequired] = useState(false);
  const [accountSearch, setAccountSearch] = useState('');

  const load = () => {
    setLoading(true);
    api.get<Dimension[]>('/dimensions?includeBudget=true')
      .then(setDimensions)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get<AccountOption[]>('/accounting/accounts').then(setAccounts).catch(console.error);
  }, []);

  // ── Load account rules when a row is expanded ─────────────────────────────

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setRules([]);
    setNewAccountId('');
    setNewRequired(false);
    setAccountSearch('');
    setRulesLoading(true);
    api.get<AccountRule[]>(`/dimensions/${id}/account-rules`)
      .then(setRules)
      .catch(console.error)
      .finally(() => setRulesLoading(false));
  };

  // ── Form helpers ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm());
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (dim: Dimension) => {
    setEditId(dim.id);
    setForm({
      name:      dim.name,
      type:      dim.type,
      budget:    dim.budget != null ? String(dim.budget) : '',
      startDate: dim.startDate ? dim.startDate.split('T')[0] : '',
      endDate:   dim.endDate   ? dim.endDate.split('T')[0]   : '',
      isActive:  dim.isActive,
    });
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditId(null);
    setFormError('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Namn krävs'); return; }
    setFormError('');
    setSaving(true);
    try {
      const body = {
        name:      form.name.trim(),
        type:      form.type,
        budget:    form.budget !== '' ? parseFloat(form.budget) : null,
        startDate: form.startDate || null,
        endDate:   form.endDate || null,
        isActive:  form.isActive,
      };
      if (editId) {
        await api.put(`/dimensions/${editId}`, body);
      } else {
        await api.post('/dimensions', body);
      }
      clearDimensionCache();
      closeForm();
      load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Kunde inte spara');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Radera dimensionen "${name}"?`)) return;
    try {
      await api.delete(`/dimensions/${id}`);
      clearDimensionCache();
      if (expandedId === id) setExpandedId(null);
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Kunde inte radera');
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMsg('');
    try {
      const result = await api.post<{ message: string }>('/dimensions/seed', {});
      setSeedMsg(result.message);
      clearDimensionCache();
      load();
    } catch (err: unknown) {
      setSeedMsg(err instanceof Error ? err.message : 'Seedning misslyckades');
    } finally {
      setSeeding(false);
    }
  };

  // ── Account rules ─────────────────────────────────────────────────────────

  const filteredAccounts = accountSearch
    ? accounts.filter(a =>
        a.accountNumber.includes(accountSearch) ||
        a.nameSv.toLowerCase().includes(accountSearch.toLowerCase())
      ).slice(0, 20)
    : [];

  const addRule = async () => {
    if (!expandedId || !newAccountId) return;
    try {
      const r = await api.post<AccountRule>(`/dimensions/${expandedId}/account-rules`, {
        accountId: newAccountId,
        required: newRequired,
      });
      setRules(rs => [...rs, r]);
      setNewAccountId('');
      setNewRequired(false);
      setAccountSearch('');
      clearDimensionCache();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Kunde inte lägga till');
    }
  };

  const removeRule = async (ruleAccountId: string) => {
    if (!expandedId) return;
    try {
      await api.delete(`/dimensions/${expandedId}/account-rules/${ruleAccountId}`);
      setRules(rs => rs.filter(r => r.accountId !== ruleAccountId));
      clearDimensionCache();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Kunde inte ta bort');
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <Loader2 className="animate-spin text-brand-500" size={24} />
    </div>
  );

  return (
    <div className="space-y-5">

      {/* Header + New button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-brand-400" />
          <h2 className="text-sm font-semibold text-white">Dimensioner</h2>
          <span className="text-xs text-white/30">({dimensions.length})</span>
        </div>
        <button onClick={openCreate} className="btn-primary text-xs px-3 py-1.5">
          <Plus size={13} /> Ny dimension
        </button>
      </div>

      {/* ── Create / Edit form ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="card border border-brand-500/30 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">{editId ? 'Redigera dimension' : 'Ny dimension'}</h3>
            <button onClick={closeForm} className="text-white/30 hover:text-white/60 transition-colors">
              <X size={15} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Namn *</label>
              <input
                className="input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="T.ex. Projekt Alfa"
              />
            </div>
            <div>
              <label className="label">Typ</label>
              <select
                className="input"
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as DimensionType }))}
              >
                {(Object.entries(TYPE_LABEL) as [DimensionType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Budget (EUR)</label>
              <input
                className="input"
                type="number"
                min="0"
                step="100"
                value={form.budget}
                onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
                placeholder="Valfritt"
              />
            </div>
            <div>
              <label className="label">Startdatum</label>
              <input
                className="input"
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Slutdatum</label>
              <input
                className="input"
                type="date"
                value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              />
            </div>
            {editId && (
              <div className="col-span-2 flex items-center gap-2">
                <input
                  id="dim-active"
                  type="checkbox"
                  className="rounded"
                  checked={form.isActive}
                  onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                />
                <label htmlFor="dim-active" className="text-sm text-white/70 cursor-pointer">Aktiv</label>
              </div>
            )}
          </div>

          {formError && (
            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">{formError}</div>
          )}

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary text-xs px-4 py-1.5">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {editId ? 'Spara' : 'Skapa'}
            </button>
            <button onClick={closeForm} className="btn-secondary text-xs px-3 py-1.5">Avbryt</button>
          </div>
        </div>
      )}

      {/* ── Dimensions table ───────────────────────────────────────────────── */}
      {dimensions.length === 0 ? (
        <div className="card text-center py-10 text-white/30 text-sm">
          Inga dimensioner skapade ännu
        </div>
      ) : (
        <div className="card divide-y divide-white/5 p-0 overflow-hidden">
          {dimensions.map(dim => (
            <div key={dim.id}>
              {/* Main row */}
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/2 transition-colors">
                <button
                  onClick={() => toggleExpand(dim.id)}
                  className="text-white/20 hover:text-white/50 transition-colors flex-shrink-0"
                >
                  {expandedId === dim.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {/* Name + active badge */}
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium ${dim.isActive ? 'text-white' : 'text-white/30 line-through'}`}>
                    {dim.name}
                  </span>
                  {!dim.isActive && (
                    <span className="ml-2 text-[10px] bg-white/5 text-white/30 px-1.5 py-0.5 rounded">Inaktiv</span>
                  )}
                </div>

                {/* Type badge */}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TYPE_COLOR[dim.type]}`}>
                  {TYPE_LABEL[dim.type]}
                </span>

                {/* Budget */}
                {dim.budget != null && (
                  <div className="text-right hidden sm:block">
                    <div className="text-xs text-white/50">{fmt(dim.budget)}</div>
                    {dim.budgetRemaining != null && (
                      <div className={`text-[10px] ${(dim.budgetRemaining ?? 0) < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {fmt(dim.budgetRemaining ?? 0)} kvar
                      </div>
                    )}
                  </div>
                )}

                {/* Date range */}
                {(dim.startDate || dim.endDate) && (
                  <div className="text-xs text-white/30 hidden md:block whitespace-nowrap">
                    {dim.startDate ? dim.startDate.split('T')[0] : '–'}
                    {' – '}
                    {dim.endDate ? dim.endDate.split('T')[0] : '∞'}
                  </div>
                )}

                {/* Linked accounts count */}
                {dim.accountRules && dim.accountRules.length > 0 && (
                  <span className="text-[10px] text-white/30 hidden sm:block whitespace-nowrap">
                    {dim.accountRules.length} konto{dim.accountRules.length !== 1 ? 'n' : ''}
                  </span>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(dim)}
                    className="p-1.5 text-white/20 hover:text-white/60 transition-colors rounded"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(dim.id, dim.name)}
                    className="p-1.5 text-white/20 hover:text-red-400 transition-colors rounded"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Expanded: account rules ─────────────────────────────────── */}
              {expandedId === dim.id && (
                <div className="px-4 pb-4 bg-surface-200/30 border-t border-white/5 space-y-3">
                  <p className="text-[10px] text-white/30 uppercase tracking-wide pt-3">Kopplingar till konton</p>

                  {rulesLoading ? (
                    <Loader2 size={14} className="animate-spin text-white/30" />
                  ) : (
                    <>
                      {rules.length === 0 && (
                        <p className="text-xs text-white/30">Inga kontoregler — dimensionen är alltid tillgänglig.</p>
                      )}
                      {rules.map(rule => (
                        <div key={rule.id} className="flex items-center gap-2 text-xs">
                          <span className="font-mono text-white/60">{rule.account.accountNumber}</span>
                          <span className="text-white/40 flex-1">{rule.account.nameSv}</span>
                          {rule.required && (
                            <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded">Obligatorisk</span>
                          )}
                          <button
                            onClick={() => removeRule(rule.accountId)}
                            className="p-1 text-white/20 hover:text-red-400 transition-colors"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}

                      {/* Add rule */}
                      <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                        <div className="relative flex-1">
                          <input
                            className="input text-xs py-1"
                            placeholder="Sök konto (nummer eller namn)..."
                            value={accountSearch}
                            onChange={e => {
                              setAccountSearch(e.target.value);
                              setNewAccountId('');
                            }}
                          />
                          {filteredAccounts.length > 0 && !newAccountId && (
                            <div className="absolute z-10 top-full left-0 right-0 mt-0.5 bg-surface-100 border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                              {filteredAccounts.map(a => (
                                <button
                                  key={a.id}
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors"
                                  onClick={() => {
                                    setNewAccountId(a.id);
                                    setAccountSearch(`${a.accountNumber} – ${a.nameSv}`);
                                  }}
                                >
                                  <span className="font-mono text-white/60 mr-2">{a.accountNumber}</span>
                                  <span className="text-white/80">{a.nameSv}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-white/50 whitespace-nowrap cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded"
                            checked={newRequired}
                            onChange={e => setNewRequired(e.target.checked)}
                          />
                          Obligatorisk
                        </label>
                        <button
                          onClick={addRule}
                          disabled={!newAccountId}
                          className="btn-ghost text-xs py-1 px-2 disabled:opacity-30"
                        >
                          <Plus size={12} /> Lägg till
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Seed section ──────────────────────────────────────────────────── */}
      <div className="card space-y-2">
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wide">Importera kategorier</h3>
        <p className="text-xs text-white/30">
          Skapar en dimension (typ: Övrigt) per underkategori i systemets hårdkodade kategoristruktur.
          Idempotent — dimensioner som redan finns hoppas över.
        </p>
        <div className="flex items-center gap-3">
          <button onClick={handleSeed} disabled={seeding} className="btn-secondary text-xs px-3 py-1.5">
            {seeding ? <Loader2 size={13} className="animate-spin" /> : <Layers size={13} />}
            Importera befintliga kategorier
          </button>
          {seedMsg && <span className="text-xs text-white/50">{seedMsg}</span>}
        </div>
      </div>
    </div>
  );
}
