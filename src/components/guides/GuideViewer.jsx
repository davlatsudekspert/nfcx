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
      <div ref={boxRef} className="qollanma-player my-8 w-full max-w-2xl rounded-2xl border border-white/10 bg-base-200 p-5 shadow-2xl sm:my-0 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-base-content/50">
              <span className="flex h-8 items-center rounded-full border border-white/15 px-3.5 font-bold uppercase tracking-wide">{t(catLabel)}</span>
              <span className="flex h-8 items-center gap-1.5 rounded-full border border-white/10 px-3.5">
                <span className="text-base leading-none">{'⏱️'}</span> {t(guideDurationLabel(guide.durationMin))}
              </span>
            </div>
            <h3 className="mt-2 text-lg font-bold leading-snug sm:text-xl">{t(guide.title)}</h3>
          </div>
          <button className="btn btn-ghost btn-square h-10 w-10 shrink-0 text-2xl" onClick={onClose} aria-label="close">&times;</button>
        </div>

        {hasFrames ? (
          <>
            <div className="mt-4 flex items-center justify-between text-xs text-base-content/45">
              <span className="flex items-center gap-2">
                {frame.kind === 'mock' && (
                  <span className="flex h-8 items-center rounded-full border border-white/15 px-3.5 font-bold uppercase tracking-wide text-base-content/50">{t('Demo')}</span>
                )}
                {frame.section && (
                  <span className="flex h-8 items-center rounded-full bg-accent/10 px-3.5 font-bold text-accent">{t(frame.section)}</span>
                )}
              </span>
              <span className="font-semibold">{i + 1} / {frames.length}</span>
            </div>
            <GuideFrame frame={frame} className="mt-2" />
            <p className="mt-3 min-h-[2.5em] text-[15px] leading-relaxed text-base-content/75">{t(frame.caption)}</p>

            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${((i + 1) / frames.length) * 100}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {frames.map((f, idx) => (
                <button
                  key={f.sortOrder}
                  type="button"
                  onClick={() => { setPlaying(false); setI(idx); }}
                  aria-label={`${idx + 1}`}
                  className={`h-2.5 w-2.5 shrink-0 rounded-full transition ${idx === i ? 'bg-accent' : 'bg-white/20 hover:bg-white/40'}`}
                />
              ))}
            </div>

            <div className="mt-5 flex items-center justify-center gap-2 sm:gap-3">
              <button className="btn btn-ghost btn-square h-12 w-12 text-2xl" onClick={prev} disabled={i === 0} title={t('Oldingi')} aria-label={t('Oldingi')}>{'⏮'}</button>
              <button className="btn btn-circle h-14 w-14 bg-accent text-2xl text-accent-content hover:bg-accent/80" onClick={togglePlay} title={playing ? t('Pauza') : t('Ijro')} aria-label={playing ? t('Pauza') : t('Ijro')}>
                {playing ? '⏸' : '▶'}
              </button>
              <button className="btn btn-ghost btn-square h-12 w-12 text-2xl" onClick={next} disabled={i === frames.length - 1} title={t('Keyingi')} aria-label={t('Keyingi')}>{'⏭'}</button>
              <button className="btn btn-ghost btn-square h-12 w-12 text-2xl" onClick={restart} title={t('Qaytadan boshlash')} aria-label={t('Qaytadan boshlash')}>{'↺'}</button>
              <button className="btn btn-ghost btn-square h-12 w-12 text-2xl" onClick={goFullscreen} title={t("To'liq ekran")} aria-label={t("To'liq ekran")}>{'⛶'}</button>
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
