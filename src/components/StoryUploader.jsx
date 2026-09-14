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
//
// `confirm` — TASDIQLASH REJIMI. Yoqilganda fayl yuklangach DARHOL
// e'lon qilinmaydi: avval ko'rinadi, ostida esa shu blokning O'Z
// "Saqlash" tugmasi turadi. Shaxsiy kabinetdagi istorya bloki aynan
// shu rejimda ishlaydi — u yerda yonida postning "Joylash" tugmasi
// bor va egasi ikkalasi bir-biriga bog'liq deb o'ylagan edi.
export default function StoryUploader({ label, onSubmit, disabled = false, hint = '', confirm = false, saveLabel = '' }) {
  const { t } = useLanguage();
  const fileRef = useRef(null);
  const [gate, setGate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Yuklangan, lekin hali e'lon qilinmagan fayl (faqat `confirm` da).
  const [pending, setPending] = useState(null);

  // Server xato kodini odam o'qiydigan matnga aylantirish — yuklashda
  // ham, saqlashda ham bir xil.
  const explain = (error) => {
    const code = error?.error || error?.message;
    return code === 'too_large' ? t('Fayl 100 MB dan katta.')
      : code === 'bad_file' ? t('Bu format qo‘llab-quvvatlanmaydi (JPG, PNG, WEBP, GIF, MP4, WEBM).')
        : code === 'limit_reached' ? t('Chegaraga yetdingiz — eskilaridan birini o‘chiring.')
          : code === 'feature_locked' ? t('Bu imkoniyat sizning tarifingizda yopiq.')
            : t('Yuklab bo‘lmadi.');
  };

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
      const payload = up.kind === 'video' ? { videoUrl: up.url, agreed: true } : { imageUrl: up.url, agreed: true };
      if (confirm) setPending(payload);
      else await onSubmit(payload);
    } catch (error) {
      setErr(explain(error));
    } finally { setBusy(false); }
  };

  const save = async () => {
    if (!pending) return;
    setBusy(true); setErr('');
    try {
      await onSubmit(pending);
      setPending(null);
    } catch (error) {
      setErr(explain(error));
    } finally { setBusy(false); }
  };

  return (
    <div className="story-upload">
      {pending ? (
        <div className="story-upload-preview">
          {pending.videoUrl
            ? <video src={pending.videoUrl} controls playsInline />
            : <img src={pending.imageUrl} alt="" />}
          <div className="story-upload-row">
            <button type="button" className="cw-upload-btn" disabled={busy} onClick={save}>
              {busy ? t('Saqlanmoqda…') : (saveLabel || t('Saqlash'))}
            </button>
            <button type="button" className="cw-upload-btn ghost" disabled={busy} onClick={() => { setPending(null); setErr(''); }}>
              {t('Bekor qilish')}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="cw-upload-btn" disabled={disabled || busy} onClick={() => setGate(true)}>
          {busy ? t('Yuklanmoqda…') : `＋ ${label}`}
        </button>
      )}
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
