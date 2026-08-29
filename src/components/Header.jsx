import { useEffect, useState } from 'react';
import { navigate } from '../lib/router.js';
import { useAuth } from '../lib/auth.jsx';
import { dbUnreadCount } from '../lib/db.js';
import { MESSAGING_ENABLED } from '../lib/features.js';
import { useLanguage } from '../lib/i18n.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import logo from '../assets/logo-128.png';

const NAV = [
  ['Narxlar', '/narxlar'],
  ['Qanday ishlaydi', '/qanday-ishlaydi'],
  ['Katalog', '/katalog'],
  ['Reyting', '/reyting'],
  ['Kompaniyalar', '/kompaniyalar'],
  ['Auksion', '/auksion'],
  ['Savollar', '/savollar'],
];

export default function Header() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

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
      {/* BETA e'lon lentasi — doimiy aylanuvchi marquee */}
      <div className="overflow-hidden border-b border-white/10 bg-accent/10">
        <div className="flex w-max animate-[marqueeScroll_30s_linear_infinite] whitespace-nowrap py-1 will-change-transform">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="px-10 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
              {'✨'} NFCSTORE BETA — {t('Platforma rivojlanish bosqichida. Ayrim imkoniyatlar tez orada ishga tushadi.')}
            </span>
          ))}
        </div>
      </div>
      <div className="navbar mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14">
        <div className="flex-1">
          <button onClick={() => go('/')} className="flex cursor-pointer items-center gap-2.5 text-[15px] font-extrabold tracking-wide">
            <img src={logo} alt="NFCSTORE" className="h-9 w-9 object-contain drop-shadow-[0_2px_6px_rgba(201,162,39,0.35)]" />
            NFCSTORE
          </button>
        </div>

        <nav className="hidden items-center gap-7 text-sm text-base-content/60 md:flex">
          {NAV.map(([label, href]) => (
            <button key={href} onClick={() => go(href)} className="cursor-pointer transition-colors hover:text-base-content">
              {t(label)}
            </button>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
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
          {user ? (
            <button className="btn btn-ghost btn-sm" onClick={() => go('/account')}>{t('Mening profilim')}</button>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={() => go('/login')}>{t('Kirish')}</button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => go('/')}>{t("Raqamli tashrif qog'ozi olish")}</button>
          <LanguageSwitcher />
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <LanguageSwitcher />
          <button aria-label="Menyu" className="btn btn-ghost btn-sm btn-square" onClick={() => setOpen(!open)}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={open ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-white/10 px-5 pb-4 md:hidden">
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
                <button onClick={() => go('/account')} className="cursor-pointer">{t('Mening profilim')}</button>
              ) : (
                <button onClick={() => go('/login')} className="cursor-pointer">{t('Kirish')}</button>
              )}
            </li>
          </ul>
          <button className="btn btn-primary btn-block mt-2" onClick={() => go('/')}>{t("Raqamli tashrif qog'ozi olish")}</button>
        </div>
      )}
    </header>
  );
}
