import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { color, radius, space, type as typeTokens } from '../tokens';

type ToastTone = 'success' | 'warning' | 'danger' | 'info';
interface ToastItem { id: number; message: string; tone: ToastTone }

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <PremiumToastProvider>');
  return ctx;
}

const TONE_COLOR: Record<ToastTone, string> = {
  success: color.success,
  warning: color.warning,
  danger: color.danger,
  info: color.gold,
};

/** Queues toasts rather than overlapping them — see android/docs/05-DESIGN_SYSTEM.md §5.2. */
export function PremiumToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const show = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextId.current++;
    setQueue((q) => [...q, { id, message, tone }]);
    setTimeout(() => setQueue((q) => q.filter((t) => t.id !== id)), 3200);
  }, []);

  const current = queue[0];

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {current && (
        <Animated.View
          key={current.id}
          entering={SlideInDown.duration(220)}
          exiting={SlideOutDown.duration(180)}
          style={styles.wrapper}
          pointerEvents="none"
        >
          <View style={[styles.bar, { backgroundColor: TONE_COLOR[current.tone] }]} />
          <Text style={styles.text} numberOfLines={2}>
            {current.message}
          </Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: space.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surfaceRaised,
    borderRadius: radius.md,
    overflow: 'hidden',
    paddingVertical: space.md,
    paddingRight: space.md,
  },
  bar: { width: 4, alignSelf: 'stretch', marginRight: space.md },
  text: { ...typeTokens.body, color: color.textPrimary, flex: 1 },
});
