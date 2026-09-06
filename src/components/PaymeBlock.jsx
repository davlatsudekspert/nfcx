import { useLanguage } from '../lib/i18n.jsx';
import { usePaymentsInfo } from '../lib/paymentsEnabled.jsx';
import { fmt } from '../lib/format.js';

// ═══════════════════════════════════════════════════════════════════════
// YAGONA PAYME TO'LOV BLOKI (2026-09)
//
// Saytdagi HAR BIR Payme oynasi (NFC ID band qilish/sotib olish, premium,
// jismoniy NFC karta buyurtmasi, auksion to'lovi, kompaniya to'lovlari,
// "To'lovlar" sahifasi) endi shu bitta komponentdan foydalanadi.
//
// YAGONA HAQIQAT MANBAI: holat FAQAT `usePaymentsInfo()` orqali
// backend'dagi /api/settings/payments-enabled javobidan olinadi. Bu
// komponentda ham, uni chaqiruvchi sahifalarda ham Payme holati QATTIQ
// YOZILMAYDI ("Tez kunlarda" matni endi hech qayerda qattiq yozilgan
// emas — u faqat `enabled === false` bo'lganda chiqadi).
//
// DIZAYN:
//  - Payme logotipi RASMIY firma rangida (turkuaz #33c8b6 -> #1fae9c, oq
//    matn). U OLTIN rangga bo'yalmaydi va qayta chizilmaydi — oltin faqat
//    blokning nozik ramkasi va asosiy tugmasida.
//  - Qora premium fon + ingichka oltin ramka.
//  - Buyurtma nomi va to'lov summasi aniq ko'rinadi.
//  - Asosiy to'lov tugmasi — eng ko'zga tashlanadigan element.
//  - Oddiy qulf belgisi + tushunarli izoh.
//  - Sandbox yoqilgan bo'lsa: "PAYME SANDBOX · TEST REJIMI" belgisi va
//    "Real pul yechilmaydi" izohi.
//
// props:
//   title     — buyurtma nomi (masalan "Jismoniy NFC karta")
//   subtitle  — qo'shimcha tavsif (ixtiyoriy)
//   amount    — to'lov summasi (so'mda, raqam)
//   payLink   — Payme checkout havolasi (bo'lsa <a> sifatida ochiladi)
//   onPay     — payLink bo'lmasa bosilganda chaqiriladi (buyurtma yaratish)
//   payLabel  — tugma matni (standart: "Payme orqali to'lash")
//   busy      — spinner
//   disabled  — tashqi sabab bilan o'chirilgan (masalan forma to'ldirilmagan)
//   note      — tugma ostidagi qo'shimcha izoh (ixtiyoriy)
//   children  — tugma ustida ko'rsatiladigan qo'shimcha maydonlar (ism/telefon v.h.)
// ═══════════════════════════════════════════════════════════════════════

function PaymeLogo() {
  // Rasmiy Payme firma rangi va so'z belgisi — o'zgartirilmaydi.
  return (
    <span className="payme-block__logo" aria-label="Payme">Payme</span>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export default function PaymeBlock({
  title,
  subtitle,
  amount,
  payLink,
  onPay,
  payLabel,
  busy = false,
  disabled = false,
  note,
  children,
}) {
  const { t } = useLanguage();
  const { enabled, sandbox, loaded } = usePaymentsInfo();

  const amountText = Number.isFinite(Number(amount)) ? t("{n} so'm", { n: fmt(Number(amount)) }) : null;
  const label = payLabel || t("Payme orqali to'lash");

  return (
    <div className="payme-block">
      <div className="payme-block__head">
        <PaymeLogo />
        {enabled && sandbox && (
          <span className="payme-block__badge payme-block__badge--test">{t('PAYME SANDBOX · TEST REJIMI')}</span>
        )}
        {loaded && !enabled && (
          <span className="payme-block__badge payme-block__badge--off">{t('Vaqtincha mavjud emas')}</span>
        )}
      </div>

      {(title || amountText) && (
        <div className="payme-block__order">
          <div className="min-w-0">
            {title && <div className="payme-block__title">{title}</div>}
            {subtitle && <div className="payme-block__subtitle">{subtitle}</div>}
          </div>
          {amountText && (
            <div className="payme-block__amount">
              <span className="payme-block__amount-label">{t("To'lov summasi")}</span>
              <span className="payme-block__amount-value">{amountText}</span>
            </div>
          )}
        </div>
      )}

      {enabled && children}

      <div className="payme-block__cta">
        {!loaded ? (
          <button type="button" className="btn btn-gold w-full" disabled aria-busy="true">
            <span className="loading loading-spinner loading-sm"></span>
          </button>
        ) : !enabled ? (
          <button
            type="button"
            className="btn btn-gold w-full btn-disabled !cursor-not-allowed opacity-60"
            disabled
            aria-disabled="true"
            title={t("To'lov tizimi vaqtincha o'chirilgan.")}
          >
            {label}
          </button>
        ) : busy ? (
          <button type="button" className="btn btn-gold w-full" disabled aria-busy="true">
            <span className="loading loading-spinner loading-sm"></span>
          </button>
        ) : payLink ? (
          <a href={payLink} target="_blank" rel="noopener noreferrer" className="btn btn-gold w-full">
            {label} &rarr;
          </a>
        ) : (
          <button type="button" className="btn btn-gold w-full" onClick={onPay} disabled={disabled}>
            {label}
          </button>
        )}
      </div>

      <div className="payme-block__foot">
        <p className="payme-block__secure">
          <LockIcon />
          <span>{t("To'lov Payme'ning himoyalangan sahifasida amalga oshiriladi — karta ma'lumotlaringiz saytda saqlanmaydi.")}</span>
        </p>
        {enabled && sandbox && (
          <p className="payme-block__sandbox-note">{t('Real pul yechilmaydi — bu test to’lovi.')}</p>
        )}
        {loaded && !enabled && (
          <p className="payme-block__off-note">{t("To'lov tizimi hozircha o'chirilgan. Buyurtmani biroz keyinroq rasmiylashtirasiz.")}</p>
        )}
        {note && <p className="payme-block__note">{note}</p>}
      </div>
    </div>
  );
}
