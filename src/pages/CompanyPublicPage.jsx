import { useEffect, useMemo, useState } from 'react';
import { companyCta, getCompany } from '../lib/company.js';
import { navigate } from '../lib/router.js';
import { useLanguage } from '../lib/i18n.jsx';
import '../company-system.css';

const fallbackCover = '/business-assets/construction-hero.jpg';

export default function CompanyPublicPage({ companyId }) {
  const { t } = useLanguage();
  const [company, setCompany] = useState(undefined);
  const [tab, setTab] = useState('main');
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
      <header className="cp-header"><button onClick={() => navigate('/')} className="cp-logo"><i>N</i><b>NFCSTORE</b></button><nav><button onClick={() => setTab('main')}>{t('Asosiy')}</button><button onClick={() => setTab('catalog')}>{t(cta.noun)}</button><button onClick={() => setTab('gallery')}>{t('Galereya')}</button><button onClick={() => setTab('contact')}>{t('Aloqa')}</button></nav><button className="cp-nfc" onClick={() => navigate(`/c/${company.companyId.toLowerCase()}`)}>{t('NFC ko‘rinish')} ↗</button></header>
      <section className="cp-hero" style={{ backgroundImage: `linear-gradient(90deg,rgba(0,0,0,.96) 5%,rgba(0,0,0,.56) 62%,rgba(0,0,0,.16)),url("${company.coverUrl || fallbackCover}")` }}>
        <div className="cp-hero-copy"><span className="cp-kicker">{t('COMPANY ID')} · {company.companyId}</span><div className="cp-title-row"><div className="cp-hero-logo">{company.logoUrl ? <img src={company.logoUrl} alt="" /> : company.displayName.slice(0, 2).toUpperCase()}</div><div><h1>{company.displayName}</h1><p>{company.subcategory || company.categoryLabel || t('Professional kompaniya')}</p></div></div><p className="cp-lead">{company.description || t('Biz haqimizda to‘liq ma’lumot tez orada qo‘shiladi.')}</p><div className="cp-hero-actions">{company.phone && <a href={`tel:${company.phone}`}>{t('Qo‘ng‘iroq qilish')}</a>}<button onClick={() => { setTab('catalog'); document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }); }}>{t(cta.label)}</button></div></div>
      </section>

      <nav className="cp-tabs">{[['main',t('Asosiy')],['catalog',t(cta.noun)],['gallery',t('Galereya')],['contact',t('Lokatsiya va aloqa')]].map(([id,label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav>

      <div className="cp-content">
        {tab === 'main' && <><section className="cp-about"><div><span>{t('BIZ HAQIMIZDA')}</span><h2>{company.displayName}</h2><p>{company.description}</p><div className="cp-facts"><b>● {t('Admin tasdiqlagan')}</b><b>⌖ {company.city || t('O‘zbekiston')}</b><b>◇ ID {company.companyId}</b></div></div><aside><small>{t('KATALOG')}</small><strong>{company.catalog?.length || 0}</strong><p>{t('{noun} bitta ishonchli manbadan boshqariladi.', { noun: t(cta.noun) })}</p></aside></section>{items.length > 0 && <Catalog items={items.slice(0, 4)} categories={categories} filter={filter} setFilter={setFilter} title={t(cta.noun)} t={t} />}</>}
        {tab === 'catalog' && <Catalog items={items} categories={categories} filter={filter} setFilter={setFilter} title={t(cta.noun)} t={t} />}
        {tab === 'gallery' && <section className="cp-gallery"><div className="cp-section-title"><span>{t('GALEREYA')}</span><h2>{t('Kompaniya muhiti')}</h2></div><div>{(company.gallery || [company.coverUrl]).filter(Boolean).map((image, index) => <img key={`${image}-${index}`} src={image} alt="" />)}</div></section>}
        {tab === 'contact' && <section className="cp-contact"><div><span>{t('ALOQA')}</span><h2>{t('Biz bilan bog‘laning')}</h2><p>{company.address || company.city || t('Manzil kiritilmagan')}</p></div><div className="cp-contact-list">{company.phone && <a href={`tel:${company.phone}`}>📞 {company.phone}</a>}{company.telegram && <a href={`https://t.me/${company.telegram.replace(/^@/,'')}`}>✈ {company.telegram}</a>}{company.website && <a href={company.website}>◎ {company.website}</a>}</div></section>}
      </div>
      <footer className="cp-footer"><b>NFCSTORE BUSINESS</b><span>{t('Company ID')}: {company.companyId}</span></footer>
    </main>
  );
}

function Catalog({ items, categories, filter, setFilter, title, t }) {
  return <section className="cp-catalog" id="catalog"><div className="cp-section-title"><span>{t('KATALOG')}</span><h2>{title}</h2></div>{categories.length > 1 && <div className="cp-filters"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>{t('Barchasi')}</button>{categories.map((cat) => <button key={cat} className={filter === cat ? 'active' : ''} onClick={() => setFilter(cat)}>{cat}</button>)}</div>}<div className="cp-product-grid">{items.map((item) => <article key={item.id}><div className="cp-product-img"><img src={item.imageUrl || fallbackCover} alt="" />{item.promotionPrice && <span>{t('AKSIYA')}</span>}</div><div><small>{item.category}</small><h3>{item.name}</h3><p>{item.description}</p>{item.promotionPrice ? <div className="cp-price"><del>{Number(item.price).toLocaleString('uz-UZ')}</del><b>{Number(item.promotionPrice).toLocaleString('uz-UZ')} {t('so‘m')}</b></div> : <b className="cp-price-single">{Number(item.price || 0).toLocaleString('uz-UZ')} {t('so‘m')}</b>}</div></article>)}</div>{items.length === 0 && <div className="cp-empty">{t('Hozircha katalog elementi yo‘q.')}</div>}</section>;
}

