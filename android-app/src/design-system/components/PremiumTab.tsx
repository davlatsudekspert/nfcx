import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { color, radius, space, touchTarget, type as typeTokens } from '../tokens';
import { haptics } from '../../native/haptics';

export interface PremiumTabItem {
  key: string;
  label: string;
}

export interface PremiumTabProps {
  items: PremiumTabItem[];
  activeKey: string;
  onChange: (key: string) => void;
}

/** The rail is a machined groove; the indicator is a lit filament sliding in it. */
const INDICATOR = ['rgba(142,111,46,0.35)', color.gold, color.goldHighlight, 'rgba(142,111,46,0.35)'] as const;
const SPRING = { damping: 20, stiffness: 220 };

/**
 * Segmented control with a gold filament that slides between tabs. Used for
 * Auction's tabs, the company public profile's tabs, etc. A tab is never
 * hidden when empty (avoids layout shift) — its content renders an empty
 * state instead.
 */
export function PremiumTab({ items, activeKey, onChange }: PremiumTabProps) {
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [offsets, setOffsets] = useState<Record<string, number>>({});

  const activeWidth = widths[activeKey] ?? 0;
  const activeOffset = offsets[activeKey] ?? 0;

  const indicatorStyle = useAnimatedStyle(() => ({
    width: withSpring(activeWidth, SPRING),
    transform: [{ translateX: withSpring(activeOffset, SPRING) }],
  }));

  const onItemLayout = (key: string) => (e: LayoutChangeEvent) => {
    const { width, x } = e.nativeEvent.layout;
    setWidths((w) => (w[key] === width ? w : { ...w, [key]: width }));
    setOffsets((o) => (o[key] === x ? o : { ...o, [key]: x }));
  };

  return (
    <View style={styles.wrapper}>
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Pressable
            key={item.key}
            onLayout={onItemLayout(item.key)}
            onPress={() => {
              if (!active) haptics.selection();
              onChange(item.key);
            }}
            style={styles.item}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
      {activeWidth > 0 && (
        <Animated.View style={[styles.indicator, indicatorStyle]} pointerEvents="none">
          <LinearGradient
            colors={INDICATOR}
            locations={[0, 0.25, 0.75, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.indicatorFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    position: 'relative',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  item: {
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  label: { ...typeTokens.body, color: color.textSecondary, fontWeight: '600', letterSpacing: 0.2 },
  labelActive: { color: color.gold },
  indicator: { position: 'absolute', bottom: 0, height: 2, borderRadius: radius.pill, overflow: 'hidden' },
  indicatorFill: { flex: 1 },
});
