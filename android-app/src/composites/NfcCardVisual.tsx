import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { color, depth, gradient } from '../design-system/tokens';
import { resolveMediaUrl } from './mediaUrl';
import { EmbossOverlay } from './NfcChip';

export interface NfcCardVisualProps {
  avatarUrl?: string | null;
  size?: number;
  /** Adds the embossed gold check for a verified profile. */
  verified?: boolean;
  /** Slow breathing glow behind the ring. On for the one centrepiece avatar
   * on a profile; off for a small header avatar, which just wears its ring. */
  pulse?: boolean;
}

/**
 * The avatar as a gold-rimmed medallion, in the same metal as the cards: a
 * champagne-to-antique gold ring lit from the top-left, a hairline of dark
 * bezel between ring and photo so the ring reads as a raised edge, and a
 * soft gold halo behind it. A failed or unresolvable avatar URL falls back
 * to the placeholder rather than leaving an empty hole where the face
 * should be.
 */
export function NfcCardVisual({ avatarUrl, size = 128, verified = false, pulse = true }: NfcCardVisualProps) {
  const glow = useSharedValue(pulse ? 0.55 : 0.8);
  const uri = resolveMediaUrl(avatarUrl);
  // Keyed by URI rather than a boolean reset in an effect, so pointing at a
  // new avatar automatically clears a previous load failure.
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const failed = !!uri && failedUri === uri;

  useEffect(() => {
    if (!pulse) return;
    glow.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [glow, pulse]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  const ringWidth = Math.max(3, Math.round(size * 0.03));
  const bezel = Math.max(2, Math.round(size * 0.016));
  const ringSize = size + ringWidth * 2 + bezel * 2;
  const haloSize = ringSize + Math.round(size * 0.16);
  const showImage = !!uri && !failed;
  const badge = Math.max(18, Math.round(size * 0.19));

  return (
    <View style={[styles.wrapper, { width: ringSize, height: ringSize }]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.halo, glowStyle, { width: haloSize, height: haloSize, borderRadius: haloSize / 2 }]}
      />
      <View style={[styles.ring, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }]}>
        <LinearGradient
          colors={gradient.goldButton}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Specular: the top-left of the ring catches the light. */}
        <LinearGradient
          colors={['rgba(255,248,224,0.6)', 'rgba(255,248,224,0.05)', 'transparent']}
          locations={[0, 0.45, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.8, y: 0.9 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.bezel, { padding: bezel, margin: ringWidth, borderRadius: (ringSize - ringWidth * 2) / 2 }]}>
          {showImage ? (
            <Image
              source={{ uri }}
              onError={() => setFailedUri(uri ?? null)}
              style={{ width: size, height: size, borderRadius: size / 2 }}
            />
          ) : (
            <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
              <Feather name="user" size={size * 0.4} color={color.textTertiary} />
            </View>
          )}
        </View>
        <EmbossOverlay radius={ringSize / 2} />
      </View>
      {verified && (
        <View style={[styles.verifiedBadge, { width: badge, height: badge, borderRadius: badge / 2 }]}>
          <LinearGradient
            colors={gradient.goldButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Feather name="check" size={Math.round(badge * 0.5)} color={color.textOnGold} />
          <EmbossOverlay radius={badge / 2} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', backgroundColor: 'rgba(212,175,90,0.10)', boxShadow: '0 0 36px rgba(212,175,90,0.42)' },
  ring: { overflow: 'hidden', backgroundColor: color.goldDark, ...depth.emboss },
  bezel: { backgroundColor: color.bg },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: color.surfaceRaised },
  verifiedBadge: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: color.bg,
    backgroundColor: color.gold,
    ...depth.emboss,
  },
});
