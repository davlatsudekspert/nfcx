import { useState } from 'react';
import { useLanguage, LANGUAGES } from '../lib/i18n.jsx';

// Til tanlash tugmasi — 🇺🇿/🇷🇺/🇬🇧, tanlov brauzerda saqlanadi.
// Header'da ham, header'siz "bare" sahifalarda (public profil, admin) ham
// ishlatiladi.
export default function LanguageSwitcher({ className = '', menuClassName = '' }) {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];
  return (
    <div className={`relative ${className}`}>
      <button className="btn btn-ghost btn-sm px-2" onClick={() => setOpen((o) => !o)} aria-label={current.label}>
        <span className="text-base leading-none">{current.flag}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}></div>
          <div className={`absolute right-0 z-50 mt-1 w-36 overflow-hidden rounded-xl border border-white/10 bg-base-200 shadow-xl ${menuClassName}`}>
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); setOpen(false); }}
                className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5 ${lang === l.code ? 'text-accent' : ''}`}
              >
                <span>{l.flag}</span> {l.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
