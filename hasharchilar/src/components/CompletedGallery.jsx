import { formatDateTime } from '../lib/utils.js';
import BeforeAfterSlider from './BeforeAfterSlider.jsx';
import { PinIcon, UsersIcon } from './icons.jsx';

/** Bajarilgan hasharlar galereyasi — har birida Oldin/Keyin slayderi. */
export default function CompletedGallery({ hashars }) {
  if (hashars.length === 0) {
    return <p className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-md">Hozircha bajarilgan hasharlar yo'q.</p>;
  }
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {hashars.map((h) => (
        <article key={h.id} className="rounded-2xl bg-white p-4 shadow-md">
          {h.before_url && h.after_url ? (
            <BeforeAfterSlider before={h.before_url} after={h.after_url} alt={h.title} />
          ) : (
            <div className="grid aspect-[16/10] place-items-center rounded-2xl bg-slate-100 text-sm text-slate-400">Rasm yo'q</div>
          )}
          <h3 className="mt-3 text-lg font-bold">{h.title}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
            <PinIcon className="h-4 w-4 text-emerald-600" /> {h.address || 'Xaritada belgilangan joy'}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <UsersIcon className="h-4 w-4" /> {h.volunteer_count} ishtirokchi · {formatDateTime(h.date_time)}
          </p>
        </article>
      ))}
    </div>
  );
}
