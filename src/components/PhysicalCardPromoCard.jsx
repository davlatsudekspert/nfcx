import { useLanguage } from '../lib/i18n.jsx';
import { fmt } from '../lib/format.js';
import { PHYSICAL_CARD_FEE } from '../lib/pricing.js';
import { usePhysicalCardCta } from './PhysicalCardCta.jsx';
import brandLockup from '../assets/nfcstore-lockup.png';
import brandMark from '../assets/nfcstore-mark.png';

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
//
// RANG — MAVZUGA ERGASHADI (2026-09). Ramka, karta yuzasi, matn, tugma,
// narx va nur endi `src/themes.css` dagi tokenlardan oladi, ya'ni Pearl'da
// ivory-oltin, Graphite'da platinum, Ocean'da muz ko'k, Aurora'da lavanda,
// Midnight'da navy-champagne bo'ladi. Standart (legacy) mavzuda tokenlar
// AYNAN avvalgi qora-oltin qiymatlarni beradi — ko'rinish o'zgarmaydi.
//
// Bu NAMOYISH (marketing) kartasi. Foydalanuvchining HAQIQIY kartasi
// (tarif finish'i, Card Designer tanlovi) bu tokenlarga bog'liq EMAS.
//
// O'lcham, joylashuv, nisbat va animatsiya TEGILMAGAN — faqat rang va
// brend tasviri (matn o'rniga haqiqiy logotip) yangilandi.
// ═══════════════════════════════════════════════════════════════════════
export default function PhysicalCardPromoCard() {
  const { t } = useLanguage();
  const go = usePhysicalCardCta();

  return (
    <button
      type="button"
      onClick={go}
      className="vz-tap group relative block w-full max-w-[520px] cursor-pointer text-left transition-transform duration-300 will-change-transform hover:-translate-y-1 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      aria-label={t('NFC ID karta buyurtma berish')}
    >
      {/* Oltin nur — faqat bezak, bosishni to'sib qo'ymasin. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-4 rounded-[42px] opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none"
        style={{ background: 'radial-gradient(60% 60% at 50% 50%, var(--promo-glow), transparent 70%)' }}
      />

      {/* OLTIN RAMKA. Ramka gradient bilan chiziladi (rasm emas): har
          qanday ekran zichligida tiniq, telefon kengligiga moslashadi va
          sayt mavzusi bilan bir xil rangda qoladi. */}
      <span
        className="relative block rounded-[32px] p-[13px] transition-shadow duration-300 group-focus-visible:ring-2 group-focus-visible:ring-[color:var(--accent-primary)] group-focus-visible:ring-offset-4 group-focus-visible:ring-offset-transparent"
        style={{
          background: 'var(--promo-frame)',
          boxShadow: '0 30px 70px -34px color-mix(in srgb, var(--shade-base) 95%, transparent)',
        }}
      >
        <span
          className="relative flex aspect-[1.585/1] flex-col justify-between rounded-[21px] px-8 py-7"
          style={{
            background: 'var(--promo-inner-bg)',
            boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--showcase-card-gloss) 22%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--promo-code) 14%, transparent)',
          }}
        >
          {/* Yuqori qator: brend + NFC to'lqini */}
          <span className="flex items-start justify-between gap-3">
            {/* Brend belgisi — haqiqiy logotip fayli (yuqori aniqlikdagi
                manba, shuning uchun har qanday ekran zichligida tiniq).
                `--brand-mark-filter` uni mavzu bilan hamohang qiladi:
                shakl va nisbat o'zgarmaydi, faqat metall rangi. */}
            <img
              src={brandLockup}
              alt="NFCSTORE"
              className="h-[34px] w-auto shrink-0 sm:h-[42px]"
              style={{ filter: 'var(--promo-mark-filter, var(--brand-mark-filter))' }}
            />
            <img
              src={brandMark}
              alt=""
              aria-hidden="true"
              className="mt-0.5 h-[38px] w-[38px] shrink-0 object-contain"
              style={{ filter: 'var(--promo-mark-filter, var(--brand-mark-filter))' }}
            />
          </span>

          {/* O'rta: taklif matni */}
          <span className="block">
            <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[color:var(--promo-code)] sm:text-[13px]">
              {t('O‘zingiz xohlagan uslubda')}
            </span>
            <span className="mt-2 block text-[17px] font-semibold leading-snug text-[color:var(--promo-ink)] sm:text-[19px]">
              {t('Rang, dizayn va uslubni o‘zingiz tanlang')}
            </span>
          </span>

          {/* Pastki qator: tugma + narx */}
          <span className="flex flex-wrap items-center justify-between gap-3">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[15px] font-extrabold"
              style={{
                background: 'var(--promo-btn-bg, var(--button-bg))',
                color: 'var(--promo-btn-ink, var(--button-text))',
                boxShadow: '0 6px 18px -8px var(--accent-glow)',
              }}
            >
              {t('Buyurtma berish')} &rarr;
            </span>
            <span className="font-mono text-[15px] font-semibold text-[color:var(--promo-code)]">
              {fmt(PHYSICAL_CARD_FEE)} {t("so'm")}
            </span>
          </span>
        </span>
      </span>
    </button>
  );
}
