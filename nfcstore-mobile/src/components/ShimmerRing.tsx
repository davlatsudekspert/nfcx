import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useSvgId } from '@/lib/svgId';
import { useTheme } from '@/theme/ThemeProvider';
import { SEEN_RING } from '@/theme/themes';

/**
 * Sekin aylanadigan "shimmer" halqa — avatar (9s) va istorya
 * doirachalari (11s) uchun bitta manba.
 *
 * CSS `conic-gradient` RN da ham, SVG da ham yo'q. Shuning uchun halqa
 * TO'RT CHORAK yoydan yasaladi va har bir yoyga o'z chizig'i bo'ylab
 * chiziqli gradient beriladi. Maketdagi conic to'xtash nuqtalari
 * (a2, a1, a2, a1, a2 — ya'ni har 90° da almashinadi) shu to'rt yoyga
 * AYNAN mos tushadi, demak natija ko'zga bir xil ko'rinadi.
 *
 * Ko'rilganda halqa kulrang conic ga o'tadi va aylanishi to'xtaydi
 * (`opacity .55–.6`) — spetsifikatsiyadagi "seen" holati.
 */
export function ShimmerRing({
  size,
  band,
  active,
  duration = 9000,
  seenOpacity = 0.6,
}: {
  size: number;
  band: number;
  /** `false` — kulrang, harakatsiz halqa. */
  active: boolean;
  duration?: number;
  seenOpacity?: number;
}) {
  const { theme } = useTheme();
  const spin = useSharedValue(0);
  const ringId = useSvgId('ring');

  useEffect(() => {
    if (active) {
      spin.value = 0;
      spin.value = withRepeat(
        withTiming(360, { duration, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      spin.value = 0;
    }
  }, [active, duration, spin]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  const c = size / 2;
  const r = c - band / 2;
  const top = { x: c, y: c - r };
  const right = { x: c + r, y: c };
  const bottom = { x: c, y: c + r };
  const left = { x: c - r, y: c };

  const [g1, g2] = active ? [theme.a2, theme.a1] : [SEEN_RING[0], SEEN_RING[1]];

  const quadrants = [
    { id: `${ringId}a`, from: top, to: right, c1: g1, c2: g2 },
    { id: `${ringId}b`, from: right, to: bottom, c1: g2, c2: g1 },
    { id: `${ringId}c`, from: bottom, to: left, c1: g1, c2: g2 },
    { id: `${ringId}d`, from: left, to: top, c1: g2, c2: g1 },
  ];

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          width: size,
          height: size,
          opacity: active ? 1 : seenOpacity,
        },
        spinStyle,
      ]}
    >
      <Svg width={size} height={size}>
        <Defs>
          {quadrants.map((q) => (
            <LinearGradient
              key={q.id}
              id={q.id}
              x1={q.from.x}
              y1={q.from.y}
              x2={q.to.x}
              y2={q.to.y}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={q.c1} />
              <Stop offset="1" stopColor={q.c2} />
            </LinearGradient>
          ))}
        </Defs>
        {quadrants.map((q) => (
          <Path
            key={q.id}
            d={`M ${q.from.x} ${q.from.y} A ${r} ${r} 0 0 1 ${q.to.x} ${q.to.y}`}
            stroke={`url(#${q.id})`}
            strokeWidth={band}
            fill="none"
          />
        ))}
      </Svg>
    </Animated.View>
  );
}
