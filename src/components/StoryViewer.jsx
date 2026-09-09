import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../lib/i18n.jsx';

const STEP_MS = 5000;

// Istoryani to'liq ekranda ko'rish: yuqorida progress chiziqlari,
// o'ngga/chapga bosib o'tish, oxiriga yetganda yopiladi.
//
// Video o'z uzunligicha o'ynaydi (5 soniyada uzilib qolmasin), rasm esa
// 5 soniya turadi.
export default function StoryViewer({ stories = [], title = '', avatarUrl = '', canDelete = false, onDelete, onClose }) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);
  const list = Array.isArray(stories) ? stories.filter(Boolean) : [];
  const current = list[index];

  const go = (delta) => {
    setIndex((i) => {
      const next = i + delta;
      if (next < 0) return 0;
      if (next >= list.length) { onClose(); return i; }
      return next;
    });
  };

  useEffect(() => {
    if (!current || paused || current.videoUrl) return undefined;
    timerRef.current = setTimeout(() => go(1), STEP_MS);
    return () => clearTimeout(timerRef.current);
  }, [index, paused, current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape bilan yopish + orqa fon scroll qilmasin.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) return null;

  return (
    <div className="sv-back" role="dialog" aria-modal="true">
      <div className="sv-bars">
        {list.map((s, i) => (
          <i key={s.id} className={i < index ? 'done' : i === index ? 'active' : ''}
            style={i === index && !current.videoUrl && !paused ? { animationDuration: `${STEP_MS}ms` } : undefined} />
        ))}
      </div>

      <div className="sv-top">
        <div className="sv-who">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{(title || 'N').slice(0, 1).toUpperCase()}</span>}
          <b>{title}</b>
        </div>
        <div className="sv-top-actions">
          {canDelete && <button type="button" onClick={() => onDelete?.(current.id)} aria-label={t('O‘chirish')}>🗑</button>}
          <button type="button" onClick={onClose} aria-label={t('Yopish')}>✕</button>
        </div>
      </div>

      <div className="sv-media"
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerCancel={() => setPaused(false)}
      >
        {current.videoUrl
          ? <video src={current.videoUrl} autoPlay playsInline controls={false} onEnded={() => go(1)} />
          : <img src={current.imageUrl} alt={current.caption || ''} />}
      </div>

      {current.caption && <p className="sv-caption">{current.caption}</p>}

      {/* Bosish sohalari media USTIDA — chapga/o'ngga o'tish. */}
      <button type="button" className="sv-nav left" onClick={() => go(-1)} aria-label={t('Oldingi')} />
      <button type="button" className="sv-nav right" onClick={() => go(1)} aria-label={t('Keyingi')} />
    </div>
  );
}
