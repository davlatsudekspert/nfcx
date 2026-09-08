import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { checkCompanyId, companyIdLocalInfo, normalizeCompanyId, COMPANY_STATUS, createCompany, listMyCompanies } from '../lib/company.js';
import { navigate } from '../lib/router.js';
import { companyNameBlocked } from '../lib/nameGuard.js';
import { useLanguage } from '../lib/i18n.jsx';
import { fmt } from '../lib/format.js';
import logo from '../assets/logo-128.png';
import '../company-system.css';

const categories = [
  ['restaurant', 'Restoran / kafe'], ['market', 'Do‘kon / market'], ['services', 'Xizmatlar'],
  ['construction', 'Qurilish'], ['clinic', 'Tibbiyot'], ['pharmacy', 'Dorixona'],
  ['education', 'Ta’lim'], ['other', 'Boshqa'],
];

export default function CompanyCreatePage() {
  const { t } = useLanguage();
  const { user, myCards } = useAuth();
  const [mine, setMine] = useState([]);
  const [form, setForm] = useState({ companyId: '', displayName: '', category: 'market', subcategory: '', city: '', phone: '', telegram: '', description: '', sourceCardCode: '' });
  const [check, setCheck] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Taqiqlangan so'z tekshiruvi — yozayotgan paytda darhol ko'rinadi
  // (klaviatura, paste va autofill — hammasi `value` orqali o'tadi).
  const nameBlocked = companyNameBlocked(form.displayName);
  const [mineState, setMineState] = useState('idle'); // idle | loading | error | ready
  const [mineTick, setMineTick] = useState(0);

  useEffect(() => {
    if (!user) return;
    setMineState('loading');
    listMyCompanies()
      .then((data) => { setMine(data.companies || []); setMineState('ready'); })
      .catch(() => setMineState('error'));
  }, [user, mineTick]);
  useEffect(() => {
    const source = new URLSearchParams(window.location.search).get('from');
    if (source && myCards.some((card) => card.code.toLowerCase() === source.toLowerCase())) setForm((old) => ({ ...old, sourceCardCode: source.toUpperCase() }));
  }, [myCards]);
  useEffect(() => {
    const local = companyIdLocalInfo(form.companyId);
    setCheck(local);
    if (!local.valid) return;
    const timer = setTimeout(() => checkCompanyId(local.companyId).then(setCheck).catch((err) => setCheck({ ...local, available: false, reason: err.message })), 320);
    return () => clearTimeout(timer);
  }, [form.companyId]);

  if (user === undefined) {
    return (
      <main className="cc-state" aria-busy="true">
        <div className="vz-skel mx-auto" style={{ width: 62, height: 62, borderRadius: '50%' }} />
        <div className="vz-skel mx-auto mt-4" style={{ width: 220, height: 24 }} />
        <div className="vz-skel mx-auto mt-3" style={{ width: 160 }} />
        <span className="sr-only">{t('Yuklanmoqda…')}</span>
      </main>
    );
  }
  if (!user) return <main className="cc-state"><div className="cc-logo"><img src={logo} alt="NFCSTORE" /></div><h1>{t('Kompaniya ochish uchun kiring')}</h1><p>{t('Company ID akkauntingizga biriktiriladi.')}</p><button type="button" className="vz-tap" onClick={() => navigate('/login')}>{t('Kirish')}</button></main>;

  const submit = async (event) => {
    event.preventDefault();
    if (!check?.valid || !check?.available) return;
    if (companyNameBlocked(form.displayName)) {
      setError(t('Kompaniya nomida ushbu so‘zdan foydalanish mumkin emas.'));
      return;
    }
    setBusy(true); setError('');
    try {
      const data = await createCompany(form);
      navigate(`/workspace/${data.company.companyId.toLowerCase()}`);
    } catch (err) {
      setError(({ company_id_taken: t('Bu Company ID hozirgina band qilindi.'), company_id_reserved: t('Bu Company ID admin rezervida.'), bad_company_id: t('Company ID faqat 3–15 ta lotin harfidan iborat bo‘ladi.'), name_not_allowed: t('Kompaniya nomida ushbu so‘zdan foydalanish mumkin emas.') })[err.message] || t('So‘rovni yuborib bo‘lmadi. Qayta urinib ko‘ring.'));
    } finally { setBusy(false); }
  };

  return <main className="cc-page">
    <header className="cc-header"><button type="button" className="vz-tap" onClick={() => navigate('/')}><i><img src={logo} alt="NFCSTORE" /></i><b>NFCSTORE</b></button><span>{t('COMPANY ACCOUNT')}</span><button type="button" className="vz-tap" onClick={() => navigate('/account')}>← {t('Kabinet')}</button></header>
    <div className="cc-layout">
      <section className="cc-intro"><span className="cc-kicker">{t('YANGI TIZIM · SHAXSIY NFC ID’DAN ALOHIDA')}</span><h1>{t('Kompaniyangiz uchun')} <em>{t('alohida ID')}</em></h1><p>{t('Company ID kompaniya NFC profili, public sahifasi va boshqaruv markazini bir-biriga bog‘laydi. Mavjud shaxsiy NFC kartalaringiz o‘z holicha qoladi.')}</p><div className="cc-flow"><div><b>01</b><span>{t('ID tanlash')}</span></div><i>→</i><div><b>02</b><span>{t('Admin tekshiruvi')}</span></div><i>→</i><div><b>03</b><span>Payme</span></div><i>→</i><div><b>04</b><span>{t('Faollashadi')}</span></div></div>
        {mineState === 'loading' && <div className="cc-existing" aria-busy="true"><span>{t('SIZNING KOMPANIYALARINGIZ')}</span><div className="vz-skel mt-3" style={{ height: 56, borderRadius: 14 }} /></div>}
        {mineState === 'error' && <div className="cc-existing"><span>{t('SIZNING KOMPANIYALARINGIZ')}</span><div className="vz-empty mt-3" role="alert"><b>{t("Server bilan aloqa yo'q")}</b><button type="button" className="btn btn-outline-gold btn-sm mt-1" onClick={() => setMineTick((n) => n + 1)}>{t('Qayta urinish')}</button></div></div>}
        {mineState === 'ready' && mine.length > 0 && <div className="cc-existing"><span>{t('SIZNING KOMPANIYALARINGIZ')}</span>{mine.map((company) => <button type="button" key={company.companyId} onClick={() => navigate(`/workspace/${company.companyId.toLowerCase()}`)}><div className="min-w-0"><b className="break-words">{company.displayName}</b><small>{company.companyId}</small></div><strong data-status={company.status}>{t(COMPANY_STATUS[company.status]) || company.status}</strong><i>→</i></button>)}</div>}
      </section>

      <form className="cc-form" onSubmit={submit}>
        <div className="cc-form-title"><span>{t('ARIZA')}</span><h2>{t('Company ID yarating')}</h2><p>{t('Lotin harflari, shuningdek o‘zbekcha O‘ va G‘ (masalan g‘oya). Raqam, probel va boshqa belgilar qabul qilinmaydi.')}</p></div>
        <label className="cc-id-field"><span>{t('COMPANY ID')} *</span><div><small>nfcstore.uz/c/</small><input autoFocus value={form.companyId} onChange={(e) => setForm((old) => ({ ...old, companyId: normalizeCompanyId(e.target.value) }))} placeholder={t('KOMPANIYA')} spellCheck={false} autoCapitalize="characters" autoCorrect="off" /></div></label>
        {/* BREND UCHUN HIMOYALANGAN — alohida blok.
            "Band" deb yozish noto'g'ri bo'lardi: bu tugab qolgan narsa
            emas, qoida. Narx ham ko'rsatilmaydi (sotilmaydi), lekin
            rasmiy vakil uchun murojaat yo'li ochiq qoladi — bu bizga
            kompaniya mijozi ham keltiradi. */}
        {/* AUKSION BEKOR QILINDI (2026-09): 'auction' guruhidagi nomlar
            endi PREMIUM NOM — qat'iy narxda, oddiy oqim bilan sotiladi,
            shuning uchun bu "sotuvda emas" tarmog'iga TUSHMAYDI. */}
        {check?.reserved && check.reserved !== 'auction' ? (
          <div className="cc-id-result unavailable">
            <div>
              <b>{check.reserved === 'blocked' ? t('Bu nom taqiqlangan')
                : check.reserved === 'brand' ? t('Bu NFC ID himoyalangan')
                  : t('Bu nom alohida toifaga saqlangan')}</b>
              <span>{check.reserved === 'blocked'
                ? t('Bu NFC ID’dan foydalanish taqiqlangan. Boshqa nom tanlang.')
                : check.reserved === 'brand'
                  ? t('Ushbu nom kompaniya yoki brend nomiga mos kelgani sababli ochiq sotuvga qo‘yilmagan. Agar siz brendning rasmiy egasi yoki vakili bo‘lsangiz, tasdiqlash uchun admin bilan bog‘laning.')
                  : t('Bu nom kripto toifasiga saqlangan va hozircha sotuvda emas.')}</span>
            </div>
            {/* TAQIQLANGAN nomda admin bilan bog'lanish TAKLIF
                QILINMAYDI — bunday nomlar muhokama qilinmaydi. */}
            <div className="cc-alternatives flex-wrap">
              {check.reserved === 'brand' && <button type="button" className="vz-tap" onClick={() => navigate('/aloqa')}>{t('Admin bilan bog‘lanish')}</button>}
              <button type="button" className="vz-tap" onClick={() => setForm((old) => ({ ...old, companyId: '' }))}>{t('Boshqa ID tanlash')}</button>
            </div>
          </div>
        ) : (
        <div className={`cc-id-result ${check?.available ? 'available' : check?.valid ? 'unavailable' : ''}`}>
          <div><b>{check?.valid
            ? `${check.premiumName ? t('PREMIUM NOM') : (check.tier || '').toUpperCase()} · ${fmt(check.price)} ${t('so‘m')}`
            : t('3–15 ta harf')}</b><span>{check?.available === true ? `✓ ${t('Bo‘sh — ariza yuborish mumkin')}` : check?.available === false ? `✕ ${check.reason ? t(check.reason) : t('Band yoki sotuvda emas')}` : (check?.reason ? t(check.reason) : t('ID yozishni boshlang'))}</span></div>
          {check?.alternatives?.length > 0 && <div className="cc-alternatives flex-wrap">{check.alternatives.map((id) => <button type="button" key={id} className="vz-tap" onClick={() => setForm((old) => ({ ...old, companyId: id }))}>{id}</button>)}</div>}
        </div>
        )}
        <div className="cc-grid">
          <label><span>{t('Kompaniya nomi')} *</span><input required value={form.displayName} onChange={(e) => setForm((old) => ({ ...old, displayName: e.target.value }))} placeholder={t('Masalan, NFC Dorixona')} aria-invalid={nameBlocked || undefined} aria-describedby={nameBlocked ? 'cc-name-err' : undefined} />{nameBlocked && <small id="cc-name-err" role="alert" className="cc-name-err">{t('Kompaniya nomida ushbu so‘zdan foydalanish mumkin emas.')}</small>}</label>
          <label><span>{t('Yo‘nalish')} *</span><select value={form.category} onChange={(e) => setForm((old) => ({ ...old, category: e.target.value }))}>{categories.map(([value,label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>
          <label><span>{t('Kichik soha')}</span><input value={form.subcategory} onChange={(e) => setForm((old) => ({ ...old, subcategory: e.target.value }))} placeholder={t('Masalan, 24/7 dorixona')} /></label>
          <label><span>{t('Shahar')} *</span><input required value={form.city} onChange={(e) => setForm((old) => ({ ...old, city: e.target.value }))} placeholder={t('Toshkent')} /></label>
          <label><span>{t('Telefon')} *</span><input required value={form.phone} onChange={(e) => setForm((old) => ({ ...old, phone: e.target.value }))} placeholder="+998 90 000 00 00" /></label>
          <label><span>Telegram</span><input value={form.telegram} onChange={(e) => setForm((old) => ({ ...old, telegram: e.target.value }))} placeholder="@username" /></label>
          <label className="wide"><span>{t('Kompaniya haqida')} *</span><textarea required minLength={20} value={form.description} onChange={(e) => setForm((old) => ({ ...old, description: e.target.value }))} placeholder={t('Mijoz kompaniyangizni bir qarashda tushunadigan 2–3 jumla yozing.')} /></label>
          {form.sourceCardCode && <label className="wide cc-copy"><input type="checkbox" checked onChange={(e) => setForm((old) => ({ ...old, sourceCardCode: e.target.checked ? form.sourceCardCode : '' }))} /><div><b>{t('{code} dagi eski biznes ma’lumotini qoralamaga nusxalash', { code: form.sourceCardCode })}</b><span>{t('Asl NFC ID va uning profili o‘zgarmaydi.')}</span></div></label>}
        </div>
        {error && <p className="cc-error" role="alert">{error}</p>}
        <button type="submit" className="cc-submit vz-tap" disabled={busy || !check?.available || nameBlocked}>{busy ? t('Yuborilmoqda…') : t('Admin tekshiruviga yuborish →')}</button>
        <p className="cc-legal">{t('ID qidirish uni band qilmaydi. Ariza serverda yaratilgandan keyingina ID rezervlanadi.')}</p>
      </form>
    </div>
  </main>;
}

