import React from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { color, space } from '../../design-system/tokens';

export interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
}

/** Weight settling at the bottom of the screen — it gives a half-empty view
 * a horizon instead of an edge. */
const FLOOR_FADE = ['rgba(10,8,5,0)', 'rgba(0,0,0,0.55)'] as const;

/**
 * The floor a screen stands on: `color.bg` with a faint warm radial wash
 * bled in from the top centre, so every screen has a light source and never
 * reads as a dead flat rectangle. A single static SVG radial — no images,
 * no per-frame work.
 */
export function ScreenAmbient() {
  return (
    <>
      <View style={styles.ambient} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="screenWash" cx="50%" cy="0%" rx="70%" ry="100%" fx="50%" fy="0%">
              <Stop offset="0" stopColor={color.goldHighlight} stopOpacity="0.17" />
              <Stop offset="0.45" stopColor={color.gold} stopOpacity="0.05" />
              <Stop offset="1" stopColor={color.gold} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#screenWash)" />
        </Svg>
      </View>
      <LinearGradient
        colors={FLOOR_FADE}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.floor}
        pointerEvents="none"
      />
    </>
  );
}

/** Shared screen chrome: warm near-black floor, ambient wash, safe-area
 * aware, optional scroll. */
export function ScreenContainer({ children, scroll = true, padded = true, style }: ScreenContainerProps) {
  if (scroll) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
        <ScreenAmbient />
        <ScrollView
          style={[styles.flex, style]}
          contentContainerStyle={[padded && styles.padded, styles.grow]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <ScreenAmbient />
      <View style={[styles.flex, padded && styles.padded, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  flex: { flex: 1, backgroundColor: 'transparent' },
  grow: { flexGrow: 1 },
  padded: { padding: space.lg },
  ambient: { position: 'absolute', top: 0, left: 0, right: 0, height: 300 },
  floor: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 160 },
});
