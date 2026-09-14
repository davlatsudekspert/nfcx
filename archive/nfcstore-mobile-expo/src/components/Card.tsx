import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';

import { A165, SHADOW } from '@/theme/css';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Maketdagi standart karta:
 *
 *   background: linear-gradient(165deg, var(--c1), var(--c2));
 *   border: 1px solid var(--rim);
 *   border-radius: 14px;
 *   box-shadow: 0 10px 24px rgba(0,0,0,.55);
 *
 * Spetsifikatsiya 7-bo'limi "soft shadow + subtle gold rim-glow"
 * talab qiladi: soya `SHADOW.card` dan, "rim-glow" esa temaning
 * yarim shaffof aksent chegarasi (`rim`) dan keladi.
 */
export function Card({
  children,
  style,
  radius = 14,
  shadow = 'card',
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  shadow?: keyof typeof SHADOW | 'none';
}) {
  const { theme } = useTheme();
  return (
    <LinearGradient
      colors={[theme.c1, theme.c2]}
      start={A165.start}
      end={A165.end}
      style={[
        {
          borderRadius: radius,
          borderWidth: 1,
          borderColor: theme.rim,
        },
        shadow === 'none' ? null : SHADOW[shadow],
        style,
      ]}
    >
      {children}
    </LinearGradient>
  );
}

/** Karta uslubidagi gradient — `TapScale` ichida fon sifatida ishlatiladi. */
export function CardBackdrop({ radius = 14 }: { radius?: number }) {
  const { theme } = useTheme();
  return (
    <LinearGradient
      colors={[theme.c1, theme.c2]}
      start={A165.start}
      end={A165.end}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: radius,
      }}
    />
  );
}
