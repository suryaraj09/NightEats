import { useLang } from '../i18n/LanguageProvider';
import { LANGS } from '../i18n/translate';

/** Segmented ગુજરાતી | English switch; the choice is remembered in this browser. */
export function LanguageToggle() {
  const { lang, setLang, t } = useLang();
  return (
    <div className="lang-toggle" role="group" aria-label={t('lang.label')}>
      {LANGS.map((l) => (
        <button key={l} type="button" className={lang === l ? 'active' : ''} aria-pressed={lang === l} onClick={() => setLang(l)}>
          {t(l === 'gu' ? 'lang.gu' : 'lang.en')}
        </button>
      ))}
    </div>
  );
}
