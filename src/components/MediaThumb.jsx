import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../lib/i18n.jsx';
import { mediaKind, mediaUrl, videoPosterSrc } from '../lib/media.js';
import { acquireVideoSlot, release } from '../lib/media-queue.js';

// ═══════════════════════════════════════════════════════════════════════
// MEDIA OYNACHASI — SAYT BO'YICHA YAGONA
//
// MUAMMO. Rasm yoki video ko'rsatadigan har bir joy o'zicha yozilgan
// edi va birortasida ham "media kelmasa nima ko'rsatamiz?" degan
// savolga javob yo'q edi. Natijada media yuklanmasa ekranda JIM QORA
// TO'RTBURCHAK qolardi — na foydalanuvchi, na dasturchi nima
// bo'lganini bilardi.
//
// QOIDA. Oynacha hech qachon bo'm-bo'sh qolmaydi: ostida har doim
// NOMLANGAN qatlam turadi, media esa uning ustiga tushadi.
//
// ── VIDEO VA RASM BIR XIL EMAS ─────────────────────────────────────
//
// Bu farqni birinchi urinishda o'tkazib yuborgan edim va u xatoga
// olib keldi. Productionda ekranda yettita "Media javob bermadi"
// chiqdi — go'yo tarmoq buzuq. Aslida esa hammasi joyida edi:
// telefon brauzeri bir vaqtda to'qqizta videoni o'qiy olmaydi,
// ortig'ini jim navbatda qoldiradi va ular haqida HECH QANDAY hodisa
// bermaydi.
//
// Ya'ni "video hali kadr bermadi" — XATO EMAS, ODATIY HOL.
// Shuning uchun:
//   • VIDEO navbat bilan o'qiladi (src/lib/media-queue.js) va kadr
//     kelmaguncha TOZA "▶ Video" kartasi ko'rinadi — sariq
//     ogohlantirish emas;
//   • RASM esa parallel yuklanaveradi, chunki u arzon. Rasm
//     kelmasa — bu HAQIQATAN muammo, shuning uchun "javob bermadi"
//     ogohlantirishi faqat rasmga tegishli.
//
// ── TO'RT HOLAT ────────────────────────────────────────────────────
//   ok        media chizildi
//   pending   kutilmoqda (video: "▶ Video", rasm: "□ Rasm")
//   slow      FAQAT RASM — 8 soniyada kelmadi, bir marta qayta
//             urinildi va u ham kelmadi
//   error     `onError` chiqdi yoki media umuman yo'q
//
// Kesh dan kelgan media React hodisani ulagunicha tayyor bo'lishi
// mumkin (o'shanda `onLoad`/`onLoadedData` umuman chiqmaydi), shuning
// uchun element holati O'ZIDAN ham o'qiladi.
// ═══════════════════════════════════════════════════════════════════════

// Rasm uchun kutish chegarasi. Sekin 3G da ham katta rasm shu vaqtga
// ulguradi; undan keyin kutishning ma'nosi yo'q.
export const MEDIA_TIMEOUT_MS = 8000;

// Video uchun — navbat kelgandan KEYIN qancha kutamiz. Kadr kelmasa
// navbat keyingisiga bo'shatiladi (aks holda bitta og'ir video butun
// navbatni to'sib qo'yardi).
export const VIDEO_TIMEOUT_MS = 6000;

const retryUrl = (url) => (url.includes('?') ? `${url}&r=1` : `${url}?r=1`);

export default function MediaThumb({
  item,                 // { imageUrl, videoUrl, id }
  id,                   // loglarda ko'rsatish uchun (ixtiyoriy)
  alt = '',
  className = '',
  fit = 'cover',
  onKind,
}) {
  const { t } = useLanguage();
  const kind = mediaKind(item);
  const url = mediaUrl(item);
  const isVideo = kind === 'video';
  const key = id != null ? id : item?.id;

  const [state, setState] = useState(kind === 'none' ? 'error' : 'pending');
  const [attempt, setAttempt] = useState(0);
  // Video uchun: navbat keldimi? Kelmaguncha `src` umuman qo'yilmaydi,
  // aks holda brauzer baribir hammasini birdan so'rardi.
  const [armed, setArmed] = useState(!isVideo);
  const doneRef = useRef(false);
  const timerRef = useRef(0);

  useEffect(() => { onKind?.(kind); }, [kind, onKind]);

  const note = useCallback((reason) => {
    console.warn('[media] ko‘rsatib bo‘lmadi', { id: key, kind, url, reason, attempt });
  }, [key, kind, url, attempt]);

  // ── VIDEO: NAVBAT ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isVideo || kind === 'none') return undefined;
    const cancel = acquireVideoSlot(() => setArmed(true));
    return () => {
      cancel();
      if (doneRef.current) return;   // allaqachon bo'shatilgan
      doneRef.current = true;
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVideo, kind, url]);

  // Navbatni bir marta bo'shatish.
  const freeSlot = useCallback(() => {
    if (!isVideo || doneRef.current) return;
    doneRef.current = true;
    release();
  }, [isVideo]);

  // ── KUTISH CHEGARASI ───────────────────────────────────────────────
  useEffect(() => {
    if (state !== 'pending' || kind === 'none') return undefined;
    // Video hali navbatini kutayotgan bo'lsa vaqt sanalmaydi — u
    // yuklanmayapti ham.
    if (isVideo && !armed) return undefined;

    timerRef.current = setTimeout(() => {
      if (isVideo) {
        // VIDEO uchun bu XATO EMAS: telefon kadr bermasligi mumkin.
        // Navbatni bo'shatamiz, karta esa toza "▶ Video" bo'lib
        // qolaveradi.
        note('video_no_preview');
        freeSlot();
        return;
      }
      if (attempt === 0) {
        note('timeout_retry');
        setAttempt(1);
      } else {
        note('timeout');
        setState('slow');
      }
    }, isVideo ? VIDEO_TIMEOUT_MS : MEDIA_TIMEOUT_MS);
    return () => clearTimeout(timerRef.current);
  }, [state, attempt, kind, isVideo, armed, note, freeSlot]);

  const ok = useCallback(() => { setState('ok'); freeSlot(); }, [freeSlot]);
  const bad = useCallback(() => { note('load_failed'); setState('error'); freeSlot(); }, [note, freeSlot]);

  const mediaRef = useCallback((el) => {
    if (!el) return;
    if (el.tagName === 'IMG') {
      if (el.complete && el.naturalWidth > 0) ok();
      else if (el.complete) bad();
    } else {
      if (el.readyState >= 2) ok();
      else if (el.error) bad();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, armed]);

  const src = attempt ? retryUrl(url) : url;
  const broken = kind === 'none' || state === 'error';
  const slow = state === 'slow';          // faqat rasm shu holatga tushadi

  const mark = broken ? '!' : slow ? '…' : isVideo ? '▶' : '□';
  const label = broken
    ? t('Media ochilmadi')
    : slow ? t('Media javob bermadi')
      : isVideo ? t('Video') : t('Rasm');

  return (
    <span className={`mt-wrap ${className}`} data-media-state={broken ? 'error' : slow ? 'slow' : state}>
      {/* ENG OSTKI QATLAM — har doim, har holatda, matni bilan. */}
      <span className={`mt-ph ${broken ? 'is-err' : ''} ${slow ? 'is-slow' : ''} ${isVideo && !broken ? 'is-video' : ''}`} aria-hidden="true">
        <b>{mark}</b><i>{label}</i>
      </span>

      {!broken && (isVideo
        ? (armed && (
          <video
            key={attempt}
            ref={mediaRef}
            className={`mt-media mt-${fit}`}
            src={videoPosterSrc(src)}
            muted playsInline preload="metadata"
            onLoadedData={ok}
            onError={bad}
            style={{ opacity: state === 'ok' ? 1 : 0 }}
          />
        ))
        : (
          <img
            key={attempt}
            ref={mediaRef}
            className={`mt-media mt-${fit}`}
            src={src}
            alt={alt}
            decoding="async"
            onLoad={ok}
            onError={bad}
          />
        ))}
    </span>
  );
}
