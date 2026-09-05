import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { color, radius, space, type as typeTokens } from '../tokens';
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

/** Segmented control with a gold underline that slides between tabs. Used
 * for Auction's 4 tabs, Company public profile's tabs, etc. A tab is never
 * hidden even when empty (brief-aligned: avoids layout shift) — its content
 * renders an empty state instead. */
export function PremiumTab({ items, activeKey, onChange }: PremiumTabProps) {
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [offsets, setOffsets] = useState<Record<string, number>>({});

  const activeWidth = widths[activeKey] ?? 0;
  const activeOffset = offsets[activeKey] ?? 0;

  const indicatorStyle = useAnimatedStyle(() => ({
    width: withSpring(activeWidth, { damping: 20, stiffness: 220 }),
    transform: [{ translateX: withSpring(activeOffset, { damping: 20, stiffness: 220 }) }],
  }));

  const onItemLayout = (key: string) => (e: LayoutChangeEvent) => {
    const { width, x } = e.nativeEvent.layout;
    setWidths((w) => ({ ...w, [key]: width }));
    setOffsets((o) => ({ ...o, [key]: x }));
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
      {activeWidth > 0 && <Animated.View style={[styles.indicator, indicatorStyle]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', position: 'relative', borderBottomWidth: 1, borderBottomColor: color.border },
  item: { paddingVertical: space.sm, paddingHorizontal: space.md },
  label: { ...typeTokens.body, color: color.textSecondary, fontWeight: '600' },
  labelActive: { color: color.gold },
  indicator: { position: 'absolute', bottom: 0, height: 2, backgroundColor: color.gold, borderRadius: radius.pill },
});
