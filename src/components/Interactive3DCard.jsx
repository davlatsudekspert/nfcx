import { cloneElement, useState } from 'react';

// Bosilganda kartaning old tomoni yo'qolib, ORQA TOMONI ko'rinadigan
// haqiqiy 3D flip (rotateY 180deg). `children` — bitta <NfcCard .../>
// elementi bo'lishi kerak; orqa tomon avtomatik hosil qilinadi
// (bir xil elementning `back` propi TRUE qilingan nusxasi).
export default function Interactive3DCard({ children, className = '' }) {
  const [flipped, setFlipped] = useState(false);
  const backChild = cloneElement(children, { back: true });

  return (
    <div
      onClick={() => setFlipped((f) => !f)}
      className={`cursor-pointer select-none ${className}`}
      style={{ perspective: '1400px' }}
      title="Orqa tomonini ko'rish uchun bosing"
    >
      <div
        style={{
          position: 'relative',
          transformStyle: 'preserve-3d',
          transition: 'transform 750ms cubic-bezier(0.22,1,0.36,1)',
          transform: `rotateY(${flipped ? 180 : 0}deg)`,
        }}
      >
        <div style={{ backfaceVisibility: 'hidden' }}>{children}</div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {backChild}
        </div>
      </div>
    </div>
  );
}
