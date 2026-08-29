import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useAuth, authLogout, authUpdateCard } from '../lib/auth.jsx';
import { dbUploadImage, dbUploadAudio, dbSetPrimary, dbOrderPhysicalCard, dbRequestPremium, dbGetPayment, dbListWonPendingAuctions, dbGiftCard, dbListGiftOffers, dbAcceptGift, dbRejectGift, dbCancelGift, dbSendSupportMessage, dbListMySupportMessages, dbListReferrals, dbListPosts, dbCreatePost, dbDeletePost } from '../lib/db.js';
import { navigate } from '../lib/router.js';
import { fmt, timeAgo, initials } from '../lib/format.js';
import { useLanguage } from '../lib/i18n.jsx';
import { isYoutubeMusic } from '../lib/music.js';
import { MESSAGING_ENABLED, PAYMENTS_ENABLED } from '../lib/features.js';
import PaymentUnavailableNotice from '../components/PaymentUnavailableNotice.jsx';
import { vzStyle } from './ProfilePage.jsx';
import NfcCard from '../components/NfcCard.jsx';
import { tierForCode } from '../lib/pricing.js';
const CardDesignerPage = lazy(() => import('./CardDesignerPage.jsx'));
import {
  IconLinkedIn, IconInstagram, IconTelegram, IconFacebook, IconX,
  IconPhone, IconGlobe, IconTag, IconLink, IconChevronDown,
} from '../components/Icons.jsx';

const THEMES = [
  { id: 'classic', label: 'Classic', css: 'linear-gradient(160deg,#241e17,#15120f)', accent: '#d4af5a' },
  { id: 'midnight', label: 'Onyx', css: 'linear-gradient(160deg,#0e0e10,#000000)', accent: '#ffffff' },
  { id: 'emerald', label: 'Graphite', css: 'linear-gradient(160deg,#3c4044,#2b2e31)', accent: '#9fb3bd' },
  { id: 'royal', label: 'Platinum', css: 'linear-gradient(160deg,#f3f5f8,#dfe3e9)', accent: '#5b6b85' },
  { id: 'sunset', label: 'Ink', css: 'linear-gradient(160deg,#161c3a,#0a0d1c)', accent: '#8ea2ff' },
  { id: 'gold', label: 'Gold', css: 'linear-gradient(160deg,#3a2a0c,#1a1206)', accent: '#f0c04a' },
  { id: 'glass', label: 'Shaffof', css: 'linear-gradient(160deg,#2a2f36,#0b0d10)', accent: '#cbd5e1' },
];

// Yig'iladigan/ochiladigan bo'lim — uzun formani mantiqiy blokларга ажратади.
function Section({ title, subtitle, defaultOpen, openSignal, id, children }) {
  const [open, setOpen] = useState(!!defaultOpen);
  useEffect(() => { if (openSignal) setOpen(true); }, [openSignal]);
  return (
    <div id={id} className={`mt-4 overflow-hidden rounded-2xl border bg-base-200/30 backdrop-blur-sm transition-all duration-200 first:mt-0 ${open ? 'border-accent/25 shadow-[0_10px_35px_rgba(0,0,0,0.35)]' : 'border-white/10 hover:border-white/20'}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <div>
          <div className="text-sm font-bold">{title}</div>
          {subtitle && <div className="mt-0.5 text-xs text-base-content/45">{subtitle}</div>}
        </div>
        <span className={`shrink-0 text-base-content/50 transition-transform duration-200 ${open ? 'rotate-180 text-accent' : ''}`}>
          <IconChevronDown />
        </span>
      </button>
      {open && <div className="border-t border-white/10 px-4 pb-5 pt-4">{children}</div>}
    </div>
  );
}

// Tahrirlash paytida o'ng tomonda ko'rinadigan jonli telefon preview —
// ProfilePage'dagi haqiqiy fon/tema mantig'ini (vzStyle) qayta ishlatadi,
// shunda "qanday ko'rinadi" bilan haqiqiy profil bir xil bo'ladi.
function PhonePreview({ form, code }) {
  const { t } = useLanguage();
  const record = form;
  const socials = [
    form.tg && { Icon: IconTelegram, label: 'Telegram' },
    form.instagram && { Icon: IconInstagram, label: 'Instagram' },
    form.facebook && { Icon: IconFacebook, label: 'Facebook' },
    form.twitter && { Icon: IconX, label: 'X' },
    form.website && { Icon: IconGlobe, label: t('Veb-sayt') },
    form.linkedin && { Icon: IconLinkedIn, label: 'LinkedIn' },
    form.cardNumber && { Icon: IconTag, label: t('Karta') },
    form.phone && { Icon: IconPhone, label: t('Tel') },
  ].filter(Boolean);

  return (
    <div className="sticky top-6">
      <div className="mx-auto w-[260px] rounded-[34px] border-[6px] border-[#1c1c1f] bg-[#1c1c1f] shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
        <div className="relative h-[520px] overflow-hidden rounded-[28px]" style={vzStyle(form.theme || 'classic', record)}>
          <div className="pointer-events-none absolute left-1/2 top-2 h-4 w-20 -translate-x-1/2 rounded-full bg-black/70"></div>
          <div className="h-full overflow-y-auto px-4 pb-6 pt-9 text-center text-[color:var(--vz-ink)]">
            <div className="mx-auto inline-flex items-center gap-1 rounded-full border border-[color:var(--vz-line)] bg-[color:var(--vz-card)] px-2.5 py-0.5 font-mono text-[9px] font-bold text-[color:var(--vz-ink)]">
              # {code}
            </div>
            <div className="mx-auto mt-3 flex h-[64px] w-[64px] items-center justify-center overflow-hidden rounded-full border-2 border-[color:var(--vz-card)] bg-gradient-to-br from-[#dfe3e6] to-[#cfd4d8] text-[18px] font-bold text-[#565c62] shadow-[0_0_0_1px_var(--vz-line)]">
              {form.avatarUrl ? <img src={form.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials(form.name)}
            </div>
            <div className="mt-2.5 text-[14px] font-bold leading-tight">{form.name || t('Ismingiz')}</div>
            {form.role && <div className="mt-0.5 text-[10.5px] text-[color:var(--vz-ink-dim)]">{form.role}</div>}
            {form.about && <p className="mx-auto mt-1.5 max-w-[190px] text-[9.5px] leading-snug text-[color:var(--vz-ink-dim)]">{form.about}</p>}

            {form.hashtags && (
              <div className="mt-2.5 flex flex-wrap justify-center gap-x-2 gap-y-0.5 text-[8.5px] font-semibold text-[color:var(--vz-accent)]">
                {form.hashtags.split(',').map((h) => h.trim()).filter(Boolean).map((h) => <span key={h}>#{h}</span>)}
              </div>
            )}

            <div className="mx-auto mt-4 flex max-w-[210px] flex-col gap-1.5">
              {socials.length === 0 && (
                <div className="rounded-lg border border-dashed border-[color:var(--vz-line)] px-3 py-3 text-[9px] text-[color:var(--vz-ink-faint)]">
                  {t("Aloqa maydonlarini to'ldirsangiz, tugmalar shu yerda ko'rinadi")}
                </div>
              )}
              {socials.map(({ Icon, label }) => (
                <div key={label} className="flex items-center justify-center gap-1.5 rounded-lg bg-[color:var(--vz-pill)] px-3 py-2 text-[10px] font-bold text-white">
                  <Icon width={11} height={11} /> {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-base-content/40">{t("Jonli oldindan ko'rish — real vaqtda yangilanadi")}</p>
    </div>
  );
}

// Rasmini klientda siqish: max 512px, JPEG ~85% (yuklash tez bo'lishi uchun).
function fileToCompressedDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Fayl oqilmadi.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Rasm formati noto\u2019g\u2019ri.'));
      img.onload = () => {
        const max = 512;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Audio fayllar siqilmaydi (rasm kabi canvas orqali qayta ishlab bo'lmaydi) —
// shunchaki base64 data URL sifatida o'qiladi, hajm serverda tekshiriladi.
function audioFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Fayl oqilmadi.'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

const PREMIUM_FEE = 5000;

// Premium profilga o'tish — real Payme to'lovi (5000 so'm). E-wallet yo'q:
// to'lov tasdiqlangach status avtomatik "Premium"ga o'zgaradi (admin
// tasdig'i shart emas, chunki Payme to'lovning o'zi tasdiq beradi).
// Foydalanuvchi auksionda yutgan, hali to'lamagan kodlari — aniq
// ogohlantirish bilan: 24 soatda to'lamasa auksion bekor bo'ladi VA
// akkaunt 72 soatga bloklanadi.
// Kelgan va yuborilgan sovg'a takliflari — qabul qilish/rad etish/bekor
// qilish shu yerdan boshqariladi.
function GiftOffersPanel({ onChanged }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = () => dbListGiftOffers().then(setData).catch(() => setData({ incoming: [], outgoing: [] }));
  useEffect(() => {
    load();
    const timer = setInterval(load, 8000);
    return () => clearInterval(timer);
  }, []);

  const accept = async (id) => {
    setBusy(id);
    try { await dbAcceptGift(id); await load(); onChanged?.(); }
    catch { alert(t("Qabul qilib bo'lmadi — taklif allaqachon ishlangan bo'lishi mumkin.")); }
    finally { setBusy(null); }
  };
  const reject = async (id) => {
    setBusy(id);
    try { await dbRejectGift(id); await load(); } finally { setBusy(null); }
  };
  const cancel = async (id) => {
    setBusy(id);
    try { await dbCancelGift(id); await load(); } finally { setBusy(null); }
  };

  if (!data || (data.incoming.length === 0 && data.outgoing.length === 0)) return null;

  return (
    <section className="pt-8">
      <h2 className="text-xl font-bold">{'\u{1F381}'} {t("Sovg'a takliflari")}</h2>
      <div className="mt-3 space-y-2">
        {data.incoming.map((g) => (
          <div key={'in' + g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
            <span><b className="font-mono">{g.code}</b> — <span className="text-base-content/60">{g.fromEmail}</span> {t('sizga sovg‘a qilmoqchi')}</span>
            <div className="flex gap-1.5">
              <button className="btn btn-success btn-xs" disabled={busy === g.id} onClick={() => accept(g.id)}>{t('Qabul qilish')}</button>
              <button className="btn btn-ghost btn-xs" disabled={busy === g.id} onClick={() => reject(g.id)}>{t('Rad etish')}</button>
            </div>
          </div>
        ))}
        {data.outgoing.map((g) => (
          <div key={'out' + g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm">
            <span><b className="font-mono">{g.code}</b> — <span className="text-base-content/60">{g.toEmail}</span>{t('ga yuborilgan, javob kutilmoqda')}</span>
            <button className="btn btn-ghost btn-xs" disabled={busy === g.id} onClick={() => cancel(g.id)}>{t('Bekor qilish')}</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function WonAuctionsPanel() {
  const { t } = useLanguage();
  const [list, setList] = useState(null);
  const [, tick] = useState(0);

  useEffect(() => {
    const load = () => dbListWonPendingAuctions().then(setList).catch(() => setList([]));
    load();
    const timer = setInterval(load, 10000);
    const ticker = setInterval(() => tick((n) => n + 1), 1000);
    return () => { clearInterval(timer); clearInterval(ticker); };
  }, []);

  if (!list || list.length === 0) return null;

  return (
    <section className="pt-8">
      <h2 className="text-xl font-bold">{'\u{1F3C6}'} {t('Yutgan auksionlaringiz')}</h2>
      <div className="mt-3 space-y-3">
        {list.map((a) => {
          const msLeft = new Date(a.paymentDeadline).getTime() - Date.now();
          const h = Math.max(0, Math.floor(msLeft / 3600000));
          const m = Math.max(0, Math.floor((msLeft % 3600000) / 60000));
          return (
            <div key={a.id} className="rounded-2xl border border-warning/40 bg-warning/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-mono text-sm font-bold">nfcstore.uz/{a.code.toLowerCase()}</div>
                  <div className="text-xs text-base-content/60">{t("Siz g'olib bo'ldingiz — {n} so'm", { n: fmt(a.currentPrice) })}</div>
                </div>
                {PAYMENTS_ENABLED
                  ? <button className="btn btn-warning btn-sm" onClick={() => navigate('/auksion/' + a.id)}>{t("To'lov qiling")}</button>
                  : <button className="btn btn-sm btn-disabled !cursor-not-allowed opacity-60" disabled aria-disabled="true">{t("To'lov qiling")}</button>}
              </div>
              {PAYMENTS_ENABLED ? (
                <p className="mt-2 text-xs font-semibold text-warning">
                  {'\u26A0\uFE0F'} {t("Diqqat: {h} soat {m} daqiqa ichida to'lov qilmasangiz, auksion bekor bo'ladi va akkauntingiz 72 soatga bloklanadi.", { h, m })}
                </p>
              ) : (
                <div className="mt-2"><PaymentUnavailableNotice compact /></div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PremiumPanel({ user, onBecamePremium }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [order, setOrder] = useState(null);

  useEffect(() => {
    if (!order) return;
    const timer = setInterval(async () => {
      try {
        const st = await dbGetPayment(order.orderId);
        if (st.status === 'paid') {
          clearInterval(timer);
          setOrder(null);
          setMsg({ type: 'ok', text: t("To'lov tasdiqlandi — siz endi Premium foydalanuvchisiz!") });
          onBecamePremium?.();
        } else if (st.status === 'cancelled') {
          clearInterval(timer);
          setOrder(null);
          setMsg({ type: 'err', text: t("To'lov bekor qilindi.") });
        }
      } catch { /* keyingi urinishda qayta tekshiramiz */ }
    }, 3000);
    return () => clearInterval(timer);
  }, [order]);

  if (user?.isPremium) {
    return (
      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-5">
        <div className="flex items-center gap-2 text-lg font-extrabold text-accent">{'\u2B50'} {t("Siz premium foydalanuvchisiz")}</div>
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await dbRequestPremium();
      setOrder(res);
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-base-200/60 p-5">
      <div className="text-sm font-bold">{t("Premium profilga o'ting")}</div>
      <p className="mt-1 text-xs text-base-content/50">
        {t("Premium profil — bu maxsus maqom belgisi: profilingiz oltin rangda, yonida ")}{'\u{1F451}'}{t(" qirol emoji bilan chiqadi va boshqalarga ko'zga yaqqol tashlanadi. O'tish narxi: ")}<b>{fmt(PREMIUM_FEE)} so'm</b>{t(" (bir martalik, real to'lov).")}
      </p>
      {!PAYMENTS_ENABLED ? (
        <>
          <button className="btn btn-accent btn-sm mt-3 btn-disabled !cursor-not-allowed opacity-60" disabled aria-disabled="true">
            {t("To'lash \u2014 {n} so'm", { n: fmt(PREMIUM_FEE) })}
          </button>
          <div className="mt-3"><PaymentUnavailableNotice /></div>
        </>
      ) : !order ? (
        <button className="btn btn-accent btn-sm mt-3" onClick={submit} disabled={busy}>
          {busy ? <span className="loading loading-spinner loading-xs"></span> : t("To'lash \u2014 {n} so'm", { n: fmt(PREMIUM_FEE) })}
        </button>
      ) : (
        <div className="mt-3">
          <a href={order.payLink} target="_blank" rel="noopener noreferrer" className="btn btn-accent btn-sm">
            {t("To'lovga o'tish")} &rarr;
          </a>
          <p className="mt-2 flex items-center gap-2 text-xs text-base-content/45">
            <span className="loading loading-spinner loading-xs"></span> {t("To'lov kutilmoqda...")}
          </p>
        </div>
      )}
      {msg && <div className={`alert mt-3 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{msg.text}</span></div>}
    </div>
  );
}

// Profil postlarini boshqarish — rasm + izoh joylash, o'chirish.
// Rasm yuklashdan oldin foydalanuvchi qonuniy ogohlantirishni tasdiqlashi shart.
function PostsManager({ code }) {
  const { t } = useLanguage();
  const [posts, setPosts] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    dbListPosts(code).then(setPosts).catch(() => setPosts([]));
  }, [code]);

  const onPick = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!agreed) {
      setMsg({ type: 'err', text: t('Avval quyidagi shartni belgilang.') });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setUploading(true);
    setMsg(null);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      const url = await dbUploadImage(dataUrl);
      setImageUrl(url);
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const publish = async () => {
    if (!imageUrl) { setMsg({ type: 'err', text: t('Avval rasm yuklang.') }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const post = await dbCreatePost(code, { imageUrl, caption: caption.trim() });
      setPosts((list) => [post, ...(list || [])]);
      setImageUrl(''); setCaption(''); setAgreed(false);
      setMsg({ type: 'ok', text: t('Post joylandi.') });
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!confirm(t('Bu postni o‘chirasizmi?'))) return;
    try {
      await dbDeletePost(id);
      setPosts((list) => (list || []).filter((p) => p.id !== id));
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  };

  const inp = 'input input-bordered input-sm mt-1 w-full bg-base-100';
  return (
    <div>
      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-base-content/55">{t('Yangi post')}</div>

        <label className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-base-content/70">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="checkbox checkbox-xs mt-0.5 shrink-0" />
          <span>{t('Men joylayotgan rasm O‘zbekiston Respublikasi qonunchiligiga zid emasligini tasdiqlayman. Diniy targ‘ibot, pornografik va axloq normalariga zid tasvirlar, giyohvand moddalar, spirtli ichimliklar hamda tamaki mahsulotlari reklamasi, zo‘ravonlik, kamsitish va boshqa noqonuniy mazmundagi rasmlarni joylash qat’iyan taqiqlanadi. Qoidaga rioya qilinmasa, post o‘chiriladi va NFC ID bloklanishi mumkin.')}</span>
        </label>

        <div className="mt-3">
          <input ref={fileRef} type="file" accept="image/*" onChange={onPick} disabled={!agreed || uploading} className="file-input file-input-bordered file-input-sm w-full bg-base-100 disabled:opacity-50" />
          {uploading && <p className="mt-1 flex items-center gap-2 text-xs text-base-content/45"><span className="loading loading-spinner loading-xs"></span> {t('Rasm yuklanmoqda...')}</p>}
          {imageUrl && <img src={imageUrl} alt="" className="mt-2 max-h-52 rounded-lg border border-white/10 object-cover" />}
        </div>

        <textarea value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 600))} placeholder={t('Izoh (ixtiyoriy)')} rows={2} className="textarea textarea-bordered textarea-sm mt-2 w-full bg-base-100" />

        <button type="button" className="btn btn-accent btn-sm mt-3 w-full" onClick={publish} disabled={!agreed || !imageUrl || busy}>
          {busy ? <span className="loading loading-spinner loading-xs"></span> : t('Joylash')}
        </button>
        {msg && <div className={`alert mt-3 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{msg.text}</span></div>}
      </div>

      <div className="mt-4 space-y-2">
        {posts === null && <p className="text-xs text-base-content/45">{t('Yuklanmoqda...')}</p>}
        {posts !== null && posts.length === 0 && <p className="text-xs text-base-content/45">{t('Hali post yo‘q')}</p>}
        {(posts || []).map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 p-2">
            <img src={p.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs text-base-content/70">{p.caption || <span className="text-base-content/35">{t('(izohsiz)')}</span>}</div>
              <div className="text-[10px] text-base-content/40">{timeAgo(p.createdAt)} · {'\u{1F90D}'} {p.likeCount}</div>
            </div>
            <button type="button" className="btn btn-ghost btn-xs shrink-0 text-error" onClick={() => remove(p.id)}>{t('O‘chirish')}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Umumiy markazlashgan modal (SupportModal uslubi).
function Modal({ title, onClose, children, wide }) {
  const { t } = useLanguage();
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`my-6 w-full rounded-2xl border border-white/10 bg-base-200 p-6 shadow-2xl ${wide ? 'max-w-4xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button className="btn btn-ghost btn-xs" onClick={onClose}>&times;</button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

const PHYSICAL_CARD_FEE_UZS = 200_000;

// Curated profil kartasi ranglari — NfcCard FINISHES kalitlari.
const CARD_FINISHES = [
  { id: 'auto', label: 'Avtomatik (tarif bo‘yicha)', css: 'linear-gradient(135deg,#3a3834,#1f1e1c)' },
  { id: 'tier-exclusive', label: 'Ekslyuziv (tilla-qora)', css: 'linear-gradient(145deg,#3a3834,#1f1e1c)' },
  { id: 'black', label: 'Qora', css: 'linear-gradient(135deg,#201a10,#0a0908)' },
  { id: 'silver', label: 'Kumush', css: 'linear-gradient(135deg,#f4f4f5,#d6d7d9)' },
  { id: 'tier-gold', label: 'Tilla', css: 'linear-gradient(135deg,#f0c419,#a9840f)' },
  { id: 'graphite', label: 'Grafit', css: 'linear-gradient(135deg,#3a3730,#201f1a)' },
  { id: 'tier-premium', label: 'Platina', css: 'linear-gradient(145deg,#eef0f2,#b9bcc4)' },
  { id: 'tier-free', label: 'Zumrad', css: 'linear-gradient(135deg,#22352a,#14201a)' },
];

// "Karta dizayni" modali — 2 tab: profil kartasi (rang/matn/fon) va bosma karta.
function CardDesignModal({ card, onClose, onSaved, initialTab = 'profile' }) {
  const { t } = useLanguage();
  const [tab, setTab] = useState(initialTab);
  const d = card.cardDesign || {};
  const [finish, setFinish] = useState(d.finish || 'auto');
  const [name, setName] = useState(d.name || '');
  const [bgUrl, setBgUrl] = useState(d.bgUrl || '');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);

  const autoTier = tierForCode(card.code);
  const previewFinish = finish && finish !== 'auto' ? finish : ('tier-' + autoTier);

  const onPick = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true); setMsg(null);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      const url = await dbUploadImage(dataUrl);
      setBgUrl(url);
    } catch (err) { setMsg({ type: 'err', text: err.message }); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const cardDesign = (finish !== 'auto' || name.trim() || bgUrl)
        ? { finish, name: name.trim(), bgUrl }
        : null;
      // Server validatsiyasi to'liq profil obyektini kutadi (ism majburiy) —
      // shuning uchun mavjud maydonlarni ham yuboramiz, faqat cardDesign yangi.
      await authUpdateCard(card.code, {
        name: card.name, role: card.role || '', avatarUrl: card.avatarUrl || '',
        bgUrl: card.bgUrl || '', accentColor: card.accentColor || '', bgColor: card.bgColor || '',
        bgAnimated: card.bgAnimated !== false, linksTransparent: !!card.linksTransparent,
        musicUrl: card.musicUrl || '', tg: card.tg || '', phone: card.phone || '', hidePhone: !!card.hidePhone,
        email: card.email || '', linkedin: card.linkedin || '', instagram: card.instagram || '',
        facebook: card.facebook || '', twitter: card.twitter || '', website: card.website || '',
        about: card.about || '', cardNumber: card.cardNumber || '',
        extraLinks: card.extraLinks || [], cardNumbers: card.cardNumbers || [],
        theme: card.theme || 'classic', hashtags: card.hashtags || [],
        cardDesign,
      });
      setMsg({ type: 'ok', text: t('Saqlandi.') });
      onSaved?.();
      setTimeout(onClose, 500);
    } catch (err) { setMsg({ type: 'err', text: err.message || t('Saqlashda xatolik yuz berdi.') }); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={'\u{1F3A8} ' + t('Karta dizayni')} onClose={onClose} wide>
      <div className="mb-4 flex gap-1 border-b border-white/10">
        <button className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === 'profile' ? 'border-accent text-accent' : 'border-transparent text-base-content/50'}`} onClick={() => setTab('profile')}>
          {t('Profil kartasi')}
        </button>
        <button className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === 'print' ? 'border-accent text-accent' : 'border-transparent text-base-content/50'}`} onClick={() => setTab('print')}>
          {t('Bosma karta')}
        </button>
      </div>

      {tab === 'profile' && (
        <div className="grid gap-5 md:grid-cols-[1fr_280px]">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-base-content/45">{t('Karta rangi')}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {CARD_FINISHES.map((f) => (
                <button key={f.id} type="button" title={t(f.label)} onClick={() => setFinish(f.id)}
                  className={`h-8 w-8 shrink-0 rounded-lg border transition ${finish === f.id ? 'ring-2 ring-white ring-offset-2 ring-offset-base-200' : 'border-white/15'}`}
                  style={{ background: f.css }} />
              ))}
            </div>
            <div className="mt-1.5 text-xs text-base-content/45">{t(CARD_FINISHES.find((f) => f.id === finish)?.label || '')}</div>

            <label className="form-control mt-4 block">
              <span className="text-xs font-semibold text-base-content/70">{t('Kartadagi ism (bo‘sh — profil ismi)')}</span>
              <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder={card.name} className="input input-bordered input-sm mt-1 w-full bg-base-100" />
            </label>

            <div className="mt-4">
              <span className="text-xs font-semibold text-base-content/70">{t('Karta foni rasmi (ixtiyoriy)')}</span>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="file-input file-input-bordered file-input-sm bg-base-100" disabled={uploading} />
                {bgUrl && <button type="button" className="btn btn-ghost btn-xs" onClick={() => setBgUrl('')}>{t('Olib tashlash')}</button>}
              </div>
              {uploading && <p className="mt-1 text-xs text-base-content/45"><span className="loading loading-spinner loading-xs"></span> {t('Rasm yuklanmoqda...')}</p>}
            </div>

            <button className="btn btn-primary btn-sm mt-5" onClick={save} disabled={busy || uploading}>
              {busy ? <span className="loading loading-spinner loading-xs"></span> : t('Saqlash')}
            </button>
            {msg && <div className={`alert mt-3 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{msg.text}</span></div>}
          </div>

          <div className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="text-[11px] uppercase tracking-wider text-base-content/40">{t('Oldindan ko‘rish')}</div>
            <NfcCard code={card.code} name={name || card.name} finish={previewFinish} bgImage={bgUrl || ''} size="sm" since={card.ts} />
          </div>
        </div>
      )}

      {tab === 'print' && (
        <div>
          <div className="mb-4 rounded-xl border border-accent/30 bg-accent/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold">{'\u{1F4E6}'} {t('Jismoniy NFC karta buyurtma berish')}</div>
                <p className="mt-1 text-xs text-base-content/50">{t('Dizaynni tayyorlab, chop etilgan haqiqiy NFC kartani pochta orqali olasiz.')}</p>
              </div>
              <div className="text-right text-lg font-extrabold text-accent">{t("{n} so'm", { n: fmt(PHYSICAL_CARD_FEE_UZS) })}</div>
            </div>
            <button className="btn btn-accent btn-sm mt-3 w-full btn-disabled !cursor-not-allowed opacity-60" disabled aria-disabled="true">
              {t("Buyurtma berish — {n} so'm", { n: fmt(PHYSICAL_CARD_FEE_UZS) })}
            </button>
            <div className="mt-3"><PaymentUnavailableNotice /></div>
          </div>
          <CardDesignerPage embedded code={card.code} />
        </div>
      )}
    </Modal>
  );
}

function EditCardForm({ card, onSaved }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    name: card.name,
    role: card.role || '',
    avatarUrl: card.avatarUrl || '',
    bgUrl: card.bgUrl || '',
    
    accentColor: card.accentColor || '',
    bgColor: card.bgColor || '',
    bgAnimated: card.bgAnimated !== false,
    linksTransparent: !!card.linksTransparent,
    musicUrl: card.musicUrl || '',
    tg: card.tg || '',
    phone: card.phone || '',
    hidePhone: !!card.hidePhone,
    email: card.email || '',
    linkedin: card.linkedin || '',
    instagram: card.instagram || '',
    facebook: card.facebook || '',
    twitter: card.twitter || '',
    website: card.website || '',
    about: card.about || '',
    cardNumber: card.cardNumber || '',
    extraLinks: (card.extraLinks && card.extraLinks.length) ? card.extraLinks.map((l) => ({ ...l })) : [],
    cardNumbers: (card.cardNumbers && card.cardNumbers.length) ? card.cardNumbers.map((c) => ({ ...c })) : [],
    theme: card.theme || 'classic',
    hashtags: (card.hashtags || []).join(', '),
  });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const [saleMsg, setSaleMsg] = useState(null);
  const fileRef = useRef(null);
  const bgFileRef = useRef(null);
  const musicFileRef = useRef(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const addLink = () => setForm((f) => ({ ...f, extraLinks: [...f.extraLinks, { label: '', url: '' }] }));
  const updateLink = (i, key) => (e) => setForm((f) => {
    const list = f.extraLinks.map((l, idx) => (idx === i ? { ...l, [key]: e.target.value } : l));
    return { ...f, extraLinks: list };
  });
  const removeLink = (i) => setForm((f) => ({ ...f, extraLinks: f.extraLinks.filter((_, idx) => idx !== i) }));

  const addCardNum = () => setForm((f) => ({ ...f, cardNumbers: [...f.cardNumbers, { label: '', number: '' }] }));
  const updateCardNum = (i, key) => (e) => setForm((f) => {
    const list = f.cardNumbers.map((c, idx) => (idx === i ? { ...c, [key]: e.target.value } : c));
    return { ...f, cardNumbers: list };
  });
  const removeCardNum = (i) => setForm((f) => ({ ...f, cardNumbers: f.cardNumbers.filter((_, idx) => idx !== i) }));

  const onPickFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      const url = await dbUploadImage(dataUrl);
      setForm((f) => ({ ...f, avatarUrl: url }));
      setMsg({ type: 'ok', text: t('Rasm yuklandi. Saqlash tugmasini bosing.') });
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onPickBgFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploadingBg(true);
    setMsg(null);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      const url = await dbUploadImage(dataUrl);
      setForm((f) => ({ ...f, bgUrl: url }));
      setMsg({ type: 'ok', text: t('Fon rasmi yuklandi. Saqlash tugmasini bosing.') });
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setUploadingBg(false);
      if (bgFileRef.current) bgFileRef.current.value = '';
    }
  };

  const onPickMusicFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setMsg({ type: 'err', text: t("Musiqa fayli juda katta (maksimal ~8 MB).") });
      if (musicFileRef.current) musicFileRef.current.value = '';
      return;
    }
    setUploadingMusic(true);
    setMsg(null);
    try {
      const dataUrl = await audioFileToDataUrl(file);
      const url = await dbUploadAudio(dataUrl);
      setForm((f) => ({ ...f, musicUrl: url }));
      setMsg({ type: 'ok', text: t('Musiqa yuklandi. Saqlash tugmasini bosing.') });
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setUploadingMusic(false);
      if (musicFileRef.current) musicFileRef.current.value = '';
    }
  };

  const [giftOpen, setGiftOpen] = useState(false);
  const [giftToCode, setGiftToCode] = useState('');
  const [giftBusy, setGiftBusy] = useState(false);
  const [giftMsg, setGiftMsg] = useState(null);
  const [postModal, setPostModal] = useState(false);
  const [designModal, setDesignModal] = useState(null); // null | 'profile' | 'print'
  const sendGift = async () => {
    if (!giftToCode.trim()) { setGiftMsg({ type: 'err', text: t("Qabul qiluvchining NFC ID'sini kiriting.") }); return; }
    setGiftBusy(true);
    setGiftMsg(null);
    try {
      await dbGiftCard(card.code, giftToCode.trim().toUpperCase());
      setGiftMsg({ type: 'ok', text: t("Sovg'a taklifi yuborildi — qabul qiluvchi tasdiqlagach, egalik o'tadi.") });
      setGiftToCode('');
      onSaved(card);
    } catch (err) {
      setGiftMsg({ type: 'err', text: err.message });
    } finally {
      setGiftBusy(false);
    }
  };

  const [primaryBusy, setPrimaryBusy] = useState(false);
  const makePrimary = async () => {
    setPrimaryBusy(true);
    setSaleMsg(null);
    try {
      await dbSetPrimary(card.code);
      onSaved({ ...card, isPrimary: true });
      setSaleMsg({ type: 'ok', text: t("Asosiy profil sifatida belgilandi.") });
    } catch (err) {
      setSaleMsg({ type: 'err', text: err.message });
    } finally {
      setPrimaryBusy(false);
    }
  };

  const submit = async () => {
    if (!form.name.trim()) { setMsg({ type: 'err', text: t("Ism bo'sh bo'lmasligi kerak.") }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const updated = await authUpdateCard(card.code, {
        name: form.name.trim(),
        role: form.role.trim(),
        avatarUrl: form.avatarUrl.trim(),
        bgUrl: form.bgUrl.trim(),
        accentColor: form.accentColor,
        bgColor: form.bgColor,
        bgAnimated: form.bgAnimated,
        linksTransparent: form.linksTransparent,
        musicUrl: form.musicUrl.trim(),
        tg: form.tg.trim(),
        phone: form.phone.trim(),
        hidePhone: form.hidePhone,
        email: form.email.trim(),
        linkedin: form.linkedin.trim(),
        instagram: form.instagram.trim(),
        facebook: form.facebook.trim(),
        twitter: form.twitter.trim(),
        website: form.website.trim(),
        about: form.about,
        cardNumber: form.cardNumber.trim(),
        extraLinks: form.extraLinks
          .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
          .filter((l) => l.url),
        cardNumbers: form.cardNumbers
          .map((c) => ({ label: c.label.trim(), number: c.number.trim() }))
          .filter((c) => c.number),
        theme: form.theme,
        hashtags: form.hashtags.split(',').map((h) => h.trim()).filter(Boolean),
      });
      setMsg({ type: 'ok', text: t('Saqlandi! Profilingiz yangilandi.') });
      onSaved(updated);
    } catch (err) {
      const text = err.message === 'unauthorized'
        ? t('Avval tizimga kiring.')
        : err.message === 'forbidden'
          ? t("Bu raqamli tashrif qog'ozi sizga tegishli emas.")
          : t("Saqlashda xatolik yuz berdi.");
      setMsg({ type: 'err', text });
    } finally {
      setBusy(false);
    }
  };

  const inp = 'input input-bordered input-sm mt-1 w-full bg-base-100';

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-base-200/60 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-sm font-bold tracking-wide">
            nfcstore.uz/{card.code.toLowerCase()}
            {card.isPrimary && <span className="badge badge-accent badge-xs">{t("ASOSIY")}</span>}
          </div>
          <div className="mt-1 text-xs text-base-content/50">
            {t("{n} so'm", { n: fmt(card.price) })} · {timeAgo(card.ts)} · {t("{n} ko'rish", { n: fmt(card.views || 0) })}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/' + card.code)}>{t("Ko'rish")}</button>
          {!card.isPrimary && (
            <button className="btn btn-ghost btn-sm" onClick={makePrimary} disabled={primaryBusy}>
              {primaryBusy ? <span className="loading loading-spinner loading-xs"></span> : t('Asosiy qilish')}
            </button>
          )}
          {card.giftable !== false && (
            <button className="btn btn-outline btn-sm" onClick={() => setGiftOpen((o) => !o)}>
              {'\u{1F381}'} {t("Sovg'a qilish")}
            </button>
          )}
          <button className="btn btn-outline btn-sm" onClick={() => setPostModal(true)}>
            {'\u{1F4DD}'} {t('Post')}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => setDesignModal('profile')}>
            {'\u{1F3A8}'} {t('Karta dizayni')}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => setDesignModal('print')}>
            {'\u{1F4B3}'} {t('NFC ID buyurtma berish')}
          </button>
        </div>
      </div>

      {postModal && (
        <Modal title={'\u{1F4DD}' + ' ' + t('Postlar')} onClose={() => setPostModal(false)}>
          <PostsManager code={card.code} />
        </Modal>
      )}
      {designModal && (
        <CardDesignModal
          card={card}
          initialTab={designModal}
          onClose={() => setDesignModal(null)}
          onSaved={onSaved}
        />
      )}
      {giftOpen && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <input
            value={giftToCode}
            onChange={(e) => setGiftToCode(e.target.value)}
            placeholder={t("Qabul qiluvchining NFC ID'si (masalan ABZ007)")}
            className="input input-bordered input-sm flex-1 bg-base-100 font-mono"
          />
          <button className="btn btn-accent btn-sm" onClick={sendGift} disabled={giftBusy}>
            {giftBusy ? <span className="loading loading-spinner loading-xs"></span> : t('Taklif yuborish')}
          </button>
          <p className="w-full text-xs text-base-content/45">{t("Pulsiz — qabul qiluvchi o'zi tasdiqlaguncha egalik o'tmaydi. U albatta o'z NFC ID'siga (mavjud profiliga) ega bo'lishi kerak.")}</p>
        </div>
      )}
      {giftMsg && <div className={`alert mt-3 py-2 text-sm ${giftMsg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(giftMsg.text)}</span></div>}
      {saleMsg && <div className={`alert mt-4 py-2 text-sm ${saleMsg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(saleMsg.text)}</span></div>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0">
          <Section title={t("Asosiy ma'lumot")} subtitle={t("Ism, kasb, bio va rasm")} defaultOpen>
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-base-100 font-bold">
                {form.avatarUrl
                  ? <img src={form.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                  : <span>{initials(form.name)}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickFile} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current && fileRef.current.click()} disabled={uploading}>
                  {uploading ? <span className="loading loading-spinner loading-xs"></span> : t('Rasm tanlash')}
                </button>
                <p className="mt-2 text-xs text-base-content/45">{t("JPG/PNG. Avtomatik kichraytiriladi. Yoki quyida havola qoldiring.")}</p>
                <input className={`${inp} font-mono text-xs`} value={form.avatarUrl} onChange={set('avatarUrl')} placeholder={t("https://... yoki /uploads/...")} />
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="form-control"><span className="text-xs font-semibold text-base-content/70">{t("Ism *")}</span><input value={form.name} onChange={set('name')} className={inp} /></label>
              <label className="form-control"><span className="text-xs font-semibold text-base-content/70">{t("Kasb / sarlavha")}</span><input value={form.role} onChange={set('role')} className={inp} /></label>
            </div>
            <label className="form-control mt-3 block">
              <span className="text-xs font-semibold text-base-content/70">{t("O'zingiz haqingizda (bio)")}</span>
              <textarea rows={3} value={form.about} onChange={set('about')} placeholder={t("Qisqacha o'zingiz haqingizda...")} className="textarea textarea-bordered mt-1 w-full bg-base-100" />
            </label>
          </Section>

          <Section title={t("Dizayn va fon")} subtitle={t("Tema, fon rasmi, naqsh")}>
            <div className="font-mono text-[11px] uppercase tracking-widest text-base-content/45">{t("Tema")}</div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {THEMES.map((th) => (
                <button key={th.id} type="button"
                  className={`cursor-pointer rounded-xl border p-3 text-sm font-semibold transition-all ${form.theme === th.id ? 'border-base-content/70 ring-2 ring-white/30' : 'border-white/10 hover:border-white/30'}`}
                  style={{ background: th.css }}
                  onClick={() => setForm((f) => ({ ...f, theme: th.id, bgColor: '', bgUrl: '' }))}>
                  <span style={{ color: th.accent }}>{th.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-5 font-mono text-[11px] uppercase tracking-widest text-base-content/45">{t("Fon rasmi")}</div>
            <div className="mt-2 flex items-start gap-4">
              <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-white/15 bg-base-100">
                {form.bgUrl
                  ? <img src={form.bgUrl} alt="fon" className="h-full w-full object-cover" />
                  : <div className="flex h-full w-full items-center justify-center text-[10px] text-base-content/40">{t("Standart")}</div>}
              </div>
              <div className="min-w-0 flex-1">
                <input ref={bgFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickBgFile} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => bgFileRef.current && bgFileRef.current.click()} disabled={uploadingBg}>
                    {uploadingBg ? <span className="loading loading-spinner loading-xs"></span> : t('Fon rasmi tanlash')}
                  </button>
                  {form.bgUrl && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm((f) => ({ ...f, bgUrl: '' }))}>
                      {t('Standart fonga qaytarish')}
                    </button>
                  )}
                </div>
                <p className="mt-2 text-xs text-base-content/45">{t("O'z rasmingizni qo'ysangiz, u tema fonining o'rniga ishlatiladi.")}</p>
                <input className={`${inp} font-mono text-xs`} value={form.bgUrl} onChange={set('bgUrl')} placeholder={t("https://... yoki /uploads/...")} />
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <input
                type="color"
                value={form.accentColor || '#f5a524'}
                onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))}
                className="h-9 w-9 cursor-pointer rounded-lg border border-white/15 bg-transparent p-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-base-content/70">{t("Istalgan aksent rang")}</div>
                <p className="mt-0.5 text-xs text-base-content/45">{t("Tugmalar va urg'u rangi shu bilan almashadi — tema tanlovidan mustaqil.")}</p>
              </div>
              {form.accentColor && (
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => setForm((f) => ({ ...f, accentColor: '' }))}>
                  {t('Andozaga qaytarish')}
                </button>
              )}
            </div>

            <div className="mt-5 flex items-center gap-3">
              <input
                type="color"
                value={form.bgColor || '#1a1a1c'}
                onChange={(e) => setForm((f) => ({ ...f, bgColor: e.target.value }))}
                className="h-9 w-9 cursor-pointer rounded-lg border border-white/15 bg-transparent p-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-base-content/70">{t("Profil fon rangi")}</div>
                <p className="mt-0.5 text-xs text-base-content/45">{t("Aksent rangdan mustaqil — butun profil foni shu rangda (sekin qimirlab turadigan gradient bilan) chiqadi. Diqqat: bu tanlangan temaning o'z fonidan ustun turadi — yuqoridagi temalardan birini qayta bossangiz, bu rang avtomatik tozalanadi.")}</p>
              </div>
              {form.bgColor && (
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => setForm((f) => ({ ...f, bgColor: '' }))}>
                  {t('Andozaga qaytarish')}
                </button>
              )}
            </div>
            {form.bgColor && (
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="checkbox checkbox-sm" checked={form.bgAnimated} onChange={(e) => setForm((f) => ({ ...f, bgAnimated: e.target.checked }))} />
                <span>{t("Fon sekin qimirlab (animatsiyali) tursin")}</span>
              </label>
            )}

            <label className="mt-4 flex cursor-pointer items-start gap-2.5">
              <input type="checkbox" className="checkbox checkbox-sm mt-0.5" checked={form.linksTransparent} onChange={(e) => setForm((f) => ({ ...f, linksTransparent: e.target.checked }))} />
              <span className="text-sm">
                {t("Havola tugmalarini shaffof qilish (shisha effekti)")}
                <span className="mt-0.5 block text-xs text-base-content/45">{t("Tugmalar yarim shaffof bo'lib, orqa fon ular ostidan ko'rinib turadi. Ustidan yorug'lik yugurish animatsiyasi har doim ishlaydi.")}</span>
              </span>
            </label>

            <label className="form-control mt-5 block">
              <span className="text-xs font-semibold text-base-content/70">{'\u{1F3B5}'} {t('Profil musiqasi')}</span>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <input ref={musicFileRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={onPickMusicFile} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => musicFileRef.current && musicFileRef.current.click()} disabled={uploadingMusic}>
                  {uploadingMusic ? <span className="loading loading-spinner loading-xs"></span> : t('Fayl yuklash (mp3, maks. 8 MB)')}
                </button>
                {form.musicUrl && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm((f) => ({ ...f, musicUrl: '' }))}>
                    {t('Olib tashlash')}
                  </button>
                )}
              </div>
              <input className={`${inp} font-mono text-xs`} value={form.musicUrl} onChange={set('musicUrl')} placeholder={t("YouTube havolasi yoki https://.../musiqa.mp3")} />
              {form.musicUrl && (
                isYoutubeMusic(form.musicUrl)
                  ? <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs text-red-400"><span>{'▶'}</span> {t('YouTube musiqasi ulandi — iPhone/Android hammasida ishlaydi.')}</div>
                  : <audio controls src={form.musicUrl} className="mt-2 h-9 w-full" />
              )}
              <p className="mt-1.5 text-xs text-base-content/45">{t("YouTube havolasini qo'ysangiz — fayl yuklamasdan, iPhone'da ham ishlaydi. Yoki to'g'ridan-to'g'ri .mp3 havolasi / fayl. Profilingizga kirgan odam pastdagi tugma orqali yoqib-o'chiradi.")}</p>
            </label>
          </Section>

          <Section title={t("Aloqa va ijtimoiy tarmoqlar")} subtitle={t("Telegram, Instagram, telefon va h.k.")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="form-control"><span className="text-xs font-semibold text-base-content/70">Telegram</span><input value={form.tg} onChange={set('tg')} placeholder="@username" className={inp} /></label>
              <label className="form-control"><span className="text-xs font-semibold text-base-content/70">Instagram</span><input value={form.instagram} onChange={set('instagram')} placeholder="@username" className={inp} /></label>
              <label className="form-control"><span className="text-xs font-semibold text-base-content/70">Facebook</span><input value={form.facebook} onChange={set('facebook')} placeholder={t("username yoki havola")} className={inp} /></label>
              <label className="form-control"><span className="text-xs font-semibold text-base-content/70">X (Twitter)</span><input value={form.twitter} onChange={set('twitter')} placeholder="@username" className={inp} /></label>
              <label className="form-control"><span className="text-xs font-semibold text-base-content/70">{t("Veb-sayt")}</span><input value={form.website} onChange={set('website')} placeholder="https://sayt.uz" className={inp} /></label>
              <label className="form-control"><span className="text-xs font-semibold text-base-content/70">LinkedIn</span><input value={form.linkedin} onChange={set('linkedin')} placeholder="linkedin.com/in/..." className={inp} /></label>
              <label className="form-control"><span className="text-xs font-semibold text-base-content/70">{t("Telefon")}</span><input value={form.phone} onChange={set('phone')} className={inp} /></label>
              <label className="form-control"><span className="text-xs font-semibold text-base-content/70">Email</span><input value={form.email} onChange={set('email')} className={inp} /></label>
            </div>
            {form.phone && (
              <label className="mt-3 flex cursor-pointer items-center gap-2.5">
                <input type="checkbox" className="checkbox checkbox-sm" checked={form.hidePhone} onChange={(e) => setForm((f) => ({ ...f, hidePhone: e.target.checked }))} />
                <span className="text-xs text-base-content/60">{t("Telefon raqamini profilda hammadan yashirish (faqat menga ko'rinsin)")}</span>
              </label>
            )}
          </Section>

          <Section title={t("To'lov kartalari")} subtitle={t("Profilda ko'rinadigan karta raqamlari")}>
            <label className="form-control block">
              <span className="text-xs font-semibold text-base-content/70">{t("Asosiy karta raqami")}</span>
              <input value={form.cardNumber} onChange={set('cardNumber')} placeholder="8600 1234 5678 9012" className={`${inp} font-mono`} />
            </label>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-base-content/55">{t("Qo'shimcha karta raqamlari")}</div>
              <div className="mt-3 space-y-2">
                {form.cardNumbers.map((c, i) => (
                  <div className="flex gap-2" key={i}>
                    <input value={c.label} onChange={updateCardNum(i, 'label')} placeholder={t("Nomi (masalan: Humo)")} className={`${inp} !mt-0`} />
                    <input value={c.number} onChange={updateCardNum(i, 'number')} placeholder="9860 1234 5678 9012" className={`${inp} !mt-0 font-mono`} />
                    <button type="button" className="btn btn-ghost btn-square btn-sm shrink-0" onClick={() => removeCardNum(i)}>&times;</button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-ghost btn-xs mt-3" onClick={addCardNum}>{t("+ Karta qo'shish")}</button>
            </div>
          </Section>

          <Section title={t("Qo'shimcha havolalar va hashtaglar")} subtitle={t("Portfolio, boshqa saytlar, teglar")}>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-base-content/55">{t("Qo'shimcha havolalar (istalgancha)")}</div>
              <div className="mt-3 space-y-2">
                {form.extraLinks.map((l, i) => (
                  <div className="flex gap-2" key={i}>
                    <input value={l.label} onChange={updateLink(i, 'label')} placeholder={t("Nomi (masalan: Portfolio)")} className={`${inp} !mt-0`} />
                    <input value={l.url} onChange={updateLink(i, 'url')} placeholder="https://..." className={`${inp} !mt-0 font-mono`} />
                    <button type="button" className="btn btn-ghost btn-square btn-sm shrink-0" onClick={() => removeLink(i)}>&times;</button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-ghost btn-xs mt-3" onClick={addLink}>{t("+ Havola qo'shish")}</button>
            </div>
            <label className="form-control mt-4 block">
              <span className="text-xs font-semibold text-base-content/70">{t("Hashtaglar (vergul bilan)")}</span>
              <input value={form.hashtags} onChange={set('hashtags')} className={inp} />
            </label>
          </Section>

          <button className="btn btn-primary mt-5 w-full sm:w-auto" onClick={submit} disabled={busy}>
            {busy ? <span className="loading loading-spinner loading-sm"></span> : t('Profilni saqlash')}
          </button>
          {msg && <div className={`alert mt-4 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(msg.text)}</span></div>}
        </div>

        <div className="hidden lg:block">
          <PhonePreview form={form} code={card.code} />
        </div>
      </div>

      {/* Mobil uchun preview forma tagida ko'rinadi */}
      <div className="mt-8 lg:hidden">
        <PhonePreview form={form} code={card.code} />
      </div>
    </div>
  );
}

const ORDER_STATUS_LABEL = {
  pending: { text: "To'lov kutilmoqda", cls: 'badge-warning' },
  paid: { text: "To'landi", cls: 'badge-success' },
  cancelled: { text: 'Bekor qilindi', cls: 'badge-ghost' },
  failed_code_taken: { text: "Kod band bo'lib qoldi — pul qaytariladi", cls: 'badge-error' },
};

// Profildagi "Adminga murojaat" — foydalanuvchi xabar yozadi, admin
// javob bersa shu yerda (o'tgan murojaatlar tarixida) ko'rinadi.
function SupportModal({ onClose }) {
  const { t } = useLanguage();
  const [history, setHistory] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = () => dbListMySupportMessages().then(setHistory).catch(() => setHistory([]));
  useEffect(() => { load(); }, []);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      await dbSendSupportMessage(text.trim());
      setText('');
      setMsg({ type: 'ok', text: t('Yuborildi — admin tez orada javob beradi.') });
      await load();
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-base-200 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{'\u2709\uFE0F'} {t('Adminga murojaat')}</h3>
          <button className="btn btn-ghost btn-xs" onClick={onClose}>&times;</button>
        </div>

        <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
          {history === null && <div className="text-sm text-base-content/40">{t('Yuklanmoqda...')}</div>}
          {history?.length === 0 && <div className="text-sm text-base-content/40">{t("Hozircha murojaatingiz yo'q.")}</div>}
          {history?.map((m) => (
            <div key={m.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
              <p className="text-base-content/80">{m.message}</p>
              {m.reply ? (
                <p className="mt-2 rounded-lg bg-accent/10 p-2 text-accent"><b>{t('Admin')}:</b> {m.reply}</p>
              ) : (
                <p className="mt-1 text-xs text-warning">{t('Kutilmoqda...')}</p>
              )}
            </div>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("Xabaringizni yozing...")}
          rows={3}
          className="textarea textarea-bordered mt-4 w-full bg-base-100"
        />
        <button className="btn btn-primary btn-sm mt-2 w-full" onClick={send} disabled={busy || !text.trim()}>
          {busy ? <span className="loading loading-spinner loading-xs"></span> : t('Yuborish')}
        </button>
        {msg && <div className={`alert mt-3 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(msg.text)}</span></div>}
      </div>
    </div>
  );
}

// Do'st taklif qilish — o'z promokodini ko'rsatadi, ulashadi, taklif
// qilingan do'stlar ro'yxatini va kutilayotgan chegirmani ko'rsatadi.
function ReferralPanel({ user }) {
  const { t } = useLanguage();
  const [referrals, setReferrals] = useState([]);
  const [copied, setCopied] = useState(false);
  useEffect(() => { dbListReferrals().then(setReferrals).catch(() => {}); }, []);

  if (!user.promoCode) return null;
  const link = `${window.location.origin}/register?promo=${user.promoCode}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* jim tur */ }
  };

  return (
    <section className="pt-8">
      <h2 className="text-xl font-bold">{'\u{1F91D}'} {t("Do'st taklif qiling")}</h2>
      <div className="mt-3 rounded-2xl border border-accent/25 bg-accent/5 p-5">
        <p className="text-sm text-base-content/70">
          {t("Do'stingiz shu havola orqali ro'yxatdan o'tsa, siz keyingi bandlashda avtomatik ")}<b className="text-accent">{t('15% chegirma')}</b>{t(' olasiz.')}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="rounded-lg bg-black/30 px-3 py-2 text-sm font-mono">{link}</code>
          <button className="btn btn-accent btn-sm" onClick={copy}>{copied ? t('Nusxalandi!') : t('Nusxalash')}</button>
        </div>
        {user.pendingDiscountPct > 0 && (
          <div className="mt-3 text-sm font-semibold text-success">
            {'\u2728'} {t('Sizda {p}% chegirma kutilmoqda — keyingi bandlashda avtomatik qo\'llanadi!', { p: user.pendingDiscountPct })}
          </div>
        )}
        {referrals.length > 0 && (
          <div className="mt-4 border-t border-white/10 pt-3">
            <div className="text-xs font-semibold text-base-content/50">{t('Taklif qilgan do\'stlaringiz')} ({referrals.length}):</div>
            <ul className="mt-1.5 space-y-1 text-xs text-base-content/60">
              {referrals.map((r) => <li key={r.id}>{r.referredEmail} — {timeAgo(new Date(r.createdAt).getTime())}</li>)}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

export default function AccountPage({ refreshCatalog }) {
  const { user, myCards, refresh } = useAuth();
  const { t } = useLanguage();
  const [selectedCode, setSelectedCode] = useState(null);
  useEffect(() => {
    if (myCards.length && !myCards.some((c) => c.code === selectedCode)) {
      setSelectedCode(myCards[0].code);
    }
  }, [myCards, selectedCode]);
  const selectedCard = myCards.find((c) => c.code === selectedCode) || myCards[0];
  const primaryCard = myCards.find((c) => c.isPrimary) || myCards[0];
  const [orders, setOrders] = useState([]);
  const [supportOpen, setSupportOpen] = useState(false);

  useEffect(() => {
    if (user === null) navigate('/login', { replace: true });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let stop = false;
    const load = async () => {
      try {
        const res = await fetch('/api/orders', { credentials: 'same-origin' });
        const data = await res.json();
        if (!stop) setOrders(Array.isArray(data.orders) ? data.orders : []);
      } catch { /* jim tur — kritik emas */ }
    };
    load();
    const timer = setInterval(load, 5000);
    return () => { stop = true; clearInterval(timer); };
  }, [user]);

  if (user === undefined || user === null) {
    return (
      <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pt-16 pb-16"><p className="text-base-content/60">{t('Yuklanmoqda...')}</p></main>
    );
  }

  // Auksionda g'olib chiqib, 24 soatda to'lamagan foydalanuvchi — 72 soat
  // akkauntga kirish taqiqlangan.
  if (user.bannedUntil) {
    const until = new Date(user.bannedUntil);
    return (
      <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pt-16 pb-16">
        <div className="mx-auto max-w-lg rounded-2xl border border-error/40 bg-error/10 p-7 text-center">
          <div className="text-3xl">{'\u26D4'}</div>
          <h1 className="mt-3 text-xl font-bold">{t('Akkauntingiz vaqtincha bloklangan')}</h1>
          <p className="mt-2 text-sm text-base-content/60">
            {t("Siz auksionda g'olib chiqib, 24 soat ichida to'lamadingiz. Shu sababli akkauntingiz ")}
            <b>{until.toLocaleString('uz-UZ')}</b> {t('gacha bloklangan.')}
          </p>
          <p className="mt-3 text-sm text-error">
            {t("Diqqat: bu takrorlansa, akkauntingiz doimiy bloklanishi yoki raqamli tashrif qog'ozilaringiz olib qo'yilishi mumkin.")}
          </p>
        </div>
      </main>
    );
  }

  const logout = async () => {
    await authLogout().catch(() => {});
    await refresh();
    refreshCatalog();
    navigate('/');
  };

  const onSaved = async () => {
    await refresh();
    refreshCatalog();
  };

  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pb-16">
      <section className="pt-14">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-base-content/45">{t('Kabinet')}</div>
            <h1 className="mt-1 text-2xl font-bold">{user.email}</h1>
            <p className="mt-1 text-sm text-base-content/55">
              {t('Sizning profilingiz:')}{' '}
              {myCards.length
                ? <b className="font-mono">{myCards.map((c) => 'nfcstore.uz/' + c.code.toLowerCase()).join(', ')}</b>
                : '—'}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/sozlamalar')}>{'\u2699\uFE0F'} {t('Sozlamalar')}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSupportOpen(true)}>{'\u2709\uFE0F'} {t('Adminga murojaat')}</button>
            <button className="btn btn-ghost btn-sm" onClick={logout}>{t('Chiqish')}</button>
          </div>
        </div>
      </section>

      <nav className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-base-200/55 p-2" aria-label={t('Kabinet bo‘limlari')}>
        <div className="flex min-w-max gap-1">
          <button className="btn btn-primary btn-sm min-h-11">{t('Hisob')}</button>
          <button className="btn btn-ghost btn-sm min-h-11" onClick={() => primaryCard && navigate('/' + primaryCard.code.toLowerCase())} disabled={!primaryCard}>{t('Profil')}</button>
          <button className="btn btn-ghost btn-sm min-h-11" onClick={() => navigate('/bildirishnomalar')}>{t('Bildirishnomalar')}</button>
          <button className="btn btn-ghost btn-sm min-h-11" onClick={() => MESSAGING_ENABLED && navigate('/xabarlar')} disabled={!MESSAGING_ENABLED}>{t(MESSAGING_ENABLED ? 'Xabarlar' : 'Xabarlar · tez orada')}</button>
          <button className="btn btn-ghost btn-sm min-h-11" onClick={() => navigate('/tolovlar')}>{t("To'lovlar")}</button>
          <button className="btn btn-ghost btn-sm min-h-11" onClick={() => navigate('/sozlamalar')}>{t('Sozlamalar')}</button>
        </div>
      </nav>

      {supportOpen && <SupportModal onClose={() => setSupportOpen(false)} />}

      <section className="pt-8">
        <PremiumPanel user={user} onBecamePremium={refresh} />
      </section>

      <GiftOffersPanel onChanged={refresh} />

      <ReferralPanel user={user} />

      <WonAuctionsPanel />

      {orders.filter((o) => o.status !== 'paid' && o.kind !== 'auction_payment').length > 0 && (
        <section className="pt-8">
          <h2 className="text-xl font-bold">{t('Buyurtmalarim')}</h2>
          <div className="mt-3 space-y-2">
            {orders.filter((o) => o.status !== 'paid' && o.kind !== 'auction_payment').map((o) => {
              const st = ORDER_STATUS_LABEL[o.status] || { text: o.status, cls: 'badge-ghost' };
              return (
                <div key={o.id} className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-sm">
                  <span className="font-mono">nfcstore.uz/{o.code.toLowerCase()}</span>
                  <span className="text-base-content/50">{t("{n} so'm", { n: fmt(o.price) })}</span>
                  <span className={`badge ${st.cls}`}>{t(st.text)}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="pt-8">
        <h2 className="text-xl font-bold">{t("Mening raqamli tashrif qog'ozilarim")}</h2>
        {myCards.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/15 p-10 text-center text-base-content/50">
            {t("Hozircha raqamli tashrif qog'ozingiz yo'q.")}{' '}
            <button className="cursor-pointer underline underline-offset-2 hover:text-base-content" onClick={() => navigate('/')}>
              {t('Bosh sahifada band qilish')} &rarr;
            </button>
          </div>
        ) : (
          <>
            {myCards.length > 1 && (
              <label className="form-control mt-4 block max-w-xs">
                <span className="text-xs font-semibold text-base-content/60">{t('Tahrirlash uchun ID tanlang')} ({myCards.length} {t('ta')})</span>
                <select
                  value={selectedCode || ''}
                  onChange={(e) => setSelectedCode(e.target.value)}
                  className="select select-bordered select-sm mt-1 w-full bg-base-100 font-mono"
                >
                  {myCards.map((c) => (
                    <option key={c.code} value={c.code}>{c.code}{c.isPrimary ? '  ★ ' + t('Asosiy') : ''}</option>
                  ))}
                </select>
              </label>
            )}
            {selectedCard && <EditCardForm key={selectedCard.code} card={selectedCard} onSaved={onSaved} />}
          </>
        )}
      </section>
    </main>
  );
}
