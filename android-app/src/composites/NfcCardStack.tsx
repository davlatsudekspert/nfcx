import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { NfcIdCard } from './NfcIdCard';
import { color, space } from '../design-system/tokens';

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
  /** Kept for call-site compatibility; the wallet is always browsable. */
  initiallyExpanded?: boolean;
}

/** How far each card behind the front one peeks out to the right. */
const STEP = 52;
/** Space the last card needs on its right so it can still snap to the front. */
const EDGE = space.lg;

/**
 * The user's NFC IDs as a horizontal wallet with parallax depth: the front
 * card is sharp and full-size, the cards behind it peek out to the right,
 * each one smaller, dimmer and turned slightly away, the way a fanned deck
 * sits in the hand. Swiping slides the front card away and brings the next
 * one forward; snapping keeps a card always in the front position.
 *
 * Cheap by construction: a single shared value (`scrollX`) written by the
 * scroll handler on the UI thread drives every card's transform and the
 * page dots — no per-frame JS, no measuring. Each card sweeps its sheen
 * once on mount, staggered, and never again.
 */
export function NfcCardStack({ items }: NfcCardStackProps) {
  const { width: screenW } = useWindowDimensions();
  // Capped so a wide phone still shows a card, not a billboard (300 dp is
  // 189 dp tall at the ISO proportion; a 360 dp phone gets 276 x 174).
  const cardW = Math.min(300, screenW - EDGE * 2 - STEP);
  const scrollX = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  const count = items.length;
  if (count === 0) return null;

  const paddingRight = Math.max(EDGE, screenW - EDGE - cardW);

  return (
    <View>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        snapToInterval={STEP}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={[styles.track, { paddingLeft: EDGE, paddingRight }]}
      >
        {items.map((item, i) => (
          <WalletCard key={item.key} item={item} index={i} count={count} cardW={cardW} scrollX={scrollX} />
        ))}
      </Animated.ScrollView>

      {count > 1 && (
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {items.map((item, i) => (
            <Dot key={item.key} index={i} scrollX={scrollX} />
          ))}
        </View>
      )}
    </View>
  );
}

function WalletCard({
  item,
  index,
  count,
  cardW,
  scrollX,
}: {
  item: NfcCardStackItem;
  index: number;
  count: number;
  cardW: number;
  scrollX: SharedValue<number>;
}) {
  const overhang = cardW - STEP;

  const style = useAnimatedStyle(() => {
    // p = 0: this card is at the front. p < 0: it sits behind, to the
    // right. p > 0: it has been swiped past and slides fully off the left.
    const p = scrollX.value / STEP - index;
    const behind = Math.max(0, -p);
    const passed = Math.max(0, p);
    return {
      transform: [
        { perspective: 800 },
        { translateX: -passed * overhang },
        { translateY: interpolate(behind, [0, 3], [0, 14], Extrapolation.CLAMP) },
        { scale: interpolate(behind, [0, 1, 3], [1, 0.94, 0.84], Extrapolation.CLAMP) - passed * 0.04 },
        { rotateY: `${interpolate(behind, [0, 2], [0, -12], Extrapolation.CLAMP)}deg` },
      ],
      opacity: interpolate(behind, [0, 1, 3], [1, 0.62, 0.3], Extrapolation.CLAMP),
    };
  });

  return (
    <Animated.View style={[styles.slot, { width: index === count - 1 ? cardW : STEP, zIndex: count - index }, style]}>
      <NfcIdCard
        code={item.code}
        name={item.name}
        state={item.state}
        layout="carousel"
        width={cardW}
        index={index}
        isPrimary={item.isPrimary}
        verified={item.verified}
        statusLabel={item.statusLabel}
        views={item.views}
        sheen={index < 4}
        onPress={item.onPress}
      />
    </Animated.View>
  );
}

function Dot({ index, scrollX }: { index: number; scrollX: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const d = Math.abs(scrollX.value / STEP - index);
    return {
      opacity: interpolate(d, [0, 1], [1, 0.28], Extrapolation.CLAMP),
      transform: [{ scaleX: interpolate(d, [0, 1], [2.2, 1], Extrapolation.CLAMP) }],
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  track: { paddingVertical: space.md, alignItems: 'flex-start' },
  slot: { overflow: 'visible' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.xs },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.gold },
});
