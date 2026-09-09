import { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../lib/i18n.jsx';
import { navigate } from '../lib/router.js';
import { useCategories, catPath } from '../lib/categories.js';
import { fmt } from '../lib/format.js';
import { dbSearchCompanies } from '../lib/db.js';
import { listPublicCompanies } from '../lib/company.js';
import { checkCompanyId, companyIdLocalInfo, normalizeCompanyId } from '../lib/company.js';
import NfcCard from '../components/NfcCard.jsx';

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
  const { t } = useLanguage();
  return (
    <PhoneShell className="restaurant-phone">
      <header className="co-r-head"><span>‹</span><div><i>♨</i><b>NFC Restaurant</b><small>{t('PREMIUM MENYU')}</small></div><span>⌕</span></header>
      <div className="co-phone-welcome"><span>{t('Bugungi tavsiya')}</span><b>{t('Chef tanlovi')} · −15%</b></div>
      <div className="co-phone-tabs"><b>{t('Nonushta')}</b><span>{t('Issiq taomlar')}</span><span>{t('Salatlar')}</span><span>{t('Ichimliklar')}</span></div>
      <div className="co-menu-list">
        {RESTAURANT_ITEMS.map((item) => (
          <article key={item.name}>
            <img src={item.image} alt="" />
            <div><b>{item.name}{item.badge && <em>{item.badge}</em>}</b><small>{t('Yangi, mazali va mehr bilan')}</small><strong>{item.price} {t('so‘m')}</strong></div>
            <span>♡</span>
          </article>
        ))}
      </div>
    </PhoneShell>
  );
}

function MarketPhone() {
  const { t } = useLanguage();
  return (
    <PhoneShell className="market-phone">
      <header className="co-m-head"><span>‹</span><div><i>▣</i><b>NFC Market</b><small>{t('PREMIUM KATALOG')}</small></div><span>♡</span></header>
      <div className="co-phone-search"><span>⌕</span> {t('Smartfon qidiring')}</div>
      <div className="co-phone-tabs"><b>{t('Barchasi')}</b><span>{t('Telefonlar')}</span><span>Fold</span><span>Gaming</span></div>
      <div className="co-product-grid">
        {MARKET_ITEMS.map((item) => (
          <article key={item.name}>
            <span className={`co-product-shot sprite-${item.sprite}`}>{item.badge && <em>{item.badge}</em>}</span>
            <b>{item.name}</b>
            <strong>{item.price} {t('so‘m')}</strong>
          </article>
        ))}
      </div>
    </PhoneShell>
  );
}

// Company ID NARX TEKSHIRGICHI (2026-09).
//
// Egasining talabi: "kompaniya bo'limida kompaniyalar ID sini narxlarini
// bilish joyi bo'lsin ... o'sha yerning o'zidan ham sotib olish/band
// qilishga o'ta olsin".
//
// Narx SERVERDAN olinadi (checkCompanyId) — sahifaga hech qanday narx
// qo'lda yozilmagan. Premium nomlar (BANK, MARKET...) o'z qat'iy
// narxida, qolganlari harflar soniga qarab.
function CompanyIdPriceCard({ t }) {
  const [value, setValue] = useState('');
  const [check, setCheck] = useState(null);
  const [busy, setBusy] = useState(false);

  // Yozilayotganda o'zi tekshiradi (450 ms kutib) — alohida tugma
  // bosish shart emas, lekin tugma ham bor (klaviaturasiz qulay bo'lsin).
  useEffect(() => {
    const local = companyIdLocalInfo(value);
    setCheck(local);
    if (!local.valid) { setBusy(false); return undefined; }
    setBusy(true);
    const timer = setTimeout(() => {
      checkCompanyId(local.companyId)
        .then((r) => { setCheck(r); setBusy(false); })
        .catch(() => { setCheck({ ...local, available: null }); setBusy(false); });
    }, 450);
    return () => clearTimeout(timer);
  }, [value]);

  const ready = check?.valid && check?.available === true;

  return (
    <article className="co-price-card">
      <div className="co-price-head">
        <span className="co-price-kicker">{t('COMPANY ID')}</span>
        <h2>{t('Nomingiz bo‘shmi? Narxini shu yerda bilib oling')}</h2>
        <p>{t('Kompaniya nomini yozing — bo‘sh yoki bandligi va aniq narxi darhol ko‘rinadi.')}</p>
      </div>

      <label className="co-price-input">
        <span className="co-price-prefix">nfcstore.uz/c/</span>
        <input
          value={value}
          onChange={(e) => setValue(normalizeCompanyId(e.target.value).slice(0, 15))}
          placeholder="KOMPANIYA"
          aria-label={t('Company ID')}
          autoComplete="off"
          spellCheck="false"
        />
      </label>

      <div className={`co-price-result ${ready ? 'is-ok' : check?.valid && check?.available === false ? 'is-no' : ''}`}>
        {!check?.valid && <b>{t('3–15 ta harf')}</b>}
        {check?.valid && busy && <b>{t('Tekshirilmoqda…')}</b>}
        {check?.valid && !busy && check.available === true && (
          <>
            <b>{check.premiumName ? t('PREMIUM NOM') : String(check.tier || '').toUpperCase()}</b>
            <strong>{fmt(check.price)} {t('so‘m')}</strong>
            <span>{t('Bo‘sh — hoziroq band qilish mumkin')}</span>
          </>
        )}
        {check?.valid && !busy && check.available === false && (
          <>
            <b>{t('Band')}</b>
            <span>{check.reason ? t(check.reason) : t('Bu nom sotuvda emas')}</span>
          </>
        )}
        {check?.valid && !busy && check.available == null && <b>{t('Server bilan aloqa yo‘q')}</b>}
      </div>

      {/* Band qilishga o'tish — ID formaga oldindan yozilib ochiladi. */}
      <button
        type="button"
        className="co-price-cta"
        disabled={!ready}
        onClick={() => navigate(`/kompaniyalar/yaratish?id=${encodeURIComponent(check.companyId)}`)}
      >
        {ready ? t('Band qilish') : t('Avval nom yozing')} <span>→</span>
      </button>

      {check?.valid && !busy && check.available === false && check.alternatives?.length > 0 && (
        <div className="co-price-alts">
          <span>{t('Bo‘sh variantlar:')}</span>
          {check.alternatives.map((id) => (
            <button key={id} type="button" onClick={() => setValue(id)}>{id}</button>
          ))}
        </div>
      )}

      <p className="co-price-note">
        {t('Narx nomdagi harflar soniga bog‘liq: qanchalik qisqa bo‘lsa, shunchalik qimmat. Ba’zi nomlar premium toifada.')}
      </p>
    </article>
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
        {/* SHAXSIY KABINETGA EMAS, BIZNES KABINETGA (2026-09). Avval
            bu tugma /account ga olib borardi — odam kompaniya ochmoqchi
            bo'lib bosardi-yu, shaxsiy profiliga tushib qolardi. */}
        <button type="button" className="co-create-profile" onClick={() => navigate('/business')}>
          {t('Kompaniya profilini ochish')} <span>→</span>
        </button>
      </div>
      {/* TELEFON MAKETI OLIB TASHLANDI (2026-09, egasining qarori).
          O'rniga kompaniyaga mos premium ko'rinish: kompaniya NFC
          kartasi va undan tarqaladigan oltin signal to'lqinlari —
          biznes kabinetdagi bilan bir uslubda. */}
      <div className="co-showcase-visual">
        <div className="co-orbit one" /><div className="co-orbit two" />
        <img className="co-backdrop-image" src={restaurant ? '/business-assets/restaurant-food.jpg' : '/business-assets/market-interior.jpg'} alt="" />
        <div className="co-nfc-waves" aria-hidden="true">
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} style={{ animationDelay: `${(i * 0.5).toFixed(2)}s` }} />
          ))}
        </div>
        <div className="co-nfc-card">
          <NfcCard code="BIZ001" name={t('KOMPANIYANGIZ')} finish="black" size="md" rim />
        </div>
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
  // Ikki xil yozuv bir ro'yxatda: biznes turidagi NFC karta (/vip001)
  // va haqiqiy KOMPANIYA profili (/c/nfcstoreuz). Manzili ham, belgisi
  // ham shunga qarab tanlanadi.
  const isCompany = item.kind === 'company';
  const href = isCompany ? `/c/${item.code.toLowerCase()}` : '/' + item.code.toLowerCase();
  return (
    <button type="button" className="co-real-company" onClick={() => navigate(href)}>
      <div className="co-real-cover">
        {item.bgUrl || item.avatarUrl
          ? <img src={item.bgUrl || item.avatarUrl} alt="" />
          : <span>{(item.name || item.code).slice(0, 2).toUpperCase()}</span>}
        <em>{isCompany ? t('Kompaniya') : t('Biznes profil')}</em>
      </div>
      <div className="co-real-body">
        <span className="co-real-logo">{item.avatarUrl ? <img src={item.avatarUrl} alt="" /> : (item.name || item.code).slice(0, 2).toUpperCase()}</span>
        <div><h3>{item.name || item.code}{item.verified && <i>✓</i>}</h3><p>{path || item.role || t('Kompaniya')}</p><small>{item.city ? `⌖ ${item.city}` : `nfcstore.uz${href}`}</small></div>
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
  const [searchError, setSearchError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const debounceRef = useRef(null);
  // HAQIQIY KOMPANIYA PROFILLARI (`companies` jadvali, /c/<ID>).
  // Egasining shikoyati: "Kompaniyalar sahifasida NFCSTORE biznes
  // profili ko'rinmayapti" — ro'yxat faqat biznes turidagi NFC
  // kartalardan yig'ilardi va kompaniyalar u yerga umuman tushmasdi.
  // Yiqilsa JIM turadi: sahifaning qolgani avvalgidek ishlayveradi.
  const [realCompanies, setRealCompanies] = useState([]);
  useEffect(() => {
    let live = true;
    listPublicCompanies()
      .then((rows) => live && setRealCompanies(rows))
      .catch(() => live && setRealCompanies([]));
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const term = q.trim();
    clearTimeout(debounceRef.current);
    setSearchError(false);
    if (!term) { setItemResults(null); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      dbSearchCompanies(term)
        .then((result) => { setItemResults(result); setSearching(false); })
        .catch(() => { setItemResults([]); setSearchError(true); setSearching(false); });
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [q, retryTick]);

  const query = q.trim().toUpperCase();
  const localMatches = useMemo(() => {
    // Kompaniya profillarini kartochkalar bilan BIR XIL shaklga
    // keltiramiz — pastdagi filtr va kartochka ikkalasiga ham ishlasin.
    const asCards = realCompanies.map((c) => ({
      kind: 'company',
      code: c.companyId,
      name: c.displayName || c.companyId,
      role: c.subcategory || '',
      city: c.city || '',
      categorySlug: c.category || '',
      avatarUrl: c.logoUrl || '',
      bgUrl: c.coverUrl || '',
      verified: true,
      // Tartib uchun: kompaniyada `ts` yo'q, yaratilgan sanasidan olamiz.
      ts: c.createdAt ? Date.parse(c.createdAt) || 0 : 0,
      hiddenFromDirectory: false,
      profileType: 'business',
    }));
    return [...catalog.filter((item) => item.profileType === 'business' && !item.hiddenFromDirectory), ...asCards]
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .filter((item) => !query
        || item.code.includes(query)
        || (item.name || '').toUpperCase().includes(query)
        || (item.role || '').toUpperCase().includes(query)
        || (item.city || '').toUpperCase().includes(query)
        || catPath(categories, item.categorySlug, lang).toUpperCase().includes(query));
  }, [catalog, realCompanies, query, categories, lang]);

  const companies = useMemo(() => {
    if (!query || itemResults == null) return localMatches;
    const keyOf = (item) => `${item.kind === 'company' ? 'c' : 'p'}:${item.code}`;
    const byCode = new Map(localMatches.map((item) => [keyOf(item), item]));
    for (const result of itemResults) {
      const key = keyOf(result);
      byCode.set(key, { ...(byCode.get(key) || result), ...result });
    }
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
        <span className="co-eyebrow vz-kicker">NFCSTORE {t('Kompaniyalar katalogi')}</span>
        <h1>{t('Kompaniyalar va')}<br />{t('mutaxassislarni')} <strong>{t('toping')}</strong></h1>
        {/* Probel <br /> DAN OLDIN turishi shart: telefonda `.co-hero>p br`
            display:none bo'ladi va probelsiz ikki jumla "toping.Ularning"
            bo'lib yopishib qolardi. Katta ekranda bu probel qator oxirida
            qolib, ko'rinmaydi. */}
        <p>{t('Kerakli kompaniya, xizmat yoki mutaxassisni NFCStore orqali toping.')}{' '}<br />{t('Ularning faoliyat sohasi, katalogi va ochiq aloqa ma’lumotlarini bitta joyda ko‘ring.')}</p>
        <form className="co-search" onSubmit={search}>
          <span aria-hidden="true">⌕</span><input value={q} onChange={(event) => setQ(event.target.value)} placeholder={t('Kompaniya nomi, mahsulot, taom yoki xizmat')} aria-label={t('Qidirish')} /><button type="submit" className="vz-tap" aria-busy={searching}>{searching ? '•••' : t('Qidirish')}</button>
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

      {/* Avval bu yerda IKKITA bir xil kartochka (telefon maketi bilan)
          turardi va ular bir-birini takrorlardi. Endi chapda BITTA
          namuna, o'ngda esa Company ID narxini bilish va darhol band
          qilish joyi — egasining talabi. */}
      <section className="co-showcase-grid">
        <ShowcaseCard type="restaurant" t={t} />
        <CompanyIdPriceCard t={t} />
      </section>

      <section id="kompaniyalar-royxati" className="co-directory">
        <header><div><h2>{t('Kompaniyalar va kataloglarni kashf eting')}</h2><p>{t('Restoranlar va kompaniyalarni qidiring, ularning profili va katalogini ko‘ring.')}</p></div>{companies.length > 0 && <span>{fmt(companies.length)} {t('ta natija')}</span>}</header>
        {searchError ? (
          <div className="vz-empty mt-4" role="alert">
            <b>{t("Server bilan aloqa yo'q")}</b>
            <p className="text-sm">{t("Qidiruv natijalarini yuklab bo'lmadi.")}</p>
            <button type="button" className="btn btn-outline-gold btn-sm mt-2" onClick={() => setRetryTick((n) => n + 1)}>{t('Qayta urinish')}</button>
          </div>
        ) : searching && companies.length === 0 ? (
          <div className="co-real-grid" aria-busy="true">
            {[0, 1].map((i) => <div key={i} className="vz-card--flat vz-card min-w-0 p-4"><div className="vz-skel" style={{ height: 96 }} /><div className="vz-skel mt-3 w-2/3" /><div className="vz-skel mt-2 w-1/2" /></div>)}
          </div>
        ) : companies.length > 0 ? (
          <div className="co-real-grid">{companies.map((item) => <RealCompanyCard key={`${item.kind === 'company' ? 'c' : 'p'}:${item.code}`} item={item} categories={categories} lang={lang} t={t} />)}</div>
        ) : query ? (
          <div className="co-empty vz-empty"><span aria-hidden="true">⌕</span><b>{t('Mos kompaniya topilmadi')}</b><p>{t('Boshqa nom, xizmat yoki shahar bilan qidiring.')}</p></div>
        ) : (
          <div className="co-demo-grid"><DemoCompanyCard type="restaurant" t={t} /><DemoCompanyCard type="market" t={t} /></div>
        )}
      </section>

      <section className="co-business-cta">
        <i>♢</i><div><h2>{t('Sizning biznesingiz ham NFCStore’da bo‘lsin')}</h2><p>{t('Kompaniyangiz uchun rasmli raqamli profil oching. Katalog boshqaruvi kompaniya profilingiz ichidagi Business Workspace’da ochiladi.')}</p></div>
        <button type="button" className="vz-tap" onClick={() => navigate('/business')}>{t('Kompaniya profilini ochish')} <span>→</span></button>
        {/* "NFC ID tanlash" — katalogga, ya'ni ID'lar tanlanadigan
            joyga. Narxlar sahifasi narxni tushuntiradi, ID tanlash esa
            katalogda bo'ladi. */}
        <button type="button" className="secondary vz-tap" onClick={() => navigate('/katalog')}>{t('NFC ID tanlash')}</button>
      </section>
    </main>
  );
}
