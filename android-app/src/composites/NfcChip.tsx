import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { color, depth, gradient } from '../design-system/tokens';

/**
 * The contactless symbol — three arcs opening to the right — drawn as a
 * vector with a champagne-to-antique gold stroke so it reads as the same
 * metal as the chip beside it. Pure geometry: no image, no font glyph.
 */
export function NfcContactlessIcon({ size = 22, tint }: { size?: number; tint?: string }) {
  const stroke = tint ?? 'url(#nfcWaveGold)';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <SvgLinearGradient id="nfcWaveGold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={color.goldHighlight} />
          <Stop offset="0.55" stopColor={color.gold} />
          <Stop offset="1" stopColor={color.goldDark} />
        </SvgLinearGradient>
      </Defs>
      <Path d="M6.5 8.6a5 5 0 0 1 0 6.8" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
      <Path d="M10.6 5.4a9.6 9.6 0 0 1 0 13.2" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
      <Path d="M14.8 2.2a14.4 14.4 0 0 1 0 19.6" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Carries an emboss's *inset* lips above a gradient fill. On the New
 * Architecture an inset `boxShadow` paints on the view's own background
 * layer — beneath children — so a surface whose gold is an `absoluteFill`
 * gradient would bury its own lips. This transparent overlay sits last in
 * the tree and shows them; the outer part of the preset is clipped by the
 * host's `overflow: 'hidden'` and costs nothing.
 */
export function EmbossOverlay({ radius }: { radius: number }) {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.emboss, { borderRadius: radius }]} />;
}

export interface NfcChipProps {
  /** Chip width; height follows the EMV 4:3 proportion. */
  width?: number;
  /** Draw the contactless waves to the right of the chip. */
  contactless?: boolean;
}

/**
 * An embossed EMV-style contact chip: a gold billet (the button gradient,
 * lit from the top-left), the machined contact tracks etched into it, and
 * `depth.emboss` — a bright top lip and a dark lower lip — so it sits
 * *proud* of the card surface instead of being printed on it.
 */
export function NfcChip({ width = 42, contactless = true }: NfcChipProps) {
  const height = Math.round(width * 0.74);
  const r = Math.round(width * 0.16);
  return (
    <View style={styles.row}>
      <View style={[styles.chip, { width, height, borderRadius: r }]}>
        <LinearGradient
          colors={gradient.goldButton}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Specular: the top-left corner catches the light. */}
        <LinearGradient
          colors={['rgba(255,248,224,0.55)', 'rgba(255,248,224,0.08)', 'transparent']}
          locations={[0, 0.4, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Svg width={width} height={height} viewBox="0 0 42 31" style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgLinearGradient id="nfcChipTrack" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="rgba(80,52,6,0.7)" />
              <Stop offset="1" stopColor="rgba(60,38,4,0.55)" />
            </SvgLinearGradient>
          </Defs>
          {/* etched contact tracks */}
          <Path d="M0 10.5H13M29 10.5H42M0 20.5H13M29 20.5H42" stroke="url(#nfcChipTrack)" strokeWidth={1.1} />
          <Path d="M13 10.5V0M29 10.5V0M13 20.5V31M29 20.5V31" stroke="url(#nfcChipTrack)" strokeWidth={1.1} />
          <Rect x={13} y={10.5} width={16} height={10} rx={3} stroke="url(#nfcChipTrack)" strokeWidth={1.1} fill="none" />
          {/* a hairline of light along the etched edges */}
          <Path d="M0 11.6H13M29 11.6H42M0 21.6H13M29 21.6H42" stroke="rgba(255,244,214,0.28)" strokeWidth={0.6} />
        </Svg>
        <EmbossOverlay radius={r} />
      </View>
      {contactless && (
        <View style={styles.waves}>
          <NfcContactlessIcon size={Math.round(height * 0.78)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { overflow: 'hidden', ...depth.emboss, backgroundColor: color.goldDark },
  waves: { opacity: 0.95 },
  emboss: { ...depth.emboss, backgroundColor: 'transparent' },
});
