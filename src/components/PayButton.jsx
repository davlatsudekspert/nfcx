import { usePaymentsEnabled } from '../lib/paymentsEnabled.jsx';
import { useLanguage } from '../lib/i18n.jsx';
import PaymentUnavailableNotice from './PaymentUnavailableNotice.jsx';

// Yagona "to'lov tugmasi" — PAYMENTS_ENABLED false bo'lsa professional
// disabled holatga tushadi va tagida "Payme tez kunlarda" izohi chiqadi.
// Yoqilganda: payLink berilgan bo'lsa <a>, aks holda <button onClick>.
//
// props:
//   label      — tugma matni
//   payLink    — to'lov havolasi (Payme checkout). Bo'lsa <a target=_blank>.
//   onClick    — payLink bo'lmasa bosilganda chaqiriladi (buyurtma yaratish v.h.)
//   className  — qo'shimcha klasslar (masalan "btn-accent btn-sm")
//   disabled   — tashqi disabled (busy holati v.h.)
//   busy       — spinner ko'rsatish
//   notice     — false bo'lsa disabled holatда izohni ko'rsatmaydi (ro'yxatlarda)
export default function PayButton({
  label, payLink, onClick, className = '', disabled = false, busy = false, notice = true,
}) {
  const { t } = useLanguage();
  const PAYMENTS_ENABLED = usePaymentsEnabled();
  const base = `btn ${className}`;

  if (!PAYMENTS_ENABLED) {
    return (
      <div>
        <button
          type="button"
          className={`${base} btn-disabled !cursor-not-allowed opacity-60`}
          disabled
          aria-disabled="true"
          title={t('Payme orqali to‘lov imkoniyati tez kunlarda ishga tushadi.')}
        >
          {label}
        </button>
        {notice && <PaymentUnavailableNotice compact />}
      </div>
    );
  }

  if (busy) {
    return <button type="button" className={base} disabled><span className="loading loading-spinner loading-sm"></span></button>;
  }

  if (payLink) {
    return (
      <a href={payLink} target="_blank" rel="noopener noreferrer" className={`${base} ${disabled ? 'btn-disabled' : ''}`}>
        {label}
      </a>
    );
  }

  return (
    <button type="button" className={base} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}
