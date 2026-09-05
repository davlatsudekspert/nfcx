import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { color } from '../design-system/tokens';

export interface NfcCardVisualProps {
  avatarUrl?: string | null;
  size?: number;
}

/**
 * The centerpiece of the NFC Profile View (brief §10): a large circular
 * avatar with a gold ring and a subtle animated glow — no card-preview
 * chrome, exactly as the brief specifies ("Karta preview shart emas").
 */
export function NfcCardVisual({ avatarUrl, size = 128 }: NfcCardVisualProps) {
  const glow = useSharedValue(0.6);

  useEffect(() => {
    glow.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [glow]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  const ringSize = size + 12;

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
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]} />
        ) : (
          <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
            <Feather name="user" size={size * 0.4} color={color.textTertiary} />
          </View>
        )}
      </View>
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
});
