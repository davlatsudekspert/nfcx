import { useMemo, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { useLanguage } from '../lib/i18n.jsx';
import { navigate } from '../lib/router.js';
import { EditCardForm } from './AccountPage.jsx';

const DEMO_PRESETS = {
  construction: {
    module: 'Xizmatlar',
    accent: '#dcae48',
    name: 'ELITE QURILISH',
    role: 'Qurilish va arxitektura xizmatlari',
    city: 'Toshkent',
    address: 'Chilonzor tumani, Bunyodkor ko‘chasi 12',
    phone: '+998 90 123 45 67',
    telegram: '@elite_qurilish',
    about: 'Zamonaviy turar-joy va tijorat obyektlarini loyihalashdan topshirishgacha bo‘lgan barcha bosqichlarda sifatli xizmat ko‘rsatamiz.',
    cover: '/business-assets/construction-hero.jpg',
    items: [
      { name: 'Uy-joy qurilishi', category: 'Qurilish', price: '1 500 000', discountPrice: '1 260 000', promotionDays: '12', unit: "so‘m/m² dan", description: 'Kalit topshirishgacha to‘liq qurilish xizmati.', image: '/business-assets/construction-home.jpg', available: true },
      { name: 'Ta’mirlash ishlari', category: 'Interyer', price: '150 000', unit: "so‘m/m² dan", description: 'Dizayn asosida sifatli ichki ta’mirlash.', image: '/business-assets/construction-interior.jpg', available: true },
      { name: 'Loyihalash', category: 'Arxitektura', price: '100 000', unit: "so‘m/m² dan", description: 'Arxitektura, reja va muhandislik yechimlari.', image: '/business-assets/construction-design.jpg', available: true },
    ],
  },
  restaurant: {
    module: 'Menyu',
    accent: '#f0b83f',
    name: 'YAQEEN RESTAURANT',
    role: 'Milliy va zamonaviy taomlar',
    city: 'Toshkent',
    address: 'Yunusobod tumani, Amir Temur shoh ko‘chasi 108',
    phone: '+998 90 777 70 70',
    telegram: '@yaqeen_restaurant',
    about: 'Mehr bilan tayyorlangan taomlar, iliq muhit va oilaviy kechalar uchun did bilan yaratilgan restoran.',
    cover: '/business-assets/restaurant-interior.jpg',
    items: [
      { name: 'Chef pizza', category: 'Issiq taomlar', price: '72 000', unit: "so‘m", description: 'Tovuq, ananas, mozzarella va maxsus sous.', image: '/business-assets/restaurant-food.jpg', available: true },
      { name: 'Gril salmon', category: 'Asosiy taomlar', price: '98 000', unit: "so‘m", description: 'Sabzavot va yashil sous bilan.', image: '/business-assets/restaurant-dish.jpg', available: true },
      { name: 'Oilaviy set', category: 'Maxsus taklif', price: '240 000', unit: "so‘m", description: '4 kishiga mo‘ljallangan iliq taomlar to‘plami.', image: '/business-assets/restaurant-interior.jpg', available: true },
    ],
  },
  shop: {
    module: 'Mahsulotlar',
    accent: '#9165ff',
    name: 'NOVA MARKET',
    role: 'Smartfon va texnika do‘koni',
    city: 'Toshkent',
    address: 'Chilonzor tumani, Bunyodkor ko‘chasi 5',
    phone: '+998 71 200 20 20',
    telegram: '@novamarket',
    about: 'Original smartfonlar, aksessuarlar va zamonaviy texnika — rasmiy kafolat va qulay yetkazib berish bilan.',
    cover: '/business-assets/market-interior.jpg',
    items: [
      { name: 'iPhone 15 Pro', category: 'Telefonlar', price: '12 990 000', discountPrice: '10 990 000', promotionDays: '5', unit: "so‘m", description: '256 GB, Natural Titanium.', image: '/business-assets/market-phone.jpg', available: true },
      { name: 'Smart aksessuarlar', category: 'Aksessuarlar', price: '390 000', unit: "so‘mdan", description: 'G‘ilof, quvvatlagich va himoya oynalari.', image: '/business-assets/market-interior.jpg', available: true },
      { name: 'MacBook Air', category: 'Noutbuklar', price: '14 500 000', unit: "so‘m", description: 'M2, 8/256 GB, kafolat bilan.', image: '/business-assets/market-phone.jpg', available: false },
    ],
  },
};

const NAV_ITEMS = [
  ['main', 'Asosiy', '◇'],
  ['catalog', null, '▦'],
  ['promotions', 'Aksiyalar', '◆'],
  ['gallery', 'Galereya', '▧'],
  ['location', 'Lokatsiya', '⌖'],
  ['contact', 'Aloqa', '↗'],
  ['settings', 'Sozlamalar', '⚙'],
];

function WorkspacePhone({ profile, items, active, accent }) {
  const selected = items[0];
  return (
    <div className="bw-phone-shell" style={{ '--bw-accent': accent }}>
      <div className="bw-phone-island" />
      <div className="bw-phone-screen">
        <div className="bw-phone-status"><span>9:41</span><span>◔ ◒ ▰</span></div>
        {active === 'main' && (
          <div className="bw-phone-main">
            <div className="bw-phone-cover"><img src={profile.cover} alt="" /><div /></div>
            <div className="bw-phone-logo">{profile.name.slice(0, 2)}</div>
            <h3>{profile.name}</h3><p>{profile.role}</p>
            <span className="bw-phone-place">⌖ {profile.city}</span>
            <div className="bw-phone-actions"><b>☎ Qo‘ng‘iroq</b><span>Telegram</span></div>
            <nav><b>Asosiy</b><span>Katalog</span><span>Galereya</span></nav>
            <article><small>BIZ HAQIMIZDA</small><p>{profile.about}</p></article>
          </div>
        )}
        {active === 'catalog' && (
          <div className="bw-phone-catalog">
            <div className="bw-phone-head"><span>←</span><b>{profile.module}</b><span>⌕</span></div>
            <input readOnly value="Qidirish..." />
            <div className="bw-phone-chips"><b>Barchasi</b><span>{items[0]?.category}</span><span>{items[1]?.category}</span></div>
            <div className="bw-phone-list">
              {items.map((item) => <article key={item.name}><img src={item.image} alt="" /><div><b>{item.name}</b><small>{item.description}</small><strong>{item.price} {item.unit}</strong></div></article>)}
            </div>
          </div>
        )}
        {active === 'promotions' && (
          <div className="bw-phone-catalog">
            <div className="bw-phone-head"><span>←</span><b>Aksiyalar</b><span>◆</span></div>
            <div className="bw-phone-chips"><b>Faol</b><span>Tez tugaydi</span></div>
            <div className="bw-phone-list">
              {items.filter((entry) => entry.discountPrice).map((entry) => <article key={entry.name}><img src={entry.image} alt="" /><div><b>{entry.name}</b><small><s>{entry.price} {entry.unit}</s> · {entry.promotionDays} kun</small><strong>{entry.discountPrice} {entry.unit}</strong></div></article>)}
            </div>
          </div>
        )}
        {active === 'gallery' && (
          <div className="bw-phone-gallery"><div className="bw-phone-head"><span>←</span><b>Galereya</b><span>•••</span></div><div>{[profile.cover, ...items.map((item) => item.image)].slice(0, 6).map((image, index) => <img key={`${image}-${index}`} src={image} alt="" />)}</div></div>
        )}
        {active === 'location' && (
          <div className="bw-phone-location"><div className="bw-phone-head"><span>←</span><b>Lokatsiya</b><span>•••</span></div><div className="bw-mini-map"><i>⌖</i></div><h3>{profile.city}</h3><p>{profile.address}</p><b>⌖ Yo‘nalishni ochish</b></div>
        )}
        {active === 'contact' && (
          <div className="bw-phone-contact"><div className="bw-phone-head"><span>←</span><b>Aloqa</b><span>•••</span></div><small>BOG‘LANISH</small><h3>Keling, gaplashamiz</h3><a>☎ <span><small>Telefon</small><b>{profile.phone}</b></span></a><a>↗ <span><small>Telegram</small><b>{profile.telegram}</b></span></a><a>⌖ <span><small>Manzil</small><b>{profile.city}</b></span></a></div>
        )}
        {active === 'settings' && (
          <div className="bw-phone-contact"><div className="bw-phone-head"><span>←</span><b>Profil holati</b><span>•••</span></div><small>PUBLIC PROFILE</small><h3>{profile.name}</h3><a>✓ <span><small>Nashr holati</small><b>Faol</b></span></a><a>↗ <span><small>Public manzil</small><b>nfcstore.uz/elite</b></span></a></div>
        )}
      </div>
      <div className="bw-phone-home" />
    </div>
  );
}

function Input({ label, value, onChange, textarea, hint }) {
  const field = textarea
    ? <textarea value={value} rows={4} onChange={(event) => onChange(event.target.value)} />
    : <input value={value} onChange={(event) => onChange(event.target.value)} />;
  return <label className="bw-field"><span>{label}</span>{field}{hint && <small>{hint}</small>}</label>;
}

function DemoWorkspace() {
  const { t } = useLanguage();
  const [kind, setKind] = useState('construction');
  const [active, setActive] = useState('main');
  const [profile, setProfile] = useState(DEMO_PRESETS.construction);
  const [items, setItems] = useState(DEMO_PRESETS.construction.items);
  const [selectedItem, setSelectedItem] = useState(0);
  const [mobileView, setMobileView] = useState('edit');
  const [saved, setSaved] = useState(false);
  const accent = profile.accent;
  const item = items[selectedItem] || items[0];

  const switchKind = (nextKind) => {
    setKind(nextKind);
    setProfile(DEMO_PRESETS[nextKind]);
    setItems(DEMO_PRESETS[nextKind].items);
    setSelectedItem(0);
    setActive('main');
  };
  const changeProfile = (key, value) => setProfile((current) => ({ ...current, [key]: value }));
  const changeItem = (key, value) => setItems((current) => current.map((entry, index) => index === selectedItem ? { ...entry, [key]: value } : entry));
  const navItems = NAV_ITEMS.map(([id, label, icon]) => [id, label || profile.module, icon]);
  const save = () => { setSaved(true); window.setTimeout(() => setSaved(false), 2200); };

  return (
    <main className="bw-page" style={{ '--bw-accent': accent }}>
      <header className="bw-topbar">
        <button type="button" className="bw-brand" onClick={() => navigate('/')}><img src="/logo-192.png" alt="" /><span>NFCSTORE</span></button>
        <div className="bw-breadcrumb"><span>{t('Kabinet')}</span><i>/</i><b>{t('Biznes Workspace')}</b></div>
        <div className="bw-top-actions"><span className="bw-separate-badge">◇ {t("NFC ID'dan alohida")}</span><button type="button" className="bw-preview-link" onClick={() => navigate('/biznes-namuna')}>{t('Public profil')} ↗</button><button type="button" className="bw-save-top" onClick={save}>{saved ? `✓ ${t('Saqlandi')}` : t('Saqlash')}</button></div>
      </header>

      <div className="bw-mobile-switch"><button className={mobileView === 'edit' ? 'active' : ''} onClick={() => setMobileView('edit')}>{t('Tahrirlash')}</button><button className={mobileView === 'preview' ? 'active' : ''} onClick={() => setMobileView('preview')}>{t('Jonli ko‘rish')}</button></div>

      <div className="bw-layout">
        <aside className="bw-sidebar">
          <div className="bw-company-card"><div className="bw-company-logo">{profile.name.slice(0, 2)}</div><div><small>{t('KOMPANIYAM')}</small><b>{profile.name}</b><span>{profile.city}</span></div></div>
          <nav>{navItems.map(([id, label, icon]) => <button type="button" key={id} className={active === id ? 'active' : ''} onClick={() => { setActive(id); setMobileView('edit'); }}><span>{icon}</span><b>{t(label)}</b>{id === 'catalog' && <em>{items.length}</em>}</button>)}</nav>
          <div className="bw-sidebar-note"><span>◆</span><div><b>{t('Business-only')}</b><p>{t('Bu bo‘lim faqat biznes profili egasiga ko‘rinadi.')}</p></div></div>
          <button type="button" className="bw-back-account" onClick={() => navigate('/account')}>← {t('Kabinetga qaytish')}</button>
        </aside>

        <section className={`bw-editor ${mobileView === 'preview' ? 'mobile-hidden' : ''}`}>
          <div className="bw-editor-head"><div><span>{t('BUSINESS WORKSPACE')}</span><h1>{t(navItems.find(([id]) => id === active)?.[1] || 'Asosiy')}</h1><p>{t("O‘zgarishlar o‘ngdagi telefonda darhol ko‘rinadi. Backendga faqat Saqlash bosilganda yuboriladi.")}</p></div><div className="bw-live-pill"><i /> {t('LIVE PREVIEW')}</div></div>

          {active === 'main' && (
            <>
              <section className="bw-section"><div className="bw-section-title"><span>01</span><div><h2>{t('Biznes yo‘nalishi')}</h2><p>{t('Katalog atamalari shu tanlovga moslashadi.')}</p></div></div><div className="bw-type-grid">{[
                ['construction', '▱', 'Qurilish', 'Xizmatlar'],
                ['restaurant', '◒', 'Restoran', 'Menyu'],
                ['shop', '▦', 'Do‘kon', 'Mahsulotlar'],
              ].map(([id, icon, title, module]) => <button type="button" key={id} className={kind === id ? 'active' : ''} onClick={() => switchKind(id)}><span>{icon}</span><div><b>{t(title)}</b><small>→ {t(module)}</small></div>{kind === id && <i>✓</i>}</button>)}</div></section>
              <section className="bw-section"><div className="bw-section-title"><span>02</span><div><h2>{t('Kompaniya profili')}</h2><p>{t('Real public sahifada ko‘rinadigan ma’lumotlar.')}</p></div></div><div className="bw-cover-upload"><img src={profile.cover} alt="" /><div><small>{t('MUQOVA RASMI')}</small><b>{t('Professional cover')}</b><button type="button">＋ {t('Rasmni almashtirish')}</button></div></div><div className="bw-fields-grid"><Input label={t('Kompaniya nomi')} value={profile.name} onChange={(value) => changeProfile('name', value)} /><Input label={t('Faoliyat tavsifi')} value={profile.role} onChange={(value) => changeProfile('role', value)} /><div className="wide"><Input textarea label={t('Biz haqimizda')} value={profile.about} onChange={(value) => changeProfile('about', value)} hint={`${profile.about.length}/420`} /></div></div></section>
            </>
          )}

          {active === 'catalog' && item && (
            <section className="bw-section catalog-section"><div className="bw-section-title"><span>01</span><div><h2>{t(`${profile.module} katalogi`)}</h2><p>{t('Universal Catalog Engine — nomlar biznes turiga qarab o‘zgaradi.')}</p></div><button type="button" className="bw-add-item">＋ {t('Yangi qo‘shish')}</button></div><div className="bw-catalog-editor"><div className="bw-item-list">{items.map((entry, index) => <button type="button" key={entry.name} className={selectedItem === index ? 'active' : ''} onClick={() => setSelectedItem(index)}><img src={entry.image} alt="" /><div><b>{entry.name}</b><small>{entry.category}</small></div><span>⋮</span></button>)}</div><div className="bw-item-form"><div className="bw-item-image"><img src={item.image} alt="" /><button type="button">▧ {t('Rasmni almashtirish')}</button></div><div className="bw-fields-grid"><Input label={t('Nomi')} value={item.name} onChange={(value) => changeItem('name', value)} /><Input label={t('Kategoriya')} value={item.category} onChange={(value) => changeItem('category', value)} /><Input label={t('Narx')} value={item.price} onChange={(value) => changeItem('price', value)} /><Input label={t('Narx turi')} value={item.unit} onChange={(value) => changeItem('unit', value)} /><div className="wide"><Input textarea label={t('Tavsif')} value={item.description} onChange={(value) => changeItem('description', value)} /></div></div><label className="bw-toggle"><input type="checkbox" checked={item.available} onChange={(event) => changeItem('available', event.target.checked)} /><i /><span><b>{t('Mavjud')}</b><small>{t('Public katalogda ko‘rsatiladi')}</small></span></label></div></div></section>
          )}

          {active === 'promotions' && item && (
            <section className="bw-section catalog-section"><div className="bw-section-title"><span>◆</span><div><h2>{t('Aksiyalar')}</h2><p>{t('Eski narx, yangi narx va aksiya muddatini boshqaring.')}</p></div></div><div className="bw-catalog-editor"><div className="bw-item-list">{items.map((entry, index) => <button type="button" key={entry.name} className={selectedItem === index ? 'active' : ''} onClick={() => setSelectedItem(index)}><img src={entry.image} alt="" /><div><b>{entry.name}</b><small>{entry.discountPrice ? `◆ ${entry.promotionDays || 7} ${t('kun')}` : t('Aksiya yo‘q')}</small></div><span>›</span></button>)}</div><div className="bw-item-form"><div className="bw-item-image"><img src={item.image} alt="" /><span className="bw-promo-demo-badge">◆ {t('AKSIYA')}</span></div><div className="bw-fields-grid"><Input label={t('Eski narx')} value={item.price} onChange={(value) => changeItem('price', value)} /><Input label={t('Yangi narx')} value={item.discountPrice || ''} onChange={(value) => changeItem('discountPrice', value)} /><Input label={t('Aksiya muddati (kun)')} value={item.promotionDays || '7'} onChange={(value) => changeItem('promotionDays', value)} /></div><div className="bw-setting-row"><span>◆</span><div><b>{t('Public profilga chiqarish')}</b><p>{t('Faol aksiya alohida “Aksiyalar” tabida ko‘rinadi.')}</p></div><label className="bw-toggle"><input type="checkbox" checked={Boolean(item.discountPrice)} onChange={(event) => changeItem('discountPrice', event.target.checked ? item.discountPrice || item.price : '')} /><i /></label></div></div></div></section>
          )}

          {active === 'gallery' && (
            <section className="bw-section"><div className="bw-section-title"><span>01</span><div><h2>{t('Kompaniya galereyasi')}</h2><p>{t('Real ishlar, joy va jamoa suratlarini qo‘shing.')}</p></div><button type="button" className="bw-add-item">＋ {t('Rasm qo‘shish')}</button></div><div className="bw-gallery-editor">{[profile.cover, ...items.map((entry) => entry.image)].map((image, index) => <article key={`${image}-${index}`}><img src={image} alt="" /><button type="button">⋮</button><span>{index === 0 ? t('Muqova') : `${t('Loyiha')} ${index}`}</span></article>)}</div></section>
          )}

          {active === 'location' && (
            <section className="bw-section"><div className="bw-section-title"><span>01</span><div><h2>{t('Lokatsiya')}</h2><p>{t('Manzil public profil va yo‘nalish tugmasida ishlatiladi.')}</p></div></div><div className="bw-location-editor"><div className="bw-mini-map large"><i>⌖</i><span>{profile.city}</span></div><div className="bw-fields-grid"><Input label={t('Shahar / viloyat')} value={profile.city} onChange={(value) => changeProfile('city', value)} /><Input label={t('Aniq manzil')} value={profile.address} onChange={(value) => changeProfile('address', value)} /><Input label="Latitude" value="41.311081" onChange={() => {}} /><Input label="Longitude" value="69.240562" onChange={() => {}} /></div></div></section>
          )}

          {active === 'contact' && (
            <section className="bw-section"><div className="bw-section-title"><span>01</span><div><h2>{t('Aloqa ma’lumotlari')}</h2><p>{t('Mijozlar siz bilan qulay kanalda bog‘lanadi.')}</p></div></div><div className="bw-fields-grid"><Input label={t('Telefon')} value={profile.phone} onChange={(value) => changeProfile('phone', value)} /><Input label="Telegram" value={profile.telegram} onChange={(value) => changeProfile('telegram', value)} /><Input label="Instagram" value="@elite.qurilish" onChange={() => {}} /><Input label={t('Veb-sayt')} value="elite-qurilish.uz" onChange={() => {}} /></div></section>
          )}

          {active === 'settings' && (
            <section className="bw-section"><div className="bw-section-title"><span>01</span><div><h2>{t('Workspace sozlamalari')}</h2><p>{t('Public profil holati va biznesga tegishli boshqaruvlar.')}</p></div></div><div className="bw-setting-row"><span>◉</span><div><b>{t('Public profil faol')}</b><p>{t('Kompaniya qidiruv va katalogda ko‘rinadi.')}</p></div><label className="bw-toggle"><input type="checkbox" checked readOnly /><i /></label></div><div className="bw-setting-row"><span>◇</span><div><b>{t('NFC ID boshqaruvi')}</b><p>{t('Kod, karta dizayni va tarif alohida NFC ID sozlamalarida qoladi.')}</p></div><button type="button" onClick={() => navigate('/account')}>{t('NFC ID sozlamalari')} →</button></div></section>
          )}

          <div className="bw-editor-footer"><span>{saved ? `✓ ${t('Barcha o‘zgarishlar saqlandi')}` : t('Saqlanmagan o‘zgarishlar local previewda ko‘rinmoqda')}</span><button type="button" onClick={save}>{saved ? t('Saqlandi') : t('O‘zgarishlarni saqlash')}</button></div>
        </section>

        <aside className={`bw-preview ${mobileView === 'edit' ? 'mobile-hidden' : ''}`}><div className="bw-preview-head"><div><span>{t('JONLI KO‘RISH')}</span><b>{t(navItems.find(([id]) => id === active)?.[1] || 'Asosiy')}</b></div><i><span /> {t('REAL VAQTDA')}</i></div><WorkspacePhone profile={{ ...profile, module: profile.module }} items={items} active={active} accent={accent} /><p>{t('Telefondagi preview serverga so‘rov yubormasdan local state bilan yangilanadi.')}</p><div className="bw-preview-links"><button type="button" onClick={() => navigate('/biznes-namuna')}>↗ {t('Public profilni ochish')}</button><button type="button">▣ {t('QR ko‘rish')}</button></div></aside>
      </div>
      {saved && <div className="bw-toast">✓ {t('O‘zgarishlar muvaffaqiyatli saqlandi')}</div>}
    </main>
  );
}

export default function BusinessWorkspacePage({ code }) {
  const { user, myCards } = useAuth();
  const { t } = useLanguage();
  if (String(code || '').toLowerCase() === 'demo') return <DemoWorkspace />;
  if (user === undefined) return <main className="bw-auth-state">{t('Yuklanmoqda...')}</main>;
  if (!user) return <main className="bw-auth-state"><h1>{t('Business Workspace')}</h1><p>{t('Bu bo‘lim faqat biznes profili egasi uchun.')}</p><button onClick={() => navigate('/login')}>{t('Kirish')}</button></main>;
  const card = myCards.find((entry) => entry.code.toLowerCase() === String(code || '').toLowerCase());
  if (!card || card.profileType !== 'business') return <main className="bw-auth-state"><h1>{t('Ruxsat yo‘q')}</h1><p>{t('Business Workspace faqat sizga tegishli biznes profil uchun ochiladi.')}</p><button onClick={() => navigate('/account')}>{t('Kabinetga qaytish')}</button></main>;
  return (
    <main className="bw-auth-state" style={{ minHeight: '100vh', background: '#050505', color: '#fff', padding: '32px' }}>
      <div style={{ width: 'min(760px,100%)', margin: '9vh auto', border: '1px solid rgba(239,183,47,.28)', borderRadius: 28, background: 'linear-gradient(145deg,rgba(239,183,47,.08),#0b0b0b 38%)', padding: 'clamp(28px,5vw,56px)', textAlign: 'left' }}>
        <span style={{ color: '#efb72f', fontSize: 11, fontWeight: 800, letterSpacing: '.16em' }}>YANGI COMPANY SYSTEM</span>
        <h1 style={{ margin: '14px 0 12px', fontSize: 'clamp(34px,5vw,56px)', letterSpacing: '-.04em' }}>{card.name || card.code}</h1>
        <p style={{ color: '#aaa397', lineHeight: 1.75 }}>{t('Bu eski biznes ko‘rinishi shaxsiy NFC ID bilan aralashib qolgan edi. Endi kompaniya alohida, faqat harflardan iborat Company ID va admin tasdig‘i bilan ochiladi.')}</p>
        <div style={{ marginTop: 24, padding: 18, border: '1px solid #2e291e', borderRadius: 14, background: '#090909' }}>
          <b style={{ color: '#efc45a' }}>{card.code} — mavjud NFC ID</b>
          <p style={{ color: '#7f796e', fontSize: 13, lineHeight: 1.6, marginBottom: 0 }}>{t('Uning profili va bazadagi ma’lumotlari o‘zgarmaydi. Yangi kompaniyaga kerakli biznes ma’lumotlarini nusxalash mumkin.')}</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 25 }}>
          <button style={{ background: '#efb72f', color: '#080705', border: 0, borderRadius: 11, padding: '13px 18px', fontWeight: 900, cursor: 'pointer' }} onClick={() => navigate(`/company/create?from=${card.code.toLowerCase()}`)}>{t('Alohida Company ID ochish')} →</button>
          <button style={{ background: '#111', color: '#d7d0c4', border: '1px solid #302c24', borderRadius: 11, padding: '13px 18px', cursor: 'pointer' }} onClick={() => navigate('/' + card.code.toLowerCase())}>{t('Eski profilni ko‘rish')} ↗</button>
          <button style={{ background: 'transparent', color: '#8c8578', border: 0, padding: '13px 18px', cursor: 'pointer' }} onClick={() => navigate('/account')}>← {t('Kabinet')}</button>
        </div>
      </div>
    </main>
  );
}
