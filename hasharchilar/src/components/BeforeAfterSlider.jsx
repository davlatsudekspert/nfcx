import { useState } from 'react';

/**
 * "Oldin / Keyin" taqqoslash slayderi.
 * Pastda "keyin" rasmi, ustida "oldin" rasmi clip-path bilan qirqiladi.
 * Ustidagi ko'rinmas <input type=range> sichqoncha, sensor va klaviaturani qo'llaydi.
 */
export default function BeforeAfterSlider({ before, after, alt = '' }) {
  const [pos, setPos] = useState(50);
  return (
    <div className="relative aspect-[16/10] select-none overflow-hidden rounded-2xl bg-slate-200">
      <img src={after} alt={`${alt} — keyin`} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <img
        src={before}
        alt={`${alt} — oldin`}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        draggable={false}
      />
      <span className="absolute left-3 top-3 rounded-full bg-slate-900/70 px-3 py-1 text-xs font-bold text-white">OLDIN</span>
      <span className="absolute right-3 top-3 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">KEYIN</span>

      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }}>
        <div className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-amber-400 text-sm font-black text-slate-900 shadow-lg">
          ⇆
        </div>
      </div>

      <input
        type="range"
        min="0"
        max="100"
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Oldin va keyin rasmlarini solishtirish"
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}
