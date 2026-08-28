import { useState } from 'react';
import { fmt, timeAgo } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import NfcCard from '../components/NfcCard.jsx';
import Interactive3DCard from '../components/Interactive3DCard.jsx';

export default function CatalogPage({ catalog }) {
  const [q, setQ] = useState(() => new URLSearchParams(window.location.search).get('q') || '');

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
    <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pb-16">
      <section className="grid items-center gap-10 pt-14 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wider text-base-content/70">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>
            Katalog
          </span>
          <h1 className="mt-4 max-w-xl text-4xl font-extrabold leading-tight tracking-tight">
            Barcha band qilingan <span className="bg-gradient-to-br from-white to-base-content/50 bg-clip-text text-transparent">raqamli tashrif qog'ozlar</span>
          </h1>
          <p className="mt-3 text-[15px] text-base-content/60">Jami {fmt(catalog.length)} ta raqamli tashrif qog'ozi band qilingan. Kod yoki ism bo'yicha qidiring.</p>
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
        </div>
        <div className="hidden justify-self-center lg:flex">
          <Interactive3DCard>
            <NfcCard
              code={filtered[0]?.code || 'AAA000'}
              name={filtered[0]?.name?.toUpperCase() || 'SIZNING ISMINGIZ'}
              finish="showcase"
              size="lg"
            />
          </Interactive3DCard>
        </div>
      </section>

      <section className="mt-16">
        <div className="font-mono text-xs uppercase tracking-widest text-base-content/45">Live</div>
        <h2 className="mt-2 text-2xl font-bold">Barcha raqamli tashrif qog'ozlar</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 && <div className="col-span-full py-10 text-center text-base-content/45">Hech narsa topilmadi.</div>}
          {filtered.map((it) => (
            <button key={it.code} className={`${cardCls} text-left`} onClick={() => navigate('/' + it.code)}>
              <div className="font-mono text-sm font-bold tracking-wide">nfcstore.uz/{it.code.toLowerCase()}</div>
              <div className="mt-1 truncate text-[13px] text-base-content/55">{it.name}{it.tg ? ' · ' + it.tg : ''}</div>
              <div className="mt-3 flex items-center gap-2 text-sm text-base-content/75">
                {fmt(it.price)} so'm · {timeAgo(it.ts)}
              </div>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
