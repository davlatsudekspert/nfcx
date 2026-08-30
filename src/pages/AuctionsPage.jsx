import { useEffect, useMemo, useState } from 'react';
import { dbListAuctions, dbListAuctionDemand, dbVoteAuctionDemand, dbRequestAuction } from '../lib/db.js';
import { fmt } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import { useAuth } from '../lib/auth.jsx';
import { useLanguage } from '../lib/i18n.jsx';
import NfcCard from '../components/NfcCard.jsx';
import Interactive3DCard from '../components/Interactive3DCard.jsx';

function timeLeft(endsAt, t) {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return t('tugadi');
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) return t('{d} kun {h} soat qoldi', { d: Math.floor(h / 24), h: h % 24 });
  if (h > 0) return t('{h} soat {m} daqiqa qoldi', { h, m });
  return t('{m} daqiqa qoldi', { m });
}

// Foydalanuvchi "shu noyob nomni auksionga qo'ying" deb adminga
// murojaat qiladi — real auksion emas, faqat taklif (admin tasdiqlab
// "Talab" board'iga qo'shadi).
function RequestAuctionForm() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const submit = async () => {
    if (!user) { navigate('/login'); return; }
    if (!code.trim()) { setMsg({ type: 'err', text: t('Kodni kiriting.') }); return; }
    setBusy(true);
    setMsg(null);
    try {
      await dbRequestAuction(code.trim().toUpperCase(), note.trim());
      setMsg({ type: 'ok', text: t("So'rovingiz adminga yuborildi. Ko'rib chiqilgach, auksion ochiladi.") });
      setCode('');
      setNote('');
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-12 rounded-2xl border border-accent/25 bg-accent/5 p-5">
      <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setOpen((o) => !o)}>
        <div>
          <div className="text-sm font-bold">{'\u{1F451}'} {t("Noyob nomni auksionga qo'yishni so'rang")}</div>
          <p className="mt-0.5 text-xs text-base-content/50">{t("Sizga yoqqan bo'sh kod bormi? Adminga taklif qiling — u ko'rib chiqib, auksion ochadi.")}</p>
        </div>
        <span className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>&#9662;</span>
      </button>
      {open && (
        <div className="mt-4 space-y-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('Kod (masalan VIP007)')} className="input input-bordered input-sm w-full bg-base-100 font-mono" />
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Nega bu kod noyob deb hisoblaysiz? (ixtiyoriy)')} rows={2} className="textarea textarea-bordered textarea-sm w-full bg-base-100" />
          <button className="btn btn-accent btn-sm" onClick={submit} disabled={busy}>
            {busy ? <span className="loading loading-spinner loading-xs"></span> : t("So'rov yuborish")}
          </button>
          {msg && <div className={`alert py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(msg.text)}</span></div>}
        </div>
      )}
    </div>
  );
}

// "Talab" board kartasi — foydalanuvchi qiziqish bildiradi.
function DemandCard({ item, threshold, voteBusy, onVote, idx = 0 }) {
  const { t } = useLanguage();
  const ready = item.status === 'ready';
  const pct = Math.min(100, Math.round((item.interestCount / threshold) * 100));
  return (
    <div
      className={`auc-card tier-shine flex flex-col rounded-2xl p-5 ${ready ? 'is-ready' : ''}`}
      style={{ '--shine-delay': `${(idx % 6) * 0.6}s` }}
    >
      {ready && (
        <div className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-[11px] font-bold text-success">
          {t('AUKSIONNI BOSHLASH MUMKIN')}
        </div>
      )}
      <div className="py-3 text-center font-mono text-2xl font-extrabold tracking-[0.14em] text-[#f2d9a0]">
        {item.code}
      </div>
      <div className="mt-1 flex items-center justify-center gap-1.5 text-sm text-base-content/70">
        <span>{'\u{1F525}'}</span>
        <span>{t('{n} kishi qiziqmoqda', { n: item.interestCount })}</span>
      </div>
      <div className="mt-3">
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div className={`h-full rounded-full ${ready ? 'bg-success' : 'bg-[#e6c165]'}`} style={{ width: `${Math.max(4, pct)}%` }} />
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-base-content/45">
          <span>{ready ? t('Auksionga tayyor') : t('Talab yig’ilmoqda')}</span>
          <span>{item.interestCount} / {threshold}</span>
        </div>
      </div>
      <button
        className={`btn btn-sm mt-4 w-full ${item.voted ? 'btn-ghost text-success' : 'btn-primary'}`}
        disabled={item.voted || voteBusy}
        onClick={() => onVote(item)}
      >
        {voteBusy
          ? <span className="loading loading-spinner loading-xs"></span>
          : item.voted
            ? t('✓ Siz qiziqyapsiz')
            : <>{'\u{1F525}'} {t('Auksionda qatnashaman')}</>}
      </button>
    </div>
  );
}

// Faol / sotilgan auksion kartasi.
function AuctionMiniCard({ a, sold, idx = 0 }) {
  const { t } = useLanguage();
  return (
    <button
      className="auc-card tier-shine flex flex-col rounded-2xl p-5 text-left"
      style={{ '--shine-delay': `${(idx % 6) * 0.6}s` }}
      onClick={() => navigate('/auksion/' + a.id)}
    >
      <div className="py-3 text-center font-mono text-2xl font-extrabold tracking-[0.14em] text-[#f2d9a0]">
        {a.code}
      </div>
      <div className="mt-1 flex items-baseline justify-between text-sm">
        <span className="text-base-content/50">{sold ? t('Sotildi') : t('Joriy narx')}</span>
        <b className="text-base">{t("{n} so'm", { n: fmt(a.currentPrice) })}</b>
      </div>
      {!sold && (
        <div className="mt-3 text-xs font-semibold text-accent">{timeLeft(a.endsAt, t)}</div>
      )}
      <div className="mt-3 text-xs text-base-content/45">{sold ? t('Auksion yakunlandi') : t('Batafsil va taklif berish →')}</div>
    </button>
  );
}

const TAB_KEYS = ['collecting', 'ready', 'live', 'sold'];

export default function AuctionsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [demand, setDemand] = useState(null);
  const [threshold, setThreshold] = useState(20);
  const [auctions, setAuctions] = useState([]);
  const [sold, setSold] = useState([]);
  const [tab, setTab] = useState('collecting');
  const [voteBusy, setVoteBusy] = useState(null);

  useEffect(() => {
    let stop = false;
    const load = () => {
      dbListAuctionDemand().then((d) => { if (!stop) { setDemand(d.demand); setThreshold(d.threshold); } });
      dbListAuctions(true).then((d) => { if (!stop) { setAuctions(d.auctions); setSold(d.sold); } });
    };
    load();
    const timer = setInterval(load, 8000);
    return () => { stop = true; clearInterval(timer); };
  }, []);

  const collecting = useMemo(() => (demand || []).filter((d) => d.status === 'collecting'), [demand]);
  const ready = useMemo(() => (demand || []).filter((d) => d.status === 'ready'), [demand]);

  const counts = { collecting: collecting.length, ready: ready.length, live: auctions.length, sold: sold.length };

  // Bo'sh bo'lmagan birinchi tab'ni tanlaymiz (bir marta, yuklangач).
  useEffect(() => {
    if (demand === null) return;
    if (counts[tab] === 0) {
      const first = TAB_KEYS.find((k) => counts[k] > 0);
      if (first) setTab(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demand]);

  const vote = async (item) => {
    if (!user) { navigate('/login'); return; }
    setVoteBusy(item.id);
    try {
      const r = await dbVoteAuctionDemand(item.id);
      setDemand((prev) => (prev || []).map((d) => d.id === item.id
        ? { ...d, voted: true, interestCount: r.interestCount ?? d.interestCount, status: r.status || d.status }
        : d));
    } catch { /* jim — keyingi poll to'g'irlaydi */ }
    finally { setVoteBusy(null); }
  };

  const topDemand = useMemo(
    () => [...collecting, ...ready].sort((a, b) => b.interestCount - a.interestCount).slice(0, 5),
    [collecting, ready]
  );

  const TABS = [
    { key: 'collecting', label: t("Talab yig’ilmoqda") },
    { key: 'ready', label: t('Auksionga tayyor') },
    { key: 'live', label: t('Faol auksion') },
    { key: 'sold', label: t('Sotilgan') },
  ];

  const gridItems = tab === 'collecting' ? collecting
    : tab === 'ready' ? ready
    : tab === 'live' ? auctions
    : sold;

  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pb-16">
      <section className="grid items-center gap-10 pt-14 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wider text-base-content/70">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>
            {t('Auksion')}
          </span>
          <h1 className="mt-4 max-w-xl text-4xl font-extrabold leading-tight tracking-tight">
            {t('Noyob kodlar uchun')} <span className="bg-gradient-to-br from-white to-base-content/50 bg-clip-text text-transparent">{t('ochiq savdo')}</span>
          </h1>
          <p className="mt-3 max-w-xl text-[15px] text-base-content/60">
            {t("Yoqqan kodga “Auksionda qatnashaman” bosing. {n} kishi qiziqsa, admin auksionni boshlaydi.", { n: threshold })}
          </p>
        </div>
        <div className="hidden justify-self-center lg:flex">
          <Interactive3DCard>
            <NfcCard code={collecting[0]?.code || auctions[0]?.code || 'VIP001'} name={t("G'OLIB SIZ BO'LING")} finish="showcase" size="lg" rim />
          </Interactive3DCard>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map((x) => (
            <button
              key={x.key}
              onClick={() => setTab(x.key)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                tab === x.key
                  ? 'border-accent bg-accent/10 text-base-content'
                  : 'border-white/10 text-base-content/55 hover:text-base-content'
              }`}
            >
              {x.label}
              {counts[x.key] > 0 && <span className="ml-1.5 text-xs text-base-content/45">{counts[x.key]}</span>}
            </button>
          ))}
        </div>

        {demand === null && <div className="py-10 text-center text-base-content/45">{t('Yuklanmoqda...')}</div>}

        {demand !== null && gridItems.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-base-content/50">
            {tab === 'live' ? t("Hozircha faol auksion yo'q.")
              : tab === 'sold' ? t("Hozircha sotilgan auksion yo'q.")
              : tab === 'ready' ? t("Hozircha auksionga tayyor kod yo'q.")
              : t("Hozircha talab yig'ilayotgan kod yo'q.")}
          </div>
        )}

        <div className="auc-grid grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {(tab === 'collecting' || tab === 'ready') && gridItems.map((d, i) => (
            <DemandCard key={d.id} idx={i} item={d} threshold={threshold} voteBusy={voteBusy === d.id} onVote={vote} />
          ))}
          {tab === 'live' && gridItems.map((a, i) => <AuctionMiniCard key={a.id} idx={i} a={a} />)}
          {tab === 'sold' && gridItems.map((a, i) => <AuctionMiniCard key={a.id} idx={i} a={a} sold />)}
        </div>

        {topDemand.length > 1 && (
          <div className="mt-10 rounded-2xl border border-white/10 bg-base-200/40 p-5">
            <div className="text-sm font-bold">{t("Eng ko'p talab qilinayotgan NFC ID'lar")}</div>
            <ol className="mt-3 space-y-1.5">
              {topDemand.map((d, i) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="text-base-content/40">{i + 1}</span>
                    <span className="font-mono font-semibold">{d.code}</span>
                  </span>
                  <span className="text-base-content/55">{'\u{1F525}'} {t('{n} kishi', { n: d.interestCount })}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <RequestAuctionForm />
    </main>
  );
}
