-- 0002 rollback — faqat indekslar o'chiriladi, ma'lumot o'zgarmaydi.
DROP INDEX IF EXISTS cards_user_idx; DROP INDEX IF EXISTS cards_profile_type_idx; DROP INDEX IF EXISTS cards_verified_idx;
DROP INDEX IF EXISTS sessions_user_idx; DROP INDEX IF EXISTS sessions_expires_idx;
DROP INDEX IF EXISTS web_orders_code_status_idx; DROP INDEX IF EXISTS web_orders_status_created_idx; DROP INDEX IF EXISTS web_orders_user_created_idx;
DROP INDEX IF EXISTS news_pub_created_idx; DROP INDEX IF EXISTS news_likes_visitor_idx; DROP INDEX IF EXISTS referral_uses_referrer_idx;
DROP INDEX IF EXISTS gift_offers_from_idx; DROP INDEX IF EXISTS nfc_gifts_code_status_idx; DROP INDEX IF EXISTS users_is_test_idx;
DROP INDEX IF EXISTS company_payments_company_idx; DROP INDEX IF EXISTS company_status_log_company_idx;
DROP INDEX IF EXISTS card_events_code_created_idx; DROP INDEX IF EXISTS card_leads_code_idx;
DROP INDEX IF EXISTS phone_otp_codes_phone_idx; DROP INDEX IF EXISTS password_reset_codes_user_idx;
DROP INDEX IF EXISTS web_orders_one_pending_per_code; DROP INDEX IF EXISTS company_payments_upstream_uniq;
DROP INDEX IF EXISTS auction_requests_user_code_pending; DROP INDEX IF EXISTS referral_uses_referred_uniq;
