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
    <main className="wrap">
      <section className="auth-wrap">
        <div className="panel auth-box">
          <div className="section-label">NFCSTORE</div>
          <h2>{isRegister ? 'Ro\u2019yxatdan o\u2019tish' : 'Kirish'}</h2>
          <p className="section-desc" style={{ marginBottom: 22 }}>
            {isRegister
              ? 'Akkaunt yarating — sotib olgan vizitkangiz profilingiz bilan birga shu yerda bo\u2019ladi.'
              : 'Vizitkalaringizni boshqarish uchun akkauntingizga kiring.'}
          </p>

          <form onSubmit={submit}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="ism@gmail.com" autoComplete="email" required />
            </div>
            <div className="field">
              <label>Parol</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Kamida 6 belgi" autoComplete={isRegister ? 'new-password' : 'current-password'} required minLength={6} />
            </div>
            {isRegister && (
              <div className="field">
                <label>Parolni takrorlang</label>
                <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)}
                  placeholder="Parolni qayta kiriting" autoComplete="new-password" required />
              </div>
            )}
            <button className="btn btn-brass" style={{ width: '100%', marginTop: 6 }} disabled={busy}>
              {busy ? 'Yuklanmoqda...' : isRegister ? 'Akkaunt yaratish' : 'Kirish'}
            </button>
          </form>

          {msg && <div className={'modal-msg ' + msg.type} style={{ marginTop: 14 }}>{msg.text}</div>}

          <div className="auth-switch">
            {isRegister ? (
              <>Akkauntingiz bormi?{' '}
                <button onClick={() => navigate('/login')}>Kirish</button>
              </>
            ) : (
              <>Akkauntingiz yo&apos;qmi?{' '}
                <button onClick={() => navigate('/register')}>Ro&apos;yxatdan o&apos;tish</button>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
