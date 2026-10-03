export const TABS = [
  { id: 'map', label: "Xaritada ko'rish", emoji: '🗺️' },
  { id: 'nearby', label: 'Yaqindagi hasharlar', emoji: '📍' },
  { id: 'done', label: 'Bajarilganlar (Oldin/Keyin)', emoji: '✨' },
];

/** Tezkor filtr tablari. */
export default function Tabs({ active, onChange }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <div role="tablist" className="flex w-max gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => onChange(t.id)}
            className={`whitespace-nowrap rounded-2xl px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
              active === t.id ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 hover:bg-emerald-50'
            }`}
          >
            <span className="mr-1.5">{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
