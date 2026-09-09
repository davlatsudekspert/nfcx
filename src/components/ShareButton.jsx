import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../lib/i18n.jsx';
import { shareLink, canSystemShare, shareTargets } from '../lib/share.js';
import { IconShare, IconCheck, IconLink, IconCopy, IconTelegram, IconWhatsApp, IconFacebook, IconX } from './Icons.jsx';

// "Ulashish" tugmasi.
//
// NIMA UCHUN O'Z MENYUSI BOR (2026-09, egasining shikoyati: "ulashish
// ishlamayapti, oq oyna ochilib yo'qolib qolyapti"):
//
// Ish stoli brauzerlarining bir qismida — Yandex shulardan biri —
// `navigator.share` MAVJUD, lekin ishlamaydi: bo'm-bo'sh oq oyna
// ochilib, darhol yopiladi va va'da (promise) xatosiz "bajarildi" deb
// qaytadi. Ya'ni buni koddan aniqlash ham mumkin emas: biz "ulashildi"
// deb hisoblab, hech narsa ko'rsatmasdik, odam esa hech narsa
// bo'lmaganini ko'rardi.
//
// Shuning uchun tizim oynasi endi FAQAT sensorli qurilmalarda ochiladi
// (telefon/planshet — u yerda u chindan ishlaydi va eng qulayi). Ish
// stolida esa o'zimizning kichik menyu chiqadi: Telegram, WhatsApp,
// Facebook, X va "Havolani nusxalash". Bu har qanday brauzerda
// ishlaydi va hech narsani taxmin qilmaydi.
//
// props:
//   url   — ulashiladigan to'liq havola (majburiy)
//   title — ulashish oynasidagi sarlavha
//   text  — ulashish oynasidagi qisqa tavsif
//   label — tugma matni; berilmasa faqat belgi chiqadi (ixcham holat)
//   className — tashqi uslub (btn o'lchami v.h.)
//   forceCopy — menyusiz, to'g'ridan-to'g'ri nusxalash tugmasi
const NET_ICON = { telegram: IconTelegram, whatsapp: IconWhatsApp, facebook: IconFacebook, x: IconX };

export default function ShareButton({ url, title, text, label, forceCopy = false, className = 'btn btn-ghost-vz btn-sm min-h-11' }) {
  const { t } = useLanguage();
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [menu, setMenu] = useState(null); // null yoki {top, left, align}
  const btnRef = useRef(null);
  // Komponent yopilganidan keyin setState chaqirilmasligi uchun.
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Menyu ochiq bo'lganda: tashqariga bosish, Escape, sahifa siljishi —
  // hammasi uni yopadi. Aks holda menyu tugmadan "uzilib" qolardi
  // (u sahifaga emas, ekranga nisbatan joylashtirilgan).
  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(null);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    // Bosishni "capture" bosqichida emas, oddiy bosqichda kutamiz —
    // menyu ichidagi bosish o'z ishini bajarib bo'lgach yopiladi.
    const onDown = (e) => { if (!e.target.closest?.('[data-share-menu]')) close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [menu]);

  const flash = (ok) => {
    setDone(ok);
    setFailed(!ok);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { setDone(false); setFailed(false); }, 2000);
  };

  const copy = async () => {
    setMenu(null);
    const result = await shareLink({ url, title, text, forceCopy: true });
    flash(result === 'copied');
  };

  const onClick = async () => {
    if (forceCopy) { await copy(); return; }
    // Telefon/planshet — tizimning o'z oynasi.
    if (canSystemShare()) {
      const result = await shareLink({ url, title, text });
      // 'shared' — foydalanuvchi natijani o'zi ko'rdi;
      // 'cancelled' — o'zi bekor qildi, xabar chiqarish noto'g'ri bo'lardi.
      if (result === 'copied' || result === 'failed') flash(result === 'copied');
      return;
    }
    if (menu) { setMenu(null); return; }
    // Menyu ekranga nisbatan joylashtiriladi va `document.body` ga
    // chiziladi: karta ichidagi `overflow: hidden` uni kesib
    // tashlamasin.
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = 236;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    // Pastda joy bo'lmasa — tugmaning tepasidan ochiladi.
    const below = window.innerHeight - r.bottom;
    setMenu({ left, top: below > 260 ? r.bottom + 8 : Math.max(8, r.top - 268), width });
  };

  const caption = done ? t('Nusxalandi!') : failed ? t('Nusxalab bo‘lmadi') : label;
  const targets = shareTargets({ url, title, text });

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={onClick}
        className={`${className} gap-2`}
        aria-haspopup={forceCopy ? undefined : 'menu'}
        aria-expanded={menu ? true : undefined}
        aria-label={label ? undefined : t(forceCopy ? 'Havolani nusxalash' : 'Ulashish')}
        title={t(forceCopy ? 'Havolani nusxalash' : 'Ulashish')}
      >
        {done ? <IconCheck /> : forceCopy ? <IconLink /> : <IconShare />}
        {caption && <span>{caption}</span>}
      </button>

      {menu && createPortal(
        <div
          data-share-menu
          role="menu"
          style={{
            position: 'fixed', top: menu.top, left: menu.left, width: menu.width, zIndex: 9999,
            background: 'var(--vz-card-2, #1e1810)', border: '1px solid var(--vz-line, #2d2518)',
            borderRadius: 'var(--vz-radius, 14px)', boxShadow: 'var(--vz-shadow, 0 12px 30px -16px rgba(0,0,0,.7))',
            padding: 6, color: 'var(--vz-ink, #f6efe0)',
          }}
        >
          {targets.map((s) => {
            const Icon = NET_ICON[s.id];
            return (
              <a
                key={s.id}
                role="menuitem"
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenu(null)}
                className="flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-[10px] px-3 text-[14px] font-semibold no-underline hover:bg-white/5"
                style={{ color: 'inherit' }}
              >
                <Icon /> {s.name}
              </a>
            );
          })}
          <button
            type="button"
            role="menuitem"
            onClick={copy}
            className="flex min-h-11 w-full items-center gap-2.5 whitespace-nowrap rounded-[10px] px-3 text-left text-[14px] font-semibold hover:bg-white/5"
            style={{ color: 'inherit' }}
          >
            <IconCopy width={16} height={16} /> {t('Havolani nusxalash')}
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}
