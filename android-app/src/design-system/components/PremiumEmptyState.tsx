import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { color, depth, gradient, medallion, radius, space, type as typeTokens } from '../tokens';
import { GoldSheen } from './GoldSheen';
import { PremiumButton } from './PremiumButton';

export interface PremiumEmptyStateProps {
  icon?: React.ComponentProps<typeof Feather>['name'];
  title: string;
  description?: string;
  ctaLabel?: string;
  onPressCta?: () => void;
  /**
   * Floating 3D treatment: the icon sits in an embossed gold medallion with
   * a soft glow and a slow up-down bob (UI thread, ~3 s per cycle, off under
   * reduced motion). Opt-in per screen — the default disc stays static.
   */
  floating?: boolean;
}

/** The halo the disc casts on the floor — this is what stops a big empty
 * region from reading as dead space. */
const HALO = ['rgba(212,175,90,0.10)', 'rgba(212,175,90,0.02)', 'transparent'] as const;
const HALO_FLOATING = ['rgba(240,207,122,0.22)', 'rgba(212,175,90,0.06)', 'transparent'] as const;
/** Specular corner on the gold medallion. */
const SPECULAR = ['rgba(255,255,255,0.32)', 'rgba(255,255,255,0.06)', 'transparent'] as const;

const BOB_HALF_MS = 1500;
const BOB_PX = 7;

/**
 * Shown wherever there is genuinely nothing to display. It is a composed
 * object — medallion, one line of consequence, one quiet line of explanation,
 * at most one action — rather than a grey icon floating in a void.
 */
export function PremiumEmptyState({
  icon = 'inbox',
  title,
  description,
  ctaLabel,
  onPressCta,
  floating = false,
}: PremiumEmptyStateProps) {
  const bob = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!floating || reduceMotion) {
      cancelAnimation(bob);
      bob.value = 0;
      return;
    }
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: BOB_HALF_MS, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: BOB_HALF_MS, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(bob);
  }, [floating, reduceMotion, bob]);

  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -BOB_PX * bob.value }] }));
  /** The contact shadow shrinks and fades as the disc lifts. */
  const floorShadowStyle = useAnimatedStyle(() => ({
    opacity: 0.6 - bob.value * 0.3,
    transform: [{ scaleX: 1 - bob.value * 0.2 }],
  }));

  return (
    <View style={styles.wrapper}>
      <View style={styles.stage}>
        <LinearGradient
          colors={floating ? HALO_FLOATING : HALO}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.halo}
          pointerEvents="none"
        />
        {floating ? <Animated.View style={[styles.floorShadow, floorShadowStyle]} pointerEvents="none" /> : null}
        <Animated.View style={[styles.disc, floating ? styles.discGold : styles.discDark, bobStyle]}>
          {floating ? (
            <>
              <LinearGradient
                colors={medallion.gold}
                locations={[0, 0.55, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.7, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <LinearGradient
                colors={SPECULAR}
                locations={[0, 0.4, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <GoldSheen loop band={0.45} intensity={0.5} />
              <View style={styles.emboss} pointerEvents="none" />
            </>
          ) : (
            <>
              <LinearGradient
                colors={gradient.cardSurface}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <View style={styles.discLip} pointerEvents="none" />
            </>
          )}
          <Feather name={icon} size={26} color={floating ? color.textOnGold : color.gold} />
        </Animated.View>
      </View>
      <Text style={styles.title}>{title}</Text>
      {!!description && <Text style={styles.description}>{description}</Text>}
      {!!ctaLabel && onPressCta && (
        <PremiumButton label={ctaLabel} onPress={onPressCta} variant="ghost" fullWidth={false} style={styles.cta} />
      )}
    </View>
  );
}

const DISC = 76;

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    paddingVertical: space.xxl,
    paddingHorizontal: space.xl,
  },
  stage: { width: DISC, height: DISC + 14, alignItems: 'center', justifyContent: 'flex-start', marginBottom: space.lg },
  /* 168 wide against a 76 disc, offset by (76-168)/2 so it stays centred. */
  halo: { position: 'absolute', top: -46, left: -46, width: 168, height: 168, borderRadius: radius.pill },
  floorShadow: {
    position: 'absolute',
    bottom: 0,
    width: 52,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    boxShadow: '0 0 14px rgba(0,0,0,0.7)',
  },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  discDark: {
    borderColor: color.borderGold,
    backgroundColor: color.surface,
    ...depth.chip,
  },
  discGold: {
    borderColor: 'rgba(255,244,214,0.6)',
    backgroundColor: color.gold,
    boxShadow: `${depth.emboss.boxShadow}, 0 0 28px rgba(212,175,90,0.35)`,
  },
  emboss: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.pill, ...depth.emboss },
  discLip: {
    position: 'absolute',
    top: 0,
    left: 18,
    right: 18,
    height: 1,
    backgroundColor: 'rgba(255,238,196,0.30)',
  },
  title: { ...typeTokens.h2, color: color.textPrimary, textAlign: 'center', letterSpacing: 0.2 },
  description: {
    ...typeTokens.body,
    color: color.textSecondary,
    marginTop: space.sm,
    textAlign: 'center',
    maxWidth: 320,
  },
  cta: { marginTop: space.lg, paddingHorizontal: space.xl },
});
