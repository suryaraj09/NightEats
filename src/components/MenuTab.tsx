import { useState } from 'react';
import { useLang } from '../i18n/LanguageProvider';
import { supabase } from '../lib/supabase';
import type { Category, MenuItem } from '../types';

interface Props {
  items: MenuItem[];
  reload: () => Promise<void>;
}

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'Burger', label: 'Burger' },
  { value: 'Sandwich', label: 'Sandwich' },
  { value: 'Tikka Pav', label: 'Tikka Pav' },
  { value: 'Fries', label: 'French Fries' },
];

export function MenuTab({ items, reload }: Props) {
  const { t } = useLang();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('Burger');
  const [price, setPrice] = useState('');
  const [cheesePrice, setCheesePrice] = useState('');
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState<MenuItem | null>(null);

  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await p;
    if (error) alert(error.message);
    else await reload();
    return !error;
  };

  const DEFAULT_DESC = 'Night Eats Special Fresh Preparation';
  const isMoney = (v: string) => /^\d+$/.test(v.trim());

  const clearForm = () => {
    setName(''); setPrice(''); setCheesePrice(''); setDescription('');
    setCategory('Burger'); setEditing(null);
  };

  const startEdit = (i: MenuItem) => {
    setEditing(i);
    setName(i.name);
    setCategory(i.category);
    setPrice(String(i.price));
    setCheesePrice(i.cheesePrice === null ? '' : String(i.cheesePrice));
    setDescription(i.description);
    document.querySelector('.modal-body')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    if (!name.trim()) return alert(t('menuTab.nameRequired'));
    if (!isMoney(price)) return alert(t('menuTab.priceBad'));
    if (cheesePrice.trim() && !isMoney(cheesePrice)) return alert(t('menuTab.cheeseBad'));
    const fields = {
      name: name.trim(),
      category,
      price: parseInt(price, 10),
      cheese_price: cheesePrice.trim() ? parseInt(cheesePrice, 10) : null,
      description: description.trim() || DEFAULT_DESC,
    };
    if (editing) {
      if (await run(supabase.from('menu_items').update(fields).eq('id', editing.id))) clearForm();
      return;
    }
    const ok = await run(
      supabase.from('menu_items').insert({
        ...fields,
        sort_order: (items.length ? Math.max(...items.map((i) => i.id)) : 0) + 1000,
      }),
    );
    if (ok) {
      clearForm();
      alert(t('menuTab.added'));
    }
  };

  const toggle = (i: MenuItem) => run(supabase.from('menu_items').update({ in_stock: !i.inStock }).eq('id', i.id));
  const remove = (i: MenuItem) => {
    if (!confirm(t('menuTab.removeConfirm'))) return;
    if (editing?.id === i.id) clearForm();
    void run(supabase.from('menu_items').delete().eq('id', i.id));
  };
  const reset = () => {
    if (confirm(t('menuTab.resetConfirm'))) void run(supabase.rpc('reset_menu'));
  };

  return (
    <>
      <h4 style={{ color: 'var(--gold-primary)', fontSize: '0.9rem' }}>
        {editing ? t('menuTab.editTitle', { name: editing.name }) : t('menuTab.newTitle')}
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="input-group">
          <label>{t('menuTab.nameLabel')}</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('menuTab.namePlaceholder')} />
        </div>
        <div className="input-group">
          <label>{t('menuTab.categoryLabel')}</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label>{t('menuTab.priceLabel')}</label>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t('menuTab.pricePlaceholder')} />
        </div>
        <div className="input-group">
          <label>{t('menuTab.cheeseLabel')}</label>
          <input type="number" value={cheesePrice} onChange={(e) => setCheesePrice(e.target.value)} placeholder={t('menuTab.cheesePlaceholder')} />
        </div>
      </div>
      <div className="input-group">
        <label>{t('menuTab.descLabel')}</label>
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={DEFAULT_DESC} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-primary-action" style={{ padding: 8 }} onClick={() => void save()}>
          {editing ? t('menuTab.saveEdit') : t('menuTab.saveNew')}
        </button>
        {editing && (
          <button className="btn-add-item" onClick={clearForm}>{t('menuTab.cancel')}</button>
        )}
      </div>

      <hr style={{ border: 0, borderTop: '1px solid var(--border-subtle)', margin: '10px 0' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ color: 'var(--gold-primary)', fontSize: '0.9rem' }}>{t('menuTab.stockTitle')}</h4>
        <button
          style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: 6, fontSize: '0.7rem', cursor: 'pointer' }}
          onClick={reset}
        >
          {t('menuTab.restore')}
        </button>
      </div>

      <div style={{ maxHeight: 350, overflowY: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr><th>{t('menuTab.thDish')}</th><th>{t('menuTab.thPrice')}</th><th>{t('menuTab.thStock')}</th><th>{t('menuTab.thEdit')}</th><th>{t('menuTab.thDelete')}</th></tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} style={editing?.id === i.id ? { background: 'var(--gold-glow)' } : undefined}>
                <td><b>{i.name}</b><br /><small style={{ color: 'var(--text-muted)' }}>{i.category}</small></td>
                <td>₹{i.price} {i.cheesePrice ? `/ ₹${i.cheesePrice}` : ''}</td>
                <td>
                  <button className={`btn-toggle-stock ${i.inStock ? 'instock' : 'outstock'}`} onClick={() => void toggle(i)}>
                    {i.inStock ? 'In Stock' : 'Out'}
                  </button>
                </td>
                <td><button className="btn-del-item" style={{ color: 'var(--gold-primary)' }} onClick={() => startEdit(i)}>✏️</button></td>
                <td><button className="btn-del-item" onClick={() => remove(i)}>🗑️</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
