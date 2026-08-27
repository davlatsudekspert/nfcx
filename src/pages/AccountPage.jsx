import { useEffect, useRef, useState } from 'react';
import { useAuth, authLogout, authUpdateCard } from '../lib/auth.jsx';
import { dbUploadImage, dbUploadAudio, dbSetSale, dbSetPrimary, dbRequestPremium, dbGetPayment, dbListWonPendingAuctions, dbGiftCard, dbListGiftOffers, dbAcceptGift, dbRejectGift, dbCancelGift } from '../lib/db.js';
import { navigate } from '../lib/router.js';
import { fmt, timeAgo, initials } from '../lib/format.js';
import { vzStyle } from './ProfilePage.jsx';
import CardDesignerPage from './CardDesignerPage.jsx';
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
];

// Yig'iladigan/ochiladigan bo'lim — uzun formani mantiqiy blokларга ажратади.
function Section({ title, subtitle, defaultOpen, children }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className={`mt-4 overflow-hidden rounded-2xl border bg-base-200/30 backdrop-blur-sm transition-all duration-200 first:mt-0 ${open ? 'border-accent/25 shadow-[0_10px_35px_rgba(0,0,0,0.35)]' : 'border-white/10 hover:border-white/20'}`}>
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
  const record = form;
  const socials = [
    form.tg && { Icon: IconTelegram, label: 'Telegram' },
    form.instagram && { Icon: IconInstagram, label: 'Instagram' },
    form.facebook && { Icon: IconFacebook, label: 'Facebook' },
    form.twitter && { Icon: IconX, label: 'X' },
    form.website && { Icon: IconGlobe, label: 'Veb-sayt' },
    form.linkedin && { Icon: IconLinkedIn, label: 'LinkedIn' },
    form.cardNumber && { Icon: IconTag, label: 'Karta' },
    form.phone && { Icon: IconPhone, label: 'Tel' },
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
            <div className="mt-2.5 text-[14px] font-bold leading-tight">{form.name || 'Ismingiz'}</div>
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
                  Aloqa maydonlarini to'ldirsangiz, tugmalar shu yerda ko'rinadi
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
      <p className="mt-3 text-center text-[11px] text-base-content/40">Jonli oldindan ko'rish — real vaqtda yangilanadi</p>
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
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = () => dbListGiftOffers().then(setData).catch(() => setData({ incoming: [], outgoing: [] }));
  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  const accept = async (id) => {
    setBusy(id);
    try { await dbAcceptGift(id); await load(); onChanged?.(); }
    catch { alert("Qabul qilib bo'lmadi — taklif allaqachon ishlangan bo'lishi mumkin."); }
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
      <h2 className="text-xl font-bold">{'\u{1F381}'} Sovg'a takliflari</h2>
      <div className="mt-3 space-y-2">
        {data.incoming.map((g) => (
          <div key={'in' + g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
            <span><b className="font-mono">{g.code}</b> — <span className="text-base-content/60">{g.fromEmail}</span> sizga sovg'a qilmoqchi</span>
            <div className="flex gap-1.5">
              <button className="btn btn-success btn-xs" disabled={busy === g.id} onClick={() => accept(g.id)}>Qabul qilish</button>
              <button className="btn btn-ghost btn-xs" disabled={busy === g.id} onClick={() => reject(g.id)}>Rad etish</button>
            </div>
          </div>
        ))}
        {data.outgoing.map((g) => (
          <div key={'out' + g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm">
            <span><b className="font-mono">{g.code}</b> — <span className="text-base-content/60">{g.toEmail}</span>ga yuborilgan, javob kutilmoqda</span>
            <button className="btn btn-ghost btn-xs" disabled={busy === g.id} onClick={() => cancel(g.id)}>Bekor qilish</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function WonAuctionsPanel() {
  const [list, setList] = useState(null);
  const [, tick] = useState(0);

  useEffect(() => {
    const load = () => dbListWonPendingAuctions().then(setList).catch(() => setList([]));
    load();
    const t = setInterval(load, 10000);
    const ticker = setInterval(() => tick((n) => n + 1), 1000);
    return () => { clearInterval(t); clearInterval(ticker); };
  }, []);

  if (!list || list.length === 0) return null;

  return (
    <section className="pt-8">
      <h2 className="text-xl font-bold">{'\u{1F3C6}'} Yutgan auksionlaringiz</h2>
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
                  <div className="text-xs text-base-content/60">Siz g'olib bo'ldingiz — {fmt(a.currentPrice)} so'm</div>
                </div>
                <button className="btn btn-warning btn-sm" onClick={() => navigate('/auksion/' + a.id)}>To'lov qiling</button>
              </div>
              <p className="mt-2 text-xs font-semibold text-warning">
                {'\u26A0\uFE0F'} Diqqat: {h} soat {m} daqiqa ichida to'lov qilmasangiz, auksion bekor bo'ladi va akkauntingiz 72 soatga bloklanadi.
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PremiumPanel({ user, onBecamePremium }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [order, setOrder] = useState(null);

  useEffect(() => {
    if (!order) return;
    const t = setInterval(async () => {
      try {
        const st = await dbGetPayment(order.orderId);
        if (st.status === 'paid') {
          clearInterval(t);
          setOrder(null);
          setMsg({ type: 'ok', text: "To'lov tasdiqlandi — siz endi Premium foydalanuvchisiz!" });
          onBecamePremium?.();
        } else if (st.status === 'cancelled') {
          clearInterval(t);
          setOrder(null);
          setMsg({ type: 'err', text: "To'lov bekor qilindi." });
        }
      } catch { /* keyingi urinishda qayta tekshiramiz */ }
    }, 3000);
    return () => clearInterval(t);
  }, [order]);

  if (user?.isPremium) {
    return (
      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-accent">{'\u2B50'} Siz premium foydalanuvchisiz</div>
        <p className="mt-1 text-xs text-base-content/50">Profilingiz oltin/kumush belgi va {'\u{1F451}'} qirol emoji bilan ajralib turadi — sizga obuna bo'lish endi bepul.</p>
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
      <div className="text-sm font-bold">Premium profilga o'ting</div>
      <p className="mt-1 text-xs text-base-content/50">
        Premium profil — bu maxsus maqom belgisi: profilingiz oltin rangda, yonida {'\u{1F451}'} qirol emoji bilan chiqadi va boshqalarga ko'zga yaqqol tashlanadi. O'tish narxi: <b>{fmt(PREMIUM_FEE)} so'm</b> (bir martalik, real to'lov).
      </p>
      {!order ? (
        <button className="btn btn-accent btn-sm mt-3" onClick={submit} disabled={busy}>
          {busy ? <span className="loading loading-spinner loading-xs"></span> : `To'lov qilish \u2014 ${fmt(PREMIUM_FEE)} so'm`}
        </button>
      ) : (
        <div className="mt-3">
          <a href={order.payLink} target="_blank" rel="noopener noreferrer" className="btn btn-accent btn-sm">
            To'lovga o'tish &rarr;
          </a>
          <p className="mt-2 flex items-center gap-2 text-xs text-base-content/45">
            <span className="loading loading-spinner loading-xs"></span> To'lov kutilmoqda...
          </p>
        </div>
      )}
      {msg && <div className={`alert mt-3 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{msg.text}</span></div>}
    </div>
  );
}

function EditCardForm({ card, onSaved }) {
  const [form, setForm] = useState({
    name: card.name,
    role: card.role || '',
    avatarUrl: card.avatarUrl || '',
    bgUrl: card.bgUrl || '',
    
    accentColor: card.accentColor || '',
    bgColor: card.bgColor || '',
    bgAnimated: card.bgAnimated !== false,
    musicUrl: card.musicUrl || '',
    tg: card.tg || '',
    phone: card.phone || '',
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
      setMsg({ type: 'ok', text: 'Rasm yuklandi. Saqlash tugmasini bosing.' });
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
      setMsg({ type: 'ok', text: 'Fon rasmi yuklandi. Saqlash tugmasini bosing.' });
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
      setMsg({ type: 'err', text: "Musiqa fayli juda katta (maksimal ~8 MB)." });
      if (musicFileRef.current) musicFileRef.current.value = '';
      return;
    }
    setUploadingMusic(true);
    setMsg(null);
    try {
      const dataUrl = await audioFileToDataUrl(file);
      const url = await dbUploadAudio(dataUrl);
      setForm((f) => ({ ...f, musicUrl: url }));
      setMsg({ type: 'ok', text: 'Musiqa yuklandi. Saqlash tugmasini bosing.' });
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
  const sendGift = async () => {
    if (!giftToCode.trim()) { setGiftMsg({ type: 'err', text: "Qabul qiluvchining NFC ID'sini kiriting." }); return; }
    setGiftBusy(true);
    setGiftMsg(null);
    try {
      await dbGiftCard(card.code, giftToCode.trim().toUpperCase());
      setGiftMsg({ type: 'ok', text: "Sovg'a taklifi yuborildi — qabul qiluvchi tasdiqlagach, egalik o'tadi." });
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
      setSaleMsg({ type: 'ok', text: "Asosiy profil sifatida belgilandi." });
    } catch (err) {
      setSaleMsg({ type: 'err', text: err.message });
    } finally {
      setPrimaryBusy(false);
    }
  };

  const submit = async () => {
    if (!form.name.trim()) { setMsg({ type: 'err', text: "Ism bo'sh bo'lmasligi kerak." }); return; }
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
        musicUrl: form.musicUrl.trim(),
        tg: form.tg.trim(),
        phone: form.phone.trim(),
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
      setMsg({ type: 'ok', text: 'Saqlandi! Profilingiz yangilandi.' });
      onSaved(updated);
    } catch (err) {
      const text = err.message === 'unauthorized'
        ? 'Avval tizimga kiring.'
        : err.message === 'forbidden'
          ? "Bu raqamli tashrif qog'ozi sizga tegishli emas."
          : "Saqlashda xatolik yuz berdi.";
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
            {card.isPrimary && <span className="badge badge-accent badge-xs">ASOSIY</span>}
          </div>
          <div className="mt-1 text-xs text-base-content/50">
            {fmt(card.price)} so'm · {timeAgo(card.ts)} · {fmt(card.views || 0)} ko'rish
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/' + card.code)}>Ko'rish</button>
          {!card.isPrimary && (
            <button className="btn btn-ghost btn-sm" onClick={makePrimary} disabled={primaryBusy}>
              {primaryBusy ? <span className="loading loading-spinner loading-xs"></span> : 'Asosiy qilish'}
            </button>
          )}
          <button className="btn btn-outline btn-sm" onClick={() => setGiftOpen((o) => !o)}>
            {'\u{1F381}'} Sovg'a qilish
          </button>
        </div>
      </div>
      {giftOpen && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <input
            value={giftToCode}
            onChange={(e) => setGiftToCode(e.target.value)}
            placeholder="Qabul qiluvchining NFC ID'si (masalan ABZ007)"
            className="input input-bordered input-sm flex-1 bg-base-100 font-mono"
          />
          <button className="btn btn-accent btn-sm" onClick={sendGift} disabled={giftBusy}>
            {giftBusy ? <span className="loading loading-spinner loading-xs"></span> : 'Taklif yuborish'}
          </button>
          <p className="w-full text-xs text-base-content/45">Pulsiz — qabul qiluvchi o'zi tasdiqlaguncha egalik o'tmaydi. U albatta o'z NFC ID'siga (mavjud profiliga) ega bo'lishi kerak.</p>
        </div>
      )}
      {giftMsg && <div className={`alert mt-3 py-2 text-sm ${giftMsg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{giftMsg.text}</span></div>}
      {saleMsg && <div className={`alert mt-4 py-2 text-sm ${saleMsg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{saleMsg.text}</span></div>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0">
          <Section title="Asosiy ma'lumot" subtitle="Ism, kasb, bio va rasm" defaultOpen>
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-base-100 font-bold">
                {form.avatarUrl
                  ? <img src={form.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                  : <span>{initials(form.name)}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickFile} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current && fileRef.current.click()} disabled={uploading}>
                  {uploading ? <span className="loading loading-spinner loading-xs"></span> : 'Rasm tanlash'}
                </button>
                <p className="mt-2 text-xs text-base-content/45">JPG/PNG. Avtomatik kichraytiriladi. Yoki quyida havola qoldiring.</p>
                <input className={`${inp} font-mono text-xs`} value={form.avatarUrl} onChange={set('avatarUrl')} placeholder="https://... yoki /uploads/..." />
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="form-control"><span className="text-xs font-semibold text-base-content/70">Ism *</span><input value={form.name} onChange={set('name')} className={inp} /></label>
              <label className="form-control"><span className="text-xs font-semibold text-base-content/70">Kasb / sarlavha</span><input value={form.role} onChange={set('role')} className={inp} /></label>
            </div>
            <label className="form-control mt-3 block">
              <span className="text-xs font-semibold text-base-content/70">O'zingiz haqingizda (bio)</span>
              <textarea rows={3} value={form.about} onChange={set('about')} placeholder="Qisqacha o'zingiz haqingizda..." className="textarea textarea-bordered mt-1 w-full bg-base-100" />
            </label>
          </Section>

          <Section title="Dizayn va fon" subtitle="Tema, fon rasmi, naqsh">
            <div className="font-mono text-[11px] uppercase tracking-widest text-base-content/45">Tema</div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {THEMES.map((t) => (
                <button key={t.id} type="button"
                  className={`cursor-pointer rounded-xl border p-3 text-sm font-semibold transition-all ${form.theme === t.id ? 'border-base-content/70 ring-2 ring-white/30' : 'border-white/10 hover:border-white/30'}`}
                  style={{ background: t.css }}
                  onClick={() => setForm((f) => ({ ...f, theme: t.id, bgColor: '', bgUrl: '' }))}>
                  <span style={{ color: t.accent }}>{t.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-5 font-mono text-[11px] uppercase tracking-widest text-base-content/45">Fon rasmi</div>
            <div className="mt-2 flex items-start gap-4">
              <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-white/15 bg-base-100">
                {form.bgUrl
                  ? <img src={form.bgUrl} alt="fon" className="h-full w-full object-cover" />
                  : <div className="flex h-full w-full items-center justify-center text-[10px] text-base-content/40">Standart</div>}
              </div>
              <div className="min-w-0 flex-1">
                <input ref={bgFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickBgFile} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => bgFileRef.current && bgFileRef.current.click()} disabled={uploadingBg}>
                    {uploadingBg ? <span className="loading loading-spinner loading-xs"></span> : 'Fon rasmi tanlash'}
                  </button>
                  {form.bgUrl && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm((f) => ({ ...f, bgUrl: '' }))}>
                      Standart fonga qaytarish
                    </button>
                  )}
                </div>
                <p className="mt-2 text-xs text-base-content/45">O'z rasmingizni qo'ysangiz, u tema fonining o'rniga ishlatiladi.</p>
                <input className={`${inp} font-mono text-xs`} value={form.bgUrl} onChange={set('bgUrl')} placeholder="https://... yoki /uploads/..." />
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
                <div className="text-xs font-semibold text-base-content/70">Istalgan aksent rang</div>
                <p className="mt-0.5 text-xs text-base-content/45">Tugmalar va urg'u rangi shu bilan almashadi — tema tanlovidan mustaqil.</p>
              </div>
              {form.accentColor && (
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => setForm((f) => ({ ...f, accentColor: '' }))}>
                  Andozaga qaytarish
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
                <div className="text-xs font-semibold text-base-content/70">Profil fon rangi</div>
                <p className="mt-0.5 text-xs text-base-content/45">Aksent rangdan mustaqil — butun profil foni shu rangda (sekin qimirlab turadigan gradient bilan) chiqadi. <b>Diqqat:</b> bu tanlangan temaning o'z fonidan ustun turadi — yuqoridagi temalardan birini qayta bossangiz, bu rang avtomatik tozalanadi.</p>
              </div>
              {form.bgColor && (
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => setForm((f) => ({ ...f, bgColor: '' }))}>
                  Andozaga qaytarish
                </button>
              )}
            </div>
            {form.bgColor && (
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="checkbox checkbox-sm" checked={form.bgAnimated} onChange={(e) => setForm((f) => ({ ...f, bgAnimated: e.target.checked }))} />
                <span>Fon sekin qimirlab (animatsiyali) tursin</span>
              </label>
            )}

            <label className="form-control mt-5 block">
              <span className="text-xs font-semibold text-base-content/70">{'\u{1F3B5}'} Profil musiqasi</span>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <input ref={musicFileRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={onPickMusicFile} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => musicFileRef.current && musicFileRef.current.click()} disabled={uploadingMusic}>
                  {uploadingMusic ? <span className="loading loading-spinner loading-xs"></span> : 'Fayl yuklash (mp3, maks. 8 MB)'}
                </button>
                {form.musicUrl && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm((f) => ({ ...f, musicUrl: '' }))}>
                    Olib tashlash
                  </button>
                )}
              </div>
              <input className={`${inp} font-mono text-xs`} value={form.musicUrl} onChange={set('musicUrl')} placeholder="yoki havola: https://.../musiqa.mp3" />
              {form.musicUrl && (
                <audio controls src={form.musicUrl} className="mt-2 h-9 w-full" />
              )}
              <p className="mt-1.5 text-xs text-base-content/45">Profilingizga kirgan odam pastdagi tugma orqali yoqib-o'chira oladi (brauzerlar avtomatik ovozli ijroni bloklaydi).</p>
            </label>
          </Section>

          <Section title="Aloqa va ijtimoiy tarmoqlar" subtitle="Telegram, Instagram, telefon va h.k.">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="form-control"><span className="text-xs font-semibold text-base-content/70">Telegram</span><input value={form.tg} onChange={set('tg')} placeholder="@username" className={inp} /></label>
              <label className="form-control"><span className="text-xs font-semibold text-base-content/70">Instagram</span><input value={form.instagram} onChange={set('instagram')} placeholder="@username" className={inp} /></label>
              <label className="form-control"><span className="text-xs font-semibold text-base-content/70">Facebook</span><input value={form.facebook} onChange={set('facebook')} placeholder="username yoki havola" className={inp} /></label>
              <label className="form-control"><span className="text-xs font-semibold text-base-content/70">X (Twitter)</span><input value={form.twitter} onChange={set('twitter')} placeholder="@username" className={inp} /></label>
              <label className="form-control"><span className="text-xs font-semibold text-base-content/70">Veb-sayt</span><input value={form.website} onChange={set('website')} placeholder="https://sayt.uz" className={inp} /></label>
              <label className="form-control"><span className="text-xs font-semibold text-base-content/70">LinkedIn</span><input value={form.linkedin} onChange={set('linkedin')} placeholder="linkedin.com/in/..." className={inp} /></label>
              <label className="form-control"><span className="text-xs font-semibold text-base-content/70">Telefon</span><input value={form.phone} onChange={set('phone')} className={inp} /></label>
              <label className="form-control"><span className="text-xs font-semibold text-base-content/70">Email</span><input value={form.email} onChange={set('email')} className={inp} /></label>
            </div>
          </Section>

          <Section title="To'lov kartalari" subtitle="Profilda ko'rinadigan karta raqamlari">
            <label className="form-control block">
              <span className="text-xs font-semibold text-base-content/70">Asosiy karta raqami</span>
              <input value={form.cardNumber} onChange={set('cardNumber')} placeholder="8600 1234 5678 9012" className={`${inp} font-mono`} />
            </label>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-base-content/55">Qo'shimcha karta raqamlari</div>
              <div className="mt-3 space-y-2">
                {form.cardNumbers.map((c, i) => (
                  <div className="flex gap-2" key={i}>
                    <input value={c.label} onChange={updateCardNum(i, 'label')} placeholder="Nomi (masalan: Humo)" className={`${inp} !mt-0`} />
                    <input value={c.number} onChange={updateCardNum(i, 'number')} placeholder="9860 1234 5678 9012" className={`${inp} !mt-0 font-mono`} />
                    <button type="button" className="btn btn-ghost btn-square btn-sm shrink-0" onClick={() => removeCardNum(i)}>&times;</button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-ghost btn-xs mt-3" onClick={addCardNum}>+ Karta qo'shish</button>
            </div>
          </Section>

          <Section title="Qo'shimcha havolalar va hashtaglar" subtitle="Portfolio, boshqa saytlar, teglar">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-base-content/55">Qo'shimcha havolalar (istalgancha)</div>
              <div className="mt-3 space-y-2">
                {form.extraLinks.map((l, i) => (
                  <div className="flex gap-2" key={i}>
                    <input value={l.label} onChange={updateLink(i, 'label')} placeholder="Nomi (masalan: Portfolio)" className={`${inp} !mt-0`} />
                    <input value={l.url} onChange={updateLink(i, 'url')} placeholder="https://..." className={`${inp} !mt-0 font-mono`} />
                    <button type="button" className="btn btn-ghost btn-square btn-sm shrink-0" onClick={() => removeLink(i)}>&times;</button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-ghost btn-xs mt-3" onClick={addLink}>+ Havola qo'shish</button>
            </div>
            <label className="form-control mt-4 block">
              <span className="text-xs font-semibold text-base-content/70">Hashtaglar (vergul bilan)</span>
              <input value={form.hashtags} onChange={set('hashtags')} className={inp} />
            </label>
          </Section>

          <Section title="Jismoniy karta bosma dizayni" subtitle="Old/orqa tomon, rang, logotip — PNG holida yuklab olasiz">
            <CardDesignerPage embedded code={card.code} />
          </Section>

          <button className="btn btn-primary mt-5 w-full sm:w-auto" onClick={submit} disabled={busy}>
            {busy ? <span className="loading loading-spinner loading-sm"></span> : 'Profilni saqlash'}
          </button>
          {msg && <div className={`alert mt-4 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{msg.text}</span></div>}
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

export default function AccountPage({ refreshCatalog }) {
  const { user, myCards, refresh } = useAuth();
  const [orders, setOrders] = useState([]);

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
    const t = setInterval(load, 5000);
    return () => { stop = true; clearInterval(t); };
  }, [user]);

  if (user === undefined || user === null) {
    return (
      <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pt-16 pb-16"><p className="text-base-content/60">Yuklanmoqda...</p></main>
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
          <h1 className="mt-3 text-xl font-bold">Akkauntingiz vaqtincha bloklangan</h1>
          <p className="mt-2 text-sm text-base-content/60">
            Siz auksionda g'olib chiqib, 24 soat ichida to'lamadingiz. Shu sababli akkauntingiz{' '}
            <b>{until.toLocaleString('uz-UZ')}</b> gacha bloklangan.
          </p>
          <p className="mt-3 text-sm text-error">
            Diqqat: bu takrorlansa, akkauntingiz doimiy bloklanishi yoki raqamli tashrif qog'ozilaringiz olib qo'yilishi mumkin.
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
            <div className="font-mono text-xs uppercase tracking-widest text-base-content/45">Kabinet</div>
            <h1 className="mt-1 text-2xl font-bold">{user.email}</h1>
            <p className="mt-1 text-sm text-base-content/55">
              Sizning profilingiz:{' '}
              {myCards.length
                ? <b className="font-mono">{myCards.map((c) => 'nfcstore.uz/' + c.code.toLowerCase()).join(', ')}</b>
                : '—'}
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Chiqish</button>
        </div>
      </section>

      <section className="pt-8">
        <PremiumPanel user={user} onBecamePremium={refresh} />
      </section>

      <GiftOffersPanel onChanged={refresh} />

      <WonAuctionsPanel />

      {orders.filter((o) => o.status !== 'paid' && o.kind !== 'auction_payment').length > 0 && (
        <section className="pt-8">
          <h2 className="text-xl font-bold">Buyurtmalarim</h2>
          <div className="mt-3 space-y-2">
            {orders.filter((o) => o.status !== 'paid' && o.kind !== 'auction_payment').map((o) => {
              const st = ORDER_STATUS_LABEL[o.status] || { text: o.status, cls: 'badge-ghost' };
              return (
                <div key={o.id} className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-sm">
                  <span className="font-mono">nfcstore.uz/{o.code.toLowerCase()}</span>
                  <span className="text-base-content/50">{fmt(o.price)} so'm</span>
                  <span className={`badge ${st.cls}`}>{st.text}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="pt-8">
        <h2 className="text-xl font-bold">Mening raqamli tashrif qog'ozilarim</h2>
        {myCards.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/15 p-10 text-center text-base-content/50">
            Hozircha raqamli tashrif qog'ozingiz yo'q.{' '}
            <button className="cursor-pointer underline underline-offset-2 hover:text-base-content" onClick={() => navigate('/')}>
              Bosh sahifada band qilish &rarr;
            </button>
          </div>
        ) : (
          myCards.map((card) => (
            <EditCardForm key={card.code} card={card} onSaved={onSaved} />
          ))
        )}
      </section>
    </main>
  );
}
