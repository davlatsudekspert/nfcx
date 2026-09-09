import { useRef, useState } from 'react';
import ContentRulesGate from './ContentRulesGate.jsx';
import { dbUploadMedia, STORY_MEDIA_MAX_BYTES } from '../lib/db.js';
import { useLanguage } from '../lib/i18n.jsx';

// Istorya/post qo'shish: avval QOIDALAR oynasi, keyin fayl tanlash,
// keyin yuklash. Tartib ataylab shunday — ogohlantirish faylni
// tanlagandan KEYIN chiqsa, odam allaqachon "ish tugadi" deb o'ylab,
// uni o'qimay yopib yuborardi.
//
// Fayl XOM BINAR sifatida ketadi (base64 emas): 100 MB fayl base64 da
// 133 MB satrga aylanardi va na brauzer, na server uni ko'tarardi.
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
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) { setErr(t('Faqat rasm yoki video tanlanadi.')); return; }
    if (file.size > STORY_MEDIA_MAX_BYTES) { setErr(t('Fayl 100 MB dan katta.')); return; }
    setBusy(true); setErr('');
    try {
      const up = await dbUploadMedia(file);
      await onSubmit(up.kind === 'video' ? { videoUrl: up.url, agreed: true } : { imageUrl: up.url, agreed: true });
    } catch (error) {
      const code = error?.error || error?.message;
      setErr(code === 'too_large' ? t('Fayl 100 MB dan katta.')
        : code === 'bad_file' ? t('Bu format qo‘llab-quvvatlanmaydi (JPG, PNG, WEBP, GIF, MP4, WEBM).')
          : code === 'limit_reached' ? t('Chegaraga yetdingiz — eskilaridan birini o‘chiring.')
            : code === 'feature_locked' ? t('Bu imkoniyat sizning tarifingizda yopiq.')
              : t('Yuklab bo‘lmadi.'));
    } finally { setBusy(false); }
  };

  return (
    <div className="story-upload">
      <button type="button" className="cw-upload-btn" disabled={disabled || busy} onClick={() => setGate(true)}>
        {busy ? t('Yuklanmoqda…') : `＋ ${label}`}
      </button>
      <small className="cw-upload-hint">{hint || t('Rasm yoki video, 100 MB gacha.')}</small>
      {err && <small role="alert" className="cw-upload-err">{err}</small>}
      <input ref={fileRef} type="file" accept="image/*,video/mp4,video/webm" hidden onChange={pick} />
      {gate && (
        <ContentRulesGate
          onClose={() => setGate(false)}
          onAccept={() => { setGate(false); fileRef.current?.click(); }}
        />
      )}
    </div>
  );
}
