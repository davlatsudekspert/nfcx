import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { color, depth, font, gradient, radius, space } from '../tokens';
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

/** Specular corner on the gold pill — the light source is top-left. */
const SPECULAR = ['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.05)', 'transparent'] as const;
const SPRING = { damping: 20, stiffness: 220 };
const RAIL_PAD = 3;
/** ≥ 44dp hit target inside the rail. */
const ITEM_MIN_HEIGHT = 44;

/**
 * Segmented control: a sunken rail milled into the surface, with a gold
 * billet that slides under the selected tab. Used for Auction's tabs, the
 * NFC read/write switch, etc. A tab is never hidden when empty (avoids
 * layout shift) — its content renders an empty state instead.
 */
export function PremiumTab({ items, activeKey, onChange }: PremiumTabProps) {
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [offsets, setOffsets] = useState<Record<string, number>>({});

  const activeWidth = widths[activeKey] ?? 0;
  const activeOffset = offsets[activeKey] ?? 0;

  const pillStyle = useAnimatedStyle(() => ({
    width: withSpring(activeWidth, SPRING),
    transform: [{ translateX: withSpring(activeOffset, SPRING) }],
  }));

  const onItemLayout = (key: string) => (e: LayoutChangeEvent) => {
    const { width, x } = e.nativeEvent.layout;
    setWidths((w) => (w[key] === width ? w : { ...w, [key]: width }));
    setOffsets((o) => (o[key] === x ? o : { ...o, [key]: x }));
  };

  return (
    <View style={styles.rail}>
      <View style={styles.railWell} pointerEvents="none" />
      {activeWidth > 0 && (
        <Animated.View style={[styles.pill, pillStyle]} pointerEvents="none">
          <LinearGradient
            colors={gradient.goldButton}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={SPECULAR}
            locations={[0, 0.4, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.pillLip} />
        </Animated.View>
      )}
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
            <Text
              style={[styles.label, active && styles.labelActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: 'row',
    position: 'relative',
    padding: RAIL_PAD,
    borderRadius: radius.md,
    backgroundColor: color.surfaceSunken,
  },
  /** The groove: a hairline and an inner shadow, drawn above the floor but
   * beneath the pill and the labels. */
  railWell: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.45)',
  },
  item: {
    flex: 1,
    minHeight: ITEM_MIN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  label: { fontFamily: font.sansSemi, fontSize: 14, lineHeight: 18, letterSpacing: 0.2, color: color.textSecondary },
  labelActive: { color: color.textOnGold },
  pill: {
    position: 'absolute',
    top: RAIL_PAD,
    bottom: RAIL_PAD,
    left: 0,
    borderRadius: radius.md - RAIL_PAD,
    overflow: 'hidden',
    backgroundColor: color.goldDark,
    ...depth.chip,
  },
  pillLip: { position: 'absolute', top: 0, left: 8, right: 8, height: 1, backgroundColor: 'rgba(255,252,235,0.55)' },
});
