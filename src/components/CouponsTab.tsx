import { useState } from 'react';
import { useCoupons } from '../hooks/useCoupons';
import { useLang } from '../i18n/LanguageProvider';
import type { Key } from '../i18n/translate';
import {
  COUPON_TYPES, emptyForm, formFromRow, rowFromForm, summarize,
  type AppliesTo, type CouponForm, type CouponRow, type CouponType,
} from '../lib/coupons';
import { supabase } from '../lib/supabase';
import type { Category, MenuItem } from '../types';

interface Props {
  items: MenuItem[];
  active: boolean;
}

const CATEGORIES: Category[] = ['Burger', 'Sandwich', 'Tikka Pav', 'Fries'];
const SCOPES: AppliesTo[] = ['cart', 'category', 'items'];
const DAYS = [0, 1, 2, 3, 4, 5, 6];

export function CouponsTab({ items, active }: Props) {
  const { t } = useLang();
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
    const res = rowFromForm(form, t);
    if ('error' in res) return alert(res.error);
    setBusy(true);
    const q = editing
      ? supabase.from('coupons').update(res.row).eq('id', editing.id)
      : supabase.from('coupons').insert(res.row);
    const { error: err } = await q;
    setBusy(false);
    if (err) return alert(err.code === '23505' ? t('coupons.duplicate') : err.message);
    clear();
    await reload();
  };

  const toggle = async (c: CouponRow) => {
    const { error: err } = await supabase.from('coupons').update({ is_active: !c.is_active }).eq('id', c.id);
    if (err) alert(err.message);
    else await reload();
  };

  const remove = async (c: CouponRow) => {
    if (!confirm(t('coupons.deleteConfirm', { code: c.code }))) return;
    if (editing?.id === c.id) clear();
    const { error: err } = await supabase.from('coupons').delete().eq('id', c.id);
    if (err) alert(err.message);
    else await reload();
  };

  const type = form.type;
  return (
    <>
      <h4 style={{ color: 'var(--gold-primary)', fontSize: '0.9rem' }}>
        {editing ? t('coupons.editTitle', { code: editing.code }) : t('coupons.newTitle')}
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="input-group">
          <label>{t('coupons.codeLabel')}</label>
          <input type="text" value={form.code} maxLength={20} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder={t('coupons.codePlaceholder')} />
        </div>
        <div className="input-group">
          <label>{t('coupons.typeLabel')}</label>
          <select value={type} onChange={(e) => set('type', e.target.value as CouponType)}>
            {COUPON_TYPES.map((k) => <option key={k} value={k}>{t(`coupons.type.${k}` as Key)}</option>)}
          </select>
        </div>

        {type === 'percent' && (
          <>
            <div className="input-group"><label>{t('coupons.percentLabel')}</label><input type="number" value={form.percentOff} onChange={(e) => set('percentOff', e.target.value)} placeholder="10" /></div>
            <div className="input-group"><label>{t('coupons.maxDiscountLabel')}</label><input type="number" value={form.maxDiscount} onChange={(e) => set('maxDiscount', e.target.value)} placeholder="50" /></div>
          </>
        )}
        {type === 'flat' && (
          <div className="input-group"><label>{t('coupons.flatLabel')}</label><input type="number" value={form.flatOff} onChange={(e) => set('flatOff', e.target.value)} placeholder="30" /></div>
        )}
        {type === 'buy_x_get_y' && (
          <>
            <div className="input-group"><label>{t('coupons.buyLabel')}</label><input type="number" value={form.buyQty} onChange={(e) => set('buyQty', e.target.value)} /></div>
            <div className="input-group"><label>{t('coupons.freeLabel')}</label><input type="number" value={form.freeQty} onChange={(e) => set('freeQty', e.target.value)} /></div>
          </>
        )}
        {type === 'free_item' && (
          <>
            <div className="input-group">
              <label>{t('coupons.freeItemLabel')}</label>
              <select value={form.freeItemId} onChange={(e) => set('freeItemId', e.target.value)}>
                <option value="">{t('coupons.choose')}</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div className="input-group" style={{ alignSelf: 'end', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {t('coupons.freeItemHint')}
            </div>
          </>
        )}
        {type === 'bundle' && (
          <>
            <div className="input-group"><label>{t('coupons.bundleQtyLabel')}</label><input type="number" value={form.bundleQty} onChange={(e) => set('bundleQty', e.target.value)} /></div>
            <div className="input-group"><label>{t('coupons.bundlePriceLabel')}</label><input type="number" value={form.bundlePrice} onChange={(e) => set('bundlePrice', e.target.value)} placeholder="140" /></div>
          </>
        )}

        <div className="input-group">
          <label>{t('coupons.appliesLabel')}</label>
          <select value={form.appliesTo} onChange={(e) => set('appliesTo', e.target.value as AppliesTo)}>
            {SCOPES.map((k) => <option key={k} value={k}>{t(`coupons.scope.${k}` as Key)}</option>)}
          </select>
        </div>
        {form.appliesTo === 'category' && (
          <div className="input-group">
            <label>{t('coupons.categoryLabel')}</label>
            <select value={form.category} onChange={(e) => set('category', e.target.value as Category)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
        <div className="input-group"><label>{t('coupons.minQtyLabel')}</label><input type="number" value={form.minQty} onChange={(e) => set('minQty', e.target.value)} placeholder="0" /></div>
        <div className="input-group"><label>{t('coupons.minOrderLabel')}</label><input type="number" value={form.minOrderValue} onChange={(e) => set('minOrderValue', e.target.value)} placeholder="0" /></div>
      </div>

      {form.appliesTo === 'items' && (
        <div className="input-group">
          <label>{t('coupons.pickItems', { count: form.itemIds.length })}</label>
          <div className="coupon-checks">
            {items.map((i) => (
              <label key={i.id}><input type="checkbox" checked={form.itemIds.includes(i.id)} onChange={() => toggleIn('itemIds', i.id)} /> {i.name}</label>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div className="input-group"><label>{t('coupons.maxTotalLabel')}</label><input type="number" value={form.maxTotalUses} onChange={(e) => set('maxTotalUses', e.target.value)} placeholder="∞" /></div>
        <div className="input-group"><label>{t('coupons.maxUserLabel')}</label><input type="number" value={form.maxUsesPerUser} onChange={(e) => set('maxUsesPerUser', e.target.value)} placeholder="∞" /></div>
        <div className="input-group"><label>{t('coupons.maxPhoneLabel')}</label><input type="number" value={form.maxUsesPerPhone} onChange={(e) => set('maxUsesPerPhone', e.target.value)} placeholder="∞" /></div>
      </div>
      <label className="coupon-check"><input type="checkbox" checked={form.firstOrderOnly} onChange={(e) => set('firstOrderOnly', e.target.checked)} /> {t('coupons.firstOrderOnly')}</label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="input-group"><label>{t('coupons.startsLabel')}</label><input type="datetime-local" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} /></div>
        <div className="input-group"><label>{t('coupons.endsLabel')}</label><input type="datetime-local" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} /></div>
        <div className="input-group"><label>{t('coupons.startTimeLabel')}</label><input type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} /></div>
        <div className="input-group"><label>{t('coupons.endTimeLabel')}</label><input type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} /></div>
      </div>
      <div className="input-group">
        <label>{t('coupons.daysLabel')}</label>
        <div className="coupon-days">
          {DAYS.map((d) => (
            <button key={d} type="button" className={form.days.includes(d) ? 'on' : ''} onClick={() => toggleIn('days', d)}>{t(`day.${d}` as Key)}</button>
          ))}
        </div>
      </div>

      <div className="input-group">
        <label>{t('coupons.descLabel')}</label>
        <input type="text" value={form.description} maxLength={200} onChange={(e) => set('description', e.target.value)} placeholder={t('coupons.descPlaceholder')} />
      </div>
      <label className="coupon-check"><input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} /> {t('coupons.activeLabel')}</label>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-primary-action" style={{ padding: 8 }} disabled={busy} onClick={() => void save()}>
          {editing ? t('coupons.saveEdit') : t('coupons.saveNew')}
        </button>
        {editing && <button className="btn-add-item" onClick={clear}>{t('coupons.cancel')}</button>}
      </div>

      <hr style={{ border: 0, borderTop: '1px solid var(--border-subtle)', margin: '10px 0' }} />
      <h4 style={{ color: 'var(--gold-primary)', fontSize: '0.9rem' }}>{t('coupons.allTitle')}</h4>
      {error && <div className="pincode-fixed-badge">⚠️ {error}</div>}
      {!error && coupons.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('coupons.none')}</div>}

      <div style={{ maxHeight: 350, overflowY: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr><th>{t('coupons.thCode')}</th><th>{t('coupons.thUsage')}</th><th>{t('coupons.thActive')}</th><th>{t('coupons.thEdit')}</th><th>{t('coupons.thDelete')}</th></tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} style={editing?.id === c.id ? { background: 'var(--gold-glow)' } : undefined}>
                <td>
                  <b>{c.code}</b>
                  <br /><small style={{ color: 'var(--text-muted)' }}>{summarize(c, items, t)}</small>
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
