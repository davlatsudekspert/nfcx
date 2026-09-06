import { useEffect, useRef, useState } from 'react';
import { navigate, usePathRoute } from '../lib/router.js';
import { useAuth } from '../lib/auth.jsx';
import { dbUnreadCount, dbList } from '../lib/db.js';
import { MESSAGING_ENABLED } from '../lib/features.js';
import { useLanguage } from '../lib/i18n.jsx';
import { canInstall, onInstallableChange, promptInstall } from '../lib/pwa.js';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import { IconBell, IconChat, IconInstall } from './Icons.jsx';
import logo from '../assets/logo-128.png';

// Navbar jonli qidiruv — ID (kod) yoki ism bo'yicha. Yozilgan sari
// katalogdan mos profillar ochiluvchi ro'yxatda chiqadi.
function HeaderSearch({ onNavigate }) {
  const { t } = useLanguage();
  const [catalog, setCatalog] = useState([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => { dbList().then((r) => setCatalog(Array.isArray(r) ? r : [])).catch(() => {}); }, []);
  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const query = q.trim().toLowerCase();
  const results = query
    ? catalog.filter((c) => c.code.toLowerCase().includes(query) || (c.name || '').toLowerCase().includes(query)).slice(0, 8)
    : [];

  const goTo = (code) => {
    setQ(''); setOpen(false);
    (onNavigate || navigate)('/' + code.toLowerCase());
  };
  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (results[0]) goTo(results[0].code);
      else if (query) { setQ(''); setOpen(false); (onNavigate || navigate)('/katalog?q=' + encodeURIComponent(q.trim())); }
    } else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={t('ID yoki ism bo‘yicha qidirish')}
        className="input input-bordered input-sm w-full bg-base-100"
      />
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-base-200 shadow-2xl">
          {results.map((c) => (
            <button
              key={c.code}
              onMouseDown={(e) => { e.preventDefault(); goTo(c.code); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5"
            >
              <span className="font-mono text-xs text-accent">#{c.code}</span>
              <span className="truncate text-base-content/70">{c.name || '—'}</span>
            </button>
          ))}
        </div>
      )}
      {open && query && results.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-white/10 bg-base-200 px-3 py-2 text-xs text-base-content/45 shadow-2xl">
          {t('Hech narsa topilmadi.')}
        </div>
      )}
    </div>
  );
}

const NAV = [
  ['Narxlar', '/narxlar'],
  ['Yangiliklar', '/yangiliklar'],
  ['Katalog', '/katalog'],
  ['Reyting', '/reyting'],
  ['Kompaniyalar', '/kompaniyalar'],
  ['Auksion', '/auksion'],
  ['Sovg‘alar', '/gifts'],
  ['Savollar', '/savollar'],
  ['Qo‘llanma', '/qollanma'],
];

const DESKTOP_NAV = [
  ['Yangiliklar', '/yangiliklar'],
  ['Narxlar', '/narxlar'],
  ['Katalog', '/katalog'],
  ['Reyting', '/reyting'],
  ['Kompaniyalar', '/kompaniyalar'],
  ['Auksion', '/auksion'],
  ['Sovg‘alar', '/gifts'],
  ['Savollar', '/savollar'],
  ['Qo‘llanma', '/qollanma'],
];

// "Mening profilim" tugmasi yonidagi kichik avatar — asosiy profil rasmi
// (yo'q bo'lsa ism/email bosh harfi).
function MyProfileAvatar({ src, label, size = 'h-6 w-6' }) {
  const letter = (label || '?').trim().charAt(0).toUpperCase() || '?';
  return src ? (
    <img src={src} alt="" className={`${size} shrink-0 rounded-full object-cover ring-1 ring-white/15`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-accent/20 text-[14px] font-bold text-accent ring-1 ring-white/15`}>
      {letter}
    </span>
  );
}

export default function Header() {
  const { user, myCards } = useAuth();
  const { t } = useLanguage();
  // Joriy sahifa — navigatsiyada oltin rang + indikator uchun.
  const path = usePathRoute();
  const isActive = (href) => path === href || path.startsWith(href + '/');
  const primaryCard = Array.isArray(myCards) ? myCards[0] : null;
  const myAvatar = primaryCard?.avatarUrl || '';
  const myLabel = primaryCard?.name || user?.email || '';
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [installable, setInstallable] = useState(canInstall());
  const [iosHint, setIosHint] = useState(null); // null | 'safari' | 'open-safari'

  useEffect(() => {
    setInstallable(canInstall());
    return onInstallableChange(setInstallable);
  }, []);
  const install = async () => {
    setOpen(false);
    const r = await promptInstall();
    if (r === 'ios-instructions') setIosHint('safari');
    else if (r === 'ios-open-safari') setIosHint('open-safari');
  };

  useEffect(() => {
    if (!user) { setUnread(0); return; }
    const load = () => dbUnreadCount().then((d) => setUnread(d.count)).catch(() => {});
    load();
    const t2 = setInterval(load, 8000);
    return () => clearInterval(t2);
  }, [user]);

  const go = (href) => { setOpen(false); navigate(href); };

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--vz-line)] bg-[rgba(0,0,0,0.86)] backdrop-blur-md">
      {/* BETA e'lon lentasi — doimiy aylanuvchi marquee. Fon rangini bermaymiz —
          header'ning o'zidagi bg-base-100/80 dan meros oladi, aks holda ikki
          qavat shaffof fon ustma-ust tushib, marquee bilan navbar orasida
          chok (rang farqi) hosil bo'ladi. */}
      <div className="overflow-hidden border-b border-white/10">
        <div className="flex w-max animate-[marqueeScroll_30s_linear_infinite] whitespace-nowrap py-1 will-change-transform">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="px-10 text-[14px] font-semibold uppercase tracking-[0.14em] text-accent">
              NFCSTORE BETA — {t('Platforma rivojlanish bosqichida. Ayrim imkoniyatlar tez orada ishga tushadi.')}
            </span>
          ))}
        </div>
      </div>
      <div className="navbar mx-auto w-full max-w-[1800px] px-6 sm:px-10 xl:px-4 2xl:px-10">
        <div className="flex items-center gap-3 sm:gap-4">
          <button onClick={() => go('/')} className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 font-display text-[17px] font-semibold tracking-[0.08em] text-[color:var(--vz-gold-2)] xl:gap-2 xl:text-[15px] 2xl:gap-2.5 2xl:text-[17px]">
            <img src={logo} alt="NFCSTORE" className="h-9 w-9 object-contain drop-shadow-[0_2px_6px_rgba(201,162,39,0.35)] xl:h-8 xl:w-8 2xl:h-9 2xl:w-9" />
            NFCSTORE
          </button>
          <div className="hidden w-36 shrink-0 md:block lg:w-40 xl:w-28 2xl:w-40">
            <HeaderSearch />
          </div>
        </div>

        {/* Navigatsiya uslubi src/theme.css'dagi `.vz-nav` / `.vz-nav__link`
            da (Black & Gold Prestige): 15-16px, vazn 500/600, iliq oq
            (--vz-ink) matn, hover va joriy sahifada yumshoq oltin
            (--vz-gold-2) + nozik oltin indikator. O'lcham va oraliq
            `clamp()` bilan — 9 ta havola 1366/1440/1920 px ekranlarda
            bitta qatorga sig'adi, UZ/RU/EN uzun matnlarida ham. */}
        <nav className="vz-nav hidden min-w-0 flex-1 xl:flex" aria-label={t('Asosiy menyu')}>
          {DESKTOP_NAV.map(([label, href]) => (
            <button
              key={href}
              onClick={() => go(href)}
              className="vz-nav__link"
              aria-current={isActive(href) ? 'page' : undefined}
            >
              {t(label)}
            </button>
          ))}
        </nav>

        <div className="flex-1 xl:hidden" />

        <div className="hidden items-center gap-2 xl:flex">
          {user && MESSAGING_ENABLED && (
            <button className="btn btn-ghost btn-sm relative gap-1.5" onClick={() => go('/xabarlar')}>
              <IconChat /> {t('Xabarlar')}
              {unread > 0 && <span className="badge badge-accent badge-xs absolute -right-1 -top-1">{unread}</span>}
            </button>
          )}
          {user && (
            <button className="btn btn-ghost btn-circle btn-sm" onClick={() => go('/bildirishnomalar')} title={t('Bildirishnomalar')} aria-label={t('Bildirishnomalar')}>
              <IconBell />
            </button>
          )}
          {user && (
            <button className="btn btn-ghost btn-sm hidden 2xl:inline-flex" onClick={() => go('/tolovlar')}>{t("To'lovlar")}</button>
          )}
          {installable && (
            <button className="btn btn-ghost btn-circle btn-sm" onClick={install} title={t('Ilovani o‘rnatish')} aria-label={t('Ilovani o‘rnatish')}><IconInstall /></button>
          )}
          {user ? (
            <button className="btn btn-outline-gold h-10 min-h-10 gap-2 pl-1.5 pr-4 text-[13.5px]" onClick={() => go('/account')}>
              <MyProfileAvatar src={myAvatar} label={myLabel} />
              {t('Mening profilim')}
            </button>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={() => go('/login')}>{t('Kirish')}</button>
          )}
          {/* Kirgan foydalanuvchi uchun asosiy CTA "Mening profilim" — ro'yxatdan
              o'tish tugmasi faqat mehmonlarga (xl kengligida navbar sig'ishi uchun ham). */}
          {!user && (
            /* xl (1280-1535px) da navigatsiyaning 9 ta havolasi sig'ishi
               uchun CTA qisqa variantda ("Ro'yxatdan o'tish"), 2xl dan
               boshlab to'liq matn qaytadi. Tugma, manzil va harakat
               O'ZGARMAYDI — faqat yorlig'i qisqaradi. */
            <button className="btn btn-gold h-10 min-h-10 px-4 text-[13.5px] 2xl:px-5" onClick={() => go('/register')}>
              <span className="2xl:hidden">{t("Ro'yxatdan o'tish")}</span>
              <span className="hidden 2xl:inline">{t('Bepul profil yaratish')}</span>
            </button>
          )}
          <LanguageSwitcher />
        </div>

        <div className="flex items-center gap-1 xl:hidden">
          <LanguageSwitcher />
          <button aria-label={t('Menyu')} aria-expanded={open} className="btn btn-ghost btn-square h-11 min-h-11 w-11" onClick={() => setOpen(!open)}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={open ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="max-h-[calc(100dvh-96px)] overflow-y-auto border-t border-[color:var(--vz-line)] px-5 pb-4 xl:hidden">
          <div className="py-3">
            <HeaderSearch onNavigate={go} />
          </div>
          <ul className="menu w-full gap-1 bg-transparent p-0">
            {NAV.map(([label, href]) => (
              <li key={href}>
                {/* .vz-nav-m__link — 16px matn, kamida 48px teginish maydoni. */}
                <button
                  onClick={() => go(href)}
                  className="vz-nav-m__link"
                  aria-current={isActive(href) ? 'page' : undefined}
                >
                  {t(label)}
                </button>
              </li>
            ))}
            <li className="mt-2 border-t border-white/10 pt-2">
              {user && MESSAGING_ENABLED && (
                <button onClick={() => go('/xabarlar')} className="min-h-11 cursor-pointer">
                  <IconChat /> {t('Xabarlar')} {unread > 0 && <span className="badge badge-accent badge-xs ml-1">{unread}</span>}
                </button>
              )}
              {user ? (
                <button onClick={() => go('/account')} className="flex min-h-11 cursor-pointer items-center gap-2">
                  <MyProfileAvatar src={myAvatar} label={myLabel} size="h-7 w-7" />
                  {t('Mening profilim')}
                </button>
              ) : (
                <button onClick={() => go('/login')} className="min-h-11 cursor-pointer">{t('Kirish')}</button>
              )}
            </li>
          </ul>
          {installable && (
            <button className="btn btn-ghost-vz btn-block mt-2 gap-2" onClick={install}><IconInstall /> {t('Ilovani o‘rnatish')}</button>
          )}
          <button className="btn btn-gold btn-block mt-2" onClick={() => go('/register')}>{t('Bepul profil yaratish')}</button>
        </div>
      )}

      {iosHint && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setIosHint(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-base-200 p-5 text-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-base font-bold"><IconInstall /> {t('Ilovani o‘rnatish')}</div>
            {iosHint === 'open-safari' ? (
              <p className="mt-3 text-base-content/75">
                {t('iPhone’da ilovani faqat Safari brauzeri orqali o‘rnatish mumkin. Bu sahifani Safari’da oching va yana urinib ko‘ring.')}
              </p>
            ) : (
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-base-content/75">
                <li>{t('Safari’da pastdagi "Ulashish" tugmasini bosing')} <span className="inline-block">{'\u{2191}'}</span></li>
                <li>{t('"Bosh ekranga qo‘shish" ni tanlang')}</li>
                <li>{t('"Qo‘shish" ni bosing')}</li>
              </ol>
            )}
            <button className="btn btn-gold btn-block mt-4" onClick={() => setIosHint(null)}>{t('Tushundim')}</button>
          </div>
        </div>
      )}
    </header>
  );
}
