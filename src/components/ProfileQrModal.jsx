import { useEffect, useRef, useState } from 'react';
import { backdropProps } from '../lib/backdrop.js';
import { useLanguage } from '../lib/i18n.jsx';

// PROFIL QR KODI — egasi uchun, ⋮ menyusidan.
//
// NFC karta yaqin masofa talab qiladi va eski telefonlarda umuman yo'q;
// QR esa har qanday kamerada ishlaydi. Shuning uchun ikkalasi birga
// kerak: kartani tegizib bo'lmaganda odam QR ni ko'rsatadi.
//
// `qrcode` kutubxonasi (~50 KB) FAQAT shu oyna ochilganda yuklanadi —
// har bir tashrifchiga yuklash bekor bo'lardi.
export default function ProfileQrModal({ url, name = '', onClose }) {
  const { t } = useLanguage();
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');
  const value = String(url || '').trim();

  useEffect(() => {
    let live = true;
    setReady(false); setErr('');
    import('qrcode')
      .then((QRCode) => {
        if (!live || !canvasRef.current) return;
        QRCode.toCanvas(canvasRef.current, value, { margin: 1, width: 260, color: { dark: '#0a0a0a', light: '#ffffff' } }, (e) => {
          if (!live) return;
          if (e) setErr(t('QR kodni chizib bo‘lmadi.')); else setReady(true);
        });
      })
      .catch(() => { if (live) setErr(t('QR kodni chizib bo‘lmadi.')); });
    return () => { live = false; };
  }, [value, t]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = `nfcstore-qr-${(name || 'profil').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  return (
    <div className="co-modal-back" {...backdropProps(onClose)}>
      <div className="co-modal cn-modal" role="dialog" aria-modal="true">
        <h3>{t('QR kod')}</h3>
        {name && <p className="cn-holder">{name}</p>}
        <canvas ref={canvasRef} width={260} height={260} aria-label={t('Profil QR kodi')} />
        {err && <p className="co-modal-note cn-fail" role="alert">{err}</p>}
        <b className="cn-number">{value}</b>
        <button type="button" className="co-modal-cta" onClick={download} disabled={!ready}>
          {t('QR kodni yuklab olish')} ↓
        </button>
        <p className="co-modal-note">
          {t('Chop etib stolga yoki vitrinaga qo‘ying — kamera bilan skanerlansa sahifangiz ochiladi.')}
        </p>
        <button type="button" className="cn-close" onClick={onClose}>{t('Yopish')}</button>
      </div>
    </div>
  );
}
