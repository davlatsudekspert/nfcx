import pg from 'pg';
import crypto from 'crypto';
import { hashPassword } from './auth.js';
import { AUCTION_DEMAND_THRESHOLD } from '../src/lib/auctionDemand.js';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || '';

let pool = null;
let dbReady = false;

function makePool(useSsl) {
  return new Pool({
    connectionString: connectionString || undefined,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000,
  });
}

// Railway internal hostnames may or may not serve TLS depending on the
// Postgres template version — try SSL first, then plain.
export async function initDb() {
  if (!connectionString) {
    console.warn('[db] DATABASE_URL kiritilmagan — API faqat xatolik qaytaradi.');
    return false;
  }

  // Railway'da Postgres konteyneri ilovadan keyin tayyorlanishi mumkin —
  // bir necha marta qayta urinib ko'ramiz.
  const MAX_TRIES = 5;
  let lastErr = null;

  outer: for (let attemptNo = 1; attemptNo <= MAX_TRIES; attemptNo++) {
    for (const useSsl of [true, false]) {
      const candidate = makePool(useSsl);
      try {
        await candidate.query('SELECT 1');
        pool = candidate;
        break outer;
      } catch (err) {
        lastErr = err;
        await candidate.end().catch(() => {});
      }
    }
    if (attemptNo < MAX_TRIES) {
      console.warn(`[db] Ulanmadi (${attemptNo}/${MAX_TRIES}) — 3 soniyadan keyin yana urinaman...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  if (!pool) {
    console.error('[db] Ulanib boilmadi:', lastErr ? lastErr.message : "noma'lum xato");
    return false;
  }

  // MUHIM TARTIB: users -> sessions -> cards -> migratsiyalar.
  // Aks holda yangi bazada cards.user_id FK 'users' topolmay xato beradi.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      balance       BIGINT NOT NULL DEFAULT 0,
      held_balance  BIGINT NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`
    );
    const uc = new Set(rows.map((r) => r.column_name));
    if (!uc.has('balance')) {
      await pool.query(`ALTER TABLE users ADD COLUMN balance BIGINT NOT NULL DEFAULT 0`);
      console.log('[db] users.balance ustuni qo\u2019shildi.');
    }
    if (!uc.has('held_balance')) {
      await pool.query(`ALTER TABLE users ADD COLUMN held_balance BIGINT NOT NULL DEFAULT 0`);
      console.log('[db] users.held_balance ustuni qo\u2019shildi.');
    }
    // Telegram bot orqali tasdiqlash: ro'yxatdan o'tishdan oldin foydalanuvchi
    // botga ism-familya va telefon raqamini yuborgan bo'lishi shart (jismoniy
    // kartani kimga yetkazish kerakligini bilish va soxta akkauntlarning
    // oldini olish uchun).
    if (!uc.has('phone')) {
      await pool.query(`ALTER TABLE users ADD COLUMN phone TEXT`);
      console.log('[db] users.phone ustuni qo\u2019shildi.');
    }
    if (!uc.has('bot_ack')) {
      await pool.query(`ALTER TABLE users ADD COLUMN bot_ack BOOLEAN NOT NULL DEFAULT FALSE`);
      console.log('[db] users.bot_ack ustuni qo\u2019shildi.');
    }
    // Premium profil: oddiy foydalanuvchi bu profilga "yozilishi" (follow)
    // uchun pullik bo'ladi (PREMIUM_FOLLOW_FEE), pul to'g'ridan-to'g'ri
    // profil egasining NFC Pay hamyoniga tushadi.
    if (!uc.has('is_premium')) {
      await pool.query(`ALTER TABLE users ADD COLUMN is_premium BOOLEAN NOT NULL DEFAULT FALSE`);
      console.log('[db] users.is_premium ustuni qo\u2019shildi.');
    }
    // E-wallet YO'Q — bu faqat "platforma sizga qarzdor" hisob-kitobi
    // (masalan premium obunachi to'lovlaridan tegishli ulush). Admin
    // buni qo'lda (Payme/karta orqali) to'laydi va shu yerda ayiradi.
    if (!uc.has('pending_payout')) {
      await pool.query(`ALTER TABLE users ADD COLUMN pending_payout BIGINT NOT NULL DEFAULT 0`);
      console.log('[db] users.pending_payout ustuni qo\u2019shildi.');
    }
    // Auksionda yutib, 24 soatda to'lamagan foydalanuvchilar uchun jazo:
    // 1-marta — 72 soat akkauntga kirish taqiqlanadi (banned_until).
    // 2-marta va undan ko'p — strike_count oshadi, admin panelda ko'rinadi
    // (doimiy taqiq/akkauntni olib qo'yishni admin qo'lda hal qiladi).
    if (!uc.has('banned_until')) {
      await pool.query(`ALTER TABLE users ADD COLUMN banned_until TIMESTAMPTZ`);
      console.log('[db] users.banned_until ustuni qo\u2019shildi.');
    }
    if (!uc.has('strike_count')) {
      await pool.query(`ALTER TABLE users ADD COLUMN strike_count INTEGER NOT NULL DEFAULT 0`);
      console.log('[db] users.strike_count ustuni qo\u2019shildi.');
    }
    // Ro'yxatdan o'tishda ommaviy oferta/shartlarga rozilik belgisi.
    if (!uc.has('tos_accepted')) {
      await pool.query(`ALTER TABLE users ADD COLUMN tos_accepted BOOLEAN NOT NULL DEFAULT FALSE`);
      console.log('[db] users.tos_accepted ustuni qo\u2019shildi.');
    }
    // Admin/sinov akkauntlarini asosiy ko'rsatkichlardan (Foydalanuvchilar
    // soni, Jami savdo va h.k.) chiqarib tashlash uchun. Admin akkaunt
    // (ADMIN_EMAIL) avtomatik shu belgi bilan yaratiladi (pastga qarang).
    if (!uc.has('is_test')) {
      await pool.query(`ALTER TABLE users ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT FALSE`);
      console.log('[db] users.is_test ustuni qo\u2019shildi.');
    }
    // Admin moderatsiyasi: auksion jarima tizimidan (banned_until)
    // ATAYLAB alohida — bu adminning o'zi qo'lda qo'llagan bloklash.
    if (!uc.has('suspended_until')) {
      await pool.query(`ALTER TABLE users ADD COLUMN suspended_until TIMESTAMPTZ`);
      console.log('[db] users.suspended_until ustuni qo\u2019shildi.');
    }
    if (!uc.has('suspend_reason')) {
      await pool.query(`ALTER TABLE users ADD COLUMN suspend_reason TEXT`);
      console.log('[db] users.suspend_reason ustuni qo\u2019shildi.');
    }
    // Butunlay o'chirish — "soft delete": login qila olmaydi, lekin
    // ma'lumotlari (tergov/tekshiruv kerak bo'lsa) bazada saqlanib qoladi.
    if (!uc.has('deleted_at')) {
      await pool.query(`ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ`);
      console.log('[db] users.deleted_at ustuni qo\u2019shildi.');
    }
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cards (
      code        VARCHAR(16) PRIMARY KEY,
      name        TEXT NOT NULL,
      role        TEXT,
      avatar_url  TEXT,
      tg          TEXT,
      phone       TEXT,
      email       TEXT,
      linkedin    TEXT,
      instagram   TEXT,
      about       TEXT,
      facebook    TEXT,
      twitter     TEXT,
      website     TEXT,
      card_number TEXT,
      theme       VARCHAR(20) NOT NULL DEFAULT 'classic',
      for_sale    BOOLEAN NOT NULL DEFAULT FALSE,
      sale_price  BIGINT,
      hashtags    JSONB NOT NULL DEFAULT '[]'::jsonb,
      price       INTEGER NOT NULL,
      ts          BIGINT NOT NULL,
      views       INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS cards_ts_idx ON cards (ts DESC)`);

  // Migratsiya: eski jadval strukturasini yangi maydonlar bilan to'ldiramiz.
  const desired = {
    user_id: `ALTER TABLE cards ADD COLUMN user_id INTEGER REFERENCES users(id)`,
    code_wide: `ALTER TABLE cards ALTER COLUMN code TYPE VARCHAR(16)`,
    about: `ALTER TABLE cards ADD COLUMN about TEXT`,
    facebook: `ALTER TABLE cards ADD COLUMN facebook TEXT`,
    twitter: `ALTER TABLE cards ADD COLUMN twitter TEXT`,
    website: `ALTER TABLE cards ADD COLUMN website TEXT`,
    card_number: `ALTER TABLE cards ADD COLUMN card_number TEXT`,
    theme: `ALTER TABLE cards ADD COLUMN theme VARCHAR(20) NOT NULL DEFAULT 'classic'`,
    for_sale: `ALTER TABLE cards ADD COLUMN for_sale BOOLEAN NOT NULL DEFAULT FALSE`,
    sale_price: `ALTER TABLE cards ADD COLUMN sale_price BIGINT`,
    extra_links: `ALTER TABLE cards ADD COLUMN extra_links JSONB NOT NULL DEFAULT '[]'::jsonb`,
    card_numbers: `ALTER TABLE cards ADD COLUMN card_numbers JSONB NOT NULL DEFAULT '[]'::jsonb`,
    bg_url: `ALTER TABLE cards ADD COLUMN bg_url TEXT`,
    bg_pattern: `ALTER TABLE cards ADD COLUMN bg_pattern BOOLEAN NOT NULL DEFAULT TRUE`,
    accent_color: `ALTER TABLE cards ADD COLUMN accent_color TEXT`,
    bg_color: `ALTER TABLE cards ADD COLUMN bg_color TEXT`,
    bg_animated: `ALTER TABLE cards ADD COLUMN bg_animated BOOLEAN NOT NULL DEFAULT TRUE`,
    is_primary: `ALTER TABLE cards ADD COLUMN is_primary BOOLEAN NOT NULL DEFAULT FALSE`,
    giftable: `ALTER TABLE cards ADD COLUMN giftable BOOLEAN NOT NULL DEFAULT TRUE`,
    hide_phone: `ALTER TABLE cards ADD COLUMN hide_phone BOOLEAN NOT NULL DEFAULT FALSE`,
    music_url: `ALTER TABLE cards ADD COLUMN music_url TEXT`,
    links_transparent: `ALTER TABLE cards ADD COLUMN links_transparent BOOLEAN NOT NULL DEFAULT FALSE`,
    card_design: `ALTER TABLE cards ADD COLUMN card_design JSONB`,
    link_style: `ALTER TABLE cards ADD COLUMN link_style VARCHAR(12) NOT NULL DEFAULT 'standard'`,
    profile_type: `ALTER TABLE cards ADD COLUMN profile_type VARCHAR(12) NOT NULL DEFAULT 'personal'`,
    city: `ALTER TABLE cards ADD COLUMN city TEXT`,
    hidden_from_directory: `ALTER TABLE cards ADD COLUMN hidden_from_directory BOOLEAN NOT NULL DEFAULT FALSE`,
  };
  const existing = await pool.query(
    `SELECT column_name, character_maximum_length FROM information_schema.columns
     WHERE table_name = 'cards'`
  );
  const cols = new Set(existing.rows.map((r) => r.column_name));
  const codeLen = existing.rows.find((r) => r.column_name === 'code');
  if (!cols.has('user_id')) {
    await pool.query(desired.user_id);
    console.log('[db] cards.user_id ustuni qo\u2019shildi.');
  }
  if (codeLen && codeLen.character_maximum_length && codeLen.character_maximum_length < 16) {
    await pool.query(desired.code_wide);
    console.log('[db] cards.code ustuni VARCHAR(16)ga kengaytirildi.');
  }
  for (const key of ['about', 'facebook', 'twitter', 'website', 'card_number', 'theme', 'for_sale', 'sale_price', 'extra_links', 'card_numbers', 'bg_url', 'bg_pattern', 'accent_color', 'bg_color', 'bg_animated', 'music_url', 'is_primary', 'giftable', 'hide_phone', 'links_transparent', 'card_design', 'link_style', 'profile_type', 'city', 'hidden_from_directory']) {
    if (!cols.has(key)) {
      await pool.query(desired[key]);
      console.log(`[db] cards.${key} ustuni qo'shildi.`);
      // link_style yangi qo'shilganda — eski links_transparent=true ni 'glass'ga o'tkazamiz.
      if (key === 'link_style') {
        await pool.query(`UPDATE cards SET link_style = 'glass' WHERE links_transparent = TRUE`);
      }
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_orders (
      id                 SERIAL PRIMARY KEY,
      tg_user_id         BIGINT NOT NULL,
      tg_username        TEXT,
      tg_name            TEXT,
      code               VARCHAR(16) NOT NULL,
      price              INTEGER NOT NULL,
      status             VARCHAR(20) NOT NULL DEFAULT 'pending',
      screenshot_file_id TEXT,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS bot_orders_user_idx ON bot_orders (tg_user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS bot_orders_code_idx ON bot_orders (code)`);

  // Sayt orqali beriladigan buyurtmalar: to'lov tasdiqlanmaguncha karta
  // yaratilmaydi (avval "band qilish" to'lovsiz karta yaratib yuborardi).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS web_orders (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code       VARCHAR(40) NOT NULL,
      kind       VARCHAR(24) NOT NULL DEFAULT 'card_purchase', -- card_purchase | auction_payment | premium_upgrade | premium_follow
      price      INTEGER NOT NULL,
      payload    JSONB NOT NULL,
      status     VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  {
    const { rows } = await pool.query(
      `SELECT column_name, character_maximum_length FROM information_schema.columns WHERE table_name = 'web_orders'`
    );
    const wc = new Set(rows.map((r) => r.column_name));
    const codeLen = rows.find((r) => r.column_name === 'code');
    if (!wc.has('kind')) {
      await pool.query(`ALTER TABLE web_orders ADD COLUMN kind VARCHAR(24) NOT NULL DEFAULT 'card_purchase'`);
      console.log('[db] web_orders.kind ustuni qo\u2019shildi.');
    }
    if (codeLen && codeLen.character_maximum_length && codeLen.character_maximum_length < 40) {
      await pool.query(`ALTER TABLE web_orders ALTER COLUMN code TYPE VARCHAR(40)`);
      console.log('[db] web_orders.code ustuni VARCHAR(40)ga kengaytirildi.');
    }
    // Payme protokoli har bir tranzaksiyaga o'zining ID'sini beradi —
    // buyurtmani shu orqali topib, idempotent qayta ishlash uchun kerak.
    if (!wc.has('payme_transaction_id')) {
      await pool.query(`ALTER TABLE web_orders ADD COLUMN payme_transaction_id TEXT UNIQUE`);
      console.log('[db] web_orders.payme_transaction_id ustuni qo\u2019shildi.');
    }
  }
  await pool.query(`CREATE INDEX IF NOT EXISTS web_orders_user_idx ON web_orders (user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS web_orders_code_idx ON web_orders (code)`);

  // Hamyon to'ldirish buyurtmalari (Payme orqali).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wallet_topups (
      id                  SERIAL PRIMARY KEY,
      user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount              BIGINT NOT NULL,
      payme_transaction_id TEXT UNIQUE,
      status              VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS wallet_topups_user_idx ON wallet_topups (user_id)`);

  // Auksionlar va takliflar.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auctions (
      id                  SERIAL PRIMARY KEY,
      code                VARCHAR(16) NOT NULL, -- MUHIM: endi cards(code)ga FK YO'Q — auksion ko'pincha
                                                  -- hali hech kimga tegishli bo'lmagan YANGI kod uchun ochiladi.
      seller_id           INTEGER REFERENCES users(id) ON DELETE SET NULL, -- endi har doim NULL (admin ochadi, sotuvchi yo'q)
      start_price         BIGINT NOT NULL,
      buy_now_price       BIGINT,
      current_price       BIGINT NOT NULL,
      highest_bidder_id   INTEGER REFERENCES users(id),
      ends_at             TIMESTAMPTZ NOT NULL,
      -- status: active -> awaiting_payment -> sold | payment_expired | expired | cancelled
      status              VARCHAR(20) NOT NULL DEFAULT 'active',
      payment_deadline    TIMESTAMPTZ,      -- g'olib uchun 24 soatlik muddat
      seller_payout_amount BIGINT,          -- eski (foydalanuvchi auksionlari) uchun qoldirilgan, endi ishlatilmaydi
      seller_payout_status VARCHAR(20) NOT NULL DEFAULT 'none',
      seller_payme_number TEXT,
      created_by_admin    BOOLEAN NOT NULL DEFAULT TRUE, -- endi doim TRUE
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'auctions'`
    );
    const ac = new Set(rows.map((r) => r.column_name));
    const auctionCols = {
      payment_deadline: `ALTER TABLE auctions ADD COLUMN payment_deadline TIMESTAMPTZ`,
      seller_payout_amount: `ALTER TABLE auctions ADD COLUMN seller_payout_amount BIGINT`,
      seller_payout_status: `ALTER TABLE auctions ADD COLUMN seller_payout_status VARCHAR(20) NOT NULL DEFAULT 'none'`,
      seller_payme_number: `ALTER TABLE auctions ADD COLUMN seller_payme_number TEXT`,
      created_by_admin: `ALTER TABLE auctions ADD COLUMN created_by_admin BOOLEAN NOT NULL DEFAULT TRUE`,
    };
    for (const key of Object.keys(auctionCols)) {
      if (!ac.has(key)) {
        await pool.query(auctionCols[key]);
        console.log(`[db] auctions.${key} ustuni qo'shildi.`);
      }
    }
    // Eski deploy'larda auctions.code -> cards(code) va seller_id NOT NULL
    // bo'lishi mumkin edi — endi auksion hali card yaratilmagan YANGI
    // kod uchun ham ochilishi kerak, shuning uchun bu cheklovlarni
    // (agar mavjud bo'lsa) olib tashlaymiz.
    const { rows: cons } = await pool.query(`
      SELECT con.conname FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'auctions' AND con.contype = 'f'
    `);
    for (const { conname } of cons) {
      await pool.query(`ALTER TABLE auctions DROP CONSTRAINT IF EXISTS ${conname}`);
    }
    await pool.query(`ALTER TABLE auctions ALTER COLUMN seller_id DROP NOT NULL`).catch(() => {});
    await pool.query(`ALTER TABLE auctions ADD CONSTRAINT auctions_seller_fk
      FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE SET NULL`).catch(() => {});
  }
  await pool.query(`CREATE INDEX IF NOT EXISTS auctions_status_idx ON auctions (status, ends_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS auctions_code_idx ON auctions (code)`);

  // Foydalanuvchi adminga "shu noyob nomni auksionga qo'ying" deb
  // so'rov yuboradi — admin ko'rib chiqib, tasdiqlasa auksion o'zi
  // yaratiladi (narx/muddatni admin belgilaydi).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auction_requests (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code        VARCHAR(16) NOT NULL,
      note        TEXT,
      status      VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | approved | rejected
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS auction_requests_status_idx ON auction_requests (status)`);

  // Sovg'a qilish — pulsiz egalik o'tkazish. Qabul qiluvchi O'Z NFC ID'si
  // (mavjud kodi) orqali aniqlanadi. Egalik faqat qabul qiluvchi
  // TASDIQLAGANDA o'tadi (ikki tomonlama rozilik).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gift_offers (
      id           SERIAL PRIMARY KEY,
      code         VARCHAR(16) NOT NULL,
      from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status       VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | accepted | rejected | cancelled
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      decided_at   TIMESTAMPTZ
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS gift_offers_to_idx ON gift_offers (to_user_id, status)`);

  // Foydalanuvchidan adminga murojaat — profildagi "Chiqish" tugmasi
  // yonida. Admin javob bersa, foydalanuvchiga bildirishnoma (email/UI)
  // ko'rinadi; admin panelda esa alohida "Bildirishnomalar" bo'limida
  // barcha murojaatlar ko'rinadi.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS support_messages (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message     TEXT NOT NULL,
      reply       TEXT,
      status      VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | replied
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      replied_at  TIMESTAMPTZ
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS support_messages_status_idx ON support_messages (status)`);

  // Parolni Telegram orqali kelgan bir martalik kod bilan o'zgartirish.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_codes (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code        VARCHAR(6) NOT NULL,
      expires_at  TIMESTAMPTZ NOT NULL,
      used        BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Admin panelga kirish tarixi — muvaffaqiyatli/noto'g'ri parol/2FA
  // xatosi/bloklangan IP/logout/sessiya tugashi — hammasi shu yerga.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_login_history (
      id          SERIAL PRIMARY KEY,
      event       VARCHAR(30) NOT NULL, -- login_ok | bad_password | bad_2fa | rate_limited | logout | idle_timeout
      ip          TEXT,
      user_agent  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Admin Activity Log — adminning har bir muhim harakati (kim, nima,
  // qachon, oldingi/yangi qiymat). Oddiy admin buni o'chira olmaydi
  // (frontend/backendda DELETE endpoint umuman yo'q).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_activity_log (
      id          SERIAL PRIMARY KEY,
      action      VARCHAR(60) NOT NULL,   -- masalan: "auction_created", "user_suspended"
      details     TEXT,                    -- inson o'qiy oladigan qisqa tavsif
      old_value   TEXT,
      new_value   TEXT,
      ip          TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // IP Whitelist — admin panelga faqat shu ro'yxatdagi IP'lardan kirish
  // mumkin (yoqilgan bo'lsa). MAX 2 ta yozuv (talab shunday).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_ip_whitelist (
      id          SERIAL PRIMARY KEY,
      ip          TEXT NOT NULL UNIQUE,
      label       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  // Yoqish/o'chirish holati — oddiy kalit-qiymat jadval, kelajakdagi
  // boshqa sozlamalar uchun ham qayta ishlatiladi.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_settings (
      key    TEXT PRIMARY KEY,
      value  TEXT
    )
  `);

  // Ko'p adminli tizim + rollar (Super Admin / Manager / Content Manager)
  // + TOTP (Authenticator app) 2FA. Avval bitta ENV-asosli admin bo'lgan —
  // birinchi ishga tushirishda shu yerga avtomatik ko'chiriladi (pastroqda).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id            SERIAL PRIMARY KEY,
      phone         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name          TEXT,
      role          VARCHAR(20) NOT NULL DEFAULT 'manager', -- super_admin | manager | content_manager
      totp_secret   TEXT,
      totp_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  // Birinchi ishga tushirishda: agar admins jadvali bo'sh bo'lsa va
  // eski ENV-asosli login (ADMIN_PANEL_PHONE/PASSWORD) sozlangan bo'lsa,
  // shu ma'lumotdan avtomatik SUPER ADMIN yaratamiz — eski login
  // buzilib qolmasligi uchun.
  {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM admins`);
    if (rows[0].n === 0 && process.env.ADMIN_PANEL_PHONE && process.env.ADMIN_PANEL_PASSWORD) {
      const hash = hashPassword(process.env.ADMIN_PANEL_PASSWORD);
      await pool.query(
        `INSERT INTO admins (phone, password_hash, name, role) VALUES ($1,$2,'Super Admin','super_admin')`,
        [process.env.ADMIN_PANEL_PHONE.trim(), hash]
      );
      console.log('[db] ENV asosida birinchi Super Admin yaratildi.');
    }
  }

  // ===================== "GIFT NFC ID" — YANGI, IZOLYATSIYALANGAN =====================
  // Mavjud "sovg'a qilish" (gift_offers — egasi bor kodni boshqa foydalanuvchiga
  // o'tkazish) funksiyasidan BUTUNLAY FARQLI: bu yerda admin HALI HECH KIMGA
  // TEGISHLI BO'LMAGAN kodni oldindan ajratib, tashqarida (konvert bilan)
  // kimgadir beradi. Kod HECH QANDAY profilga ULANMAYDI, faqat qabul qiluvchi
  // o'zi bir martalik aktivatsiya kodi bilan tasdiqlagandan keyingina ulanadi.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS nfc_gifts (
      id                  SERIAL PRIMARY KEY,
      code                VARCHAR(16) UNIQUE NOT NULL,
      recipient_name      TEXT,
      note                TEXT,
      activation_code     VARCHAR(20) UNIQUE NOT NULL,
      status              VARCHAR(20) NOT NULL DEFAULT 'reserved', -- reserved | activated
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      activated_at        TIMESTAMPTZ,
      activated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Xavfsizlik: foydalanuvchini bloklash va shikoyat qilish — xabar
  // yozish tizimidagi suiiste'moldan himoya.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blocked_users (
      blocker_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (blocker_id, blocked_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_reports (
      id            SERIAL PRIMARY KEY,
      reporter_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reported_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason        TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Do'st taklif qilish (referral) — har bir foydalanuvchi ro'yxatdan
  // o'tganda avtomatik o'ziga xos promokod oladi (users.promo_code).
  // Boshqa odam ro'yxatdan o'tganda shu promokodni kiritsa, promokod
  // egasiga 10% chegirma "krediti" yoziladi — bu keyingi bandlashda
  // avtomatik qo'llaniladi.
  const { rows: ucRows2 } = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`
  );
  const uc2 = new Set(ucRows2.map((r) => r.column_name));
  if (!uc2.has('promo_code')) {
    await pool.query(`ALTER TABLE users ADD COLUMN promo_code VARCHAR(12) UNIQUE`);
    console.log('[db] users.promo_code ustuni qo\u2019shildi.');
  }
  if (!uc2.has('pending_discount_pct')) {
    await pool.query(`ALTER TABLE users ADD COLUMN pending_discount_pct INTEGER NOT NULL DEFAULT 0`);
    console.log('[db] users.pending_discount_pct ustuni qo\u2019shildi.');
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS referral_uses (
      id            SERIAL PRIMARY KEY,
      referrer_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      referred_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Oldin (promo_code tizimi qo'shilishidan avval) ro'yxatdan o'tgan
  // foydalanuvchilarga ham 6 xonali promokod avtomatik beriladi —
  // bu tekshiruv har safar server ishga tushganda ishlaydi, lekin
  // faqat promo_code hali NULL bo'lganlarga tegadi (xavfsiz, bir marta).
  {
    const { rows: noPromo } = await pool.query(`SELECT id FROM users WHERE promo_code IS NULL`);
    for (const u of noPromo) {
      await assignPromoCode(u.id);
    }
    if (noPromo.length > 0) console.log(`[db] ${noPromo.length} ta eski foydalanuvchiga promokod berildi.`);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bids (
      id                SERIAL PRIMARY KEY,
      auction_id        INTEGER NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
      user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount            BIGINT NOT NULL,
      released          BOOLEAN NOT NULL DEFAULT FALSE,
      idempotency_key   TEXT UNIQUE,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'bids'`
    );
    if (!rows.some((r) => r.column_name === 'idempotency_key')) {
      await pool.query(`ALTER TABLE bids ADD COLUMN idempotency_key TEXT UNIQUE`);
      console.log('[db] bids.idempotency_key ustuni qo\u2019shildi.');
    }
  }
  await pool.query(`CREATE INDEX IF NOT EXISTS bids_auction_idx ON bids (auction_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS bids_user_idx ON bids (user_id)`);

  // Audit jurnali: har bir NFC Coin balans o'zgarishi shu yerga yoziladi
  // (kim, qancha, nega). Balansning o'zi tezkor o'qish uchun users'da
  // saqlanadi, lekin "nega shunday bo'ldi" degan savolga shu jadval javob
  // beradi — moliyaviy tizim uchun bu shart.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE, -- NULL = platforma (admin hamyoni)
      amount      BIGINT NOT NULL,           -- musbat = kirim, manfiy = chiqim
      kind        VARCHAR(30) NOT NULL,      -- 'topup' | 'bid_hold' | 'bid_release' |
                                              -- 'auction_win' | 'auction_sale' | 'refund' |
                                              -- 'admin_adjust' | 'card_purchase' |
                                              -- 'platform_commission'
      ref_table   TEXT,                      -- masalan 'wallet_topups', 'auctions'
      ref_id      INTEGER,
      note        TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS transactions_user_idx ON transactions (user_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS transactions_kind_idx ON transactions (kind, created_at DESC)`);
  // Eski o'rnatishlarda user_id NOT NULL bo'lishi mumkin edi — platforma
  // tranzaksiyalari (user_id = NULL) yozilishi uchun bo'shatamiz.
  await pool.query(`ALTER TABLE transactions ALTER COLUMN user_id DROP NOT NULL`);

  // Platforma (admin) hamyoni — auksion komissiyasi va premium obuna
  // komissiyasi shu yerga tushadi. Har doim bitta qator (id=1).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_wallet (
      id      SMALLINT PRIMARY KEY DEFAULT 1,
      balance BIGINT NOT NULL DEFAULT 0,
      CHECK (id = 1)
    )
  `);
  await pool.query(`INSERT INTO platform_wallet (id, balance) VALUES (1, 0) ON CONFLICT (id) DO NOTHING`);

  // Jismoniy NFC kartalar — profildan (cards/nfcstore.uz/vip001) ALOHIDA.
  // Har bir chipga tasodifiy, taxmin qilib bo'lmaydigan `chip_token` beriladi
  // va aynan shu token chip ichiga (NDEF yozuvga) qo'yiladi: masalan
  // nfcstore.uz/vip001?t=<chip_token>. Saytdagi va bio'dagi ko'rinadigan
  // havola esa har doim toza (nfcstore.uz/vip001) qoladi. Bu orqali
  // auksion/qayta sotuvda profil egasi almashganda, eski jismoniy karta
  // shunchaki linked_code=NULL qilinadi (butunlay boshqa jadval bo'lgani
  // uchun bu profilning o'ziga hech qanday ta'sir qilmaydi).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS physical_cards (
      id                SERIAL PRIMARY KEY,
      chip_token        TEXT UNIQUE NOT NULL,
      linked_code       VARCHAR(16) REFERENCES cards(code) ON DELETE SET NULL,
      owner_user_id     INTEGER REFERENCES users(id),
      active            BOOLEAN NOT NULL DEFAULT TRUE,
      shipping_name     TEXT,
      shipping_phone    TEXT,
      shipping_address  TEXT,
      status            VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending -> printing -> shipped -> delivered
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS physical_cards_code_idx ON physical_cards (linked_code)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS physical_cards_owner_idx ON physical_cards (owner_user_id)`);
  // blocked_by_owner — egasi qurilmani vaqtincha bloklaydi (admin `active`
  // bilan aralashmasin — Band 3.5).
  {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'physical_cards' AND column_name = 'blocked_by_owner'`);
    if (!rows.length) {
      await pool.query(`ALTER TABLE physical_cards ADD COLUMN blocked_by_owner BOOLEAN NOT NULL DEFAULT FALSE`);
      console.log('[db] physical_cards.blocked_by_owner ustuni qo’shildi.');
    }
  }

  // Premium profilga o'tish so'rovlari — ESKI (dormant) oqim: NFC Coin +
  // admin tasdig'i. Hozirgi oqim to'g'ridan-to'g'ri Payme (requestPremium),
  // admin tasdig'i shart emas. Jadval eski ma'lumot uchun saqlanadi.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS premium_requests (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount      BIGINT NOT NULL,
      status      VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | approved | rejected
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      decided_at  TIMESTAMPTZ
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS premium_requests_status_idx ON premium_requests (status)`);

  // Obuna (follow) — kimning kimga obuna bo'lganini saqlaydi. Agar
  // maqsad profil premium bo'lsa, `paid`=true va `amount` shu vaqtdagi
  // to'lov summasini bildiradi (keyinchalik narx o'zgarsa ham tarixiy
  // yozuv o'zgarmay qoladi).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS follows (
      id            SERIAL PRIMARY KEY,
      follower_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      followee_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      paid          BOOLEAN NOT NULL DEFAULT FALSE,
      amount        BIGINT NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (follower_id, followee_id)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS follows_follower_idx ON follows (follower_id)`);

  // Layk — profillar (kartalar) orasida, kod (nfc card) ustiga bosiladi.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS card_likes (
      id          SERIAL PRIMARY KEY,
      code        VARCHAR(16) NOT NULL,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (code, user_id)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS card_likes_code_idx ON card_likes (code)`);

  // Tarif override — odatda daraja kod naqshidan hisoblanadi (pricing.js
  // tierForCode), lekin admin SOVG'A qilgan NFC ID'lar har doim "Ekslyuziv"
  // ko'rinishi kerak. Shu ustun NULL bo'lmasa — profilda o'sha daraja
  // ko'rsatiladi (faqat vizual: rang/badge/emoji; narx mantig'iga tegmaydi).
  await pool.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS tier_override VARCHAR(12)`);
  // Tasdiqlangan profil — admin qo'lда beradi (haqiqiy shaxs / rasmiy biznes).
  // Faqat vizual "✔" belgisi; tarif/narx/access mantig'iga tegmaydi (PHASE 5).
  await pool.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE`);
  // Retroaktiv: allaqachon faollashtirilgan sovg'a kartalari ham Ekslyuziv bo'lsin.
  await pool.query(`
    UPDATE cards SET tier_override = 'exclusive'
    WHERE tier_override IS NULL
      AND code IN (SELECT code FROM nfc_gifts WHERE status = 'activated')
  `);

  // Profil postlari — egasi profilga rasm + izoh joylaydi; tashrif
  // buyuruvchilar like bosishi mumkin. Kartalar (card_likes) laykidan
  // butunlay alohida.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id         SERIAL PRIMARY KEY,
      code       VARCHAR(16) NOT NULL,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      image_url  TEXT NOT NULL,
      caption    TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS posts_code_idx ON posts (code, created_at DESC)`);
  // Post'ga video biriktirish — video endi FAQAT post orqali qo'yiladi.
  {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'video_url'`);
    if (!rows.length) {
      await pool.query(`ALTER TABLE posts ADD COLUMN video_url TEXT`);
      await pool.query(`ALTER TABLE posts ALTER COLUMN image_url DROP NOT NULL`);
      console.log('[db] posts.video_url ustuni qo’shildi.');
    }
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS post_likes (
      id         SERIAL PRIMARY KEY,
      post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (post_id, user_id)
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS follows_followee_idx ON follows (followee_id)`);

  // Suhbatlar va xabarlar (Direct Messages). Har bir juftlik uchun bitta
  // conversation — user_a_id har doim KICHIKROQ id, shuning uchun
  // (A,B) va (B,A) ikkita alohida qatorga aylanib ketmaydi.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id          SERIAL PRIMARY KEY,
      user_a_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_b_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_a_id, user_b_id),
      CHECK (user_a_id < user_b_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id               SERIAL PRIMARY KEY,
      conversation_id  INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body             TEXT NOT NULL,
      is_read          BOOLEAN NOT NULL DEFAULT FALSE,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  // Suhbat tarixini tez o'qish uchun (conversation_id, created_at) — eng
  // ko'p ishlatiladigan so'rov shakli shu.
  await pool.query(`CREATE INDEX IF NOT EXISTS messages_conv_idx ON messages (conversation_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS messages_unread_idx ON messages (conversation_id) WHERE is_read = FALSE`);

  // Telegram bot orqali "kontakt ulashish" tugmasi bilan tasdiqlangan
  // ism-familya + telefon raqamlar — ro'yxatdan o'tishda shu jadval bilan
  // solishtiriladi (honor-system checkbox'dan ko'ra ishonchliroq tekshiruv).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_verifications (
      id           SERIAL PRIMARY KEY,
      phone        TEXT UNIQUE NOT NULL,
      tg_user_id   BIGINT NOT NULL,
      tg_name      TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // ---- place_bid(): butun taklif jarayonini bitta atomik RPC ichiga oladi ----
  // SECURITY DEFINER: funksiya uni yaratgan (DB egasi) huquqi bilan ishlaydi,
  // shu bilan wallets/bids'ga to'g'ridan-to'g'ri UPDATE/INSERT emas, faqat shu
  // nazorat qilinadigan yo'l orqali o'zgartirish kiritilishini kafolatlaydi.
  // Aniq xatolik kodlari qaytaradi (frontend shu kodlar bo'yicha xabar ko'rsatadi):
  //   AUCTION_NOT_FOUND, AUCTION_ALREADY_CLOSED, OWN_AUCTION, BID_TOO_LOW,
  //   INSUFFICIENT_NFC_COINS
  await pool.query(`
    CREATE OR REPLACE FUNCTION place_bid(
      p_user_id INTEGER,
      p_auction_id INTEGER,
      p_amount BIGINT,
      p_idempotency_key TEXT
    ) RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      v_auction     RECORD;
      v_buy_now     BOOLEAN := FALSE;
      v_bid_id      INTEGER;
      v_new_ends_at TIMESTAMPTZ;
      v_snipe       BOOLEAN := FALSE;
    BEGIN
      IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'BID_TOO_LOW');
      END IF;

      -- Idempotentlik: shu kalit bilan taklif avval qayta ishlangan bo'lsa,
      -- qaytadan yozmasdan o'sha natijani qaytaramiz (tarmoq uzilib qayta
      -- so'rov yuborilgan holatlarda ikki marta yozilib qolmasligi uchun).
      SELECT id INTO v_bid_id FROM bids WHERE idempotency_key = p_idempotency_key;
      IF FOUND THEN
        RETURN jsonb_build_object('ok', true, 'idempotent', true, 'bidId', v_bid_id);
      END IF;

      -- Auksionni qulflaymiz — parallel takliflar navbat bilan ishlanadi,
      -- dirty read va poyga holati (race condition) bo'lmaydi. E-wallet
      -- yo'qligi sababli bu yerda balans bilan ishlanmaydi — taklif
      -- BEPUL, real to'lov faqat g'olib chiqqanda amalga oshadi.
      SELECT id, seller_id, current_price, buy_now_price, highest_bidder_id, status, ends_at,
             COALESCE(min_increment, 0) AS min_increment
        INTO v_auction FROM auctions WHERE id = p_auction_id FOR UPDATE;

      IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'AUCTION_NOT_FOUND');
      END IF;
      IF v_auction.status <> 'active' OR v_auction.ends_at <= now() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'AUCTION_ALREADY_CLOSED');
      END IF;
      IF v_auction.seller_id = p_user_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'OWN_AUCTION');
      END IF;
      -- Birinchi taklif: current_price (= start_price) dan katta yoki teng.
      -- Keyingi takliflar: joriy narx + minimal qadam dan kam bo'lmasin.
      IF v_auction.highest_bidder_id IS NULL THEN
        IF p_amount < v_auction.current_price THEN
          RETURN jsonb_build_object('ok', false, 'error', 'BID_TOO_LOW');
        END IF;
      ELSE
        IF p_amount < v_auction.current_price + v_auction.min_increment THEN
          RETURN jsonb_build_object('ok', false, 'error', 'BID_TOO_LOW', 'minNext', v_auction.current_price + v_auction.min_increment);
        END IF;
      END IF;

      INSERT INTO bids (auction_id, user_id, amount, idempotency_key)
        VALUES (p_auction_id, p_user_id, p_amount, p_idempotency_key)
        RETURNING id INTO v_bid_id;

      v_buy_now := v_auction.buy_now_price IS NOT NULL AND p_amount >= v_auction.buy_now_price;

      -- ANTI-SNIPE: tugashiga 5 daqiqadan kam qolganda valid taklif kelsa,
      -- muddat joriy tugash vaqtidan +5 daqiqaga suriladi (kumulyativ).
      IF NOT v_buy_now AND (v_auction.ends_at - now()) <= interval '5 minutes' THEN
        v_new_ends_at := v_auction.ends_at + interval '5 minutes';
        v_snipe := TRUE;
      ELSE
        v_new_ends_at := v_auction.ends_at;
      END IF;

      IF v_buy_now THEN
        -- "Darhol sotib olish" narxiga yetdi: auksion so'rov qabul
        -- qilishni to'xtatadi, g'olibga 24 soatlik REAL to'lov muddati
        -- beriladi (pul hali harakatlanmagan!).
        UPDATE auctions SET
            current_price = p_amount,
            highest_bidder_id = p_user_id,
            status = 'awaiting_payment',
            ends_at = now(),
            payment_deadline = now() + interval '24 hours'
          WHERE id = p_auction_id;
      ELSE
        UPDATE auctions SET
            current_price = p_amount,
            highest_bidder_id = p_user_id,
            ends_at = v_new_ends_at
          WHERE id = p_auction_id;
      END IF;

      RETURN jsonb_build_object('ok', true, 'buyNow', v_buy_now, 'bidId', v_bid_id, 'antiSnipe', v_snipe, 'newEndsAt', v_new_ends_at);
    EXCEPTION WHEN unique_violation THEN
      -- Bir xil idempotency_key bilan bir vaqtda ikkita so'rov kirib kelsa.
      RETURN jsonb_build_object('ok', true, 'idempotent', true);
    END;
    $$;
  `);

  // Yangiliklar — faqat admin joylaydi, hamma o'qiydi. title/body — o'zbekcha
  // (asosiy); title_ru/en, body_ru/en — tarjimalar (bo'sh bo'lsa o'zbekchaga
  // qaytiladi).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS news (
      id         SERIAL PRIMARY KEY,
      title      TEXT NOT NULL,
      body       TEXT NOT NULL DEFAULT '',
      image_url  TEXT NOT NULL DEFAULT '',
      published  BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'news'`
    );
    const have = new Set(rows.map((r) => r.column_name));
    for (const col of ['title_ru', 'title_en', 'body_ru', 'body_en']) {
      if (!have.has(col)) {
        await pool.query(`ALTER TABLE news ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`);
        console.log(`[db] news.${col} ustuni qo’shildi.`);
      }
    }
    if (!have.has('views')) {
      await pool.query(`ALTER TABLE news ADD COLUMN views INTEGER NOT NULL DEFAULT 0`);
      console.log('[db] news.views ustuni qo’shildi.');
    }
  }
  // Yangilik like'lari — anonim (visitor_hash bo'yicha bir marta).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS news_likes (
      news_id      INTEGER NOT NULL REFERENCES news(id) ON DELETE CASCADE,
      visitor_hash VARCHAR(64) NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (news_id, visitor_hash)
    )
  `);

  // ── Katalog kategoriyalari (soha → kichik soha) ─────────────────────
  // Dinamik: admin qo'shadi/tahrirlaydi/o'chiradi (Band 2.5). Seed faqat
  // bo'sh bo'lganda yoki slug topilmaganda qo'shiladi (idempotent).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id          SERIAL PRIMARY KEY,
      slug        VARCHAR(60) UNIQUE NOT NULL,
      parent_slug VARCHAR(60),
      name_uz     TEXT NOT NULL,
      name_ru     TEXT NOT NULL DEFAULT '',
      name_en     TEXT NOT NULL DEFAULT '',
      sort        INTEGER NOT NULL DEFAULT 0,
      enabled     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS categories_parent_idx ON categories (parent_slug)`);
  // cards.category_slug — profil tanlagan kichik soha (yoki asosiy soha).
  {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'cards' AND column_name = 'category_slug'`);
    if (!rows.length) {
      await pool.query(`ALTER TABLE cards ADD COLUMN category_slug VARCHAR(60)`);
      console.log('[db] cards.category_slug ustuni qo’shildi.');
    }
  }
  await seedCategories();

  // ── Profil hodisalari (Analytics — Band 3.1) ───────────────────────
  // Yengil tracking: har profil ko'rish / havola bosish bitta qator.
  // Mavjud cards.views hisoblagichiga tegmaydi — parallel ishlaydi.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS card_events (
      id           BIGSERIAL PRIMARY KEY,
      code         VARCHAR(16) NOT NULL,
      event_type   VARCHAR(24) NOT NULL,
      ref          TEXT,
      visitor_hash VARCHAR(64),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS card_events_code_time_idx ON card_events (code, created_at DESC)`);

  // ── Lead Capture (Band 3.2) ────────────────────────────────────────
  // Tashrifchi "Kontaktingizni qoldiring" formasi orqali qoldirgan
  // kontaktlar. Mavjud vCard / xabarlashish tizimiga tegmaydi.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS card_leads (
      id           BIGSERIAL PRIMARY KEY,
      code         VARCHAR(16) NOT NULL,
      name         TEXT NOT NULL,
      phone        TEXT,
      telegram     TEXT,
      whatsapp     TEXT,
      email        TEXT,
      company      TEXT,
      note         TEXT,
      visitor_hash VARCHAR(64),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS card_leads_code_time_idx ON card_leads (code, created_at DESC)`);
  // cards.lead_capture — egasi lead formasini yoqadi (default o'chiq).
  {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'cards' AND column_name = 'lead_capture'`);
    if (!rows.length) {
      await pool.query(`ALTER TABLE cards ADD COLUMN lead_capture BOOLEAN NOT NULL DEFAULT FALSE`);
      console.log('[db] cards.lead_capture ustuni qo’shildi.');
    }
  }

  // ── Restoran menyusi (Band 3.3) ───────────────────────────────────
  // Profil ICHIDA modul — alohida profil tizimi emas. Kategoriya → taom.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS menu_categories (
      id         BIGSERIAL PRIMARY KEY,
      code       VARCHAR(16) NOT NULL,
      name       TEXT NOT NULL,
      sort       INTEGER NOT NULL DEFAULT 0,
      enabled    BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS menu_categories_code_idx ON menu_categories (code, sort)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id             BIGSERIAL PRIMARY KEY,
      code           VARCHAR(16) NOT NULL,
      category_id    BIGINT NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
      name           TEXT NOT NULL,
      description    TEXT,
      price          BIGINT,
      discount_price BIGINT,
      image_url      TEXT,
      available      BOOLEAN NOT NULL DEFAULT TRUE,
      featured       BOOLEAN NOT NULL DEFAULT FALSE,
      sort           INTEGER NOT NULL DEFAULT 0,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS menu_items_code_idx ON menu_items (code, category_id, sort)`);

  // ── Mahsulotlar katalogi (Company System — Products) ───────────────
  // menu_categories/menu_items bilan bir xil naqsh, lekin ovqatlanish
  // sohasi bilan cheklanmagan — istalgan biznes profil uchun.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_categories (
      id         BIGSERIAL PRIMARY KEY,
      code       VARCHAR(16) NOT NULL,
      name       TEXT NOT NULL,
      sort       INTEGER NOT NULL DEFAULT 0,
      enabled    BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS product_categories_code_idx ON product_categories (code, sort)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id             BIGSERIAL PRIMARY KEY,
      code           VARCHAR(16) NOT NULL,
      category_id    BIGINT NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
      name           TEXT NOT NULL,
      description    TEXT,
      price          BIGINT,
      discount_price BIGINT,
      image_url      TEXT,
      available      BOOLEAN NOT NULL DEFAULT TRUE,
      featured       BOOLEAN NOT NULL DEFAULT FALSE,
      sort           INTEGER NOT NULL DEFAULT 0,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS products_code_idx ON products (code, category_id, sort)`);

  // ── Fayl / PDF / katalog (Band 3.4) ───────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS card_files (
      id          BIGSERIAL PRIMARY KEY,
      code        VARCHAR(16) NOT NULL,
      title       TEXT NOT NULL,
      file_url    TEXT NOT NULL,
      size_bytes  BIGINT,
      sort        INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS card_files_code_idx ON card_files (code, sort)`);

  // ── Video (PHASE 4) ──────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS card_videos (
      id          BIGSERIAL PRIMARY KEY,
      code        VARCHAR(16) NOT NULL,
      video_url   TEXT NOT NULL,
      thumb_url   TEXT,
      title       TEXT,
      size_bytes  BIGINT,
      sort        INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS card_videos_code_idx ON card_videos (code, sort)`);

  // ── Jamoa / Team (PHASE 5) — biznes profil a'zolari ───────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS card_team (
      id           BIGSERIAL PRIMARY KEY,
      code         VARCHAR(16) NOT NULL,
      name         TEXT NOT NULL,
      position     TEXT,
      photo_url    TEXT,
      member_code  VARCHAR(16),
      sort         INTEGER NOT NULL DEFAULT 0,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS card_team_code_idx ON card_team (code, sort)`);

  // ── Auksion "Talab" board (demand) ───────────────────────────────
  // Foydalanuvchilar "Auksionda qatnashaman" bosib qiziqish bildiradi.
  // AUCTION_DEMAND_THRESHOLD (20) ta unique hisob yig'ilganda admin +
  // Telegram xabar oladi va "Auksionni boshlash mumkin" bo'ladi.
  // Mavjud auctions / auction_requests jadvallariga TEGMAYDI.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auction_demand (
      id                    SERIAL PRIMARY KEY,
      code                  VARCHAR(16) NOT NULL UNIQUE,
      status                VARCHAR(20) NOT NULL DEFAULT 'collecting', -- collecting | ready | auction_live | done | hidden
      suggested_start_price BIGINT NOT NULL DEFAULT 250000,
      suggested_min_step    BIGINT NOT NULL DEFAULT 25000,
      interest_count        INTEGER NOT NULL DEFAULT 0,
      auction_id            INTEGER REFERENCES auctions(id) ON DELETE SET NULL,
      notified_ready_at     TIMESTAMPTZ,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS auction_demand_status_idx ON auction_demand (status, interest_count DESC)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auction_demand_votes (
      demand_id  INTEGER NOT NULL REFERENCES auction_demand(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (demand_id, user_id)
    )
  `);

  // Auksion minimal qadam (bid step) — har auksionга alohida, admin belgilaydi.
  {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'auctions' AND column_name = 'min_increment'`);
    if (!rows.length) {
      await pool.query(`ALTER TABLE auctions ADD COLUMN min_increment BIGINT NOT NULL DEFAULT 25000`);
      console.log('[db] auctions.min_increment ustuni qo’shildi.');
    }
  }

  // Public "Sovg'alar" sahifasi — faqat SHU vaqtdan keyin qabul qilingan
  // sovg'alar ommaviy ko'rinadi. Eski sovg'a tarixi (foydalanuvchilar buni
  // kutmagan) public'ga chiqmaydi. Birinchi deploy vaqti bir marta yoziladi.
  {
    const existing = await pool.query(`SELECT 1 FROM admin_settings WHERE key = 'public_gifts_cutoff'`);
    if (!existing.rows.length) {
      await pool.query(
        `INSERT INTO admin_settings (key, value) VALUES ('public_gifts_cutoff', $1) ON CONFLICT (key) DO NOTHING`,
        [new Date().toISOString()]
      );
      console.log('[db] public_gifts_cutoff belgilandi.');
    }
  }

  // SPECIAL TIER klassifikatsiyasi bekor qilindi — grandfather "muzlatish"ni
  // tozalaymiz (VIP001 endi naqsh bo'yicha o'zi exclusive). Bir marta ishlaydi.
  {
    const done = await pool.query(`SELECT 1 FROM admin_settings WHERE key = 'tier_grandfather_v1'`);
    if (done.rows.length) {
      await pool.query(`UPDATE cards SET tier_override = NULL WHERE code = 'VIP001' AND tier_override = 'exclusive'`).catch(() => {});
      await pool.query(`DELETE FROM admin_settings WHERE key = 'tier_grandfather_v1'`).catch(() => {});
      console.log('[db] tier_grandfather_v1 bekor qilindi.');
    }
  }

  // Sotilgan auksion narxlarini bir martalik to'g'rilash (egasi so'rovi) —
  // faqat hozirgi (test) qiymatga teng bo'lsa yangilanadi (idempotent).
  for (const [code, wrong, right] of [
    ['OOO000', 200000, 8700000],
    ['III777', 500000000, 7300000],
    ['VVV444', 300000, 2900000],
  ]) {
    const r = await pool.query(
      `UPDATE auctions SET current_price = $3 WHERE code = $1 AND status = 'sold' AND current_price = $2`,
      [code, wrong, right]
    ).catch(() => ({ rowCount: 0 }));
    if (r.rowCount) console.log(`[db] ${code} sotilgan narxi ${right} ga to'g'rilandi.`);
  }

  // ═══════════════ MOLIYA / BUXGALTERIYA MODULI ═══════════════
  // FAQAT yangi jadvallar — mavjud to'lov/buyurtma sxemasiga (web_orders,
  // transactions, bot_orders) TEGILMAYDI. Bu modul ulardan faqat O'QIYDI.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance_rates (
      id             SERIAL PRIMARY KEY,
      scope          VARCHAR(12) NOT NULL,               -- 'payme' | 'bank' | 'tax'
      params         JSONB NOT NULL DEFAULT '{}'::jsonb,
      effective_from DATE NOT NULL,
      note           TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS finance_rates_scope_idx ON finance_rates (scope, effective_from DESC)`);
  // Har scope uchun bitta bo'sh (nol) boshlang'ich qator — admin bank bilan
  // kelishib real foizlarni keyin kiritadi. HARD-CODE YO'Q.
  for (const scope of ['payme', 'bank', 'tax']) {
    const { rows } = await pool.query(`SELECT 1 FROM finance_rates WHERE scope = $1 LIMIT 1`, [scope]);
    if (!rows.length) {
      const params = scope === 'payme' ? { pct: 0, fixed: 0, mode: 'settlement_deducted' }
        : scope === 'bank' ? { cashPct: 0, transferPct: 0, monthlyFee: 0, extraFee: 0 }
        : { turnoverPct: 0, socialMonthly: 0 };
      await pool.query(
        `INSERT INTO finance_rates (scope, params, effective_from, note)
         VALUES ($1, $2::jsonb, CURRENT_DATE, 'Boshlang''ich — hali to''ldirilmagan')`,
        [scope, JSON.stringify(params)]
      );
      console.log(`[db] finance_rates: '${scope}' boshlang'ich qator yaratildi.`);
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance_expenses (
      id         SERIAL PRIMARY KEY,
      title      TEXT NOT NULL,
      category   VARCHAR(24) NOT NULL DEFAULT 'other',
      amount     BIGINT NOT NULL,
      spent_on   DATE NOT NULL,
      note       TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS finance_expenses_date_idx ON finance_expenses (spent_on DESC)`);

  // Bankka real tushgan pul — oy bo'yicha admin qo'lda kiritadi (Trastbank
  // hisob varag'idan). Reconciliation shu bilan "expected"ni solishtiradi.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance_bank_actuals (
      period        VARCHAR(7) PRIMARY KEY,              -- 'YYYY-MM'
      actual_amount BIGINT NOT NULL DEFAULT 0,
      note          TEXT,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance_docs (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      doc_type   VARCHAR(16) NOT NULL DEFAULT 'other',   -- payme_report | bank_statement | tax | invoice | receipt | other
      period     VARCHAR(16),
      url        TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  dbReady = true;
  console.log('[db] PostgreSQL ulanishi va schema tayyor.');
  return true;
}

// Boshlang'ich kategoriyalar — slug bo'yicha idempotent (mavjudi o'zgarmaydi).
const CATEGORY_SEED = [
  ['it', null, 'IT va texnologiyalar', 'IT и технологии', 'IT & technology', 10],
    ['it-web', 'it', 'Veb-dasturlash', 'Веб-разработка', 'Web development', 1],
    ['it-mobile', 'it', 'Mobil dasturlash', 'Мобильная разработка', 'Mobile development', 2],
    ['it-software', 'it', 'Dasturiy ta’minot', 'Программное обеспечение', 'Software', 3],
    ['it-security', 'it', 'Kiberxavfsizlik', 'Кибербезопасность', 'Cybersecurity', 4],
    ['it-services', 'it', 'IT xizmatlar / autsorsing', 'IT-услуги / аутсорсинг', 'IT services / outsourcing', 5],
    ['it-telecom', 'it', 'Telekommunikatsiya', 'Телекоммуникации', 'Telecom', 6],
  ['construction', null, 'Qurilish va ta’mirlash', 'Строительство и ремонт', 'Construction & renovation', 20],
    ['con-architecture', 'construction', 'Arxitektura', 'Архитектура', 'Architecture', 1],
    ['con-interior', 'construction', 'Interyer dizayni', 'Дизайн интерьера', 'Interior design', 2],
    ['con-materials', 'construction', 'Qurilish materiallari', 'Стройматериалы', 'Building materials', 3],
    ['con-contractor', 'construction', 'Pudratchi / usta', 'Подрядчик / мастер', 'Contractor', 4],
  ['realestate', null, 'Ko’chmas mulk', 'Недвижимость', 'Real estate', 30],
    ['re-agency', 'realestate', 'Agentlik', 'Агентство', 'Agency', 1],
    ['re-rent', 'realestate', 'Ijara', 'Аренда', 'Rentals', 2],
  ['food', null, 'Restoran va ovqatlanish', 'Рестораны и питание', 'Food & dining', 40],
    ['food-restaurant', 'food', 'Restoran', 'Ресторан', 'Restaurant', 1],
    ['food-cafe', 'food', 'Kafe', 'Кафе', 'Cafe', 2],
    ['food-fastfood', 'food', 'Fast food', 'Фастфуд', 'Fast food', 3],
    ['food-bakery', 'food', 'Nonvoyxona / qandolat', 'Пекарня / кондитерская', 'Bakery', 4],
    ['food-catering', 'food', 'Ketering', 'Кейтеринг', 'Catering', 5],
  ['hospitality', null, 'Mehmonxona va turizm', 'Отели и туризм', 'Hospitality & tourism', 50],
    ['hos-hotel', 'hospitality', 'Mehmonxona', 'Отель', 'Hotel', 1],
    ['hos-travel', 'hospitality', 'Turagentlik', 'Турагентство', 'Travel agency', 2],
  ['retail', null, 'Savdo va do’konlar', 'Торговля и магазины', 'Retail & shops', 60],
    ['retail-shop', 'retail', 'Do’kon', 'Магазин', 'Shop', 1],
    ['retail-online', 'retail', 'Onlayn do’kon', 'Интернет-магазин', 'Online shop', 2],
    ['retail-wholesale', 'retail', 'Ulgurji savdo', 'Оптовая торговля', 'Wholesale', 3],
  ['transport', null, 'Transport va logistika', 'Транспорт и логистика', 'Transport & logistics', 70],
    ['tr-logistics', 'transport', 'Logistika', 'Логистика', 'Logistics', 1],
    ['tr-auto-dealer', 'transport', 'Avtosalon', 'Автосалон', 'Car dealership', 2],
    ['tr-auto-service', 'transport', 'Avtoservis', 'Автосервис', 'Auto service', 3],
    ['tr-taxi', 'transport', 'Taksi / yetkazib berish', 'Такси / доставка', 'Taxi / delivery', 4],
  ['medicine', null, 'Tibbiyot va sog’liq', 'Медицина и здоровье', 'Medicine & health', 80],
    ['med-clinic', 'medicine', 'Klinika', 'Клиника', 'Clinic', 1],
    ['med-dental', 'medicine', 'Stomatologiya', 'Стоматология', 'Dentistry', 2],
    ['med-pharmacy', 'medicine', 'Dorixona', 'Аптека', 'Pharmacy', 3],
    ['med-lab', 'medicine', 'Laboratoriya', 'Лаборатория', 'Lab', 4],
  ['beauty', null, 'Go’zallik va parvarish', 'Красота и уход', 'Beauty & care', 90],
    ['beauty-salon', 'beauty', 'Go’zallik saloni', 'Салон красоты', 'Beauty salon', 1],
    ['beauty-barber', 'beauty', 'Sartaroshxona', 'Барбершоп', 'Barbershop', 2],
    ['beauty-cosmetology', 'beauty', 'Kosmetologiya', 'Косметология', 'Cosmetology', 3],
    ['beauty-spa', 'beauty', 'SPA / massaj', 'SPA / массаж', 'Spa / massage', 4],
  ['education', null, 'Ta’lim', 'Образование', 'Education', 100],
    ['edu-center', 'education', 'O’quv markaz', 'Учебный центр', 'Training center', 1],
    ['edu-school', 'education', 'Maktab', 'Школа', 'School', 2],
    ['edu-university', 'education', 'Universitet', 'Университет', 'University', 3],
    ['edu-tutor', 'education', 'Repetitor', 'Репетитор', 'Tutor', 4],
  ['finance', null, 'Moliya', 'Финансы', 'Finance', 110],
    ['fin-bank', 'finance', 'Bank', 'Банк', 'Bank', 1],
    ['fin-accounting', 'finance', 'Buxgalteriya', 'Бухгалтерия', 'Accounting', 2],
    ['fin-insurance', 'finance', 'Sug’urta', 'Страхование', 'Insurance', 3],
  ['legal', null, 'Yuridik va konsalting', 'Юридические услуги и консалтинг', 'Legal & consulting', 120],
    ['legal-law', 'legal', 'Advokat / yurist', 'Адвокат / юрист', 'Lawyer', 1],
    ['legal-consulting', 'legal', 'Konsalting', 'Консалтинг', 'Consulting', 2],
  ['marketing', null, 'Marketing va reklama', 'Маркетинг и реклама', 'Marketing & advertising', 130],
    ['mkt-smm', 'marketing', 'SMM', 'SMM', 'SMM', 1],
    ['mkt-ads', 'marketing', 'Reklama', 'Реклама', 'Advertising', 2],
    ['mkt-branding', 'marketing', 'Brending', 'Брендинг', 'Branding', 3],
  ['media', null, 'Media va ijod', 'Медиа и творчество', 'Media & creative', 140],
    ['media-photo', 'media', 'Fotografiya', 'Фотография', 'Photography', 1],
    ['media-video', 'media', 'Videografiya', 'Видеография', 'Videography', 2],
    ['media-design', 'media', 'Grafik dizayn', 'Графический дизайн', 'Graphic design', 3],
    ['media-print', 'media', 'Poligrafiya', 'Полиграфия', 'Printing', 4],
  ['sport', null, 'Sport va fitnes', 'Спорт и фитнес', 'Sport & fitness', 150],
    ['sport-gym', 'sport', 'Sport zali / fitnes', 'Спортзал / фитнес', 'Gym / fitness', 1],
  ['events', null, 'Tadbirlar', 'Мероприятия', 'Events', 160],
    ['events-agency', 'events', 'Tadbir agentligi', 'Event-агентство', 'Event agency', 1],
    ['events-decor', 'events', 'Dekor / bezash', 'Декор / оформление', 'Decor', 2],
  ['agriculture', null, 'Qishloq xo’jaligi', 'Сельское хозяйство', 'Agriculture', 170],
  ['manufacturing', null, 'Ishlab chiqarish', 'Производство', 'Manufacturing', 180],
  ['services', null, 'Xizmatlar', 'Услуги', 'Services', 190],
  ['freelance', null, 'Frilanser', 'Фрилансер', 'Freelance', 200],
  ['other', null, 'Boshqa', 'Другое', 'Other', 999],
];

async function seedCategories() {
  for (const [slug, parent, uz, ru, en, sort] of CATEGORY_SEED) {
    await pool.query(
      `INSERT INTO categories (slug, parent_slug, name_uz, name_ru, name_en, sort)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (slug) DO NOTHING`,
      [slug, parent, uz, ru, en, sort]
    );
  }
}

export async function listCategories({ includeDisabled = false } = {}) {
  if (!dbReady) return [];
  const { rows } = await pool.query(
    `SELECT id, slug, parent_slug AS "parentSlug", name_uz AS "nameUz", name_ru AS "nameRu",
            name_en AS "nameEn", sort, enabled
       FROM categories ${includeDisabled ? '' : 'WHERE enabled = TRUE'}
      ORDER BY sort, name_uz`
  );
  return rows;
}
export async function categorySlugValid(slug) {
  if (!slug) return true; // bo'sh — ruxsat
  const { rows } = await pool.query(`SELECT 1 FROM categories WHERE slug = $1 AND enabled = TRUE`, [slug]);
  return !!rows[0];
}
export async function adminCreateCategory(f) {
  const { rows } = await pool.query(
    `INSERT INTO categories (slug, parent_slug, name_uz, name_ru, name_en, sort, enabled)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, slug, parent_slug AS "parentSlug", name_uz AS "nameUz", name_ru AS "nameRu", name_en AS "nameEn", sort, enabled`,
    [f.slug, f.parentSlug || null, f.nameUz, f.nameRu || '', f.nameEn || '', f.sort || 0, f.enabled !== false]
  );
  return rows[0];
}
export async function adminUpdateCategory(id, f) {
  const { rows } = await pool.query(
    `UPDATE categories SET
        name_uz = COALESCE($2, name_uz), name_ru = COALESCE($3, name_ru), name_en = COALESCE($4, name_en),
        sort = COALESCE($5, sort), enabled = COALESCE($6, enabled), parent_slug = COALESCE($7, parent_slug)
      WHERE id = $1
      RETURNING id, slug, parent_slug AS "parentSlug", name_uz AS "nameUz", name_ru AS "nameRu", name_en AS "nameEn", sort, enabled`,
    [id, f.nameUz ?? null, f.nameRu ?? null, f.nameEn ?? null, f.sort ?? null, f.enabled ?? null, f.parentSlug ?? null]
  );
  return rows[0] || null;
}
export async function adminDeleteCategory(id) {
  await pool.query(`DELETE FROM categories WHERE id = $1`, [id]);
}

// ---------- Yangiliklar ----------
const NEWS_COLS = `
  id, title, body,
  title_ru AS "titleRu", title_en AS "titleEn",
  body_ru AS "bodyRu", body_en AS "bodyEn",
  image_url AS "imageUrl", published, views,
  created_at AS "createdAt", updated_at AS "updatedAt"`;

export async function listNews({ includeUnpublished = false } = {}) {
  if (!dbReady) return [];
  const where = includeUnpublished ? '' : 'WHERE n.published = TRUE';
  const { rows } = await pool.query(
    `SELECT n.id, n.title, n.body,
            n.title_ru AS "titleRu", n.title_en AS "titleEn",
            n.body_ru AS "bodyRu", n.body_en AS "bodyEn",
            n.image_url AS "imageUrl", n.published, n.views,
            n.created_at AS "createdAt", n.updated_at AS "updatedAt",
            (SELECT COUNT(*)::int FROM news_likes l WHERE l.news_id = n.id) AS "likeCount"
       FROM news n ${where} ORDER BY n.created_at DESC LIMIT 100`
  );
  return rows;
}

export async function incrementNewsViews(id) {
  await pool.query(`UPDATE news SET views = views + 1 WHERE id = $1`, [id]);
}

// like toggle — visitor_hash bo'yicha. { liked, count } qaytaradi.
export async function toggleNewsLike(id, visitorHash) {
  const del = await pool.query(
    `DELETE FROM news_likes WHERE news_id = $1 AND visitor_hash = $2`, [id, visitorHash]
  );
  if (del.rowCount === 0) {
    await pool.query(
      `INSERT INTO news_likes (news_id, visitor_hash) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`, [id, visitorHash]
    );
  }
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM news_likes WHERE news_id = $1`, [id]
  );
  return { liked: del.rowCount === 0, count: rows[0]?.n || 0 };
}

export async function newsLikedBy(visitorHash) {
  if (!visitorHash) return [];
  const { rows } = await pool.query(
    `SELECT news_id AS "newsId" FROM news_likes WHERE visitor_hash = $1`, [visitorHash]
  );
  return rows.map((r) => r.newsId);
}
export async function adminCreateNews(f) {
  const { rows } = await pool.query(
    `INSERT INTO news (title, body, title_ru, title_en, body_ru, body_en, image_url, published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING ${NEWS_COLS}`,
    [
      f.title, f.body || '',
      f.titleRu || '', f.titleEn || '', f.bodyRu || '', f.bodyEn || '',
      f.imageUrl || '', f.published !== false,
    ]
  );
  return rows[0];
}
export async function adminUpdateNews(id, f) {
  const { rows } = await pool.query(
    `UPDATE news SET
        title = COALESCE($2, title),
        body = COALESCE($3, body),
        title_ru = COALESCE($4, title_ru),
        title_en = COALESCE($5, title_en),
        body_ru = COALESCE($6, body_ru),
        body_en = COALESCE($7, body_en),
        image_url = COALESCE($8, image_url),
        published = COALESCE($9, published),
        updated_at = now()
      WHERE id = $1
      RETURNING ${NEWS_COLS}`,
    [
      id,
      f.title ?? null, f.body ?? null,
      f.titleRu ?? null, f.titleEn ?? null, f.bodyRu ?? null, f.bodyEn ?? null,
      f.imageUrl ?? null, f.published ?? null,
    ]
  );
  return rows[0] || null;
}
export async function adminDeleteNews(id) {
  await pool.query(`DELETE FROM news WHERE id = $1`, [id]);
}

export function isDbReady() {
  return dbReady;
}

const SELECT_FIELDS = `
  code, name, role, avatar_url AS "avatarUrl", bg_url AS "bgUrl", bg_pattern AS "bgPattern",
  accent_color AS "accentColor", bg_color AS "bgColor", bg_animated AS "bgAnimated", music_url AS "musicUrl",
  links_transparent AS "linksTransparent", link_style AS "linkStyle",
  profile_type AS "profileType", city, category_slug AS "categorySlug", hidden_from_directory AS "hiddenFromDirectory",
  lead_capture AS "leadCapture",
  is_primary AS "isPrimary", giftable, hide_phone AS "hidePhone",
  tg, phone, email,
  linkedin, instagram, about, facebook, twitter, website,
  card_number AS "cardNumber", extra_links AS "extraLinks", card_numbers AS "cardNumbers",
  tier_override AS "tierOverride", card_design AS "cardDesign", verified,
  theme, for_sale AS "forSale",
  sale_price AS "salePrice", hashtags, price, ts, views
`;

function rowToRecord(row) {
  return {
    code: row.code,
    name: row.name,
    role: row.role || '',
    avatarUrl: row.avatarUrl || '',
    bgUrl: row.bgUrl || '',
    bgPattern: row.bgPattern !== false,
    accentColor: row.accentColor || '',
    bgColor: row.bgColor || '',
    bgAnimated: row.bgAnimated !== false,
    isPrimary: !!row.isPrimary,
    hidePhone: !!row.hidePhone,
    giftable: row.giftable !== false,
    linksTransparent: !!row.linksTransparent,
    linkStyle: ['standard', 'transparent', 'glass'].includes(row.linkStyle) ? row.linkStyle : 'standard',
    profileType: ['personal', 'expert', 'business'].includes(row.profileType) ? row.profileType : 'personal',
    city: row.city || '',
    categorySlug: row.categorySlug || '',
    hiddenFromDirectory: !!row.hiddenFromDirectory,
    leadCapture: !!row.leadCapture,
    musicUrl: row.musicUrl || '',
    tg: row.tg || '',
    phone: row.phone || '',
    email: row.email || '',
    linkedin: row.linkedin || '',
    instagram: row.instagram || '',
    about: row.about || '',
    facebook: row.facebook || '',
    twitter: row.twitter || '',
    website: row.website || '',
    cardNumber: row.cardNumber || '',
    extraLinks: Array.isArray(row.extraLinks) ? row.extraLinks : [],
    cardNumbers: Array.isArray(row.cardNumbers) ? row.cardNumbers : [],
    tierOverride: row.tierOverride || '',
    verified: !!row.verified,
    cardDesign: row.cardDesign && typeof row.cardDesign === 'object' ? row.cardDesign : null,
    theme: row.theme || 'classic',
    forSale: !!row.forSale,
    salePrice: row.salePrice != null ? Number(row.salePrice) : null,
    hashtags: Array.isArray(row.hashtags) ? row.hashtags : [],
    price: Number(row.price),
    ts: Number(row.ts),
    views: Number(row.views),
  };
}

// Katalog / qidiruv uchun — YASHIRILGAN profillar chiqmaydi.
export async function listRecords({ includeHidden = false } = {}) {
  const { rows } = await pool.query(
    `SELECT code, name, role, avatar_url AS "avatarUrl", tg, hashtags, theme, price, ts, views,
            profile_type AS "profileType", city, category_slug AS "categorySlug", verified,
            hidden_from_directory AS "hiddenFromDirectory"
       FROM cards
      ${includeHidden ? '' : 'WHERE hidden_from_directory = FALSE'}
      ORDER BY ts DESC LIMIT 500`
  );
  return rows.map(rowToRecord);
}

// Katalog qidiruvi — SERVERда moslashtiradi: kod / ism / kasb / shahar /
// telefon / email / telegram / hashtag. Telefon va email JAVOBDA
// QAYTARILMAYDI (faqat topish uchun ishlatiladi) — maxfiylik.
export async function searchRecords(q, { includeHidden = false, limit = 60 } = {}) {
  const term = String(q || '').trim();
  if (!term) return [];
  const like = `%${term.toLowerCase()}%`;
  const { rows } = await pool.query(
    `SELECT c.code, c.name, c.role, c.avatar_url AS "avatarUrl", c.tg, c.hashtags, c.theme,
            c.price, c.ts, c.views, c.profile_type AS "profileType", c.city,
            c.category_slug AS "categorySlug", c.verified,
            c.hidden_from_directory AS "hiddenFromDirectory"
       FROM cards c
       LEFT JOIN users u ON u.id = c.user_id
      WHERE ${includeHidden ? '' : 'c.hidden_from_directory = FALSE AND '}(
            LOWER(c.code)  LIKE $1
         OR LOWER(c.name)  LIKE $1
         OR LOWER(COALESCE(c.role, ''))  LIKE $1
         OR LOWER(COALESCE(c.city, ''))  LIKE $1
         OR LOWER(COALESCE(c.email, '')) LIKE $1
         OR LOWER(COALESCE(c.phone, '')) LIKE $1
         OR LOWER(COALESCE(c.tg, ''))    LIKE $1
         OR LOWER(c.hashtags::text)      LIKE $1
         OR LOWER(COALESCE(u.email, '')) LIKE $1
         OR LOWER(COALESCE(u.phone, '')) LIKE $1
      )
      ORDER BY c.ts DESC LIMIT $2`,
    [like, Math.max(1, Math.min(200, limit))]
  );
  return rows.map(rowToRecord);
}

export async function countRecords() {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM cards`);
  return Number(rows[0].n);
}

export async function getRecord(code) {
  const { rows } = await pool.query(
    `SELECT c.code, c.name, c.role, c.avatar_url AS "avatarUrl", c.bg_url AS "bgUrl", c.bg_pattern AS "bgPattern",
            c.accent_color AS "accentColor", c.bg_color AS "bgColor", c.bg_animated AS "bgAnimated", c.music_url AS "musicUrl",
            c.links_transparent AS "linksTransparent", c.link_style AS "linkStyle",
            c.profile_type AS "profileType", c.city, c.category_slug AS "categorySlug",
            c.hidden_from_directory AS "hiddenFromDirectory", c.lead_capture AS "leadCapture", c.hide_phone AS "hidePhone",
            c.tg, c.phone, c.email, c.linkedin, c.instagram, c.about, c.facebook, c.twitter, c.website,
            c.card_number AS "cardNumber", c.extra_links AS "extraLinks", c.card_numbers AS "cardNumbers",
            c.tier_override AS "tierOverride", c.card_design AS "cardDesign", c.verified,
            c.theme, c.for_sale AS "forSale", c.sale_price AS "salePrice", c.hashtags, c.price, c.ts, c.views,
            u.is_premium AS "ownerIsPremium",
            EXISTS(SELECT 1 FROM nfc_gifts g WHERE g.code = c.code AND g.status = 'activated') AS "isGift"
     FROM cards c LEFT JOIN users u ON u.id = c.user_id
     WHERE c.code = $1`,
    [code]
  );
  if (!rows[0]) return null;
  return { ...rowToRecord(rows[0]), isPremium: !!rows[0].ownerIsPremium, isGift: !!rows[0].isGift };
}

export async function createRecord(record) {
  const { rows } = await pool.query(
    `INSERT INTO cards
       (code, name, role, avatar_url, bg_url, bg_pattern, accent_color, bg_color, bg_animated, music_url,
        tg, phone, email, linkedin, instagram,
        about, facebook, twitter, website, card_number, extra_links, card_numbers, theme, hashtags, price, ts)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22::jsonb,$23,$24::jsonb,$25,$26)
     ON CONFLICT (code) DO NOTHING
     RETURNING ${SELECT_FIELDS}`,
    [
      record.code,
      record.name,
      record.role,
      record.avatarUrl,
      record.bgUrl || '',
      record.bgPattern === false ? false : true,
      record.accentColor || null,
      record.bgColor || null,
      record.bgAnimated === false ? false : true,
      record.musicUrl || null,
      record.tg,
      record.phone,
      record.email,
      record.linkedin,
      record.instagram,
      record.about || '',
      record.facebook || '',
      record.twitter || '',
      record.website || '',
      record.cardNumber || '',
      JSON.stringify(record.extraLinks || []),
      JSON.stringify(record.cardNumbers || []),
      record.theme || 'classic',
      JSON.stringify(record.hashtags || []),
      record.price,
      Date.now(),
    ]
  );
  return rows[0] ? rowToRecord(rows[0]) : null;
}

export async function incrementViews(code) {
  const { rows } = await pool.query(
    `UPDATE cards SET views = views + 1 WHERE code = $1 RETURNING views`,
    [code]
  );
  return rows[0] ? Number(rows[0].views) : null;
}

// ---------- Analytics (Band 3.1) ----------

// Ruxsat etilgan hodisa turlari — frontend yuborgan har qanday satr emas.
export const CARD_EVENT_TYPES = [
  'profile_view', 'phone_click', 'telegram_click', 'whatsapp_click',
  'instagram_click', 'website_click', 'email_click', 'link_click',
  'contact_save', 'lead', 'menu_view', 'products_view',
];

export async function logCardEvent(code, eventType, { ref, visitorHash } = {}) {
  if (!CARD_EVENT_TYPES.includes(eventType)) return false;
  await pool.query(
    `INSERT INTO card_events (code, event_type, ref, visitor_hash) VALUES ($1, $2, $3, $4)`,
    [code, eventType, ref ? String(ref).slice(0, 120) : null, visitorHash || null]
  );
  return true;
}

// Egaga statistika: kunlik ko'rishlar, hodisa turlari bo'yicha sanoq, eng
// ko'p bosilgan havolalar. days — oxirgi necha kun (1..365).
export async function cardEventStats(code, days = 30) {
  const d = Math.max(1, Math.min(365, Math.round(Number(days) || 30)));
  const since = `now() - ($2::text || ' days')::interval`;
  const [byType, byDay, byRef, uniqueVisitors, totalRow] = await Promise.all([
    pool.query(
      `SELECT event_type, COUNT(*)::int AS n FROM card_events
        WHERE code = $1 AND created_at >= ${since} GROUP BY event_type`,
      [code, d]
    ),
    pool.query(
      `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
         FROM card_events
        WHERE code = $1 AND event_type = 'profile_view' AND created_at >= ${since}
        GROUP BY day ORDER BY day`,
      [code, d]
    ),
    pool.query(
      `SELECT ref, COUNT(*)::int AS n FROM card_events
        WHERE code = $1 AND ref IS NOT NULL AND event_type <> 'profile_view'
          AND created_at >= ${since}
        GROUP BY ref ORDER BY n DESC LIMIT 20`,
      [code, d]
    ),
    pool.query(
      `SELECT COUNT(DISTINCT visitor_hash)::int AS n FROM card_events
        WHERE code = $1 AND event_type = 'profile_view'
          AND visitor_hash IS NOT NULL AND created_at >= ${since}`,
      [code, d]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS n FROM card_events
        WHERE code = $1 AND event_type = 'profile_view' AND created_at >= ${since}`,
      [code, d]
    ),
  ]);
  return {
    days: d,
    totalViews: totalRow.rows[0]?.n || 0,
    uniqueVisitors: uniqueVisitors.rows[0]?.n || 0,
    byType: Object.fromEntries(byType.rows.map((r) => [r.event_type, r.n])),
    byDay: byDay.rows,
    byRef: byRef.rows,
  };
}

// ---------- Lead Capture (Band 3.2) ----------

export async function createLead(code, f) {
  const { rows } = await pool.query(
    `INSERT INTO card_leads (code, name, phone, telegram, whatsapp, email, company, note, visitor_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, created_at AS "createdAt"`,
    [code, f.name, f.phone || null, f.telegram || null, f.whatsapp || null,
     f.email || null, f.company || null, f.note || null, f.visitorHash || null]
  );
  return rows[0];
}

export async function listLeadsByCode(code, limit = 200) {
  const { rows } = await pool.query(
    `SELECT id, name, phone, telegram, whatsapp, email, company, note,
            created_at AS "createdAt"
       FROM card_leads WHERE code = $1 ORDER BY created_at DESC LIMIT $2`,
    [code, Math.max(1, Math.min(500, limit))]
  );
  return rows;
}

export async function leadCount(code) {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM card_leads WHERE code = $1`, [code]);
  return rows[0]?.n || 0;
}

// Bir profilga oxirgi 24 soatda kelgan lead soni — tarif limitini tekshirish uchun.
export async function leadCountToday(code) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM card_leads WHERE code = $1 AND created_at >= now() - interval '24 hours'`,
    [code]
  );
  return rows[0]?.n || 0;
}

export async function deleteLead(code, id) {
  await pool.query(`DELETE FROM card_leads WHERE code = $1 AND id = $2`, [code, id]);
}

// ---------- Restoran menyusi (Band 3.3) ----------

// Public — profil sahifasi uchun to'liq menyu (yoqilgan kategoriyalar +
// ularning taomlari). Egaga esa hammasi (yashirin kategoriyalar ham).
export async function getMenu(code, { includeDisabled = false } = {}) {
  const [cats, items] = await Promise.all([
    pool.query(
      `SELECT id, name, sort, enabled FROM menu_categories
        WHERE code = $1 ${includeDisabled ? '' : 'AND enabled = TRUE'}
        ORDER BY sort, id`,
      [code]
    ),
    pool.query(
      `SELECT id, category_id AS "categoryId", name, description, price, discount_price AS "discountPrice",
              image_url AS "imageUrl", available, featured, sort
         FROM menu_items WHERE code = $1 ORDER BY sort, id`,
      [code]
    ),
  ]);
  const byCat = new Map();
  for (const it of items.rows) {
    if (!byCat.has(it.categoryId)) byCat.set(it.categoryId, []);
    byCat.get(it.categoryId).push({
      ...it,
      price: it.price == null ? null : Number(it.price),
      discountPrice: it.discountPrice == null ? null : Number(it.discountPrice),
    });
  }
  return cats.rows.map((c) => ({ ...c, items: byCat.get(c.id) || [] }));
}

export async function menuCounts(code) {
  const { rows } = await pool.query(
    `SELECT (SELECT COUNT(*)::int FROM menu_categories WHERE code = $1) AS cats,
            (SELECT COUNT(*)::int FROM menu_items WHERE code = $1) AS items`,
    [code]
  );
  return { cats: rows[0].cats, items: rows[0].items };
}

export async function createMenuCategory(code, { name, sort }) {
  const { rows } = await pool.query(
    `INSERT INTO menu_categories (code, name, sort) VALUES ($1, $2, $3)
     RETURNING id, name, sort, enabled`,
    [code, name, sort || 0]
  );
  return rows[0];
}

export async function updateMenuCategory(code, id, f) {
  const { rows } = await pool.query(
    `UPDATE menu_categories SET
        name = COALESCE($3, name), sort = COALESCE($4, sort), enabled = COALESCE($5, enabled)
      WHERE code = $1 AND id = $2
      RETURNING id, name, sort, enabled`,
    [code, id, f.name ?? null, f.sort ?? null, f.enabled ?? null]
  );
  return rows[0] || null;
}

export async function deleteMenuCategory(code, id) {
  await pool.query(`DELETE FROM menu_categories WHERE code = $1 AND id = $2`, [code, id]);
}

// category_id shu kartaga tegishli ekanini tekshiradi (IDOR himoyasi).
export async function menuCategoryBelongs(code, categoryId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM menu_categories WHERE id = $1 AND code = $2`, [categoryId, code]
  );
  return !!rows[0];
}

const menuItemRow = (r) => (r ? {
  ...r,
  price: r.price == null ? null : Number(r.price),
  discountPrice: r.discountPrice == null ? null : Number(r.discountPrice),
} : null);

export async function createMenuItem(code, f) {
  const { rows } = await pool.query(
    `INSERT INTO menu_items (code, category_id, name, description, price, discount_price, image_url, available, featured, sort)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, category_id AS "categoryId", name, description, price, discount_price AS "discountPrice",
               image_url AS "imageUrl", available, featured, sort`,
    [code, f.categoryId, f.name, f.description || null, f.price ?? null, f.discountPrice ?? null,
     f.imageUrl || null, f.available !== false, f.featured === true, f.sort || 0]
  );
  return menuItemRow(rows[0]);
}

export async function updateMenuItem(code, id, f) {
  const sets = [];
  const vals = [code, id];
  const col = {
    categoryId: 'category_id', name: 'name', description: 'description', price: 'price',
    discountPrice: 'discount_price', imageUrl: 'image_url', available: 'available',
    featured: 'featured', sort: 'sort',
  };
  for (const [k, c] of Object.entries(col)) {
    if (k in f) { vals.push(f[k]); sets.push(`${c} = $${vals.length}`); }
  }
  if (!sets.length) return null;
  const { rows } = await pool.query(
    `UPDATE menu_items SET ${sets.join(', ')} WHERE code = $1 AND id = $2
     RETURNING id, category_id AS "categoryId", name, description, price, discount_price AS "discountPrice",
               image_url AS "imageUrl", available, featured, sort`,
    vals
  );
  return menuItemRow(rows[0]) || null;
}

export async function deleteMenuItem(code, id) {
  await pool.query(`DELETE FROM menu_items WHERE code = $1 AND id = $2`, [code, id]);
}

// ---------- Mahsulotlar katalogi (Company System — Products) ----------
// menu_* funksiyalari bilan bir xil naqsh — jadval nomlari boshqa.

export async function getProducts(code, { includeDisabled = false } = {}) {
  const [cats, items] = await Promise.all([
    pool.query(
      `SELECT id, name, sort, enabled FROM product_categories
        WHERE code = $1 ${includeDisabled ? '' : 'AND enabled = TRUE'}
        ORDER BY sort, id`,
      [code]
    ),
    pool.query(
      `SELECT id, category_id AS "categoryId", name, description, price, discount_price AS "discountPrice",
              image_url AS "imageUrl", available, featured, sort
         FROM products WHERE code = $1 ORDER BY sort, id`,
      [code]
    ),
  ]);
  const byCat = new Map();
  for (const it of items.rows) {
    if (!byCat.has(it.categoryId)) byCat.set(it.categoryId, []);
    byCat.get(it.categoryId).push({
      ...it,
      price: it.price == null ? null : Number(it.price),
      discountPrice: it.discountPrice == null ? null : Number(it.discountPrice),
    });
  }
  return cats.rows.map((c) => ({ ...c, items: byCat.get(c.id) || [] }));
}

export async function productCounts(code) {
  const { rows } = await pool.query(
    `SELECT (SELECT COUNT(*)::int FROM product_categories WHERE code = $1) AS cats,
            (SELECT COUNT(*)::int FROM products WHERE code = $1) AS items`,
    [code]
  );
  return { cats: rows[0].cats, items: rows[0].items };
}

export async function createProductCategory(code, { name, sort }) {
  const { rows } = await pool.query(
    `INSERT INTO product_categories (code, name, sort) VALUES ($1, $2, $3)
     RETURNING id, name, sort, enabled`,
    [code, name, sort || 0]
  );
  return rows[0];
}

export async function updateProductCategory(code, id, f) {
  const { rows } = await pool.query(
    `UPDATE product_categories SET
        name = COALESCE($3, name), sort = COALESCE($4, sort), enabled = COALESCE($5, enabled)
      WHERE code = $1 AND id = $2
      RETURNING id, name, sort, enabled`,
    [code, id, f.name ?? null, f.sort ?? null, f.enabled ?? null]
  );
  return rows[0] || null;
}

export async function deleteProductCategory(code, id) {
  await pool.query(`DELETE FROM product_categories WHERE code = $1 AND id = $2`, [code, id]);
}

// category_id shu kartaga tegishli ekanini tekshiradi (IDOR himoyasi).
export async function productCategoryBelongs(code, categoryId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM product_categories WHERE id = $1 AND code = $2`, [categoryId, code]
  );
  return !!rows[0];
}

const productRow = (r) => (r ? {
  ...r,
  price: r.price == null ? null : Number(r.price),
  discountPrice: r.discountPrice == null ? null : Number(r.discountPrice),
} : null);

export async function createProduct(code, f) {
  const { rows } = await pool.query(
    `INSERT INTO products (code, category_id, name, description, price, discount_price, image_url, available, featured, sort)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, category_id AS "categoryId", name, description, price, discount_price AS "discountPrice",
               image_url AS "imageUrl", available, featured, sort`,
    [code, f.categoryId, f.name, f.description || null, f.price ?? null, f.discountPrice ?? null,
     f.imageUrl || null, f.available !== false, f.featured === true, f.sort || 0]
  );
  return productRow(rows[0]);
}

export async function updateProduct(code, id, f) {
  const sets = [];
  const vals = [code, id];
  const col = {
    categoryId: 'category_id', name: 'name', description: 'description', price: 'price',
    discountPrice: 'discount_price', imageUrl: 'image_url', available: 'available',
    featured: 'featured', sort: 'sort',
  };
  for (const [k, c] of Object.entries(col)) {
    if (k in f) { vals.push(f[k]); sets.push(`${c} = $${vals.length}`); }
  }
  if (!sets.length) return null;
  const { rows } = await pool.query(
    `UPDATE products SET ${sets.join(', ')} WHERE code = $1 AND id = $2
     RETURNING id, category_id AS "categoryId", name, description, price, discount_price AS "discountPrice",
               image_url AS "imageUrl", available, featured, sort`,
    vals
  );
  return productRow(rows[0]) || null;
}

export async function deleteProduct(code, id) {
  await pool.query(`DELETE FROM products WHERE code = $1 AND id = $2`, [code, id]);
}

// ---------- Fayl / PDF / katalog (Band 3.4) ----------

const fileRow = (r) => (r ? { ...r, sizeBytes: r.sizeBytes == null ? null : Number(r.sizeBytes) } : null);

export async function listCardFiles(code) {
  const { rows } = await pool.query(
    `SELECT id, title, file_url AS "fileUrl", size_bytes AS "sizeBytes", sort, created_at AS "createdAt"
       FROM card_files WHERE code = $1 ORDER BY sort, id`,
    [code]
  );
  return rows.map(fileRow);
}

export async function cardFileCount(code) {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM card_files WHERE code = $1`, [code]);
  return rows[0]?.n || 0;
}

export async function createCardFile(code, { title, fileUrl, sizeBytes, sort }) {
  const { rows } = await pool.query(
    `INSERT INTO card_files (code, title, file_url, size_bytes, sort)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, title, file_url AS "fileUrl", size_bytes AS "sizeBytes", sort, created_at AS "createdAt"`,
    [code, title, fileUrl, sizeBytes ?? null, sort || 0]
  );
  return fileRow(rows[0]);
}

export async function updateCardFile(code, id, f) {
  const { rows } = await pool.query(
    `UPDATE card_files SET title = COALESCE($3, title), sort = COALESCE($4, sort)
      WHERE code = $1 AND id = $2
      RETURNING id, title, file_url AS "fileUrl", size_bytes AS "sizeBytes", sort, created_at AS "createdAt"`,
    [code, id, f.title ?? null, f.sort ?? null]
  );
  return fileRow(rows[0]) || null;
}

export async function deleteCardFile(code, id) {
  const { rows } = await pool.query(
    `DELETE FROM card_files WHERE code = $1 AND id = $2 RETURNING file_url AS "fileUrl"`,
    [code, id]
  );
  return rows[0]?.fileUrl || null;
}

// ---------- Video (PHASE 4) ----------

const videoRow = (r) => (r ? { ...r, sizeBytes: r.sizeBytes == null ? null : Number(r.sizeBytes) } : null);

export async function listCardVideos(code) {
  const { rows } = await pool.query(
    `SELECT id, video_url AS "videoUrl", thumb_url AS "thumbUrl", title,
            size_bytes AS "sizeBytes", sort, created_at AS "createdAt"
       FROM card_videos WHERE code = $1 ORDER BY sort, id`,
    [code]
  );
  return rows.map(videoRow);
}

export async function cardVideoCount(code) {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM card_videos WHERE code = $1`, [code]);
  return rows[0]?.n || 0;
}

export async function createCardVideo(code, { videoUrl, thumbUrl, title, sizeBytes }) {
  const { rows } = await pool.query(
    `INSERT INTO card_videos (code, video_url, thumb_url, title, size_bytes)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, video_url AS "videoUrl", thumb_url AS "thumbUrl", title, size_bytes AS "sizeBytes", sort, created_at AS "createdAt"`,
    [code, videoUrl, thumbUrl || null, title || null, sizeBytes ?? null]
  );
  return videoRow(rows[0]);
}

export async function updateCardVideo(code, id, f) {
  const { rows } = await pool.query(
    `UPDATE card_videos SET title = COALESCE($3, title), thumb_url = COALESCE($4, thumb_url), sort = COALESCE($5, sort)
      WHERE code = $1 AND id = $2
      RETURNING id, video_url AS "videoUrl", thumb_url AS "thumbUrl", title, size_bytes AS "sizeBytes", sort, created_at AS "createdAt"`,
    [code, id, f.title ?? null, f.thumbUrl ?? null, f.sort ?? null]
  );
  return videoRow(rows[0]) || null;
}

export async function deleteCardVideo(code, id) {
  const { rows } = await pool.query(
    `DELETE FROM card_videos WHERE code = $1 AND id = $2 RETURNING video_url AS "videoUrl", thumb_url AS "thumbUrl"`,
    [code, id]
  );
  return rows[0] || null;
}

// ---------- Jamoa / Team (PHASE 5) ----------

export async function listCardTeam(code) {
  const { rows } = await pool.query(
    `SELECT t.id, t.name, t.position, t.photo_url AS "photoUrl", t.member_code AS "memberCode",
            t.sort, c.name AS "memberName"
       FROM card_team t
       LEFT JOIN cards c ON c.code = t.member_code
      WHERE t.code = $1 ORDER BY t.sort, t.id`,
    [code]
  );
  return rows;
}

export async function cardTeamCount(code) {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM card_team WHERE code = $1`, [code]);
  return rows[0]?.n || 0;
}

export async function createTeamMember(code, f) {
  const { rows } = await pool.query(
    `INSERT INTO card_team (code, name, position, photo_url, member_code, sort)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, name, position, photo_url AS "photoUrl", member_code AS "memberCode", sort`,
    [code, f.name, f.position || null, f.photoUrl || null, f.memberCode || null, f.sort || 0]
  );
  return rows[0];
}

export async function updateTeamMember(code, id, f) {
  const sets = [];
  const vals = [code, id];
  const col = { name: 'name', position: 'position', photoUrl: 'photo_url', memberCode: 'member_code', sort: 'sort' };
  for (const [k, c] of Object.entries(col)) {
    if (k in f) { vals.push(f[k]); sets.push(`${c} = $${vals.length}`); }
  }
  if (!sets.length) return null;
  const { rows } = await pool.query(
    `UPDATE card_team SET ${sets.join(', ')} WHERE code = $1 AND id = $2
     RETURNING id, name, position, photo_url AS "photoUrl", member_code AS "memberCode", sort`,
    vals
  );
  return rows[0] || null;
}

export async function deleteTeamMember(code, id) {
  const { rows } = await pool.query(
    `DELETE FROM card_team WHERE code = $1 AND id = $2 RETURNING photo_url AS "photoUrl"`,
    [code, id]
  );
  return rows[0]?.photoUrl || null;
}

// ---------- Auth ----------

// Ro'yxatdan o'tgan har bir foydalanuvchiga avtomatik, bepul, 8 xonali
// raqamli ID beriladi (masalan nfcstore.uz/12345678). Bu ID sovg'a qilib
// bo'lmaydi (giftable=FALSE) — faqat foydalanuvchining o'zi ega bo'ladi.
export async function createFreeAutoId(userId, name) {
  for (let i = 0; i < 8; i++) {
    const code = String(Math.floor(10_000_000 + Math.random() * 89_999_999));
    try {
      const { rows } = await pool.query(
        `INSERT INTO cards (code, name, theme, hashtags, price, ts, user_id, is_primary, giftable)
         VALUES ($1,$2,'classic','[]'::jsonb,0,$3,$4,TRUE,FALSE)
         ON CONFLICT (code) DO NOTHING
         RETURNING code`,
        [code, name || 'Yangi foydalanuvchi', Date.now(), userId]
      );
      if (rows[0]) return rows[0].code;
    } catch (err) {
      if (err.code !== '23505') throw err; // band bo'lib qolgan bo'lsa qayta uramiz
    }
  }
  return null;
}

export async function createUser(email, passwordHash, { phone, botAck, tosAccepted, isTest } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, phone, bot_ack, tos_accepted, is_test) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (email) DO NOTHING
     RETURNING id, email, phone, bot_ack AS "botAck"`,
    [email.toLowerCase(), passwordHash, phone || null, !!botAck, !!tosAccepted, !!isTest]
  );
  return rows[0] || null;
}

// Admin panelda "Sinov/admin akkaunt" deb belgilash-belgilamaslik — bunday
// akkauntlar "Foydalanuvchilar", "Jami savdo" kabi asosiy ko'rsatkichlarga
// KIRMAYDI (lekin jadvalda ko'rinishda davom etadi).
// Admin/sinov akkaunt belgisi ustidan qo'lda bloklash/o'chirish —
// SUSPEND_REASONS ro'yxati bilan (statistik hisobot uchun ham foydali).
export async function adminSuspendUser(userId, days, reason) {
  await pool.query(
    `UPDATE users SET suspended_until = now() + ($2 || ' days')::interval, suspend_reason = $3 WHERE id = $1`,
    [userId, days, reason]
  );
}
export async function adminUnsuspendUser(userId) {
  await pool.query(`UPDATE users SET suspended_until = NULL, suspend_reason = NULL WHERE id = $1`, [userId]);
}
// Foydalanuvchini BUTUNLAY (hard-delete) o'chiradi — qatorning o'zi
// bazadan olib tashlanadi, shuning uchun uning emaili bo'shab qoladi va
// o'sha email bilan qaytadan ro'yxatdan o'tish mumkin bo'ladi.
// users(id) ga CASCADE bilan bog'langan jadvallar (sessions, web_orders,
// wallet_topups, transactions, bids, follows, card_likes, gift_offers,
// support_messages, conversations, messages, ...) avtomatik tozalanadi.
// CASCADE'siz FK'lar (cards.user_id, physical_cards.owner_user_id) qo'lda
// tozalanadi.
export async function adminDeleteUser(userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // 1) Jismoniy karta buyurtmalari (owner_user_id da CASCADE yo'q).
    //    physical_cards.linked_code -> cards(code) ON DELETE SET NULL, shuning
    //    uchun avval physical_cards, keyin cards o'chiriladi.
    await client.query(`DELETE FROM physical_cards WHERE owner_user_id = $1`, [userId]);
    // 2) Foydalanuvchining NFC ID profillari (cards.user_id da CASCADE yo'q).
    await client.query(`DELETE FROM cards WHERE user_id = $1`, [userId]);
    // 3) Auksionlardagi eskirgan yetakchi havolasini tozalash (FK bo'lmasligi
    //    mumkin — himoya uchun qo'lda).
    await client.query(`UPDATE auctions SET highest_bidder_id = NULL WHERE highest_bidder_id = $1`, [userId]);
    // 4) Foydalanuvchining o'zi — qolgan bog'liq qatorlar CASCADE bilan ketadi.
    await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------- Admin login tarixi ----------
export async function logAdminLoginEvent(event, ip, userAgent) {
  await pool.query(
    `INSERT INTO admin_login_history (event, ip, user_agent) VALUES ($1,$2,$3)`,
    [event, ip || null, userAgent || null]
  );
}
export async function listAdminLoginHistory(limit = 100) {
  const { rows } = await pool.query(
    `SELECT id, event, ip, user_agent AS "userAgent", created_at AS "createdAt"
     FROM admin_login_history ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

// ---------- Admin Activity Log ----------
export async function logAdminActivity({ action, details, oldValue, newValue, ip }) {
  await pool.query(
    `INSERT INTO admin_activity_log (action, details, old_value, new_value, ip) VALUES ($1,$2,$3,$4,$5)`,
    [action, details || null, oldValue != null ? String(oldValue) : null, newValue != null ? String(newValue) : null, ip || null]
  );
}
export async function listAdminActivityLog(limit = 200) {
  const { rows } = await pool.query(
    `SELECT id, action, details, old_value AS "oldValue", new_value AS "newValue", ip, created_at AS "createdAt"
     FROM admin_activity_log ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

// ---------- IP Whitelist ----------
export async function getAdminSetting(key) {
  const { rows } = await pool.query(`SELECT value FROM admin_settings WHERE key = $1`, [key]);
  return rows[0]?.value ?? null;
}
export async function setAdminSetting(key, value) {
  await pool.query(
    `INSERT INTO admin_settings (key, value) VALUES ($1,$2)
     ON CONFLICT (key) DO UPDATE SET value = $2`,
    [key, value]
  );
}

// ---------- Jismoniy NFC (ko'p dona) narx pog'onalari + yetkazib berish
// muddati (Company System — Faz 25/26). Bitta joyda saqlangan standart
// qiymatlar — index.js (public o'qish) va admin.js (admin tahrirlash)
// ikkalasi ham shu yerdan import qiladi. ----------
export const DEFAULT_PHYSICAL_NFC_TIERS = [
  { minQty: 1, maxQty: 1, pricePerUnit: 200000 },
  { minQty: 2, maxQty: 4, pricePerUnit: 150000 },
  { minQty: 5, maxQty: 9, pricePerUnit: 120000 },
  { minQty: 10, maxQty: null, pricePerUnit: 100000 },
];
export const DEFAULT_DELIVERY_DAYS = { minDays: 3, maxDays: 5 };

export async function getPhysicalNfcTiers() {
  try {
    const raw = await getAdminSetting('physical_nfc_pricing');
    if (!raw) return DEFAULT_PHYSICAL_NFC_TIERS;
    const tiers = JSON.parse(raw);
    return Array.isArray(tiers) && tiers.length ? tiers : DEFAULT_PHYSICAL_NFC_TIERS;
  } catch { return DEFAULT_PHYSICAL_NFC_TIERS; }
}
export async function setPhysicalNfcTiers(tiers) {
  await setAdminSetting('physical_nfc_pricing', JSON.stringify(tiers));
}
export async function getDeliveryDays() {
  try {
    const raw = await getAdminSetting('delivery_days');
    if (!raw) return DEFAULT_DELIVERY_DAYS;
    const d = JSON.parse(raw);
    return (d && Number.isFinite(d.minDays) && Number.isFinite(d.maxDays)) ? d : DEFAULT_DELIVERY_DAYS;
  } catch { return DEFAULT_DELIVERY_DAYS; }
}
export async function setDeliveryDays(d) {
  await setAdminSetting('delivery_days', JSON.stringify(d));
}

// Menyu/Mahsulotlar FREE-PRO limitlar override (Faz 4) — admin_settings'da
// 'menu_limits'/'product_limits' kaliti ostida JSON: { free:{cat,item,images}, ... }.
export async function getLimitsOverride(kind) {
  try {
    const raw = await getAdminSetting(`${kind}_limits`);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
export async function setLimitsOverride(kind, map) {
  await setAdminSetting(`${kind}_limits`, JSON.stringify(map));
}
export async function listAdminIpWhitelist() {
  const { rows } = await pool.query(`SELECT id, ip, label, created_at AS "createdAt" FROM admin_ip_whitelist ORDER BY id ASC`);
  return rows;
}
export async function addAdminIpWhitelist(ip, label) {
  const { rows: existing } = await pool.query(`SELECT COUNT(*)::int AS n FROM admin_ip_whitelist`);
  if (existing[0].n >= 2) return { error: 'MAX_2' };
  const { rows } = await pool.query(
    `INSERT INTO admin_ip_whitelist (ip, label) VALUES ($1,$2) ON CONFLICT (ip) DO NOTHING RETURNING id`,
    [ip, label || null]
  );
  if (!rows[0]) return { error: 'ALREADY_EXISTS' };
  return { ok: true };
}
export async function removeAdminIpWhitelist(id) {
  await pool.query(`DELETE FROM admin_ip_whitelist WHERE id = $1`, [id]);
}

export async function getUserByEmail(email) {
  const { rows } = await pool.query(
    `SELECT id, email, password_hash, phone, bot_ack AS "botAck", suspended_until AS "suspendedUntil", suspend_reason AS "suspendReason", deleted_at AS "deletedAt"
     FROM users WHERE email = $1`,
    [String(email || '').toLowerCase()]
  );
  return rows[0]
    ? {
        id: rows[0].id, email: rows[0].email, passwordHash: rows[0].password_hash, phone: rows[0].phone, botAck: rows[0].botAck,
        suspendedUntil: rows[0].suspendedUntil, suspendReason: rows[0].suspendReason, deletedAt: rows[0].deletedAt,
      }
    : null;
}

export async function updateUserPassword(userId, passwordHash) {
  await pool.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [
    userId,
    passwordHash,
  ]);
}

export async function createSession(token, userId, ttlMs) {
  const { rows } = await pool.query(
    `INSERT INTO sessions (token, user_id, expires_at)
     VALUES ($1, $2, now() + ($3 || ' milliseconds')::interval)
     RETURNING expires_at`,
    [token, userId, String(ttlMs)]
  );
  return rows[0];
}

export async function getSessionUser(token) {
  // Muddati o'tgan sessiyalarni o'chirib tashlaymiz (lazy cleanup).
  await pool.query(`DELETE FROM sessions WHERE expires_at < now()`);
  if (!token) return null;
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.is_premium AS "isPremium",
            u.banned_until AS "bannedUntil", u.strike_count AS "strikeCount",
            u.promo_code AS "promoCode", u.pending_discount_pct AS "pendingDiscountPct",
            u.suspended_until AS "suspendedUntil", u.deleted_at AS "deletedAt"
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > now()`,
    [token]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  // Admin tomonidan bloklangan yoki o'chirilgan akkaunt — hatto mavjud
  // sessiya bo'lsa ham darhol "tizimga kirmagan" deb hisoblanadi.
  if (r.deletedAt) return null;
  if (r.suspendedUntil && new Date(r.suspendedUntil) > new Date()) return null;
  const isBanned = r.bannedUntil && new Date(r.bannedUntil) > new Date();
  return {
    id: r.id, email: r.email, isPremium: !!r.isPremium,
    bannedUntil: isBanned ? r.bannedUntil : null,
    strikeCount: r.strikeCount || 0,
    promoCode: r.promoCode || null,
    pendingDiscountPct: r.pendingDiscountPct || 0,
  };
}

export async function deleteSession(token) {
  await pool.query(`DELETE FROM sessions WHERE token = $1`, [token]);
}

export async function attachCardToUser(code, userId) {
  await pool.query(`UPDATE cards SET user_id = $2 WHERE code = $1 AND user_id IS NULL`, [
    code,
    userId,
  ]);
}

export async function listRecordsByUser(userId) {
  const { rows } = await pool.query(
    `SELECT ${SELECT_FIELDS} FROM cards WHERE user_id = $1 ORDER BY is_primary DESC, ts DESC`,
    [userId]
  );
  return rows.map(rowToRecord);
}

// Foydalanuvchining bir nechta vizitkasi bo'lsa, ulardan bittasini
// "Asosiy" deb belgilaydi — qolganlarining belgisi avtomatik olib
// tashlanadi (bir vaqtda faqat bitta asosiy bo'lishi mumkin).
// ---------- Sovg'a qilish (pulsiz egalik o'tkazish) ----------

// Sovg'a taklifi yaratadi — qabul qiluvchi o'zining NFC ID'sini (mavjud
// kodini) aytadi, tizim shu orqali uning akkauntini topadi.
export async function createGiftOffer(code, fromUserId, toCode) {
  const owner = await getRecordOwner(code);
  if (owner !== fromUserId) return { error: 'NOT_OWNER' };

  const { rows: giftableRows } = await pool.query(`SELECT giftable FROM cards WHERE code = $1`, [code]);
  if (giftableRows[0] && giftableRows[0].giftable === false) return { error: 'NOT_GIFTABLE' };

  const toUserId = await getRecordOwner(toCode);
  if (!toUserId) return { error: 'RECIPIENT_NOT_FOUND' };
  if (toUserId === fromUserId) return { error: 'CANNOT_GIFT_SELF' };

  const { rows: pending } = await pool.query(
    `SELECT id FROM gift_offers WHERE code = $1 AND status = 'pending'`, [code]
  );
  if (pending[0]) return { error: 'ALREADY_PENDING' };

  const { rows } = await pool.query(
    `INSERT INTO gift_offers (code, from_user_id, to_user_id) VALUES ($1,$2,$3) RETURNING id`,
    [code, fromUserId, toUserId]
  );
  return { ok: true, id: rows[0].id };
}

export async function listGiftOffers(userId) {
  const { rows: incoming } = await pool.query(
    `SELECT g.id, g.code, g.created_at AS "createdAt", u.email AS "fromEmail"
     FROM gift_offers g JOIN users u ON u.id = g.from_user_id
     WHERE g.to_user_id = $1 AND g.status = 'pending' ORDER BY g.created_at DESC`,
    [userId]
  );
  const { rows: outgoing } = await pool.query(
    `SELECT g.id, g.code, g.created_at AS "createdAt", u.email AS "toEmail"
     FROM gift_offers g JOIN users u ON u.id = g.to_user_id
     WHERE g.from_user_id = $1 AND g.status = 'pending' ORDER BY g.created_at DESC`,
    [userId]
  );
  return { incoming, outgoing };
}

// Qabul qiluvchi tasdiqlaydi — egalik shu yerda, atomik tarzda o'tadi.
export async function acceptGiftOffer(id, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, code, to_user_id AS "toUserId", from_user_id AS "fromUserId"
       FROM gift_offers WHERE id = $1 AND status = 'pending' FOR UPDATE`,
      [id]
    );
    const offer = rows[0];
    if (!offer || offer.toUserId !== userId) { await client.query('ROLLBACK'); return null; }
    // Egalik faqat taklif YUBORUVCHISI hali ham egasi bo'lsa o'tadi — taklif
    // yaratilgach kod boshqa yo'l bilan (auksion, boshqa sovg'a) egasini
    // o'zgartirgan bo'lsa, bu eski taklif egalikni buzmaydi.
    const upd = await client.query(
      `UPDATE cards SET user_id = $2, is_primary = FALSE WHERE code = $1 AND user_id = $3`,
      [offer.code, userId, offer.fromUserId]
    );
    if (!upd.rowCount) { await client.query('ROLLBACK'); return { error: 'OWNERSHIP_CHANGED' }; }
    await client.query(`UPDATE gift_offers SET status = 'accepted', decided_at = now() WHERE id = $1`, [id]);
    await client.query('COMMIT');
    return { ok: true, code: offer.code };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function rejectGiftOffer(id, userId) {
  const { rows } = await pool.query(
    `UPDATE gift_offers SET status = 'rejected', decided_at = now()
     WHERE id = $1 AND to_user_id = $2 AND status = 'pending' RETURNING id`,
    [id, userId]
  );
  return !!rows[0];
}

export async function cancelGiftOffer(id, userId) {
  const { rows } = await pool.query(
    `UPDATE gift_offers SET status = 'cancelled', decided_at = now()
     WHERE id = $1 AND from_user_id = $2 AND status = 'pending' RETURNING id`,
    [id, userId]
  );
  return !!rows[0];
}

// ---------- Public "Sovg'alar" sahifasi ----------
// MUHIM PRIVACY: from_user_id / yuboruvchi HECH QACHON SELECT qilinmaydi.
// Faqat: sovg'a qilingan kod, qabul qiluvchining ommaviy nomi (agar profili
// ommaviy bo'lsa), sana. Cutoff'dan oldingi sovg'alar chiqmaydi.
export async function listPublicGifts({ page = 1, limit = 12 } = {}) {
  const cutoff = (await getAdminSetting('public_gifts_cutoff')) || '2099-01-01';
  const lim = Math.min(48, Math.max(1, Math.round(limit)));
  const offset = Math.max(0, (Math.max(1, Math.round(page)) - 1)) * lim;
  const { rows } = await pool.query(
    `SELECT g.code, g.decided_at AS "date",
            r.name AS "recipientName", r.code AS "recipientCode",
            COALESCE(r.hidden_from_directory, TRUE) AS hidden
     FROM gift_offers g
     LEFT JOIN LATERAL (
       SELECT name, code, hidden_from_directory
       FROM cards WHERE user_id = g.to_user_id
       ORDER BY is_primary DESC, ts ASC
       LIMIT 1
     ) r ON TRUE
     WHERE g.status = 'accepted' AND g.decided_at >= $1
     ORDER BY g.decided_at DESC
     LIMIT $2 OFFSET $3`,
    [cutoff, lim + 1, offset]
  );
  const hasMore = rows.length > lim;
  const items = rows.slice(0, lim).map((r) => {
    const publicRecipient = !r.hidden && r.recipientName;
    return {
      code: r.code,
      recipientName: publicRecipient ? r.recipientName : null,
      recipientCode: publicRecipient ? r.recipientCode : null,
      date: r.date,
    };
  });
  return { gifts: items, hasMore };
}

// Foydalanuvchining bir nechta vizitkasi bo'lsa, ulardan bittasini
// "Asosiy" deb belgilaydi — qolganlarining belgisi avtomatik olib
// tashlanadi (bir vaqtda faqat bitta asosiy bo'lishi mumkin).
// ---------- Adminga murojaat (support) ----------

export async function createSupportMessage(userId, message) {
  const { rows } = await pool.query(
    `INSERT INTO support_messages (user_id, message) VALUES ($1,$2) RETURNING id, created_at AS "createdAt"`,
    [userId, message]
  );
  return rows[0];
}

export async function listMySupportMessages(userId) {
  const { rows } = await pool.query(
    `SELECT id, message, reply, status, created_at AS "createdAt", replied_at AS "repliedAt"
     FROM support_messages WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30`,
    [userId]
  );
  return rows;
}

export async function adminListSupportMessages(status) {
  const { rows } = await pool.query(
    `SELECT sm.id, sm.message, sm.reply, sm.status, sm.created_at AS "createdAt",
            u.id AS "userId", u.email AS "userEmail",
            (SELECT c.code FROM cards c WHERE c.user_id = u.id ORDER BY c.is_primary DESC, c.ts ASC LIMIT 1) AS "userCode"
     FROM support_messages sm JOIN users u ON u.id = sm.user_id
     WHERE ($1::text IS NULL OR sm.status = $1)
     ORDER BY sm.created_at DESC LIMIT 100`,
    [status || null]
  );
  return rows;
}

export async function adminReplySupportMessage(id, reply) {
  const { rows } = await pool.query(
    `UPDATE support_messages SET reply = $2, status = 'replied', replied_at = now()
     WHERE id = $1 RETURNING id`,
    [id, reply]
  );
  return rows[0] || null;
}

export async function countPendingSupportMessages() {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM support_messages WHERE status = 'pending'`);
  return rows[0]?.n || 0;
}

// Foydalanuvchining bir nechta vizitkasi bo'lsa, ulardan bittasini
// "Asosiy" deb belgilaydi — qolganlarining belgisi avtomatik olib
// tashlanadi (bir vaqtda faqat bitta asosiy bo'lishi mumkin).
// ---------- Do'st taklif qilish (referral / promokod) ----------

function generatePromoCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// Har bir yangi foydalanuvchiga o'ziga xos promokod beriladi.
export async function assignPromoCode(userId) {
  for (let i = 0; i < 8; i++) {
    const code = generatePromoCode();
    try {
      const { rows } = await pool.query(
        `UPDATE users SET promo_code = $2 WHERE id = $1 AND promo_code IS NULL RETURNING promo_code`,
        [userId, code]
      );
      if (rows[0]) return rows[0].promo_code;
    } catch (err) {
      if (err.code !== '23505') throw err;
    }
  }
  return null;
}

export async function getUserByPromoCode(promoCode) {
  const { rows } = await pool.query(`SELECT id FROM users WHERE promo_code = $1`, [promoCode]);
  return rows[0]?.id || null;
}

// Ro'yxatdan o'tishda promokod kiritilgan bo'lsa: taklif qiluvchiga 10%
// chegirma krediti yoziladi (keyingi bandlashda avtomatik qo'llanadi).
export async function applyReferral(referrerId, referredId) {
  if (referrerId === referredId) return false;
  await pool.query(`INSERT INTO referral_uses (referrer_id, referred_id) VALUES ($1,$2)`, [referrerId, referredId]);
  await pool.query(`UPDATE users SET pending_discount_pct = LEAST(pending_discount_pct + 10, 100) WHERE id = $1`, [referrerId]);
  return true;
}

export async function getPendingDiscountPct(userId) {
  const { rows } = await pool.query(`SELECT pending_discount_pct AS pct FROM users WHERE id = $1`, [userId]);
  return rows[0]?.pct || 0;
}

// Chegirma bandlash paytida ISHLATILGANDA, kreditni 0'ga qaytaradi
// (bir martalik foydalanish).
export async function consumeDiscount(userId) {
  await pool.query(`UPDATE users SET pending_discount_pct = 0 WHERE id = $1`, [userId]);
}

export async function listMyReferrals(userId) {
  const { rows } = await pool.query(
    `SELECT r.id, r.created_at AS "createdAt", u.email AS "referredEmail"
     FROM referral_uses r JOIN users u ON u.id = r.referred_id
     WHERE r.referrer_id = $1 ORDER BY r.created_at DESC`,
    [userId]
  );
  return rows;
}

// Admin: BARCHA promokod (referral) foydalanishlari — kimning promokodi
// bilan kim ro'yxatdan o'tgani, sana bilan. Ism sifatida foydalanuvchining
// asosiy kartasidagi nom ko'rsatiladi (bo'lmasa email).
export async function adminListReferrals(limit = 2000) {
  const { rows } = await pool.query(
    `SELECT r.id, r.created_at AS "createdAt",
            ru.email AS "referrerEmail", ru.promo_code AS "referrerPromo", cru.name AS "referrerName",
            rd.email AS "referredEmail", crd.name AS "referredName"
     FROM referral_uses r
     JOIN users ru ON ru.id = r.referrer_id
     JOIN users rd ON rd.id = r.referred_id
     LEFT JOIN cards cru ON cru.user_id = ru.id AND cru.is_primary = TRUE
     LEFT JOIN cards crd ON crd.user_id = rd.id AND crd.is_primary = TRUE
     ORDER BY r.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

// Foydalanuvchining bir nechta vizitkasi bo'lsa, ulardan bittasini
// "Asosiy" deb belgilaydi — qolganlarining belgisi avtomatik olib
// tashlanadi (bir vaqtda faqat bitta asosiy bo'lishi mumkin).
// ---------- Parolni Telegram OTP orqali o'zgartirish ----------

// ---------- Admins (ko'p adminli tizim + rollar + TOTP) ----------
export async function getAdminByPhone(phone) {
  const { rows } = await pool.query(
    `SELECT id, phone, password_hash AS "passwordHash", name, role, totp_secret AS "totpSecret", totp_enabled AS "totpEnabled"
     FROM admins WHERE phone = $1`,
    [phone]
  );
  return rows[0] || null;
}
export async function getAdminById(id) {
  const { rows } = await pool.query(
    `SELECT id, phone, name, role, totp_enabled AS "totpEnabled" FROM admins WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}
export async function listAdmins() {
  const { rows } = await pool.query(
    `SELECT id, phone, name, role, totp_enabled AS "totpEnabled", created_at AS "createdAt" FROM admins ORDER BY id ASC`
  );
  return rows;
}
export async function createAdmin({ phone, passwordHash, name, role }) {
  const { rows } = await pool.query(
    `INSERT INTO admins (phone, password_hash, name, role) VALUES ($1,$2,$3,$4)
     ON CONFLICT (phone) DO NOTHING RETURNING id`,
    [phone, passwordHash, name || null, role]
  );
  return rows[0] || null;
}
export async function removeAdmin(id) {
  await pool.query(`DELETE FROM admins WHERE id = $1`, [id]);
}
export async function setAdminTotpSecret(id, secret) {
  await pool.query(`UPDATE admins SET totp_secret = $2, totp_enabled = FALSE WHERE id = $1`, [id, secret]);
}
export async function enableAdminTotp(id) {
  await pool.query(`UPDATE admins SET totp_enabled = TRUE WHERE id = $1`, [id]);
}
export async function disableAdminTotp(id) {
  await pool.query(`UPDATE admins SET totp_enabled = FALSE, totp_secret = NULL WHERE id = $1`, [id]);
}
export async function getAdminTotpSecret(id) {
  const { rows } = await pool.query(`SELECT totp_secret AS "totpSecret" FROM admins WHERE id = $1`, [id]);
  return rows[0]?.totpSecret || null;
}

export async function getUserPhoneAndTgId(userId) {
  const { rows } = await pool.query(
    `SELECT u.phone, bv.tg_user_id AS "tgUserId"
     FROM users u LEFT JOIN bot_verifications bv ON bv.phone = u.phone
     WHERE u.id = $1`,
    [userId]
  );
  return rows[0] || null;
}

export async function createPasswordResetCode(userId) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await pool.query(
    `INSERT INTO password_reset_codes (user_id, code, expires_at) VALUES ($1,$2, now() + interval '10 minutes')`,
    [userId, code]
  );
  return code;
}

export async function verifyAndConsumePasswordResetCode(userId, code) {
  const { rows } = await pool.query(
    `UPDATE password_reset_codes SET used = TRUE
     WHERE id = (
       SELECT id FROM password_reset_codes
       WHERE user_id = $1 AND code = $2 AND used = FALSE AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1
     )
     RETURNING id`,
    [userId, code]
  );
  return !!rows[0];
}

// Foydalanuvchining bir nechta vizitkasi bo'lsa, ulardan bittasini
// "Asosiy" deb belgilaydi — qolganlarining belgisi avtomatik olib
// tashlanadi (bir vaqtda faqat bitta asosiy bo'lishi mumkin).
export async function setPrimaryCard(code, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: owns } = await client.query(
      `SELECT 1 FROM cards WHERE code = $1 AND user_id = $2 FOR UPDATE`,
      [code, userId]
    );
    if (!owns[0]) { await client.query('ROLLBACK'); return null; }
    await client.query(`UPDATE cards SET is_primary = FALSE WHERE user_id = $1`, [userId]);
    await client.query(`UPDATE cards SET is_primary = TRUE WHERE code = $1`, [code]);
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getRecordOwner(code) {
  const { rows } = await pool.query(
    `SELECT user_id FROM cards WHERE code = $1`,
    [code]
  );
  return rows[0] ? rows[0].user_id : null;
}

// Foydalanuvchi O'Z NFC ID'sini butunlay o'chiradi. Qaytarib bo'lmaydi.
// 6-belgili (AAA000) kod o'chirilгач yana bo'sh bo'ladi (checker'да
// bandlanмаган ko'rinadi). 8-raqamli avto-ID esa shunчаки yo'qoladi.
// Foydalanuvchининг OXIRGI kartasini o'chirib bo'lmaydi.
export async function deleteOwnCard(code, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT code, is_primary AS "isPrimary" FROM cards WHERE code = $1 AND user_id = $2 FOR UPDATE`,
      [code, userId]
    );
    if (!rows[0]) { await client.query('ROLLBACK'); return { error: 'NOT_FOUND' }; }
    const { rows: mine } = await client.query(`SELECT COUNT(*)::int AS n FROM cards WHERE user_id = $1`, [userId]);
    if (mine[0].n <= 1) { await client.query('ROLLBACK'); return { error: 'LAST_CARD' }; }

    await client.query(`DELETE FROM post_likes WHERE post_id IN (SELECT id FROM posts WHERE code = $1)`, [code]);
    await client.query(`DELETE FROM posts WHERE code = $1`, [code]);
    await client.query(`DELETE FROM menu_items WHERE code = $1`, [code]);
    await client.query(`DELETE FROM menu_categories WHERE code = $1`, [code]);
    await client.query(`DELETE FROM card_files WHERE code = $1`, [code]);
    await client.query(`DELETE FROM card_videos WHERE code = $1`, [code]);
    await client.query(`DELETE FROM card_team WHERE code = $1`, [code]);
    await client.query(`DELETE FROM card_leads WHERE code = $1`, [code]);
    await client.query(`DELETE FROM card_events WHERE code = $1`, [code]);
    await client.query(`DELETE FROM card_likes WHERE code = $1`, [code]);
    await client.query(`UPDATE gift_offers SET status = 'cancelled', decided_at = now() WHERE code = $1 AND status = 'pending'`, [code]);
    await client.query(`UPDATE physical_cards SET linked_code = NULL WHERE linked_code = $1`, [code]);
    await client.query(`DELETE FROM cards WHERE code = $1`, [code]);

    if (rows[0].isPrimary) {
      await client.query(
        `UPDATE cards SET is_primary = TRUE
         WHERE code = (SELECT code FROM cards WHERE user_id = $1 ORDER BY ts ASC LIMIT 1)`,
        [userId]
      );
    }
    await client.query('COMMIT');
    return { ok: true, freeId: /^[0-9]{8}$/.test(code) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateRecord(code, fields) {
  const sets = [];
  const vals = [code];
  const map = {
    name: 'name',
    role: 'role',
    avatarUrl: 'avatar_url',
    bgUrl: 'bg_url',
    bgPattern: 'bg_pattern',
    accentColor: 'accent_color',
    bgColor: 'bg_color',
    bgAnimated: 'bg_animated',
    linksTransparent: 'links_transparent',
    linkStyle: 'link_style',
    profileType: 'profile_type',
    city: 'city',
    categorySlug: 'category_slug',
    hiddenFromDirectory: 'hidden_from_directory',
    leadCapture: 'lead_capture',
    musicUrl: 'music_url',
    tg: 'tg',
    phone: 'phone',
    email: 'email',
    linkedin: 'linkedin',
    instagram: 'instagram',
    about: 'about',
    facebook: 'facebook',
    twitter: 'twitter',
    website: 'website',
    cardNumber: 'card_number',
    theme: 'theme',
    hidePhone: 'hide_phone',
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in fields) {
      vals.push(fields[key]);
      sets.push(`${col} = $${vals.length}`);
    }
  }
  if ('hashtags' in fields) {
    vals.push(JSON.stringify(fields.hashtags));
    sets.push(`hashtags = $${vals.length}::jsonb`);
  }
  if ('extraLinks' in fields) {
    vals.push(JSON.stringify(fields.extraLinks));
    sets.push(`extra_links = $${vals.length}::jsonb`);
  }
  if ('cardNumbers' in fields) {
    vals.push(JSON.stringify(fields.cardNumbers));
    sets.push(`card_numbers = $${vals.length}::jsonb`);
  }
  if ('cardDesign' in fields) {
    vals.push(fields.cardDesign ? JSON.stringify(fields.cardDesign) : null);
    sets.push(`card_design = $${vals.length}::jsonb`);
  }
  if (!sets.length) return getRecord(code);
  const { rows } = await pool.query(
    `UPDATE cards SET ${sets.join(', ')} WHERE code = $1 RETURNING ${SELECT_FIELDS}`,
    vals
  );
  return rows[0] ? rowToRecord(rows[0]) : null;
}

// ---------- Sotuv (resale) ----------

export async function listForSale() {
  const { rows } = await pool.query(
    `SELECT ${SELECT_FIELDS} FROM cards WHERE for_sale = TRUE ORDER BY sale_price ASC LIMIT 200`
  );
  return rows.map(rowToRecord);
}

export async function setForSale(code, forSale, salePrice) {
  const { rows } = await pool.query(
    `UPDATE cards SET for_sale = $2, sale_price = $3 WHERE code = $1
     RETURNING ${SELECT_FIELDS}`,
    [code, forSale, forSale ? salePrice : null]
  );
  return rows[0] ? rowToRecord(rows[0]) : null;
}

// Vizitkani boshqa foydalanuvchiga o'tkazish (sotib olish).
export async function transferCard(code, fromUserId, toUserId) {
  const { rows } = await pool.query(
    `UPDATE cards SET user_id = $3, for_sale = FALSE, sale_price = NULL
     WHERE code = $1 AND user_id = $2 AND for_sale = TRUE
     RETURNING ${SELECT_FIELDS}`,
    [code, fromUserId, toUserId]
  );
  return rows[0] ? rowToRecord(rows[0]) : null;
}

// ---------- Telegram bot buyurtmalari ----------

const BOT_ORDER_FIELDS = `
  id, tg_user_id AS "tgUserId", tg_username AS "tgUsername", tg_name AS "tgName",
  code, price, status, screenshot_file_id AS "screenshotFileId",
  created_at AS "createdAt"
`;

function rowToBotOrder(row) {
  return {
    ...row,
    tgUsername: row.tgUsername || null,
    tgName: row.tgName || null,
    screenshotFileId: row.screenshotFileId || null,
  };
}

export async function createBotOrder({ tgUserId, tgUsername, tgName, code, price }) {
  const { rows } = await pool.query(
    `INSERT INTO bot_orders (tg_user_id, tg_username, tg_name, code, price)
     VALUES ($1,$2,$3,$4,$5) RETURNING ${BOT_ORDER_FIELDS}`,
    [tgUserId, tgUsername || null, tgName || null, code, price]
  );
  return rows[0] ? rowToBotOrder(rows[0]) : null;
}

export async function getBotOrder(id) {
  const { rows } = await pool.query(
    `SELECT ${BOT_ORDER_FIELDS} FROM bot_orders WHERE id = $1`,
    [id]
  );
  return rows[0] ? rowToBotOrder(rows[0]) : null;
}

export async function setBotOrderStatus(id, status, screenshotFileId) {
  const { rows } = await pool.query(
    `UPDATE bot_orders
     SET status = $2,
         screenshot_file_id = COALESCE($3, screenshot_file_id)
     WHERE id = $1
     RETURNING ${BOT_ORDER_FIELDS}`,
    [id, status, screenshotFileId || null]
  );
  return rows[0] ? rowToBotOrder(rows[0]) : null;
}

// Bot orderni "to'landi" deb belgilaydi va kodni band qiladi — Payme/Paynet
// webhook'i kelganda ham, admin QO'LDA tasdiqlaganda ham SHU BITTA
// funksiya ishlatiladi (ikki marta yozilmasin).
export async function finalizePaidBotOrder(orderId) {
  const order = await getBotOrder(orderId);
  if (!order || order.status !== 'pending') return { alreadyProcessed: true };
  await setBotOrderStatus(order.id, 'paid');
  if (!(await getRecord(order.code))) {
    await createRecord({ code: order.code, name: 'TELEGRAM MIJOZ', price: order.price });
  }
  return { ok: true, order };
}

export async function listBotOrdersByUser(tgUserId) {
  const { rows } = await pool.query(
    `SELECT ${BOT_ORDER_FIELDS} FROM bot_orders
     WHERE tg_user_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [tgUserId]
  );
  return rows.map(rowToBotOrder);
}

export async function latestPendingBotOrder(tgUserId) {
  const { rows } = await pool.query(
    `SELECT ${BOT_ORDER_FIELDS} FROM bot_orders
     WHERE tg_user_id = $1 AND status = 'pending'
     ORDER BY created_at DESC LIMIT 1`,
    [tgUserId]
  );
  return rows[0] ? rowToBotOrder(rows[0]) : null;
}

// Kod bo'yicha faol (to'lanmagan/pending) buyurtma bormi?
export async function activeBotOrderByCode(code) {
  const { rows } = await pool.query(
    `SELECT ${BOT_ORDER_FIELDS} FROM bot_orders
     WHERE code = $1 AND status IN ('pending','paid')
     ORDER BY created_at DESC LIMIT 1`,
    [code]
  );
  return rows[0] ? rowToBotOrder(rows[0]) : null;
}

export async function listPendingBotOrders() {
  const { rows } = await pool.query(
    `SELECT ${BOT_ORDER_FIELDS} FROM bot_orders
     WHERE status = 'pending' ORDER BY created_at ASC LIMIT 50`
  );
  return rows.map(rowToBotOrder);
}

export async function countPaidBotOrders() {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM bot_orders WHERE status = 'paid'`);
  return Number(rows[0].n);
}

export async function listActiveBotOrderCodes() {
  const { rows } = await pool.query(
    `SELECT DISTINCT code FROM bot_orders WHERE status IN ('pending','paid')`
  );
  return rows.map((r) => r.code);
}

// ---------- Sayt buyurtmalari (to'lov tasdiqlangach karta yaratiladi) ----------

const WEB_ORDER_FIELDS = `
  id, user_id AS "userId", code, kind, price, payload, status, created_at AS "createdAt"
`;

export async function createWebOrder({ userId, code, price, payload, kind = 'card_purchase' }) {
  const { rows } = await pool.query(
    `INSERT INTO web_orders (user_id, code, kind, price, payload)
     VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING ${WEB_ORDER_FIELDS}`,
    [userId, code, kind, price, JSON.stringify(payload || {})]
  );
  return rows[0] || null;
}

// Bir xil auksion uchun ikkinchi marta "To'lash" bosilsa, YANGI (dublikat)
// to'lov buyurtmasi yaratilmasin — mavjud kutilayotganini qaytaramiz.
// Aks holda foydalanuvchi ehtimol ikki marta to'lab qo'yishi mumkin edi.
export async function getPendingAuctionPaymentOrder(auctionId, userId) {
  const { rows } = await pool.query(
    `SELECT ${WEB_ORDER_FIELDS} FROM web_orders
     WHERE user_id = $1 AND kind = 'auction_payment' AND status = 'pending'
       AND (payload->>'auctionId')::int = $2
     ORDER BY created_at DESC LIMIT 1`,
    [userId, auctionId]
  );
  return rows[0] || null;
}

// Admin uchun — auksionning KUTILAYOTGAN to'lov buyurtmasini (kim
// bo'lishidan qat'i nazar) topadi. Admin "To'lovni tasdiqlash" bosganda
// shu buyurtma finalize qilinadi.
export async function findPendingAuctionPaymentOrderByAuction(auctionId) {
  const { rows } = await pool.query(
    `SELECT ${WEB_ORDER_FIELDS} FROM web_orders
     WHERE kind = 'auction_payment' AND status = 'pending'
       AND (payload->>'auctionId')::int = $1
     ORDER BY created_at DESC LIMIT 1`,
    [auctionId]
  );
  return rows[0] || null;
}

export async function getWebOrder(id) {
  const { rows } = await pool.query(
    `SELECT ${WEB_ORDER_FIELDS} FROM web_orders WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function setWebOrderStatus(id, status) {
  const { rows } = await pool.query(
    `UPDATE web_orders SET status = $2 WHERE id = $1 RETURNING ${WEB_ORDER_FIELDS}`,
    [id, status]
  );
  return rows[0] || null;
}

// ---------- Payme integratsiyasi uchun ----------

export async function getWebOrderByPaymeId(paymeTransactionId) {
  const { rows } = await pool.query(
    `SELECT ${WEB_ORDER_FIELDS}, payme_transaction_id AS "paymeTransactionId"
     FROM web_orders WHERE payme_transaction_id = $1`,
    [paymeTransactionId]
  );
  return rows[0] || null;
}

export async function setWebOrderPaymeId(id, paymeTransactionId) {
  await pool.query(`UPDATE web_orders SET payme_transaction_id = $2 WHERE id = $1`, [id, paymeTransactionId]);
}

// Buyurtma turi (kind)ga qarab to'g'ri "finalize" mantig'ini bajaradi —
// Payme va Paynet webhook'lari ikkalasi ham SHU BITTA funksiyani
// chaqiradi, shunda ikki marta kod yozilmaydi va ikkalasi bir xil
// ishlaydi. Idempotent: agar buyurtma allaqachon 'pending' bo'lmasa,
// hech narsa qilmay qaytadi.
export async function finalizePaidWebOrder(orderId) {
  const order = await getWebOrder(orderId);
  if (!order || order.status !== 'pending') return { alreadyProcessed: true };

  if (order.kind === 'auction_payment') {
    const auctionId = Number(order.payload?.auctionId);
    const result = await finalizeAuctionPayment(auctionId, order.userId, order.payload || {});
    await setWebOrderStatus(order.id, result ? 'paid' : 'failed_code_taken');
    return { ok: !!result, result };
  }

  if (order.kind === 'premium_upgrade') {
    await finalizePremiumUpgrade(order.userId);
    await setWebOrderStatus(order.id, 'paid');
    return { ok: true };
  }

  if (order.kind === 'premium_follow') {
    const followeeId = Number(order.payload?.followeeId);
    await finalizeFollowPayment(order.userId, followeeId, order.price, Number(process.env.PREMIUM_FOLLOW_COMMISSION_PCT || 5));
    await setWebOrderStatus(order.id, 'paid');
    return { ok: true };
  }

  // Mavjud (allaqachon egasi bor) kod uchun KEYINCHALIK jismoniy karta
  // buyurtma qilish — dastlabki bandlash paytidagi jismoniy karta
  // tanlovidan farqli, alohida oqim.
  if (order.kind === 'physical_card_order') {
    const p = order.payload || {};
    await createPhysicalCard({
      linkedCode: order.code,
      ownerUserId: order.userId,
      shippingName: p.shippingName || '',
      shippingPhone: p.shippingPhone || '',
      shippingAddress: p.shippingAddress || '',
    });
    await setWebOrderStatus(order.id, 'paid');
    return { ok: true };
  }

  // 'card_purchase' — oddiy vizitka xaridi (jismoniy karta bilan yoki bo'lmasa).
  const existing = await getRecord(order.code);
  if (existing) {
    await setWebOrderStatus(order.id, 'failed_code_taken');
    return { ok: false, reason: 'code_taken' };
  }
  const created = await createRecord({ ...order.payload, code: order.code, price: order.price });
  if (created) {
    await attachCardToUser(order.code, order.userId);
    if (order.payload?.physicalCard) {
      await createPhysicalCard({
        linkedCode: order.code,
        ownerUserId: order.userId,
        shippingName: order.payload.shippingName,
        shippingPhone: order.payload.shippingPhone,
        shippingAddress: order.payload.shippingAddress,
      });
    }
  }
  await setWebOrderStatus(order.id, 'paid');
  return { ok: true, created };
}

export async function cancelPendingWebOrder(orderId) {
  await setWebOrderStatus(orderId, 'cancelled');
}

// Kod bo'yicha faol (to'lanmagan) sayt buyurtmasi bormi? — shu kodni
// boshqa birov bir vaqtning o'zida bosib olib qolmasligi uchun.
export async function activeWebOrderByCode(code) {
  const { rows } = await pool.query(
    `SELECT ${WEB_ORDER_FIELDS} FROM web_orders WHERE code = $1 AND status = 'pending' LIMIT 1`,
    [code]
  );
  return rows[0] || null;
}

export async function listWebOrdersByUser(userId) {
  const { rows } = await pool.query(
    `SELECT ${WEB_ORDER_FIELDS} FROM web_orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [userId]
  );
  return rows;
}

// ---------- Hamyon (balans) — Payme orqali to'ldiriladi ----------

const WALLET_TOPUP_FIELDS = `
  id, user_id AS "userId", amount, status, created_at AS "createdAt"
`;

export async function createWalletTopup({ userId, amount }) {
  const { rows } = await pool.query(
    `INSERT INTO wallet_topups (user_id, amount) VALUES ($1,$2)
     RETURNING ${WALLET_TOPUP_FIELDS}`,
    [userId, amount]
  );
  return rows[0] || null;
}

export async function getWalletTopup(id) {
  const { rows } = await pool.query(
    `SELECT ${WALLET_TOPUP_FIELDS}, payme_transaction_id AS "paymeTransactionId"
     FROM wallet_topups WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function getWalletTopupByPaymeId(paymeTransactionId) {
  const { rows } = await pool.query(
    `SELECT ${WALLET_TOPUP_FIELDS}, payme_transaction_id AS "paymeTransactionId"
     FROM wallet_topups WHERE payme_transaction_id = $1`,
    [paymeTransactionId]
  );
  return rows[0] || null;
}

export async function setWalletTopupPaymeId(id, paymeTransactionId) {
  await pool.query(`UPDATE wallet_topups SET payme_transaction_id = $2 WHERE id = $1`, [id, paymeTransactionId]);
}

// To'lov muvaffaqiyatli bo'lganda: buyurtma holatini yangilaydi VA
// foydalanuvchi balansini bitta tranzaksiyada oshiradi (ikkalasi ham
// muvaffaqiyatli bo'lishi yoki ikkalasi ham bekor bo'lishi kerak).
export async function markWalletTopupPaid(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE wallet_topups SET status = 'paid' WHERE id = $1 AND status = 'pending'
       RETURNING ${WALLET_TOPUP_FIELDS}`,
      [id]
    );
    const order = rows[0];
    if (order) {
      await client.query(`UPDATE users SET balance = balance + $2 WHERE id = $1`, [order.userId, order.amount]);
      await client.query(
        `INSERT INTO transactions (user_id, amount, kind, ref_table, ref_id, note)
         VALUES ($1,$2,'topup','wallet_topups',$3,'Payme orqali NFC Pay to\u2019ldirildi')`,
        [order.userId, order.amount, order.id]
      );
    }
    await client.query('COMMIT');
    return order || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Payme CancelTransaction: agar buyurtma hali 'pending' bo'lsa — shunchaki
// bekor qilamiz (balansga tegilmagan). Agar 'paid' bo'lsa — bu holatda pul
// allaqachon foydalanuvchi balansiga yozilgan; uni avtomatik orqaga
// qaytaramiz, LEKIN agar u pulni allaqachon sarflab (masalan auksionda
// bandlab yoki xarid qilib) ulgurgan bo'lsa, balans manfiy bo'lib
// qolmasligi uchun to'liq qaytarib bo'lmaydi — shu holatni aniq
// belgilab, admin panelga chiqadigan qilib qoldiramiz (qo'lda hal qilish
// uchun), avtomatik yashirmaymiz.
export async function cancelWalletTopup(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: tRows } = await client.query(
      `SELECT ${WALLET_TOPUP_FIELDS} FROM wallet_topups WHERE id = $1 FOR UPDATE`,
      [id]
    );
    const order = tRows[0];
    if (!order) { await client.query('ROLLBACK'); return null; }

    if (order.status === 'pending') {
      await client.query(`UPDATE wallet_topups SET status = 'cancelled' WHERE id = $1`, [id]);
      await client.query('COMMIT');
      return { ...order, status: 'cancelled' };
    }

    if (order.status === 'paid') {
      const { rows: uRows } = await client.query(
        `SELECT balance, held_balance AS "heldBalance" FROM users WHERE id = $1 FOR UPDATE`,
        [order.userId]
      );
      const u = uRows[0];
      const available = u ? Number(u.balance) - Number(u.heldBalance) : 0;

      if (u && available >= Number(order.amount)) {
        // Pul hali ishlatilmagan — to'liq avtomatik qaytaramiz.
        await client.query(`UPDATE users SET balance = balance - $2 WHERE id = $1`, [order.userId, order.amount]);
        await client.query(
          `INSERT INTO transactions (user_id, amount, kind, ref_table, ref_id, note)
           VALUES ($1,$2,'refund','wallet_topups',$3,'Payme to\u2019lovi bekor qilindi \u2014 avtomatik qaytarildi')`,
          [order.userId, -Number(order.amount), order.id]
        );
        await client.query(`UPDATE wallet_topups SET status = 'cancelled' WHERE id = $1`, [id]);
        await client.query('COMMIT');
        return { ...order, status: 'cancelled' };
      }

      // Pul allaqachon sarflangan/bandlangan — avtomatik yechib bo'lmaydi,
      // adminning qo'lda ko'rib chiqishi shart.
      await client.query(`UPDATE wallet_topups SET status = 'cancel_needs_review' WHERE id = $1`, [id]);
      await client.query(
        `INSERT INTO transactions (user_id, amount, kind, ref_table, ref_id, note)
         VALUES ($1,0,'admin_adjust','wallet_topups',$2,'DIQQAT: to\u2019lov bekor qilindi, lekin foydalanuvchi pulni sarflab ulgurgan \u2014 qo\u2019lda ko\u2019rib chiqish kerak')`,
        [order.userId, order.id]
      );
      await client.query('COMMIT');
      return { ...order, status: 'cancel_needs_review' };
    }

    await client.query('ROLLBACK');
    return order;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getWallet(userId) {
  const { rows } = await pool.query(
    `SELECT balance, held_balance AS "heldBalance" FROM users WHERE id = $1`,
    [userId]
  );
  if (!rows[0]) return { balance: 0, heldBalance: 0, available: 0 };
  const balance = Number(rows[0].balance);
  const heldBalance = Number(rows[0].heldBalance);
  return { balance, heldBalance, available: balance - heldBalance };
}

// ---------- Auksion ----------

const AUCTION_FIELDS = `
  a.id, a.code, a.seller_id AS "sellerId", a.start_price AS "startPrice",
  a.buy_now_price AS "buyNowPrice", a.current_price AS "currentPrice",
  a.highest_bidder_id AS "highestBidderId", a.ends_at AS "endsAt",
  a.status, a.payment_deadline AS "paymentDeadline",
  a.seller_payout_amount AS "sellerPayoutAmount", a.seller_payout_status AS "sellerPayoutStatus",
  a.seller_payme_number AS "sellerPaymeNumber",
  a.min_increment AS "minIncrement",
  a.created_at AS "createdAt"
`;

// Admin tomonidan yangi (hali hech kimga tegishli bo'lmagan) kod uchun
// auksion ochish — sellerId endi har doim NULL (sotuvchi yo'q, platforma
// o'zi taklif qiladi).
// ---------- Auksion so'rovlari (foydalanuvchidan) ----------

export async function createAuctionRequest(userId, code, note) {
  // Foydalanuvchi bir kod uchun bir vaqtda faqat bitta kutilayotgan
  // so'rov yubora oladi (spam'ning oldini olish uchun).
  const { rows: existing } = await pool.query(
    `SELECT id FROM auction_requests WHERE user_id = $1 AND code = $2 AND status = 'pending'`,
    [userId, code]
  );
  if (existing[0]) return { error: 'ALREADY_PENDING' };
  const { rows } = await pool.query(
    `INSERT INTO auction_requests (user_id, code, note) VALUES ($1,$2,$3) RETURNING id`,
    [userId, code, note || null]
  );
  return { ok: true, id: rows[0].id };
}

export async function listAuctionRequests(status = 'pending') {
  const { rows } = await pool.query(
    `SELECT ar.id, ar.code, ar.note, ar.status, ar.created_at AS "createdAt",
            u.id AS "userId", u.email AS "userEmail",
            (SELECT c.code FROM cards c WHERE c.user_id = u.id ORDER BY c.is_primary DESC, c.ts ASC LIMIT 1) AS "userCode"
     FROM auction_requests ar JOIN users u ON u.id = ar.user_id
     WHERE ar.status = $1 ORDER BY ar.created_at DESC`,
    [status]
  );
  return rows;
}

export async function rejectAuctionRequest(id) {
  const { rows } = await pool.query(
    `UPDATE auction_requests SET status = 'rejected' WHERE id = $1 AND status = 'pending' RETURNING id`,
    [id]
  );
  return !!rows[0];
}

export async function approveAuctionRequest(id) {
  const { rows } = await pool.query(
    `UPDATE auction_requests SET status = 'approved' WHERE id = $1 AND status = 'pending' RETURNING id, code`,
    [id]
  );
  return rows[0] || null;
}

// ---------- Auksion "Talab" board (demand) ----------

const DEMAND_FIELDS = `
  d.id, d.code, d.status,
  d.suggested_start_price AS "suggestedStartPrice",
  d.suggested_min_step AS "suggestedMinStep",
  d.interest_count AS "interestCount",
  d.auction_id AS "auctionId",
  d.created_at AS "createdAt"
`;

function demandRow(r) {
  if (!r) return r;
  return {
    ...r,
    suggestedStartPrice: Number(r.suggestedStartPrice),
    suggestedMinStep: Number(r.suggestedMinStep),
    interestCount: Number(r.interestCount),
    threshold: AUCTION_DEMAND_THRESHOLD,
  };
}

// Ochiq ro'yxat — yashirilganlardan boshqa hammasi. userId berilса, har
// qatorда shu foydalanuvchi ovoz berганmi (voted) ko'rsatiladi. Faol/sotilган
// auksion narxi/tugash vaqti ham qo'shiladi.
export async function listAuctionDemand(userId = null) {
  const { rows } = await pool.query(
    `SELECT ${DEMAND_FIELDS},
            a.current_price AS "auctionCurrentPrice",
            a.ends_at       AS "auctionEndsAt",
            a.status        AS "auctionStatus",
            ${userId ? `EXISTS(SELECT 1 FROM auction_demand_votes v WHERE v.demand_id = d.id AND v.user_id = $1)` : 'FALSE'} AS "voted"
     FROM auction_demand d
     LEFT JOIN auctions a ON a.id = d.auction_id
     WHERE d.status <> 'hidden'
     ORDER BY
       CASE d.status WHEN 'ready' THEN 0 WHEN 'collecting' THEN 1 WHEN 'auction_live' THEN 2 ELSE 3 END,
       d.interest_count DESC, d.created_at DESC
     LIMIT 300`,
    userId ? [userId] : []
  );
  return rows.map((r) => ({
    ...demandRow(r),
    voted: !!r.voted,
    auctionCurrentPrice: r.auctionCurrentPrice != null ? Number(r.auctionCurrentPrice) : null,
    auctionEndsAt: r.auctionEndsAt || null,
    auctionStatus: r.auctionStatus || null,
  }));
}

// "Auksionda qatnashaman" — bir hisob bir marta. Threshold yetganда
// { becameReady: true } qaytadi (chaqiruvchi Telegram xabar yuboradi).
export async function voteAuctionDemand(demandId, userId) {
  const { rows: dRows } = await pool.query(
    `SELECT id, code, status, interest_count FROM auction_demand WHERE id = $1`,
    [demandId]
  );
  const d = dRows[0];
  if (!d) return { error: 'NOT_FOUND' };
  if (d.status !== 'collecting' && d.status !== 'ready') {
    return { error: 'CLOSED' };
  }
  const ins = await pool.query(
    `INSERT INTO auction_demand_votes (demand_id, user_id) VALUES ($1,$2)
     ON CONFLICT (demand_id, user_id) DO NOTHING RETURNING demand_id`,
    [demandId, userId]
  );
  if (!ins.rows[0]) {
    // Allaqachon ovoz bergan — joriy holatni qaytaramiz.
    return { ok: true, alreadyVoted: true, interestCount: Number(d.interest_count), status: d.status, code: d.code };
  }
  // Ovoz sanog'ini oshiramiz — CHEKLOV YO'Q, 20 dan oshsa ham davom etadi.
  const { rows: uRows } = await pool.query(
    `UPDATE auction_demand SET interest_count = interest_count + 1
     WHERE id = $1 RETURNING code, status, interest_count`,
    [demandId]
  );
  const u = uRows[0];
  let status = u.status;
  let becameReady = false;
  // Threshold birinchi marta yetganda — ATOMIK "claim": faqat 'collecting' →
  // 'ready' qila olgan bitta so'rov signal yuboradi (parallel ovozlarda ham
  // bir marta). 20 tadan keyingi ovozlar sanoqni oshiraveradi.
  if (u.status === 'collecting' && Number(u.interest_count) >= AUCTION_DEMAND_THRESHOLD) {
    const claim = await pool.query(
      `UPDATE auction_demand
         SET status = 'ready', notified_ready_at = COALESCE(notified_ready_at, now())
       WHERE id = $1 AND status = 'collecting'
       RETURNING id`,
      [demandId]
    );
    if (claim.rows[0]) { status = 'ready'; becameReady = true; }
  }
  return {
    ok: true,
    voted: true,
    code: u.code,
    status,
    interestCount: Number(u.interest_count),
    becameReady,
  };
}

// ── Admin ──
export async function adminListAuctionDemand() {
  const { rows } = await pool.query(
    `SELECT ${DEMAND_FIELDS}, d.notified_ready_at AS "notifiedReadyAt"
     FROM auction_demand d
     ORDER BY
       CASE d.status WHEN 'ready' THEN 0 WHEN 'collecting' THEN 1 WHEN 'auction_live' THEN 2 WHEN 'done' THEN 3 ELSE 4 END,
       d.interest_count DESC, d.created_at DESC`
  );
  return rows.map(demandRow);
}

export async function adminAddAuctionDemand({ code, startPrice, minStep }) {
  const { rows } = await pool.query(
    `INSERT INTO auction_demand (code, suggested_start_price, suggested_min_step)
     VALUES ($1, $2, $3)
     ON CONFLICT (code) DO NOTHING
     RETURNING ${DEMAND_FIELDS.replace(/d\./g, '')}`,
    [code, Math.max(10000, Math.round(Number(startPrice) || 250000)), Math.max(1000, Math.round(Number(minStep) || 25000))]
  );
  return rows[0] ? demandRow(rows[0]) : null;
}

export async function adminUpdateAuctionDemand(id, fields) {
  const sets = [];
  const vals = [id];
  if (fields.status && ['collecting', 'ready', 'hidden', 'done'].includes(fields.status)) {
    sets.push(`status = $${vals.push(fields.status)}`);
  }
  if (fields.startPrice != null) {
    sets.push(`suggested_start_price = $${vals.push(Math.max(10000, Math.round(Number(fields.startPrice))))}`);
  }
  if (fields.minStep != null) {
    sets.push(`suggested_min_step = $${vals.push(Math.max(1000, Math.round(Number(fields.minStep))))}`);
  }
  if (!sets.length) return null;
  const { rows } = await pool.query(
    `UPDATE auction_demand SET ${sets.join(', ')} WHERE id = $1 RETURNING ${DEMAND_FIELDS.replace(/d\./g, '')}`,
    vals
  );
  return rows[0] ? demandRow(rows[0]) : null;
}

export async function adminDeleteAuctionDemand(id) {
  const { rows } = await pool.query(`DELETE FROM auction_demand WHERE id = $1 RETURNING id`, [id]);
  return !!rows[0];
}

export async function getAuctionDemandByCode(code) {
  const { rows } = await pool.query(
    `SELECT ${DEMAND_FIELDS} FROM auction_demand d WHERE d.code = $1`,
    [code]
  );
  return rows[0] ? demandRow(rows[0]) : null;
}

// ---------- Foydalanuvchi yutgan, hali to'lanmagan auksionlar ----------

export async function listWonAuctionsAwaitingPayment(userId) {
  const { rows } = await pool.query(
    `SELECT id, code, current_price AS "currentPrice", payment_deadline AS "paymentDeadline"
     FROM auctions WHERE highest_bidder_id = $1 AND status = 'awaiting_payment'
     ORDER BY payment_deadline ASC`,
    [userId]
  );
  return rows.map((r) => ({ ...r, currentPrice: Number(r.currentPrice) }));
}

// Admin tomonidan yangi (hali hech kimga tegishli bo'lmagan) kod uchun
// auksion ochish — sellerId endi har doim NULL (sotuvchi yo'q, platforma
// o'zi taklif qiladi).
export async function createAuction({ code, startPrice, buyNowPrice, hours, minStep }) {
  const step = Math.max(1000, Math.round(Number(minStep) || 25000));
  const { rows } = await pool.query(
    `INSERT INTO auctions (code, seller_id, start_price, buy_now_price, current_price, ends_at, created_by_admin, min_increment)
     VALUES ($1,NULL,$2,$3,$2, now() + ($4 || ' hours')::interval, TRUE, $5)
     RETURNING ${AUCTION_FIELDS.replace(/a\./g, '')}`,
    [code, startPrice, buyNowPrice || null, hours, step]
  );
  const auction = rows[0] || null;
  // Shu kod "Talab" board'ida bo'lsa — auksionга bog'laymiz.
  if (auction) {
    await pool.query(
      `UPDATE auction_demand SET status = 'auction_live', auction_id = $2 WHERE code = $1 AND status IN ('collecting','ready')`,
      [code, auction.id]
    ).catch(() => {});
  }
  return auction;
}

export async function getActiveAuctionByCode(code) {
  const { rows } = await pool.query(
    `SELECT ${AUCTION_FIELDS} FROM auctions a WHERE a.code = $1 AND a.status = 'active' LIMIT 1`,
    [code]
  );
  return rows[0] || null;
}

export async function getAuction(id) {
  const { rows } = await pool.query(
    `SELECT ${AUCTION_FIELDS} FROM auctions a WHERE a.id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function listActiveAuctions() {
  const { rows } = await pool.query(
    `SELECT ${AUCTION_FIELDS} FROM auctions a WHERE a.status = 'active' ORDER BY a.ends_at ASC LIMIT 200`
  );
  return rows;
}

// "Sotilgan" filtri uchun — yaqinda sotilgan auksionlar (ochiq).
export async function listRecentSoldAuctions(limit = 40) {
  const { rows } = await pool.query(
    `SELECT ${AUCTION_FIELDS} FROM auctions a WHERE a.status = 'sold' ORDER BY a.ends_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function setAuctionSellerPayme(auctionId, paymeNumber) {
  await pool.query(`UPDATE auctions SET seller_payme_number = $2 WHERE id = $1`, [auctionId, paymeNumber]);
}

// Admin sotuvchiga qo'lda to'lov qilgach shu chaqiriladi.
export async function markAuctionPayoutPaid(auctionId) {
  const { rows } = await pool.query(
    `UPDATE auctions SET seller_payout_status = 'paid' WHERE id = $1 AND seller_payout_status = 'pending'
     RETURNING id`,
    [auctionId]
  );
  return rows[0] || null;
}

export async function listExpiredActiveAuctions() {
  const { rows } = await pool.query(
    `SELECT ${AUCTION_FIELDS} FROM auctions a WHERE a.status = 'active' AND a.ends_at <= now() LIMIT 50`
  );
  return rows;
}

// Har bir taklif yonida bidderning O'Z asosiy (yoki birinchi) NFC ID'si
// ko'rsatiladi (agar bo'lsa) — "Foydalanuvchi #N" o'rniga tanish, brendga
// mos identifikatsiya.
export async function listBidsByAuction(auctionId) {
  const { rows } = await pool.query(
    `SELECT b.id, b.auction_id AS "auctionId", b.user_id AS "userId", b.amount, b.released,
            b.created_at AS "createdAt",
            (SELECT c.code FROM cards c WHERE c.user_id = b.user_id
               ORDER BY c.is_primary DESC, c.ts ASC LIMIT 1) AS "bidderCode"
     FROM bids b WHERE b.auction_id = $1 ORDER BY b.amount DESC, b.created_at ASC`,
    [auctionId]
  );
  return rows;
}

// Narx taklif qilish — butun mantiq PostgreSQL'dagi place_bid() RPC
// funksiyasi ichida, bitta ACID tranzaksiya sifatida bajariladi (qarang:
// initDb() ichidagi CREATE FUNCTION). Bu yerda faqat chaqiramiz va
// natijani JS formatiga o'giramiz — balansni bu yerda HECH QACHON
// to'g'ridan-to'g'ri o'zgartirmaymiz.
export async function placeBid({ auctionId, userId, amount, idempotencyKey }) {
  const key = idempotencyKey || `${userId}:${auctionId}:${amount}:${Date.now()}`;
  const { rows } = await pool.query(
    `SELECT place_bid($1, $2, $3, $4) AS result`,
    [userId, auctionId, amount, key]
  );
  const result = rows[0]?.result || { ok: false, error: 'SYSTEM' };
  if (!result.ok) return { error: result.error, available: result.available };
  return { ok: true, buyNow: !!result.buyNow, idempotent: !!result.idempotent, bidId: result.bidId };
}

// Muddati tugagan auksionni yakunlaydi: g'olib bo'lsa — kartani o'tkazadi,
// sotuvchiga komissiyadan keyingi summani yozadi, boshqa hamma taklif
// qiluvchilarning holdini bo'shatadi. G'olib bo'lmasa — auksion "expired".
// Auksion bidlash muddati tugaganda chaqiriladi. E-wallet yo'qligi
// sababli bu funksiya endi pul harakatlantirmaydi — faqat holatni
// o'zgartiradi: g'olib bo'lsa 'awaiting_payment' (24 soat real to'lov
// muddati bilan), bo'lmasa 'expired'. Haqiqiy pul harakati va egalik
// o'tkazish faqat `finalizeAuctionPayment()` orqali, to'lov Payme/Paynet
// webhook'i bilan TASDIQLANGANDA sodir bo'ladi.
export async function closeAuctionBidding(auctionId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: aRows } = await client.query(
      `SELECT id, highest_bidder_id AS "highestBidderId", status
       FROM auctions WHERE id = $1 FOR UPDATE`,
      [auctionId]
    );
    const auction = aRows[0];
    if (!auction || auction.status !== 'active') { await client.query('ROLLBACK'); return null; }

    if (auction.highestBidderId) {
      await client.query(
        `UPDATE auctions SET status = 'awaiting_payment', payment_deadline = now() + interval '24 hours'
         WHERE id = $1`,
        [auctionId]
      );
      await client.query('COMMIT');
      return { awaitingPayment: true };
    } else {
      await client.query(`UPDATE auctions SET status = 'expired' WHERE id = $1`, [auctionId]);
      await client.query('COMMIT');
      return { expired: true };
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// G'olib real to'lovni (Payme/Paynet) muvaffaqiyatli amalga oshirganda
// webhook orqali chaqiriladi: karta egasi almashadi, sotuvchiga tegishli
// 95% "to'lanishi kerak" deb belgilanadi (admin panelda qo'lda to'lanadi —
// e-wallet yo'qligi sababli avtomatik o'tkazib bo'lmaydi), platforma
// komissiyasi hisobga yoziladi (haqiqiy pul, real Payme orqali kelgan).
// G'olib to'lagach chaqiriladi: ENDI mavjud kartani ko'chirish emas —
// bu kod hali hech kimga tegishli bo'lmagan, shuning uchun YANGI karta
// yaratiladi (g'olib bergan profil ma'lumotlari bilan). Sotuvchi yo'q —
// butun summa platforma daromadiga tushadi.
export async function finalizeAuctionPayment(auctionId, winnerId, profile) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: aRows } = await client.query(
      `SELECT id, code, current_price AS "currentPrice", highest_bidder_id AS "highestBidderId", status
       FROM auctions WHERE id = $1 FOR UPDATE`,
      [auctionId]
    );
    const auction = aRows[0];
    if (!auction || auction.status !== 'awaiting_payment' || auction.highestBidderId !== winnerId) {
      await client.query('ROLLBACK'); return null;
    }
    // Kimdir shu kodni boshqa yo'l bilan (masalan to'g'ridan-to'g'ri
    // band qilib) ulgurmaganini tekshiramiz — juda kam holat, lekin
    // xavfsizlik uchun shart.
    const { rows: exists } = await client.query(`SELECT 1 FROM cards WHERE code = $1`, [auction.code]);
    if (exists[0]) { await client.query('ROLLBACK'); return null; }

    const winAmount = Number(auction.currentPrice);

    await client.query(
      `INSERT INTO cards (code, name, role, avatar_url, tg, phone, email, linkedin, instagram, theme, hashtags, price, ts, user_id, is_primary)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,TRUE)`,
      [
        auction.code,
        profile.name || 'Yangi egasi',
        profile.role || '',
        profile.avatarUrl || '',
        profile.tg || '',
        profile.phone || '',
        profile.email || '',
        profile.linkedin || '',
        profile.instagram || '',
        'classic',
        JSON.stringify([]),
        winAmount,
        Date.now(),
        winnerId,
      ]
    );
    // Auksionda yutib olingan ID avtomatik "Asosiy profil" bo'ladi —
    // g'olibning boshqa (eski) kodlaridagi "Asosiy" belgisi olib tashlanadi.
    await client.query(`UPDATE cards SET is_primary = FALSE WHERE user_id = $1 AND code <> $2`, [winnerId, auction.code]);

    // Butun summa (sotuvchi yo'qligi sababli) platforma daromadiga tushadi.
    await creditPlatformWallet(client, winAmount, 'platform_commission', 'auctions', auctionId,
      `Auksion daromadi (100%) \u2014 ${auction.code}`);

    await client.query(`UPDATE auctions SET status = 'sold' WHERE id = $1`, [auctionId]);

    await client.query('COMMIT');
    return { code: auction.code, winnerId, winAmount };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// To'lov muddati (24 soat) o'tib ketgan, lekin g'olib to'lamagan
// auksionlarni "payment_expired" deb belgilaydi.
// To'lov muddati (24 soat) o'tib ketgan, lekin g'olib to'lamagan
// auksionlarni "payment_expired" deb belgilaydi VA g'olibga jazo qo'llaydi:
// 1-marta — 72 soat akkauntga kirish taqiqlanadi; 2-marta va undan ko'p —
// strike_count oshib boradi (doimiy taqiq/o'chirishni admin panelda
// qo'lda hal qiladi — avtomatik akkaunt o'chirilmaydi, bu og'ir qaror).
export async function expireUnpaidAuctions() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: expired } = await client.query(
      `UPDATE auctions SET status = 'payment_expired'
       WHERE status = 'awaiting_payment' AND payment_deadline < now()
       RETURNING id, code, highest_bidder_id AS "highestBidderId"`
    );
    for (const a of expired) {
      if (!a.highestBidderId) continue;
      const { rows } = await client.query(
        `UPDATE users SET strike_count = strike_count + 1 WHERE id = $1 RETURNING strike_count AS "strikeCount"`,
        [a.highestBidderId]
      );
      const strikeCount = rows[0]?.strikeCount || 1;
      if (strikeCount === 1) {
        await client.query(`UPDATE users SET banned_until = now() + interval '72 hours' WHERE id = $1`, [a.highestBidderId]);
      }
      // 2-marta va undan ko'p bo'lsa — banned_until yangilanmaydi (admin
      // panelda strike_count >= 2 ko'ringan foydalanuvchini admin qo'lda
      // ko'rib chiqadi, kerak bo'lsa doimiy bloklaydi yoki vizitkasini oladi).
      console.log(`[auction] #${a.id} (${a.code}) g'olib #${a.highestBidderId} to'lamadi \u2014 strike ${strikeCount}.`);
    }
    await client.query('COMMIT');
    return expired;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------- Admin panel uchun so'rovlar ----------

export async function adminListUsers(limit = 200) {
  const { rows } = await pool.query(
    `SELECT id, email, phone, bot_ack AS "botAck", balance, held_balance AS "heldBalance",
            created_at AS "createdAt", is_test AS "isTest",
            suspended_until AS "suspendedUntil", suspend_reason AS "suspendReason", deleted_at AS "deletedAt",
            (SELECT COUNT(*) FROM cards WHERE user_id = users.id) AS "cardCount",
            (SELECT array_agg(code) FROM cards WHERE user_id = users.id) AS "codes"
     FROM users ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return rows.map((r) => ({ ...r, balance: Number(r.balance), heldBalance: Number(r.heldBalance), cardCount: Number(r.cardCount), codes: r.codes || [] }));
}

// Admin tomonidan qo'lda balans tuzatish (masalan Payme ishlamay qolganda
// qo'lda to'lov tasdiqlash, yoki xato uchun kompensatsiya). Har doim
// transactions'ga yoziladi — asossiz tuzatish qilib bo'lmaydi.
export async function adminAdjustBalance(userId, amount, note) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE users SET balance = balance + $2 WHERE id = $1
       RETURNING balance, held_balance AS "heldBalance"`,
      [userId, amount]
    );
    if (!rows[0]) { await client.query('ROLLBACK'); return null; }
    await client.query(
      `INSERT INTO transactions (user_id, amount, kind, note) VALUES ($1,$2,'admin_adjust',$3)`,
      [userId, amount, note || 'Admin tomonidan qo\u2019lda tuzatildi']
    );
    await client.query('COMMIT');
    return { balance: Number(rows[0].balance), heldBalance: Number(rows[0].heldBalance) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function adminListOrders(limit = 100) {
  const { rows: web } = await pool.query(
    `SELECT id, 'web' AS source, user_id AS "userId", code, price AS amount, status, created_at AS "createdAt"
     FROM web_orders ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  const { rows: bot } = await pool.query(
    `SELECT id, 'bot' AS source, tg_user_id AS "userId", code, price AS amount, status, created_at AS "createdAt",
            tg_username AS "tgUsername", tg_name AS "tgName"
     FROM bot_orders ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return [...web, ...bot].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
}

export async function adminListWalletTopups(limit = 100) {
  const { rows } = await pool.query(
    `SELECT wt.id, wt.user_id AS "userId", u.email, wt.amount, wt.status, wt.created_at AS "createdAt"
     FROM wallet_topups wt JOIN users u ON u.id = wt.user_id
     ORDER BY wt.created_at DESC LIMIT $1`,
    [limit]
  );
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

export async function adminListAuctions(limit = 100) {
  const { rows } = await pool.query(
    `SELECT a.id, a.code, a.seller_id AS "sellerId", su.email AS "sellerEmail",
            a.start_price AS "startPrice", a.buy_now_price AS "buyNowPrice",
            a.current_price AS "currentPrice", a.highest_bidder_id AS "highestBidderId",
            hu.email AS "highestBidderEmail", a.ends_at AS "endsAt", a.status, a.created_at AS "createdAt",
            a.payment_deadline AS "paymentDeadline", a.seller_payout_amount AS "sellerPayoutAmount",
            a.seller_payout_status AS "sellerPayoutStatus", a.seller_payme_number AS "sellerPaymeNumber"
     FROM auctions a
     LEFT JOIN users su ON su.id = a.seller_id
     LEFT JOIN users hu ON hu.id = a.highest_bidder_id
     ORDER BY a.created_at DESC LIMIT $1`,
    [limit]
  );
  return rows.map((r) => ({
    ...r,
    sellerPayoutAmount: r.sellerPayoutAmount != null ? Number(r.sellerPayoutAmount) : null,
  }));
}

// Admin auksionni majburan bekor qiladi (masalan qoidabuzarlik sababli) —
// barcha bandlangan mablag'lar bekorsiz bo'shatiladi, karta sotuvchida qoladi.
export async function adminCancelAuction(auctionId, note) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: aRows } = await client.query(
      `SELECT id, status FROM auctions WHERE id = $1 FOR UPDATE`, [auctionId]
    );
    const auction = aRows[0];
    if (!auction || auction.status !== 'active') { await client.query('ROLLBACK'); return null; }

    const { rows: bidRows } = await client.query(
      `SELECT user_id AS "userId", MAX(amount) AS amount FROM bids WHERE auction_id = $1 GROUP BY user_id`,
      [auctionId]
    );
    for (const b of bidRows) {
      await client.query(`UPDATE users SET held_balance = held_balance - $2 WHERE id = $1`, [b.userId, Number(b.amount)]);
      await client.query(
        `INSERT INTO transactions (user_id, amount, kind, ref_table, ref_id, note)
         VALUES ($1,0,'bid_release','auctions',$2,$3)`,
        [b.userId, auctionId, note || 'Admin auksionni bekor qildi \u2014 mablag\u2019 bo\u2019shatildi']
      );
    }
    await client.query(`UPDATE auctions SET status = 'cancelled' WHERE id = $1`, [auctionId]);
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function adminListPhysicalCards(limit = 100) {
  const { rows } = await pool.query(
    `SELECT pc.id, pc.chip_token AS "chipToken", pc.linked_code AS "linkedCode",
            pc.owner_user_id AS "ownerUserId", ou.email AS "ownerEmail",
            pc.active, pc.status, pc.shipping_name AS "shippingName",
            pc.shipping_phone AS "shippingPhone", pc.shipping_address AS "shippingAddress",
            pc.created_at AS "createdAt"
     FROM physical_cards pc LEFT JOIN users ou ON ou.id = pc.owner_user_id
     ORDER BY pc.created_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function adminSetPhysicalCardStatus(id, status) {
  const { rows } = await pool.query(
    `UPDATE physical_cards SET status = $2 WHERE id = $1 RETURNING id, status`,
    [id, status]
  );
  return rows[0] || null;
}

// NFC kartani bloklash/blokdan chiqarish — chip_token orqali ishlaydi:
// karta "active=false" bo'lsa, /api/tap/:chipToken (ko'rinmas havola,
// masalan nfcstore.uz/vip001?t=xxxxx) endi profilni ochmaydi.
export async function adminSetPhysicalCardActive(id, active) {
  const { rows } = await pool.query(
    `UPDATE physical_cards SET active = $2 WHERE id = $1 RETURNING id, active, linked_code AS "linkedCode"`,
    [id, active]
  );
  return rows[0] || null;
}

export async function adminStats() {
  const [{ rows: u }, { rows: c }, { rows: a }, { rows: p }, { rows: t }] = await Promise.all([
    // MUHIM: is_test = TRUE bo'lgan (admin/sinov) akkauntlar asosiy
    // ko'rsatkichlardan chiqarib tashlanadi — real mijozlar sonini
    // buzmasligi uchun.
    pool.query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(balance),0)::bigint AS total_balance FROM users WHERE is_test = FALSE`),
    pool.query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(price),0)::bigint AS total_price FROM cards c
                WHERE c.user_id IS NULL OR c.user_id NOT IN (SELECT id FROM users WHERE is_test = TRUE)`),
    pool.query(`SELECT COUNT(*)::int AS n FROM auctions WHERE status = 'active'`),
    pool.query(`SELECT COUNT(*)::int AS n FROM web_orders WHERE status = 'pending'`),
    pool.query(`SELECT COUNT(*)::int AS n FROM wallet_topups WHERE status = 'cancel_needs_review'`),
  ]);
  return {
    userCount: u[0].n,
    totalWalletBalance: Number(u[0].total_balance),
    cardCount: c[0].n,
    totalCardSalesValue: Number(c[0].total_price),
    activeAuctions: a[0].n,
    pendingWebOrders: p[0].n,
    topupsNeedReview: t[0].n,
  };
}

// ---------- Bot orqali kontakt tasdiqlash ----------

export async function saveBotVerification({ phone, tgUserId, tgName }) {
  const { rows } = await pool.query(
    `INSERT INTO bot_verifications (phone, tg_user_id, tg_name)
     VALUES ($1,$2,$3)
     ON CONFLICT (phone) DO UPDATE SET tg_user_id = $2, tg_name = $3
     RETURNING id`,
    [phone, tgUserId, tgName || null]
  );
  return rows[0] || null;
}

export async function isPhoneBotVerified(phone) {
  const { rows } = await pool.query(`SELECT 1 FROM bot_verifications WHERE phone = $1`, [phone]);
  return rows.length > 0;
}

// ---------- Jismoniy kartalar: yaratish va tap orqali yo'naltirish ----------

// Chip ichiga yoziladigan token — taxmin qilib bo'lmaydigan, tasodifiy.
// Bio/reklama uchun ko'rinadigan havola (nfcstore.uz/vip001) hech qachon
// buni o'z ichiga olmaydi — faqat chipning o'zi ?t= parametri sifatida
// ishlatadi (qarang: oldingi javobdagi "Variant A" tushuntirishi).
function generateChipToken() {
  return crypto.randomBytes(6).toString('base64url'); // ~8 belgi, URL-xavfsiz
}

export async function createPhysicalCard({ linkedCode, ownerUserId, shippingName, shippingPhone, shippingAddress }) {
  let token = generateChipToken();
  for (let i = 0; i < 5; i++) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO physical_cards (chip_token, linked_code, owner_user_id, shipping_name, shipping_phone, shipping_address)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id, chip_token AS "chipToken"`,
        [token, linkedCode, ownerUserId, shippingName, shippingPhone, shippingAddress]
      );
      return rows[0];
    } catch (err) {
      if (err.code === '23505') { token = generateChipToken(); continue; } // token to'qnashuvi — juda kam, lekin qayta uramiz
      throw err;
    }
  }
  throw new Error('chip_token_collision');
}

// Chip skanerlanganda: token bo'yicha qaysi profilga yo'naltirish kerakligini
// aniqlaydi. Agar karta deaktivatsiya qilingan bo'lsa (auksionda sotilgan,
// eski egasi) — active=false qaytadi, frontend "karta faol emas" ko'rsatadi.
export async function resolvePhysicalCard(chipToken) {
  const { rows } = await pool.query(
    `SELECT chip_token AS "chipToken", linked_code AS "linkedCode", active,
            blocked_by_owner AS "blockedByOwner"
     FROM physical_cards WHERE chip_token = $1`,
    [chipToken]
  );
  return rows[0] || null;
}

// ---------- Mening NFC qurilmalarim (Band 3.5) ----------

export async function listPhysicalCardsByOwner(userId) {
  const { rows } = await pool.query(
    `SELECT pc.id, pc.chip_token AS "chipToken", pc.linked_code AS "linkedCode",
            pc.active, pc.blocked_by_owner AS "blockedByOwner", pc.status,
            pc.created_at AS "createdAt", c.name AS "linkedName"
       FROM physical_cards pc
       LEFT JOIN cards c ON c.code = pc.linked_code
      WHERE pc.owner_user_id = $1
      ORDER BY pc.created_at DESC`,
    [userId]
  );
  // chip_token'ni to'liq oshkor qilmaymiz — faqat oxirgi 4 belgi.
  return rows.map((r) => ({
    id: r.id,
    tokenTail: String(r.chipToken || '').slice(-4).toUpperCase(),
    linkedCode: r.linkedCode,
    linkedName: r.linkedName || '',
    active: r.active,
    blockedByOwner: r.blockedByOwner,
    status: r.status,
    createdAt: r.createdAt,
  }));
}

// linked_code'ni O'ZGARTIRADI — faqat foydalanuvchi ega bo'lgan qurilma va
// faqat foydalanuvchi ega bo'lgan kodga (IDOR himoyasi).
export async function setPhysicalCardLink(id, ownerUserId, code) {
  const { rows: own } = await pool.query(
    `SELECT 1 FROM cards WHERE code = $1 AND user_id = $2`, [code, ownerUserId]
  );
  if (!own[0]) return { error: 'NOT_YOUR_CODE' };
  const { rows } = await pool.query(
    `UPDATE physical_cards SET linked_code = $3
      WHERE id = $1 AND owner_user_id = $2
      RETURNING id`,
    [id, ownerUserId, code]
  );
  return rows[0] ? { ok: true } : { error: 'NOT_FOUND' };
}

export async function setPhysicalCardBlocked(id, ownerUserId, blocked) {
  const { rows } = await pool.query(
    `UPDATE physical_cards SET blocked_by_owner = $3
      WHERE id = $1 AND owner_user_id = $2
      RETURNING id, blocked_by_owner AS "blockedByOwner"`,
    [id, ownerUserId, !!blocked]
  );
  return rows[0] || null;
}

// ---------- Premium profil so'rovlari ----------

// Premium profilga o'tish uchun real Payme to'lovini boshlaydi (narx —
// PROFILE_PREMIUM_FEE, src/lib/pricing.js; index.js summani shu yerga uzatadi).
// E-wallet yo'q — pul darhol yechilmaydi, foydalanuvchi Payme checkout'iga
// yo'naltiriladi, is_premium faqat to'lov webhook orqali TASDIQLANGANDA
// TRUE bo'ladi (finalizePremiumUpgrade() orqali).
export async function requestPremium(userId, amount) {
  const { rows: uRows } = await pool.query(
    `SELECT is_premium AS "isPremium" FROM users WHERE id = $1`, [userId]
  );
  if (!uRows[0]) return { error: 'NOT_FOUND' };
  if (uRows[0].isPremium) return { error: 'ALREADY_PREMIUM' };

  const { rows: pending } = await pool.query(
    `SELECT id FROM web_orders WHERE user_id = $1 AND kind = 'premium_upgrade' AND status = 'pending'`,
    [userId]
  );
  if (pending[0]) return { error: 'ALREADY_PENDING' };

  const order = await createWebOrder({ userId, code: 'PREMIUM', kind: 'premium_upgrade', price: amount, payload: {} });
  return { ok: true, orderId: order.id };
}

// To'lov tasdiqlangach webhook shu funksiyani chaqiradi.
export async function finalizePremiumUpgrade(userId) {
  await pool.query(`UPDATE users SET is_premium = TRUE WHERE id = $1`, [userId]);
}

// ---------- Obuna (follow) ----------

export async function getUserById(id) {
  const { rows } = await pool.query(
    `SELECT id, email, is_premium AS "isPremium" FROM users WHERE id = $1`, [id]
  );
  return rows[0] || null;
}

// Profil kodidan (masalan VIP001) egasining user_id'sini topadi.
export async function getOwnerByCode(code) {
  const { rows } = await pool.query(`SELECT user_id AS "userId" FROM cards WHERE code = $1`, [code]);
  return rows[0]?.userId || null;
}

// Oddiy (pullik bo'lmagan) obuna — bepul, darhol yoziladi.
// Obuna — endi HAMMASI bepul (premium yoki oddiy profil farqi yo'q,
// obuna to'lovi butunlay bekor qilindi). Premium status faqat vizual
// belgi/tarif sifatida qoladi (rang, king emoji va h.k.).
// ---------- Layk (profillar orasida) ----------
export async function toggleLike(code, userId) {
  const { rows: existing } = await pool.query(`SELECT id FROM card_likes WHERE code = $1 AND user_id = $2`, [code, userId]);
  if (existing[0]) {
    await pool.query(`DELETE FROM card_likes WHERE id = $1`, [existing[0].id]);
    return { liked: false };
  }
  await pool.query(`INSERT INTO card_likes (code, user_id) VALUES ($1,$2)`, [code, userId]);
  return { liked: true };
}
export async function getLikeInfo(code, userId) {
  const { rows: countRows } = await pool.query(`SELECT COUNT(*)::int AS n FROM card_likes WHERE code = $1`, [code]);
  let liked = false;
  if (userId) {
    const { rows } = await pool.query(`SELECT 1 FROM card_likes WHERE code = $1 AND user_id = $2`, [code, userId]);
    liked = rows.length > 0;
  }
  return { count: countRows[0].n, liked };
}

// ---------- Tarif override (admin sovg'a qilgan NFC ID → Ekslyuziv) ----------
export async function setCardTierOverride(code, tier) {
  await pool.query(`UPDATE cards SET tier_override = $2 WHERE code = $1`, [code, tier || null]);
}

// ---------- Profil tasdiqlash (admin, PHASE 5) ----------
export async function adminSetCardVerified(code, verified) {
  const { rows } = await pool.query(
    `UPDATE cards SET verified = $2 WHERE code = $1 RETURNING code, name, verified`,
    [code, !!verified]
  );
  return rows[0] || null;
}

// Ko'rishlar hisoblagichini qo'lда o'zgartirish (admin).
export async function adminSetCardViews(code, views) {
  const n = Math.max(0, Math.min(100_000_000, Math.round(Number(views) || 0)));
  const { rows } = await pool.query(
    `UPDATE cards SET views = $2 WHERE code = $1 RETURNING code, name, views`,
    [code, n]
  );
  return rows[0] || null;
}

export async function adminListVerifiedCards() {
  const { rows } = await pool.query(
    `SELECT code, name, role, profile_type AS "profileType" FROM cards WHERE verified = TRUE ORDER BY name`
  );
  return rows;
}

// ---------- Company System — admin (Admin Panel Faz 20–23) ----------
// "Company" = profile_type = 'business' bo'lgan cards yozuvi (alohida
// jadval yo'q — Faz 0 audit qarori). Tarif — mavjud NFC ID tier tizimi
// (tier_override / kod naqshi / owner Profile Premium), alohida
// obuna jadvali emas.

// Umumiy statistika: jami/faol/bloklangan kompaniyalar, Menyu/Mahsulotlar
// modulidan foydalanayotganlar soni.
export async function adminCompanyStats() {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE hidden_from_directory = FALSE)::int AS active,
      COUNT(*) FILTER (WHERE hidden_from_directory = TRUE)::int AS suspended,
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM menu_categories mc WHERE mc.code = cards.code))::int AS with_menu,
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM product_categories pc WHERE pc.code = cards.code))::int AS with_products,
      COUNT(*) FILTER (
        WHERE EXISTS (SELECT 1 FROM menu_categories mc WHERE mc.code = cards.code)
          AND EXISTS (SELECT 1 FROM product_categories pc WHERE pc.code = cards.code)
      )::int AS with_both
    FROM cards WHERE profile_type = 'business'
  `);
  const r = rows[0];
  return {
    total: r.total, active: r.active, suspended: r.suspended,
    withMenu: r.with_menu, withProducts: r.with_products, withBoth: r.with_both,
  };
}

const COMPANY_LIST_SQL = `
  SELECT c.code, c.name, c.role, c.city, c.category_slug AS "categorySlug",
         c.tier_override AS "tierOverride", c.verified, c.ts,
         c.hidden_from_directory AS "hiddenFromDirectory",
         c.phone, c.email, c.about,
         u.id AS "ownerId", u.email AS "ownerEmail", u.phone AS "ownerPhone", u.is_premium AS "ownerIsPremium",
         EXISTS(SELECT 1 FROM nfc_gifts g WHERE g.code = c.code AND g.status = 'activated') AS "isGift",
         (SELECT COUNT(*)::int FROM menu_categories mc WHERE mc.code = c.code) AS "menuCatCount",
         (SELECT COUNT(*)::int FROM menu_items mi WHERE mi.code = c.code) AS "menuItemCount",
         (SELECT COUNT(*)::int FROM product_categories pc WHERE pc.code = c.code) AS "productCatCount",
         (SELECT COUNT(*)::int FROM products p WHERE p.code = c.code) AS "productItemCount",
         (SELECT COUNT(*)::int FROM card_team tm WHERE tm.code = c.code) AS "teamCount"
    FROM cards c
    LEFT JOIN users u ON u.id = c.user_id
   WHERE c.profile_type = 'business'
`;

function companyRow(r) {
  return {
    ...r,
    ts: Number(r.ts),
    verified: !!r.verified,
    hiddenFromDirectory: !!r.hiddenFromDirectory,
    ownerIsPremium: !!r.ownerIsPremium,
    isGift: !!r.isGift,
  };
}

export async function adminListCompanies(limit = 300) {
  const { rows } = await pool.query(`${COMPANY_LIST_SQL} ORDER BY c.ts DESC LIMIT $1`, [limit]);
  return rows.map(companyRow);
}

export async function adminGetCompany(code) {
  const { rows } = await pool.query(`${COMPANY_LIST_SQL} AND c.code = $1`, [code]);
  return rows[0] ? companyRow(rows[0]) : null;
}

// Direktoriya/qidiruvdan yashirish — "suspend" (mavjud "hidden_from_directory"
// maydonini qayta ishlatadi; ma'lumot o'chirilmaydi, faqat ommaviy
// katalog/qidiruvdan chiqadi — to'g'ridan-to'g'ri havola ishlayveradi).
export async function adminSetCompanyDirectoryHidden(code, hidden) {
  const { rows } = await pool.query(
    `UPDATE cards SET hidden_from_directory = $2 WHERE code = $1 AND profile_type = 'business'
     RETURNING code, name, hidden_from_directory AS "hiddenFromDirectory"`,
    [code, !!hidden]
  );
  return rows[0] || null;
}

// ---------- Profil postlari ----------
const MAX_POSTS_PER_PROFILE = 60;

export async function listPostsByCode(code, viewerUserId) {
  const { rows } = await pool.query(
    `SELECT p.id, p.image_url AS "imageUrl", p.video_url AS "videoUrl", p.caption, p.created_at AS "createdAt",
            (SELECT COUNT(*)::int FROM post_likes pl WHERE pl.post_id = p.id) AS "likeCount",
            ${viewerUserId ? `EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $2)` : `FALSE`} AS "liked"
     FROM posts p
     WHERE p.code = $1
     ORDER BY p.created_at DESC`,
    viewerUserId ? [code, viewerUserId] : [code]
  );
  return rows.map((r) => ({
    id: r.id,
    imageUrl: r.imageUrl || '',
    videoUrl: r.videoUrl || '',
    caption: r.caption || '',
    createdAt: new Date(r.createdAt).getTime(),
    likeCount: r.likeCount,
    liked: !!r.liked,
  }));
}

export async function createPost(code, userId, { imageUrl, caption, videoUrl, limit }) {
  const owner = await getOwnerByCode(code);
  if (!owner || owner !== userId) return { error: 'NOT_OWNER' };
  // Limit — chaqiruvchi (index.js) tarif bo'yicha uzatadi; kelmasa eski
  // umumiy chegara. MUHIM: mavjud postlar HECH QACHON o'chirilmaydi —
  // limit faqat YANGI post qo'shishga ta'sir qiladi (grandfathering).
  const cap = Number.isFinite(limit) ? limit : MAX_POSTS_PER_PROFILE;
  const { rows: cnt } = await pool.query(`SELECT COUNT(*)::int AS n FROM posts WHERE code = $1`, [code]);
  if (cnt[0].n >= cap) return { error: 'LIMIT_REACHED' };
  const { rows } = await pool.query(
    `INSERT INTO posts (code, user_id, image_url, video_url, caption) VALUES ($1,$2,$3,$4,$5)
     RETURNING id, image_url AS "imageUrl", video_url AS "videoUrl", caption, created_at AS "createdAt"`,
    [code, userId, imageUrl || null, videoUrl || null, caption || null]
  );
  const r = rows[0];
  return { post: { id: r.id, imageUrl: r.imageUrl || '', videoUrl: r.videoUrl || '', caption: r.caption || '', createdAt: new Date(r.createdAt).getTime(), likeCount: 0, liked: false } };
}

export async function deletePost(id, userId) {
  const { rowCount } = await pool.query(`DELETE FROM posts WHERE id = $1 AND user_id = $2`, [id, userId]);
  return { ok: rowCount > 0 };
}

export async function togglePostLike(postId, userId) {
  const { rows: post } = await pool.query(`SELECT id FROM posts WHERE id = $1`, [postId]);
  if (!post[0]) return { error: 'NOT_FOUND' };
  const { rows: existing } = await pool.query(`SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2`, [postId, userId]);
  if (existing[0]) {
    await pool.query(`DELETE FROM post_likes WHERE id = $1`, [existing[0].id]);
  } else {
    await pool.query(`INSERT INTO post_likes (post_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [postId, userId]);
  }
  const { rows: countRows } = await pool.query(`SELECT COUNT(*)::int AS n FROM post_likes WHERE post_id = $1`, [postId]);
  return { liked: !existing[0], count: countRows[0].n };
}

export async function followUserFree(followerId, followeeId) {
  if (followerId === followeeId) return { error: 'CANNOT_FOLLOW_SELF' };
  const { rows: exists } = await pool.query(
    `SELECT id FROM follows WHERE follower_id = $1 AND followee_id = $2`, [followerId, followeeId]
  );
  if (exists[0]) return { error: 'ALREADY_FOLLOWING' };
  const { rows: feRows } = await pool.query(`SELECT id FROM users WHERE id = $1`, [followeeId]);
  if (!feRows[0]) return { error: 'NOT_FOUND' };
  await pool.query(`INSERT INTO follows (follower_id, followee_id, paid, amount) VALUES ($1,$2,FALSE,0)`, [followerId, followeeId]);
  return { ok: true, paid: false };
}

// Premium profilga (pullik) obuna bo'lish uchun real Payme to'lovini
// boshlaydi. E-wallet yo'q — follow yozuvi faqat to'lov TASDIQLANGANDA
// (finalizeFollowPayment orqali) yaratiladi.
export async function requestPaidFollow(followerId, followeeId, feeAmount) {
  if (followerId === followeeId) return { error: 'CANNOT_FOLLOW_SELF' };
  const { rows: exists } = await pool.query(
    `SELECT id FROM follows WHERE follower_id = $1 AND followee_id = $2`, [followerId, followeeId]
  );
  if (exists[0]) return { error: 'ALREADY_FOLLOWING' };
  const { rows: feRows } = await pool.query(`SELECT is_premium AS "isPremium" FROM users WHERE id = $1`, [followeeId]);
  if (!feRows[0]) return { error: 'NOT_FOUND' };
  if (!feRows[0].isPremium) return { error: 'NOT_PREMIUM' };

  const { rows: pending } = await pool.query(
    `SELECT id FROM web_orders WHERE user_id = $1 AND kind = 'premium_follow'
     AND status = 'pending' AND payload->>'followeeId' = $2`,
    [followerId, String(followeeId)]
  );
  if (pending[0]) return { error: 'ALREADY_PENDING' };

  const order = await createWebOrder({
    userId: followerId, code: 'FOLLOW', kind: 'premium_follow', price: feeAmount,
    payload: { followeeId },
  });
  return { ok: true, orderId: order.id };
}

// To'lov tasdiqlangach webhook shu funksiyani chaqiradi: follow yoziladi,
// premium profil egasiga "to'lanishi kerak" summasi qo'shiladi (pending_payout),
// komissiya platforma hisobiga tushadi.
export async function finalizeFollowPayment(followerId, followeeId, amount, commissionPct) {
  const commission = Math.round(amount * (commissionPct / 100));
  const ownerGets = amount - commission;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO follows (follower_id, followee_id, paid, amount) VALUES ($1,$2,TRUE,$3)
       ON CONFLICT (follower_id, followee_id) DO NOTHING`,
      [followerId, followeeId, amount]
    );
    await client.query(`UPDATE users SET pending_payout = pending_payout + $2 WHERE id = $1`, [followeeId, ownerGets]);
    await creditPlatformWallet(client, commission, 'platform_commission', 'follows', followeeId,
      `Premium obuna komissiyasi (${commissionPct}%)`);
    await client.query('COMMIT');
    return { ok: true, ownerGets, commission };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function unfollowUser(followerId, followeeId) {
  const { rowCount } = await pool.query(
    `DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2`, [followerId, followeeId]
  );
  return rowCount > 0;
}

// Obunachilar / obunalar ro'yxati — har foydalanuvchining ASOSIY (yoki eng
// eski) profil kartasi bilan (link uchun). Yashirin profillar tushib qoladi.
async function _followList(sql, userId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (u.id) c.code, c.name, c.avatar_url AS "avatarUrl", c.verified
       FROM follows fw
       JOIN users u ON u.id = ${sql}
       JOIN cards c ON c.user_id = u.id AND c.hidden_from_directory = FALSE
      WHERE ${sql === 'fw.follower_id' ? 'fw.followee_id' : 'fw.follower_id'} = $1
      ORDER BY u.id, c.is_primary DESC, c.ts ASC
      LIMIT 200`,
    [userId]
  );
  return rows;
}
export const listFollowers = (userId) => _followList('fw.follower_id', userId);
export const listFollowing = (userId) => _followList('fw.followee_id', userId);

export async function getFollowStats(userId, viewerId) {
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM follows WHERE followee_id = $1) AS followers,
       (SELECT COUNT(*)::int FROM follows WHERE follower_id = $1) AS following,
       ${viewerId ? `(SELECT EXISTS(SELECT 1 FROM follows WHERE follower_id = ${Number(viewerId)} AND followee_id = $1)) AS "isFollowing"` : 'FALSE AS "isFollowing"'}
    `,
    [userId]
  );
  return rows[0];
}

// ---------- Suhbatlar va xabarlar ----------

export async function getOrCreateConversation(userIdA, userIdB) {
  const a = Math.min(userIdA, userIdB);
  const b = Math.max(userIdA, userIdB);
  const { rows } = await pool.query(
    `INSERT INTO conversations (user_a_id, user_b_id) VALUES ($1,$2)
     ON CONFLICT (user_a_id, user_b_id) DO UPDATE SET user_a_id = EXCLUDED.user_a_id
     RETURNING id`,
    [a, b]
  );
  return rows[0].id;
}

// Faqat shu foydalanuvchi ishtirok etgan suhbatlarni qaytaradi — himoya
// SQL darajasida (WHERE user_a_id = $1 OR user_b_id = $1), boshqa hech
// qanday suhbat qatorga tushmaydi.
export async function listConversations(userId) {
  const { rows } = await pool.query(
    `SELECT c.id,
            CASE WHEN c.user_a_id = $1 THEN c.user_b_id ELSE c.user_a_id END AS "otherUserId",
            ou.email AS "otherEmail",
            (SELECT body FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS "lastMessage",
            (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS "lastAt",
            (SELECT COUNT(*)::int FROM messages WHERE conversation_id = c.id AND is_read = FALSE AND sender_id != $1) AS "unreadCount"
     FROM conversations c
     JOIN users ou ON ou.id = (CASE WHEN c.user_a_id = $1 THEN c.user_b_id ELSE c.user_a_id END)
     WHERE c.user_a_id = $1 OR c.user_b_id = $1
     ORDER BY "lastAt" DESC NULLS LAST`,
    [userId]
  );
  return rows;
}

// Suhbat ichidagi xabarlarni faqat shu suhbatning ikkala tarafidan biri
// so'rasa qaytaradi — chaqiruvchi tomondan userId tekshirilishi SHART
// (bu funksiya faqat conversationId bo'yicha ishlaydi, ruxsatni index.js
// darajasida tekshiramiz — pastga qarang).
export async function isConversationParticipant(conversationId, userId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM conversations WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $2)`,
    [conversationId, userId]
  );
  return rows.length > 0;
}

export async function getOtherParticipant(conversationId, userId) {
  const { rows } = await pool.query(
    `SELECT CASE WHEN user_a_id = $2 THEN user_b_id ELSE user_a_id END AS other
     FROM conversations WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $2)`,
    [conversationId, userId]
  );
  return rows[0]?.other || null;
}

// ---------- Bloklash / shikoyat ----------

export async function blockUser(blockerId, blockedId) {
  await pool.query(
    `INSERT INTO blocked_users (blocker_id, blocked_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [blockerId, blockedId]
  );
}

export async function unblockUser(blockerId, blockedId) {
  await pool.query(`DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2`, [blockerId, blockedId]);
}

// MUHIM: ikkala yo'nalishda ham tekshiramiz — A B'ni bloklagan bo'lsa,
// B ham A'ga xabar yubora olmasligi kerak (aks holda bloklash yarim-yorti bo'lardi).
export async function isBlocked(userId, otherUserId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM blocked_users WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`,
    [userId, otherUserId]
  );
  return rows.length > 0;
}

export async function reportUser(reporterId, reportedId, reason) {
  await pool.query(
    `INSERT INTO user_reports (reporter_id, reported_id, reason) VALUES ($1,$2,$3)`,
    [reporterId, reportedId, reason]
  );
}

export async function listMessages(conversationId, { before, limit = 50 } = {}) {
  const { rows } = await pool.query(
    before
      ? `SELECT id, sender_id AS "senderId", body, is_read AS "isRead", created_at AS "createdAt"
         FROM messages WHERE conversation_id = $1 AND created_at < $2
         ORDER BY created_at DESC LIMIT $3`
      : `SELECT id, sender_id AS "senderId", body, is_read AS "isRead", created_at AS "createdAt"
         FROM messages WHERE conversation_id = $1
         ORDER BY created_at DESC LIMIT $2`,
    before ? [conversationId, before, limit] : [conversationId, limit]
  );
  return rows.reverse(); // eskidan yangiga
}

export async function sendMessage(conversationId, senderId, body) {
  const { rows } = await pool.query(
    `INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1,$2,$3)
     RETURNING id, sender_id AS "senderId", body, is_read AS "isRead", created_at AS "createdAt"`,
    [conversationId, senderId, body]
  );
  return rows[0];
}

export async function markConversationRead(conversationId, readerId) {
  await pool.query(
    `UPDATE messages SET is_read = TRUE WHERE conversation_id = $1 AND sender_id != $2 AND is_read = FALSE`,
    [conversationId, readerId]
  );
}

export async function totalUnreadCount(userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE (c.user_a_id = $1 OR c.user_b_id = $1) AND m.sender_id != $1 AND m.is_read = FALSE`,
    [userId]
  );
  return rows[0].n;
}

// ---------- Platforma (admin) hamyoni ----------

// Tranzaksiya ichidan chaqiriladi (client bilan) — auksion komissiyasi,
// premium obuna komissiyasi shu orqali platforma hamyoniga tushadi.
// Har doim transactions'ga user_id=NULL bilan yoziladi (audit uchun).
async function creditPlatformWallet(client, amount, kind, refTable, refId, note) {
  await client.query(`UPDATE platform_wallet SET balance = balance + $1 WHERE id = 1`, [amount]);
  await client.query(
    `INSERT INTO transactions (user_id, amount, kind, ref_table, ref_id, note)
     VALUES (NULL, $1, $2, $3, $4, $5)`,
    [amount, kind, refTable || null, refId || null, note || null]
  );
}

export async function getPlatformWallet() {
  const { rows } = await pool.query(`SELECT balance FROM platform_wallet WHERE id = 1`);
  return Number(rows[0]?.balance || 0);
}

// Admin uchun: daromad turlari bo'yicha yig'indi (diagramma uchun).
// Daromad turlari bo'yicha taqsimot — DIQQAT: 'admin_adjust' turi bu yerga
// ATAYLAB kiritilmaydi, chunki bu real platforma daromadi emas, balki
// xodim tomonidan qo'lda kiritilgan balans tuzatishi (masalan sinov
// maqsadida). Aks holda bitta katta qo'lda tuzatish butun grafikni
// buzib, real daromadni ko'rsatib bo'lmay qoladi. Qo'lda tuzatishlar
// alohida, aniq nomlangan holda adminListManualAdjustments() orqali
// ko'rsatiladi (pastga qarang).
export async function adminRevenueBreakdown() {
  const { rows } = await pool.query(
    `SELECT kind,
            COUNT(*)::int AS count,
            COALESCE(SUM(amount),0)::bigint AS total
     FROM transactions
     WHERE amount > 0 AND kind <> 'admin_adjust'
     GROUP BY kind ORDER BY total DESC`
  );
  return rows.map((r) => ({ kind: r.kind, count: r.count, total: Number(r.total) }));
}

// Qo'lda kiritilgan balans tuzatishlari — auditga foydali, lekin daromad
// hisobotidan ATAYLAB ajratilgan (yuqoridagi izohga qarang).
export async function adminListManualAdjustments(limit = 50) {
  const { rows } = await pool.query(
    `SELECT t.id, t.user_id AS "userId", u.email, t.amount, t.note, t.created_at AS "createdAt"
     FROM transactions t LEFT JOIN users u ON u.id = t.user_id
     WHERE t.kind = 'admin_adjust'
     ORDER BY t.created_at DESC LIMIT $1`,
    [limit]
  );
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

// Admin panelda "Sinov/admin akkaunt" deb belgilash-belgilamaslik — bunday
// akkauntlar "Foydalanuvchilar", "Jami savdo" kabi asosiy ko'rsatkichlarga
// KIRMAYDI (lekin jadvalda ko'rinishda davom etadi).
export async function setUserTestFlag(userId, isTest) {
  await pool.query(`UPDATE users SET is_test = $2 WHERE id = $1`, [userId, !!isTest]);
}

// Platforma komissiyasi kunlar bo'yicha (chiziqli grafik uchun).
export async function adminCommissionTimeSeries(days = 30) {
  const { rows } = await pool.query(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
            COALESCE(SUM(amount),0)::bigint AS total
     FROM transactions
     WHERE kind = 'platform_commission' AND created_at >= now() - ($1 || ' days')::interval
     GROUP BY 1 ORDER BY 1`,
    [days]
  );
  return rows.map((r) => ({ day: r.day, total: Number(r.total) }));
}

// Ro'yxatdan o'tishlar kunlar bo'yicha (o'sish grafigi uchun).
export async function adminSignupsTimeSeries(days = 30) {
  const { rows } = await pool.query(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
            COUNT(*)::int AS count
     FROM users
     WHERE created_at >= now() - ($1 || ' days')::interval
     GROUP BY 1 ORDER BY 1`,
    [days]
  );
  return rows.map((r) => ({ day: r.day, count: r.count }));
}

// Band qilingan vizitkalar kunlar bo'yicha.
export async function adminCardsTimeSeries(days = 30) {
  const { rows } = await pool.query(
    `SELECT to_char(date_trunc('day', to_timestamp(ts / 1000.0)), 'YYYY-MM-DD') AS day,
            COUNT(*)::int AS count
     FROM cards
     WHERE ts >= (extract(epoch FROM now() - ($1 || ' days')::interval) * 1000)
     GROUP BY 1 ORDER BY 1`,
    [days]
  );
  return rows.map((r) => ({ day: r.day, count: r.count }));
}

// Excelga eksport uchun — kun bo'yicha birlashtirilgan statistika + jamlama.
// `opts.fromIso` / `opts.toIso` berilsa — aynan shu oraliq (custom sana), aks
// holda oxirgi `days` kun.
// DIQQAT: trafik manbasi (Telegram/Instagram/Google) hisobga OLINMAGAN,
// chunki tizimda UTM/referrer kuzatuvi hali yo'q — yolg'on nol ustunlar
// ko'rsatishdan ko'ra, umuman qo'shmaslik ma'qul.
export async function adminExportStats(days = 30, opts = {}) {
  const to = opts.toIso ? new Date(opts.toIso) : new Date();
  const from = opts.fromIso ? new Date(opts.fromIso) : new Date(Date.now() - days * 86400000);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const fromMs = from.getTime();
  const toMs = to.getTime();

  const q = (sql) => pool.query(sql, [fromIso, toIso]);
  const qCards = (sql) => pool.query(sql, [fromMs, toMs]);

  const { rows: signups } = await q(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
     FROM users WHERE created_at >= $1 AND created_at < $2 AND is_test = FALSE GROUP BY 1`
  );
  const { rows: cards } = await qCards(
    `SELECT to_char(date_trunc('day', to_timestamp(ts / 1000.0)), 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
     FROM cards WHERE ts >= $1 AND ts < $2 AND price > 0 GROUP BY 1`
  );
  const { rows: premiums } = await q(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
     FROM transactions WHERE kind = 'premium_upgrade' AND created_at >= $1 AND created_at < $2 GROUP BY 1`
  );
  const { rows: orders } = await q(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
     FROM web_orders WHERE created_at >= $1 AND created_at < $2 GROUP BY 1`
  );
  const { rows: payments } = await q(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
     FROM web_orders WHERE status = 'paid' AND created_at >= $1 AND created_at < $2 GROUP BY 1`
  );
  const { rows: revenue } = await q(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COALESCE(SUM(amount),0)::bigint AS n
     FROM transactions WHERE kind = 'platform_commission' AND created_at >= $1 AND created_at < $2 GROUP BY 1`
  );
  const { rows: auctionsCreated } = await q(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
     FROM auctions WHERE created_at >= $1 AND created_at < $2 GROUP BY 1`
  );
  const { rows: auctionsSold } = await q(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
     FROM auctions WHERE status = 'sold' AND created_at >= $1 AND created_at < $2 GROUP BY 1`
  );

  const byDay = {};
  const put = (arr, key) => arr.forEach((r) => {
    byDay[r.day] = byDay[r.day] || { date: r.day, newUsers: 0, newCards: 0, newPremium: 0, orders: 0, payments: 0, revenue: 0, auctionsCreated: 0, auctionsSold: 0 };
    byDay[r.day][key] = Number(r.n);
  });
  put(signups, 'newUsers');
  put(cards, 'newCards');
  put(premiums, 'newPremium');
  put(orders, 'orders');
  put(payments, 'payments');
  put(revenue, 'revenue');
  put(auctionsCreated, 'auctionsCreated');
  put(auctionsSold, 'auctionsSold');

  const rows = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
  const sum = (k) => rows.reduce((s, r) => s + (r[k] || 0), 0);

  const [{ rows: tu }, { rows: tp }, { rows: ta }] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE is_test = FALSE AND created_at < $1`, [toIso]),
    pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE is_test = FALSE AND is_premium = TRUE`),
    pool.query(`SELECT COUNT(*)::int AS n FROM auctions WHERE status = 'active'`),
  ]);

  const summary = {
    from: fromIso.slice(0, 10),
    to: toIso.slice(0, 10),
    totalUsers: tu[0].n,
    totalPremium: tp[0].n,
    activeAuctions: ta[0].n,
    auctionsCreated: sum('auctionsCreated'),
    auctionsSold: sum('auctionsSold'),
    revenue: sum('revenue'),
    payments: sum('payments'),
    orders: sum('orders'),
    newUsers: sum('newUsers'),
    newCards: sum('newCards'),
    newPremium: sum('newPremium'),
  };

  return { rows, summary };
}

// ---------- To'lovlar tarixi ----------

export async function listUserPayments(userId, limit = 50) {
  const { rows } = await pool.query(
    `SELECT id, kind, code, price, status, created_at AS "createdAt"
     FROM web_orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

export async function getPendingPayout(userId) {
  const { rows } = await pool.query(`SELECT pending_payout AS "pendingPayout" FROM users WHERE id = $1`, [userId]);
  return rows[0] ? Number(rows[0].pendingPayout) : 0;
}

// Admin: barcha "to'lanishi kerak" (pending_payout > 0) foydalanuvchilar.
export async function adminListPendingPayouts() {
  const { rows } = await pool.query(
    `SELECT id, email, phone, pending_payout AS "pendingPayout" FROM users WHERE pending_payout > 0 ORDER BY pending_payout DESC`
  );
  return rows.map((r) => ({ ...r, pendingPayout: Number(r.pendingPayout) }));
}

// Admin sotuvchiga/premium egasiga qo'lda to'lagach shu chaqiriladi.
export async function adminClearPendingPayout(userId, amount) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE users SET pending_payout = pending_payout - $2
       WHERE id = $1 AND pending_payout >= $2
       RETURNING pending_payout AS "pendingPayout"`,
      [userId, amount]
    );
    if (!rows[0]) { await client.query('ROLLBACK'); return null; }
    await client.query(
      `INSERT INTO transactions (user_id, amount, kind, note) VALUES ($1,0,'admin_adjust',$2)`,
      [userId, `Admin qo\u2019lda ${amount} so\u2019m to\u2019lab berdi (pending_payout kamaytirildi)`]
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ===================== "GIFT NFC ID" — funksiya funksiyalari =====================
// Bu bo'lim butunlay YANGI va IZOLYATSIYALANGAN — mavjud hech qanday
// funksiyaga (auksion, oddiy sovg'a, oddiy ro'yxatdan o'tish) tegmaydi.

function generateActivationCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `NFC-${seg()}-${seg()}`;
}

// Admin — bo'sh (hech kimga tegishli bo'lmagan) kodni sovg'a sifatida
// ajratib qo'yadi. Kod HALI HECH QANDAY profilga ulanmaydi.
export async function createNfcGift(code, recipientName, note) {
  const { rows: taken } = await pool.query(`SELECT 1 FROM cards WHERE code = $1`, [code]);
  if (taken[0]) return { error: 'CODE_TAKEN' };
  const { rows: already } = await pool.query(`SELECT 1 FROM nfc_gifts WHERE code = $1 AND status = 'reserved'`, [code]);
  if (already[0]) return { error: 'ALREADY_RESERVED' };

  for (let i = 0; i < 8; i++) {
    const activationCode = generateActivationCode();
    try {
      const { rows } = await pool.query(
        `INSERT INTO nfc_gifts (code, recipient_name, note, activation_code) VALUES ($1,$2,$3,$4)
         RETURNING id, code, activation_code AS "activationCode"`,
        [code, recipientName || null, note || null, activationCode]
      );
      return { ok: true, gift: rows[0] };
    } catch (err) {
      if (err.code !== '23505') throw err; // activation_code to'qnashuvi — juda kam, qayta uramiz
    }
  }
  return { error: 'GENERATION_FAILED' };
}

export async function listNfcGifts() {
  const { rows } = await pool.query(
    `SELECT ng.id, ng.code, ng.recipient_name AS "recipientName", ng.note,
            ng.activation_code AS "activationCode", ng.status,
            ng.created_at AS "createdAt", ng.activated_at AS "activatedAt",
            u.email AS "activatedByEmail"
     FROM nfc_gifts ng LEFT JOIN users u ON u.id = ng.activated_by_user_id
     ORDER BY ng.created_at DESC`
  );
  return rows;
}

// Profil sahifasi ochilganda — shu kod uchun kutilayotgan sovg'a bor-yo'qligini
// tekshiradi (faqat status='reserved' bo'lsa qaytaradi, activation_code'ni
// XAVFSIZLIK uchun QAYTARMAYDI — u faqat konvertda, admin biladi).
export async function getPendingGiftByCode(code) {
  const { rows } = await pool.query(
    `SELECT id, code, recipient_name AS "recipientName" FROM nfc_gifts WHERE code = $1 AND status = 'reserved'`,
    [code]
  );
  return rows[0] || null;
}

// Aktivatsiya kodini tekshiradi (bir martalik, urinishlar orasida hech
// narsa oshkor qilinmaydi — noto'g'ri/to'g'ri, boshqa hech narsa).
export async function verifyGiftActivationCode(code, activationCode) {
  const { rows } = await pool.query(
    `SELECT id FROM nfc_gifts WHERE code = $1 AND activation_code = $2 AND status = 'reserved'`,
    [code, activationCode.trim().toUpperCase()]
  );
  return !!rows[0];
}

// Aktivatsiya + profil yaratish — BITTA atomik tranzaksiyada: yangi
// foydalanuvchi yaratiladi, kod shu foydalanuvchiga (asosiy profil
// sifatida) biriktiriladi, sovg'a "activated" deb belgilanadi.
export async function activateNfcGift(code, activationCode, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: giftRows } = await client.query(
      `SELECT id FROM nfc_gifts WHERE code = $1 AND activation_code = $2 AND status = 'reserved' FOR UPDATE`,
      [code, activationCode.trim().toUpperCase()]
    );
    if (!giftRows[0]) { await client.query('ROLLBACK'); return { error: 'BAD_CODE' }; }

    // Kod band bo'lib qolganmi tekshiramiz — LEKIN aynan shu aktivatsiya
    // oqimi kartani hozirgina yaratib, shu foydalanuvchiga biriktirgan
    // bo'lsa, bu "band" hisoblanmaydi (aks holda har doim CODE_TAKEN chiqardi).
    const { rows: takenRows } = await client.query(`SELECT user_id AS "userId" FROM cards WHERE code = $1`, [code]);
    if (takenRows[0] && takenRows[0].userId !== userId) { await client.query('ROLLBACK'); return { error: 'CODE_TAKEN' }; }

    await client.query(
      `UPDATE nfc_gifts SET status = 'activated', activated_at = now(), activated_by_user_id = $2 WHERE id = $1`,
      [giftRows[0].id, userId]
    );
    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ═══════════════════════════════════════════════════════════════════
// MOLIYA / BUXGALTERIYA MODULI — hisoblash va CRUD.
//
// MUHIM: bu modul faqat YANGI finance_* jadvallarni yozadi. Gross savdo,
// Payme tranzaksiya, buyurtma holati — hammasi web_orders / bot_orders'dan
// FAQAT O'QILADI. Hech bir mavjud to'lov mantig'i o'zgarmaydi.
// ═══════════════════════════════════════════════════════════════════

export const FINANCE_EXPENSE_CATEGORIES = ['hosting', 'domain', 'ads', 'printing', 'delivery', 'office', 'salary', 'tax', 'bank', 'other'];
export const FINANCE_DOC_TYPES = ['payme_report', 'bank_statement', 'tax', 'invoice', 'receipt', 'other'];

function financeYmd(x) {
  const d = x instanceof Date ? x : new Date(x);
  return d.toISOString().slice(0, 10);
}

// Davrga tegishli oylar ro'yxati ('YYYY-MM').
function financeMonthsInRange(fromIso, toIso) {
  const out = [];
  const a = new Date(fromIso);
  const b = new Date(toIso);
  const endKey = b.getUTCFullYear() * 12 + b.getUTCMonth();
  let y = a.getUTCFullYear();
  let m = a.getUTCMonth();
  while (y * 12 + m <= endKey && out.length < 120) {
    out.push(`${y}-${String(m + 1).padStart(2, '0')}`);
    if (++m > 11) { m = 0; y++; }
  }
  return out;
}

// Berilgan sanaga (YYYY-MM-DD) amal qiladigan scope stavkasi.
async function financeRateOn(scope, dateStr) {
  const { rows } = await pool.query(
    `SELECT params FROM finance_rates WHERE scope = $1 AND effective_from <= $2
     ORDER BY effective_from DESC, id DESC LIMIT 1`,
    [scope, dateStr]
  );
  if (rows[0]) return rows[0].params || {};
  const { rows: fallback } = await pool.query(
    `SELECT params FROM finance_rates WHERE scope = $1 ORDER BY effective_from ASC, id ASC LIMIT 1`,
    [scope]
  );
  return fallback[0]?.params || {};
}

// Har scope uchun hozir amal qiladigan stavka + to'liq tarix.
export async function financeGetRates() {
  const { rows } = await pool.query(
    `SELECT id, scope, params, to_char(effective_from, 'YYYY-MM-DD') AS "effectiveFrom",
            note, created_at AS "createdAt"
     FROM finance_rates ORDER BY scope, effective_from DESC, id DESC`
  );
  const today = financeYmd(new Date());
  const current = {};
  const history = { payme: [], bank: [], tax: [] };
  for (const r of rows) {
    (history[r.scope] || (history[r.scope] = [])).push(r);
    if (!current[r.scope] && r.effectiveFrom <= today) current[r.scope] = r;
  }
  for (const s of ['payme', 'bank', 'tax']) {
    if (!current[s] && history[s] && history[s].length) current[s] = history[s][history[s].length - 1];
  }
  return { current, history };
}

export async function financeSetRate({ scope, params, effectiveFrom, note }) {
  if (!['payme', 'bank', 'tax'].includes(scope)) return { error: 'bad_scope' };
  const eff = /^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom) ? effectiveFrom : financeYmd(new Date());
  const clean = {};
  for (const [k, v] of Object.entries(params || {})) {
    if (k === 'mode') clean.mode = v === 'separate' ? 'separate' : 'settlement_deducted';
    else clean[k] = Math.max(0, Number(v) || 0);
  }
  const { rows } = await pool.query(
    `INSERT INTO finance_rates (scope, params, effective_from, note)
     VALUES ($1, $2::jsonb, $3, $4)
     RETURNING id, scope, params, to_char(effective_from, 'YYYY-MM-DD') AS "effectiveFrom", note, created_at AS "createdAt"`,
    [scope, JSON.stringify(clean), eff, (note || '').slice(0, 200) || null]
  );
  return { ok: true, rate: rows[0] };
}

// Davr uchun to'liq moliyaviy manzara. Har bir qiymat manbasi shaffof.
export async function financeComputePeriod(fromIso, toIso) {
  const { rows: paidWeb } = await pool.query(
    `SELECT w.id, w.kind, w.price, w.status,
            to_char(w.created_at, 'YYYY-MM-DD') AS day
     FROM web_orders w
     WHERE w.status = 'paid' AND w.created_at >= $1 AND w.created_at < $2`,
    [fromIso, toIso]
  );
  let paidBot = [];
  try {
    const r = await pool.query(
      `SELECT id, price, to_char(created_at, 'YYYY-MM-DD') AS day
       FROM bot_orders WHERE status = 'paid' AND created_at >= $1 AND created_at < $2`,
      [fromIso, toIso]
    );
    paidBot = r.rows;
  } catch { paidBot = []; }

  const orders = [
    ...paidWeb.map((r) => ({ price: Number(r.price) || 0, kind: r.kind || 'card_purchase', day: r.day })),
    ...paidBot.map((r) => ({ price: Number(r.price) || 0, kind: 'card_purchase', day: r.day })),
  ];

  let grossSales = 0;
  let paymeFee = 0;
  const byType = {};
  const rateCache = {};
  for (const o of orders) {
    grossSales += o.price;
    byType[o.kind] = (byType[o.kind] || 0) + o.price;
    const p = rateCache[o.day] || (rateCache[o.day] = await financeRateOn('payme', o.day));
    paymeFee += Math.round(o.price * (Number(p.pct) || 0) / 100) + (Number(p.fixed) || 0);
  }

  const months = financeMonthsInRange(fromIso, toIso);
  const monthCount = Math.max(1, months.length);
  const toDate = financeYmd(new Date(toIso));

  const paymeParams = await financeRateOn('payme', toDate);
  const bankParams = await financeRateOn('bank', toDate);
  const taxParams = await financeRateOn('tax', toDate);
  const paymeMode = paymeParams.mode === 'separate' ? 'separate' : 'settlement_deducted';

  // Refund — hozircha tizimda ma'lumot yo'q (0). Kelajakda alohida jadval.
  const refunds = 0;

  const { rows: expRows } = await pool.query(
    `SELECT COALESCE(SUM(amount), 0)::bigint AS total, COUNT(*)::int AS n
     FROM finance_expenses WHERE spent_on >= $1 AND spent_on < $2`,
    [financeYmd(new Date(fromIso)), financeYmd(new Date(toIso))]
  );
  const manualExpenses = Number(expRows[0].total);

  let actualBankSettlement = null;
  {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(actual_amount), 0)::bigint AS total, COUNT(*)::int AS n
       FROM finance_bank_actuals WHERE period = ANY($1)`,
      [months]
    );
    if (Number(rows[0].n) > 0) actualBankSettlement = Number(rows[0].total);
  }

  const expectedBankSettlement = paymeMode === 'settlement_deducted'
    ? grossSales - refunds - paymeFee
    : grossSales - refunds;
  const reconciliationDifference = actualBankSettlement != null ? actualBankSettlement - expectedBankSettlement : null;

  // §8: Payme komissiyasi soliq bazasidan AVTOMATIK chiqarilmaydi.
  const taxBase = grossSales - refunds;
  const turnoverPct = Number(taxParams.turnoverPct) || 0;
  const turnoverTax = Math.round(taxBase * turnoverPct / 100);
  const socialMonthly = Number(taxParams.socialMonthly) || 0;
  const socialTax = socialMonthly * monthCount;
  const bankFees = (Number(bankParams.monthlyFee) || 0) * monthCount + (Number(bankParams.extraFee) || 0);

  const settlementForNet = actualBankSettlement != null ? actualBankSettlement : expectedBankSettlement;
  const netCashFlow = settlementForNet - bankFees - turnoverTax - socialTax - manualExpenses;

  return {
    fromIso, toIso, months,
    grossSales, refunds, paymeFee, paymeMode,
    expectedBankSettlement, actualBankSettlement, reconciliationDifference,
    taxBase, turnoverPct, turnoverTax, socialMonthly, socialTax,
    bankFees, manualExpenses, netCashFlow,
    orderCount: orders.length,
    byType: Object.entries(byType).map(([kind, total]) => ({ kind, total })).sort((a, b) => b.total - a.total),
    rates: { payme: paymeParams, bank: bankParams, tax: taxParams },
    ratesConfigured: Boolean((Number(paymeParams.pct) || Number(paymeParams.fixed)) || Number(taxParams.turnoverPct) || Number(taxParams.socialMonthly) || Number(bankParams.monthlyFee)),
  };
}

// Kunlik breakdown (web_orders'dan hisoblanadi).
export async function financeDailyBreakdown(fromIso, toIso) {
  const { rows } = await pool.query(
    `SELECT to_char(created_at, 'YYYY-MM-DD') AS day,
            COALESCE(SUM(price), 0)::bigint AS gross,
            COUNT(*)::int AS orders
     FROM web_orders
     WHERE status = 'paid' AND created_at >= $1 AND created_at < $2
     GROUP BY 1 ORDER BY 1`,
    [fromIso, toIso]
  );
  const out = [];
  const cache = {};
  for (const r of rows) {
    const p = cache[r.day] || (cache[r.day] = await financeRateOn('payme', r.day));
    const gross = Number(r.gross);
    const fee = Math.round(gross * (Number(p.pct) || 0) / 100) + (Number(p.fixed) || 0) * r.orders;
    out.push({ day: r.day, gross, orders: r.orders, paymeFee: fee, expected: gross - fee });
  }
  return out;
}

// Oy bo'yicha reconciliation: expected (hisob) ↔ actual (admin kiritgan).
export async function financeMonthlyReconciliation(year) {
  const y = Number(year) || new Date().getFullYear();
  const { rows: actuals } = await pool.query(
    `SELECT period, actual_amount AS "actualAmount", note, updated_at AS "updatedAt"
     FROM finance_bank_actuals WHERE period LIKE $1 ORDER BY period`,
    [`${y}-%`]
  );
  const actualMap = Object.fromEntries(actuals.map((a) => [a.period, a]));
  const out = [];
  for (let mo = 1; mo <= 12; mo++) {
    const period = `${y}-${String(mo).padStart(2, '0')}`;
    const fromIso = new Date(Date.UTC(y, mo - 1, 1)).toISOString();
    const toIso = new Date(Date.UTC(y, mo, 1)).toISOString();
    const { rows: g } = await pool.query(
      `SELECT COALESCE(SUM(price), 0)::bigint AS gross, COUNT(*)::int AS orders
       FROM web_orders WHERE status = 'paid' AND created_at >= $1 AND created_at < $2`,
      [fromIso, toIso]
    );
    const gross = Number(g[0].gross);
    const orders = Number(g[0].orders);
    const p = await financeRateOn('payme', `${period}-15`);
    const paymeFee = Math.round(gross * (Number(p.pct) || 0) / 100) + (Number(p.fixed) || 0) * orders;
    const mode = p.mode === 'separate' ? 'separate' : 'settlement_deducted';
    const expected = mode === 'separate' ? gross : gross - paymeFee;
    const a = actualMap[period];
    const actual = a ? Number(a.actualAmount) : null;
    const diff = actual != null ? actual - expected : null;
    let status = 'pending';
    if (actual != null) status = diff === 0 ? 'matched' : 'difference';
    out.push({ period, gross, orders, paymeFee, expected, actual, diff, status, note: a?.note || '' });
  }
  return out;
}

export async function financeSetBankActual({ period, actualAmount, note }) {
  if (!/^\d{4}-\d{2}$/.test(period)) return { error: 'bad_period' };
  const amt = Math.max(0, Math.round(Number(actualAmount) || 0));
  const { rows } = await pool.query(
    `INSERT INTO finance_bank_actuals (period, actual_amount, note, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (period) DO UPDATE SET actual_amount = $2, note = $3, updated_at = now()
     RETURNING period, actual_amount AS "actualAmount", note`,
    [period, amt, (note || '').slice(0, 200) || null]
  );
  return { ok: true, row: rows[0] };
}

// Tranzaksiyalar ro'yxati (sayt + bot buyurtmalari birlashtirilgan).
export async function financeListTransactions({ fromIso, toIso, type = '', status = '', q = '', page = 1, limit = 50 }) {
  const lim = Math.min(200, Math.max(10, Number(limit) || 50));
  const off = Math.max(0, (Math.max(1, Number(page) || 1) - 1) * lim);
  const args = [fromIso, toIso];
  const wWhere = [`w.status <> 'pending'`, `w.created_at >= $1`, `w.created_at < $2`];
  if (type) { args.push(type); wWhere.push(`w.kind = $${args.length}`); }
  if (status) { args.push(status); wWhere.push(`w.status = $${args.length}`); }
  if (q) {
    args.push(`%${q}%`);
    wWhere.push(`(w.code ILIKE $${args.length} OR u.email ILIKE $${args.length} OR w.payme_transaction_id ILIKE $${args.length})`);
  }
  const { rows: web } = await pool.query(
    `SELECT w.id, 'web' AS source, w.kind, w.code, w.price AS amount, w.status,
            w.payme_transaction_id AS "paymeTxnId", u.email AS "userEmail",
            w.created_at AS "createdAt"
     FROM web_orders w LEFT JOIN users u ON u.id = w.user_id
     WHERE ${wWhere.join(' AND ')}
     ORDER BY w.created_at DESC LIMIT $${args.length + 1} OFFSET $${args.length + 2}`,
    [...args, lim, off]
  );
  const { rows: cnt } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM web_orders w LEFT JOIN users u ON u.id = w.user_id WHERE ${wWhere.join(' AND ')}`,
    args
  );

  let bot = [];
  if (!type || type === 'card_purchase') {
    try {
      const bArgs = [fromIso, toIso];
      const bWhere = [`status <> 'pending'`, `created_at >= $1`, `created_at < $2`];
      if (status) { bArgs.push(status); bWhere.push(`status = $${bArgs.length}`); }
      if (q) { bArgs.push(`%${q}%`); bWhere.push(`code ILIKE $${bArgs.length}`); }
      const r = await pool.query(
        `SELECT id, 'bot' AS source, 'card_purchase' AS kind, code, price AS amount, status,
                NULL AS "paymeTxnId", tg_name AS "userEmail", created_at AS "createdAt"
         FROM bot_orders WHERE ${bWhere.join(' AND ')} ORDER BY created_at DESC LIMIT 100`,
        bArgs
      );
      bot = r.rows;
    } catch { bot = []; }
  }

  const items = [...web, ...bot]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((r) => ({ ...r, amount: Number(r.amount) }));

  return { items, total: Number(cnt[0].n) + bot.length, page: Math.max(1, Number(page) || 1), limit: lim };
}

export async function financeListExpenses(limit = 200) {
  const { rows } = await pool.query(
    `SELECT id, title, category, amount, to_char(spent_on, 'YYYY-MM-DD') AS "spentOn", note, created_at AS "createdAt"
     FROM finance_expenses ORDER BY spent_on DESC, id DESC LIMIT $1`,
    [Math.min(500, Number(limit) || 200)]
  );
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

export async function financeAddExpense({ title, category, amount, spentOn, note }) {
  const t = (title || '').trim().slice(0, 120);
  if (!t) return { error: 'title_required' };
  const amt = Math.round(Number(amount) || 0);
  if (!amt || amt <= 0) return { error: 'bad_amount' };
  const cat = FINANCE_EXPENSE_CATEGORIES.includes(category) ? category : 'other';
  const day = /^\d{4}-\d{2}-\d{2}$/.test(spentOn) ? spentOn : financeYmd(new Date());
  const { rows } = await pool.query(
    `INSERT INTO finance_expenses (title, category, amount, spent_on, note)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, title, category, amount, to_char(spent_on, 'YYYY-MM-DD') AS "spentOn", note`,
    [t, cat, amt, day, (note || '').slice(0, 300) || null]
  );
  return { ok: true, expense: { ...rows[0], amount: Number(rows[0].amount) } };
}

export async function financeDeleteExpense(id) {
  const { rowCount } = await pool.query(`DELETE FROM finance_expenses WHERE id = $1`, [Number(id)]);
  return { ok: rowCount > 0 };
}

export async function financeListDocs(limit = 200) {
  const { rows } = await pool.query(
    `SELECT id, name, doc_type AS "docType", period, url, created_at AS "createdAt"
     FROM finance_docs ORDER BY created_at DESC LIMIT $1`,
    [Math.min(500, Number(limit) || 200)]
  );
  return rows;
}

export async function financeAddDoc({ name, docType, period, url }) {
  const n = (name || '').trim().slice(0, 160);
  const u = (url || '').trim().slice(0, 600);
  if (!n || !u) return { error: 'name_url_required' };
  const dt = FINANCE_DOC_TYPES.includes(docType) ? docType : 'other';
  const { rows } = await pool.query(
    `INSERT INTO finance_docs (name, doc_type, period, url)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, doc_type AS "docType", period, url, created_at AS "createdAt"`,
    [n, dt, (period || '').slice(0, 16) || null, u]
  );
  return { ok: true, doc: rows[0] };
}

export async function financeDeleteDoc(id) {
  const { rowCount } = await pool.query(`DELETE FROM finance_docs WHERE id = $1`, [Number(id)]);
  return { ok: rowCount > 0 };
}
