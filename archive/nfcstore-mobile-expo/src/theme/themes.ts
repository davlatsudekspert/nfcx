/**
 * Tema presetlari — Claude Design maketidagi `THEMES` obyektining AYNAN
 * ko'chirmasi (NFCSTORE App.dc.html). Qiymatlar qo'lda o'zgartirilmagan:
 * maket tasdiqlangan, demak u yerdagi son shu yerda ham turishi kerak.
 *
 * Spetsifikatsiyadagi `border: #2d2518` alohida token sifatida saqlanmaydi:
 * u `rim` ning qattiq (nooaniq) ekvivalenti — rgba(240,207,122,.14) ni
 * bg #0a0805 ustiga qo'yganda aynan #2d2518 chiqadi. Shaffof variantni
 * saqlaymiz, chunki u karta gradienti ustida ham to'g'ri ishlaydi.
 */

export type ThemeKey = 'gold' | 'silver' | 'midnight' | 'bronze';

export type Theme = {
  label: string;
  /** Ekran foni */
  bg: string;
  /** Sarlavha ortidagi yumshoq yorug'lik */
  glow: string;
  /** Karta gradienti: c1 -> c2 */
  c1: string;
  c2: string;
  /** Aksent gradienti: a1 (yorug') -> a2 (to'q) */
  a1: string;
  a2: string;
  /** Chegara (shaffof aksent) */
  rim: string;
  /** Asosiy matn */
  ink: string;
  /** So'ngan matn / faol bo'lmagan ikonka */
  off: string;
  /** Bottom sheet foni */
  sheet: string;
  /** Rasm o'rnini bosuvchi chiziqlar */
  ph1: string;
  ph2: string;
  phInk: string;
  /** Aksent ustidagi matn (gradient tugma ichidagi yozuv) */
  onAccent: string;
};

export const THEMES: Record<ThemeKey, Theme> = {
  gold: {
    label: 'Black-Gold',
    bg: '#0a0805',
    glow: '#16110a',
    c1: '#171209',
    c2: '#120e08',
    a1: '#f0cf7a',
    a2: '#b3860f',
    rim: 'rgba(240,207,122,.14)',
    ink: '#f7f3ea',
    off: '#6b6355',
    sheet: '#100c07',
    ph1: '#191307',
    ph2: '#120e07',
    phInk: 'rgba(240,207,122,.45)',
    onAccent: '#150f04',
  },
  silver: {
    label: 'Silver',
    bg: '#08090a',
    glow: '#14171a',
    c1: '#16181b',
    c2: '#101214',
    a1: '#e6ebf0',
    a2: '#8e979f',
    rim: 'rgba(220,228,236,.16)',
    ink: '#f4f6f8',
    off: '#5d646b',
    sheet: '#0e1012',
    ph1: '#181b1e',
    ph2: '#111315',
    phInk: 'rgba(230,235,240,.42)',
    onAccent: '#0b0d0f',
  },
  midnight: {
    label: 'Midnight Blue',
    bg: '#05070f',
    glow: '#0c1225',
    c1: '#101526',
    c2: '#0b0f1c',
    a1: '#9db6f0',
    a2: '#3f5fb3',
    rim: 'rgba(150,175,240,.18)',
    ink: '#eef2fb',
    off: '#545d78',
    sheet: '#0a0e1a',
    ph1: '#131a2e',
    ph2: '#0d1220',
    phInk: 'rgba(157,182,240,.45)',
    onAccent: '#050810',
  },
  bronze: {
    label: 'Warm Bronze',
    bg: '#0b0704',
    glow: '#1b1108',
    c1: '#1b1209',
    c2: '#140d06',
    a1: '#e0a878',
    a2: '#8a5320',
    rim: 'rgba(224,168,120,.18)',
    ink: '#f6ece2',
    off: '#6d5d4e',
    sheet: '#120b06',
    ph1: '#1d1309',
    ph2: '#150e07',
    phInk: 'rgba(224,168,120,.45)',
    onAccent: '#150c05',
  },
};

export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[];
export const DEFAULT_THEME: ThemeKey = 'gold';

export const isThemeKey = (v: unknown): v is ThemeKey =>
  typeof v === 'string' && v in THEMES;

/** Maketdagi "ko'rilgan" (dim) halqa rangi — hech bir temaga bog'lanmagan. */
export const SEEN_RING = ['#4a4740', '#615d54', '#4a4740'] as const;

/**
 * Ijtimoiy tarmoqlarning O'Z brend ranglari. Egasining talabi: faqat
 * GLIF rangli bo'ladi, uni o'rab turgan doira esa temaning qora karta
 * uslubida qoladi — shunda "kamalak" effekti chiqmaydi.
 */
export const BRAND = {
  telegram: '#2AABEE',
  whatsapp: '#25D366',
  facebook: '#1877F2',
  /** Instagram bitta rang emas — gradient. Glif stroke'iga beriladi. */
  instagram: ['#FEDA75', '#FA7E1E', '#D62976', '#8134AF'] as const,
  instagramDot: '#D62976',
} as const;
