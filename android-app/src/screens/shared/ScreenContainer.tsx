import React from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { color, gradient, space } from '../../design-system/tokens';

export interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
}

/** The floor a screen stands on: deep black with a single ambient gold wash
 * bled in from the top-left, so even a sparse screen has a light source and
 * does not read as a dead black rectangle. */
export function ScreenAmbient() {
  return (
    <>
      <LinearGradient
        colors={gradient.screenAmbient}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.ambient}
        pointerEvents="none"
      />
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

/** Weight settling at the bottom of the screen — it gives a half-empty view
 * a horizon instead of an edge. */
const FLOOR_FADE = ['rgba(5,5,5,0)', 'rgba(0,0,0,0.55)'] as const;

/** Shared screen chrome: deep-black floor, ambient wash, safe-area aware,
 * optional scroll. */
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
  safe: { flex: 1, backgroundColor: color.bgDeep },
  flex: { flex: 1, backgroundColor: 'transparent' },
  grow: { flexGrow: 1 },
  padded: { padding: space.lg },
  ambient: { position: 'absolute', top: 0, left: 0, right: 0, height: 220 },
  floor: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 160 },
});
