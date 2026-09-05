/**
 * NFC ID tier/pricing classifier — ported 1:1 from src/lib/pricing.js (web
 * app). This is a **display/preview helper only**. The Worker
 * (`hosting/worker.js` → `personalPurchaseQuote`) is the sole authority for
 * the real purchase price — see android/docs/02-API_MAP.md §2.2. Never wire
 * a real order to a value computed here.
 */
import { codeTierOverride, type TierKey } from './codeTiers';

export const BLOCKED_PREFIXES = ['GOD'];
export function isBlockedCode(raw: string): boolean {
  const c = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return BLOCKED_PREFIXES.some((p) => c.startsWith(p));
}

export const FREE_AUTO_ID_RE = /^[0-9]{8}$/;

export function isPurchasableCode(raw: string): boolean {
  const c = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!c) return false;
  if (isBlockedCode(c)) return false;
  if (FREE_AUTO_ID_RE.test(c)) return false;
  return true;
}

export interface ParsedCode {
  code: string;
  letters: string;
  digits: string;
}

export function parseCode(raw: string): ParsedCode | null {
  const c = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length !== 6) return null;
  if (isBlockedCode(c)) return null;
  const letters = c.slice(0, 3);
  const digits = c.slice(3, 6);
  if (!/^[A-Z]{3}$/.test(letters) || !/^[0-9]{3}$/.test(digits)) return null;
  return { code: c, letters, digits };
}

export function parseAnyCode(raw: string): { code: string } | ParsedCode | null {
  const clean = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return null;
  if (isBlockedCode(clean)) return null;
  if (/^[0-9]{8}$/.test(clean)) return { code: clean };
  return parseCode(clean);
}

const EXCLUSIVE_WORDS = ['VIP', 'CEO', 'KNG', 'LEG', 'ROY', 'ACE', 'WIN', 'UZB', 'LUX'];

const PREMIUM_WORDS = [
  'BMW', 'AMG', 'GTR', 'AUD', 'GTI', 'GTS', 'EVO', 'RSQ', 'SUV', 'CAR',
  'KIA', 'BYD', 'RRS', 'LMB', 'TSL', 'PRS', 'MRX',
  'BOS', 'TOP', 'PRO', 'MAX', 'BIG', 'ONE', 'MBA', 'DEV', 'DOC', 'LAW',
  'ART', 'FIT', 'GYM', 'BIZ', 'DJX', 'BND',
  'TAS', 'SAM', 'BUX', 'AND', 'NAV', 'FER', 'XIV', 'NUK', 'JIZ', 'QAR',
  'TER', 'URG', 'NMG',
  'ALI', 'AZI', 'JAS', 'BOB', 'SAR', 'SHO', 'TIM', 'UMR', 'MIR',
  'SHX', 'BEK', 'ABR', 'ODI', 'RUS', 'ISL', 'KAM', 'NOD', 'OYB', 'SUX',
  'FUR', 'ELY', 'DIY', 'HAS', 'HUS', 'ZAF', 'AKM', 'BAX', 'JAV', 'SHR',
  'AZM', 'FAR', 'TOX', 'ULU', 'XON', 'OTA', 'IBR', 'SUL', 'NUR',
  'DIL', 'NIL', 'ZAR', 'NOZ', 'MAL', 'LAY', 'MAD', 'GUL', 'SEV', 'MOX',
  'LOB', 'IRO', 'MUX', 'SHA', 'ZUL', 'FOT', 'OYS', 'NAF', 'RAY', 'MEH',
  'KOM', 'NIG', 'MAR', 'MAH', 'XUR',
  'SKY', 'SUN', 'FLY', 'JET', 'ICE', 'RED', 'FOX', 'GEM', 'ZEN', 'NEO',
  'PAY', 'STA', 'USD', 'UZS',
];

const GOV_WORDS = [
  'IIB', 'DXX', 'MXX', 'DAV', 'YHX', 'YPX', 'GAI', 'FVV', 'DBX', 'DSX',
  'DSI', 'ADL', 'SUD', 'PRK', 'TIV', 'MUD', 'HKM', 'VZR', 'BOJ', 'GUV',
];

function allSame3(s: string) {
  return s[0] === s[1] && s[1] === s[2];
}
function hasAdjacentPair(s: string) {
  return s[0] === s[1] || s[1] === s[2];
}
function isZeroSuperDigit(d: string) {
  return d === '001' || d === '007' || d === '077';
}
const EXTRA_SUPER_DIGITS = ['711', '712', '771', '772'];
function isExtraSuperDigit(d: string) {
  return EXTRA_SUPER_DIGITS.includes(d);
}
function isMirrorDigit(d: string) {
  return d[0] === d[2] && d !== '000';
}
function isX0X(d: string) {
  return d[1] === '0' && d[0] === d[2] && d[0] !== '0';
}
function isGovPremiumDigit(d: string) {
  return d === '001' || d === '007' || d === '077' || d === '707' || d === '010' || isExtraSuperDigit(d);
}
function isSuperDigit(d: string) {
  if (isZeroSuperDigit(d)) return true;
  if (allSame3(d) && d !== '000') return true;
  if (isX0X(d)) return true;
  if (isExtraSuperDigit(d)) return true;
  return false;
}

export function tierFromCode(letters: string, digits: string): TierKey {
  const lettersAllSame = allSame3(letters);
  const digitsAllSame = allSame3(digits);
  const exclusiveWord = EXCLUSIVE_WORDS.includes(letters);
  const premiumWord = PREMIUM_WORDS.includes(letters);
  const govWord = GOV_WORDS.includes(letters);

  if (lettersAllSame && digitsAllSame) return 'exclusive';
  if (exclusiveWord) return 'exclusive';

  if (digits === '000') return 'premium';
  if (govWord && isGovPremiumDigit(digits)) return 'premium';
  if (premiumWord && isSuperDigit(digits)) return 'premium';

  if (premiumWord) return 'gold';
  if (govWord) return 'gold';
  if (lettersAllSame || digitsAllSame) return 'gold';
  if (isZeroSuperDigit(digits)) return 'gold';

  if (isMirrorDigit(digits)) return 'silver';
  if (hasAdjacentPair(letters) && hasAdjacentPair(digits)) return 'silver';

  return 'free';
}

export function tierForCode(code: string): TierKey {
  const c = String(code || '').toUpperCase();
  const ov = codeTierOverride(c);
  if (ov) return ov;
  if (/^[A-Z]{3,12}$/.test(c)) return 'exclusive';
  if (c.length !== 6) return 'free';
  return tierFromCode(c.slice(0, 3), c.slice(3, 6));
}

export const TIER_PRICE: Record<TierKey, number | null> = {
  exclusive: null,
  premium: 199000,
  gold: 149000,
  silver: 99000,
  free: 49000,
};

export const PROFILE_PREMIUM_FEE = 20000;

export const TIER_LABEL: Record<TierKey, string> = {
  exclusive: 'Ekslyuziv',
  premium: 'Premium',
  gold: 'Gold',
  silver: 'Silver',
  free: 'Bronza',
};

export const TIER_COLOR: Record<TierKey, string> = {
  exclusive: '#d4af37',
  premium: '#d8a34a',
  gold: '#f0c419',
  silver: '#9aa3ad',
  free: '#C58A55',
};

export function priceForCode(code: string): { total: number; tier: TierKey; override?: boolean } {
  const c = String(code || '').toUpperCase();
  const ov = codeTierOverride(c);
  if (ov) return { total: TIER_PRICE[ov] ?? 0, tier: ov, override: true };
  const parsed = c.length === 6 ? c : '';
  const tier = parsed ? tierFromCode(c.slice(0, 3), c.slice(3, 6)) : tierForCode(c);
  return { total: TIER_PRICE[tier] ?? 0, tier };
}

export type PurchaseQuote =
  | { purchasable: false; reason: 'not_purchasable' }
  | { purchasable: false; reason: 'exclusive_auction_only'; tier: 'exclusive' }
  | { purchasable: true; tier: Exclude<TierKey, 'exclusive'>; amount: number };

/**
 * Local preview-only quote — mirrors src/lib/pricing.js `getPersonalPurchaseQuote`.
 * The real, safe purchase entrypoint is always the server (POST /api/records/:code) —
 * see android/docs/02-API_MAP.md §2.2. This function must never be used to decide
 * how much to actually charge; it only drives the pre-purchase UI preview.
 */
export function getPersonalPurchaseQuote(rawCode: string): PurchaseQuote {
  const parsed = parseCode(rawCode);
  if (!parsed) return { purchasable: false, reason: 'not_purchasable' };
  if (!isPurchasableCode(parsed.code)) return { purchasable: false, reason: 'not_purchasable' };
  const { tier } = priceForCode(parsed.code);
  if (tier === 'exclusive') return { purchasable: false, reason: 'exclusive_auction_only', tier };
  const amount = TIER_PRICE[tier];
  if (amount == null) return { purchasable: false, reason: 'not_purchasable' };
  return { purchasable: true, tier, amount };
}
