import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Category } from '../api/types';

interface CategoryPickerProps {
  categoryId: string;
  subcategoryId: string;
  onChange: (categoryId: string, subcategoryId: string) => void;
  className?: string;
  /** If set, only shows categories whose id is in the list */
  filter?: string[];
}

// Singleton cache so we only fetch once per page load
let _cachedCategories: Category[] | null = null;

export default function CategoryPicker({
  categoryId,
  subcategoryId,
  onChange,
  className = '',
  filter,
}: CategoryPickerProps) {
  const [categories, setCategories] = useState<Category[]>(_cachedCategories ?? []);

  useEffect(() => {
    if (_cachedCategories) return;
    api.get<Category[]>('/accounting/categories').then(data => {
      _cachedCategories = data;
      setCategories(data);
    }).catch(console.error);
  }, []);

  const visible = filter ? categories.filter(c => filter.includes(c.id)) : categories;
  const selectedCat = visible.find(c => c.id === categoryId);

  // Auto-select when only one category is available (e.g. invoices always use 'income')
  useEffect(() => {
    if (visible.length === 1 && categoryId !== visible[0].id) {
      onChange(visible[0].id, '');
    }
  }, [visible.length, visible[0]?.id, categoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCategory = (id: string) => {
    onChange(id, '');
  };

  const handleSubcategory = (id: string) => {
    onChange(categoryId, id);
  };

  return (
    <div className={`flex gap-1.5 ${className}`}>
      {/* Only show the category dropdown when there are multiple categories to choose from */}
      {visible.length !== 1 && (
        <select
          className="input text-xs py-1"
          value={categoryId}
          onChange={e => handleCategory(e.target.value)}
        >
          <option value="">Kategori...</option>
          {visible.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      )}

      {selectedCat && (
        <select
          className="input text-xs py-1"
          value={subcategoryId}
          onChange={e => handleSubcategory(e.target.value)}
        >
          <option value="">Välj kategori...</option>
          {selectedCat.subcategories.map(sub => (
            <option key={sub.id} value={sub.id}>{sub.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}

/** Returns display label for a category/subcategory pair */
export function getCategoryLabel(
  categories: Category[],
  categoryId?: string,
  subcategoryId?: string
): string {
  if (!categoryId) return '';
  const cat = categories.find(c => c.id === categoryId);
  if (!cat) return categoryId;
  if (!subcategoryId) return cat.name;
  const sub = cat.subcategories.find(s => s.id === subcategoryId);
  return sub ? `${cat.name} › ${sub.name}` : cat.name;
}
