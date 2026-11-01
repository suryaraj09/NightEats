import { useState } from 'react';
import { useCoupons } from '../hooks/useCoupons';
import {
  DAY_LABEL, TYPE_LABEL, emptyForm, formFromRow, rowFromForm, summarize,
  type AppliesTo, type CouponForm, type CouponRow, type CouponType,
} from '../lib/coupons';
import { supabase } from '../lib/supabase';
import type { Category, MenuItem } from '../types';

interface Props {
  items: MenuItem[];
  active: boolean;
}

const CATEGORIES: Category[] = ['Burger', 'Sandwich', 'Tikka Pav', 'Fries'];
const SCOPE_LABEL: Record<AppliesTo, string> = { cart: 'આખું કાર્ટ', category: 'એક કેટેગરી', items: 'ચોક્કસ આઇટમ્સ' };

export function CouponsTab({ items, active }: Props) {
  const { coupons, usage, error, reload } = useCoupons(active);
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [editing, setEditing] = useState<CouponRow | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof CouponForm>(key: K, value: CouponForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const toggleIn = (key: 'days' | 'itemIds', v: number) =>
    setForm((f) => ({ ...f, [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] }));
  const clear = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const startEdit = (c: CouponRow) => {
    setEditing(c);
    setForm(formFromRow(c));
    document.querySelector('.modal-body')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    const res = rowFromForm(form);
    if ('error' in res) return alert(res.error);
    setBusy(true);
    const q = editing
      ? supabase.from('coupons').update(res.row).eq('id', editing.id)
      : supabase.from('coupons').insert(res.row);
    const { error: err } = await q;
    setBusy(false);
    if (err) return alert(err.code === '23505' ? 'આ કોડ પહેલેથી છે. બીજો કોડ પસંદ કરો.' : err.message);
    clear();
    await reload();
  };

  const toggle = async (c: CouponRow) => {
    const { error: err } = await supabase.from('coupons').update({ is_active: !c.is_active }).eq('id', c.id);
    if (err) alert(err.message);
    else await reload();
  };

  const remove = async (c: CouponRow) => {
    if (!confirm(`કોડ ${c.code} કાયમ માટે કાઢી નાખવો છે? જૂના ઓર્ડર બદલાશે નહીં. (બંધ કરવા માટે સ્વિચ વાપરો.)`)) return;
    if (editing?.id === c.id) clear();
    const { error: err } = await supabase.from('coupons').delete().eq('id', c.id);
    if (err) alert(err.message);
    else await reload();
  };

  const t = form.type;
  return (
    <>
      <h4 style={{ color: 'var(--gold-primary)', fontSize: '0.9rem' }}>
        {editing ? `✏️ એડિટ કરો: ${editing.code}` : '+ નવો કૂપન બનાવો'}
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="input-group">
          <label>કોડ (A-Z, 0-9)</label>
          <input type="text" value={form.code} maxLength={20} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="દા.ત. NIGHT10" />
        </div>
        <div className="input-group">
          <label>પ્રકાર</label>
          <select value={t} onChange={(e) => set('type', e.target.value as CouponType)}>
            {(Object.keys(TYPE_LABEL) as CouponType[]).map((k) => <option key={k} value={k}>{TYPE_LABEL[k]}</option>)}
          </select>
        </div>

        {t === 'percent' && (
          <>
            <div className="input-group"><label>% ડિસ્કાઉન્ટ</label><input type="number" value={form.percentOff} onChange={(e) => set('percentOff', e.target.value)} placeholder="10" /></div>
            <div className="input-group"><label>મહત્તમ ₹ (વૈકલ્પિક)</label><input type="number" value={form.maxDiscount} onChange={(e) => set('maxDiscount', e.target.value)} placeholder="50" /></div>
          </>
        )}
        {t === 'flat' && (
          <div className="input-group"><label>₹ ડિસ્કાઉન્ટ</label><input type="number" value={form.flatOff} onChange={(e) => set('flatOff', e.target.value)} placeholder="30" /></div>
        )}
        {t === 'buy_x_get_y' && (
          <>
            <div className="input-group"><label>Buy (આઇટમ)</label><input type="number" value={form.buyQty} onChange={(e) => set('buyQty', e.target.value)} /></div>
            <div className="input-group"><label>Get ફ્રી (સૌથી સસ્તી)</label><input type="number" value={form.freeQty} onChange={(e) => set('freeQty', e.target.value)} /></div>
          </>
        )}
        {t === 'free_item' && (
          <>
            <div className="input-group">
              <label>ફ્રી આઇટમ (રેગ્યુલર)</label>
              <select value={form.freeItemId} onChange={(e) => set('freeItemId', e.target.value)}>
                <option value="">— પસંદ કરો —</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div className="input-group" style={{ alignSelf: 'end', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              નીચે &quot;ઓછામાં ઓછો ઓર્ડર ₹&quot; માં રકમ મૂકો.
            </div>
          </>
        )}
        {t === 'bundle' && (
          <>
            <div className="input-group"><label>બંડલમાં આઇટમ (≥2)</label><input type="number" value={form.bundleQty} onChange={(e) => set('bundleQty', e.target.value)} /></div>
            <div className="input-group"><label>બંડલ ભાવ ₹</label><input type="number" value={form.bundlePrice} onChange={(e) => set('bundlePrice', e.target.value)} placeholder="140" /></div>
          </>
        )}

        <div className="input-group">
          <label>લાગુ પડે છે</label>
          <select value={form.appliesTo} onChange={(e) => set('appliesTo', e.target.value as AppliesTo)}>
            {(Object.keys(SCOPE_LABEL) as AppliesTo[]).map((k) => <option key={k} value={k}>{SCOPE_LABEL[k]}</option>)}
          </select>
        </div>
        {form.appliesTo === 'category' && (
          <div className="input-group">
            <label>કેટેગરી</label>
            <select value={form.category} onChange={(e) => set('category', e.target.value as Category)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
        <div className="input-group"><label>ઓછામાં ઓછી યોગ્ય આઇટમ</label><input type="number" value={form.minQty} onChange={(e) => set('minQty', e.target.value)} placeholder="0" /></div>
        <div className="input-group"><label>ઓછામાં ઓછો ઓર્ડર ₹ (આખું કાર્ટ)</label><input type="number" value={form.minOrderValue} onChange={(e) => set('minOrderValue', e.target.value)} placeholder="0" /></div>
      </div>

      {form.appliesTo === 'items' && (
        <div className="input-group">
          <label>આઇટમ્સ પસંદ કરો ({form.itemIds.length})</label>
          <div className="coupon-checks">
            {items.map((i) => (
              <label key={i.id}><input type="checkbox" checked={form.itemIds.includes(i.id)} onChange={() => toggleIn('itemIds', i.id)} /> {i.name}</label>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div className="input-group"><label>કુલ વપરાશ</label><input type="number" value={form.maxTotalUses} onChange={(e) => set('maxTotalUses', e.target.value)} placeholder="∞" /></div>
        <div className="input-group"><label>દરેક એકાઉન્ટ</label><input type="number" value={form.maxUsesPerUser} onChange={(e) => set('maxUsesPerUser', e.target.value)} placeholder="∞" /></div>
        <div className="input-group"><label>દરેક ફોન નંબર</label><input type="number" value={form.maxUsesPerPhone} onChange={(e) => set('maxUsesPerPhone', e.target.value)} placeholder="∞" /></div>
      </div>
      <label className="coupon-check"><input type="checkbox" checked={form.firstOrderOnly} onChange={(e) => set('firstOrderOnly', e.target.checked)} /> ફક્ત પહેલા ઓર્ડર માટે</label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="input-group"><label>શરૂ (તારીખ/સમય)</label><input type="datetime-local" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} /></div>
        <div className="input-group"><label>પૂરું (તારીખ/સમય)</label><input type="datetime-local" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} /></div>
        <div className="input-group"><label>રોજ આ સમયથી (happy hour)</label><input type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} /></div>
        <div className="input-group"><label>આ સમય સુધી (રાત્રે પણ ચાલે)</label><input type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} /></div>
      </div>
      <div className="input-group">
        <label>દિવસો (કંઈ ન પસંદ કરો = રોજ) · સમય ભારતીય (IST)</label>
        <div className="coupon-days">
          {DAY_LABEL.map((d, i) => (
            <button key={d} type="button" className={form.days.includes(i) ? 'on' : ''} onClick={() => toggleIn('days', i)}>{d}</button>
          ))}
        </div>
      </div>

      <div className="input-group">
        <label>ગ્રાહકને બતાવવાનું વર્ણન (વૈકલ્પિક)</label>
        <input type="text" value={form.description} maxLength={200} onChange={(e) => set('description', e.target.value)} placeholder="દા.ત. રાત્રે 10 પછી 10% ઓફ" />
      </div>
      <label className="coupon-check"><input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} /> ચાલુ (Active)</label>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-primary-action" style={{ padding: 8 }} disabled={busy} onClick={() => void save()}>
          {editing ? 'ફેરફાર સાચવો' : 'કૂપન બનાવો'}
        </button>
        {editing && <button className="btn-add-item" onClick={clear}>રદ કરો</button>}
      </div>

      <hr style={{ border: 0, borderTop: '1px solid var(--border-subtle)', margin: '10px 0' }} />
      <h4 style={{ color: 'var(--gold-primary)', fontSize: '0.9rem' }}>બધા કૂપન</h4>
      {error && <div className="pincode-fixed-badge">⚠️ {error}</div>}
      {!error && coupons.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>કોઈ કૂપન નથી.</div>}

      <div style={{ maxHeight: 350, overflowY: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr><th>કોડ</th><th>વપરાશ</th><th>ચાલુ</th><th>એડિટ</th><th>કાઢો</th></tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} style={editing?.id === c.id ? { background: 'var(--gold-glow)' } : undefined}>
                <td>
                  <b>{c.code}</b>
                  <br /><small style={{ color: 'var(--text-muted)' }}>{summarize(c, items)}</small>
                </td>
                <td>{usage[c.id] ?? 0}{c.max_total_uses !== null ? ` / ${c.max_total_uses}` : ''}</td>
                <td>
                  <button className={`btn-toggle-stock ${c.is_active ? 'instock' : 'outstock'}`} onClick={() => void toggle(c)}>
                    {c.is_active ? 'On' : 'Off'}
                  </button>
                </td>
                <td><button className="btn-del-item" style={{ color: 'var(--gold-primary)' }} onClick={() => startEdit(c)}>✏️</button></td>
                <td><button className="btn-del-item" onClick={() => void remove(c)}>🗑️</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
