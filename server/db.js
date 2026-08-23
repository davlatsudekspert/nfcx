import pg from 'pg';

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
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
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
  for (const key of ['about', 'facebook', 'twitter', 'website', 'card_number', 'theme', 'for_sale', 'sale_price', 'extra_links', 'card_numbers']) {
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

  dbReady = true;
  console.log('[db] PostgreSQL ulanishi va schema tayyor.');
  return true;
}

export function isDbReady() {
  return dbReady;
}

const SELECT_FIELDS = `
  code, name, role, avatar_url AS "avatarUrl", tg, phone, email,
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
    `SELECT ${SELECT_FIELDS} FROM cards WHERE code = $1`,
    [code]
  );
  return rows[0] ? rowToRecord(rows[0]) : null;
}

export async function createRecord(record) {
  const { rows } = await pool.query(
    `INSERT INTO cards
       (code, name, role, avatar_url, tg, phone, email, linkedin, instagram,
        about, facebook, twitter, website, card_number, extra_links, card_numbers, theme, hashtags, price, ts)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17,$18::jsonb,$19,$20)
     ON CONFLICT (code) DO NOTHING
     RETURNING ${SELECT_FIELDS}`,
    [
      record.code,
      record.name,
      record.role,
      record.avatarUrl,
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
      JSON.stringify(record.hashtags),
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

export async function createUser(email, passwordHash) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2)
     ON CONFLICT (email) DO NOTHING
     RETURNING id, email`,
    [email.toLowerCase(), passwordHash]
  );
  return rows[0] ? { id: rows[0].id, email: rows[0].email } : null;
}

export async function getUserByEmail(email) {
  const { rows } = await pool.query(
    `SELECT id, email, password_hash FROM users WHERE email = $1`,
    [String(email || '').toLowerCase()]
  );
  return rows[0]
    ? { id: rows[0].id, email: rows[0].email, passwordHash: rows[0].password_hash }
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
    `SELECT u.id, u.email FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > now()`,
    [token]
  );
  return rows[0] ? { id: rows[0].id, email: rows[0].email } : null;
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
