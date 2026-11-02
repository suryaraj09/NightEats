import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_LANG, isLang, localeOf, translate, type Lang, type T } from './translate';

const LANG_KEY = 'nighteats.lang';

interface LanguageState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: T;
  /** `en-IN` / `gu-IN`, for toLocaleString. */
  locale: string;
}

const LanguageContext = createContext<LanguageState | null>(null);

// Storage can throw (private mode, blocked site data), so every access is guarded.
function loadLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (isLang(saved)) return saved;
  } catch {
    /* ignore */
  }
  return DEFAULT_LANG;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(loadLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = translate(lang, 'app.docTitle');
  }, [lang]);

  const value = useMemo<LanguageState>(
    () => ({ lang, setLang, t: (key, params) => translate(lang, key, params), locale: localeOf(lang) }),
    [lang, setLang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang(): LanguageState {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used inside <LanguageProvider>');
  return ctx;
}
