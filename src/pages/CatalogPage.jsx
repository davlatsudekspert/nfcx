import { useEffect, useState } from 'react';
import { dbListSales } from '../lib/db.js';
import { fmt, timeAgo } from '../lib/format.js';
import { navigate } from '../lib/router.js';

export default function CatalogPage({ catalog }) {
  const [sales, setSales] = useState([]);
  const [q, setQ] = useState('');

  useEffect(() => { dbListSales().then(setSales); }, []);

  const saleMap = {};
  sales.forEach((r) => { saleMap[r.code] = r; });

  const query = q.trim().toUpperCase();
  const filtered = [...catalog]
    .sort((a, b) => b.ts - a.ts)
    .filter((it) => !query || it.code.includes(query) || (it.name || '').toUpperCase().includes(query));

  return (
    <main className="wrap">
      <section className="hero" style={{ paddingBottom: 10 }}>
        <div className="eyebrow reveal"><span className="dot"></span> Katalog</div>
        <h1 className="reveal reveal-1">Barcha band qilingan <span className="accent shine-text">vizitkalar</span></h1>
        <p className="sub reveal reveal-2">Jami {fmt(catalog.length)} ta vizitka band qilingan. Kod yoki ism bo'yicha qidiring.</p>
        <div className="code-input-group reveal reveal-3" style={{ maxWidth: 420 }}>
          <span className="pfx mono">qidirish</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ABZ07 yoki ism..." autoComplete="off" />
        </div>
      </section>

      {sales.length > 0 && (
        <section id="sotuv">
          <div className="section-label">Bozor</div>
          <h2>Sotuvdagi vizitkalar</h2>
          <p className="section-desc">Egalari qayta sotuvga qo'ygan vizitkalar. Sotib olingach profilingizga o'tadi.</p>
          <div className="grid">
            {sales.map((s) => (
              <a key={s.code} className="card card-sale" onClick={() => navigate('/' + s.code)}>
                <div className="code">nfcstore.uz/{s.code.toLowerCase()}</div>
                <div className="owner">{s.name}{s.role ? ' · ' + s.role : ''}</div>
                <div className="meta"><span className="sale-pill">SOTUVDA</span> {fmt(s.salePrice || s.price)} so'm</div>
              </a>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="section-label">Live</div>
        <h2>Barcha vizitkalar</h2>
        <div className="grid">
          {filtered.length === 0 && <div className="empty-note">Hech narsa topilmadi.</div>}
          {filtered.map((it) => (
            <a key={it.code} className="card" onClick={() => navigate('/' + it.code)}>
              <div className="code">nfcstore.uz/{it.code.toLowerCase()}</div>
              <div className="owner">{it.name}{it.tg ? ' · ' + it.tg : ''}</div>
              <div className="meta">
                {saleMap[it.code] && <span className="sale-pill">SOTUVDA</span>}
                {fmt(it.price)} so'm · {timeAgo(it.ts)}
              </div>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
