import { useState } from 'react';
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
// NEGA HAR KATAK O'Z HOLATINI YURITADI
//
// SHIKOYAT. VIP001 profilida "Stories 7" deb yozilardi, lekin ekranda
// bitta rasm ko'rinib, qolgan olti katak QOP-QORA turardi.
//
// SABAB — ROSTAKAM, CSS EMAS. Katak ichida ikki xil media bo'ladi:
//
//   1) VIDEO. Ilgari u shunchaki `<video preload="metadata">` edi,
//      `poster` ESA YO'Q EDI. `preload="metadata"` brauzerga "faqat
//      uzunligi va o'lchamini ol, KADR OLMA" deydi. Ya'ni element
//      chizilgan, lekin ichida ko'rsatadigan pikselning O'ZI yo'q —
//      natija qop-qora to'rtburchak. Android Chrome'dagi "Trafikni
//      tejash" yoki `Save-Data` yoqilgan bo'lsa, u metama'lumotni ham
//      olmaydi va qorayish 100% bo'ladi. Shuning uchun aynan VIDEO
//      istoryalar qorayib, RASM istorya ko'rinib turgan.
//
//   2) MEDIA OCHILMASA. `<img>` da `onError` umuman yo'q edi. Fayl
//      404 bo'lsa (R2 dan o'chib ketgan, eski havola) yoki buzuq
//      bo'lsa, rasm JIM YIQILARDI: katak fonining rangi ko'rinardi —
//      u ham qora. Ya'ni "video kadr olmadi" bilan "fayl yo'q" ekranda
//      BIR XIL ko'rinardi va shuning uchun sababni aniqlab bo'lmasdi.
//
// YECHIM. Har katak o'z holatini biladi: `loading` → `ready` | `error`.
//   • Media haqiqatan piksel chizgunicha (`onLoad` / `onLoadedData`)
//     u SHAFFOF turadi — ya'ni bo'sh `<video>` ning qora qutisi
//     hech qachon ustni qoplamaydi.
//   • Ostida esa har doim MA'NOLI qatlam turadi: video uchun "Video"
//     yozuvi va ▶ belgisi, xato uchun ochiq "Media ochilmadi".
//   • Xato konsolga SABABI bilan yoziladi (id, tur, havola) — endi
//     productionda nima buzilganini ekranning o'zidan ham, konsoldan
//     ham o'qish mumkin.
//
// Ya'ni katak endi HECH QACHON "shunchaki qora" bo'lmaydi: yo media,
// yo nomlangan video kartasi, yo ochiq xato holati.
// ═══════════════════════════════════════════════════════════════════════

function StoryCell({ story, index, onOpen }) {
  const { t } = useLanguage();
  const [state, setState] = useState('loading');   // loading | ready | error
  const kind = storyMediaKind(story);
  const isVideo = kind === 'video';
  const src = storyMediaUrl(story);

  // Hech qanday media yo'q qator — bu ma'lumotlar xatosi, uni ham
  // ko'rsatib qo'yamiz (jim qora katak qoldirmaymiz).
  const missing = kind === 'none';

  const fail = (reason) => {
    setState('error');
    // Sabab KONSOLGA ham: ekranda "ochilmadi" deyiladi, bu yerda esa
    // aynan qaysi story va qaysi havola ekani turadi.
    console.warn('[story] media ochilmadi', {
      id: story.id, kind, url: src, reason,
    });
  };

  const shown = missing ? 'error' : state;

  return (
    <button type="button" className="pf-story-cell" onClick={onOpen}>
      {/* ORQA QATLAM — media chizilgunicha (yoki umuman chizilmasa)
          ko'rinadigan MA'NOLI fon. */}
      {shown !== 'ready' && (
        <span className={`pf-story-ph ${shown === 'error' ? 'is-err' : ''}`} aria-hidden="true">
          {shown === 'error'
            ? <><b>{'⚠'}</b><i>{t('Media ochilmadi')}</i></>
            : isVideo && <><b>{'▶'}</b><i>{t('Video')}</i></>}
        </span>
      )}

      {!missing && shown !== 'error' && (isVideo
        ? (
          <video
            src={videoPosterSrc(src)}
            muted playsInline preload="metadata"
            // `onLoadedData` — BIRINCHI KADR tayyor bo'lgan payt.
            // Aynan shunda ochamiz: undan oldin element bo'm-bo'sh va
            // ochilsa qora bo'lib ko'rinardi.
            onLoadedData={() => setState('ready')}
            onError={() => fail('video_load_failed')}
            style={{ opacity: state === 'ready' ? 1 : 0 }}
          />
        )
        : (
          <img
            src={src}
            alt={story.caption || ''}
            // Birinchi ikki qator DARHOL yuklansin: "lazy" ular uchun
            // hech narsa tejamaydi (ular ekranda), lekin kechikish
            // berardi. Qolgani — odatdagidek kerak bo'lganda.
            loading={index < 6 ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={() => setState('ready')}
            onError={() => fail('image_load_failed')}
            style={{ opacity: state === 'ready' ? 1 : 0 }}
          />
        ))}

      {/* ▶ — media ko'ringandan KEYIN ham turadi: katak video ekani
          bosishdan oldin bilinsin. */}
      {isVideo && shown === 'ready' && <span className="pf-story-play" aria-hidden="true">{'▶'}</span>}
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
          <StoryCell key={s.id} story={s} index={i} onOpen={() => setOpenAt(i)} />
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
