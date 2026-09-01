CREATE TABLE IF NOT EXISTS catalog_item_reactions (
  code TEXT NOT NULL,
  module TEXT NOT NULL,
  item_id TEXT NOT NULL,
  visitor_key TEXT NOT NULL,
  reaction TEXT NOT NULL CHECK (reaction IN ('like', 'dislike')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (code, module, item_id, visitor_key)
);

CREATE INDEX IF NOT EXISTS idx_catalog_reactions_item
ON catalog_item_reactions(code, module, item_id);

CREATE TABLE IF NOT EXISTS catalog_item_views (
  code TEXT NOT NULL,
  module TEXT NOT NULL,
  item_id TEXT NOT NULL,
  visitor_key TEXT NOT NULL,
  view_day TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (code, module, item_id, visitor_key, view_day)
);

CREATE INDEX IF NOT EXISTS idx_catalog_views_item
ON catalog_item_views(code, module, item_id);

CREATE TABLE IF NOT EXISTS catalog_promotions (
  code TEXT NOT NULL,
  module TEXT NOT NULL,
  item_id TEXT NOT NULL,
  old_price INTEGER NOT NULL,
  new_price INTEGER NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (code, module, item_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_promotions_active
ON catalog_promotions(code, module, active, ends_at);

PRAGMA optimize;
