import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { useSvgId } from '@/lib/svgId';

/**
 * Pastki navigatsiya ikonkalari.
 *
 * `d` yo'llari maketdan (NFCSTORE App.dc.html) AYNAN ko'chirilgan —
 * qayta chizilmagan. Har bir ikonka ikki holatda:
 *
 *   active   — gold gradient bilan TO'LDIRILGAN (outline emas),
 *              spetsifikatsiya: "filled with the gold gradient"
 *   inactive — yupqa kontur, muted rang ("keep inactive icons simple
 *              and muted so the active one stands out")
 *
 * To'ldirilgan holatdagi ikonka ichidagi "teshiklar" (kartadagi yuz,
 * binodagi derazalar) fon rangi bilan chiziladi — maketda ham shunday
 * (`stroke="var(--bg)"`), shuning uchun `bg` prop kerak.
 */

export type NavIconName = 'home' | 'search' | 'nfc' | 'company' | 'profile';

type ActiveProps = { size?: number; a1: string; a2: string; bg: string };
type IdleProps = { size?: number; color: string };

function useGrad() {
  return useSvgId('navGold');
}

function GradDefs({ id, a1, a2 }: { id: string; a1: string; a2: string }) {
  return (
    <Defs>
      <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={a1} />
        <Stop offset="1" stopColor={a2} />
      </LinearGradient>
    </Defs>
  );
}

/* ── Home ─────────────────────────────────────────────────────────── */

export function HomeActive({ size = 21, a1, a2 }: ActiveProps) {
  const id = useGrad();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <GradDefs id={id} a1={a1} a2={a2} />
      <Path
        d="M4 10.4L12 4l8 6.4V20a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-9.6z"
        fill={`url(#${id})`}
      />
    </Svg>
  );
}

export function HomeIdle({ size = 21, color }: IdleProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 10.4L12 4l8 6.4V20a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-9.6z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/* ── Katalog (ID karta) ───────────────────────────────────────────── */

export function KatalogActive({ size = 21, a1, a2, bg }: ActiveProps) {
  const id = useGrad();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <GradDefs id={id} a1={a1} a2={a2} />
      <Rect x={3} y={5} width={18} height={14} rx={3.4} fill={`url(#${id})`} />
      <Circle cx={9} cy={11.2} r={2} fill={bg} />
      <Path
        d="M5.9 16c.6-1.2 1.7-1.9 3.1-1.9s2.5.7 3.1 1.9M14.6 10h4.2M14.6 13.4h3"
        stroke={bg}
        strokeWidth={1.4}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

export function KatalogIdle({ size = 21, color }: IdleProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect
        x={3}
        y={5}
        width={18}
        height={14}
        rx={3.4}
        stroke={color}
        strokeWidth={1.7}
        fill="none"
      />
      <Circle cx={9} cy={11.5} r={2.1} stroke={color} strokeWidth={1.5} fill="none" />
      <Path
        d="M5.8 16.2c.6-1.3 1.8-2 3.2-2s2.6.7 3.2 2M14.6 10h4.2M14.6 13.4h3"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/* ── Company ──────────────────────────────────────────────────────── */

export function CompanyActive({ size = 21, a1, a2, bg }: ActiveProps) {
  const id = useGrad();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <GradDefs id={id} a1={a1} a2={a2} />
      <Path d="M4 21V6.4L12 3.4v17.6H4z" fill={`url(#${id})`} />
      <Path d="M12 8.2l7.4 2.4V21H12V8.2z" fill={`url(#${id})`} opacity={0.75} />
      <Path
        d="M7.4 9.2v.01M7.4 13v.01M16 14v.01"
        stroke={bg}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

export function CompanyIdle({ size = 21, color }: IdleProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 21V6.4L12 3v18M12 21h8V10l-8-2.6"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M7.4 9.2v.01M7.4 13v.01M15.6 13v.01M15.6 16.6v.01"
        stroke={color}
        strokeWidth={2.1}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/* ── Profile ──────────────────────────────────────────────────────── */

export function ProfileActive({ size = 21, a1, a2 }: ActiveProps) {
  const id = useGrad();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <GradDefs id={id} a1={a1} a2={a2} />
      <Circle cx={12} cy={8.2} r={3.9} fill={`url(#${id})`} />
      <Path
        d="M4.6 20.6c1.3-3.5 4.1-5.3 7.4-5.3s6.1 1.8 7.4 5.3H4.6z"
        fill={`url(#${id})`}
      />
    </Svg>
  );
}

export function ProfileIdle({ size = 21, color }: IdleProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={8.4} r={3.6} stroke={color} strokeWidth={1.7} fill="none" />
      <Path
        d="M4.8 20.4c1.3-3.4 4-5.1 7.2-5.1s5.9 1.7 7.2 5.1"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/* ── Search ───────────────────────────────────────────────────────── */

export function SearchActive({ size = 21, a1, a2, bg }: ActiveProps) {
  const id = useGrad();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <GradDefs id={id} a1={a1} a2={a2} />
      <Circle cx={10.5} cy={10.5} r={7.5} fill={`url(#${id})`} />
      <Circle cx={10.5} cy={10.5} r={4.2} fill={bg} />
      <Path
        d="M16.2 16.2L21 21"
        stroke={`url(#${id})`}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function SearchIdle({ size = 21, color }: IdleProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M16.2 16.2L21 21M18 10.5a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/* ── NFC (markaziy tab) ───────────────────────────────────────────── */

export function NfcActive({ size = 21, a1, a2 }: ActiveProps) {
  const id = useGrad();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <GradDefs id={id} a1={a1} a2={a2} />
      <Circle cx={6.2} cy={12} r={1.9} fill={`url(#${id})`} />
      <Path
        d="M10.6 8a5.6 5.6 0 010 8M14.2 5.2a9.7 9.7 0 010 13.6M17.8 2.6a13.6 13.6 0 010 18.8"
        stroke={`url(#${id})`}
        strokeWidth={2.1}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

export function NfcIdle({ size = 21, color }: IdleProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={6.2} cy={12} r={1.6} fill={color} />
      <Path
        d="M10.6 8a5.6 5.6 0 010 8M14.2 5.2a9.7 9.7 0 010 13.6M17.8 2.6a13.6 13.6 0 010 18.8"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

export const NAV_ICONS: Record<
  NavIconName,
  {
    Active: (p: ActiveProps) => React.ReactElement;
    Idle: (p: IdleProps) => React.ReactElement;
  }
> = {
  home: { Active: HomeActive, Idle: HomeIdle },
  search: { Active: SearchActive, Idle: SearchIdle },
  nfc: { Active: NfcActive, Idle: NfcIdle },
  company: { Active: CompanyActive, Idle: CompanyIdle },
  profile: { Active: ProfileActive, Idle: ProfileIdle },
};
