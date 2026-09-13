/**
 * Handoff'ning rangга bog'liq bo'lmagan tokenlari — bo'shliq, radius,
 * elevatsiya va harakat vaqtlari. `design_handoff_nfcstore_app/README.md`
 * ("Space, radius, elevation" va "Motion" bo'limlari) dan AYNAN.
 *
 * Rang tokenlari `themes.ts` da (tema presetiga bog'liq), bu yerdagilar
 * esa tema o'zgarsa ham o'zgarmaydi — shuning uchun alohida fayl.
 */

/** Spacing scale 4 · 8 · 12 · 16 · 20 · 24 · 32 · 44 */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 44,
  /** Screen gutter — handoff: 20 */
  screenGutter: 20,
  /** Card padding — handoff: 13–18 */
  cardPaddingMin: 13,
  cardPaddingMax: 18,
} as const;

/**
 * Radius — bitta element klassiga bitta radius, ikkitasini bitta karta
 * ichida aralashtirmaslik kerak (handoff qoidasi).
 */
export const RADIUS = {
  /** Chip / status */
  chip: 7,
  chipMax: 9,
  /** Ikonka plitasi */
  iconTile: 12.5,
  iconTileMin: 11,
  iconTileMax: 14,
  /** Karta */
  card: 15,
  cardMin: 14,
  cardMax: 16,
  /** Hero / metall karta */
  hero: 19,
  heroMin: 18,
  heroMax: 20,
  /** Varaq — faqat yuqori burchaklar */
  sheetTop: 28,
  /** Avatar */
  avatar: 9999,
} as const;

/**
 * Elevatsiya — handoff "e1/e2/e3/sheet" nomlari bilan, `theme/css.ts`
 * dagi `shadow()` orqali RN ga o'girilgan (`SHADOW.e1` va h.k.).
 * Qiymatlar shu yerda emas, `css.ts` da — chunki `shadow()` platformaga
 * qarab hisoblanadi. Bu obyekt faqat spetsifikatsiyani hujjatlashtiradi:
 *
 *   e1    0 4px 12px rgba(0,0,0,.4)
 *   e2    0 10px 24px rgba(0,0,0,.5)
 *   e3    0 22px 50px rgba(0,0,0,.6)
 *   sheet 0 -20px 50px rgba(0,0,0,.6)
 */
export const ELEVATION_SPEC = {
  e1: { y: 4, blur: 12, opacity: 0.4 },
  e2: { y: 10, blur: 24, opacity: 0.5 },
  e3: { y: 22, blur: 50, opacity: 0.6 },
  sheet: { y: -20, blur: 50, opacity: 0.6 },
} as const;

/**
 * Harakat vaqtlari — handoff "Motion" jadvalidan. Byudjet: 400ms dan
 * oshmasin, bir ekranda bir vaqtning o'zida faqat bitta uzluksiz
 * animatsiya (story ring).
 */
export const MOTION = {
  /** Bosish: scale(.97), 120ms ease */
  press: 120,
  /** Ekran o'tishi: slide 24px + fade, 280ms */
  screenPush: 280,
  /** Umumiy element (avatar/mahsulot rasmi) morfi */
  sharedElement: 320,
  /** Bottom sheet ko'tarilishi */
  sheetUp: 280,
  /** Bottom sheet scrim so'nishi */
  sheetScrim: 180,
  /** Tab kontenti cross-fade */
  tabCrossfade: 200,
  /** Nav indikatori siljishi */
  navIndicator: 280,
  /** Rasm skeletondan fade-in */
  imageLoad: 240,
  /** Story halqasi — to'liq aylanish (uzluksiz, boshqasi bilan qo'shilmaydi) */
  storyRingMs: 11_000,
  /** Story progress — bitta rasm segmenti */
  storyProgressMs: 5_000,
  /** Pull-to-refresh chizig'i to'liq aylanishga o'tguncha */
  pullToRefreshSpin: 600,
  /** Hech qanday animatsiya shundan uzun bo'lmasin */
  maxDuration: 400,
} as const;
