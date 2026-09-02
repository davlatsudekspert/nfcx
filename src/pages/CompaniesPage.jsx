import { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../lib/i18n.jsx';
import { navigate } from '../lib/router.js';
import { useCategories, catPath } from '../lib/categories.js';
import { fmt } from '../lib/format.js';
import { dbSearchCompanies } from '../lib/db.js';

const QUICK_EXAMPLES = [
  { query: 'Restoran', title: 'NFC Restaurant', meta: 'Restoran · Menyu', icon: '♨', tone: 'gold' },
  { query: 'Do‘kon', title: 'NFC Market', meta: 'Savdo do‘koni · Katalog', icon: '▣', tone: 'violet' },
  { query: 'Qurilish', title: 'Techno Build', meta: 'Qurilish · Xizmatlar', icon: '⌂', tone: 'blue' },
  { query: 'IT xizmatlari', title: 'IT Solutions', meta: 'IT xizmatlari · Konsalting', icon: '◇', tone: 'cyan' },
];

const RESTAURANT_ITEMS = [
  { name: 'Premium osh', price: '28 000', image: '/business-assets/restaurant-dish.jpg', badge: 'TOP' },
  { name: 'Caesar salat', price: '32 000', image: '/business-assets/restaurant-food.jpg' },
  { name: 'Ribeye steak', price: '89 000', image: '/business-assets/restaurant-interior.jpg', badge: 'CHEF' },
  { name: 'Pizza Pepperoni', price: '70 000', image: '/business-assets/restaurant-food.jpg' },
  { name: 'Cheesecake', price: '28 000', image: '/business-assets/restaurant-dish.jpg' },
];

const MARKET_ITEMS = [
  { name: 'iPhone 18 Pro · Concept', price: '18 990 000', sprite: 0, badge: 'NEW' },
  { name: 'iPhone Air · Concept', price: '16 500 000', sprite: 1 },
  { name: 'Samsung S2 Ultra · Concept', price: '17 900 000', sprite: 2, badge: 'TOP' },
  { name: 'Nova Fold X · Concept', price: '15 200 000', sprite: 3 },
  { name: 'Aurora Gold · Concept', price: '14 800 000', sprite: 4 },
  { name: 'Shadow Gaming · Concept', price: '12 900 000', sprite: 5 },
];

function PhoneShell({ children, className = '' }) {
  return (
    <div className={`co-phone ${className}`} aria-hidden="true">
      <span className="co-phone-action" />
      <span className="co-phone-volume one" />
      <span className="co-phone-volume two" />
      <span className="co-phone-camera" />
      <div className="co-phone-island" />
      <div className="co-phone-status"><b>9:41</b><span>● ◔ ▰</span></div>
      <div className="co-phone-screen">{children}</div>
      <div className="co-phone-home" />
    </div>
  );
}

function RestaurantPhone() {
  return (
    <PhoneShell className="restaurant-phone">
      <header className="co-r-head"><span>‹</span><div><i>♨</i><b>NFC Restaurant</b><small>PREMIUM MENYU</small></div><span>⌕</span></header>
      <div className="co-phone-welcome"><span>Bugungi tavsiya</span><b>Chef tanlovi · −15%</b></div>
      <div className="co-phone-tabs"><b>Nonushta</b><span>Issiq taomlar</span><span>Salatlar</span><span>Ichimliklar</span></div>
      <div className="co-menu-list">
        {RESTAURANT_ITEMS.map((item) => (
          <article key={item.name}>
            <img src={item.image} alt="" />
            <div><b>{item.name}{item.badge && <em>{item.badge}</em>}</b><small>Yangi, mazali va mehr bilan</small><strong>{item.price} so‘m</strong></div>
            <span>♡</span>
          </article>
        ))}
      </div>
    </PhoneShell>
  );
}

function MarketPhone() {
  return (
    <PhoneShell className="market-phone">
      <header className="co-m-head"><span>‹</span><div><i>▣</i><b>NFC Market</b><small>PREMIUM KATALOG</small></div><span>♡</span></header>
      <div className="co-phone-search"><span>⌕</span> Smartfon qidiring</div>
      <div className="co-phone-tabs"><b>Barchasi</b><span>Telefonlar</span><span>Fold</span><span>Gaming</span></div>
      <div className="co-product-grid">
        {MARKET_ITEMS.map((item) => (
          <article key={item.name}>
            <span className={`co-product-shot sprite-${item.sprite}`}>{item.badge && <em>{item.badge}</em>}</span>
            <b>{item.name}</b>
            <strong>{item.price} so‘m</strong>
          </article>
        ))}
      </div>
    </PhoneShell>
  );
}

function ShowcaseCard({ type, t }) {
  const restaurant = type === 'restaurant';
  const title = restaurant ? 'NFC Restaurant' : 'NFC Market';
  const question = restaurant ? 'Restoran menyusi qanday ko‘rinadi?' : 'Mahsulotlaringiz qanday ko‘rinadi?';
  const description = restaurant
    ? 'Mijozlar menyuingizni NFC yoki QR orqali bir tegishda telefonida ochadi. Zamonaviy, mazali va qulay.'
    : 'Mahsulot va xizmatlaringizni premium, rasmli katalog ko‘rinishida mijozlarga taqdim eting.';
  const features = restaurant
    ? [['Taomlar rasm va narxlari bilan'], ['Kategoriya va tartibli menyu'], ['Telefon va lokatsiya', true], ['O‘z logotipingiz va uslubingiz', true]]
    : [['Mahsulotlar rasm va narxlari bilan'], ['Kategoriyalarni o‘zingiz belgilang'], ['Telefon va lokatsiya', true], ['Cheksiz mahsulotlar', true]];

  return (
    <article className={`co-showcase-card ${restaurant ? 'is-restaurant' : 'is-market'}`}>
      <div className="co-showcase-copy">
        <div className="co-showcase-brand"><i>{restaurant ? '♨' : '▣'}</i><b>{title}</b><em>{t('NAMUNA')}</em></div>
        <h2>{t(question)}</h2>
        <p>{t(description)}</p>
        <ul>
          {features.map(([label, pro]) => <li key={label}><span>✓</span>{t(label)}{pro && <em>♙ PRO</em>}</li>)}
        </ul>
        <button type="button" className="co-create-profile" onClick={() => navigate('/account')}>
          {t('Kompaniya profilini yaratish')} <span>→</span>
        </button>
      </div>
      <div className="co-showcase-visual">
        <div className="co-orbit one" /><div className="co-orbit two" />
        <img className="co-backdrop-image" src={restaurant ? '/business-assets/restaurant-food.jpg' : '/business-assets/market-interior.jpg'} alt="" />
        {restaurant ? <RestaurantPhone /> : <MarketPhone />}
      </div>
    </article>
  );
}

function DemoCompanyCard({ type, t }) {
  const restaurant = type === 'restaurant';
  return (
    <article className={`co-directory-card ${restaurant ? 'gold' : 'violet'}`}>
      <div className="co-directory-image">
        <img src={restaurant ? '/business-assets/restaurant-interior.jpg' : '/business-assets/market-interior.jpg'} alt="" />
        <span>{restaurant ? '♨' : '▣'} {restaurant ? t('Menyu') : t('Katalog')}</span><em>{t('NAMUNA')}</em>
      </div>
      <div className="co-directory-copy">
        <i>{restaurant ? 'NR' : 'NM'}</i>
        <div><h3>{restaurant ? 'NFC Restaurant' : 'NFC Market'} <span>✓</span></h3><p>{t(restaurant ? 'Restoran · Oziq-ovqat' : 'Savdo do‘koni · Elektronika')}</p><small>⌖ {t('Toshkent')}, {t(restaurant ? 'Yunusobod' : 'Chilonzor')} {t('tumani')}</small></div>
      </div>
      <p>{t(restaurant ? 'Milliy va Yevropa taomlari. Sifatli xizmat va mazali taomlar.' : 'Smartfonlar, aksessuarlar va noutbuklar. Eng yaxshi narxlar.')}</p>
      <button type="button" onClick={() => navigate('/biznes-namuna')}>{t('Profilga o‘tish')} →</button>
    </article>
  );
}

function RealCompanyCard({ item, categories, lang, t }) {
  const path = catPath(categories, item.categorySlug, lang);
  return (
    <button type="button" className="co-real-company" onClick={() => navigate('/' + item.code.toLowerCase())}>
      <div className="co-real-cover">
        {item.bgUrl || item.avatarUrl
          ? <img src={item.bgUrl || item.avatarUrl} alt="" />
          : <span>{(item.name || item.code).slice(0, 2).toUpperCase()}</span>}
        <em>{t('Biznes profil')}</em>
      </div>
      <div className="co-real-body">
        <span className="co-real-logo">{item.avatarUrl ? <img src={item.avatarUrl} alt="" /> : (item.name || item.code).slice(0, 2).toUpperCase()}</span>
        <div><h3>{item.name || item.code}{item.verified && <i>✓</i>}</h3><p>{path || item.role || t('Kompaniya')}</p><small>{item.city ? `⌖ ${item.city}` : `nfcstore.uz/${item.code.toLowerCase()}`}</small></div>
      </div>
      {item.matchLabel && <div className="co-match">✨ {t('Mos natija')}: <b>{item.matchLabel}</b>{item.matchPrice != null && <> · {fmt(item.matchPrice)} {t("so'm")}</>}</div>}
      <span className="co-real-link">{t('Profilga o‘tish')} →</span>
    </button>
  );
}

export default function CompaniesPage({ catalog = [] }) {
  const { t, lang } = useLanguage();
  const categories = useCategories();
  const [q, setQ] = useState('');
  const [itemResults, setItemResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    const term = q.trim();
    clearTimeout(debounceRef.current);
    if (!term) { setItemResults(null); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      dbSearchCompanies(term).then((result) => { setItemResults(result); setSearching(false); });
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [q]);

  const query = q.trim().toUpperCase();
  const localMatches = useMemo(() => [...catalog]
    .filter((item) => item.profileType === 'business' && !item.hiddenFromDirectory)
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))
    .filter((item) => !query
      || item.code.includes(query)
      || (item.name || '').toUpperCase().includes(query)
      || (item.role || '').toUpperCase().includes(query)
      || (item.city || '').toUpperCase().includes(query)
      || catPath(categories, item.categorySlug, lang).toUpperCase().includes(query)),
  [catalog, query, categories, lang]);

  const companies = useMemo(() => {
    if (!query || itemResults == null) return localMatches;
    const byCode = new Map(localMatches.map((item) => [item.code, item]));
    for (const result of itemResults) byCode.set(result.code, { ...(byCode.get(result.code) || result), ...result });
    return [...byCode.values()].sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }, [localMatches, itemResults, query]);

  const search = (event) => {
    event?.preventDefault();
    document.getElementById('kompaniyalar-royxati')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <main className="companies-luxe">
      <section className="co-hero">
        <div className="co-hero-glow" />
        <span className="co-eyebrow">NFCSTORE {t('Kompaniyalar katalogi')}</span>
        <h1>{t('Kompaniyalar va')}<br />{t('mutaxassislarni')} <strong>{t('toping')}</strong></h1>
        <p>{t('Kerakli kompaniya, xizmat yoki mutaxassisni NFCStore orqali toping.')}<br />{t('Ularning faoliyat sohasi, katalogi va ochiq aloqa ma’lumotlarini bitta joyda ko‘ring.')}</p>
        <form className="co-search" onSubmit={search}>
          <span>⌕</span><input value={q} onChange={(event) => setQ(event.target.value)} placeholder={t('Kompaniya nomi, mahsulot, taom yoki xizmat')} /><button>{searching ? '•••' : t('Qidirish')}</button>
        </form>

        <div className="co-quick-row">
          <span>{t('Tezkor misollar')}:</span>
          {QUICK_EXAMPLES.map((example) => (
            <button type="button" className={example.tone} key={example.query} onClick={() => setQ(example.query)}>
              <i>{example.icon}</i><span><b>{example.title}</b><small>{t(example.meta)}</small></span>
            </button>
          ))}
          <button type="button" className="all" onClick={search}>{t('Barchasini ko‘rish')} <b>→</b></button>
        </div>
      </section>

      <section className="co-showcase-grid">
        <ShowcaseCard type="restaurant" t={t} />
        <ShowcaseCard type="market" t={t} />
      </section>

      <section id="kompaniyalar-royxati" className="co-directory">
        <header><div><h2>{t('Kompaniyalar va kataloglarni kashf eting')}</h2><p>{t('Restoranlar va kompaniyalarni qidiring, ularning profili va katalogini ko‘ring.')}</p></div>{companies.length > 0 && <span>{fmt(companies.length)} {t('ta natija')}</span>}</header>
        {companies.length > 0 ? (
          <div className="co-real-grid">{companies.map((item) => <RealCompanyCard key={item.code} item={item} categories={categories} lang={lang} t={t} />)}</div>
        ) : query ? (
          <div className="co-empty"><span>⌕</span><b>{t('Mos kompaniya topilmadi')}</b><p>{t('Boshqa nom, xizmat yoki shahar bilan qidiring.')}</p></div>
        ) : (
          <div className="co-demo-grid"><DemoCompanyCard type="restaurant" t={t} /><DemoCompanyCard type="market" t={t} /></div>
        )}
      </section>

      <section className="co-business-cta">
        <i>♢</i><div><h2>{t('Sizning biznesingiz ham NFCStore’da bo‘lsin')}</h2><p>{t('Kompaniyangiz uchun rasmli raqamli profil yarating. Katalog boshqaruvi kompaniya profilingiz ichidagi Business Workspace’da ochiladi.')}</p></div>
        <button type="button" onClick={() => navigate('/account')}>{t('Kompaniya profilini yaratish')} <span>→</span></button>
        <button type="button" className="secondary" onClick={() => navigate('/narxlar')}>{t('NFC ID tanlash')}</button>
      </section>
    </main>
  );
}
