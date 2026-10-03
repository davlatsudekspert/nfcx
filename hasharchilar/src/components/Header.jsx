import { LeafIcon, SearchIcon } from './icons.jsx';

/** Logo + tezkor qidiruv + asosiy CTA tugmasi. */
export default function Header({ query, onQuery, onCreate }) {
  return (
    <header className="sticky top-0 z-[1000] border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <a href="/" className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-600 text-white shadow-md">
            <LeafIcon className="h-6 w-6" />
          </span>
          <span className="text-xl font-extrabold tracking-tight sm:text-2xl">
            <span className="text-emerald-600">hashar</span>
            <span className="text-amber-500">chilar</span>
            <span className="text-slate-400">.uz</span>
          </span>
        </a>

        {/* Mobilda qidiruv ikkinchi qatorga tushadi */}
        <label className="order-3 flex w-full items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2.5 text-slate-500 focus-within:ring-2 focus-within:ring-emerald-500 sm:order-none sm:ml-4 sm:w-auto sm:flex-1 sm:max-w-md">
          <SearchIcon className="h-5 w-5 shrink-0" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Mahalla yoki hashar nomi…"
            className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
        </label>

        <button
          onClick={onCreate}
          className="ml-auto rounded-2xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-md transition hover:bg-amber-500 active:scale-95 sm:px-5"
        >
          + <span className="hidden sm:inline">Hashar e'lon qilish</span>
          <span className="sm:hidden">E'lon</span>
        </button>
      </div>
    </header>
  );
}
