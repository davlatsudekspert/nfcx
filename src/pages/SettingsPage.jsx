import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';
import { dbRequestPasswordCode, dbChangePassword, dbRequestPhoneChangeCode, dbConfirmPhoneChange } from '../lib/db.js';
import BackToCabinet from '../components/BackToCabinet.jsx';
import CardTools from '../components/CardTools.jsx';

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
  const [phoneStep, setPhoneStep] = useState('idle'); // idle | code_sent
  const [newPhone, setNewPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneMsg, setPhoneMsg] = useState(null);

  if (user === undefined) {
    return <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pt-16 text-center text-base-content/45">{t('Yuklanmoqda...')}</main>;
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
    <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pb-16">
      <BackToCabinet />
      <section className="pt-6">
        <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wider text-base-content/70">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>
          {t('Sozlamalar')}
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">{t('Akkaunt sozlamalari')}</h1>
      </section>

      <section className="mt-8 max-w-lg">
        <h2 className="text-lg font-bold">{t("Shaxsiy ma'lumotlar")}</h2>
        <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-base-200/50 p-5">
          <div className="flex items-center justify-between border-b border-white/5 pb-3 text-sm">
            <span className="text-base-content/55">{t('Email (login)')}</span>
            <span className="font-semibold">{user.email}</span>
          </div>
          <div className="flex items-center justify-between border-b border-white/5 pb-3 text-sm">
            <span className="text-base-content/55">{t('Telefon raqamingiz')}</span>
            <span className="font-mono font-semibold">{user.phone || '—'}</span>
          </div>
          <div className="flex items-center justify-between border-b border-white/5 pb-3 text-sm">
            <span className="text-base-content/55">{t("Raqamli tashrif qog'ozlarim")}</span>
            <span className="font-mono text-xs">{myCards.map((c) => c.code).join(', ') || '—'}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-base-content/55">{t('Promokodim')}</span>
            <span className="font-mono">{user.promoCode || '—'}</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-base-content/40">{t("Ism, manzil va boshqa profil ma'lumotlarini")} <a href="/account" className="underline underline-offset-2 hover:text-base-content">{t('Kabinetim')}</a> {t('sahifasida tahrirlaysiz.')}</p>
      </section>

      {myCards.length > 0 && (
        <section className="mt-10 max-w-xl">
          <h2 className="text-lg font-bold">{t('Statistika, lidlar, fayllar va video')}</h2>
          <p className="mt-1 text-sm text-base-content/50">{t('Profilingiz bo‘yicha hisobotlar va yuklangan kontent.')}</p>
          {myCards.length > 1 && (
            <select
              value={toolsCode || myCards[0].code}
              onChange={(e) => setToolsCode(e.target.value)}
              className="select select-bordered select-sm mt-4 w-full max-w-xs bg-base-100 font-mono"
            >
              {myCards.map((c) => (
                <option key={c.code} value={c.code}>{c.code}{c.isPrimary ? '  ★' : ''}</option>
              ))}
            </select>
          )}
          <div className="mt-4">
            <CardTools card={myCards.find((c) => c.code === (toolsCode || myCards[0].code)) || myCards[0]} />
          </div>
        </section>
      )}

      <section className="mt-10 max-w-lg">
        <h2 className="text-lg font-bold">{t("Parolni o'zgartirish")}</h2>
        <p className="mt-1 text-sm text-base-content/50">{t('Xavfsizlik uchun parol Telegram botingizga yuboriladigan bir martalik kod bilan tasdiqlanadi.')}</p>

        <div className="mt-4 rounded-2xl border border-white/10 bg-base-200/50 p-5">
          {step === 'idle' ? (
            <button className="btn btn-primary btn-sm" onClick={requestCode} disabled={busy}>
              {busy ? <span className="loading loading-spinner loading-xs"></span> : t("Telegram'ga kod yuborish")}
            </button>
          ) : (
            <div className="space-y-3">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={t("Telegram'dan kelgan 6 xonali kod")}
                className="input input-bordered input-sm w-full bg-base-100 font-mono tracking-widest"
                maxLength={6}
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('Yangi parol (kamida 6 belgi)')}
                className="input input-bordered input-sm w-full bg-base-100"
              />
              <input
                type="password"
                value={newPassword2}
                onChange={(e) => setNewPassword2(e.target.value)}
                placeholder={t('Yangi parolni takrorlang')}
                className="input input-bordered input-sm w-full bg-base-100"
              />
              <div className="flex gap-2">
                <button className="btn btn-primary btn-sm flex-1" onClick={submitChange} disabled={busy}>
                  {busy ? <span className="loading loading-spinner loading-xs"></span> : t("Parolni o'zgartirish")}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={requestCode} disabled={busy}>{t('Kodni qayta yuborish')}</button>
              </div>
            </div>
          )}
          {msg && <div className={`alert mt-3 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(msg.text)}</span></div>}
        </div>
      </section>

      <section className="mt-10 max-w-lg">
        <h2 className="text-lg font-bold">{t('Telefon raqamini o‘zgartirish')}</h2>
        <p className="mt-1 text-sm text-base-content/50">{t('Yangi raqamni kiriting, so‘ng shu raqam botga ulangan bo‘lishi kerak (avval botga "Kontaktni ulashish" orqali yozing).')}</p>

        <div className="mt-4 rounded-2xl border border-white/10 bg-base-200/50 p-5">
          {phoneStep === 'idle' ? (
            <div className="space-y-3">
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+998901234567"
                className="input input-bordered input-sm w-full bg-base-100"
              />
              <button className="btn btn-primary btn-sm" onClick={requestPhoneCode} disabled={phoneBusy}>
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
                className="input input-bordered input-sm w-full bg-base-100 font-mono tracking-widest"
                maxLength={6}
              />
              <div className="flex gap-2">
                <button className="btn btn-primary btn-sm flex-1" onClick={submitPhoneChange} disabled={phoneBusy}>
                  {phoneBusy ? <span className="loading loading-spinner loading-xs"></span> : t('Telefon raqamini o‘zgartirish')}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={requestPhoneCode} disabled={phoneBusy}>{t('Kodni qayta yuborish')}</button>
              </div>
            </div>
          )}
          {phoneMsg && <div className={`alert mt-3 py-2 text-sm ${phoneMsg.type === 'ok' ? 'alert-success' : 'alert-error'}`}><span>{t(phoneMsg.text)}</span></div>}
        </div>
      </section>
    </main>
  );
}
