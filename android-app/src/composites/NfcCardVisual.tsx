import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { color } from '../design-system/tokens';
import { resolveMediaUrl } from './mediaUrl';

export interface NfcCardVisualProps {
  avatarUrl?: string | null;
  size?: number;
  /** Turns the ring gold-on-gold for a verified profile. */
  verified?: boolean;
}

/**
 * The centerpiece of the NFC Profile View (brief §10): a large circular
 * avatar with a gold ring and a subtle animated glow — no card-preview
 * chrome, exactly as the brief specifies ("Karta preview shart emas").
 *
 * A failed or unresolvable avatar URL falls back to the placeholder rather
 * than leaving an empty hole where the face should be.
 */
export function NfcCardVisual({ avatarUrl, size = 128, verified = false }: NfcCardVisualProps) {
  const glow = useSharedValue(0.6);
  const uri = resolveMediaUrl(avatarUrl);
  // Keyed by URI rather than a boolean reset in an effect, so pointing at a
  // new avatar automatically clears a previous load failure.
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const failed = !!uri && failedUri === uri;

  useEffect(() => {
    glow.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [glow]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  const ringSize = size + 12;
  const showImage = !!uri && !failed;

  return (
    <View style={[styles.wrapper, { width: ringSize, height: ringSize }]}>
      <Animated.View
        style={[
          styles.glow,
          glowStyle,
          { width: ringSize + 16, height: ringSize + 16, borderRadius: (ringSize + 16) / 2 },
        ]}
      />
      <View style={[styles.ring, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }]}>
        {showImage ? (
          <Image
            source={{ uri }}
            onError={() => setFailedUri(uri ?? null)}
            style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
          />
        ) : (
          <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
            <Feather name="user" size={size * 0.4} color={color.textTertiary} />
          </View>
        )}
      </View>
      {verified && (
        <View style={styles.verifiedBadge}>
          <Feather name="check" size={12} color={color.textOnGold} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', backgroundColor: 'rgba(215,182,93,0.18)' },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: color.gold,
    backgroundColor: color.surface,
  },
  avatar: {},
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: color.surfaceRaised },
  verifiedBadge: {
    position: 'absolute',
    right: 2,
    bottom: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.gold,
    borderWidth: 2,
    borderColor: color.bg,
  },
});
