import { formatDate } from '../data.js';
import { PinIcon, UsersIcon } from './icons.jsx';

export default function HasharCard({ hashar: h, selected, joined, onSelect, onJoin }) {
  const done = h.status === 'completed';
  return (
    <article
      onClick={onSelect}
      className={`card cursor-pointer border bg-base-100 shadow-xl transition hover:-translate-y-0.5 ${
        selected ? 'border-primary ring-2 ring-primary/40' : 'border-base-200'
      }`}
    >
      <div className="card-body gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="card-title text-lg leading-snug">{h.title}</h2>
          <span className={`badge shrink-0 font-semibold ${done ? 'badge-success text-white' : 'badge-warning'}`}>
            {done ? 'Yakunlangan' : 'Kutilmoqda'}
          </span>
        </div>

        <p className="flex items-start gap-1.5 text-sm text-slate-600">
          <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          {h.address}
        </p>

        <div className="flex flex-wrap gap-1.5">
          <span className="badge badge-outline">📅 {formatDate(h.date)}</span>
          <span className="badge badge-outline">🕒 {h.time}</span>
          {h.needs.map((n) => (
            <span key={n} className="badge badge-outline border-primary text-primary">
              {n}
            </span>
          ))}
        </div>

        <div className="mt-1 flex items-center gap-3">
          <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-slate-500">
            <UsersIcon className="h-4 w-4" /> {h.people}
          </span>
          <button
            className="btn btn-warning btn-sm min-w-0 flex-1"
            disabled={done || joined}
            onClick={(e) => {
              e.stopPropagation();
              onJoin();
            }}
          >
            {done ? 'Yakunlangan' : joined ? '✓ Qatnashasiz' : 'Qatnashish'}
          </button>
        </div>
      </div>
    </article>
  );
}
