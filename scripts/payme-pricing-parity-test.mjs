// Payme Phase 2A — pricing parity test.
//
// hosting/worker.js keeps a self-contained COPY of src/lib/pricing.js's
// tier/price logic (personalPriceForCode/isPersonalCodePurchasable —
// see the comment above them for why this isn't a cross-file import).
// This script is the safety net for that duplication: it runs the SAME
// set of NFC ID codes through both the real source (src/lib/pricing.js +
// src/lib/codeTiers.js) and the Worker-side copy, and fails loudly the
// moment they disagree. Run after ANY change to either file:
//
//   node scripts/payme-pricing-parity-test.mjs
//
// Also covers the two other Payme Phase 2A guarantees:
//   - the 8-digit free-auto-ID shape is never purchasable (personal or
//     legacy server-side), and
//   - companyPricing() (Company ID — a different product) never overlaps
//     with personal NFC ID pricing.
import { priceForCode, isPurchasableCode, FREE_AUTO_ID_RE, getPersonalPurchaseQuote } from '../src/lib/pricing.js';
import { personalPriceForCode, isPersonalCodePurchasable, PERSONAL_TIER_PRICE, personalPurchaseQuote } from '../hosting/worker.js';

let pass = 0;
let fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(ok ? 'PASS' : 'FAIL', '-', label, ok ? '' : `\n    actual:   ${JSON.stringify(actual)}\n    expected: ${JSON.stringify(expected)}`);
  ok ? pass++ : fail++;
}

// ---------- 1) tier/price parity: real source vs Worker-side copy ----------
// A broad sample covering every tier, every special-word category, digit
// patterns, and the per-code override list (src/lib/codeTiers.js).
const SAMPLE_CODES = [
  // free / Bronza (no pattern match)
  'XYZ412', 'MXK114', 'ABC999',
  // silver (mirror digit / adjacent-pair-both)
  'LOL101', 'ABC292', 'ABB770', 'AAB114',
  // gold (premium/gov word + plain digit, all-same letters/digits, zero-super digit)
  'BMW412', 'ALI063', 'IIB412', 'MXK888', 'XYZ001',
  // premium (digits===000, gov+super-digit, premium-word+super-digit)
  'KLM000', 'IIB001', 'DXX707', 'BMW007', 'ALI777', 'TAS101',
  // exclusive (all-same letters+digits, exclusive word)
  'AAA777', 'QQQ000', 'VIP555', 'CEO001',
  // per-code overrides (src/lib/codeTiers.js)
  'AAA001', 'AAA100', 'UFC229', 'BMW010',
  // 8-digit free-auto-ID shape (must be blocked, not priced as a tier)
  '12345678', '87654321', '00000000',
];
for (const code of SAMPLE_CODES) {
  const real = priceForCode(code);
  const worker = personalPriceForCode(code);
  check(`priceForCode parity: ${code}`, worker, real);
}

// TIER_PRICE table parity (the constant itself, not just derived results).
check('TIER_PRICE table parity', PERSONAL_TIER_PRICE, { exclusive: null, premium: 199000, gold: 149000, silver: 99000, free: 49000 });

// ---------- 2) 8-digit free-auto-ID guard ----------
const FREE_ID_SAMPLES = ['12345678', '87654321', '00000001', '99999999'];
for (const code of FREE_ID_SAMPLES) {
  check(`isPurchasableCode blocks free-auto-ID ${code} (shared pricing.js)`, isPurchasableCode(code), false);
  check(`isPersonalCodePurchasable blocks free-auto-ID ${code} (worker copy)`, isPersonalCodePurchasable(code), false);
  check(`FREE_AUTO_ID_RE matches ${code}`, FREE_AUTO_ID_RE.test(code), true);
}
// A normal 6-char code must remain purchasable through both guards.
for (const code of ['XYZ412', 'BMW007', 'AAA777']) {
  check(`isPurchasableCode allows normal code ${code}`, isPurchasableCode(code), true);
  check(`isPersonalCodePurchasable allows normal code ${code}`, isPersonalCodePurchasable(code), true);
}
// Blocked prefix (GOD...) must never be purchasable either.
check('isPurchasableCode blocks GOD-prefixed code', isPurchasableCode('GOD123'), false);
check('isPersonalCodePurchasable blocks GOD-prefixed code', isPersonalCodePurchasable('GOD123'), false);

// ---------- 3) exclusive tier is priced as auction-only (never a direct-buy amount) ----------
// TIER_PRICE.exclusive is `null` (see src/lib/pricing.js), but priceForCode()
// coalesces it to `0` via `TIER_PRICE[tier] ?? 0` for its returned `.total` —
// that `0` is never actually charged: the purchase route (server/index.js)
// checks `tier === 'exclusive'` and returns 409 BEFORE this value is ever
// used as a real amount. This assertion just documents/locks in that shape
// so it stays consistent between the real source and the Worker copy.
for (const code of ['AAA777', 'VIP555', 'CEO001']) {
  check(`${code} is 'exclusive' tier`, priceForCode(code).tier, 'exclusive');
  check(`${code} exclusive tier's raw .total is the unused placeholder 0 (route must 409 before ever using it)`, priceForCode(code).total, 0);
}

// ---------- 4) companyPricing() must never collide with personal pricing ----------
// Company ID uses a totally different price list (349k/549k/749k/990k by
// ID length) — this only re-asserts that PERSONAL_TIER_PRICE hasn't been
// accidentally pointed at those numbers.
const COMPANY_PRICE_NUMBERS = [349000, 549000, 749000, 990000];
for (const [tier, price] of Object.entries(PERSONAL_TIER_PRICE)) {
  if (price == null) continue;
  check(`personal tier "${tier}" price (${price}) is not a company-pricing number`, COMPANY_PRICE_NUMBERS.includes(price), false);
}

// ---------- 5) safety entrypoint: getPersonalPurchaseQuote / personalPurchaseQuote ----------
// This is the "single safe entrypoint" any future Payme order-creation code
// must use — it must NEVER hand back a numeric 0 for something that isn't
// really purchasable (exclusive, 8-digit free-auto-ID, malformed code).
const QUOTE_CASES = [
  // 8-digit free-auto-ID -> blocked, not a tier/price question at all
  ['12345678', { purchasable: false, reason: 'not_purchasable' }],
  ['00000000', { purchasable: false, reason: 'not_purchasable' }],
  // blocked prefix
  ['GOD123', { purchasable: false, reason: 'not_purchasable' }],
  // malformed (not 6-char AAA000)
  ['AB12', { purchasable: false, reason: 'not_purchasable' }],
  ['TOOLONGCODE', { purchasable: false, reason: 'not_purchasable' }],
  // exclusive -> blocked with a named reason, NEVER a 0 amount
  ['AAA777', { purchasable: false, reason: 'exclusive_auction_only', tier: 'exclusive' }],
  ['VIP555', { purchasable: false, reason: 'exclusive_auction_only', tier: 'exclusive' }],
  // the four purchasable tiers -> exact prices, amount always > 0
  ['XYZ412', { purchasable: true, tier: 'free', amount: 49000 }],
  ['ABB770', { purchasable: true, tier: 'silver', amount: 99000 }],
  ['BMW412', { purchasable: true, tier: 'gold', amount: 149000 }],
  ['BMW007', { purchasable: true, tier: 'premium', amount: 199000 }],
];
for (const [code, expected] of QUOTE_CASES) {
  const real = getPersonalPurchaseQuote(code);
  const worker = personalPurchaseQuote(code);
  check(`getPersonalPurchaseQuote(${code}) matches expected shape`, real, expected);
  check(`personalPurchaseQuote(${code}) (Worker copy) matches expected shape`, worker, expected);
  check(`quote parity real vs Worker for ${code}`, worker, real);
  // The hard safety invariant this whole helper exists for: `amount` must
  // never be present-and-zero. Either it's a positive number (purchasable)
  // or it's simply absent (not purchasable / exclusive) — a caller that
  // blindly reads `.amount` without checking `.purchasable` first still
  // can never end up creating a real order for 0.
  for (const result of [real, worker]) {
    if ('amount' in result) {
      check(`amount for ${code} is a positive number when present`, result.amount > 0, true);
    } else {
      check(`amount for ${code} is correctly absent (not 0) when not purchasable`, result.purchasable, false);
    }
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
