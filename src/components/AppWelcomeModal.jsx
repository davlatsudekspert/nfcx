import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../lib/auth.jsx';
import { useLanguage } from '../lib/i18n.jsx';
import { navigate } from '../lib/router.js';
import { backdropProps } from '../lib/backdrop.js';
import {
  APP_PAGE_PATH, APP_STORE_URL, PLAY_STORE_LIVE, PLAY_STORE_URL,
  clearAppWelcome, hasAppWelcome,
} from '../lib/appDownload.js';
import CloseButton from './CloseButton.jsx';
import logo from '../assets/logo-128.png';

// ═══════════════════════════════════════════════════════════════════════
// RO'YXATDAN O'TGANDAN KEYIN — "ILOVANI YUKLAB OLING" OYNASI (2026-09-26)
//
// Egasi: "ro'yxatdan o'tgandan keyin modal bo'lib ilovani yuklab olish
// chiqsin — Play Market va App Store; App Store tez kunlarda".
//
//  * FAQAT yangi ro'yxatdan o'tgan odamga, BIR MARTA (AuthPage bayroq
//    qo'yadi, oyna ochilishi bilan o'chiriladi). Kirish (login) da yo'q.
//  * Jarayon o'rtasida CHIQMAYDI: aktivatsiya (/activate) va kompaniya
//    ochish sahifalarida kutib turadi — odam ishini tugatgach chiqadi.
//  * App Store tugmasi "Tez kunda" — bosilmaydi.
// ═══════════════════════════════════════════════════════════════════════
const WAIT_ROUTES = /^\/(activate|company\/create|login|register)(\/|$)/;

function PlayGlyph() {
  return (
    <svg width="22" height="24" viewBox="0 0 22 24" aria-hidden="true">
      <path d="M1.2.6 12.6 12 1.2 23.4c-.4-.3-.7-.8-.7-1.4V2c0-.6.3-1.1.7-1.4Z" fill="#00d7fe" />
      <path d="m16.4 8.2-3.8 3.8-11.4-11.4c.4-.3 1-.4 1.6-.1l13.6 7.7Z" fill="#00f076" />
      <path d="m16.4 15.8-13.6 7.7c-.6.3-1.2.2-1.6-.1L12.6 12l3.8 3.8Z" fill="#ff3a44" />
      <path d="m20.4 13.4-4 2.4-3.8-3.8 3.8-3.8 4 2.3c1 .6 1 2.3 0 2.9Z" fill="#ffd500" />
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg width="20" height="24" viewBox="0 0 20 24" aria-hidden="true" fill="currentColor">
      <path d="M16.5 12.7c0-2.9 2.4-4.3 2.5-4.4-1.4-2-3.5-2.3-4.3-2.3-1.8-.2-3.5 1.1-4.4 1.1-.9 0-2.3-1-3.8-1-2 0-3.8 1.1-4.8 2.9-2 3.5-.5 8.7 1.5 11.5 1 1.4 2.1 2.9 3.6 2.9 1.4-.1 2-.9 3.7-.9s2.2.9 3.7.9c1.6 0 2.5-1.4 3.5-2.8 1.1-1.6 1.5-3.2 1.6-3.3-.1 0-3.1-1.2-3.1-4.6ZM13.7 4.1c.8-1 1.3-2.3 1.2-3.6-1.1 0-2.5.8-3.3 1.7-.7.8-1.4 2.2-1.2 3.5 1.3.1 2.5-.6 3.3-1.6Z" />
    </svg>
  );
}

export default function AppWelcomeModal() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState(() => (typeof window === 'undefined' ? '/' : window.location.pathname));

  // Sayt ichidagi o'tishlarni kuzatamiz (router pushState/popstate).
  useEffect(() => {
    const sync = () => setPath(window.location.pathname);
    window.addEventListener('popstate', sync);
    const timer = setInterval(sync, 700);
    return () => { window.removeEventListener('popstate', sync); clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (open || !user || !hasAppWelcome() || WAIT_ROUTES.test(path)) return;
    clearAppWelcome();
    setOpen(true);
  }, [user, path, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open || typeof document === 'undefined') return null;
  const close = () => setOpen(false);
  const openPlay = () => {
    close();
    if (PLAY_STORE_LIVE) window.open(PLAY_STORE_URL, '_blank', 'noopener');
    else navigate(APP_PAGE_PATH);
  };
  const storeBtn = 'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition';

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      {...backdropProps(close)}
    >
      <div className="vz-card w-full max-w-sm p-6" role="dialog" aria-modal="true" aria-labelledby="app-welcome-title" data-testid="app-welcome-modal">
        <div className="flex items-start justify-between gap-3">
          <img src={logo} alt="" width="56" height="56" className="h-14 w-14 rounded-2xl" />
          <CloseButton onClick={close} />
        </div>
        <h2 id="app-welcome-title" className="mt-4 text-[22px] font-extrabold leading-tight text-[color:var(--vz-ink)]">
          {t('Xush kelibsiz! NFCSTORE ilovasini yuklab oling')}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[color:var(--vz-ink-2)]">
          {t('Vizitkangiz, lenta, Reels va NFC kartaga yozish — hammasi telefoningizda. Hisobingiz bilan kirasiz, hech narsa qayta kiritilmaydi.')}
        </p>

        <div className="mt-5 space-y-3">
          <button type="button" onClick={openPlay} data-testid="app-welcome-play"
            className={`${storeBtn} border-[color:var(--vz-ink)] bg-[color:var(--vz-ink)] text-[color:var(--vz-bg)] hover:opacity-90`}>
            <PlayGlyph />
            <span className="min-w-0">
              <small className="block text-[11px] uppercase tracking-wider opacity-70">{t('Yuklab olish')}</small>
              <b className="block text-[17px] leading-tight">Google Play</b>
            </span>
          </button>

          {APP_STORE_URL ? (
            <a href={APP_STORE_URL} target="_blank" rel="noreferrer" onClick={close}
              className={`${storeBtn} border-[color:var(--vz-line)] text-[color:var(--vz-ink)] no-underline`}>
              <AppleGlyph />
              <span className="min-w-0">
                <small className="block text-[11px] uppercase tracking-wider opacity-70">{t('Yuklab olish')}</small>
                <b className="block text-[17px] leading-tight">App Store</b>
              </span>
            </a>
          ) : (
            <div aria-disabled="true" data-testid="app-welcome-appstore"
              className={`${storeBtn} cursor-not-allowed border-dashed border-[color:var(--vz-line)] text-[color:var(--vz-ink-3)]`}>
              <AppleGlyph />
              <span className="min-w-0 flex-1">
                <small className="block text-[11px] uppercase tracking-wider opacity-70">iPhone</small>
                <b className="block text-[17px] leading-tight">App Store</b>
              </span>
              <span className="shrink-0 rounded-full border border-[color:var(--accent-primary)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--accent-text)]">
                {t('Tez kunda')}
              </span>
            </div>
          )}
        </div>

        <button type="button" onClick={close} className="mt-4 w-full py-2 text-[14px] font-semibold text-[color:var(--vz-ink-3)]">
          {t('Keyinroq')}
        </button>
      </div>
    </div>,
    document.body,
  );
}
