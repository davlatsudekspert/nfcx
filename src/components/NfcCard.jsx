import { useRef, useState } from 'react';
import { IconChip, IconWave } from './Icons.jsx';

// A premium physical-card mockup — chip, contactless waves, embossed
// vizitka code and name — with a real-time mouse-tilt (3D perspective)
// and a looping holographic sheen sweep. Purely our own generic design
// (no third-party card-network branding), in black / silver / white
// finishes to match the monochrome theme.
const FINISHES = {
  black: { bg: 'linear-gradient(135deg, #1c1d1f 0%, #0a0a0b 55%, #1c1d1f 100%)', fg: '#f5f5f6', sub: 'rgba(245,245,246,0.55)' },
  silver: { bg: 'linear-gradient(135deg, #f4f4f5 0%, #d6d7d9 45%, #f4f4f5 100%)', fg: '#101112', sub: 'rgba(16,17,18,0.55)' },
  graphite: { bg: 'linear-gradient(135deg, #3a3b3d 0%, #202123 55%, #3a3b3d 100%)', fg: '#f5f5f6', sub: 'rgba(245,245,246,0.55)' },
};

export default function NfcCard({ code = 'AAA00', name = 'ISM FAMILIYA', since, finish = 'black', size = 'md', className = '' }) {
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
    <div className={'nfc-card-wrap ' + size + ' ' + className} style={{ perspective: 1000 }}>
      <div
        ref={ref}
        className="nfc-card"
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{
          background: f.bg,
          color: f.fg,
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        }}
      >
        <div className="nfc-card-sheen" style={{ backgroundPosition: `${tilt.mx}% ${tilt.my}%` }} />
        <div className="nfc-card-sweep" />
        <div className="nfc-card-row nfc-card-top">
          <IconChip />
          <IconWave style={{ color: f.sub }} />
        </div>
        <div className="nfc-card-brand" style={{ color: f.sub }}>NFCSTORE</div>
        <div className="nfc-card-number mono">{spacedCode}</div>
        <div className="nfc-card-row nfc-card-bottom">
          <div className="nfc-card-name">{name || 'ISM FAMILIYA'}</div>
          <div className="nfc-card-since" style={{ color: f.sub }}>MEMBER SINCE<br />{year}</div>
        </div>
      </div>
    </div>
  );
}
