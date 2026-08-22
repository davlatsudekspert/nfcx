import { useEffect, useRef, useState } from 'react';
import { useAuth, authLogout, authUpdateCard } from '../lib/auth.jsx';
import { dbUploadImage, dbSetSale } from '../lib/db.js';
import { navigate } from '../lib/router.js';
import { fmt, timeAgo } from '../lib/format.js';

const THEMES = [
  { id: 'classic', label: 'Classic', css: 'linear-gradient(160deg,#eef1f3,#dfe4e8)', accent: '#1f8f6f' },
  { id: 'midnight', label: 'Midnight', css: 'linear-gradient(160deg,#10141f,#1b2233)', accent: '#7aa2ff' },
  { id: 'emerald', label: 'Emerald', css: 'linear-gradient(160deg,#0e1f19,#14352a)', accent: '#34d399' },
  { id: 'royal', label: 'Royal', css: 'linear-gradient(160deg,#170f24,#241640)', accent: '#a78bfa' },
  { id: 'sunset', label: 'Sunset', css: 'linear-gradient(160deg,#241014,#3c1a1e)', accent: '#fb7185' },
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

  return (
    <div className="acct-card">
      <div className="acct-card-head">
        <div>
          <div className="mono acct-code">nfcstore.uz/{card.code.toLowerCase()}</div>
          <div className="acct-sub">
            {fmt(card.price)} so'm · {timeAgo(card.ts)} · {fmt(card.views || 0)} ko'rish
            {card.forSale && <span className="sale-pill"> SOTUVDA</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-teal" onClick={() => navigate('/' + card.code)}>Ko'rish</button>
          <button className={'btn ' + (card.forSale ? 'btn-ghost' : 'btn-brass')} onClick={toggleSale} disabled={saleBusy}>
            {saleBusy ? '...' : card.forSale ? "Sotuvdan olish" : 'Sotuvga qo\u2019yish'}
          </button>
        </div>
      </div>
      {saleMsg && <div className={'modal-msg ' + saleMsg.type} style={{ marginBottom: 14 }}>{saleMsg.text}</div>}

      {/* Profil ko'rinishi */}
      <div className="section-label" style={{ marginTop: 4 }}>PROFIL KO'RINISHI</div>
      <div className="theme-grid">
        {THEMES.map((t) => (
          <button key={t.id} type="button"
            className={'theme-swatch' + (form.theme === t.id ? ' active' : '')}
            style={{ background: t.css }}
            onClick={() => setForm((f) => ({ ...f, theme: t.id }))}>
            <span style={{ color: t.accent }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Avatar */}
      <div className="acct-avatar-row">
        <div className="acct-avatar-preview">
          {form.avatarUrl
            ? <img src={form.avatarUrl} alt="avatar" />
            : <span>{(form.name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</span>}
        </div>
        <div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickFile} />
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current && fileRef.current.click()} disabled={uploading}>
            {uploading ? 'Yuklanmoqda...' : 'Rasm tanlash'}
          </button>
          <p className="modal-hint" style={{ marginTop: 8 }}>JPG/PNG. Avtomatik kichraytiriladi. Yoki quyida havola qoldiring.</p>
          <input className="acct-avatar-url" value={form.avatarUrl} onChange={set('avatarUrl')} placeholder="https://... yoki /uploads/..." />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>Ism *</label>
          <input value={form.name} onChange={set('name')} />
        </div>
        <div className="field">
          <label>Kasb / sarlavha</label>
          <input value={form.role} onChange={set('role')} />
        </div>
      </div>
      <div className="field">
        <label>O'zingiz haqingizda (bio)</label>
        <textarea rows={3} value={form.about} onChange={set('about')} placeholder="Qisqacha o'zingiz haqingizda..." />
      </div>

      <div className="field-row">
        <div className="field">
          <label>Telegram</label>
          <input value={form.tg} onChange={set('tg')} placeholder="@username" />
        </div>
        <div className="field">
          <label>Instagram</label>
          <input value={form.instagram} onChange={set('instagram')} placeholder="@username" />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Facebook</label>
          <input value={form.facebook} onChange={set('facebook')} placeholder="username yoki havola" />
        </div>
        <div className="field">
          <label>X (Twitter)</label>
          <input value={form.twitter} onChange={set('twitter')} placeholder="@username" />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Veb-sayt</label>
          <input value={form.website} onChange={set('website')} placeholder="https://sayt.uz" />
        </div>
        <div className="field">
          <label>LinkedIn</label>
          <input value={form.linkedin} onChange={set('linkedin')} placeholder="linkedin.com/in/..." />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Telefon</label>
          <input value={form.phone} onChange={set('phone')} />
        </div>
        <div className="field">
          <label>Email</label>
          <input value={form.email} onChange={set('email')} />
        </div>
      </div>
      <div className="field">
        <label>To'lov karta raqami (profilda ko'rinadi)</label>
        <input value={form.cardNumber} onChange={set('cardNumber')} placeholder="8600 1234 5678 9012" />
      </div>
      <div className="field">
        <label>Hashtaglar (vergul bilan)</label>
        <input value={form.hashtags} onChange={set('hashtags')} />
      </div>

      <button className="btn btn-brass" onClick={submit} disabled={busy}>
        {busy ? 'Yuklanmoqda...' : 'Profilni saqlash'}
      </button>
      {msg && <div className={'modal-msg ' + msg.type} style={{ marginTop: 12 }}>{msg.text}</div>}

      <p className="modal-hint" style={{ marginTop: 12 }}>
        Tanlangan mavzu: <b style={{ color: preview.accent }}>{preview.label}</b>. «Ko'rish» orqali profilingizni tekshirib ko'ring.
      </p>
    </div>
  );
}

export default function AccountPage({ refreshCatalog }) {
  const { user, myCards, refresh } = useAuth();

  useEffect(() => {
    if (user === null) navigate('/login', { replace: true });
  }, [user]);

  if (user === undefined || user === null) {
    return (
      <main className="wrap"><section><p style={{ color: 'var(--ink-dim)' }}>Yuklanmoqda...</p></section></main>
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
    <main className="wrap">
      <section className="acct-head-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div className="section-label">Kabinet</div>
            <h2 style={{ marginBottom: 4 }}>{user.email}</h2>
            <p className="section-desc" style={{ marginBottom: 0 }}>
              Sizning profilingiz:{' '}
              {myCards.length
                ? <b className="mono">{myCards.map((c) => 'nfcstore.uz/' + c.code.toLowerCase()).join(', ')}</b>
                : '—'}
            </p>
          </div>
          <button className="btn btn-ghost" onClick={logout}>Chiqish</button>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <h2>Mening vizitkalarim</h2>
        {myCards.length === 0 ? (
          <div className="empty-note">
            Hozircha vizitkangiz yo'q.{' '}
            <a style={{ color: 'var(--teal-bright)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/')}>
              Bosh sahifada band qilish &rarr;
            </a>
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
