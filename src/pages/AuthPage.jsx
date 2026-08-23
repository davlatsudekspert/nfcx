import { useState } from 'react';
import { authLogin, authRegister, useAuth } from '../lib/auth.jsx';
import { navigate } from '../lib/router.js';

const ERR_TEXT = {
  email_taken: 'Bu email allaqachon ro\u2019yxatdan o\u2019tgan.',
  bad_credentials: 'Email yoki parol xato.',
  db_unavailable: 'Server bazasi hozir mavjud emas. Keyinroq urinib ko\u2019ring.',
};

function errText(err) {
  const key = err && err.message;
  if (key === 'bad_credentials') return ERR_TEXT.bad_credentials;
  if (key && key.startsWith('email_taken')) return ERR_TEXT.email_taken;
  return "Xatolik yuz berdi. Ma'lumotlarni tekshirib qayta urinib ko'ring.";
}

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (isRegister && password !== password2) {
      setMsg({ type: 'err', text: 'Parollar bir xil emas.' });
      return;
    }
    setBusy(true);
    try {
      if (isRegister) await authRegister(email.trim(), password);
      else await authLogin(email.trim(), password);
      await refresh();
      navigate('/account');
    } catch (err) {
      setMsg({ type: 'err', text: errText(err) });
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-5 pb-16">
      <section className="flex justify-center pt-16">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-base-200/70 p-7 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
          <div className="font-mono text-xs uppercase tracking-widest text-base-content/45">NFCSTORE</div>
          <h2 className="mt-2 text-2xl font-bold">{isRegister ? 'Ro\u2019yxatdan o\u2019tish' : 'Kirish'}</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-base-content/55">
            {isRegister
              ? 'Akkaunt yarating — sotib olgan vizitkangiz profilingiz bilan birga shu yerda bo\u2019ladi.'
              : 'Vizitkalaringizni boshqarish uchun akkauntingizga kiring.'}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-3">
            <label className="form-control">
              <span className="text-xs font-semibold text-base-content/70">Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="ism@gmail.com" autoComplete="email" required
                className="input input-bordered mt-1 w-full bg-base-100" />
            </label>
            <label className="form-control">
              <span className="text-xs font-semibold text-base-content/70">Parol</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Kamida 6 belgi" autoComplete={isRegister ? 'new-password' : 'current-password'} required minLength={6}
                className="input input-bordered mt-1 w-full bg-base-100" />
            </label>
            {isRegister && (
              <label className="form-control">
                <span className="text-xs font-semibold text-base-content/70">Parolni takrorlang</span>
                <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)}
                  placeholder="Parolni qayta kiriting" autoComplete="new-password" required
                  className="input input-bordered mt-1 w-full bg-base-100" />
              </label>
            )}
            <button className="btn btn-primary w-full" disabled={busy}>
              {busy ? <span className="loading loading-spinner loading-sm"></span> : isRegister ? 'Akkaunt yaratish' : 'Kirish'}
            </button>
          </form>

          {msg && <div className="alert alert-error mt-4 py-2 text-sm"><span>{msg.text}</span></div>}

          <div className="mt-5 text-center text-sm text-base-content/55">
            {isRegister ? (
              <>Akkauntingiz bormi?{' '}
                <button onClick={() => navigate('/login')} className="cursor-pointer underline underline-offset-2 hover:text-base-content">Kirish</button>
              </>
            ) : (
              <>Akkauntingiz yo&apos;qmi?{' '}
                <button onClick={() => navigate('/register')} className="cursor-pointer underline underline-offset-2 hover:text-base-content">Ro&apos;yxatdan o&apos;tish</button>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
