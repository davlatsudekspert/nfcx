import { useEffect, useRef, useState } from 'react';
import { useLanguage, LANGUAGES } from '../lib/i18n.jsx';
import { useTheme } from '../lib/theme.jsx';
import { ThemeDots } from './ThemeSwitcher.jsx';
import { ReportModal } from './ContentMenu.jsx';
import FlagIcon from './FlagIcon.jsx';

// ═══════════════════════════════════════════════════════════════════════
// PROFIL YUQORISIDAGI "YANA" MENYUSI (⋮)
//
// MUAMMO. Profil tepasida beshta ikona yonma-yon turardi: nusxalash,
// ulashish, ⋮ (shikoyat), palitra (mavzu) va bayroq (til). Telefonda bu
// qator siqilib qolar, palitra esa "Tahrirlash" tugmasiga yopishib,
// tasodifan bosiladigan holatga tushardi.
//
// Yana bir jihat: palitra va bayroq — SAYT sozlamalari, profilning o'z
// bezagi emas. Ular profil ustida ko'rinib turishi kerak emas; kerak
// bo'lganda topilsa yetarli.
//
// YECHIM. Uchtasi — Mavzu, Til, Shikoyat — bitta ⋮ menyusiga yig'ildi.
// Yuqorida endi uchta ikona qoladi: nusxalash, ulashish, ⋮.
//
// NIMA UCHUN "YANGI" MENYU EMAS. ⋮ tugmasi profilda allaqachon bor edi
// (shikoyat uchun). Bu komponent uni ALMASHTIRADI, yonida ikkinchi
// nuqtali tugma paydo qilmaydi — aks holda odam qaysi biri nima
// ekanini bilmasdi. Shikoyat oynasi ham o'sha-o'sha: `ReportModal`
// `ContentMenu.jsx` dan qayta ishlatiladi, nusxasi yaratilmadi.
//
// Mavzu tanlovi SAYT qobig'iga ta'sir qiladi; profil egasining
// ma'lumotlar bazasidagi `theme / accentColor / bgColor` qiymatlariga
// TEGMAYDI.
// ═══════════════════════════════════════════════════════════════════════

// `ownerActions` — FAQAT EGAGA ko'rinadigan amallar:
//   [{ label, onClick }]
//
// Ular ilgari profil TEPASIDA katta tugmalar edi ("Tahrirlash",
// "Story qo'shish") va yonida "Boshqa raqamli tashrif
// qog'ozlaringiz" ro'yxati turardi. Natijada ochiq profil —
// mehmonga ko'rsatiladigan sahifa — boshqaruv paneliga o'xshab
// qolgandi. Endi ular shu menyuda: ega uchun bir bosish narida,
// mehmon uchun umuman yo'q.
export default function ProfileMoreMenu({ targetKind, targetId, className = '', ownerActions = [] }) {
  const { t, lang, setLang } = useLanguage();
  const { theme, setTheme, themes } = useTheme();
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState(false);
  const boxRef = useRef(null);

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

  const head = 'px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--text-faint)]';
  const row = 'flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-sm transition';

  return (
    <>
      <div ref={boxRef} className="relative shrink-0">
        <button
          type="button"
          className={className}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={t('Yana')}
          title={t('Yana')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="5" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="12" cy="19" r="1.8" />
          </svg>
        </button>

        {open && (
          <div
            role="menu"
            aria-label={t('Yana')}
            // `max-h` + `overflow-y-auto` — 6 mavzu, 3 til va shikoyat
            // birga 320px li telefonda ekrandan chiqib ketmasin.
            className="absolute right-0 z-50 mt-1 max-h-[70vh] w-[248px] max-w-[calc(100vw-20px)] overflow-y-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--modal-bg)] p-1.5 text-[color:var(--text-secondary)] shadow-[var(--shadow)]"
          >
            {/* EGA AMALLARI — eng tepada, chunki ega uchun aynan shular
                kerak. Mehmonda bu ro'yxat bo'sh bo'ladi va bo'lim
                umuman chizilmaydi. */}
            {ownerActions.length > 0 && (
              <>
                <div className={head}>{t('Egasi uchun')}</div>
                {ownerActions.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    role="menuitem"
                    onClick={() => { setOpen(false); a.onClick(); }}
                    className={`${row} hover:bg-[color:var(--surface-raised)]`}
                  >
                    <span className="w-4 shrink-0 text-center text-[color:var(--accent-primary)]" aria-hidden="true">{a.icon || '·'}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold leading-tight">{a.label}</span>
                  </button>
                ))}
                <div className="my-1 h-px bg-[color:var(--border)]" />
              </>
            )}

            <div className={head}>{t('Rang mavzusi')}</div>
            {themes.map((th) => {
              const active = th.id === theme;
              return (
                <button
                  key={th.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => { setTheme(th.id); setOpen(false); }}
                  className={`${row} ${active
                    ? 'bg-[color:var(--accent-soft)] text-[color:var(--accent-primary)]'
                    : 'hover:bg-[color:var(--surface-raised)]'}`}
                >
                  <ThemeDots dots={th.dots} />
                  <span className="min-w-0 flex-1 truncate font-semibold leading-tight">{th.label}</span>
                  <span className={`w-3 shrink-0 text-[color:var(--accent-primary)] ${active ? '' : 'opacity-0'}`} aria-hidden="true">{'✓'}</span>
                </button>
              );
            })}

            <div className="my-1 h-px bg-[color:var(--border)]" />

            <div className={head}>{t('Til')}</div>
            {LANGUAGES.map((l) => {
              const active = l.code === lang;
              return (
                <button
                  key={l.code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => { setLang(l.code); setOpen(false); }}
                  className={`${row} ${active
                    ? 'bg-[color:var(--accent-soft)] text-[color:var(--accent-primary)]'
                    : 'hover:bg-[color:var(--surface-raised)]'}`}
                >
                  <FlagIcon code={l.code} />
                  <span className="min-w-0 flex-1 truncate font-semibold leading-tight">{l.label}</span>
                  <span className={`w-3 shrink-0 text-[color:var(--accent-primary)] ${active ? '' : 'opacity-0'}`} aria-hidden="true">{'✓'}</span>
                </button>
              );
            })}

            {/* Shikoyat — oxirida va ajratilgan. U kundalik amal emas;
                yuqorida tursa tasodifan bosilardi. */}
            {targetId && (
              <>
                <div className="my-1 h-px bg-[color:var(--border)]" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setOpen(false); setReport(true); }}
                  className={`${row} hover:bg-[color:var(--surface-raised)]`}
                >
                  <span className="min-w-0 flex-1 truncate font-semibold leading-tight">{t('Shikoyat qilish')}</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {report && (
        <ReportModal targetKind={targetKind} targetId={targetId} onClose={() => setReport(false)} />
      )}
    </>
  );
}
