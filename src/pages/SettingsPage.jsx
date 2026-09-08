import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';
import { dbRequestPasswordCode, dbChangePassword, dbRequestPhoneChangeCode, dbConfirmPhoneChange, dbChangePasswordDirect, dbLinkTelegram } from '../lib/db.js';
import BackToCabinet from '../components/BackToCabinet.jsx';
import CardTools from '../components/CardTools.jsx';
import TgLinkBox from '../components/TgLinkBox.jsx';
import { IconUser, IconShield, IconPhone } from '../components/Icons.jsx';

// Profildagi Sozlamalar sahifasi — o'z ma'lumotlarini ko'rish va
// Telegram orqali kelgan bir martalik kod bilan parolni o'zgartirish.
export default function SettingsPage() {
  const { user, myCards, refresh } = useAuth();
  const { t } = useLanguage();

  const [step, setStep] = useState('idle'); // idle | code_sent
  const [toolsCode, setToolsCode] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // Telefon raqamini o'zgartirish — parolni o'zgartirish bilan bir xil
  // naqsh (Telegram OTP), lekin alohida state (ikkalasi bir vaqtda ochiq
  // bo'lishi mumkin).
  // Joriy parol bilan almashtirish — Telegramga bog'liq bo'lmagan
  // ODATIY yo'l. Botni ulamagan odam ham parolini o'zgartira olsin.
  const [cur, setCur] = useState('');
  const [np, setNp] = useState('');
  const [np2, setNp2] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);

  // "Profilingizni himoyalang" — Telegramni akkauntga bog'lash.
  const [tgBusy, setTgBusy] = useState(false);
  const [tgMsg, setTgMsg] = useState(null);
  const [tgDone, setTgDone] = useState(false);

  const [phoneStep, setPhoneStep] = useState('idle'); // idle | code_sent
  const [newPhone, setNewPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneMsg, setPhoneMsg] = useState(null);

  if (user === undefined) {
    return (
      <main className="mx-auto w-full max-w-[1800px] px-5 sm:px-10 lg:px-14 pt-16" aria-busy="true">
        <div className="vz-skel h-6 w-40"></div>
        <div className="mt-6 max-w-lg space-y-3"><div className="vz-skel h-40 w-full"></div><div className="vz-skel h-28 w-full"></div></div>
      </main>
    );
  }
  if (user === null) {
    navigate('/login', { replace: true });
    return null;
  }

  const submitDirectChange = async () => {
    setPwMsg(null);
    if (np.length < 6) { setPwMsg({ type: 'err', text: t('Parol kamida 6 belgidan iborat bo\u2019lishi kerak.') }); return; }
    if (np !== np2) { setPwMsg({ type: 'err', text: t('Parollar bir xil emas.') }); return; }
    setPwBusy(true);
    try {
      await dbChangePasswordDirect(cur, np);
      setCur(''); setNp(''); setNp2('');
      setPwMsg({ type: 'ok', text: t('Parol yangilandi. Boshqa qurilmalardagi sessiyalar yopildi.') });
    } catch (err) {
      const k = err?.message;
      setPwMsg({ type: 'err', text:
        k === 'bad_current_password' ? t('Joriy parol xato.')
          : k === 'weak_password' ? t('Yangi parol kamida 6 belgidan iborat bo\u2019lishi kerak.')
            : k === 'too_many_requests' ? t('Juda ko\u2018p urinish. Birozdan so\u2018ng qayta urinib ko\u2018ring.')
              : t('Xatolik yuz berdi. Qayta urinib ko\u2018ring.') });
    } finally { setPwBusy(false); }
  };

  const linkTelegram = async (phoneFromBot, token) => {
    setTgMsg(null); setTgBusy(true);
    try {
      await dbLinkTelegram(token);
      setTgDone(true);
      setTgMsg({ type: 'ok', text: t('Telegram ulandi. Endi parolni tiklay olasiz va buyurtma xabarlari keladi.') });
      await refresh();
    } catch (err) {
      const k = err?.message;
      setTgMsg({ type: 'err', text:
        k === 'phone_taken' ? t('Bu raqam boshqa akkauntga bog\u2018langan.')
          : k === 'link_not_confirmed' ? t('Tasdiq topilmadi yoki muddati o\u2018tgan. Tugmani qayta bosing.')
            : t('Ulab bo\u2018lmadi. Qayta urinib ko\u2018ring.') });
    } finally { setTgBusy(false); }
  };

  const requestCode = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await dbRequestPasswordCode();
      setStep('code_sent');
      setMsg({ type: 'ok', text: t('Kod Telegram botingizga yuborildi.') });
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const submitChange = async () => {
    if (!code.trim()) { setMsg({ type: 'err', text: t('Kodni kiriting.') }); return; }
    if (newPassword.length < 6) { setMsg({ type: 'err', text: t('Parol kamida 6 belgidan iborat bo\u2019lishi kerak.') }); return; }
    if (newPassword !== newPassword2) { setMsg({ type: 'err', text: t('Parollar mos kelmadi.') }); return; }
    setBusy(true);
    setMsg(null);
    try {
      await dbChangePassword(code.trim(), newPassword);
      setMsg({ type: 'ok', text: t("Parol muvaffaqiyatli o'zgartirildi!") });
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

  const requestPhoneCode = async () => {
    if (!newPhone.trim()) { setPhoneMsg({ type: 'err', text: t("Yangi telefon raqamini kiriting.") }); return; }
    setPhoneBusy(true);
    setPhoneMsg(null);
    try {
      await dbRequestPhoneChangeCode(newPhone.trim());
      setPhoneStep('code_sent');
      setPhoneMsg({ type: 'ok', text: t('Kod Telegram botingizga yuborildi.') });
    } catch (err) {
      setPhoneMsg({ type: 'err', text: err.message });
    } finally {
      setPhoneBusy(false);
    }
  };

  const submitPhoneChange = async () => {
    if (!phoneCode.trim()) { setPhoneMsg({ type: 'err', text: t('Kodni kiriting.') }); return; }
    setPhoneBusy(true);
    setPhoneMsg(null);
    try {
      await dbConfirmPhoneChange(newPhone.trim(), phoneCode.trim());
      setPhoneMsg({ type: 'ok', text: t('Telefon raqami yangilandi!') });
      setPhoneStep('idle');
      setNewPhone('');
      setPhoneCode('');
      await refresh();
    } catch (err) {
      setPhoneMsg({ type: 'err', text: err.message });
    } finally {
      setPhoneBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1800px] overflow-x-hidden px-5 sm:px-10 lg:px-14 pb-16">
      <BackToCabinet />
      <section className="pt-6">
        <span className="vz-kicker">{t('Sozlamalar')}</span>
        <h1 className="vz-h2 mt-3">{t('Akkaunt sozlamalari')}</h1>
      </section>

      <section className="mt-8 max-w-lg">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><IconUser /> {t("Shaxsiy ma'lumotlar")}</h2>
        <div className="vz-card mt-4 space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-white/5 pb-3 text-sm">
            <span className="text-base-content/55">{t('Email (login)')}</span>
            <span className="min-w-0 break-all font-semibold">{user.email}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-white/5 pb-3 text-sm">
            <span className="text-base-content/55">{t('Telefon raqamingiz')}</span>
            <span className="font-mono font-semibold">{user.phone || '—'}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-white/5 pb-3 text-sm">
            <span className="text-base-content/55">{t("Raqamli tashrif qog'ozlarim")}</span>
            <span className="min-w-0 break-words font-mono text-xs">{myCards.map((c) => c.code).join(', ') || '—'}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
            <span className="text-base-content/55">{t('Promokodim')}</span>
            <span className="font-mono">{user.promoCode || '—'}</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-base-content/40">{t("Ism, manzil va boshqa profil ma'lumotlarini")} <a href="/account" className="underline underline-offset-2 hover:text-base-content">{t('Kabinetim')}</a> {t('sahifasida tahrirlaysiz.')}</p>
      </section>

      {myCards.length > 0 && (
        <section className="mt-10 max-w-xl">
          <h2 className="font-display text-lg font-semibold">{t('Statistika, lidlar, fayllar va video')}</h2>
          <p className="mt-1 text-sm text-base-content/50">{t('Profilingiz bo‘yicha hisobotlar va yuklangan kontent.')}</p>
          {myCards.length > 1 && (
            <select
              value={toolsCode || myCards[0].code}
              onChange={(e) => setToolsCode(e.target.value)}
              className="select select-bordered select-sm mt-4 min-h-11 w-full max-w-xs bg-base-100 font-mono"
              aria-label={t('NFC ID tanlash')}
            >
              {myCards.map((c) => (
                <option key={c.code} value={c.code}>{c.code}{c.isPrimary ? ` — ${t('ASOSIY')}` : ''}</option>
              ))}
            </select>
          )}
          <div className="mt-4">
            <CardTools card={myCards.find((c) => c.code === (toolsCode || myCards[0].code)) || myCards[0]} />
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          PROFILNI HIMOYALASH — Telegramni akkauntga bog'lash.

          Ro'yxatdan o'tishda Telegram endi so'ralmaydi: u yerda
          "Telegram" so'zi TO'SIQ bo'lib ko'rinardi va odamlar shu joyda
          to'xtardi. Bu yerda esa u to'siq emas, IMTIYOZ — nima
          berishini ochiq yozamiz.

          Bog'lanmagan bo'lsa blok ko'rinadi; bog'langach o'rniga qisqa
          tasdiq qoladi (yana bir marta bosishga undamaslik uchun).
          ═══════════════════════════════════════════════════════════════ */}
      <section className="mt-10 max-w-lg">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><IconShield /> {t('Profilingizni himoyalang')}</h2>
        <p className="mt-1 text-sm text-base-content/50">
          {t('Telegramni ulasangiz: parolni unutsangiz o‘zingiz tiklaysiz va buyurtmalaringiz haqida xabar keladi.')}
        </p>

        <div className="vz-card mt-4 p-5">
          {(user.telegramLinked || tgDone) ? (
            <div className="text-sm font-semibold text-accent">{'\u2713'} {t('Telegram ulangan')}</div>
          ) : (
            <>
              <TgLinkBox
                botUsername=""
                title={t('Telegramni ulash')}
                onLinked={linkTelegram}
              />
              {tgBusy && <div className="mt-2 text-xs text-base-content/50">{t('Ulanmoqda…')}</div>}
            </>
          )}
          {tgMsg && <div className={`alert mt-3 py-2 text-sm ${tgMsg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{tgMsg.text}</span></div>}
        </div>
      </section>

      {/* Parolni almashtirishning ODATIY yo'li — joriy parol bilan.
          Ilgari buning uchun ham Telegram kodi kerak edi, ya'ni botni
          ulamagan odam parolini umuman o'zgartira olmasdi. */}
      <section className="mt-10 max-w-lg">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><IconShield /> {t("Parolni o'zgartirish")}</h2>
        <p className="mt-1 text-sm text-base-content/50">{t('Joriy parolingizni kiriting va yangisini qo‘ying.')}</p>

        <div className="vz-card mt-4 space-y-3 p-5">
          <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password"
            placeholder={t('Joriy parol')} className="input input-bordered input-sm min-h-11 w-full bg-base-100" />
          <input type="password" value={np} onChange={(e) => setNp(e.target.value)} autoComplete="new-password"
            placeholder={t('Yangi parol (kamida 6 belgi)')} className="input input-bordered input-sm min-h-11 w-full bg-base-100" />
          <input type="password" value={np2} onChange={(e) => setNp2(e.target.value)} autoComplete="new-password"
            placeholder={t('Yangi parolni takrorlang')} className="input input-bordered input-sm min-h-11 w-full bg-base-100" />
          <button className="btn btn-gold btn-sm min-h-11 w-full" onClick={submitDirectChange} disabled={pwBusy}>
            {pwBusy ? <span className="loading loading-spinner loading-xs"></span> : t("Parolni o'zgartirish")}
          </button>
          {pwMsg && <div className={`alert py-2 text-sm ${pwMsg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{pwMsg.text}</span></div>}
        </div>
      </section>

      {/* Parolni UNUTGAN odam uchun eski, Telegram kodli yo'l — joriy
          parolni bilmasa, yagona yo'l shu. */}
      <section className="mt-10 max-w-lg">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><IconShield /> {t("Parolni unutdingizmi?")}</h2>
        <p className="mt-1 text-sm text-base-content/50">{t('Joriy parolni eslay olmasangiz — Telegram botingizga yuboriladigan bir martalik kod bilan yangilaysiz.')}</p>

        <div className="vz-card mt-4 p-5">
          {step === 'idle' ? (
            <button className="btn btn-gold btn-sm min-h-11" onClick={requestCode} disabled={busy}>
              {busy ? <span className="loading loading-spinner loading-xs"></span> : t("Telegram'ga kod yuborish")}
            </button>
          ) : (
            <div className="space-y-3">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={t("Telegram'dan kelgan 6 xonali kod")}
                className="input input-bordered input-sm min-h-11 w-full bg-base-100 font-mono tracking-widest"
                maxLength={6}
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('Yangi parol (kamida 6 belgi)')}
                className="input input-bordered input-sm min-h-11 w-full bg-base-100"
              />
              <input
                type="password"
                value={newPassword2}
                onChange={(e) => setNewPassword2(e.target.value)}
                placeholder={t('Yangi parolni takrorlang')}
                className="input input-bordered input-sm min-h-11 w-full bg-base-100"
              />
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-gold btn-sm min-h-11 flex-1" onClick={submitChange} disabled={busy}>
                  {busy ? <span className="loading loading-spinner loading-xs"></span> : t("Parolni o'zgartirish")}
                </button>
                <button className="btn btn-ghost btn-sm min-h-11" onClick={requestCode} disabled={busy}>{t('Kodni qayta yuborish')}</button>
              </div>
            </div>
          )}
          {msg && <div className={`alert mt-3 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(msg.text)}</span></div>}
        </div>
      </section>

      <section className="mt-10 max-w-lg">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><IconPhone /> {t('Telefon raqamini o‘zgartirish')}</h2>
        <p className="mt-1 text-sm text-base-content/50">{t('Yangi raqamni kiriting, so‘ng shu raqam botga ulangan bo‘lishi kerak (avval botga "Kontaktni ulashish" orqali yozing).')}</p>

        <div className="vz-card mt-4 p-5">
          {phoneStep === 'idle' ? (
            <div className="space-y-3">
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+998901234567"
                className="input input-bordered input-sm min-h-11 w-full bg-base-100"
              />
              <button className="btn btn-gold btn-sm min-h-11" onClick={requestPhoneCode} disabled={phoneBusy}>
                {phoneBusy ? <span className="loading loading-spinner loading-xs"></span> : t("Telegram'ga kod yuborish")}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="font-mono text-sm text-base-content/60">{newPhone}</div>
              <input
                value={phoneCode}
                onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={t("Telegram'dan kelgan 6 xonali kod")}
                className="input input-bordered input-sm min-h-11 w-full bg-base-100 font-mono tracking-widest"
                maxLength={6}
              />
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-gold btn-sm min-h-11 flex-1" onClick={submitPhoneChange} disabled={phoneBusy}>
                  {phoneBusy ? <span className="loading loading-spinner loading-xs"></span> : t('Telefon raqamini o‘zgartirish')}
                </button>
                <button className="btn btn-ghost btn-sm min-h-11" onClick={requestPhoneCode} disabled={phoneBusy}>{t('Kodni qayta yuborish')}</button>
              </div>
            </div>
          )}
          {phoneMsg && <div className={`alert mt-3 py-2 text-sm ${phoneMsg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(phoneMsg.text)}</span></div>}
        </div>
      </section>
    </main>
  );
}
