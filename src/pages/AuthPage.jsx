import { useState } from 'react';
import { authLogin, authRegister, useAuth } from '../lib/auth.jsx';
import { navigate } from '../lib/router.js';
import NfcCard from '../components/NfcCard.jsx';
import Interactive3DCard from '../components/Interactive3DCard.jsx';

// Diqqat: haqiqiy bot username'ingizga almashtiring (masalan @NFCStoreBot).
const BOT_USERNAME = 'NFCStoreBot';
const BOT_LINK = `https://t.me/${BOT_USERNAME}`;

const ERR_TEXT = {
  email_taken: 'Bu email allaqachon ro\u2019yxatdan o\u2019tgan.',
  bad_credentials: 'Email yoki parol xato.',
  db_unavailable: 'Server bazasi hozir mavjud emas. Keyinroq urinib ko\u2019ring.',
};

function errText(err) {
  const key = err && err.message;
  if (key === 'bad_credentials') return ERR_TEXT.bad_credentials;
  if (key && key.startsWith('email_taken')) return ERR_TEXT.email_taken;
  if (key === 'phone_not_verified') {
    return `Bu telefon raqami botda tasdiqlanmagan. Avval ${BOT_LINK} ga o'ting, "Kontaktni ulashish" tugmasini bosing, so'ng shu raqamni qayta kiriting.`;
  }
  // Backend validatsiya xabarlari (telefon/bot tasdiq) to'g'ridan-to'g'ri
  // o'zbek tilida keladi — ularni shundayligicha ko'rsatamiz.
  if (key && /telefon|bot|kamida|format/i.test(key)) return key;
  return "Xatolik yuz berdi. Ma'lumotlarni tekshirib qayta urinib ko'ring.";
}

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [phone, setPhone] = useState('');
  const [botAck, setBotAck] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [promoCode, setPromoCode] = useState(() => new URLSearchParams(window.location.search).get('promo') || '');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (isRegister && password !== password2) {
      setMsg({ type: 'err', text: 'Parollar bir xil emas.' });
      return;
    }
    if (isRegister && !botAck) {
      setMsg({ type: 'err', text: "Avval botga yozganingizni tasdiqlovchi katakchani belgilang." });
      return;
    }
    if (isRegister && !tosAccepted) {
      setMsg({ type: 'err', text: "Davom etish uchun ommaviy oferta shartlariga rozilik bering." });
      return;
    }
    setBusy(true);
    try {
      if (isRegister) await authRegister(email.trim(), password, { phone: phone.trim(), botAck, tosAccepted, promoCode: promoCode.trim() });
      else await authLogin(email.trim(), password);
      await refresh();
      navigate('/account');
    } catch (err) {
      setMsg({ type: 'err', text: errText(err) });
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pb-16">
      <section className="grid items-center gap-14 pt-16 lg:grid-cols-2">
        <div className="hidden justify-self-center lg:flex">
          <div className="flex flex-col items-center gap-6">
            <div className="animate-[floatY_5.5s_ease-in-out_infinite]">
              <Interactive3DCard>
                <NfcCard code="ABZ007" name="SIZNING ISMINGIZ" finish="showcase" size="lg" rim />
              </Interactive3DCard>
            </div>
            <p className="max-w-[280px] text-center text-sm text-base-content/45">Raqamli profilingiz. Shaxsiy ma'lumotlaringiz. Bitta joyda.</p>
          </div>
        </div>
        <div className="flex justify-center lg:justify-start">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-base-200/70 p-7 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
          <div className="font-mono text-xs uppercase tracking-widest text-base-content/45">NFCSTORE</div>
          <h2 className="mt-2 text-2xl font-bold">{isRegister ? 'Ro\u2019yxatdan o\u2019tish' : 'Kirish'}</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-base-content/55">
            {isRegister
              ? "Akkaunt yarating — sotib olgan raqamli tashrif qog'ozingiz profilingiz bilan birga shu yerda bo\u2019ladi."
              : "Raqamli tashrif qog'ozilaringizni boshqarish uchun akkauntingizga kiring."}
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
            {isRegister && (
              <label className="form-control">
                <span className="text-xs font-semibold text-base-content/70">Telefon raqamingiz</span>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="+998901234567" autoComplete="tel" required
                  className="input input-bordered mt-1 w-full bg-base-100" />
              </label>
            )}
            {isRegister && (
              <div className="rounded-xl border border-accent/30 bg-accent/5 p-3">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input type="checkbox" checked={botAck} onChange={(e) => setBotAck(e.target.checked)}
                    className="checkbox checkbox-sm mt-0.5" required />
                  <span className="text-xs leading-relaxed text-base-content/75">
                    <b>Ro'yxatdan o'tishdan oldin</b>, {' '}
                    <a href={BOT_LINK} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
                      shu Telegram botimizga
                    </a>{' '}
                    o'ting va u yerga <b>ism-familyangiz</b> hamda <b>telefon raqamingizni</b> yozib qoldiring. Bu — jismoniy NFC kartangizni to'g'ri manzilga yetkazib berishimiz uchun kerak. Buni bajargan bo'lsangiz, shu katakchani belgilang.
                  </span>
                </label>
              </div>
            )}
            {isRegister && (
              <label className="form-control">
                <span className="text-xs font-semibold text-base-content/70">Do'stingiz promokodi (ixtiyoriy)</span>
                <input type="text" value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="Masalan: AB3X9K" maxLength={12}
                  className="input input-bordered mt-1 w-full bg-base-100 font-mono uppercase" />
              </label>
            )}
            {isRegister && (
              <label className="flex cursor-pointer items-start gap-2.5">
                <input type="checkbox" checked={tosAccepted} onChange={(e) => setTosAccepted(e.target.checked)}
                  className="checkbox checkbox-sm mt-0.5" required />
                <span className="text-xs leading-relaxed text-base-content/75">
                  Men <a href="/shartlar" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">ommaviy oferta shartlari</a>ni o'qib chiqdim va roziman.
                </span>
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
        </div>
      </section>
    </main>
  );
}
