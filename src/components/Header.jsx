import { useEffect, useRef, useState } from 'react';
import { navigate } from '../lib/router.js';
import { useAuth } from '../lib/auth.jsx';
import { dbUnreadCount, dbList } from '../lib/db.js';
import { MESSAGING_ENABLED } from '../lib/features.js';
import { useLanguage } from '../lib/i18n.jsx';
import { canInstall, onInstallableChange, promptInstall } from '../lib/pwa.js';
import LanguageSwitcher from './LanguageSwitcher.jsx';
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
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-accent ring-1 ring-white/15`}>
      {letter}
    </span>
  );
}

export default function Header() {
  const { user, myCards } = useAuth();
  const { t } = useLanguage();
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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-base-100/80 backdrop-blur-md">
      {/* BETA e'lon lentasi — doimiy aylanuvchi marquee. Fon rangini bermaymiz —
          header'ning o'zidagi bg-base-100/80 dan meros oladi, aks holda ikki
          qavat shaffof fon ustma-ust tushib, marquee bilan navbar orasida
          chok (rang farqi) hosil bo'ladi. */}
      <div className="overflow-hidden border-b border-white/10">
        <div className="flex w-max animate-[marqueeScroll_30s_linear_infinite] whitespace-nowrap py-1 will-change-transform">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="px-10 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
              {'✨'} NFCSTORE BETA — {t('Platforma rivojlanish bosqichida. Ayrim imkoniyatlar tez orada ishga tushadi.')}
            </span>
          ))}
        </div>
      </div>
      <div className="navbar mx-auto w-full max-w-[1800px] px-6 sm:px-10 xl:px-8 2xl:px-14">
        <div className="flex items-center gap-3 sm:gap-4">
          <button onClick={() => go('/')} className="flex shrink-0 cursor-pointer items-center gap-2.5 text-[15px] font-extrabold tracking-wide">
            <img src={logo} alt="NFCSTORE" className="h-9 w-9 object-contain drop-shadow-[0_2px_6px_rgba(201,162,39,0.35)]" />
            NFCSTORE
          </button>
          <div className="hidden w-36 shrink-0 md:block lg:w-40">
            <HeaderSearch />
          </div>
        </div>

        <nav className="hidden flex-1 items-center justify-center gap-1.5 text-sm text-base-content/60 xl:flex 2xl:gap-6">
          {DESKTOP_NAV.map(([label, href]) => (
            <button key={href} onClick={() => go(href)} className="shrink-0 cursor-pointer transition-colors hover:text-base-content">
              {t(label)}
            </button>
          ))}
        </nav>

        <div className="flex-1 xl:hidden" />

        <div className="hidden items-center gap-2 xl:flex">
          {user && MESSAGING_ENABLED && (
            <button className="btn btn-ghost btn-sm relative" onClick={() => go('/xabarlar')}>
              {'\u{1F4AC}'} {t('Xabarlar')}
              {unread > 0 && <span className="badge badge-accent badge-xs absolute -right-1 -top-1">{unread}</span>}
            </button>
          )}
          {user && (
            <button className="btn btn-ghost btn-circle btn-sm" onClick={() => go('/bildirishnomalar')} title={t('Bildirishnomalar')}>
              {'\u{1F514}'}
            </button>
          )}
          {user && (
            <button className="btn btn-ghost btn-sm" onClick={() => go('/tolovlar')}>{t("To'lovlar")}</button>
          )}
          {installable && (
            <button className="btn btn-ghost btn-sm" onClick={install} title={t('Ilovani o‘rnatish')}>{'\u{1F4F2}'}</button>
          )}
          {user ? (
            <button className="btn btn-ghost btn-sm gap-2 pl-1.5" onClick={() => go('/account')}>
              <MyProfileAvatar src={myAvatar} label={myLabel} />
              {t('Mening profilim')}
            </button>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={() => go('/login')}>{t('Kirish')}</button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => go('/register')}>{t('Bepul profil yaratish')}</button>
          <LanguageSwitcher />
        </div>

        <div className="flex items-center gap-1 xl:hidden">
          <LanguageSwitcher />
          <button aria-label="Menyu" className="btn btn-ghost btn-sm btn-square" onClick={() => setOpen(!open)}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={open ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-white/10 px-5 pb-4 xl:hidden">
          <div className="py-3">
            <HeaderSearch onNavigate={go} />
          </div>
          <ul className="menu w-full gap-1 bg-transparent p-0">
            {NAV.map(([label, href]) => (
              <li key={href}>
                <button onClick={() => go(href)} className="cursor-pointer">{t(label)}</button>
              </li>
            ))}
            <li className="mt-2 border-t border-white/10 pt-2">
              {user && MESSAGING_ENABLED && (
                <button onClick={() => go('/xabarlar')} className="cursor-pointer">
                  {'\u{1F4AC}'} {t('Xabarlar')} {unread > 0 && <span className="badge badge-accent badge-xs ml-1">{unread}</span>}
                </button>
              )}
              {user ? (
                <button onClick={() => go('/account')} className="flex cursor-pointer items-center gap-2">
                  <MyProfileAvatar src={myAvatar} label={myLabel} size="h-7 w-7" />
                  {t('Mening profilim')}
                </button>
              ) : (
                <button onClick={() => go('/login')} className="cursor-pointer">{t('Kirish')}</button>
              )}
            </li>
          </ul>
          {installable && (
            <button className="btn btn-ghost btn-block mt-2" onClick={install}>{'\u{1F4F2}'} {t('Ilovani o‘rnatish')}</button>
          )}
          <button className="btn btn-primary btn-block mt-2" onClick={() => go('/register')}>{t('Bepul profil yaratish')}</button>
        </div>
      )}

      {iosHint && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setIosHint(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-base-200 p-5 text-sm" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-bold">{'\u{1F4F2}'} {t('Ilovani o‘rnatish')}</div>
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
            <button className="btn btn-primary btn-sm btn-block mt-4" onClick={() => setIosHint(null)}>{t('Tushundim')}</button>
          </div>
        </div>
      )}
    </header>
  );
}
