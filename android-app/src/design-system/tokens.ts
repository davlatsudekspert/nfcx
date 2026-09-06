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
  bg: '#0a0805',
  bgDeep: '#070503',
  bgWarm: '#0d0a06',
  surface: '#171209',
  surfaceRaised: '#1d170c',
  surfaceHigh: '#241c10',
  surfaceSunken: '#120e08',
  border: '#2d2518',
  borderStrong: '#3d3220',
  borderGold: 'rgba(212,175,90,0.35)',
  borderGoldStrong: 'rgba(240,207,122,0.6)',

  gold: '#d4af5a',
  goldHighlight: '#f0cf7a',
  goldDark: '#b3860f',
  goldMuted: 'rgba(212,175,90,0.14)',
  goldWash: 'rgba(212,175,90,0.06)',

  textPrimary: '#f3ece0',
  textSecondary: '#a89a82',
  textTertiary: '#6f6452',
  textOnGold: '#140F04',

  success: '#4ade80',
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
  goldButton: ['#f0cf7a', '#d4af5a', '#b3860f'] as const,
  goldShimmerSweep: ['transparent', 'rgba(255,244,214,0.55)', 'transparent'] as const,
  cardGlass: ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)'] as const,
  /** Default card fill — a warm near-black that lifts off `color.bg` without
   * reading as a flat grey rectangle. */
  cardSurface: ['#171209', '#120e08'] as const,
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

/**
 * Font families. Loaded once in App.tsx from @expo-google-fonts; until they
 * arrive Android falls back to the system face, so nothing ever renders
 * blank. Custom Android faces do NOT synthesise weights — every weight is
 * its own family name, so `fontWeight` is deliberately absent below.
 */
export const font = {
  serif: 'PlayfairDisplay_700Bold',
  serifMedium: 'PlayfairDisplay_600SemiBold',
  serifRegular: 'PlayfairDisplay_500Medium',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemi: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
} as const;

export const type = {
  /** Serif hero — page titles, the big number, the ID code on a card. */
  display: { fontSize: 32, lineHeight: 38, fontFamily: font.serif, letterSpacing: -0.2 },
  h1: { fontSize: 24, lineHeight: 30, fontFamily: font.serif },
  h2: { fontSize: 18, lineHeight: 24, fontFamily: font.serifMedium },
  h3: { fontSize: 16, lineHeight: 22, fontFamily: font.sansSemi },
  body: { fontSize: 15, lineHeight: 22, fontFamily: font.sans },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontFamily: font.sansSemi },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: font.sansMedium },
  overline: { fontSize: 11, lineHeight: 14, fontFamily: font.sansBold, letterSpacing: 1.2 },
  /** Numbers — views, prices, stats: tabular digits, ticker spacing. */
  mono: { fontSize: 15, lineHeight: 20, fontFamily: font.sansSemi, letterSpacing: 0.4, fontVariant: ['tabular-nums'] as ('tabular-nums')[] },
  monoLarge: { fontSize: 22, lineHeight: 28, fontFamily: font.serif, letterSpacing: 1.2, fontVariant: ['tabular-nums'] as ('tabular-nums')[] },
  /** Ticker-style stat number. */
  stat: { fontSize: 22, lineHeight: 26, fontFamily: font.sansSemi, letterSpacing: 0.6, fontVariant: ['tabular-nums'] as ('tabular-nums')[] },
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

/**
 * 3D depth — the tactile layer the brief asks for. Each preset is a real
 * multi-layer `boxShadow` (React Native 0.76+, New Architecture): a tight
 * dark contact shadow, a wide soft ambient shadow and a 1px gold rim glow,
 * so a card reads as resting *above* the floor rather than painted on it.
 * Pair with `elevation` only for legacy paths; boxShadow is the source of
 * truth on Android now.
 */
export const depth = {
  card: {
    boxShadow: '0 4px 12px rgba(0,0,0,0.6), 0 40px 80px -30px rgba(0,0,0,0.8), 0 0 0 1px rgba(212,175,90,0.12)',
  },
  cardHero: {
    boxShadow: '0 6px 16px rgba(0,0,0,0.65), 0 48px 96px -28px rgba(0,0,0,0.85), 0 0 0 1px rgba(212,175,90,0.22), 0 0 60px -10px rgba(212,175,90,0.35)',
  },
  chip: {
    boxShadow: '0 2px 6px rgba(0,0,0,0.5), 0 0 0 1px rgba(212,175,90,0.10)',
  },
  button: {
    boxShadow: '0 4px 10px rgba(0,0,0,0.55), 0 12px 28px -12px rgba(179,134,15,0.55)',
  },
  buttonPressed: {
    boxShadow: '0 1px 3px rgba(0,0,0,0.5), inset 0 2px 6px rgba(0,0,0,0.35)',
  },
  /** Pressed-metal look for embossed medallions (tier badges, step numbers). */
  emboss: {
    boxShadow: 'inset 0 1px 0 rgba(255,244,214,0.35), inset 0 -2px 4px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.5)',
  },
  glow: {
    boxShadow: '0 0 24px rgba(212,175,90,0.35)',
  },
} as const;

/** Tier medallion fills — copper, chrome and gold. */
export const medallion = {
  free: ['#d09265', '#8a5a34', '#5e3a1f'] as const,
  silver: ['#e8ecef', '#9aa3ad', '#5f6870'] as const,
  gold: ['#f0cf7a', '#d4af5a', '#b3860f'] as const,
  premium: ['#f6dc8f', '#d4af5a', '#a77c0c'] as const,
  exclusive: ['#fff0bf', '#e2bd60', '#9c7208'] as const,
} as const;

/** Standard motion timings/springs reused across every animated component
 * (brief §5 — "not too much animation", enforced via one shared config). */
export const motion = {
  pressScale: 0.97,
  pressDurationMs: 90,
  sheetSpring: { damping: 18, stiffness: 200 },
  modalDurationMs: 180,
  shimmerDurationMs: 1400,
  /** Metallic light-sweep cadence on gold CTAs/badges (brief: every 3-4 s). */
  sheenPeriodMs: 3600,
  sheenSweepMs: 1100,
  cardEntranceStaggerMs: 40,
  maxStaggeredItems: 6,
};

/**
 * METALL KARTA TIZIMI — physical-material palettes for the NFC ID cards.
 *
 * Every tier is BLACK — the brand's floor — differentiated only by how
 * brightly gold catches the light on it. Never a grey or brown card:
 * a diagonal base gradient (the metal itself), a brushed micro-texture, a
 * specular corner, one hairline edge, and a single sheen sweep. Nothing
 * glitters on its own — light only moves when the card enters or is
 * touched, which is what separates "premium" from "casino".
 *
 * `iridescent` exists only for the exclusive tier: a slow shimmer that
 * drifts through gold -> champagne -> warm white over the black base.
 * Card text is always white; gold is the accent, black is the material.
 */
export const metal = {
  exclusive: {
    base: ['#1c150a', '#171209', '#140f08', '#120e08'],
    brush: ['rgba(255,255,255,0.00)', 'rgba(245,215,122,0.05)', 'rgba(0,0,0,0.10)', 'rgba(245,215,122,0.04)', 'rgba(0,0,0,0.08)'],
    sheen: 'rgba(245,215,122,0.45)',
    hairline: 'rgba(245,215,122,0.62)',
    edgeTop: 'rgba(245,215,122,0.42)',
    text: '#f3ece0',
    subtext: 'rgba(255,255,255,0.62)',
    glow: 'rgba(215,182,93,0.45)',
    iridescent: ['rgba(215,182,93,0.24)', 'rgba(245,215,122,0.16)', 'rgba(255,244,214,0.12)', 'rgba(142,111,46,0.18)'],
  },
  premium: {
    base: ['#1a1409', '#171209', '#130f08', '#120e08'],
    brush: ['rgba(255,255,255,0.00)', 'rgba(255,255,255,0.045)', 'rgba(0,0,0,0.09)', 'rgba(245,215,122,0.03)', 'rgba(0,0,0,0.07)'],
    sheen: 'rgba(245,215,122,0.34)',
    hairline: 'rgba(215,182,93,0.48)',
    edgeTop: 'rgba(245,215,122,0.30)',
    text: '#f3ece0',
    subtext: 'rgba(255,255,255,0.60)',
    glow: 'rgba(215,182,93,0.32)',
    iridescent: null,
  },
  gold: {
    base: ['#191309', '#171209', '#130f08', '#120e08'],
    brush: ['rgba(255,255,255,0.00)', 'rgba(240,196,25,0.04)', 'rgba(0,0,0,0.09)', 'rgba(255,255,255,0.03)', 'rgba(0,0,0,0.07)'],
    sheen: 'rgba(240,205,120,0.30)',
    hairline: 'rgba(215,182,93,0.40)',
    edgeTop: 'rgba(240,205,120,0.26)',
    text: '#f3ece0',
    subtext: 'rgba(255,255,255,0.58)',
    glow: 'rgba(240,196,25,0.26)',
    iridescent: null,
  },
  silver: {
    base: ['#18130a', '#161109', '#130f08', '#120e08'],
    brush: ['rgba(255,255,255,0.00)', 'rgba(255,255,255,0.045)', 'rgba(0,0,0,0.09)', 'rgba(255,255,255,0.03)', 'rgba(0,0,0,0.07)'],
    sheen: 'rgba(255,255,255,0.26)',
    hairline: 'rgba(215,182,93,0.28)',
    edgeTop: 'rgba(255,255,255,0.20)',
    text: '#f3ece0',
    subtext: 'rgba(255,255,255,0.56)',
    glow: 'rgba(215,182,93,0.18)',
    iridescent: null,
  },
  free: {
    base: ['#17120a', '#151009', '#120e08', '#110d07'],
    brush: ['rgba(255,255,255,0.00)', 'rgba(255,255,255,0.035)', 'rgba(0,0,0,0.09)', 'rgba(215,182,93,0.02)', 'rgba(0,0,0,0.07)'],
    sheen: 'rgba(255,240,210,0.20)',
    hairline: 'rgba(215,182,93,0.22)',
    edgeTop: 'rgba(255,240,210,0.16)',
    text: '#f3ece0',
    subtext: 'rgba(255,255,255,0.54)',
    glow: 'rgba(215,182,93,0.14)',
    iridescent: null,
  },
} as const;

export type MetalKey = keyof typeof metal;
