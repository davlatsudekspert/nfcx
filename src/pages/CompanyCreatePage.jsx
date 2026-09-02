import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { checkCompanyId, companyIdLocalInfo, COMPANY_STATUS, createCompany, listMyCompanies } from '../lib/company.js';
import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';
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

  useEffect(() => { if (user) listMyCompanies().then((data) => setMine(data.companies || [])).catch(() => {}); }, [user]);
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

  if (user === undefined) return <main className="cc-state">{t('Yuklanmoqda…')}</main>;
  if (!user) return <main className="cc-state"><div className="cc-logo">N</div><h1>{t('Kompaniya ochish uchun kiring')}</h1><p>{t('Company ID akkauntingizga biriktiriladi.')}</p><button onClick={() => navigate('/login')}>{t('Kirish')}</button></main>;

  const submit = async (event) => {
    event.preventDefault();
    if (!check?.valid || !check?.available) return;
    setBusy(true); setError('');
    try {
      const data = await createCompany(form);
      navigate(`/workspace/${data.company.companyId.toLowerCase()}`);
    } catch (err) {
      setError(({ company_id_taken: t('Bu Company ID hozirgina band qilindi.'), company_id_reserved: t('Bu Company ID admin rezervida.'), bad_company_id: t('Company ID faqat 3–15 ta lotin harfidan iborat bo‘ladi.') })[err.message] || t('So‘rovni yuborib bo‘lmadi. Qayta urinib ko‘ring.'));
    } finally { setBusy(false); }
  };

  return <main className="cc-page">
    <header className="cc-header"><button onClick={() => navigate('/')}><i>N</i><b>NFCSTORE</b></button><span>{t('COMPANY ACCOUNT')}</span><button onClick={() => navigate('/account')}>← {t('Kabinet')}</button></header>
    <div className="cc-layout">
      <section className="cc-intro"><span className="cc-kicker">{t('YANGI TIZIM · SHAXSIY NFC ID’DAN ALOHIDA')}</span><h1>{t('Kompaniyangiz uchun')} <em>{t('alohida ID')}</em></h1><p>{t('Company ID kompaniya NFC profili, public sahifasi va boshqaruv markazini bir-biriga bog‘laydi. Mavjud shaxsiy NFC kartalaringiz o‘z holicha qoladi.')}</p><div className="cc-flow"><div><b>01</b><span>{t('ID tanlash')}</span></div><i>→</i><div><b>02</b><span>{t('Admin tekshiruvi')}</span></div><i>→</i><div><b>03</b><span>Payme</span></div><i>→</i><div><b>04</b><span>{t('Faollashadi')}</span></div></div>
        {mine.length > 0 && <div className="cc-existing"><span>{t('SIZNING KOMPANIYALARINGIZ')}</span>{mine.map((company) => <button key={company.companyId} onClick={() => navigate(`/workspace/${company.companyId.toLowerCase()}`)}><div><b>{company.displayName}</b><small>{company.companyId}</small></div><strong data-status={company.status}>{t(COMPANY_STATUS[company.status]) || company.status}</strong><i>→</i></button>)}</div>}
      </section>

      <form className="cc-form" onSubmit={submit}>
        <div className="cc-form-title"><span>{t('ARIZA')}</span><h2>{t('Company ID yarating')}</h2><p>{t('Faqat lotin harflari. Raqam, probel va belgi qabul qilinmaydi.')}</p></div>
        <label className="cc-id-field"><span>{t('COMPANY ID')} *</span><div><small>nfcstore.uz/c/</small><input autoFocus value={form.companyId} onChange={(e) => setForm((old) => ({ ...old, companyId: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 15) }))} placeholder={t('KOMPANIYA')} /></div></label>
        <div className={`cc-id-result ${check?.available ? 'available' : check?.valid ? 'unavailable' : ''}`}>
          <div><b>{check?.valid ? `${check.tier || ''} · ${Number(check.price || 0).toLocaleString('uz-UZ')} ${t('so‘m')}` : t('3–15 ta harf')}</b><span>{check?.available === true ? `✓ ${t('Bo‘sh — ariza yuborish mumkin')}` : check?.available === false ? `✕ ${check.reason || t('Band yoki sotuvda emas')}` : check?.reason || t('ID yozishni boshlang')}</span></div>
          {check?.alternatives?.length > 0 && <div className="cc-alternatives">{check.alternatives.map((id) => <button type="button" key={id} onClick={() => setForm((old) => ({ ...old, companyId: id }))}>{id}</button>)}</div>}
        </div>
        <div className="cc-grid">
          <label><span>{t('Kompaniya nomi')} *</span><input required value={form.displayName} onChange={(e) => setForm((old) => ({ ...old, displayName: e.target.value }))} placeholder={t('Masalan, NFC Dorixona')} /></label>
          <label><span>{t('Yo‘nalish')} *</span><select value={form.category} onChange={(e) => setForm((old) => ({ ...old, category: e.target.value }))}>{categories.map(([value,label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>
          <label><span>{t('Kichik soha')}</span><input value={form.subcategory} onChange={(e) => setForm((old) => ({ ...old, subcategory: e.target.value }))} placeholder={t('Masalan, 24/7 dorixona')} /></label>
          <label><span>{t('Shahar')} *</span><input required value={form.city} onChange={(e) => setForm((old) => ({ ...old, city: e.target.value }))} placeholder={t('Toshkent')} /></label>
          <label><span>{t('Telefon')} *</span><input required value={form.phone} onChange={(e) => setForm((old) => ({ ...old, phone: e.target.value }))} placeholder="+998 90 000 00 00" /></label>
          <label><span>Telegram</span><input value={form.telegram} onChange={(e) => setForm((old) => ({ ...old, telegram: e.target.value }))} placeholder="@username" /></label>
          <label className="wide"><span>{t('Kompaniya haqida')} *</span><textarea required minLength={20} value={form.description} onChange={(e) => setForm((old) => ({ ...old, description: e.target.value }))} placeholder={t('Mijoz kompaniyangizni bir qarashda tushunadigan 2–3 jumla yozing.')} /></label>
          {form.sourceCardCode && <label className="wide cc-copy"><input type="checkbox" checked onChange={(e) => setForm((old) => ({ ...old, sourceCardCode: e.target.checked ? form.sourceCardCode : '' }))} /><div><b>{t('{code} dagi eski biznes ma’lumotini qoralamaga nusxalash', { code: form.sourceCardCode })}</b><span>{t('Asl NFC ID va uning profili o‘zgarmaydi.')}</span></div></label>}
        </div>
        {error && <p className="cc-error">{error}</p>}
        <button className="cc-submit" disabled={busy || !check?.available}>{busy ? t('Yuborilmoqda…') : t('Admin tekshiruviga yuborish →')}</button>
        <p className="cc-legal">{t('ID qidirish uni band qilmaydi. Ariza serverda yaratilgandan keyingina ID rezervlanadi.')}</p>
      </form>
    </div>
  </main>;
}

