import { useEffect, useMemo, useRef, useState } from 'react';
import ImageUploadField from '../components/ImageUploadField.jsx';
import { addCompanyItem, beginCompanyPayment, companyCta, COMPANY_STATUS, deleteCompanyItem, getCompany, submitCompany, updateCompany } from '../lib/company.js';
import { navigate } from '../lib/router.js';
import { dbUploadAudio } from '../lib/db.js';
import { useLanguage } from '../lib/i18n.jsx';
import { companyNameBlocked } from '../lib/nameGuard.js';
import logo from '../assets/logo-128.png';
import '../company-system.css';

const tabs = [['dashboard','Boshqaruv'],['profile','Profil'],['catalog','Katalog'],['contact','Aloqa'],['settings','Sozlamalar']];
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

        {tab === 'contact' && <div className="cw-panel"><div className="cw-panel-head"><span>01</span><div><h2>{t('Aloqa va lokatsiya')}</h2><p>{t('Mijoz tegishli tugmani bosganda shu ma’lumot ishlatiladi.')}</p></div></div><div className="cw-fields"><label><span>{t('Telefon')}</span><input value={form.phone || ''} onChange={set('phone')} /></label><label><span>Telegram</span><input value={form.telegram || ''} onChange={set('telegram')} /></label><label><span>WhatsApp</span><input value={form.whatsapp || ''} onChange={set('whatsapp')} /></label><label><span>{t('Veb-sayt')}</span><input value={form.website || ''} onChange={set('website')} /></label><label><span>{t('Shahar')}</span><input value={form.city || ''} onChange={set('city')} /></label><label><span>{t('To‘liq manzil')}</span><input value={form.address || ''} onChange={set('address')} /></label><label><span>Instagram</span><input value={form.instagram || ''} onChange={set('instagram')} placeholder="@kompaniya" /></label><label><span>Facebook</span><input value={form.facebook || ''} onChange={set('facebook')} placeholder="facebook.com/..." /></label><label><span>{t('Karta raqami')}</span><input value={form.cardNumber || ''} onChange={set('cardNumber')} placeholder="8600 0000 0000 0000" inputMode="numeric" /></label></div><CompanyLocationField form={form} setForm={setForm} t={t} /><CompanyExtraLinks form={form} setForm={setForm} t={t} /><CompanyMusic form={form} setForm={setForm} t={t} /></div>}

        {tab === 'settings' && <div className="cw-settings"><section><small>{t('COMPANY ID')}</small><h2>{company.companyId}</h2><p>{t('ID o‘zgarmaydi va shaxsiy NFC ID bilan aralashmaydi.')}</p></section><section><small>{t('NFC KARTAGA YOZILADIGAN URL')}</small><code>{window.location.origin}/c/{company.companyId.toLowerCase()}</code><button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/c/${company.companyId.toLowerCase()}`)}>{t('Nusxalash')}</button></section><section><small>{t('KOMPANIYA PUBLIC URL')}</small><code>{window.location.origin}/company/{company.companyId.toLowerCase()}</code><button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/company/${company.companyId.toLowerCase()}`)}>{t('Nusxalash')}</button></section><section className="warning"><small>{t('ESKI NFC ID')}</small><p>{company.sourceCardCode ? t('{code} dan ma’lumot nusxalangan. Asl profil o‘zgarmagan.', { code: company.sourceCardCode }) : t('Bu kompaniya hech bir shaxsiy NFC IDga bog‘lanmagan.')}</p></section></div>}
      </section>

      <aside className="cw-preview"><div className="cw-preview-head"><div><span>{t('JONLI KO‘RISH')}</span><b>{t('Tezkor NFC profil')}</b></div><i>● {t('REAL VAQTDA')}</i></div><div className="cw-iphone"><div className="cw-phone-side left"/><div className="cw-phone-side right"/><div className="cw-phone-screen" style={{ backgroundImage:`linear-gradient(rgba(2,2,2,.42),rgba(2,2,2,.92)),url("${form.coverUrl || '/business-assets/market-interior.jpg'}")` }}><div className="cw-dynamic"><span/><i/></div><div className="cw-phone-status"><b>9:41</b><span>⌁ ▰</span></div><div className="cw-phone-id">◆ {company.companyId}</div><div className="cw-phone-logo">{form.logoUrl ? <img src={form.logoUrl} alt=""/> : form.displayName.slice(0,2).toUpperCase()}</div><h3>{form.displayName}</h3><p>{form.subcategory || form.category} · {form.city}</p><div className="cw-phone-buttons"><button>📞 {t('Qo‘ng‘iroq')}</button><button>✈ Telegram</button></div><div className="cw-phone-items">{topItems.length ? topItems.map((entry) => <div key={entry.id}><img src={entry.imageUrl || form.coverUrl || '/business-assets/market-phone.jpg'} alt=""/><span><b>{entry.name}</b><small>{Number(entry.price).toLocaleString('uz-UZ')} {t('so‘m')}</small></span></div>) : <div className="empty"><span><b>{t(cta.label)}</b><small>{t('Katalog elementlari shu yerda chiqadi')}</small></span></div>}</div><div className="cw-home-indicator"/></div></div><p>{t('Bu preview shaxsiy NFC kontakt kartasi emas. Kompaniya NFC kartasiga aynan shu quick profil yoziladi.')}</p></aside>
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
