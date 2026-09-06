import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { color, elevation, radius, space, type as typeTokens } from '../tokens';

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

const TONE_ICON: Record<ToastTone, React.ComponentProps<typeof Feather>['name']> = {
  success: 'check-circle',
  warning: 'alert-triangle',
  danger: 'alert-octagon',
  info: 'info',
};

const SLAB = ['#1D1C1A', '#111111'] as const;

const TOAST_MS = 3200;

/** Queues toasts rather than overlapping them — see android/docs/05-DESIGN_SYSTEM.md §5.2. */
export function PremiumToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const show = useCallback((message: string, tone: ToastTone = 'info') => {
    const text = typeof message === 'string' ? message.trim() : '';
    if (!text) return;
    const id = nextId.current++;
    setQueue((q) => [...q, { id, message: text, tone }]);
    const timer = setTimeout(() => {
      timers.current = timers.current.filter((t) => t !== timer);
      setQueue((q) => q.filter((t) => t.id !== id));
    }, TOAST_MS);
    timers.current.push(timer);
  }, []);

  /* Clear any in-flight dismiss timers if the provider unmounts, so a
     setState never lands on a torn-down tree. */
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

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
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          <LinearGradient
            colors={SLAB}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={[styles.rail, { backgroundColor: TONE_COLOR[current.tone] }]} />
          <View style={styles.iconWrap}>
            <Feather name={TONE_ICON[current.tone]} size={16} color={TONE_COLOR[current.tone]} />
          </View>
          <Text style={styles.text} numberOfLines={3}>
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
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: '#141414',
    overflow: 'hidden',
    paddingVertical: space.md,
    paddingRight: space.md,
    ...elevation.raised,
  },
  rail: { width: 3, alignSelf: 'stretch' },
  iconWrap: { paddingHorizontal: space.md },
  text: { ...typeTokens.body, color: color.textPrimary, flex: 1 },
});
