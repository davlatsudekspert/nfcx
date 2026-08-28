import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { navigate } from '../lib/router.js';
import { dbRequestPasswordCode, dbChangePassword } from '../lib/db.js';

// Profildagi Sozlamalar sahifasi — o'z ma'lumotlarini ko'rish va
// Telegram orqali kelgan bir martalik kod bilan parolni o'zgartirish.
export default function SettingsPage() {
  const { user, myCards } = useAuth();

  const [step, setStep] = useState('idle'); // idle | code_sent
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  if (user === undefined) {
    return <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pt-16 text-center text-base-content/45">Yuklanmoqda...</main>;
  }
  if (user === null) {
    navigate('/login', { replace: true });
    return null;
  }

  const requestCode = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await dbRequestPasswordCode();
      setStep('code_sent');
      setMsg({ type: 'ok', text: "Kod Telegram botingizga yuborildi." });
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const submitChange = async () => {
    if (!code.trim()) { setMsg({ type: 'err', text: 'Kodni kiriting.' }); return; }
    if (newPassword.length < 6) { setMsg({ type: 'err', text: 'Parol kamida 6 belgidan iborat bo\u2019lishi kerak.' }); return; }
    if (newPassword !== newPassword2) { setMsg({ type: 'err', text: 'Parollar mos kelmadi.' }); return; }
    setBusy(true);
    setMsg(null);
    try {
      await dbChangePassword(code.trim(), newPassword);
      setMsg({ type: 'ok', text: "Parol muvaffaqiyatli o'zgartirildi!" });
      setStep('idle');
      setCode('');
      setNewPassword('');
      setNewPassword2('');
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pb-16">
      <section className="pt-14">
        <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wider text-base-content/70">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>
          Sozlamalar
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Akkaunt sozlamalari</h1>
      </section>

      <section className="mt-8 max-w-lg">
        <h2 className="text-lg font-bold">Shaxsiy ma'lumotlar</h2>
        <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-base-200/50 p-5">
          <div className="flex items-center justify-between border-b border-white/5 pb-3 text-sm">
            <span className="text-base-content/55">Email (login)</span>
            <span className="font-semibold">{user.email}</span>
          </div>
          <div className="flex items-center justify-between border-b border-white/5 pb-3 text-sm">
            <span className="text-base-content/55">Raqamli tashrif qog'ozlarim</span>
            <span className="font-mono text-xs">{myCards.map((c) => c.code).join(', ') || '—'}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-base-content/55">Promokodim</span>
            <span className="font-mono">{user.promoCode || '—'}</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-base-content/40">Ism, manzil va boshqa profil ma'lumotlarini <a href="/account" className="underline underline-offset-2 hover:text-base-content">Kabinetim</a> sahifasida tahrirlaysiz.</p>
      </section>

      <section className="mt-10 max-w-lg">
        <h2 className="text-lg font-bold">Parolni o'zgartirish</h2>
        <p className="mt-1 text-sm text-base-content/50">Xavfsizlik uchun parol Telegram botingizga yuboriladigan bir martalik kod bilan tasdiqlanadi.</p>

        <div className="mt-4 rounded-2xl border border-white/10 bg-base-200/50 p-5">
          {step === 'idle' ? (
            <button className="btn btn-primary btn-sm" onClick={requestCode} disabled={busy}>
              {busy ? <span className="loading loading-spinner loading-xs"></span> : "Telegram'ga kod yuborish"}
            </button>
          ) : (
            <div className="space-y-3">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Telegram'dan kelgan 6 xonali kod"
                className="input input-bordered input-sm w-full bg-base-100 font-mono tracking-widest"
                maxLength={6}
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Yangi parol (kamida 6 belgi)"
                className="input input-bordered input-sm w-full bg-base-100"
              />
              <input
                type="password"
                value={newPassword2}
                onChange={(e) => setNewPassword2(e.target.value)}
                placeholder="Yangi parolni takrorlang"
                className="input input-bordered input-sm w-full bg-base-100"
              />
              <div className="flex gap-2">
                <button className="btn btn-primary btn-sm flex-1" onClick={submitChange} disabled={busy}>
                  {busy ? <span className="loading loading-spinner loading-xs"></span> : "Parolni o'zgartirish"}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={requestCode} disabled={busy}>Kodni qayta yuborish</button>
              </div>
            </div>
          )}
          {msg && <div className={`alert mt-3 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{msg.text}</span></div>}
        </div>
      </section>
    </main>
  );
}
