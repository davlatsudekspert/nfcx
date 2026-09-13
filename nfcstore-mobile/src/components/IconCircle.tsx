import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient,
  Stop,
} from 'react-native-svg';

import { useSvgId } from '@/lib/svgId';
import { SH } from '@/theme/css';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * 46×46 DUMALOQ ikonka plitasi — mijozning etalon maketidagi (to'rt
 * telefonli gold mockup) ikonka tili. Butun ilovada shu bitta shakl
 * takrorlanadi: Home ning ikkilamchi kartalari, Company logotipi,
 * profildagi kontakt tugmalari.
 *
 *   background: radial-gradient(70% 70% at 35% 25%,
 *                               rgba(240,207,122,.16), rgba(0,0,0,.55));
 *   border: 1px solid #b3860f;
 *   box-shadow: inset 0 1px 0 rgba(255,255,255,.14),
 *               0 4px 12px rgba(0,0,0,.55),
 *               0 0 14px -4px #b3860f;
 *
 * Radial gradient RN da yo'q — SVG bilan chiziladi. `inset 0 1px 0`
 * ham yo'q: dumaloq shaklda u yuqori yoyning yorug'ligi, shuning uchun
 * ichki doira vertikal gradient bilan shtrixlanadi (yuqorida oq, 45%
 * dan pastda shaffof).
 */
export function IconCircle({
  children,
  size = 46,
  /** Doira ichidagi radial yorug'lik rangi. Standart — temaning aksenti. */
  tint,
  /** Kontakt doirasi biroz kuchliroq soya oladi. */
  shadow = 'iconCircle',
  style,
}: {
  children?: ReactNode;
  size?: number;
  tint?: string;
  shadow?: 'iconCircle' | 'contact';
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const fillId = useSvgId('tileFill');
  const rimId = useSvgId('tileRim');
  const glow = tint ?? theme.a1;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1,
          borderColor: theme.a2,
          backgroundColor: 'rgba(0,0,0,.55)',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        SH[shadow](theme.a2),
        style,
      ]}
    >
      <Svg
        width={size}
        height={size}
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <Defs>
          {/* radial-gradient(70% 70% at 35% 25%, <glow .16>, rgba(0,0,0,.55)) */}
          <RadialGradient id={fillId} cx="35%" cy="25%" rx="70%" ry="70%">
            <Stop offset="0" stopColor={glow} stopOpacity={0.16} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0.55} />
          </RadialGradient>
          {/* inset 0 1px 0 rgba(255,255,255,.14) — yuqori yoydagi yorug'lik */}
          <SvgLinearGradient id={rimId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={0.2} />
            <Stop offset="0.45" stopColor="#ffffff" stopOpacity={0} />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${fillId})`} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 0.5}
          stroke={`url(#${rimId})`}
          strokeWidth={1}
          fill="none"
        />
      </Svg>
      {children}
    </View>
  );
}

/**
 * Gold bilan TO'LDIRILGAN dumaloq plita — "Yangi Company ID" kartasidagi
 * `+` uchun:
 *
 *   background: linear-gradient(140deg, #f0cf7a, #b3860f);
 *   box-shadow: inset 0 1px 0 rgba(255,255,255,.45),
 *               inset 0 -3px 6px rgba(0,0,0,.4),
 *               0 4px 14px rgba(0,0,0,.55), 0 0 18px -4px #f0cf7a;
 */
export function GoldCircle({
  children,
  size = 48,
  style,
}: {
  children?: ReactNode;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const id = useSvgId('goldTile');
  const shadeId = useSvgId('goldTileShade');

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.a2,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          boxShadow: `0px 4px 14px rgba(0, 0, 0, 0.55), 0px 0px 18px -4px ${theme.a1}`,
        },
        style,
      ]}
    >
      <Svg
        width={size}
        height={size}
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <Defs>
          <SvgLinearGradient id={id} x1="0.17" y1="0" x2="0.83" y2="1">
            <Stop offset="0" stopColor={theme.a1} />
            <Stop offset="1" stopColor={theme.a2} />
          </SvgLinearGradient>
          {/* inset 0 -3px 6px rgba(0,0,0,.4) — pastdagi soya */}
          <SvgLinearGradient id={shadeId} x1="0" y1="0.55" x2="0" y2="1">
            <Stop offset="0" stopColor="#000000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0.4} />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${shadeId})`} />
        {/* inset 0 1px 0 rgba(255,255,255,.45) */}
        <Circle
          cx={size / 2}
          cy={size / 2 + 0.5}
          r={size / 2 - 0.5}
          stroke="rgba(255,255,255,.45)"
          strokeWidth={1}
          fill="none"
        />
      </Svg>
      {children}
    </View>
  );
}
