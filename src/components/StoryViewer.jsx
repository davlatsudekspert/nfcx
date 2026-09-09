import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { dbToggleStoryLike } from '../lib/db.js';
import { navigate } from '../lib/router.js';
import { useAuth } from '../lib/auth.jsx';
import { useLanguage } from '../lib/i18n.jsx';

// Rasm uchun ko'rsatish vaqti. Video o'z uzunligicha o'ynaydi.
const IMAGE_MS = 5000;

// Istoryani to'liq ekranda ko'rish.
//
// YUQORIDAGI CHIZIQ — Instagram'dagi kabi. U CSS animatsiyasi EMAS,
// haqiqiy holatdan chiziladi:
//   • rasm  — vaqt bo'yicha (requestAnimationFrame);
//   • video — videoning O'Z vaqtidan (`timeupdate`).
// Shuning uchun chiziq video bilan TENG boshlanadi va TENG tugaydi;
// video sekin yuklansa yoki pauza qilinsa, chiziq ham to'xtaydi.
// CSS animatsiyasida bu mumkin emas edi: u videoning uzunligini ham,
// bufer kutishini ham bilmaydi va bir-biridan ajralib ketardi.
export default function StoryViewer({ stories = [], title = '', avatarUrl = '', canDelete = false, onDelete, onClose }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [likes, setLikes] = useState({});   // { [storyId]: { liked, likeCount } }
  const videoRef = useRef(null);
  const rafRef = useRef(0);

  const list = Array.isArray(stories) ? stories.filter(Boolean) : [];
  const current = list[index];

  const go = useCallback((delta) => {
    setProgress(0);
    setIndex((i) => {
      const next = i + delta;
      if (next < 0) return 0;
      if (next >= list.length) { onClose(); return i; }
      return next;
    });
  }, [list.length, onClose]);

  // ── RASM: vaqt bo'yicha ────────────────────────────────────────────
  useEffect(() => {
    if (!current || current.videoUrl) return undefined;
    if (paused) return undefined;
    const started = Date.now() - progress * IMAGE_MS;
    const tick = () => {
      const p = Math.min(1, (Date.now() - started) / IMAGE_MS);
      setProgress(p);
      if (p >= 1) { go(1); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // `progress` ATAYLAB bog'liqlikda emas: har kadrda effekt qayta
    // ishga tushib, cheksiz halqa hosil bo'lardi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, paused, current?.videoUrl, go]);

  // ── VIDEO: pauza/davom ─────────────────────────────────────────────
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (paused) el.pause();
    else el.play().catch(() => {});
  }, [paused, index]);

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
  }, [go, onClose]);

  if (!current) return null;

  const like = likes[current.id] || { liked: !!current.liked, likeCount: Number(current.likeCount || 0) };

  const toggleLike = async () => {
    if (!user) { onClose(); navigate('/login'); return; }
    // Darhol ko'rsatamiz — tarmoq javobini kutib turish sekin tuyuladi.
    const next = { liked: !like.liked, likeCount: like.likeCount + (like.liked ? -1 : 1) };
    setLikes((m) => ({ ...m, [current.id]: next }));
    try {
      const res = await dbToggleStoryLike(current.id);
      setLikes((m) => ({ ...m, [current.id]: { liked: res.liked, likeCount: res.likeCount } }));
    } catch {
      setLikes((m) => ({ ...m, [current.id]: like })); // xato bo'lsa qaytaramiz
    }
  };

  const view = (
    <div className="sv-back" role="dialog" aria-modal="true">
      <div className="sv-bars">
        {list.map((s, i) => (
          <i key={s.id} className={i < index ? 'done' : ''}>
            {i === index && <span style={{ width: `${Math.round(progress * 100)}%` }} />}
          </i>
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
          ? (
            <video
              ref={videoRef} src={current.videoUrl} autoPlay playsInline controls={false}
              onTimeUpdate={(e) => {
                const el = e.currentTarget;
                if (el.duration > 0) setProgress(Math.min(1, el.currentTime / el.duration));
              }}
              onEnded={() => go(1)}
            />
          )
          : <img src={current.imageUrl} alt={current.caption || ''} />}
      </div>

      {current.caption && <p className="sv-caption">{current.caption}</p>}

      {/* Bosish sohalari media USTIDA — chapga/o'ngga o'tish. */}
      <button type="button" className="sv-nav left" onClick={() => go(-1)} aria-label={t('Oldingi')} />
      <button type="button" className="sv-nav right" onClick={() => go(1)} aria-label={t('Keyingi')} />

      <div className="sv-actions">
        <button
          type="button" className={`sv-like ${like.liked ? 'is-on' : ''}`}
          onClick={toggleLike} aria-pressed={like.liked} aria-label={t('Yoqdi')}
        >
          <span>{like.liked ? '❤️' : '🤍'}</span>
          {like.likeCount > 0 && <b>{like.likeCount}</b>}
        </button>
        <button type="button" className="sv-back-btn" onClick={onClose}>
          ‹ {t('Profilga qaytish')}
        </button>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return view;
  return createPortal(view, document.body);
}
