import React from 'react';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';
import { color, motion, radius, space, type as typeTokens } from '../tokens';

export interface PremiumModalProps {
  visible: boolean;
  title?: string;
  onRequestClose: () => void;
  children: React.ReactNode;
}

/** Used sparingly — confirmation dialogs only (delete catalog item, discard
 * edits). Scale+fade entrance, per android/docs/05-DESIGN_SYSTEM.md §5.2. */
export function PremiumModal({ visible, title, onRequestClose, children }: PremiumModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <Pressable style={styles.scrim} onPress={onRequestClose} accessibilityLabel="Yopish">
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Animated.View
            entering={ZoomIn.duration(motion.modalDurationMs)}
            exiting={ZoomOut.duration(motion.modalDurationMs)}
            style={styles.card}
          >
            {!!title && <Text style={styles.title}>{title}</Text>}
            {children}
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: color.surfaceRaised,
    borderRadius: radius.lg,
    padding: space.xl,
    borderWidth: 1,
    borderColor: color.border,
  },
  title: { ...typeTokens.h2, color: color.textPrimary, marginBottom: space.md },
});
