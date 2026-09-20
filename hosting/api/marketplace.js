// ═══════════════════════════════════════════════════════════════════════
// MARKETPLACE — UNIVERSAL NFC AKTIVATSIYA
//
// MAQSAD. NFCSTORE fizik mahsulotlari (NFC karta, stiker, avtomobil
// stikeri, stol NFC) Uzum Market va boshqa marketplace'larda sotiladi.
// Xaridor konvertdagi QR'ni skanerlaydi, aktivatsiya kodini kiritadi va
// SHAXSIY yoki BIZNES profilni O'ZI tanlaydi.
//
// ENG MUHIM ARXITEKTURA QARORI — PARALLEL TIZIM YO'Q.
//
// Bu modul YANGI NFCSTORE yaratmaydi. Unda YO'Q:
//   • marketplace foydalanuvchisi        — oddiy `users` qatori;
//   • marketplace profili                — oddiy `cards` / `companies`;
//   • marketplace tarifi va limitlari    — mavjud tier/plan dvigateli;
//   • YANGI NFC ID GENERATORI            — `auth.js: createFreeAutoId`.
//
// Marketplace faqat SOTUV + AKTIVATSIYA KANALI. Aktivatsiyadan keyin
// odam oddiy NFCSTORE foydalanuvchisi bo'ladi va kelajakda tariflar
// o'zgarsa, bu yerda hech narsa o'zgartirilmaydi.
//
// TARIF. `marketplace_products.included_tier`:
//   'auto'  -> `cards.tier_override` ga HECH NARSA yozilmaydi, ya'ni ID
//              aynan ro'yxatdan o'tishdagi bepul ID kabi ishlaydi va
//              darajani mavjud `personalIdTierD1` kod shaklidan
//              hisoblaydi;
//   boshqa  -> sovg'a oqimi ishlatadigan AYNAN o'sha `tier_override`
//              ustuni yoziladi. Yangi limit tizimi yaratilmadi.
// ═══════════════════════════════════════════════════════════════════════

import { createFreeAutoId } from './auth.js';

// ── AKTIVATSIYA KODI ─────────────────────────────────────────────────
//
// Shakl: NF-XXXX-XXXX. Alifboda chalkashadigan belgilar (I, O, 0, 1)
// YO'Q — kod konvertga chop etiladi va odam uni qo'lda ko'chiradi.
// 32^8 ≈ 1.1×10^12 variant.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN = 8;

export function generateActivationCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LEN));
  let s = '';
  // Rad etish (rejection) YO'Q: 256 % 32 === 0, ya'ni `b % 32`
  // taqsimoti bir tekis. (Alifbo uzunligi o'zgarsa bu shart buziladi —
  // quyidagi tekshiruv shuni eslatib turadi.)
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return `NF-${s.slice(0, 4)}-${s.slice(4)}`;
}

// KOD NORMALIZATSIYASI — ANIQ QOIDA.
//
// Odam kodni turlicha kiritadi: kichik harfda, chiziqchasiz, bo'shliq
// bilan, oldidan/orqasidan bo'sh joy bilan. Barchasi BIR XIL kodga
// olib kelishi shart, aks holda to'g'ri kod "noto'g'ri" deb rad
// etilardi. Shuning uchun: katta harfga o'tkazamiz, alifboda
// bo'lmagan HAMMA belgini olib tashlaymiz va faqat 8 belgi qolsa
// qabul qilamiz.
export function normalizeActivationCode(raw) {
  const up = String(raw || '').toUpperCase();
  let out = '';
  for (const ch of up) if (ALPHABET.includes(ch)) out += ch;
  // `NF` PREFIKSI ALIFBONING O'ZIDA. Ya'ni belgilarni tozalagach
  // "NF" ham qolib ketadi va kod 10 belgi bo'ladi. Buni hisobga
  // olmaslik jimgina xato berardi: TO'G'RI kod "noto'g'ri" deb rad
  // etilardi (test aynan shuni tutdi).
  //
  // Qoida aniq: 10 belgi bo'lib "NF" bilan boshlansa — prefiks
  // tashlanadi. Kodning O'ZI "NF" bilan boshlansa ham to'g'ri
  // ishlaydi: "NF-NFXX-YYYY" -> "NFNFXXYYYY" -> "NFXXYYYY".
  if (out.length === CODE_LEN + 2 && out.startsWith('NF')) out = out.slice(2);
  return out.length === CODE_LEN ? out : '';
}

export function formatActivationCode(normalized) {
  const n = String(normalized || '');
  return n.length === CODE_LEN ? `NF-${n.slice(0, 4)}-${n.slice(4)}` : '';
}

export function codeTail(normalized) {
  return String(normalized || '').slice(-4);
}

// KOD BAZADA OCHIQ SAQLANMAYDI — faqat xesh va oxirgi 4 belgi.
//
// Baza sizib chiqsa, ochiq kodlar bilan mahsulotlarni begona odam
// faollashtirib yuborardi. Xesh bilan buning uchun 32^8 variantni
// qayta hisoblash kerak.
//
// Prefiks (`nfcstore-activation:`) — bu xeshlarni boshqa har qanday
// SHA-256 jadvalidan ajratib turadi. U sir emas va sir bo'lishi ham
// shart emas: brute-force'ga qarshi asosiy himoya — kodning uzunligi,
// bir martalik ishlashi va `isRateLimited` dagi tezlik chegarasi.
export async function activationCodeHash(H, normalized) {
  return H.sha256Hex(`nfcstore-activation:${normalized}`);
}

const STATUSES = ['new', 'exported', 'sold', 'activating', 'activated', 'blocked', 'expired'];
// Faollashtirish MUMKIN bo'lgan holatlar. `activating` YO'Q — u
// boshqa so'rov tomonidan band qilingan degani.
const ACTIVATABLE = ['new', 'exported', 'sold'];

const PHYSICAL_TYPES = ['nfc_card', 'nfc_sticker', 'car_sticker', 'table_nfc', 'premium_card', 'custom'];
const MARKETPLACES = ['uzum', 'wildberries', 'ozon', 'other'];

// Yarim qolgan bandlik shuncha vaqtdan keyin bekor qilinadi. Worker
// aktivatsiya o'rtasida to'xtab qolsa (crash/timeout), kod abadiy
// `activating` holatida qolib ketmasin.
const RESERVE_TTL_MS = 5 * 60 * 1000;

// Jadvallar BIR MARTA tayyorlanadi.
//
// Ilgari bu funksiya har so'rovda to'liq ishlardi: `CREATE TABLE IF
// NOT EXISTS` lar ham, `ALTER TABLE` urinishi ham. Ular zararsiz,
// lekin har aktivatsiyaga bir nechta ortiqcha D1 borish-kelishi
// qo'shilardi. Naqsh worker.js dagi `coreSchemaReady` bilan bir xil:
// yiqilsa qayta urinish uchun tozalanadi.
let tablesReady = null;
export function resetMarketplaceTablesCache() { tablesReady = null; }

export async function ensureMarketplaceTables(env) {
  if (tablesReady) return tablesReady;
  tablesReady = prepareMarketplaceTables(env).catch((err) => { tablesReady = null; throw err; });
  return tablesReady;
}

async function prepareMarketplaceTables(env) {
  await env.DB.batch([
    // `external_sku` — MARKETPLACE'NING O'Z SKU SI (Uzum offer id va
    // h.k.). Bizning `sku` ichki nom; marketplace o'z raqamini beradi
    // va buyurtma fayllari AYNAN o'shani olib keladi. Ikkalasi bitta
    // qatorda turgani uchun mos kelmaslikni darhol tutib olish mumkin.
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS marketplace_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      marketplace TEXT NOT NULL DEFAULT 'uzum',
      physical_type TEXT NOT NULL DEFAULT 'nfc_card',
      included_tier TEXT NOT NULL DEFAULT 'auto',
      external_sku TEXT,
      price INTEGER,
      description TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS marketplace_activations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code_hash TEXT NOT NULL UNIQUE,
      code_tail TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      physical_device_id INTEGER,
      marketplace_order_id TEXT,
      customer_reference TEXT,
      batch_id TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      reserved_by_user_id INTEGER,
      reserved_at TEXT,
      activated_by_user_id INTEGER,
      activated_profile_kind TEXT,
      activated_profile_code TEXT,
      created_at TEXT NOT NULL,
      sold_at TEXT,
      activated_at TEXT,
      expires_at TEXT
    )`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_mkt_act_status ON marketplace_activations(status)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_mkt_act_product ON marketplace_activations(product_id)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_mkt_act_tail ON marketplace_activations(code_tail)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_mkt_act_batch ON marketplace_activations(batch_id)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_mkt_act_order ON marketplace_activations(marketplace_order_id)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_mkt_act_user ON marketplace_activations(activated_by_user_id)`),
  ]);
  // FIZIK QURILMA BIZNES PROFILGA HAM BOG'LANA OLSIN.
  //
  // `physical_cards.linked_code` — `cards.code` ga FOREIGN KEY, ya'ni
  // u yerga kompaniya ID sini yozib bo'lmaydi (va bo'sh satr yozish
  // ham FK ni buzadi — test aynan shuni tutdi). Shuning uchun MAVJUD
  // jadvalga bitta ixtiyoriy ustun qo'shiladi; parallel "marketplace
  // device" jadvali YARATILMADI.
  await env.DB.prepare(`ALTER TABLE physical_cards ADD COLUMN linked_company_id TEXT`).run()
    .catch(() => { /* ustun allaqachon bor */ });
  // Oldin yaratilgan jadvalga ustun qo'shish (CREATE TABLE IF NOT
  // EXISTS mavjud jadvalni O'ZGARTIRMAYDI).
  await env.DB.prepare(`ALTER TABLE marketplace_products ADD COLUMN external_sku TEXT`).run()
    .catch(() => { /* ustun allaqachon bor */ });
}

function productOut(r) {
  return {
    id: Number(r.id), name: r.name, sku: r.sku, marketplace: r.marketplace,
    physicalType: r.physical_type, includedTier: r.included_tier,
    externalSku: r.external_sku || '',
    price: r.price == null ? null : Number(r.price),
    description: r.description || '', active: !!r.active, createdAt: r.created_at,
  };
}

// Admin jadvalida TO'LIQ kod ham, to'liq chip token ham ko'rinmaydi —
// faqat oxirgi belgilar. To'liq kod faqat yaratish/eksport/chop etish
// paytida bir marta beriladi.
function activationOut(r) {
  return {
    id: Number(r.id),
    codeTail: r.code_tail,
    codeMasked: `****-${r.code_tail}`,
    productId: Number(r.product_id),
    productName: r.product_name || '',
    sku: r.sku || '',
    marketplace: r.marketplace || '',
    physicalType: r.physical_type || '',
    deviceId: r.physical_device_id == null ? null : Number(r.physical_device_id),
    deviceTokenTail: r.chip_token ? String(r.chip_token).slice(-4).toUpperCase() : '',
    marketplaceOrderId: r.marketplace_order_id || '',
    customerReference: r.customer_reference || '',
    batchId: r.batch_id || '',
    status: r.status,
    activatedByUserId: r.activated_by_user_id == null ? null : Number(r.activated_by_user_id),
    activatedByEmail: r.activated_by_email || '',
    profileKind: r.activated_profile_kind || '',
    profileCode: r.activated_profile_code || '',
    createdAt: r.created_at, soldAt: r.sold_at, activatedAt: r.activated_at, expiresAt: r.expires_at,
  };
}

const ACTIVATION_SELECT = `
  SELECT a.*, p.name AS product_name, p.sku, p.marketplace, p.physical_type,
         pc.chip_token, u.email AS activated_by_email
    FROM marketplace_activations a
    LEFT JOIN marketplace_products p ON p.id = a.product_id
    LEFT JOIN physical_cards pc ON pc.id = a.physical_device_id
    LEFT JOIN users u ON u.id = a.activated_by_user_id`;

function isExpired(row, H) {
  if (!row?.expires_at) return false;
  const t = H.parseDbDate(row.expires_at);
  return t instanceof Date && !Number.isNaN(t.getTime()) && t.getTime() < Date.now();
}

// Holat -> odamga aytiladigan sabab. Qaysi kod mavjudligini OCHIB
// BERMAYDI: mavjud bo'lmagan kod ham, boshqa odam faollashtirgan kod
// ham bir xil emas — lekin ikkalasi ham foydalanuvchi uchun aniq
// xabar beradi va enumeratsiya uchun foyda bermaydi (kod topish uchun
// baribir 32^8 urinish kerak).
function statusError(status) {
  if (status === 'activated') return 'already_activated';
  if (status === 'blocked') return 'code_blocked';
  if (status === 'expired') return 'code_expired';
  if (status === 'activating') return 'activation_in_progress';
  return 'bad_code';
}

async function loadByCode(env, H, rawCode) {
  const normalized = normalizeActivationCode(rawCode);
  if (!normalized) return { normalized: '', row: null };
  const hash = await activationCodeHash(H, normalized);
  const row = await env.DB.prepare(`${ACTIVATION_SELECT} WHERE a.code_hash = ?`).bind(hash).first();
  return { normalized, row: row || null };
}

// ── TEZLIK CHEGARASI ─────────────────────────────────────────────────
// Kod topish uchun 32^8 urinish kerak, lekin chegara bo'lmasa bot
// soatiga millionlab urinish qilardi. Mavjud `H.rateLimitD1` ishlatiladi
// — yangi mexanizm yozilmadi.
// `check` — kirish TALAB QILINMAYDI, ya'ni bu brute-force uchun eng
// ochiq eshik: chegara qattiq (10 daqiqada 20 urinish).
// `activate` — kirish SHART va kod baribir to'g'ri bo'lishi kerak, shu
// sababli chegara yumshoqroq (60). Bitta uydan bir necha odam bir
// nechta mahsulotni faollashtirishi mumkin (do'kon, oila, ofis) va
// chegara ularni to'sib qo'ymasligi kerak.
const RATE_LIMITS = { check: 20, activate: 60 };
// DIQQAT — QAYTISH QIYMATI TESKARI O'QILADI.
// `H.rateLimitD1` chegara OSHGANDA `true` qaytaradi ("bloklangan"),
// ruxsat berilganda `false`. Nomi "ruxsatmi?" degan taassurot beradi
// va shu sababli bu yerda bir marta teskari yozilgan edi: natijada
// BIRINCHI so'rovdan boshlab hamma narsa 429 bo'lardi va aktivatsiya
// umuman ishlamasdi (test aynan shuni tutdi). Nom ham shuning uchun
// aniq: "bloklanganmi".
async function isRateLimited(env, H, request, suffix) {
  const ip = H.reqIp(request) || 'unknown';
  return H.rateLimitD1(env, `mkt:${suffix}:${ip}`, RATE_LIMITS[suffix] || 20, 10 * 60 * 1000);
}

// ═════════════════════════════════════════════════════════════════════
// KELAJAKDAGI MARKETPLACE API SI QAYERGA ULANADI
//
// Uzum'ning Seller API si hozir BIZDA YO'Q va u ishga tushirishga
// TO'SIQ EMAS: buyurtmalar qo'lda va CSV orqali bog'lanadi.
//
// API (yoki webhook) berilganda UNING UCHUN ALOHIDA AKTIVATSIYA
// TIZIMI YOZILMAYDI. U shu modulga ADAPTER bo'lib ulanadi va bor-yo'g'i
// bitta ishni bajaradi: marketplace javobini quyidagi shaklga
// aylantiradi —
//
//   { code | sku, marketplaceOrderId, customerReference?, soldAt? }
//
// va `POST /api/admin/marketplace/orders/import` ga (yoki uning
// ichidagi o'sha halqaga) beradi. Undan keyingi hamma narsa —
// SKU mosligi, holat o'zgarishi, audit — O'ZGARMAYDI.
//
// Shuning uchun import ataylab FAYL emas, QATORLAR qabul qiladi:
// qatorlar CSV dan ham, API javobidan ham bir xil keladi.
// ═════════════════════════════════════════════════════════════════════

export async function handle(request, env, url, H) {
  const path = url.pathname;
  const method = request.method;
  if (!path.startsWith('/api/activate') && !path.startsWith('/api/admin/marketplace')) return null;

  await ensureMarketplaceTables(env);
  const readJson = async () => (await request.json().catch(() => ({}))) || {};

  // ═════════════════════════════════════════════════════════════════
  // OMMAVIY: AKTIVATSIYA
  // ═════════════════════════════════════════════════════════════════

  // Kodni TEKSHIRISH — hech narsa o'zgartirmaydi. Sahifa shu javob
  // bilan mahsulot nomini ko'rsatadi va foydalanuvchini kirishga
  // yo'naltiradi.
  //
  // POST, GET emas: kod URL'da (brauzer tarixi, server loglari,
  // analitika, Referer sarlavhasi) qolmasligi kerak.
  if (path === '/api/activate/check' && method === 'POST') {
    if (await isRateLimited(env, H, request, 'check')) return H.json({ error: 'rate_limited' }, 429);
    const body = await readJson();
    const { normalized, row } = await loadByCode(env, H, body.code);
    if (!normalized) return H.json({ error: 'bad_code' }, 422);
    if (!row) return H.json({ error: 'bad_code' }, 404);
    if (isExpired(row, H)) return H.json({ error: 'code_expired' }, 409);
    if (!ACTIVATABLE.includes(row.status)) {
      // Allaqachon SHU odam faollashtirgan bo'lsa — bu xato emas,
      // natijani ko'rsatamiz (idempotentlik, 16-band).
      const user = await H.getCurrentUser(request, env);
      if (row.status === 'activated' && user && String(row.activated_by_user_id) === String(user.id)) {
        return H.json({ ok: true, alreadyActivated: true, result: activationResult(row) });
      }
      return H.json({ error: statusError(row.status) }, 409);
    }
    return H.json({
      ok: true,
      product: { name: row.product_name || '', sku: row.sku || '', physicalType: row.physical_type || '', marketplace: row.marketplace || '' },
    });
  }

  // Foydalanuvchining tanlash uchun mavjud profillari. Faqat O'ZINIKI.
  if (path === '/api/activate/options' && method === 'GET') {
    const user = await H.getCurrentUser(request, env);
    if (!user) return H.json({ error: 'unauthorized' }, 401);
    const [cards, companies] = await Promise.all([
      env.DB.prepare(`SELECT code, name, is_primary FROM cards WHERE user_id = ? ORDER BY is_primary DESC, ts DESC LIMIT 50`).bind(user.id).all(),
      env.DB.prepare(`SELECT company_id, display_name, status FROM companies WHERE owner_user_id = ? ORDER BY created_at DESC LIMIT 50`).bind(String(user.id)).all(),
    ]);
    return H.json({
      personal: (cards.results || []).map((r) => ({ code: r.code, name: r.name || '', isPrimary: !!r.is_primary })),
      business: (companies.results || []).map((r) => ({ companyId: r.company_id, displayName: r.display_name || '', status: r.status })),
    });
  }

  if (path === '/api/activate' && method === 'POST') {
    return activateHandler(request, env, H, await readJson());
  }

  // ═════════════════════════════════════════════════════════════════
  // ADMIN
  // ═════════════════════════════════════════════════════════════════
  if (path.startsWith('/api/admin/marketplace')) {
    const admin = await H.requireAdmin(request, env);
    if (!admin) return H.json({ error: 'unauthorized' }, 401);
    const ip = H.reqIp(request);

    // ── MAHSULOTLAR ───────────────────────────────────────────────
    if (path === '/api/admin/marketplace/products' && method === 'GET') {
      const rows = await env.DB.prepare(`SELECT * FROM marketplace_products ORDER BY created_at DESC`).all();
      return H.json({ products: (rows.results || []).map(productOut) });
    }
    if (path === '/api/admin/marketplace/products' && method === 'POST') {
      const body = await readJson();
      const name = H.shortText(body.name, 120);
      const sku = H.shortText(body.sku, 60).toUpperCase().replace(/[^A-Z0-9-]/g, '');
      if (!name || !sku) return H.json({ error: 'required_fields' }, 422);
      const marketplace = MARKETPLACES.includes(body.marketplace) ? body.marketplace : 'uzum';
      const physicalType = PHYSICAL_TYPES.includes(body.physicalType) ? body.physicalType : 'nfc_card';
      // 'auto' — mavjud bepul ID bilan AYNAN bir xil. Boshqa qiymat
      // sovg'a oqimi ishlatadigan `tier_override` ustuniga yoziladi.
      const includedTier = ['auto', 'free', 'standard', 'premium', 'exclusive'].includes(body.includedTier) ? body.includedTier : 'auto';
      // Marketplace'ning O'Z SKU si — ixtiyoriy. Uzum'da raqam,
      // boshqalarda harf-raqam bo'lishi mumkin, shuning uchun
      // shakl TALAB QILINMAYDI, faqat uzunligi cheklanadi.
      const externalSku = H.shortText(body.externalSku, 80).toUpperCase();
      const price = body.price == null || body.price === '' ? null : Math.max(0, Math.round(Number(body.price)) || 0);
      try {
        const row = await env.DB.prepare(
          `INSERT INTO marketplace_products (name, sku, marketplace, physical_type, included_tier, external_sku, price, description, active, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING *`
        ).bind(name, sku, marketplace, physicalType, includedTier, externalSku || null, price, H.shortText(body.description, 600), body.active === false ? 0 : 1, H.nowTs()).first();
        await H.logAdminActivity(env, { action: 'marketplace_product_created', details: `${sku} — ${name}`, ip });
        return H.json({ product: productOut(row) }, 201);
      } catch (err) {
        if (/UNIQUE/i.test(String(err?.message || err))) return H.json({ error: 'sku_taken' }, 409);
        throw err;
      }
    }
    const prodMatch = path.match(/^\/api\/admin\/marketplace\/products\/(\d+)$/);
    if (prodMatch && (method === 'PATCH' || method === 'PUT')) {
      const body = await readJson();
      const id = Number(prodMatch[1]);
      const active = body.active === true ? 1 : body.active === false ? 0 : null;
      // `externalSku` mahsulot YARATILGANDA hali noma'lum bo'ladi —
      // u marketplace'da e'lon joylangandan keyin beriladi. Shuning
      // uchun keyin ham qo'yish mumkin. Bo'sh satr — tozalash.
      const hasSku = typeof body.externalSku === 'string';
      const externalSku = hasSku ? H.shortText(body.externalSku, 80).toUpperCase() : null;
      if (active == null && !hasSku) return H.json({ error: 'nothing_to_update' }, 422);
      const row = await env.DB.prepare(
        `UPDATE marketplace_products
            SET active = COALESCE(?, active),
                external_sku = CASE WHEN ? THEN ? ELSE external_sku END
          WHERE id = ? RETURNING *`
      ).bind(active, hasSku ? 1 : 0, externalSku || null, id).first();
      if (!row) return H.json({ error: 'not_found' }, 404);
      await H.logAdminActivity(env, {
        action: 'marketplace_product_updated',
        details: `${row.sku}${active == null ? '' : ` active=${active}`}${hasSku ? ` external=${externalSku || '—'}` : ''}`,
        ip,
      });
      return H.json({ product: productOut(row) });
    }

    // ── BATCH: KODLAR YARATISH ────────────────────────────────────
    // TO'LIQ kodlar FAQAT shu javobda bir marta qaytadi (chop etish va
    // eksport uchun). Bazada faqat xesh qoladi.
    if (path === '/api/admin/marketplace/batch' && method === 'POST') {
      const body = await readJson();
      const productId = Number(body.productId) || 0;
      const quantity = Math.min(Math.max(Math.round(Number(body.quantity)) || 0, 1), 1000);
      const product = await env.DB.prepare(`SELECT * FROM marketplace_products WHERE id = ?`).bind(productId).first();
      if (!product) return H.json({ error: 'product_not_found' }, 404);
      const expiresAt = body.expiresAt ? H.shortText(body.expiresAt, 40) : null;
      const batchId = `B${Date.now().toString(36).toUpperCase()}${H.newToken(2).toUpperCase().slice(0, 4)}`;
      const now = H.nowTs();

      const created = [];
      // Takrorlanish EHTIMOLI yo'q emas, shuning uchun har kod uchun
      // `ON CONFLICT DO NOTHING` va qayta urinish. Natijada
      // "duplicate = 0" kafolatini tasodifga emas, BAZAGA qoldiramiz.
      for (let i = 0; i < quantity; i++) {
        let ok = false;
        for (let attempt = 0; attempt < 6 && !ok; attempt++) {
          const plain = generateActivationCode();
          const normalized = normalizeActivationCode(plain);
          const hash = await activationCodeHash(H, normalized);
          const row = await env.DB.prepare(
            `INSERT INTO marketplace_activations (code_hash, code_tail, product_id, batch_id, status, created_at, expires_at)
             VALUES (?,?,?,?, 'new', ?, ?) ON CONFLICT(code_hash) DO NOTHING RETURNING id`
          ).bind(hash, codeTail(normalized), productId, batchId, now, expiresAt).first().catch(() => null);
          if (row?.id) { created.push({ id: Number(row.id), code: formatActivationCode(normalized) }); ok = true; }
        }
        if (!ok) return H.json({ error: 'generation_failed', created: created.length }, 500);
      }
      await H.logAdminActivity(env, { action: 'marketplace_codes_created', details: `${product.sku} × ${created.length}`, newValue: batchId, ip });
      return H.json({ batchId, product: productOut(product), codes: created }, 201);
    }

    // ── RO'YXAT: QIDIRUV VA FILTR ─────────────────────────────────
    if (path === '/api/admin/marketplace/activations' && method === 'GET') {
      const q = url.searchParams;
      const where = [];
      const bind = [];
      const status = q.get('status') || '';
      if (STATUSES.includes(status)) { where.push('a.status = ?'); bind.push(status); }
      const marketplace = q.get('marketplace') || '';
      if (MARKETPLACES.includes(marketplace)) { where.push('p.marketplace = ?'); bind.push(marketplace); }
      const productId = Number(q.get('productId')) || 0;
      if (productId) { where.push('a.product_id = ?'); bind.push(productId); }
      const kind = q.get('profileKind') || '';
      if (kind === 'personal' || kind === 'business') { where.push('a.activated_profile_kind = ?'); bind.push(kind); }
      const batchId = H.shortText(q.get('batchId'), 40);
      if (batchId) { where.push('a.batch_id = ?'); bind.push(batchId); }
      const from = H.shortText(q.get('from'), 40);
      if (from) { where.push('a.created_at >= ?'); bind.push(from); }
      const to = H.shortText(q.get('to'), 40);
      if (to) { where.push('a.created_at <= ?'); bind.push(to); }

      // QIDIRUV. Aktivatsiya kodi bo'yicha qidirishda TO'LIQ kod
      // berilsa xesh bo'yicha aniq topiladi; qisqa matn berilsa
      // faqat OXIRGI 4 belgi bo'yicha — to'liq kod bazada yo'q.
      const search = H.shortText(q.get('search'), 60);
      if (search) {
        const normalized = normalizeActivationCode(search);
        if (normalized) {
          where.push('a.code_hash = ?');
          bind.push(await activationCodeHash(H, normalized));
        } else {
          const like = `%${search.toUpperCase()}%`;
          where.push(`(UPPER(a.code_tail) LIKE ? OR UPPER(p.sku) LIKE ? OR UPPER(COALESCE(a.marketplace_order_id,'')) LIKE ? OR UPPER(COALESCE(a.activated_profile_code,'')) LIKE ?)`);
          bind.push(like, like, like, like);
        }
      }
      const limit = Math.min(Math.max(Number(q.get('limit')) || 100, 1), 500);
      const sql = `${ACTIVATION_SELECT}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY a.created_at DESC, a.id DESC LIMIT ?`;
      const rows = await env.DB.prepare(sql).bind(...bind, limit).all();
      return H.json({ activations: (rows.results || []).map(activationOut) });
    }

    // ── STATISTIKA ────────────────────────────────────────────────
    if (path === '/api/admin/marketplace/stats' && method === 'GET') {
      const [byStatus, byMarketplace, byProduct, byKind] = await Promise.all([
        env.DB.prepare(`SELECT status, COUNT(*) AS n FROM marketplace_activations GROUP BY status`).all(),
        env.DB.prepare(`SELECT p.marketplace AS k, COUNT(*) AS n FROM marketplace_activations a LEFT JOIN marketplace_products p ON p.id = a.product_id GROUP BY p.marketplace`).all(),
        env.DB.prepare(`SELECT p.sku AS k, p.name AS name, COUNT(*) AS n,
            SUM(CASE WHEN a.status = 'activated' THEN 1 ELSE 0 END) AS activated
          FROM marketplace_activations a LEFT JOIN marketplace_products p ON p.id = a.product_id GROUP BY p.sku, p.name`).all(),
        env.DB.prepare(`SELECT activated_profile_kind AS k, COUNT(*) AS n FROM marketplace_activations WHERE status = 'activated' GROUP BY activated_profile_kind`).all(),
      ]);
      const counts = {};
      for (const s of STATUSES) counts[s] = 0;
      let total = 0;
      for (const r of byStatus.results || []) { counts[r.status] = Number(r.n); total += Number(r.n); }
      const kinds = { personal: 0, business: 0 };
      for (const r of byKind.results || []) if (r.k === 'personal' || r.k === 'business') kinds[r.k] = Number(r.n);
      return H.json({
        total, counts, profileKinds: kinds,
        byMarketplace: (byMarketplace.results || []).map((r) => ({ marketplace: r.k || 'other', count: Number(r.n) })),
        byProduct: (byProduct.results || []).map((r) => ({ sku: r.k || '', name: r.name || '', count: Number(r.n), activated: Number(r.activated || 0) })),
      });
    }

    // ── MARKETPLACE BUYURTMALARINI CSV DAN BOG'LASH ───────────────
    //
    // Uzum'ning API si hali yo'q, shuning uchun bog'lanish QO'LDA
    // boshlanadi: omborchi qaysi kodni qaysi buyurtmaga solganini
    // yozib boradi va o'sha ro'yxat shu yerga keladi.
    //
    // Kod XESH bo'yicha topiladi — bazada ochiq kod yo'q. Ya'ni
    // import uchun TO'LIQ kod kerak (batch yaratilganda beriladigan
    // CSV da bor).
    //
    // Fayl EMAS, tayyor qatorlar keladi: CSV ni brauzer o'qiydi va
    // shu yerga yuboradi. Sabab — fayl yuklash uchun alohida yo'l
    // ochish kerak bo'lardi va u xatolarni yashirardi; qatorlar
    // bilan har satr uchun ANIQ natija qaytariladi.
    if (path === '/api/admin/marketplace/orders/import' && method === 'POST') {
      const body = await readJson();
      const rows = Array.isArray(body.rows) ? body.rows.slice(0, 2000) : [];
      if (!rows.length) return H.json({ error: 'no_rows' }, 422);
      const now = H.nowTs();
      let linked = 0;
      const problems = [];
      for (let i = 0; i < rows.length; i += 1) {
        const r = rows[i] || {};
        const normalized = normalizeActivationCode(r.code);
        const orderId = H.shortText(r.marketplaceOrderId, 80);
        if (!normalized) { problems.push({ line: i + 1, code: String(r.code || '').slice(0, 20), reason: 'bad_code' }); continue; }
        if (!orderId) { problems.push({ line: i + 1, code: formatActivationCode(normalized), reason: 'order_required' }); continue; }
        const hash = await activationCodeHash(H, normalized);

        // SKU MOSLIGI — OMBORDAGI XATONI TUTADI.
        //
        // Fayldagi satr o'z SKU sini olib kelsa (bizning ichki SKU
        // yoki marketplace'ning o'z SKU si), u kodning HAQIQIY
        // mahsuloti bilan solishtiriladi. Mos kelmasa — bog'lanmaydi
        // va satr muammo sifatida qaytadi.
        //
        // Nima uchun MUHIM: bu "konvertga boshqa mahsulotning kodi
        // solingan" degani. Jimgina bog'lab qo'ysak, xaridor stiker
        // buyurtma qilib karta oladi va hisobotlar ham noto'g'ri
        // bo'lardi.
        const wantSku = H.shortText(r.sku, 80).toUpperCase();
        if (wantSku) {
          const owner = await env.DB.prepare(
            `SELECT p.sku, p.external_sku AS ext FROM marketplace_activations a
               LEFT JOIN marketplace_products p ON p.id = a.product_id
              WHERE a.code_hash = ?`
          ).bind(hash).first().catch(() => null);
          if (owner && String(owner.sku || '').toUpperCase() !== wantSku && String(owner.ext || '').toUpperCase() !== wantSku) {
            problems.push({ line: i + 1, code: formatActivationCode(normalized), reason: 'sku_mismatch' });
            continue;
          }
        }

        // FAOLLASHTIRILGAN kodga tegilmaydi: odam allaqachon
        // ishlatgan bo'lsa, buyurtma raqami uni o'zgartirmasligi
        // kerak. Buyurtma ma'lumoti esa baribir yoziladi.
        const row = await env.DB.prepare(
          `UPDATE marketplace_activations
              SET marketplace_order_id = ?, customer_reference = COALESCE(?, customer_reference),
                  sold_at = COALESCE(sold_at, ?),
                  status = CASE WHEN status IN ('new','exported') THEN 'sold' ELSE status END
            WHERE code_hash = ? RETURNING id, code_tail, status`
        ).bind(orderId, H.shortText(r.customerReference, 80) || null, now, hash).first().catch(() => null);
        if (!row) { problems.push({ line: i + 1, code: formatActivationCode(normalized), reason: 'not_found' }); continue; }
        linked += 1;
      }
      await H.logAdminActivity(env, {
        action: 'marketplace_orders_imported',
        details: `${linked}/${rows.length}`,
        ip,
      });
      return H.json({ linked, total: rows.length, problems: problems.slice(0, 100) });
    }

    // ── HOLAT O'ZGARTIRISH ────────────────────────────────────────
    const actMatch = path.match(/^\/api\/admin\/marketplace\/activations\/(\d+)\/([a-z-]+)$/);
    if (actMatch && method === 'POST') {
      const id = Number(actMatch[1]);
      const action = actMatch[2];
      const body = await readJson();
      const row = await env.DB.prepare(`SELECT * FROM marketplace_activations WHERE id = ?`).bind(id).first();
      if (!row) return H.json({ error: 'not_found' }, 404);

      // FAOLLASHTIRILGAN KOD UCHUN ODDIY "RESET" YO'Q.
      // Reassign — alohida amal, majburiy sabab va audit bilan.
      if (action === 'reassign') {
        const reason = H.shortText(body.reason, 300);
        if (row.status !== 'activated') return H.json({ error: 'not_activated' }, 409);
        if (body.confirm !== true || reason.length < 10) return H.json({ error: 'confirmation_required' }, 422);
        await env.DB.prepare(
          `UPDATE marketplace_activations SET status = 'new', activated_by_user_id = NULL,
             activated_profile_kind = NULL, activated_profile_code = NULL, activated_at = NULL,
             reserved_by_user_id = NULL, reserved_at = NULL WHERE id = ?`
        ).bind(id).run();
        await H.logAdminActivity(env, {
          action: 'marketplace_reassigned',
          details: `****-${row.code_tail} — ${reason}`,
          oldValue: `${row.activated_profile_kind || ''}:${row.activated_profile_code || ''}`,
          newValue: 'new', ip,
        });
        return H.json({ ok: true });
      }

      const map = {
        block: { to: 'blocked', from: null, log: 'marketplace_blocked' },
        unblock: { to: 'new', from: ['blocked'], log: 'marketplace_unblocked' },
        expire: { to: 'expired', from: ACTIVATABLE, log: 'marketplace_expired' },
        'mark-sold': { to: 'sold', from: ['new', 'exported'], log: 'marketplace_marked_sold' },
      };
      if (map[action]) {
        const rule = map[action];
        // Faollashtirilgan kod bu amallar bilan O'ZGARMAYDI — aks
        // holda odamning ishlab turgan kartasi jimgina o'chib qolardi.
        if (row.status === 'activated') return H.json({ error: 'already_activated' }, 409);
        if (rule.from && !rule.from.includes(row.status)) return H.json({ error: 'bad_state', status: row.status }, 409);
        const soldAt = action === 'mark-sold' ? H.nowTs() : null;
        await env.DB.prepare(
          `UPDATE marketplace_activations SET status = ?, sold_at = COALESCE(?, sold_at) WHERE id = ?`
        ).bind(rule.to, soldAt, id).run();
        await H.logAdminActivity(env, { action: rule.log, details: `****-${row.code_tail}`, oldValue: row.status, newValue: rule.to, ip });
        return H.json({ ok: true, status: rule.to });
      }

      if (action === 'attach-order') {
        const orderId = H.shortText(body.marketplaceOrderId, 80);
        const ref = H.shortText(body.customerReference, 80);
        await env.DB.prepare(
          `UPDATE marketplace_activations SET marketplace_order_id = ?, customer_reference = ?,
             sold_at = COALESCE(sold_at, ?), status = CASE WHEN status IN ('new','exported') THEN 'sold' ELSE status END
           WHERE id = ?`
        ).bind(orderId || null, ref || null, H.nowTs(), id).run();
        await H.logAdminActivity(env, { action: 'marketplace_order_attached', details: `****-${row.code_tail} — ${orderId}`, ip });
        return H.json({ ok: true });
      }

      if (action === 'mark-exported') {
        if (row.status !== 'new') return H.json({ error: 'bad_state', status: row.status }, 409);
        await env.DB.prepare(`UPDATE marketplace_activations SET status = 'exported' WHERE id = ? AND status = 'new'`).bind(id).run();
        await H.logAdminActivity(env, { action: 'marketplace_code_exported', details: `****-${row.code_tail}`, ip });
        return H.json({ ok: true, status: 'exported' });
      }

      return H.json({ error: 'not_found' }, 404);
    }

    return H.json({ error: 'not_found' }, 404);
  }

  return null;
}

function activationResult(row) {
  return {
    profileKind: row.activated_profile_kind || '',
    profileCode: row.activated_profile_code || '',
    productName: row.product_name || '',
  };
}

// ═════════════════════════════════════════════════════════════════════
// AKTIVATSIYA — ATOMIK OQIM
//
// Qadamlar (14-band):
//   1. kodni tekshirish
//   2. kodni BAND QILISH (compare-and-swap)
//   3. egalikni tekshirish
//   4. profil tanlash/yaratish + ID ajratish
//   5. fizik qurilmani bog'lash
//   6. kodni ACTIVATED qilish
//   7. audit
//
// Birorta qadam yiqilsa — kod BAND holatidan asl holatiga QAYTARILADI
// va yarim yaratilgan narsa qolmaydi.
//
// D1 da ko'p qadamli tranzaksiya yo'q, shuning uchun yagona g'olibni
// BAND QILISH qadami ta'minlaydi: `UPDATE ... WHERE status IN (...)
// RETURNING` — ikki parallel so'rovdan faqat BITTASI qator oladi.
// Aynan shu naqsh sovg'a aktivatsiyasida ham ishlatilgan.
// ═════════════════════════════════════════════════════════════════════
async function activateHandler(request, env, H, body) {
  if (await isRateLimited(env, H, request, 'activate')) return H.json({ error: 'rate_limited' }, 429);

  const user = await H.getCurrentUser(request, env);
  if (!user) return H.json({ error: 'unauthorized' }, 401);

  const { normalized, row } = await loadByCode(env, H, body.code);
  if (!normalized) return H.json({ error: 'bad_code' }, 422);
  if (!row) return H.json({ error: 'bad_code' }, 404);

  // ── IDEMPOTENTLIK (16-band) ────────────────────────────────────────
  // Odam tugmani ikki marta bossa YANGI ID, YANGI profil yoki ikkinchi
  // qurilma bog'lanishi YARATILMAYDI — oldingi natija qaytariladi.
  if (row.status === 'activated') {
    if (String(row.activated_by_user_id) === String(user.id)) {
      return H.json({ ok: true, alreadyActivated: true, result: activationResult(row) });
    }
    return H.json({ error: 'already_activated' }, 409);
  }
  if (isExpired(row, H)) return H.json({ error: 'code_expired' }, 409);
  if (!ACTIVATABLE.includes(row.status)) {
    // Yarim qolgan bandlik: egasi SHU odam bo'lsa va muddati o'tgan
    // bo'lsa davom etamiz; aks holda ikkinchi so'rovga aniq javob.
    const stale = row.reserved_at && (Date.now() - new Date(row.reserved_at).getTime() > RESERVE_TTL_MS);
    const mine = String(row.reserved_by_user_id) === String(user.id);
    if (!(row.status === 'activating' && (mine || stale))) return H.json({ error: statusError(row.status) }, 409);
  }

  const kind = body.profileKind === 'business' ? 'business' : body.profileKind === 'personal' ? 'personal' : '';
  if (!kind) return H.json({ error: 'profile_kind_required' }, 422);

  // ── 2) BAND QILISH — YAGONA G'OLIB ─────────────────────────────────
  const prevStatus = ACTIVATABLE.includes(row.status) ? row.status : 'new';
  const reserved = await env.DB.prepare(
    `UPDATE marketplace_activations SET status = 'activating', reserved_by_user_id = ?, reserved_at = ?
      WHERE id = ? AND (status IN ('new','exported','sold') OR (status = 'activating' AND (reserved_by_user_id = ? OR reserved_at < ?)))
      RETURNING id`
  ).bind(user.id, H.nowTs(), row.id, user.id, new Date(Date.now() - RESERVE_TTL_MS).toISOString()).first().catch(() => null);
  if (!reserved) return H.json({ error: 'activation_in_progress' }, 409);

  // Yiqilsa kodni asl holatiga QAYTARAMIZ — u behuda "ishlatilgan"
  // bo'lib qolmasin.
  const release = async () => {
    await env.DB.prepare(
      `UPDATE marketplace_activations SET status = ?, reserved_by_user_id = NULL, reserved_at = NULL
        WHERE id = ? AND status = 'activating' AND reserved_by_user_id = ?`
    ).bind(prevStatus, row.id, user.id).run().catch(() => {});
  };

  try {
    const product = await env.DB.prepare(`SELECT * FROM marketplace_products WHERE id = ?`).bind(row.product_id).first();
    if (!product) { await release(); return H.json({ error: 'product_not_found' }, 404); }

    let profileCode = '';
    let createdCode = '';

    if (kind === 'personal') {
      const wanted = H.shortText(body.profileCode, 32).toUpperCase();
      if (wanted) {
        // ── 3) EGALIK — SERVER TOMONDA ──────────────────────────────
        // Begona profilga bog'lash mumkin bo'lmasin (11-band).
        const owner = await H.getRecordOwner(env, wanted);
        if (owner == null || String(owner) !== String(user.id)) { await release(); return H.json({ error: 'not_your_profile' }, 403); }
        profileCode = wanted;
      } else {
        // ── 4) ID AJRATISH — MAVJUD ALLOKATOR ───────────────────────
        // YANGI GENERATOR YOZILMADI: bu `auth.js` dagi, ro'yxatdan
        // o'tish ishlatadigan AYNAN o'sha funksiya.
        const hasPrimary = await env.DB.prepare(`SELECT 1 AS x FROM cards WHERE user_id = ? AND is_primary = 1`).bind(user.id).first();
        const name = H.cleanStr(body.name, 80) || (user.email ? String(user.email).split('@')[0] : 'NFCSTORE');
        createdCode = await createFreeAutoId(env, user.id, name, { primary: !hasPrimary, source: 'marketplace_activation' });
        if (!createdCode) { await release(); return H.json({ error: 'id_allocation_failed' }, 503); }
        profileCode = createdCode;
      }
      // TARIF — mavjud ustun. 'auto' bo'lsa HECH NARSA yozilmaydi va
      // ID aynan oddiy bepul ID kabi ishlaydi.
      if (product.included_tier && product.included_tier !== 'auto' && createdCode) {
        await env.DB.prepare(`UPDATE cards SET tier_override = ? WHERE code = ?`).bind(product.included_tier, createdCode).run().catch(() => {});
      }
    } else {
      // BIZNES. Yangi "marketplace business" modeli YARATILMADI —
      // bu yerda faqat O'ZINIKI bo'lgan mavjud kompaniyaga bog'lanadi.
      // Kompaniya YARATISH esa saytning o'z oqimida (`POST /api/companies`)
      // bo'ladi va odam undan keyin shu yerga qaytadi.
      const wanted = H.shortText(body.companyId, 40).toUpperCase();
      if (!wanted) { await release(); return H.json({ error: 'company_required' }, 422); }
      const own = await env.DB.prepare(`SELECT company_id FROM companies WHERE company_id = ? AND owner_user_id = ?`)
        .bind(wanted, String(user.id)).first();
      if (!own) { await release(); return H.json({ error: 'not_your_company' }, 403); }
      profileCode = own.company_id;
    }

    // ── 5) FIZIK QURILMANI BOG'LASH ────────────────────────────────
    // Faqat SHU kodga oldindan biriktirilgan qurilma. Begona qurilma
    // tashqaridan berilmaydi — `body` dan qurilma OLINMAYDI.
    if (row.physical_device_id) {
      const dev = await env.DB.prepare(`SELECT id, owner_user_id, linked_code FROM physical_cards WHERE id = ?`).bind(row.physical_device_id).first();
      if (dev && (dev.owner_user_id == null || String(dev.owner_user_id) === String(user.id))) {
        // Shaxsiy -> `linked_code` (cards.code ga FK).
        // Biznes  -> `linked_company_id`; `linked_code` NULL bo'lib
        //            qoladi, chunki kompaniya `cards` da yo'q va
        //            u yerga har qanday qiymat yozish FK ni buzardi.
        await env.DB.prepare(`UPDATE physical_cards SET owner_user_id = ?, linked_code = ?, linked_company_id = ?, active = 1 WHERE id = ?`)
          .bind(user.id, kind === 'personal' ? profileCode : null, kind === 'business' ? profileCode : null, row.physical_device_id).run();
      } else if (dev) {
        await release();
        return H.json({ error: 'device_taken' }, 409);
      }
    }

    // ── 6) KODNI YAKUNIY HOLATGA O'TKAZISH ─────────────────────────
    const done = await env.DB.prepare(
      `UPDATE marketplace_activations SET status = 'activated', activated_by_user_id = ?, activated_profile_kind = ?,
         activated_profile_code = ?, activated_at = ?, reserved_by_user_id = NULL, reserved_at = NULL
        WHERE id = ? AND status = 'activating' AND reserved_by_user_id = ? RETURNING id`
    ).bind(user.id, kind, profileCode, H.nowTs(), row.id, user.id).first().catch(() => null);
    if (!done) {
      // Boshqa so'rov oldinda ketdi. Biz yaratgan YANGI karta
      // ORFAN bo'lib qolmasin.
      if (createdCode) await env.DB.prepare(`DELETE FROM cards WHERE code = ? AND user_id = ?`).bind(createdCode, user.id).run().catch(() => {});
      return H.json({ error: 'activation_in_progress' }, 409);
    }

    // ── 7) AUDIT ───────────────────────────────────────────────────
    await H.logAdminActivity(env, {
      action: 'marketplace_activated',
      details: `****-${row.code_tail} — ${kind}:${profileCode}`,
      newValue: String(product.sku || ''), ip: H.reqIp(request),
    });

    return H.json({
      ok: true,
      result: { profileKind: kind, profileCode, productName: product.name || '' },
    }, 201);
  } catch (err) {
    await release();
    throw err;
  }
}
