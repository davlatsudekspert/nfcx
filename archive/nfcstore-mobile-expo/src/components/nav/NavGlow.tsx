import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { useSvgId } from '@/lib/svgId';

/**
 * Faol ikonka ortidan YUQORIGA taralayotgan yumshoq gold yorug'lik.
 *
 * Maketdagi CSS:
 *   width:46px; height:34px; border-radius:50%;
 *   background: radial-gradient(50% 50% at 50% 60%, var(--a1), transparent 70%);
 *   opacity:.22; filter: blur(6px);
 *
 * RN da `filter: blur()` yo'q. Lekin radial gradientning o'zi allaqachon
 * yumshoq — blur o'rniga oraliq to'xtash nuqtasi qo'shiladi, shunda
 * chekka yanada silliq o'chadi va natija blur bilan deyarli farq qilmaydi.
 */
export function NavGlow({
  color,
  width = 46,
  height = 34,
  opacity = 0.22,
}: {
  color: string;
  width?: number;
  height?: number;
  opacity?: number;
}) {
  const id = useSvgId('navGlow');

  return (
    <Svg
      width={width}
      height={height}
      pointerEvents="none"
      style={{ position: 'absolute', top: -2 }}
    >
      <Defs>
        <RadialGradient id={id} cx="50%" cy="60%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={color} stopOpacity={1} />
          {/* blur(6px) ning o'rnini bosuvchi oraliq nuqta */}
          <Stop offset="0.45" stopColor={color} stopOpacity={0.55} />
          <Stop offset="0.7" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse
        cx={width / 2}
        cy={height * 0.6}
        rx={width / 2}
        ry={height / 2}
        fill={`url(#${id})`}
        opacity={opacity}
      />
    </Svg>
  );
}
