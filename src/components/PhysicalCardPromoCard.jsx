import { useLanguage } from '../lib/i18n.jsx';
import { fmt } from '../lib/format.js';
import { PHYSICAL_CARD_FEE } from '../lib/pricing.js';
import { usePhysicalCardCta } from './PhysicalCardCta.jsx';
import NfcCard from './NfcCard.jsx';

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
export default function PhysicalCardPromoCard({ code = 'AAA000', name = '' }) {
  const { t } = useLanguage();
  const go = usePhysicalCardCta();

  return (
    <button
      type="button"
      onClick={go}
      className="vz-tap group relative block cursor-pointer rounded-[22px] text-left transition-transform duration-300 will-change-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--vz-gold)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      aria-label={t('NFC ID karta buyurtma berish')}
    >
      {/* Oltin nur — faqat bezak, bosishni to'sib qo'ymasin. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-3 rounded-[28px] opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none"
        style={{ background: 'radial-gradient(60% 60% at 50% 50%, rgba(212,175,90,0.28), transparent 70%)' }}
      />

      <span className="relative block">
        <NfcCard code={code} name={name} finish="showcase" size="lg" />

        {/* Yozuv kartaning O'ZIDA — pastki qismida, qorayuvchi fon ustida.
            Fon kerak: karta naqshi ochiq rangli bo'lsa matn o'qilmay
            qolardi. */}
        <span
          className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1.5 rounded-b-[18px] border-t border-[rgba(212,175,90,0.22)] px-5 pb-4 pt-3.5 backdrop-blur-[2px]"
          style={{ background: 'linear-gradient(to top, rgba(6,5,4,0.97), rgba(6,5,4,0.9))' }}
        >
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--vz-gold-2)]">
            {'\u{1F3B4}'} {t('O‘zingiz xohlagan uslubda')}
          </span>
          <span className="text-[13px] font-semibold leading-snug text-white">
            {t('Rang, dizayn va uslubni o‘zingiz tanlang')}
          </span>
          <span className="mt-1 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#f0cf7a] to-[#b3860f] px-3 py-1.5 text-[12px] font-extrabold text-[#1a1206]">
              {t('Buyurtma berish')} &rarr;
            </span>
            <span className="font-mono text-[12px] text-white/70">
              {fmt(PHYSICAL_CARD_FEE)} {t("so'm")}
            </span>
          </span>
        </span>
      </span>
    </button>
  );
}
