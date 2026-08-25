import pg from 'pg';
import crypto from 'crypto';

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
  for (const key of ['about', 'facebook', 'twitter', 'website', 'card_number', 'theme', 'for_sale', 'sale_price', 'extra_links', 'card_numbers', 'bg_url', 'bg_pattern']) {
    if (!cols.has(key)) {
      await pool.query(desired[key]);
      console.log(`[db] cards.${key} ustuni qo'shildi.`);
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
      code       VARCHAR(16) NOT NULL,
      price      INTEGER NOT NULL,
      payload    JSONB NOT NULL,
      status     VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
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
      id                SERIAL PRIMARY KEY,
      code              VARCHAR(16) NOT NULL REFERENCES cards(code) ON DELETE CASCADE,
      seller_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      start_price       BIGINT NOT NULL,
      buy_now_price     BIGINT,
      current_price     BIGINT NOT NULL,
      highest_bidder_id INTEGER REFERENCES users(id),
      ends_at           TIMESTAMPTZ NOT NULL,
      status            VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS auctions_status_idx ON auctions (status, ends_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS auctions_code_idx ON auctions (code)`);

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

  // Premium profilga o'tish so'rovlari — foydalanuvchi 5000 NFC Coin to'laydi
  // (darhol ushlab qolinadi), admin panelda ko'rib chiqib tasdiqlaydi
  // (is_premium=true) yoki rad etadi (pul avtomatik qaytariladi).
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
      v_auction   RECORD;
      v_balance   BIGINT;
      v_held      BIGINT;
      v_available BIGINT;
      v_prev      BIGINT;
      v_buy_now   BOOLEAN := FALSE;
      v_bid_id    INTEGER;
    BEGIN
      IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'BID_TOO_LOW');
      END IF;

      -- Idempotentlik: shu kalit bilan taklif avval qayta ishlangan bo'lsa,
      -- qaytadan yozmasdan o'sha natijani qaytaramiz (tarmoq uzilib qayta
      -- so'rov yuborilgan holatlarda ikki marta yechilib qolmasligi uchun).
      SELECT id INTO v_bid_id FROM bids WHERE idempotency_key = p_idempotency_key;
      IF FOUND THEN
        RETURN jsonb_build_object('ok', true, 'idempotent', true, 'bidId', v_bid_id);
      END IF;

      -- Auksionni qulflaymiz — parallel takliflar navbat bilan ishlanadi,
      -- dirty read va poyga holati (race condition) bo'lmaydi.
      SELECT id, seller_id, current_price, buy_now_price, highest_bidder_id, status, ends_at
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
      IF p_amount <= v_auction.current_price THEN
        RETURN jsonb_build_object('ok', false, 'error', 'BID_TOO_LOW');
      END IF;

      -- Foydalanuvchi hamyonini (NFC Pay) qulflaymiz — 1 NFC Coin = 1 so'm.
      SELECT balance, held_balance INTO v_balance, v_held
        FROM users WHERE id = p_user_id FOR UPDATE;
      v_available := v_balance - v_held;
      IF v_available < p_amount THEN
        RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_NFC_COINS', 'available', v_available);
      END IF;

      -- Avvalgi g'olibning bandlangan NFC Coin'lari bo'shatiladi.
      IF v_auction.highest_bidder_id IS NOT NULL THEN
        SELECT COALESCE(MAX(amount), 0) INTO v_prev FROM bids
          WHERE auction_id = p_auction_id AND user_id = v_auction.highest_bidder_id;
        UPDATE users SET held_balance = held_balance - v_prev WHERE id = v_auction.highest_bidder_id;
        INSERT INTO transactions (user_id, amount, kind, ref_table, ref_id, note)
          VALUES (v_auction.highest_bidder_id, 0, 'bid_release', 'auctions', p_auction_id,
                  'Yangi yuqori taklif keldi \u2014 oldingi ' || v_prev || ' NFC Coin bandlovdan bo\u2019shatildi');
      END IF;

      INSERT INTO bids (auction_id, user_id, amount, idempotency_key)
        VALUES (p_auction_id, p_user_id, p_amount, p_idempotency_key)
        RETURNING id INTO v_bid_id;

      UPDATE users SET held_balance = held_balance + p_amount WHERE id = p_user_id;
      INSERT INTO transactions (user_id, amount, kind, ref_table, ref_id, note)
        VALUES (p_user_id, 0, 'bid_hold', 'auctions', p_auction_id,
                p_amount || ' NFC Coin taklif uchun bandlandi');

      v_buy_now := v_auction.buy_now_price IS NOT NULL AND p_amount >= v_auction.buy_now_price;

      UPDATE auctions SET
          current_price = p_amount,
          highest_bidder_id = p_user_id,
          status = CASE WHEN v_buy_now THEN 'sold' ELSE status END,
          ends_at = CASE WHEN v_buy_now THEN now() ELSE ends_at END
        WHERE id = p_auction_id;

      RETURN jsonb_build_object('ok', true, 'buyNow', v_buy_now, 'bidId', v_bid_id);
    EXCEPTION WHEN unique_violation THEN
      -- Bir xil idempotency_key bilan bir vaqtda ikkita so'rov kirib kelsa.
      RETURN jsonb_build_object('ok', true, 'idempotent', true);
    END;
    $$;
  `);

  dbReady = true;
  console.log('[db] PostgreSQL ulanishi va schema tayyor.');
  return true;
}

export function isDbReady() {
  return dbReady;
}

const SELECT_FIELDS = `
  code, name, role, avatar_url AS "avatarUrl", bg_url AS "bgUrl", bg_pattern AS "bgPattern",
  tg, phone, email,
  linkedin, instagram, about, facebook, twitter, website,
  card_number AS "cardNumber", extra_links AS "extraLinks", card_numbers AS "cardNumbers",
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
    theme: row.theme || 'classic',
    forSale: !!row.forSale,
    salePrice: row.salePrice != null ? Number(row.salePrice) : null,
    hashtags: Array.isArray(row.hashtags) ? row.hashtags : [],
    price: Number(row.price),
    ts: Number(row.ts),
    views: Number(row.views),
  };
}

export async function listRecords() {
  const { rows } = await pool.query(
    `SELECT ${SELECT_FIELDS} FROM cards ORDER BY ts DESC LIMIT 500`
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
            c.tg, c.phone, c.email, c.linkedin, c.instagram, c.about, c.facebook, c.twitter, c.website,
            c.card_number AS "cardNumber", c.extra_links AS "extraLinks", c.card_numbers AS "cardNumbers",
            c.theme, c.for_sale AS "forSale", c.sale_price AS "salePrice", c.hashtags, c.price, c.ts, c.views,
            u.is_premium AS "ownerIsPremium"
     FROM cards c LEFT JOIN users u ON u.id = c.user_id
     WHERE c.code = $1`,
    [code]
  );
  if (!rows[0]) return null;
  return { ...rowToRecord(rows[0]), isPremium: !!rows[0].ownerIsPremium };
}

export async function createRecord(record) {
  const { rows } = await pool.query(
    `INSERT INTO cards
       (code, name, role, avatar_url, bg_url, bg_pattern, tg, phone, email, linkedin, instagram,
        about, facebook, twitter, website, card_number, extra_links, card_numbers, theme, hashtags, price, ts)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb,$19,$20::jsonb,$21,$22)
     ON CONFLICT (code) DO NOTHING
     RETURNING ${SELECT_FIELDS}`,
    [
      record.code,
      record.name,
      record.role,
      record.avatarUrl,
      record.bgUrl || '',
      record.bgPattern === false ? false : true,
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

// ---------- Auth ----------

export async function createUser(email, passwordHash, { phone, botAck } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, phone, bot_ack) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING
     RETURNING id, email, phone, bot_ack AS "botAck"`,
    [email.toLowerCase(), passwordHash, phone || null, !!botAck]
  );
  return rows[0] || null;
}

export async function getUserByEmail(email) {
  const { rows } = await pool.query(
    `SELECT id, email, password_hash, phone, bot_ack AS "botAck" FROM users WHERE email = $1`,
    [String(email || '').toLowerCase()]
  );
  return rows[0]
    ? { id: rows[0].id, email: rows[0].email, passwordHash: rows[0].password_hash, phone: rows[0].phone, botAck: rows[0].botAck }
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
    `SELECT u.id, u.email, u.is_premium AS "isPremium" FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > now()`,
    [token]
  );
  return rows[0] ? { id: rows[0].id, email: rows[0].email, isPremium: !!rows[0].isPremium } : null;
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
    `SELECT ${SELECT_FIELDS} FROM cards WHERE user_id = $1 ORDER BY ts DESC`,
    [userId]
  );
  return rows.map(rowToRecord);
}

export async function getRecordOwner(code) {
  const { rows } = await pool.query(
    `SELECT user_id FROM cards WHERE code = $1`,
    [code]
  );
  return rows[0] ? rows[0].user_id : null;
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
  id, user_id AS "userId", code, price, payload, status, created_at AS "createdAt"
`;

export async function createWebOrder({ userId, code, price, payload }) {
  const { rows } = await pool.query(
    `INSERT INTO web_orders (user_id, code, price, payload)
     VALUES ($1,$2,$3,$4::jsonb) RETURNING ${WEB_ORDER_FIELDS}`,
    [userId, code, price, JSON.stringify(payload || {})]
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
  a.status, a.created_at AS "createdAt"
`;

export async function createAuction({ code, sellerId, startPrice, buyNowPrice, hours }) {
  const { rows } = await pool.query(
    `INSERT INTO auctions (code, seller_id, start_price, buy_now_price, current_price, ends_at)
     VALUES ($1,$2,$3,$4,$3, now() + ($5 || ' hours')::interval)
     RETURNING ${AUCTION_FIELDS.replace(/a\./g, '')}`,
    [code, sellerId, startPrice, buyNowPrice || null, hours]
  );
  return rows[0] || null;
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

export async function listExpiredActiveAuctions() {
  const { rows } = await pool.query(
    `SELECT ${AUCTION_FIELDS} FROM auctions a WHERE a.status = 'active' AND a.ends_at <= now() LIMIT 50`
  );
  return rows;
}

export async function listBidsByAuction(auctionId) {
  const { rows } = await pool.query(
    `SELECT id, auction_id AS "auctionId", user_id AS "userId", amount, released, created_at AS "createdAt"
     FROM bids WHERE auction_id = $1 ORDER BY amount DESC, created_at ASC`,
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
export async function settleAuction(auctionId, commissionPct) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: aRows } = await client.query(
      `SELECT id, code, seller_id AS "sellerId", current_price AS "currentPrice",
              highest_bidder_id AS "highestBidderId", status
       FROM auctions WHERE id = $1 FOR UPDATE`,
      [auctionId]
    );
    const auction = aRows[0];
    if (!auction || auction.status !== 'active') { await client.query('ROLLBACK'); return null; }

    const { rows: bidRows } = await client.query(
      `SELECT user_id AS "userId", MAX(amount) AS amount FROM bids WHERE auction_id = $1 GROUP BY user_id`,
      [auctionId]
    );

    if (auction.highestBidderId) {
      const winAmount = Number(auction.currentPrice);
      const commission = Math.round(winAmount * (commissionPct / 100));
      const sellerGets = winAmount - commission;

      // G'olibning holdi -> real yechiladi (balance va held ikkalasidan).
      await client.query(
        `UPDATE users SET balance = balance - $2, held_balance = held_balance - $2 WHERE id = $1`,
        [auction.highestBidderId, winAmount]
      );
      await client.query(
        `INSERT INTO transactions (user_id, amount, kind, ref_table, ref_id, note)
         VALUES ($1,$2,'auction_win','auctions',$3,'Auksionda g\u2019olib chiqdingiz \u2014 ' || $2 || ' NFC Coin yechildi')`,
        [auction.highestBidderId, -winAmount, auctionId]
      );
      // Sotuvchiga (komissiyadan keyin) tushadi.
      await client.query(`UPDATE users SET balance = balance + $2 WHERE id = $1`, [auction.sellerId, sellerGets]);
      await client.query(
        `INSERT INTO transactions (user_id, amount, kind, ref_table, ref_id, note)
         VALUES ($1,$2,'auction_sale','auctions',$3,'Auksionda sotildi \u2014 komissiya (' || $4 || '%) ' || $5 || ' NFC Coin ushlab qolindi')`,
        [auction.sellerId, sellerGets, auctionId, commissionPct, commission]
      );
      // Komissiya platforma (admin) hamyoniga tushadi.
      await creditPlatformWallet(client, commission, 'platform_commission', 'auctions', auctionId,
        `Auksion komissiyasi (${commissionPct}%) \u2014 ${auction.code}`);
      // Karta yangi egasiga o'tadi.
      await client.query(
        `UPDATE cards SET user_id = $2, for_sale = FALSE, sale_price = NULL WHERE code = $1`,
        [auction.code, auction.highestBidderId]
      );
      // Sotuvchining eski jismoniy kartasi (agar bo'lsa) deaktivatsiya qilinadi.
      await client.query(
        `UPDATE physical_cards SET linked_code = NULL, active = FALSE WHERE linked_code = $1`,
        [auction.code]
      );
      // Yutqazganlarning holdi bo'shatiladi.
      for (const b of bidRows) {
        if (b.userId !== auction.highestBidderId) {
          await client.query(`UPDATE users SET held_balance = held_balance - $2 WHERE id = $1`, [b.userId, Number(b.amount)]);
          await client.query(
            `INSERT INTO transactions (user_id, amount, kind, ref_table, ref_id, note)
             VALUES ($1,0,'bid_release','auctions',$2,'Auksionda yutqazdingiz \u2014 bandlangan mablag\u2019 bo\u2019shatildi')`,
            [b.userId, auctionId]
          );
        }
      }
      await client.query(`UPDATE auctions SET status = 'sold' WHERE id = $1`, [auctionId]);
      await client.query('COMMIT');
      return { code: auction.code, sellerId: auction.sellerId, winnerId: auction.highestBidderId, winAmount, commission, sellerGets };
    } else {
      await client.query(`UPDATE auctions SET status = 'expired' WHERE id = $1`, [auctionId]);
      await client.query('COMMIT');
      return { code: auction.code, expired: true };
    }
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
            created_at AS "createdAt",
            (SELECT COUNT(*) FROM cards WHERE user_id = users.id) AS "cardCount"
     FROM users ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return rows.map((r) => ({ ...r, balance: Number(r.balance), heldBalance: Number(r.heldBalance), cardCount: Number(r.cardCount) }));
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
            hu.email AS "highestBidderEmail", a.ends_at AS "endsAt", a.status, a.created_at AS "createdAt"
     FROM auctions a
     JOIN users su ON su.id = a.seller_id
     LEFT JOIN users hu ON hu.id = a.highest_bidder_id
     ORDER BY a.created_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
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

export async function adminStats() {
  const [{ rows: u }, { rows: c }, { rows: a }, { rows: p }, { rows: t }] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(balance),0)::bigint AS total_balance FROM users`),
    pool.query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(price),0)::bigint AS total_price FROM cards`),
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
    `SELECT chip_token AS "chipToken", linked_code AS "linkedCode", active
     FROM physical_cards WHERE chip_token = $1`,
    [chipToken]
  );
  return rows[0] || null;
}

// ---------- Premium profil so'rovlari ----------

export async function requestPremium(userId, amount) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: uRows } = await client.query(
      `SELECT balance, held_balance AS "heldBalance", is_premium AS "isPremium" FROM users WHERE id = $1 FOR UPDATE`,
      [userId]
    );
    const u = uRows[0];
    if (!u) { await client.query('ROLLBACK'); return { error: 'NOT_FOUND' }; }
    if (u.isPremium) { await client.query('ROLLBACK'); return { error: 'ALREADY_PREMIUM' }; }
    const available = Number(u.balance) - Number(u.heldBalance);
    if (available < amount) { await client.query('ROLLBACK'); return { error: 'INSUFFICIENT_NFC_COINS', available }; }

    const { rows: existing } = await client.query(
      `SELECT id FROM premium_requests WHERE user_id = $1 AND status = 'pending'`, [userId]
    );
    if (existing[0]) { await client.query('ROLLBACK'); return { error: 'ALREADY_PENDING' }; }

    // Summani darhol ushlab qolamiz (balansdan yechamiz) — admin rad etsa
    // avtomatik qaytariladi (pastroqqa qarang).
    await client.query(`UPDATE users SET balance = balance - $2 WHERE id = $1`, [userId, amount]);
    await client.query(
      `INSERT INTO transactions (user_id, amount, kind, note) VALUES ($1,$2,'admin_adjust',$3)`,
      [userId, -amount, 'Premium profil uchun to\u2019lov (admin tasdig\u2019ini kutmoqda)']
    );
    const { rows } = await client.query(
      `INSERT INTO premium_requests (user_id, amount) VALUES ($1,$2) RETURNING id`,
      [userId, amount]
    );
    await client.query('COMMIT');
    return { ok: true, requestId: rows[0].id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listPremiumRequests(status = 'pending') {
  const { rows } = await pool.query(
    `SELECT pr.id, pr.user_id AS "userId", u.email, pr.amount, pr.status, pr.created_at AS "createdAt"
     FROM premium_requests pr JOIN users u ON u.id = pr.user_id
     WHERE pr.status = $1 ORDER BY pr.created_at DESC`,
    [status]
  );
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

export async function approvePremiumRequest(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE premium_requests SET status = 'approved', decided_at = now()
       WHERE id = $1 AND status = 'pending' RETURNING user_id AS "userId"`,
      [id]
    );
    if (!rows[0]) { await client.query('ROLLBACK'); return null; }
    await client.query(`UPDATE users SET is_premium = TRUE WHERE id = $1`, [rows[0].userId]);
    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function rejectPremiumRequest(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE premium_requests SET status = 'rejected', decided_at = now()
       WHERE id = $1 AND status = 'pending' RETURNING user_id AS "userId", amount`,
      [id]
    );
    const req = rows[0];
    if (!req) { await client.query('ROLLBACK'); return null; }
    // To'lov avtomatik qaytariladi.
    await client.query(`UPDATE users SET balance = balance + $2 WHERE id = $1`, [req.userId, req.amount]);
    await client.query(
      `INSERT INTO transactions (user_id, amount, kind, note) VALUES ($1,$2,'refund',$3)`,
      [req.userId, Number(req.amount), 'Premium so\u2019rovi rad etildi \u2014 to\u2019lov qaytarildi']
    );
    await client.query('COMMIT');
    return req;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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

export async function followUser(followerId, followeeId, feeAmount, commissionPct) {
  if (followerId === followeeId) return { error: 'CANNOT_FOLLOW_SELF' };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: exists } = await client.query(
      `SELECT id FROM follows WHERE follower_id = $1 AND followee_id = $2`, [followerId, followeeId]
    );
    if (exists[0]) { await client.query('ROLLBACK'); return { error: 'ALREADY_FOLLOWING' }; }

    const { rows: feRows } = await client.query(
      `SELECT is_premium AS "isPremium" FROM users WHERE id = $1 FOR UPDATE`, [followeeId]
    );
    if (!feRows[0]) { await client.query('ROLLBACK'); return { error: 'NOT_FOUND' }; }
    const isPremium = feRows[0].isPremium;
    const amount = isPremium ? feeAmount : 0;
    const commission = isPremium ? Math.round(amount * (commissionPct / 100)) : 0;
    const ownerGets = amount - commission;

    if (isPremium) {
      const { rows: frRows } = await client.query(
        `SELECT balance, held_balance AS "heldBalance" FROM users WHERE id = $1 FOR UPDATE`, [followerId]
      );
      const fr = frRows[0];
      const available = Number(fr.balance) - Number(fr.heldBalance);
      if (available < amount) { await client.query('ROLLBACK'); return { error: 'INSUFFICIENT_NFC_COINS', available }; }

      await client.query(`UPDATE users SET balance = balance - $2 WHERE id = $1`, [followerId, amount]);
      await client.query(`UPDATE users SET balance = balance + $2 WHERE id = $1`, [followeeId, ownerGets]);
      await client.query(
        `INSERT INTO transactions (user_id, amount, kind, note) VALUES ($1,$2,'card_purchase',$3)`,
        [followerId, -amount, 'Premium profilga obuna to\u2019lovi']
      );
      await client.query(
        `INSERT INTO transactions (user_id, amount, kind, note) VALUES ($1,$2,'card_purchase',$3)`,
        [followeeId, ownerGets, `Yangi premium obunachi to\u2019lovi (komissiya ${commissionPct}% ushlab qolindi)`]
      );
      // Komissiya platforma hamyoniga tushadi.
      await creditPlatformWallet(client, commission, 'platform_commission', 'follows', followeeId,
        `Premium obuna komissiyasi (${commissionPct}%)`);
    }

    await client.query(
      `INSERT INTO follows (follower_id, followee_id, paid, amount) VALUES ($1,$2,$3,$4)`,
      [followerId, followeeId, isPremium, amount]
    );
    await client.query('COMMIT');
    return { ok: true, paid: isPremium, amount };
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
export async function adminRevenueBreakdown() {
  const { rows } = await pool.query(
    `SELECT kind,
            COUNT(*)::int AS count,
            COALESCE(SUM(amount),0)::bigint AS total
     FROM transactions
     WHERE amount > 0
     GROUP BY kind ORDER BY total DESC`
  );
  return rows.map((r) => ({ kind: r.kind, count: r.count, total: Number(r.total) }));
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
