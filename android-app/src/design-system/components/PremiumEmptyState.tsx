import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { color, radius, space, type as typeTokens } from '../tokens';
import { PremiumButton } from './PremiumButton';

export interface PremiumEmptyStateProps {
  icon?: React.ComponentProps<typeof Feather>['name'];
  title: string;
  description?: string;
  ctaLabel?: string;
  onPressCta?: () => void;
}

/** A turned metal disc: the light sits top-left, the fill falls away. */
const MEDALLION = ['#232120', '#161514', '#0F0F0F'] as const;
/** The halo the disc casts on the floor — this is what stops a big empty
 * region from reading as dead space. */
const HALO = ['rgba(215,182,93,0.10)', 'rgba(215,182,93,0.02)', 'transparent'] as const;

/**
 * Shown wherever there is genuinely nothing to display. It is a composed
 * object — medallion, one line of consequence, one quiet line of explanation,
 * at most one action — rather than a grey icon floating in a void.
 */
export function PremiumEmptyState({ icon = 'inbox', title, description, ctaLabel, onPressCta }: PremiumEmptyStateProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.medallionWrap}>
        <LinearGradient
          colors={HALO}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.halo}
          pointerEvents="none"
        />
        <View style={styles.medallion}>
          <LinearGradient
            colors={MEDALLION}
            locations={[0, 0.55, 1]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.medallionLip} pointerEvents="none" />
          <Feather name={icon} size={26} color={color.gold} />
        </View>
      </View>
      <Text style={styles.title}>{title}</Text>
      {!!description && <Text style={styles.description}>{description}</Text>}
      {!!ctaLabel && onPressCta && (
        <PremiumButton label={ctaLabel} onPress={onPressCta} variant="ghost" fullWidth={false} style={styles.cta} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    paddingVertical: space.xxl,
    paddingHorizontal: space.xl,
  },
  medallionWrap: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg },
  /* 168 wide against a 76 disc, offset by (76-168)/2 so it stays centred. */
  halo: { position: 'absolute', top: -46, left: -46, width: 168, height: 168, borderRadius: radius.pill },
  medallion: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: color.borderGold,
    backgroundColor: '#161514',
  },
  medallionLip: {
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
