import { useLanguage } from '../lib/i18n.jsx';

// ═══════════════════════════════════════════════════════════════════════
// YOPISH TUGMASI — butun sayt uchun YAGONA (2026-09)
//
// Avval har bir oyna o'z tugmasini yozardi va ular har xil edi:
// `btn-xs` (24px), `btn-circle` (44px), `text-xl`, `✕`, `&times;`...
// Eng yomoni `&times;` belgisi: bu MATEMATIK ko'paytirish belgisi, ko'p
// shriftlarda juda kichkina va ingichka chiziladi — telefonda u
// tugmaga emas, NUQTAGA o'xshab ko'rinardi va odam oynani qanday
// yopishni topa olmasdi.
//
// Bu yerda belgi shrifтga bog'liq emas: ikkita chiziqli SVG. Qanday
// shrift yuklanishidan qat'i nazar bir xil, qalin va aniq chiqadi.
//
//  * 44x44 — barmoq uchun eng kichik ishonchli o'lcham (Apple/Google
//    tavsiyasi). Belgi esa 20px: ko'rinadi, lekin qo'pol emas;
//  * nozik doira fon — tugma har qanday sirt ustida (qora karta, rasm,
//    oq panel) ko'rinib tursin;
//  * `focus-visible` halqasi — klaviatura bilan yurgan odam qayerda
//    turganini ko'rsin.
// ═══════════════════════════════════════════════════════════════════════
export default function CloseButton({ onClick, className = '', size = 'md' }) {
  const { t } = useLanguage();
  const box = size === 'lg' ? 'h-12 w-12' : 'h-11 w-11';
  const icon = size === 'lg' ? 22 : 20;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('Yopish')}
      title={t('Yopish')}
      className={`inline-flex ${box} shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/12 bg-white/8 text-[color:var(--vz-ink-dim,#c9c6c0)] transition hover:border-white/25 hover:bg-white/16 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vz-gold,#d4af5a)] active:scale-95 ${className}`}
    >
      <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}
