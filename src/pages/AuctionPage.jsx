import { useEffect, useRef, useState } from 'react';
import { dbGetAuction, dbPlaceBid, dbPayAuctionWinner, dbGetPayment } from '../lib/db.js';
import { fmt, timeAgo, dateTime } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import { useAuth } from '../lib/auth.jsx';
import NfcCard from '../components/NfcCard.jsx';
import Interactive3DCard from '../components/Interactive3DCard.jsx';

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
  awaiting_payment: { text: "To'lov kutilmoqda", cls: 'badge-warning' },
  sold: { text: 'Sotildi', cls: 'badge-accent' },
  expired: { text: "Taklifsiz tugadi", cls: 'badge-ghost' },
  payment_expired: { text: "To'lov muddati o'tdi", cls: 'badge-error' },
  cancelled: { text: 'Bekor qilindi', cls: 'badge-ghost' },
};

export default function AuctionPage({ id }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [payOrder, setPayOrder] = useState(null);
  const [winnerName, setWinnerName] = useState('');
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
    if (!payOrder) return;
    const t = setInterval(async () => {
      try {
        const st = await dbGetPayment(payOrder.orderId);
        if (st.status === 'paid') {
          clearInterval(t);
          setPayOrder(null);
          setMsg({ type: 'ok', text: "To'lov tasdiqlandi — tabriklaymiz, raqamli tashrif qog'ozi endi sizniki!" });
          await load();
        } else if (st.status === 'cancelled') {
          clearInterval(t);
          setPayOrder(null);
          setMsg({ type: 'err', text: "To'lov bekor qilindi." });
        }
      } catch { /* keyingi urinishda qayta tekshiramiz */ }
    }, 3000);
    return () => clearInterval(t);
  }, [payOrder]);

  if (data === null) {
    return <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pt-16 pb-16 text-center text-base-content/45">Yuklanmoqda yoki auksion topilmadi...</main>;
  }

  const { auction, bids } = data;
  const st = STATUS_LABEL[auction.status] || { text: auction.status, cls: 'badge-ghost' };
  const minNext = Number(auction.currentPrice) + Math.max(1000, Math.round(Number(auction.currentPrice) * 0.02));
  const isOwner = user && user.id === auction.sellerId;
  const isHighest = user && user.id === auction.highestBidderId;

  const bid = async () => {
    if (!user) { navigate('/login'); return; }
    const val = Math.round(Number(amount));
    if (!val || val < minNext) { setMsg({ type: 'err', text: `Taklif kamida ${fmt(minNext)} so'm bo'lishi kerak.` }); return; }
    if (!idemRef.current) idemRef.current = crypto.randomUUID();
    setBusy(true);
    setMsg(null);
    try {
      const res = await dbPlaceBid(auction.id, val, idemRef.current);
      idemRef.current = null;
      setMsg({
        type: 'ok',
        text: res.buyNow
          ? "Siz 'darhol sotib olish' narxiga yetdingiz — endi 24 soat ichida to'lashingiz kerak."
          : res.antiSnipe
            ? "Taklifingiz qabul qilindi! Tugash vaqti oxirgi daqiqada bo'lgani uchun +5 daqiqaga uzaytirildi."
            : "Taklifingiz qabul qilindi!",
      });
      setAmount('');
      await load();
    } catch (err) {
      if (err.code && err.code !== 'SYSTEM') idemRef.current = null;
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const payNow = async () => {
    if (!winnerName.trim()) { setMsg({ type: 'err', text: 'Profilingiz uchun ismingizni kiriting.' }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const order = await dbPayAuctionWinner(auction.id, { name: winnerName.trim() });
      setPayOrder(order);
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pb-16">
      <section className="pt-14 lg:flex lg:items-center lg:justify-between lg:gap-8">
        <div>
          <button className="text-xs text-base-content/50 hover:text-base-content" onClick={() => navigate('/auksion')}>&larr; Auksionlarga qaytish</button>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-bold tracking-wide">nfcstore.uz/{auction.code.toLowerCase()}</h1>
            <span className={`badge ${st.cls}`}>{st.text}</span>
          </div>
        </div>
        <div className="mt-6 hidden shrink-0 lg:mt-0 lg:block">
          <Interactive3DCard>
            <NfcCard code={auction.code} name="G'OLIB SIZ BO'LING" finish={auction.status === 'sold' ? 'graphite' : 'gold'} size="sm" />
          </Interactive3DCard>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-base-200/60 p-5">
          <div className="text-xs text-base-content/50">Joriy narx</div>
          <div className="mt-1 text-2xl font-extrabold">{fmt(auction.currentPrice)} <span className="text-sm font-normal text-base-content/50">so'm</span></div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-base-200/60 p-5">
          <div className="text-xs text-base-content/50">{auction.status === 'active' ? 'Qolgan vaqt' : auction.status === 'awaiting_payment' ? "To'lov muddati" : 'Yakunlangan'}</div>
          <div className="mt-1 text-2xl font-extrabold">
            {auction.status === 'active' ? timeLeft(auction.endsAt)
              : auction.status === 'awaiting_payment' ? timeLeft(auction.paymentDeadline)
              : '—'}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-base-200/60 p-5">
          <div className="text-xs text-base-content/50">Darhol sotib olish</div>
          <div className="mt-1 text-2xl font-extrabold">{auction.buyNowPrice ? fmt(auction.buyNowPrice) + " so'm" : '—'}</div>
        </div>
      </section>

      {isHighest && auction.status === 'active' && (
        <div className="alert alert-success mt-6 py-2 text-sm"><span>Hozircha siz yetakchisiz!</span></div>
      )}
      {isOwner && (
        <div className="alert mt-6 py-2 text-sm"><span>Bu — sizning auksioningiz. O'zingiz taklif qila olmaysiz.</span></div>
      )}

      {isHighest && auction.status === 'awaiting_payment' && !payOrder && (
        <section className="mt-6 rounded-2xl border border-warning/40 bg-warning/10 p-5">
          <div className="text-sm font-bold">{'\u{1F389}'} Tabriklaymiz — siz g'olib bo'ldingiz!</div>
          <p className="mt-1 text-sm text-base-content/60">
            {fmt(auction.currentPrice)} so'mni <b>{dateTime(new Date(auction.paymentDeadline).getTime())}</b> gacha (24 soat ichida) to'lashingiz kerak, aks holda auksion bekor bo'ladi va akkauntingiz 72 soatga bloklanadi.
          </p>
          <input
            value={winnerName}
            onChange={(e) => setWinnerName(e.target.value)}
            placeholder="Profilingizdagi ismingiz"
            className="input input-bordered input-sm mt-3 w-full max-w-xs bg-base-100"
          />
          <div>
            <button className="btn btn-primary btn-sm mt-3" onClick={payNow} disabled={busy}>
              {busy ? <span className="loading loading-spinner loading-xs"></span> : `To'lash \u2014 ${fmt(auction.currentPrice)} so'm`}
            </button>
          </div>
        </section>
      )}
      {payOrder && (
        <section className="mt-6 rounded-2xl border border-white/10 p-5">
          <a href={payOrder.payLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
            To'lovga o'tish &rarr;
          </a>
          <p className="mt-2 flex items-center gap-2 text-xs text-base-content/45">
            <span className="loading loading-spinner loading-xs"></span> To'lov kutilmoqda...
          </p>
        </section>
      )}

      {auction.status === 'active' && !isOwner && (
        <section className="mt-6 rounded-2xl border border-white/10 p-5">
          <div className="text-sm font-bold">Narx taklif qilish</div>
          <p className="mt-1 text-xs text-base-content/50">
            Taklif berish bepul — real to'lovni faqat g'olib bo'lsangiz, 24 soat ichida qilasiz.
          </p>
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
        </section>
      )}
      {msg && <div className={`alert mt-4 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{msg.text}</span></div>}

      <section className="mt-8">
        <div className="text-sm font-bold">Takliflar tarixi ({bids.length})</div>
        <div className="mt-3 space-y-2">
          {bids.length === 0 && <div className="text-sm text-base-content/45">Hali taklif yo'q — birinchi bo'ling.</div>}
          {bids.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-2.5 text-sm">
              <span className="text-base-content/60">
                {b.userId === auction.highestBidderId ? '\uD83D\uDC51 ' : ''}
                {b.bidderCode ? `NFC ID: ${b.bidderCode}` : `Foydalanuvchi #${b.userId}`}
              </span>
              <span className="font-semibold">{fmt(b.amount)} so'm</span>
              <span className="text-xs text-base-content/40">{timeAgo(new Date(b.createdAt).getTime())}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
