import { useRef, useState } from 'react';
import { IconChip, IconWave } from './Icons.jsx';

// A premium physical-card mockup — chip, contactless waves, embossed
// vizitka code and name — with a real-time mouse-tilt (3D perspective)
// and a looping holographic sheen sweep. Purely our own generic design
// (no third-party card-network branding), in black / silver / white
// finishes to match the monochrome theme.
const FINISHES = {
  black: { bg: 'linear-gradient(135deg, #201a10 0%, #0a0908 55%, #201a10 100%)', fg: '#f6f2ea', sub: 'rgba(232,193,101,0.75)', code: '#e8c165' },
  silver: { bg: 'linear-gradient(135deg, #f4f4f5 0%, #d6d7d9 45%, #f4f4f5 100%)', fg: '#101112', sub: 'rgba(16,17,18,0.55)', code: '#101112' },
  graphite: { bg: 'linear-gradient(135deg, #3a3730 0%, #201f1a 55%, #3a3730 100%)', fg: '#f6f2ea', sub: 'rgba(232,193,101,0.6)', code: '#e8c165' },
};

const CARD_SIZES = {
  lg: 'h-[214px] w-[340px]',
  md: 'h-[176px] w-[280px]',
  sm: 'h-[138px] w-[220px]',
};

const SHADOW_DEFAULT = '0 20px 45px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)';
const SHADOW_RIM = '0 0 0 1px rgba(201,162,39,0.28), 0 0 40px rgba(180,140,30,0.28), 0 28px 70px rgba(0,0,0,0.65)';

export default function NfcCard({ code = 'AAA000', name = 'ISM FAMILIYA', since, finish = 'black', size = 'md', rim = false }) {
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, mx: 50, my: 50 });
  const f = FINISHES[finish] || FINISHES.black;
  const year = since ? new Date(since).getFullYear() : new Date().getFullYear();

  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setTilt({ rx: (0.5 - py) * 16, ry: (px - 0.5) * 20, mx: px * 100, my: py * 100 });
  };
  const onLeave = () => setTilt({ rx: 0, ry: 0, mx: 50, my: 50 });

  const spacedCode = String(code).split('').join(' ');

  return (
    <div className="flex justify-center" style={{ perspective: 1000 }}>
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className={`relative flex ${CARD_SIZES[size]} cursor-pointer select-none flex-col justify-between overflow-hidden rounded-2xl px-5 py-[18px] transition-transform duration-[250ms] ease-[cubic-bezier(.2,.8,.2,1)] [transform-style:preserve-3d]`}
        style={{
          background: f.bg,
          color: f.fg,
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          boxShadow: rim ? SHADOW_RIM : SHADOW_DEFAULT,
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-55 mix-blend-overlay"
          style={{ background: `radial-gradient(360px circle at ${tilt.mx}% ${tilt.my}%, rgba(255,255,255,0.55), transparent 45%)` }}
        />
        <div className="pointer-events-none absolute -left-[60%] -top-[60%] h-[220%] w-[60%] animate-[shimmerSweep_3.6s_ease-in-out_infinite] bg-[linear-gradient(100deg,transparent,rgba(255,255,255,0.16)_40%,rgba(255,255,255,0.35)_50%,rgba(255,255,255,0.16)_60%,transparent)]" />
        <div className="relative z-[1] flex items-center justify-between">
          <IconChip />
          <IconWave style={{ color: f.sub }} />
        </div>
        <div className="relative z-[1] text-center font-display text-[11px] font-bold tracking-[0.22em]" style={{ color: f.sub }}>NFCSTORE</div>
        <div className="relative z-[1] text-center font-mono text-[19px] font-bold tracking-[0.14em] [text-shadow:0_1px_1px_rgba(0,0,0,0.15)]" style={{ color: f.code }}>{spacedCode}</div>
        <div className="relative z-[1] flex items-center justify-between">
          <div className="font-display text-xs font-bold tracking-[0.04em] uppercase">{name || 'ISM FAMILIYA'}</div>
          <div className="text-right font-mono text-[8.5px] leading-snug tracking-[0.08em]" style={{ color: f.sub }}>MEMBER SINCE<br />{year}</div>
        </div>
      </div>
    </div>
  );
}
