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

  const field = 'form-control';
  const inp = 'input input-bordered input-sm mt-1 w-full bg-base-100';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative my-8 w-full max-w-lg rounded-2xl border border-white/10 bg-base-200 shadow-2xl">
        <button className="btn btn-ghost btn-circle btn-sm absolute right-3 top-3" onClick={onClose}>&times;</button>
        <div className="p-6">
          <h3 className="text-lg font-bold">Vizitkani band qilish</h3>
          <div className="mt-1 font-mono text-sm text-base-content/50">nfcstore.uz/{code.toLowerCase()}</div>

          <div className="mt-5 max-h-[52vh] space-y-3 overflow-y-auto pr-1">
            <label className={field}>
              <span className="text-xs font-semibold text-base-content/70">Ismingiz *</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Azizbek Turgunov" className={inp} />
            </label>
            <label className={field}>
              <span className="text-xs font-semibold text-base-content/70">Kasb / sarlavha</span>
              <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Mobile App Developer & Community Builder" className={inp} />
            </label>
            <label className={field}>
              <span className="text-xs font-semibold text-base-content/70">Avatar rasm havolasi (ixtiyoriy)</span>
              <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." className={inp} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={field}>
                <span className="text-xs font-semibold text-base-content/70">Telegram</span>
                <input value={tg} onChange={(e) => setTg(e.target.value)} placeholder="@username" className={inp} />
              </label>
              <label className={field}>
                <span className="text-xs font-semibold text-base-content/70">Telefon</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 XX XXX XX XX" className={inp} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className={field}>
                <span className="text-xs font-semibold text-base-content/70">Email</span>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ism@gmail.com" className={inp} />
              </label>
              <label className={field}>
                <span className="text-xs font-semibold text-base-content/70">LinkedIn</span>
                <input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="linkedin.com/in/..." className={inp} />
              </label>
            </div>
            <label className={field}>
              <span className="text-xs font-semibold text-base-content/70">Instagram</span>
              <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@username" className={inp} />
            </label>
            <label className={field}>
              <span className="text-xs font-semibold text-base-content/70">Hashtaglar (vergul bilan)</span>
              <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="IT_specialist, community_builder" className={inp} />
            </label>

            {!user ? (
              <>
                <div className="divider my-2"></div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-base-content/60">Akkaunt — profilingizni boshqarish uchun (tavsiya etiladi)</div>
                <div className="grid grid-cols-2 gap-3">
                  <label className={field}>
                    <span className="text-xs font-semibold text-base-content/70">Email (login)</span>
                    <input type="email" value={acctEmail} onChange={(e) => setAcctEmail(e.target.value)} placeholder="ism@gmail.com" autoComplete="email" className={inp} />
                  </label>
                  <label className={field}>
                    <span className="text-xs font-semibold text-base-content/70">Parol (min. 6 belgi)</span>
                    <input type="password" value={acctPassword} onChange={(e) => setAcctPassword(e.target.value)} placeholder="••••••" autoComplete="new-password" className={inp} />
                  </label>
                </div>
                <p className="text-xs leading-relaxed text-base-content/45">
                  Akkaunt bilan vizitkangiz profilingizga biriktiriladi va uni keyin /account sahifasidan tahrirlaysiz.
                </p>
              </>
            ) : (
              <>
                <div className="divider my-2"></div>
                <p className="text-xs leading-relaxed text-base-content/45">
                  Vizitka profilingizga biriktiriladi: <b>{user.email}</b>. Keyinchalik /account sahifasidan tahrirlashingiz mumkin.
                </p>
              </>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
            <span className="text-sm text-base-content/60">Jami</span>
            <b className="text-lg">{fmt(price)} so'm</b>
          </div>
          <button className="btn btn-primary mt-3 w-full" onClick={submit} disabled={busy}>
            {busy ? <span className="loading loading-spinner loading-sm"></span> : 'Band qilish'}
          </button>
          {msg && (
            <div className={`alert mt-3 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}>
              <span>{msg.text}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
