import React, { useEffect } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { color, radius, space, touchTarget, type as typeTokens } from '../design-system/tokens';
import { haptics } from '../native/haptics';

export interface ContactButtonSpec {
  key: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
}

/**
 * Vertical, full-width contact buttons (brief §10): icon left, text
 * centered, NO arrow, black/gold border, a slow moving shine sweep. Each
 * button gets its own shimmer phase offset so the row doesn't pulse in
 * lockstep (a subtle premium detail, not a gimmick — one pass every ~5s).
 */
export function ContactButtons({ items }: { items: ContactButtonSpec[] }) {
  return (
    <View style={styles.list}>
      {items.map(({ key, ...item }, i) => (
        <ContactButtonRow key={key} {...item} delayMs={i * 350} />
      ))}
    </View>
  );
}

function ContactButtonRow({ icon, label, onPress, delayMs }: Omit<ContactButtonSpec, 'key'> & { delayMs: number }) {
  const sweep = useSharedValue(-1);

  useEffect(() => {
    sweep.value = withDelay(
      delayMs,
      withRepeat(withTiming(1, { duration: 2600, easing: Easing.linear }), -1, false),
    );
  }, [sweep, delayMs]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweep.value * 220 }],
  }));

  return (
    <Pressable
      onPress={() => {
        haptics.light();
        onPress();
      }}
      style={styles.button}
    >
      <View style={styles.sweepMask} pointerEvents="none">
        <Animated.View style={[styles.sweep, sweepStyle]} />
      </View>
      <Feather name={icon} size={18} color={color.gold} style={styles.icon} />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Builds the button spec list from whichever contact fields the record
 * actually has — never renders a dead button for a missing field. */
export function buildContactButtons(record: { phone?: string; tg?: string; whatsapp?: string; email?: string }): ContactButtonSpec[] {
  const items: ContactButtonSpec[] = [];
  if (record.phone) {
    items.push({ key: 'phone', icon: 'phone', label: "Qo'ng'iroq qilish", onPress: () => Linking.openURL(`tel:${record.phone}`) });
  }
  if (record.tg) {
    items.push({ key: 'telegram', icon: 'send', label: 'Telegram', onPress: () => Linking.openURL(`https://t.me/${record.tg!.replace(/^@/, '')}`) });
  }
  if (record.whatsapp) {
    items.push({ key: 'whatsapp', icon: 'message-circle', label: 'WhatsApp', onPress: () => Linking.openURL(`https://wa.me/${record.whatsapp!.replace(/\D/g, '')}`) });
  }
  if (record.email) {
    items.push({ key: 'email', icon: 'mail', label: 'Email', onPress: () => Linking.openURL(`mailto:${record.email}`) });
  }
  return items;
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  button: {
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.borderGold,
    backgroundColor: color.bgDeep,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sweepMask: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  sweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -110,
    width: 90,
    backgroundColor: 'rgba(245,215,122,0.08)',
    transform: [{ skewX: '-20deg' }],
  },
  icon: { position: 'absolute', left: space.lg },
  label: { ...typeTokens.h2, fontSize: 15, color: color.textPrimary, textAlign: 'center' },
});
