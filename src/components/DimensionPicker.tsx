import { useEffect, useState, useRef } from 'react';
import { api } from '../api/client';
import type { Dimension, DimensionType } from '../api/types';

interface DimensionPickerProps {
  dimensionId: string;
  onChange: (dimensionId: string) => void;
  /** Kontonummer för smart filter — visar endast dimensioner kopplade till detta konto (+ de utan regler) */
  accountNumber?: string;
  /** Om true: placeholder visar "Dimension krävs" och röd ram visas om inget val gjorts */
  required?: boolean;
  className?: string;
}

// Cache per accountNumber för att undvika upprepade API-anrop under samma session
const _cache: Record<string, Dimension[]> = {};

// Typ-etiketter (behålls för getDimensionLabel + tooltips)
const TYPE_LABEL: Record<DimensionType, string> = {
  PROJECT:    'Projekt',
  DEPARTMENT: 'Avdelning',
  REGION:     'Region',
  OTHER:      'Övrigt',
};

function formatBudgetTooltip(dim: Dimension): string | undefined {
  if (dim.type !== 'PROJECT' || dim.budget == null) return undefined;
  const fmt = (n: number) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
  const used = dim.budgetUsed ?? 0;
  const remaining = dim.budgetRemaining ?? dim.budget;
  return `Budget: ${fmt(dim.budget)} | Använt: ${fmt(used)} | Kvar: ${fmt(remaining)}`;
}

export default function DimensionPicker({
  dimensionId,
  onChange,
  accountNumber,
  required = false,
  className = '',
}: DimensionPickerProps) {
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [loading, setLoading] = useState(false);
  const prevAccount = useRef<string | undefined>(undefined);

  useEffect(() => {
    const cacheKey = accountNumber ?? '__all__';
    if (_cache[cacheKey]) {
      setDimensions(_cache[cacheKey]);
      return;
    }

    if (prevAccount.current === accountNumber && dimensions.length > 0) return;
    prevAccount.current = accountNumber;

    setLoading(true);
    const params = new URLSearchParams({ includeBudget: 'true' });
    if (accountNumber) params.set('accountNumber', accountNumber);

    api.get<Dimension[]>(`/dimensions?${params}`)
      .then(data => {
        _cache[cacheKey] = data;
        setDimensions(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [accountNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Bygg hierarki ────────────────────────────────────────────────────────
  // Vilka id:n används som föräldrar?
  const parentIdSet = new Set(
    dimensions.filter(d => d.parentId).map(d => d.parentId!)
  );

  // Valbara: de som INTE är föräldrar till någon annan (löv + fristående)
  const selectable = dimensions.filter(d => !parentIdSet.has(d.id));

  // Dela upp i grupper (barn med förälder) och fristående (inget parentId)
  const standalone = selectable.filter(d => !d.parentId);

  // Gruppa barn per förälder, bevara API:s ordning
  const groupMap = new Map<string, { name: string; items: Dimension[] }>();
  for (const dim of selectable.filter(d => d.parentId)) {
    const pid = dim.parentId!;
    if (!groupMap.has(pid)) {
      groupMap.set(pid, {
        name: dim.parent?.name ?? pid,
        items: [],
      });
    }
    groupMap.get(pid)!.items.push(dim);
  }
  // Bevara ordningen föräldrar dök upp i API-svaret
  const groups = Array.from(groupMap.values());

  // ── Validering ───────────────────────────────────────────────────────────
  const showRequired = required && !dimensionId;
  const borderClass = showRequired
    ? 'border-red-500/50 focus:border-red-400'
    : '';

  const placeholder = required ? 'Dimension krävs' : 'Ingen dimension';

  if (loading) {
    return (
      <select disabled className={`input text-xs py-1 opacity-50 ${className}`}>
        <option>Laddar...</option>
      </select>
    );
  }

  // Visa ingenting om inga valbara dimensioner finns
  if (selectable.length === 0 && !dimensionId) return null;

  return (
    <select
      className={`input text-xs py-1 ${borderClass} ${className}`}
      value={dimensionId}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>

      {/* Fristående dimensioner (ingen förälder) */}
      {standalone.map(dim => (
        <option key={dim.id} value={dim.id} title={formatBudgetTooltip(dim)}>
          {dim.name}
        </option>
      ))}

      {/* Hierarkiska grupper med förälder som optgroup-etikett */}
      {groups.map(group => (
        <optgroup key={group.name} label={group.name}>
          {group.items.map(dim => (
            <option key={dim.id} value={dim.id} title={formatBudgetTooltip(dim)}>
              {dim.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/** Rensa cache (t.ex. efter att en dimension skapats/redigerats) */
export function clearDimensionCache() {
  Object.keys(_cache).forEach(k => delete _cache[k]);
}

/** Returnerar visningsetikett för en dimension */
export function getDimensionLabel(dimensions: Dimension[], dimensionId?: string): string {
  if (!dimensionId) return '';
  const dim = dimensions.find(d => d.id === dimensionId);
  if (!dim) return dimensionId;
  const prefix = dim.parent ? `${dim.parent.name}: ` : `${TYPE_LABEL[dim.type]}: `;
  return `${prefix}${dim.name}`;
}
