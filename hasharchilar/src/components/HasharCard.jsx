import { formatDateTime, formatKm } from '../lib/utils.js';
import { CalendarIcon, PinIcon, UsersIcon } from './icons.jsx';

/** Bitta hashar kartasi: status, joy, vaqt, kerakli narsalar va "Qatnashish". */
export default function HasharCard({ hashar: h, selected, joined, distance, onSelect, onJoin }) {
  const done = h.status === 'COMPLETED';
  return (
    <article
      onClick={onSelect}
      className={`cursor-pointer rounded-2xl border bg-white p-5 shadow-md transition hover:shadow-lg ${
        selected ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-slate-100'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-bold leading-snug">{h.title}</h3>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
            done ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {done ? 'Bajarildi' : 'Kutilmoqda'}
        </span>
      </div>

      {h.address && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
          <PinIcon className="h-4 w-4 shrink-0 text-emerald-600" />
          {h.address}
          {distance != null && <span className="ml-1 font-semibold text-emerald-700">· {formatKm(distance)}</span>}
        </p>
      )}
      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
        <CalendarIcon className="h-4 w-4 shrink-0 text-emerald-600" />
        {formatDateTime(h.date_time)}
      </p>

      {h.items.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {h.items.map((it) => (
            <span key={it} className="rounded-full border border-emerald-200 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              {it}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-slate-500">
          <UsersIcon className="h-4 w-4" /> {h.volunteer_count}
        </span>
        <button
          disabled={done || joined}
          onClick={(e) => {
            e.stopPropagation();
            onJoin(h.id);
          }}
          className="min-w-0 flex-1 rounded-xl bg-amber-400 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-amber-500 active:scale-95 disabled:cursor-default disabled:bg-slate-100 disabled:text-slate-500 disabled:active:scale-100"
        >
          {done ? 'Yakunlangan' : joined ? '✓ Qatnashasiz' : 'Qatnashish'}
        </button>
      </div>
    </article>
  );
}
