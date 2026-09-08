import { useRef, useState } from 'react';
import { dbUploadImage } from '../lib/db.js';
import { useLanguage } from '../lib/i18n.jsx';

// Rasm maydoni: KOMPYUTERDAN FAYL tanlanadi, URL yozish shart emas.
//
// NIMA UCHUN: kompaniya profilida "Logo URL" va "Muqova rasmi URL"
// maydonlari bor edi — odam avval rasmni boshqa joyga yuklab, keyin
// manzilini ko'chirib kelishi kerak edi. Amalda hech kim buni qilmasdi
// va maydonlar bo'sh qolardi.
//
// URL yozish YO'LI OLIB TASHLANMADI: tayyor manzili bor odam uni
// baribir qo'ya oladi ("Havolani qo'lda kiritish"). Yangi yuklangan
// rasm ham oxir-oqibat shunday manzilga aylanadi, ya'ni saqlash
// mantig'i umuman o'zgarmaydi.
//
// props:
//   label    — maydon nomi
//   value    — joriy manzil ('' bo'lishi mumkin)
//   onChange — yangi manzil (yoki '' — o'chirilganda)
//   hint     — maydon ostidagi izoh
export default function ImageUploadField({ label, value, onChange, hint = '' }) {
  const { t } = useLanguage();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [manual, setManual] = useState(false);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    // Maydon TOZALANADI: bir xil faylni qayta tanlaganda ham `change`
    // hodisasi ishlashi uchun.
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr(t('Faqat rasm fayli tanlanadi.')); return; }
    setBusy(true); setErr('');
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('read'));
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      onChange(await dbUploadImage(dataUrl));
    } catch (error) {
      setErr(error?.message === 'read' ? t('Faylni o‘qib bo‘lmadi.') : (error?.message || t('Rasmni yuklab bo‘lmadi.')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <label className="cw-upload">
      <span>{label}</span>
      <div className="cw-upload-row">
        {value
          ? <img src={value} alt="" className="cw-upload-thumb" />
          : <div className="cw-upload-thumb cw-upload-empty">{'☷'}</div>}
        <div className="cw-upload-actions">
          <button type="button" className="cw-upload-btn" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? t('Yuklanmoqda…') : value ? t('Rasmni almashtirish') : t('Fayl tanlash')}
          </button>
          {value && (
            <button type="button" className="cw-upload-btn ghost" onClick={() => { onChange(''); setErr(''); }}>
              {t('O‘chirish')}
            </button>
          )}
          <button type="button" className="cw-upload-btn ghost" onClick={() => setManual((v) => !v)}>
            {manual ? t('Yopish') : t('Havolani qo‘lda kiritish')}
          </button>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
      {manual && (
        <input
          className="cw-upload-url"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
        />
      )}
      {err && <small role="alert" className="cw-upload-err">{err}</small>}
      {!err && hint && <small className="cw-upload-hint">{hint}</small>}
    </label>
  );
}
