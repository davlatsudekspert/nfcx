import { useCallback, useRef, useState } from 'react';
import { useLanguage, LANGUAGES } from '../lib/i18n.jsx';
import { useTheme } from '../lib/theme.jsx';
import { ThemeDots } from './ThemeSwitcher.jsx';
import { ReportModal } from './ContentMenu.jsx';
import AnchoredMenu, { anchorTo } from './AnchoredMenu.jsx';
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
//
// MENYU `document.body` GA CHIZILADI (2026-09, egasining shikoyati:
// "menyu ochilsa o'rtasi berkilib qolyapti"). Ilgari u o'z o'ramida
// `absolute z-50` edi va profil AVATARI (`z-10`) uning ustidan
// tushardi — mavzu qatorlari o'qib bo'lmas holga kelardi. Sabab
// `z-50` ning kichikligida emas: `.pf-card-actions` (`z-index:3`) va
// `.pf-actions` (`backdrop-filter`) o'zining ALOHIDA qatlam kontekstini
// ochadi, ichkaridagi `z-50` esa faqat o'sha kontekst ichida ishlaydi va
// avatar bilan bellasha olmaydi. Shuning uchun raqam kattalashtirilmadi
// — menyu yonidagi "Ulashish" allaqachon ishlatib turgan
// `AnchoredMenu` ga (portal + `position:fixed`) o'tkazildi. Bu HAMMA
// profilda — shaxsiy ham, biznes (`/c/…`) ham — bir xil, chunki
// ikkalasi ham shu bitta komponentni chaqiradi.
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
  const [menu, setMenu] = useState(null); // null yoki anchorTo() natijasi
  const [report, setReport] = useState(false);
  const btnRef = useRef(null);

  const close = useCallback(() => setMenu(null), []);

  // Menyuning taxminiy bo'yi — qaysi tomonga ochilishini hal qilish
  // uchun. Qatorlar `min-h-11` (44px), sarlavha va ajratkichlar bilan
  // birga ~46px; 150px — ikkita sarlavha, ajratkichlar, "Shikoyat" va
  // ichki chekka. Aniq bo'lishi shart emas: `AnchoredMenu` baribir
  // ekranda bor joyga `maxHeight` qo'yadi.
  const estHeight = 150
    + (ownerActions.length ? 36 + ownerActions.length * 46 : 0)
    + themes.length * 46
    + LANGUAGES.length * 46;

  const toggle = () => {
    if (menu) { setMenu(null); return; }
    // O'NG qirra bo'yicha tenglashadi: ⋮ qator oxirida, ekran chetida
    // turadi — chapga tenglashsa menyu ekrandan chiqib ketardi.
    setMenu(anchorTo(btnRef.current, { width: 248, height: estHeight, align: 'right' }));
  };

  const head = 'px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--text-faint)]';
  const row = 'flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-sm transition';

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`${className} shrink-0`}
        onClick={toggle}
        // Qatorda ulashish tugmasida ham `aria-haspopup="menu"` bor —
        // ya'ni faqat shu belgi bilan ⋮ ni ajratib bo'lmaydi. Bu
        // atribut qo'riqchi testlarga aniq nishon beradi.
        data-more-menu=""
        // Menyu tashqariga bosilganda yopiladi; bu belgi shu tugmani
        // "tashqari" deb hisoblamaslikni aytadi, aks holda tugma
        // menyuni yopolmas edi (yopilib, darrov qayta ochilardi).
        data-anchored-anchor=""
        aria-haspopup="menu"
        aria-expanded={!!menu}
        aria-label={t('Yana')}
        title={t('Yana')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      <AnchoredMenu at={menu} onClose={close} label={t('Yana')}>
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
                onClick={() => { close(); a.onClick(); }}
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
              onClick={() => { setTheme(th.id); close(); }}
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
              onClick={() => { setLang(l.code); close(); }}
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
              onClick={() => { close(); setReport(true); }}
              className={`${row} hover:bg-[color:var(--surface-raised)]`}
            >
              <span className="min-w-0 flex-1 truncate font-semibold leading-tight">{t('Shikoyat qilish')}</span>
            </button>
          </>
        )}
      </AnchoredMenu>

      {report && (
        <ReportModal targetKind={targetKind} targetId={targetId} onClose={() => setReport(false)} />
      )}
    </>
  );
}
