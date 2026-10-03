-- hasharchilar.uz — Cloudflare D1 sxemasi
-- Ishga tushirish: npm run db:local  (lokal)  |  npm run db:remote  (production)

PRAGMA foreign_keys = ON;

-- Foydalanuvchilar: telefon raqami bo'yicha yengil "hisob" (parolsiz).
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  phone      TEXT NOT NULL UNIQUE,          -- +998901234567 ko'rinishida
  email      TEXT,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Hasharlar (tadbirlar).
CREATE TABLE IF NOT EXISTS hashars (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  address     TEXT NOT NULL DEFAULT '',
  lat         REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng         REAL NOT NULL CHECK (lng BETWEEN -180 AND 180),
  date_time   TEXT NOT NULL,                -- ISO: 2026-10-11T09:00
  items       TEXT NOT NULL DEFAULT '[]',   -- kerakli narsalar (JSON massiv)
  status      TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED')),
  creator_id  INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_hashars_status_date ON hashars(status, date_time);

-- Rasmlar (R2 dagi fayllarga havola): oldin / keyin.
CREATE TABLE IF NOT EXISTS hashar_media (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  hashar_id  INTEGER NOT NULL REFERENCES hashars(id) ON DELETE CASCADE,
  photo_type TEXT NOT NULL CHECK (photo_type IN ('BEFORE', 'AFTER')),
  r2_url     TEXT NOT NULL                  -- /api/media/<r2-key>
);
CREATE INDEX IF NOT EXISTS idx_media_hashar ON hashar_media(hashar_id);

-- Qatnashuvchilar: bir foydalanuvchi bitta hasharga faqat bir marta qo'shiladi.
CREATE TABLE IF NOT EXISTS volunteers (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  hashar_id INTEGER NOT NULL REFERENCES hashars(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (hashar_id, user_id)
);
