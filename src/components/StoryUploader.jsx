import { useRef, useState } from 'react';
import ContentRulesGate from './ContentRulesGate.jsx';
import { dbUploadImage } from '../lib/db.js';
import { useLanguage } from '../lib/i18n.jsx';

// Istorya/post qo'shish tugmasi: avval QOIDALAR oynasi, keyin fayl
// tanlash, keyin yuklash.
//
// Tartib ataylab shunday: ogohlantirish faylni tanlagandan KEYIN
// chiqsa, odam allaqachon "ish tugadi" deb o'ylab, uni o'qimay
// yopib yuborardi.
export default function StoryUploader({ label, onSubmit, disabled = false, hint = '' }) {
  const { t } = useLanguage();
  const fileRef = useRef(null);
  const [gate, setGate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr(t('Faqat rasm tanlanadi.')); return; }
    setBusy(true); setErr('');
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('read'));
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      const url = await dbUploadImage(dataUrl);
      await onSubmit({ imageUrl: url, agreed: true });
    } catch (error) {
      const code = error?.error || error?.message;
      setErr(code === 'limit_reached' ? t('Chegaraga yetdingiz — eskilaridan birini o‘chiring.')
        : code === 'feature_locked' ? t('Bu imkoniyat sizning tarifingizda yopiq.')
          : code === 'read' ? t('Faylni o‘qib bo‘lmadi.')
            : (error?.message || t('Yuklab bo‘lmadi.')));
    } finally { setBusy(false); }
  };

  return (
    <div className="story-upload">
      <button type="button" className="cw-upload-btn" disabled={disabled || busy} onClick={() => setGate(true)}>
        {busy ? t('Yuklanmoqda…') : `＋ ${label}`}
      </button>
      {hint && <small className="cw-upload-hint">{hint}</small>}
      {err && <small role="alert" className="cw-upload-err">{err}</small>}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
      {gate && (
        <ContentRulesGate
          onClose={() => setGate(false)}
          onAccept={() => { setGate(false); fileRef.current?.click(); }}
        />
      )}
    </div>
  );
}
