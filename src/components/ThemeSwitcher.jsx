import { useEffect, useId, useRef, useState } from 'react';
import { useLanguage } from '../lib/i18n.jsx';
import { useTheme } from '../lib/theme.jsx';

// Mavzu (rang) almashtirgich — ixcham ikona tugma + kichik popover.
//
// BU NAVIGATSIYA ELEMENTI EMAS: u hech qayerga olib bormaydi va hech
// qanday ma'lumotni o'zgartirmaydi — faqat saytning RANG mavzusini
// almashtiradi. Header tuzilmasiga tegmaydi: mavjud til tugmasi yonida,
// xuddi shu o'lchamdagi tugma bo'lib turadi.
//
// Tanlov `localStorage.nfc_theme` da (src/lib/theme.jsx). Sozlamalar
// sahifasidagi to'liq selektor ham AYNAN shu holatni ishlatadi, shuning
// uchun bir joydan o'zgartirilsa ikkinchisi darhol yangilanadi.

function PaletteIcon({ className = 'h-5 w-5' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a9 9 0 0 0 0 18h1.5a2 2 0 0 0 1.6-3.2 2 2 0 0 1 1.6-3.2H19a2 2 0 0 0 2-2A9 9 0 0 0 12 3Z" />
      <circle cx="7.6" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="9.9" cy="7.9" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="14.4" cy="7.6" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="17.3" cy="11" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Mavzuning uchta asosiy rangi — kichik namuna (fon / yuza / accent).
export function ThemeDots({ dots, size = 'h-3.5 w-3.5' }) {
  return (
    <span className="flex shrink-0 items-center -space-x-1" aria-hidden="true">
      {dots.map((c, i) => (
        <span
          key={i}
          className={`${size} rounded-full border border-[color:var(--border-strong)]`}
          style={{ background: c, zIndex: dots.length - i }}
        />
      ))}
    </span>
  );
}

export default function ThemeSwitcher({ className = '', menuClassName = '', buttonClassName = 'btn btn-ghost btn-sm min-h-11 px-2', iconClassName = 'h-5 w-5' }) {
  const { t } = useLanguage();
  const { theme, setTheme, themes } = useTheme();
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [open]);

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <button
        type="button"
        className={buttonClassName}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={t('Rang mavzusi')}
        title={t('Rang mavzusi')}
      >
        <PaletteIcon className={iconClassName} />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={t('Rang mavzusi')}
          className={`absolute right-0 z-50 mt-1 w-[268px] max-w-[calc(100vw-20px)] overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--modal-bg)] p-1.5 shadow-[var(--shadow)] ${menuClassName}`}
        >
          {themes.map((th) => {
            const active = th.id === theme;
            return (
              <button
                key={th.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => { setTheme(th.id); setOpen(false); }}
                className={`flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition ${
                  active
                    ? 'bg-[color:var(--accent-soft)] text-[color:var(--accent-primary)]'
                    : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-raised)]'
                }`}
              >
                <ThemeDots dots={th.dots} />
                {/* Nom va izoh IKKI QATORDA: eng uzun yorliq
                    ("NFCSTORE Original") bitta qatorda popover'ni
                    telefon ekranidan chiqarib yuborardi. */}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold leading-tight">{th.label}</span>
                  <span className="block truncate text-[11px] font-medium leading-tight text-[color:var(--text-faint)]">{th.hint}</span>
                </span>
                <span className={`w-3 shrink-0 text-[color:var(--accent-primary)] ${active ? '' : 'opacity-0'}`} aria-hidden="true">{'✓'}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
