import { useEffect, useState } from 'react';
import { navigate } from '../lib/router.js';
import { useAuth } from '../lib/auth.jsx';
import { dbUnreadCount } from '../lib/db.js';

const NAV = [
  ['Narxlar', '/narxlar'],
  ['Qanday ishlaydi', '/qanday-ishlaydi'],
  ['Katalog', '/katalog'],
  ['Auksion', '/auksion'],
  ['Savollar', '/savollar'],
];

export default function Header() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) { setUnread(0); return; }
    const load = () => dbUnreadCount().then((d) => setUnread(d.count)).catch(() => {});
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [user]);

  const go = (href) => { setOpen(false); navigate(href); };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-base-100/80 backdrop-blur-md">
      <div className="navbar mx-auto max-w-6xl px-5">
        <div className="flex-1">
          <button onClick={() => go('/')} className="flex cursor-pointer items-center gap-2 text-[15px] font-extrabold tracking-wide">
            <span className="badge badge-primary badge-sm font-mono">N00</span>
            NFCSTORE
          </button>
        </div>

        <nav className="hidden items-center gap-7 text-sm text-base-content/60 md:flex">
          {NAV.map(([label, href]) => (
            <button key={href} onClick={() => go(href)} className="cursor-pointer transition-colors hover:text-base-content">
              {label}
            </button>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user && (
            <button className="btn btn-ghost btn-sm relative" onClick={() => go('/xabarlar')}>
              {'\u{1F4AC}'} Xabarlar
              {unread > 0 && <span className="badge badge-accent badge-xs absolute -right-1 -top-1">{unread}</span>}
            </button>
          )}
          {user && (
            <button className="btn btn-ghost btn-sm" onClick={() => go('/tolovlar')}>To'lovlar</button>
          )}
          {user ? (
            <button className="btn btn-ghost btn-sm" onClick={() => go('/account')}>Mening profilim</button>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={() => go('/login')}>Kirish</button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => go('/')}>Vizitka olish</button>
        </div>

        <div className="flex-none md:hidden">
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
                <button onClick={() => go(href)} className="cursor-pointer">{label}</button>
              </li>
            ))}
            <li className="mt-2 border-t border-white/10 pt-2">
              {user && (
                <button onClick={() => go('/xabarlar')} className="cursor-pointer">
                  {'\u{1F4AC}'} Xabarlar {unread > 0 && <span className="badge badge-accent badge-xs ml-1">{unread}</span>}
                </button>
              )}
              {user ? (
                <button onClick={() => go('/account')} className="cursor-pointer">Mening profilim</button>
              ) : (
                <button onClick={() => go('/login')} className="cursor-pointer">Kirish</button>
              )}
            </li>
          </ul>
          <button className="btn btn-primary btn-block mt-2" onClick={() => go('/')}>Vizitka olish</button>
        </div>
      )}
    </header>
  );
}
