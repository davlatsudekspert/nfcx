import { useEffect, useRef, useState } from 'react';
import { dbCreate, dbGetOrder } from '../lib/db.js';
import { fmt } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import { useAuth, authRegister, authLogin } from '../lib/auth.jsx';
import CardDesignerPage from '../pages/CardDesignerPage.jsx';

// Diqqat: haqiqiy bot username'ingizga almashtiring (masalan @NFCStoreBot).
const BOT_USERNAME = 'nfcsalebot';
const BOT_LINK = `https://t.me/${BOT_USERNAME}`;

const PHYSICAL_CARD_FEE = 200_000;

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
  const [acctPhone, setAcctPhone] = useState('');
  const [acctBotAck, setAcctBotAck] = useState(false);
  const [acctTosAccepted, setAcctTosAccepted] = useState(false);
  const [wantPhysicalCard, setWantPhysicalCard] = useState(false);
  const [showDesigner, setShowDesigner] = useState(false);
  const [shippingName, setShippingName] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  // To'lov bosqichi: buyurtma yaratilgach shu yerga o'tamiz.
  const [order, setOrder] = useState(null); // { orderId, payLink, code, price }
  const pollRef = useRef(null);
  const totalPrice = price + (wantPhysicalCard ? PHYSICAL_CARD_FEE : 0);

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
    if (!name.trim()) { setMsg({ type: 'err', text: 'Ismingizni kiriting.' }); return; }
    if (needsAccount) {
      if (!acctEmail.trim()) { setMsg({ type: 'err', text: "Raqamli tashrif qog'ozingizni boshqarish uchun email kiriting." }); return; }
      if (acctPassword.length < 6) { setMsg({ type: 'err', text: 'Parol kamida 6 belgidan iborat bo\u2019lishi kerak.' }); return; }
      if (!acctPhone.trim()) { setMsg({ type: 'err', text: 'Telefon raqamingizni kiriting.' }); return; }
      if (!acctBotAck) { setMsg({ type: 'err', text: "Avval botga yozganingizni tasdiqlovchi katakchani belgilang." }); return; }
      if (!acctTosAccepted) { setMsg({ type: 'err', text: "Ommaviy oferta shartlariga rozilik bering." }); return; }
    }
    if (wantPhysicalCard) {
      if (!shippingName.trim() || !shippingPhone.trim() || !shippingAddress.trim()) {
        setMsg({ type: 'err', text: "Jismoniy karta uchun ism, telefon va manzilni to'liq kiriting." });
        return;
      }
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
        physicalCard: wantPhysicalCard,
        ...(wantPhysicalCard ? {
          shippingName: shippingName.trim(),
          shippingPhone: shippingPhone.trim(),
          shippingAddress: shippingAddress.trim(),
        } : {}),
      };
      const result = await dbCreate(code, data);
      if (!result) {
        setMsg({ type: 'err', text: "Afsuski, bu raqamli tashrif qog'ozi allaqachon band qilingan yoki saqlashda xatolik yuz berdi." });
        setBusy(false);
        return;
      }
      if (result.pending) {
        // Payme yoqilgan: karta hali yaratilmadi, avval to'lov kerak.
        setOrder(result);
        setBusy(false);
        return;
      }
      setMsg({ type: 'ok', text: 'nfcstore.uz/' + code.toLowerCase() + " sizniki bo'ldi! Profilingizga o'tkazilyapti..." });
      setTimeout(() => { onDone(); navigate('/' + code.toLowerCase()); }, 900);
    } catch (err) {
      const code2 = err && err.code;
      const text = code2 === 'reserved_pending_payment'
        ? "Bu raqamli tashrif qog'ozi hozir boshqa birov tomonidan to\u2019lanmoqda. Bir ozdan keyin qayta urinib ko\u2019ring."
        : code2 === 'exclusive_auction_only'
          ? "\u{1F48E} Bu NFC ID EKSLYUZIV daraja — to'g'ridan-to'g'ri sotib olib bo'lmaydi, faqat saytdagi Auksion bo'limi orqali qo'lga kiritiladi."
          : String(err.message).startsWith('bad_credentials')
            ? 'Bu email boshqa akkauntga tegishli va parol mos kelmadi.'
            : String(err.message) === 'phone_not_verified'
              ? `Bu telefon raqami botda tasdiqlanmagan. Avval ${BOT_LINK} ga o'ting, "Kontaktni ulashish" tugmasini bosing, so'ng shu raqamni qayta kiriting.`
              : 'Xatolik: ' + (err && err.message ? err.message : "noma'lum xato");
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
          setMsg({ type: 'ok', text: "To'lov tasdiqlandi! Profilingizga o'tkazilyapti..." });
          await refreshAuth();
          setTimeout(() => { onDone(); navigate('/' + code.toLowerCase()); }, 800);
        } else if (st && (st.status === 'cancelled' || st.status === 'failed_code_taken')) {
          clearInterval(pollRef.current);
          setMsg({ type: 'err', text: st.status === 'cancelled' ? "To'lov bekor qilindi." : "Kechirasiz, siz to'lagan payt bu kod band bo'lib qoldi — pulingiz qaytariladi, biz bilan bog'laning." });
        }
      } catch { /* keyingi urinishda qayta tekshiramiz */ }
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [order]);

  const field = 'form-control';
  const inp = 'input input-bordered input-sm mt-1 w-full bg-base-100';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`relative my-8 w-full rounded-2xl border border-white/10 bg-base-200 shadow-2xl transition-all ${showDesigner ? 'max-w-3xl' : 'max-w-lg'}`}>
        <button className="btn btn-ghost btn-circle btn-sm absolute right-3 top-3" onClick={onClose}>&times;</button>
        {order ? (
          <div className="p-6">
            <h3 className="text-lg font-bold">To'lovni yakunlang</h3>
            <div className="mt-1 font-mono text-sm text-base-content/50">nfcstore.uz/{code.toLowerCase()}</div>
            <p className="mt-4 text-sm leading-relaxed text-base-content/70">
              Raqamli tashrif qog'ozi <b>{fmt(order.price)} so'm</b>lik to'lov tasdiqlangach avtomatik yaratiladi va profilingizga biriktiriladi. Quyidagi tugma orqali to'lovni amalga oshiring — bu oyna o'zi holatni kuzatib turadi.
            </p>
            <a href={order.payLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-5 w-full">
              To'lovga o'tish — {fmt(order.price)} so'm
            </a>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-base-content/50">
              <span className="loading loading-spinner loading-xs"></span>
              To'lov tasdiqlanishini kutmoqdamiz...
            </div>
            {msg && (
              <div className={`alert mt-3 py-2 text-sm ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}>
                <span>{msg.text}</span>
              </div>
            )}
          </div>
        ) : (
        <div className="p-6">
          <h3 className="text-lg font-bold">Raqamli tashrif qog'ozini band qilish</h3>
          <div className="mt-1 font-mono text-sm text-base-content/50">nfcstore.uz/{code.toLowerCase()}</div>

          <div className="mt-5 max-h-[52vh] space-y-3 overflow-y-auto pr-1">
            <label className={field}>
              <span className="text-xs font-semibold text-base-content/70">Ismingiz *</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Azizbek Turgunov" className={inp} />
            </label>
            <label className={field}>
              <span className="text-xs font-semibold text-base-content/70">Kasb / sarlavha</span>
              <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Mobile App Developer & Community Builder" className={inp} />
            </label>
            <label className={field}>
              <span className="text-xs font-semibold text-base-content/70">Avatar rasm havolasi (ixtiyoriy)</span>
              <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." className={inp} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={field}>
                <span className="text-xs font-semibold text-base-content/70">Telegram</span>
                <input value={tg} onChange={(e) => setTg(e.target.value)} placeholder="@username" className={inp} />
              </label>
              <label className={field}>
                <span className="text-xs font-semibold text-base-content/70">Telefon</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 XX XXX XX XX" className={inp} />
              </label>
            </div>
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
                <div className="text-[11px] font-bold uppercase tracking-wider text-base-content/60">Akkaunt — raqamli tashrif qog'ozingizni boshqarish uchun shart *</div>
                <div className="grid grid-cols-2 gap-3">
                  <label className={field}>
                    <span className="text-xs font-semibold text-base-content/70">Email (login) *</span>
                    <input type="email" value={acctEmail} onChange={(e) => setAcctEmail(e.target.value)} placeholder="ism@gmail.com" autoComplete="email" className={inp} />
                  </label>
                  <label className={field}>
                    <span className="text-xs font-semibold text-base-content/70">Parol (min. 6 belgi) *</span>
                    <input type="password" value={acctPassword} onChange={(e) => setAcctPassword(e.target.value)} placeholder="••••••" autoComplete="new-password" className={inp} />
                  </label>
                  <label className={field}>
                    <span className="text-xs font-semibold text-base-content/70">Telefon raqamingiz *</span>
                    <input type="tel" value={acctPhone} onChange={(e) => setAcctPhone(e.target.value)} placeholder="+998901234567" autoComplete="tel" className={inp} />
                  </label>
                </div>
                <div className="rounded-xl border border-accent/30 bg-accent/5 p-3">
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input type="checkbox" checked={acctBotAck} onChange={(e) => setAcctBotAck(e.target.checked)} className="checkbox checkbox-sm mt-0.5" />
                    <span className="text-xs leading-relaxed text-base-content/75">
                      <b>Ro'yxatdan o'tishdan oldin</b>, {' '}
                      <a href={BOT_LINK} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
                        shu Telegram botimizga
                      </a>{' '}
                      o'ting va ism-familyangiz hamda telefon raqamingizni yozib qoldiring — bu jismoniy NFC kartangizni to'g'ri yetkazib berish uchun kerak. Bajargan bo'lsangiz, shu katakchani belgilang.
                    </span>
                  </label>
                </div>
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input type="checkbox" checked={acctTosAccepted} onChange={(e) => setAcctTosAccepted(e.target.checked)} className="checkbox checkbox-sm mt-0.5" />
                  <span className="text-xs leading-relaxed text-base-content/75">
                    Men <a href="/shartlar" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">ommaviy oferta shartlari</a>ni o'qib chiqdim va roziman.
                  </span>
                </label>
                <p className="text-xs leading-relaxed text-base-content/45">
                  Akkauntsiz band qilish endi mumkin emas — aks holda raqamli tashrif qog'ozingiz hech kimning profiliga bog'lanmay qolib ketishi mumkin. Akkaunt bilan uni keyin /account sahifasidan tahrirlaysiz.
                </p>
              </>
            ) : (
              <>
                <div className="divider my-2"></div>
                <p className="text-xs leading-relaxed text-base-content/45">
                  Raqamli tashrif qog'ozi profilingizga biriktiriladi: <b>{user.email}</b>. Keyinchalik /account sahifasidan tahrirlashingiz mumkin.
                </p>
              </>
            )}

            <div className="divider my-2"></div>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 p-3">
              <input type="checkbox" checked={wantPhysicalCard} onChange={(e) => setWantPhysicalCard(e.target.checked)} className="checkbox checkbox-sm mt-0.5" />
              <span className="text-xs leading-relaxed text-base-content/75">
                <b>Jismoniy NFC karta ham buyurtma qilish</b> — kartani qo'lingizga ushlab, telefonga tegizib ochasiz. Qo'shimcha <b>{fmt(PHYSICAL_CARD_FEE)} so'm</b>.
              </span>
            </label>
            {wantPhysicalCard && (
              <div className="mt-2 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
                <input value={shippingName} onChange={(e) => setShippingName(e.target.value)} placeholder="Qabul qiluvchi ism-familya *" className={`${inp} !mt-0`} />
                <input value={shippingPhone} onChange={(e) => setShippingPhone(e.target.value)} placeholder="Telefon (yetkazib berish uchun) *" className={`${inp} !mt-0`} />
                <textarea value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} placeholder="To'liq manzil (shahar, tuman, ko'cha, uy) *" rows={2} className="textarea textarea-bordered textarea-sm w-full bg-base-100" />

                <button type="button" className="btn btn-ghost btn-xs w-full" onClick={() => setShowDesigner((v) => !v)}>
                  {showDesigner ? 'Dizaynerni yopish' : "\u{1F3A8} Kartaning bosma dizaynini hozir belgilash (ixtiyoriy)"}
                </button>
                {showDesigner && (
                  <div className="-mx-3 mt-1 max-h-[60vh] overflow-y-auto border-t border-white/10 px-3 pt-3">
                    <CardDesignerPage embedded />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
            <span className="text-sm text-base-content/60">Jami</span>
            <b className="text-lg">{fmt(totalPrice)} so'm</b>
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
