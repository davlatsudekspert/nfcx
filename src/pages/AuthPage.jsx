import { useEffect, useState } from 'react';
import { authLogin, authRegister, authRequestRegisterCode, useAuth } from '../lib/auth.jsx';
import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';
import { dbGetTelegramBotUsername, dbAuthRequestPasswordReset, dbAuthResetPassword } from '../lib/db.js';
import NfcCard from '../components/NfcCard.jsx';
import Interactive3DCard from '../components/Interactive3DCard.jsx';
import { IconUser, IconShield, IconTelegram } from '../components/Icons.jsx';

// Bot username backend'dan keladi (GET /api/telegram/bot → {username});
// bo'sh bo'lsa 'nfcsalebot' zaxira. Modul darajasida keshlanadi (db.js).
const BOT_FALLBACK = 'nfcsalebot';
const botLinkFor = (username) => `https://t.me/${username || BOT_FALLBACK}`;

// Ro'yxatdan o'tishda tanlangan profil turi — backend /api/auth/register
// bu maydonni qabul qilmaydi (har doim shaxsiy 8 xonali bepul ID yaratadi),
// shuning uchun tanlov faqat KEYINGI qadamni belgilaydi: kompaniya → Company
// ID ochish oqimi (/company/create), shaxsiy → kabinet (/account).
const REG_TYPE_KEY = 'nfc_reg_profile_type';

function errText(err, t, botLink) {
  const key = err && err.message;
  const BOT_LINK = botLink || botLinkFor();
  if (key === 'bad_credentials') return t('Email yoki parol xato.');
  if (key === 'too_many_requests' || key === 'api_error_429') return t("Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring.");
  if (key === 'account_deleted') return t("Bu akkaunt o'chirilgan. Yangi akkaunt ochishingiz mumkin.");
  if (key === 'account_suspended') return t("Akkauntingiz vaqtincha to'xtatilgan. Admin bilan bog'laning.");
  if (key === 'api_error_503' || key === 'api_error_502') return t("Server bilan aloqa yo'q. Qayta urinib ko'ring.");
  if (err && err.name === 'TypeError') return t("Server bilan aloqa yo'q. Qayta urinib ko'ring.");
  if (key && key.startsWith('email_taken')) return t('Bu email allaqachon ro\u2019yxatdan o\u2019tgan.');
  if (key === 'db_unavailable') return t('Server bazasi hozir mavjud emas. Keyinroq urinib ko\u2019ring.');
  if (key === 'phone_not_verified') {
    return t('Bu telefon raqami botda tasdiqlanmagan. Avval {link} ga o‘ting, "Kontaktni ulashish" tugmasini bosing, so‘ng shu raqamni qayta kiriting.', { link: BOT_LINK });
  }
  if (key === 'bad_code' || key === 'code_required') return t("Tasdiqlash kodi noto'g'ri yoki muddati o'tgan. Qaytadan yuboring.");
  if (key === 'bad_phone') return t("Telefon raqamini to'g'ri kiriting.");
  if (key === 'tg_send_failed') return t("Telegram orqali kod yuborib bo'lmadi. Birozdan so'ng qayta urining.");
  // Backend validatsiya xabarlari — t() orqali (topilsa) tarjima qilinadi.
  if (key && /telefon|bot|kamida|format/i.test(key)) return t(key);
  return t("Xatolik yuz berdi. Ma'lumotlarni tekshirib qayta urinib ko'ring.");
}

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const { refresh } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [phone, setPhone] = useState('');
  const [botAck, setBotAck] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [promoCode, setPromoCode] = useState(() => new URLSearchParams(window.location.search).get('promo') || '');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  // Telegram OTP — ro'yxatdan o'tishdan oldin telefon raqamini tasdiqlash
  // (bot orqali kelgan bir martalik kod).
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [codeSending, setCodeSending] = useState(false);
  const [codeMsg, setCodeMsg] = useState(null);
  // Shaxsiy profil / Kompaniya profili — ro'yxatdan o'tishda aniq tanlov.
  const [profileKind, setProfileKind] = useState(() => {
    try { return sessionStorage.getItem(REG_TYPE_KEY) === 'company' ? 'company' : 'personal'; } catch { return 'personal'; }
  });
  // Telegram bot username — backend'dan (zaxira: nfcsalebot).
  const [botUsername, setBotUsername] = useState(BOT_FALLBACK);
  useEffect(() => {
    let alive = true;
    dbGetTelegramBotUsername(BOT_FALLBACK).then((u) => { if (alive && u) setBotUsername(u); });
    return () => { alive = false; };
  }, []);
  const BOT_LINK = botLinkFor(botUsername);

  // "Parolni unutdingizmi?" — 2 qadam: email → kod + yangi parol.
  const [forgot, setForgot] = useState(false);
  const [resetStep, setResetStep] = useState('email'); // 'email' | 'code'
  const [resetCode, setResetCode] = useState('');
  const [resetPass, setResetPass] = useState('');
  const [resetPass2, setResetPass2] = useState('');

  const requestCode = async () => {
    setCodeMsg(null);
    if (!botAck) { setCodeMsg({ type: 'err', text: t('Avval botga yozganingizni tasdiqlovchi katakchani belgilang.') }); return; }
    setCodeSending(true);
    try {
      await authRequestRegisterCode(phone.trim());
      setCodeSent(true);
      setCodeMsg({ type: 'ok', text: t("Kod Telegram botga yuborildi.") });
    } catch (err) {
      setCodeMsg({ type: 'err', text: errText(err, t, BOT_LINK) });
    } finally {
      setCodeSending(false);
    }
  };

  const requestReset = async () => {
    setMsg(null);
    if (!email.trim()) { setMsg({ type: 'err', text: t('Email manzilingizni kiriting.') }); return; }
    setBusy(true);
    try {
      await dbAuthRequestPasswordReset(email.trim());
      setResetStep('code');
      setMsg({ type: 'ok', text: t("Agar bu email ro'yxatda bo'lsa va telefoningiz botga ulangan bo'lsa, kod Telegram'ga yuborildi.") });
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (resetCode.trim().length !== 6) { setMsg({ type: 'err', text: t('6 xonali kodni kiriting.') }); return; }
    if (resetPass.length < 6) { setMsg({ type: 'err', text: t('Parol kamida 6 belgidan iborat bo\u2019lishi kerak.') }); return; }
    if (resetPass !== resetPass2) { setMsg({ type: 'err', text: t('Parollar bir xil emas.') }); return; }
    setBusy(true);
    try {
      await dbAuthResetPassword(email.trim(), resetCode.trim(), resetPass);
      setPassword('');
      setForgot(false);
      setResetStep('email');
      setResetCode(''); setResetPass(''); setResetPass2('');
      setMsg({ type: 'ok', text: t("Parol yangilandi. Endi yangi parol bilan kiring.") });
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const openForgot = () => { setForgot(true); setResetStep('email'); setMsg(null); };
  const closeForgot = () => { setForgot(false); setResetStep('email'); setMsg(null); };

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (isRegister && password !== password2) {
      setMsg({ type: 'err', text: t('Parollar bir xil emas.') });
      return;
    }
    if (isRegister && !botAck) {
      setMsg({ type: 'err', text: t('Avval botga yozganingizni tasdiqlovchi katakchani belgilang.') });
      return;
    }
    if (isRegister && !tosAccepted) {
      setMsg({ type: 'err', text: t('Davom etish uchun ommaviy oferta shartlariga rozilik bering.') });
      return;
    }
    if (isRegister && !code.trim()) {
      setMsg({ type: 'err', text: t("Telegram botga yuborilgan tasdiqlash kodini kiriting.") });
      return;
    }
    setBusy(true);
    try {
      if (isRegister) await authRegister(email.trim(), password, { phone: phone.trim(), botAck, tosAccepted, promoCode: promoCode.trim(), code: code.trim() });
      else await authLogin(email.trim(), password);
      await refresh();
      if (isRegister && profileKind === 'company') {
        try { sessionStorage.removeItem(REG_TYPE_KEY); } catch { /* jim */ }
        navigate('/company/create');
      } else {
        navigate('/account');
      }
    } catch (err) {
      setMsg({ type: 'err', text: errText(err, t, BOT_LINK) });
      setBusy(false);
    }
  };

  const pickKind = (kind) => {
    setProfileKind(kind);
    try { sessionStorage.setItem(REG_TYPE_KEY, kind); } catch { /* jim */ }
  };

  return (
    <main className="mx-auto w-full max-w-[1800px] overflow-x-hidden px-5 sm:px-10 lg:px-14 pb-16">
      <section className="grid items-center gap-10 pt-10 sm:pt-16 lg:grid-cols-2 lg:gap-14">
        <div className="hidden justify-self-center lg:flex">
          <div className="flex flex-col items-center gap-6">
            <div className="animate-[floatY_5.5s_ease-in-out_infinite]">
              <Interactive3DCard>
                <NfcCard code="ABZ007" name={t('SIZNING ISMINGIZ')} finish="showcase" size="lg" rim />
              </Interactive3DCard>
            </div>
            <p className="max-w-[280px] text-center text-sm text-base-content/45">{t("Raqamli profilingiz. Shaxsiy ma'lumotlaringiz. Bitta joyda.")}</p>
          </div>
        </div>
        <div className="flex min-w-0 justify-center lg:justify-start">
        <div className="vz-card w-full max-w-md min-w-0 p-6 sm:p-7">
          <div className="vz-kicker">NFCSTORE</div>
          {forgot ? (
            <>
              <h2 className="vz-h2 mt-2 !text-2xl">{t('Parolni tiklash')}</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-base-content/55">
                {resetStep === 'email'
                  ? t("Email manzilingizni kiriting — tasdiqlash kodi akkauntingizga ulangan Telegram botga yuboriladi.")
                  : t("Telegram'ga kelgan 6 xonali kodni va yangi parolni kiriting.")}
              </p>
              <form onSubmit={resetStep === 'email' ? (e) => { e.preventDefault(); requestReset(); } : submitReset} className="mt-6 space-y-3">
                <label className="form-control">
                  <span className="vz-label !mb-0">Email</span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="ism@gmail.com" autoComplete="email" required disabled={resetStep === 'code'}
                    className="input input-bordered mt-1 w-full bg-base-100" />
                </label>
                {resetStep === 'code' && (
                  <>
                    <label className="form-control">
                      <span className="vz-label !mb-0">{t('Telegram orqali tasdiqlash kodi')}</span>
                      <input type="text" inputMode="numeric" value={resetCode} onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder={t('6 xonali kod')} maxLength={6} required
                        className="input input-bordered mt-1 w-full bg-base-100 font-mono tracking-widest" />
                    </label>
                    <label className="form-control">
                      <span className="vz-label !mb-0">{t('Yangi parol')}</span>
                      <input type="password" value={resetPass} onChange={(e) => setResetPass(e.target.value)}
                        placeholder={t('Kamida 6 belgi')} autoComplete="new-password" required minLength={6}
                        className="input input-bordered mt-1 w-full bg-base-100" />
                    </label>
                    <label className="form-control">
                      <span className="vz-label !mb-0">{t('Parolni takrorlang')}</span>
                      <input type="password" value={resetPass2} onChange={(e) => setResetPass2(e.target.value)}
                        placeholder={t('Parolni qayta kiriting')} autoComplete="new-password" required
                        className="input input-bordered mt-1 w-full bg-base-100" />
                    </label>
                  </>
                )}
                <button className="btn btn-gold w-full" disabled={busy}>
                  {busy ? <span className="loading loading-spinner loading-sm"></span> : resetStep === 'email' ? t('Kod yuborish') : t('Parolni yangilash')}
                </button>
                {resetStep === 'code' && (
                  <button type="button" className="btn btn-ghost-vz w-full" disabled={busy} onClick={requestReset}>{t('Kodni qayta yuborish')}</button>
                )}
              </form>
              {msg && <div className={`alert mt-4 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(msg.text)}</span></div>}
              <p className="mt-3 text-xs leading-relaxed text-base-content/45">
                {t('Kod kelmadimi? Telefoningiz botga ulanganini tekshiring:')}{' '}
                <a href={BOT_LINK} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent underline underline-offset-2"><IconTelegram width={12} height={12} /> @{botUsername}</a>
              </p>
              <div className="mt-5 text-center text-sm text-base-content/55">
                <button type="button" onClick={closeForgot} className="min-h-11 cursor-pointer underline underline-offset-2 hover:text-base-content">{t('Kirish sahifasiga qaytish')}</button>
              </div>
            </>
          ) : (
          <>
          <h2 className="vz-h2 mt-2 !text-2xl">{isRegister ? t('Ro\u2019yxatdan o\u2019tish') : t('Kirish')}</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-base-content/55">
            {isRegister
              ? t("Akkaunt yarating — sotib olgan raqamli tashrif qog'ozingiz profilingiz bilan birga shu yerda bo\u2019ladi.")
              : t("Raqamli tashrif qog'ozilaringizni boshqarish uchun akkauntingizga kiring.")}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-3">
            {isRegister && (
              <div>
                <span className="vz-label">{t('Profil turi')}</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['personal', t('Shaxsiy profil'), t('Odam, mutaxassis'), IconUser],
                    ['company', t('Kompaniya profili'), t('Biznes, do‘kon, restoran'), IconShield],
                  ].map(([id, label, sub, Icon]) => (
                    <button key={id} type="button" onClick={() => pickKind(id)} aria-pressed={profileKind === id}
                      className={`min-h-11 min-w-0 rounded-xl border p-3 text-left transition ${profileKind === id ? 'border-accent bg-accent/10' : 'border-white/10 hover:border-white/25'}`}>
                      <div className={`flex items-center gap-1.5 text-sm font-bold ${profileKind === id ? 'text-accent' : ''}`}><Icon width={15} height={15} /> <span className="truncate">{label}</span></div>
                      <div className="mt-0.5 text-xs text-base-content/45">{sub}</div>
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-base-content/40">
                  {profileKind === 'company'
                    ? t("Ro'yxatdan o'tgach, kompaniya uchun alohida Company ID ochish sahifasiga o'tasiz.")
                    : t("Ro'yxatdan o'tgach, bepul shaxsiy NFC ID bilan kabinetga kirasiz.")}
                </p>
              </div>
            )}
            <label className="form-control">
              <span className="text-xs font-semibold text-base-content/70">Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="ism@gmail.com" autoComplete="email" required
                className="input input-bordered mt-1 w-full bg-base-100" />
            </label>
            <label className="form-control">
              <span className="flex items-center justify-between text-xs font-semibold text-base-content/70">
                {t('Parol')}
                {!isRegister && (
                  <button type="button" onClick={openForgot} className="min-h-6 cursor-pointer font-normal text-accent underline underline-offset-2">{t('Parolni unutdingizmi?')}</button>
                )}
              </span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={t('Kamida 6 belgi')} autoComplete={isRegister ? 'new-password' : 'current-password'} required minLength={6}
                className="input input-bordered mt-1 w-full bg-base-100" />
            </label>
            {isRegister && (
              <label className="form-control">
                <span className="text-xs font-semibold text-base-content/70">{t('Parolni takrorlang')}</span>
                <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)}
                  placeholder={t('Parolni qayta kiriting')} autoComplete="new-password" required
                  className="input input-bordered mt-1 w-full bg-base-100" />
              </label>
            )}
            {isRegister && (
              <label className="form-control">
                <span className="text-xs font-semibold text-base-content/70">{t('Telefon raqamingiz')}</span>
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
                    <b>{t("Ro'yxatdan o'tishdan oldin")}</b>, {' '}
                    <a href={BOT_LINK} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
                      {t('shu Telegram botimizga')} (@{botUsername})
                    </a>{' '}
                    {t("o'ting va u yerga ism-familyangiz hamda telefon raqamingizni yozib qoldiring. Bu — jismoniy NFC kartangizni to'g'ri manzilga yetkazib berishimiz uchun kerak. Buni bajargan bo'lsangiz, shu katakchani belgilang.")}
                  </span>
                </label>
              </div>
            )}
            {isRegister && (
              <div className="rounded-xl border border-white/10 bg-base-100/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-base-content/70">{t('Telegram orqali tasdiqlash kodi')}</span>
                  <button type="button" className="btn btn-outline btn-xs" disabled={codeSending || !phone.trim()} onClick={requestCode}>
                    {codeSending ? <span className="loading loading-spinner loading-xs"></span> : codeSent ? t('Qayta yuborish') : t('Kod yuborish')}
                  </button>
                </div>
                {codeMsg && <p className={`mt-2 text-xs ${codeMsg.type === 'ok' ? 'text-accent' : 'text-error'}`}>{codeMsg.text}</p>}
                <input type="text" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={t('6 xonali kod')} maxLength={6}
                  className="input input-bordered input-sm mt-2 w-full bg-base-100 font-mono tracking-widest" />
                <p className="mt-1.5 text-[14px] text-base-content/45">{t("Kod botga yuboriladi — botga hali yozmagan bo'lsangiz, avval yuqoridagi katakchani belgilang.")}</p>
              </div>
            )}
            {isRegister && (
              <label className="form-control">
                <span className="text-xs font-semibold text-base-content/70">{t("Do'stingiz promokodi (ixtiyoriy)")}</span>
                <input type="text" value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder={t('Masalan: AB3X9K')} maxLength={12}
                  className="input input-bordered mt-1 w-full bg-base-100 font-mono uppercase" />
              </label>
            )}
            {isRegister && (
              <label className="flex cursor-pointer items-start gap-2.5">
                <input type="checkbox" checked={tosAccepted} onChange={(e) => setTosAccepted(e.target.checked)}
                  className="checkbox checkbox-sm mt-0.5" required />
                <span className="text-xs leading-relaxed text-base-content/75">
                  {t('Men')} <a href="/shartlar" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">{t('ommaviy oferta shartlari')}</a>{t("ni o'qib chiqdim va roziman.")}
                </span>
              </label>
            )}
            <button className="btn btn-gold w-full" disabled={busy}>
              {busy ? <span className="loading loading-spinner loading-sm"></span> : isRegister ? t('Akkaunt yaratish') : t('Kirish')}
            </button>
          </form>

          {msg && <div className={`alert mt-4 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(msg.text)}</span></div>}

          <div className="mt-5 text-center text-sm text-base-content/55">
            {isRegister ? (
              <>{t('Akkauntingiz bormi?')}{' '}
                <button onClick={() => navigate('/login')} className="min-h-11 cursor-pointer underline underline-offset-2 hover:text-base-content">{t('Kirish')}</button>
              </>
            ) : (
              <>{t('Akkauntingiz yo‘qmi?')}{' '}
                <button onClick={() => navigate('/register')} className="min-h-11 cursor-pointer underline underline-offset-2 hover:text-base-content">{t('Ro’yxatdan o’tish')}</button>
              </>
            )}
          </div>
          </>
          )}
        </div>
        </div>
      </section>
    </main>
  );
}
