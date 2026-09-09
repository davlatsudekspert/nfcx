import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../lib/i18n.jsx';

// Company ID uchun QR — stolga qo'yish, vitrinaga yopishtirish uchun.
// NFC karta yaqin masofa talab qiladi va eski telefonlarda yo'q; QR esa
// har qanday kamerada ishlaydi. Shuning uchun ikkalasi birga kerak.
//
// `qrcode` kutubxonasi FAQAT shu komponent ochilganda yuklanadi
// (dynamic import) — u ~50 KB va uni har bir tashrifchiga yuklash
// bekor bo'lardi.
export default function CompanyQrCard({ url, fileName = 'nfcstore-qr' }) {
  const { t } = useLanguage();
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let live = true;
    setReady(false); setErr('');
    import('qrcode')
      .then((QRCode) => {
        if (!live || !canvasRef.current) return;
        QRCode.toCanvas(canvasRef.current, url, { margin: 1, width: 320, color: { dark: '#0a0a0a', light: '#ffffff' } }, (e) => {
          if (!live) return;
          if (e) setErr(t('QR kodni chizib bo‘lmadi.')); else setReady(true);
        });
      })
      .catch(() => live && setErr(t('QR kodni chizib bo‘lmadi.')));
    return () => { live = false; };
  }, [url, t]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = `${fileName}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  return (
    <div className="cw-qr">
      <canvas ref={canvasRef} width={320} height={320} aria-label={t('QR kod')} />
      {err && <small role="alert">{err}</small>}
      <code>{url}</code>
      <button type="button" onClick={download} disabled={!ready}>{t('QR kodni yuklab olish')} ↓</button>
      <small>{t('Chop etib stolga yoki vitrinaga qo‘ying — kamera bilan skanerlansa sahifangiz ochiladi.')}</small>
    </div>
  );
}
