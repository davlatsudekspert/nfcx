import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../lib/i18n.jsx';

// ═══════════════════════════════════════════════════════════════════════
// QR BILAN TO'LASH (2026-09)
//
// Payme'ning "to'lov tugmasi va QR kod generatsiyasi" hujjatida
// tavsiflangan QR — bu ALOHIDA havola emas, aynan bizdagi checkout
// havolasining o'zi QR kodga aylantirilgani. Shuning uchun bu yerda
// hech qanday yangi so'rov yo'q: `payLink` qanday bo'lsa, shundayligicha
// kodlanadi. Havola noto'g'ri bo'lsa QR ham noto'g'ri bo'ladi — ikkovi
// bitta manbadan.
//
// NIMA UCHUN KERAK: mijoz kompyuterda o'tirgan bo'lsa, kartasini
// klaviaturada terishi shart emas — telefonidagi Payme ilovasi bilan
// skanerlab, o'sha yerdan barmoq izi bilan to'laydi. Do'konda/qo'lma-qol
// sotuvda ham shu ekranni ko'rsatish kifoya.
//
// YOPIQ HOLATDA TURADI: telefonda ochib turgan odamga o'z ekranidagi QR
// keraksiz — u shunchaki tugmani bosadi. Shuning uchun QR faqat
// so'ralganda ochiladi va shundagina `qrcode` kutubxonasi yuklanadi
// (dinamik import — asosiy bundle'ga qo'shilmaydi).
//
// props:
//   payLink — Payme checkout havolasi (bo'sh bo'lsa komponent ko'rinmaydi)
//   className — tashqi joylashuv uchun (ixtiyoriy)
// ═══════════════════════════════════════════════════════════════════════
export default function PayQr({ payLink, className = '' }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);
  // Havola o'zgarsa (yangi buyurtma) eski QR ko'rinib turmasligi kerak —
  // aks holda mijoz OLDINGI buyurtmani to'lab yuborishi mumkin edi.
  const linkRef = useRef(payLink);

  useEffect(() => {
    if (linkRef.current !== payLink) {
      linkRef.current = payLink;
      setSrc('');
      setFailed(false);
    }
  }, [payLink]);

  useEffect(() => {
    if (!open || !payLink || src) return;
    let cancelled = false;
    import('qrcode')
      .then((QRCode) => QRCode.toDataURL(payLink, {
        margin: 1,
        width: 320,
        errorCorrectionLevel: 'M',
        // QR HAR DOIM qora-oq: skanerlash ishonchliligi dizayndan
        // muhimroq. Oltin/qora variant ba'zi kameralarda o'qilmaydi.
        color: { dark: '#000000', light: '#ffffff' },
      }))
      .then((url) => { if (!cancelled) setSrc(url); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [open, payLink, src]);

  if (!payLink) return null;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="btn btn-ghost btn-sm min-h-11 w-full gap-2 text-xs font-semibold text-base-content/60 hover:text-base-content"
      >
        <QrIcon />
        {open ? t('QR kodni yashirish') : t("QR kod bilan to'lash")}
      </button>

      {open && (
        <div className="mt-2 flex flex-col items-center gap-2 rounded-xl border border-base-content/10 bg-base-content/5 p-4">
          {failed ? (
            <p className="text-center text-xs text-base-content/60">
              {t("QR kod chiqmadi. Yuqoridagi tugma orqali to'layvering.")}
            </p>
          ) : src ? (
            <>
              <img
                src={src}
                width={220}
                height={220}
                alt={t("Payme to'lov QR kodi")}
                className="rounded-lg bg-white p-2"
              />
              <p className="max-w-[15rem] text-center text-xs leading-relaxed text-base-content/60">
                {t('Telefoningizdagi Payme ilovasini oching va shu kodni skanerlang.')}
              </p>
            </>
          ) : (
            <div className="flex h-[220px] items-center justify-center">
              <span className="loading loading-spinner loading-sm"></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QrIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM19 14h2M14 19h3M19 19h2" />
    </svg>
  );
}
