import { useEffect, useRef, useState } from 'react';
import { dbGetAuction, dbPlaceBid, dbGetWallet } from '../lib/db.js';
import { fmt, timeAgo } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import { useAuth } from '../lib/auth.jsx';

function timeLeft(endsAt) {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "tugadi";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h >= 24) return `${Math.floor(h / 24)} kun ${h % 24} soat`;
  if (h > 0) return `${h}soat ${m}daq`;
  return `${m}daq ${s}son`;
}

const STATUS_LABEL = {
  active: { text: 'Faol', cls: 'badge-success' },
  sold: { text: 'Sotildi', cls: 'badge-accent' },
  expired: { text: "Taklifsiz tugadi", cls: 'badge-ghost' },
};

export default function AuctionPage({ id }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [, tick] = useState(0);
  const idemRef = useRef(null);

  const load = () => dbGetAuction(id).then(setData).catch(() => setData(null));

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    const ticker = setInterval(() => tick((n) => n + 1), 1000);
    return () => { clearInterval(t); clearInterval(ticker); };
  }, [id]);

  useEffect(() => {
    if (user) dbGetWallet().then(setWallet);
  }, [user]);

  if (data === null) {
    return <main className="mx-auto max-w-3xl px-5 pt-16 pb-16 text-center text-base-content/45">Yuklanmoqda yoki auksion topilmadi...</main>;
  }

  const { auction, bids } = data;
  const st = STATUS_LABEL[auction.status] || { text: auction.status, cls: 'badge-ghost' };
  const minNext = Number(auction.currentPrice) + Math.max(1000, Math.round(Number(auction.currentPrice) * 0.02));
  const isOwner = user && user.id === auction.sellerId;
  const isHighest = user && user.id === auction.highestBidderId;

  const bid = async () => {
    if (!user) { navigate('/login'); return; }
    const val = Math.round(Number(amount));
    if (!val || val < minNext) { setMsg({ type: 'err', text: `Taklif kamida ${fmt(minNext)} NFC Coin bo'lishi kerak.` }); return; }
    // Har bir yangi urinish uchun bitta idempotency key — tarmoq uzilib
    // qayta so'rov ketsa ham, bir xil taklif ikki marta yozilmaydi/yechilmaydi.
    if (!idemRef.current) idemRef.current = crypto.randomUUID();
    setBusy(true);
    setMsg(null);
    try {
      const res = await dbPlaceBid(auction.id, val, idemRef.current);
      idemRef.current = null; // muvaffaqiyatli — keyingi taklif uchun yangi kalit kerak
      setMsg({ type: 'ok', text: res.buyNow ? "Tabriklaymiz! Siz 'darhol sotib olish' narxiga yetdingiz — auksion yakunlandi." : "Taklifingiz qabul qilindi!" });
      setAmount('');
      await load();
      dbGetWallet().then(setWallet);
    } catch (err) {
      // SYSTEM xatosida kalitni saqlab qolamiz — qayta bossa xuddi shu
      // urinish deb hisoblanadi (ikki marta yechilib qolmaydi).
      if (err.code && err.code !== 'SYSTEM') idemRef.current = null;
      setMsg({ type: 'err', text: err.message + (err.available != null ? ` (mavjud: ${fmt(err.available)} NFC Coin)` : '') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-5 pb-16">
      <section className="pt-14">
        <button className="text-xs text-base-content/50 hover:text-base-content" onClick={() => navigate('/auksion')}>&larr; Auksionlarga qaytish</button>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-bold tracking-wide">nfcstore.uz/{auction.code.toLowerCase()}</h1>
          <span className={`badge ${st.cls}`}>{st.text}</span>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-base-200/60 p-5">
          <div className="text-xs text-base-content/50">Joriy narx</div>
          <div className="mt-1 text-2xl font-extrabold">{fmt(auction.currentPrice)} <span className="text-sm font-normal text-base-content/50">NFC Coin</span></div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-base-200/60 p-5">
          <div className="text-xs text-base-content/50">{auction.status === 'active' ? 'Qolgan vaqt' : 'Yakunlangan'}</div>
          <div className="mt-1 text-2xl font-extrabold">{auction.status === 'active' ? timeLeft(auction.endsAt) : '—'}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-base-200/60 p-5">
          <div className="text-xs text-base-content/50">Darhol sotib olish</div>
          <div className="mt-1 text-2xl font-extrabold">{auction.buyNowPrice ? fmt(auction.buyNowPrice) + " NFC Coin" : '—'}</div>
        </div>
      </section>

      {isHighest && auction.status === 'active' && (
        <div className="alert alert-success mt-6 py-2 text-sm"><span>Hozircha siz yetakchisiz!</span></div>
      )}
      {isOwner && (
        <div className="alert mt-6 py-2 text-sm"><span>Bu — sizning auksioningiz. O'zingiz taklif qila olmaysiz.</span></div>
      )}

      {auction.status === 'active' && !isOwner && (
        <section className="mt-6 rounded-2xl border border-white/10 p-5">
          <div className="text-sm font-bold">Narx taklif qilish</div>
          {user && wallet && (
            <p className="mt-1 text-xs text-base-content/50">
              NFC Pay balansingiz: <b>{fmt(wallet.available)} NFC Coin</b> ishlatish mumkin
              {wallet.heldBalance > 0 && ` (${fmt(wallet.heldBalance)} NFC Coin boshqa takliflarda bandlangan)`}.
              {' '}<button className="underline underline-offset-2" onClick={() => navigate('/account')}>NFC Pay'ni to'ldirish &rarr;</button>
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`kamida ${fmt(minNext)}`}
              className="input input-bordered input-sm w-48 bg-base-100"
            />
            <button className="btn btn-primary btn-sm" onClick={bid} disabled={busy || !user}>
              {busy ? <span className="loading loading-spinner loading-xs"></span> : (user ? 'Taklif qilish' : 'Kirish kerak')}
            </button>
            {auction.buyNowPrice && (
              <button className="btn btn-outline btn-sm" onClick={() => setAmount(String(auction.buyNowPrice))} disabled={busy}>
                Darhol sotib olish narxini yozish
              </button>
            )}
          </div>
          {msg && <div className={`alert mt-3 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{msg.text}</span></div>}
        </section>
      )}

      <section className="mt-8">
        <div className="text-sm font-bold">Takliflar tarixi ({bids.length})</div>
        <div className="mt-3 space-y-2">
          {bids.length === 0 && <div className="text-sm text-base-content/45">Hali taklif yo'q — birinchi bo'ling.</div>}
          {bids.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-2.5 text-sm">
              <span className="text-base-content/60">{b.userId === auction.highestBidderId ? '\uD83D\uDC51 ' : ''}Foydalanuvchi #{b.userId}</span>
              <span className="font-semibold">{fmt(b.amount)} NFC Coin</span>
              <span className="text-xs text-base-content/40">{timeAgo(new Date(b.createdAt).getTime())}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
