import { useState } from 'react';
import StoryViewer from './StoryViewer.jsx';
import { useLanguage } from '../lib/i18n.jsx';

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
export default function StoryGrid({ stories = [], title = '', avatarUrl = '', canDelete = false, onDelete }) {
  const { t } = useLanguage();
  const [openAt, setOpenAt] = useState(null);
  const list = Array.isArray(stories) ? stories.filter(Boolean) : [];

  if (!list.length) {
    return <div className="pf-empty">{t('Hozircha lenta bo‘sh — 24 soatlik istorya shu yerda chiqadi.')}</div>;
  }

  return (
    <>
      <div className="pf-story-grid">
        {list.map((s, i) => (
          <button key={s.id} type="button" className="pf-story-cell" onClick={() => setOpenAt(i)}>
            {s.videoUrl
              // `preload="metadata"` — birinchi kadr ko'rinsin, lekin
              // butun video yuklanmasin (lentada 10 tagacha bo'lishi
              // mumkin va hammasi birdan yuklansa trafik ketardi).
              ? <video src={s.videoUrl} muted playsInline preload="metadata" />
              : <img src={s.imageUrl} alt={s.caption || ''} loading="lazy" />}
            {s.videoUrl && <span className="pf-story-play" aria-hidden="true">▶</span>}
            {s.likeCount > 0 && <em>{'❤'} {s.likeCount}</em>}
          </button>
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
