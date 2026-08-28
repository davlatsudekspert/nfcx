import { useEffect, useState } from 'react';
import { dbListAuctions, dbRequestAuction } from '../lib/db.js';
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
// murojaat qiladi — real auksion emas, faqat taklif.
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
    <div className="mt-10 rounded-2xl border border-accent/25 bg-accent/5 p-5">
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

export default function AuctionsPage() {
  const { t } = useLanguage();
  const [auctions, setAuctions] = useState(null);

  useEffect(() => {
    let stop = false;
    const load = () => dbListAuctions().then((list) => { if (!stop) setAuctions(list); });
    load();
    const timer = setInterval(load, 8000);
    return () => { stop = true; clearInterval(timer); };
  }, []);

  const cardCls = 'cursor-pointer rounded-2xl border border-white/10 bg-base-200/60 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-base-200';

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
            {t("Egalari o'z raqamli tashrif qog'ozi kodlarini auksionga qo'yishadi. Taklif berish bepul — g'olib chiqsangiz, 24 soat ichida real so'mda to'laysiz.")}
          </p>
        </div>
        <div className="hidden justify-self-center lg:flex">
          <Interactive3DCard>
            <NfcCard code={auctions?.[0]?.code || 'VIP001'} name={t("G'OLIB SIZ BO'LING")} finish="showcase" size="lg" rim />
          </Interactive3DCard>
        </div>
      </section>

      <section className="mt-10">
        {auctions === null && <div className="py-10 text-center text-base-content/45">{t('Yuklanmoqda...')}</div>}
        {auctions !== null && auctions.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-base-content/50">
            {t("Hozircha faol auksion yo'q.")}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(auctions || []).map((a) => (
            <button key={a.id} className={cardCls} onClick={() => navigate('/auksion/' + a.id)}>
              <div className="font-mono text-sm font-bold tracking-wide">nfcstore.uz/{a.code.toLowerCase()}</div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-xs text-base-content/50">{t('Joriy narx')}</span>
                <b className="text-lg">{t("{n} so'm", { n: fmt(a.currentPrice) })}</b>
              </div>
              {a.buyNowPrice && (
                <div className="mt-1 flex items-baseline justify-between text-xs text-base-content/50">
                  <span>{t('Darhol sotib olish')}</span>
                  <span>{t("{n} so'm", { n: fmt(a.buyNowPrice) })}</span>
                </div>
              )}
              <div className="mt-3 text-xs font-semibold text-accent">{timeLeft(a.endsAt, t)}</div>
            </button>
          ))}
        </div>
      </section>

      <RequestAuctionForm />
    </main>
  );
}
