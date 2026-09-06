import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';
import { color, elevation, motion, radius, space, type as typeTokens } from '../tokens';

export interface PremiumModalProps {
  visible: boolean;
  title?: string;
  onRequestClose: () => void;
  children: React.ReactNode;
}

const SLAB = ['#1C1B19', '#121212'] as const;
const TOP_LIP = ['rgba(255,255,255,0.12)', 'transparent'] as const;

/** Used sparingly — confirmation dialogs only (delete catalog item, discard
 * edits). A lifted slab of dark metal on a deep scrim, scale+fade entrance,
 * per android/docs/05-DESIGN_SYSTEM.md §5.2. */
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
              colors={SLAB}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.7, y: 1 }}
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
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  cardHolder: { width: '100%', maxWidth: 420 },
  card: {
    width: '100%',
    backgroundColor: '#141414',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.borderStrong,
    overflow: 'hidden',
    ...elevation.raised,
  },
  lip: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  body: { padding: space.xl },
  title: { ...typeTokens.h2, color: color.textPrimary, marginBottom: space.md, letterSpacing: 0.2 },
});
