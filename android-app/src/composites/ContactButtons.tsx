import React, { useEffect } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { color, radius, space, touchTarget, type as typeTokens } from '../design-system/tokens';
import { haptics } from '../native/haptics';
import { normalizeExtraLinks } from '../api/records';
import { displayUrl, resolveExternalUrl } from './mediaUrl';

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
      accessibilityRole="button"
      accessibilityLabel={label}
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

/** `Linking.openURL` rejects on a URI no installed app can handle (no
 * dialer on a tablet, no mail client). Swallowing it keeps a missing
 * handler from crashing the profile screen with an unhandled rejection. */
function open(url: string) {
  Linking.openURL(url).catch(() => {});
}

export interface ContactSource {
  phone?: string;
  tg?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  instagram?: string;
  linkedin?: string;
  facebook?: string;
  twitter?: string;
  /** Raw wire value — normalized here, so either shape is safe. */
  extraLinks?: unknown;
  /** When true the phone is not offered at all. The Worker already strips
   * `phone` for non-owners on a hidePhone record; honoring the flag here as
   * well is what makes the owner's own NFC preview truthful. */
  hidePhone?: boolean;
}

/** Builds the button spec list from whichever contact fields the record
 * actually has — never renders a dead button for a missing field. */
export function buildContactButtons(record: ContactSource): ContactButtonSpec[] {
  const items: ContactButtonSpec[] = [];

  if (record.phone && !record.hidePhone) {
    const phone = record.phone;
    items.push({ key: 'phone', icon: 'phone', label: "Qo'ng'iroq qilish", onPress: () => open(`tel:${phone}`) });
  }
  if (record.tg) {
    const tg = record.tg.replace(/^@/, '');
    items.push({ key: 'telegram', icon: 'send', label: 'Telegram', onPress: () => open(`https://t.me/${tg}`) });
  }
  if (record.whatsapp) {
    const wa = record.whatsapp.replace(/\D/g, '');
    if (wa) items.push({ key: 'whatsapp', icon: 'message-circle', label: 'WhatsApp', onPress: () => open(`https://wa.me/${wa}`) });
  }
  if (record.instagram) {
    const ig = record.instagram.replace(/^@/, '');
    items.push({ key: 'instagram', icon: 'instagram', label: 'Instagram', onPress: () => open(`https://instagram.com/${ig}`) });
  }
  if (record.linkedin) {
    const url = resolveExternalUrl(record.linkedin);
    if (url) items.push({ key: 'linkedin', icon: 'linkedin', label: 'LinkedIn', onPress: () => open(url) });
  }
  if (record.facebook) {
    const fb = record.facebook.replace(/^@/, '');
    items.push({ key: 'facebook', icon: 'facebook', label: 'Facebook', onPress: () => open(`https://facebook.com/${fb}`) });
  }
  if (record.twitter) {
    const tw = record.twitter.replace(/^@/, '');
    items.push({ key: 'twitter', icon: 'twitter', label: 'X / Twitter', onPress: () => open(`https://x.com/${tw}`) });
  }
  if (record.email) {
    const email = record.email;
    items.push({ key: 'email', icon: 'mail', label: 'Email', onPress: () => open(`mailto:${email}`) });
  }
  if (record.website) {
    const url = resolveExternalUrl(record.website);
    if (url) {
      items.push({ key: 'website', icon: 'globe', label: displayUrl(url) || 'Veb-sayt', onPress: () => open(url) });
    }
  }

  normalizeExtraLinks(record.extraLinks).forEach((link, i) => {
    const url = resolveExternalUrl(link.url);
    if (!url) return;
    items.push({
      key: `extra-${i}-${link.url}`,
      icon: 'link',
      label: link.label || displayUrl(url) || 'Havola',
      onPress: () => open(url),
    });
  });

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
    paddingHorizontal: space.xxl,
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
