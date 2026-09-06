import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { NfcIdCard, NFC_CARD_HEIGHT } from './NfcIdCard';
import { haptics } from '../native/haptics';
import { color, motion, radius, space, type as typeTokens } from '../design-system/tokens';

export interface NfcCardStackItem {
  /** Stable React key — the code for an owned card, `order-<id>` for a
   * pending purchase (two rows can legitimately share a code). */
  key: string;
  code: string;
  name?: string;
  state: 'owned' | 'pending';
  isPrimary?: boolean;
  verified?: boolean;
  statusLabel?: string;
  views?: number;
  onPress: () => void;
}

export interface NfcCardStackProps {
  items: NfcCardStackItem[];
  /** Start expanded — for screens where scanning beats depth. */
  initiallyExpanded?: boolean;
}

const CARD_H = NFC_CARD_HEIGHT.stack;
/** Vertical peek of each card behind the front one. */
const PEEK = 22;
/** How many cards behind the front one are actually drawn while collapsed. */
const MAX_PEEK = 3;
const GAP = space.md;
const SCALE_STEP = 0.035;
const OPACITY_STEP = 0.14;

const SPRING = { damping: motion.sheetSpring.damping, stiffness: motion.sheetSpring.stiffness, mass: 0.9 };

function collapsedDepth(i: number) {
  return Math.min(i, MAX_PEEK);
}

/**
 * The user's NFC IDs as a physical deck (design brief §2): cards stacked
 * with a small vertical offset and a scale/opacity falloff, so the edges of
 * the ones behind are visible and the front card stays fully readable.
 *
 * Interaction mirrors a real wallet: the front card acts (opens its ID), a
 * card behind fans the deck out, and every card — collapsed or expanded —
 * stays a real, labelled button. Only the front card sweeps its sheen, so a
 * deck reads as one object catching the light rather than five blinking
 * rectangles.
 *
 * Cheap by construction: one shared value drives every card's transform on
 * the UI thread, and while collapsed only the visible layers are mounted, so
 * a 20-ID deck costs the same as a 4-ID one until it is opened.
 */
export function NfcCardStack({ items, initiallyExpanded = false }: NfcCardStackProps) {
  const [fanned, setFanned] = useState(initiallyExpanded);
  const count = items.length;
  const stackable = count > 1;
  // A single card has nothing to fan out, so the expanded state is derived
  // rather than stored — a deck that shrinks to one card cannot get stuck.
  const expanded = fanned && stackable;
  const progress = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(expanded ? 1 : 0, SPRING);
  }, [expanded, progress]);

  const collapsedHeight = CARD_H + Math.min(count - 1, MAX_PEEK) * PEEK;
  const expandedHeight = count * CARD_H + Math.max(count - 1, 0) * GAP;

  const containerStyle = useAnimatedStyle(() => ({
    height: collapsedHeight + (expandedHeight - collapsedHeight) * progress.value,
  }));

  const toggle = useCallback(() => {
    haptics.selection();
    setFanned((v) => !v);
  }, []);

  // While collapsed, cards past the visible layers are not mounted at all.
  const rendered = useMemo(
    () => (expanded ? items : items.slice(0, MAX_PEEK + 1)),
    [expanded, items],
  );

  if (count === 0) return null;

  return (
    <View>
      <Animated.View style={[styles.stack, stackable ? containerStyle : { height: CARD_H }]}>
        {rendered.map((item, i) => (
          <StackedCard
            key={item.key}
            item={item}
            index={i}
            expanded={expanded}
            stackable={stackable}
            progress={progress}
            onExpand={toggle}
          />
        ))}
      </Animated.View>

      {stackable && (
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? "ID'lar to'plamini yig'ish" : `Barcha ID'lar, ${count} ta`}
          style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
        >
          <Text style={styles.toggleText}>
            {expanded ? "Yig'ish" : `Barcha ID'lar (${count})`}
          </Text>
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={color.gold} />
        </Pressable>
      )}
    </View>
  );
}

function StackedCard({
  item,
  index,
  expanded,
  stackable,
  progress,
  onExpand,
}: {
  item: NfcCardStackItem;
  index: number;
  expanded: boolean;
  stackable: boolean;
  progress: SharedValue<number>;
  onExpand: () => void;
}) {
  const depth = collapsedDepth(index);
  const collapsedY = depth * PEEK;
  const collapsedScale = 1 - depth * SCALE_STEP;
  const collapsedOpacity = 1 - depth * OPACITY_STEP;
  const expandedY = index * (CARD_H + GAP);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      transform: [
        { translateY: collapsedY + (expandedY - collapsedY) * p },
        { scale: collapsedScale + (1 - collapsedScale) * p },
      ],
      opacity: collapsedOpacity + (1 - collapsedOpacity) * p,
    };
  });

  // A card behind the front one fans the deck out instead of navigating —
  // you cannot read what you are tapping until it is on top.
  const actsOnPress = expanded || index === 0 || !stackable;

  return (
    <Animated.View
      style={[styles.card, { zIndex: 100 - index, elevation: Math.max(1, 12 - index) }, stackable ? style : undefined]}
      pointerEvents="box-none"
    >
      <NfcIdCard
        code={item.code}
        name={item.name}
        state={item.state}
        layout="stack"
        index={index}
        isPrimary={item.isPrimary}
        verified={item.verified}
        statusLabel={item.statusLabel}
        views={item.views}
        sheen={index === 0}
        onPress={actsOnPress ? item.onPress : onExpand}
        accessibilityHint={actsOnPress ? undefined : "To'plamni ochish uchun bosing"}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stack: { width: '100%' },
  card: { position: 'absolute', top: 0, left: 0, right: 0 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    marginTop: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceSunken,
  },
  togglePressed: { opacity: 0.7 },
  toggleText: { ...typeTokens.caption, color: color.gold },
});
