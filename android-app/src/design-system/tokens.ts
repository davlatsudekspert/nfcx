/**
 * NFCSTORE premium design tokens.
 *
 * Source of truth: android/docs/05-DESIGN_SYSTEM.md §5.1. Gold is used as an
 * accent on near-black surfaces, never as a saturated fill — this is the
 * direct antidote to "juda yorqin casino-style bo'lmasin" from the brief.
 */

export const color = {
  bg: '#0A0A0A',
  bgDeep: '#050505',
  surface: '#171717',
  surfaceRaised: '#1E1E1E',
  border: 'rgba(255,255,255,0.08)',
  borderGold: 'rgba(215,182,93,0.35)',

  gold: '#D7B65D',
  goldHighlight: '#F5D77A',
  goldDark: '#8E6F2E',

  textPrimary: '#FFFFFF',
  textSecondary: '#A5A5A5',
  textTertiary: '#6B6B6B',

  success: '#3FBF7F',
  warning: '#E0B34A',
  danger: '#E5484D',

  // NFC ID tier accents — ported 1:1 from src/lib/pricing.js TIER_COLOR
  // (web app) so the Android tier badge always matches the web badge for
  // the same code. See src/lib/pricing.ts in this project.
  tierExclusive: '#d4af37',
  tierPremium: '#d8a34a',
  tierGold: '#f0c419',
  tierSilver: '#9aa3ad',
  tierFree: '#C58A55',
} as const;

export const gradient = {
  goldButton: ['#8E6F2E', '#D7B65D', '#F5D77A'] as const,
  goldShimmerSweep: ['transparent', 'rgba(245,215,122,0.35)', 'transparent'] as const,
  cardGlass: ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)'] as const,
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const type = {
  display: { fontSize: 32, fontWeight: '800' as const, lineHeight: 38 },
  h1: { fontSize: 24, fontWeight: '700' as const, lineHeight: 30 },
  h2: { fontSize: 18, fontWeight: '700' as const, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  mono: { fontSize: 15, fontWeight: '600' as const, fontFamily: 'monospace' },
} as const;

/** Android minimum touch target (brief §4). */
export const touchTarget = 48;

/** Standard motion timings/springs reused across every animated component
 * (brief §5 — "not too much animation", enforced via one shared config). */
export const motion = {
  pressScale: 0.97,
  pressDurationMs: 90,
  sheetSpring: { damping: 18, stiffness: 200 },
  modalDurationMs: 180,
  shimmerDurationMs: 1400,
  cardEntranceStaggerMs: 40,
  maxStaggeredItems: 6,
};
