import { useRef, useState, useEffect } from 'react';
import { useLanguage } from '../lib/i18n.jsx';

// Professional 3D product showcase: karta + pьedestal BITTA composition
// sifatida bog'langan holda sekin, doimiy 360° aylanadi. Bosilganda
// qo'shimcha cinematic burilish + scale-up + oltin porlash beradi.
// Sichqoncha harakati esa nozik parallax/tilt (banking-card reklama
// uslubida) qo'shadi. Faqat CSS 3D transform (preserve-3d/perspective) —
// og'ir WebGL yo'q, GPU-friendly.
export default function PedestalShowcase3D({ children }) {
  const { t } = useLanguage();
  const wrapRef = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [clickSpin, setClickSpin] = useState(0);
  const [pulsing, setPulsing] = useState(false);
  const pulseTimeout = useRef(null);

  useEffect(() => () => clearTimeout(pulseTimeout.current), []);

  const onMouseMove = (e) => {
    const rect = wrapRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    // Juda nozik — "premium banking card" reklamasidagidek, kuchli emas.
    setTilt({ rx: -py * 7, ry: px * 10 });
  };
  const onMouseLeave = () => setTilt({ rx: 0, ry: 0 });

  const onActivate = () => {
    // Har bosishda +180° qo'shimcha cinematic burilish (keyingi bosish
    // yana +180° qo'shadi — jami 360°, va h.k.).
    setClickSpin((s) => s + 180);
    setPulsing(true);
    clearTimeout(pulseTimeout.current);
    pulseTimeout.current = setTimeout(() => setPulsing(false), 900);
  };

  return (
    <div
      ref={wrapRef}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={onActivate}
      className="relative flex cursor-pointer select-none flex-col items-center py-6"
      style={{ perspective: '1600px' }}
      title={t('Aylantirish uchun bosing')}
    >
      {/* Orqa fondagi yumshoq oltin ambient nur */}
      <div
        className="pointer-events-none absolute left-1/2 top-[38%] -z-10 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(212,175,90,0.35), transparent 70%)' }}
      />

      {/* QATLAM 1 — doimiy, sekin, tekis aylanish (pedestal + karta BIRGA) */}
      <div
        className="pedestal-continuous-spin"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* QATLAM 2 — bosilganda qo'shimcha burilish + sichqoncha tilt (shu qatlam ustiga qo'shiladi) */}
        <div
          className={pulsing ? 'scale-[1.06]' : 'scale-100'}
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry + clickSpin}deg)`,
            transition: pulsing
              ? 'transform 900ms cubic-bezier(0.22,1,0.36,1), scale 450ms ease-out'
              : 'transform 700ms cubic-bezier(0.22,1,0.36,1), scale 450ms ease-out',
          }}
        >
          {/* Karta — pedestaldan biroz yuqorida, o'zining yengil floaty harakati bilan */}
          <div
            className="relative z-[2] animate-[floatY_5.5s_ease-in-out_infinite]"
            style={{
              transformStyle: 'preserve-3d',
              transform: 'translateZ(46px) translateY(-8px)',
              filter: pulsing ? 'drop-shadow(0 0 26px rgba(212,175,90,0.55))' : 'drop-shadow(0 0 0 rgba(212,175,90,0))',
              transition: 'filter 500ms ease-out',
            }}
          >
            {children}
          </div>

          {/* PEDESTAL — qora premium material, nozik oltin metallic rim */}
          <div className="relative z-[1] -mt-2 h-[54px] w-[360px] sm:w-[430px]" style={{ transformStyle: 'preserve-3d' }}>
            <div
              className="absolute inset-0 rounded-[50%]"
              style={{
                background: 'radial-gradient(ellipse at 50% 35%, #322910 0%, #1c1608 45%, #0c0904 78%)',
                boxShadow: '0 0 55px 8px rgba(212,175,90,0.22), 0 0 110px 26px rgba(212,175,90,0.07), inset 0 2px 6px rgba(0,0,0,0.6)',
              }}
            />
            {/* Gold metallic rim — aylanish davomida "shimmer" harakati bilan */}
            <div className="pedestal-rim-shimmer absolute inset-x-0 top-0 h-[9px] overflow-hidden rounded-[50%]">
              <div className="h-full w-[300%]" style={{
                background: 'repeating-linear-gradient(90deg, #6b4f18 0%, #f0cf7a 8%, #d4af5a 16%, #6b4f18 24%)',
              }} />
            </div>
            {/* Statik "yorug'lik nuqtasi" — real refleksiya illyuziyasi uchun */}
            <div
              className="pointer-events-none absolute left-[18%] top-0 h-[9px] w-[70px] rounded-full opacity-80 blur-[2px]"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,247,214,0.95), transparent)' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
