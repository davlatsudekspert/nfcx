import React from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Polyline, Rect, Stop } from 'react-native-svg';

export interface BrandLogoProps {
  /** Rendered width/height in dp. */
  size?: number;
  /** Draw the gold-edged rounded-square badge behind the mark. */
  badge?: boolean;
  /** Single flat colour instead of the gold gradient (e.g. tab icons). */
  color?: string;
}

const C45 = Math.SQRT1_2;

/**
 * The NFCSTORE mark — the owner's brand artwork as vector: a slab-serif "N"
 * with a heavy diagonal, three NFC arcs above and below, and circuit
 * traces ending in hollow nodes, inside a gold-edged rounded square.
 * Geometry is identical to scripts/generate-brand-assets.mjs, so the
 * launcher icon, the native splash and every in-app mark are one drawing.
 */
export function BrandLogo({ size = 96, badge = true, color }: BrandLogoProps) {
  const fill = color ?? 'url(#nfc-gold)';
  const edge = color ?? 'url(#nfc-edge)';

  const arc = (cy: number, r: number, up: boolean, key: string) => {
    const sx = 512 - r * C45;
    const ex = 512 + r * C45;
    const y = up ? cy - r * C45 : cy + r * C45;
    return (
      <Path
        key={key}
        d={`M${sx} ${y} A${r} ${r} 0 0 ${up ? 1 : 0} ${ex} ${y}`}
        fill="none"
        stroke={fill}
        strokeWidth={16}
        strokeLinecap="round"
      />
    );
  };

  const trace = (dir: 1 | -1, y: number, jog: number, key: string) => {
    const x0 = dir < 0 ? 372 : 652;
    const x1 = x0 + dir * 46;
    const x2 = x1 + dir * 44;
    const x3 = x2 + dir * 30;
    return (
      <React.Fragment key={key}>
        <Polyline
          points={`${x0},${y} ${x1},${y} ${x2},${y + jog} ${x3},${y + jog}`}
          fill="none"
          stroke={fill}
          strokeWidth={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={x3 + dir * 16} cy={y + jog} r={13} fill="#050505" stroke={fill} strokeWidth={9} />
      </React.Fragment>
    );
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Defs>
        <LinearGradient id="nfc-gold" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#f0cf7a" />
          <Stop offset="0.5" stopColor="#d4af5a" />
          <Stop offset="1" stopColor="#b3860f" />
        </LinearGradient>
        <LinearGradient id="nfc-edge" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#f0cf7a" />
          <Stop offset="0.45" stopColor="#b3860f" />
          <Stop offset="1" stopColor="#f0cf7a" />
        </LinearGradient>
      </Defs>
      {badge && (
        <Rect x={196} y={196} width={632} height={632} rx={150} fill={color ? 'none' : '#0b0a08'} stroke={edge} strokeWidth={22} />
      )}
      <Path d="M382 356 H452 V668 H382 Z M572 356 H642 V668 H572 Z M382 356 H452 L642 668 H572 Z" fill={fill} />
      {arc(352, 62, true, 'a1')}
      {arc(352, 100, true, 'a2')}
      {arc(352, 138, true, 'a3')}
      {arc(672, 62, false, 'b1')}
      {arc(672, 100, false, 'b2')}
      {arc(672, 138, false, 'b3')}
      {trace(-1, 436, -34, 'l1')}
      {trace(-1, 486, -12, 'l2')}
      {trace(-1, 536, 12, 'l3')}
      {trace(-1, 586, 34, 'l4')}
      {trace(1, 436, -34, 'r1')}
      {trace(1, 486, -12, 'r2')}
      {trace(1, 536, 12, 'r3')}
      {trace(1, 586, 34, 'r4')}
    </Svg>
  );
}
