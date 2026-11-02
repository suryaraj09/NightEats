import { useLang } from '../i18n/LanguageProvider';

export type ActiveCategory = 'All' | 'Burger' | 'Sandwich' | 'Tikka Pav' | 'Fries';

// Category names are the same in both languages; only "All" is translated.
const CHIPS: { id: ActiveCategory; label: string | null }[] = [
  { id: 'All', label: null },
  { id: 'Burger', label: 'Burgers' },
  { id: 'Sandwich', label: 'Sandwiches (3 Layer)' },
  { id: 'Tikka Pav', label: 'Tikka Pav' },
  { id: 'Fries', label: 'French Fries' },
];

export function CategoryScroll({ active, onChange }: { active: ActiveCategory; onChange: (c: ActiveCategory) => void }) {
  const { t } = useLang();
  return (
    <div className="category-scroll">
      {CHIPS.map((c) => (
        <div key={c.id} className={`cat-chip ${active === c.id ? 'active' : ''}`} onClick={() => onChange(c.id)}>
          {c.label ?? t('cat.all')}
        </div>
      ))}
    </div>
  );
}
