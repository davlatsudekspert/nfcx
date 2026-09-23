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
//   * kompaniya `status = 'active'` (moderatsiyadan o'tgan, to'langan);
//   * kompaniya egasining hisobi O'CHIRILMAGAN;
//   * tovar `available = 1`.
//
// `pending_review` holatidagi bepul bizneslar ATAYLAB ko'rinmaydi:
// moderatsiyadan o'tmagan tovar global katalogga chiqmasin.
//
// ═══ SO'ROV ═══
//
//   GET /api/catalog/feed
//     ?page=1          1 dan boshlab
//     &limit=20        1..50
//     &q=karta         nom, tavsif, kompaniya nomi yoki Business ID bo'yicha
//     &category=card   card | sticker | keychain | accessory | other | (bo'sh = hammasi)
//     &sort=new        new | price_asc | price_desc
//
// ═══ JAVOB ═══
//
//   { items: [{ id, name, description, imageUrl, price, promotionPrice,
//               effectivePrice, category, nfcType, createdAt,
//               company: { companyId, displayName, logoUrl, tier, city } }],
//     page, limit, total, hasMore,
//     counts: { all, card, sticker, keychain, accessory, other } }
//
// `counts` — `q` filtri qo'llangan, lekin `category` qo'llanmagan sonlar:
// filtr chiplarida "Kartalar · 12" ko'rsatish uchun.
//
// ═══ TASNIF ═══
//
// Biznes tovar qo'shganda turini tanlaydi va u `category` ga slug bo'lib
// yoziladi (`card` ...). Eski yozuvlarda `category` erkin matn — ular
// kalit so'z bo'yicha tasniflanadi. Qoida ilovadagi
// `NfcProductType.fromCategory()` (mobile_nova/lib/data/models/models.dart)
// bilan AYNAN bir xil — o'zgarsa ikkalasini birga o'zgartiring.
//
// Tasnif JS'da (SQL'da emas), chunki SQLite `LOWER()` faqat lotin
// harflarini kichraytiradi — "КАРТА" ushlanmasdi. Buning uchun ko'rib
// chiqiladigan qatorlar soni SCAN_CAP bilan cheklangan (eng yangilari).

export const NFC_TYPES = ['card', 'sticker', 'keychain', 'accessory'];

const WORDS = {
  card: ['card', 'karta', 'карта', 'kartochka'],
  sticker: ['sticker', 'stiker', 'стикер', 'наклейка'],
  keychain: ['keychain', 'brelok', 'брелок'],
  accessory: ['accessory', 'aksessuar', 'аксессуар', 'bilaguzuk', 'браслет', 'bracelet'],
};

const SORTS = ['new', 'price_asc', 'price_desc'];
const SCAN_CAP = 2000;
const MAX_LIMIT = 50;

export function nfcTypeOf(category, name = '') {
  const c = String(category || '').trim().toLowerCase();
  if (NFC_TYPES.includes(c) || c === 'other') return c;
  const hay = `${c} ${String(name || '').toLowerCase()}`;
  for (const t of NFC_TYPES) {
    if (WORDS[t].some((w) => hay.includes(w))) return t;
  }
  return 'other';
}

export function effectivePrice(price, promo) {
  const p = Number(price || 0);
  const s = promo == null ? null : Number(promo);
  return s != null && s > 0 && s < p ? s : p;
}

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
  return {
    id: r.id,
    name: r.name || '',
    description: r.description || '',
    imageUrl: r.image_url || '',
    price,
    promotionPrice: promo,
    effectivePrice: effectivePrice(price, promo),
    category: r.category || '',
    nfcType: r.nfcType,
    createdAt: r.created_at,
    company: {
      companyId: r.company_id,
      displayName: r.display_name || '',
      logoUrl: r.logo_url || '',
      tier: r.tier || '',
      city: r.city || '',
    },
  };
}

export async function handle(request, env, url, H) {
  if (url.pathname !== '/api/catalog/feed') return null;
  if (request.method !== 'GET') {
    return H.json({ error: 'method_not_allowed' }, 405);
  }

  const page = intIn(url.searchParams.get('page'), 1, 1, 10_000);
  const limit = intIn(url.searchParams.get('limit'), 20, 1, MAX_LIMIT);
  const q = String(url.searchParams.get('q') || '').trim().slice(0, 60);
  const rawCat = String(url.searchParams.get('category') || '').trim().toLowerCase();
  const category = NFC_TYPES.includes(rawCat) || rawCat === 'other' ? rawCat : '';
  const rawSort = String(url.searchParams.get('sort') || 'new');
  const sort = SORTS.includes(rawSort) ? rawSort : 'new';

  const where = [
    `c.status = 'active'`,
    `i.available = 1`,
    // Egasi o'chirilgan kompaniya ko'rinmaydi (worker.js dagi
    // companyOwnerAliveSql bilan bir xil qoida).
    `NOT EXISTS (SELECT 1 FROM users du WHERE CAST(du.id AS TEXT) = CAST(c.owner_user_id AS TEXT) AND du.deleted_at IS NOT NULL)`,
  ];
  const args = [];
  if (q) {
    where.push(`(i.name LIKE ? ESCAPE '\\' OR i.description LIKE ? ESCAPE '\\'
                 OR c.display_name LIKE ? ESCAPE '\\' OR c.company_id LIKE ? ESCAPE '\\')`);
    const a = likeArg(q);
    args.push(a, a, a, a);
  }

  // Kompaniya jadvallari worker'da DANGASA yaratiladi (birinchi
  // `/api/companies` so'rovida). Hali yaratilmagan bo'lsa — katalog
  // shunchaki bo'sh; 503 emas.
  let res;
  try {
    res = await env.DB.prepare(
    `SELECT i.id, i.name, i.category, i.description, i.price, i.promotion_price,
            i.image_url, i.created_at,
            c.company_id, c.display_name, c.logo_url, c.tier, c.city
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

  const rows = (res.results || []).map((r) => ({ ...r, nfcType: nfcTypeOf(r.category, r.name) }));

  const counts = { all: rows.length, card: 0, sticker: 0, keychain: 0, accessory: 0, other: 0 };
  for (const r of rows) counts[r.nfcType] += 1;

  let list = category ? rows.filter((r) => r.nfcType === category) : rows;
  if (sort !== 'new') {
    const dir = sort === 'price_asc' ? 1 : -1;
    // Barqaror: narx teng bo'lsa — yangisi oldin (asl tartib).
    list = list
      .map((r, idx) => ({ r, idx, p: effectivePrice(r.price, r.promotion_price) }))
      .sort((a, b) => (a.p - b.p) * dir || a.idx - b.idx)
      .map((x) => x.r);
  }

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
