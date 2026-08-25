import { useEffect, useState } from 'react';
import { dbListAuctions } from '../lib/db.js';
import { fmt } from '../lib/format.js';
import { navigate } from '../lib/router.js';

function timeLeft(endsAt) {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "tugadi";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)} kun ${h % 24} soat qoldi`;
  if (h > 0) return `${h} soat ${m} daqiqa qoldi`;
  return `${m} daqiqa qoldi`;
}

export default function AuctionsPage() {
  const [auctions, setAuctions] = useState(null);

  useEffect(() => {
    let stop = false;
    const load = () => dbListAuctions().then((list) => { if (!stop) setAuctions(list); });
    load();
    const t = setInterval(load, 8000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  const cardCls = 'cursor-pointer rounded-2xl border border-white/10 bg-base-200/60 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-base-200';

  return (
    <main className="mx-auto max-w-6xl px-5 pb-16">
      <section className="pt-14">
        <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wider text-base-content/70">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>
          Auksion
        </span>
        <h1 className="mt-4 max-w-xl text-4xl font-extrabold leading-tight tracking-tight">
          Noyob kodlar uchun <span className="bg-gradient-to-br from-white to-base-content/50 bg-clip-text text-transparent">ochiq savdo</span>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] text-base-content/60">
          Egalari o'z vizitka kodlarini auksionga qo'yishadi. Narx taklif qilish uchun NFC Pay hamyoningizda NFC Coin bo'lishi kerak (1 NFC Coin = 1 so'm) — taklif summasi g'olib bo'lgunicha bandlanadi (yechilmaydi).
        </p>
      </section>

      <section className="mt-10">
        {auctions === null && <div className="py-10 text-center text-base-content/45">Yuklanmoqda...</div>}
        {auctions !== null && auctions.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-base-content/50">
            Hozircha faol auksion yo'q.
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(auctions || []).map((a) => (
            <button key={a.id} className={cardCls} onClick={() => navigate('/auksion/' + a.id)}>
              <div className="font-mono text-sm font-bold tracking-wide">nfcstore.uz/{a.code.toLowerCase()}</div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-xs text-base-content/50">Joriy narx</span>
                <b className="text-lg">{fmt(a.currentPrice)} NFC Coin</b>
              </div>
              {a.buyNowPrice && (
                <div className="mt-1 flex items-baseline justify-between text-xs text-base-content/50">
                  <span>Darhol sotib olish</span>
                  <span>{fmt(a.buyNowPrice)} NFC Coin</span>
                </div>
              )}
              <div className="mt-3 text-xs font-semibold text-accent">{timeLeft(a.endsAt)}</div>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
