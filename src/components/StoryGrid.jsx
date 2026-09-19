import { useState } from 'react';
import StoryViewer from './StoryViewer.jsx';
import { useLanguage } from '../lib/i18n.jsx';
import { mediaKind } from '../lib/media.js';
import MediaThumb from './MediaThumb.jsx';

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

// LENTA KATAGI HECH QACHON BO'M-BO'SH QOLMAYDI.
//
// Shikoyat: VIP001 da "Stories 9" deb turardi, lekin ikkita katakda
// media ko'rinib, qolgan yettitasi qop-qora edi. Sabab har katak
// o'zicha `<img>`/`<video>` chizib, "media kelmasa nima ko'rsatamiz?"
// degan savolga javob bermagani edi.
//
// Endi bu ish `MediaThumb` ga topshirilgan — sayt bo'yicha YAGONA
// media oynachasi. Bo'sh katak chiqmasligining kafolati va uning
// to'liq izohi o'sha faylda (src/components/MediaThumb.jsx).
function StoryCell({ story, onOpen }) {
  const kind = mediaKind(story);
  return (
    <button type="button" className="pf-story-cell" onClick={onOpen}>
      {/* Media oynachasi — sayt bo'yicha YAGONA komponent
          (src/components/MediaThumb.jsx). Bo'sh katak chiqmasligi
          kafolati o'sha yerda, shuning uchun lenta ham, post ham,
          boshqa joylar ham bir xil ishlaydi. */}
      <MediaThumb item={story} alt={story.caption || ''} fit="cover" />

      {/* Katta ▶ — faqat kadr CHIZILGANDA. Kadr yo'q bo'lsa ostidagi
          qatlamda allaqachon "▶ Video" yozilgan turadi va ikkita
          belgi bir-birining ustiga tushib chalkashtirardi. Buni CSS
          hal qiladi (`[data-media-state="ok"] ~ .pf-story-play`),
          shuning uchun bu yerda holatni ko'chirib yurish shart emas. */}
      {kind === 'video' && <span className="pf-story-play" aria-hidden="true">{'▶'}</span>}
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
