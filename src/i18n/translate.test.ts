import { describe, expect, it } from 'vitest';
import { dictionaries, isLang, localeOf, translate, translator, type Key } from './translate';

const keys = Object.keys(dictionaries.gu) as Key[];
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('dictionaries', () => {
  it('have exactly the same keys in both languages', () => {
    expect(Object.keys(dictionaries.en).sort()).toEqual([...keys].sort());
  });

  it('never leave a translation empty', () => {
    for (const lang of ['gu', 'en'] as const) {
      for (const k of keys) expect(dictionaries[lang][k].trim(), `${lang}:${k}`).not.toBe('');
    }
  });

  it('use the same {placeholders} in both languages', () => {
    for (const k of keys) expect(placeholders(dictionaries.en[k]), k).toEqual(placeholders(dictionaries.gu[k]));
  });

  it('keep Gujarati text out of English and English sentences out of Gujarati where it matters', () => {
    const gujarati = /[઀-૿]/;
    for (const k of keys) {
      if (k === 'lang.gu') continue; // the language's own name is shown in Gujarati script on purpose
      expect(gujarati.test(dictionaries.en[k]), `en:${k}`).toBe(false);
    }
    expect(gujarati.test(dictionaries.gu['shop.closedTitle'])).toBe(true);
  });
});

describe('translate', () => {
  it('fills placeholders and leaves unknown ones alone', () => {
    expect(translate('en', 'orders.cancelConfirm', { id: 12 })).toBe('Cancel order #12?');
    expect(translate('gu', 'orders.cancelConfirm', { id: 12 })).toBe('ઓર્ડર #12 રદ કરવો છે?');
    expect(translate('en', 'orders.cancelConfirm', {})).toBe('Cancel order #{id}?');
  });

  it('returns the text unchanged when there are no params', () => {
    expect(translate('en', 'shop.viewMenu')).toBe('View menu');
  });

  it('translator() binds a language', () => {
    expect(translator('en')('cart.ok')).toBe('OK');
    expect(translator('gu')('cart.ok')).toBe('બરાબર');
  });
});

describe('helpers', () => {
  it('isLang only accepts the two languages', () => {
    expect(isLang('gu')).toBe(true);
    expect(isLang('en')).toBe(true);
    expect(isLang('hi')).toBe(false);
    expect(isLang(null)).toBe(false);
  });

  it('localeOf picks the number/date locale', () => {
    expect(localeOf('gu')).toBe('gu-IN');
    expect(localeOf('en')).toBe('en-IN');
  });
});
