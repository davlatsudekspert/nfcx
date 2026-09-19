import { useCallback, useState } from 'react';
import StoryViewer from './StoryViewer.jsx';
import { useLanguage } from '../lib/i18n.jsx';
import { storyMediaKind, storyMediaUrl, videoPosterSrc } from '../lib/story-media.js';

// "LENTA" — 24 soatdan keyin o'zi yo'qoladigan istoryalar ro'yxati.
//
// NIMA UCHUN POSTDAN ALOHIDA: post — DOIMIY kontent, istorya esa bir
// kunlik. Ilgari ular interfeysda aralash edi: istorya faqat avatar
// atrofidagi halqada ko'rinardi, ya'ni uni payqamaslik oson edi va
// "postim qayerda?" degan savol tug'ilardi. Endi ikkalasi ham alohida
// bo'lim.
//
// Halqa (StoryRing) JOYIDA QOLADI — bu uni almashtirmaydi, balki
// ko'rishning ikkinchi, ochiq yo'lini beradi.

// ═══════════════════════════════════════════════════════════════════════
// KATAK HECH QACHON "SHUNCHAKI QORA" BO'LMASLIGI KERAK
//
// SHIKOYAT. VIP001 da "Stories 7" deb yozilgan, lekin ekranda ikkita
// rasm ko'rinib, qolgan beshta katak bo'm-bo'sh qora turardi.
//
// BIRINCHI URINISH VA U NEGA YETARLI BO'LMADI. Avval har katakka
// holat (`loading → ready | error`) berilgan, media esa `ready`
// bo'lgunicha `opacity:0` bilan YASHIRILGAN edi. Bu yondashuv
// BRAUZER HODISASIGA TAYANARDI: `onLoad` yoki `onError` chiqmasa,
// katak abadiy `loading` da qolardi.
//
// Telefonda esa aynan shunday bo'ladi. So'rov osilib qolsa (sekin
// tarmoq, katta fayl, Android Chrome'ning "Trafikni tejash" rejimi,
// uzilib qolgan ulanish) na `load`, na `error` chiqadi. Natijada:
//   • rasm `opacity:0` bilan ko'rinmas bo'lib qolardi;
//   • ostidagi qatlam esa RASM uchun BO'SH chizilardi — matn faqat
//     video va xato holatlariga yozilgan edi.
// Ikkalasi qo'shilib, yana o'sha qop-qora katak chiqardi — bu safar
// hech qanday izohsiz. Buni brauzerda media so'rovini ataylab osib
// qo'yib takrorlash mumkin: 7 katakdan 7 tasi bo'm-bo'sh.
//
// HOZIRGI YECHIM — HODISAGA TAYANMAYDI.
//   1) Ostida HAR DOIM ma'noli qatlam turadi: "Rasm", "▶ Video" yoki
//      "⚠ Media ochilmadi". U holatdan qat'i nazar chiziladi, ya'ni
//      hech qachon bo'sh bo'lmaydi.
//   2) RASM yashirilmaydi. `<img>` da ma'lumot bo'lmasa u shaffof
//      bo'ladi va ostidagi qatlam ko'rinadi; ma'lumot kelsa —
//      o'zi ustini yopadi. Hodisa chiqdi-chiqmadi — ahamiyati yo'q.
//   3) VIDEO esa kadr kelgunicha yopiq turadi: bo'sh `<video>` ba'zi
//      brauzerlarda QORA to'rtburchak chizadi va ostidagi yozuvni
//      bosib qo'yardi. Lekin bu xavfsiz, chunki uning ostidagi
//      qatlamda "▶ Video" doim yozilgan turadi.
//   4) Kadr borligi IKKI yo'l bilan aniqlanadi: `onLoadedData`
//      hodisasi va elementning O'ZIDAN o'qish (`readyState`) —
//      hodisa o'tkazib yuborilsa ham holat to'g'ri bo'ladi.
//   5) `loading="lazy"` olib tashlandi: lentada ko'pi bilan 10 ta
//      katak bor, lekin kechiktirilgan rasm ham "hodisa chiqmaydi"
//      holatining yana bir sababi edi.
//
// Ya'ni endi bo'sh katak TUZILISH JIHATIDAN mumkin emas: ustida
// media bo'lmasa, ostidagi nomlangan qatlam ko'rinadi.
// ═══════════════════════════════════════════════════════════════════════

function StoryCell({ story, onOpen }) {
  const { t } = useLanguage();
  const kind = storyMediaKind(story);
  const src = storyMediaUrl(story);
  const isVideo = kind === 'video';

  // `failed` — media ochilmadi (404, buzuq fayl, qo'llab-quvvatlanmagan
  // kodek). `hasFrame` — FAQAT video uchun: birinchi kadr keldimi.
  const [failed, setFailed] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);

  const fail = (reason) => {
    setFailed(true);
    // Sabab KONSOLGA ham: ekranda odam uchun qisqa jumla, bu yerda
    // esa aynan qaysi story va qaysi havola ekani.
    console.warn('[story] media ochilmadi', { id: story.id, kind, url: src, reason });
  };

  // Element DOM ga tushgan zahoti holatini O'ZIDAN so'raymiz. Kesh dan
  // kelgan media React hodisani ulagunicha tayyor bo'lishi mumkin —
  // o'shanda `onLoadedData` umuman chiqmaydi.
  const videoRef = useCallback((el) => {
    if (!el) return;
    if (el.readyState >= 2) setHasFrame(true);
    if (el.error) fail('video_load_failed');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const broken = kind === 'none' || failed;
  const label = broken ? t('Media ochilmadi') : isVideo ? t('Video') : t('Rasm');
  const mark = broken ? '⚠' : isVideo ? '▶' : '▣';

  return (
    <button type="button" className="pf-story-cell" onClick={onOpen}>
      {/* ENG OSTKI QATLAM — har doim, har holatda, matni bilan. */}
      <span className={`pf-story-ph ${broken ? 'is-err' : ''}`} aria-hidden="true">
        <b>{mark}</b><i>{label}</i>
      </span>

      {!broken && (isVideo
        ? (
          <video
            ref={videoRef}
            className="pf-story-media"
            // `#t=0.1` — media fragmenti: brauzer 0.1-soniyaga o'tib,
            // O'SHA kadrni chizadi. `poster` rasmi bizda yo'q, bu esa
            // ayni shu ishni faylning o'zidan, qo'shimcha so'rovsiz
            // qiladi (izohi src/lib/story-media.js da).
            src={videoPosterSrc(src)}
            muted playsInline preload="metadata"
            onLoadedData={() => setHasFrame(true)}
            onError={() => fail('video_load_failed')}
            // Kadrsiz `<video>` qora chizishi mumkin — ostidagi
            // yozuvni bosib qo'ymasin.
            style={{ opacity: hasFrame ? 1 : 0 }}
          />
        )
        : (
          <img
            className="pf-story-media"
            src={src}
            alt={story.caption || ''}
            decoding="async"
            onError={() => fail('image_load_failed')}
          />
        ))}

      {/* Video ekani BOSISHDAN OLDIN bilinsin — kadr kelgan-kelmaganidan
          qat'i nazar. */}
      {isVideo && !broken && <span className="pf-story-play" aria-hidden="true">{'▶'}</span>}
      {story.likeCount > 0 && <em>{'❤'} {story.likeCount}</em>}
    </button>
  );
}

export default function StoryGrid({ stories = [], title = '', avatarUrl = '', canDelete = false, onDelete }) {
  const { t } = useLanguage();
  const [openAt, setOpenAt] = useState(null);
  const list = Array.isArray(stories) ? stories.filter(Boolean) : [];

  if (!list.length) {
    return <div className="pf-empty">{t('Hozircha lenta bo‘sh — 24 soatlik story shu yerda chiqadi.')}</div>;
  }

  return (
    <>
      <div className="pf-story-grid">
        {list.map((s, i) => (
          <StoryCell key={s.id} story={s} onOpen={() => setOpenAt(i)} />
        ))}
      </div>
      {openAt !== null && (
        <StoryViewer
          stories={list} title={title} avatarUrl={avatarUrl}
          startIndex={openAt}
          canDelete={canDelete} onDelete={onDelete}
          onClose={() => setOpenAt(null)}
        />
      )}
    </>
  );
}
