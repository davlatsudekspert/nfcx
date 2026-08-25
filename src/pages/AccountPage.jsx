import { useEffect, useRef, useState } from 'react';
import { useAuth, authLogout, authUpdateCard } from '../lib/auth.jsx';
import { dbUploadImage, dbSetSale } from '../lib/db.js';
import { navigate } from '../lib/router.js';
import { fmt, timeAgo } from '../lib/format.js';
import NfcCard from '../components/NfcCard.jsx';

const THEME_FINISH = { classic: 'silver', midnight: 'black', emerald: 'graphite', royal: 'silver', sunset: 'black' };

const THEMES = [
  { id: 'classic', label: 'Classic', css: 'linear-gradient(160deg,#eef1f3,#dfe4e8)', accent: '#101112' },
  { id: 'midnight', label: 'Onyx', css: 'linear-gradient(160deg,#0c0c0d,#1c1c1f)', accent: '#ffffff' },
  { id: 'emerald', label: 'Graphite', css: 'linear-gradient(160deg,#e9eaeb,#c9cbcd)', accent: '#101112' },
  { id: 'royal', label: 'Platinum', css: 'linear-gradient(160deg,#f6f6f7,#dcdde0)', accent: '#3a3c40' },
  { id: 'sunset', label: 'Ink', css: 'linear-gradient(160deg,#141416,#28282b)', accent: '#f5f5f6' },
];

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

function EditCardForm({ card, onSaved }) {
  const [form, setForm] = useState({
    name: card.name,
    role: card.role || '',
    avatarUrl: card.avatarUrl || '',
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
  const [saleBusy, setSaleBusy] = useState(false);
  const [saleMsg, setSaleMsg] = useState(null);
  const fileRef = useRef(null);

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

  const toggleSale = async () => {
    setSaleBusy(true);
    setSaleMsg(null);
    try {
      const updated = await dbSetSale(card.code, !card.forSale);
      setSaleMsg({
        type: 'ok',
        text: !card.forSale
          ? `Sotuvga qo'yildi — narx ${fmt(updated.salePrice)} so'm.`
          : 'Sotuvdan olindi.',
      });
      onSaved(updated);
    } catch (err) {
      setSaleMsg({ type: 'err', text: err.message });
    } finally {
      setSaleBusy(false);
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
          ? 'Bu vizitka sizga tegishli emas.'
          : "Saqlashda xatolik yuz berdi.";
      setMsg({ type: 'err', text });
    } finally {
      setBusy(false);
    }
  };

  const preview = THEMES.find((t) => t.id === form.theme) || THEMES[0];
  const inp = 'input input-bordered input-sm mt-1 w-full bg-base-100';

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-base-200/60 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono text-sm font-bold tracking-wide">nfcstore.uz/{card.code.toLowerCase()}</div>
          <div className="mt-1 text-xs text-base-content/50">
            {fmt(card.price)} so'm · {timeAgo(card.ts)} · {fmt(card.views || 0)} ko'rish
            {card.forSale && <span className="badge badge-accent badge-outline badge-xs ml-2 align-middle"> SOTUVDA</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/' + card.code)}>Ko'rish</button>
          <button className={'btn btn-sm ' + (card.forSale ? 'btn-ghost' : 'btn-primary')} onClick={toggleSale} disabled={saleBusy}>
            {saleBusy ? <span className="loading loading-spinner loading-xs"></span> : card.forSale ? "Sotuvdan olish" : 'Sotuvga qo\u2019yish'}
          </button>
        </div>
      </div>
      {saleMsg && <div className={`alert mt-4 py-2 text-sm ${saleMsg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{saleMsg.text}</span></div>}

      <div className="flex justify-center py-6">
        <NfcCard code={card.code} name={form.name} since={card.ts} finish={THEME_FINISH[form.theme] || 'black'} size="sm" />
      </div>

      {/* Profil ko'rinishi */}
      <div className="font-mono text-xs uppercase tracking-widest text-base-content/45">Profil ko'rinishi</div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {THEMES.map((t) => (
          <button key={t.id} type="button"
            className={`cursor-pointer rounded-xl border p-3 text-sm font-semibold transition-all ${form.theme === t.id ? 'border-base-content/70 ring-2 ring-white/30' : 'border-white/10 hover:border-white/30'}`}
            style={{ background: t.css }}
            onClick={() => setForm((f) => ({ ...f, theme: t.id }))}>
            <span style={{ color: t.accent }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Avatar */}
      <div className="mt-6 flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-base-100 font-bold">
          {form.avatarUrl
            ? <img src={form.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
            : <span>{(form.name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</span>}
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

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <label className="form-control"><span className="text-xs font-semibold text-base-content/70">Ism *</span><input value={form.name} onChange={set('name')} className={inp} /></label>
        <label className="form-control"><span className="text-xs font-semibold text-base-content/70">Kasb / sarlavha</span><input value={form.role} onChange={set('role')} className={inp} /></label>
      </div>
      <label className="form-control mt-3 block">
        <span className="text-xs font-semibold text-base-content/70">O'zingiz haqingizda (bio)</span>
        <textarea rows={3} value={form.about} onChange={set('about')} placeholder="Qisqacha o'zingiz haqingizda..." className="textarea textarea-bordered mt-1 w-full bg-base-100" />
      </label>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="form-control"><span className="text-xs font-semibold text-base-content/70">Telegram</span><input value={form.tg} onChange={set('tg')} placeholder="@username" className={inp} /></label>
        <label className="form-control"><span className="text-xs font-semibold text-base-content/70">Instagram</span><input value={form.instagram} onChange={set('instagram')} placeholder="@username" className={inp} /></label>
        <label className="form-control"><span className="text-xs font-semibold text-base-content/70">Facebook</span><input value={form.facebook} onChange={set('facebook')} placeholder="username yoki havola" className={inp} /></label>
        <label className="form-control"><span className="text-xs font-semibold text-base-content/70">X (Twitter)</span><input value={form.twitter} onChange={set('twitter')} placeholder="@username" className={inp} /></label>
        <label className="form-control"><span className="text-xs font-semibold text-base-content/70">Veb-sayt</span><input value={form.website} onChange={set('website')} placeholder="https://sayt.uz" className={inp} /></label>
        <label className="form-control"><span className="text-xs font-semibold text-base-content/70">LinkedIn</span><input value={form.linkedin} onChange={set('linkedin')} placeholder="linkedin.com/in/..." className={inp} /></label>
        <label className="form-control"><span className="text-xs font-semibold text-base-content/70">Telefon</span><input value={form.phone} onChange={set('phone')} className={inp} /></label>
        <label className="form-control"><span className="text-xs font-semibold text-base-content/70">Email</span><input value={form.email} onChange={set('email')} className={inp} /></label>
      </div>
      <label className="form-control mt-3 block">
        <span className="text-xs font-semibold text-base-content/70">To'lov karta raqami (asosiy, profilda ko'rinadi)</span>
        <input value={form.cardNumber} onChange={set('cardNumber')} placeholder="8600 1234 5678 9012" className={`${inp} font-mono`} />
      </label>

      <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
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

      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
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

      <button className="btn btn-primary mt-5" onClick={submit} disabled={busy}>
        {busy ? <span className="loading loading-spinner loading-sm"></span> : 'Profilni saqlash'}
      </button>
      {msg && <div className={`alert mt-4 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{msg.text}</span></div>}

      <p className="mt-4 text-xs text-base-content/45">
        Tanlangan mavzu: <b style={{ color: preview.accent }}>{preview.label}</b>. «Ko'rish» orqali profilingizni tekshirib ko'ring.
      </p>
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
      <main className="mx-auto max-w-4xl px-5 pt-16 pb-16"><p className="text-base-content/60">Yuklanmoqda...</p></main>
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
    <main className="mx-auto max-w-4xl px-5 pb-16">
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

      {orders.filter((o) => o.status !== 'paid').length > 0 && (
        <section className="pt-8">
          <h2 className="text-xl font-bold">Buyurtmalarim</h2>
          <div className="mt-3 space-y-2">
            {orders.filter((o) => o.status !== 'paid').map((o) => {
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
        <h2 className="text-xl font-bold">Mening vizitkalarim</h2>
        {myCards.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/15 p-10 text-center text-base-content/50">
            Hozircha vizitkangiz yo'q.{' '}
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
