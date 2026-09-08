import { useEffect, useState } from 'react';
import { authLogin, authRegister, useAuth } from '../lib/auth.jsx';
import { navigate } from '../lib/router.js';
import { normalizePhone, prettyPhone } from '../lib/phone.js';
import { useLanguage } from '../lib/i18n.jsx';
import { dbGetTelegramBotUsername, dbAuthResetPassword } from '../lib/db.js';
import TgLinkBox from '../components/TgLinkBox.jsx';
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
  if (key === 'phone_taken') return t('Bu telefon raqami bilan allaqachon akkaunt ochilgan. Kirishga urinib ko‘ring yoki parolni tiklang.');
  if (key === 'bad_login') return t('Telefon raqami yoki email formati noto‘g‘ri.');
  if (key === 'link_not_confirmed') return t('Telegram tasdig‘i topilmadi yoki muddati o‘tgan. «Telegramda tasdiqlash» tugmasini qayta bosing.');
  if (key === 'link_phone_mismatch') return t('Botda tasdiqlangan raqam bu akkauntdagi raqamga mos kelmadi.');
  if (key === 'bot_not_configured') return t('Telegram bot hozir sozlanmagan. Birozdan so‘ng urinib ko‘ring.');
  if (key === 'bad_phone') return t("Telefon raqamini to'g'ri kiriting.");
  if (key === 'tg_send_failed') return t("Telegram orqali kod yuborib bo'lmadi. Birozdan so'ng qayta urining.");
  // Backend validatsiya xabarlari — t() orqali (topilsa) tarjima qilinadi.
  if (key && /telefon|bot|kamida|format/i.test(key)) return t(key);
  return t("Xatolik yuz berdi. Ma'lumotlarni tekshirib qayta urinib ko'ring.");
}

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  // Kirgandan keyin qaytiladigan yo'l (masalan /business).
  const nextPath = (() => {
    try {
      const raw = new URLSearchParams(window.location.search).get('next') || '';
      return /^\/(?!\/)[A-Za-z0-9\-/_]*$/.test(raw) ? raw : '';
    } catch { return ''; }
  })();
  const isBusiness = nextPath === '/business';
  // Emaildagi havoladan kelgan bir martalik token (/login?reset=...).
  // Bo'lsa — darhol "yangi parol qo'ying" oynasi ochiladi, hech qanday
  // kod yoki Telegram tasdig'i so'ralmaydi: havolaning o'zi isbot.
  const resetToken = (() => {
    try { return new URLSearchParams(window.location.search).get('reset') || ''; } catch { return ''; }
  })();
  const { refresh } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [phone, setPhone] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);
  // Telegram tasdig'i — raqam ham, token ham BOTDAN keladi.
  const [linkToken, setLinkToken] = useState('');
  // Ketma-ket noto'g'ri parol. 3 tadan keyin odamga parolni tiklash
  // yo'li ochiq taklif qilinadi: u yerda ham kod yozilmaydi, botda
  // bitta tugma bosiladi.
  const [failCount, setFailCount] = useState(0);
  const [promoCode, setPromoCode] = useState(() => new URLSearchParams(window.location.search).get('promo') || '');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
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
  // `resetToken` bo'lsa parol tiklash oynasi DARHOL ochiladi — odam
  // emaildagi havolani bosgan, uni yana "Parolni unutdingizmi?" ni
  // qidirishga majburlash mantiqsiz.
  const [forgot, setForgot] = useState(() => !!resetToken);
  const [emailSent, setEmailSent] = useState(false);
  const [resetPass, setResetPass] = useState('');
  const [resetPass2, setResetPass2] = useState('');

  // Parolni tiklash — endi ham KODSIZ. Odam botda "Kontaktni ulashish"
  // ni bosadi, Telegram raqamni o'zi tasdiqlaydi va server o'sha raqam
  // akkauntdagi raqam bilan mos kelishini tekshiradi.
  const submitReset = async (e) => {
    e.preventDefault();
    setMsg(null);
    // Emaildagi havoladan kelgan bo'lsa, login ham, Telegram tasdig'i
    // ham so'ralmaydi — havolaning o'zi isbot.
    if (!resetToken) {
      if (!email.trim()) { setMsg({ type: 'err', text: t('Telefon raqami yoki emailingizni kiriting.') }); return; }
      if (!linkToken) { setMsg({ type: 'err', text: t('Avval Telegram orqali tasdiqlang.') }); return; }
    }
    if (resetPass.length < 6) { setMsg({ type: 'err', text: t('Parol kamida 6 belgidan iborat bo\u2019lishi kerak.') }); return; }
    if (resetPass !== resetPass2) { setMsg({ type: 'err', text: t('Parollar bir xil emas.') }); return; }
    setBusy(true);
    try {
      await dbAuthResetPassword(email.trim(), resetToken ? { emailToken: resetToken } : { linkToken }, resetPass);
      setPassword('');
      setForgot(false);
      setLinkToken(''); setPhone('');
      setResetPass(''); setResetPass2('');
      setFailCount(0);
      setMsg({ type: 'ok', text: t("Parol yangilandi. Endi yangi parol bilan kiring.") });
    } catch (err) {
      setMsg({ type: 'err', text: errText(err, t, BOT_LINK) });
    } finally {
      setBusy(false);
    }
  };

  const openForgot = () => { setForgot(true); setMsg(null); setLinkToken(''); setPhone(''); };
  const closeForgot = () => { setForgot(false); setMsg(null); setLinkToken(''); setPhone(''); };

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (isRegister && password !== password2) {
      setMsg({ type: 'err', text: t('Parollar bir xil emas.') });
      return;
    }
    if (isRegister && !tosAccepted) {
      setMsg({ type: 'err', text: t('Davom etish uchun ommaviy oferta shartlariga rozilik bering.') });
      return;
    }
    setBusy(true);
    try {
      if (isRegister) await authRegister(email.trim(), password, { phone: phone.trim(), tosAccepted, promoCode: promoCode.trim() });
      else await authLogin(email.trim(), password);
      setFailCount(0);
      await refresh();
      // `?next=` — qayerdan kelgan bo'lsa, o'sha yerga qaytadi.
      // Biznes kirish eshigi (/business) shu orqali ishlaydi: odam
      // kirgandan keyin shaxsiy kabinetga emas, biznes kabinetga tushadi.
      // XAVFSIZLIK: faqat SHU saytdagi yo'l qabul qilinadi ("/..."),
      // "//" yoki to'liq manzil emas — aks holda havola orqali begona
      // saytga olib chiqib ketish mumkin bo'lardi.
      if (nextPath) {
        try { sessionStorage.removeItem(REG_TYPE_KEY); } catch { /* jim */ }
        navigate(nextPath);
      } else if (isRegister && profileKind === 'company') {
        try { sessionStorage.removeItem(REG_TYPE_KEY); } catch { /* jim */ }
        navigate('/company/create');
      } else {
        navigate('/account');
      }
    } catch (err) {
      if (!isRegister && err?.message === 'bad_credentials') setFailCount((n) => n + 1);
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
      <section className="grid items-center gap-8 pt-6 sm:pt-10 lg:grid-cols-2 lg:gap-12">
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
        {/* Ro'yxatda maydonlar ikki ustunda joylashadi, shuning uchun
            karta kengroq. 100% masshtabda butun forma — tugmasi bilan —
            ekranga sig'ishi kerak edi; avval pastki qismi kesilib
            qolardi va odam "Akkaunt ochish" ni ko'rmasdi. */}
        <div className={`vz-card w-full min-w-0 p-5 sm:p-6 ${isRegister ? 'max-w-2xl' : 'max-w-md'}`}>
          <div className="vz-kicker">NFCSTORE</div>
          {forgot ? (
            <>
              <h2 className="vz-h2 mt-2 !text-2xl">{t('Parolni tiklash')}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-base-content/55">
                {resetToken
                  ? t('Havola tasdiqlandi. Endi yangi parol qo‘ying.')
                  : t("Telefon raqamingiz yoki emailingizni yozing va Telegram orqali tasdiqlang — so‘ng yangi parol qo‘yasiz. Hech qanday kod kiritilmaydi.")}
              </p>
              <form onSubmit={submitReset} className="mt-6 space-y-3">
                {/* Server ikkalasini ham qabul qiladi — emailsiz odam
                    faqat raqamini biladi. */}
                {/* Emaildagi havoladan kelganda bu maydonlar KERAK EMAS:
                    token o'zi qaysi akkaunt ekanini biladi. Ularni
                    ko'rsatish odamni bekorga chalkashtirardi. */}
                {!resetToken && (
                <label className="form-control">
                  <span className="vz-label !mb-0">{t('Telefon yoki email')}</span>
                  <input type="text" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="+998901234567" autoComplete="username" required
                    className="input input-bordered mt-1 w-full bg-base-100" />
                </label>
                )}

                {/* Tasdiqlash — ro'yxatdan o'tishdagi bilan AYNAN bir xil
                    oqim. Odam ikki joyda ikki xil narsa o'rganmasin. */}
                {!resetToken && <TgLinkBox
                  botUsername={botUsername}
                  linkedPhone={phone}
                  title={t('Akkauntingizga ulangan Telegram orqali tasdiqlang')}
                  onLinked={(p, token) => { setPhone(p); setLinkToken(token); }}
                />}

                {/* EMAIL YO'LI (2026-09) — Telegramga QO'SHIMCHA.
                    Emaili bor odam botga kirmasdan, pochtadagi havola
                    orqali ham parolini tiklay oladi. Javob har doim bir
                    xil: "yubordik" — akkaunt bor-yo'qligi oshkor
                    qilinmaydi. */}
                {!resetToken && /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email.trim()) && (
                  <div className="rounded-xl border border-white/10 p-3">
                    <div className="text-xs font-semibold text-base-content/70">{t('Yoki email orqali')}</div>
                    <button
                      type="button"
                      className="btn btn-ghost-vz btn-sm mt-2 min-h-11 w-full"
                      disabled={emailSent || busy}
                      onClick={async () => {
                        setBusy(true); setMsg(null);
                        try {
                          const r = await fetch('/api/auth/request-email-reset', {
                            method: 'POST',
                            headers: { 'content-type': 'application/json' },
                            body: JSON.stringify({ email: email.trim().toLowerCase() }),
                          });
                          if (r.status === 429) throw new Error('rate');
                          setEmailSent(true);
                          setMsg({ type: 'ok', text: t('Agar bu manzil bizda ro‘yxatdan o‘tgan bo‘lsa, havola yuborildi. Pochtangizni (va "Spam" papkasini) tekshiring.') });
                        } catch (e) {
                          setMsg({ type: 'err', text: e?.message === 'rate' ? t('Juda ko‘p urinish. Birozdan so‘ng qayta urinib ko‘ring.') : t('Server bilan aloqa yo‘q. Qayta urinib ko‘ring.') });
                        } finally { setBusy(false); }
                      }}
                    >
                      {emailSent ? t('Havola yuborildi') : t('Emailga havola yuborish')}
                    </button>
                  </div>
                )}

                {(linkToken || resetToken) && (
                  <>
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

                <button className="btn btn-gold w-full" disabled={busy || !linkToken}>
                  {busy ? <span className="loading loading-spinner loading-sm"></span> : t('Parolni yangilash')}
                </button>
              </form>
              {msg && <div className={`alert mt-4 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(msg.text)}</span></div>}
              <p className="mt-3 text-xs leading-relaxed text-base-content/45">
                {t('Telefon raqamingiz akkauntdagi raqam bilan mos kelishi kerak. Bot:')}{' '}
                <a href={BOT_LINK} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent underline underline-offset-2"><IconTelegram width={12} height={12} /> @{botUsername}</a>
              </p>
              <div className="mt-4 text-center text-sm text-base-content/55">
                <button type="button" onClick={closeForgot} className="min-h-11 cursor-pointer underline underline-offset-2 hover:text-base-content">{t('Kirish sahifasiga qaytish')}</button>
              </div>
            </>
          ) : (
          <>
          {/* BIZNES ESHIGIDAN kelgan bo'lsa (/business), oyna kompaniya
              uchun ekani darhol bilinsin — odam "noto'g'ri joyga
              tushdimmi" deb o'ylamasin. Maydonlar bir xil: akkaunt
              bitta, faqat kirgandan keyin biznes kabinetga qaytadi. */}
          {isBusiness && <span className="vz-badge vz-badge--gold mt-2">{t('NFCSTORE BUSINESS')}</span>}
          <h2 className="vz-h2 mt-2 !text-2xl">
            {isBusiness
              ? (isRegister ? t('Kompaniya uchun ro\u2019yxatdan o\u2019tish') : t('Biznes kabinetga kirish'))
              : (isRegister ? t('Ro\u2019yxatdan o\u2019tish') : t('Kirish'))}
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-base-content/55">
            {isBusiness
              ? (isRegister
                ? t('Akkaunt oching — so\u2019ng Company ID ochasiz. Shaxsiy NFC kartalaringiz bunga aralashmaydi.')
                : t('Kompaniyalaringizni boshqarish uchun kiring. Akkaunt shu telefon/parol \u2014 alohida raqam kerak emas.'))
              : (isRegister
                ? t("Akkaunt oching — sotib olgan raqamli tashrif qog'ozingiz profilingiz bilan birga shu yerda bo\u2019ladi.")
                : t("Raqamli tashrif qog'ozilaringizni boshqarish uchun akkauntingizga kiring."))}
          </p>

          <form onSubmit={submit} className="mt-4 space-y-2.5">
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
            {/* KIRISH: bitta maydon, ikkalasini ham qabul qiladi.
                Emailsiz ro'yxatdan o'tgan odam faqat raqamini biladi;
                eski foydalanuvchilar esa email bilan kirishda davom
                etadi. Qaysi biri yozilganini server o'zi aniqlaydi. */}
            {!isRegister && (
              <label className="form-control">
                <span className="text-xs font-semibold text-base-content/70">{t('Telefon yoki email')}</span>
                <input type="text" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="+998901234567" autoComplete="username" required
                  className="input input-bordered mt-1 w-full bg-base-100" />
              </label>
            )}

            {/* RO'YXAT MAYDONLARI IKKI USTUNDA (keng ekranda).
                Sakkiz qatorli forma 100% masshtabda ekranga sig'masdi va
                "Akkaunt ochish" tugmasi pastda ko'rinmay qolardi —
                odam formani to'ldirib, tugmani topa olmasdi. Ikki ustun
                to'rt qatorni yo'q qiladi. Telefonda avvalgidek bitta
                ustun (`sm:` dan boshlanadi). */}
            {/* O'rovchi <div> HAR DOIM render bo'ladi. Avval u
                `{isRegister && <div ...>` ichida edi — kirishda esa bu
                butun blokni, ya'ni PAROL MAYDONINI ham yo'q qilardi va
                akkauntga kirib bo'lmasdi. Ikki ustun faqat ro'yxatdan
                o'tishda kerak, shuning uchun farq endi faqat SINFDA. */}
            <div className={isRegister ? 'grid gap-3 sm:grid-cols-2' : 'space-y-2.5'}>
            {isRegister && (
              <label className="form-control">
                <span className="text-xs font-semibold text-base-content/70">{t('Telefon raqamingiz')}</span>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="+998901234567" autoComplete="tel" required
                  className="input input-bordered mt-1 w-full bg-base-100" />
                {/* RAQAM QANDAY SAQLANISHI DARHOL KO'RINADI.
                    Forma "90 111 22 33" ni ham, "+998..." ni ham qabul
                    qiladi va ikkalasini bir ko'rinishga keltiradi. Buni
                    yashirsak, odam nima saqlanganini bilmay qoladi —
                    shuning uchun natijani ko'rsatib turamiz. Xato
                    bo'lsa ham shu yerda, YUBORISHDAN OLDIN aytiladi. */}
                {phone.trim() ? (
                  normalizePhone(phone) ? (
                    <span className="mt-1 block font-mono text-xs text-[color:var(--vz-gold-2,#f0cf7a)]">
                      {'\u2713'} {prettyPhone(normalizePhone(phone))}
                    </span>
                  ) : (
                    <span className="mt-1 block text-xs text-error">
                      {t('Raqam to‘liq emas. O‘zbekiston: 90 111 22 33 yoki +998901112233.')}
                    </span>
                  )
                ) : (
                  <span className="mt-1 block text-xs text-base-content/40">
                    {t('Shu raqam bilan kirasiz. Chet el raqami ham mumkin: +7, +996…')}
                  </span>
                )}
              </label>
            )}
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
            {/* EMAIL — IXTIYORIY. Ko'p odam email ishlatmaydi va uni
                majburlash bekorga to'siq bo'lardi. Lekin u parolni
                tiklashda kerak bo'ladi, shuning uchun buni shu yerda
                ochiq aytamiz — keyin emas. */}
            {isRegister && (
              <label className="form-control">
                <span className="text-xs font-semibold text-base-content/70">{t('Email (ixtiyoriy)')}</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="ism@gmail.com" autoComplete="email"
                  className="input input-bordered mt-1 w-full bg-base-100" />
                <span className="mt-1 block text-xs text-base-content/40">
                  {t('Parolni unutsangiz tiklash uchun kerak bo‘ladi.')}
                </span>
              </label>
            )}
            {isRegister && (
              <label className="form-control">
                <span className="text-xs font-semibold text-base-content/70">{t("Do'stingiz promokodi (ixtiyoriy)")}</span>
                <input type="text" value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder={t('Masalan: AB3X9K')} maxLength={12}
                  className="input input-bordered mt-1 w-full bg-base-100 font-mono uppercase" />
              </label>
            )}
            </div>
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
              {busy ? <span className="loading loading-spinner loading-sm"></span> : isRegister ? t('Akkaunt ochish') : t('Kirish')}
            </button>
          </form>

          {/* Uch marta xato parol — odam parolini eslay olmayapti.
              Kichkina "Parolni unutdingizmi?" havolasini qidirib
              o'tirmasin: yo'lni o'zimiz ochiq taklif qilamiz. */}
          {!isRegister && failCount >= 3 && (
            <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 p-3.5">
              <div className="text-sm font-semibold text-base-content/85">
                {t('Parol {n} marta xato kiritildi.', { n: failCount })}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-base-content/60">
                {t('Parolni Telegram orqali tiklashingiz mumkin: botda bitta tugma bosasiz va yangi parol qo‘yasiz. Hech qanday kod kiritilmaydi.')}
              </p>
              <button type="button" onClick={openForgot} className="btn btn-gold mt-2.5 min-h-11 w-full">
                <IconTelegram width={16} height={16} /> {t('Telegram orqali parolni tiklash')}
              </button>
            </div>
          )}

          {msg && <div className={`alert mt-4 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(msg.text)}</span></div>}

          <div className="mt-4 text-center text-sm text-base-content/55">
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
