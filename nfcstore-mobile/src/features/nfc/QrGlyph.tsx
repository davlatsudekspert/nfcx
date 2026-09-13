import Svg, { Path, Rect } from 'react-native-svg';

/** QR belgisi — "profilni ulashish" amali uchun. */
export function QrGlyph({ color, size = 19 }: { color: string; size?: number }) {
  const w = 1.7;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={3.2} y={3.2} width={7} height={7} rx={1.6} stroke={color} strokeWidth={w} fill="none" />
      <Rect x={13.8} y={3.2} width={7} height={7} rx={1.6} stroke={color} strokeWidth={w} fill="none" />
      <Rect x={3.2} y={13.8} width={7} height={7} rx={1.6} stroke={color} strokeWidth={w} fill="none" />
      <Path
        d="M14 14h2.6v2.6H14zM19 14h1.8M14 19.4h2.6M19.4 18.4v2.4"
        stroke={color}
        strokeWidth={w}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
