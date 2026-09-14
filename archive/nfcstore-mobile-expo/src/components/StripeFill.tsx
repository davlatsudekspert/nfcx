import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

import { useSvgId } from '@/lib/svgId';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Maketdagi rasm o'rnini bosuvchi chiziqli to'ldirish:
 *
 *   background: repeating-linear-gradient(135deg, var(--ph1) 0 Npx,
 *                                                 var(--ph2) Npx 2Npx)
 *
 * RN da `repeating-linear-gradient` yo'q, shuning uchun SVG `<Pattern>`
 * ishlatiladi: kengligi 2N bo'lgan ikki vertikal chiziq -45° ga
 * burilganda CSS ning 135° dagi "/" yo'nalishi chiqadi (135° o'qi
 * o'ng-past tomonga qaraydi, chiziqlar esa unga perpendikulyar).
 *
 * Haqiqiy rasm kelganda bu komponent butunlay almashtiriladi —
 * `imageUrl` bo'lsa <Image>, bo'lmasa shu.
 */
export function StripeFill({
  /** Bitta chiziq kengligi — maketda 6, 7, 8 yoki 10px. */
  step = 8,
  style,
  children,
}: {
  step?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const { theme } = useTheme();
  const id = useSvgId('stripe');

  return (
    <View style={style}>
      <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <Defs>
          <Pattern
            id={id}
            width={step * 2}
            height={step * 2}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-45)"
          >
            <Rect x={0} y={0} width={step} height={step * 2} fill={theme.ph1} />
            <Rect x={step} y={0} width={step} height={step * 2} fill={theme.ph2} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {children}
    </View>
  );
}
