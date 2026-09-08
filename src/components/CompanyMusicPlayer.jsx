import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../lib/i18n.jsx';

// Kompaniya sahifasidagi musiqa pleeri.
//
// EKRAN O'CHGANDA HAM CHALADI: MediaSession orqali tizimga trek nomi,
// rasm va boshqaruv tugmalari beriladi — shunda Android/iOS uni musiqa
// ilovasidek qabul qiladi va fonda to'xtatmaydi, qulf ekranida esa
// Play/Pauza/keyingi tugmalari chiqadi. Shaxsiy profildagi bilan aynan
// bir xil yechim (ProfilePage MusicPlayer).
//
// Faqat O'ZIMIZNING fayllar uchun — kompaniya musiqasi fayldan
// yuklanadi, YouTube havolasi bu yerda umuman qabul qilinmaydi.
export default function CompanyMusicPlayer({ tracks = [], companyName = '', coverUrl = '' }) {
  const { t } = useLanguage();
  const audioRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const list = Array.isArray(tracks) ? tracks.filter(Boolean).slice(0, 5) : [];

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else el.play().then(() => setPlaying(true)).catch(() => {});
  };
  const go = (delta) => {
    if (list.length < 2) return;
    setIndex((i) => (i + delta + list.length) % list.length);
  };

  // Trek almashganda ijroni davom ettirish.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !playing) return;
    el.play().catch(() => setPlaying(false));
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  // MediaSession — fon ijrosi va qulf ekranidagi boshqaruv.
  useEffect(() => {
    if (!list.length) return undefined;
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return undefined;
    const ms = navigator.mediaSession;
    try {
      ms.metadata = new window.MediaMetadata({
        title: `${t('Musiqa')} ${index + 1}`,
        artist: companyName || 'NFCSTORE',
        album: 'NFCSTORE',
        artwork: [{ src: coverUrl || '/logo-512.png', sizes: '512x512', type: 'image/png' }],
      });
    } catch { /* eski brauzer */ }
    const handlers = [
      ['play', () => { const a = audioRef.current; if (a) a.play().then(() => setPlaying(true)).catch(() => {}); }],
      ['pause', () => { const a = audioRef.current; if (a) { a.pause(); setPlaying(false); } }],
      ['previoustrack', list.length > 1 ? () => go(-1) : null],
      ['nexttrack', list.length > 1 ? () => go(1) : null],
    ];
    for (const [name, fn] of handlers) {
      try { ms.setActionHandler(name, fn); } catch { /* qo'llab-quvvatlanmaydi */ }
    }
    return () => { for (const [name] of handlers) { try { ms.setActionHandler(name, null); } catch { /* ignore */ } } };
    // `index` ham bog'liqlikda: busiz qulf ekranidagi "keyingi" tugmasi
    // eski trek raqamini eslab qolardi.
  }, [list.length, index, companyName, coverUrl, t]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try { navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'; } catch { /* ignore */ }
  }, [playing]);

  if (!list.length) return null;

  return (
    <div className="cp-music">
      <audio
        ref={audioRef}
        src={list[index]}
        preload="none"
        onEnded={() => { if (index < list.length - 1) go(1); else setPlaying(false); }}
      />
      <button type="button" className="cp-music-play" onClick={toggle} aria-label={playing ? t('Pauza') : t('Ijro etish')}>
        {playing ? '❚❚' : '▶'}
      </button>
      <div className="cp-music-info">
        <b>{companyName || t('Musiqa')}</b>
        <small>{list.length > 1 ? t('{n} / {total}', { n: index + 1, total: list.length }) : t('Musiqa')}</small>
      </div>
      {list.length > 1 && (
        <div className="cp-music-nav">
          <button type="button" onClick={() => go(-1)} aria-label={t('Oldingi')}>‹</button>
          <button type="button" onClick={() => go(1)} aria-label={t('Keyingi')}>›</button>
        </div>
      )}
    </div>
  );
}
