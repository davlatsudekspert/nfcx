import { useEffect } from 'react';
import { createPortal } from 'react-dom';

// TUGMAGA YOPISHGAN KICHIK MENYU.
//
// NIMA UCHUN ALOHIDA: saytda bunday menyu endi UCHTA —
// "Ulashish" (Telegram, WhatsApp, …), kontent menyusi
// ("⋯" → shikoyat) va profil tepasidagi ⋮ (mavzu, til,
// shikoyat, ega amallari). Uchalasida ham bir xil nozik ish bor:
//
//   — menyu `document.body` ga chiziladi, chunki karta ichidagi
//     `overflow: hidden` uni kesib tashlardi;
//   — shu sababli u SAHIFAGA emas, EKRANGA nisbatan turadi va
//     sahifa siljishi bilan tugmadan "uzilib" qolardi — shuning
//     uchun siljish, o'lcham o'zgarishi, Escape va tashqariga
//     bosish uni yopadi;
//   — pastda joy bo'lmasa, tugmaning TEPASIDAN ochiladi.
//
// Buni uch joyda takrorlash ularning vaqt o'tib bir-biridan
// uzoqlashishiga olib kelardi.
//
// QATLAM (2026-09). ⋮ menyusi ilgari o'z o'ramida `absolute z-50`
// bilan chizilardi va profil AVATARI (`z-10`) uning USTIDA turardi:
// menyu ochilsa, o'rtasi avatar bilan berkilib qolardi. Sabab —
// `z-50` emas, o'ram: `.pf-card-actions` ning `z-index:3` i va
// `.pf-actions` dagi `backdrop-filter` ikkalasi ham ALOHIDA qatlam
// konteksti ochadi, ichkaridagi `z-50` esa o'sha kontekstdan tashqariga
// chiqolmaydi — u avatar bilan emas, faqat menyuning aka-ukalari bilan
// bellashadi. `document.body` ga chiqarilgan menyuda bunday o'ram
// umuman yo'q, shuning uchun yechim — `z-index` ni kattalashtirish
// emas, aynan shu komponentga o'tish.

/// Menyu o'rnini hisoblaydi. `null` — tugma hali chizilmagan.
///
/// [height] — menyuning taxminiy bo'yi: pastda shuncha joy
/// bo'lmasa, menyu tepaga chiqadi.
/// [align] — `'right'` bo'lsa menyuning O'NG qirrasi tugmaning o'ng
/// qirrasiga tenglashadi (ekran chetidagi ⋮ uchun; chapga tenglashsa
/// menyu ekrandan chiqib ketardi).
export function anchorTo(button, { width = 236, height = 260, align = 'left' } = {}) {
  const r = button?.getBoundingClientRect();
  if (!r) return null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Tor telefonda menyu ekrandan keng bo'lib qolmasin.
  const w = Math.min(width, vw - 16);
  const rawLeft = align === 'right' ? r.right - w : r.left;
  // Chetdan 8px: menyu ekran qirrasiga yopishib qolmasin.
  const left = Math.min(Math.max(8, rawLeft), Math.max(8, vw - w - 8));
  // 8px — tugma bilan menyu orasi, yana 8px — menyu bilan ekran qirrasi
  // orasi: menyu pastki chekkaga yopishib qolmasin.
  const below = vh - r.bottom - 16;
  const above = r.top - 16;
  // Pastda sig'sa — pastga. Aks holda QAYSI TOMONDA KO'PROQ joy bo'lsa,
  // o'sha tomonga: ikkalasi ham tor bo'lganda menyu kattaroq bo'lakda
  // ochilsin.
  const down = below >= height || below >= above;
  const space = Math.max(160, down ? below : above);
  // Tepaga ochilganda `top` emas, `bottom` qaytaramiz: menyuning haqiqiy
  // bo'yi taxminiydan qisqa bo'lsa ham u tugmaga yopishib turadi,
  // orasida bo'sh joy qolmaydi.
  return down
    ? { left, top: r.bottom + 8, width: w, maxHeight: space }
    : { left, bottom: Math.max(8, vh - r.top + 8), width: w, maxHeight: space };
}

export default function AnchoredMenu({ at, onClose, children, label }) {
  useEffect(() => {
    if (!at) return undefined;
    const close = () => onClose();
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    // MENYUNING O'Z ICHIDAGI SIJLISH menyuni YOPMAYDI. ⋮ menyusi uzun
    // (mavzular + tillar + shikoyat) va `maxHeight` ichida o'zi
    // siljiydi; `capture` bosqichidagi umumiy "siljidi — yop" qoidasi
    // uni birinchi barmoq harakatidayoq yopib qo'yardi.
    const onScroll = (e) => { if (!e.target?.closest?.('[data-anchored-menu]')) close(); };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    // Bosishni "capture" bosqichida emas, oddiy bosqichda kutamiz —
    // menyu ichidagi bosish o'z ishini bajarib bo'lgach yopiladi.
    // Menyuni OCHGAN tugma ham istisno: aks holda `mousedown` menyuni
    // yopar, ketidan kelgan `click` uni qaytadan ochardi va tugma
    // menyuni yopolmasdi.
    const onDown = (e) => {
      if (!e.target.closest?.('[data-anchored-menu],[data-anchored-anchor]')) close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
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
      aria-label={label}
      style={{
        position: 'fixed', top: at.top, bottom: at.bottom, left: at.left, width: at.width, zIndex: 9999,
        maxHeight: at.maxHeight, overflowY: 'auto', overscrollBehavior: 'contain',
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
