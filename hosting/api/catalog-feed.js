// hosting/api/catalog-feed.js — GLOBAL KATALOG LENTASI (ilova "Tanlov" bo'limi).
//
// ═══ NIMA UCHUN BOR ═══
//
// Egasining talabi: Tanlov bo'limida bizneslar qo'ygan BARCHA tovarlar
// bitta katalogda tursin, filtr va saralash bilan; tovar bosilsa egasi
// (Business ID) ochilsin. Ilgari tovarlar faqat har bir kompaniya
// sahifasi ICHIDA (`GET /api/companies/:id` -> `company.catalog`) bor edi —
// hammasini bitta ro'yxatda olishning yo'li yo'q edi.
//
// ═══ NIMA QILMAYDI ═══
//
//   * YOZMAYDI. Faqat o'qish (GET). Jadval, ustun, indeks QO'SHILMAYDI —
//     migratsiya yo'q. Manba: mavjud `company_catalog_items` + `companies`.
//   * Marketplace (hosting/api/marketplace.js) ga TEGMAYDI va uning
//     o'rnini bosmaydi: u NFCSTORE'ning o'z do'koni, bu esa bizneslarning
//     katalog ko'rgazmasi. To'lov ham yo'q — faqat ko'rish va egasiga o'tish.
//   * Boshqa marshrutlarni USHLAMAYDI: faqat `GET /api/catalog/feed`,
//     qolgan hamma narsa uchun `null` (keyingi modulga o'tadi).
//
// ═══ KIM KO'RINADI ═══
//
//   * kompaniya `status = 'active'` (moderatsiyadan o'tgan);
//   * kompaniya egasining hisobi O'CHIRILMAGAN.
//
// `pending_review` holatidagi bepul bizneslar ATAYLAB ko'rinmaydi:
// moderatsiyadan o'tmagan tovar global katalogga chiqmasin.
// Mavjud EMAS (`available = 0`) tovar ham ko'rinadi, lekin "Mavjud
// emas" belgisi bilan va ro'yxat oxirida — egasining talabi: listingda
// mavjud/mavjud emas holati bo'lsin.
//
// ═══ UMUMIY KATALOG (2026-09, egasining talabi) ═══
//
// Katalog faqat NFC mahsulotlari emas — BARCHA bizneslarning istalgan
// qonuniy mahsuloti yoki xizmati. Har listingda:
//
//   kind            product | service
//   marketCategory  food | fashion | electronics | beauty | education |
//                   health | home | auto | other   (global, dinamik chiplar)
//   sub             NFC turi (card | sticker | keychain | accessory) —
//                   FAQAT electronics ichida, NFCSTORE mahsulotlari uchun
//   section         biznesning O'Z bo'limi (erkin matn: "Ichimliklar") —
//                   serverdagi eski `category` maydoni; sayt uni o'z
//                   sahifasida filtr sifatida ishlatadi, shuning uchun
//                   u yerga slug YOZILMAYDI
//   priceOnRequest  "Narx kelishiladi" (xizmatlar uchun)
//
// Yangi ustunlar (kind, market_category, images_json, price_on_request)
// worker.js dagi `ensureCatalogListingColumns` bilan QO'SHILADI (faqat
// ADD COLUMN — hech narsa o'chirilmaydi). Ustun bo'sh bo'lgan eski
// yozuvlar uchun tur va kategoriya ANIQLANADI: avval kompaniya sohasi
// (restoran → food), keyin nom/bo'limdagi kalit so'zlar.
//
// ═══ SO'ROV ═══
//
//   GET /api/catalog/feed
//     ?page=1 &limit=20
//     &q=...           mahsulot/xizmat nomi, tavsifi, bo'limi, Business
//                      nomi, Business ID yoki NFC ID bo'yicha
//     &kind=service    product | service
//     &category=food   global kategoriya; eski NFC slugi (card...) ham
//                      qabul qilinadi = electronics + shu sub
//     &sub=card        NFC sub-turi
//     &sort=new        new | price_asc | price_desc | popular
//                      popular — oxirgi 30 kunda eng ko'p ko'rilgan
//                      (ko'rish teng bo'lsa — yangisi oldin)
//
//   POST /api/catalog/items/:id/view
//     Mahsulot/xizmat sahifasi ochilganda. Bir odam bir mahsulotni
//     KUNIGA BIR MARTA sanaladi (PRIMARY KEY) — qayta ochish yoki
//     sahifani yangilash hisobni oshirmaydi. Odam: hisob bo'lsa user
//     id, bo'lmasa IP + brauzer — faqat SHA-256 izi saqlanadi.
//
// `counts` — faqat `q` qo'llangan sonlar: chiplar "Ovqat · 12" deb
// yozilsin va bo'sh kategoriya chipi umuman ko'rsatilmasin (dinamik).
//
// Qoidalar ilovadagi `ListingKind.infer` / `MarketCategory.infer`
// (mobile_nova/lib/data/models/models.dart) bilan AYNAN bir xil —
// o'zgarsa ikkalasini birga o'zgartiring.

export const NFC_TYPES = ['card', 'sticker', 'keychain', 'accessory'];
export const MARKET_CATEGORIES = ['food', 'fashion', 'electronics', 'beauty', 'education', 'health', 'home', 'auto', 'other'];
export const LISTING_KINDS = ['product', 'service'];

const NFC_WORDS = {
  card: ['card', 'karta', 'карта', 'kartochka'],
  sticker: ['sticker', 'stiker', 'стикер', 'наклейка'],
  keychain: ['keychain', 'brelok', 'брелок'],
  accessory: ['accessory', 'aksessuar', 'аксессуар', 'bilaguzuk', 'браслет', 'bracelet'],
};

// Kalit so'zlar — lotin (o'zbek), kirill (rus) va ingliz. Qisqa
// o'zaklar ataylab: "одежд" -> одежда/одежды.
const MARKET_WORDS = {
  food: ['taom', 'ovqat', 'palov', "lag'mon", 'somsa', 'shashlik', 'pizza', 'burger', 'lavash', 'kofe', 'coffee', 'ichimlik', 'shirinlik', 'tort', 'salat', "sho'rva", 'еда', 'блюд', 'напит', 'кофе', 'пицц', 'бургер', 'торт', 'десерт', 'food', 'drink', 'meal'],
  fashion: ['kiyim', "ko'yla", 'shim', 'poyabzal', 'sumka', 'kurtka', 'futbolka', 'libos', 'одежд', 'обув', 'плать', 'сумк', 'куртк', 'fashion', 'dress', 'shoes', 'clothing'],
  electronics: ['nfc', 'telefon', 'smartfon', 'noutbuk', 'kompyuter', 'quloqchin', 'planshet', 'televizor', 'elektron', 'телефон', 'смартфон', 'ноутбук', 'компьютер', 'наушник', 'электрон', 'phone', 'laptop', 'headphone', 'gadget'],
  beauty: ['salon', 'soch', 'manikyur', 'pedikyur', 'kosmetika', 'atir', 'parfyum', "go'zallik", 'massaj', 'kiprik', 'makiyaj', 'салон', 'стрижк', 'маникюр', 'космет', 'парфюм', 'массаж', 'beauty', 'cosmetic', 'perfume', 'nail'],
  education: ['kurs', 'dars', "ta'lim", "o'quv", 'repetitor', 'trening', 'курс', 'урок', 'обучен', 'репетитор', 'тренинг', 'course', 'lesson', 'training', 'tutor'],
  health: ['klinika', 'shifokor', 'doktor', 'tish', 'stomatolog', 'dori', 'apteka', 'tahlil', 'vitamin', 'клиник', 'врач', 'стомат', 'аптек', 'лекарств', 'анализ', 'clinic', 'doctor', 'dental', 'pharmacy'],
  home: ['qurilish', "ta'mirlash", 'remont', 'mebel', 'santexnika', "bo'yoq", 'sement', "g'isht", 'deraza', 'строит', 'ремонт', 'мебел', 'сантех', 'краск', 'furniture', 'construction', 'plumbing'],
  auto: ['avto', 'mashina', 'shina', 'ehtiyot qism', 'автомоб', 'авто', 'шин', 'запчаст', 'car wash', 'tire'],
};

const SERVICE_WORDS = ['xizmat', 'услуг', 'service', 'kurs', 'курс', "ta'mirlash", 'ремонт', 'konsultatsiya', 'консультац', 'massaj', 'массаж', 'soch olish', 'стрижк', 'yetkazib berish', 'доставк', 'dars', 'урок'];

// Kompaniya sohasi (companies.category) -> global kategoriya. Faqat
// ANIQ sohalar: restoran menyusidagi "Uy salati" "uy" so'zi bilan
// qurilishga tushib qolmasin — soha kalit so'zdan USTUN.
const COMPANY_MARKET = {
  restaurant: 'food', cafe: 'food',
  clinic: 'health', pharmacy: 'health',
  education: 'education', construction: 'home',
};
const SERVICE_COMPANIES = new Set(['services', 'clinic', 'education']);

const norm = (v) => String(v || '').trim().toLowerCase().replace(/[‘’ʻʼ`´]/g, "'");

export function nfcTypeOf(category, name = '') {
  const c = norm(category);
  if (NFC_TYPES.includes(c) || c === 'other') return c;
  const hay = `${c} ${norm(name)}`;
  for (const t of NFC_TYPES) {
    if (NFC_WORDS[t].some((w) => hay.includes(w))) return t;
  }
  return 'other';
}

export function marketCategoryOf(explicit, companyCategory, section = '', name = '') {
  const e = norm(explicit);
  if (MARKET_CATEGORIES.includes(e)) return e;
  if (NFC_TYPES.includes(norm(section))) return 'electronics';
  const byCompany = COMPANY_MARKET[norm(companyCategory)];
  if (byCompany) return byCompany;
  // NFC mahsulotlari (karta, stiker, brelok...) — elektronika.
  if (nfcTypeOf(section, name) !== 'other') return 'electronics';
  const hay = `${norm(section)} ${norm(name)}`;
  for (const m of MARKET_CATEGORIES) {
    if ((MARKET_WORDS[m] || []).some((w) => hay.includes(w))) return m;
  }
  return 'other';
}

export function kindOf(explicit, companyCategory, section = '', name = '') {
  const e = norm(explicit);
  if (LISTING_KINDS.includes(e)) return e;
  if (SERVICE_COMPANIES.has(norm(companyCategory))) return 'service';
  const hay = `${norm(section)} ${norm(name)}`;
  return SERVICE_WORDS.some((w) => hay.includes(w)) ? 'service' : 'product';
}

// NFC sub-turi faqat elektronika ichida — restoran "karta orqali
// to'lov" deb yozsa, u NFC karta bo'lib qolmasin.
export function subOf(market, section = '', name = '') {
  if (market !== 'electronics') return null;
  const t = nfcTypeOf(section, name);
  return t === 'other' ? null : t;
}

export function effectivePrice(price, promo) {
  const p = Number(price || 0);
  const s = promo == null ? null : Number(promo);
  return s != null && s > 0 && s < p ? s : p;
}

const parseImages = (raw, first) => {
  let list = [];
  try { list = JSON.parse(raw || '[]'); } catch { list = []; }
  if (!Array.isArray(list)) list = [];
  const out = [];
  for (const u of [first, ...list]) {
    const s = String(u || '').trim();
    if (s && !out.includes(s)) out.push(s);
  }
  return out.slice(0, 6);
};

/// Katalog qatoridan umumiy listing maydonlari — worker.js (kompaniya
/// sahifasi) va shu lenta BIR XIL qoidadan foydalanadi.
export function listingFields(row, companyCategory) {
  const section = row.category || '';
  const kind = kindOf(row.kind, companyCategory, section, row.name);
  const marketCategory = marketCategoryOf(row.market_category, companyCategory, section, row.name);
  const price = Number(row.price || 0);
  return {
    kind,
    marketCategory,
    sub: subOf(marketCategory, section, row.name),
    section,
    images: parseImages(row.images_json, row.image_url),
    priceOnRequest: Number(row.price_on_request || 0) === 1 || price <= 0,
  };
}

const SORTS = ['new', 'price_asc', 'price_desc', 'popular'];
export const POPULAR_WINDOW_DAYS = 30;

let viewsReady = null;
export function ensureItemViews(env) {
  viewsReady ||= env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS company_catalog_item_views (
      item_id TEXT NOT NULL, visitor_key TEXT NOT NULL, view_day TEXT NOT NULL, created_at TEXT NOT NULL,
      PRIMARY KEY (item_id, visitor_key, view_day)
    )`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_company_item_views_day ON company_catalog_item_views(view_day, item_id)`),
  ]).catch((e) => { viewsReady = null; throw e; });
  return viewsReady;
}

async function sha256(v) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Oxirgi N kun ko'rishlari: item_id -> son. Jadval hali yo'q bo'lsa — bo'sh.
async function recentViews(env, now) {
  const since = new Date(now - POPULAR_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  try {
    const r = await env.DB.prepare(
      `SELECT item_id, COUNT(*) AS n FROM company_catalog_item_views WHERE view_day >= ? GROUP BY item_id`
    ).bind(since).all();
    return new Map((r.results || []).map((x) => [String(x.item_id), Number(x.n || 0)]));
  } catch (error) {
    if (/no such table/i.test(String(error?.message || error))) return new Map();
    throw error;
  }
}
const SCAN_CAP = 2000;
const MAX_LIMIT = 50;

const intIn = (v, d, min, max) => {
  const n = Number.parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n)) return d;
  return Math.min(max, Math.max(min, n));
};

// LIKE uchun maxsus belgilar qochiriladi: foydalanuvchi "%" yozsa
// hamma narsa emas, aynan "%" qidirilsin.
const likeArg = (q) => `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

function itemJson(r) {
  const price = Number(r.price || 0);
  const promo = r.promotion_price == null ? null : Number(r.promotion_price);
  const f = r.listing;
  return {
    id: r.id,
    name: r.name || '',
    description: r.description || '',
    imageUrl: f.images[0] || '',
    images: f.images,
    price,
    promotionPrice: promo,
    effectivePrice: effectivePrice(price, promo),
    priceOnRequest: f.priceOnRequest,
    available: Number(r.available ?? 1) === 1,
    kind: f.kind,
    marketCategory: f.marketCategory,
    sub: f.sub,
    section: f.section,
    category: r.category || '',
    createdAt: r.created_at,
    company: {
      companyId: r.company_id,
      displayName: r.display_name || '',
      logoUrl: r.logo_url || '',
      tier: r.tier || '',
      city: r.city || '',
      address: r.address || '',
      phone: r.phone || '',
      telegram: r.telegram || '',
      whatsapp: r.whatsapp || '',
      website: r.website || '',
      category: r.company_category || '',
    },
  };
}

export async function handle(request, env, url, H) {
  const viewMatch = url.pathname.match(/^\/api\/catalog\/items\/([A-Za-z0-9_-]{1,80})\/view$/);
  if (viewMatch) {
    if (request.method !== 'POST') return H.json({ error: 'method_not_allowed' }, 405);
    const itemId = viewMatch[1];
    // Faqat mavjud va faol biznesning mahsuloti sanaladi.
    let ok = null;
    try {
      ok = await env.DB.prepare(
        `SELECT 1 AS ok FROM company_catalog_items i JOIN companies c ON c.company_id = i.company_id
          WHERE CAST(i.id AS TEXT) = ? AND c.status = 'active'`
      ).bind(itemId).first();
    } catch (error) {
      if (!/no such table/i.test(String(error?.message || error))) throw error;
    }
    if (!ok) return H.json({ error: 'not_found' }, 404);
    // Bir IP'dan soatiga 120 tadan ortig'i jim tashlab yuboriladi —
    // UA almashtirib reytingni sun'iy ko'tarib bo'lmasin.
    if (await H.rateLimitD1(env, `catalog-view:ip:${H.reqIp(request)}`, 120, 3_600_000)) return H.json({ ok: true });
    await ensureItemViews(env);
    const user = await H.getCurrentUser(request, env).catch(() => null);
    // Kirgan foydalanuvchi — `u:<id>` (akkaunt o'chirilganda purge shu
    // bo'yicha tozalaydi); mehmon — IP+UA xeshi, xom IP saqlanmaydi.
    const who = user?.id != null
      ? `u:${user.id}`
      : `v:${await sha256(`${H.reqIp(request)}|${request.headers.get('user-agent') || ''}`)}`;
    const now = new Date();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO company_catalog_item_views (item_id, visitor_key, view_day, created_at) VALUES (?, ?, ?, ?)`
    ).bind(itemId, who, now.toISOString().slice(0, 10), now.toISOString()).run();
    return H.json({ ok: true });
  }
  if (url.pathname !== '/api/catalog/feed') return null;
  if (request.method !== 'GET') {
    return H.json({ error: 'method_not_allowed' }, 405);
  }

  const page = intIn(url.searchParams.get('page'), 1, 1, 10_000);
  const limit = intIn(url.searchParams.get('limit'), 20, 1, MAX_LIMIT);
  const q = String(url.searchParams.get('q') || '').trim().slice(0, 60);
  const rawKind = norm(url.searchParams.get('kind'));
  const kind = LISTING_KINDS.includes(rawKind) ? rawKind : '';
  const rawCat = norm(url.searchParams.get('category'));
  const rawSub = norm(url.searchParams.get('sub'));
  // Eski ilova `category=card` yuborardi — endi bu electronics + sub.
  const legacySub = NFC_TYPES.includes(rawCat) ? rawCat : '';
  const category = MARKET_CATEGORIES.includes(rawCat) ? rawCat : legacySub ? 'electronics' : '';
  const sub = NFC_TYPES.includes(rawSub) ? rawSub : legacySub;
  const rawSort = String(url.searchParams.get('sort') || 'new');
  const sort = SORTS.includes(rawSort) ? rawSort : 'new';

  const where = [
    `c.status = 'active'`,
    // Egasi o'chirilgan kompaniya ko'rinmaydi (worker.js dagi
    // companyOwnerAliveSql bilan bir xil qoida).
    `NOT EXISTS (SELECT 1 FROM users du WHERE CAST(du.id AS TEXT) = CAST(c.owner_user_id AS TEXT) AND du.deleted_at IS NOT NULL)`,
  ];
  const args = [];
  if (q) {
    // NFC ID — biznes qaysi NFC kartadan ochilgan bo'lsa
    // (`source_card_code`); kompaniya sahifasida ham ochiq ko'rinadi.
    where.push(`(i.name LIKE ? ESCAPE '\\' OR i.description LIKE ? ESCAPE '\\'
                 OR i.category LIKE ? ESCAPE '\\'
                 OR c.display_name LIKE ? ESCAPE '\\' OR c.company_id LIKE ? ESCAPE '\\'
                 OR c.source_card_code LIKE ? ESCAPE '\\')`);
    const a = likeArg(q);
    args.push(a, a, a, a, a, a);
  }

  // Kompaniya jadvallari worker'da DANGASA yaratiladi (birinchi
  // `/api/companies` so'rovida). Hali yaratilmagan bo'lsa — katalog
  // shunchaki bo'sh; 503 emas. `i.*` — yangi ustunlar hali qo'shilmagan
  // bazada ham so'rov yiqilmaydi (maydonlar aniqlanadi).
  let res;
  try {
    res = await env.DB.prepare(
    `SELECT i.*, c.company_id AS company_id, c.category AS company_category,
            c.display_name, c.logo_url, c.tier, c.city, c.address,
            c.phone, c.telegram, c.whatsapp, c.website
       FROM company_catalog_items i
       JOIN companies c ON c.company_id = i.company_id
      WHERE ${where.join(' AND ')}
      ORDER BY i.created_at DESC, i.id
      LIMIT ${SCAN_CAP}`
    ).bind(...args).all();
  } catch (error) {
    if (!/no such table/i.test(String(error?.message || error))) throw error;
    res = { results: [] };
  }

  const rows = (res.results || []).map((r) => ({ ...r, listing: listingFields(r, r.company_category) }));

  const counts = { all: rows.length };
  for (const k of [...LISTING_KINDS, ...MARKET_CATEGORIES, ...NFC_TYPES]) counts[k] = 0;
  for (const r of rows) {
    counts[r.listing.kind] += 1;
    counts[r.listing.marketCategory] += 1;
    if (r.listing.sub) counts[r.listing.sub] += 1;
  }

  let list = rows.filter((r) => (!kind || r.listing.kind === kind)
    && (!category || r.listing.marketCategory === category)
    && (!sub || r.listing.sub === sub));

  const avail = (r) => (Number(r.available ?? 1) === 1 ? 0 : 1);
  const dir = sort === 'price_asc' ? 1 : sort === 'price_desc' ? -1 : 0;
  const views = sort === 'popular' ? await recentViews(env, Date.now()) : null;
  const pop = (r) => (views ? views.get(String(r.id)) || 0 : 0);
  // Barqaror: mavjudlari oldin; narx bo'yicha saralashda "Narx
  // kelishiladi" oxirida; qolgan hollarda asl (yangisi oldin) tartib.
  list = list
    .map((r, idx) => ({ r, idx, p: effectivePrice(r.price, r.promotion_price) }))
    .sort((a, b) => avail(a.r) - avail(b.r)
      || (dir && (Number(a.r.listing.priceOnRequest) - Number(b.r.listing.priceOnRequest)))
      || (dir && (a.p - b.p) * dir)
      || (views && pop(b.r) - pop(a.r))
      || a.idx - b.idx)
    .map((x) => x.r);

  const total = list.length;
  const start = (page - 1) * limit;
  const items = list.slice(start, start + limit).map(itemJson);

  return H.json({
    items,
    page,
    limit,
    total,
    hasMore: start + items.length < total,
    counts,
  });
}
