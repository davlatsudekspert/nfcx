import { useEffect, useMemo, useState } from 'react';
import ProfileActionCluster from './ProfileActionCluster.jsx';
import ProfileQrModal from './ProfileQrModal.jsx';
import { directionsUrl, yandexDirectionsUrl } from '../lib/mapLink.js';
import CloseButton from './CloseButton.jsx';
import { socialUrl } from '../lib/socialLinks.js';
import { businessModule } from '../lib/access.js';
import { dbAddCatalogItemView, dbGetCatalogMeta, dbSetCatalogReaction } from '../lib/db.js';
import { fmt } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import { ownerActionUrl } from './OwnerDock.jsx';
import { downloadVcard } from '../lib/vcard.js';

const MODULE_COPY = {
  menu: { tab: 'Menyu', singular: 'Taom', route: 'menu' },
  products: { tab: 'Mahsulotlar', singular: 'Mahsulot', route: 'products' },
  services: { tab: 'Xizmatlar', singular: 'Xizmat', route: 'services' },
};

function telegramUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return socialUrl('tg', raw);
}

function websiteUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function priceText(item, module, t) {
  if (item.priceType === 'negotiable') return t('Narx kelishiladi');
  if (item.price == null || item.price === '') return t('Narx so‘rov bo‘yicha');
  const suffix = item.priceType === 'from' ? t(" so‘mdan") : t(" so‘m");
  return `${fmt(item.price)}${suffix}`;
}

function livePromotion(meta) {
  const promotion = meta?.promotion;
  if (!promotion?.active || !promotion.endsAt) return null;
  return new Date(promotion.endsAt).getTime() > Date.now() ? promotion : null;
}

function promotionDays(promotion) {
  if (!promotion?.endsAt) return 0;
  return Math.max(0, Math.ceil((new Date(promotion.endsAt).getTime() - Date.now()) / 86400000));
}

function Price({ item, module, meta, t }) {
  const promotion = livePromotion(meta);
  const fallbackSale = !promotion && item.discountPrice != null && Number(item.discountPrice) < Number(item.price);
  if (promotion || fallbackSale) {
    const oldPrice = promotion?.oldPrice ?? item.price;
    const newPrice = promotion?.newPrice ?? item.discountPrice;
    return (
      <div className="bp-sale-price">
        <s>{fmt(oldPrice)} {t('so‘m')}</s>
        <b>{fmt(newPrice)} {t('so‘m')}</b>
      </div>
    );
  }
  return <b className="bp-price">{priceText(item, module, t)}</b>;
}

function CatalogCard({ item, module, t, meta, onOpen, onReact }) {
  const promotion = livePromotion(meta);
  return (
    <article className="bp-catalog-card">
      <button type="button" className="bp-catalog-open" onClick={() => onOpen(item)}>
        <div className="bp-catalog-image">
          {item.imageUrl
            ? <img src={item.imageUrl} alt={item.name} />
            : <span>{(item.name || '?').slice(0, 1).toUpperCase()}</span>}
          {item.available === false && <b className="bp-unavailable">{t('Mavjud emas')}</b>}
          {promotion && <b className="bp-promo-badge">−{Math.max(1, Math.round((1 - promotion.newPrice / promotion.oldPrice) * 100))}%</b>}
        </div>
        <div className="bp-catalog-copy">
          <div>
            <strong>{item.name}</strong>
            {item.description && <p>{item.description}</p>}
          </div>
          <Price item={item} module={module} meta={meta} t={t} />
          {promotion && <span className="bp-promo-time">◆ {promotionDays(promotion)} {t('kun qoldi')}</span>}
        </div>
      </button>
      <div className="bp-engagement" aria-label={t('Mahsulot statistikasi')}>
        <button type="button" className={meta?.reaction === 'like' ? 'active' : ''} onClick={() => onReact(item, 'like')} aria-label={t('Yoqdi')}><span>♥</span>{fmt(meta?.likes || 0)}</button>
        <button type="button" className={meta?.reaction === 'dislike' ? 'active dislike' : ''} onClick={() => onReact(item, 'dislike')} aria-label={t('Yoqmadi')}><span>↓</span>{fmt(meta?.dislikes || 0)}</button>
        <span className="bp-view-count" title={t('Ko‘rishlar')}><i>◉</i>{fmt(meta?.views || 0)}</span>
      </div>
    </article>
  );
}

export default function BusinessPublicProfile({
  record,
  menu = [],
  products = [],
  services = [],
  gallery = [],
  team = [],
  initialTab,
  isOwner,
  // Egasining boshqa NFC ID lari SONI. Ro'yxatning o'zi kabinetda
  // ("Mening ID'larim"); bu yerda faqat menyu bandini ko'rsatish-
  // ko'rsatmaslik uchun kerak.
  otherCodesCount = 0,
  t,
}) {
  const module = businessModule(record.profileType, record.categorySlug) || 'services';
  const moduleCopy = MODULE_COPY[module];
  const initial = initialTab === 'aksiyalar'
    ? 'promotions'
    : initialTab && ['menyu', 'mahsulotlar', 'xizmatlar'].includes(initialTab) ? 'catalog' : 'main';
  const [active, setActive] = useState(initial);
  const [selected, setSelected] = useState(null);
  const [catalogMeta, setCatalogMeta] = useState({});
  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const source = module === 'menu' ? menu : module === 'products' ? products : services;
  const categories = useMemo(() => (source || []).filter((category) => category.items?.length), [source]);
  const items = useMemo(() => categories.flatMap((category) => category.items.map((item) => ({ ...item, categoryName: category.name }))), [categories]);
  useEffect(() => {
    let cancelled = false;
    dbGetCatalogMeta(record.code, module).then((result) => {
      if (cancelled) return;
      if (!record.demo) {
        setCatalogMeta(result.items || {});
        return;
      }
      const sample = {};
      items.forEach((item, index) => {
        sample[String(item.id || item.name)] = {
          likes: [38, 24, 17, 31][index] || 12,
          dislikes: [1, 0, 2, 1][index] || 0,
          views: [428, 316, 209, 354][index] || 150,
          reaction: null,
          promotion: index === 0 && Number(item.price) > 0 ? {
            oldPrice: Number(item.price),
            newPrice: Math.round(Number(item.price) * .84),
            startsAt: new Date().toISOString(),
            endsAt: new Date(Date.now() + 12 * 86400000).toISOString(),
            active: true,
          } : null,
        };
      });
      setCatalogMeta({ ...sample, ...(result.items || {}) });
    });
    return () => { cancelled = true; };
  }, [record.code, record.demo, module, items]);
  const promotedItems = items.filter((item) => livePromotion(catalogMeta[String(item.id || item.name)]));
  const heroImage = record.bgUrl || gallery[0]?.imageUrl || items.find((item) => item.imageUrl)?.imageUrl || '';
  const tgUrl = telegramUrl(record.tg);
  const hasLocation = Boolean(record.address || (record.latitude != null && record.longitude != null));
  // Yo'nalish havolasi — qurilmaga mos xarita ilovasida (iPhone'da
  // Apple Maps, qolganlarida Google Maps). Avval hamma joyda Google
  // Maps'ning QIDIRUV havolasi edi: nuqtani ko'rsatardi, lekin yo'nalish
  // bermasdi. Yandex alohida tugma — O'zbekistonda ko'p ishlatiladi.
  const mapsUrl = directionsUrl(record);
  const yandexUrl = yandexDirectionsUrl(record);
  const osmUrl = record.latitude != null && record.longitude != null
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${Number(record.longitude) - 0.018}%2C${Number(record.latitude) - 0.01}%2C${Number(record.longitude) + 0.018}%2C${Number(record.latitude) + 0.01}&layer=mapnik&marker=${record.latitude}%2C${record.longitude}`
    : '';
  const publicRoute = `/${record.code.toLowerCase()}`;

  const chooseTab = (tab) => {
    setActive(tab);
    setSelected(null);
    if (tab === 'main') window.history.pushState(null, '', publicRoute);
    if (tab === 'catalog') window.history.pushState(null, '', `${publicRoute}/${moduleCopy.route}`);
    if (tab === 'promotions') window.history.pushState(null, '', `${publicRoute}/aksiyalar`);
  };

  const updateItemMeta = (item, next) => {
    const key = String(item.id || item.name);
    setCatalogMeta((current) => ({ ...current, [key]: { ...(current[key] || {}), ...next } }));
  };

  const openItem = (item) => {
    setSelected(item);
    dbAddCatalogItemView(record.code, module, item.id || item.name)
      .then((result) => updateItemMeta(item, result))
      .catch(() => {});
  };

  const reactToItem = (item, reaction) => {
    const key = String(item.id || item.name);
    const nextReaction = catalogMeta[key]?.reaction === reaction ? null : reaction;
    dbSetCatalogReaction(record.code, module, item.id || item.name, nextReaction)
      .then((result) => updateItemMeta(item, result))
      .catch(() => {});
  };

  const tabs = [
    ['main', t('Asosiy')],
    ['catalog', t(moduleCopy.tab)],
    ...(promotedItems.length ? [['promotions', `${t('Aksiyalar')} · ${promotedItems.length}`]] : []),
    ...(gallery.length ? [['gallery', t('Galereya')]] : []),
    ...(hasLocation ? [['location', t('Lokatsiya')]] : []),
    ['contact', t('Aloqa')],
  ];

  // Ulashish/nusxalash uchun kanonik havola — shaxsiy profildagi bilan
  // AYNAN bir xil shakl: nfcstore.uz/<kod kichik harfda>.
  const shareUrl = typeof window === 'undefined'
    ? `https://nfcstore.uz/${String(record.code || '').toLowerCase()}`
    : `${window.location.origin}/${String(record.code || '').toLowerCase()}`;
  // Nusxalash RAD ETILISHI mumkin (ruxsat berilmagan brauzer, HTTPS
  // bo'lmagan muhit) — va'da qaytaradi, shuning uchun `await` bilan
  // kutiladi va natija ROST aytiladi.
  const saveContact = () => downloadVcard({
    name: record.name,
    org: record.name,
    title: record.role,
    phone: (record.phone && !record.hidePhone) ? record.phone : '',
    email: record.email,
    address: record.address,
    note: record.about ? String(record.about).replace(/\s*\n\s*/g, ' ') : '',
    urls: [tgUrl, record.website || '', shareUrl].filter(Boolean),
  }, String(record.code || 'nfcstore').toLowerCase());

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* brauzer rad etdi — ulashish tugmasi baribir ishlaydi */ }
  };

  return (
    <main className="bp-page">
      <header className="bp-topbar">
        <button type="button" className="bp-brand" onClick={() => navigate('/')} aria-label={t('Bosh sahifa')}>
          <img src="/logo-192.png" alt="" />
          <span>NFCSTORE</span>
        </button>
        {record.demo && <span className="bp-demo-badge">{t('NAMUNA PROFIL')}</span>}
        <div className="bp-top-actions">
        {/* "Kompaniyalar" — SAYT navigatsiyasi, profilning amali emas.
            Telefonda yashiriladi (theme.css) — u yerda joy yo'q va
            pastdagi kolontitulda o'sha havola baribir bor. */}
        <button type="button" className="bp-quiet-btn" onClick={() => navigate('/kompaniyalar')}>{t('Kompaniyalar')}</button>
        {/* O'NG YUQORI BURCHAK — SHAXSIY PROFIL BILAN BITTA TIZIM:
                [nusxalash] [ulashish] [⋮]
            (yurak biznes profilda yo'q — bu yerda asosiy ijtimoiy
            harakat "Obuna bo'lish", u pastda turadi.)

            EGASI UCHUN KATTA OLTIN "TAHRIRLASH" TUGMASI OLIB TASHLANDI.
            Ochiq profil — mehmonga ko'rsatiladigan sahifa; boshqaruv
            tugmasi uning eng ko'zga tashlanadigan joyida turmasligi
            kerak. Tahrirlash yo'qolmadi: u ⋮ menyusida va avvalgidek
            o'zining NFC ID si bilan haqiqiy tahrirlash oynasini
            ochadi (`ownerActionUrl`) — shaxsiy profildagi bilan bir
            xil yo'l. (Ilgari u `/business/:code` ga olib borardi; u
            sahifa esa NAMUNA — `DEMO_PRESETS` ustida ishlaydi va
            birorta ham so'rov yubormaydi, ya'ni yozilgan narsa hech
            qayerga saqlanmasdi.) */}
        <ProfileActionCluster
          url={shareUrl}
          shareTitle={record.name || 'NFCSTORE'}
          shareText={record.role || t('Kompaniya va xizmatlar')}
          onCopy={copyLink}
          targetKind="record"
          targetId={record.code}
          ownerActions={isOwner ? [
            { label: t('Profilni tahrirlash'), icon: '✎', onClick: () => navigate(ownerActionUrl(record.code, 'edit')) },
            { label: t('Story qo‘shish'), icon: '＋', onClick: () => navigate(ownerActionUrl(record.code, 'story')) },
            { label: t('Post qo‘shish'), icon: '＋', onClick: () => navigate(ownerActionUrl(record.code, 'post')) },
            { label: t('QR kod'), icon: '▦', onClick: () => setQrOpen(true) },
            ...(otherCodesCount > 0
              ? [{ label: t("Mening ID'larim"), icon: '▤', onClick: () => navigate('/account#myids') }]
              : []),
          ] : []}
        />
        </div>
      </header>

      <section className={`bp-hero ${heroImage ? 'has-image' : ''}`}>
        {heroImage && <img className="bp-hero-image" src={heroImage} alt="" />}
        <div className="bp-hero-shade" />
        <div className="bp-hero-content">
          <div className="bp-logo">
            {record.avatarUrl ? <img src={record.avatarUrl} alt={`${record.name} logotipi`} /> : <span>{(record.name || '?').slice(0, 2).toUpperCase()}</span>}
          </div>
          <div className="bp-identity">
            <div className="bp-kicker">{t(record.demo ? 'NAMUNA · BUSINESS PROFILE' : 'BUSINESS PROFILE')}</div>
            <h1>{record.name}</h1>
            <p>{record.role || t('Kompaniya va xizmatlar')}</p>
            <div className="bp-meta">
              {record.verified && <span className="bp-verified">✓ {t('Tasdiqlangan')}</span>}
              {record.city && <span>⌖ {record.city}</span>}
              {(record.views || 0) > 0 && <span>◉ {fmt(record.views)} {t('ko‘rish')}</span>}
            </div>
          </div>
          <div className="bp-hero-actions">
            {/* KONTAKTNI SAQLASH — NFC KARTANING BUTUN MA'NOSI.
                Odam tegizadi, sahifani yopadi — va raqamingiz uning
                telefonida QOLADI. Shaxsiy profilda ham, kompaniya
                sahifasida ham bu tugma bor edi, faqat SHU YERDA
                yo'q edi: bu yerda qolgani (qo'ng'iroq, Telegram)
                sahifa yopilgach hech qanday iz qoldirmaydi.
                Yozuvchi umumiy (`src/lib/vcard.js`) — uchinchi
                nusxa yaratilmadi. */}
            <button type="button" className="bp-gold-btn" onClick={saveContact}>↓ {t('Kontaktni saqlash')}</button>
            {record.phone && !record.hidePhone && <a className="bp-dark-btn" href={`tel:${record.phone}`}>☎ {t('Qo‘ng‘iroq')}</a>}
            {tgUrl && <a className="bp-dark-btn" href={tgUrl} target="_blank" rel="noopener noreferrer">Telegram</a>}
            {hasLocation && <a className="bp-dark-btn" href={mapsUrl} target="_blank" rel="noopener noreferrer">⌖ {t('Yo‘nalish')}</a>}
          </div>
        </div>
      </section>

      <nav className="bp-tabs" aria-label={t('Biznes profil bo‘limlari')}>
        {tabs.map(([id, label]) => (
          <button type="button" key={id} className={active === id ? 'active' : ''} onClick={() => chooseTab(id)}>{label}</button>
        ))}
      </nav>

      <div className="bp-content">
        {active === 'main' && (
          <>
            <section className="bp-main-grid">
              <article className="bp-panel bp-about">
                <span className="bp-section-label">{t('BIZ HAQIMIZDA')}</span>
                <h2>{record.role || record.name}</h2>
                <p>{record.about || t('Kompaniya haqida ma’lumot tez orada qo‘shiladi.')}</p>
                <div className="bp-facts">
                  {record.city && <span><b>⌖</b>{record.city}</span>}
                  {record.website && <a href={websiteUrl(record.website)} target="_blank" rel="noopener noreferrer"><b>↗</b>{record.website.replace(/^https?:\/\//, '')}</a>}
                  {record.phone && !record.hidePhone && <a href={`tel:${record.phone}`}><b>☎</b>{record.phone}</a>}
                </div>
              </article>
              <article className="bp-panel bp-summary">
                <span className="bp-section-label">{t('KATALOG')}</span>
                <strong>{fmt(items.length)}</strong>
                <p>{t(`${moduleCopy.tab} professional katalog ko‘rinishida`)}</p>
                <button type="button" className="bp-text-link" onClick={() => chooseTab('catalog')}>{t(`${moduleCopy.tab}ni ko‘rish`)} →</button>
              </article>
              <article className="bp-panel bp-summary">
                <span className="bp-section-label">{t('ALOQA')}</span>
                <strong>{record.phone && !record.hidePhone ? t('Ochiq') : t('Onlayn')}</strong>
                <p>{record.address || record.city || t('Bog‘lanish ma’lumotlari')}</p>
                <button type="button" className="bp-text-link" onClick={() => chooseTab('contact')}>{t('Bog‘lanish')} →</button>
              </article>
            </section>

            {items.length > 0 && (
              <section className="bp-featured">
                <div className="bp-section-head"><div><span className="bp-section-label">{t('TANLANGANLAR')}</span><h2>{t(moduleCopy.tab)}</h2></div><button type="button" className="bp-quiet-btn" onClick={() => chooseTab('catalog')}>{t('Barchasini ko‘rish')} →</button></div>
                <div className="bp-catalog-grid">{items.slice(0, 4).map((item) => <CatalogCard key={item.id || item.name} item={item} module={module} t={t} meta={catalogMeta[String(item.id || item.name)]} onOpen={openItem} onReact={reactToItem} />)}</div>
              </section>
            )}

            {promotedItems.length > 0 && (
              <button type="button" className="bp-promo-banner" onClick={() => chooseTab('promotions')}>
                <span>◆ {t('AKSIYALAR')}</span>
                <div><b>{promotedItems.length} {t('ta maxsus taklif')}</b><small>{t('Chegirmalar tugashidan oldin ko‘ring')}</small></div>
                <i>→</i>
              </button>
            )}

            {gallery.length > 0 && (
              <section className="bp-gallery-strip">
                {gallery.slice(0, 4).map((image) => <button type="button" key={image.id || image.imageUrl} onClick={() => chooseTab('gallery')}><img src={image.imageUrl} alt={image.caption || record.name} /></button>)}
              </section>
            )}
          </>
        )}

        {active === 'catalog' && (
          <section className="bp-catalog-section">
            <div className="bp-section-head"><div><span className="bp-section-label">{t('KATALOG')}</span><h2>{t(moduleCopy.tab)}</h2><p>{t('Kategoriya bo‘yicha tanlang va batafsil ma’lumotni oching.')}</p></div><span className="bp-count">{fmt(items.length)} {t(moduleCopy.singular.toLowerCase())}</span></div>
            {categories.length ? categories.map((category) => (
              <div className="bp-category" key={category.id || category.name}>
                <h3>{category.name}</h3>
                <div className="bp-catalog-grid">{category.items.map((item) => <CatalogCard key={item.id || item.name} item={item} module={module} t={t} meta={catalogMeta[String(item.id || item.name)]} onOpen={openItem} onReact={reactToItem} />)}</div>
              </div>
            )) : <div className="bp-empty">{t('Katalog hozircha to‘ldirilmagan.')}</div>}
          </section>
        )}

        {active === 'promotions' && (
          <section className="bp-catalog-section bp-promotions-section">
            <div className="bp-section-head"><div><span className="bp-section-label">◆ {t('MAXSUS TAKLIFLAR')}</span><h2>{t('Aksiyalar')}</h2><p>{t('Eski narx, yangi narx va qolgan muddat — hammasi aniq ko‘rsatiladi.')}</p></div><span className="bp-count">{promotedItems.length} {t('ta aksiya')}</span></div>
            <div className="bp-catalog-grid">{promotedItems.map((item) => <CatalogCard key={item.id || item.name} item={item} module={module} t={t} meta={catalogMeta[String(item.id || item.name)]} onOpen={openItem} onReact={reactToItem} />)}</div>
          </section>
        )}

        {active === 'gallery' && (
          <section className="bp-catalog-section">
            <div className="bp-section-head"><div><span className="bp-section-label">{t('MEDIA')}</span><h2>{t('Galereya')}</h2></div></div>
            <div className="bp-gallery-grid">{gallery.map((image) => <figure key={image.id || image.imageUrl}><img src={image.imageUrl} alt={image.caption || record.name} />{image.caption && <figcaption>{image.caption}</figcaption>}</figure>)}</div>
          </section>
        )}

        {active === 'location' && (
          <section className="bp-location-grid">
            <div className="bp-panel bp-location-copy"><span className="bp-section-label">{t('LOKATSIYA')}</span><h2>{record.city || t('Bizning manzil')}</h2><p>{record.address || t('Aniq manzil xaritada ko‘rsatilgan.')}</p><a className="bp-gold-btn" href={mapsUrl} target="_blank" rel="noopener noreferrer">⌖ {t('Yo‘nalishni ochish')}</a>{yandexUrl && <a className="bp-dark-btn" href={yandexUrl} target="_blank" rel="noopener noreferrer" style={{ marginTop: 10 }}>{t('Yandex Karta')}</a>}</div>
            <div className="bp-map">{osmUrl ? <iframe title={t('Kompaniya lokatsiyasi')} src={osmUrl} loading="lazy" /> : <div><span>⌖</span><p>{record.address}</p></div>}</div>
          </section>
        )}

        {active === 'contact' && (
          <section className="bp-contact-grid">
            <div><span className="bp-section-label">{t('ALOQA')}</span><h2>{t('Keling, loyihangizni muhokama qilamiz')}</h2><p>{record.about || t('Savolingizni qulay kanal orqali yuboring.')}</p></div>
            <div className="bp-contact-list">
              {record.phone && !record.hidePhone && <a href={`tel:${record.phone}`}><span>☎</span><div><small>{t('Telefon')}</small><b>{record.phone}</b></div><i>→</i></a>}
              {record.email && <a href={`mailto:${record.email}`}><span>✉</span><div><small>Email</small><b>{record.email}</b></div><i>→</i></a>}
              {tgUrl && <a href={tgUrl} target="_blank" rel="noopener noreferrer"><span>↗</span><div><small>Telegram</small><b>{record.tg}</b></div><i>→</i></a>}
              {record.website && <a href={websiteUrl(record.website)} target="_blank" rel="noopener noreferrer"><span>◎</span><div><small>{t('Veb-sayt')}</small><b>{record.website.replace(/^https?:\/\//, '')}</b></div><i>→</i></a>}
            </div>
          </section>
        )}
      </div>

      <footer className="bp-footer"><span>NFCSTORE BUSINESS</span><button type="button" onClick={() => navigate('/kompaniyalar')}>{t('Boshqa kompaniyalarni ko‘rish')} →</button></footer>

      {selected && (
        <div className="bp-modal-backdrop" role="presentation" onClick={() => setSelected(null)}>
          <article className="bp-modal" role="dialog" aria-modal="true" aria-label={selected.name} onClick={(event) => event.stopPropagation()}>
            <CloseButton onClick={() => setSelected(null)} className="bp-modal-close" />
            {selected.imageUrl && <img src={selected.imageUrl} alt={selected.name} />}
            <span className="bp-section-label">{selected.categoryName}</span>
            <h2>{selected.name}</h2>
            <Price item={selected} module={module} meta={catalogMeta[String(selected.id || selected.name)]} t={t} />
            {livePromotion(catalogMeta[String(selected.id || selected.name)]) && <div className="bp-modal-promo">◆ {promotionDays(livePromotion(catalogMeta[String(selected.id || selected.name)]))} {t('kun qoldi')}</div>}
            {selected.description && <p>{selected.description}</p>}
            <div className="bp-modal-engagement">
              <button type="button" className={catalogMeta[String(selected.id || selected.name)]?.reaction === 'like' ? 'active' : ''} onClick={() => reactToItem(selected, 'like')}>♥ {fmt(catalogMeta[String(selected.id || selected.name)]?.likes || 0)}</button>
              <button type="button" className={catalogMeta[String(selected.id || selected.name)]?.reaction === 'dislike' ? 'active' : ''} onClick={() => reactToItem(selected, 'dislike')}>↓ {fmt(catalogMeta[String(selected.id || selected.name)]?.dislikes || 0)}</button>
              <span>◉ {fmt(catalogMeta[String(selected.id || selected.name)]?.views || 0)} {t('ko‘rish')}</span>
            </div>
            <div className="bp-modal-actions">
              {record.phone && !record.hidePhone && <a className="bp-gold-btn" href={`tel:${record.phone}`}>☎ {t('Qo‘ng‘iroq')}</a>}
              {tgUrl && <a className="bp-dark-btn" href={tgUrl} target="_blank" rel="noopener noreferrer">{t('Yozish')}</a>}
            </div>
          </article>
        </div>
      )}

      {/* QR — ega uchun, ⋮ menyusidan. Shaxsiy profildagi bilan bitta
          komponent (`ProfileQrModal`): ikki xil QR oynasi bo'lsa,
          ulardan biri vaqt o'tib boshqasidan orqada qolardi. */}
      {qrOpen && (
        <ProfileQrModal
          url={shareUrl}
          name={record.name || record.code}
          onClose={() => setQrOpen(false)}
        />
      )}

      {/* Nusxalash natijasi KO'RINADI — aks holda tugma
          "ishlamayotgandek" tuyulardi. */}
      {copied && <div className="bp-toast" role="status">{t('Havola nusxalandi!')}</div>}
    </main>
  );
}
