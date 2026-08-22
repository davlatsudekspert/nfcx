import { useState } from 'react';
import { dbCreate } from '../lib/db.js';
import { fmt } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import { useAuth, authRegister, authLogin } from '../lib/auth.jsx';

export default function ReserveModal({ code, price, onClose, onDone }) {
  const { user, refresh: refreshAuth } = useAuth();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [tg, setTg] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [instagram, setInstagram] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [acctEmail, setAcctEmail] = useState('');
  const [acctPassword, setAcctPassword] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  // Xarid paytida akkaunt: kirgan bo'lsa shart emas, aks holda
  // email+parol kiritilsa avtomatik ro'yxatdan o'tadi va vizitka
  // profilingizga biriktiriladi.
  const wantAccount = !user && acctEmail.trim() && acctPassword;

  const ensureAccount = async () => {
    if (user) return;
    if (!wantAccount) return;
    try {
      await authRegister(acctEmail.trim(), acctPassword);
    } catch (err) {
      if (String(err.message).startsWith('email_taken')) {
        // Bu email bilan akkaunt mavjud — parol to'g'ri bo'lsa kiradi.
        await authLogin(acctEmail.trim(), acctPassword);
      } else {
        throw err;
      }
    }
    await refreshAuth();
  };

  const submit = async () => {
    if (!name.trim()) { setMsg({ type: 'err', text: 'Ismingizni kiriting.' }); return; }
    if (wantAccount && acctPassword.length < 6) {
      setMsg({ type: 'err', text: 'Parol kamida 6 belgidan iborat bo\u2019lishi kerak.' });
      return;
    }
    setBusy(true);
    try {
      await ensureAccount();
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
      setMsg({ type: 'ok', text: 'nfcstore.uz/' + code.toLowerCase() + " sizniki bo'ldi! Profilingizga o'tkazilyapti..." });
      setTimeout(() => { onDone(); navigate('/' + code.toLowerCase()); }, 900);
    } catch (err) {
      const text = String(err.message).startsWith('bad_credentials')
        ? 'Bu email boshqa akkauntga tegishli va parol mos kelmadi.'
        : 'Xatolik: ' + (err && err.message ? err.message : "noma'lum xato");
      setMsg({ type: 'err', text });
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h3>Vizitkani band qilish</h3>
        <div className="modal-code mono">nfcstore.uz/{code.toLowerCase()}</div>

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

          {!user ? (
            <>
              <div className="modal-divider"></div>
              <div className="modal-acct-label">Akkaunt — profilingizni boshqarish uchun (tavsiya etiladi)</div>
              <div className="field-row">
                <div className="field">
                  <label>Email (login)</label>
                  <input type="email" value={acctEmail} onChange={(e) => setAcctEmail(e.target.value)} placeholder="ism@gmail.com" autoComplete="email" />
                </div>
                <div className="field">
                  <label>Parol (min. 6 belgi)</label>
                  <input type="password" value={acctPassword} onChange={(e) => setAcctPassword(e.target.value)} placeholder="••••••" autoComplete="new-password" />
                </div>
              </div>
              <p className="modal-hint">
                Akkaunt bilan vizitkangiz profilingizga biriktiriladi va uni keyin /account sahifasidan tahrirlaysiz.
              </p>
            </>
          ) : (
            <>
              <div className="modal-divider"></div>
              <p className="modal-hint">
                Vizitka profilingizga biriktiriladi: <b>{user.email}</b>. Keyinchalik /account sahifasidan tahrirlashingiz mumkin.
              </p>
            </>
          )}
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
