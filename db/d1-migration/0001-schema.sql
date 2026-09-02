-- NFCSTORE PostgreSQL + Sites D1 -> Cloudflare D1 schema

-- Generated without BEGIN/COMMIT for Wrangler D1 import compatibility.

CREATE TABLE IF NOT EXISTS "admin_activity_log" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "action" TEXT (60) NOT NULL,
  "details" TEXT,
  "old_value" TEXT,
  "new_value" TEXT,
  "ip" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "admin_ip_whitelist" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "ip" TEXT NOT NULL,
  "label" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE ("ip")
);

CREATE TABLE IF NOT EXISTS "admin_login_history" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "event" TEXT (30) NOT NULL,
  "ip" TEXT,
  "user_agent" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "admin_settings" (
  "key" TEXT NOT NULL,
  "value" TEXT,
  PRIMARY KEY ("key")
);

CREATE TABLE IF NOT EXISTS "admins" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "phone" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "name" TEXT,
  "role" TEXT (20) DEFAULT 'manager' NOT NULL,
  "totp_secret" TEXT,
  "totp_enabled" INTEGER DEFAULT 0 NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE ("phone")
);

CREATE TABLE IF NOT EXISTS "auction_demand" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "code" TEXT (16) NOT NULL,
  "status" TEXT (20) DEFAULT 'collecting' NOT NULL,
  "suggested_start_price" INTEGER DEFAULT 250000 NOT NULL,
  "suggested_min_step" INTEGER DEFAULT 25000 NOT NULL,
  "interest_count" INTEGER DEFAULT 0 NOT NULL,
  "auction_id" INTEGER,
  "notified_ready_at" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE ("code"),
  FOREIGN KEY ("auction_id") REFERENCES "auctions" ("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "auction_demand_votes" (
  "demand_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("demand_id", "user_id"),
  FOREIGN KEY ("demand_id") REFERENCES "auction_demand" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "auction_requests" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "user_id" INTEGER NOT NULL,
  "code" TEXT (16) NOT NULL,
  "note" TEXT,
  "status" TEXT (20) DEFAULT 'pending' NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "auctions" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "code" TEXT (16) NOT NULL,
  "seller_id" INTEGER,
  "start_price" INTEGER NOT NULL,
  "buy_now_price" INTEGER,
  "current_price" INTEGER NOT NULL,
  "highest_bidder_id" INTEGER,
  "ends_at" TEXT NOT NULL,
  "status" TEXT (20) DEFAULT 'active' NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "payment_deadline" TEXT,
  "seller_payout_amount" INTEGER,
  "seller_payout_status" TEXT (20) DEFAULT 'none' NOT NULL,
  "seller_payme_number" TEXT,
  "created_by_admin" INTEGER DEFAULT 1 NOT NULL,
  "min_increment" INTEGER DEFAULT 25000 NOT NULL,
  FOREIGN KEY ("seller_id") REFERENCES "users" ("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "bids" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "auction_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "amount" INTEGER NOT NULL,
  "released" INTEGER DEFAULT 0 NOT NULL,
  "idempotency_key" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE ("idempotency_key"),
  FOREIGN KEY ("auction_id") REFERENCES "auctions" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "blocked_users" (
  "blocker_id" INTEGER NOT NULL,
  "blocked_id" INTEGER NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("blocker_id", "blocked_id"),
  FOREIGN KEY ("blocked_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("blocker_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "bot_orders" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "tg_user_id" INTEGER NOT NULL,
  "tg_username" TEXT,
  "tg_name" TEXT,
  "code" TEXT (16) NOT NULL,
  "price" INTEGER NOT NULL,
  "status" TEXT (20) DEFAULT 'pending' NOT NULL,
  "screenshot_file_id" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "source" TEXT (20) DEFAULT 'bot' NOT NULL,
  "user_id" INTEGER,
  "record_data" TEXT,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id")
);

CREATE TABLE IF NOT EXISTS "bot_verifications" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "phone" TEXT NOT NULL,
  "tg_user_id" INTEGER NOT NULL,
  "tg_name" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE ("phone")
);

CREATE TABLE IF NOT EXISTS "card_events" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "code" TEXT (16) NOT NULL,
  "event_type" TEXT (24) NOT NULL,
  "ref" TEXT,
  "visitor_hash" TEXT (64),
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "card_files" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "code" TEXT (16) NOT NULL,
  "title" TEXT NOT NULL,
  "file_url" TEXT NOT NULL,
  "size_bytes" INTEGER,
  "sort" INTEGER DEFAULT 0 NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "card_gallery" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "code" TEXT (16) NOT NULL,
  "image_url" TEXT NOT NULL,
  "caption" TEXT,
  "sort" INTEGER DEFAULT 0 NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "card_leads" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "code" TEXT (16) NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "telegram" TEXT,
  "whatsapp" TEXT,
  "email" TEXT,
  "company" TEXT,
  "note" TEXT,
  "visitor_hash" TEXT (64),
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "card_likes" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "code" TEXT (16) NOT NULL,
  "user_id" INTEGER NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE ("code", "user_id"),
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "card_team" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "code" TEXT (16) NOT NULL,
  "name" TEXT NOT NULL,
  "position" TEXT,
  "photo_url" TEXT,
  "member_code" TEXT (16),
  "sort" INTEGER DEFAULT 0 NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "card_videos" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "code" TEXT (16) NOT NULL,
  "video_url" TEXT NOT NULL,
  "thumb_url" TEXT,
  "title" TEXT,
  "size_bytes" INTEGER,
  "sort" INTEGER DEFAULT 0 NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "cards" (
  "code" TEXT (16) NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT,
  "avatar_url" TEXT,
  "tg" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "linkedin" TEXT,
  "instagram" TEXT,
  "hashtags" TEXT DEFAULT '[]' NOT NULL,
  "price" INTEGER NOT NULL,
  "ts" INTEGER NOT NULL,
  "views" INTEGER DEFAULT 0 NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "user_id" INTEGER,
  "about" TEXT,
  "facebook" TEXT,
  "twitter" TEXT,
  "website" TEXT,
  "card_number" TEXT,
  "theme" TEXT (20) DEFAULT 'classic' NOT NULL,
  "for_sale" INTEGER DEFAULT 0 NOT NULL,
  "sale_price" INTEGER,
  "extra_links" TEXT DEFAULT '[]' NOT NULL,
  "card_numbers" TEXT DEFAULT '[]' NOT NULL,
  "status" TEXT (20) DEFAULT 'pending' NOT NULL,
  "bg_url" TEXT,
  "bg_pattern" INTEGER DEFAULT 1 NOT NULL,
  "accent_color" TEXT,
  "bg_color" TEXT,
  "bg_animated" INTEGER DEFAULT 1 NOT NULL,
  "music_url" TEXT,
  "is_primary" INTEGER DEFAULT 0 NOT NULL,
  "giftable" INTEGER DEFAULT 1 NOT NULL,
  "hide_phone" INTEGER DEFAULT 0 NOT NULL,
  "tier_override" TEXT (12),
  "links_transparent" INTEGER DEFAULT 0 NOT NULL,
  "card_design" TEXT,
  "link_style" TEXT (12) DEFAULT 'standard' NOT NULL,
  "profile_type" TEXT (12) DEFAULT 'personal' NOT NULL,
  "city" TEXT,
  "hidden_from_directory" INTEGER DEFAULT 0 NOT NULL,
  "category_slug" TEXT (60),
  "lead_capture" INTEGER DEFAULT 0 NOT NULL,
  "verified" INTEGER DEFAULT 0 NOT NULL,
  "address" TEXT,
  "latitude" REAL,
  "longitude" REAL,
  PRIMARY KEY ("code"),
  FOREIGN KEY ("user_id") REFERENCES "users" ("id")
);

CREATE TABLE IF NOT EXISTS "categories" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "slug" TEXT (60) NOT NULL,
  "parent_slug" TEXT (60),
  "name_uz" TEXT NOT NULL,
  "name_ru" TEXT DEFAULT '' NOT NULL,
  "name_en" TEXT DEFAULT '' NOT NULL,
  "sort" INTEGER DEFAULT 0 NOT NULL,
  "enabled" INTEGER DEFAULT 1 NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE ("slug")
);

CREATE TABLE IF NOT EXISTS "conversations" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "user_a_id" INTEGER NOT NULL,
  "user_b_id" INTEGER NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE ("user_a_id", "user_b_id"),
  FOREIGN KEY ("user_a_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("user_b_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  CHECK ((user_a_id < user_b_id))
);

CREATE TABLE IF NOT EXISTS "finance_bank_actuals" (
  "period" TEXT (7) NOT NULL,
  "actual_amount" INTEGER DEFAULT 0 NOT NULL,
  "note" TEXT,
  "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("period")
);

CREATE TABLE IF NOT EXISTS "finance_docs" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL,
  "doc_type" TEXT (16) DEFAULT 'other' NOT NULL,
  "period" TEXT (16),
  "url" TEXT NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "finance_expenses" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT (24) DEFAULT 'other' NOT NULL,
  "amount" INTEGER NOT NULL,
  "spent_on" TEXT NOT NULL,
  "note" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "finance_rates" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "scope" TEXT (12) NOT NULL,
  "params" TEXT DEFAULT '{}' NOT NULL,
  "effective_from" TEXT NOT NULL,
  "note" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "follows" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "follower_id" INTEGER NOT NULL,
  "followee_id" INTEGER NOT NULL,
  "paid" INTEGER DEFAULT 0 NOT NULL,
  "amount" INTEGER DEFAULT 0 NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE ("follower_id", "followee_id"),
  FOREIGN KEY ("followee_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("follower_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "gift_offers" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "code" TEXT (16) NOT NULL,
  "from_user_id" INTEGER NOT NULL,
  "to_user_id" INTEGER NOT NULL,
  "status" TEXT (20) DEFAULT 'pending' NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "decided_at" TEXT,
  FOREIGN KEY ("from_user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("to_user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "menu_categories" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "code" TEXT (16) NOT NULL,
  "name" TEXT NOT NULL,
  "sort" INTEGER DEFAULT 0 NOT NULL,
  "enabled" INTEGER DEFAULT 1 NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "menu_items" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "code" TEXT (16) NOT NULL,
  "category_id" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price" INTEGER,
  "discount_price" INTEGER,
  "image_url" TEXT,
  "available" INTEGER DEFAULT 1 NOT NULL,
  "featured" INTEGER DEFAULT 0 NOT NULL,
  "sort" INTEGER DEFAULT 0 NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY ("category_id") REFERENCES "menu_categories" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "messages" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "conversation_id" INTEGER NOT NULL,
  "sender_id" INTEGER NOT NULL,
  "body" TEXT NOT NULL,
  "is_read" INTEGER DEFAULT 0 NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("sender_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "news" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT DEFAULT '' NOT NULL,
  "image_url" TEXT DEFAULT '' NOT NULL,
  "published" INTEGER DEFAULT 1 NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "title_ru" TEXT DEFAULT '' NOT NULL,
  "title_en" TEXT DEFAULT '' NOT NULL,
  "body_ru" TEXT DEFAULT '' NOT NULL,
  "body_en" TEXT DEFAULT '' NOT NULL,
  "views" INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "news_likes" (
  "news_id" INTEGER NOT NULL,
  "visitor_hash" TEXT (64) NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("news_id", "visitor_hash"),
  FOREIGN KEY ("news_id") REFERENCES "news" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "nfc_gifts" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "code" TEXT (16) NOT NULL,
  "recipient_name" TEXT,
  "note" TEXT,
  "activation_code" TEXT (20) NOT NULL,
  "status" TEXT (20) DEFAULT 'reserved' NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "activated_at" TEXT,
  "activated_by_user_id" INTEGER,
  "value" INTEGER,
  UNIQUE ("activation_code"),
  UNIQUE ("code"),
  FOREIGN KEY ("activated_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "password_reset_codes" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "user_id" INTEGER NOT NULL,
  "code" TEXT (6) NOT NULL,
  "expires_at" TEXT NOT NULL,
  "used" INTEGER DEFAULT 0 NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "phone_otp_codes" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "phone" TEXT (32) NOT NULL,
  "code" TEXT (6) NOT NULL,
  "purpose" TEXT (20) DEFAULT 'register' NOT NULL,
  "expires_at" TEXT NOT NULL,
  "used" INTEGER DEFAULT 0 NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "physical_cards" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "chip_token" TEXT NOT NULL,
  "linked_code" TEXT (16),
  "owner_user_id" INTEGER,
  "active" INTEGER DEFAULT 1 NOT NULL,
  "shipping_name" TEXT,
  "shipping_phone" TEXT,
  "shipping_address" TEXT,
  "status" TEXT (20) DEFAULT 'pending' NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "blocked_by_owner" INTEGER DEFAULT 0 NOT NULL,
  UNIQUE ("chip_token"),
  FOREIGN KEY ("linked_code") REFERENCES "cards" ("code") ON DELETE SET NULL,
  FOREIGN KEY ("owner_user_id") REFERENCES "users" ("id")
);

CREATE TABLE IF NOT EXISTS "platform_wallet" (
  "id" INTEGER PRIMARY KEY DEFAULT 1 NOT NULL,
  "balance" INTEGER DEFAULT 0 NOT NULL,
  CHECK ((id = 1))
);

CREATE TABLE IF NOT EXISTS "post_likes" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "post_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE ("post_id", "user_id"),
  FOREIGN KEY ("post_id") REFERENCES "posts" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "posts" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "code" TEXT (16) NOT NULL,
  "user_id" INTEGER,
  "image_url" TEXT,
  "caption" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "video_url" TEXT,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "premium_requests" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "user_id" INTEGER NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" TEXT (20) DEFAULT 'pending' NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "decided_at" TEXT,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "product_categories" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "code" TEXT (16) NOT NULL,
  "name" TEXT NOT NULL,
  "sort" INTEGER DEFAULT 0 NOT NULL,
  "enabled" INTEGER DEFAULT 1 NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "products" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "code" TEXT (16) NOT NULL,
  "category_id" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price" INTEGER,
  "discount_price" INTEGER,
  "image_url" TEXT,
  "available" INTEGER DEFAULT 1 NOT NULL,
  "featured" INTEGER DEFAULT 0 NOT NULL,
  "sort" INTEGER DEFAULT 0 NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY ("category_id") REFERENCES "product_categories" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "referral_uses" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "referrer_id" INTEGER NOT NULL,
  "referred_id" INTEGER NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY ("referred_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("referrer_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "service_categories" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "code" TEXT (16) NOT NULL,
  "name" TEXT NOT NULL,
  "sort" INTEGER DEFAULT 0 NOT NULL,
  "enabled" INTEGER DEFAULT 1 NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "services" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "code" TEXT (16) NOT NULL,
  "category_id" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price" INTEGER,
  "price_type" TEXT (12) DEFAULT 'fixed' NOT NULL,
  "image_url" TEXT,
  "available" INTEGER DEFAULT 1 NOT NULL,
  "featured" INTEGER DEFAULT 0 NOT NULL,
  "sort" INTEGER DEFAULT 0 NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY ("category_id") REFERENCES "service_categories" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "token" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "expires_at" TEXT NOT NULL,
  PRIMARY KEY ("token"),
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "support_messages" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "user_id" INTEGER NOT NULL,
  "message" TEXT NOT NULL,
  "reply" TEXT,
  "status" TEXT (20) DEFAULT 'pending' NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "replied_at" TEXT,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "transactions" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "user_id" INTEGER,
  "amount" INTEGER NOT NULL,
  "kind" TEXT (30) NOT NULL,
  "ref_table" TEXT,
  "ref_id" INTEGER,
  "note" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "user_reports" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "reporter_id" INTEGER NOT NULL,
  "reported_id" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY ("reported_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("reporter_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "users" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "balance" INTEGER DEFAULT 0 NOT NULL,
  "held_balance" INTEGER DEFAULT 0 NOT NULL,
  "phone" TEXT,
  "bot_ack" INTEGER DEFAULT 0 NOT NULL,
  "is_premium" INTEGER DEFAULT 0 NOT NULL,
  "pending_payout" INTEGER DEFAULT 0 NOT NULL,
  "banned_until" TEXT,
  "strike_count" INTEGER DEFAULT 0 NOT NULL,
  "tos_accepted" INTEGER DEFAULT 0 NOT NULL,
  "is_test" INTEGER DEFAULT 0 NOT NULL,
  "promo_code" TEXT (12),
  "pending_discount_pct" INTEGER DEFAULT 0 NOT NULL,
  "suspended_until" TEXT,
  "suspend_reason" TEXT,
  "deleted_at" TEXT,
  UNIQUE ("email"),
  UNIQUE ("promo_code")
);

CREATE TABLE IF NOT EXISTS "wallet_topups" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "user_id" INTEGER NOT NULL,
  "amount" INTEGER NOT NULL,
  "payme_transaction_id" TEXT,
  "status" TEXT (20) DEFAULT 'pending' NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE ("payme_transaction_id"),
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "web_orders" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "user_id" INTEGER NOT NULL,
  "code" TEXT (40) NOT NULL,
  "price" INTEGER NOT NULL,
  "payload" TEXT NOT NULL,
  "status" TEXT (20) DEFAULT 'pending' NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "kind" TEXT (24) DEFAULT 'card_purchase' NOT NULL,
  "payme_transaction_id" TEXT,
  UNIQUE ("payme_transaction_id"),
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "auction_demand_status_idx" ON "auction_demand" ("status", "interest_count" DESC);

CREATE INDEX IF NOT EXISTS "auction_requests_status_idx" ON "auction_requests" ("status");

CREATE INDEX IF NOT EXISTS "auctions_code_idx" ON "auctions" ("code");

CREATE INDEX IF NOT EXISTS "auctions_status_idx" ON "auctions" ("status", "ends_at");

CREATE INDEX IF NOT EXISTS "bids_auction_idx" ON "bids" ("auction_id");

CREATE INDEX IF NOT EXISTS "bids_user_idx" ON "bids" ("user_id");

CREATE INDEX IF NOT EXISTS "bot_orders_code_idx" ON "bot_orders" ("code");

CREATE INDEX IF NOT EXISTS "bot_orders_user_idx" ON "bot_orders" ("tg_user_id");

CREATE INDEX IF NOT EXISTS "card_events_code_time_idx" ON "card_events" ("code", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "card_files_code_idx" ON "card_files" ("code", "sort");

CREATE INDEX IF NOT EXISTS "card_gallery_code_idx" ON "card_gallery" ("code", "sort");

CREATE INDEX IF NOT EXISTS "card_leads_code_time_idx" ON "card_leads" ("code", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "card_likes_code_idx" ON "card_likes" ("code");

CREATE INDEX IF NOT EXISTS "card_team_code_idx" ON "card_team" ("code", "sort");

CREATE INDEX IF NOT EXISTS "card_videos_code_idx" ON "card_videos" ("code", "sort");

CREATE INDEX IF NOT EXISTS "cards_city_trgm_idx" ON "cards" (LOWER("city"));

CREATE INDEX IF NOT EXISTS "cards_name_trgm_idx" ON "cards" (LOWER("name"));

CREATE INDEX IF NOT EXISTS "cards_ts_idx" ON "cards" ("ts" DESC);

CREATE INDEX IF NOT EXISTS "categories_parent_idx" ON "categories" ("parent_slug");

CREATE INDEX IF NOT EXISTS "finance_expenses_date_idx" ON "finance_expenses" ("spent_on" DESC);

CREATE INDEX IF NOT EXISTS "finance_rates_scope_idx" ON "finance_rates" ("scope", "effective_from" DESC);

CREATE INDEX IF NOT EXISTS "follows_followee_idx" ON "follows" ("followee_id");

CREATE INDEX IF NOT EXISTS "follows_follower_idx" ON "follows" ("follower_id");

CREATE INDEX IF NOT EXISTS "gift_offers_to_idx" ON "gift_offers" ("to_user_id", "status");

CREATE INDEX IF NOT EXISTS "menu_categories_code_idx" ON "menu_categories" ("code", "sort");

CREATE INDEX IF NOT EXISTS "menu_items_code_idx" ON "menu_items" ("code", "category_id", "sort");

CREATE INDEX IF NOT EXISTS "menu_items_name_trgm_idx" ON "menu_items" (LOWER("name"));

CREATE INDEX IF NOT EXISTS "messages_conv_idx" ON "messages" ("conversation_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "messages_unread_idx" ON "messages" ("conversation_id") WHERE "is_read" = 0;

CREATE INDEX IF NOT EXISTS "phone_otp_codes_lookup_idx" ON "phone_otp_codes" ("phone", "purpose", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "physical_cards_code_idx" ON "physical_cards" ("linked_code");

CREATE INDEX IF NOT EXISTS "physical_cards_owner_idx" ON "physical_cards" ("owner_user_id");

CREATE INDEX IF NOT EXISTS "posts_code_idx" ON "posts" ("code", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "premium_requests_status_idx" ON "premium_requests" ("status");

CREATE INDEX IF NOT EXISTS "product_categories_code_idx" ON "product_categories" ("code", "sort");

CREATE INDEX IF NOT EXISTS "products_code_idx" ON "products" ("code", "category_id", "sort");

CREATE INDEX IF NOT EXISTS "products_name_trgm_idx" ON "products" (LOWER("name"));

CREATE INDEX IF NOT EXISTS "service_categories_code_idx" ON "service_categories" ("code", "sort");

CREATE INDEX IF NOT EXISTS "services_code_idx" ON "services" ("code", "category_id", "sort");

CREATE INDEX IF NOT EXISTS "services_name_trgm_idx" ON "services" (LOWER("name"));

CREATE INDEX IF NOT EXISTS "support_messages_status_idx" ON "support_messages" ("status");

CREATE INDEX IF NOT EXISTS "transactions_kind_idx" ON "transactions" ("kind", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "transactions_user_idx" ON "transactions" ("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "wallet_topups_user_idx" ON "wallet_topups" ("user_id");

CREATE INDEX IF NOT EXISTS "web_orders_code_idx" ON "web_orders" ("code");

CREATE INDEX IF NOT EXISTS "web_orders_user_idx" ON "web_orders" ("user_id");

CREATE TABLE IF NOT EXISTS "catalog_item_reactions" ("code" TEXT NOT NULL, "module" TEXT NOT NULL, "item_id" TEXT NOT NULL, "visitor_key" TEXT NOT NULL, "reaction" TEXT NOT NULL CHECK ("reaction" IN ('like', 'dislike')), "created_at" TEXT NOT NULL, "updated_at" TEXT NOT NULL, PRIMARY KEY ("code", "module", "item_id", "visitor_key"));

CREATE INDEX IF NOT EXISTS "idx_catalog_reactions_item" ON "catalog_item_reactions" ("code", "module", "item_id");

CREATE TABLE IF NOT EXISTS "catalog_item_views" ("code" TEXT NOT NULL, "module" TEXT NOT NULL, "item_id" TEXT NOT NULL, "visitor_key" TEXT NOT NULL, "view_day" TEXT NOT NULL, "created_at" TEXT NOT NULL, PRIMARY KEY ("code", "module", "item_id", "visitor_key", "view_day"));

CREATE INDEX IF NOT EXISTS "idx_catalog_views_item" ON "catalog_item_views" ("code", "module", "item_id");

CREATE TABLE IF NOT EXISTS "catalog_promotions" ("code" TEXT NOT NULL, "module" TEXT NOT NULL, "item_id" TEXT NOT NULL, "old_price" INTEGER NOT NULL, "new_price" INTEGER NOT NULL, "starts_at" TEXT NOT NULL, "ends_at" TEXT NOT NULL, "active" INTEGER NOT NULL DEFAULT 1, "updated_by" TEXT, "updated_at" TEXT NOT NULL, PRIMARY KEY ("code", "module", "item_id"));

CREATE INDEX IF NOT EXISTS "idx_catalog_promotions_active" ON "catalog_promotions" ("code", "module", "active", "ends_at");

CREATE TABLE IF NOT EXISTS "companies" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "company_id" TEXT NOT NULL UNIQUE, "owner_user_id" TEXT NOT NULL, "owner_email" TEXT, "display_name" TEXT NOT NULL, "category" TEXT NOT NULL DEFAULT 'other', "subcategory" TEXT, "city" TEXT, "address" TEXT, "description" TEXT, "phone" TEXT, "telegram" TEXT, "whatsapp" TEXT, "website" TEXT, "logo_url" TEXT, "cover_url" TEXT, "gallery_json" TEXT NOT NULL DEFAULT '[]', "source_card_code" TEXT, "tier" TEXT NOT NULL, "price" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'draft', "admin_note" TEXT, "rejected_reason" TEXT, "created_at" TEXT NOT NULL, "updated_at" TEXT NOT NULL, "approved_at" TEXT, "paid_at" TEXT, "activated_at" TEXT);

CREATE INDEX IF NOT EXISTS "idx_companies_owner" ON "companies" ("owner_user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_companies_status" ON "companies" ("status", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "company_catalog_items" ("id" TEXT PRIMARY KEY, "company_id" TEXT NOT NULL, "name" TEXT NOT NULL, "category" TEXT, "description" TEXT, "price" INTEGER NOT NULL DEFAULT 0, "promotion_price" INTEGER, "image_url" TEXT, "available" INTEGER NOT NULL DEFAULT 1, "sort_order" INTEGER NOT NULL DEFAULT 0, "created_at" TEXT NOT NULL, "updated_at" TEXT NOT NULL, FOREIGN KEY ("company_id") REFERENCES "companies" ("company_id") ON DELETE CASCADE);

CREATE INDEX IF NOT EXISTS "idx_company_items_company" ON "company_catalog_items" ("company_id", "sort_order", "created_at");

CREATE TABLE IF NOT EXISTS "company_id_rules" ("company_id" TEXT PRIMARY KEY, "rule" TEXT NOT NULL DEFAULT 'reserved', "tier_override" TEXT, "price_override" INTEGER, "note" TEXT, "updated_by" TEXT, "updated_at" TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS "company_status_log" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "company_id" TEXT NOT NULL, "from_status" TEXT, "to_status" TEXT NOT NULL, "actor" TEXT, "note" TEXT, "created_at" TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS "company_payments" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "company_id" TEXT NOT NULL, "owner_user_id" TEXT NOT NULL, "amount" INTEGER NOT NULL, "provider" TEXT NOT NULL DEFAULT 'payme', "upstream_order_id" TEXT, "status" TEXT NOT NULL DEFAULT 'pending', "created_at" TEXT NOT NULL, "updated_at" TEXT NOT NULL);
