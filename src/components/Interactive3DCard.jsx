import { useState } from 'react';

// Bosilganda 360 gradusga aylanadigan 3D karta o'rovchisi. Har bosishda
// +360 qo'shiladi (kartaning "old tomoni" har doim tugashda yuqorida
// qoladi), CSS transition orqali silliq aylanadi.
export default function Interactive3DCard({ children, className = '' }) {
  const [spins, setSpins] = useState(0);
  return (
    <div
      onClick={() => setSpins((s) => s + 1)}
      className={`cursor-pointer select-none ${className}`}
      style={{ perspective: '1400px' }}
      title="Aylantirish uchun bosing"
    >
      <div
        style={{
          transform: `rotateY(${spins * 360}deg)`,
          transition: 'transform 950ms cubic-bezier(0.22,1,0.36,1)',
          transformStyle: 'preserve-3d',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}
