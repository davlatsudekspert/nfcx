import { useEffect, useState } from 'react';
import { dbListSales } from '../lib/db.js';
import { fmt, timeAgo } from '../lib/format.js';
import { navigate } from '../lib/router.js';

export default function CatalogPage({ catalog }) {
  const [sales, setSales] = useState([]);
  const [q, setQ] = useState(() => new URLSearchParams(window.location.search).get('q') || '');

  useEffect(() => { dbListSales().then(setSales); }, []);

  const saleMap = {};
  sales.forEach((r) => { saleMap[r.code] = r; });

  const query = q.trim().toUpperCase();
  const filtered = [...catalog]
    .sort((a, b) => b.ts - a.ts)
    .filter((it) => !query
      || it.code.includes(query)
      || (it.name || '').toUpperCase().includes(query)
      || (it.role || '').toUpperCase().includes(query)
      || (it.hashtags || []).some((h) => String(h).toUpperCase().includes(query)));

  const cardCls = 'cursor-pointer rounded-2xl border border-white/10 bg-base-200/60 p-5 transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-base-200';

  return (
    <main className="mx-auto max-w-6xl px-5 pb-16">
      <section className="pt-14">
        <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wider text-base-content/70">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>
          Katalog
        </span>
        <h1 className="mt-4 max-w-xl text-4xl font-extrabold leading-tight tracking-tight">
          Barcha band qilingan <span className="bg-gradient-to-br from-white to-base-content/50 bg-clip-text text-transparent">vizitkalar</span>
        </h1>
        <p className="mt-3 text-[15px] text-base-content/60">Jami {fmt(catalog.length)} ta vizitka band qilingan. Kod yoki ism bo'yicha qidiring.</p>
        <div className="mt-6 flex max-w-md items-center rounded-lg border border-white/15 bg-black/40 focus-within:border-base-content/40">
          <span className="shrink-0 pl-3 font-mono text-xs text-base-content/40">qidirish</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ABZ007 yoki ism..."
            autoComplete="off"
            className="w-full bg-transparent px-2 py-3 text-sm outline-none"
          />
        </div>
      </section>

      {sales.length > 0 && (
        <section id="sotuv" className="mt-16">
          <div className="font-mono text-xs uppercase tracking-widest text-base-content/45">Bozor</div>
          <h2 className="mt-2 text-2xl font-bold">Sotuvdagi vizitkalar</h2>
          <p className="mt-2 text-sm text-base-content/55">Egalari qayta sotuvga qo'ygan vizitkalar. Sotib olingach profilingizga o'tadi.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sales.map((s) => (
              <button key={s.code} className={`${cardCls} text-left`} onClick={() => navigate('/' + s.code)}>
                <div className="font-mono text-sm font-bold tracking-wide">nfcstore.uz/{s.code.toLowerCase()}</div>
                <div className="mt-1 truncate text-[13px] text-base-content/55">{s.name}{s.role ? ' · ' + s.role : ''}</div>
                <div className="mt-3 flex items-center gap-2 text-sm font-semibold">
                  <span className="badge badge-accent badge-outline badge-xs">SOTUVDA</span> {fmt(s.salePrice || s.price)} so'm
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mt-16">
        <div className="font-mono text-xs uppercase tracking-widest text-base-content/45">Live</div>
        <h2 className="mt-2 text-2xl font-bold">Barcha vizitkalar</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 && <div className="col-span-full py-10 text-center text-base-content/45">Hech narsa topilmadi.</div>}
          {filtered.map((it) => (
            <button key={it.code} className={`${cardCls} text-left`} onClick={() => navigate('/' + it.code)}>
              <div className="font-mono text-sm font-bold tracking-wide">nfcstore.uz/{it.code.toLowerCase()}</div>
              <div className="mt-1 truncate text-[13px] text-base-content/55">{it.name}{it.tg ? ' · ' + it.tg : ''}</div>
              <div className="mt-3 flex items-center gap-2 text-sm text-base-content/75">
                {saleMap[it.code] && <span className="badge badge-accent badge-outline badge-xs">SOTUVDA</span>}
                {fmt(it.price)} so'm · {timeAgo(it.ts)}
              </div>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
