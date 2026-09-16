// Lokal ishlab chiqish uchun DEMO MA'LUMOT.
//
// NIMA UCHUN ALOHIDA FAYL: `scripts/lib/d1-harness.mjs` dagi
// `seedBasic` testlar uchun — u eng kichik holatni beradi (ikki
// foydalanuvchi, uchta karta). Ilovani QO'LDA ochib ko'rish uchun esa
// lenta, istoriya, katalog, buyurtma — hammasi to'la bo'lishi kerak,
// aks holda ekranlar bo'sh chiqadi va "ishlamayapti" bilan
// "ma'lumot yo'q" ni farqlab bo'lmaydi.
//
// BU MA'LUMOT PRODUCTION'GA HECH QACHON TUSHMAYDI: faqat
// `scripts/dev-api-server.mjs` chaqiradi, u esa xotiradagi SQLite
// bilan ishlaydi.
import crypto from 'node:crypto';

/// Parol hashi — `server/auth.js` va `hosting/worker.js` bilan BIR XIL
/// format: `<saltHex>:<hex(scrypt(parol, saltHex, 64))>`. Tuz sifatida
/// hex SATRNING O'ZI ishlatiladi (baytlarga qaytarilmaydi) — ikkala
/// tomon shunday qiladi, shuning uchun bu yerda ham shunday.
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

const iso = (msAgo = 0) => new Date(Date.now() - msAgo).toISOString();
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

export const DEMO = {
  email: 'dilshod@nfcstore.uz',
  password: 'demo1234',
  code: 'VIP001',
};

/// Demo ma'lumotni yozadi. `ensureCoreSchema` allaqachon chaqirilgan
/// bo'lishi kerak (worker runtime jadvallari: stories, sessions, ...).
export async function seedDemo(env) {
  const run = (sql, ...args) => env.DB.prepare(sql).bind(...args).run();
  const pw = hashPassword(DEMO.password);

  // ── Foydalanuvchilar ────────────────────────────────────────────
  await run(
    `INSERT INTO users (id, email, password_hash, phone, is_premium, tos_accepted, promo_code)
     VALUES (1, ?, ?, '+998901234567', 1, 1, 'DILSHOD10')`,
    DEMO.email, pw,
  );
  await run(
    `INSERT INTO users (id, email, password_hash, phone, tos_accepted)
     VALUES (2, 'malika@nfcstore.uz', ?, '+998901112233', 1)`,
    pw,
  );
  await run(
    `INSERT INTO users (id, email, password_hash, phone, tos_accepted)
     VALUES (3, 'latte@nfcstore.uz', ?, '+998907778899', 1)`,
    pw,
  );

  // Uzoq muddatli sessiya — ilovani har safar qayta login qilmaslik
  // uchun. Token ochiq saqlanadi (server SHA-256 bilan solishtiradi,
  // lekin mobil `Bearer` yo'li xom tokenni kutadi).
  await run(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES ('dev-token-dilshod', 1, '2999-01-01T00:00:00.000Z')`,
  );
  // Ikkinchi sessiya — PREMIUM BO'LMAGAN foydalanuvchi. Premium
  // sotib olish oqimini sinash uchun kerak: Dilshod allaqachon
  // premium va u yerda server "ALREADY_PREMIUM" deydi.
  await run(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES ('dev-token-malika', 2, '2999-01-01T00:00:00.000Z')`,
  );

  // ── Kategoriyalar (katalog va qidiruv filtrlari) ────────────────
  //
  // MUHIM: biznes profilning KATALOG MODULI shu `slug` dan kelib
  // chiqadi (`hosting/api/catalog.js: businessModule`):
  //   food*  → menyu,  retail* → mahsulotlar,  qolgani → xizmatlar.
  // Ya'ni kafega 'food-cafe' berilmasa, menyusi bo'sh ko'rinadi.
  const cats = [
    ['food', null, 'Ovqatlanish', 'Питание', 'Food', 1],
    ['food-cafe', 'food', 'Kafe', 'Кафе', 'Cafe', 2],
    ['food-restaurant', 'food', 'Restoran', 'Ресторан', 'Restaurant', 3],
    ['retail', null, 'Savdo', 'Торговля', 'Retail', 4],
    ['retail-clothing', 'retail', 'Kiyim', 'Одежда', 'Clothing', 5],
    ['beauty', null, 'Go‘zallik', 'Красота', 'Beauty', 6],
    ['health', null, 'Tibbiyot', 'Медицина', 'Health', 7],
    ['legal', null, 'Huquq', 'Юриспруденция', 'Legal', 8],
    ['it', null, 'IT', 'IT', 'IT', 9],
    ['design', null, 'Dizayn', 'Дизайн', 'Design', 10],
    ['business', null, 'Biznes', 'Бизнес', 'Business', 11],
    ['other', null, 'Boshqa', 'Другое', 'Other', 12],
  ];
  for (const [slug, parent, uz, ru, en, sort] of cats) {
    await run(
      `INSERT INTO categories (slug, parent_slug, name_uz, name_ru, name_en, sort, enabled) VALUES (?,?,?,?,?,?,1)`,
      slug, parent, uz, ru, en, sort,
    );
  }

  // ── Kartalar (raqamli profillar) ────────────────────────────────
  const card = async (o) => {
    await run(
      `INSERT INTO cards (code, name, role, about, avatar_url, phone, email, tg, instagram, website,
                          hashtags, price, ts, views, user_id, status, profile_type, city,
                          category_slug, theme, is_primary, verified, address, latitude, longitude)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      o.code, o.name, o.role ?? null, o.about ?? null, o.avatar ?? null, o.phone ?? null,
      o.email ?? null, o.tg ?? null, o.instagram ?? null, o.website ?? null,
      JSON.stringify(o.hashtags ?? []), o.price, Math.floor(Date.now() / 1000), o.views ?? 0,
      o.userId, 'approved', o.type ?? 'personal', o.city ?? 'Toshkent',
      o.category ?? null, o.theme ?? 'classic', o.primary ? 1 : 0, o.verified ? 1 : 0,
      o.address ?? null, o.lat ?? null, o.lng ?? null,
    );
  };

  await card({
    code: 'VIP001', name: 'Dilshod Karimov', role: 'Biznes maslahatchi',
    about: 'Kompaniyalarga raqamli transformatsiya bo‘yicha maslahat beraman. 12 yillik tajriba.',
    phone: '+998901234567', email: DEMO.email, tg: 'dilshod', instagram: 'dilshod.k',
    website: 'https://nfcstore.uz/vip001', hashtags: ['biznes', 'maslahat', 'strategiya'],
    price: 490000, views: 12480, userId: 1, primary: true, verified: true, category: 'business',
  });
  await card({
    code: '77777777', name: 'Dilshod K. (zaxira)', role: 'Shaxsiy',
    price: 0, views: 34, userId: 1, category: 'other',
  });
  await card({
    code: 'ABC123', name: 'Malika Yusupova', role: 'Dizayner',
    about: 'Brend identikasi va UI. Toshkent.', phone: '+998901112233',
    instagram: 'malika.design', hashtags: ['dizayn', 'brending'],
    price: 149000, views: 3240, userId: 2, primary: true, category: 'design',
  });
  await card({
    code: 'DDD333', name: 'Latte Coffee', role: 'Kafe · Chilonzor',
    about: 'Har kuni 09:00–23:00. Mualliflik qahva, shirinliklar, jonli musiqa.',
    phone: '+998907778899', tg: 'lattecoffee', instagram: 'latte.coffee.uz',
    hashtags: ['kafe', 'qahva'], price: 199000, views: 8712, userId: 3,
    type: 'business', primary: true, verified: true, category: 'food-cafe',
    address: 'Chilonzor 9-mavze, 24-uy', lat: 41.2756, lng: 69.2039,
  });

  // ── KOMPANIYA (biznes profil) ───────────────────────────────────
  //
  // MUHIM FARQ: `cards.profile_type = 'business'` va `companies`
  // jadvali — IKKI XIL NARSA. Ilovaning biznes ekranlari
  // (`/api/companies/:id`, katalog, postlar, buyurtmalar) aynan
  // `companies` dan o'qiydi. Faqat karta yaratilsa, biznes profil
  // ilovada "topilmadi" bo'lib chiqardi.
  //
  // KOMPANIYA ID'SI FAQAT HARFLARDAN iborat bo'ladi (`companyId()`
  // raqamli qiymatni rad etadi) — shuning uchun bu yerda 'LATTE',
  // 'DDD333' esa uning MANBA KARTASI bo'lib qoladi.
  await run(
    `INSERT INTO companies (company_id, owner_user_id, owner_email, display_name, category, subcategory,
                            city, address, description, phone, telegram, website, logo_url, cover_url,
                            gallery_json, source_card_code, tier, price, status, orders_enabled,
                            created_at, updated_at, approved_at, paid_at, activated_at)
     VALUES ('LATTE', '3', 'latte@nfcstore.uz', 'Latte Coffee', 'food', 'food-cafe',
             'Toshkent', 'Chilonzor 9-mavze, 24-uy',
             'Mualliflik qahva, shirinliklar, jonli musiqa. Har kuni 09:00–23:00.',
             '+998907778899', 'lattecoffee', 'https://nfcstore.uz/ddd333', '/demo/cafe.jpg', '/demo/coffee.jpg',
             ?, 'DDD333', 'premium', 199000, 'active', 1, ?, ?, ?, ?, ?)`,
    JSON.stringify(['/demo/cafe.jpg', '/demo/coffee.jpg', '/demo/dessert.jpg']),
    iso(30 * DAY), iso(2 * DAY), iso(29 * DAY), iso(29 * DAY), iso(29 * DAY),
  );

  const catalogItem = (id, name, price, promo, desc, img, sort) => run(
    `INSERT INTO company_catalog_items (id, company_id, name, category, description, price, promotion_price,
                                        image_url, available, sort_order, created_at, updated_at)
     VALUES (?, 'LATTE', ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    id, name, sort < 2 ? 'Qahva' : 'Shirinliklar', desc, price, promo, img ?? null, sort,
    iso(10 * DAY), iso(DAY),
  );
  await catalogItem('cat-1', 'Kapuchino', 45000, 35000, 'Ikki porsiya espresso, mayin sut ko‘pigi', '/demo/coffee.jpg', 0);
  await catalogItem('cat-2', 'Raf', 52000, null, 'Qaymoqli, vanilli', null, 1);
  await catalogItem('cat-3', 'Chizkeyk', 38000, null, 'Klassik Nyu-York', '/demo/dessert.jpg', 2);
  await catalogItem('cat-4', 'Tiramisu', 42000, null, 'Mascarpone, savoyardi', null, 3);

  await run(
    `INSERT INTO company_posts (id, company_id, image_url, video_url, caption, created_at)
     VALUES (1, 'LATTE', '/demo/cafe.jpg', NULL, ?, ?)`,
    'Yangi mavsum menyusi tayyor. Kelib ko‘ring!', iso(8 * HOUR),
  );

  // ── Obunalar ────────────────────────────────────────────────────
  // `followee_id` — KARTA KODI emas, EGASINING user id'si (sxema shunday:
  // obuna odamga bo'ladi, uning har bir kartasiga alohida emas).
  const follow = (a, b, ago) => run(
    `INSERT INTO follows (follower_id, followee_id, paid, amount, created_at) VALUES (?, ?, 0, 0, ?)`, a, b, iso(ago),
  );
  await follow(1, 2, 3 * DAY);
  await follow(1, 3, 2 * DAY);
  await follow(2, 1, 5 * DAY);
  await follow(3, 1, 6 * DAY);

  // ── Postlar (lenta) ─────────────────────────────────────────────
  const post = (id, code, userId, caption, ago, image, video) => run(
    `INSERT INTO posts (id, code, user_id, image_url, video_url, caption, created_at) VALUES (?,?,?,?,?,?,?)`,
    id, code, userId, image ?? null, video ?? null, caption, iso(ago),
  );
  await post(1, 'ABC123', 2, 'Brend identikasi ustida ishlayapmiz. Tez orada natija.', 2 * HOUR, '/demo/office.jpg');
  await post(2, 'DDD333', 3, 'Aksiya: kapuchino 45 000 → 35 000 so‘m, shanba-yakshanba.', 5 * HOUR, '/demo/coffee.jpg');
  await post(3, 'VIP001', 1, 'Yangi loyiha boshlandi. Jamoaga qo‘shilganlar bilan tanishing.', 26 * HOUR, '/demo/city.jpg');
  await post(4, 'DDD333', 3, 'Kechqurun jonli musiqa. Shanba 20:00. Stol band qiling.', 30 * HOUR, null, '/demo/live.mp4');
  await run(`INSERT INTO post_likes (post_id, user_id, created_at) VALUES (1, 1, ?)`, iso(HOUR));
  await run(`INSERT INTO post_likes (post_id, user_id, created_at) VALUES (2, 1, ?)`, iso(HOUR));
  await run(`INSERT INTO post_likes (post_id, user_id, created_at) VALUES (1, 3, ?)`, iso(HOUR));

  // ── Istoriyalar (24 soat) ───────────────────────────────────────
  const story = (id, code, userId, caption, ago, image, video) => run(
    `INSERT INTO stories (id, owner_kind, owner_id, user_id, image_url, video_url, caption, created_at, expires_at)
     VALUES (?, 'card', ?, ?, ?, ?, ?, ?, ?)`,
    id, code, userId, image ?? null, video ?? null, caption, iso(ago), iso(ago - DAY),
  );
  await story(1, 'ABC123', 2, 'Studiyada', 3 * HOUR, '/demo/dessert.jpg');
  await story(2, 'DDD333', 3, 'Yangi mavsum menyusi', 6 * HOUR, '/demo/cafe.jpg');
  await story(3, 'VIP001', 1, 'Konferensiya', 8 * HOUR, '/demo/event.jpg');

  // ── Biznes profil: katalog, ish vaqti ───────────────────────────
  await run(
    `INSERT INTO menu_categories (id, code, name, sort, enabled, created_at) VALUES (1, 'DDD333', 'Qahva', 0, 1, ?)`, iso(10 * DAY),
  );
  await run(
    `INSERT INTO menu_categories (id, code, name, sort, enabled, created_at) VALUES (2, 'DDD333', 'Shirinliklar', 1, 1, ?)`, iso(10 * DAY),
  );
  const item = (id, cat, name, price, desc, img) => run(
    `INSERT INTO menu_items (id, code, category_id, name, description, price, image_url, sort, available, created_at)
     VALUES (?, 'DDD333', ?, ?, ?, ?, ?, ?, 1, ?)`,
    id, cat, name, desc, price, img ?? null, id, iso(10 * DAY),
  );
  await item(1, 1, 'Kapuchino', 45000, 'Ikki porsiya espresso, mayin sut ko‘pigi', '/demo/coffee.jpg');
  await item(2, 1, 'Raf', 52000, 'Qaymoqli, vanilli', null);
  await item(3, 2, 'Chizkeyk', 38000, 'Klassik Nyu-York', '/demo/dessert.jpg');
  await item(4, 2, 'Tiramisu', 42000, 'Mascarpone, savoyardi', null);

  // ── Jismoniy NFC kartalar (teg → profil) ─────────────────────
  await run(
    `INSERT INTO physical_cards (id, chip_token, linked_code, owner_user_id, active, status, created_at)
     VALUES (1, 'demo-chip-vip001', 'VIP001', 1, 1, 'delivered', ?)`, iso(20 * DAY),
  );

  // ── Tegishlar tarixi (statistika grafigi uchun) ─────────────────
  for (let d = 0; d < 7; d++) {
    const n = [9, 14, 11, 18, 22, 17, 24][d];
    for (let i = 0; i < n; i++) {
      await run(
        `INSERT INTO card_events (code, event_type, visitor_hash, created_at) VALUES ('VIP001', ?, ?, ?)`,
        i % 4 === 0 ? 'tap' : 'view', `demo-${d}-${i}`, iso((6 - d) * DAY - i * 90000),
      );
    }
  }

  // ── Buyurtma (jismoniy karta) ───────────────────────────────────
  await run(
    `INSERT INTO web_orders (id, user_id, code, kind, price, payload, status, created_at)
     VALUES (1, 1, 'VIP001', 'physical_card', 200000, ?, 'paid', ?)`,
    JSON.stringify({ design: 'matte_black', name: 'Dilshod Karimov', phone: '+998901234567', city: 'Toshkent' }),
    iso(9 * DAY),
  );

  return DEMO;
}
