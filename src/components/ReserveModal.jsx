import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { dbCreate, dbGetOrder } from '../lib/db.js';
import { fmt } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import { useAuth, authRegister, authLogin } from '../lib/auth.jsx';
import { useLanguage } from '../lib/i18n.jsx';
import { usePaymentsInfo } from '../lib/paymentsEnabled.jsx';
import PaymentUnavailableNotice from './PaymentUnavailableNotice.jsx';
import PaymeReadyBadge from './PaymeReadyBadge.jsx';
import TelegramChannelCTA from './TelegramChannelCTA.jsx';
const CardDesignerPage = lazy(() => import('../pages/CardDesignerPage.jsx'));

// Bot username backend'dan (GET /api/telegram/bot → env.TELEGRAM_BOT_USERNAME)
// olinadi; javob kelmasa eski standart qiymat ishlatiladi.
const DEFAULT_BOT_USERNAME = 'nfcsalebot';
let botUsernameCache = null;
async function fetchBotUsername() {
  if (botUsernameCache) return botUsernameCache;
  try {
    const r = await fetch('/api/telegram/bot');
    const d = r.ok ? await r.json() : null;
    botUsernameCache = String(d?.username || '').replace(/^@/, '') || DEFAULT_BOT_USERNAME;
  } catch { botUsernameCache = DEFAULT_BOT_USERNAME; }
  return botUsernameCache;
}

const PHYSICAL_CARD_FEE = 200_000;

// JISMONIY KARTA — BACKEND'DA HALI YO'Q.
// hosting/worker.js (POST /api/records/:code) `physicalCard === true` ni
// ATAYLAB 501 `physical_card_not_supported_yet` bilan rad etadi: pul olib,
// keyin kartani yetkazib bera olmaydigan holatga yo'l qo'ymaslik uchun.
// Avval bu katakcha `disabled={!PAYMENTS_ENABLED}` edi — ya'ni Payme
// yoqilishi bilanoq bosiladigan bo'lardi va belgilagan mijozning BUTUN
// xaridi 501 bilan yiqilardi (faqat qo'shimcha emas). Shu sababli
// backend porti tayyor bo'lguncha alohida bayroq bilan yopiq turadi.
const PHYSICAL_CARD_ENABLED = false;

// Ommaviy oferta tahriri — rozilik yozuvi qaysi matnga berilganini
// keyinchalik aniqlash uchun buyurtma bilan birga saqlanadi.
// TermsPage.jsx o'zgarganda shu qiymat ham yangilanishi kerak.
export const OFFER_VERSION = '2026-09';

export default function ReserveModal({ code, price, onClose, onDone }) {
  const { user, refresh: refreshAuth } = useAuth();
  const { t } = useLanguage();
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
  const [acctPhone, setAcctPhone] = useState('');
  const [acctBotAck, setAcctBotAck] = useState(false);
  const [acctTosAccepted, setAcctTosAccepted] = useState(false);
  const [wantPhysicalCard, setWantPhysicalCard] = useState(false);
  const [showDesigner, setShowDesigner] = useState(false);
  const [shippingName, setShippingName] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [refundAck, setRefundAck] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [botUsername, setBotUsername] = useState(botUsernameCache || DEFAULT_BOT_USERNAME);
  useEffect(() => { let on = true; fetchBotUsername().then((u) => { if (on) setBotUsername(u); }); return () => { on = false; }; }, []);
  const BOT_LINK = `https://t.me/${botUsername}`;
  // To'lov bosqichi: buyurtma yaratilgach shu yerga o'tamiz.
  const [order, setOrder] = useState(null); // { orderId, payLink, code, price }
  const pollRef = useRef(null);
  const { enabled: PAYMENTS_ENABLED, sandbox: paymentsSandbox } = usePaymentsInfo();
  const totalPrice = price + (wantPhysicalCard ? PHYSICAL_CARD_FEE : 0);
  // Band qilish to'lov tizimi tayyor bo'lmaguncha butunlay yopiq —
  // tekin (0 so'm) nomlar ham band qilinmaydi.
  const paymentBlocked = !PAYMENTS_ENABLED;

  // MUHIM: akkaunt endi tanlov emas, majburiy. Tizimga kirmagan bo'lsa,
  // email+parol kiritish shart — aks holda raqamli tashrif qog'ozi hech kimning
  // profiliga bog'lanmay, "egasiz" qolib ketardi (ilgari yuz bergan bug').
  const needsAccount = !user;

  const ensureAccount = async () => {
    if (user) return;
    try {
      await authRegister(acctEmail.trim(), acctPassword, { phone: acctPhone.trim(), botAck: acctBotAck, tosAccepted: acctTosAccepted });
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
    if (!name.trim()) { setMsg({ type: 'err', text: t('Ismingizni kiriting.') }); return; }
    if (needsAccount) {
      if (!acctEmail.trim()) { setMsg({ type: 'err', text: t("Raqamli tashrif qog'ozingizni boshqarish uchun email kiriting.") }); return; }
      if (acctPassword.length < 6) { setMsg({ type: 'err', text: t('Parol kamida 6 belgidan iborat bo\u2019lishi kerak.') }); return; }
      if (!acctPhone.trim()) { setMsg({ type: 'err', text: t('Telefon raqamingizni kiriting.') }); return; }
      if (!acctBotAck) { setMsg({ type: 'err', text: t('Avval botga yozganingizni tasdiqlovchi katakchani belgilang.') }); return; }
      if (!acctTosAccepted) { setMsg({ type: 'err', text: t('Ommaviy oferta shartlariga rozilik bering.') }); return; }
    }
    if (wantPhysicalCard) {
      if (!shippingName.trim() || !shippingPhone.trim() || !shippingAddress.trim()) {
        setMsg({ type: 'err', text: t("Jismoniy karta uchun ism, telefon va manzilni to'liq kiriting.") });
        return;
      }
    }
    if (!refundAck) { setMsg({ type: 'err', text: t("To'lov shartlari va pul qaytarish tartibiga rozilik bering.") }); return; }
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
        // Nizo chiqqanda "rozilik bergan" degan gap emas, YOZUV kerak:
        // qaysi oferta tahririga va qachon rozilik berilgani buyurtma
        // payload'i bilan birga web_orders'da saqlanadi.
        offerVersion: OFFER_VERSION,
        refundAckAt: new Date().toISOString(),
        physicalCard: wantPhysicalCard,
        ...(wantPhysicalCard ? {
          shippingName: shippingName.trim(),
          shippingPhone: shippingPhone.trim(),
          shippingAddress: shippingAddress.trim(),
        } : {}),
      };
      const result = await dbCreate(code, data);
      if (!result) {
        setMsg({ type: 'err', text: t("Afsuski, bu raqamli tashrif qog'ozi allaqachon band qilingan yoki saqlashda xatolik yuz berdi.") });
        setBusy(false);
        return;
      }
      if (result.pending) {
        // Payme yoqilgan: karta hali yaratilmadi, avval to'lov kerak.
        setOrder(result);
        setBusy(false);
        return;
      }
      setMsg({ type: 'ok', text: t('nfcstore.uz/{code} sizniki bo‘ldi! Profilingizga o‘tkazilyapti...', { code: code.toLowerCase() }) });
      setTimeout(() => { onDone(); navigate('/' + code.toLowerCase()); }, 900);
    } catch (err) {
      const code2 = err && err.code;
      const text = code2 === 'reserved_pending_payment'
        ? t("Bu raqamli tashrif qog'ozi hozir boshqa birov tomonidan band qilingan (to'lov kutilmoqda). Agar u 24 soat ichida to'lamasa, avtomatik bo'shaydi \u2014 birozdan keyin qayta urinib ko'ring.")
        : code2 === 'exclusive_auction_only'
          ? t("\u{1F48E} Bu NFC ID EKSLYUZIV daraja — to'g'ridan-to'g'ri sotib olib bo'lmaydi, faqat saytdagi Auksion bo'limi orqali qo'lga kiritiladi.")
          : String(err.message).startsWith('bad_credentials')
            ? t('Bu email boshqa akkauntga tegishli va parol mos kelmadi.')
            : String(err.message) === 'phone_not_verified'
              ? t('Bu telefon raqami botda tasdiqlanmagan. Avval {link} ga o’ting, "Kontaktni ulashish" tugmasini bosing, so’ng shu raqamni qayta kiriting.', { link: BOT_LINK })
              : t('Xatolik: {msg}', { msg: (err && err.message ? err.message : "noma'lum xato") });
      setMsg({ type: 'err', text });
      setBusy(false);
    }
  };

  // To'lov bosqichida buyurtma holatini avtomatik tekshirib turamiz
  // (Payme webhook orqali "paid" bo'lgach karta avtomatik yaratiladi).
  useEffect(() => {
    if (!order) return;
    pollRef.current = setInterval(async () => {
      try {
        const st = await dbGetOrder(order.orderId);
        if (st && st.status === 'paid') {
          clearInterval(pollRef.current);
          setMsg({ type: 'ok', text: t("To'lov tasdiqlandi! Profilingizga o'tkazilyapti...") });
          await refreshAuth();
          setTimeout(() => { onDone(); navigate('/' + code.toLowerCase()); }, 800);
        } else if (st && (st.status === 'cancelled' || st.status === 'failed_code_taken')) {
          clearInterval(pollRef.current);
          setMsg({ type: 'err', text: st.status === 'cancelled' ? t("To'lov bekor qilindi.") : t("Kechirasiz, siz to'lagan payt bu kod band bo'lib qoldi — pulingiz qaytariladi, biz bilan bog'laning.") });
        }
      } catch { /* keyingi urinishda qayta tekshiramiz */ }
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [order]);

  const field = 'form-control';
  const inp = 'vz-input mt-1 w-full';
  // Payme sandbox (test.paycom.uz) — foydalanuvchiga bu test rejimi ekani ko'rsatiladi.
  // Sandbox belgisi endi YAGONA manbadan keladi: backend bayrog'i
  // (/api/settings/payments-enabled -> sandbox) YOKI checkout havolasining
  // test domeni. Avval faqat havola tekshirilardi.
  const payIsSandbox = paymentsSandbox || (!!order?.payLink && /test\.paycom\.uz/i.test(order.payLink));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex min-h-full items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`vz-card relative my-8 w-full transition-all ${showDesigner ? 'max-w-3xl' : 'max-w-lg'}`}>
        <button className="btn btn-ghost btn-circle absolute right-2 top-2 h-11 min-h-11 w-11 text-xl" onClick={onClose} aria-label={t('Yopish')}>&times;</button>
        {order ? (
          <div className="p-6">
            <span className="vz-kicker">{t('Payme')}</span>
            <h3 className="font-display mt-1 text-2xl font-semibold">{t("To'lovni yakunlang")}</h3>
            <div className="mt-1 font-mono text-sm text-base-content/50">nfcstore.uz/{code.toLowerCase()}</div>
            <p className="mt-4 text-sm leading-relaxed text-base-content/70">
              {t("Raqamli tashrif qog'ozi {price} lik to'lov tasdiqlangach avtomatik yaratiladi va profilingizga biriktiriladi. Quyidagi tugma orqali to'lovni amalga oshiring — bu oyna o'zi holatni kuzatib turadi.", { price: fmt(order.price) + " so'm" })}
            </p>
            {PAYMENTS_ENABLED ? (
              <>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <PaymeReadyBadge />
                  {payIsSandbox && <span className="vz-badge vz-badge--warn">{t('PAYME SANDBOX \u00b7 TEST REJIMI')}</span>}
                </div>
                <a href={order.payLink} target="_blank" rel="noopener noreferrer" className="btn btn-gold mt-4 w-full">
                  {t("To'lash — {n} so'm", { n: fmt(order.price) })}
                </a>
                {payIsSandbox && (
                  <p className="mt-2 text-center text-xs font-bold text-[#5fd9ca]">{t('Real pul yechilmaydi \u2014 bu test to\u2019lovi.')}</p>
                )}
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-base-content/50">
                  <span className="loading loading-spinner loading-xs"></span>
                  {t("To'lov tasdiqlanishini kutmoqdamiz...")}
                </div>
              </>
            ) : (
              <>
                <TelegramChannelCTA />
                <button type="button" className="btn btn-disabled mt-4 w-full !cursor-not-allowed opacity-60" disabled aria-disabled="true">
                  {t("To'lash — {n} so'm", { n: fmt(order.price) })}
                </button>
                <div className="mt-4"><PaymentUnavailableNotice /></div>
              </>
            )}
            {msg && (
              <div className={`alert mt-3 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}>
                <span>{t(msg.text)}</span>
              </div>
            )}
          </div>
        ) : (
        <div className="p-6">
          <span className="vz-kicker">{t('NFC ID')}</span>
          <h3 className="font-display mt-1 text-2xl font-semibold">{t("Raqamli tashrif qog'ozini band qilish")}</h3>
          <div className="mt-1 font-mono text-sm text-base-content/50">nfcstore.uz/{code.toLowerCase()}</div>

          <div className="mt-5 max-h-[52vh] space-y-3 overflow-y-auto pr-1">
            <label className={field}>
              <span className="text-xs font-semibold text-base-content/70">{t('Ismingiz *')}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Azizbek Turgunov" className={inp} />
            </label>
            <label className={field}>
              <span className="text-xs font-semibold text-base-content/70">{t('Kasb / sarlavha')}</span>
              <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Mobile App Developer & Community Builder" className={inp} />
            </label>
            <label className={field}>
              <span className="text-xs font-semibold text-base-content/70">{t('Avatar rasm havolasi (ixtiyoriy)')}</span>
              <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." className={inp} />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={field}>
                <span className="text-xs font-semibold text-base-content/70">Telegram</span>
                <input value={tg} onChange={(e) => setTg(e.target.value)} placeholder="@username" className={inp} />
              </label>
              <label className={field}>
                <span className="text-xs font-semibold text-base-content/70">{t('Telefon')}</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 XX XXX XX XX" className={inp} />
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <span className="text-xs font-semibold text-base-content/70">{t('Hashtaglar (vergul bilan)')}</span>
              <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="IT_specialist, community_builder" className={inp} />
            </label>

            {!user ? (
              <>
                <div className="divider my-2"></div>
                <div className="text-[14px] font-bold uppercase tracking-wider text-base-content/60">{t("Akkaunt — raqamli tashrif qog'ozingizni boshqarish uchun shart *")}</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className={field}>
                    <span className="text-xs font-semibold text-base-content/70">{t('Email (login) *')}</span>
                    <input type="email" value={acctEmail} onChange={(e) => setAcctEmail(e.target.value)} placeholder="ism@gmail.com" autoComplete="email" className={inp} />
                  </label>
                  <label className={field}>
                    <span className="text-xs font-semibold text-base-content/70">{t('Parol (min. 6 belgi) *')}</span>
                    <input type="password" value={acctPassword} onChange={(e) => setAcctPassword(e.target.value)} placeholder="••••••" autoComplete="new-password" className={inp} />
                  </label>
                  <label className={field}>
                    <span className="text-xs font-semibold text-base-content/70">{t('Telefon raqamingiz *')}</span>
                    <input type="tel" value={acctPhone} onChange={(e) => setAcctPhone(e.target.value)} placeholder="+998901234567" autoComplete="tel" className={inp} />
                  </label>
                </div>
                <div className="rounded-xl border border-accent/30 bg-accent/5 p-3">
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input type="checkbox" checked={acctBotAck} onChange={(e) => setAcctBotAck(e.target.checked)} className="checkbox checkbox-sm mt-0.5" />
                    <span className="text-xs leading-relaxed text-base-content/75">
                      <b>{t("Ro'yxatdan o'tishdan oldin")}</b>, {' '}
                      <a href={BOT_LINK} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
                        {t('shu Telegram botimizga')}
                      </a>{' '}
                      {t("o'ting va ism-familyangiz hamda telefon raqamingizni yozib qoldiring — bu jismoniy NFC kartangizni to'g'ri yetkazib berish uchun kerak. Bajargan bo'lsangiz, shu katakchani belgilang.")}
                    </span>
                  </label>
                </div>
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input type="checkbox" checked={acctTosAccepted} onChange={(e) => setAcctTosAccepted(e.target.checked)} className="checkbox checkbox-sm mt-0.5" />
                  <span className="text-xs leading-relaxed text-base-content/75">
                    {t('Men')} <a href="/shartlar" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">{t('ommaviy oferta shartlari')}</a>{t("ni o'qib chiqdim va roziman.")}
                  </span>
                </label>
                <p className="text-xs leading-relaxed text-base-content/45">
                  {t("Akkauntsiz band qilish endi mumkin emas — aks holda raqamli tashrif qog'ozingiz hech kimning profiliga bog'lanmay qolib ketishi mumkin. Akkaunt bilan uni keyin /account sahifasidan tahrirlaysiz.")}
                </p>
              </>
            ) : (
              <>
                <div className="divider my-2"></div>
                <p className="text-xs leading-relaxed text-base-content/45">
                  {t("Raqamli tashrif qog'ozi profilingizga biriktiriladi: {email}. Keyinchalik /account sahifasidan tahrirlashingiz mumkin.", { email: user.email })}
                </p>
              </>
            )}

            <div className="divider my-2"></div>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 p-3">
              <input type="checkbox" checked={wantPhysicalCard} onChange={(e) => setWantPhysicalCard(e.target.checked)} className="checkbox checkbox-sm mt-0.5" disabled={!PHYSICAL_CARD_ENABLED} />
              <span className="text-xs leading-relaxed text-base-content/75">
              <b>{t('Jismoniy NFC karta ham buyurtma qilish')}</b> {t(PHYSICAL_CARD_ENABLED ? "— profilingizni jismoniy karta orqali ulashasiz. Qo‘shimcha {fee}." : "— jismoniy karta buyurtmasi tez kunlarda ishga tushadi.", { fee: fmt(PHYSICAL_CARD_FEE) + " so'm" })}
              </span>
            </label>
            {wantPhysicalCard && (
              <div className="mt-2 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
                <input value={shippingName} onChange={(e) => setShippingName(e.target.value)} placeholder={t('Qabul qiluvchi ism-familya *')} className={`${inp} !mt-0`} />
                <input value={shippingPhone} onChange={(e) => setShippingPhone(e.target.value)} placeholder={t('Telefon (yetkazib berish uchun) *')} className={`${inp} !mt-0`} />
                <textarea value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} placeholder={t("To'liq manzil (shahar, tuman, ko'cha, uy) *")} rows={2} className="textarea textarea-bordered textarea-sm w-full bg-base-100" />

                <button type="button" className="btn btn-ghost btn-xs w-full" onClick={() => setShowDesigner((v) => !v)}>
                  {showDesigner ? t('Dizaynerni yopish') : t('Kartaning bosma dizaynini hozir belgilash (ixtiyoriy)')}
                </button>
                {showDesigner && (
                  <div className="-mx-3 mt-1 max-h-[60vh] overflow-y-auto border-t border-white/10 px-3 pt-3">
                    <Suspense fallback={<div className="py-6 text-center text-sm text-base-content/50">{t('Yuklanmoqda...')}</div>}>
                      <CardDesignerPage embedded code={code} />
                    </Suspense>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
            <span className="text-sm text-base-content/60">{t('Jami')}</span>
            <b className="text-lg">{t("{n} so'm", { n: fmt(totalPrice) })}</b>
          </div>

          {/* PUL QAYTARISH TARTIBI — to'lovdan OLDIN, o'qilishi shart joyda.
              Avval bu ma'lumot faqat /shartlar sahifasida edi: mijoz uni
              ko'rmasdan to'lardi. Matn Oferta 2.3-2.6 bandlarining qisqa
              bayoni; to'liq shartlar havola orqali. */}
          <div className="mt-4 rounded-xl border border-warning/25 bg-warning/5 p-3">
            <p className="text-xs font-semibold text-warning">{t("To'lov va pul qaytarish shartlari")}</p>
            <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-base-content/70">
              <li>{t("NFC ID — raqamli mahsulot. To'lov tasdiqlangan zahoti kod profilingizga biriktiriladi, shundan keyin xarid bekor qilinmaydi va pul qaytarilmaydi.")}</li>
              <li>{t("Band qilingan, lekin to'lanmagan buyurtma 24 soatdan keyin o'zi bekor bo'ladi — bu holda hech qanday summa yechilmaydi.")}</li>
              <li>{t("Agar xizmat texnik sabab bilan ko'rsatilmasa yoki summa xato yechilsa — to'langan pul to'liq qaytariladi. Bu huquqni Oferta cheklamaydi.")}</li>
            </ul>
          </div>
          <label className="mt-3 flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={refundAck}
              onChange={(e) => setRefundAck(e.target.checked)}
              className="checkbox checkbox-sm mt-0.5"
              aria-describedby="reserve-refund-ack"
            />
            <span id="reserve-refund-ack" className="text-xs leading-relaxed text-base-content/75">
              {t("Men yuqoridagi to'lov va pul qaytarish shartlari hamda")}{' '}
              <a href="/shartlar" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
                {t('ommaviy oferta')}
              </a>{' '}
              {t("bilan tanishdim va roziman.")}
            </span>
          </label>

          {paymentBlocked && <TelegramChannelCTA />}
          {!paymentBlocked && <div className="mt-3 flex justify-center"><PaymeReadyBadge /></div>}
          <button
            className={`btn btn-gold mt-3 w-full ${paymentBlocked ? 'btn-disabled !cursor-not-allowed opacity-60' : ''}`}
            onClick={submit}
            disabled={busy || paymentBlocked || !refundAck}
            aria-disabled={paymentBlocked}
            title={paymentBlocked ? t('Payme orqali to‘lov imkoniyati tez kunlarda ishga tushadi.') : undefined}
          >
            {busy ? <span className="loading loading-spinner loading-sm"></span> : t('Band qilish')}
          </button>
          {!paymentBlocked && (
            <p className="mt-2 text-center text-xs text-base-content/45">
              {t("Band qilingandan so'ng 24 soat ichida to'lashingiz kerak — aks holda joy avtomatik bo'shaydi.")}
            </p>
          )}
          {paymentBlocked && <div className="mt-3"><PaymentUnavailableNotice /></div>}
          {msg && (
            <div className={`alert mt-3 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}>
              <span>{t(msg.text)}</span>
            </div>
          )}
        </div>
        )}
      </div>
      </div>
    </div>
  );
}
