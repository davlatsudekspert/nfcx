import { View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  RadialGradient,
  Stop,
} from 'react-native-svg';

import { CrownGlyph } from '@/components/Glyphs';
import { useSvgId } from '@/lib/svgId';
import { SH } from '@/theme/css';

/**
 * Tarif medali — 46×46 "bosma metall" nishon:
 *
 *   background: radial-gradient(70% 70% at 32% 26%, <m1>, <m2> 62%, <m1>);
 *   border: 1px solid rgba(255,255,255,.22);
 *   box-shadow: inset 0  3px 5px rgba(255,255,255,.6),
 *               inset 0 -4px 7px rgba(0,0,0,.6),
 *               inset 0  0   0 3px rgba(0,0,0,.16),
 *               0 4px 10px rgba(0,0,0,.55);
 *
 * RN ichki soyani bolalar ostida chizadi, medalning foni esa SVG bolasi
 * — ya'ni `inset` shu yerda ishlamaydi. Shuning uchun uch qatlamning
 * hammasi SVG ning O'ZIDA chiziladi:
 *   • yuqoridagi oq yorug'lik  -> yuqoridan pastga oq gradient
 *   • pastdagi qora soya       -> pastdan yuqoriga qora gradient
 *   • `inset 0 0 0 3px`        -> 3px qalinlikdagi ichki qora halqa
 * Natijada metall "qavariq" ko'rinadi — spetsifikatsiyaning "embossed
 * medal, not a flat pill" talabi.
 */
export function TierMedal({
  m1,
  m2,
  size = 46,
}: {
  m1: string;
  m2: string;
  size?: number;
}) {
  const faceId = useSvgId('medalFace');
  const liteId = useSvgId('medalLite');
  const darkId = useSvgId('medalDark');
  const r = size / 2;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: r,
          backgroundColor: m2,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,.22)',
        },
        SH.medal(),
      ]}
    >
      <Svg
        width={size}
        height={size}
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <Defs>
          <RadialGradient id={faceId} cx="32%" cy="26%" rx="70%" ry="70%">
            <Stop offset="0" stopColor={m1} />
            <Stop offset="0.62" stopColor={m2} />
            <Stop offset="1" stopColor={m1} />
          </RadialGradient>
          <SvgGradient id={liteId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={0.6} />
            <Stop offset="0.34" stopColor="#ffffff" stopOpacity={0} />
          </SvgGradient>
          <SvgGradient id={darkId} x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor="#000000" stopOpacity={0.6} />
            <Stop offset="0.36" stopColor="#000000" stopOpacity={0} />
          </SvgGradient>
        </Defs>

        <Circle cx={r} cy={r} r={r} fill={`url(#${faceId})`} />
        <Circle cx={r} cy={r} r={r} fill={`url(#${liteId})`} />
        <Circle cx={r} cy={r} r={r} fill={`url(#${darkId})`} />
        {/* inset 0 0 0 3px rgba(0,0,0,.16) */}
        <Circle
          cx={r}
          cy={r}
          r={r - 1.5}
          stroke="rgba(0,0,0,.16)"
          strokeWidth={3}
          fill="none"
        />
      </Svg>
      <CrownGlyph color="rgba(0,0,0,.55)" size={Math.round(size * 0.43)} />
    </View>
  );
}

/**
 * Tarif metallari — spetsifikatsiyadagi qiymatlar.
 * Narxlar `hosting/worker.js` dagi `PERSONAL_TIER_PRICE` bilan bir xil
 * (qarang: `HomeScreen.tsx` dagi izoh).
 */
export const TIER_METALS = {
  free: { name: 'Bronze', m1: '#e0b083', m2: '#7d4a1e' },
  silver: { name: 'Silver', m1: '#eef2f6', m2: '#8b949c' },
  gold: { name: 'Gold', m1: '#f0cf7a', m2: '#a87c0d' },
  premium: { name: 'Premium', m1: '#d8c6f0', m2: '#6b4fa0' },
  exclusive: { name: 'Exclusive', m1: '#f6ead0', m2: '#5a4a22' },
} as const;

export type TierKey = keyof typeof TIER_METALS;
