import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../lib/i18n.jsx';
import { usePaymentsInfo, usePaymentProviders } from '../lib/paymentsEnabled.jsx';
import { fmt } from '../lib/format.js';
import PayQr from './PayQr.jsx';

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

// To'lov tizimlari — YAGONA ro'yxat. Yangi tizim qo'shilsa faqat shu
// yerga qatoq qo'shiladi, qolgan hamma joy o'zi moslashadi.
const PROVIDERS = [
  { id: 'payme', label: 'Payme' },
  { id: 'click', label: 'Click' },
];

// Bitta brend belgisi — Payme turkuaz, Click ko'k. Ikkalasi bir xil
// o'lchamda va bir xil ishlovda (firma ranglari o'zgartirilmaydi).
function ProviderMark({ id, label }) {
  return <span className={`pay-method__mark pay-method__mark--${id}`}>{label}</span>;
}

function PaymeLogo({ provider = 'payme' }) {
  // Tanlangan to'lov tizimining RASMIY firma rangidagi so'z belgisi —
  // o'zgartirilmaydi, oltin rangga bo'yalmaydi. Ichidagi `__sheen` — 5
  // soniyada bir marta o'tadigan juda nozik yaltiroq (neon/miltillash
  // emas); prefers-reduced-motion'da butunlay o'chadi (CSS'da).
  const meta = PROVIDERS.find((x) => x.id === provider) || PROVIDERS[0];
  return (
    <span
      className={`payme-block__logo${provider === 'click' ? ' payme-block__logo--click' : ''}`}
      aria-label={meta.label}
    >
      <span className="payme-block__sheen" aria-hidden="true"></span>
      <span className="payme-block__logo-text">{meta.label}</span>
    </span>
  );
}

// Tugma ichidagi ixcham Payme belgisi — oq, turquoise fon ustida.
function PaymeMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="3" />
      <path d="M2 10h20" />
    </svg>
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
  const { enabled, loaded } = usePaymentsInfo();
  const providers = usePaymentProviders();

  // Tanlangan to'lov tizimi. Standart — ishlaydiganlarning birinchisi.
  // Hech biri ishlamasa Payme ko'rsatiladi (blok baribir "o'chiq"
  // holatida chiqadi, foydalanuvchi nima kutayotganini biladi).
  const firstReady = PROVIDERS.find((x) => providers[x.id]?.enabled)?.id || 'payme';
  const [provider, setProvider] = useState(firstReady);
  // Holat backend'dan kechroq kelsa, tanlovni bir marta moslaymiz —
  // foydalanuvchi o'zi tanlaganidan keyin bu o'zgartirmaydi.
  const autoPicked = useRef(false);
  useEffect(() => {
    if (autoPicked.current || !loaded) return;
    autoPicked.current = true;
    setProvider(firstReady);
  }, [loaded, firstReady]);

  const active = providers[provider] || { enabled: false, sandbox: false };
  const sandbox = !!active.sandbox;

  const payClass = `payme-block__pay${provider === 'click' ? ' payme-block__pay--click' : ''}`;
  const amountText = Number.isFinite(Number(amount)) ? t("{n} so'm", { n: fmt(Number(amount)) }) : null;
  const brand = (PROVIDERS.find((x) => x.id === provider) || PROVIDERS[0]).label;
  const label = payLabel || t('{brand} orqali to‘lash', { brand });

  // TAKRORIY TRANZAKSIYA HIMOYASI. `busy` prop React holati orqali keladi,
  // ya'ni u yangilanguncha (bir render kadri) foydalanuvchi tugmani yana
  // bosib ulgurishi mumkin edi — bu ikkinchi buyurtma/tranzaksiya yaratardi.
  // `lockRef` sinxron (renderni kutmaydi): bitta bosish = bitta so'rov.
  // Qulf onPay tugagach ochiladi, shunda xatolikdan keyin qayta urinish
  // mumkin bo'ladi.
  const lockRef = useRef(false);
  const handlePay = async () => {
    if (lockRef.current || !onPay) return;
    lockRef.current = true;
    try { await onPay(); } finally { lockRef.current = false; }
  };

  return (
    <div className="payme-block">
      <div className="payme-block__head">
        <PaymeLogo provider={provider} />
        {enabled && sandbox && (
          <span className="payme-block__badge payme-block__badge--test">{t('{brand} SANDBOX · TEST REJIMI', { brand: brand.toUpperCase() })}</span>
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

      {/* TO'LOV TIZIMINI TANLASH. Ikkala brend ham DOIM ko'rinadi —
          ishga tushmagani "tez kunlarda" bo'lib turadi, yashirilmaydi.
          Shunda mijoz kelajakda qaysi imkoniyat bo'lishini biladi va
          Click ulangan kuni interfeys o'zgarmaydi — faqat holati
          "tez kunlarda" dan "tayyor" ga o'tadi. */}
      <div className="pay-methods" role="radiogroup" aria-label={t("To'lov tizimi")}>
        {PROVIDERS.map((x) => {
          const on = !!providers[x.id]?.enabled;
          const isActive = provider === x.id && on;
          return (
            <button
              key={x.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={!on}
              onClick={() => on && setProvider(x.id)}
              className={`pay-method${isActive ? ' is-active' : ''}${on ? '' : ' is-soon'}`}
            >
              <ProviderMark id={x.id} label={x.label} />
              <span className="pay-method__state">
                {on ? (isActive ? t('Tanlandi') : t('Tanlash')) : t('Tez kunlarda')}
              </span>
            </button>
          );
        })}
      </div>

      {enabled && children}

      <div className="payme-block__cta">
        {!loaded ? (
          <button type="button" className="payme-block__pay is-busy" disabled aria-busy="true">
            <span className="loading loading-spinner loading-sm"></span>
          </button>
        ) : !active.enabled ? (
          <button
            type="button"
            className="payme-block__pay is-off"
            disabled
            aria-disabled="true"
            title={t("To'lov tizimi vaqtincha o'chirilgan.")}
          >
            {label}
          </button>
        ) : busy ? (
          // Yuklanish paytida tugma BLOKLANADI — takroriy bosish yangi
          // tranzaksiya yaratmaydi.
          <button type="button" className="payme-block__pay is-busy" disabled aria-busy="true">
            <span className="loading loading-spinner loading-sm"></span>
            <span className="payme-block__pay-wait">{t('Kutilmoqda...')}</span>
          </button>
        ) : payLink ? (
          <a href={payLink} target="_blank" rel="noopener noreferrer" className={payClass}>
            <PaymeMark />
            <span>{label}</span>
          </a>
        ) : (
          <button type="button" className={payClass} onClick={handlePay} disabled={disabled}>
            <PaymeMark />
            <span>{label}</span>
          </button>
        )}
      </div>

      {/* QR — faqat havola tayyor bo'lganda. Buyurtma hali yaratilmagan
          bo'lsa kodlash uchun narsa yo'q. */}
      {active.enabled && payLink && <PayQr payLink={payLink} className="mt-2" />}

      <div className="payme-block__foot">
        <p className="payme-block__secure">
          <LockIcon />
          <span>{t("To'lov {brand}ning himoyalangan sahifasida amalga oshiriladi — karta ma'lumotlaringiz saytda saqlanmaydi.", { brand })}</span>
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
