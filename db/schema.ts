// NFCSTORE Sites/D1 schema. Runtime initialization in hosting/worker.js uses
// the same statements so a fresh deployment is immediately usable.
export const catalogSchema = {
  reactions: `CREATE TABLE IF NOT EXISTS catalog_item_reactions (
    code TEXT NOT NULL,
    module TEXT NOT NULL,
    item_id TEXT NOT NULL,
    visitor_key TEXT NOT NULL,
    reaction TEXT NOT NULL CHECK (reaction IN ('like', 'dislike')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (code, module, item_id, visitor_key)
  )`,
  views: `CREATE TABLE IF NOT EXISTS catalog_item_views (
    code TEXT NOT NULL,
    module TEXT NOT NULL,
    item_id TEXT NOT NULL,
    visitor_key TEXT NOT NULL,
    view_day TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (code, module, item_id, visitor_key, view_day)
  )`,
  promotions: `CREATE TABLE IF NOT EXISTS catalog_promotions (
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
  )`,
};
