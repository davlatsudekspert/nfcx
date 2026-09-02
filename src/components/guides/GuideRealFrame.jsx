// Haqiqiy NFCSTORE interfeysi skrinshoti ustiga chiziladigan interaktiv
// overlay: kursor nuqtasi, "bosish" effekti, highlight to'rtburchagi, zoom.
// Skrinshotlar mahalliy (production emas) sinov muhitida, demo ma'lumotlar
// bilan olingan — src/lib/guides.js boshidagi izohga qarang.
export default function GuideRealFrame({ src, cursorX, cursorY, clickEffect, highlightBox, zoomTarget, className = '' }) {
  return (
    <div className={`qollanma-realframe relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-white/10 bg-base-100 ${className}`}>
      <div
        className="absolute inset-0 transition-transform duration-500 ease-out"
        style={zoomTarget ? { transform: 'scale(1.4)', transformOrigin: zoomTarget } : undefined}
      >
        {/* object-position: top — sahifaning header/asosiy qismi ko'rinishda qolsin. */}
        <img src={src} alt="" className="h-full w-full object-cover object-top" loading="lazy" />
        {highlightBox && (
          <div
            className="absolute rounded-md ring-2 ring-accent shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
            style={{
              left: `${highlightBox.xPct}%`, top: `${highlightBox.yPct}%`,
              width: `${highlightBox.wPct}%`, height: `${highlightBox.hPct}%`,
            }}
          />
        )}
      </div>
      {cursorX != null && cursorY != null && (
        <div
          className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out"
          style={{ left: `${cursorX}%`, top: `${cursorY}%` }}
        >
          <div className="h-full w-full rounded-full border-2 border-white bg-black/40 shadow-lg" />
          {clickEffect && <span className="absolute inset-0 animate-ping rounded-full bg-white/70" />}
        </div>
      )}
    </div>
  );
}
