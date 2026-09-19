import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../lib/i18n.jsx';
import { mediaKind, mediaUrl, videoPosterSrc } from '../lib/media.js';

// ═══════════════════════════════════════════════════════════════════════
// MEDIA OYNACHASI — SAYT BO'YICHA YAGONA
//
// MUAMMO. Rasm yoki video ko'rsatadigan har bir joy o'zicha yozilgan
// edi: lenta katagi, post kartasi, katalog. Ularning birortasida ham
// "media kelmasa nima ko'rsatamiz?" degan savolga javob yo'q edi.
// Natijada media yuklanmasa EKRANDA JIM QORA TO'RTBURCHAK qolardi —
// foydalanuvchi ham, dasturchi ham nima bo'lganini bilmasdi.
//
// Productionda bu ikki joyda bir vaqtda ko'rindi: VIP001 profilida
// to'qqizta storydan yettitasi va o'n sakkizta postdan ko'pi qop-qora
// edi.
//
// QOIDA. Bu komponent BIR narsani kafolatlaydi: oynacha hech qachon
// bo'm-bo'sh qolmaydi. Ostida har doim NOMLANGAN qatlam turadi, media
// esa uning ustiga tushadi. Media kelsa — o'zi ko'rinadi; kelmasa —
// ostidagi yozuv o'qiladi.
//
// TO'RT HOLAT:
//   rasm      — `<img>` yashirilmaydi. Ma'lumot bo'lmasa u shaffof
//               bo'ladi va ostidagi yozuv ko'rinadi. Ya'ni brauzer
//               hodisasi kelmasa ham katak bo'sh qolmaydi.
//   video     — kadr kelgunicha yopiq (bo'sh `<video>` ba'zi
//               brauzerlarda QORA chizadi va yozuvni bosib qo'yardi).
//   xato      — `onError` chiqdi: media umuman ochilmadi.
//   javobsiz  — na `load`, na `error` keldi. Telefonda aynan shu
//               ko'p uchraydi: sekin tarmoq, katta fayl, Android
//               Chrome'ning "Trafikni tejash" rejimi. Brauzer bunday
//               holatda HECH QANDAY hodisa bermaydi, shuning uchun
//               vaqtni O'ZIMIZ o'lchaymiz.
//
// JAVOBSIZ HOLATDA BIR MARTA QAYTA URINAMIZ. Osilib qolgan so'rov
// ko'pincha ikkinchi urinishda o'tadi. Manzilga `?r=1` qo'shiladi:
// o'sha manzil brauzer keshida "yuklanmoqda" holatida qotib qolgan
// bo'lsa, yangi manzil yangi so'rov demakdir. Faqat BIR marta —
// aks holda ishlamaydigan media cheksiz so'rov yuborardi.
// ═══════════════════════════════════════════════════════════════════════

// Necha soniyadan keyin "javobsiz" deb hisoblaymiz. Sekin 3G da ham
// katta rasm shu vaqtga ulguradi; undan keyin kutishning ma'nosi yo'q,
// chunki ekranda baribir hech narsa yo'q.
export const MEDIA_TIMEOUT_MS = 8000;

const retryUrl = (url) => (url.includes('?') ? `${url}&r=1` : `${url}?r=1`);

export default function MediaThumb({
  item,                 // { imageUrl, videoUrl, id }
  id,                   // loglarda ko'rsatish uchun (ixtiyoriy)
  alt = '',
  className = '',       // tashqi o'ram sinfi
  fit = 'cover',        // 'cover' | 'contain'
  onKind,               // ota-komponent turini bilishi kerak bo'lsa
}) {
  const { t } = useLanguage();
  const kind = mediaKind(item);
  const url = mediaUrl(item);
  const isVideo = kind === 'video';
  const key = id != null ? id : item?.id;

  const [state, setState] = useState(kind === 'none' ? 'error' : 'pending'); // pending|ok|slow|error
  const [attempt, setAttempt] = useState(0);
  const timerRef = useRef(0);

  useEffect(() => { onKind?.(kind); }, [kind, onKind]);

  const note = useCallback((reason) => {
    console.warn('[media] ko‘rsatib bo‘lmadi', { id: key, kind, url, reason, attempt });
  }, [key, kind, url, attempt]);

  // Vaqt o'lchagich — faqat hali hech narsa bo'lmaganda ishlaydi.
  useEffect(() => {
    if (state !== 'pending' || kind === 'none') return undefined;
    timerRef.current = setTimeout(() => {
      if (attempt === 0) {
        // Birinchi marta — jim qayta urinamiz.
        note('timeout_retry');
        setAttempt(1);
      } else {
        note('timeout');
        setState('slow');
      }
    }, MEDIA_TIMEOUT_MS);
    return () => clearTimeout(timerRef.current);
  }, [state, attempt, kind, note]);

  const ok = () => setState('ok');
  const bad = () => { note('load_failed'); setState('error'); };

  // Kesh dan kelgan media React hodisani ulagunicha tayyor bo'lishi
  // mumkin — o'shanda `onLoad`/`onLoadedData` UMUMAN chiqmaydi.
  // Shuning uchun element DOM ga tushganda holatini O'ZIDAN so'raymiz.
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
  }, [attempt]);

  const src = attempt ? retryUrl(url) : url;
  const broken = kind === 'none' || state === 'error';
  const slow = state === 'slow';

  const mark = broken ? '!' : slow ? '…' : isVideo ? '▶' : '□';
  const label = broken
    ? t('Media ochilmadi')
    : slow ? t('Media javob bermadi')
      : isVideo ? t('Video') : t('Rasm');

  return (
    <span className={`mt-wrap ${className}`} data-media-state={broken ? 'error' : slow ? 'slow' : state}>
      {/* ENG OSTKI QATLAM — har doim, har holatda, matni bilan. */}
      <span className={`mt-ph ${broken ? 'is-err' : ''} ${slow ? 'is-slow' : ''}`} aria-hidden="true">
        <b>{mark}</b><i>{label}</i>
      </span>

      {!broken && (isVideo
        ? (
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
        )
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
