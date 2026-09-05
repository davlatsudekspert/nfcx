/**
 * Per-code manual tier overrides — ported 1:1 from src/lib/codeTiers.js
 * (web app). See android/docs/01-AUDIT.md §1.5: this must never drift from
 * the web app's list, and the *server* (hosting/worker.js `personalPurchaseQuote`)
 * remains the authority for the actual purchase price — this is a display/
 * preview helper only.
 */
export type TierKey = 'exclusive' | 'premium' | 'gold' | 'silver' | 'free';

const AUCTION_CODES = [
  'AAA001', 'AAA007', 'OOO001', 'OOO007', 'JJJ007', 'DDD001', 'DDD007', 'FFF007',
  'BEK001', 'BEK007', 'BEK777', 'UZB000', 'UZB001', 'UZB007', 'UAE001', 'USD100',
  'ABC123', 'DEV001', 'GEM001', 'UNO000', 'WOW013', 'ASL777', 'AGA777', 'KHU777',
  'ISA777', 'FAY777', 'USS777', 'OZZ777', 'PZP777', 'PLT034', 'RMA007', 'FCB010',
  'AMG063', 'CLS063',
];

const PREMIUM_CODES = [
  'AAA100', 'AAA701', 'AAA717', 'AAA097', 'AAA066', 'ZZZ717', 'ZZZ727', 'ZZZ005',
  'OOO005', 'OOO013', 'EMR777', 'GRL999', 'GRL444', 'GRL555', 'GRL777', 'GRL888',
  'GRL333', 'GRL222', 'AZU555', 'TEN444', 'KAP444', 'DYR444', 'AKL444', 'ACA666',
  'PBP888', 'SKB888', 'GIO111', 'WEF111', 'ETS111', 'SZZ222', 'BOY222', 'MLN222',
  'GGG200', 'VVV700', 'NMX700', 'ZOO700', 'GRL700', 'BMW010',
];

const EXACT_PREMIUM_CODES = [
  'KHB029', 'UFC229', 'UFC300', 'UFC205', 'UFC194', 'UFC100', 'UFC200', 'UFC254',
  'MMA029', 'MMA300', 'KHB254', 'CON013', 'CON205', 'CON194',
];

export const CODE_TIERS: Record<string, TierKey> = {};
for (const c of AUCTION_CODES) CODE_TIERS[c] = 'exclusive';
for (const c of PREMIUM_CODES) CODE_TIERS[c] = 'premium';
for (const c of EXACT_PREMIUM_CODES) CODE_TIERS[c] = 'premium';

export function codeTierOverride(code: string): TierKey | null {
  const c = String(code || '').toUpperCase();
  return Object.prototype.hasOwnProperty.call(CODE_TIERS, c) ? CODE_TIERS[c] : null;
}
