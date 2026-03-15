import { useState, useEffect, useRef } from 'react';
import { Search, Plus, X, Building2 } from 'lucide-react';
import { api } from '../api/client';
import type { Supplier } from '../api/types';

interface Props {
  value: { id: string; name: string } | null;
  onChange: (supplier: { id: string; name: string } | null) => void;
  placeholder?: string;
}

export default function SupplierPicker({ value, onChange, placeholder = 'Sök leverantör...' }: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<Supplier[]>('/suppliers').then(setSuppliers).catch(console.error);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.businessId || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (s: Supplier) => {
    onChange({ id: s.id, name: s.name });
    setSearch('');
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setSearch('');
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger / selected display */}
      <div
        className="input flex items-center gap-2 cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        {value ? (
          <>
            <Building2 size={14} className="text-white/40 flex-shrink-0" />
            <span className="flex-1 text-white text-sm">{value.name}</span>
            <button onClick={handleClear} className="text-white/30 hover:text-white/70 transition-colors">
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <Search size={14} className="text-white/30 flex-shrink-0" />
            <span className="text-white/30 text-sm">{placeholder}</span>
          </>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface-100 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-white/5">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-white/30 outline-none focus:border-brand-500/60"
                placeholder="Sök namn eller FO-nummer..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-white/30 text-center">Inga leverantörer hittades</div>
            ) : (
              filtered.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleSelect(s)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-300 text-xs font-semibold flex-shrink-0">
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{s.name}</p>
                    {s.businessId && <p className="text-xs text-white/30">{s.businessId}</p>}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Add new */}
          <div className="border-t border-white/5 p-2">
            <a
              href="/suppliers/new"
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-brand-400 hover:bg-brand-600/10 transition-colors"
            >
              <Plus size={14} />
              Lägg till ny leverantör
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
