import { useEffect } from 'react';
import { createPortal } from 'react-dom';

// TUGMAGA YOPISHGAN KICHIK MENYU.
//
// NIMA UCHUN ALOHIDA: saytda bunday menyu endi IKKITA —
// "Ulashish" (Telegram, WhatsApp, …) va kontent menyusi
// ("⋯" → shikoyat). Ikkalasida ham bir xil nozik ish bor:
//
//   — menyu `document.body` ga chiziladi, chunki karta ichidagi
//     `overflow: hidden` uni kesib tashlardi;
//   — shu sababli u SAHIFAGA emas, EKRANGA nisbatan turadi va
//     sahifa siljishi bilan tugmadan "uzilib" qolardi — shuning
//     uchun siljish, o'lcham o'zgarishi, Escape va tashqariga
//     bosish uni yopadi;
//   — pastda joy bo'lmasa, tugmaning TEPASIDAN ochiladi.
//
// Buni ikki joyda takrorlash ularning vaqt o'tib bir-biridan
// uzoqlashishiga olib kelardi.

/// Menyu o'rnini hisoblaydi. `null` — tugma hali chizilmagan.
///
/// [height] — menyuning taxminiy bo'yi: pastda shuncha joy
/// bo'lmasa, menyu tepaga chiqadi.
export function anchorTo(button, { width = 236, height = 260 } = {}) {
  const r = button?.getBoundingClientRect();
  if (!r) return null;
  // Chetdan 8px: menyu ekran qirrasiga yopishib qolmasin.
  const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
  const below = window.innerHeight - r.bottom;
  return {
    left,
    top: below > height ? r.bottom + 8 : Math.max(8, r.top - height - 8),
    width,
  };
}

export default function AnchoredMenu({ at, onClose, children }) {
  useEffect(() => {
    if (!at) return undefined;
    const close = () => onClose();
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    // Bosishni "capture" bosqichida emas, oddiy bosqichda kutamiz —
    // menyu ichidagi bosish o'z ishini bajarib bo'lgach yopiladi.
    const onDown = (e) => { if (!e.target.closest?.('[data-anchored-menu]')) close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [at, onClose]);

  if (!at) return null;

  return createPortal(
    <div
      data-anchored-menu
      role="menu"
      style={{
        position: 'fixed', top: at.top, left: at.left, width: at.width, zIndex: 9999,
        background: 'var(--vz-card-2, #1e1810)', border: '1px solid var(--vz-line, #2d2518)',
        borderRadius: 'var(--vz-radius, 14px)', boxShadow: 'var(--vz-shadow, 0 12px 30px -16px rgba(0,0,0,.7))',
        padding: 6, color: 'var(--vz-ink, #f6efe0)',
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
