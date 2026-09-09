import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import ImageUploadField from '../components/ImageUploadField.jsx';
import { addCompanyItem, beginCompanyPayment, companyCta, COMPANY_STATUS, createCompanyPost, createCompanyStory, deleteCompanyItem, deleteCompanyPost, deleteCompanyStory, getCompany, getCompanyStats, listCompanyOrders, listCompanyPosts, listCompanyStories, setCompanyOrderStatus, submitCompany, updateCompany } from '../lib/company.js';
import { navigate } from '../lib/router.js';
import { dbUploadAudio } from '../lib/db.js';
import { directionsUrl, hasCoords } from '../lib/mapLink.js';
import CompanyQrCard from '../components/CompanyQrCard.jsx';
import StoryUploader from '../components/StoryUploader.jsx';

// Karta dizayneri OG'IR (canvas, qrcode, shriftlar) — u faqat shu bo'lim
// ochilganda yuklanadi, kabinetning qolgan qismini sekinlashtirmaydi.
const CardDesignerPage = lazy(() => import('./CardDesignerPage.jsx'));
import { DAY_NAMES, WEEK_ORDER, defaultHours, hoursEmpty, normalizeHours } from '../lib/hours.js';
import { fmt } from '../lib/format.js';
import { socialUrl } from '../lib/socialLinks.js';
import { useLanguage } from '../lib/i18n.jsx';
import { companyNameBlocked } from '../lib/nameGuard.js';
import logo from '../assets/logo-128.png';
import '../company-system.css';

const tabs = [['dashboard','Boshqaruv'],['stats','Statistika'],['orders','Buyurtmalar'],['feed','Lenta'],['profile','Profil'],['catalog','Katalog'],['contact','Aloqa'],['design','Karta dizayni'],['settings','Sozlamalar']];
const blankItem = { name: '', category: '', description: '', price: '', promotionPrice: '', imageUrl: '', available: true };

export default function CompanyWorkspacePage({ companyId }) {
  const { t } = useLanguage();
  const [company, setCompany] = useState(undefined);
  const [form, setForm] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [item, setItem] = useState(blankItem);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const load = () => getCompany(companyId).then((data) => { setCompany(data.company); setForm(data.company); }).catch(() => setCompany(null));
  useEffect(() => { load(); }, [companyId]);
  const cta = companyCta(form?.category);
  const topItems = useMemo(() => (form?.catalog || []).slice(0, 4), [form]);

  if (company === undefined) return <main className="cw-state">{t('Workspace yuklanmoqda…')}</main>;
  if (!company) return <main className="cw-state"><h1>{t('Workspace topilmadi')}</h1><p>{t('Bu Company ID sizga tegishli emas yoki sessiya tugagan.')}</p><button onClick={() => navigate('/business')}>{t('Biznes kabinetga qaytish')}</button></main>;

  // Nom taqiqlangan so'zni o'z ichiga olsa — saqlash ham, tekshiruvga
  // yuborish ham to'xtatiladi (backend baribir 422 qaytaradi, lekin
  // foydalanuvchi sababni darhol ko'rishi kerak).
  const nameBlocked = companyNameBlocked(form.displayName);
  const save = async () => {
    if (companyNameBlocked(form.displayName)) { setTab('profile'); setNotice(t('Kompaniya nomida ushbu so‘zdan foydalanish mumkin emas.')); return; }
    setBusy(true); setNotice('');
    try { const data = await updateCompany(company.companyId, form); setCompany(data.company); setForm(data.company); setNotice(t('O‘zgarishlar saqlandi')); }
    catch (err) { setNotice((err.error || err.message) === 'name_not_allowed' ? t('Kompaniya nomida ushbu so‘zdan foydalanish mumkin emas.') : t('Saqlab bo‘lmadi')); } finally { setBusy(false); }
  };
  const sendReview = async () => { setBusy(true); try { await save(); const data = await submitCompany(company.companyId); setCompany(data.company); setForm(data.company); setNotice(t('Ariza admin tekshiruviga yuborildi')); } finally { setBusy(false); } };
  // 2026-09: xabar ANIQLASHTIRILDI. Avval "Payme ... backend deployidan
  // keyin ochiladi" deb yozardi — bu endi to'g'ri emas (backend deploy
  // qilingan) va Payme'ni ayblab, foydalanuvchini chalg'itardi. Haqiqiy
  // sabab: kompaniya tarifi hali belgilanmagan, shuning uchun kompaniya
  // adminning tasdig'i bilan faollashadi.
  const payment = async () => { setBusy(true); try { const data = await beginCompanyPayment(company.companyId); if (data.payLink) window.location.href = data.payLink; else setNotice(data.message || t('Arizangiz qabul qilindi — admin tasdig‘i kutilmoqda.')); } catch (err) { const code = err.error || err.message; setNotice(code === 'company_tariff_not_set' ? t('Arizangiz qabul qilindi — kompaniya tarifi tasdiqlangach faollashadi.') : code === 'payments_disabled' ? t('To‘lov tizimi vaqtincha o‘chirilgan.') : t('To‘lovni boshlab bo‘lmadi.')); } finally { setBusy(false); } };
  const addItem = async (e) => { e.preventDefault(); setBusy(true); try { const data = await addCompanyItem(company.companyId, item); setCompany(data.company); setForm(data.company); setItem(blankItem); setNotice(t('Katalog elementi qo‘shildi')); } finally { setBusy(false); } };
  const removeItem = async (id) => { if (!confirm(t('Element o‘chirilsinmi?'))) return; const data = await deleteCompanyItem(company.companyId, id); setCompany(data.company); setForm(data.company); };
  const set = (key) => (e) => setForm((old) => ({ ...old, [key]: e.target.value }));

  return <main className="cw-page">
    <header className="cw-header"><button className="cw-brand" onClick={() => navigate('/')}><i><img src={logo} alt="NFCSTORE" /></i><b>NFCSTORE</b><span>{t('BUSINESS')}</span></button><div className="cw-company"><small>{t('COMPANY ID')}</small><b>{company.companyId}</b><span data-status={company.status}>{t(COMPANY_STATUS[company.status]) || company.status}</span></div><div className="cw-head-actions"><button onClick={() => navigate(`/c/${company.companyId.toLowerCase()}`)}>{t('NFC profil')} ↗</button><button onClick={() => navigate(`/company/${company.companyId.toLowerCase()}`)}>{t('Kompaniya sahifasi')} ↗</button><button onClick={() => navigate('/business')}>{t('Biznes kabinet')}</button></div></header>
    <div className="cw-layout">
      <aside className="cw-sidebar"><div className="cw-owner"><div>{form.logoUrl ? <img src={form.logoUrl} alt="" /> : form.displayName.slice(0,2).toUpperCase()}</div><span><b>{form.displayName}</b><small>{form.city}</small></span></div><nav>{tabs.map(([id,label],index) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><i>0{index+1}</i>{t(label)}<span>›</span></button>)}</nav><div className="cw-separation"><b>✓ {t('NFC ID’dan alohida')}</b><p>{t('Shaxsiy kartalaringiz bu yerda o‘zgarmaydi.')}</p></div></aside>
      <section className="cw-main">
        <div className="cw-title"><div><span>{t('BUSINESS WORKSPACE')}</span><h1>{t(tabs.find(([id]) => id === tab)?.[1])}</h1></div><button className="cw-save" onClick={save} disabled={busy || nameBlocked}>{busy ? t('Saqlanmoqda…') : t('Saqlash')}</button></div>

        {company.status !== 'active' && <div className="cw-status-banner" data-status={company.status}><div><b>{t(COMPANY_STATUS[company.status])}</b><p>{company.status === 'pending_review' ? t('Admin arizani tekshirmoqda. Ma’lumotlarni tahrirlashda davom etishingiz mumkin.') : company.status === 'approved' || company.status === 'payment_pending' ? t('Ariza tasdiqlandi. Company ID ni faollashtirish uchun to‘lovni yakunlang.') : company.status === 'rejected' ? company.rejectedReason || t('Ma’lumotlarni tuzatib, qayta yuboring.') : t('Arizani admin tekshiruviga yuboring.')}</p></div>{['draft','rejected'].includes(company.status) && <button onClick={sendReview}>{t('Tekshiruvga yuborish')}</button>}{['approved','payment_pending'].includes(company.status) && <button onClick={payment}>{t('Payme orqali to‘lash')}</button>}</div>}

        {tab === 'dashboard' && <div className="cw-dashboard"><section className="cw-action-grid"><button onClick={() => navigate(`/c/${company.companyId.toLowerCase()}`)}><i>◉</i><span><small>{t('NFC KARTAGA YOZILADI')}</small><b>{t('Tezkor NFC profil')}</b><p>{t('Bir tegishda aloqa, yo‘nalish va asosiy takliflar.')}</p></span><strong>↗</strong></button><button onClick={() => navigate(`/company/${company.companyId.toLowerCase()}`)}><i>◇</i><span><small>{t('TO‘LIQ PUBLIC SAHIFA')}</small><b>{t('Kompaniya sayti')}</b><p>{t('Katalog, galereya, lokatsiya va to‘liq ma’lumot.')}</p></span><strong>↗</strong></button><button onClick={() => setTab('settings')}><i>⚙</i><span><small>{t('FAQAT EGASI UCHUN')}</small><b>{t('Sozlamalar')}</b><p>{t('Company ID holati, linklar va admin jarayoni.')}</p></span><strong>→</strong></button></section><section className="cw-metrics"><article><small>{t('STATUS')}</small><b>{t(COMPANY_STATUS[company.status])}</b><p>{t('Admin boshqaruvi')}</p></article><article><small>{t('KATALOG')}</small><b>{form.catalog?.length || 0}</b><p>{t(cta.noun)}</p></article><article><small>{t('PUBLIC URL')}</small><b>/company/{company.companyId}</b><p>{t('To‘liq sahifa')}</p></article></section></div>}

        {tab === 'profile' && <div className="cw-panel"><div className="cw-panel-head"><span>01</span><div><h2>{t('Kompaniya profili')}</h2><p>{t('NFC va public sahifada bir xil ma’lumot ishlatiladi.')}</p></div></div><div className="cw-fields"><label><span>{t('Nomi')}</span><input value={form.displayName} onChange={set('displayName')} aria-invalid={nameBlocked || undefined} aria-describedby={nameBlocked ? 'cw-name-err' : undefined} />{nameBlocked && <small id="cw-name-err" role="alert" className="cc-name-err">{t('Kompaniya nomida ushbu so‘zdan foydalanish mumkin emas.')}</small>}</label><label><span>{t('Kichik soha')}</span><input value={form.subcategory || ''} onChange={set('subcategory')} /></label><label className="wide"><span>{t('Biz haqimizda')}</span><textarea value={form.description || ''} onChange={set('description')} /></label><ImageUploadField label={t('Logo')} value={form.logoUrl} onChange={(url) => setForm((old) => ({ ...old, logoUrl: url }))} hint={t('Kvadrat rasm eng yaxshi ko‘rinadi.')} /><ImageUploadField kind="cover" label={t('Muqova rasmi')} value={form.coverUrl} onChange={(url) => setForm((old) => ({ ...old, coverUrl: url }))} hint={t('Kompaniya sahifasi va NFC profil foni. GIF ham mumkin, 20 MB gacha.')} /></div></div>}

        {tab === 'catalog' && <div className="cw-catalog-editor"><div className="cw-panel"><div className="cw-panel-head"><span>01</span><div><h2>{t(cta.noun)}</h2><p>{t('Qo‘shilgan elementlar ikkala kompaniya ko‘rinishida darhol chiqadi.')}</p></div></div><form className="cw-item-form" onSubmit={addItem}><input required value={item.name} onChange={(e) => setItem((old) => ({ ...old, name:e.target.value }))} placeholder={t('Nomi')} /><input value={item.category} onChange={(e) => setItem((old) => ({ ...old, category:e.target.value }))} placeholder={t('Kategoriya')} /><input required type="number" min="0" value={item.price} onChange={(e) => setItem((old) => ({ ...old, price:e.target.value }))} placeholder={t('Narxi')} /><input type="number" min="0" value={item.promotionPrice} onChange={(e) => setItem((old) => ({ ...old, promotionPrice:e.target.value }))} placeholder={t('Aksiya narxi')} /><div className="wide"><ImageUploadField label={t('Rasmi')} value={item.imageUrl} onChange={(url) => setItem((old) => ({ ...old, imageUrl: url }))} /></div><textarea className="wide" value={item.description} onChange={(e) => setItem((old) => ({ ...old, description:e.target.value }))} placeholder={t('Qisqa tavsif')} /><button disabled={busy}>＋ {t('Qo‘shish')}</button></form></div><div className="cw-items">{(form.catalog || []).map((entry) => <article key={entry.id}><img src={entry.imageUrl || form.coverUrl || '/business-assets/market-interior.jpg'} alt="" /><div><small>{entry.category}</small><b>{entry.name}</b><p>{entry.description}</p><strong>{Number(entry.price).toLocaleString('uz-UZ')} {t('so‘m')}</strong></div><button onClick={() => removeItem(entry.id)}>×</button></article>)}{!form.catalog?.length && <p className="cw-empty">{t('Hozircha element yo‘q. Birinchi mahsulot yoki xizmatni yuqoridan qo‘shing.')}</p>}</div></div>}

        {tab === 'contact' && <div className="cw-panel"><div className="cw-panel-head"><span>01</span><div><h2>{t('Aloqa va lokatsiya')}</h2><p>{t('Mijoz tegishli tugmani bosganda shu ma’lumot ishlatiladi.')}</p></div></div><div className="cw-fields"><label><span>{t('Telefon')}</span><input value={form.phone || ''} onChange={set('phone')} /></label><label><span>Telegram</span><input value={form.telegram || ''} onChange={set('telegram')} /></label><label><span>WhatsApp</span><input value={form.whatsapp || ''} onChange={set('whatsapp')} /></label><label><span>{t('Veb-sayt')}</span><input value={form.website || ''} onChange={set('website')} /></label><label><span>{t('Shahar')}</span><input value={form.city || ''} onChange={set('city')} /></label><label><span>{t('To‘liq manzil')}</span><input value={form.address || ''} onChange={set('address')} /></label><label><span>Instagram</span><input value={form.instagram || ''} onChange={set('instagram')} placeholder="@kompaniya" /></label><label><span>Facebook</span><input value={form.facebook || ''} onChange={set('facebook')} placeholder="facebook.com/..." /></label><label><span>{t('Karta raqami')}</span><input value={form.cardNumber || ''} onChange={set('cardNumber')} placeholder="8600 0000 0000 0000" inputMode="numeric" /></label></div><CompanyHoursEditor form={form} setForm={setForm} t={t} /><CompanyLocationField form={form} setForm={setForm} t={t} /><CompanyExtraLinks form={form} setForm={setForm} t={t} /><CompanyMusic form={form} setForm={setForm} t={t} /></div>}

        {tab === 'stats' && <CompanyStatsPanel companyId={company.companyId} t={t} />}

        {tab === 'orders' && <CompanyOrdersPanel companyId={company.companyId} form={form} setForm={setForm} save={save} busy={busy} t={t} />}

        {/* KARTA DIZAYNI — shaxsiy profildagi bilan AYNAN bir xil vosita
            (bitta komponent, ikki joyda). Alohida nusxa yozilsa, ikkovi
            vaqt o'tib bir-biridan farq qilib ketardi. */}
        {tab === 'design' && (
          <div className="cw-panel">
            <div className="cw-panel-head">
              <span>01</span>
              <div>
                <h2>{t('Karta dizayni')}</h2>
                <p>{t('Kompaniya NFC kartangizning bosma ko‘rinishi. Tayyor fonlardan tanlang yoki o‘z rasmingizni yuklang.')}</p>
              </div>
            </div>
            <Suspense fallback={<p className="cw-empty">{t('Yuklanmoqda…')}</p>}>
              <CardDesignerPage embedded companyMark code={company.companyId} />
            </Suspense>
          </div>
        )}

        {tab === 'feed' && <CompanyFeedPanel companyId={company.companyId} name={company.displayName} logoUrl={company.logoUrl} t={t} />}

        {tab === 'settings' && <div className="cw-settings"><section><small>{t('COMPANY ID')}</small><h2>{company.companyId}</h2><p>{t('ID o‘zgarmaydi va shaxsiy NFC ID bilan aralashmaydi.')}</p></section><section><small>{t('NFC KARTAGA YOZILADIGAN URL')}</small><code>{window.location.origin}/c/{company.companyId.toLowerCase()}</code><button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/c/${company.companyId.toLowerCase()}`)}>{t('Nusxalash')}</button></section><section><small>{t('KOMPANIYA PUBLIC URL')}</small><code>{window.location.origin}/company/{company.companyId.toLowerCase()}</code><button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/company/${company.companyId.toLowerCase()}`)}>{t('Nusxalash')}</button></section><section><small>{t('QR KOD')}</small><p>{t('NFC ishlamaydigan telefonlar uchun — kamera bilan skanerlansa ham sahifangiz ochiladi.')}</p><CompanyQrCard url={`${window.location.origin}/c/${company.companyId.toLowerCase()}`} fileName={`nfcstore-${company.companyId.toLowerCase()}`} /></section><CompanyDomainSection company={company} form={form} setForm={setForm} save={save} busy={busy} t={t} /><section className="warning"><small>{t('ESKI NFC ID')}</small><p>{company.sourceCardCode ? t('{code} dan ma’lumot nusxalangan. Asl profil o‘zgarmagan.', { code: company.sourceCardCode }) : t('Bu kompaniya hech bir shaxsiy NFC IDga bog‘lanmagan.')}</p></section></div>}
      </section>

      {/* JONLI KO'RINISH — endi haqiqiy /c/:id sahifasini takrorlaydi:
          muqova butun ekranni egallaydi, tugmalar bir qatorga bitta va
          o'rtada, ish vaqti belgisi, musiqa va "Kontaktni saqlash".
          Avval bu preview eski ko'rinishda qolgan edi va egasi
          kiritgan o'zgarishlarni ko'rsatmasdi. */}
      <aside className="cw-preview"><div className="cw-preview-head"><div><span>{t('JONLI KO\u2018RISH')}</span><b>{t('Tezkor NFC profil')}</b></div><i>● {t('REAL VAQTDA')}</i></div><div className="cw-iphone"><div className="cw-phone-side left"/><div className="cw-phone-side right"/><div className="cw-phone-screen" style={{ backgroundImage:`linear-gradient(rgba(3,3,3,.62),rgba(3,3,3,.78) 38%,rgba(3,3,3,.92)),url("${form.coverUrl || '/business-assets/market-interior.jpg'}")` }}><div className="cw-dynamic"><span/><i/></div><div className="cw-phone-status"><b>9:41</b><span>⌁ ▰</span></div><div className="cw-phone-id">◆ {company.companyId}</div><div className="cw-phone-logo">{form.logoUrl ? <img src={form.logoUrl} alt=""/> : form.displayName.slice(0,2).toUpperCase()}</div><h3>{form.displayName}</h3><p>{form.subcategory || form.category} · {form.city}</p><PhoneHoursBadge form={form} t={t} /><PhoneButtons form={form} t={t} /><PhoneMusicRow form={form} t={t} /><div className="cw-phone-items">{topItems.length ? topItems.map((entry) => <div key={entry.id}><img src={entry.imageUrl || form.coverUrl || '/business-assets/market-phone.jpg'} alt=""/><span><b>{entry.name}</b><small>{Number(entry.price).toLocaleString('uz-UZ')} {t('so\u2018m')}</small></span></div>) : <div className="empty"><span><b>{t(cta.label)}</b><small>{t('Katalog elementlari shu yerda chiqadi')}</small></span></div>}</div><div className="cw-phone-save">{t('Kontaktni saqlash')}</div><div className="cw-home-indicator"/></div></div><p>{t('Bu preview shaxsiy NFC kontakt kartasi emas. Kompaniya NFC kartasiga aynan shu quick profil yoziladi.')}</p></aside>
    </div>{notice && <div className="cw-toast">{notice}</div>}
  </main>;
}

// ── LOKATSIYA ────────────────────────────────────────────────────────
// Koordinatani qo'lda yozish shart emas: brauzer joyni o'zi beradi.
// Kiritilsa, kompaniya sahifasida "Yo'nalish" tugmasi ishlaydi.
function CompanyLocationField({ form, setForm, t }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const has = form.latitude != null && form.longitude != null && form.latitude !== '' && form.longitude !== '';
  return (
    <div className="cw-sub">
      <div className="cw-sub-head"><b>{t('Lokatsiya')}</b><small>{t('Mijoz "Yo‘nalish" tugmasini bosganda ishlatiladi.')}</small></div>
      <div className="cw-upload-actions">
        <button
          type="button" className="cw-upload-btn" disabled={busy}
          onClick={() => {
            if (typeof navigator === 'undefined' || !navigator.geolocation) { setMsg(t('Brauzeringiz joylashuvni aniqlay olmadi.')); return; }
            setBusy(true); setMsg('');
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                setForm((old) => ({ ...old, latitude: Number(pos.coords.latitude.toFixed(6)), longitude: Number(pos.coords.longitude.toFixed(6)) }));
                setBusy(false); setMsg(t('Joylashuv aniqlandi. Saqlashni unutmang.'));
              },
              () => { setBusy(false); setMsg(t('Joylashuvga ruxsat berilmadi.')); },
              { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
            );
          }}
        >
          {busy ? t('Aniqlanmoqda…') : t('Joriy joylashuvimni olish')}
        </button>
        {has && (
          <button type="button" className="cw-upload-btn ghost" onClick={() => { setForm((old) => ({ ...old, latitude: null, longitude: null })); setMsg(''); }}>
            {t('Tozalash')}
          </button>
        )}
      </div>
      {has && <small className="cw-upload-hint">{Number(form.latitude).toFixed(6)}, {Number(form.longitude).toFixed(6)}</small>}
      {msg && <small className="cw-upload-hint">{msg}</small>}
    </div>
  );
}

// ── O'ZI QO'SHADIGAN HAVOLALAR ───────────────────────────────────────
// Egasining talabi: "xohlasa o'zi qo'shadigan funksiya". Har qanday
// havola — YouTube, Telegram kanali, menyu PDF — nomi bilan.
function CompanyExtraLinks({ form, setForm, t }) {
  const links = Array.isArray(form.extraLinks) ? form.extraLinks : [];
  const MAX = 8;
  const setAt = (i, patch) => setForm((old) => ({
    ...old,
    extraLinks: (old.extraLinks || []).map((l, k) => (k === i ? { ...l, ...patch } : l)),
  }));
  return (
    <div className="cw-sub">
      <div className="cw-sub-head">
        <b>{t('Qo‘shimcha havolalar')}</b>
        <small>{t('Xohlagan havolangizni nomi bilan qo‘shing — profilda tugma bo‘lib chiqadi.')}</small>
      </div>
      {links.map((l, i) => (
        <div className="cw-link-row" key={i}>
          <input value={l.label || ''} onChange={(e) => setAt(i, { label: e.target.value })} placeholder={t('Nomi (masalan: Menyu)')} />
          <input value={l.url || ''} onChange={(e) => setAt(i, { url: e.target.value })} placeholder="https://…" />
          <button type="button" className="cw-upload-btn ghost" onClick={() => setForm((old) => ({ ...old, extraLinks: (old.extraLinks || []).filter((_, k) => k !== i) }))}>×</button>
        </div>
      ))}
      {links.length < MAX && (
        <button type="button" className="cw-upload-btn" onClick={() => setForm((old) => ({ ...old, extraLinks: [...(old.extraLinks || []), { label: '', url: '' }] }))}>
          ＋ {t('Havola qo‘shish')}
        </button>
      )}
      <small className="cw-upload-hint">{t('{n} tadan {max} tagacha', { n: links.length, max: MAX })}</small>
    </div>
  );
}

// ── MUSIQA (5 tagacha) ───────────────────────────────────────────────
// Fayldan yuklanadi. Kompaniya sahifasida ijro etiladi va ekran
// o'chganda ham to'xtamaydi (MediaSession — shaxsiy profildagi bilan
// bir xil yechim).
function CompanyMusic({ form, setForm, t }) {
  const tracks = Array.isArray(form.music) ? form.music : [];
  const MAX = 5;
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('audio/')) { setErr(t('Faqat audio fayl tanlanadi.')); return; }
    setBusy(true); setErr('');
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('read'));
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      const url = await dbUploadAudio(dataUrl);
      setForm((old) => ({ ...old, music: [...(old.music || []), url].slice(0, MAX) }));
    } catch (error) {
      setErr(error?.message === 'read' ? t('Faylni o‘qib bo‘lmadi.') : (error?.message || t('Yuklab bo‘lmadi.')));
    } finally { setBusy(false); }
  };

  return (
    <div className="cw-sub">
      <div className="cw-sub-head">
        <b>{t('Musiqa')}</b>
        <small>{t('Kompaniya sahifasida ijro etiladi. {max} tagacha, fayldan yuklanadi.', { max: MAX })}</small>
      </div>
      {tracks.map((url, i) => (
        <div className="cw-link-row" key={url + i}>
          <audio src={url} controls preload="none" style={{ width: '100%' }} />
          <button type="button" className="cw-upload-btn ghost" onClick={() => setForm((old) => ({ ...old, music: (old.music || []).filter((_, k) => k !== i) }))}>×</button>
        </div>
      ))}
      {tracks.length < MAX && (
        <button type="button" className="cw-upload-btn" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? t('Yuklanmoqda…') : `＋ ${t('Qo‘shiq qo‘shish')}`}
        </button>
      )}
      <input ref={fileRef} type="file" accept="audio/*" hidden onChange={pick} />
      {err && <small role="alert" className="cw-upload-err">{err}</small>}
      <small className="cw-upload-hint">{t('{n} tadan {max} tagacha', { n: tracks.length, max: MAX })}</small>
    </div>
  );
}

// ── PREVIEW TUGMALARI ────────────────────────────────────────────────
// Avval bu yerda IKKITA o'lik tugma turardi: "Qo'ng'iroq" va "Telegram",
// ikkalasi ham `<button>` — bosilganda hech narsa qilmasdi va Aloqa
// bo'limiga nima yozilsa ham o'zgarmasdi. Ya'ni preview haqiqiy NFC
// profilni ko'rsatmasdi.
//
// Endi bu ro'yxat AYNAN /c/<id> sahifasidagi tugmalarni takrorlaydi:
// faqat to'ldirilgan maydonlar chiqadi va har biri haqiqiy havola —
// egasi preview'dan turib tekshirib ko'rishi mumkin.
function PhoneButtons({ form, t }) {
  const tel = String(form.phone || '').replace(/[^+\d]/g, '');
  const geo = hasCoords(form.latitude, form.longitude);
  const links = [
    form.phone && { key: 'tel', label: `📞 ${t('Qo‘ng‘iroq')}`, href: `tel:${tel}`, primary: true },
    form.telegram && { key: 'tg', label: '✈ Telegram', href: socialUrl('tg', form.telegram) },
    form.whatsapp && { key: 'wa', label: '✆ WhatsApp', href: socialUrl('wa', form.whatsapp) },
    form.instagram && { key: 'ig', label: '◉ Instagram', href: socialUrl('ig', form.instagram) },
    form.facebook && { key: 'fb', label: 'f Facebook', href: socialUrl('fb', form.facebook) },
    form.website && { key: 'web', label: `◎ ${t('Veb-sayt')}`, href: form.website },
    geo && { key: 'map', label: `⌖ ${t('Yo‘nalish olish')}`, href: directionsUrl(form) },
    form.cardNumber && { key: 'card', label: `▤ ${form.cardNumber}`, href: '' },
    ...(form.extraLinks || []).filter((l) => l && l.label && l.url).map((l, i) => ({ key: `x${i}`, label: `→ ${l.label}`, href: l.url })),
  ].filter(Boolean);

  if (!links.length) {
    return <div className="cw-phone-buttons"><span className="cw-phone-empty">{t('Aloqa bo‘limini to‘ldiring — tugmalar shu yerda chiqadi')}</span></div>;
  }
  return (
    <div className="cw-phone-buttons">
      {links.map((l) => (l.href
        ? <a key={l.key} href={l.href} target="_blank" rel="noopener noreferrer" className={l.primary ? 'primary' : ''}>{l.label}</a>
        : <span key={l.key}>{l.label}</span>))}
    </div>
  );
}

// ── ISH VAQTI ────────────────────────────────────────────────────────
// Egasi 7 kunni alohida belgilaydi. Tungacha cho'zilgan smena ham
// mumkin (18:00–02:00) — server buni to'g'ri hisoblaydi.
function CompanyHoursEditor({ form, setForm, t }) {
  const week = normalizeHours(form.hours);
  const empty = hoursEmpty(week);
  const setDay = (i, patch) => setForm((old) => {
    const next = normalizeHours(old.hours).map((d, k) => (k === i ? { ...d, ...patch } : d));
    return { ...old, hours: next };
  });
  return (
    <div className="cw-sub">
      <div className="cw-sub-head">
        <b>{t('Ish vaqti')}</b>
        <small>{t('Sahifangizda “Hozir ochiq / yopiq” deb ko‘rinadi. Vaqt Toshkent bo‘yicha.')}</small>
      </div>
      {empty ? (
        <button type="button" className="cw-upload-btn" onClick={() => setForm((old) => ({ ...old, hours: defaultHours() }))}>
          ＋ {t('Ish vaqtini qo‘shish')}
        </button>
      ) : (
        <>
          <div className="cw-hours">
            {WEEK_ORDER.map((i) => (
              <div className="cw-hours-row" key={i}>
                <span>{t(DAY_NAMES[i])}</span>
                <label className="cw-hours-off">
                  <input type="checkbox" checked={!week[i].closed} onChange={(e) => setDay(i, e.target.checked ? { closed: false, open: week[i].open || '09:00', close: week[i].close || '18:00' } : { closed: true })} />
                  <span>{week[i].closed ? t('Yopiq') : t('Ochiq')}</span>
                </label>
                <input type="time" value={week[i].open} disabled={week[i].closed} onChange={(e) => setDay(i, { open: e.target.value })} />
                <input type="time" value={week[i].close} disabled={week[i].closed} onChange={(e) => setDay(i, { close: e.target.value })} />
              </div>
            ))}
          </div>
          <button type="button" className="cw-upload-btn ghost" onClick={() => setForm((old) => ({ ...old, hours: [] }))}>{t('Ish vaqtini olib tashlash')}</button>
        </>
      )}
    </div>
  );
}

// ── STATISTIKA ───────────────────────────────────────────────────────
// Raqamlar SERVERDAN keladi va faqat egasiga ko'rinadi.
const ACTION_LABEL = {
  phone: 'Qo‘ng‘iroq', telegram: 'Telegram', whatsapp: 'WhatsApp', instagram: 'Instagram',
  facebook: 'Facebook', website: 'Veb-sayt', directions: 'Yo‘nalish', yandex: 'Yandex Karta',
};

function CompanyStatsPanel({ companyId, t }) {
  const [data, setData] = useState(undefined);
  const [days, setDays] = useState(30);
  useEffect(() => {
    let live = true;
    setData(undefined);
    getCompanyStats(companyId, days).then((d) => live && setData(d)).catch(() => live && setData(null));
    return () => { live = false; };
  }, [companyId, days]);

  if (data === undefined) return <div className="cw-panel"><p className="cw-empty">{t('Yuklanmoqda…')}</p></div>;
  if (!data) return <div className="cw-panel"><p className="cw-empty">{t('Statistikani yuklab bo‘lmadi.')}</p></div>;

  const max = Math.max(1, ...data.series.map((d) => d.views));
  return (
    <div className="cw-panel">
      <div className="cw-panel-head">
        <span>01</span>
        <div>
          <h2>{t('Statistika')}</h2>
          <p>{t('Sahifangiz necha marta ochilgan va qaysi tugmalar bosilgan.')}</p>
        </div>
      </div>

      <div className="cw-stat-range">
        {[7, 30, 90].map((d) => (
          <button key={d} type="button" className={days === d ? 'active' : ''} onClick={() => setDays(d)}>{t('{n} kun', { n: d })}</button>
        ))}
      </div>

      <section className="cw-metrics">
        <article><small>{t('OCHILISHLAR')}</small><b>{fmt(data.views)}</b><p>{t('NFC tegish va havola')}</p></article>
        <article><small>{t('TUGMA BOSILDI')}</small><b>{fmt(data.taps)}</b><p>{t('Qo‘ng‘iroq, Telegram, yo‘nalish…')}</p></article>
        <article><small>{t('BUYURTMALAR')}</small><b>{fmt(data.orders)}</b><p>{t('Jami')}</p></article>
      </section>

      {data.views > 0 ? (
        <div className="cw-chart" role="img" aria-label={t('Kunlik ochilishlar')}>
          {data.series.map((d) => (
            <i key={d.day} style={{ height: `${Math.max(2, (d.views / max) * 100)}%` }} title={`${d.day}: ${d.views}`} />
          ))}
        </div>
      ) : (
        <p className="cw-empty">{t('Hozircha ma’lumot yo‘q. Kartangiz birinchi marta ishlatilganda shu yerda ko‘rinadi.')}</p>
      )}

      <div className="cw-stat-cols">
        <div>
          <div className="cw-sub-head"><b>{t('Tugmalar')}</b></div>
          {data.actions.length ? data.actions.map((a) => (
            <div className="cw-stat-row" key={a.key}><span>{t(ACTION_LABEL[a.key] || a.key)}</span><b>{fmt(a.hits)}</b></div>
          )) : <p className="cw-empty">{t('Hali hech kim bosmagan.')}</p>}
        </div>
        <div>
          <div className="cw-sub-head"><b>{t('Eng ko‘p qaralgan')}</b></div>
          {data.items.length ? data.items.map((i) => (
            <div className="cw-stat-row" key={i.id}><span>{i.name || i.id}</span><b>{fmt(i.hits)}</b></div>
          )) : <p className="cw-empty">{t('Hozircha yo‘q.')}</p>}
        </div>
      </div>
    </div>
  );
}

// ── BUYURTMALAR ──────────────────────────────────────────────────────
const ORDER_STATUS = { new: 'Yangi', done: 'Bajarildi', cancelled: 'Bekor qilingan' };

function CompanyOrdersPanel({ companyId, form, setForm, save, busy, t }) {
  const [orders, setOrders] = useState(undefined);
  const load = () => listCompanyOrders(companyId).then((d) => setOrders(d.orders || [])).catch(() => setOrders(null));
  useEffect(() => { load(); }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const mark = async (id, status) => {
    setOrders((old) => (old || []).map((o) => (o.id === id ? { ...o, status } : o)));
    try { await setCompanyOrderStatus(companyId, id, status); } catch { load(); }
  };

  return (
    <div className="cw-panel">
      <div className="cw-panel-head">
        <span>01</span>
        <div>
          <h2>{t('Buyurtmalar')}</h2>
          <p>{t('Mijoz katalogdan buyurtma bersa shu yerga tushadi va Telegramingizga xabar keladi.')}</p>
        </div>
      </div>

      <label className="cw-toggle">
        <input
          type="checkbox" checked={!!form.ordersEnabled} disabled={busy}
          onChange={(e) => { setForm((old) => ({ ...old, ordersEnabled: e.target.checked })); setTimeout(save, 0); }}
        />
        <span>
          <b>{t('Saytdan buyurtma qabul qilish')}</b>
          <small>{t('Yoqilsa, katalogdagi har bir mahsulotda “Buyurtma berish” tugmasi chiqadi.')}</small>
        </span>
      </label>
      {/* Telegram xabari FAQAT bot bilan bog'langan raqamga boradi.
          Bog'lanmagan bo'lsa buyurtma baribir shu ro'yxatda qoladi —
          hech narsa yo'qolmaydi. */}
      <small className="cw-upload-hint">{t('Telegramda xabar olish uchun akkauntingiz botga ulangan bo‘lishi kerak.')}</small>

      {orders === undefined && <p className="cw-empty">{t('Yuklanmoqda…')}</p>}
      {orders === null && <p className="cw-empty">{t('Buyurtmalarni yuklab bo‘lmadi.')}</p>}
      {orders && orders.length === 0 && <p className="cw-empty">{t('Hozircha buyurtma yo‘q.')}</p>}
      {orders && orders.length > 0 && (
        <div className="cw-orders">
          {orders.map((o) => (
            <article key={o.id} data-status={o.status}>
              <div>
                <b>{o.itemName || t('Umumiy so‘rov')}{o.qty > 1 ? ` × ${o.qty}` : ''}</b>
                {o.price > 0 && <strong>{fmt(o.price)} {t('so‘m')}</strong>}
                <p>{o.name} · <a href={`tel:${o.phone}`}>{o.phone}</a></p>
                {o.note && <p className="note">{o.note}</p>}
                <small>{String(o.createdAt || '').slice(0, 16).replace('T', ' ')}</small>
              </div>
              <div className="cw-order-actions">
                <span className="cw-order-badge">{t(ORDER_STATUS[o.status] || o.status)}</span>
                {o.status !== 'done' && <button type="button" onClick={() => mark(o.id, 'done')}>{t('Bajarildi')}</button>}
                {o.status !== 'cancelled' && <button type="button" className="ghost" onClick={() => mark(o.id, 'cancelled')}>{t('Bekor qilish')}</button>}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

// ── O'Z DOMENI ───────────────────────────────────────────────────────
// Domen O'ZI faollashmaydi: egasi yozadi, DNS'ni yo'naltiradi, admin
// tekshirib tasdiqlaydi. Shuning uchun bu yerda holat ochiq ko'rsatiladi
// va nima qilish kerakligi qadamma-qadam yozilgan — aks holda egasi
// domenni yozib qo'yib, "nega ishlamayapti" deb kutib qolardi.
function CompanyDomainSection({ company, form, setForm, save, busy, t }) {
  const status = company.customDomainStatus || '';
  const badge = status === 'active' ? t('Faol') : status === 'rejected' ? t('Rad etilgan') : status === 'pending' ? t('Tekshiruvda') : '';
  return (
    <section>
      <small>{t('O‘Z DOMENINGIZ')}</small>
      <p>{t('Sahifangiz o‘z domeningizda ochilsin: menu.kompaniya.uz')}</p>
      <div className="cw-domain">
        <input
          value={form.customDomain || ''}
          onChange={(e) => setForm((old) => ({ ...old, customDomain: e.target.value }))}
          placeholder="menu.kompaniya.uz"
          spellCheck="false"
          autoComplete="off"
        />
        <button type="button" onClick={save} disabled={busy}>{t('Saqlash')}</button>
      </div>
      {badge && <span className="cw-domain-badge" data-status={status}>{badge}</span>}
      {company.customDomainNote && <p className="cw-domain-note">{company.customDomainNote}</p>}
      <ol className="cw-domain-steps">
        <li>{t('Domeningiz DNS sozlamasida CNAME yozuvini nfcstore.uz ga yo‘naltiring.')}</li>
        <li>{t('Domenni shu yerga yozib saqlang.')}</li>
        <li>{t('Admin tekshirib tasdiqlaydi — shundan so‘ng sahifangiz o‘sha manzilda ochiladi.')}</li>
      </ol>
    </section>
  );
}

// ── LENTA: postlar va istorya ────────────────────────────────────────
// Post — qoladi. Istorya — 24 soatdan keyin o'zi yo'qoladi.
// Ikkalasida ham joylashdan OLDIN kontent qoidalari ko'rsatiladi
// (StoryUploader ichida) va rozilik serverga yuboriladi.
function CompanyFeedPanel({ companyId, name, logoUrl, t }) {
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [notice, setNotice] = useState('');

  const load = () => Promise.all([
    listCompanyPosts(companyId).then((d) => setPosts(d.posts || [])).catch(() => setPosts([])),
    listCompanyStories(companyId).then((d) => setStories(d.stories || [])).catch(() => setStories([])),
  ]);
  useEffect(() => { load(); }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const removePost = async (id) => {
    if (!confirm(t('Post o‘chirilsinmi?'))) return;
    await deleteCompanyPost(companyId, id).catch(() => {});
    load();
  };
  const removeStory = async (id) => {
    await deleteCompanyStory(companyId, id).catch(() => {});
    load();
  };

  return (
    <div className="cw-panel">
      <div className="cw-panel-head">
        <span>01</span>
        <div>
          <h2>{t('Lenta')}</h2>
          <p>{t('Post kompaniya sahifasida qoladi. Istorya logotip atrofida chiqadi va 24 soatdan keyin o‘zi yo‘qoladi.')}</p>
        </div>
      </div>

      <div className="cw-sub">
        <div className="cw-sub-head">
          <b>{t('Istorya')}</b>
          <small>{t('{n} tadan {max} tagacha', { n: stories.length, max: 10 })} · {t('24 soat')}</small>
        </div>
        <div className="cw-feed-strip">
          {stories.map((st) => (
            <div key={st.id} className="cw-feed-item is-story">
              <img src={st.imageUrl} alt="" />
              <button type="button" onClick={() => removeStory(st.id)} aria-label={t('O‘chirish')}>×</button>
            </div>
          ))}
          {!stories.length && <p className="cw-empty">{t('Hozircha istorya yo‘q.')}</p>}
        </div>
        <StoryUploader
          label={t('Istorya qo‘shish')}
          onSubmit={async (payload) => { await createCompanyStory(companyId, payload); setNotice(t('Istorya joylandi')); load(); }}
        />
      </div>

      <div className="cw-sub">
        <div className="cw-sub-head">
          <b>{t('Postlar')}</b>
          <small>{t('{n} tadan {max} tagacha', { n: posts.length, max: 30 })}</small>
        </div>
        <div className="cw-feed-grid">
          {posts.map((p) => (
            <div key={p.id} className="cw-feed-item">
              <img src={p.imageUrl} alt="" />
              {p.caption && <span>{p.caption}</span>}
              <button type="button" onClick={() => removePost(p.id)} aria-label={t('O‘chirish')}>×</button>
            </div>
          ))}
          {!posts.length && <p className="cw-empty">{t('Hozircha post yo‘q.')}</p>}
        </div>
        <StoryUploader
          label={t('Post qo‘shish')}
          onSubmit={async (payload) => { await createCompanyPost(companyId, payload); setNotice(t('Post joylandi')); load(); }}
        />
      </div>

      {notice && <div className="cw-toast" role="status">{notice}</div>}
    </div>
  );
}

// Preview uchun ish vaqti belgisi — haqiqiy sahifadagi CompanyHours
// bilan bir xil ma'no, lekin `openNow` SERVERDAN keladi va tahrirlash
// paytida hali yangilanmagan bo'lishi mumkin, shuning uchun bu yerda
// faqat bugungi oraliq ko'rsatiladi.
function PhoneHoursBadge({ form, t }) {
  const week = normalizeHours(form.hours);
  if (hoursEmpty(week)) return null;
  const today = week[new Date().getDay()];
  return (
    <div className="cw-phone-hours">
      <span />{today.closed ? t('Bugun yopiq') : `${today.open}\u2013${today.close}`}
    </div>
  );
}

function PhoneMusicRow({ form, t }) {
  const n = (form.music || []).length;
  if (!n) return null;
  return <div className="cw-phone-music-row"><i>▶</i><span><b>{form.displayName}</b><small>{t('Musiqa')}{n > 1 ? ` \u00b7 ${n}` : ''}</small></span></div>;
}
