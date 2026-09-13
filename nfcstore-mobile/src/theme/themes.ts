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
  /** Ekran foni (handoff: Obsidian) */
  bg: string;
  /** Sarlavha ortidagi yumshoq yorug'lik */
  glow: string;
  /** Karta gradienti: c1 -> c2 (handoff: Slate -> Graphite) */
  c1: string;
  c2: string;
  /** Aksent gradienti: a1 (yorug') -> a2 (to'q) (handoff: Champagne -> Antique gold) */
  a1: string;
  a2: string;
  /** Chegara (shaffof aksent) */
  rim: string;
  /** Asosiy matn (handoff: Off-white) */
  ink: string;
  /** So'ngan matn / faol bo'lmagan ikonka (handoff: Muted) */
  off: string;
  /** Bottom sheet foni */
  sheet: string;
  /** Rasm o'rnini bosuvchi chiziqlar (handoff: Placeholder) */
  ph1: string;
  ph2: string;
  phInk: string;
  /** Aksent ustidagi matn (gradient tugma ichidagi yozuv) */
  onAccent: string;

  /**
   * Handoff'da qo'shilgan yakuniy tokenlar (`design_handoff_nfcstore_app/README.md`,
   * "Color tokens" jadvali). Faqat `gold` presetida AYNAN handoff qiymatlari;
   * qolgan uchta preset (silver/midnight/bronze — handoff qamrovidan tashqari,
   * foydalanuvchi tanlovi sifatida saqlanadi) shu yangi rollarni o'z rang oilasi
   * ichida hisoblab beradi, shunda `Theme` turi barcha presetlarda bir xil qoladi.
   */
  /** Eng chuqur fon — freym ortidagi asos (handoff: Backdrop `#050508`) */
  backdrop: string;
  /** Standart chegara (handoff: Hairline `#232028`) */
  hairline: string;
  /** Interaktiv/to'ldirilgan element chegarasi (handoff: Warm hairline `#2a2620`) */
  warmHairline: string;
  /** Ikkilamchi aksent — NFC tab, tasdiqlangan nishon (handoff: Platinum `#c9ccd2`) */
  platinum: string;
  /** Ikkilamchi matn — birlamchi matndan xiraroq (handoff: Ash `#98918a`) */
  ash: string;
  /** Muvaffaqiyat / ochiq / to'langan (handoff: Verdant `#63d694`) */
  verdant: string;
  /** Xato / muvaffaqiyatsiz / o'qilmagan nuqta (handoff: Signal `#e2685f`) */
  signal: string;
};

export const THEMES: Record<ThemeKey, Theme> = {
  gold: {
    label: 'Black-Gold',
    // Handoff "Color tokens" jadvalidan AYNAN: Obsidian/Graphite/Slate/
    // Hairline/Champagne/Antique gold/Platinum/Off-white/Ash/Muted/
    // Verdant/Signal/Placeholder. Qiymatlar qo'lda o'zgartirilmaydi —
    // dizayn "final" deb belgilangan.
    bg: '#0a0805',
    glow: '#16110a',
    c1: '#141318',
    c2: '#0e0d11',
    a1: '#e8cfa0',
    a2: '#b99a5e',
    rim: 'rgba(232,207,160,.14)',
    ink: '#faf7f0',
    off: '#5f5a55',
    sheet: '#100c07',
    ph1: '#16151b',
    ph2: '#101016',
    phInk: 'rgba(232,207,160,.42)',
    onAccent: '#1a1508',
    backdrop: '#050508',
    hairline: '#232028',
    warmHairline: '#2a2620',
    platinum: '#c9ccd2',
    ash: '#98918a',
    verdant: '#63d694',
    signal: '#e2685f',
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
    backdrop: '#050608',
    hairline: '#232529',
    warmHairline: '#2a2d31',
    platinum: '#c9ccd2',
    ash: '#93989d',
    verdant: '#63d694',
    signal: '#e2685f',
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
    backdrop: '#03040a',
    hairline: '#1e2436',
    warmHairline: '#26305a',
    platinum: '#c9ccd2',
    ash: '#8a92ab',
    verdant: '#63d694',
    signal: '#e2685f',
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
    backdrop: '#060403',
    hairline: '#2a2118',
    warmHairline: '#32271b',
    platinum: '#c9ccd2',
    ash: '#a4948a',
    verdant: '#63d694',
    signal: '#e2685f',
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
  /** To'lov provayderlari — handoff "Brand glyph colors" qatori. */
  payme: '#00C1C1',
  click: '#1A73E8',
} as const;
