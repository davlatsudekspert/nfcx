import { useEffect, useRef, useState } from 'react';
import { dbGetAuction, dbPlaceBid, dbPayAuctionWinner, dbGetPayment } from '../lib/db.js';
import { fmt, timeAgo, dateTime } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import { useAuth } from '../lib/auth.jsx';
import { useLanguage } from '../lib/i18n.jsx';
import { usePaymentsEnabled } from '../lib/paymentsEnabled.jsx';
import PaymentUnavailableNotice from '../components/PaymentUnavailableNotice.jsx';
import NfcCard from '../components/NfcCard.jsx';
import Interactive3DCard from '../components/Interactive3DCard.jsx';

function timeLeft(endsAt, t) {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return t('tugadi');
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h >= 24) return t('{d} kun {h} soat', { d: Math.floor(h / 24), h: h % 24 });
  if (h > 0) return t('{h}soat {m}daq', { h, m });
  return t('{m}daq {s}son', { m, s });
}

const STATUS_LABEL = {
  active: { text: 'Faol', cls: 'badge-success', vz: 'vz-badge--ok' },
  awaiting_payment: { text: "To'lov kutilmoqda", cls: 'badge-warning', vz: 'vz-badge--warn' },
  sold: { text: 'Sotildi', cls: 'badge-accent', vz: 'vz-badge--gold' },
  expired: { text: "Taklifsiz tugadi", cls: 'badge-ghost', vz: 'vz-badge--muted' },
  payment_expired: { text: "To'lov muddati o'tdi", cls: 'badge-error', vz: 'vz-badge--warn' },
  cancelled: { text: 'Bekor qilindi', cls: 'badge-ghost', vz: 'vz-badge--muted' },
};

export default function AuctionPage({ id }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const PAYMENTS_ENABLED = usePaymentsEnabled();
  const [data, setData] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // loading | ready | notfound | error
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [payOrder, setPayOrder] = useState(null);
  const [winnerName, setWinnerName] = useState('');
  const [winnerPhone, setWinnerPhone] = useState('');
  const [, tick] = useState(0);
  const idemRef = useRef(null);

  const load = () => dbGetAuction(id)
    .then((d) => {
      if (!d || !d.auction) { setData(null); setLoadState('notfound'); return; }
      setData(d);
      setLoadState('ready');
    })
    .catch((err) => {
      // 404 → topilmadi; tarmoq/server xatosi → qayta urinish taklifi.
      const notFound = err && /api_error_404|not_found/.test(String(err.message));
      // Polling paytida mavjud ma'lumot saqlanadi; faqat birinchi yuklashda holat o'zgaradi.
      setLoadState((prev) => (prev === 'ready' ? prev : (notFound ? 'notfound' : 'error')));
    });

  useEffect(() => {
    setLoadState('loading');
    load();
    const timer = setInterval(load, 5000);
    const ticker = setInterval(() => tick((n) => n + 1), 1000);
    return () => { clearInterval(timer); clearInterval(ticker); };
  }, [id]);

  useEffect(() => {
    if (!payOrder) return;
    const timer = setInterval(async () => {
      try {
        const st = await dbGetPayment(payOrder.orderId);
        if (st.status === 'paid') {
          clearInterval(timer);
          setPayOrder(null);
          setMsg({ type: 'ok', text: t("To'lov tasdiqlandi — tabriklaymiz, raqamli tashrif qog'ozi endi sizniki!") });
          await load();
        } else if (st.status === 'cancelled') {
          clearInterval(timer);
          setPayOrder(null);
          setMsg({ type: 'err', text: t("To'lov bekor qilindi.") });
        }
      } catch { /* keyingi urinishda qayta tekshiramiz */ }
    }, 3000);
    return () => clearInterval(timer);
  }, [payOrder]);

  if (data === null) {
    if (loadState === 'loading') {
      return (
        <main className="mx-auto w-full max-w-[1800px] px-6 pb-16 pt-16 sm:px-10 lg:px-14" aria-busy="true" aria-label={t('Yuklanmoqda...')}>
          <div className="vz-skel w-40" />
          <div className="vz-skel mt-4 w-72" style={{ height: 32 }} />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="vz-card p-5"><div className="vz-skel w-1/2" /><div className="vz-skel mt-3 w-3/4" style={{ height: 28 }} /></div>)}
          </div>
        </main>
      );
    }
    return (
      <main className="mx-auto w-full max-w-[1800px] px-6 pb-16 pt-16 sm:px-10 lg:px-14">
        <div className="vz-empty" role={loadState === 'error' ? 'alert' : undefined}>
          <b>{loadState === 'error' ? t("Server bilan aloqa yo'q") : t('Auksion topilmadi')}</b>
          <p className="text-sm">{loadState === 'error' ? t("Auksion ma'lumotini yuklab bo'lmadi.") : t("Bu auksion mavjud emas yoki o'chirilgan.")}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {loadState === 'error' && <button type="button" className="btn btn-gold btn-sm" onClick={() => { setLoadState('loading'); load(); }}>{t('Qayta urinish')}</button>}
            <button type="button" className="btn btn-outline-gold btn-sm" onClick={() => navigate('/auksion')}>{t('Auksionlarga qaytish')}</button>
          </div>
        </div>
      </main>
    );
  }

  const { auction, bids } = data;
  // "Faol" rozetkasi bilan "tugadi" hisoblagichi ZIDDIYATI (2026-09 hotfix).
  // Asosiy tuzatish backendda (muddati o'tgan auksion endi `active` bo'lib
  // qolmaydi — hosting/worker.js closeExpiredAuctionsD1), bu esa qo'shimcha
  // himoya: sahifa har 5 sekundda yangilanadi, shu oraliqda ham vaqt
  // tugagan auksion "Faol" ko'rinmasin va taklif formasi ochiq qolmasin.
  const endsAtMs = new Date(auction.endsAt).getTime();
  const timeIsUp = Number.isFinite(endsAtMs) && endsAtMs <= Date.now();
  const biddingOpen = auction.status === 'active' && !timeIsUp;
  const st = (auction.status === 'active' && timeIsUp)
    ? { text: 'Tugagan', cls: 'badge-ghost', vz: 'vz-badge--muted' }
    : (STATUS_LABEL[auction.status] || { text: auction.status, cls: 'badge-ghost', vz: 'vz-badge--muted' });
  // Minimal keyingi taklif: birinchi taklif = boshlang'ich narx; keyin joriy narx + qadam.
  const bidStep = Math.max(1000, Number(auction.minIncrement) || Math.round(Number(auction.currentPrice) * 0.02));
  const minNext = auction.highestBidderId
    ? Number(auction.currentPrice) + bidStep
    : Number(auction.currentPrice);
  const isOwner = user && user.id === auction.sellerId;
  const isHighest = user && user.id === auction.highestBidderId;

  const bid = async () => {
    if (!user) { navigate('/login'); return; }
    const val = Math.round(Number(amount));
    if (!val || val < minNext) { setMsg({ type: 'err', text: t("Taklif kamida {n} so'm bo'lishi kerak.", { n: fmt(minNext) }) }); return; }
    if (!idemRef.current) idemRef.current = crypto.randomUUID();
    setBusy(true);
    setMsg(null);
    try {
      const res = await dbPlaceBid(auction.id, val, idemRef.current);
      idemRef.current = null;
      setMsg({
        type: 'ok',
        text: res.buyNow
          ? t("Siz 'darhol sotib olish' narxiga yetdingiz — endi 24 soat ichida to'lashingiz kerak.")
          : res.antiSnipe
            ? t("Taklifingiz qabul qilindi! Tugash vaqti oxirgi daqiqada bo'lgani uchun +5 daqiqaga uzaytirildi.")
            : t("Taklifingiz qabul qilindi!"),
      });
      setAmount('');
      await load();
    } catch (err) {
      if (err.code && err.code !== 'SYSTEM') idemRef.current = null;
      // Server aniq minimal narxni qaytargan bo'lsa (BID_TOO_LOW), umumiy
      // matn o'rniga o'sha aniq summani ko'rsatamiz.
      setMsg({
        type: 'err',
        text: (err.code === 'BID_TOO_LOW' && err.minNext)
          ? t("Taklif kamida {n} so'm bo'lishi kerak.", { n: fmt(err.minNext) })
          : err.message,
      });
      // Auksion yopilgan/narx o'zgargan bo'lsa — holatni darhol yangilaymiz,
      // foydalanuvchi eskirgan narx bilan qayta urinmasin.
      if (err.code === 'AUCTION_ALREADY_CLOSED' || err.code === 'BID_TOO_LOW') await load();
    } finally {
      setBusy(false);
    }
  };

  const payNow = async () => {
    if (!winnerName.trim()) { setMsg({ type: 'err', text: t('Profilingiz uchun ismingizni kiriting.') }); return; }
    if (!winnerPhone.trim()) { setMsg({ type: 'err', text: t('Telefon raqamingizni kiriting.') }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const order = await dbPayAuctionWinner(auction.id, { name: winnerName.trim(), phone: winnerPhone.trim() });
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
          <button type="button" className="min-h-11 text-xs text-base-content/50 hover:text-base-content" onClick={() => navigate('/auksion')}>&larr; {t('Auksionlarga qaytish')}</button>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="vz-kicker">{t('Auksion')}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="break-all font-mono text-2xl font-bold tracking-wide">nfcstore.uz/{auction.code.toLowerCase()}</h1>
            <span className={`vz-badge ${st.vz}`}>{t(st.text)}</span>
          </div>
        </div>
        <div className="mt-6 hidden shrink-0 lg:mt-0 lg:block">
          <Interactive3DCard>
            <NfcCard code={auction.code} name={t("G'OLIB SIZ BO'LING")} finish={auction.status === 'sold' ? 'graphite' : 'showcase'} size="sm" />
          </Interactive3DCard>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="vz-card min-w-0 p-5">
          <div className="text-xs text-base-content/50">{t('Joriy narx')}</div>
          <div className="mt-1 break-words text-2xl font-extrabold">{fmt(auction.currentPrice)} <span className="text-sm font-normal text-base-content/50">{t("so'm")}</span></div>
        </div>
        <div className="vz-card min-w-0 p-5">
          <div className="text-xs text-base-content/50">{auction.status === 'active' ? t('Qolgan vaqt') : auction.status === 'awaiting_payment' ? t("To'lov muddati") : t('Yakunlangan')}</div>
          <div className="mt-1 text-2xl font-extrabold">
            {auction.status === 'active' ? timeLeft(auction.endsAt, t)
              : auction.status === 'awaiting_payment' ? timeLeft(auction.paymentDeadline, t)
              : '—'}
          </div>
        </div>
        <div className="vz-card min-w-0 p-5">
          <div className="text-xs text-base-content/50">{t('Darhol sotib olish')}</div>
          <div className="mt-1 break-words text-2xl font-extrabold">{auction.buyNowPrice ? t("{n} so'm", { n: fmt(auction.buyNowPrice) }) : '—'}</div>
        </div>
      </section>

      {isHighest && biddingOpen && (
        <div className="alert alert-success mt-6 py-2 text-sm"><span>{t('Hozircha siz yetakchisiz!')}</span></div>
      )}
      {isOwner && (
        <div className="alert mt-6 py-2 text-sm"><span>{t("Bu — sizning auksioningiz. O'zingiz taklif qila olmaysiz.")}</span></div>
      )}

      {isHighest && auction.status === 'awaiting_payment' && !payOrder && (
        <section className="mt-6 rounded-2xl border border-warning/40 bg-warning/10 p-5">
          <div className="text-sm font-bold">{t("Tabriklaymiz — siz g'olib bo'ldingiz!")}</div>
          <p className="mt-1 text-sm text-base-content/60">
            {t("{n} so'mni {deadline} gacha (24 soat ichida) to'lashingiz kerak, aks holda auksion bekor bo'ladi va akkauntingiz 72 soatga bloklanadi.", { n: fmt(auction.currentPrice), deadline: dateTime(new Date(auction.paymentDeadline).getTime()) })}
          </p>
          {PAYMENTS_ENABLED ? (
            <>
              <input
                value={winnerName}
                onChange={(e) => setWinnerName(e.target.value)}
                placeholder={t('Profilingizdagi ismingiz')}
                aria-label={t('Profilingizdagi ismingiz')}
                className="vz-input mt-3 max-w-xs"
              />
              <input
                value={winnerPhone}
                onChange={(e) => setWinnerPhone(e.target.value)}
                placeholder={t('Telefon raqamingiz (+998...)')}
                aria-label={t('Telefon raqamingiz (+998...)')}
                className="vz-input mt-2 max-w-xs"
              />
              <div>
                <button type="button" className="btn btn-gold mt-3" onClick={payNow} disabled={busy}>
                  {busy ? <span className="loading loading-spinner loading-xs"></span> : t("To'lash \u2014 {n} so'm", { n: fmt(auction.currentPrice) })}
                </button>
              </div>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-gold mt-3 btn-disabled !cursor-not-allowed opacity-60" disabled aria-disabled="true">
                {t("To'lash \u2014 {n} so'm", { n: fmt(auction.currentPrice) })}
              </button>
              <div className="mt-3"><PaymentUnavailableNotice /></div>
            </>
          )}
        </section>
      )}
      {payOrder && PAYMENTS_ENABLED && (
        <section className="vz-card mt-6 p-5">
          <a href={payOrder.payLink} target="_blank" rel="noopener noreferrer" className="btn btn-gold">
            {t("To'lovga o'tish")} &rarr;
          </a>
          <p className="mt-2 flex items-center gap-2 text-xs text-base-content/45">
            <span className="loading loading-spinner loading-xs"></span> {t("To'lov kutilmoqda...")}
          </p>
        </section>
      )}

      {auction.status === 'active' && timeIsUp && (
        <section className="vz-card mt-6 p-5">
          <div className="text-sm font-bold">{t('Auksion yakunlandi')}</div>
          <p className="mt-1 text-xs text-base-content/50">
            {t("Bu auksionning vaqti tugadi — yangi taklif qabul qilinmaydi. Natija bir necha soniyada yangilanadi.")}
          </p>
        </section>
      )}

      {biddingOpen && !isOwner && !PAYMENTS_ENABLED && (
        <section className="vz-card mt-6 p-5">
          <div className="text-sm font-bold">{t('Narx taklif qilish')}</div>
          <p className="mt-1 text-xs text-base-content/50">
            {t("Auksionda g'olib bo'lsangiz, 24 soat ichida to'lov qilish talab etiladi. To'lov tizimi vaqtincha to'xtatilgani uchun hozircha taklif berish yopiq.")}
          </p>
          <div className="mt-3"><PaymentUnavailableNotice /></div>
        </section>
      )}

      {biddingOpen && !isOwner && PAYMENTS_ENABLED && (
        <section className="vz-card mt-6 p-5">
          <div className="text-sm font-bold">{t('Narx taklif qilish')}</div>
          <p className="mt-1 text-xs text-base-content/50">
            {t("Taklif berish bepul — real to'lovni faqat g'olib bo'lsangiz, 24 soat ichida qilasiz.")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('kamida {n}', { n: fmt(minNext) })}
              aria-label={t('Narx taklif qilish')}
              className="vz-input w-full sm:w-48"
            />
            {/* Bu tarmoq faqat PAYMENTS_ENABLED === true bo'lganda
                render qilinadi, shuning uchun tugmada "Tez kunlarda"
                holati QATTIQ YOZILGAN ko'rinishda qolmaydi. */}
            <button type="button" className="btn btn-gold" onClick={bid} disabled={busy || !user}>
              {busy ? <span className="loading loading-spinner loading-xs"></span> : (user ? t('Taklif qilish') : t('Kirish kerak'))}
            </button>
            {auction.buyNowPrice && (
              <button type="button" className="btn btn-ghost-vz" onClick={() => setAmount(String(auction.buyNowPrice))} disabled={busy}>
                {t('Darhol sotib olish narxini yozish')}
              </button>
            )}
          </div>
        </section>
      )}
      {msg && <div role={msg.type === 'ok' ? 'status' : 'alert'} className={`alert mt-4 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(msg.text)}</span></div>}

      <section className="mt-8">
        <h2 className="vz-h2 text-xl">{t('Takliflar tarixi')} <span className="text-base font-normal text-base-content/40">({bids.length})</span></h2>
        <div className="mt-4 space-y-2">
          {bids.length === 0 && <div className="vz-empty"><b>{t("Hali taklif yo'q — birinchi bo'ling.")}</b></div>}
          {bids.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm">
              <span className="inline-flex min-w-0 items-center gap-1.5 text-base-content/60">
                {b.userId === auction.highestBidderId && <span className="vz-badge vz-badge--gold" style={{ padding: '2px 7px', fontSize: 10 }}>{t('Yetakchi')}</span>}
                <span className="truncate">{b.bidderCode ? `NFC ID: ${b.bidderCode}` : t('Foydalanuvchi #{id}', { id: b.userId })}</span>
              </span>
              <span className="font-semibold">{t("{n} so'm", { n: fmt(b.amount) })}</span>
              <span className="text-xs text-base-content/40">{timeAgo(new Date(b.createdAt).getTime())}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
