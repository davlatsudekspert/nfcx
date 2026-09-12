import { Platform, type ViewStyle } from 'react-native';

/**
 * CSS `linear-gradient(Xdeg, …)` -> expo-linear-gradient `start`/`end`.
 *
 * CSS da burchak "to top" dan soat yo'nalishi bo'yicha o'lchanadi
 * (0deg = yuqoriga, 90deg = o'ngga). RN da esa koordinata y pastga
 * qaraydi va gradient birlik kvadrat ichidagi ikki nuqta bilan
 * beriladi. Shuning uchun yo'nalish vektori: dx = sin θ, dy = -cos θ,
 * so'ng markazdan ikki tomonga yarim-yarim uzatiladi.
 *
 * Maketdagi har bir burchak (120, 145, 150, 160, 165, 180) shu yerdan
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
export const A140 = angle(140);
export const A145 = angle(145);
export const A150 = angle(150);
export const A160 = angle(160);
export const A165 = angle(165);
export const A180 = angle(180);

/**
 * CSS `box-shadow: 0 Ypx Bpx rgba(0,0,0,α)` -> RN soyasi.
 *
 * Android'da rangli/yumshoq soya yo'q — faqat `elevation` bor va uning
 * kuchini biz tanlamaymiz. Shuning uchun Android uchun blur radiusidan
 * taxminiy elevation hisoblanadi. Natija iOS bilan piksel-aniq bir xil
 * bo'lmaydi (RN ning cheklovi, dizayn xatosi emas) — lekin qora fonda
 * farq deyarli sezilmaydi.
 */
export function shadow(y: number, blur: number, opacity: number): ViewStyle {
  if (Platform.OS === 'android') {
    return { elevation: Math.max(1, Math.round(blur / 3)) };
  }
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: y },
    shadowOpacity: opacity,
    shadowRadius: blur / 2,
  };
}

/** Maket qiymatlari: `0 10px 24px rgba(0,0,0,.55)` va hokazo. */
export const SHADOW = {
  card: shadow(10, 24, 0.55),
  soft: shadow(8, 20, 0.45),
  tile: shadow(6, 16, 0.5),
  tier: shadow(8, 18, 0.45),
  sheet: shadow(-20, 50, 0.6),
} as const;
