import { useEffect, useRef, useState } from 'react';
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
  const [createdCard, setCreatedCard] = useState(null);

  const needsAccount = !user;

  const ensureAccount = async () => {
    if (user) return;
    try {
      await authRegister(acctEmail.trim(), acctPassword);
    } catch (err) {
      if (String(err.message).startsWith('email_taken')) {
        await authLogin(acctEmail.trim(), acctPassword);
      } else {
        throw err;
      }
    }
    await refreshAuth();
  };

  const submit = async () => {
    if (!name.trim()) { setMsg({ type: 'err', text: 'Ismingizni kiriting.' }); return; }
    if (!tg.trim()) { setMsg({ type: 'err', text: 'Telegram username kiriting (masalan: @username).' }); return; }
    if (!phone.trim()) { setMsg({ type: 'err', text: 'Telefon raqamini kiriting.' }); return; }
    if (needsAccount) {
      if (!acctEmail.trim()) { setMsg({ type: 'err', text: 'Vizitkangizni boshqarish uchun email kiriting.' }); return; }
      if (acctPassword.length < 6) { setMsg({ type: 'err', text: 'Parol kamida 6 belgidan iborat bo\u2019lishi kerak.' }); return; }
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
      const res = await fetch('/api/records/' + encodeURIComponent(code), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((result && result.error) || 'api_error_' + res.status);
      }
      if (result.pending) {
        // Karta 'pending' holatida yaratildi, user_id bilan bog'landi
        setCreatedCard(result);
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
        {createdCard ? (
          <div className="p-6">
            <h3 className="text-lg font-bold">Karta yaratildi \u23F3</h3>
            <div className="mt-1 font-mono text-sm text-base-content/50">nfcstore.uz/{code.toLowerCase()}</div>
            <div className="mt-4 p-4 bg-warning/10 border border-warning/30 rounded-lg">
              <p className="text-sm font-semibold text-warning-content mb-2">
                📸 Keyingi qadam: Chek rasmini yuboring
              </p>
              <p className="text-sm text-warning-content mb-3">
                To'lovni amalga oshirib, <b>screenshotni @nfcsalebot ga yuboring</b>.
                Rasmga <b>vizitka kodini ({code}) caption (izoh) qilib qo'shing</b>.
              </p>
              <div className="text-xs text-warning-content font-mono bg-base-200 p-2 rounded">
                {code}
              </div>
              <p className="text-xs text-warning-content mt-2">
                Admin (892463694) to'lovni tekshirib, tasdiqlagach karta <b>faol</b> holatga o'tadi va sizga xabar keladi.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-base-content/50">
              <span className="loading loading-spinner loading-xs"></span>
              To'lov tasdiqlanishini kutmoqda...
            </div>
            {msg && (
              <div className={`alert mt-3 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}>
                <span>{msg.text}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6">
            <h3 className="text-lg font-bold">Vizitkani band qilish</h3>
            <div className="mt-1 font-mono text-sm text-base-content/50">nfcstore.uz/{code.toLowerCase()}</div>

            <div className="mt-5 max-h-[52vh] space-y-3 overflow-y-auto pr-1">
              <label className={field}>
                <span className="text-xs font-semibold text-base-content/70">Ismingiz *</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Azizbek Turgunov" className={inp} required />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={field}>
                  <span className="text-xs font-semibold text-base-content/70">Telegram *</span>
                  <input value={tg} onChange={(e) => setTg(e.target.value)} placeholder="@username" className={inp} required />
                </label>
                <label className={field}>
                  <span className="text-xs font-semibold text-base-content/70">Telefon *</span>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 XX XXX XX XX" className={inp} required />
                </label>
              </div>
              <div className="divider my-2"></div>
              <p className="text-xs text-base-content/50">Quyidagilar ixtiyoriy — keyin /account dan o'zgartirib bo'ladi</p>
              <label className={field}>
                <span className="text-xs font-semibold text-base-content/70">Kasb / sarlavha</span>
                <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Mobile App Developer & Community Builder" className={inp} />
              </label>
              <label className={field}>
                <span className="text-xs font-semibold text-base-content/70">Avatar rasm havolasi</span>
                <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." className={inp} />
              </label>
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
                  <div className="text-[11px] font-bold uppercase tracking-wider text-base-content/60">Akkaunt — vizitkangizni boshqarish uchun shart *</div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={field}>
                      <span className="text-xs font-semibold text-base-content/70">Email (login) *</span>
                      <input type="email" value={acctEmail} onChange={(e) => setAcctEmail(e.target.value)} placeholder="ism@gmail.com" autoComplete="email" className={inp} required />
                    </label>
                    <label className={field}>
                      <span className="text-xs font-semibold text-base-content/70">Parol (min. 6 belgi) *</span>
                      <input type="password" value={acctPassword} onChange={(e) => setAcctPassword(e.target.value)} placeholder="\u2022\u2022\u2022\u2022\u2022\u2022" autoComplete="new-password" className={inp} required />
                    </label>
                  </div>
                  <p className="text-xs leading-relaxed text-base-content/45">
                    Akkauntsiz band qilish endi mumkin emas — aks holda vizitkangiz hech kimning profiliga bog'lanmay qolib ketishi mumkin. Akkaunt bilan uni keyin /account sahifasidan tahrirlaysiz.
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
        )}
      </div>
    </div>
  );
}