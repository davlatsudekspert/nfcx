import { useEffect, useRef, useState } from 'react';
import { backdropProps } from '../lib/backdrop.js';
import { useLanguage } from '../lib/i18n.jsx';

// KARTA RAQAMI — ro'yxatda YASHIRIN turadi ("Karta raqami" deb yozilgan),
// bosilganda shu oyna ochiladi: QR kod, uning ostida raqamning o'zi va
// nusxalash tugmasi.
//
// Nima uchun yashirin: karta raqami ochiq turganda u tasodifan
// ekranga tushadi (skrinshot, video, yonidagi odam). Bosish esa —
// ataylab qilingan harakat.
//
// QR ichida FAQAT raqamning o'zi bo'ladi. Bank ilovasining to'lov QR
// formati banklarda har xil va standart emas — noto'g'ri format yozsak
// odam skanerlab pulni boshqa joyga yuborib yuborardi. Shuning uchun
// QR "raqamni ko'chirishning tez yo'li", to'lov havolasi EMAS.
export default function CardNumberModal({ cardNumber, holder = '', onClose }) {
  const { t } = useLanguage();
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const value = String(cardNumber || '').trim();

  useEffect(() => {
    let live = true;
    import('qrcode').then((QRCode) => {
      if (!live || !canvasRef.current) return;
      QRCode.toCanvas(canvasRef.current, value, { margin: 1, width: 260, color: { dark: '#0a0a0a', light: '#ffffff' } }, () => {});
    }).catch(() => {});
    return () => { live = false; };
  }, [value]);

  // NUSXALASH ISHLAMASA — SHUNI AYTAMIZ.
  //
  // Avval bu yerda `navigator.clipboard.writeText(...)` sinxron
  // `try/catch` ichida chaqirilardi. U va'da (promise) qaytaradi, ya'ni
  // RAD ETILGANDA catch umuman ishlamasdi: tugma baribir "Nusxalandi!"
  // deb yozar, xotirada esa hech narsa yo'q edi. Ba'zi brauzerlarda
  // (ruxsat berilmagan, HTTPS bo'lmagan muhit) aynan shu bo'ladi va
  // odam "ishlamayapti" deb ko'radi.
  //
  // Endi natija rost aytiladi, muvaffaqiyatsiz bo'lsa esa raqamning
  // o'zi bir tegishda belgilanadi (.cn-number { user-select: all }).
  const [failed, setFailed] = useState(false);
  const copy = async () => {
    const plain = value.replace(/\s+/g, '');
    try {
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      setFailed(false);
    } catch {
      setCopied(false);
      setFailed(true);
    }
    setTimeout(() => { setCopied(false); setFailed(false); }, 2500);
  };

  // Ko'rinish uchun 4 talab ajratiladi — o'qish va tekshirish oson.
  const pretty = value.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();

  return (
    <div className="co-modal-back" {...backdropProps(onClose)}>
      <div className="co-modal cn-modal" role="dialog" aria-modal="true">
        <h3>{t('Karta raqami')}</h3>
        {holder && <p className="cn-holder">{holder}</p>}
        <canvas ref={canvasRef} width={260} height={260} aria-label={t('Karta raqami QR kodi')} />
        <b className="cn-number">{pretty || value}</b>
        <button type="button" className="co-modal-cta" onClick={copy}>
          {copied ? t('Nusxalandi!') : failed ? t('Nusxalab bo‘lmadi') : t('Raqamni nusxalash')}
        </button>
        <p className={`co-modal-note${failed ? ' cn-fail' : ''}`}>
          {failed
            ? t('Brauzer nusxalashga ruxsat bermadi — raqam ustiga bosib, qo‘lda nusxalang.')
            : t('QR kodda faqat karta raqami yozilgan — bu to‘lov havolasi emas.')}
        </p>
        <button type="button" className="cn-close" onClick={onClose}>{t('Yopish')}</button>
      </div>
    </div>
  );
}
