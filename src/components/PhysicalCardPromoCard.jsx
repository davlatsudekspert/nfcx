import { useLanguage } from '../lib/i18n.jsx';
import { fmt } from '../lib/format.js';
import { PHYSICAL_CARD_FEE } from '../lib/pricing.js';
import { usePhysicalCardCta } from './PhysicalCardCta.jsx';

// ═══════════════════════════════════════════════════════════════════════
// KATALOG SAHIFASIDAGI NAMOYISH KARTASI — endi TAKLIF (2026-09)
//
// Bu joyda ilgari `Interactive3DCard` turardi: bosilganda karta 180
// gradusga AYLANARDI va orqa tomonini ko'rsatardi. Ikkita muammo bor edi:
//
//   1. Bosishning natijasi HECH NARSA — karta aylanadi, keyin nima
//      qilishni odam bilmaydi. Sahifadagi eng ko'zga tashlanadigan
//      element hech qayerga olib bormasdi;
//   2. Aylanish paytida matn teskari/o'qib bo'lmas holatga tushardi.
//
// Endi karta AYLANMAYDI. U — bosiladigan taklif: ustida nima taklif
// qilinayotgani yozilgan, bosilsa buyurtma oqimiga olib boradi.
//
// VIZUAL EFFEKT QOLDI, lekin boshqacha: sichqoncha yaqinlashganda karta
// biroz ko'tariladi va oltin nur bilan yoritiladi. Bu "bosiladi" degan
// ishorani beradi, lekin o'qishga xalaqit qilmaydi.
// `prefers-reduced-motion` yoqilgan qurilmada harakat butunlay o'chadi.
//
// `<button>` ISHLATILADI, `<div onClick>` emas: klaviatura bilan yurgan
// va ekran o'quvchi ishlatadigan odam uchun ham bu haqiqiy tugma bo'lsin.
// ═══════════════════════════════════════════════════════════════════════
export default function PhysicalCardPromoCard() {
  const { t } = useLanguage();
  const go = usePhysicalCardCta();

  return (
    <button
      type="button"
      onClick={go}
      className="vz-tap group relative block w-full max-w-[420px] cursor-pointer text-left transition-transform duration-300 will-change-transform hover:-translate-y-1 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      aria-label={t('NFC ID karta buyurtma berish')}
    >
      {/* Oltin nur — faqat bezak, bosishni to'sib qo'ymasin. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-4 rounded-[34px] opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none"
        style={{ background: 'radial-gradient(60% 60% at 50% 50%, rgba(212,175,90,0.3), transparent 70%)' }}
      />

      {/* OLTIN RAMKA. Ramka gradient bilan chiziladi (rasm emas): har
          qanday ekran zichligida tiniq, telefon kengligiga moslashadi va
          sayt mavzusi bilan bir xil rangda qoladi. */}
      <span
        className="relative block rounded-[26px] p-[10px] shadow-[0_30px_70px_-34px_rgba(0,0,0,0.95)] transition-shadow duration-300 group-focus-visible:ring-2 group-focus-visible:ring-[var(--vz-gold)] group-focus-visible:ring-offset-4 group-focus-visible:ring-offset-transparent"
        style={{
          background: 'linear-gradient(140deg,#f6e3a8 0%,#c9a24b 22%,#8a6a22 46%,#e8d194 62%,#a8813a 82%,#f2dfa2 100%)',
        }}
      >
        <span
          className="relative flex aspect-[1.585/1] flex-col justify-between rounded-[17px] px-6 py-5"
          style={{ background: 'linear-gradient(160deg,#12131a 0%,#0a0b10 55%,#070709 100%)' }}
        >
          {/* Yuqori qator: brend + NFC to'lqini */}
          <span className="flex items-start justify-between gap-3">
            <span className="font-display text-[26px] font-bold leading-none tracking-[0.16em] text-transparent sm:text-[30px]"
              style={{ backgroundImage: 'linear-gradient(180deg,#f7e6ae,#c9a24b)', WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>
              NFCSTORE
            </span>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-0.5 shrink-0">
              <rect x="3" y="8" width="7" height="9" rx="1.6" stroke="#d9b866" strokeWidth="1.6" />
              <circle cx="6.5" cy="12.5" r="1.1" fill="#d9b866" />
              <path d="M13.5 7.5a7 7 0 0 1 0 9M16.5 5.5a10.5 10.5 0 0 1 0 13M19.5 3.5a14 14 0 0 1 0 17"
                stroke="#d9b866" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </span>

          {/* O'rta: taklif matni */}
          <span className="block">
            <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--vz-gold-2)] sm:text-[11px]">
              {'\u{1F3B4}'} {t('O‘zingiz xohlagan uslubda')}
            </span>
            <span className="mt-1.5 block text-[14px] font-semibold leading-snug text-white sm:text-[15px]">
              {t('Rang, dizayn va uslubni o‘zingiz tanlang')}
            </span>
          </span>

          {/* Pastki qator: tugma + narx */}
          <span className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#f6e3a8] to-[#c9a24b] px-4 py-2 text-[13px] font-extrabold text-[#1a1206] shadow-[0_6px_18px_-8px_rgba(212,175,90,0.9)]">
              {t('Buyurtma berish')} &rarr;
            </span>
            <span className="font-mono text-[13px] font-semibold text-[color:var(--vz-gold-2)]">
              {fmt(PHYSICAL_CARD_FEE)} {t("so'm")}
            </span>
          </span>
        </span>
      </span>
    </button>
  );
}
