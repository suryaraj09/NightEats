import { useState } from 'react';
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
    if (!name.trim()) return alert('કૃપા કરીને વાનગીનું નામ દાખલ કરો!');
    if (!isMoney(price)) return alert('ભાવ ૦ કે તેથી વધુનો પૂર્ણ આંકડો હોવો જોઈએ!');
    if (cheesePrice.trim() && !isMoney(cheesePrice)) return alert('ડબલ ચીઝ ભાવ ૦ કે તેથી વધુનો પૂર્ણ આંકડો હોવો જોઈએ!');
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
      alert('નવી વાનગી સફળતાપૂર્વક ઉમેરાઈ ગઈ છે!');
    }
  };

  const toggle = (i: MenuItem) => run(supabase.from('menu_items').update({ in_stock: !i.inStock }).eq('id', i.id));
  const remove = (i: MenuItem) => {
    if (!confirm('શું તમે આ વાનગીને લાઈવ મેનૂમાંથી કાયમ માટે કાઢી નાખવા માંગો છો?')) return;
    if (editing?.id === i.id) clearForm();
    void run(supabase.from('menu_items').delete().eq('id', i.id));
  };
  const reset = () => {
    if (confirm('શું તમે ઓરિજિનલ મેનૂ ફરીથી રીસ્ટોર કરવા માંગો છો?')) void run(supabase.rpc('reset_menu'));
  };

  return (
    <>
      <h4 style={{ color: 'var(--gold-primary)', fontSize: '0.9rem' }}>
        {editing ? `✏️ એડિટ કરો: ${editing.name}` : '+ નવી આઇટમ ઉમેરો'}
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="input-group">
          <label>વાનગીનું નામ</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="દા.ત. Peri Peri Burger" />
        </div>
        <div className="input-group">
          <label>કેટેગરી</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label>ભાવ (₹)</label>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="દા.ત. 120" />
        </div>
        <div className="input-group">
          <label>ડબલ ચીઝ ભાવ (વૈકલ્પિક)</label>
          <input type="number" value={cheesePrice} onChange={(e) => setCheesePrice(e.target.value)} placeholder="દા.ત. 140" />
        </div>
      </div>
      <div className="input-group">
        <label>વર્ણન (વૈકલ્પિક)</label>
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={DEFAULT_DESC} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-primary-action" style={{ padding: 8 }} onClick={() => void save()}>
          {editing ? 'ફેરફાર સાચવો' : 'લાઇવ મેનૂમાં ઉમેરો'}
        </button>
        {editing && (
          <button className="btn-add-item" onClick={clearForm}>રદ કરો</button>
        )}
      </div>

      <hr style={{ border: 0, borderTop: '1px solid var(--border-subtle)', margin: '10px 0' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ color: 'var(--gold-primary)', fontSize: '0.9rem' }}>લાઇવ સ્ટોક કંટ્રોલ (ક્લાઉડ સિન્ક)</h4>
        <button
          style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: 6, fontSize: '0.7rem', cursor: 'pointer' }}
          onClick={reset}
        >
          મૂળ મેનૂ રીસ્ટોર
        </button>
      </div>

      <div style={{ maxHeight: 350, overflowY: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr><th>વાનગી</th><th>ભાવ</th><th>લાઈવ સ્ટોક</th><th>એડિટ</th><th>કાઢી નાખો</th></tr>
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
