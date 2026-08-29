import { useLanguage } from '../lib/i18n.jsx';

// To'lov tizimi hali ishga tushmagani haqidagi professional ogohlantirish.
// To'lov tugmalarining ostida (compact) yoki alohida bo'lim sifatida (to'liq).
//
// Diqqat: bu yerda hech qanday Payme API chaqiruvi, tranzaksiya yoki
// soxta to'lov oynasi YO'Q — faqat "tayyorlanmoqda" holati.
export default function PaymentUnavailableNotice({ compact = false }) {
  const { t } = useLanguage();

  if (compact) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-xs text-base-content/50">
        <span aria-hidden className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-warning"></span>
        {t('Payme orqali to‘lov imkoniyati tez kunlarda ishga tushadi.')}
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-base-200/40 p-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="rounded-lg bg-[#33c8b6] px-2.5 py-1 text-sm font-extrabold tracking-tight text-white">Payme</span>
        <span className="badge badge-warning badge-sm font-semibold">{t('Tez kunlarda')}</span>
      </div>
      <div className="mt-3 text-sm font-bold">{t('To‘lov tizimi tayyorlanmoqda')}</div>
      <p className="mt-1 text-sm leading-relaxed text-base-content/60">
        {t('Payme orqali to‘lov imkoniyati tez kunlarda ishga tushadi.')}
      </p>
    </div>
  );
}
