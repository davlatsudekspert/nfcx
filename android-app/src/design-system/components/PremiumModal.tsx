import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';
import { color, depth, gradient, motion, radius, space, type as typeTokens } from '../tokens';

export interface PremiumModalProps {
  visible: boolean;
  title?: string;
  onRequestClose: () => void;
  children: React.ReactNode;
}

/** A faint gold breath in the top-left corner — the dialog is the one lit
 * object on a dark scrim. */
const BREATH = ['rgba(240,207,122,0.14)', 'rgba(212,175,90,0.03)', 'transparent'] as const;
const TOP_LIP = ['rgba(255,238,196,0.28)', 'rgba(255,238,196,0.05)', 'transparent'] as const;

/** Used sparingly — confirmation dialogs only (delete catalog item, discard
 * edits). A card-material slab on a deep warm scrim with `depth.cardHero`,
 * a serif title, scale+fade entrance. */
export function PremiumModal({ visible, title, onRequestClose, children }: PremiumModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <Pressable style={styles.scrim} onPress={onRequestClose} accessibilityLabel="Yopish">
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.cardHolder}>
          <Animated.View
            entering={ZoomIn.duration(motion.modalDurationMs)}
            exiting={ZoomOut.duration(motion.modalDurationMs)}
            style={styles.card}
          >
            <LinearGradient
              colors={gradient.cardSurface}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <LinearGradient
              colors={BREATH}
              locations={[0, 0.4, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.8, y: 0.9 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <LinearGradient colors={TOP_LIP} style={styles.lip} pointerEvents="none" />
            <View style={styles.body}>
              {!!title && <Text style={styles.title}>{title}</Text>}
              {children}
            </View>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(5,3,1,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  cardHolder: { width: '100%', maxWidth: 420 },
  card: {
    width: '100%',
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.borderGold,
    overflow: 'hidden',
    ...depth.cardHero,
  },
  lip: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  body: { padding: space.xl },
  title: { ...typeTokens.h2, color: color.textPrimary, marginBottom: space.md, letterSpacing: 0.2 },
});
