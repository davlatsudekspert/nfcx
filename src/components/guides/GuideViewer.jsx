import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../lib/i18n.jsx';
import { GUIDE_CATEGORIES, guideDurationLabel } from '../../lib/guides.js';
import GuideFrame from './GuideFrame.jsx';

// Interaktiv "guide player" — bosqichma-bosqich animatsion namoyish.
// Frame modeli (src/lib/guides.js): image, caption, durationMs, cursorX,
// cursorY, clickEffect, highlight, zoomTarget, sortOrder. Bu komponent
// faqat shu ma'lumotlarni o'qiydi — hech qanday tarmoq so'rovi yubormaydi,
// hech narsani saqlamaydi.
export default function GuideViewer({ guide, onClose }) {
  const { t } = useLanguage();
  const frames = guide.frames || [];
  const hasFrames = frames.length > 0;
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const boxRef = useRef(null);
  const timerRef = useRef(null);

  const catLabel = GUIDE_CATEGORIES.find((c) => c.id === guide.category)?.label || guide.category;
  const frame = frames[i];

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (hasFrames && e.key === 'ArrowRight') next();
      else if (hasFrames && e.key === 'ArrowLeft') prev();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, frames.length]);

  useEffect(() => {
    if (!playing || !hasFrames) return undefined;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setI((cur) => {
        if (cur >= frames.length - 1) { setPlaying(false); return cur; }
        return cur + 1;
      });
    }, frame?.durationMs || 2200);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, i, frames.length]);

  const next = () => { setI((cur) => Math.min(cur + 1, frames.length - 1)); };
  const prev = () => { setI((cur) => Math.max(cur - 1, 0)); };
  const restart = () => { setI(0); setPlaying(true); };
  const togglePlay = () => {
    if (!hasFrames) return;
    if (i >= frames.length - 1) { setI(0); setPlaying(true); return; }
    setPlaying((p) => !p);
  };
  const goFullscreen = () => {
    try { boxRef.current?.requestFullscreen?.(); } catch { /* fullscreen taqiqlangan bo'lishi mumkin — jim o'tamiz */ }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={boxRef} className="qollanma-player my-8 w-full max-w-xl rounded-2xl border border-white/10 bg-base-200 p-5 shadow-2xl sm:my-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] text-base-content/45">
              <span className="rounded-full border border-white/10 px-2 py-0.5 uppercase tracking-wide">{t(catLabel)}</span>
              <span>·</span>
              <span>{'⏱️'} {t(guideDurationLabel(guide.durationMin))}</span>
            </div>
            <h3 className="mt-1.5 text-lg font-bold leading-snug">{t(guide.title)}</h3>
          </div>
          <button className="btn btn-ghost btn-xs shrink-0" onClick={onClose} aria-label="close">&times;</button>
        </div>

        {hasFrames ? (
          <>
            <div className="mt-4 flex items-center justify-between text-[11px] text-base-content/40">
              {frame.kind === 'mock' ? (
                <span className="rounded-full border border-white/15 px-2 py-0.5 font-semibold uppercase tracking-wide text-base-content/45">{t('Demo')}</span>
              ) : <span />}
              <span>{i + 1} / {frames.length}</span>
            </div>
            <GuideFrame frame={frame} className="mt-1" />
            <p className="mt-3 min-h-[2.5em] text-sm leading-relaxed text-base-content/75">{t(frame.caption)}</p>

            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${((i + 1) / frames.length) * 100}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-center gap-1.5">
              {frames.map((f, idx) => (
                <span
                  key={f.sortOrder}
                  className={`h-1.5 w-1.5 rounded-full transition ${idx === i ? 'bg-accent' : 'bg-white/20'}`}
                />
              ))}
            </div>

            <div className="mt-4 flex items-center justify-center gap-2">
              <button className="btn btn-ghost btn-sm btn-square" onClick={prev} disabled={i === 0} title={t('Oldingi')} aria-label={t('Oldingi')}>{'⏮'}</button>
              <button className="btn btn-sm btn-circle bg-accent text-accent-content hover:bg-accent/80" onClick={togglePlay} title={playing ? t('Pauza') : t('Ijro')} aria-label={playing ? t('Pauza') : t('Ijro')}>
                {playing ? '⏸' : '▶'}
              </button>
              <button className="btn btn-ghost btn-sm btn-square" onClick={next} disabled={i === frames.length - 1} title={t('Keyingi')} aria-label={t('Keyingi')}>{'⏭'}</button>
              <button className="btn btn-ghost btn-sm btn-square" onClick={restart} title={t('Qaytadan boshlash')} aria-label={t('Qaytadan boshlash')}>{'↺'}</button>
              <button className="btn btn-ghost btn-sm btn-square" onClick={goFullscreen} title={t("To'liq ekran")} aria-label={t("To'liq ekran")}>{'⛶'}</button>
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-base-100/40 p-8 text-center">
            <p className="text-sm text-base-content/60">{t(guide.description)}</p>
            <p className="mt-3 text-xs text-base-content/35">{t('Bu darsning interaktiv namoyishi tez orada qo‘shiladi.')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
