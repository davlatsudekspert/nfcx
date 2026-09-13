import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Maketdagi ikonkalar — 24×24 viewBox, 1.6–1.7 stroke, yumaloq uchlar.
 *
 * Kutubxona qo'shilmadi: spetsifikatsiya ikonkalarning og'irligini aniq
 * belgilaydi ("Replace with the codebase's icon set ONLY if it matches
 * that weight"), tayyor to'plamlar esa boshqa qalinlikda keladi va
 * dumaloq gold plitalar ichida begona ko'rinadi.
 */

type G = { color: string; size?: number; width?: number };

const S = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24' });

/** Tasdiq belgisi doira ichida — "ID faol" qatori uchun. */
export function CheckCircleGlyph({ color, size = 19, width = 1.7 }: G) {
  return (
    <Svg {...S(size)}>
      <Circle cx={12} cy={12} r={8.6} stroke={color} strokeWidth={width} fill="none" />
      <Path
        d="M8.4 12.2l2.5 2.5 4.7-5"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** Plastik karta — "Jismoniy karta buyurtma qilish". */
export function CardGlyph({ color, size = 19, width = 1.7 }: G) {
  return (
    <Svg {...S(size)}>
      <Rect
        x={2.8}
        y={5.4}
        width={18.4}
        height={13.2}
        rx={2.6}
        stroke={color}
        strokeWidth={width}
        fill="none"
      />
      <Path d="M2.8 9.9h18.4" stroke={color} strokeWidth={width} fill="none" />
      <Path
        d="M6.4 14.6h3.4"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** Zanjir halqalari — "Havolalarni tahrirlash". */
export function LinkGlyph({ color, size = 19, width = 1.7 }: G) {
  return (
    <Svg {...S(size)}>
      <Path
        d="M10.3 13.7a3.9 3.9 0 000 0l-1.9 1.9a3.6 3.6 0 01-5.1-5.1l2.4-2.4a3.6 3.6 0 015.1 0"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M13.7 10.3a3.9 3.9 0 000 0l1.9-1.9a3.6 3.6 0 015.1 5.1l-2.4 2.4a3.6 3.6 0 01-5.1 0"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** Sovg'a qutisi — "Do'stga ID sovg'a qilish". */
export function GiftGlyph({ color, size = 19, width = 1.7 }: G) {
  return (
    <Svg {...S(size)}>
      <Rect
        x={3.4}
        y={9.4}
        width={17.2}
        height={10.6}
        rx={2.2}
        stroke={color}
        strokeWidth={width}
        fill="none"
      />
      <Path d="M2.4 9.4h19.2M12 9.4V20" stroke={color} strokeWidth={width} fill="none" />
      <Path
        d="M12 9.4C10.6 7 9.4 5.2 8 4.8a2 2 0 00-1 3.8c1.5.5 3.4.8 5 .8zM12 9.4c1.4-2.4 2.6-4.2 4-4.6a2 2 0 011 3.8c-1.5.5-3.4.8-5 .8z"
        stroke={color}
        strokeWidth={width}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** To'lov kartasi — "To'lovlar". */
export function PaymentGlyph({ color, size = 19, width = 1.7 }: G) {
  return (
    <Svg {...S(size)}>
      <Rect
        x={2.6}
        y={6}
        width={18.8}
        height={12}
        rx={2.6}
        stroke={color}
        strokeWidth={width}
        fill="none"
      />
      <Circle cx={9.8} cy={12} r={2.7} stroke={color} strokeWidth={width} fill="none" />
      <Circle cx={14.2} cy={12} r={2.7} stroke={color} strokeWidth={width} fill="none" />
    </Svg>
  );
}

/** Bino — kompaniya kartasidagi kichik belgi. */
export function BuildingGlyph({ color, size = 19, width = 1.7 }: G) {
  return (
    <Svg {...S(size)}>
      <Path
        d="M4.5 20.5V5.2a1.4 1.4 0 011.4-1.4h6.4a1.4 1.4 0 011.4 1.4v15.3M13.7 20.5v-9h4a1.4 1.4 0 011.4 1.4v7.6M3 20.5h18"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M7.4 7.7h3.2M7.4 11.3h3.2M7.4 14.9h3.2"
        stroke={color}
        strokeWidth={width - 0.2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** Toj — tarif medali ichida. */
export function CrownGlyph({ color, size = 20 }: G) {
  return (
    <Svg {...S(size)}>
      <Path
        d="M4 17.4l-1.4-9 5 3.4L12 5l4.4 6.8 5-3.4-1.4 9z"
        fill={color}
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <Path d="M4 19.6h16" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

/** NFC to'lqinlari — Home hero kartasi. */
export function NfcGlyph({ color, size = 30 }: G) {
  return (
    <Svg {...S(size)}>
      <Circle cx={7} cy={12} r={1.6} fill={color} />
      <Path
        d="M11 8.2a5.4 5.4 0 010 7.6M14.4 5.4a9.4 9.4 0 010 13.2M17.8 2.9a13.3 13.3 0 010 18.2"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** O'ngga qaragan chevron — kartalarning oxirida. */
export function ChevronRight({ color, size = 18, width = 1.7 }: G) {
  return (
    <Svg {...S(size)}>
      <Path
        d="M9.5 5.5l6.5 6.5-6.5 6.5"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** Chapga qaragan chevron — profildagi "orqaga" tugmasi. */
export function ChevronLeft({ color, size = 18, width = 1.7 }: G) {
  return (
    <Svg {...S(size)}>
      <Path
        d="M14.5 5.5L8 12l6.5 6.5"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** Qo'shish belgisi — "Yangi Company ID" va tab nishonlari. */
export function PlusGlyph({ color, size = 14, width = 1.8 }: G) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12">
      <Path
        d="M6 1.6v8.8M1.6 6h8.8"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
