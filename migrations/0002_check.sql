-- 0002 dan OLDIN production'da bajarilsin (read-only). Har biri 0 qator qaytarsa — xavfsiz.
SELECT code, COUNT(*) AS n FROM web_orders WHERE status='pending' GROUP BY code HAVING n > 1;
SELECT upstream_order_id, COUNT(*) AS n FROM company_payments WHERE upstream_order_id IS NOT NULL GROUP BY upstream_order_id HAVING n > 1;
SELECT user_id, code, COUNT(*) AS n FROM auction_requests WHERE status='pending' GROUP BY user_id, code HAVING n > 1;
SELECT referred_id, COUNT(*) AS n FROM referral_uses GROUP BY referred_id HAVING n > 1;
-- Dublikat topilsa: eng eskisidan boshqasini 'cancelled' qilish (web_orders) yoki qo'lda tozalash — avtomatik DELETE yo'q.
