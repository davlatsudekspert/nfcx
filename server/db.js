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
    music_url: `ALTER TABLE cards ADD COLUMN music_url TEXT`,
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
  for (const key of ['about', 'facebook', 'twitter', 'website', 'card_number', 'theme', 'for_sale', 'sale_price', 'extra_links', 'card_numbers', 'bg_url', 'bg_pattern', 'accent_color', 'bg_color', 'bg_animated', 'music_url', 'is_primary']) {
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

  dbReady = true;
  console.log('[db] PostgreSQL ulanishi va schema tayyor.');
  return true;
}

export function isDbReady() {
  return dbReady;
}

const SELECT_FIELDS = `
  code, name, role, avatar_url AS "avatarUrl", bg_url AS "bgUrl", bg_pattern AS "bgPattern",
  accent_color AS "accentColor", bg_color AS "bgColor", bg_animated AS "bgAnimated", music_url AS "musicUrl",
  is_primary AS "isPrimary",
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
    accentColor: row.accentColor || '',
    bgColor: row.bgColor || '',
    bgAnimated: row.bgAnimated !== false,
    isPrimary: !!row.isPrimary,
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
            c.accent_color AS "accentColor", c.bg_color AS "bgColor", c.bg_animated AS "bgAnimated", c.music_url AS "musicUrl",
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

// ---------- Auth ----------

export async function createUser(email, passwordHash, { phone, botAck, tosAccepted } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, phone, bot_ack, tos_accepted) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO NOTHING
     RETURNING id, email, phone, bot_ack AS "botAck"`,
    [email.toLowerCase(), passwordHash, phone || null, !!botAck, !!tosAccepted]
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
    `SELECT u.id, u.email, u.is_premium AS "isPremium",
            u.banned_until AS "bannedUntil", u.strike_count AS "strikeCount"
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > now()`,
    [token]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  const isBanned = r.bannedUntil && new Date(r.bannedUntil) > new Date();
  return {
    id: r.id, email: r.email, isPremium: !!r.isPremium,
    bannedUntil: isBanned ? r.bannedUntil : null,
    strikeCount: r.strikeCount || 0,
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
      `SELECT id, code, to_user_id AS "toUserId" FROM gift_offers WHERE id = $1 AND status = 'pending' FOR UPDATE`,
      [id]
    );
    const offer = rows[0];
    if (!offer || offer.toUserId !== userId) { await client.query('ROLLBACK'); return null; }
    await client.query(`UPDATE cards SET user_id = $2, is_primary = FALSE WHERE code = $1`, [offer.code, userId]);
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
            u.id AS "userId", u.email AS "userEmail"
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
export async function createAuction({ code, startPrice, buyNowPrice, hours }) {
  const { rows } = await pool.query(
    `INSERT INTO auctions (code, seller_id, start_price, buy_now_price, current_price, ends_at, created_by_admin)
     VALUES ($1,NULL,$2,$3,$2, now() + ($4 || ' hours')::interval, TRUE)
     RETURNING ${AUCTION_FIELDS.replace(/a\./g, '')}`,
    [code, startPrice, buyNowPrice || null, hours]
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
      `INSERT INTO cards (code, name, role, avatar_url, tg, phone, email, linkedin, instagram, theme, hashtags, price, ts, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14)`,
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

// Premium profilga o'tish uchun real Payme to'lovini boshlaydi (5000 so'm).
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
