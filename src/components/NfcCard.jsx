import { useRef, useState } from 'react';
import { IconWave } from './Icons.jsx';

// A premium physical-card mockup — contactless waves, embossed
// raqamli tashrif qog'ozi code and name — with a real-time mouse-tilt (3D perspective)
// and a looping holographic sheen sweep. Purely our own generic design
// (no third-party card-network branding), in black / silver / white
// finishes to match the monochrome theme.
const FINISHES = {
  black: { bg: 'linear-gradient(135deg, #201a10 0%, #0a0908 55%, #201a10 100%)', fg: '#f6f2ea', sub: 'rgba(232,193,101,0.75)', code: '#e8c165' },
  silver: { bg: 'linear-gradient(135deg, #f4f4f5 0%, #d6d7d9 45%, #f4f4f5 100%)', fg: '#101112', sub: 'rgba(16,17,18,0.55)', code: '#101112' },
  graphite: { bg: 'linear-gradient(135deg, #3a3730 0%, #201f1a 55%, #3a3730 100%)', fg: '#f6f2ea', sub: 'rgba(232,193,101,0.6)', code: '#e8c165' },
  gold: { bg: 'linear-gradient(135deg, #d4af5a 0%, #8a6a20 45%, #d4af5a 100%)', fg: '#1a1206', sub: 'rgba(26,18,6,0.6)', code: '#1a1206' },
  // "Showcase" — sayt bo'ylab (Narxlar, Savollar, Auksion, Ro'yxatdan
  // o'tish) NAMUNA sifatida ko'rsatiladigan kartalar uchun: to'q kulrang
  // fon, oltin chegara, barcha matn oltin rangda.
  showcase: { bg: 'linear-gradient(135deg, #262422 0%, #171614 55%, #262422 100%)', fg: '#d4af5a', sub: 'rgba(212,175,90,0.62)', code: '#e8c165', border: '1.5px solid #d4af5a' },
  // ===== Daraja-asosli finish'lar — profildagi haqiqiy karta shu tarifga
  // qarab avtomatik shu ko'rinishni oladi (Titanium Gold/Platinum/Gold/
  // Silver/Emerald vizual tizimi). =====
  'tier-exclusive': { bg: 'linear-gradient(145deg, #2b2926 0%, #3a3834 50%, #1f1e1c 100%)', fg: '#f2ead0', sub: 'rgba(212,175,55,0.7)', code: '#d4af37', border: '1px solid rgba(212,175,55,0.5)' },
  'tier-premium': { bg: 'linear-gradient(145deg, #d9dade 0%, #eef0f2 45%, #b9bcc4 100%)', fg: '#1a1c22', sub: 'rgba(26,28,34,0.55)', code: '#3a3d45', border: '1px solid rgba(200,205,214,0.7)' },
  'tier-gold': { bg: 'linear-gradient(135deg, #f0c419 0%, #a9840f 45%, #f0c419 100%)', fg: '#1a1206', sub: 'rgba(26,18,6,0.6)', code: '#1a1206' },
  'tier-silver': { bg: 'linear-gradient(135deg, #c4cad2 0%, #8f97a3 45%, #c4cad2 100%)', fg: '#15181c', sub: 'rgba(21,24,28,0.55)', code: '#15181c' },
  'tier-free': { bg: 'linear-gradient(135deg, #22352a 0%, #14201a 55%, #22352a 100%)', fg: '#eafff2', sub: 'rgba(63,174,106,0.65)', code: '#3fae6a', border: '1px solid rgba(63,174,106,0.4)' },
  // Ink — chuqur indigo-havo rang (sayt "Ink" temasiga mos).
  ink: { bg: 'linear-gradient(145deg, #10163a 0%, #0a0d1c 55%, #1b2456 100%)', fg: '#eef0fb', sub: 'rgba(142,162,255,0.7)', code: '#8ea2ff', border: '1px solid rgba(142,162,255,0.35)' },
};

export const CARD_SIZES = {
  lg: 'h-[240px] w-[380px]',
  md: 'h-[176px] w-[280px]',
  sm: 'h-[138px] w-[220px]',
};

// Tashqi komponentlar (masalan profildagi "aylanadigan karta") uchun —
// tarif finish'ining fon/matn ranglari.
export function cardFinish(finish) {
  return FINISHES[finish] || FINISHES.black;
}

const SHADOW_DEFAULT = '0 20px 45px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)';
const SHADOW_RIM = '0 0 0 1px rgba(201,162,39,0.28), 0 0 40px rgba(180,140,30,0.28), 0 28px 70px rgba(0,0,0,0.65)';

export default function NfcCard({
  code = 'AAA000', name = 'ISM FAMILIYA', since, finish = 'black', size = 'md',
  rim = false, back = false, bgImage = '', hideBrand = false,
  namePos = null, nameScale = 1, nameColor = '', onNameChange = null,
  codePos = null, codeScale = 1, onCodeChange = null,
  brandPos = null, brandScale = 1, brandColor = '', onBrandChange = null,
}) {
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, mx: 50, my: 50 });
  const [dragTarget, setDragTarget] = useState(null); // 'name' | 'code' | 'brand' | null
  const f = FINISHES[finish] || FINISHES.black;
  const year = since ? new Date(since).getFullYear() : new Date().getFullYear();
  const editable = typeof onNameChange === 'function' || typeof onCodeChange === 'function' || typeof onBrandChange === 'function';
  const namePositioned = namePos && Number.isFinite(namePos.x) && Number.isFinite(namePos.y);
  const codePositioned = codePos && Number.isFinite(codePos.x) && Number.isFinite(codePos.y);
  // "NFCSTORE" yozuvi: sozlangan (brandPos) yoki tahrirlash rejimida — suzuvchi.
  const brandPositioned = (brandPos && Number.isFinite(brandPos.x) && Number.isFinite(brandPos.y)) || (editable && typeof onBrandChange === 'function');
  const brandXY = brandPos && Number.isFinite(brandPos.x) ? brandPos : { x: 0.5, y: 0.32 };
  const nameFontPx = 12 * (Number.isFinite(nameScale) ? nameScale : 1);
  const codeFontPx = 19 * (Number.isFinite(codeScale) ? codeScale : 1);
  const brandFontPx = 11 * (Number.isFinite(brandScale) ? brandScale : 1);
  const nameClr = nameColor || f.fg;
  const brandClr = brandColor || f.sub;

  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    if (dragTarget) {
      const clamped = { x: Math.min(0.97, Math.max(0.03, px)), y: Math.min(0.95, Math.max(0.05, py)) };
      if (dragTarget === 'name' && onNameChange) onNameChange(clamped);
      else if (dragTarget === 'code' && onCodeChange) onCodeChange(clamped);
      else if (dragTarget === 'brand' && onBrandChange) onBrandChange(clamped);
      return;
    }
    if (editable) return; // tahrirlash rejimida 3D egilish yo'q — barqaror sirt
    setTilt({ rx: (0.5 - py) * 16, ry: (px - 0.5) * 20, mx: px * 100, my: py * 100 });
  };
  const onLeave = () => { setDragTarget(null); setTilt({ rx: 0, ry: 0, mx: 50, my: 50 }); };
  const startDrag = (which) => (e) => { e.preventDefault(); e.stopPropagation(); setDragTarget(which); };

  const spacedCode = String(code).split('').join(' ');

  // Kartaning ORQA tomoni — QR-kod uslubidagi belgi, logotip va havola.
  if (back) {
    return (
      <div className="flex justify-center" style={{ perspective: 1000 }}>
        <div
          className={`relative flex ${CARD_SIZES[size]} select-none flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl px-5 py-[18px]`}
          style={{ background: f.bg, color: f.fg, boxShadow: rim ? SHADOW_RIM : SHADOW_DEFAULT }}
        >
          <div className="pointer-events-none absolute -left-[60%] -top-[60%] h-[220%] w-[60%] animate-[shimmerSweep_3.6s_ease-in-out_infinite] bg-[linear-gradient(100deg,transparent,rgba(255,255,255,0.16)_40%,rgba(255,255,255,0.35)_50%,rgba(255,255,255,0.16)_60%,transparent)]" />
          <div className="relative z-[1] grid grid-cols-5 gap-[3px] rounded-md p-2" style={{ background: 'rgba(0,0,0,0.12)' }}>
            {Array.from({ length: 25 }).map((_, i) => (
              <span key={i} className="h-[5px] w-[5px] rounded-[1px]" style={{ background: (i * 7 + code.length) % 3 === 0 ? 'transparent' : f.code, opacity: 0.9 }} />
            ))}
          </div>
          <div className="relative z-[1] text-center font-mono text-[10px] tracking-[0.1em]" style={{ color: f.sub }}>nfcstore.uz/{String(code).toLowerCase()}</div>
          <div className="relative z-[1] text-center font-display text-[10px] font-bold tracking-[0.22em]" style={{ color: f.sub }}>NFCSTORE</div>
          <div className="relative z-[1] text-center font-mono text-[8px] leading-snug tracking-[0.08em]" style={{ color: f.sub }}>MEMBER SINCE {year}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center" style={{ perspective: 1000 }}>
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onMouseUp={() => setDragTarget(null)}
        className={`relative flex ${CARD_SIZES[size]} ${editable ? 'cursor-default' : 'cursor-pointer'} select-none flex-col justify-between overflow-hidden rounded-2xl px-5 py-[18px] transition-transform duration-[250ms] ease-[cubic-bezier(.2,.8,.2,1)] [transform-style:preserve-3d]`}
        style={{
          background: f.bg,
          color: f.fg,
          border: f.border || 'none',
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          boxShadow: rim ? SHADOW_RIM : SHADOW_DEFAULT,
        }}
      >
        {bgImage && (
          <>
            {/\.(mp4|webm)(\?|$)/i.test(bgImage)
              ? <video
                  src={bgImage}
                  autoPlay loop muted playsInline
                  ref={(el) => { if (el) { el.muted = true; const p = el.play(); if (p) p.catch(() => {}); } }}
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                />
              : <img src={bgImage} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />}
            <div className="pointer-events-none absolute inset-0" style={{ background: 'rgba(0,0,0,0.42)' }} />
          </>
        )}
        <div
          className="pointer-events-none absolute inset-0 opacity-55 mix-blend-overlay"
          style={{ background: `radial-gradient(360px circle at ${tilt.mx}% ${tilt.my}%, rgba(255,255,255,0.55), transparent 45%)` }}
        />
        <div className="pointer-events-none absolute -left-[60%] -top-[60%] h-[220%] w-[60%] animate-[shimmerSweep_3.6s_ease-in-out_infinite] bg-[linear-gradient(100deg,transparent,rgba(255,255,255,0.16)_40%,rgba(255,255,255,0.35)_50%,rgba(255,255,255,0.16)_60%,transparent)]" />
        <div className="relative z-[1] flex items-center justify-end">
          <IconWave style={{ color: f.sub }} />
        </div>
        {(brandPositioned || hideBrand)
          ? <span />
          : <div className="relative z-[1] text-center font-display text-[11px] font-bold tracking-[0.22em]" style={{ color: brandClr }}>NFCSTORE</div>}
        {codePositioned
          ? <span />
          : (
            <div
              className={`relative z-[1] text-center font-mono font-bold tracking-[0.14em] [text-shadow:0_1px_1px_rgba(0,0,0,0.15)] ${editable && onCodeChange ? 'cursor-move' : ''}`}
              style={{ color: f.code, fontSize: `${codeFontPx}px` }}
              onMouseDown={editable && onCodeChange ? startDrag('code') : undefined}
            >
              {spacedCode}
            </div>
          )}
        <div className="relative z-[1] flex items-center justify-between">
          {namePositioned
            ? <span />
            : <div className="font-display font-bold tracking-[0.04em] uppercase" style={{ fontSize: `${nameFontPx}px`, color: nameClr }}>{name || 'ISM FAMILIYA'}</div>}
          {!brandPositioned && (
            <div className="text-right font-mono text-[8.5px] leading-snug tracking-[0.08em]" style={{ color: f.sub }}>MEMBER SINCE<br />{year}</div>
          )}
        </div>

        {namePositioned && (
          <div
            onMouseDown={editable && onNameChange ? startDrag('name') : undefined}
            className={`absolute z-[3] font-display font-bold uppercase leading-none tracking-[0.04em] ${editable && onNameChange ? 'cursor-move rounded px-1 outline-dashed outline-1 outline-white/50' : ''}`}
            style={{
              left: `${namePos.x * 100}%`,
              top: `${namePos.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: `${nameFontPx}px`,
              whiteSpace: 'nowrap',
              color: nameClr,
            }}
          >
            {name || 'ISM FAMILIYA'}
          </div>
        )}

        {brandPositioned && !hideBrand && (
          <div
            onMouseDown={editable && onBrandChange ? startDrag('brand') : undefined}
            className={`absolute z-[3] font-display font-bold uppercase leading-none tracking-[0.22em] ${editable && onBrandChange ? 'cursor-move rounded px-1 outline-dashed outline-1 outline-white/50' : ''}`}
            style={{
              left: `${brandXY.x * 100}%`,
              top: `${brandXY.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: `${brandFontPx}px`,
              whiteSpace: 'nowrap',
              color: brandClr,
            }}
          >
            NFCSTORE
          </div>
        )}

        {codePositioned && (
          <div
            onMouseDown={editable && onCodeChange ? startDrag('code') : undefined}
            className={`absolute z-[3] font-mono font-bold leading-none tracking-[0.14em] [text-shadow:0_1px_1px_rgba(0,0,0,0.15)] ${editable && onCodeChange ? 'cursor-move rounded px-1 outline-dashed outline-1 outline-white/50' : ''}`}
            style={{
              left: `${codePos.x * 100}%`,
              top: `${codePos.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: `${codeFontPx}px`,
              whiteSpace: 'nowrap',
              color: f.code,
            }}
          >
            {spacedCode}
          </div>
        )}
      </div>
    </div>
  );
}