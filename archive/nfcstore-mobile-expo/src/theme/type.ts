import type { TextStyle } from 'react-native';

/**
 * Tipografiya — maketdagi `font: <weight> <size>/<line-height> <family>`
 * qisqartmalarining RN ekvivalenti.
 *
 * RN da `fontWeight` bilan variativ shrift tanlanmaydi: har bir
 * qalinlik ALOHIDA fayl, shuning uchun `fontFamily` ning o'zi
 * qalinlikni ham bildiradi (Manrope_600SemiBold va h.k.).
 *
 * CSS `line-height` nisbat sifatida beriladi (1.2, 1.4 …), RN esa
 * pikselda kutadi — shuning uchun `lh()` ko'paytiradi. Maketda ko'p
 * joyda `/1` turadi (ya'ni qat'iy bir qatorlik); unda balandlik
 * shriftning o'z o'lchamiga teng bo'ladi va matn vertikal markazda
 * turishi uchun `includeFontPadding: false` kerak (Android).
 */

export const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  monoSemibold: 'IBMPlexMono_600SemiBold',
} as const;

type Weight = 400 | 500 | 600 | 700 | 800;

const SANS: Record<Weight, string> = {
  400: FONTS.regular,
  500: FONTS.medium,
  600: FONTS.semibold,
  700: FONTS.bold,
  800: FONTS.extrabold,
};

/** Manrope. `ratio` — CSS line-height nisbati (standart 1 = bir qatorlik). */
export function sans(weight: Weight, size: number, ratio = 1): TextStyle {
  return {
    fontFamily: SANS[weight],
    fontSize: size,
    lineHeight: Math.round(size * ratio * 100) / 100,
    includeFontPadding: false,
  };
}

const MONO: Record<400 | 500 | 600, string> = {
  400: FONTS.mono,
  500: FONTS.monoMedium,
  600: FONTS.monoSemibold,
};

/** IBM Plex Mono — maketda 400, 500 va 600 ishlatilgan. */
export function mono(weight: 400 | 500 | 600, size: number, ratio = 1): TextStyle {
  return {
    fontFamily: MONO[weight],
    fontSize: size,
    lineHeight: Math.round(size * ratio * 100) / 100,
    includeFontPadding: false,
  };
}

/** Barcha shriftlar — `useFonts()` ga beriladigan xarita uchun. */
export const FONT_ASSETS = FONTS;
