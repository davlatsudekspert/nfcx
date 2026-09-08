import { useAuth } from '../lib/auth.jsx';
import { useLanguage } from '../lib/i18n.jsx';
import { navigate } from '../lib/router.js';
import { fmt } from '../lib/format.js';
import { PHYSICAL_CARD_FEE, TIER_LABEL, PHYSICAL_CARD_MIN_TIER } from '../lib/pricing.js';
import { IconChip, IconCheck } from './Icons.jsx';

// ═══════════════════════════════════════════════════════════════════════
// JISMONIY NFC KARTA — bosh sahifadagi taklif (2026-09)
//
// Avval jismoniy kartani buyurtma qilish YO'LI faqat kabinet ichida,
// karta qatoridagi kichik tugmada edi. Ya'ni saytga birinchi marta
// kirgan odam bu mahsulot borligini umuman bilmasdi.
//
// TUGMA HECH QACHON "BOSHI BERK KO'CHA" GA OLIB BORMAYDI. Foydalanuvchi
// holatiga qarab to'g'ri keyingi qadamga yuboradi:
//
//   tizimga kirmagan  -> ro'yxatdan o'tish
//   kirgan            -> kabinet, dizayn oynasi O'ZI ochiladi
//                        (`?open=nfc-karta`)
//
// NFC ID hali yo'q bo'lsa yoki tarifi yetmasa — buni kabinetning o'zi
// aytadi (u yerda tarif tekshiruvi va "yopiq funksiya" oynasi bor).
// Shu sabab bu yerda ikkinchi marta tekshirilmaydi: bitta qoida ikki
// joyda yozilsa, vaqt o'tib ular ajralib ketadi.
//
// SHART OCHIQ YOZILADI: pastdagi izohda "{tarif} va undan yuqori NFC ID
// kerak" deb turadi. Odam tugmani bosgandan keyin emas, BOSISHDAN OLDIN
// bilishi kerak — aks holda ro'yxatdan o'tib, keyin "yopiq" degan
// xabarni ko'radi va bu aldangandek taassurot qoldiradi.
// ═══════════════════════════════════════════════════════════════════════
// Bir xil yo'nalish mantig'i ikki joyda ishlatiladi (bosh sahifadagi keng
// blok va katalogdagi karta) — shuning uchun alohida hook. Ikki nusxa
// bo'lsa, vaqt o'tib biri o'zgarib, ikkinchisi eskirib qolardi.
export function usePhysicalCardCta() {
  const { user } = useAuth();
  return () => {
    // Niyat sessiyada saqlanadi: ro'yxatdan o'tish oqimi tugagach
    // foydalanuvchi kabinetga tushadi va dizayn oynasi O'ZI ochiladi.
    // `?open=` bilan birga ishlaydi — biri yo'qolsa (masalan auth
    // sahifasi boshqa manzilga yuborsa) ikkinchisi qoladi.
    try { sessionStorage.setItem('nfcx:open-after-auth', 'nfc-karta'); } catch { /* jim */ }
    if (!user) { navigate('/register'); return; }
    navigate('/account?open=nfc-karta');
  };
}

export default function PhysicalCardCta() {
  const { t } = useLanguage();
  const go = usePhysicalCardCta();

  const points = [
    'Rang, fon va uslubni o‘zingiz tanlaysiz',
    'Old va orqa tomon — ikkalasi ham sizniki',
    'QR kod va logotipni xohlagan joyga qo‘yasiz',
    'Chop etilgan karta pochta orqali keladi',
  ];

  return (
    <div className="vz-card grid items-center gap-8 overflow-hidden p-7 md:grid-cols-[1fr_auto] md:p-9">
      <div className="min-w-0">
        <span className="vz-kicker">{t('O‘zingiz xohlagan uslubda')}</span>
        <h2 className="vz-h2 mt-3 text-[color:var(--vz-ink)]">
          {t('NFC ID kartangizni o‘zingizga mos')} <span className="text-[color:var(--vz-gold-2)]">{t('dizaynda yarating')}</span>
        </h2>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[color:var(--vz-ink-2)]">
          {t('Rang, dizayn va uslubni o‘zingiz tanlaysiz — keyin buyurtma berasiz. Tayyor karta pochta orqali qo‘lingizga yetib boradi.')}
        </p>

        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {points.map((x) => (
            <li key={x} className="flex items-start gap-2 text-[15px] text-[color:var(--vz-ink-2)]">
              <IconCheck width="16" height="16" className="mt-0.5 shrink-0 text-[color:var(--vz-gold)]" />
              {t(x)}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button type="button" onClick={go} className="btn btn-gold min-h-11">
            <IconChip width={16} height={16} /> {t('NFC ID karta buyurtma berish')}
          </button>
          <span className="font-display text-2xl font-semibold text-[color:var(--vz-ink)]">
            {fmt(PHYSICAL_CARD_FEE)} <small className="font-sans text-sm font-normal text-[color:var(--vz-ink-2)]">{t("so'm")}</small>
          </span>
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-[color:var(--vz-ink-3,rgba(255,255,255,0.45))]">
          {t('Buning uchun {tier} yoki undan yuqori NFC ID kerak. ID’ni «Narxlar» bo‘limidan tanlaysiz — dizayner shundan keyin ochiladi.', { tier: t(TIER_LABEL[PHYSICAL_CARD_MIN_TIER]) })}
          {' '}
          <button type="button" onClick={() => navigate('/narxlar')} className="underline underline-offset-2 hover:text-[color:var(--vz-gold-2)]">
            {t('Narxlarni ko‘rish')}
          </button>
        </p>
      </div>

      {/* Karta ko'rinishi — dekor. `aria-hidden`: ekran o'quvchi uchun
          ma'nosi yo'q, matnda hammasi aytilgan. Tor ekranda yashiriladi:
          telefonda u matnni pastga surib yuborardi. */}
      <div aria-hidden="true" className="hidden md:block">
        <div className="relative h-[196px] w-[310px] rotate-[-4deg] rounded-2xl border border-[rgba(212,175,90,0.35)] bg-gradient-to-br from-[#181206] to-[#0b0906] p-5 shadow-[0_28px_60px_-30px_rgba(0,0,0,0.95)]">
          <div className="font-mono text-[11px] tracking-[0.28em] text-[color:var(--vz-gold-2)]">NFCSTORE</div>
          <div className="mt-8 font-mono text-[30px] font-extrabold tracking-[0.14em] text-[color:var(--vz-ink)]">VIP001</div>
          <div className="mt-1 text-[12px] text-[color:var(--vz-ink-2)]">nfcstore.uz/vip001</div>
          <div className="absolute bottom-5 right-5 h-9 w-9 rounded-full border border-[rgba(212,175,90,0.4)]" />
          <div className="absolute bottom-[26px] right-[26px] h-4 w-4 rounded-full border border-[rgba(212,175,90,0.28)]" />
        </div>
      </div>
    </div>
  );
}
