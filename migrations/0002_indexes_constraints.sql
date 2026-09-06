-- 0002 — indekslar va cheklovlar (audit: docs/NFCSTORE_FULL_AUDIT.md §3 D4/D5)
-- XAVFSIZ: faqat CREATE INDEX IF NOT EXISTS — ma'lumot o'zgarmaydi, o'chirilmaydi.
-- Production'ga QO'LDA, tekshiruvdan keyin: wrangler d1 execute DB --remote --file=migrations/0002_indexes_constraints.sql
-- Rollback: migrations/0002_rollback.sql (DROP INDEX IF EXISTS ...)

-- Yangi jadval (Worker ham CREATE IF NOT EXISTS qiladi): D1 asosidagi rate limit
CREATE TABLE IF NOT EXISTS "rate_limits" ("key" TEXT PRIMARY KEY NOT NULL, "hits" INTEGER DEFAULT 0 NOT NULL, "window_start" INTEGER NOT NULL);

-- Eng issiq yo'llar
CREATE INDEX IF NOT EXISTS cards_user_idx            ON cards(user_id);
CREATE INDEX IF NOT EXISTS cards_profile_type_idx    ON cards(profile_type);
CREATE INDEX IF NOT EXISTS cards_verified_idx        ON cards(verified);
CREATE INDEX IF NOT EXISTS sessions_user_idx         ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx      ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS web_orders_code_status_idx ON web_orders(code, status);
CREATE INDEX IF NOT EXISTS web_orders_status_created_idx ON web_orders(status, created_at);
CREATE INDEX IF NOT EXISTS web_orders_user_created_idx ON web_orders(user_id, created_at);
CREATE INDEX IF NOT EXISTS news_pub_created_idx      ON news(published, created_at);
CREATE INDEX IF NOT EXISTS news_likes_visitor_idx    ON news_likes(visitor_hash);
CREATE INDEX IF NOT EXISTS referral_uses_referrer_idx ON referral_uses(referrer_id);
CREATE INDEX IF NOT EXISTS gift_offers_from_idx      ON gift_offers(from_user_id, status);
CREATE INDEX IF NOT EXISTS nfc_gifts_code_status_idx ON nfc_gifts(code, status);
CREATE INDEX IF NOT EXISTS users_is_test_idx         ON users(is_test);
CREATE INDEX IF NOT EXISTS company_payments_company_idx ON company_payments(company_id);
CREATE INDEX IF NOT EXISTS company_status_log_company_idx ON company_status_log(company_id);
CREATE INDEX IF NOT EXISTS card_events_code_created_idx ON card_events(code, created_at);
CREATE INDEX IF NOT EXISTS card_leads_code_idx       ON card_leads(code);
CREATE INDEX IF NOT EXISTS phone_otp_codes_phone_idx ON phone_otp_codes(phone);
CREATE INDEX IF NOT EXISTS password_reset_codes_user_idx ON password_reset_codes(user_id);

-- Dublikatlarga qarshi cheklovlar (UNIQUE partial index)
-- DIQQAT: production'da allaqachon dublikat bo'lsa CREATE UNIQUE INDEX xato beradi —
-- oldin migrations/0002_check.sql dagi tekshiruv so'rovlarini bajaring.
CREATE UNIQUE INDEX IF NOT EXISTS web_orders_one_pending_per_code ON web_orders(code) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS company_payments_upstream_uniq  ON company_payments(upstream_order_id) WHERE upstream_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS auction_requests_user_code_pending ON auction_requests(user_id, code) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS referral_uses_referred_uniq ON referral_uses(referred_id);
