import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../lib/i18n.jsx';
import { GUIDE_CATEGORIES, guideDurationLabel } from '../../lib/guides.js';
import GuideFrame from './GuideFrame.jsx';

// Interaktiv "guide player" — bosqichma-bosqich animatsion namoyish.
// Frame modeli (src/lib/guides.js): image, caption, durationMs, cursorX,
// cursorY, clickEffect, highlight, zoomTarget, sortOrder. Bu komponent
// faqat shu ma'lumotlarni o'qiydi — hech qanday tarmoq so'rovi yubormaydi,
// hech narsani saqlamaydi.
//
// Resize/fullscreen tuzatish (bu fayl bo'yicha regression fix):
//   - Modal endi flex-col: header + o'sib-qisqaruvchi scroll qism (rasm/
//     caption/progress-dots) + PASTGA MAHKAMLANGAN (sticky) boshqaruv
//     paneli. Shu tufayli boshqaruv tugmalari HECH QACHON (oddiy va
//     fullscreen rejimida ham) yashirinib qolmaydi — ular flex-footer
//     bo'lib, agar kontent balandlik yetmasa faqat o'rtadagi qism scroll
//     bo'ladi, footer joyidan siljimaydi.
//   - Desktop'da pastki-o'ng burchakdan pointer bilan tortib resize qilish
//     mumkin (mobil/tablet'da yashirin — ular allaqachon responsive).
//   - `⛶` tugmasi endi ENTER/EXIT fullscreen'ni almashtiradi (toggle).
//   - Fullscreen paytida Escape avval brauzerning o'z fullscreen'dan
//     chiqishiga beriladi — modal shu bosishda ham yopilib ketmaydi.
//
// Frame responsive-scale tuzatish (ikkinchi round — real qurilmada
// topilgan xato):
//   - AVVALGI fix (frame ustunini `max-w-3xl`ga qattiq cheklash) fullscreen
//     ochilganda frame kichik/yuqorida qolib, pastda katta bo'sh qora joy
//     qoldirar edi — chunki kenglik FIXED edi, box qancha kattalashsa ham
//     frame o'smasdi.
//   - TO'G'RI YECHIM: frame o'lchami faqat box haqiqatan ANIQ balandlikka
//     ega bo'lgan holatlarda (fullscreen — h-screen, yoki qo'lda resize —
//     inline style.height) ResizeObserver orqali o'lchanadi va
//     `width = min(mavjud_kenglik, mavjud_balandlik * nisbat)` formulasi
//     bilan hisoblanadi (video-pleyer "letterbox" mantig'i) — shu tufayli
//     box kattalashsa/kichraysa frame HAM proporsional o'sadi/kichrayadi,
//     nisbat (aspect ratio) hech qachon buzilmaydi va viewportdan chiqib
//     ketmaydi.
//   - Standart (kompakt, hali resize qilinmagan, fullscreen'siz) holatda
//     box ANIQ balandlikka ega EMAS (tabiiy kontent balandligi) — bu holda
//     ResizeObserver mantiqiy natija bermaydi (balandlik hali "auto"), shu
//     sabab bu holatda ASL sodda yondashuv qaytarilgan: frame shunchaki
//     o'zining `aspect-[16/10] w-full` klassi bilan ustun kengligiga mos
//     chiziladi — bu eski (pre-fix) va allaqachon to'g'ri ishlagan holat.
const MIN_W = 380;
const MIN_H = 420;
const FRAME_RATIO = 16 / 10; // GuideFrame/GuideMockFrame/GuideRealFrame'dagi aspect-[16/10] bilan bir xil bo'lishi shart

export default function GuideViewer({ guide, onClose }) {
  const { t } = useLanguage();
  const frames = guide.frames || [];
  const hasFrames = frames.length > 0;
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [size, setSize] = useState(null); // {w,h} px — faqat desktop qo'lda resize qilgach
  const [frameSize, setFrameSize] = useState(null); // {w,h} px — faqat fullscreen/resize holatida (ResizeObserver bilan hisoblangan)
  const boxRef = useRef(null);
  const frameAreaRef = useRef(null);
  const timerRef = useRef(null);

  const catLabel = GUIDE_CATEGORIES.find((c) => c.id === guide.category)?.label || guide.category;
  const frame = frames[i];
  // Box ANIQ balandlikka ega bo'lgan holatlar — faqat shu holatlarda frame
  // uchun "mavjud joyni to'ldirish" hisob-kitobi mantiqiy (pastga qarang).
  const boxHasFixedHeight = isFullscreen || !!size;

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(document.fullscreenElement === boxRef.current);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        // Fullscreen ochiq bo'lsa, birinchi Escape faqat undan chiqsin —
        // brauzer buni o'zi bajaradi; modalni endi yopmaymiz.
        if (document.fullscreenElement) return;
        onClose();
      } else if (hasFrames && e.key === 'ArrowRight') next();
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

  // Fullscreen'da yoki qo'lda resize qilinganda frame uchun mavjud joyni
  // (frameAreaRef konteynerining haqiqiy piksel o'lchamini) kuzatib,
  // "kengligi = min(kenglik, balandlik * nisbat)" letterbox formulasi
  // bo'yicha frame o'lchamini qayta hisoblaymiz. ResizeObserver box
  // kattalashtirilganda/kichraytirilganda, fullscreen almashtirilganda va
  // oyna resize qilinganda AVTOMATIK qayta ishga tushadi — alohida
  // effect/dependency kerak emas.
  useEffect(() => {
    if (!hasFrames || !boxHasFixedHeight) { setFrameSize(null); return undefined; }
    const el = frameAreaRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      const fw = Math.min(w, h * FRAME_RATIO);
      setFrameSize({ w: fw, h: fw / FRAME_RATIO });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasFrames, boxHasFixedHeight]);

  const next = () => { setI((cur) => Math.min(cur + 1, frames.length - 1)); };
  const prev = () => { setI((cur) => Math.max(cur - 1, 0)); };
  const restart = () => { setI(0); setPlaying(true); };
  const togglePlay = () => {
    if (!hasFrames) return;
    if (i >= frames.length - 1) { setI(0); setPlaying(true); return; }
    setPlaying((p) => !p);
  };
  const toggleFullscreen = () => {
    try {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else boxRef.current?.requestFullscreen?.();
    } catch { /* fullscreen taqiqlangan bo'lishi mumkin — jim o'tamiz */ }
  };

  // Pastki-o'ng burchakdan pointer bilan tortib o'lchamini o'zgartirish —
  // faqat desktop (fullscreen paytida o'chirilgan, brauzer o'zi to'liq
  // ekranni boshqaradi).
  //
  // Pointer Capture tuzatish (real brauzerda topilgan xato): avval
  // mousemove/mouseup `window`ga osib qo'yilardi — agar foydalanuvchi
  // tez harakat qilib kursor dastakdan chiqib ketsa yoki tugmani boshqa
  // elementning ustida qo'yib yuborsa, drag holati g'alati tugar yoki
  // umuman tugamas edi. Endi dastakning o'ziga `setPointerCapture`
  // qilinadi — shundan keyin pointermove/pointerup/pointercancel FAQAT
  // shu elementga, kursor qayerda bo'lishidan qat'i nazar, kelib turadi;
  // shuning uchun drag har doim tabiiy va barqaror tugaydi.
  const startResize = (e) => {
    if (isFullscreen) return;
    e.preventDefault();
    const box = boxRef.current;
    const handle = e.currentTarget;
    if (!box || !handle) return;
    const startRect = box.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = startRect.width;
    const startH = startRect.height;

    try { handle.setPointerCapture(e.pointerId); } catch { /* eski brauzer — jim o'tamiz */ }

    const onMove = (ev) => {
      // MUHIM: bu yerdagi 0.96/0.92 nisbatlar pastdagi `boxStyle`'dagi
      // CSS `maxWidth: 96vw` / `maxHeight: 92vh` bilan AYNAN bir xil
      // bo'lishi shart — aks holda drag hisoblagan qiymat CSS max-height
      // tomonidan yashirincha kesib tashlanadi va resize "ishlamayotgandek"
      // ko'rinadi (bu yerda topilgan asl xato — oldin 0.94 ishlatilgan edi).
      const maxW = window.innerWidth * 0.96;
      const maxH = window.innerHeight * 0.92;
      const w = Math.min(maxW, Math.max(MIN_W, startW + (ev.clientX - startX)));
      const h = Math.min(maxH, Math.max(MIN_H, startH + (ev.clientY - startY)));
      setSize({ w, h });
    };
    const onUp = (ev) => {
      try { handle.releasePointerCapture(ev.pointerId); } catch { /* jim o'tamiz */ }
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
    // Drag paytida butun sahifa bo'ylab matn belgilanishi ("ghost drag")ni
    // oldini olish va kursor turini saqlash uchun.
    document.body.style.cursor = 'nwse-resize';
    document.body.style.userSelect = 'none';
  };

  // MUHIM: `size` hali o'rnatilmagan bo'lsa (foydalanuvchi hali resize
  // qilmagan, ya'ni standart holat), style umuman qo'yilmaydi — shunda
  // asl ixcham "max-w-2xl" klassi ishlaydi. Aks holda (avval bu yerda
  // maxWidth/maxHeight har doim qo'yilardi) standart modal ham har safar
  // ekranning deyarli to'liq eniga cho'zilib ketardi — bu topilgan
  // regressiya edi.
  const boxStyle = (isFullscreen || !size)
    ? undefined
    : {
        width: `${size.w}px`,
        height: `${size.h}px`,
        maxWidth: '96vw',
        maxHeight: '92vh',
      };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={boxRef}
        style={boxStyle}
        className={`qollanma-player relative my-8 flex w-full max-w-2xl flex-col overflow-hidden border border-white/10 bg-base-200 shadow-2xl sm:my-0 ${isFullscreen ? 'h-screen w-screen max-w-none rounded-none' : 'rounded-2xl'}`}
      >
        {/* ── Scroll bo'ladigan yuqori qism: sarlavha + rasm + caption + progress-dots ── */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {/* `flex h-full min-h-0 flex-col`: box ANIQ balandlikka ega bo'lgan
              holatda (fullscreen/resize) bu ustun ham to'liq balandlikni
              egallaydi va pastdagi frame-maydon `flex-1` bilan qolgan
              bo'sh joyni oladi. Standart (auto-height) holatda `h-full`
              ta'sirsiz — ustun oddiy kontent balandligiga mos chiziladi
              (hech qanday regressiya yo'q). */}
          <div className="flex h-full min-h-0 flex-col">
          <div className="flex shrink-0 items-start justify-between gap-3">
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
              <div className="mt-4 flex shrink-0 items-center justify-between text-xs text-base-content/45">
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

              {boxHasFixedHeight ? (
                // Fullscreen / qo'lda-resize: frame mavjud joyni (kenglik VA
                // balandlik) hisobga olib, nisbatini saqlagan holda iloji
                // boricha kattalashadi — letterbox mantig'i.
                <div ref={frameAreaRef} className="mt-2 flex min-h-0 flex-1 items-center justify-center">
                  <div style={frameSize ? { width: `${frameSize.w}px`, height: `${frameSize.h}px` } : { width: '100%', aspectRatio: '16 / 10' }}>
                    <GuideFrame frame={frame} />
                  </div>
                </div>
              ) : (
                // Standart kompakt holat — asl, o'zgartirilmagan xulq.
                <GuideFrame frame={frame} className="mt-2" />
              )}

              <p className="mt-3 min-h-[2.5em] shrink-0 text-[15px] leading-relaxed text-base-content/75">{t(frame.caption)}</p>

              <div className="mt-3 h-1.5 w-full shrink-0 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-300"
                  style={{ width: `${((i + 1) / frames.length) * 100}%` }}
                />
              </div>
              <div className="mt-3 flex shrink-0 flex-wrap items-center justify-center gap-2">
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
            </>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-base-100/40 p-8 text-center">
              <p className="text-sm text-base-content/60">{t(guide.description)}</p>
              <p className="mt-3 text-xs text-base-content/35">{t('Bu darsning interaktiv namoyishi tez orada qo‘shiladi.')}</p>
            </div>
          )}
          </div>
        </div>

        {/* ── Pastga mahkamlangan (sticky) boshqaruv paneli — oddiy va fullscreen rejimida ham doim ko'rinadi ── */}
        {hasFrames && (
          <div className="flex shrink-0 items-center justify-center gap-2 border-t border-white/10 bg-base-200 p-4 sm:gap-3">
            <button className="btn btn-ghost btn-square h-12 w-12 text-2xl" onClick={prev} disabled={i === 0} title={t('Oldingi')} aria-label={t('Oldingi')}>{'⏮'}</button>
            <button className="btn btn-circle h-14 w-14 bg-accent text-2xl text-accent-content hover:bg-accent/80" onClick={togglePlay} title={playing ? t('Pauza') : t('Ijro')} aria-label={playing ? t('Pauza') : t('Ijro')}>
              {playing ? '⏸' : '▶'}
            </button>
            <button className="btn btn-ghost btn-square h-12 w-12 text-2xl" onClick={next} disabled={i === frames.length - 1} title={t('Keyingi')} aria-label={t('Keyingi')}>{'⏭'}</button>
            <button className="btn btn-ghost btn-square h-12 w-12 text-2xl" onClick={restart} title={t('Qaytadan boshlash')} aria-label={t('Qaytadan boshlash')}>{'↺'}</button>
            <button className="btn btn-ghost btn-square h-12 w-12 text-2xl" onClick={toggleFullscreen} title={isFullscreen ? t("To'liq ekrandan chiqish") : t("To'liq ekran")} aria-label={isFullscreen ? t("To'liq ekrandan chiqish") : t("To'liq ekran")}>{isFullscreen ? '⛶' : '⛶'}</button>
          </div>
        )}

        {/* ── Resize dastagi — faqat desktop, fullscreen'da yashiringan ── */}
        {!isFullscreen && (
          <div
            onPointerDown={startResize}
            className="absolute bottom-0 right-0 z-10 hidden h-7 w-7 cursor-nwse-resize touch-none select-none items-end justify-end p-1.5 text-white/30 hover:text-white/70 md:flex"
            title={t("O'lchamini o'zgartirish")}
            aria-hidden="true"
          >
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M11 1L1 11M11 6L6 11M11 11L11 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </div>
        )}
      </div>
    </div>
  );
}
