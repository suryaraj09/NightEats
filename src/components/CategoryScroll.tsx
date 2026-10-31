export type ActiveCategory = 'All' | 'Burger' | 'Sandwich' | 'Tikka Pav' | 'Fries';

const CHIPS: { id: ActiveCategory; label: string }[] = [
  { id: 'All', label: 'બધું (All)' },
  { id: 'Burger', label: 'Burgers' },
  { id: 'Sandwich', label: 'Sandwiches (3 Layer)' },
  { id: 'Tikka Pav', label: 'Tikka Pav' },
  { id: 'Fries', label: 'French Fries' },
];

export function CategoryScroll({ active, onChange }: { active: ActiveCategory; onChange: (c: ActiveCategory) => void }) {
  return (
    <div className="category-scroll">
      {CHIPS.map((c) => (
        <div key={c.id} className={`cat-chip ${active === c.id ? 'active' : ''}`} onClick={() => onChange(c.id)}>
          {c.label}
        </div>
      ))}
    </div>
  );
}
