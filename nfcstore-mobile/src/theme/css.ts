import { type ViewStyle } from 'react-native';

/**
 * CSS `linear-gradient(Xdeg, …)` -> expo-linear-gradient `start`/`end`.
 *
 * CSS da burchak "to top" dan soat yo'nalishi bo'yicha o'lchanadi
 * (0deg = yuqoriga, 90deg = o'ngga). RN da esa koordinata y pastga
 * qaraydi va gradient birlik kvadrat ichidagi ikki nuqta bilan
 * beriladi. Shuning uchun yo'nalish vektori: dx = sin θ, dy = -cos θ,
 * so'ng markazdan ikki tomonga yarim-yarim uzatiladi.
 *
 * Maketdagi har bir burchak (120, 135, 140, 150, 165, 180) shu yerdan
 * o'tadi — qo'lda hisoblangan sonlar kodga sochilib ketmasin.
 */
export function angle(deg: number): {
  start: { x: number; y: number };
  end: { x: number; y: number };
} {
  const rad = (deg * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  return {
    start: { x: 0.5 - dx / 2, y: 0.5 - dy / 2 },
    end: { x: 0.5 + dx / 2, y: 0.5 + dy / 2 },
  };
}

/** Maketda eng ko'p uchraydigan burchaklar — qayta hisoblamaslik uchun. */
export const A120 = angle(120);
export const A135 = angle(135);
export const A140 = angle(140);
export const A145 = angle(145);
export const A150 = angle(150);
export const A160 = angle(160);
export const A165 = angle(165);
export const A180 = angle(180);

/**
 * `#rrggbb` + alfa -> `rgba(r,g,b,a)`.
 *
 * Spetsifikatsiyada `rgba(21,15,4,.6)` kabi qiymatlar bor — 21,15,4 bu
 * Black-Gold temasining `onAccent` (#150f04) rangi. Boshqa temada
 * boshqa qiymat bo'lishi kerak, shuning uchun rang qo'lda yozilmaydi,
 * temadan olinib shu funksiya orqali shaffoflashtiriladi.
 */
export function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  const n = parseInt(full.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/**
 * ── SOYALAR ──────────────────────────────────────────────────────────
 *
 * MUHIM O'ZGARISH: ilgari soyalar Android'da `elevation` ga
 * aylantirilardi, ya'ni spetsifikatsiyadagi RANGLI "rim-glow"
 * (`0 0 18px -6px <accent>`) Android'da UMUMAN chizilmasdi — kartalar
 * shunchaki qora quti bo'lib ko'rinardi. Aynan shu narsa "dizayn
 * aytgandek chiroyli emas" degan e'tirozning asosiy sababi edi.
 *
 * React Native 0.76+ (Yangi Arxitektura yoqilgan, bizda `newArchEnabled:
 * true`) CSS `box-shadow` ni TO'G'RIDAN-TO'G'RI qo'llab-quvvatlaydi:
 * ikkala platformada ham rang, blur VA spread ishlaydi. Shuning uchun
 * spetsifikatsiyadagi qiymatlar shu yerda AYNAN o'sha ko'rinishda
 * saqlanadi.
 *
 * Aksent rangi temaga bog'liq, shuning uchun har biri funksiya:
 * chaqirilganda faol temaning `a1`/`a2` si beriladi.
 *
 * Ichki (`inset`) soyalar bu yerda YO'Q. Sababi: RN ichki soyani fon va
 * BOLALAR orasida chizadi, bizning kartalarimizda esa fon — butun
 * yuzani egallagan `LinearGradient` bolasi, ya'ni ichki soya uning
 * ostida qolib ko'rinmasdi. Shuning uchun `inset 0 1px 0 rgba(...)`
 * yuqori yorug'ligi alohida 1px qatlam bilan chiziladi
 * (`components/Card.tsx` dagi `TopHighlight`).
 */
export const SH = {
  /** Karta: `0 10px 24px rgba(0,0,0,.5), 0 0 18px -6px <a2>` */
  card: (a2: string): ViewStyle => ({
    boxShadow: `0px 10px 24px rgba(0, 0, 0, 0.5), 0px 0px 18px -6px ${a2}`,
  }),
  /** Tarif kartasi va mini NFC karta: `0 10px 22px …` */
  cardTight: (a2: string): ViewStyle => ({
    boxShadow: `0px 10px 22px rgba(0, 0, 0, 0.5), 0px 0px 18px -6px ${a2}`,
  }),
  /** Katalogdagi mini NFC karta — yorug'ligi biroz kengroq. */
  mini: (a2: string): ViewStyle => ({
    boxShadow: `0px 10px 22px rgba(0, 0, 0, 0.5), 0px 0px 20px -6px ${a2}`,
  }),
  /** 46px dumaloq ikonka: `0 4px 12px rgba(0,0,0,.55), 0 0 14px -4px <a2>` */
  iconCircle: (a2: string): ViewStyle => ({
    boxShadow: `0px 4px 12px rgba(0, 0, 0, 0.55), 0px 0px 14px -4px ${a2}`,
  }),
  /** Kontakt doirasi: `0 6px 16px rgba(0,0,0,.55), 0 0 16px -4px <a2>` */
  contact: (a2: string): ViewStyle => ({
    boxShadow: `0px 6px 16px rgba(0, 0, 0, 0.55), 0px 0px 16px -4px ${a2}`,
  }),
  /** Gold tugma: `0 8px 18px rgba(0,0,0,.5), 0 0 18px -6px <a1>` */
  goldButton: (a1: string): ViewStyle => ({
    boxShadow: `0px 8px 18px rgba(0, 0, 0, 0.5), 0px 0px 18px -6px ${a1}`,
  }),
  /** Hero: `0 18px 40px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.05)` */
  hero: (): ViewStyle => ({
    boxShadow:
      '0px 18px 40px rgba(0, 0, 0, 0.6), 0px 0px 0px 1px rgba(255, 255, 255, 0.05)',
  }),
  /** Hisob chipi: `0 6px 14px rgba(0,0,0,.4), 0 0 14px -6px <a2>` */
  chip: (a2: string): ViewStyle => ({
    boxShadow: `0px 6px 14px rgba(0, 0, 0, 0.4), 0px 0px 14px -6px ${a2}`,
  }),
  /** Faol filtr tugmasi: `0 6px 14px rgba(0,0,0,.45), 0 0 16px -6px <a1>` */
  pill: (a1: string): ViewStyle => ({
    boxShadow: `0px 6px 14px rgba(0, 0, 0, 0.45), 0px 0px 16px -6px ${a1}`,
  }),
  /** Feed katakchasi: `0 8px 18px rgba(0,0,0,.5), 0 0 14px -6px <a2>` */
  tile: (a2: string): ViewStyle => ({
    boxShadow: `0px 8px 18px rgba(0, 0, 0, 0.5), 0px 0px 14px -6px ${a2}`,
  }),
  /** Medal tashqi soyasi (ichki qatlamlar SVG bilan chiziladi). */
  medal: (): ViewStyle => ({ boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.55)' }),
  /** Bottom sheet: `0 -20px 50px rgba(0,0,0,.6)` */
  sheet: (): ViewStyle => ({ boxShadow: '0px -20px 50px rgba(0, 0, 0, 0.6)' }),
  /** Navigatsiya indikatori: `0 0 10px <a1>66` */
  navIndicator: (a1: string): ViewStyle => ({ boxShadow: `0px 0px 10px ${a1}66` }),
  /** Istorya halqasi: `0 0 14px -4px <a1>` */
  storyRing: (a1: string): ViewStyle => ({ boxShadow: `0px 0px 14px -4px ${a1}` }),
} as const;

/** Spetsifikatsiyadagi `inset 0 1px 0 rgba(255,255,255,.05)` — standart qiymat. */
export const INSET_TOP = 'rgba(255,255,255,.05)';
