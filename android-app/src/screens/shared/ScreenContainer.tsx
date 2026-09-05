import React from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, space } from '../../design-system/tokens';

export interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
}

/** Shared screen chrome: dark background, safe-area aware, optional scroll. */
export function ScreenContainer({ children, scroll = true, padded = true, style }: ScreenContainerProps) {
  if (scroll) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
        <ScrollView style={[styles.flex, style]} contentContainerStyle={[padded && styles.padded, styles.grow]}>
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <View style={[styles.flex, padded && styles.padded, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  padded: { padding: space.lg },
});
