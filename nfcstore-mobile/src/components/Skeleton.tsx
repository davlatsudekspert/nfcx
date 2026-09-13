import { useEffect } from 'react';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';

/**
 * SKELETON — ma'lumot kelguncha turadigan "shakl".
 *
 * Nega spinner emas: aylanuvchi doira ekranning qayerda nima
 * chiqishini aytmaydi va kontent kelganda tartib SAKRAB o'zgaradi.
 * Skeleton esa bo'lajak elementning o'lchamini oldindan egallaydi —
 * kontent kelganda hech narsa siljimaydi va ilova tezroq ochilgandek
 * his qilinadi.
 *
 * Yaltirash `opacity` bilan: RN da kenglik bo'ylab harakatlanuvchi
 * gradient har kadrda layout hisoblashni talab qiladi, shaffoflik esa
 * to'g'ridan-to'g'ri GPU da ishlaydi — uzun ro'yxatlarda sezilarli
 * farq.
 */
export function Skeleton({
  width = '100%',
  height = 14,
  radius = 8,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [t]);

  const anim = useAnimatedStyle(() => ({ opacity: 0.4 + t.value * 0.35 }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { width, height, borderRadius: radius, backgroundColor: theme.c1 },
        anim,
        style,
      ]}
    />
  );
}

/** Home va Company dagi kartalar uchun tayyor skelet. */
export function CardSkeleton({ rows = 4 }: { rows?: number }) {
  const { theme } = useTheme();

  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: rows }, (_, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            padding: 15,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.rim,
            backgroundColor: theme.c2,
          }}
        >
          <Skeleton width={46} height={46} radius={23} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="62%" height={13} />
            <Skeleton width="86%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Gorizontal karusel uchun skelet. */
export function RowSkeleton({
  count = 4,
  width = 132,
  height = 172,
  radius = 16,
}: {
  count?: number;
  width?: number;
  height?: number;
  radius?: number;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16 }}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} width={width} height={height} radius={radius} />
      ))}
    </View>
  );
}
