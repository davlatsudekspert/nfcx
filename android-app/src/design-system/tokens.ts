/**
 * NFCSTORE premium design tokens.
 *
 * Source of truth: android/docs/05-DESIGN_SYSTEM.md §5.1. Gold is used as an
 * accent on near-black surfaces, never as a saturated fill — this is the
 * direct antidote to "juda yorqin casino-style bo'lmasin" from the brief.
 *
 * Layering model (mobile-first, deliberately NOT a shrunken web page):
 *   bgDeep      — the screen floor, behind everything
 *   bg          — default screen background
 *   surface     — a card sitting on the screen
 *   surfaceRaised / surfaceHigh — nested or focused content inside a card
 * Depth comes from these steps plus `elevation`, never from heavy borders.
 */

export const color = {
  bg: '#0A0A0A',
  bgDeep: '#050505',
  bgWarm: '#0C0A08',
  surface: '#171717',
  surfaceRaised: '#1E1E1E',
  surfaceHigh: '#242424',
  surfaceSunken: '#121212',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  borderGold: 'rgba(215,182,93,0.35)',
  borderGoldStrong: 'rgba(215,182,93,0.6)',

  gold: '#D7B65D',
  goldHighlight: '#F5D77A',
  goldDark: '#8E6F2E',
  goldMuted: 'rgba(215,182,93,0.14)',
  goldWash: 'rgba(215,182,93,0.06)',

  textPrimary: '#FFFFFF',
  textSecondary: '#A5A5A5',
  textTertiary: '#6B6B6B',
  textOnGold: '#140F04',

  success: '#3FBF7F',
  warning: '#E0B34A',
  danger: '#E5484D',
  info: '#5AA9E6',
  live: '#FF4D4D',

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
  /** Default card fill — a warm near-black that lifts off `color.bg` without
   * reading as a flat grey rectangle. */
  cardSurface: ['#1C1B19', '#141414'] as const,
  /** A featured/owned card: the same near-black with a faint gold breath at
   * the top-left corner only, so gold stays an accent, not a fill. */
  cardFeatured: ['rgba(215,182,93,0.14)', 'rgba(215,182,93,0.03)', 'rgba(20,20,20,1)'] as const,
  /** Screen-level ambient wash painted behind scroll content. */
  screenAmbient: ['rgba(215,182,93,0.07)', 'rgba(10,10,10,0)'] as const,
  /** Metal edge used for the NFC card visual / hero surfaces. */
  metalEdge: ['rgba(245,215,122,0.55)', 'rgba(142,111,46,0.15)', 'rgba(245,215,122,0.4)'] as const,
  tierExclusive: ['#3A2E12', '#1A1710'] as const,
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 8, md: 14, lg: 20, xl: 28, xxl: 34, pill: 999 } as const;

export const type = {
  display: { fontSize: 32, fontWeight: '800' as const, lineHeight: 38 },
  h1: { fontSize: 24, fontWeight: '700' as const, lineHeight: 30 },
  h2: { fontSize: 18, fontWeight: '700' as const, lineHeight: 24 },
  h3: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  overline: { fontSize: 11, fontWeight: '700' as const, lineHeight: 14, letterSpacing: 1.2 },
  mono: { fontSize: 15, fontWeight: '600' as const, fontFamily: 'monospace' },
  monoLarge: { fontSize: 22, fontWeight: '700' as const, fontFamily: 'monospace', letterSpacing: 1 },
} as const;

/** Android minimum touch target (brief §4). */
export const touchTarget = 48;

/**
 * Elevation presets. Android renders `elevation`; the shadow* props are kept
 * so the same style object stays meaningful if this ever runs on iOS, and so
 * the visual weight is described in one place rather than re-invented per
 * screen.
 */
export const elevation = {
  none: {},
  card: {
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  raised: {
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  /** Gold-tinted glow — reserved for the single most important element on a
   * screen (primary CTA, owned hero card). Never on ordinary list rows. */
  gold: {
    elevation: 10,
    shadowColor: color.gold,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
} as const;

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

/**
 * METALL KARTA TIZIMI — physical-material palettes for the NFC ID cards.
 *
 * Each tier is a real metal, lit from the top-left on a deep-black floor:
 * a diagonal base gradient (the metal itself), a brushed micro-texture, a
 * specular corner, one hairline edge, and a single sheen sweep. Nothing
 * glitters on its own — light only moves when the card enters or is
 * touched, which is what separates "premium" from "casino".
 *
 * `iridescent` exists only for the exclusive tier: a slow, Apple-Card-style
 * hue drift layered at low opacity over the gold base.
 */
export const metal = {
  exclusive: {
    base: ['#4A3A18', '#7A6229', '#C9A24A', '#3A2E14'],
    brush: ['rgba(255,255,255,0.00)', 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0.06)', 'rgba(255,255,255,0.04)', 'rgba(0,0,0,0.05)'],
    sheen: 'rgba(255,240,205,0.42)',
    hairline: 'rgba(245,215,122,0.55)',
    edgeTop: 'rgba(255,242,210,0.30)',
    text: '#FFF6E2',
    subtext: 'rgba(255,246,226,0.62)',
    glow: 'rgba(215,182,93,0.45)',
    iridescent: ['rgba(215,182,93,0.30)', 'rgba(126,96,200,0.20)', 'rgba(72,170,182,0.18)', 'rgba(224,120,86,0.22)'],
  },
  premium: {
    base: ['#2B2E32', '#454A50', '#6A7078', '#292B2F'],
    brush: ['rgba(255,255,255,0.00)', 'rgba(255,255,255,0.06)', 'rgba(0,0,0,0.07)', 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0.06)'],
    sheen: 'rgba(255,255,255,0.40)',
    hairline: 'rgba(215,182,93,0.50)',
    edgeTop: 'rgba(255,255,255,0.26)',
    text: '#F4F6F8',
    subtext: 'rgba(244,246,248,0.60)',
    glow: 'rgba(190,200,212,0.35)',
    iridescent: null,
  },
  gold: {
    base: ['#3E3014', '#6E5622', '#A8853A', '#3A2D13'],
    brush: ['rgba(255,255,255,0.00)', 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0.06)', 'rgba(255,255,255,0.04)', 'rgba(0,0,0,0.05)'],
    sheen: 'rgba(255,236,190,0.38)',
    hairline: 'rgba(240,196,25,0.45)',
    edgeTop: 'rgba(255,238,196,0.26)',
    text: '#FFF3DA',
    subtext: 'rgba(255,243,218,0.60)',
    glow: 'rgba(240,196,25,0.32)',
    iridescent: null,
  },
  silver: {
    base: ['#26292C', '#3B4045', '#575D64', '#24272A'],
    brush: ['rgba(255,255,255,0.00)', 'rgba(255,255,255,0.06)', 'rgba(0,0,0,0.07)', 'rgba(255,255,255,0.04)', 'rgba(0,0,0,0.06)'],
    sheen: 'rgba(255,255,255,0.34)',
    hairline: 'rgba(154,163,173,0.45)',
    edgeTop: 'rgba(255,255,255,0.22)',
    text: '#EFF2F5',
    subtext: 'rgba(239,242,245,0.58)',
    glow: 'rgba(154,163,173,0.28)',
    iridescent: null,
  },
  free: {
    base: ['#2E2117', '#4E3626', '#6E4E33', '#2A1E15'],
    brush: ['rgba(255,255,255,0.00)', 'rgba(255,255,255,0.04)', 'rgba(0,0,0,0.06)', 'rgba(255,255,255,0.03)', 'rgba(0,0,0,0.05)'],
    sheen: 'rgba(255,222,190,0.30)',
    hairline: 'rgba(197,138,85,0.45)',
    edgeTop: 'rgba(255,225,196,0.20)',
    text: '#F6E7DA',
    subtext: 'rgba(246,231,218,0.58)',
    glow: 'rgba(197,138,85,0.26)',
    iridescent: null,
  },
} as const;

export type MetalKey = keyof typeof metal;
