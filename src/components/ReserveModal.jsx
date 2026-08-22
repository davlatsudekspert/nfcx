import { useState } from 'react';
import { dbCreate } from '../lib/db.js';
import { fmt } from '../lib/format.js';
import { navigate } from '../lib/router.js';

export default function ReserveModal({ code, price, onClose, onDone }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [tg, setTg] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [instagram, setInstagram] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) { setMsg({ type: 'err', text: 'Ismingizni kiriting.' }); return; }
    setBusy(true);
    try {
      const data = {
        name: name.trim(),
        role: role.trim(),
        avatarUrl: avatarUrl.trim(),
        tg: tg.trim(),
        phone: phone.trim(),
        email: email.trim(),
        linkedin: linkedin.trim(),
        instagram: instagram.trim(),
        hashtags: hashtags.split(',').map((h) => h.trim()).filter(Boolean),
        price,
      };
      const created = await dbCreate(code, data);
      if (!created) {
        setMsg({ type: 'err', text: 'Afsuski, bu vizitka allaqachon band qilingan yoki saqlashda xatolik yuz berdi.' });
        setBusy(false);
        return;
      }
      setMsg({ type: 'ok', text: 'belgi.uz/' + code + " muvaffaqiyatli band qilindi! O'z sahifasiga o'tkazilyapti..." });
      setTimeout(() => { onDone(); navigate(code); }, 900);
    } catch (err) {
      setMsg({ type: 'err', text: 'Xatolik: ' + (err && err.message ? err.message : "noma'lum xato") });
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h3>Vizitkani band qilish</h3>
        <div className="modal-code mono">belgi.uz/{code}</div>

        <div className="modal-scroll">
          <div className="field">
            <label>Ismingiz *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Azizbek Turgunov" />
          </div>
          <div className="field">
            <label>Kasb / sarlavha</label>
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Mobile App Developer & Community Builder" />
          </div>
          <div className="field">
            <label>Avatar rasm havolasi (ixtiyoriy)</label>
            <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Telegram</label>
              <input value={tg} onChange={(e) => setTg(e.target.value)} placeholder="@username" />
            </div>
            <div className="field">
              <label>Telefon</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 XX XXX XX XX" />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ism@gmail.com" />
            </div>
            <div className="field">
              <label>LinkedIn</label>
              <input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="linkedin.com/in/..." />
            </div>
          </div>
          <div className="field">
            <label>Instagram</label>
            <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@username" />
          </div>
          <div className="field">
            <label>Hashtaglar (vergul bilan)</label>
            <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="IT_specialist, community_builder" />
          </div>
        </div>

        <div className="modal-total">
          <span style={{ color: 'var(--ink-dim)', fontSize: 14 }}>Jami</span>
          <b>{fmt(price)} so'm</b>
        </div>
        <button className="btn btn-brass" style={{ width: '100%' }} onClick={submit} disabled={busy}>
          {busy ? 'Yuklanmoqda...' : 'Band qilish'}
        </button>
        {msg && <div className={'modal-msg ' + msg.type}>{msg.text}</div>}
      </div>
    </div>
  );
}
