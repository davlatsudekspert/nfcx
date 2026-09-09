import { useEffect, useMemo, useState } from 'react';
import CompanyMusicPlayer from '../components/CompanyMusicPlayer.jsx';
import CompanyHours from '../components/CompanyHours.jsx';
import CompanyOrderModal from '../components/CompanyOrderModal.jsx';
import StoryRing from '../components/StoryRing.jsx';
import { directionsUrl, yandexDirectionsUrl } from '../lib/mapLink.js';
import { socialUrl } from '../lib/socialLinks.js';
import { companyCta, companyEvent, getCompany, listCompanyPosts, listCompanyStories } from '../lib/company.js';
import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';
import logo from '../assets/logo-128.png';
import '../company-system.css';

const fallbackCover = '/business-assets/construction-hero.jpg';

export default function CompanyPublicPage({ companyId }) {
  const { t } = useLanguage();
  const [company, setCompany] = useState(undefined);
  const [tab, setTab] = useState('main');
  // Karta raqami nusxalangani haqidagi qisqa bildirish.
  const [copied, setCopied] = useState(false);
  const [orderItem, setOrderItem] = useState(null);
  const [stories, setStories] = useState([]);
  const [posts, setPosts] = useState([]);
  // Istorya va postlar — asosiy ma'lumotdan ALOHIDA so'rov: ular tez
  // o'zgaradi, profil javobi esa keshlanadi.
  useEffect(() => {
    if (!company?.companyId) return undefined;
    let live = true;
    listCompanyStories(company.companyId).then((d) => live && setStories(d.stories || [])).catch(() => {});
    listCompanyPosts(company.companyId).then((d) => live && setPosts(d.posts || [])).catch(() => {});
    return () => { live = false; };
  }, [company?.companyId]);

  // Ko'rish hodisasi — egasi sahifasi qanchalik ochilganini bilsin.
  // Faqat BIR MARTA, ma'lumot kelgach: sahifa ochilmasa ham hisoblanib
  // ketmasin va yiqilgan so'rov statistikani shishirmasin.
  useEffect(() => {
    if (company?.companyId) companyEvent(company.companyId, 'view');
  }, [company?.companyId]);

  useEffect(() => {
    let live = true;
    getCompany(companyId).then((data) => live && setCompany(data.company)).catch(() => live && setCompany(null));
    return () => { live = false; };
  }, [companyId]);
  const categories = useMemo(() => [...new Set((company?.catalog || []).map((item) => item.category).filter(Boolean))], [company]);
  const [filter, setFilter] = useState('all');
  if (company === undefined) return <main className="cp-state">{t('Yuklanmoqda…')}</main>;
  if (!company) return <main className="cp-state"><h1>{t('Kompaniya sahifasi faol emas')}</h1><button onClick={() => navigate('/kompaniyalar')}>{t('Ortga')}</button></main>;
  const cta = companyCta(company.category);
  const items = (company.catalog || []).filter((item) => item.available !== false && (filter === 'all' || item.category === filter));
  return (
    <main className="cp-page">
      <header className="cp-header"><button onClick={() => navigate('/')} className="cp-logo"><i><img src={logo} alt="NFCSTORE" /></i><b>NFCSTORE</b></button><nav><button onClick={() => setTab('main')}>{t('Asosiy')}</button><button onClick={() => setTab('catalog')}>{t(cta.noun)}</button><button onClick={() => setTab('gallery')}>{t('Galereya')}</button><button onClick={() => setTab('contact')}>{t('Aloqa')}</button></nav><button className="cp-nfc" onClick={() => navigate(`/c/${company.companyId.toLowerCase()}`)}>{t('NFC ko‘rinish')} ↗</button></header>
      <section className="cp-hero" style={{ backgroundImage: `linear-gradient(90deg,rgba(0,0,0,.96) 5%,rgba(0,0,0,.56) 62%,rgba(0,0,0,.16)),url("${company.coverUrl || fallbackCover}")` }}>
        <div className="cp-hero-copy"><span className="cp-kicker">{t('COMPANY ID')} · {company.companyId}</span><div className="cp-title-row"><StoryRing stories={stories} title={company.displayName} avatarUrl={company.logoUrl}><div className="cp-hero-logo">{company.logoUrl ? <img src={company.logoUrl} alt="" /> : company.displayName.slice(0, 2).toUpperCase()}</div></StoryRing><div><h1>{company.displayName}</h1><p>{company.subcategory || company.categoryLabel || t('Professional kompaniya')}</p></div></div><p className="cp-lead">{company.description || t('Biz haqimizda to‘liq ma’lumot tez orada qo‘shiladi.')}</p><CompanyHours hours={company.hours} openNow={company.openNow} /><div className="cp-hero-actions">{company.phone && <a href={`tel:${company.phone}`} onClick={() => companyEvent(company.companyId, 'action', 'phone')}>{t('Qo‘ng‘iroq qilish')}</a>}<button onClick={() => { setTab('catalog'); document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }); }}>{t(cta.label)}</button></div></div>
      </section>

      <nav className="cp-tabs">{[['main',t('Asosiy')],['catalog',t(cta.noun)],['gallery',t('Galereya')],['contact',t('Lokatsiya va aloqa')]].map(([id,label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav>

      <div className="cp-content">
        {tab === 'main' && <><section className="cp-about"><div><span>{t('BIZ HAQIMIZDA')}</span><h2>{company.displayName}</h2><p>{company.description}</p><div className="cp-facts"><b>● {t('Admin tasdiqlagan')}</b><b>⌖ {company.city || t('O‘zbekiston')}</b><b>◇ ID {company.companyId}</b></div></div><aside><small>{t('KATALOG')}</small><strong>{company.catalog?.length || 0}</strong><p>{t('{noun} bitta ishonchli manbadan boshqariladi.', { noun: t(cta.noun) })}</p></aside></section>{items.length > 0 && <Catalog items={items.slice(0, 4)} categories={categories} filter={filter} setFilter={setFilter} title={t(cta.noun)} t={t} company={company} onOrder={setOrderItem} />}{posts.length > 0 && <CompanyPosts posts={posts} t={t} />}</>}
        {tab === 'catalog' && <Catalog items={items} categories={categories} filter={filter} setFilter={setFilter} title={t(cta.noun)} t={t} company={company} onOrder={setOrderItem} />}
        {tab === 'gallery' && <section className="cp-gallery"><div className="cp-section-title"><span>{t('GALEREYA')}</span><h2>{t('Kompaniya muhiti')}</h2></div><div>{(company.gallery || [company.coverUrl]).filter(Boolean).map((image, index) => <img key={`${image}-${index}`} src={image} alt="" />)}</div></section>}
        {/* Musiqa — kompaniya sahifasining o'zida, hamma bo'limda
            ko'rinadi va ekran o'chganda ham to'xtamaydi. */}
        <CompanyMusicPlayer tracks={company.music} companyName={company.displayName} coverUrl={company.logoUrl || company.coverUrl} />
        {tab === 'contact' && <section className="cp-contact"><div><span>{t('ALOQA')}</span><h2>{t('Biz bilan bog‘laning')}</h2><p>{company.address || company.city || t('Manzil kiritilmagan')}</p><CompanyHours hours={company.hours} openNow={company.openNow} /></div><div className="cp-contact-list" onClick={(e) => { const k = e.target.closest('[data-ev]')?.dataset.ev; if (k) companyEvent(company.companyId, 'action', k); }}>{company.phone && <a data-ev="phone" href={`tel:${company.phone}`}>📞 {company.phone}</a>}{company.telegram && <a data-ev="telegram" href={socialUrl('tg', company.telegram)}>✈ {company.telegram}</a>}{company.whatsapp && <a data-ev="whatsapp" href={socialUrl('wa', company.whatsapp)} target="_blank" rel="noopener noreferrer">✆ WhatsApp</a>}{company.instagram && <a data-ev="instagram" href={socialUrl('ig', company.instagram)} target="_blank" rel="noopener noreferrer">◉ Instagram</a>}{company.facebook && <a data-ev="facebook" href={socialUrl('fb', company.facebook)} target="_blank" rel="noopener noreferrer">f Facebook</a>}{company.website && <a data-ev="website" href={company.website}>◎ {company.website}</a>}
          {/* KARTA RAQAMI — bosilganda nusxalanadi (havola emas). */}
          {company.cardNumber && (
            <button type="button" onClick={() => { try { navigator.clipboard.writeText(company.cardNumber); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ruxsat yo'q */ } }}>
              ▤ {copied ? t('Nusxalandi!') : company.cardNumber}
            </button>
          )}
          {/* YO'NALISH — qurilmaning o'z xarita ilovasida. */}
          {(company.latitude != null && company.longitude != null) && (
            <>
              <a data-ev="directions" href={directionsUrl(company)} target="_blank" rel="noopener noreferrer">⌖ {t('Yo‘nalish olish')}</a>
              <a data-ev="yandex" href={yandexDirectionsUrl(company)} target="_blank" rel="noopener noreferrer">🗺 {t('Yandex Karta')}</a>
            </>
          )}
          {/* O'zi qo'shgan havolalar. */}
          {(company.extraLinks || []).map((l, i) => (
            <a key={`x${i}`} href={l.url} target="_blank" rel="noopener noreferrer">→ {l.label}</a>
          ))}</div></section>}
      </div>
      {orderItem && <CompanyOrderModal companyId={company.companyId} item={orderItem} onClose={() => setOrderItem(null)} />}
      <footer className="cp-footer"><b>NFCSTORE BUSINESS</b><span>{t('Company ID')}: {company.companyId}</span></footer>
    </main>
  );
}

// Kompaniya postlari — yangiliklar lentasi (yangi taom, aksiya, ish
// jarayoni). Katalogdan farqi: narx yo'q, muddat yo'q, shunchaki
// ko'rsatish.
function CompanyPosts({ posts, t }) {
  return (
    <section className="cp-posts">
      <div className="cp-section-title"><span>{t('LENTA')}</span><h2>{t('Yangiliklar')}</h2></div>
      <div className="cp-post-grid">
        {posts.map((p) => (
          <article key={p.id}>
            {p.videoUrl
              ? <video src={p.videoUrl} controls playsInline preload="none" />
              : <img src={p.imageUrl} alt={p.caption || ''} loading="lazy" />}
            {p.caption && <p>{p.caption}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

function Catalog({ items, categories, filter, setFilter, title, t, company, onOrder }) {
  return <section className="cp-catalog" id="catalog"><div className="cp-section-title"><span>{t('KATALOG')}</span><h2>{title}</h2></div>{categories.length > 1 && <div className="cp-filters"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>{t('Barchasi')}</button>{categories.map((cat) => <button key={cat} className={filter === cat ? 'active' : ''} onClick={() => setFilter(cat)}>{cat}</button>)}</div>}<div className="cp-product-grid">{items.map((item) => <article key={item.id}><div className="cp-product-img"><img src={item.imageUrl || fallbackCover} alt="" />{item.promotionPrice && <span>{t('AKSIYA')}</span>}</div><div><small>{item.category}</small><h3>{item.name}</h3><p>{item.description}</p>{item.promotionPrice ? <div className="cp-price"><del>{Number(item.price).toLocaleString('uz-UZ')}</del><b>{Number(item.promotionPrice).toLocaleString('uz-UZ')} {t('so‘m')}</b></div> : <b className="cp-price-single">{Number(item.price || 0).toLocaleString('uz-UZ')} {t('so‘m')}</b>}{company?.ordersEnabled && item.available !== false && <button type="button" className="cp-order-btn" onClick={() => { companyEvent(company.companyId, 'item', String(item.id)); onOrder(item); }}>{t('Buyurtma berish')}</button>}</div></article>)}</div>{items.length === 0 && <div className="cp-empty">{t('Hozircha katalog elementi yo‘q.')}</div>}</section>;
}

